const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeSGPA, computeCGPA, computeSubjectRollup } = require('../services/gradeCalculator');

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

    // Fetch all active exam types
    const examTypesRes = await pool.query(`SELECT * FROM exam_types ORDER BY display_order`);
    const examTypes = examTypesRes.rows;

    // Requirement: Data is for TE Semester 1 (Semester 5), AY 2025-26 only.
    // For any other semester, show all marks/results as 0 (no data entered yet)
    if (semester !== 5) {
      return res.json({
        student,
        semester,
        academicYear: '2025-26',
        examTypes,
        subjects: [],
        termWorkDetails: {},
        sgpa: 0,
        totalCredits: 22,
        earnedCredits: 0,
        published: false,
        isOtherSemester: true,
        message: 'No data entered yet (all marks/results are 0).'
      });
    }

    // Check publication status for this semester & division
    const pubCheck = await pool.query(
      `SELECT status FROM result_publish_status 
       WHERE semester = 5 AND academic_year = '2025-26' AND division = $1`,
      [student.division]
    );
    const isPublished = pubCheck.rows.length > 0 && pubCheck.rows[0].status === 'published';

    // Fetch student's marks across all exam types
    const marksResult = await pool.query(
      `SELECT sem.id, sem.marks_obtained, sem.is_absent, sem.status,
              et.id AS exam_type_id, et.code AS exam_code, et.name AS exam_name,
              et.category AS exam_category, et.has_result_impact, et.default_max_marks,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.credits, s.subject_type, s.has_practical
       FROM student_exam_marks sem
       JOIN subjects s ON s.id = sem.subject_id
       JOIN exam_types et ON et.id = sem.exam_type_id
       WHERE sem.student_id = $1 AND sem.semester = 5 AND sem.academic_year = '2025-26'
       ORDER BY s.code, et.display_order`,
      [student.id]
    );

    // Fetch Term Work breakdown details
    const twRes = await pool.query(
      `SELECT tw.*, s.code AS subject_code, s.name AS subject_name
       FROM student_term_work_details tw
       JOIN subjects s ON s.id = tw.subject_id
       WHERE tw.student_id = $1 AND tw.semester = 5 AND tw.academic_year = '2025-26'`,
      [student.id]
    );
    const termWorkDetails = {};
    for (const tw of twRes.rows) {
      termWorkDetails[tw.subject_id] = tw;
    }

    // Group marks by subject
    const subjectMap = {};
    for (const row of marksResult.rows) {
      if (!subjectMap[row.subject_id]) {
        subjectMap[row.subject_id] = {
          subject: {
            id: row.subject_id,
            name: row.subject_name,
            code: row.subject_code,
            credits: row.credits,
            subject_type: row.subject_type,
            has_practical: row.has_practical
          },
          examRows: []
        };
      }
      subjectMap[row.subject_id].examRows.push(row);
    }

    // Compute rollup per subject
    const rolledUpSubjects = Object.values(subjectMap).map(({ subject, examRows }) => {
      const rollup = computeSubjectRollup(subject, examRows);
      rollup.termWorkDetail = termWorkDetails[subject.id] || null;
      return rollup;
    });

    const totalCredits = rolledUpSubjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
    const sgpa = isPublished ? computeSGPA(rolledUpSubjects) : null;

    const earnedCredits = rolledUpSubjects.reduce((sum, s) => sum + (Number(s.earned_credits) || 0), 0);

    res.json({
      student,
      semester,
      academicYear: '2025-26',
      examTypes,
      subjects: rolledUpSubjects,
      termWorkDetails,
      sgpa,
      totalCredits,
      earnedCredits: isPublished ? earnedCredits : 0,
      published: isPublished,
      isOtherSemester: false,
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

    // Check publication for TE Sem 1 (Semester 5)
    const pubCheck = await pool.query(
      `SELECT status FROM result_publish_status 
       WHERE semester = 5 AND academic_year = '2025-26' AND division = $1`,
      [student.division]
    );
    const isPublished = pubCheck.rows.length > 0 && pubCheck.rows[0].status === 'published';

    // Get Sem 5 marks rollup
    const marksResult = await pool.query(
      `SELECT sem.id, sem.marks_obtained, sem.is_absent, sem.status,
              et.id AS exam_type_id, et.code AS exam_code, et.name AS exam_name,
              s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
              s.credits, s.subject_type, s.has_practical
       FROM student_exam_marks sem
       JOIN subjects s ON s.id = sem.subject_id
       JOIN exam_types et ON et.id = sem.exam_type_id
       WHERE sem.student_id = $1 AND sem.semester = 5 AND sem.academic_year = '2025-26'
       ORDER BY s.code, et.display_order`,
      [student.id]
    );

    const subjectMap = {};
    for (const row of marksResult.rows) {
      if (!subjectMap[row.subject_id]) {
        subjectMap[row.subject_id] = {
          subject: {
            id: row.subject_id,
            name: row.subject_name,
            code: row.subject_code,
            credits: row.credits,
            subject_type: row.subject_type,
            has_practical: row.has_practical
          },
          examRows: []
        };
      }
      subjectMap[row.subject_id].examRows.push(row);
    }

    const sem5Subjects = Object.values(subjectMap).map(({ subject, examRows }) => computeSubjectRollup(subject, examRows));
    const sem5Credits = sem5Subjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
    const sem5SGPA = isPublished ? computeSGPA(sem5Subjects) : 0;

    // Construct 8 semester array: semester 5 has data, others have 0
    const semesters = [];
    for (let s = 1; s <= 8; s++) {
      if (s === 5) {
        semesters.push({
          semester: 5,
          academic_year: '2025-26',
          subjects: sem5Subjects,
          sgpa: sem5SGPA,
          totalCredits: sem5Credits,
          published: isPublished
        });
      } else {
        semesters.push({
          semester: s,
          academic_year: '2025-26',
          subjects: [],
          sgpa: 0,
          totalCredits: 22,
          earnedCredits: 0,
          published: false,
          message: 'No data entered yet'
        });
      }
    }

    const cgpa = isPublished ? sem5SGPA : 0;
    const backlogs = sem5Subjects.filter(s => s.isBacklog);

    res.json({ student, semesters, cgpa, backlogs });
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
