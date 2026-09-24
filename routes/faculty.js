const express = require('express');
const pool = require('../db/pool');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeMarks } = require('../services/gradeCalculator');
const { logAudit, auditMark, auditRecord } = require('../middleware/auditLogger');

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

// ─── GET /api/faculty/exam-types ──────────────────────────────────────────────
router.get('/exam-types', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM exam_types ORDER BY display_order`);
    res.json({ examTypes: result.rows });
  } catch (err) {
    console.error('[Faculty] Exam types error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/dashboard ───────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    // Available academic years
    const yearsRes = await pool.query(
      `SELECT DISTINCT academic_year FROM faculty_subject_map WHERE faculty_id = $1 ORDER BY academic_year DESC`,
      [faculty.id]
    );
    const academicYears = yearsRes.rows.map(r => r.academic_year);
    const selectedYear = req.query.academic_year || academicYears[0] || '2025-26';

    // Assigned subjects for selected year with student_exam_marks stats
    const subjectsRes = await pool.query(
      `SELECT fsm.id AS map_id, s.id, s.name, s.code, s.semester, s.credits,
              s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.subject_type,
              fsm.academic_year, fsm.division,
              COUNT(sem.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division AND st.current_semester = fsm.semester) AS enrolled_count,
              CASE
                WHEN COUNT(sem.id) = 0 THEN 'not_started'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'published') > 0 THEN 'published'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'approved') = COUNT(sem.id) AND COUNT(sem.id) > 0 THEN 'approved'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'submitted') > 0 THEN 'submitted'
                ELSE 'draft'
              END AS submission_status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       LEFT JOIN student_exam_marks sem ON sem.subject_id = s.id AND sem.semester = fsm.semester AND sem.academic_year = fsm.academic_year
       WHERE fsm.faculty_id = $1 AND fsm.academic_year = $2
       GROUP BY fsm.id, s.id, fsm.academic_year, fsm.division
       ORDER BY s.semester, s.code`,
      [faculty.id, selectedYear]
    );

    // Check if class teacher
    const ctRes = await pool.query(
      `SELECT class_name, academic_year FROM class_teachers WHERE faculty_id = $1 AND academic_year = $2`,
      [faculty.id, selectedYear]
    );
    const classTeacherOf = ctRes.rows.map(r => r.class_name);

    // BE Project Panel Evaluations
    const panelAssignmentsRes = await pool.query(
      `SELECT pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
              s.id as stage_id, s.name as stage_name, s.sequence_order, s.max_marks_total, s.scheduled_date_from, s.scheduled_date_to,
              g.id as group_id, g.group_code, g.title, g.domain, g.academic_year, g.batch, g.guide_id,
              gu.name as guide_name,
              pe.id as evaluation_id, pe.status as evaluation_status, pe.submitted_at, pe.overall_remarks
       FROM project_panel_assignments pa
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       JOIN project_groups g ON pa.group_id = g.id
       LEFT JOIN faculty gf ON g.guide_id = gf.id
       LEFT JOIN users gu ON gf.user_id = gu.id
       LEFT JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
       WHERE pa.panel_member_id = $1 AND (g.academic_year = $2 OR $2 IS NULL)
       ORDER BY s.sequence_order ASC, g.group_code ASC`,
      [faculty.id, selectedYear]
    );

    const panelAssignments = panelAssignmentsRes.rows;
    for (const row of panelAssignments) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, u.name FROM project_group_members gm
         JOIN students st ON gm.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1`,
        [row.group_id]
      );
      row.members = membersRes.rows;
    }

    const pendingPanelEvaluations = panelAssignments.filter(
      (a) => a.assignment_status !== 'COMPLETED' && a.evaluation_status !== 'SUBMITTED' && a.evaluation_status !== 'LOCKED'
    ).length;
    const completedPanelEvaluations = panelAssignments.filter(
      (a) => a.assignment_status === 'COMPLETED' || a.evaluation_status === 'SUBMITTED' || a.evaluation_status === 'LOCKED'
    ).length;

    res.json({
      faculty,
      academicYears,
      selectedYear,
      subjects: subjectsRes.rows,
      classTeacherOf,
      panelAssignments,
      pendingPanelEvaluations,
      completedPanelEvaluations,
    });
  } catch (err) {
    console.error('[Faculty] Dashboard error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/subjects ────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const yearsRes = await pool.query(
      `SELECT DISTINCT academic_year FROM faculty_subject_map WHERE faculty_id = $1 ORDER BY academic_year DESC`,
      [faculty.id]
    );
    const academicYears = yearsRes.rows.map(r => r.academic_year);
    const selectedYear = req.query.academic_year || academicYears[0] || '2025-26';

    const result = await pool.query(
      `SELECT fsm.id AS map_id, s.id, s.name, s.code, s.semester, s.credits,
              s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.subject_type,
              fsm.academic_year, fsm.division,
              COUNT(sem.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division AND st.current_semester = fsm.semester) AS enrolled_count,
              CASE
                WHEN COUNT(sem.id) = 0 THEN 'not_started'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'published') > 0 THEN 'published'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'approved') = COUNT(sem.id) AND COUNT(sem.id) > 0 THEN 'approved'
                WHEN COUNT(sem.id) FILTER (WHERE sem.status = 'submitted') > 0 THEN 'submitted'
                ELSE 'draft'
              END AS submission_status
       FROM faculty_subject_map fsm
       JOIN subjects s ON s.id = fsm.subject_id
       LEFT JOIN student_exam_marks sem ON sem.subject_id = s.id AND sem.semester = fsm.semester AND sem.academic_year = fsm.academic_year
       WHERE fsm.faculty_id = $1 AND fsm.academic_year = $2
       GROUP BY fsm.id, s.id, fsm.academic_year, fsm.division
       ORDER BY s.semester, s.code`,
      [faculty.id, selectedYear]
    );

    res.json({ subjects: result.rows, faculty, academicYears, selectedYear });
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
    const semester = parseInt(req.query.semester, 10) || 5;
    const academicYear = req.query.academic_year || '2025-26';
    const division = req.query.division || 'TE 1';
    let examTypeId = req.query.exam_type_id ? parseInt(req.query.exam_type_id, 10) : null;

    // Strict Server-side RBAC: Faculty MUST be assigned to this subject, division, semester, academic_year
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map
       WHERE faculty_id = $1 AND subject_id = $2 AND division = $3 AND semester = $4 AND academic_year = $5`,
      [faculty.id, subjectId, division, semester, academicYear]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({
        error: `Access Denied: You are not assigned to teach this subject for division "${division}" in semester ${semester} (${academicYear}).`
      });
    }

    const subjectResult = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectResult.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectResult.rows[0];

    // Fetch all available exam types
    const examTypesRes = await pool.query(`SELECT * FROM exam_types ORDER BY display_order`);
    const examTypes = examTypesRes.rows;

    if (!examTypeId) {
      examTypeId = examTypes[0]?.id;
    }
    const currentExamType = examTypes.find(e => e.id === examTypeId) || examTypes[0];

    // Fetch enrolled students with marks for the selected exam_type
    const studentsResult = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name,
              sem.id AS mark_id, sem.marks_obtained, sem.is_absent, sem.status, sem.last_modified_at,
              tw.attendance_marks, tw.assignment_1_marks, tw.assignment_2_marks, tw.timely_submission_marks, tw.total_tw_marks
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN student_exam_marks sem ON sem.student_id = s.id 
         AND sem.subject_id = $1 
         AND sem.exam_type_id = $2
         AND sem.semester = $3 
         AND sem.academic_year = $4
       LEFT JOIN student_term_work_details tw ON tw.student_id = s.id 
         AND tw.subject_id = $1 
         AND tw.semester = $3 
         AND tw.academic_year = $4
       WHERE s.division = $5 AND s.current_semester = $3
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [subjectId, examTypeId, semester, academicYear, division]
    );

    // Fetch all divisions/classes this faculty teaches for this subject & semester
    const availableDivisionsRes = await pool.query(
      `SELECT DISTINCT division FROM faculty_subject_map
       WHERE faculty_id = $1 AND subject_id = $2 AND semester = $3 AND academic_year = $4
       ORDER BY division`,
      [faculty.id, subjectId, semester, academicYear]
    );

    res.json({
      subject,
      examTypes,
      currentExamType,
      selectedExamTypeId: examTypeId,
      availableDivisions: availableDivisionsRes.rows.map(r => r.division),
      students: studentsResult.rows
    });
  } catch (err) {
    console.error('[Faculty] Get marks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/faculty/marks ───────────────────────────────────────────────────
// Save or update marks for a specific exam type
router.post('/marks', async (req, res) => {
  const client = await pool.connect();
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId, examTypeId, semester, academicYear, division, marksData } = req.body;
    // marksData: [{ studentId, marksObtained, isAbsent }]

    if (!subjectId || !examTypeId || !semester || !academicYear || !division || !Array.isArray(marksData)) {
      return res.status(400).json({ error: 'Missing required parameters or marksData is not an array' });
    }

    // Strict Server-side RBAC
    const assignmentCheck = await client.query(
      `SELECT id FROM faculty_subject_map 
       WHERE faculty_id = $1 AND subject_id = $2 AND division = $3 AND semester = $4 AND academic_year = $5`,
      [faculty.id, subjectId, division, semester, academicYear]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({
        error: `Access Denied: You are not assigned to teach this subject for division "${division}" in semester ${semester}.`
      });
    }

    const examTypeRes = await client.query(`SELECT * FROM exam_types WHERE id = $1`, [examTypeId]);
    if (examTypeRes.rows.length === 0) return res.status(404).json({ error: 'Exam type not found' });
    const examType = examTypeRes.rows[0];
    const maxAllowed = Number(examType.default_max_marks);

    // Check if marks are already published
    const lockedCheck = await client.query(
      `SELECT COUNT(*) FROM student_exam_marks sem
       JOIN students st ON st.id = sem.student_id
       WHERE sem.subject_id = $1 AND sem.exam_type_id = $2 AND sem.semester = $3 
         AND sem.academic_year = $4 AND st.division = $5 AND sem.status = 'published'`,
      [subjectId, examTypeId, semester, academicYear, division]
    );
    if (parseInt(lockedCheck.rows[0].count, 10) > 0) {
      return res.status(423).json({ error: 'Marks are published and locked for editing.' });
    }

    await client.query('BEGIN');
    const results = [];

    for (const entry of marksData) {
      const { studentId, marksObtained, isAbsent } = entry;
      const numMarks = isAbsent ? 0 : (marksObtained !== '' && marksObtained !== null ? Number(marksObtained) : null);

      if (!isAbsent && numMarks !== null) {
        if (isNaN(numMarks) || numMarks < 0) {
          throw new Error(`Invalid mark value (${marksObtained}) for student ID ${studentId}`);
        }
        if (numMarks > maxAllowed) {
          throw new Error(`Mark (${numMarks}) exceeds maximum allowed (${maxAllowed}) for ${examType.name}`);
        }
      }

      // Fetch existing for audit log
      const existing = await client.query(
        `SELECT * FROM student_exam_marks 
         WHERE student_id = $1 AND subject_id = $2 AND exam_type_id = $3 AND semester = $4 AND academic_year = $5`,
        [studentId, subjectId, examTypeId, semester, academicYear]
      );

      let markId;
      if (existing.rows.length > 0) {
        const oldRow = existing.rows[0];
        const updateRes = await client.query(
          `UPDATE student_exam_marks 
           SET marks_obtained = $1, is_absent = $2, status = 'draft', entered_by = $3, last_modified_at = NOW()
           WHERE id = $4 RETURNING id`,
          [numMarks, Boolean(isAbsent), faculty.id, oldRow.id]
        );
        markId = updateRes.rows[0].id;

        await logAudit({
          req,
          tableName: 'student_exam_marks',
          recordId: markId,
          changedBy: req.user.id,
          oldValue: { marks_obtained: oldRow.marks_obtained, is_absent: oldRow.is_absent, status: oldRow.status },
          newValue: { marks_obtained: numMarks, is_absent: Boolean(isAbsent), status: 'draft', exam_type: examType.code },
          action: 'UPDATE',
          reason: `Faculty updated marks for ${examType.name}`
        });
      } else {
        const insertRes = await client.query(
          `INSERT INTO student_exam_marks (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW()) RETURNING id`,
          [studentId, subjectId, examTypeId, semester, academicYear, numMarks, Boolean(isAbsent), faculty.id]
        );
        markId = insertRes.rows[0].id;

        await logAudit({
          req,
          tableName: 'student_exam_marks',
          recordId: markId,
          changedBy: req.user.id,
          oldValue: null,
          newValue: { marks_obtained: numMarks, is_absent: Boolean(isAbsent), status: 'draft', exam_type: examType.code },
          action: 'INSERT',
          reason: `Faculty entered new marks for ${examType.name}`
        });
      }

      results.push({ studentId, markId, marksObtained: numMarks, isAbsent: Boolean(isAbsent) });
    }

    await client.query('COMMIT');
    res.json({ message: `Marks saved successfully for ${examType.name}.`, count: results.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Save marks error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/faculty/term-work ───────────────────────────────────────────────
// Save detailed Term Work (attendance, assignment 1, assignment 2, timely submission)
router.post('/term-work', async (req, res) => {
  const client = await pool.connect();
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId, semester, academicYear, division, termWorkData } = req.body;
    // termWorkData: [{ studentId, attendance, assignment1, assignment2, timelySubmission }]

    if (!subjectId || !semester || !academicYear || !division || !Array.isArray(termWorkData)) {
      return res.status(400).json({ error: 'Missing required parameters or invalid data' });
    }

    // RBAC Check
    const assignmentCheck = await client.query(
      `SELECT id FROM faculty_subject_map 
       WHERE faculty_id = $1 AND subject_id = $2 AND division = $3 AND semester = $4 AND academic_year = $5`,
      [faculty.id, subjectId, division, semester, academicYear]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject/division.' });
    }

    // Fetch term_work exam_type id
    const etRes = await client.query(`SELECT id FROM exam_types WHERE code = 'term_work'`);
    const termWorkExamTypeId = etRes.rows[0]?.id;

    await client.query('BEGIN');
    const results = [];

    for (const item of termWorkData) {
      const { studentId, attendance = 0, assignment1 = 0, assignment2 = 0, timelySubmission = 0 } = item;
      const att = Number(attendance) || 0;
      const a1  = Number(assignment1) || 0;
      const a2  = Number(assignment2) || 0;
      const tim = Number(timelySubmission) || 0;
      const totalTW = Math.round((att + a1 + a2 + tim) * 100) / 100;

      if (att < 0 || att > 5) throw new Error(`Attendance marks (${att}) must be between 0 and 5`);
      if (a1 < 0 || a1 > 7) throw new Error(`Assignment 1 marks (${a1}) must be between 0 and 7`);
      if (a2 < 0 || a2 > 7) throw new Error(`Assignment 2 marks (${a2}) must be between 0 and 7`);
      if (tim < 0 || tim > 6) throw new Error(`Timely submission marks (${tim}) must be between 0 and 6`);
      if (totalTW < 0 || totalTW > 25) throw new Error(`Total Term Work (${totalTW}) must be between 0 and 25`);

      const existingTW = await client.query(
        `SELECT * FROM student_term_work_details 
         WHERE student_id = $1 AND subject_id = $2 AND semester = $3 AND academic_year = $4`,
        [studentId, subjectId, semester, academicYear]
      );

      if (existingTW.rows.length > 0) {
        await client.query(
          `UPDATE student_term_work_details 
           SET attendance_marks = $1, assignment_1_marks = $2, assignment_2_marks = $3,
               timely_submission_marks = $4, total_tw_marks = $5, entered_by = $6, last_modified_at = NOW()
           WHERE id = $7`,
          [att, a1, a2, tim, totalTW, faculty.id, existingTW.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO student_term_work_details (student_id, subject_id, semester, academic_year, attendance_marks, assignment_1_marks, assignment_2_marks, timely_submission_marks, total_tw_marks, entered_by, last_modified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [studentId, subjectId, semester, academicYear, att, a1, a2, tim, totalTW, faculty.id]
        );
      }

      // Also synchronize into student_exam_marks
      if (termWorkExamTypeId) {
        await client.query(
          `INSERT INTO student_exam_marks (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, 'draft', $7, NOW())
           ON CONFLICT (student_id, subject_id, exam_type_id, semester, academic_year)
           DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, last_modified_at = NOW()`,
          [studentId, subjectId, termWorkExamTypeId, semester, academicYear, totalTW, faculty.id]
        );
      }

      await logAudit({
        req,
        tableName: 'student_term_work_details',
        recordId: studentId,
        changedBy: req.user.id,
        oldValue: existingTW.rows[0] || null,
        newValue: { attendance: att, assignment1: a1, assignment2: a2, timely: tim, total: totalTW },
        action: existingTW.rows.length > 0 ? 'UPDATE' : 'INSERT',
        reason: 'Faculty updated Term Work breakdown'
      });

      results.push({ studentId, totalTW });
    }

    await client.query('COMMIT');
    res.json({ message: 'Term Work saved successfully.', count: results.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Term Work save error:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/faculty/marks/submit ───────────────────────────────────────────
router.post('/marks/submit', async (req, res) => {
  try {
    const faculty = await getFaculty(req.user.id);
    if (!faculty) return res.status(404).json({ error: 'Faculty record not found' });

    const { subjectId, semester, academicYear, division } = req.body;

    // RBAC check
    const assignmentCheck = await pool.query(
      `SELECT id FROM faculty_subject_map 
       WHERE faculty_id = $1 AND subject_id = $2 AND division = $3 AND semester = $4 AND academic_year = $5`,
      [faculty.id, subjectId, division, semester, academicYear]
    );
    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this subject/division' });
    }

    const updateRes = await pool.query(
      `UPDATE student_exam_marks sem
       SET status = 'submitted', last_modified_at = NOW()
       FROM students st
       WHERE sem.student_id = st.id AND sem.subject_id = $1 AND sem.semester = $2 
         AND sem.academic_year = $3 AND st.division = $4 AND sem.status = 'draft'
       RETURNING sem.id`,
      [subjectId, semester, academicYear, division]
    );

    await logAudit({
      req,
      tableName: 'student_exam_marks',
      recordId: parseInt(subjectId, 10),
      changedBy: req.user.id,
      oldValue: { status: 'draft' },
      newValue: { status: 'submitted' },
      action: 'UPDATE',
      reason: `Faculty submitted marks for subject ${subjectId} (${division})`
    });

    res.json({ message: `Submitted ${updateRes.rows.length} marks for HOD approval.` });
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
