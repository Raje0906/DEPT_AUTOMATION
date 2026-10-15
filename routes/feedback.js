const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { THEORY_QUESTIONS, PRACTICAL_QUESTIONS } = require('../services/feedbackQuestions');

const router = express.Router();

// ─── Coordinator Authorization Middleware ────────────────────────────────────
/**
 * Strictly restricts form creation, editing, publishing, and configuration
 * to Chanchal Vakte Ma'am (Ms. C. Y. Vakte, employee_id: CYV).
 * HOD also has oversight authority.
 */
function requireFeedbackCoordinator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user;
  const isMatchId = user.id === 280 || user.faculty_id === 40;
  const isMatchEmail = typeof user.email === 'string' && user.email.toLowerCase() === 'cyv@meswadiacoe.edu';
  const isMatchEmp = typeof user.employee_id === 'string' && user.employee_id.toUpperCase() === 'CYV';
  const isMatchName = typeof user.name === 'string' && (user.name.includes('Vakte') || user.name.includes('Chanchal'));
  const isHod = user.role === 'hod';

  if (isMatchId || isMatchEmail || isMatchEmp || isMatchName || isHod) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied: Only Chanchal Vakte Ma\'am (Feedback Coordinator) or HOD is authorized to manage feedback forms.',
  });
}

// ─── Helper: Fetch Dynamic Allocations from HOD Course Allocation Matrix ──────
/**
 * Single source of truth for allocated subjects and faculty.
 * Strictly resolves from faculty_subject_map joined with subjects, faculty, and users.
 */
async function fetchHODAllocations({ academicYear, semester, division }) {
  let queryStr = `
    SELECT fsm.id AS mapping_id, fsm.faculty_id, fsm.subject_id, fsm.semester,
           fsm.academic_year, fsm.division,
           s.name AS subject_name, s.code AS subject_code, s.subject_type, s.has_practical,
           u.name AS faculty_name, u.email AS faculty_email, f.employee_id, f.designation
    FROM faculty_subject_map fsm
    JOIN subjects s ON s.id = fsm.subject_id
    JOIN faculty f ON f.id = fsm.faculty_id
    JOIN users u ON u.id = f.user_id
    WHERE fsm.semester = $1 AND fsm.academic_year = $2
  `;
  const params = [parseInt(semester, 10), academicYear];

  if (division && division !== 'All') {
    queryStr += ` AND (fsm.division = $3 OR fsm.division ILIKE '%' || $3 || '%')`;
    params.push(division);
  }

  queryStr += ` ORDER BY s.subject_type DESC, s.code, fsm.division`;

  const result = await pool.query(queryStr, params);
  const rows = result.rows;

  if (rows.length === 0) {
    return {
      available: false,
      error: `No course allocations found in the HOD matrix for AY ${academicYear}, Semester ${semester}${division ? `, Division ${division}` : ''}. Please ensure allocations are configured in Teacher Management.`,
      allocations: [],
      coreTheory: [],
      electives: [],
      practicals: [],
      electivePracticals: [],
    };
  }

  const coreTheory = [];
  const electives = [];
  const practicals = [];
  const electivePracticals = [];

  for (const row of rows) {
    const isElective = row.subject_name.toLowerCase().includes('elective') ||
                       (row.subject_code && row.subject_code.toLowerCase().includes('elec'));
    const isPractical = row.subject_type === 'practical' ||
                        row.subject_name.toLowerCase().includes('lab') ||
                        row.subject_name.toLowerCase().includes('practice') ||
                        row.subject_name.toLowerCase().includes('seminar');

    if (isPractical) {
      if (isElective) {
        electivePracticals.push(row);
      } else {
        practicals.push(row);
      }
    } else {
      if (isElective) {
        electives.push(row);
      } else {
        coreTheory.push(row);
      }
    }
  }

  return {
    available: true,
    allocations: rows,
    coreTheory,
    theorySubjects: coreTheory,
    electives,
    electiveSubjects: electives,
    practicals,
    practicalSubjects: practicals,
    electivePracticals,
    electivePracticalSubjects: electivePracticals,
  };
}

