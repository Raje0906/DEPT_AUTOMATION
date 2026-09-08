const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeSGPA, computeCGPA } = require('../services/gradeCalculator');

const router = express.Router();
router.use(verifyToken, requireRole('student'));

// Helper: get student record from user_id
async function getStudent(userId) {
  const res = await pool.query(
    `SELECT s.id, s.roll_no, s.enrollment_no, s.batch, s.current_semester, s.division, u.name, u.department
     FROM students s JOIN users u ON u.id = s.user_id WHERE s.user_id = $1`,
    [userId]
  );
  return res.rows[0] || null;
}

// ─── GET /api/student/profile ─────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });
    res.json({ student });
  } catch (err) {
    console.error('[Student] Profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/student/results/:semester ───────────────────────────────────────
router.get('/results/:semester', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const semester = parseInt(req.params.semester, 10);
    if (isNaN(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ error: 'Invalid semester' });
    }

    const marksResult = await pool.query(
      `SELECT m.id, m.cie_marks, m.practical_marks, m.end_sem_marks, m.total,
              m.grade, m.grade_points, m.is_backlog, m.attempt_number, m.status,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.credits, s.max_cie, s.max_practical, s.max_end_sem, s.has_practical
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       WHERE m.student_id = $1 AND m.semester = $2 AND m.academic_year IS NOT NULL
       ORDER BY s.code`,
      [student.id, semester]
    );

    const rows = marksResult.rows;

    if (rows.length === 0) {
      return res.json({
        student,
        semester,
        subjects: [],
        sgpa: null,
        totalCredits: 0,
        published: false,
        message: 'No results found for this semester.',
      });
    }

    const published = rows.every(r => r.status === 'published');
    const sgpaInput = rows.map(r => ({ credits: r.credits, gradePoints: parseFloat(r.grade_points) || 0 }));
    const sgpa = computeSGPA(sgpaInput);
    const totalCredits = rows.reduce((s, r) => s + r.credits, 0);

    res.json({
      student,
      semester,
      subjects: rows,
      sgpa,
      totalCredits,
      published,
    });
  } catch (err) {
    console.error('[Student] Results error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/student/results ─────────────────────────────────────────────────
// Consolidated all-semester results + CGPA
router.get('/results', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const marksResult = await pool.query(
      `SELECT m.semester, m.academic_year, m.cie_marks, m.practical_marks, m.end_sem_marks,
              m.total, m.grade, m.grade_points, m.is_backlog, m.attempt_number, m.status,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.credits, s.max_cie, s.max_practical, s.max_end_sem, s.has_practical
       FROM marks m
       JOIN subjects s ON s.id = m.subject_id
       WHERE m.student_id = $1
       ORDER BY m.semester, s.code`,
      [student.id]
    );

    // Group by semester
    const semesterMap = {};
    for (const row of marksResult.rows) {
      if (!semesterMap[row.semester]) {
        semesterMap[row.semester] = { semester: row.semester, academic_year: row.academic_year, subjects: [] };
      }
      semesterMap[row.semester].subjects.push(row);
    }

    const semesters = Object.values(semesterMap).sort((a, b) => a.semester - b.semester);

    // Compute SGPA per semester
    const semesterSGPAs = semesters.map(sem => {
      const published = sem.subjects.every(s => s.status === 'published');
      const sgpaInput = sem.subjects.map(s => ({ credits: s.credits, gradePoints: parseFloat(s.grade_points) || 0 }));
      const sgpa = computeSGPA(sgpaInput);
      const totalCredits = sem.subjects.reduce((s, r) => s + r.credits, 0);
      return { ...sem, sgpa, totalCredits, published };
    });

    // CGPA only from published semesters
    const publishedSems = semesterSGPAs.filter(s => s.published);
    const cgpa = computeCGPA(publishedSems.map(s => ({ sgpa: s.sgpa, totalCredits: s.totalCredits })));

    const backlogs = marksResult.rows.filter(r => r.is_backlog && r.status === 'published');

    res.json({ student, semesters: semesterSGPAs, cgpa, backlogs });
  } catch (err) {
    console.error('[Student] Consolidated results error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/student/notifications ───────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const notifications = [];

    // Check for newly published results
    const pubResult = await pool.query(
      `SELECT rps.semester, rps.academic_year, rps.published_at
       FROM result_publish_status rps
       WHERE rps.department = $1 AND rps.division = $2 AND rps.status = 'published'
       ORDER BY rps.published_at DESC LIMIT 3`,
      [student.department, student.division]
    );
    for (const pub of pubResult.rows) {
      notifications.push({
        type: 'result_published',
        message: `Semester ${pub.semester} results (${pub.academic_year}) have been published.`,
        date: pub.published_at,
      });
    }

    // Check revaluation status
    const revalResult = await pool.query(
      `SELECT r.status, s.name AS subject_name, r.updated_at
       FROM revaluation_requests r
       JOIN subjects s ON s.id = r.subject_id
       WHERE r.student_id = $1 AND r.updated_at > NOW() - INTERVAL '7 days'
       ORDER BY r.updated_at DESC`,
      [student.id]
    );
    for (const rev of revalResult.rows) {
      notifications.push({
        type: 'revaluation_update',
        message: `Revaluation for ${rev.subject_name}: ${rev.status.replace('_', ' ')}.`,
        date: rev.updated_at,
      });
    }

    res.json({ notifications });
  } catch (err) {
    console.error('[Student] Notifications error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/student/revaluation ────────────────────────────────────────────
router.post('/revaluation', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const { subjectId, semester, academicYear, remark } = req.body;
    if (!subjectId || !semester || !academicYear) {
      return res.status(400).json({ error: 'Subject, semester, and academic year are required' });
    }

    // Check mark exists and is published
    const markCheck = await pool.query(
      `SELECT m.id FROM marks m WHERE m.student_id = $1 AND m.subject_id = $2
       AND m.semester = $3 AND m.academic_year = $4 AND m.status = 'published'`,
      [student.id, subjectId, semester, academicYear]
    );
    if (markCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No published result found for this subject' });
    }

    // Check not already applied
    const existing = await pool.query(
      `SELECT id, status FROM revaluation_requests
       WHERE student_id = $1 AND subject_id = $2 AND semester = $3 AND academic_year = $4`,
      [student.id, subjectId, semester, academicYear]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: `A revaluation request already exists for this subject (${existing.rows[0].status})`,
      });
    }

    const result = await pool.query(
      `INSERT INTO revaluation_requests (student_id, subject_id, semester, academic_year, student_remark)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [student.id, subjectId, semester, academicYear, remark || null]
    );

    res.status(201).json({ message: 'Revaluation request submitted successfully.', id: result.rows[0].id });
  } catch (err) {
    console.error('[Student] Revaluation error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/student/revaluation ─────────────────────────────────────────────
router.get('/revaluation', async (req, res) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const result = await pool.query(
      `SELECT r.id, r.status, r.student_remark, r.faculty_remark, r.hod_remark,
              r.requested_at, r.updated_at,
              s.name AS subject_name, s.code AS subject_code, r.semester, r.academic_year
       FROM revaluation_requests r
       JOIN subjects s ON s.id = r.subject_id
       WHERE r.student_id = $1
       ORDER BY r.requested_at DESC`,
      [student.id]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('[Student] Revaluation list error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
