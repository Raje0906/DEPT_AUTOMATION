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
    const selectedYear = req.query.academic_year || '2026-27';
    const selectedSem = req.query.semester ? parseInt(req.query.semester, 10) : 5;

    // Dept-wide subject submission status table
    const result = await pool.query(
      `SELECT fsm.id, s.id AS subject_id, s.name AS subject_name, s.code, s.semester, s.credits,
              s.subject_type, s.has_practical, fsm.division, fsm.academic_year,
              u.name AS faculty_name, f.employee_id,
              COUNT(sem.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division AND st.current_semester = fsm.semester) AS enrolled,
              CASE
                WHEN COUNT(sem.id) = 0 THEN 'not_started'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'published') > 0 THEN 'published'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'approved') = COUNT(sem.id) AND COUNT(sem.id) > 0 THEN 'approved'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'submitted') > 0 THEN 'submitted'
                ELSE 'draft'
              END AS status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       LEFT JOIN student_exam_marks sem ON sem.subject_id = s.id AND sem.semester = fsm.semester AND sem.academic_year = fsm.academic_year
       WHERE f.department = $1 AND fsm.academic_year = $2
       GROUP BY fsm.id, s.id, u.name, f.employee_id
       ORDER BY s.semester, s.code, fsm.division`,
      [req.user.dept, selectedYear]
    );


    // Publication status per division for this semester & year
    const pubStatusRes = await pool.query(
      `SELECT division, status, published_at 
       FROM result_publish_status 
       WHERE semester = $1 AND academic_year = $2 AND department = $3`,
      [selectedSem, selectedYear, req.user.dept]
    );

    res.json({
      subjects: result.rows,
      publishStatus: pubStatusRes.rows,
    });
  } catch (err) {
    console.error('[HOD] Dashboard error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/exam-completion-status ───────────────────────────────────────
// Detailed matrix showing status of each exam type per subject and division
router.get('/exam-completion-status', async (req, res) => {
  try {
    const semester = req.query.semester ? parseInt(req.query.semester, 10) : 5;
    const academicYear = req.query.academic_year || '2026-27';

    const examTypesRes = await pool.query(`SELECT * FROM exam_types ORDER BY display_order`);
    const examTypes = examTypesRes.rows;

    const matrixRes = await pool.query(
      `SELECT fsm.id AS map_id, fsm.division, fsm.semester, fsm.academic_year,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code, s.subject_type,
              u.name AS faculty_name, f.employee_id,
              et.id AS exam_type_id, et.code AS exam_code, et.name AS exam_name,
              COUNT(sem.id) AS entered_count,
              (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division AND st.current_semester = fsm.semester) AS total_students,
              MAX(sem.status) AS current_status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       CROSS JOIN exam_types et
       LEFT JOIN students st2 ON st2.division = fsm.division AND st2.current_semester = fsm.semester
       LEFT JOIN student_exam_marks sem ON sem.student_id = st2.id 
         AND sem.subject_id = s.id 
         AND sem.exam_type_id = et.id 
         AND sem.semester = fsm.semester 
         AND sem.academic_year = fsm.academic_year
       WHERE f.department = $1 AND fsm.semester = $2 AND fsm.academic_year = $3
       GROUP BY fsm.id, fsm.division, fsm.semester, fsm.academic_year, s.id, u.name, f.employee_id, et.id
       ORDER BY s.code, fsm.division, et.display_order`,
      [req.user.dept, semester, academicYear]
    );

    res.json({
      semester,
      academicYear,
      examTypes,
      completionMatrix: matrixRes.rows
    });
  } catch (err) {
    console.error('[HOD] Exam completion status error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/hod/marks/:subjectId ────────────────────────────────────────────
// Full mark list for approval review (strictly read-only)
router.get('/marks/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const semester = parseInt(req.query.semester, 10) || 5;
    const academicYear = req.query.academic_year || '2026-27';
    const division = req.query.division || 'TE 1';

    const subjectResult = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectResult.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectResult.rows[0];

    const examTypesRes = await pool.query(`SELECT * FROM exam_types ORDER BY display_order`);
    const examTypes = examTypesRes.rows;

    // Fetch marks per student
    const marksResult = await pool.query(
      `SELECT st.id AS student_id, st.roll_no, st.enrollment_no, u.name AS student_name,
              sem.marks_obtained, sem.is_absent, sem.status,
              et.id AS exam_type_id, et.code AS exam_code, et.name AS exam_name
       FROM students st
       JOIN users u ON u.id = st.user_id
       LEFT JOIN student_exam_marks sem ON sem.student_id = st.id 
         AND sem.subject_id = $1 AND sem.semester = $2 AND sem.academic_year = $3
       LEFT JOIN exam_types et ON et.id = sem.exam_type_id
       WHERE st.division = $4 AND st.current_semester = $2
       ORDER BY CAST(NULLIF(regexp_replace(st.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), st.roll_no, et.display_order`,
      [subjectId, semester, academicYear, division]
    );

    // Group marks by student
    const studentMap = {};
    for (const row of marksResult.rows) {
      if (!studentMap[row.student_id]) {
        studentMap[row.student_id] = {
          student_id: row.student_id,
          roll_no: row.roll_no,
          enrollment_no: row.enrollment_no,
          student_name: row.student_name,
          marks: {},
          overall_status: 'draft'
        };
      }
      if (row.exam_code) {
        studentMap[row.student_id].marks[row.exam_code] = {
          marks: row.marks_obtained,
          isAbsent: row.is_absent,
          status: row.status
        };
        if (row.status === 'submitted' || row.status === 'approved' || row.status === 'published') {
          studentMap[row.student_id].overall_status = row.status;
        }
      }
    }

    const students = Object.values(studentMap);

    res.json({
      subject,
      semester,
      academicYear,
      division,
      examTypes,
      students,
    });
  } catch (err) {
    console.error('[HOD] Marks review error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/approve/:subjectId ─────────────────────────────────────────
router.post('/approve/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester = 5, academicYear = '2026-27', division = 'TE 1' } = req.body;

    const updateResult = await pool.query(
      `UPDATE student_exam_marks sem
       SET status = 'approved', last_modified_at = NOW()
       FROM students st
       WHERE sem.student_id = st.id AND sem.subject_id = $1 AND sem.semester = $2 
         AND sem.academic_year = $3 AND st.division = $4 AND sem.status = 'submitted'
       RETURNING sem.id`,
      [subjectId, semester, academicYear, division]
    );

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ error: 'No submitted marks found to approve for this subject & division' });
    }

    auditRecord({
      tableName: 'student_exam_marks',
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'submitted' },
      newValue: { status: 'approved' },
      action: 'UPDATE',
      reason: `HOD approved marks for subject ${subjectId} (${division})`,
    });

    res.json({ message: `Approved ${updateResult.rows.length} mark entries. Marks are locked for faculty edits.` });
  } catch (err) {
    console.error('[HOD] Approve error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/sendback/:subjectId ────────────────────────────────────────
router.post('/sendback/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester = 5, academicYear = '2026-27', division = 'TE 1', comment } = req.body;

    if (!comment || comment.trim().length < 5) {
      return res.status(400).json({ error: 'A remark is required when sending marks back for correction' });
    }

    const updateRes = await pool.query(
      `UPDATE student_exam_marks sem
       SET status = 'draft', last_modified_at = NOW()
       FROM students st
       WHERE sem.student_id = st.id AND sem.subject_id = $1 AND sem.semester = $2 
         AND sem.academic_year = $3 AND st.division = $4 AND sem.status IN ('submitted', 'approved')
       RETURNING sem.id`,
      [subjectId, semester, academicYear, division]
    );

    auditRecord({
      tableName: 'student_exam_marks',
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'submitted' },
      newValue: { status: 'draft' },
      action: 'UPDATE',
      reason: `HOD sent back for correction (${division}): ${comment}`,
    });

    res.json({ message: `Sent back ${updateRes.rows.length} marks to faculty as draft.`, comment });
  } catch (err) {
    console.error('[HOD] Send back error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/hod/publish ────────────────────────────────────────────────────
router.post('/publish', async (req, res) => {
  try {
    const { semester = 5, academicYear = '2026-27', division = 'TE 1', confirmPublish } = req.body;

    if (!confirmPublish) {
      return res.status(400).json({ error: 'Publish confirmation is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Publish all marks for this division & semester
      const pubRes = await client.query(
        `UPDATE student_exam_marks sem
         SET status = 'published', last_modified_at = NOW()
         FROM students st
         WHERE sem.student_id = st.id AND sem.semester = $1 AND sem.academic_year = $2 AND st.division = $3
         RETURNING sem.id`,
        [semester, academicYear, division]
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
        oldValue: { status: 'open' },
        newValue: { status: 'published' },
        action: 'UPDATE',
        reason: `HOD published Semester ${semester} results for ${division}`,
      });

      await client.query('COMMIT');
      res.json({ message: `Semester ${semester} results published for ${division} (${pubRes.rows.length} marks published). Students can now view their official results.` });
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

    const year = academicYear || '2026-27';

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
    const year = academicYear || '2026-27';

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

// ─── GET /api/hod/term-rollover/status ────────────────────────────────────────
router.get('/term-rollover/status', async (req, res) => {
  try {
    const selectedYear = req.query.academic_year || '2026-27';

    // 1. Current student breakdown by semester and division
    const studentBreakdownRes = await pool.query(
      `SELECT current_semester, division, COUNT(*) AS student_count
       FROM students
       GROUP BY current_semester, division
       ORDER BY current_semester, division`
    );

    // 2. Available subjects grouped by semester
    const subjectsRes = await pool.query(
      `SELECT id, name, code, semester, credits, subject_type, has_practical
       FROM subjects
       ORDER BY semester, code`
    );

    // 3. Faculty count
    const facultyCountRes = await pool.query(
      `SELECT COUNT(*) AS total_faculty FROM faculty WHERE department = $1`,
      [req.user.dept || 'Computer Engineering']
    );

    // 4. Existing publication statuses for selected year
    const publishRes = await pool.query(
      `SELECT semester, division, status, published_at
       FROM result_publish_status
       WHERE academic_year = $1 AND department = $2
       ORDER BY semester, division`,
      [selectedYear, req.user.dept || 'Computer Engineering']
    );

    // 5. Existing marks counts by semester and academic year
    const marksStatsRes = await pool.query(
      `SELECT semester, academic_year, COUNT(*) AS total_marks
       FROM student_exam_marks
       GROUP BY semester, academic_year
       ORDER BY academic_year DESC, semester ASC`
    );

    res.json({
      academicYear: selectedYear,
      availableYears: ['2026-27', '2025-26', '2024-25'],
      studentBreakdown: studentBreakdownRes.rows,
      subjects: subjectsRes.rows,
      totalFaculty: parseInt(facultyCountRes.rows[0]?.total_faculty || 0, 10),
      publishStatuses: publishRes.rows,
      marksStats: marksStatsRes.rows
    });
  } catch (err) {
    console.error('[HOD] Term rollover status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch rollover status' });
  }
});

// ─── POST /api/hod/term-rollover/preview ───────────────────────────────────────
router.post('/term-rollover/preview', async (req, res) => {
  try {
    const { fromSemester, toSemester, academicYear, divisions } = req.body;
    const fromSem = parseInt(fromSemester, 10);
    const toSem = parseInt(toSemester, 10);
    const ay = academicYear || '2026-27';
    const divList = Array.isArray(divisions) && divisions.length > 0 ? divisions : ['TE 1', 'TE 2', 'TE 3'];

    // 1. Count students eligible for promotion
    const eligibleStudentsRes = await pool.query(
      `SELECT s.id, s.roll_no, s.enrollment_no, s.division, u.name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.current_semester = $1 AND s.division = ANY($2::text[])
       ORDER BY s.division, s.roll_no`,
      [fromSem, divList]
    );

    // 2. Fetch target semester subjects
    const targetSubjectsRes = await pool.query(
      `SELECT id, name, code, semester, credits, subject_type
       FROM subjects
       WHERE semester = $1
       ORDER BY code`,
      [toSem]
    );

    // 3. Check if target semester marks already exist
    const existingTargetMarksRes = await pool.query(
      `SELECT COUNT(*) AS count
       FROM student_exam_marks
       WHERE semester = $1 AND academic_year = $2`,
      [toSem, ay]
    );

    // 4. Fetch faculty members available
    const facultyRes = await pool.query(
      `SELECT f.id, u.name, f.employee_id, f.designation
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       WHERE f.department = $1
       ORDER BY f.id ASC`,
      [req.user.dept || 'Computer Engineering']
    );

    res.json({
      fromSemester: fromSem,
      toSemester: toSem,
      academicYear: ay,
      divisions: divList,
      eligibleStudentsCount: eligibleStudentsRes.rows.length,
      sampleStudents: eligibleStudentsRes.rows.slice(0, 5),
      targetSubjects: targetSubjectsRes.rows,
      targetSubjectsCount: targetSubjectsRes.rows.length,
      existingTargetMarksCount: parseInt(existingTargetMarksRes.rows[0]?.count || 0, 10),
      availableFacultyCount: facultyRes.rows.length
    });
  } catch (err) {
    console.error('[HOD] Term rollover preview error:', err.message);
    res.status(500).json({ error: 'Failed to generate rollover preview' });
  }
});

// ─── POST /api/hod/term-rollover/execute ───────────────────────────────────────
router.post('/term-rollover/execute', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      fromSemester,
      toSemester,
      academicYear,
      divisions,
      advanceStudents = true,
      autoAssignFaculty = true,
      initPublishStatus = true
    } = req.body;

    const fromSem = parseInt(fromSemester, 10);
    const toSem = parseInt(toSemester, 10);
    const ay = academicYear || '2026-27';
    const divList = Array.isArray(divisions) && divisions.length > 0 ? divisions : ['TE 1', 'TE 2', 'TE 3'];

    if (!fromSem || !toSem || fromSem === toSem) {
      return res.status(400).json({ error: 'Valid distinct source and target semesters are required.' });
    }

    await client.query('BEGIN');

    let updatedStudentsCount = 0;
    let facultyMappingsCount = 0;

    // 1. Advance Students
    if (advanceStudents) {
      const updateRes = await client.query(
        `UPDATE students
         SET current_semester = $1
         WHERE current_semester = $2 AND division = ANY($3::text[])
         RETURNING id`,
        [toSem, fromSem, divList]
      );
      updatedStudentsCount = updateRes.rows.length;
    }

    // 2. Auto-Assign Faculty to Target Semester Subjects
    if (autoAssignFaculty) {
      const targetSubjectsRes = await client.query(
        `SELECT id, code, name FROM subjects WHERE semester = $1 ORDER BY code`,
        [toSem]
      );
      const targetSubjects = targetSubjectsRes.rows;

      const facultyRes = await client.query(
        `SELECT id FROM faculty WHERE department = $1 ORDER BY id ASC`,
        [req.user.dept || 'Computer Engineering']
      );
      const facultyList = facultyRes.rows;

      if (facultyList.length > 0 && targetSubjects.length > 0) {
        let fIdx = 0;
        for (const div of divList) {
          for (const sub of targetSubjects) {
            const facId = facultyList[fIdx % facultyList.length].id;
            await client.query(
              `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
              [facId, sub.id, toSem, ay, div]
            );
            facultyMappingsCount++;
            fIdx++;
          }
        }
      }
    }

    // 3. Initialize fresh Publish Status in 'draft' mode
    if (initPublishStatus) {
      for (const div of divList) {
        await client.query(
          `INSERT INTO result_publish_status (semester, academic_year, department, division, status)
           VALUES ($1, $2, $3, $4, 'draft')
           ON CONFLICT (semester, academic_year, department, division)
           DO UPDATE SET status = 'draft', published_at = NULL`,
          [toSem, ay, req.user.dept || 'Computer Engineering', div]
        );
      }
    }

    // Audit Log
    auditRecord({
      tableName: 'academic_term_rollover',
      recordId: toSem,
      changedBy: req.user.id,
      oldValue: { fromSemester: fromSem, academicYear: ay },
      newValue: { toSemester: toSem, updatedStudentsCount, facultyMappingsCount, divisions: divList },
      action: 'UPDATE',
      reason: `HOD executed Academic Term Rollover from Semester ${fromSem} to Semester ${toSem} (${ay})`,
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Term Rollover successfully completed! Promoted ${updatedStudentsCount} students to Semester ${toSem}, initialized new evaluation sheets for ${divList.join(', ')}.`,
      promotedStudents: updatedStudentsCount,
      facultyMappings: facultyMappingsCount,
      toSemester: toSem,
      academicYear: ay
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[HOD] Term rollover execution error:', err.message);
    res.status(500).json({ error: 'Term rollover failed: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/hod/term-rollover/switch-active-semester ────────────────────────
// Quick utility for HOD to switch students between semesters (e.g. back to Sem 5 or forward to Sem 6)
router.post('/term-rollover/switch-active-semester', async (req, res) => {
  try {
    const { targetSemester, divisions } = req.body;
    const targetSem = parseInt(targetSemester, 10);
    const divList = Array.isArray(divisions) && divisions.length > 0 ? divisions : ['TE 1', 'TE 2', 'TE 3'];

    if (!targetSem || targetSem < 1 || targetSem > 8) {
      return res.status(400).json({ error: 'Valid target semester (1-8) required.' });
    }

    const result = await pool.query(
      `UPDATE students
       SET current_semester = $1
       WHERE division = ANY($2::text[])
       RETURNING id`,
      [targetSem, divList]
    );

    auditRecord({
      tableName: 'students',
      recordId: targetSem,
      changedBy: req.user.id,
      oldValue: null,
      newValue: { targetSemester: targetSem, divisions: divList, count: result.rows.length },
      action: 'UPDATE',
      reason: `HOD switched active current_semester to ${targetSem} for divisions: ${divList.join(', ')}`,
    });

    res.json({
      success: true,
      message: `Active working semester switched to Semester ${targetSem} for ${result.rows.length} students across ${divList.join(', ')}.`,
      updatedStudents: result.rows.length,
      currentSemester: targetSem
    });
  } catch (err) {
    console.error('[HOD] Switch active semester error:', err.message);
    res.status(500).json({ error: 'Failed to switch active semester' });
  }
});

module.exports = router;

