const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeSGPA, computeCGPA } = require('../services/gradeCalculator');
const { auditRecord } = require('../middleware/auditLogger');

const router = express.Router();
router.use(verifyToken, requireRole('hod'));

// ─── GET /api/hod/dashboard ───────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    // Dept-wide subject submission status table
    const result = await pool.query(
      `SELECT fsm.id, s.name AS subject_name, s.code, s.semester, fsm.division, fsm.academic_year,
              u.name AS faculty_name, f.employee_id,
              COUNT(m.id) AS marks_entered,
              COUNT(st.id) AS enrolled,
              CASE
                WHEN COUNT(m.id) = 0 THEN 'not_started'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'published') = COUNT(m.id) AND COUNT(m.id) > 0 THEN 'published'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'approved') = COUNT(m.id) AND COUNT(m.id) > 0 THEN 'approved'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'submitted') > 0 THEN 'submitted'
                ELSE 'draft'
              END AS status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN students st ON st.division = fsm.division AND st.current_semester = s.semester
       LEFT JOIN marks m ON m.subject_id = s.id AND m.semester = fsm.semester AND m.academic_year = fsm.academic_year
       WHERE f.department = $1
       GROUP BY fsm.id, s.id, u.name, f.employee_id
       ORDER BY s.semester, s.code`,
      [req.user.dept]
    );

    // Pending revaluation requests
    const revalResult = await pool.query(
      `SELECT COUNT(*) AS pending FROM revaluation_requests r
       JOIN subjects s ON s.id = r.subject_id
       WHERE s.department = $1 AND r.status = 'pending'`,
      [req.user.dept]
    );

    res.json({
      subjects: result.rows,
      pendingRevaluations: parseInt(revalResult.rows[0].pending, 10),
    });
  } catch (err) {
    console.error('[HOD] Dashboard error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/marks/:subjectId ────────────────────────────────────────────
// Full mark list for approval review + anomaly detection
router.get('/marks/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester, academicYear } = req.query;

    const marksResult = await pool.query(
      `SELECT m.id AS mark_id, m.cie_marks, m.practical_marks, m.end_sem_marks,
              m.total, m.grade, m.grade_points, m.is_backlog, m.status,
              u.name AS student_name, s2.roll_no, s2.enrollment_no,
              sub.name AS subject_name, sub.code, sub.max_cie, sub.max_end_sem,
              sub.max_practical, sub.has_practical, sub.credits
       FROM marks m
       JOIN students s2 ON s2.id = m.student_id
       JOIN users u ON u.id = s2.user_id
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.subject_id = $1 AND m.semester = $2 AND m.academic_year = $3
       ORDER BY s2.roll_no`,
      [subjectId, semester, academicYear || '2024-25']
    );

    const rows = marksResult.rows;

    // Anomaly detection
    const anomalies = [];
    const totals = rows.map(r => parseFloat(r.total) || 0);
    const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const stdDev = totals.length > 1
      ? Math.sqrt(totals.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / totals.length)
      : 0;

    for (const row of rows) {
      const t = parseFloat(row.total) || 0;
      if (t === 0 && row.cie_marks === 0 && row.end_sem_marks === 0) {
        anomalies.push({ rollNo: row.roll_no, type: 'all_zero', message: 'All marks are zero — possible missing entry' });
      }
      const maxTotal = parseFloat(row.max_cie) + (row.has_practical ? parseFloat(row.max_practical) : 0) + parseFloat(row.max_end_sem);
      if (t === maxTotal) {
        anomalies.push({ rollNo: row.roll_no, type: 'full_marks', message: 'Full marks — verify entry' });
      }
      if (stdDev > 5 && Math.abs(t - avg) > 2.5 * stdDev) {
        anomalies.push({ rollNo: row.roll_no, type: 'outlier', message: `Statistical outlier — ${t.toFixed(1)} is far from class average of ${avg.toFixed(1)}` });
      }
    }

    res.json({ marks: rows, anomalies, classAverage: Math.round(avg * 10) / 10 });
  } catch (err) {
    console.error('[HOD] Marks review error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/approve/:subjectId ─────────────────────────────────────────
router.post('/approve/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester, academicYear } = req.body;

    const updateResult = await pool.query(
      `UPDATE marks SET status = 'approved', last_modified_at = NOW()
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3 AND status = 'submitted'
       RETURNING id`,
      [subjectId, semester, academicYear]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ error: 'No submitted marks found to approve for this subject' });
    }

    auditRecord({
      tableName: 'marks',
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'submitted' },
      newValue: { status: 'approved' },
      action: 'UPDATE',
      reason: 'HOD approved marks',
    });

    res.json({ message: `Approved ${updateResult.rows.length} mark entries. Subject is now locked for faculty edits.` });
  } catch (err) {
    console.error('[HOD] Approve error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/sendback/:subjectId ────────────────────────────────────────
router.post('/sendback/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester, academicYear, comment } = req.body;

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ error: 'A detailed comment is required when sending marks back for correction' });
    }

    await pool.query(
      `UPDATE marks SET status = 'draft', last_modified_at = NOW()
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3 AND status = 'submitted'`,
      [subjectId, semester, academicYear]
    );

    auditRecord({
      tableName: 'marks',
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'submitted' },
      newValue: { status: 'draft' },
      action: 'UPDATE',
      reason: `HOD sent back for correction: ${comment}`,
    });

    res.json({ message: 'Marks sent back to faculty for correction.', comment });
  } catch (err) {
    console.error('[HOD] Send back error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/publish ────────────────────────────────────────────────────
router.post('/publish', async (req, res) => {
  try {
    const { semester, academicYear, division, confirmPublish } = req.body;

    if (!confirmPublish) {
      return res.status(400).json({ error: 'Publish confirmation is required' });
    }

    // Ensure all subjects for this semester/division are approved
    const pendingCheck = await pool.query(
      `SELECT COUNT(*) FROM marks m
       JOIN faculty_subject_map fsm ON fsm.subject_id = m.subject_id
       JOIN faculty f ON f.id = fsm.faculty_id
       WHERE m.semester = $1 AND m.academic_year = $2 AND fsm.division = $3
       AND f.department = $4 AND m.status NOT IN ('approved','published')`,
      [semester, academicYear, division, req.user.dept]
    );

    const pendingCount = parseInt(pendingCheck.rows[0].count, 10);
    if (pendingCount > 0) {
      return res.status(400).json({
        error: `${pendingCount} mark entries are not yet approved. All marks must be approved before publishing.`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Publish all approved marks
      await client.query(
        `UPDATE marks SET status = 'published', last_modified_at = NOW()
         WHERE subject_id IN (
           SELECT fsm.subject_id FROM faculty_subject_map fsm
           JOIN faculty f ON f.id = fsm.faculty_id
           WHERE fsm.semester = $1 AND fsm.academic_year = $2 AND fsm.division = $3 AND f.department = $4
         ) AND semester = $1 AND academic_year = $2 AND status = 'approved'`,
        [semester, academicYear, division, req.user.dept]
      );

      // Update or insert publish status record
      await client.query(
        `INSERT INTO result_publish_status (semester, academic_year, department, division, status, published_by, published_at)
         VALUES ($1, $2, $3, $4, 'published', $5, NOW())
         ON CONFLICT (semester, academic_year, department, division)
         DO UPDATE SET status='published', published_by=$5, published_at=NOW()`,
        [semester, academicYear, req.user.dept, division, req.user.id]
      );

      auditRecord({
        tableName: 'result_publish_status',
        recordId: parseInt(semester, 10),
        changedBy: req.user.id,
        oldValue: { status: 'approved' },
        newValue: { status: 'published' },
        action: 'UPDATE',
        reason: `HOD published Semester ${semester} results for ${division} division`,
      });

      await client.query('COMMIT');
      res.json({ message: `Semester ${semester} results published. Students can now view their results.` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[HOD] Publish error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/analytics ───────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  try {
    const { semester, academicYear } = req.query;

    const marksResult = await pool.query(
      `SELECT m.grade, m.grade_points, m.total, m.is_backlog,
              s.credits, s.semester AS sub_semester, u.name AS student_name, s2.roll_no
       FROM marks m
       JOIN students s2 ON s2.id = m.student_id
       JOIN users u ON u.id = s2.user_id
       JOIN subjects s ON s.id = m.subject_id
       WHERE s.department = $1
         AND ($2::int IS NULL OR m.semester = $2)
         AND ($3::text IS NULL OR m.academic_year = $3)
         AND m.status = 'published'
       ORDER BY m.semester, s2.roll_no`,
      [req.user.dept, semester || null, academicYear || null]
    );

    const rows = marksResult.rows;
    const total = rows.length;
    const passed = rows.filter(r => r.grade !== 'F').length;
    const gradeDistribution = {};
    for (const r of rows) {
      gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    }

    // SGPA distribution for students
    const studentSGPAs = {};
    for (const r of rows) {
      if (!studentSGPAs[r.roll_no]) studentSGPAs[r.roll_no] = { subjects: [] };
      studentSGPAs[r.roll_no].subjects.push({ credits: r.credits, gradePoints: parseFloat(r.grade_points) || 0 });
    }
    const sgpaValues = Object.values(studentSGPAs).map(s => computeSGPA(s.subjects));
    const avgSGPA = sgpaValues.length > 0
      ? Math.round((sgpaValues.reduce((a, b) => a + b, 0) / sgpaValues.length) * 100) / 100
      : 0;

    // Faculty compliance
    const complianceResult = await pool.query(
      `SELECT u.name AS faculty_name, f.employee_id,
              COUNT(fsm.id) AS total_subjects,
              COUNT(fsm.id) FILTER (WHERE EXISTS (
                SELECT 1 FROM marks m WHERE m.subject_id = fsm.subject_id
                AND m.status IN ('submitted','approved','published')
              )) AS submitted_count
       FROM faculty_subject_map fsm
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       WHERE f.department = $1
       GROUP BY u.name, f.employee_id`,
      [req.user.dept]
    );

    res.json({
      total,
      passed,
      failed: total - passed,
      passPercentage: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
      gradeDistribution,
      sgpaValues,
      averageSGPA: avgSGPA,
      facultyCompliance: complianceResult.rows,
    });
  } catch (err) {
    console.error('[HOD] Analytics error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/audit-log ───────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const result = await pool.query(
      `SELECT a.id, a.table_name, a.record_id, a.action, a.old_value, a.new_value,
              a.reason, a.created_at, a.ip_address, a.user_agent,
              u.name AS changed_by_name, u.role AS changed_by_role
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.changed_by
       WHERE (u.department = $1 OR a.changed_by IS NULL)
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.dept, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_log a LEFT JOIN users u ON u.id = a.changed_by WHERE (u.department = $1 OR a.changed_by IS NULL)`,
      [req.user.dept]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('[HOD] Audit log error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/revaluation ─────────────────────────────────────────────────
router.get('/revaluation', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.status, r.student_remark, r.hod_remark, r.requested_at, r.updated_at,
              u.name AS student_name, s2.roll_no, sub.name AS subject_name, sub.code,
              r.semester, r.academic_year, uf.name AS faculty_name
       FROM revaluation_requests r
       JOIN students s2 ON s2.id = r.student_id
       JOIN users u ON u.id = s2.user_id
       JOIN subjects sub ON sub.id = r.subject_id
       LEFT JOIN faculty_subject_map fsm ON fsm.subject_id = r.subject_id
       LEFT JOIN faculty f ON f.id = fsm.faculty_id
       LEFT JOIN users uf ON uf.id = f.user_id
       WHERE sub.department = $1
       ORDER BY r.requested_at DESC`,
      [req.user.dept]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('[HOD] Revaluation list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/manual-override ────────────────────────────────────────────
router.post('/manual-override', async (req, res) => {
  try {
    const { markId, cie, practical, endSem, typedReason } = req.body;

    if (!typedReason || typedReason.trim().length < 20) {
      return res.status(400).json({
        error: 'A detailed typed reason (minimum 20 characters) is mandatory for manual override',
      });
    }

    const existingMark = await pool.query(
      `SELECT m.*, sub.* FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       WHERE m.id = $1 AND sub.department = $2`,
      [markId, req.user.dept]
    );

    if (existingMark.rows.length === 0) {
      return res.status(404).json({ error: 'Mark record not found in your department' });
    }

    const old = existingMark.rows[0];
    const subject = {
      max_cie: old.max_cie, max_practical: old.max_practical,
      max_end_sem: old.max_end_sem, has_practical: old.has_practical,
    };

    const { computeMarks } = require('../services/gradeCalculator');
    const computed = computeMarks(subject, cie, subject.has_practical ? practical : null, endSem);

    await pool.query(
      `UPDATE marks SET cie_marks=$1, practical_marks=$2, end_sem_marks=$3,
       total=$4, grade=$5, grade_points=$6, is_backlog=$7, last_modified_at=NOW() WHERE id=$8`,
      [cie, subject.has_practical ? practical : null, endSem,
       computed.total, computed.grade, computed.gradePoints, computed.isBacklog, markId]
    );

    auditRecord({
      tableName: 'marks',
      recordId: markId,
      changedBy: req.user.id,
      oldValue: { cie_marks: old.cie_marks, practical_marks: old.practical_marks, end_sem_marks: old.end_sem_marks, grade: old.grade },
      newValue: { cie_marks: cie, practical_marks: practical, end_sem_marks: endSem, grade: computed.grade },
      action: 'UPDATE',
      reason: `HOD MANUAL OVERRIDE: ${typedReason}`,
    });

    res.json({ message: 'Manual override applied. Audit log updated.', computed });
  } catch (err) {
    console.error('[HOD] Manual override error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/teachers ────────────────────────────────────────────────────
router.get('/teachers', async (req, res) => {
  try {
    const facultyRes = await pool.query(
      `SELECT f.id, f.employee_id, f.designation, f.department, u.name, u.email
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       WHERE u.role = 'faculty' OR u.role = 'hod'
       ORDER BY f.id`
    );

    const mappingsRes = await pool.query(
      `SELECT fsm.id AS mapping_id, fsm.faculty_id, fsm.subject_id, fsm.semester,
              fsm.academic_year, fsm.division,
              s.name AS subject_name, s.code AS subject_code, s.credits
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       ORDER BY fsm.academic_year DESC, fsm.semester, s.code, fsm.division`
    );

    // Get class teachers
    const ctRes = await pool.query(
      `SELECT id AS class_teacher_id, faculty_id, class_name, academic_year, assigned_at
       FROM class_teachers
       ORDER BY academic_year DESC, class_name`
    );

    // Group mappings by faculty_id
    const mappingsByFaculty = {};
    for (const m of mappingsRes.rows) {
      if (!mappingsByFaculty[m.faculty_id]) mappingsByFaculty[m.faculty_id] = [];
      mappingsByFaculty[m.faculty_id].push(m);
    }

    // Group class teachers by faculty_id
    const ctByFaculty = {};
    for (const ct of ctRes.rows) {
      if (!ctByFaculty[ct.faculty_id]) ctByFaculty[ct.faculty_id] = [];
      ctByFaculty[ct.faculty_id].push(ct);
    }

    const teachers = facultyRes.rows.map(f => ({
      ...f,
      assignments: mappingsByFaculty[f.id] || [],
      classTeacherOf: ctByFaculty[f.id] || [],
    }));

    res.json({ teachers, classTeachers: ctRes.rows });
  } catch (err) {
    console.error('[HOD] Get teachers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/all-subjects ────────────────────────────────────────────────
router.get('/all-subjects', async (req, res) => {
  try {
    const subjectsRes = await pool.query(
      `SELECT id, name, code, semester, credits, has_practical, subject_type
       FROM subjects
       WHERE department = $1
       ORDER BY semester, code`,
      [req.user.dept]
    );
    res.json({ subjects: subjectsRes.rows });
  } catch (err) {
    console.error('[HOD] Get all-subjects error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/teachers/assign ────────────────────────────────────────────
router.post('/teachers/assign', async (req, res) => {
  try {
    const {
      facultyId,
      subjectId,
      semester,
      academicYear,
      division,
      isClassTeacher,
      classTeacherFor,
      assignments,
    } = req.body;

    if (!facultyId) {
      return res.status(400).json({ error: 'Faculty is required' });
    }

    const year = academicYear || '2025-26';

    // Support both batch assignment (assignments: [...]) and single assignment
    const itemsToAssign = Array.isArray(assignments) && assignments.length > 0
      ? assignments
      : (subjectId && division ? [{ subjectId, division, semester }] : []);

    if (itemsToAssign.length === 0) {
      return res.status(400).json({ error: 'At least one subject and class must be selected' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let insertedCount = 0;
      let alreadyAssignedCount = 0;
      const insertedIds = [];

      for (const item of itemsToAssign) {
        if (!item.subjectId || !item.division) continue;

        const subRes = await client.query(`SELECT semester, name, code FROM subjects WHERE id = $1`, [item.subjectId]);
        if (subRes.rows.length === 0) continue;
        const actualSemester = item.semester || subRes.rows[0].semester;

        const insertRes = await client.query(
          `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING
           RETURNING id`,
          [facultyId, item.subjectId, actualSemester, year, item.division]
        );

        if (insertRes.rows.length > 0) {
          insertedCount++;
          insertedIds.push(insertRes.rows[0].id);
        } else {
          alreadyAssignedCount++;
        }
      }

      // If marked as Class Teacher, record in class_teachers
      const ctTargetClass = classTeacherFor || (itemsToAssign[0] && itemsToAssign[0].division);
      if (isClassTeacher && ctTargetClass) {
        await client.query(
          `INSERT INTO class_teachers (faculty_id, class_name, academic_year)
           VALUES ($1, $2, $3)
           ON CONFLICT (class_name, academic_year)
           DO UPDATE SET faculty_id = EXCLUDED.faculty_id, assigned_at = NOW()`,
          [facultyId, ctTargetClass, year]
        );
      }

      await client.query('COMMIT');

      if (insertedCount === 0 && alreadyAssignedCount > 0) {
        return res.status(409).json({
          error: 'The selected subject(s) are already assigned to this teacher for the chosen class(es)',
        });
      }

      auditRecord({
        tableName: 'faculty_subject_map',
        recordId: insertedIds[0] || parseInt(facultyId, 10),
        changedBy: req.user.id,
        oldValue: null,
        newValue: { facultyId, insertedCount, academicYear: year, isClassTeacher, ctTargetClass },
        action: 'INSERT',
        reason: `HOD assigned ${insertedCount} course(s) to faculty #${facultyId}${isClassTeacher && ctTargetClass ? ` [Class Teacher for ${ctTargetClass}]` : ''}`,
      });

      let msg = `Successfully assigned ${insertedCount} subject(s)!`;
      if (alreadyAssignedCount > 0) {
        msg += ` (${alreadyAssignedCount} already assigned).`;
      }
      if (isClassTeacher && ctTargetClass) {
        msg += ` Also designated as Class Teacher for ${ctTargetClass}.`;
      }

      res.json({
        message: msg,
        insertedCount,
        mappingId: insertedIds[0] || null,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[HOD] Assign teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/teachers/set-class-teacher ─────────────────────────────────
router.post('/teachers/set-class-teacher', async (req, res) => {
  try {
    const { facultyId, className, academicYear } = req.body;
    if (!facultyId || !className) {
      return res.status(400).json({ error: 'Faculty and class name are required' });
    }
    const year = academicYear || '2025-26';

    await pool.query(
      `INSERT INTO class_teachers (faculty_id, class_name, academic_year)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_name, academic_year)
       DO UPDATE SET faculty_id = EXCLUDED.faculty_id, assigned_at = NOW()`,
      [facultyId, className, year]
    );

    auditRecord({
      tableName: 'class_teachers',
      recordId: parseInt(facultyId, 10),
      changedBy: req.user.id,
      oldValue: null,
      newValue: { facultyId, className, year },
      action: 'UPDATE',
      reason: `HOD appointed faculty #${facultyId} as Class Teacher for ${className}`,
    });

    res.json({ message: `Successfully appointed as Class Teacher for ${className}!` });
  } catch (err) {
    console.error('[HOD] Set class teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/hod/teachers/remove-class-teacher/:id ────────────────────────
router.delete('/teachers/remove-class-teacher/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM class_teachers WHERE id = $1`, [id]);
    res.json({ message: 'Class teacher designation removed' });
  } catch (err) {
    console.error('[HOD] Remove class teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/hod/teachers/unassign/:mappingId ──────────────────────────────
router.delete('/teachers/unassign/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;

    const existing = await pool.query(`SELECT * FROM faculty_subject_map WHERE id = $1`, [mappingId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment mapping not found' });
    }

    await pool.query(`DELETE FROM faculty_subject_map WHERE id = $1`, [mappingId]);

    auditRecord({
      tableName: 'faculty_subject_map',
      recordId: parseInt(mappingId, 10),
      changedBy: req.user.id,
      oldValue: existing.rows[0],
      newValue: null,
      action: 'DELETE',
      reason: `HOD removed faculty subject mapping #${mappingId}`,
    });

    res.json({ message: 'Assignment removed successfully' });
  } catch (err) {
    console.error('[HOD] Unassign teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

