const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { buildFormResponsesWorkbook, buildGuideAssignmentsWorkbook, buildExaminerAssignmentsWorkbook, buildScoreReportWorkbook } = require('../services/projectExporter');
const router = express.Router();

// Helper: Get faculty ID for logged in user
async function getFacultyId(userId) {
  const res = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

// Helper: Get student ID for logged in user
async function getStudentId(userId) {
  const res = await pool.query('SELECT id, roll_no, batch FROM students WHERE user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

// Helper: Check if user is BE Project Coordinator or HOD
async function requireProjectCoordinatorOrHOD(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'hod') return next();
  if (req.user.role === 'faculty') {
    const facRes = await pool.query(
      `SELECT f.is_project_coordinator, ca.id as coord_id
       FROM faculty f
       LEFT JOIN coordinator_assignments ca ON ca.faculty_id = f.id
         AND ca.role_type = 'BE_PROJECT_COORDINATOR' AND ca.is_active = TRUE
       WHERE f.user_id = $1`,
      [req.user.id]
    );
    if (facRes.rows.length > 0 && (facRes.rows[0].is_project_coordinator || facRes.rows[0].coord_id)) {
      req.user.is_project_coordinator = true;
      return next();
    }
  }
  return res.status(403).json({ error: 'Access restricted: Only designated BE Project Coordinator or HOD can access project governance.' });
}

// ============================================================================
// 1. STUDENT ENDPOINTS
// ============================================================================

/**
 * GET /api/projects/student/my-group
 * Get current student's project group, team members, guide status, and released stage scores.
 */
router.get('/student/my-group', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    // Find student's active/current group (matches student_id, case-insensitive email, or roll_no / enrollment_no)
    const groupRes = await pool.query(
      `SELECT g.*, f.id as guide_faculty_id, u.name as guide_name, f.designation as guide_designation, u.email as guide_email,
              gm.id as member_record_id, gm.student_id as member_student_id
       FROM project_groups g
       JOIN project_group_members gm ON g.id = gm.group_id
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE (
         gm.student_id = $1
         OR (gm.email IS NOT NULL AND gm.email != '' AND LOWER(TRIM(gm.email)) = LOWER(TRIM($2)))
         OR (gm.roll_no IS NOT NULL AND gm.roll_no != '' AND (
              LOWER(TRIM(gm.roll_no)) = LOWER(TRIM($3))
              OR LOWER(TRIM(gm.roll_no)) = LOWER(TRIM($4))
            ))
       ) AND g.status != 'WITHDRAWN'
       ORDER BY g.created_at DESC LIMIT 1`,
      [student.id, req.user.email || '', student.roll_no || '', student.enrollment_no || '']
    );

    if (groupRes.rows.length === 0) {
      return res.json({ hasGroup: false });
    }

    const group = groupRes.rows[0];

    // Auto-link student_id if missing in project_group_members
    if (!group.member_student_id && group.member_record_id) {
      await pool.query(
        `UPDATE project_group_members SET student_id = $1 WHERE id = $2`,
        [student.id, group.member_record_id]
      );
    }

    // Fetch team members
    const membersRes = await pool.query(
      `SELECT gm.id, gm.student_id, gm.roll_no, gm.is_leader, gm.mobile_no,
              COALESCE(u.name, gm.student_name, 'Student') as name,
              COALESCE(u.email, gm.email, '') as email,
              COALESCE(s.enrollment_no, gm.roll_no) as enrollment_no,
              COALESCE(s.batch, g.batch) as batch,
              COALESCE(s.division, gm.division, g.batch) as division
       FROM project_group_members gm
       JOIN project_groups g ON gm.group_id = g.id
       LEFT JOIN students s ON gm.student_id = s.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.is_leader DESC, gm.id ASC`,
      [group.id]
    );

    // Guide requests are deprecated (HOD directly assigns guides)
    const guideReqRes = { rows: [] };

    // Fetch all stages for group's academic year
    const stagesRes = await pool.query(
      `SELECT * FROM project_evaluation_stages
       WHERE academic_year = $1 AND is_active = true
       ORDER BY sequence_order ASC`,
      [group.academic_year]
    );

    // Check which stages have been released and confirmed by HOD for students
    const releasesRes = await pool.query(
      `SELECT stage_id, group_id FROM project_score_releases
       WHERE (group_id IS NULL OR group_id = $1) AND (status IS NULL OR status = 'APPROVED')`,
      [group.id]
    );
    const releasedStageIds = new Set(releasesRes.rows.map(r => r.stage_id));

    // Fetch evaluations for released stages
    const stagesWithScores = [];
    for (const stage of stagesRes.rows) {
      const isReleased = releasedStageIds.has(stage.id);

      // Fetch criteria
      const criteriaRes = await pool.query(
        `SELECT * FROM project_stage_criteria WHERE stage_id = $1 ORDER BY display_order ASC`,
        [stage.id]
      );

      let evaluations = [];
      let aggregatedScore = null;

      if (isReleased) {
        // Fetch panelist evaluations for this group and stage
        const evalsRes = await pool.query(
          `SELECT pe.id as evaluation_id, pe.status, pe.submitted_at, pe.overall_remarks,
                  u.name as evaluator_name, f.designation as evaluator_designation
           FROM project_panel_assignments pa
           JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
           JOIN faculty f ON pa.panel_member_id = f.id
           JOIN users u ON f.user_id = u.id
           WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pe.status IN ('SUBMITTED','LOCKED')`,
          [group.id, stage.id]
        );

        for (const ev of evalsRes.rows) {
          const scoresRes = await pool.query(
            `SELECT pes.criterion_id, pes.marks_awarded, pes.remark, sc.name as criterion_name, sc.max_marks
             FROM project_evaluation_scores pes
             JOIN project_stage_criteria sc ON pes.criterion_id = sc.id
             WHERE pes.evaluation_id = $1`,
            [ev.evaluation_id]
          );
          ev.scores = scoresRes.rows;

          const totalEvalScore = ev.scores.reduce((sum, s) => sum + Number(s.marks_awarded), 0);
          ev.total_score = totalEvalScore;
        }

        evaluations = evalsRes.rows;

        if (evaluations.length > 0) {
          const totals = evaluations.map(e => e.total_score);
          if (stage.aggregation_rule === 'SUM') {
            aggregatedScore = totals.reduce((a, b) => a + b, 0);
          } else if (stage.aggregation_rule === 'MAX') {
            aggregatedScore = Math.max(...totals);
          } else {
            // AVERAGE
            aggregatedScore = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2);
          }
        }
      }

      stagesWithScores.push({
        ...stage,
        is_released: isReleased,
        criteria: criteriaRes.rows,
        evaluations,
        aggregated_score: aggregatedScore
      });
    }

    const isLeader = membersRes.rows.some(m =>
      (m.student_id === student.id ||
       (m.email && m.email.trim().toLowerCase() === (req.user.email || '').trim().toLowerCase()) ||
       (m.roll_no && (
         m.roll_no.trim().toLowerCase() === (student.roll_no || '').trim().toLowerCase() ||
         m.roll_no.trim().toLowerCase() === (student.enrollment_no || '').trim().toLowerCase()
       ))) && m.is_leader
    );

    res.json({
      hasGroup: true,
      group,
      members: membersRes.rows,
      guideRequests: guideReqRes.rows,
      stages: stagesWithScores,
      isLeader
    });
  } catch (err) {
    console.error('[Projects Student API Error]', err);
    res.status(500).json({ error: 'Failed to fetch student project data' });
  }
});

/**
 * POST /api/projects/student/groups
 * Register a new project group with full PDF-sheet-style member list and 3 project title choices.
 */