// ─── GET /api/feedback/allocations (Coordinator & HOD) ────────────────────────
router.get('/allocations', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const academicYear = req.query.academic_year || '2026-27';
    const semester = req.query.semester ? parseInt(req.query.semester, 10) : 5;
    const division = req.query.division || 'TE Comp 1';

    const matrix = await fetchHODAllocations({ academicYear, semester, division });
    if (!matrix.available) {
      return res.status(404).json({ error: matrix.error });
    }

    res.json(matrix);
  } catch (err) {
    console.error('[Feedback] Allocations error:', err);
    res.status(500).json({ error: 'Failed to fetch allocations from HOD matrix' });
  }
});

// ─── GET /api/feedback/forms (Coordinator & HOD Management List) ──────────────
router.get('/forms', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ff.*, u.name AS creator_name,
             (SELECT COUNT(*) FROM feedback_submissions fs WHERE fs.form_id = ff.id) AS submission_count
      FROM feedback_forms ff
      LEFT JOIN users u ON u.id = ff.created_by
      ORDER BY ff.created_at DESC
    `);

    res.json({ forms: result.rows });
  } catch (err) {
    console.error('[Feedback] Get forms error:', err);
    res.status(500).json({ error: 'Failed to retrieve feedback forms' });
  }
});

// ─── POST /api/feedback/forms (Create Form Draft - Coordinator Only) ──────────
router.post('/forms', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const {
      title,
      feedbackType = 'MID_SEM',
      academicYear = '2026-27',
      semester = 5,
      classYear = 'TE',
      division = 'All',
      formConfig = {},
    } = req.body;

    const normalizedType = ['MID_SEM', 'END_SEM'].includes(String(feedbackType).toUpperCase())
      ? String(feedbackType).toUpperCase()
      : 'MID_SEM';

    // Validate that active course allocations exist in the HOD matrix
    const matrix = await fetchHODAllocations({ academicYear, semester, division });
    if (!matrix.available) {
      return res.status(400).json({
        error: `Cannot create form: ${matrix.error}`,
      });
    }

    const typePrefix = normalizedType === 'END_SEM' ? 'END' : 'MID';
    const formId = `FB-${academicYear}-${classYear}-SEM${semester}-${typePrefix}-${division.replace(/\s+/g, '')}-${Date.now().toString().slice(-4)}`;
    const phaseLabel = normalizedType === 'END_SEM' ? 'End-Sem' : 'Mid-Sem';
    const formTitle = title || `Department of Computer Engg - ${classYear} ${phaseLabel} Feedback (Sem-${semester})`;

    const insertRes = await pool.query(
      `INSERT INTO feedback_forms
       (id, title, academic_year, semester, class_year, division, feedback_type, status, created_by, form_config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, NOW(), NOW())
       RETURNING *`,
      [formId, formTitle, academicYear, parseInt(semester, 10), classYear, division, normalizedType, req.user.id, JSON.stringify(formConfig)]
    );

    res.status(201).json({
      message: 'Feedback form draft created successfully',
      form: insertRes.rows[0],
    });
  } catch (err) {
    console.error('[Feedback] Create form error:', err);
    res.status(500).json({ error: 'Failed to create feedback form' });
  }
});

// ─── GET /api/feedback/forms/:id (View Form Config + Live Dynamic Matrix) ─────
router.get('/forms/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const formRes = await pool.query(
      `SELECT ff.*, u.name AS creator_name,
              (SELECT COUNT(*) FROM feedback_submissions fs WHERE fs.form_id = ff.id) AS submission_count
       FROM feedback_forms ff
       LEFT JOIN users u ON u.id = ff.created_by
       WHERE ff.id = $1`,
      [id]
    );

    if (formRes.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }

    const form = formRes.rows[0];

    // Dynamically fetch current allocations from HOD matrix
    const matrix = await fetchHODAllocations({
      academicYear: form.academic_year,
      semester: form.semester,
      division: form.division,
    });

    res.json({
      form,
      matrix,
      theoryQuestions: THEORY_QUESTIONS,
      practicalQuestions: PRACTICAL_QUESTIONS,
    });
  } catch (err) {
    console.error('[Feedback] Get form by id error:', err);
    res.status(500).json({ error: 'Failed to retrieve feedback form details' });
  }
});

// ─── PUT /api/feedback/forms/:id (Update / Publish / Unpublish) ───────────────
router.put('/forms/:id', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status, division, feedbackType, formConfig } = req.body;

    const existingRes = await pool.query(`SELECT * FROM feedback_forms WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }

    const currentForm = existingRes.rows[0];

    // If publishing, ensure HOD matrix allocations exist
    if (status === 'published') {
      const matrix = await fetchHODAllocations({
        academicYear: currentForm.academic_year,
        semester: currentForm.semester,
        division: division || currentForm.division,
      });
      if (!matrix.available) {
        return res.status(400).json({
          error: `Cannot publish form: ${matrix.error}`,
        });
      }

      // ── Mutual Exclusivity Enforcement ──────────────────────────────────────
      // Automatically archive/unpublish any other published form for the same cohort
      // This strictly prevents Mid-Sem and End-Sem from being published at the same time.
      const targetDivision = division || currentForm.division;
      await pool.query(
        `UPDATE feedback_forms
         SET status = 'archived', updated_at = NOW()
         WHERE id != $1
           AND academic_year = $2
           AND semester = $3
           AND status = 'published'
           AND (division = $4 OR division = 'All' OR $4 = 'All')`,
        [id, currentForm.academic_year, currentForm.semester, targetDivision]
      );
    }

    const newStatus = status || currentForm.status;
    const newTitle = title || currentForm.title;
    const newDivision = division || currentForm.division;
    const newType = feedbackType || currentForm.feedback_type || 'MID_SEM';
    const newConfig = formConfig ? JSON.stringify(formConfig) : currentForm.form_config;
    const publishedAt = (newStatus === 'published' && currentForm.status !== 'published') ? new Date() : currentForm.published_at;

    const updateRes = await pool.query(
      `UPDATE feedback_forms
       SET title = $1, status = $2, division = $3, feedback_type = $4, form_config = $5,
           published_at = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [newTitle, newStatus, newDivision, newType, newConfig, publishedAt, id]
    );

    res.json({
      message: `Feedback form status updated to '${newStatus}'`,
      form: updateRes.rows[0],
    });
  } catch (err) {
    console.error('[Feedback] Update form error:', err);
    res.status(500).json({ error: 'Failed to update feedback form' });
  }
});

// ─── DELETE /api/feedback/forms/:id (Delete Draft) ────────────────────────────
router.delete('/forms/:id', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const { id } = req.params;
    const checkRes = await pool.query(
      `SELECT status, (SELECT COUNT(*) FROM feedback_submissions fs WHERE fs.form_id = $1) AS sub_count
       FROM feedback_forms WHERE id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }

    const subCount = parseInt(checkRes.rows[0].sub_count, 10);
    if (subCount > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        error: `Cannot delete form with ${subCount} existing student submission(s). Unpublish or archive instead.`,
      });
    }

    await pool.query(`DELETE FROM feedback_forms WHERE id = $1`, [id]);
    res.json({ message: 'Feedback form deleted successfully' });
  } catch (err) {
    console.error('[Feedback] Delete form error:', err);
    res.status(500).json({ error: 'Failed to delete feedback form' });
  }
});

