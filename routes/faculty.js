const express = require('express');
const pool = require('../db/pool');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeMarks } = require('../services/gradeCalculator');
const { auditMark } = require('../middleware/auditLogger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(verifyToken, requireRole('faculty', 'hod'));

// Helper: get faculty record from user_id
async function getFaculty(userId) {
  const res = await pool.query(
    `SELECT f.id, f.employee_id, f.department, f.designation
     FROM faculty f WHERE f.user_id = $1`,
    [userId]
  );
  return res.rows[0] || null;
}

// ─── GET /api/faculty/subjects ────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const result = await pool.query(
      `SELECT fsm.id AS map_id, s.id, s.name, s.code, s.semester, s.credits,
              s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.subject_type,
              fsm.academic_year, fsm.division,
              COUNT(m.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division) AS enrolled_count,
              -- Overall status of this subject's marks
              CASE
                WHEN COUNT(m.id) = 0 THEN 'not_started'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'published') > 0 THEN 'published'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'approved') = COUNT(m.id) AND COUNT(m.id) > 0 THEN 'approved'
                WHEN COUNT(m.id) FILTER (WHERE m.status = 'submitted') > 0 THEN 'submitted'
                ELSE 'draft'
              END AS submission_status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       LEFT JOIN marks m ON m.subject_id = s.id AND m.semester = fsm.semester AND m.academic_year = fsm.academic_year
       WHERE fsm.faculty_id = $1
       GROUP BY fsm.id, s.id, fsm.academic_year, fsm.division
       ORDER BY s.semester, s.code`,
      [faculty.id]
    );

    res.json({ subjects: result.rows, faculty });
  } catch (err) {
    console.error('[Faculty] Subjects error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/marks/:subjectId ────────────────────────────────────────
router.get('/marks/:subjectId', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId } = req.params;
    const { semester, academic_year, division } = req.query;

    // RBAC: Ensure this faculty is assigned to this subject
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map
       WHERE faculty_id = $1 AND subject_id = $2`,
      [faculty.id, subjectId]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    const subjectResult = await pool.query(
      `SELECT * FROM subjects WHERE id = $1`,
      [subjectId]
    );
    if (subjectResult.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectResult.rows[0];

    // Get all enrolled students in this division/semester
    const studentsResult = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name,
              m.id AS mark_id, m.cie_marks, m.practical_marks, m.end_sem_marks,
              m.total, m.grade, m.grade_points, m.is_backlog, m.status, m.last_modified_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = $1
         AND m.semester = $2 AND m.academic_year = $3
       WHERE s.division = $4
       ORDER BY s.roll_no`,
      [subjectId, semester || subject.semester, academic_year || '2024-25', division || 'A']
    );

    res.json({ subject, students: studentsResult.rows });
  } catch (err) {
    console.error('[Faculty] Get marks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/faculty/marks ───────────────────────────────────────────────────
// Save or update draft marks for a subject
router.post('/marks', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId, semester, academicYear, division, marksData } = req.body;
    // marksData: [{ studentId, cie, practical, endSem }]

    if (!subjectId || !semester || !academicYear || !marksData || !Array.isArray(marksData)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // RBAC check
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2`,
      [faculty.id, subjectId]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    const subjectResult = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectResult.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectResult.rows[0];

    // Check if already submitted/approved/published (read-only)
    const lockedCheck = await pool.query(
      `SELECT COUNT(*) FROM marks
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3
       AND status IN ('submitted','approved','published')`,
      [subjectId, semester, academicYear]
    );
    if (parseInt(lockedCheck.rows[0].count, 10) > 0) {
      return res.status(423).json({ error: 'Marks are locked — already submitted or approved' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const entry of marksData) {
        const { studentId, cie, practical, endSem } = entry;

        // Validation
        if (cie > subject.max_cie) {
          throw new Error(`CIE marks (${cie}) exceed maximum (${subject.max_cie}) for student ${studentId}`);
        }
        if (subject.has_practical && practical > subject.max_practical) {
          throw new Error(`Practical marks (${practical}) exceed maximum (${subject.max_practical})`);
        }
        if (endSem > subject.max_end_sem) {
          throw new Error(`End-sem marks (${endSem}) exceed maximum (${subject.max_end_sem})`);
        }

        const computed = computeMarks(
          subject,
          cie,
          subject.has_practical ? practical : null,
          endSem
        );

        // Fetch old value for audit
        const existing = await client.query(
          `SELECT * FROM marks WHERE student_id = $1 AND subject_id = $2
           AND semester = $3 AND academic_year = $4 AND attempt_number = 1`,
          [studentId, subjectId, semester, academicYear]
        );

        let markId;
        if (existing.rows.length > 0) {
          const old = existing.rows[0];
          if (old.status === 'submitted' || old.status === 'approved' || old.status === 'published') {
            throw new Error('Cannot modify locked marks');
          }
          await client.query(
            `UPDATE marks SET cie_marks=$1, practical_marks=$2, end_sem_marks=$3,
             total=$4, grade=$5, grade_points=$6, is_backlog=$7, last_modified_at=NOW()
             WHERE id=$8`,
            [cie, subject.has_practical ? practical : null, endSem,
             computed.total, computed.grade, computed.gradePoints, computed.isBacklog, old.id]
          );
          markId = old.id;
          auditMark({ recordId: old.id, changedBy: req.user.id, oldValue: old, newValue: { cie_marks: cie, practical_marks: practical, end_sem_marks: endSem, total: computed.total, grade: computed.grade }, action: 'UPDATE' });
        } else {
          const ins = await client.query(
            `INSERT INTO marks (student_id, subject_id, semester, academic_year, cie_marks, practical_marks,
             end_sem_marks, total, grade, grade_points, is_backlog, entered_by, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft') RETURNING id`,
            [studentId, subjectId, semester, academicYear, cie,
             subject.has_practical ? practical : null, endSem,
             computed.total, computed.grade, computed.gradePoints, computed.isBacklog, faculty.id]
          );
          markId = ins.rows[0].id;
          auditMark({ recordId: markId, changedBy: req.user.id, oldValue: null, newValue: { cie_marks: cie, practical_marks: practical, end_sem_marks: endSem, total: computed.total, grade: computed.grade }, action: 'INSERT' });
        }
        results.push({ studentId, markId, ...computed });
      }

      await client.query('COMMIT');
      res.json({ message: 'Marks saved as draft', results });
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Faculty] Save marks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/faculty/marks/submit ───────────────────────────────────────────
router.post('/marks/submit', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId, semester, academicYear } = req.body;

    // RBAC check
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2`,
      [faculty.id, subjectId]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    // Check all students have marks in draft
    const marksCheck = await pool.query(
      `SELECT COUNT(*) AS total, COUNT(m.id) AS entered, COUNT(m.id) FILTER (WHERE m.status = 'draft') AS draft
       FROM students s
       LEFT JOIN marks m ON m.student_id = s.id AND m.subject_id = $1 AND m.semester = $2 AND m.academic_year = $3
       WHERE s.division = 'A'`,
      [subjectId, semester, academicYear]
    );

    const stats = marksCheck.rows[0];
    if (parseInt(stats.entered, 10) < parseInt(stats.total, 10)) {
      return res.status(400).json({
        error: `Marks not entered for all students. ${stats.total - stats.entered} students have no marks.`,
      });
    }

    await pool.query(
      `UPDATE marks SET status = 'submitted', last_modified_at = NOW()
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3 AND status = 'draft'`,
      [subjectId, semester, academicYear]
    );

    auditMark({
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'draft' },
      newValue: { status: 'submitted' },
      action: 'UPDATE',
      reason: 'Faculty submitted marks for HOD approval',
    });

    res.json({ message: 'Marks submitted for HOD approval. They are now read-only until the HOD acts.' });
  } catch (err) {
    console.error('[Faculty] Submit marks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/faculty/marks/csv-upload ───────────────────────────────────────
router.post('/marks/csv-upload', upload.single('file'), async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { subjectId, semester, academicYear } = req.body;

    // RBAC check
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2`,
      [faculty.id, subjectId]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    const subjectResult = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    const subject = subjectResult.rows[0];

    const rows = [];
    const errors = [];

    await new Promise((resolve, reject) => {
      const stream = Readable.from(req.file.buffer.toString());
      stream.pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const validated = [];
    for (const row of rows) {
      const rollNo = row['Roll No'] || row['roll_no'] || '';
      const cie = parseFloat(row['CIE'] || row['cie_marks'] || '');
      const practical = parseFloat(row['Practical'] || row['practical_marks'] || '0');
      const endSem = parseFloat(row['End Sem'] || row['end_sem_marks'] || '');

      if (isNaN(cie) || isNaN(endSem)) {
        errors.push({ rollNo, error: 'Invalid or missing CIE / End-Sem marks' });
        continue;
      }
      if (cie > subject.max_cie) {
        errors.push({ rollNo, error: `CIE ${cie} exceeds max ${subject.max_cie}` });
        continue;
      }
      if (subject.has_practical && practical > subject.max_practical) {
        errors.push({ rollNo, error: `Practical ${practical} exceeds max ${subject.max_practical}` });
        continue;
      }
      if (endSem > subject.max_end_sem) {
        errors.push({ rollNo, error: `End-Sem ${endSem} exceeds max ${subject.max_end_sem}` });
        continue;
      }

      const studentRes = await pool.query(
        `SELECT id FROM students WHERE roll_no = $1`, [rollNo]
      );
      if (studentRes.rows.length === 0) {
        errors.push({ rollNo, error: 'Roll number not found' });
        continue;
      }

      const computed = computeMarks(subject, cie, subject.has_practical ? practical : null, endSem);
      validated.push({ studentId: studentRes.rows[0].id, rollNo, cie, practical, endSem, ...computed });
    }

    res.json({ validated, errors, subject });
  } catch (err) {
    console.error('[Faculty] CSV upload error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/revaluation ─────────────────────────────────────────────
router.get('/revaluation', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const result = await pool.query(
      `SELECT r.id, r.status, r.student_remark, r.faculty_remark, r.requested_at, r.updated_at,
              u.name AS student_name, s2.roll_no, s.name AS subject_name, s.code AS subject_code,
              r.semester, r.academic_year,
              m.total AS current_total, m.grade AS current_grade
       FROM revaluation_requests r
       JOIN students s2 ON s2.id = r.student_id
       JOIN users u ON u.id = s2.user_id
       JOIN subjects s ON s.id = r.subject_id
       LEFT JOIN marks m ON m.student_id = r.student_id AND m.subject_id = r.subject_id
         AND m.semester = r.semester AND m.academic_year = r.academic_year
       WHERE r.subject_id IN (
         SELECT fsm.subject_id FROM faculty_subject_map fsm WHERE fsm.faculty_id = $1
       )
       ORDER BY r.requested_at DESC`,
      [faculty.id]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('[Faculty] Revaluation list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/faculty/revaluation/:id/update ─────────────────────────────────
router.post('/revaluation/:id/update', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { id } = req.params;
    const { cie, practical, endSem, remark } = req.body;

    if (!remark || remark.trim().length < 10) {
      return res.status(400).json({ error: 'A detailed remark is required for revaluation mark update' });
    }

    const revalResult = await pool.query(
      `SELECT r.*, s.faculty_id FROM revaluation_requests r
       JOIN faculty_subject_map s ON s.subject_id = r.subject_id
       WHERE r.id = $1 AND s.faculty_id = $2`,
      [id, faculty.id]
    );
    if (revalResult.rows.length === 0) {
      return res.status(403).json({ error: 'Revaluation request not found or not assigned to you' });
    }

    const reval = revalResult.rows[0];
    const subjectResult = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [reval.subject_id]);
    const subject = subjectResult.rows[0];

    const computed = computeMarks(subject, cie, subject.has_practical ? practical : null, endSem);

    const existingMark = await pool.query(
      `SELECT * FROM marks WHERE student_id = $1 AND subject_id = $2 AND semester = $3 AND academic_year = $4`,
      [reval.student_id, reval.subject_id, reval.semester, reval.academic_year]
    );

    if (existingMark.rows.length === 0) {
      return res.status(404).json({ error: 'Original mark record not found' });
    }

    const old = existingMark.rows[0];

    await pool.query(
      `UPDATE marks SET cie_marks=$1, practical_marks=$2, end_sem_marks=$3,
       total=$4, grade=$5, grade_points=$6, is_backlog=$7, last_modified_at=NOW()
       WHERE id=$8`,
      [cie, subject.has_practical ? practical : null, endSem,
       computed.total, computed.grade, computed.gradePoints, computed.isBacklog, old.id]
    );

    await pool.query(
      `UPDATE revaluation_requests SET status='marks_updated', faculty_remark=$1, updated_at=NOW() WHERE id=$2`,
      [remark, id]
    );

    auditMark({
      recordId: old.id,
      changedBy: req.user.id,
      oldValue: { cie_marks: old.cie_marks, practical_marks: old.practical_marks, end_sem_marks: old.end_sem_marks, grade: old.grade },
      newValue: { cie_marks: cie, practical_marks: practical, end_sem_marks: endSem, grade: computed.grade },
      action: 'UPDATE',
      reason: `Revaluation: ${remark}`,
    });

    res.json({ message: 'Marks updated for revaluation. Audit trail recorded.', computed });
  } catch (err) {
    console.error('[Faculty] Revaluation update error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/reports/:subjectId ──────────────────────────────────────
router.get('/reports/:subjectId', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId } = req.params;
    const { semester, academicYear } = req.query;

    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2`,
      [faculty.id, subjectId]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject' });
    }

    const result = await pool.query(
      `SELECT m.grade, m.grade_points, m.total, m.is_backlog,
              s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.credits
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       WHERE m.subject_id = $1 AND m.semester = $2 AND m.academic_year = $3`,
      [subjectId, semester, academicYear || '2024-25']
    );

    const rows = result.rows;
    const total = rows.length;
    const passed = rows.filter(r => r.grade !== 'F').length;
    const failed = total - passed;
    const avgTotal = total > 0 ? rows.reduce((s, r) => s + parseFloat(r.total || 0), 0) / total : 0;

    const gradeDistribution = {};
    for (const r of rows) {
      gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    }

    res.json({
      total,
      passed,
      failed,
      passPercentage: total > 0 ? Math.round((passed / total) * 100 * 10) / 10 : 0,
      averageTotal: Math.round(avgTotal * 10) / 10,
      gradeDistribution,
    });
  } catch (err) {
    console.error('[Faculty] Reports error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