router.post('/student/groups', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { title, title_1, title_2, title_3, domain, abstract, academic_year, batch, members } = req.body;
    
    const projTitle1 = title_1 || title;
    if (!projTitle1 || !domain) {
      return res.status(400).json({ error: 'Project Domain and Project Title 1 are required' });
    }

    if (!Array.isArray(members) || members.length < 3) {
      return res.status(400).json({ error: 'Project group must consist of at least 3 student members' });
    }

    if (members.length > 4) {
      return res.status(400).json({ error: 'Project group cannot exceed 4 student members' });
    }

    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const acadYear = academic_year || '2026-27';
    const studentBatch = batch || members[0]?.division || student.batch || 'BE-CE-A';

    // Check registration form open status and due date
    const regSettingsRes = await pool.query(
      `SELECT is_registration_open, due_date FROM project_registration_settings WHERE academic_year = $1`,
      [acadYear]
    );
    if (regSettingsRes.rows.length > 0) {
      const { is_registration_open, due_date } = regSettingsRes.rows[0];
      if (is_registration_open === false) {
        return res.status(400).json({
          error: 'Project group registration is currently closed by the BE Project Coordinator.'
        });
      }
      if (due_date && new Date() > new Date(due_date)) {
        const formattedDueDate = new Date(due_date).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });
        return res.status(400).json({
          error: `Project group registration deadline has passed (${formattedDueDate}). Registration is closed.`
        });
      }
    }

    // Check if leader or any member in the list is already in an active group
    const existingGroup = await pool.query(
      `SELECT g.id, g.group_code FROM project_groups g
       JOIN project_group_members gm ON g.id = gm.group_id
       WHERE (
         gm.student_id = $1
         OR (gm.email IS NOT NULL AND gm.email != '' AND LOWER(TRIM(gm.email)) = LOWER(TRIM($2)))
         OR (gm.roll_no IS NOT NULL AND gm.roll_no != '' AND (
              LOWER(TRIM(gm.roll_no)) = LOWER(TRIM($3))
              OR LOWER(TRIM(gm.roll_no)) = LOWER(TRIM($4))
            ))
       ) AND g.academic_year = $5 AND g.status != 'WITHDRAWN'`,
      [student.id, req.user.email || '', student.roll_no || '', student.enrollment_no || '', acadYear]
    );

    if (existingGroup.rows.length > 0) {
      return res.status(400).json({
        error: `You or one of your team members is already registered in active group ${existingGroup.rows[0].group_code}`
      });
    }

    // Generate unique Group Code
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM project_groups WHERE academic_year = $1`,
      [acadYear]
    );
    const num = parseInt(countRes.rows[0].count, 10) + 1;
    const yearPrefix = acadYear.split('-')[0];
    const groupCode = `GRP-${yearPrefix}-${num.toString().padStart(2, '0')}`;

    // Create group inside transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const groupRes = await client.query(
        `INSERT INTO project_groups (group_code, academic_year, batch, title, title_2, title_3, domain, abstract, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9)
         RETURNING *`,
        [groupCode, acadYear, studentBatch, projTitle1, title_2 || '', title_3 || '', domain, abstract || '', req.user.id]
      );
      const newGroup = groupRes.rows[0];

      // Insert all members from form payload
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const isLeader = i === 0 || !!m.is_leader;
        
        let matchedStudentId = isLeader ? student.id : null;
        if (!matchedStudentId) {
          const mEmail = (m.email || '').trim();
          const mRollNo = (m.roll_no || m.prn || '').trim();

          if (mEmail || mRollNo) {
            const matchRes = await client.query(
              `SELECT s.id, u.name, u.email, s.roll_no, s.enrollment_no
               FROM students s
               JOIN users u ON s.user_id = u.id
               WHERE (
                 ($1 != '' AND LOWER(TRIM(u.email)) = LOWER($1))
                 OR ($2 != '' AND (LOWER(TRIM(s.roll_no)) = LOWER($2) OR LOWER(TRIM(s.enrollment_no)) = LOWER($2)))
               ) LIMIT 1`,
              [mEmail.toLowerCase(), mRollNo.toLowerCase()]
            );
            if (matchRes.rows.length > 0) {
              matchedStudentId = matchRes.rows[0].id;
              if (!m.email && matchRes.rows[0].email) m.email = matchRes.rows[0].email;
              if (!m.roll_no && matchRes.rows[0].roll_no) m.roll_no = matchRes.rows[0].roll_no;
              if (!m.name && matchRes.rows[0].name) m.name = matchRes.rows[0].name;
            }
          }
        }

        await client.query(
          `INSERT INTO project_group_members (group_id, student_id, roll_no, student_name, email, mobile_no, division, is_leader)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newGroup.id,
            matchedStudentId,
            m.roll_no || m.prn || '',
            m.name || m.student_name || '',
            m.email || '',
            m.mobile_no || '',
            m.division || 'BE-1',
            isLeader
          ]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ message: 'Project group registered successfully', group: newGroup });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Create Group Error]', err);
    res.status(500).json({ error: 'Failed to register project group' });
  }
});

/**
 * POST /api/projects/student/groups/join
 * Join an existing group using group_code.
 */
router.post('/student/groups/join', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { group_code } = req.body;
    if (!group_code) return res.status(400).json({ error: 'Group Code is required' });

    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const groupRes = await pool.query(
      `SELECT * FROM project_groups WHERE group_code = $1 AND status != 'WITHDRAWN'`,
      [group_code.trim().toUpperCase()]
    );
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group code not found or group is inactive' });
    }
    const group = groupRes.rows[0];

    // Check if student is already in a group
    const existingGroup = await pool.query(
      `SELECT g.id FROM project_groups g
       JOIN project_group_members gm ON g.id = gm.group_id
       WHERE gm.student_id = $1 AND g.academic_year = $2 AND g.status != 'WITHDRAWN'`,
      [student.id, group.academic_year]
    );
    if (existingGroup.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of an active project group' });
    }

    // Check group size limit (min 2, max 4)
    const membersRes = await pool.query(
      `SELECT COUNT(*) FROM project_group_members WHERE group_id = $1`,
      [group.id]
    );
    const memberCount = parseInt(membersRes.rows[0].count, 10);
    if (memberCount >= 4) {
      return res.status(400).json({ error: 'Group has reached maximum capacity of 4 members' });
    }

    await pool.query(
      `INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader)
       VALUES ($1, $2, $3, false)`,
      [group.id, student.id, student.roll_no]
    );

    res.json({ message: `Successfully joined group ${group.group_code}`, group });
  } catch (err) {
    console.error('[Join Group Error]', err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

/**
 * POST /api/projects/student/guide-requests
 * Request a faculty member to be project guide.
 */
router.post('/student/guide-requests', verifyToken, requireRole('student'), async (req, res) => {
  return res.status(400).json({
    error: 'Guide selection by students is disabled. Project guides are assigned directly by the Head of Department (HOD).'
  });
});

/**
 * GET /api/projects/student/available-guides
 * Get list of available faculty members with current guide loads.
 */
router.get('/student/available-guides', verifyToken, async (req, res) => {
  try {
    const resList = await pool.query(
      `SELECT f.id as faculty_id, u.name, u.email, f.designation, f.employee_id,
              COUNT(g.id) as current_guided_groups
       FROM faculty f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status = 'ACTIVE'
       GROUP BY f.id, u.name, u.email, f.designation, f.employee_id
       ORDER BY u.name ASC`
    );
    res.json(resList.rows);
  } catch (err) {
    console.error('[Available Guides Error]', err);
    res.status(500).json({ error: 'Failed to fetch available guides' });
  }
});

/**
 * GET /api/projects/registration-settings
 * Get project registration form controls (open/closed status, due date) for an academic year.
 */
router.get('/registration-settings', verifyToken, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';
    const settingsRes = await pool.query(
      `SELECT * FROM project_registration_settings WHERE academic_year = $1`,
      [acadYear]
    );

    if (settingsRes.rows.length === 0) {
      return res.json({
        academic_year: acadYear,
        is_registration_open: true,
        due_date: null,
        is_open: true
      });
    }

    const row = settingsRes.rows[0];
    const now = new Date();
    const isPastDueDate = row.due_date ? now > new Date(row.due_date) : false;
    const isOpen = Boolean(row.is_registration_open) && !isPastDueDate;

    res.json({
      ...row,
      is_past_due_date: isPastDueDate,
      is_open: isOpen
    });
  } catch (err) {
    console.error('[Get Registration Settings Error]', err);
    res.status(500).json({ error: 'Failed to fetch registration settings' });
  }
});

/**
 * PATCH /api/projects/registration-settings
 * Update project registration form controls (toggle open/closed, set due date).
 * Accessible by BE Project Coordinator or HOD.
 */