// ─── GET /api/feedback/student/available (Student Portal - Published Forms) ───
router.get('/student/available', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Student access only' });
    }

    // Retrieve authenticated student record
    const studentRes = await pool.query(
      `SELECT s.id, s.roll_no, s.batch, s.current_semester, s.division, u.email, u.name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const student = studentRes.rows[0];

    // Find published forms matching semester and division
    // STRICT ENFORCEMENT: Only ONE active evaluation phase (Mid-Sem OR End-Sem) is presented to the student.
    // End-Sem takes natural precedence if active, followed by the most recently published form.
    const formsRes = await pool.query(
      `SELECT ff.*,
              (SELECT fs.id FROM feedback_submissions fs WHERE fs.form_id = ff.id AND fs.student_id = $1) AS submission_id,
              (SELECT fs.submitted_at FROM feedback_submissions fs WHERE fs.form_id = ff.id AND fs.student_id = $1) AS submitted_at
       FROM feedback_forms ff
       WHERE ff.status = 'published'
         AND ff.semester = $2
         AND (ff.division = 'All' OR ff.division = $3 OR ff.division ILIKE '%' || $3 || '%')
       ORDER BY 
         CASE WHEN ff.feedback_type = 'END_SEM' THEN 1 ELSE 2 END,
         ff.published_at DESC NULLS LAST,
         ff.created_at DESC
       LIMIT 1`,
      [student.id, student.current_semester, student.division]
    );

    const availableForms = formsRes.rows.map(f => ({
      id: f.id,
      title: f.title,
      feedbackType: f.feedback_type || 'MID_SEM',
      academicYear: f.academic_year,
      semester: f.semester,
      classYear: f.class_year,
      division: f.division,
      publishedAt: f.published_at,
      hasSubmitted: !!f.submission_id,
      submission_id: f.submission_id,
      submissionId: f.submission_id,
      submittedAt: f.submitted_at,
      submitted_at: f.submitted_at,
    }));

    res.json({
      student,
      forms: availableForms,
    });
  } catch (err) {
    console.error('[Feedback] Student available forms error:', err);
    res.status(500).json({ error: 'Failed to fetch student feedback forms' });
  }
});

// ─── GET /api/feedback/student/form/:id (Live Form Schema for Student) ─────────
router.get('/student/form/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Student access only' });
    }

    const { id } = req.params;

    const studentRes = await pool.query(
      `SELECT s.id, s.roll_no, s.batch, s.current_semester, s.division, u.email, u.name
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    const student = studentRes.rows[0];

    const formRes = await pool.query(
      `SELECT * FROM feedback_forms WHERE id = $1 AND status = 'published'`,
      [id]
    );

    if (formRes.rows.length === 0) {
      return res.status(404).json({ error: 'Published feedback form not found' });
    }
    const form = formRes.rows[0];

    // Check duplicate submission
    const subCheck = await pool.query(
      `SELECT id, submitted_at FROM feedback_submissions WHERE form_id = $1 AND student_id = $2`,
      [form.id, student.id]
    );

    const hasSubmitted = subCheck.rows.length > 0;

    // Dynamically fetch live HOD matrix allocations for this student's division
    const matrix = await fetchHODAllocations({
      academicYear: form.academic_year,
      semester: form.semester,
      division: student.division,
    });

    if (!matrix.available) {
      return res.status(500).json({
        error: `Course allocations currently unavailable for ${student.division}. Please contact HOD.`,
      });
    }

    res.json({
      form: {
        id: form.id,
        title: form.title,
        academicYear: form.academic_year,
        semester: form.semester,
        classYear: form.class_year,
        division: form.division,
      },
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        division: student.division,
        batch: student.batch,
        rollNo: student.roll_no,
      },
      hasSubmitted,
      submittedAt: hasSubmitted ? subCheck.rows[0].submitted_at : null,
      matrix,
      theoryQuestions: THEORY_QUESTIONS,
      practicalQuestions: PRACTICAL_QUESTIONS,
    });
  } catch (err) {
    console.error('[Feedback] Student get form error:', err);
    res.status(500).json({ error: 'Failed to load feedback form schema' });
  }
});

