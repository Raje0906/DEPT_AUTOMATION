const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { verifyToken, requireRole } = require('../middleware/auth');
const { calculateGrade, computeSubjectRollup, computeMarks } = require('../services/gradeCalculator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const namelistUploadDir = path.join(os.tmpdir(), 'namelist_uploads');
if (!fs.existsSync(namelistUploadDir)) {
  fs.mkdirSync(namelistUploadDir, { recursive: true });
}
const namelistDiskUpload = multer({
  dest: namelistUploadDir,
  limits: { fileSize: 30 * 1024 * 1024 }
});

// Allow any authenticated user (student, faculty, hod) to get full faculty list
router.get('/all', verifyToken, async (req, res) => {
  try {
    const { department, search, limit, offset } = req.query;
    let query = `
      SELECT f.id, f.user_id, f.employee_id, f.designation, f.department,
             f.is_seminar_coordinator, u.name, u.email, u.role, u.is_active, u.created_at
      FROM faculty f
      JOIN users u ON u.id = f.user_id
      WHERE 1=1
    `;
    const params = [];

    if (department && department !== 'all') {
      params.push(department);
      query += ` AND f.department = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      query += ` AND (LOWER(u.name) LIKE $${pIdx} OR LOWER(u.email) LIKE $${pIdx} OR LOWER(f.employee_id) LIKE $${pIdx} OR LOWER(f.designation) LIKE $${pIdx})`;
    }

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM (${query}) AS subquery`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    query += ` ORDER BY f.id ASC`;

    if (limit) {
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset, 10));
      query += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);
    res.json({ faculty: result.rows, total });
  } catch (err) {
    console.error('[Faculty] Get all error:', err.message);
    res.status(500).json({ error: 'Internal server error while fetching faculty members' });
  }
});