router.patch('/registration-settings', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { academic_year, is_registration_open, due_date } = req.body;
    const acadYear = academic_year || '2026-27';
    const isOpen = is_registration_open !== undefined ? Boolean(is_registration_open) : true;
    const dueDateVal = due_date ? new Date(due_date).toISOString() : null;

    const result = await pool.query(
      `INSERT INTO project_registration_settings (academic_year, is_registration_open, due_date, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (academic_year) DO UPDATE
       SET is_registration_open = EXCLUDED.is_registration_open,
           due_date = EXCLUDED.due_date,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
       RETURNING *`,
      [acadYear, isOpen, dueDateVal, req.user.id]
    );

    const row = result.rows[0];
    const now = new Date();
    const isPastDueDate = row.due_date ? now > new Date(row.due_date) : false;

    res.json({
      message: 'Project registration form settings updated successfully',
      settings: {
        ...row,
        is_past_due_date: isPastDueDate,
        is_open: Boolean(row.is_registration_open) && !isPastDueDate
      }
    });
  } catch (err) {
    console.error('[Update Registration Settings Error]', err);
    res.status(500).json({ error: 'Failed to update registration settings' });
  }
});

/**
 * DELETE /api/projects/hod/groups/purge
 * Delete all registered project group forms for an academic year.
 * Accessible by BE Project Coordinator or HOD.
 */
router.delete('/hod/groups/purge', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM project_groups WHERE academic_year = $1 AND status != 'WITHDRAWN'`,
      [acadYear]
    );
    const count = parseInt(countRes.rows[0].count, 10);

    await pool.query(
      `DELETE FROM project_groups WHERE academic_year = $1`,
      [acadYear]
    );

    res.json({
      message: `Successfully deleted all ${count} registered project group forms for academic year ${acadYear}.`,
      deletedCount: count
    });
  } catch (err) {
    console.error('[Purge Registered Groups Error]', err);
    res.status(500).json({ error: 'Failed to delete registered forms' });
  }
});


// ============================================================================
// 2. FACULTY / GUIDE ENDPOINTS
// ============================================================================

/**
 * GET /api/projects/guide/requests
 * List pending guide requests for the logged-in faculty.
 */
router.get('/guide/requests', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  res.json([]);
});

/**
 * PATCH /api/projects/guide/requests/:id
 * Deprecated endpoint - guides assigned directly by HOD.
 */
router.patch('/guide/requests/:id', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  res.json({ message: 'Guide requests are deprecated. Guides are assigned directly by the HOD.' });
});

/**
 * GET /api/projects/guide/my-groups
 * List groups guided by the logged-in faculty member.
 */
router.get('/guide/my-groups', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const facultyId = await getFacultyId(req.user.id);

    const groupsRes = await pool.query(
      `SELECT g.*,
              COUNT(gm.id) as member_count
       FROM project_groups g
       LEFT JOIN project_group_members gm ON g.id = gm.group_id
       WHERE g.guide_id = $1 AND g.status != 'WITHDRAWN'
       GROUP BY g.id
       ORDER BY g.group_code ASC`,
      [facultyId]
    );

    for (const group of groupsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.is_leader, gm.division, gm.mobile_no,
                COALESCE(u.name, gm.student_name, 'Student') as name,
                COALESCE(u.email, gm.email, '') as email
         FROM project_group_members gm
         LEFT JOIN students s ON gm.student_id = s.id
         LEFT JOIN users u ON s.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [group.id]
      );
      group.members = membersRes.rows;
    }

    res.json(groupsRes.rows);
  } catch (err) {
    console.error('[My Guided Groups Error]', err);
    res.status(500).json({ error: 'Failed to fetch guided groups' });
  }
});


// ============================================================================
// 3. PANELIST / EVALUATOR ENDPOINTS
// ============================================================================

/**
 * GET /api/projects/evaluator/assignments
 * Get panel assignments for the logged-in faculty evaluator.
 */
router.get('/evaluator/assignments', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const facultyId = await getFacultyId(req.user.id);
    if (!facultyId) return res.status(404).json({ error: 'Faculty record not found' });

    const assignmentsRes = await pool.query(
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
       WHERE pa.panel_member_id = $1
       ORDER BY s.sequence_order ASC, g.group_code ASC`,
      [facultyId]
    );

    for (const row of assignmentsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, COALESCE(u.name, gm.student_name, 'Student') as name FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [row.group_id]
      );
      row.members = membersRes.rows;
    }

    res.json(assignmentsRes.rows);
  } catch (err) {
    console.error('[Evaluator Assignments Error]', err);
    res.status(500).json({ error: 'Failed to fetch panel assignments' });
  }
});

/**
 * GET /api/projects/evaluations/:assignmentId
 * Get evaluation form details for a panel assignment with individual student members.
 */
router.get('/evaluations/:assignmentId', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const facultyId = await getFacultyId(req.user.id);

    const assignRes = await pool.query(
      `SELECT pa.id as assignment_id, pa.panel_member_id, pa.status as assignment_status,
              s.id as stage_id, s.name as stage_name, s.max_marks_total,
              g.id as group_id, g.group_code, g.title, g.domain, g.guide_id,
              gu.name as guide_name
       FROM project_panel_assignments pa
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       JOIN project_groups g ON pa.group_id = g.id
       LEFT JOIN faculty gf ON g.guide_id = gf.id
       LEFT JOIN users gu ON gf.user_id = gu.id
       WHERE pa.id = $1`,
      [assignmentId]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    const assign = assignRes.rows[0];

    // Conflict of interest check
    const isGuide = assign.guide_id === facultyId;

    // Fetch criteria for this stage
    const criteriaRes = await pool.query(
      `SELECT * FROM project_stage_criteria WHERE stage_id = $1 ORDER BY display_order ASC`,
      [assign.stage_id]
    );

    // Fetch team members
    const membersRes = await pool.query(
      `SELECT gm.id as id, gm.id as member_id, gm.student_id, gm.roll_no, COALESCE(u.name, gm.student_name, 'Student') as name, gm.is_leader
       FROM project_group_members gm
       LEFT JOIN students st ON gm.student_id = st.id
       LEFT JOIN users u ON st.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.is_leader DESC, gm.id ASC`,
      [assign.group_id]
    );

    // Fetch existing evaluation draft/submission
    const evalRes = await pool.query(
      `SELECT * FROM project_evaluations WHERE panel_assignment_id = $1`,
      [assignmentId]
    );

    let evaluation = null;
    let scoresMap = {};
    let studentScoresMap = {};
    if (evalRes.rows.length > 0) {
      evaluation = evalRes.rows[0];
      const scoresRes = await pool.query(
        `SELECT * FROM project_evaluation_scores WHERE evaluation_id = $1`,
        [evaluation.id]
      );
      for (const s of scoresRes.rows) {
        scoresMap[s.criterion_id] = { marks_awarded: s.marks_awarded, remark: s.remark };
        if (s.member_id) {
          if (!studentScoresMap[s.member_id]) studentScoresMap[s.member_id] = {};
          studentScoresMap[s.member_id][s.criterion_id] = { marks_awarded: s.marks_awarded, remark: s.remark };
        }
      }
    }

    res.json({
      assignment: assign,
      isGuide,
      members: membersRes.rows,
      criteria: criteriaRes.rows,
      evaluation,
      scoresMap,
      studentScoresMap
    });
  } catch (err) {
    console.error('[Get Evaluation Error]', err);
    res.status(500).json({ error: 'Failed to fetch evaluation form' });
  }
});

/**
 * POST /api/projects/evaluations
 * Save draft or submit evaluation for an assigned panel group with individual student scoring.
 */