// ─── POST /api/feedback/student/submit/:id (Submit Responses) ─────────────────
router.post('/student/submit/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only authenticated students can submit feedback' });
    }

    const { id } = req.params;
    const {
      selectedElective,
      selectedOpenElective,
      responses = [],
    } = req.body;

    // 1. Get student record
    const studentRes = await pool.query(
      `SELECT s.id, s.roll_no, s.batch, s.current_semester, s.division, u.email
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.user_id = $1`,
      [req.user.id]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found' });
    }
    const student = studentRes.rows[0];

    // 2. Verify form is active and published
    const formRes = await pool.query(
      `SELECT * FROM feedback_forms WHERE id = $1 AND status = 'published'`,
      [id]
    );
    if (formRes.rows.length === 0) {
      return res.status(400).json({ error: 'This feedback form is not currently open for submissions.' });
    }
    const form = formRes.rows[0];

    // 3. Prevent duplicate submission
    const existingSub = await pool.query(
      `SELECT id FROM feedback_submissions WHERE form_id = $1 AND student_id = $2`,
      [form.id, student.id]
    );
    if (existingSub.rows.length > 0) {
      return res.status(409).json({
        error: 'You have already submitted your feedback for this form. Duplicate submissions are not permitted.',
      });
    }

    // 4. Validate responses
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'At least one feedback response rating is required.' });
    }

    for (const r of responses) {
      const rating = parseInt(r.rating, 10);
      const subjectName = r.subject_name || r.subjectName;
      const facultyName = r.faculty_name || r.facultyName;
      const questionText = r.question_text || r.questionText;

      if (isNaN(rating) || rating < 1 || rating > 10) {
        return res.status(400).json({
          error: `Invalid rating '${r.rating}'. All feedback ratings must be an integer between 1 (Worst) and 10 (Best).`,
        });
      }
      if (!subjectName || !facultyName || !questionText) {
        return res.status(400).json({
          error: 'Missing required response metadata (subject_name, faculty_name, or question_text).',
        });
      }
    }

    // 5. Atomic database transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert submission record
      const subInsertRes = await client.query(
        `INSERT INTO feedback_submissions
         (form_id, student_id, academic_year, semester, division, batch, selected_elective, selected_open_elective, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING id, submitted_at`,
        [
          form.id,
          student.id,
          form.academic_year,
          form.semester,
          student.division,
          student.batch,
          selectedElective || null,
          selectedOpenElective || null,
        ]
      );
      const submissionId = subInsertRes.rows[0].id;

      // Insert responses with snapshot fields for historical permanence
      for (const r of responses) {
        const subjectId = r.subject_id || r.subjectId || null;
        const subjectName = r.subject_name || r.subjectName;
        const facultyId = r.faculty_id || r.facultyId || null;
        const facultyName = r.faculty_name || r.facultyName;
        const sectionType = r.section_type || r.sectionType || 'theory';
        const questionNumber = parseInt(r.question_number || r.questionNumber || r.questionId, 10) || 1;
        const questionText = r.question_text || r.questionText;
        const rating = parseInt(r.rating, 10);

        await client.query(
          `INSERT INTO feedback_responses
           (submission_id, section_type, subject_id, subject_name, faculty_id, faculty_name, question_number, question_text, rating, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            submissionId,
            sectionType,
            subjectId,
            subjectName,
            facultyId,
            facultyName,
            questionNumber,
            questionText,
            rating,
          ]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Your TE Mid-Sem Feedback has been recorded successfully. Thank you for your feedback!',
        submissionId,
        submittedAt: subInsertRes.rows[0].submitted_at,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Feedback] Submission error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit feedback responses' });
  }
});

// ─── GET /api/feedback/analytics/:formId (Results & Reports Dashboard) ────────
router.get('/analytics/:formId', verifyToken, requireFeedbackCoordinator, async (req, res) => {
  try {
    const { formId } = req.params;

    const formRes = await pool.query(`SELECT * FROM feedback_forms WHERE id = $1`, [formId]);
    if (formRes.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback form not found' });
    }
    const form = formRes.rows[0];

    // Total submissions and division distribution
    const subRes = await pool.query(
      `SELECT COUNT(*) AS total_submissions,
              COUNT(DISTINCT division) AS division_count
       FROM feedback_submissions WHERE form_id = $1`,
      [formId]
    );
    const totalSubmissions = parseInt(subRes.rows[0]?.total_submissions || 0, 10);

    const divBreakdownRes = await pool.query(
      `SELECT division, COUNT(*) AS count
       FROM feedback_submissions
       WHERE form_id = $1
       GROUP BY division
       ORDER BY division`,
      [formId]
    );

    // If no submissions yet, return empty analytics
    if (totalSubmissions === 0) {
      return res.json({
        form,
        totalSubmissions: 0,
        overallAverage: null,
        divisionBreakdown: divBreakdownRes.rows,
        facultyAverages: [],
        subjectAverages: [],
        questionAverages: [],
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
      });
    }

    // Overall Average Rating
    const overallAvgRes = await pool.query(
      `SELECT ROUND(AVG(fr.rating)::numeric, 2) AS overall_avg
       FROM feedback_responses fr
       JOIN feedback_submissions fs ON fs.id = fr.submission_id
       WHERE fs.form_id = $1`,
      [formId]
    );

    // Faculty-Wise Summary
    const facAvgRes = await pool.query(
      `SELECT fr.faculty_name,
              COUNT(fr.id) AS total_ratings,
              ROUND(AVG(fr.rating)::numeric, 2) AS avg_rating,
              ROUND(AVG(CASE WHEN fr.section_type = 'theory' THEN fr.rating END)::numeric, 2) AS theory_avg,
              ROUND(AVG(CASE WHEN fr.section_type = 'practical' THEN fr.rating END)::numeric, 2) AS practical_avg
       FROM feedback_responses fr
       JOIN feedback_submissions fs ON fs.id = fr.submission_id
       WHERE fs.form_id = $1
       GROUP BY fr.faculty_name
       ORDER BY avg_rating DESC`,
      [formId]
    );

    // Subject-Wise Summary
    const subjAvgRes = await pool.query(
      `SELECT fr.subject_name, fr.section_type,
              COUNT(fr.id) AS total_ratings,
              ROUND(AVG(fr.rating)::numeric, 2) AS avg_rating
       FROM feedback_responses fr
       JOIN feedback_submissions fs ON fs.id = fr.submission_id
       WHERE fs.form_id = $1
       GROUP BY fr.subject_name, fr.section_type
       ORDER BY avg_rating DESC`,
      [formId]
    );

    // Question-By-Question Breakdown
    const qAvgRes = await pool.query(
      `SELECT fr.section_type, fr.question_number, fr.question_text,
              COUNT(fr.id) AS response_count,
              ROUND(AVG(fr.rating)::numeric, 2) AS avg_rating
       FROM feedback_responses fr
       JOIN feedback_submissions fs ON fs.id = fr.submission_id
       WHERE fs.form_id = $1
       GROUP BY fr.section_type, fr.question_number, fr.question_text
       ORDER BY fr.section_type, fr.question_number`,
      [formId]
    );

    // Rating Distribution (1 to 10 counts)
    const distRes = await pool.query(
      `SELECT fr.rating, COUNT(*) AS count
       FROM feedback_responses fr
       JOIN feedback_submissions fs ON fs.id = fr.submission_id
       WHERE fs.form_id = $1
       GROUP BY fr.rating
       ORDER BY fr.rating`,
      [formId]
    );
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const r of distRes.rows) {
      ratingDistribution[r.rating] = parseInt(r.count, 10);
    }

    res.json({
      form,
      totalSubmissions,
      overallAverage: parseFloat(overallAvgRes.rows[0]?.overall_avg || 0),
      divisionBreakdown: divBreakdownRes.rows,
      facultyAverages: facAvgRes.rows,
      subjectAverages: subjAvgRes.rows,
      questionAverages: qAvgRes.rows,
      ratingDistribution,
    });
  } catch (err) {
    console.error('[Feedback] Analytics error:', err);
    res.status(500).json({ error: 'Failed to compute feedback analytics' });
  }
});

module.exports = router;