// ─── POST /api/faculty — Add new faculty (HOD only) ──────────────────────────
router.post('/', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      email,
      employee_id,
      designation,
      department,
      password,
      is_seminar_coordinator = false
    } = req.body;

    if (!name || !email || !employee_id || !designation || !department) {
      return res.status(400).json({ error: 'Name, email, employee ID, designation, and department are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employee_id.trim().toUpperCase();

    // Check unique email and empId
    const checkUser = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [cleanEmail]);
    if (checkUser.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }

    const checkEmp = await client.query(`SELECT id FROM faculty WHERE UPPER(employee_id) = $1`, [cleanEmpId]);
    if (checkEmp.rows.length > 0) {
      return res.status(409).json({ error: 'A faculty member with this Employee ID already exists' });
    }

    await client.query('BEGIN');

    const rawPassword = password || 'faculty@123';
    const passwordHash = bcrypt.hashSync(rawPassword, 10);

    const userRes = await client.query(
      `INSERT INTO users (name, role, email, password_hash, department)
       VALUES ($1, 'faculty', $2, $3, $4)
       RETURNING id, name, email, role, department, created_at`,
      [name.trim(), cleanEmail, passwordHash, department.trim()]
    );
    const newUserId = userRes.rows[0].id;

    const facRes = await client.query(
      `INSERT INTO faculty (user_id, department, designation, employee_id, is_seminar_coordinator)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, department, designation, employee_id, is_seminar_coordinator`,
      [newUserId, department.trim(), designation.trim(), cleanEmpId, !!is_seminar_coordinator]
    );

    await client.query('COMMIT');

    const createdFaculty = {
      ...facRes.rows[0],
      name: userRes.rows[0].name,
      email: userRes.rows[0].email,
      role: userRes.rows[0].role,
      is_active: true,
      created_at: userRes.rows[0].created_at,
    };


    res.status(201).json({
      message: `Faculty member ${name} created successfully!`,
      faculty: createdFaculty,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Create faculty error:', err.message);
    res.status(500).json({ error: 'Failed to create faculty member: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── PUT /api/faculty/:id — Update faculty (HOD only) ────────────────────────
router.put('/:id', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      name,
      email,
      employee_id,
      designation,
      department,
      password,
      is_seminar_coordinator
    } = req.body;

    const facCheck = await client.query(
      `SELECT f.*, u.name, u.email, u.department as user_dept 
       FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
      [id]
    );
    if (facCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty record not found' });
    }
    const current = facCheck.rows[0];

    const cleanEmail = email ? email.trim().toLowerCase() : current.email;
    const cleanEmpId = employee_id ? employee_id.trim().toUpperCase() : current.employee_id;
    const cleanName = name ? name.trim() : current.name;
    const cleanDesig = designation ? designation.trim() : current.designation;
    const cleanDept = department ? department.trim() : current.department;
    const coordFlag = is_seminar_coordinator !== undefined ? !!is_seminar_coordinator : current.is_seminar_coordinator;

    // Check email conflict
    if (cleanEmail !== current.email) {
      const emailDup = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2`, [cleanEmail, current.user_id]);
      if (emailDup.rows.length > 0) {
        return res.status(409).json({ error: 'Email address already in use by another account' });
      }
    }

    // Check empId conflict
    if (cleanEmpId !== current.employee_id) {
      const empDup = await client.query(`SELECT id FROM faculty WHERE UPPER(employee_id) = $1 AND id != $2`, [cleanEmpId, id]);
      if (empDup.rows.length > 0) {
        return res.status(409).json({ error: 'Employee ID already in use by another faculty' });
      }
    }

    await client.query('BEGIN');

    if (password && password.trim().length >= 6) {
      const pwHash = bcrypt.hashSync(password.trim(), 10);
      await client.query(
        `UPDATE users SET name = $1, email = $2, department = $3, password_hash = $4 WHERE id = $5`,
        [cleanName, cleanEmail, cleanDept, pwHash, current.user_id]
      );
    } else {
      await client.query(
        `UPDATE users SET name = $1, email = $2, department = $3 WHERE id = $4`,
        [cleanName, cleanEmail, cleanDept, current.user_id]
      );
    }

    const updatedFac = await client.query(
      `UPDATE faculty 
       SET employee_id = $1, designation = $2, department = $3, is_seminar_coordinator = $4 
       WHERE id = $5 
       RETURNING id, user_id, department, designation, employee_id, is_seminar_coordinator`,
      [cleanEmpId, cleanDesig, cleanDept, coordFlag, id]
    );

    // Also update cached names in seminar_guides/groups if name or designation changed
    await client.query(
      `UPDATE seminar_guides SET guide_name = $1, designation = $2 WHERE faculty_id = $3`,
      [cleanName, cleanDesig, id]
    );
    await client.query(
      `UPDATE seminar_groups SET guide_name = $1 WHERE guide_id = $2`,
      [cleanName, id]
    );
    await client.query(
      `UPDATE seminar_coordinator_history SET faculty_name = $1 WHERE faculty_id = $2`,
      [cleanName, id]
    );

    await client.query('COMMIT');

    const resultFaculty = {
      ...updatedFac.rows[0],
      name: cleanName,
      email: cleanEmail,
    };


    res.json({
      message: `Faculty member ${cleanName} updated successfully!`,
      faculty: resultFaculty,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update faculty member: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/faculty/:id — Delete faculty (HOD only) ─────────────────────
router.delete('/:id', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const facRes = await client.query(
      `SELECT f.*, u.name, u.email FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
      [id]
    );
    if (facRes.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    const faculty = facRes.rows[0];

    // Prevent deleting own account
    if (faculty.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await client.query('BEGIN');

    // Remove from seminar guides and groups references
    await client.query(`UPDATE seminar_groups SET guide_id = NULL WHERE guide_id = $1`, [id]);
    await client.query(`DELETE FROM seminar_guides WHERE faculty_id = $1`, [id]);
    await client.query(`DELETE FROM faculty_subject_map WHERE faculty_id = $1`, [id]);
    await client.query(`DELETE FROM class_teachers WHERE faculty_id = $1`, [id]);
    await client.query(`DELETE FROM coordinator_assignments WHERE faculty_id = $1`, [id]);
    await client.query(`UPDATE project_groups SET guide_id = NULL WHERE guide_id = $1`, [id]);
    await client.query(`DELETE FROM project_panel_assignments WHERE panel_member_id = $1`, [id]);

    // Deleting the user cascades to faculty table
    await client.query(`DELETE FROM users WHERE id = $1`, [faculty.user_id]);

    await client.query('COMMIT');


    res.json({ message: `Faculty member ${faculty.name} has been removed successfully.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete faculty member: ' + err.message });
  } finally {
    client.release();
  }
});

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
    const selectedYear = req.query.academic_year || academicYears[0] || '2026-27';

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
        `SELECT gm.roll_no, COALESCE(u.name, gm.student_name, 'Student') as name FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
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
    const selectedYear = req.query.academic_year || academicYears[0] || '2026-27';

    const result = await pool.query(
      `SELECT fsm.id AS map_id, s.id, s.name, s.code, s.semester, s.credits,
              s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.subject_type,
              fsm.academic_year, fsm.division,
              COUNT(sem.id) AS marks_entered,
              (SELECT COUNT(*) FROM students st WHERE (st.division = fsm.division OR st.division = REPLACE(fsm.division, ' Comp ', ' ') OR REPLACE(st.division, ' Comp ', ' ') = fsm.division) AND st.current_semester = fsm.semester) AS enrolled_count,
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
    const academicYear = req.query.academic_year || '2026-27';
    let division = req.query.division;
    if (!division) {
      const defaultDivRes = await pool.query(
        `SELECT division FROM faculty_subject_map
         WHERE faculty_id = $1 AND subject_id = $2 AND semester = $3 AND academic_year = $4
         ORDER BY division ASC LIMIT 1`,
        [faculty.id, subjectId, semester, academicYear]
      );
      division = defaultDivRes.rows[0]?.division || 'TE Comp 1';
    }
    let examTypeId = req.query.exam_type_id ? parseInt(req.query.exam_type_id, 10) : null;

    // Strict Server-side RBAC: Faculty MUST be assigned to this subject, division, semester, academic_year
    const assignmentCheck = await pool.query(
      `SELECT id, division FROM faculty_subject_map
       WHERE faculty_id = $1 AND subject_id = $2 AND semester = $4 AND academic_year = $5
         AND (division = $3 OR division = REPLACE($3, ' Comp ', ' ') OR REPLACE(division, ' Comp ', ' ') = $3)`,
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
       WHERE (s.division = $5 OR s.division = REPLACE($5, ' Comp ', ' ') OR REPLACE(s.division, ' Comp ', ' ') = $5) AND s.current_semester = $3
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
       WHERE faculty_id = $1 AND subject_id = $2 AND semester = $4 AND academic_year = $5
         AND (division = $3 OR division = REPLACE($3, ' Comp ', ' ') OR REPLACE(division, ' Comp ', ' ') = $3)`,
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

      } else {
        const insertRes = await client.query(
          `INSERT INTO student_exam_marks (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW()) RETURNING id`,
          [studentId, subjectId, examTypeId, semester, academicYear, numMarks, Boolean(isAbsent), faculty.id]
        );
        markId = insertRes.rows[0].id;

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
       WHERE faculty_id = $1 AND subject_id = $2 AND semester = $4 AND academic_year = $5
         AND (division = $3 OR division = REPLACE($3, ' Comp ', ' ') OR REPLACE(division, ' Comp ', ' ') = $3)`,
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
       WHERE faculty_id = $1 AND subject_id = $2 AND semester = $4 AND academic_year = $5
         AND (division = $3 OR division = REPLACE($3, ' Comp ', ' ') OR REPLACE(division, ' Comp ', ' ') = $3)`,
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


// ─── GET /api/faculty/reports/class-performance ──────────────────────────────
router.get('/reports/class-performance', verifyToken, async (req, res) => {
  try {
    const academicYear = req.query.academic_year || req.query.academicYear || '2026-27';
    let division = req.query.division || 'TE Comp 1';
    let subjectQuery = req.query.subject_id || req.query.subjectId || req.query.subject_code || req.query.subjectCode;

    // Fetch all available subjects
    const allSubjectsRes = await pool.query(
      `SELECT id, name, code, semester, credits, subject_type, has_practical 
       FROM subjects 
       ORDER BY semester, code`
    );
    const availableSubjects = allSubjectsRes.rows;

    // Determine target subject
    let subject = null;
    if (subjectQuery) {
      if (!isNaN(Number(subjectQuery))) {
        subject = availableSubjects.find(s => s.id === Number(subjectQuery));
      }
      if (!subject) {
        subject = availableSubjects.find(s => s.code.toLowerCase() === String(subjectQuery).toLowerCase());
      }
    }
    if (!subject) {
      subject = availableSubjects.find(s => s.code === 'CE504') || availableSubjects[0];
    }

    // Fetch all distinct classes
    const divRes = await pool.query(
      `SELECT DISTINCT division FROM students WHERE division IS NOT NULL AND division != '' ORDER BY division`
    );
    const availableClasses = divRes.rows.map(r => r.division);

    // Fetch students enrolled in this division
    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE (s.division = $1 OR s.division = REPLACE($1, ' Comp ', ' ') OR REPLACE(s.division, ' Comp ', ' ') = $1)
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [division]
    );

    const students = studentsRes.rows;
    const studentIds = students.map(s => s.student_id);

    let marksRows = [];
    if (studentIds.length > 0 && subject) {
      const marksRes = await pool.query(
        `SELECT sem.student_id, sem.marks_obtained, sem.is_absent, sem.status,
                et.code AS exam_code, et.name AS exam_name, et.category AS exam_category,
                et.has_result_impact, et.default_max_marks
         FROM student_exam_marks sem
         JOIN exam_types et ON et.id = sem.exam_type_id
         WHERE sem.subject_id = $1 
           AND sem.academic_year = $2
           AND sem.student_id = ANY($3::int[])`,
        [subject.id, academicYear, studentIds]
      );
      marksRows = marksRes.rows;
    }

    // Group marks by student
    const marksByStudent = {};
    for (const m of marksRows) {
      if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
      marksByStudent[m.student_id].push(m);
    }

    const studentRoster = [];
    for (const st of students) {
      const studentMarks = marksByStudent[st.student_id] || [];
      const rollup = computeSubjectRollup(subject, studentMarks);

      const insemRow = studentMarks.find(m => m.exam_code === 'insem');
      const endsemRow = studentMarks.find(m => m.exam_code === 'endsem' || m.exam_code === 'final_practical');
      const twRow = studentMarks.find(m => m.exam_code === 'term_work');

      const isAbsent = Boolean(insemRow?.is_absent || endsemRow?.is_absent);

      studentRoster.push({
        student_id: st.student_id,
        roll_no: st.roll_no,
        enrollment_no: st.enrollment_no,
        name: st.name,
        insem_marks: insemRow ? Number(insemRow.marks_obtained) : null,
        endsem_marks: endsemRow ? Number(endsemRow.marks_obtained) : null,
        tw_marks: twRow ? Number(twRow.marks_obtained) : null,
        total_marks: rollup.total !== null ? rollup.total : 0,
        max_marks: rollup.maxMarks,
        percentage: rollup.percentage !== null ? rollup.percentage : 0,
        grade: rollup.grade || 'F',
        grade_points: rollup.gradePoints || 0,
        is_cleared: rollup.grade !== 'F' && !isAbsent && (rollup.total || 0) > 0,
        is_absent: isAbsent,
      });
    }

    const sortedStudents = [...studentRoster].sort((a, b) => b.total_marks - a.total_marks);
    const toppers = sortedStudents
      .filter(s => s.total_marks > 0 && !s.is_absent)
      .slice(0, 5)
      .map((s, idx) => ({
        rank: idx + 1,
        name: s.name,
        roll: s.roll_no,
        prn: s.enrollment_no,
        marks: `${s.total_marks}/${s.max_marks}`,
        total: s.total_marks,
        percentage: `${s.percentage}%`,
        grade: s.grade,
      }));

    const totalStudents = students.length;
    const appeared = studentRoster.filter(s => s.total_marks > 0 || s.insem_marks !== null).length;
    const passed = studentRoster.filter(s => s.is_cleared).length;
    const failed = appeared > 0 ? (appeared - passed) : 0;
    const passPercentage = appeared > 0 ? `${(Math.round((passed / appeared) * 1000) / 10).toFixed(1)}%` : '0.0%';

    const validScores = studentRoster.filter(s => s.total_marks > 0).map(s => s.total_marks);
    const highestScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    const avgScore = validScores.length > 0 
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10 
      : 0;

    let median = 0;
    if (validScores.length > 0) {
      const sortedScores = [...validScores].sort((a, b) => a - b);
      const mid = Math.floor(sortedScores.length / 2);
      median = sortedScores.length % 2 !== 0 ? sortedScores[mid] : (sortedScores[mid - 1] + sortedScores[mid]) / 2;
      median = Math.round(median * 10) / 10;
    }

    const gradeCounts = {
      'O (Outstanding)': 0,
      'A+ (Excellent)': 0,
      'A (Very Good)': 0,
      'B+ (Good)': 0,
      'B (Above Avg)': 0,
      'C (Average)': 0,
      'P (Pass)': 0,
      'F (Backlog)': 0,
    };

    for (const s of studentRoster) {
      if (s.is_absent || s.grade === 'F' || s.total_marks === 0) {
        gradeCounts['F (Backlog)']++;
      } else if (s.grade === 'O') {
        gradeCounts['O (Outstanding)']++;
      } else if (s.grade === 'A+') {
        gradeCounts['A+ (Excellent)']++;
      } else if (s.grade === 'A') {
        gradeCounts['A (Very Good)']++;
      } else if (s.grade === 'B+') {
        gradeCounts['B+ (Good)']++;
      } else if (s.grade === 'B') {
        gradeCounts['B (Above Avg)']++;
      } else if (s.grade === 'C') {
        gradeCounts['C (Average)']++;
      } else if (s.grade === 'P') {
        gradeCounts['P (Pass)']++;
      } else {
        gradeCounts['F (Backlog)']++;
      }
    }

    const denom = appeared || totalStudents || 1;
    const gradeDist = Object.entries(gradeCounts).map(([grade, count]) => ({
      grade,
      count,
      pct: `${(Math.round((count / denom) * 1000) / 10).toFixed(1)}%`,
    }));

    res.json({
      subject,
      division,
      academicYear,
      availableSubjects,
      availableClasses,
      metrics: {
        totalStudents,
        appeared,
        passed,
        failed,
        passPercentage,
        highestScore,
        avgScore,
        median,
        backlogs: failed,
      },
      gradeDist,
      toppers,
      roster: studentRoster,
    });
  } catch (err) {
    console.error('[Faculty] Class performance reports error:', err);
    res.status(500).json({ error: 'Failed to generate class performance report: ' + err.message });
  }
});

// ─── GET /api/faculty/reports/:subjectId ──────────────────────────────────────
router.get('/reports/:subjectId', verifyToken, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { semester = 5, academicYear = '2026-27', division = 'TE Comp 1' } = req.query;

    const subRes = await pool.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
    if (subRes.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subRes.rows[0];

    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, u.name
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE (s.division = $1 OR s.division = REPLACE($1, ' Comp ', ' ') OR REPLACE(s.division, ' Comp ', ' ') = $1)
       ORDER BY s.roll_no`,
      [division]
    );

    const studentIds = studentsRes.rows.map(r => r.student_id);
    let marksRows = [];
    if (studentIds.length > 0) {
      const mRes = await pool.query(
        `SELECT sem.student_id, sem.marks_obtained, sem.is_absent, et.code AS exam_code
         FROM student_exam_marks sem JOIN exam_types et ON sem.exam_type_id = et.id
         WHERE sem.subject_id = $1 AND sem.academic_year = $2 AND sem.student_id = ANY($3::int[])`,
        [subjectId, academicYear, studentIds]
      );
      marksRows = mRes.rows;
    }

    const marksByStudent = {};
    for (const m of marksRows) {
      if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
      marksByStudent[m.student_id].push(m);
    }

    const rollups = studentsRes.rows.map(st => {
      const studentMarks = marksByStudent[st.student_id] || [];
      return computeSubjectRollup(subject, studentMarks);
    });

    const total = rollups.length;
    const passed = rollups.filter(r => r.grade && r.grade !== 'F').length;
    const failed = total - passed;
    const validScores = rollups.filter(r => r.total !== null).map(r => r.total);
    const avgTotal = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;

    const gradeDistribution = {};
    for (const r of rollups) {
      const g = r.grade || 'F';
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
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

// ─── GET /api/faculty/analysis/exam ──────────────────────────────────────────
// Detailed statistical analysis & learner categorization for any exam
router.get('/analysis/exam', async (req, res) => {
  try {
    const { subjectId, semester = 5, academicYear = '2026-27', division = 'TE 1', examCode = 'insem' } = req.query;
    const semNum = parseInt(semester, 10);

    const subjectRes = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectRes.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectRes.rows[0];

    const examTypeRes = await pool.query(`SELECT * FROM exam_types WHERE code = $1`, [examCode]);
    const examType = examTypeRes.rows[0] || { code: examCode, name: 'Examination', default_max_marks: 30 };
    const maxMarks = Number(examType.default_max_marks) || 30;
    const benchmark = req.query.benchmark ? Number(req.query.benchmark) : Math.round(maxMarks * 0.40 * 10) / 10; // 40% passing benchmark (12/30 for insem)

    // Fetch students with their exam marks
    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name,
              sem.marks_obtained, sem.is_absent, sem.status AS mark_status, sem.last_modified_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN student_exam_marks sem ON sem.student_id = s.id 
         AND sem.subject_id = $1 
         AND sem.exam_type_id = $2
         AND sem.semester = $3 
         AND sem.academic_year = $4
       WHERE s.division = $5 AND s.current_semester = $3
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [subjectId, examType.id, semNum, academicYear, division]
    );

    const students = studentsRes.rows.map(s => {
      const mark = s.marks_obtained !== null && s.marks_obtained !== undefined ? Number(s.marks_obtained) : null;
      const isAbsent = Boolean(s.is_absent);
      let category = 'Unrecorded';
      let requiresRemedial = false;

      if (isAbsent) {
        category = 'Absent / Remedial Required';
        requiresRemedial = true;
      } else if (mark !== null) {
        if (mark < benchmark) {
          category = 'Slow Learner (< 40%)';
          requiresRemedial = true;
        } else if (mark >= maxMarks * 0.70) {
          category = 'Advanced Learner (>= 70%)';
        } else {
          category = 'Average Learner (40% - 69%)';
        }
      }

      return {
        ...s,
        numericMark: mark,
        isAbsent,
        category,
        requiresRemedial,
        percentage: mark !== null ? Math.round((mark / maxMarks) * 100 * 10) / 10 : 0
      };
    });

    const totalStudents = students.length;
    const appearedList = students.filter(s => s.numericMark !== null && !s.isAbsent);
    const absentList   = students.filter(s => s.isAbsent);
    const appeared     = appearedList.length;
    const passedList   = appearedList.filter(s => s.numericMark >= benchmark);
    const slowLearners = students.filter(s => s.requiresRemedial);
    const avgScore     = appeared > 0 ? appearedList.reduce((acc, s) => acc + s.numericMark, 0) / appeared : 0;
    const highestScore = appeared > 0 ? Math.max(...appearedList.map(s => s.numericMark)) : 0;
    const lowestScore  = appeared > 0 ? Math.min(...appearedList.map(s => s.numericMark)) : 0;
    const passPercentage = appeared > 0 ? Math.round((passedList.length / appeared) * 100 * 10) / 10 : 0;

    // Categorization
    const advancedLearners = students.filter(s => s.category.startsWith('Advanced'));
    const averageLearners  = students.filter(s => s.category.startsWith('Average'));

    // Check if a Remedial Action Plan exists
    const planRes = await pool.query(
      `SELECT id, title, status, benchmark_marks, created_at, updated_at
       FROM remedial_action_plans 
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3 AND division = $4 AND exam_code = $5
       ORDER BY id DESC LIMIT 1`,
      [subjectId, semNum, academicYear, division, examCode]
    );

    res.json({
      subject,
      examType,
      maxMarks,
      benchmark,
      metrics: {
        totalStudents,
        appeared,
        absent: absentList.length,
        passed: passedList.length,
        failed: slowLearners.length,
        passPercentage,
        averageMarks: Math.round(avgScore * 10) / 10,
        highestMarks: highestScore,
        lowestMarks: lowestScore
      },
      categories: {
        slowLearners,
        averageLearners,
        advancedLearners,
      },
      students,
      activeRemedialPlan: planRes.rows[0] || null
    });
  } catch (err) {
    console.error('[Faculty] Exam analysis error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/marksheet/insem-cce ──────────────────────────────────────
// Complete In-Sem / CCE (Mid Term) Marksheet with Analysis & Remedial Action
router.get('/marksheet/insem-cce', async (req, res) => {
  try {
    const { subjectId, semester = 5, academicYear = '2026-27', division = 'TE 1' } = req.query;
    const semNum = parseInt(semester, 10);

    const subjectRes = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectRes.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectRes.rows[0];

    const insemExamRes = await pool.query(`SELECT * FROM exam_types WHERE code = 'insem'`);
    const insemExam = insemExamRes.rows[0] || { id: 3, code: 'insem', name: 'Univ In-Sem / CCE (Mid Term)', default_max_marks: 30 };
    const maxMarks = Number(insemExam.default_max_marks) || 30;
    const passingMark = 12; // 40%

    // Teacher details
    const facultyMapRes = await pool.query(
      `SELECT f.id, f.employee_id, f.designation, u.name AS faculty_name, u.email
       FROM faculty_subject_map fsm
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       WHERE fsm.subject_id = $1 AND fsm.semester = $2 AND fsm.academic_year = $3 AND fsm.division = $4
       LIMIT 1`,
      [subjectId, semNum, academicYear, division]
    );
    const faculty = facultyMapRes.rows[0] || null;

    // Student marks
    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name AS student_name,
              sem.marks_obtained, sem.is_absent, sem.status AS mark_status
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN student_exam_marks sem ON sem.student_id = s.id 
         AND sem.subject_id = $1 
         AND sem.exam_type_id = $2
         AND sem.semester = $3 
         AND sem.academic_year = $4
       WHERE s.division = $5 AND s.current_semester = $3
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [subjectId, insemExam.id, semNum, academicYear, division]
    );

    const students = studentsRes.rows.map(s => {
      const mark = s.marks_obtained !== null && s.marks_obtained !== undefined ? Number(s.marks_obtained) : null;
      const isAbsent = Boolean(s.is_absent);
      let result = 'UNRECORDED';
      let performanceBand = 'Pending';

      if (isAbsent) {
        result = 'ABSENT';
        performanceBand = 'Remedial Required';
      } else if (mark !== null) {
        if (mark >= passingMark) {
          result = 'PASS';
          if (mark >= 24) performanceBand = 'Distinction (80%+)';
          else if (mark >= 20) performanceBand = 'First Class (66%+)';
          else if (mark >= 16) performanceBand = 'Higher Second (53%+)';
          else performanceBand = 'Pass Class';
        } else {
          result = 'FAIL / REMEDIAL';
          performanceBand = 'Remedial Required (< 12)';
        }
      }

      return {
        ...s,
        numericMark: mark,
        isAbsent,
        result,
        performanceBand
      };
    });

    const appearedStudents = students.filter(s => s.numericMark !== null && !s.isAbsent);
    const passedCount = appearedStudents.filter(s => s.result === 'PASS').length;
    const failedCount = students.filter(s => s.result === 'FAIL / REMEDIAL' || s.isAbsent).length;
    const absentCount = students.filter(s => s.isAbsent).length;
    const totalCount = students.length;
    const highestMark = appearedStudents.length > 0 ? Math.max(...appearedStudents.map(s => s.numericMark)) : 0;
    const averageMark = appearedStudents.length > 0 
      ? Math.round((appearedStudents.reduce((a, b) => a + b.numericMark, 0) / appearedStudents.length) * 10) / 10 
      : 0;
    const passPercentage = appearedStudents.length > 0 ? Math.round((passedCount / appearedStudents.length) * 100 * 10) / 10 : 0;

    // Fetch associated Remedial Action Plan
    const remedialPlanRes = await pool.query(
      `SELECT rap.*, 
              (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id) AS assigned_students,
              (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id AND rsr.attendance_status = 'ATTENDED') AS attended_students,
              (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id AND (rsr.retest_marks >= rap.benchmark_marks OR rsr.outcome_status = 'REMEDIAL_CLEARED')) AS cleared_students
       FROM remedial_action_plans rap
       WHERE rap.subject_id = $1 AND rap.semester = $2 AND rap.academic_year = $3 AND rap.division = $4 AND rap.exam_code = 'insem'
       ORDER BY rap.id DESC LIMIT 1`,
      [subjectId, semNum, academicYear, division]
    );

    res.json({
      subject,
      examType: insemExam,
      faculty,
      maxMarks,
      passingMark,
      summary: {
        totalStudents: totalCount,
        appeared: appearedStudents.length,
        absent: absentCount,
        passed: passedCount,
        failed: failedCount,
        passPercentage,
        highestMark,
        averageMark
      },
      students,
      remedialPlan: remedialPlanRes.rows[0] || null
    });
  } catch (err) {
    console.error('[Faculty] Insem Marksheet error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/faculty/marksheet/end-term-internal ─────────────────────────────
// Complete End-Term Internal Marksheet (Term Work 25M + Practical 25M + Mock 70M)
router.get('/marksheet/end-term-internal', async (req, res) => {
  try {
    const { subjectId, semester = 5, academicYear = '2026-27', division = 'TE 1' } = req.query;
    const semNum = parseInt(semester, 10);

    const subjectRes = await pool.query(`SELECT * FROM subjects WHERE id = $1`, [subjectId]);
    if (subjectRes.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectRes.rows[0];

    // Exam type IDs
    const examTypesRes = await pool.query(`SELECT id, code, name, default_max_marks FROM exam_types`);
    const examMap = {};
    examTypesRes.rows.forEach(e => { examMap[e.code] = e; });

    // Faculty
    const facultyMapRes = await pool.query(
      `SELECT f.id, f.employee_id, f.designation, u.name AS faculty_name, u.email
       FROM faculty_subject_map fsm
       JOIN faculty f ON f.id = fsm.faculty_id
       JOIN users u ON u.id = f.user_id
       WHERE fsm.subject_id = $1 AND fsm.semester = $2 AND fsm.academic_year = $3 AND fsm.division = $4
       LIMIT 1`,
      [subjectId, semNum, academicYear, division]
    );
    const faculty = facultyMapRes.rows[0] || null;

    // Fetch students
    const studentsRes = await pool.query(
      `SELECT s.id AS student_id, s.roll_no, s.enrollment_no, u.name AS student_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.division = $1 AND s.current_semester = $2
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [division, semNum]
    );

    // Fetch Term Work
    const twRes = await pool.query(
      `SELECT student_id, attendance_marks, assignment_1_marks, assignment_2_marks, timely_submission_marks, total_tw_marks
       FROM student_term_work_details
       WHERE subject_id = $1 AND semester = $2 AND academic_year = $3`,
      [subjectId, semNum, academicYear]
    );
    const twMap = {};
    twRes.rows.forEach(r => { twMap[r.student_id] = r; });

    // Fetch Practical / Oral marks
    const prExamId = examMap['final_practical']?.id || examMap['mock_practical']?.id;
    let prMap = {};
    if (prExamId) {
      const prRes = await pool.query(
        `SELECT student_id, marks_obtained, is_absent
         FROM student_exam_marks
         WHERE subject_id = $1 AND exam_type_id = $2 AND semester = $3 AND academic_year = $4`,
        [subjectId, prExamId, semNum, academicYear]
      );
      prRes.rows.forEach(r => { prMap[r.student_id] = r; });
    }

    // Fetch Mock Theory / Internal CIE
    const mockExamId = examMap['mock_theory']?.id || examMap['endsem']?.id;
    let mockMap = {};
    if (mockExamId) {
      const mockRes = await pool.query(
        `SELECT student_id, marks_obtained, is_absent
         FROM student_exam_marks
         WHERE subject_id = $1 AND exam_type_id = $2 AND semester = $3 AND academic_year = $4`,
        [subjectId, mockExamId, semNum, academicYear]
      );
      mockRes.rows.forEach(r => { mockMap[r.student_id] = r; });
    }

    const students = studentsRes.rows.map(s => {
      const tw = twMap[s.student_id] || { attendance_marks: 0, assignment_1_marks: 0, assignment_2_marks: 0, timely_submission_marks: 0, total_tw_marks: 0 };
      const pr = prMap[s.student_id] || { marks_obtained: 0, is_absent: false };
      const mock = mockMap[s.student_id] || { marks_obtained: 0, is_absent: false };

      const twTotal = Number(tw.total_tw_marks) || 0;
      const prMark  = pr.is_absent ? 0 : (Number(pr.marks_obtained) || 0);
      const mockMark = mock.is_absent ? 0 : (Number(mock.marks_obtained) || 0);

      const totalInternal = subject.has_practical 
        ? Math.round((twTotal + prMark) * 10) / 10 
        : twTotal;
      const maxInternal = subject.has_practical ? 50 : 25;

      const twPassed = twTotal >= 10; // 40% of 25
      const prPassed = !subject.has_practical || prMark >= 10;
      const internalStatus = (twPassed && prPassed) ? 'QUALIFIED' : 'DETENTION_RISK';

      return {
        ...s,
        termWork: tw,
        twTotal,
        practicalMarks: prMark,
        isPracticalAbsent: Boolean(pr.is_absent),
        mockTheoryMarks: mockMark,
        isMockAbsent: Boolean(mock.is_absent),
        totalInternal,
        maxInternal,
        internalStatus
      };
    });

    const totalStudents = students.length;
    const qualifiedCount = students.filter(s => s.internalStatus === 'QUALIFIED').length;
    const atRiskCount = totalStudents - qualifiedCount;
    const avgInternal = totalStudents > 0 
      ? Math.round((students.reduce((a, b) => a + b.totalInternal, 0) / totalStudents) * 10) / 10 
      : 0;

    res.json({
      subject,
      faculty,
      summary: {
        totalStudents,
        qualified: qualifiedCount,
        atRisk: atRiskCount,
        qualificationPercentage: totalStudents > 0 ? Math.round((qualifiedCount / totalStudents) * 100 * 10) / 10 : 0,
        averageInternal: avgInternal
      },
      students
    });
  } catch (err) {
    console.error('[Faculty] End Term Internal Marksheet error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── REMEDIAL ACTION PLAN CRUD ENDPOINTS ──────────────────────────────────────

// GET /api/faculty/remedial/plans
router.get('/remedial/plans', async (req, res) => {
  try {
    const { subjectId, semester = 5, academicYear = '2026-27', division = 'TE 1' } = req.query;
    const semNum = parseInt(semester, 10);

    const query = `
      SELECT rap.*, s.name AS subject_name, s.code AS subject_code, u.name AS faculty_name,
             (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id) AS total_students,
             (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id AND rsr.attendance_status = 'ATTENDED') AS attended_count,
             (SELECT COUNT(*) FROM remedial_student_records rsr WHERE rsr.plan_id = rap.id AND (rsr.retest_marks >= rap.benchmark_marks OR rsr.outcome_status = 'REMEDIAL_CLEARED')) AS cleared_count
      FROM remedial_action_plans rap
      JOIN subjects s ON s.id = rap.subject_id
      LEFT JOIN faculty f ON f.id = rap.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      WHERE ($1::int IS NULL OR rap.subject_id = $1)
        AND ($2::int IS NULL OR rap.semester = $2)
        AND ($3::varchar IS NULL OR rap.academic_year = $3)
        AND ($4::varchar IS NULL OR rap.division = $4)
      ORDER BY rap.created_at DESC
    `;

    const result = await pool.query(query, [
      subjectId ? parseInt(subjectId, 10) : null,
      semNum || null,
      academicYear || null,
      division || null
    ]);

    res.json({ plans: result.rows });
  } catch (err) {
    console.error('[Faculty] Get remedial plans error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/faculty/remedial/plans
// Create a new remedial plan and auto-populate slow learners
router.post('/remedial/plans', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      subjectId,
      semester = 5,
      academicYear = '2026-27',
      division = 'TE 1',
      examCode = 'insem',
      title,
      benchmarkMarks = 12,
      weakTopics = '',
      actionPlan = '',
      scheduleDetails = [],
      studentIds = null
    } = req.body;

    if (!subjectId || !title) {
      return res.status(400).json({ error: 'Subject ID and Action Plan Title are required' });
    }

    let facultyId = null;
    if (req.user.role === 'faculty') {
      const fac = await getFaculty(req.user.id);
      facultyId = fac?.id || null;
    }

    await client.query('BEGIN');

    const insertPlanRes = await client.query(
      `INSERT INTO remedial_action_plans 
        (subject_id, faculty_id, semester, academic_year, division, exam_code, title, benchmark_marks, weak_topics, action_plan, schedule_details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')
       RETURNING *`,
      [
        subjectId,
        facultyId,
        parseInt(semester, 10),
        academicYear,
        division,
        examCode,
        title,
        Number(benchmarkMarks) || 12,
        weakTopics,
        actionPlan,
        JSON.stringify(scheduleDetails || [])
      ]
    );

    const plan = insertPlanRes.rows[0];

    // Determine students needing remedial intervention
    let candidates = [];
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const stdRes = await client.query(
        `SELECT s.id AS student_id, sem.marks_obtained
         FROM students s
         LEFT JOIN student_exam_marks sem ON sem.student_id = s.id 
           AND sem.subject_id = $1 AND sem.semester = $2 AND sem.academic_year = $3
         WHERE s.id = ANY($4::int[])`,
        [subjectId, parseInt(semester, 10), academicYear, studentIds]
      );
      candidates = stdRes.rows;
    } else {
      // Auto-identify students below benchmark or absent in this exam
      const examTypeRes = await client.query(`SELECT id FROM exam_types WHERE code = $1`, [examCode]);
      const examTypeId = examTypeRes.rows[0]?.id;

      const autoRes = await client.query(
        `SELECT s.id AS student_id, sem.marks_obtained, sem.is_absent
         FROM students s
         LEFT JOIN student_exam_marks sem ON sem.student_id = s.id 
           AND sem.subject_id = $1 
           AND sem.exam_type_id = $2
           AND sem.semester = $3 
           AND sem.academic_year = $4
         WHERE s.division = $5 AND s.current_semester = $3
           AND (sem.marks_obtained IS NULL OR sem.marks_obtained < $6 OR sem.is_absent = TRUE)`,
        [subjectId, examTypeId, parseInt(semester, 10), academicYear, division, Number(benchmarkMarks) || 12]
      );
      candidates = autoRes.rows;
    }

    for (const cand of candidates) {
      await client.query(
        `INSERT INTO remedial_student_records 
          (plan_id, student_id, initial_marks, attendance_status, outcome_status)
         VALUES ($1, $2, $3, 'SCHEDULED', 'PENDING')
         ON CONFLICT (plan_id, student_id) DO UPDATE SET initial_marks = EXCLUDED.initial_marks`,
        [plan.id, cand.student_id, cand.marks_obtained !== null ? Number(cand.marks_obtained) : 0]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Remedial Action Plan created with ${candidates.length} enrolled students.`,
      plan,
      enrolledCount: candidates.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Create remedial plan error:', err.message);
    res.status(500).json({ error: 'Failed to create remedial plan: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/faculty/remedial/plans/:planId
router.get('/remedial/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;

    const planRes = await pool.query(
      `SELECT rap.*, s.name AS subject_name, s.code AS subject_code, s.semester AS subject_sem,
              u.name AS faculty_name, f.employee_id
       FROM remedial_action_plans rap
       JOIN subjects s ON s.id = rap.subject_id
       LEFT JOIN faculty f ON f.id = rap.faculty_id
       LEFT JOIN users u ON u.id = f.user_id
       WHERE rap.id = $1`,
      [planId]
    );

    if (planRes.rows.length === 0) {
      return res.status(404).json({ error: 'Remedial Action Plan not found' });
    }

    const plan = planRes.rows[0];

    const recordsRes = await pool.query(
      `SELECT rsr.*, s.roll_no, s.enrollment_no, u.name AS student_name, u.email AS student_email
       FROM remedial_student_records rsr
       JOIN students s ON s.id = rsr.student_id
       JOIN users u ON u.id = s.user_id
       WHERE rsr.plan_id = $1
       ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER), s.roll_no`,
      [planId]
    );

    const records = recordsRes.rows;
    const totalAssigned = records.length;
    const attendedCount = records.filter(r => r.attendance_status === 'ATTENDED').length;
    const clearedCount  = records.filter(r => 
      (r.retest_marks !== null && Number(r.retest_marks) >= Number(plan.benchmark_marks)) ||
      r.outcome_status === 'REMEDIAL_CLEARED' || r.outcome_status === 'IMPROVED'
    ).length;

    res.json({
      plan,
      records,
      statistics: {
        totalAssigned,
        attendedCount,
        clearedCount,
        clearanceRate: totalAssigned > 0 ? Math.round((clearedCount / totalAssigned) * 100 * 10) / 10 : 0
      }
    });
  } catch (err) {
    console.error('[Faculty] Get remedial plan details error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/faculty/remedial/plans/:planId
router.put('/remedial/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const { title, weakTopics, actionPlan, scheduleDetails, status, benchmarkMarks } = req.body;

    const updateRes = await pool.query(
      `UPDATE remedial_action_plans
       SET title = COALESCE($1, title),
           weak_topics = COALESCE($2, weak_topics),
           action_plan = COALESCE($3, action_plan),
           schedule_details = COALESCE($4::jsonb, schedule_details),
           status = COALESCE($5, status),
           benchmark_marks = COALESCE($6, benchmark_marks),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        title,
        weakTopics,
        actionPlan,
        scheduleDetails ? JSON.stringify(scheduleDetails) : null,
        status,
        benchmarkMarks ? Number(benchmarkMarks) : null,
        planId
      ]
    );

    if (updateRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    res.json({ message: 'Remedial Action Plan updated successfully', plan: updateRes.rows[0] });
  } catch (err) {
    console.error('[Faculty] Update remedial plan error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/faculty/remedial/plans/:planId/students
// Bulk update student remedial progress (attendance, re-test marks, outcome)
router.put('/remedial/plans/:planId/students', async (req, res) => {
  const client = await pool.connect();
  try {
    const { planId } = req.params;
    const { studentUpdates } = req.body; // [{ studentId, attendanceStatus, retestMarks, improvementRemarks, outcomeStatus }]

    if (!Array.isArray(studentUpdates)) {
      return res.status(400).json({ error: 'studentUpdates must be an array' });
    }

    const planRes = await client.query(`SELECT benchmark_marks FROM remedial_action_plans WHERE id = $1`, [planId]);
    if (planRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    const benchmark = Number(planRes.rows[0].benchmark_marks);

    await client.query('BEGIN');

    for (const update of studentUpdates) {
      const { studentId, attendanceStatus = 'ATTENDED', retestMarks, improvementRemarks, outcomeStatus } = update;
      const numRetest = retestMarks !== '' && retestMarks !== null && retestMarks !== undefined ? Number(retestMarks) : null;
      
      let computedOutcome = outcomeStatus;
      if (!computedOutcome) {
        if (numRetest !== null) {
          computedOutcome = numRetest >= benchmark ? 'REMEDIAL_CLEARED' : 'NEEDS_FURTHER_ATTENTION';
        } else {
          computedOutcome = attendanceStatus === 'ABSENT' ? 'NEEDS_FURTHER_ATTENTION' : 'PENDING';
        }
      }

      await client.query(
        `UPDATE remedial_student_records
         SET attendance_status = $1,
             retest_marks = $2,
             improvement_remarks = $3,
             outcome_status = $4,
             updated_at = NOW()
         WHERE plan_id = $5 AND student_id = $6`,
        [attendanceStatus, numRetest, improvementRemarks || '', computedOutcome, planId, studentId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Successfully updated ${studentUpdates.length} student remedial records.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Faculty] Bulk update remedial students error:', err.message);
    res.status(500).json({ error: 'Failed to update records: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── CLASS TEACHER: UNIVERSITY NAMELIST SEGREGATION ────────────────────────────
const DEFAULT_UNIVERSITY_MASTER_PDF = 'C:\\Users\\Rajea\\Downloads\\NAMELIST\\NAMELIST\\TE COMP.pdf';

// GET /api/faculty/namelist/classes - Get classes assigned to this class teacher (or all for HOD)
router.get('/namelist/classes', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'hod') {
      const distinctDivs = await pool.query(
        `SELECT DISTINCT division as class_name FROM students WHERE division LIKE 'TE Comp%' ORDER BY division`
      );
      const classes = distinctDivs.rows.length > 0
        ? distinctDivs.rows.map(r => r.class_name)
        : ['TE Comp 1', 'TE Comp 2', 'TE Comp 3'];
      return res.json({
        classes,
        assignedClass: classes[0],
        isHod: true,
        masterAvailable: fs.existsSync(DEFAULT_UNIVERSITY_MASTER_PDF),
        defaultMasterPath: DEFAULT_UNIVERSITY_MASTER_PDF
      });
    }

    if (req.user.role !== 'faculty') {
      return res.status(403).json({ error: 'Access restricted to Class Teachers only.' });
    }

    const ctRes = await pool.query(
      `SELECT DISTINCT class_name FROM class_teachers WHERE faculty_id = $1`,
      [req.user.faculty_id]
    );

    if (ctRes.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned as a Class Teacher.' });
    }

    const assignedClass = ctRes.rows[0].class_name;
    res.json({
      classes: [assignedClass],
      assignedClass,
      isHod: false,
      masterAvailable: fs.existsSync(DEFAULT_UNIVERSITY_MASTER_PDF),
      defaultMasterPath: DEFAULT_UNIVERSITY_MASTER_PDF
    });
  } catch (err) {
    console.error('[Faculty] Get namelist classes error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve class assignments.' });
  }
});

// POST /api/faculty/namelist/segregate - Segregate university namelist by teacher PDF or DB class
router.post(
  '/namelist/segregate',
  verifyToken,
  namelistDiskUpload.fields([
    { name: 'class_pdf', maxCount: 1 },
    { name: 'master_pdf', maxCount: 1 }
  ]),
  async (req, res) => {
    const uploadedFiles = [];
    if (req.files?.class_pdf?.[0]) uploadedFiles.push(req.files.class_pdf[0].path);
    if (req.files?.master_pdf?.[0]) uploadedFiles.push(req.files.master_pdf[0].path);

    const cleanup = () => {
      uploadedFiles.forEach(fPath => {
        try {
          if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
        } catch (_) {}
      });
    };

    try {
      // Permission check: must be HOD or Class Teacher
      if (req.user.role !== 'hod' && req.user.role !== 'faculty') {
        cleanup();
        return res.status(403).json({ error: 'Only Class Teachers and HOD can access this feature.' });
      }

      let targetClass;
      if (req.user.role === 'faculty') {
        const ctCheck = await pool.query(
          `SELECT class_name FROM class_teachers WHERE faculty_id = $1`,
          [req.user.faculty_id]
        );
        if (ctCheck.rows.length === 0) {
          cleanup();
          return res.status(403).json({ error: 'Access restricted to assigned Class Teachers.' });
        }
        // Enforce strictly: the class teacher gets ONLY her assigned class
        targetClass = ctCheck.rows[0].class_name;
      } else {
        // HOD can segregate for requested class or defaults to TE Comp 1
        targetClass = req.body.class_name || 'TE Comp 1';
      }

      const classPdfPath = req.files?.class_pdf?.[0]?.path;
      const masterPdfPath = req.files?.master_pdf?.[0]?.path || DEFAULT_UNIVERSITY_MASTER_PDF;

      if (!fs.existsSync(masterPdfPath)) {
        cleanup();
        return res.status(400).json({
          error: `University Master Namelist PDF not found at: ${masterPdfPath}. Please upload it.`
        });
      }

      // Fetch enrolled students of this specific target class from PostgreSQL
      const studentRes = await pool.query(
        `SELECT u.name, s.roll_no, s.enrollment_no, s.division
         FROM students s
         JOIN users u ON s.user_id = u.id
         WHERE s.division = $1
         ORDER BY s.roll_no ASC`,
        [targetClass]
      );

      let payload = {
        master_path: masterPdfPath,
        target_class: targetClass,
        class_students: studentRes.rows,
        class_pdf_path: classPdfPath || null
      };

      const scriptPath = path.join(__dirname, '..', 'scripts', 'segregate_namelist.py');
      const py = spawn('python', [scriptPath, '--json-input']);

      let stdoutData = '';
      let stderrData = '';

      py.stdout.on('data', chunk => {
        stdoutData += chunk.toString();
      });

      py.stderr.on('data', chunk => {
        stderrData += chunk.toString();
      });

      py.on('close', code => {
        cleanup();
        if (code !== 0) {
          console.error('[Faculty] segregate_namelist.py stderr:', stderrData);
          return res.status(500).json({
            error: 'Failed to process PDF namelist.',
            details: stderrData || stdoutData
          });
        }

        try {
          const result = JSON.parse(stdoutData);
          if (!result.success) {
            return res.status(400).json({ error: result.error || 'Segregation error' });
          }
          result.source_master = path.basename(masterPdfPath);
          result.class_name = targetClass;
          return res.json(result);
        } catch (parseErr) {
          console.error('[Faculty] JSON parse error:', parseErr.message, stdoutData);
          return res.status(500).json({ error: 'Invalid response from namelist processor.' });
        }
      });

      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    } catch (err) {
      cleanup();
      console.error('[Faculty] Namelist segregate error:', err.message);
      res.status(500).json({ error: 'Server error during namelist segregation: ' + err.message });
    }
  }
);

module.exports = router;