router.post('/evaluations', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const { assignment_id, status, overall_remarks, scores, student_scores } = req.body;
    if (!assignment_id || !status) {
      return res.status(400).json({ error: 'Invalid submission payload' });
    }

    if (!['DRAFT', 'SUBMITTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be DRAFT or SUBMITTED' });
    }

    const facultyId = await getFacultyId(req.user.id);

    // Fetch assignment & group details
    const assignRes = await pool.query(
      `SELECT pa.*, g.id as group_id, g.guide_id, s.max_marks_total
       FROM project_panel_assignments pa
       JOIN project_groups g ON pa.group_id = g.id
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       WHERE pa.id = $1`,
      [assignment_id]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Panel assignment not found' });
    }
    const assign = assignRes.rows[0];

    if (assign.panel_member_id !== facultyId && req.user.role !== 'hod') {
      return res.status(403).json({ error: 'You are not assigned to evaluate this group' });
    }

    // Fetch group members
    const assignMembersRes = await pool.query(
      `SELECT id, student_id FROM project_group_members WHERE group_id = $1`,
      [assign.group_id]
    );
    const assignMembers = assignMembersRes.rows;

    // Build flattened scores array
    let flattenScores = [];
    if (Array.isArray(student_scores)) {
      for (const stScore of student_scores) {
        const memId = stScore.member_id;
        const stId = stScore.student_id || null;
        for (const sc of (stScore.scores || [])) {
          flattenScores.push({
            member_id: memId,
            student_id: stId,
            criterion_id: sc.criterion_id,
            marks_awarded: sc.marks_awarded,
            remark: sc.remark
          });
        }
      }
    } else if (Array.isArray(scores)) {
      for (const sc of scores) {
        if (sc.member_id) {
          flattenScores.push(sc);
        } else {
          for (const m of assignMembers) {
            flattenScores.push({
              member_id: m.id,
              student_id: m.student_id,
              criterion_id: sc.criterion_id,
              marks_awarded: sc.marks_awarded,
              remark: sc.remark
            });
          }
        }
      }
    }

    // Check existing evaluation status (Locked / Submitted check)
    const existingEvalRes = await pool.query(
      `SELECT * FROM project_evaluations WHERE panel_assignment_id = $1`,
      [assignment_id]
    );

    if (existingEvalRes.rows.length > 0) {
      const existing = existingEvalRes.rows[0];
      if (existing.status === 'SUBMITTED' && !existing.is_unlocked && req.user.role !== 'hod') {
        return res.status(423).json({
          error: 'This evaluation has already been submitted and locked. Ask HOD to unlock if corrections are required.'
        });
      }
    }

    // Validate marks per criterion against criterion max_marks
    const criteriaRes = await pool.query(
      `SELECT id, name, max_marks FROM project_stage_criteria WHERE stage_id = $1`,
      [assign.stage_id]
    );
    const criteriaMap = {};
    for (const c of criteriaRes.rows) criteriaMap[c.id] = c;

    for (const sc of flattenScores) {
      const crit = criteriaMap[sc.criterion_id];
      if (!crit) {
        return res.status(400).json({ error: `Invalid criterion ID ${sc.criterion_id}` });
      }
      if (Number(sc.marks_awarded) < 0 || Number(sc.marks_awarded) > Number(crit.max_marks)) {
        return res.status(400).json({
          error: `Marks for '${crit.name}' must be between 0 and ${crit.max_marks}`
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let evalId;
      if (existingEvalRes.rows.length > 0) {
        evalId = existingEvalRes.rows[0].id;
        const submittedAt = status === 'SUBMITTED' ? (existingEvalRes.rows[0].submitted_at || new Date()) : existingEvalRes.rows[0].submitted_at;
        await client.query(
          `UPDATE project_evaluations
           SET status = $1, submitted_at = $2,
               overall_remarks = $3, is_unlocked = false
           WHERE id = $4`,
          [status, submittedAt, overall_remarks || '', evalId]
        );
      } else {
        const submittedAt = status === 'SUBMITTED' ? new Date() : null;
        const newEval = await client.query(
          `INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [assignment_id, status, submittedAt, overall_remarks || '']
        );
        evalId = newEval.rows[0].id;
      }

      // Upsert scores per member
      for (const sc of flattenScores) {
        await client.query(
          `INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, member_id, student_id, marks_awarded, remark)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (evaluation_id, criterion_id, member_id)
           DO UPDATE SET marks_awarded = EXCLUDED.marks_awarded, remark = EXCLUDED.remark`,
          [evalId, sc.criterion_id, sc.member_id, sc.student_id || null, Number(sc.marks_awarded), sc.remark || '']
        );
      }

      // Update assignment status to COMPLETED if submitted
      if (status === 'SUBMITTED') {
        await client.query(
          `UPDATE project_panel_assignments SET status = 'COMPLETED' WHERE id = $1`,
          [assignment_id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: `Evaluation ${status === 'SUBMITTED' ? 'submitted & locked' : 'saved as draft'} successfully` });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Save Evaluation Error]', err);
    res.status(500).json({ error: 'Failed to save evaluation' });
  }
});


// ============================================================================
// 4. HOD / COORDINATOR GOVERNANCE ENDPOINTS
// ============================================================================

/**
 * GET /api/projects/hod/dashboard
 * Department oversight analytics, status overview, and pending approvals count.
 */
router.get('/hod/dashboard', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsCount = await pool.query(
      `SELECT status, COUNT(*) FROM project_groups WHERE academic_year = $1 GROUP BY status`,
      [acadYear]
    );

    const stagesRes = await pool.query(
      `SELECT * FROM project_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    const guideLoadRes = await pool.query(
      `SELECT f.id as faculty_id, u.name, f.designation,
              COUNT(DISTINCT g.id) as guided_groups,
              COUNT(DISTINCT pa.id) as panel_assignments
       FROM faculty f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status = 'ACTIVE' AND g.academic_year = $1
       LEFT JOIN project_panel_assignments pa ON pa.panel_member_id = f.id
       GROUP BY f.id, u.name, f.designation
       ORDER BY u.name ASC`,
      [acadYear]
    );

    const totalGroupsRes = await pool.query(
      `SELECT COUNT(*) FROM project_groups WHERE academic_year = $1 AND status != 'WITHDRAWN'`,
      [acadYear]
    );

    const totalAssignedEvals = await pool.query(
      `SELECT pa.status, COUNT(*) FROM project_panel_assignments pa
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       WHERE s.academic_year = $1 GROUP BY pa.status`,
      [acadYear]
    );

    // Pending HOD Approvals count
    const pendingGuidesRes = await pool.query(
      `SELECT COUNT(*) FROM project_groups WHERE academic_year = $1 AND guide_approval_status = 'PENDING_HOD_APPROVAL'`,
      [acadYear]
    );
    const pendingScoreReleasesRes = await pool.query(
      `SELECT COUNT(*) FROM project_score_releases sr
       JOIN project_evaluation_stages s ON sr.stage_id = s.id
       WHERE s.academic_year = $1 AND sr.status = 'PENDING_HOD_APPROVAL'`,
      [acadYear]
    );

    res.json({
      academic_year: acadYear,
      total_groups: parseInt(totalGroupsRes.rows[0].count, 10),
      group_status_breakdown: groupsCount.rows,
      evaluation_status_breakdown: totalAssignedEvals.rows,
      stages: stagesRes.rows,
      faculty_load: guideLoadRes.rows,
      pending_approvals: {
        pending_guides_count: parseInt(pendingGuidesRes.rows[0].count, 10),
        pending_scores_count: parseInt(pendingScoreReleasesRes.rows[0].count, 10),
        total_pending: parseInt(pendingGuidesRes.rows[0].count, 10) + parseInt(pendingScoreReleasesRes.rows[0].count, 10)
      }
    });
  } catch (err) {
    console.error('[HOD Dashboard Error]', err);
    res.status(500).json({ error: 'Failed to fetch project dashboard data' });
  }
});

/**
 * GET /api/projects/hod/groups
 * List all project groups with detailed roster, guide info, proposed guide info, and stage statuses.
 */
router.get('/hod/groups', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT g.*,
              f.id as guide_faculty_id, u.name as guide_name, f.designation as guide_designation,
              pf.id as proposed_guide_faculty_id, pu.name as proposed_guide_name, pf.designation as proposed_guide_designation,
              req_u.name as guide_requested_by_name
       FROM project_groups g
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN faculty pf ON g.proposed_guide_id = pf.id
       LEFT JOIN users pu ON pf.user_id = pu.id
       LEFT JOIN users req_u ON g.guide_requested_by = req_u.id
       WHERE g.academic_year = $1
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    for (const g of groupsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.is_leader, gm.division, gm.mobile_no,
                COALESCE(u.name, gm.student_name, 'Student') as name,
                COALESCE(u.email, gm.email, '') as email
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [g.id]
      );
      g.members = membersRes.rows;

      const evalProgress = await pool.query(
        `SELECT s.id as stage_id, s.name as stage_name, pa.id as assignment_id, pa.panel_member_id,
                pu.name as evaluator_name, pe.status as eval_status
         FROM project_evaluation_stages s
         LEFT JOIN project_panel_assignments pa ON pa.stage_id = s.id AND pa.group_id = $1
         LEFT JOIN faculty pf ON pa.panel_member_id = pf.id
         LEFT JOIN users pu ON pf.user_id = pu.id
         LEFT JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
         WHERE s.academic_year = $2 ORDER BY s.sequence_order ASC`,
        [g.id, acadYear]
      );
      g.stage_evaluations = evalProgress.rows;
    }

    res.json(groupsRes.rows);
  } catch (err) {
    console.error('[HOD List Groups Error]', err);
    res.status(500).json({ error: 'Failed to fetch project groups' });
  }
});

/**
 * PATCH /api/projects/hod/groups/:id/guide
 * Assign/reassign project guide. If called by BE Project Coordinator, submits for HOD approval.
 * If called by HOD, directly assigns and confirms guide.
 */
router.patch('/hod/groups/:id/guide', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { guide_id } = req.body; // faculty id or null
    const isHOD = req.user.role === 'hod';

    if (isHOD) {
      // HOD direct assignment & confirmation
      if (guide_id) {
        await pool.query(
          `UPDATE project_groups
           SET guide_id = $1, proposed_guide_id = $1, guide_approval_status = 'APPROVED',
               guide_requested_by = $2, guide_decided_at = NOW(), status = 'ACTIVE'
           WHERE id = $3`,
          [guide_id, req.user.id, groupId]
        );
        res.json({ message: 'Guide assigned and confirmed by HOD', approval_status: 'APPROVED' });
      } else {
        await pool.query(
          `UPDATE project_groups
           SET guide_id = NULL, proposed_guide_id = NULL, guide_approval_status = 'NONE',
               guide_requested_by = NULL, guide_decided_at = NOW(), status = 'DRAFT'
           WHERE id = $1`,
          [groupId]
        );
        res.json({ message: 'Guide unassigned successfully', approval_status: 'NONE' });
      }
    } else {
      // BE Project Coordinator proposal (Requires HOD Confirmation)
      if (guide_id) {
        await pool.query(
          `UPDATE project_groups
           SET proposed_guide_id = $1, guide_approval_status = 'PENDING_HOD_APPROVAL',
               guide_requested_by = $2
           WHERE id = $3`,
          [guide_id, req.user.id, groupId]
        );
        res.json({
          message: 'Guide selection submitted for HOD confirmation. Guide assignment will take effect once HOD confirms.',
          approval_status: 'PENDING_HOD_APPROVAL'
        });
      } else {
        await pool.query(
          `UPDATE project_groups
           SET proposed_guide_id = NULL, guide_approval_status = 'PENDING_HOD_APPROVAL',
               guide_requested_by = $1
           WHERE id = $2`,
          [req.user.id, groupId]
        );
        res.json({
          message: 'Guide unassignment request submitted for HOD confirmation.',
          approval_status: 'PENDING_HOD_APPROVAL'
        });
      }
    }
  } catch (err) {
    console.error('[Assign Guide Error]', err);
    res.status(500).json({ error: 'Failed to assign guide' });
  }
});

/**
 * POST /api/projects/hod/groups/:id/confirm-guide (HOD only)
 * Confirm or Reject a proposed guide assignment.
 */
router.post('/groups/:id/confirm-guide', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const groupId = req.params.id;
    const { action, remarks } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    const groupRes = await pool.query(`SELECT * FROM project_groups WHERE id = $1`, [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const group = groupRes.rows[0];

    if (action === 'APPROVE') {
      const newGuideId = group.proposed_guide_id;
      await pool.query(
        `UPDATE project_groups
         SET guide_id = $1, guide_approval_status = 'APPROVED', guide_decided_at = NOW(),
             status = CASE WHEN $1::int IS NOT NULL THEN 'ACTIVE' ELSE 'DRAFT' END
         WHERE id = $2`,
        [newGuideId, groupId]
      );
      res.json({ message: 'Guide assignment confirmed and activated by HOD' });
    } else {
      await pool.query(
        `UPDATE project_groups
         SET proposed_guide_id = NULL, guide_approval_status = 'REJECTED', guide_decided_at = NOW()
         WHERE id = $1`,
        [groupId]
      );
      res.json({ message: 'Proposed guide assignment rejected by HOD' });
    }
  } catch (err) {
    console.error('[Confirm Guide Error]', err);
    res.status(500).json({ error: 'Failed to process guide confirmation' });
  }
});

/**
 * DELETE /api/projects/hod/groups/all
 * Clear all BE project group data (groups, members, assignments, evaluations, scores).
 */
router.delete('/hod/groups/all', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE TABLE project_evaluation_scores, project_evaluations, project_panel_assignments, project_score_releases, project_guide_requests, project_group_members, project_groups RESTART IDENTITY CASCADE`
    );
    await client.query('COMMIT');
    res.json({ message: 'All BE project group data erased successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[HOD Clear All Groups Error]', err);
    res.status(500).json({ error: 'Failed to erase project group data' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/projects/hod/groups/clear-guides
 * Bulk reset/unassign project guides across all groups for an academic year.
 */
router.post('/hod/groups/clear-guides', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { academic_year } = req.body;
    const acadYear = academic_year || '2026-27';

    if (req.user.role === 'hod') {
      const result = await pool.query(
        `UPDATE project_groups
         SET guide_id = NULL, proposed_guide_id = NULL, guide_approval_status = 'NONE', status = 'DRAFT'
         WHERE academic_year = $1 RETURNING id`,
        [acadYear]
      );
      res.json({ message: `Successfully reset/unassigned project guides for ${result.rowCount} groups!`, cleared_count: result.rowCount });
    } else {
      const result = await pool.query(
        `UPDATE project_groups
         SET proposed_guide_id = NULL, guide_approval_status = 'PENDING_HOD_APPROVAL', guide_requested_by = $1
         WHERE academic_year = $2 RETURNING id`,
        [req.user.id, acadYear]
      );
      res.json({ message: `Guide clear request submitted to HOD for ${result.rowCount} groups.`, cleared_count: result.rowCount });
    }
  } catch (err) {
    console.error('[Clear Guides Error]', err);
    res.status(500).json({ error: 'Failed to clear guide assignments' });
  }
});

/**
 * GET /api/projects/hod/stages
 * Get all evaluation stages and criteria for an academic year.
 */
router.get('/hod/stages', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const stagesRes = await pool.query(
      `SELECT * FROM project_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    for (const stage of stagesRes.rows) {
      const criteriaRes = await pool.query(
        `SELECT * FROM project_stage_criteria WHERE stage_id = $1 ORDER BY display_order ASC`,
        [stage.id]
      );
      stage.criteria = criteriaRes.rows;
    }

    res.json(stagesRes.rows);
  } catch (err) {
    console.error('[HOD Stages Error]', err);
    res.status(500).json({ error: 'Failed to fetch evaluation stages' });
  }
});

/**
 * POST /api/projects/hod/stages
 * Create or update an evaluation stage.
 */
router.post('/hod/stages', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { id, name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, criteria } = req.body;
    if (!name || !sequence_order) {
      return res.status(400).json({ error: 'Stage Name and Sequence Order are required' });
    }

    const acadYear = academic_year || '2026-27';
    const dateFrom = scheduled_date_from && scheduled_date_from.trim() !== '' ? scheduled_date_from : null;
    const dateTo = scheduled_date_to && scheduled_date_to.trim() !== '' ? scheduled_date_to : null;
    const maxMarks = max_marks_total !== undefined && max_marks_total !== null ? Number(max_marks_total) : 100;
    const aggRule = aggregation_rule || 'AVERAGE';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let stageId = id;
      if (stageId) {
        await client.query(
          `UPDATE project_evaluation_stages
           SET name = $1, sequence_order = $2, scheduled_date_from = $3, scheduled_date_to = $4,
               max_marks_total = $5, aggregation_rule = $6
           WHERE id = $7`,
          [name, sequence_order, dateFrom, dateTo, maxMarks, aggRule, stageId]
        );
      } else {
        const newStage = await client.query(
          `INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [name, acadYear, sequence_order, dateFrom, dateTo, maxMarks, aggRule]
        );
        stageId = newStage.rows[0].id;
      }

      if (Array.isArray(criteria)) {
        if (id) {
          const keptIds = criteria.map((c) => c.id).filter(Boolean);
          if (keptIds.length > 0) {
            await client.query(
              `DELETE FROM project_stage_criteria WHERE stage_id = $1 AND id NOT IN (${keptIds.map((_, idx) => `$${idx + 2}`).join(',')})`,
              [stageId, ...keptIds]
            );
          } else {
            await client.query(`DELETE FROM project_stage_criteria WHERE stage_id = $1`, [stageId]);
          }
        }

        for (let i = 0; i < criteria.length; i++) {
          const c = criteria[i];
          if (!c.name || !c.name.trim()) continue;
          const cMaxMarks = c.max_marks !== undefined ? Number(c.max_marks) : 10;
          if (c.id) {
            await client.query(
              `UPDATE project_stage_criteria SET name = $1, max_marks = $2, display_order = $3 WHERE id = $4`,
              [c.name.trim(), cMaxMarks, i + 1, c.id]
            );
          } else {
            await client.query(
              `INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, $2, $3, $4)`,
              [stageId, c.name.trim(), cMaxMarks, i + 1]
            );
          }
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Stage saved successfully', stage_id: stageId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Save Stage Error]', err);
    res.status(500).json({ error: 'Failed to save stage' });
  }
});

/**
 * DELETE /api/projects/hod/stages/:id
 * Delete an evaluation stage.
 */
router.delete('/hod/stages/:id', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM project_evaluation_stages WHERE id = $1', [id]);
    res.json({ message: 'Evaluation stage deleted successfully' });
  } catch (err) {
    console.error('[Delete Stage Error]', err);
    res.status(500).json({ error: 'Failed to delete evaluation stage' });
  }
});

/**
 * POST /api/projects/hod/panel-assignments
 * Assign panel members to a group for a stage with Conflict-of-Interest (COI) check.
 */
router.post('/hod/panel-assignments', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id, group_id, panel_member_ids } = req.body;
    if (!stage_id || !group_id || !Array.isArray(panel_member_ids)) {
      return res.status(400).json({ error: 'stage_id, group_id, and panel_member_ids are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2`,
        [stage_id, group_id]
      );

      for (const facId of panel_member_ids) {
        await client.query(
          `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
           VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
          [stage_id, group_id, facId, req.user.id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: 'Panel assignments updated successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Panel Assignment Error]', err);
    res.status(500).json({ error: 'Failed to save panel assignment' });
  }
});

/**
 * GET /api/projects/hod/panel-matrix
 * Get all project groups with their assigned guide and panel examiners for a given stage.
 */
router.get('/hod/panel-matrix', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';
    const stageId = req.query.stage_id ? Number(req.query.stage_id) : null;

    const groupsRes = await pool.query(
      `SELECT g.id, g.group_code, g.title, g.domain, g.batch, g.guide_id,
              u.name as guide_name, f.designation as guide_designation
       FROM project_groups g
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    let panelMap = {};
    if (stageId) {
      const panelRes = await pool.query(
        `SELECT pa.group_id, pa.panel_member_id, u.name as panelist_name, f.designation
         FROM project_panel_assignments pa
         JOIN faculty f ON pa.panel_member_id = f.id
         JOIN users u ON f.user_id = u.id
         WHERE pa.stage_id = $1`,
        [stageId]
      );

      for (const row of panelRes.rows) {
        if (!panelMap[row.group_id]) panelMap[row.group_id] = [];
        panelMap[row.group_id].push({
          faculty_id: row.panel_member_id,
          name: row.panelist_name,
          designation: row.designation,
        });
      }
    }

    const matrix = groupsRes.rows.map((g) => {
      const panelists = panelMap[g.id] || [];
      return {
        ...g,
        panelists,
      };
    });

    res.json(matrix);
  } catch (err) {
    console.error('[Panel Matrix Error]', err);
    res.status(500).json({ error: 'Failed to fetch panel matrix' });
  }
});

/**
 * POST /api/projects/hod/panel-auto-assign
 * Automatically assign balanced panel members across all groups for a stage.
 */
router.post('/hod/panel-auto-assign', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id, academic_year, panel_size, panelists_per_group, faculty_ids } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const acadYear = academic_year || '2026-27';
    const targetPanelSize = Math.max(1, Math.min(3, Number(panel_size || panelists_per_group || 2)));

    let groupsRes = await pool.query(
      `SELECT id, group_code, guide_id, proposed_guide_id FROM project_groups WHERE academic_year = $1 AND status != 'WITHDRAWN' ORDER BY id ASC`,
      [acadYear]
    );
    let groups = groupsRes.rows;

    if (groups.length === 0) {
      const fallbackRes = await pool.query(
        `SELECT id, group_code, guide_id, proposed_guide_id FROM project_groups WHERE status != 'WITHDRAWN' ORDER BY id ASC`
      );
      groups = fallbackRes.rows;
    }

    if (groups.length === 0) return res.status(400).json({ error: 'No active project groups found' });

    let facultyRes;
    if (Array.isArray(faculty_ids) && faculty_ids.length > 0) {
      facultyRes = await pool.query(
        `SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = ANY($1::int[])`,
        [faculty_ids.map(Number)]
      );
    } else {
      facultyRes = await pool.query(
        `SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id ORDER BY f.id ASC`
      );
    }
    const facultyList = facultyRes.rows;
    if (facultyList.length === 0) {
      return res.status(400).json({ error: 'No faculty members found for panel assignment' });
    }

    const effectivePanelSize = Math.min(targetPanelSize, facultyList.length);

    const workload = {};
    facultyList.forEach((f) => {
      workload[f.id] = 0;
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM project_panel_assignments WHERE stage_id = $1`, [stage_id]);

      let assignedGroupCount = 0;

      for (const grp of groups) {
        // Exclude guide/proposed guide to prevent Conflict of Interest
        const guideId = grp.guide_id || grp.proposed_guide_id;
        let eligibleFaculty = facultyList.filter((f) => f.id !== guideId);

        if (eligibleFaculty.length < effectivePanelSize) {
          eligibleFaculty = [...facultyList];
        }

        eligibleFaculty.sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));

        const selectedPanelists = eligibleFaculty.slice(0, effectivePanelSize);

        for (const pan of selectedPanelists) {
          await client.query(
            `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
            [stage_id, grp.id, pan.id, req.user.id]
          );
          workload[pan.id] = (workload[pan.id] || 0) + 1;
        }

        assignedGroupCount++;
      }

      await client.query('COMMIT');
      res.json({
        message: `Successfully auto-assigned panels for ${assignedGroupCount} project groups!`,
        assigned_count: assignedGroupCount,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Panel Auto Assign Error]', err);
    res.status(500).json({ error: 'Failed to auto-assign panels' });
  }
});

/**
 * POST /api/projects/hod/panel-copy-stage
 * Copy panel assignments from a source stage to a target stage.
 */
router.post('/hod/panel-copy-stage', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { source_stage_id, target_stage_id } = req.body;
    if (!source_stage_id || !target_stage_id) {
      return res.status(400).json({ error: 'source_stage_id and target_stage_id are required' });
    }
    if (Number(source_stage_id) === Number(target_stage_id)) {
      return res.status(400).json({ error: 'Source and target stages must be different' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sourceRes = await client.query(
        `SELECT group_id, panel_member_id FROM project_panel_assignments WHERE stage_id = $1`,
        [source_stage_id]
      );

      if (sourceRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No panel assignments found in the source stage to copy' });
      }

      await client.query(`DELETE FROM project_panel_assignments WHERE stage_id = $1`, [target_stage_id]);

      for (const row of sourceRes.rows) {
        await client.query(
          `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
           VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
          [target_stage_id, row.group_id, row.panel_member_id, req.user.id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: `Successfully copied ${sourceRes.rows.length} panel assignments to target stage!` });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Panel Copy Stage Error]', err);
    res.status(500).json({ error: 'Failed to copy stage panel assignments' });
  }
});

/**
 * POST /api/projects/hod/panel-clear
 * Reset/clear panel examiner assignments for a stage.
 */
router.post('/hod/panel-clear', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const result = await pool.query(
      `DELETE FROM project_panel_assignments WHERE stage_id = $1`,
      [stage_id]
    );

    res.json({ message: `Successfully cleared panel assignments for this stage!`, cleared_count: result.rowCount });
  } catch (err) {
    console.error('[Clear Panels Error]', err);
    res.status(500).json({ error: 'Failed to clear panel assignments' });
  }
});

/**
 * POST /api/projects/hod/evaluations/:id/unlock
 * Unlock a locked evaluation for re-editing.
 */
router.post('/hod/evaluations/:id/unlock', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const evalId = req.params.id;
    const { unlock_reason } = req.body;
    if (!unlock_reason) return res.status(400).json({ error: 'Unlock reason is mandatory' });

    await pool.query(
      `UPDATE project_evaluations
       SET is_unlocked = true, unlocked_by = $1, unlocked_at = NOW(), unlock_reason = $2, status = 'DRAFT'
       WHERE id = $3`,
      [req.user.id, unlock_reason, evalId]
    );

    await pool.query(
      `INSERT INTO audit_log (table_name, record_id, changed_by, action, reason)
       VALUES ('project_evaluations', $1, $2, 'UPDATE', $3)`,
      [evalId, req.user.id, `Unlocked evaluation: ${unlock_reason}`]
    );

    res.json({ message: 'Evaluation unlocked for re-editing' });
  } catch (err) {
    console.error('[Unlock Evaluation Error]', err);
    res.status(500).json({ error: 'Failed to unlock evaluation' });
  }
});

/**
 * POST /api/projects/hod/score-releases
 * Release scores for a stage.
 * If called by BE Project Coordinator, submits request for HOD confirmation.
 * If called by HOD, directly approves and releases scores.
 */
router.post('/hod/score-releases', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id, group_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const isHOD = req.user.role === 'hod';
    const status = isHOD ? 'APPROVED' : 'PENDING_HOD_APPROVAL';
    const approvedBy = isHOD ? req.user.id : null;
    const approvedAt = isHOD ? new Date() : null;

    const result = await pool.query(
      `INSERT INTO project_score_releases (stage_id, group_id, released_by, status, requested_by, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [stage_id, group_id || null, req.user.id, status, req.user.id, approvedBy, approvedAt]
    );

    if (isHOD) {
      res.json({ message: 'Scores confirmed and released to students successfully', release: result.rows[0], status: 'APPROVED' });
    } else {
      res.json({
        message: 'Score release requested. Pending HOD confirmation before publishing to students.',
        release: result.rows[0],
        status: 'PENDING_HOD_APPROVAL'
      });
    }
  } catch (err) {
    console.error('[Score Release Error]', err);
    res.status(500).json({ error: 'Failed to release scores' });
  }
});

/**
 * POST /api/projects/hod/confirm-score-release (HOD only)
 * Confirm or Reject a pending score release request.
 */
router.post('/confirm-score-release', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { release_id, action } = req.body; // action: 'APPROVE' | 'REJECT'
    if (!release_id || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'release_id and action (APPROVE/REJECT) are required' });
    }

    if (action === 'APPROVE') {
      await pool.query(
        `UPDATE project_score_releases
         SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [req.user.id, release_id]
      );
      res.json({ message: 'Score release confirmed and published to students successfully!' });
    } else {
      await pool.query(
        `UPDATE project_score_releases SET status = 'REJECTED' WHERE id = $1`,
        [release_id]
      );
      res.json({ message: 'Score release request rejected by HOD.' });
    }
  } catch (err) {
    console.error('[Confirm Score Release Error]', err);
    res.status(500).json({ error: 'Failed to confirm score release' });
  }
});

/**
 * GET /api/projects/hod/pending-approvals
 * Fetch list of pending guide assignments and score releases for HOD confirmation.
 */
router.get('/hod/pending-approvals', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const pendingGuides = await pool.query(
      `SELECT g.id, g.group_code, g.title, g.title_2, g.title_3, g.domain, g.proposed_guide_id,
              f.id as proposed_guide_faculty_id, u.name as proposed_guide_name, f.designation as proposed_guide_designation,
              req_u.name as requested_by_name
       FROM project_groups g
       LEFT JOIN faculty f ON g.proposed_guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN users req_u ON g.guide_requested_by = req_u.id
       WHERE g.academic_year = $1 AND g.guide_approval_status = 'PENDING_HOD_APPROVAL'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    for (const g of pendingGuides.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.is_leader, gm.division, gm.mobile_no,
                COALESCE(u.name, gm.student_name, 'Student') as name
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [g.id]
      );
      g.members = membersRes.rows;
    }

    const pendingScoreReleases = await pool.query(
      `SELECT sr.id as release_id, sr.stage_id, s.name as stage_name, sr.group_id, g.group_code,
              u.name as requested_by_name, sr.released_at as requested_at
       FROM project_score_releases sr
       JOIN project_evaluation_stages s ON sr.stage_id = s.id
       LEFT JOIN project_groups g ON sr.group_id = g.id
       LEFT JOIN users u ON sr.requested_by = u.id
       WHERE s.academic_year = $1 AND sr.status = 'PENDING_HOD_APPROVAL'
       ORDER BY sr.released_at DESC`,
      [acadYear]
    );

    res.json({
      pendingGuides: pendingGuides.rows,
      pendingScoreReleases: pendingScoreReleases.rows,
      totalPending: pendingGuides.rows.length + pendingScoreReleases.rows.length
    });
  } catch (err) {
    console.error('[Pending Approvals Error]', err);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /api/projects/hod/reports/export
 * Download consolidated marksheets for all groups across stages.
 */
router.get('/hod/reports/export', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT g.id, g.group_code, g.title, g.domain, g.batch, u.name as guide_name
       FROM project_groups g
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    const stagesRes = await pool.query(
      `SELECT id, name, sequence_order FROM project_evaluation_stages
       WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    const reportData = [];

    for (const group of groupsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, COALESCE(u.name, gm.student_name, 'Student') as name FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [group.id]
      );
      const membersStr = membersRes.rows.map(m => `${m.name} (${m.roll_no})`).join(', ');

      const stageScores = {};
      let totalAllStages = 0;

      for (const stage of stagesRes.rows) {
        const evalsRes = await pool.query(
          `SELECT pe.id as evaluation_id
           FROM project_panel_assignments pa
           JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
           WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pe.status IN ('SUBMITTED','LOCKED')`,
          [group.id, stage.id]
        );

        if (evalsRes.rows.length === 0) {
          stageScores[stage.name] = 'N/A';
        } else {
          let stageSum = 0;
          for (const ev of evalsRes.rows) {
            const scRes = await pool.query(
              `SELECT SUM(marks_awarded) as total FROM project_evaluation_scores WHERE evaluation_id = $1`,
              [ev.evaluation_id]
            );
            stageSum += Number(scRes.rows[0].total || 0);
          }
          const avg = (stageSum / evalsRes.rows.length).toFixed(2);
          stageScores[stage.name] = avg;
          totalAllStages += Number(avg);
        }
      }

      reportData.push({
        group_code: group.group_code,
        title: group.title,
        domain: group.domain,
        guide: group.guide_name || 'Unassigned',
        members: membersStr,
        ...stageScores,
        total_aggregate: totalAllStages.toFixed(2)
      });
    }

    res.json({
      academic_year: acadYear,
      stages: stagesRes.rows.map(s => s.name),
      report: reportData
    });
  } catch (err) {
    console.error('[Export Report Error]', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/projects/export/form-responses
 * Export Raw Form Responses Excel sheet for BE Project Topic Preferences
 */
router.get('/export/form-responses', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT g.*, u_creator.email as created_by_email,
              u.name as guide_name, f.designation as guide_designation,
              pu.name as proposed_guide_name, pf.designation as proposed_guide_designation
       FROM project_groups g
       LEFT JOIN users u_creator ON g.created_by = u_creator.id
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN faculty pf ON g.proposed_guide_id = pf.id
       LEFT JOIN users pu ON pf.user_id = pu.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    const groups = groupsRes.rows;

    for (const g of groups) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.student_name, gm.division, gm.mobile_no, gm.email, gm.is_leader, u.name, u.email as user_email
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [g.id]
      );
      g.members = membersRes.rows.map(m => ({
        ...m,
        student_name: m.student_name || m.name,
        email: m.email || m.user_email
      }));
    }

    const fileBuffer = await buildFormResponsesWorkbook(groups, acadYear);
    const filename = `BE Project Topic Preferences form (AY ${acadYear}) (Responses).xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('[Export Form Responses Error]', err);
    res.status(500).json({ error: 'Failed to export form responses Excel' });
  }
});

/**
 * GET /api/projects/export/guide-assignments
 * Export Excel sheet for BE Project Guide Assignments
 */
router.get('/export/guide-assignments', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT g.*, u_creator.email as created_by_email,
              u.name as guide_name, f.designation as guide_designation,
              pu.name as proposed_guide_name, pf.designation as proposed_guide_designation
       FROM project_groups g
       LEFT JOIN users u_creator ON g.created_by = u_creator.id
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN faculty pf ON g.proposed_guide_id = pf.id
       LEFT JOIN users pu ON pf.user_id = pu.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    const groups = groupsRes.rows;

    for (const g of groups) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.student_name, gm.division, gm.mobile_no, gm.email, gm.is_leader, u.name, u.email as user_email
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [g.id]
      );
      g.members = membersRes.rows.map(m => ({
        ...m,
        student_name: m.student_name || m.name,
        email: m.email || m.user_email
      }));
    }

    const fileBuffer = await buildGuideAssignmentsWorkbook(groups, acadYear);
    const filename = `BE Project Guide Assignments (AY ${acadYear}).xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('[Export Guide Assignments Error]', err);
    res.status(500).json({ error: 'Failed to export guide assignments Excel' });
  }
});

/**
 * GET /api/projects/export/examiner-assignments
 * Export Excel sheet for BE Project Examiner Panel Matrix
 */
router.get('/export/examiner-assignments', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';
    const stageId = req.query.stage_id;

    let query = `
      SELECT pa.id as assignment_id, pa.stage_id, pa.group_id, pa.status as assignment_status,
             s.name as stage_name, s.sequence_order,
             g.group_code, g.title, g.domain, g.guide_id,
             gu.name as guide_name,
             ef.id as examiner_id, eu.name as examiner_name, ef.designation as examiner_designation
      FROM project_panel_assignments pa
      JOIN project_evaluation_stages s ON pa.stage_id = s.id
      JOIN project_groups g ON pa.group_id = g.id
      LEFT JOIN faculty gf ON g.guide_id = gf.id
      LEFT JOIN users gu ON gf.user_id = gu.id
      LEFT JOIN faculty ef ON pa.panel_member_id = ef.id
      LEFT JOIN users eu ON ef.user_id = eu.id
      WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
    `;
    const params = [acadYear];

    if (stageId) {
      query += ` AND pa.stage_id = $2`;
      params.push(stageId);
    }

    query += ` ORDER BY s.sequence_order ASC, g.group_code ASC, pa.id ASC`;

    const resAssignments = await pool.query(query, params);

    const panelMap = new Map();
    for (const row of resAssignments.rows) {
      const key = `${row.stage_id}_${row.group_id}`;
      if (!panelMap.has(key)) {
        panelMap.set(key, {
          stage_name: row.stage_name,
          sequence_order: row.sequence_order,
          group_id: row.group_id,
          group_code: row.group_code,
          domain: row.domain,
          title: row.title,
          guide_name: row.guide_name,
          status: row.assignment_status,
          examiners: [],
          members: []
        });
      }

      if (row.examiner_id) {
        panelMap.get(key).examiners.push({
          id: row.examiner_id,
          name: row.examiner_name,
          designation: row.examiner_designation
        });
      }
    }

    const panelRows = Array.from(panelMap.values());

    for (const pr of panelRows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.student_name, u.name
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC`,
        [pr.group_id]
      );
      pr.members = membersRes.rows;
    }

    const fileBuffer = buildExaminerAssignmentsWorkbook(panelRows, acadYear);
    const filename = `BE_Project_Examiner_Panel_Matrix_${acadYear}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('[Export Examiner Assignments Error]', err);
    res.status(500).json({ error: 'Failed to export examiner assignments Excel' });
  }
});

/**
 * GET /api/projects/export/score-excel
 * Export Excel sheet for BE Project Stage Scores & Student Marks
 */
router.get('/export/score-excel', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    // Fetch active evaluation stages
    const stagesRes = await pool.query(
      `SELECT id, name, sequence_order, max_marks_total, aggregation_rule
       FROM project_evaluation_stages
       WHERE academic_year = $1 AND is_active = true
       ORDER BY sequence_order ASC`,
      [acadYear]
    );
    const stages = stagesRes.rows;

    // Fetch project groups
    const groupsRes = await pool.query(
      `SELECT g.*, u_creator.email as created_by_email,
              u.name as guide_name, f.designation as guide_designation,
              pu.name as proposed_guide_name, pf.designation as proposed_guide_designation
       FROM project_groups g
       LEFT JOIN users u_creator ON g.created_by = u_creator.id
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN faculty pf ON g.proposed_guide_id = pf.id
       LEFT JOIN users pu ON pf.user_id = pu.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    const groups = groupsRes.rows;

    for (const g of groups) {
      // Fetch members
      const membersRes = await pool.query(
        `SELECT gm.id, gm.roll_no, gm.student_name, gm.division, gm.mobile_no, gm.email, gm.is_leader, gm.student_id,
                u.name, u.email as user_email
         FROM project_group_members gm
         LEFT JOIN students st ON gm.student_id = st.id
         LEFT JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC, gm.id ASC`,
        [g.id]
      );

      const members = membersRes.rows.map(m => ({
        ...m,
        student_name: m.student_name || m.name || 'Student',
        email: m.email || m.user_email || ''
      }));

      // Calculate stage scores for each member
      for (const m of members) {
        m.stage_scores = {};

        for (const st of stages) {
          // Fetch submitted or locked evaluations for this group & stage
          const evalsRes = await pool.query(
            `SELECT pe.id as evaluation_id
             FROM project_panel_assignments pa
             JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
             WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pe.status IN ('SUBMITTED','LOCKED')`,
            [g.id, st.id]
          );

          if (evalsRes.rows.length === 0) {
            m.stage_scores[st.id] = 'N/A';
          } else {
            const evalTotals = [];
            for (const ev of evalsRes.rows) {
              // Try member-specific score sum first
              const memSumRes = await pool.query(
                `SELECT SUM(marks_awarded) as total, COUNT(*) as cnt
                 FROM project_evaluation_scores
                 WHERE evaluation_id = $1 AND member_id = $2`,
                [ev.evaluation_id, m.id]
              );

              let totalScore = null;
              if (memSumRes.rows[0] && Number(memSumRes.rows[0].cnt) > 0 && memSumRes.rows[0].total !== null) {
                totalScore = Number(memSumRes.rows[0].total);
              } else {
                // Fallback to group-wide score sum (where member_id is NULL)
                const grpSumRes = await pool.query(
                  `SELECT SUM(marks_awarded) as total, COUNT(*) as cnt
                   FROM project_evaluation_scores
                   WHERE evaluation_id = $1 AND member_id IS NULL`,
                  [ev.evaluation_id]
                );
                if (grpSumRes.rows[0] && Number(grpSumRes.rows[0].cnt) > 0 && grpSumRes.rows[0].total !== null) {
                  totalScore = Number(grpSumRes.rows[0].total);
                }
              }

              if (totalScore !== null) {
                evalTotals.push(totalScore);
              }
            }

            if (evalTotals.length === 0) {
              m.stage_scores[st.id] = 'N/A';
            } else {
              let aggregate = 0;
              if (st.aggregation_rule === 'SUM') {
                aggregate = evalTotals.reduce((a, b) => a + b, 0);
              } else if (st.aggregation_rule === 'MAX') {
                aggregate = Math.max(...evalTotals);
              } else {
                aggregate = evalTotals.reduce((a, b) => a + b, 0) / evalTotals.length;
              }
              m.stage_scores[st.id] = Number(aggregate.toFixed(2));
            }
          }
        }
      }

      g.members = members;
    }

    const fileBuffer = await buildScoreReportWorkbook(groups, stages, acadYear);
    const filename = `BE Project Score Report (AY ${acadYear}).xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(fileBuffer);
  } catch (err) {
    console.error('[Export Score Excel Error]', err);
    res.status(500).json({ error: 'Failed to export score report Excel' });
  }
});

module.exports = router;
