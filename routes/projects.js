const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
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

    // Find student's active/current group
    const groupRes = await pool.query(
      `SELECT g.*, f.id as guide_faculty_id, u.name as guide_name, f.designation as guide_designation, u.email as guide_email
       FROM project_groups g
       JOIN project_group_members gm ON g.id = gm.group_id
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE gm.student_id = $1 AND g.status != 'WITHDRAWN'
       ORDER BY g.created_at DESC LIMIT 1`,
      [student.id]
    );

    if (groupRes.rows.length === 0) {
      return res.json({ hasGroup: false });
    }

    const group = groupRes.rows[0];

    // Fetch team members
    const membersRes = await pool.query(
      `SELECT gm.id, gm.student_id, gm.roll_no, gm.is_leader, u.name, u.email, s.enrollment_no, s.batch, s.division
       FROM project_group_members gm
       JOIN students s ON gm.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.is_leader DESC, gm.roll_no ASC`,
      [group.id]
    );

    // Fetch guide requests history
    const guideReqRes = await pool.query(
      `SELECT gr.*, u.name as requested_guide_name, f.designation
       FROM project_guide_requests gr
       JOIN faculty f ON gr.requested_guide_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE gr.group_id = $1
       ORDER BY gr.requested_at DESC`,
      [group.id]
    );

    // Fetch all stages for group's academic year
    const stagesRes = await pool.query(
      `SELECT * FROM project_evaluation_stages
       WHERE academic_year = $1 AND is_active = true
       ORDER BY sequence_order ASC`,
      [group.academic_year]
    );

    // Check which stages have been released by HOD for students
    const releasesRes = await pool.query(
      `SELECT stage_id, group_id FROM project_score_releases
       WHERE group_id IS NULL OR group_id = $1`,
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

    res.json({
      hasGroup: true,
      group,
      members: membersRes.rows,
      guideRequests: guideReqRes.rows,
      stages: stagesWithScores,
      isLeader: membersRes.rows.some(m => m.student_id === student.id && m.is_leader)
    });
  } catch (err) {
    console.error('[Projects Student API Error]', err);
    res.status(500).json({ error: 'Failed to fetch student project data' });
  }
});

/**
 * POST /api/projects/student/groups
 * Create a new project group. Creator becomes group leader.
 */
router.post('/student/groups', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const { title, domain, abstract, academic_year, batch } = req.body;
    if (!title || !domain) {
      return res.status(400).json({ error: 'Title and Domain are required' });
    }

    const student = await getStudentId(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });

    const acadYear = academic_year || '2025-26';
    const studentBatch = batch || student.batch || 'BE-CE-A';

    // Check if student is already in an active group
    const existingGroup = await pool.query(
      `SELECT g.id, g.group_code FROM project_groups g
       JOIN project_group_members gm ON g.id = gm.group_id
       WHERE gm.student_id = $1 AND g.academic_year = $2 AND g.status != 'WITHDRAWN'`,
      [student.id, acadYear]
    );

    if (existingGroup.rows.length > 0) {
      return res.status(400).json({
        error: `You are already a member of active group ${existingGroup.rows[0].group_code}`
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
        `INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7)
         RETURNING *`,
        [groupCode, acadYear, studentBatch, title, domain, abstract || '', req.user.id]
      );
      const newGroup = groupRes.rows[0];

      await client.query(
        `INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader)
         VALUES ($1, $2, $3, true)`,
        [newGroup.id, student.id, student.roll_no]
      );

      await client.query('COMMIT');
      res.status(201).json({ message: 'Project group created successfully', group: newGroup });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Create Group Error]', err);
    res.status(500).json({ error: 'Failed to create group' });
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
  try {
    const { group_id, requested_guide_id } = req.body;
    if (!group_id || !requested_guide_id) {
      return res.status(400).json({ error: 'group_id and requested_guide_id are required' });
    }

    const student = await getStudentId(req.user.id);

    // Verify student is leader of the group
    const leaderRes = await pool.query(
      `SELECT is_leader FROM project_group_members WHERE group_id = $1 AND student_id = $2`,
      [group_id, student.id]
    );
    if (leaderRes.rows.length === 0 || !leaderRes.rows[0].is_leader) {
      return res.status(403).json({ error: 'Only the group leader can request a guide' });
    }

    // Check guide load limit (max 5 groups)
    const loadRes = await pool.query(
      `SELECT COUNT(*) FROM project_groups WHERE guide_id = $1 AND status IN ('ACTIVE','PENDING_GUIDE_APPROVAL')`,
      [requested_guide_id]
    );
    const currentLoad = parseInt(loadRes.rows[0].count, 10);
    if (currentLoad >= 5) {
      return res.status(400).json({ error: 'Selected faculty member has reached maximum guide capacity (5 groups)' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create guide request
      const reqRes = await client.query(
        `INSERT INTO project_guide_requests (group_id, requested_guide_id, status)
         VALUES ($1, $2, 'PENDING') RETURNING *`,
        [group_id, requested_guide_id]
      );

      // Update group status
      await client.query(
        `UPDATE project_groups SET status = 'PENDING_GUIDE_APPROVAL' WHERE id = $1`,
        [group_id]
      );

      await client.query('COMMIT');
      res.status(201).json({ message: 'Guide request submitted successfully', request: reqRes.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Guide Request Error]', err);
    res.status(500).json({ error: 'Failed to submit guide request' });
  }
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
       LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status IN ('ACTIVE','PENDING_GUIDE_APPROVAL')
       GROUP BY f.id, u.name, u.email, f.designation, f.employee_id
       ORDER BY u.name ASC`
    );
    res.json(resList.rows);
  } catch (err) {
    console.error('[Available Guides Error]', err);
    res.status(500).json({ error: 'Failed to fetch available guides' });
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
  try {
    const facultyId = await getFacultyId(req.user.id);
    if (!facultyId) return res.status(404).json({ error: 'Faculty record not found' });

    const requestsRes = await pool.query(
      `SELECT gr.*, g.group_code, g.title, g.domain, g.abstract, g.academic_year, g.batch,
              u.name as leader_name, u.email as leader_email
       FROM project_guide_requests gr
       JOIN project_groups g ON gr.group_id = g.id
       JOIN project_group_members gm ON g.id = gm.group_id AND gm.is_leader = true
       JOIN students s ON gm.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE gr.requested_guide_id = $1 AND gr.status = 'PENDING'
       ORDER BY gr.requested_at DESC`,
      [facultyId]
    );

    res.json(requestsRes.rows);
  } catch (err) {
    console.error('[Fetch Guide Requests Error]', err);
    res.status(500).json({ error: 'Failed to fetch guide requests' });
  }
});

/**
 * PATCH /api/projects/guide/requests/:id
 * Approve or Reject a guide request.
 */
router.patch('/guide/requests/:id', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status, remarks } = req.body; // 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const facultyId = await getFacultyId(req.user.id);

    const reqRes = await pool.query(
      `SELECT * FROM project_guide_requests WHERE id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Guide request not found' });
    const reqObj = reqRes.rows[0];

    if (reqObj.requested_guide_id !== facultyId && req.user.role !== 'hod') {
      return res.status(403).json({ error: 'Unauthorized to act on this guide request' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE project_guide_requests
         SET status = $1, decided_at = NOW(), decided_by = $2, remarks = $3
         WHERE id = $4`,
        [status, req.user.id, remarks || '', requestId]
      );

      if (status === 'APPROVED') {
        await client.query(
          `UPDATE project_groups SET guide_id = $1, status = 'ACTIVE' WHERE id = $2`,
          [reqObj.requested_guide_id, reqObj.group_id]
        );
      } else {
        await client.query(
          `UPDATE project_groups SET status = 'DRAFT' WHERE id = $1`,
          [reqObj.group_id]
        );
      }

      await client.query('COMMIT');
      res.json({ message: `Guide request ${status.toLowerCase()} successfully` });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Decide Guide Request Error]', err);
    res.status(500).json({ error: 'Failed to update guide request' });
  }
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
        `SELECT gm.roll_no, gm.is_leader, u.name, u.email
         FROM project_group_members gm
         JOIN students s ON gm.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC`,
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
        `SELECT gm.roll_no, u.name FROM project_group_members gm
         JOIN students st ON gm.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1`,
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
 * Get evaluation form details for a panel assignment.
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
      `SELECT gm.roll_no, u.name FROM project_group_members gm
       JOIN students st ON gm.student_id = st.id
       JOIN users u ON st.user_id = u.id
       WHERE gm.group_id = $1`,
      [assign.group_id]
    );

    // Fetch existing evaluation draft/submission
    const evalRes = await pool.query(
      `SELECT * FROM project_evaluations WHERE panel_assignment_id = $1`,
      [assignmentId]
    );

    let evaluation = null;
    let scoresMap = {};
    if (evalRes.rows.length > 0) {
      evaluation = evalRes.rows[0];
      const scoresRes = await pool.query(
        `SELECT * FROM project_evaluation_scores WHERE evaluation_id = $1`,
        [evaluation.id]
      );
      for (const s of scoresRes.rows) {
        scoresMap[s.criterion_id] = { marks_awarded: s.marks_awarded, remark: s.remark };
      }
    }

    res.json({
      assignment: assign,
      isGuide,
      members: membersRes.rows,
      criteria: criteriaRes.rows,
      evaluation,
      scoresMap
    });
  } catch (err) {
    console.error('[Get Evaluation Error]', err);
    res.status(500).json({ error: 'Failed to fetch evaluation form' });
  }
});

/**
 * POST /api/projects/evaluations
 * Save draft or submit evaluation for an assigned panel group.
 */
router.post('/evaluations', verifyToken, requireRole('faculty','hod'), async (req, res) => {
  try {
    const { assignment_id, status, overall_remarks, scores } = req.body;
    if (!assignment_id || !status || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'Invalid submission payload' });
    }

    if (!['DRAFT', 'SUBMITTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be DRAFT or SUBMITTED' });
    }

    const facultyId = await getFacultyId(req.user.id);

    // Fetch assignment & group details
    const assignRes = await pool.query(
      `SELECT pa.*, g.guide_id, s.max_marks_total
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

    // ────────────────────────────────────────────────────────────────────────
    // CONFLICT-OF-INTEREST RULE ENFORCEMENT
    // ────────────────────────────────────────────────────────────────────────
    if (assign.guide_id === facultyId) {
      return res.status(403).json({
        error: 'Conflict of Interest: The project guide is not permitted to evaluate their own guided group as a panel examiner!'
      });
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

    for (const sc of scores) {
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
        await client.query(
          `UPDATE project_evaluations
           SET status = $1, submitted_at = CASE WHEN $1 = 'SUBMITTED' THEN NOW() ELSE submitted_at END,
               overall_remarks = $2, is_unlocked = false
           WHERE id = $3`,
          [status, overall_remarks || '', evalId]
        );
      } else {
        const newEval = await client.query(
          `INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
           VALUES ($1, $2, CASE WHEN $2 = 'SUBMITTED' THEN NOW() ELSE NULL END, $3)
           RETURNING id`,
          [assignment_id, status, overall_remarks || '']
        );
        evalId = newEval.rows[0].id;
      }

      // Upsert scores
      for (const sc of scores) {
        await client.query(
          `INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (evaluation_id, criterion_id)
           DO UPDATE SET marks_awarded = EXCLUDED.marks_awarded, remark = EXCLUDED.remark`,
          [evalId, sc.criterion_id, Number(sc.marks_awarded), sc.remark || '']
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
 * Department oversight analytics and status overview.
 */
router.get('/hod/dashboard', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2025-26';

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

    res.json({
      academic_year: acadYear,
      total_groups: parseInt(totalGroupsRes.rows[0].count, 10),
      group_status_breakdown: groupsCount.rows,
      evaluation_status_breakdown: totalAssignedEvals.rows,
      stages: stagesRes.rows,
      faculty_load: guideLoadRes.rows
    });
  } catch (err) {
    console.error('[HOD Dashboard Error]', err);
    res.status(500).json({ error: 'Failed to fetch HOD project dashboard data' });
  }
});

/**
 * GET /api/projects/hod/groups
 * List all project groups with detailed roster, guide info, and stage statuses.
 */
router.get('/hod/groups', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2025-26';

    const groupsRes = await pool.query(
      `SELECT g.*, f.id as guide_faculty_id, u.name as guide_name, f.designation as guide_designation
       FROM project_groups g
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE g.academic_year = $1
       ORDER BY g.group_code ASC`,
      [acadYear]
    );

    for (const g of groupsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.roll_no, gm.is_leader, u.name, u.email
         FROM project_group_members gm
         JOIN students st ON gm.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1 ORDER BY gm.is_leader DESC`,
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
 * HOD directly sets/reassigns a project guide for a group.
 */
router.patch('/hod/groups/:id/guide', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const groupId = req.params.id;
    const { guide_id } = req.body; // faculty id

    if (!guide_id) return res.status(400).json({ error: 'guide_id is required' });

    await pool.query(
      `UPDATE project_groups SET guide_id = $1, status = 'ACTIVE' WHERE id = $2`,
      [guide_id, groupId]
    );

    res.json({ message: 'Guide assigned successfully by HOD' });
  } catch (err) {
    console.error('[HOD Assign Guide Error]', err);
    res.status(500).json({ error: 'Failed to assign guide' });
  }
});

/**
 * GET /api/projects/hod/stages
 * Get all evaluation stages and criteria for an academic year.
 */
router.get('/hod/stages', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2025-26';

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
router.post('/hod/stages', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { id, name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, criteria } = req.body;
    if (!name || !sequence_order) {
      return res.status(400).json({ error: 'Stage Name and Sequence Order are required' });
    }

    const acadYear = academic_year || '2025-26';

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
          [name, sequence_order, scheduled_date_from || null, scheduled_date_to || null, max_marks_total || 100, aggregation_rule || 'AVERAGE', stageId]
        );
      } else {
        const newStage = await client.query(
          `INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [name, acadYear, sequence_order, scheduled_date_from || null, scheduled_date_to || null, max_marks_total || 100, aggregation_rule || 'AVERAGE']
        );
        stageId = newStage.rows[0].id;
      }

      if (Array.isArray(criteria)) {
        for (let i = 0; i < criteria.length; i++) {
          const c = criteria[i];
          if (c.id) {
            await client.query(
              `UPDATE project_stage_criteria SET name = $1, max_marks = $2, display_order = $3 WHERE id = $4`,
              [c.name, c.max_marks, i + 1, c.id]
            );
          } else {
            await client.query(
              `INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, $2, $3, $4)`,
              [stageId, c.name, c.max_marks, i + 1]
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
 * POST /api/projects/hod/panel-assignments
 * Assign panel members to a group for a stage with Conflict-of-Interest (COI) check.
 */
router.post('/hod/panel-assignments', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { stage_id, group_id, panel_member_ids } = req.body; // panel_member_ids: Array of faculty IDs
    if (!stage_id || !group_id || !Array.isArray(panel_member_ids)) {
      return res.status(400).json({ error: 'stage_id, group_id, and panel_member_ids are required' });
    }

    // Fetch group to check guide COI
    const groupRes = await pool.query(`SELECT group_code, guide_id FROM project_groups WHERE id = $1`, [group_id]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const group = groupRes.rows[0];

    // COI Check: Check if guide is in panel_member_ids
    if (group.guide_id && panel_member_ids.includes(group.guide_id)) {
      const guideUserRes = await pool.query(
        `SELECT u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
        [group.guide_id]
      );
      const guideName = guideUserRes.rows.length > 0 ? guideUserRes.rows[0].name : 'Group Guide';

      return res.status(400).json({
        error: `Conflict of Interest Violation: ${guideName} is the Guide of ${group.group_code} and CANNOT be assigned as a panel examiner!`
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing panel assignments for this group and stage
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
      res.json({ message: 'Panel assignments updated successfully with COI validation passed' });
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
 * POST /api/projects/hod/evaluations/:id/unlock
 * HOD unlocks a locked evaluation for re-editing.
 */
router.post('/hod/evaluations/:id/unlock', verifyToken, requireRole('hod'), async (req, res) => {
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

    // Audit log
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
 * Release scores for a stage (stage-wide or group-specific).
 */
router.post('/hod/score-releases', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { stage_id, group_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    await pool.query(
      `INSERT INTO project_score_releases (stage_id, group_id, released_by)
       VALUES ($1, $2, $3)`,
      [stage_id, group_id || null, req.user.id]
    );

    res.json({ message: 'Scores released successfully to students' });
  } catch (err) {
    console.error('[Score Release Error]', err);
    res.status(500).json({ error: 'Failed to release scores' });
  }
});

/**
 * GET /api/projects/hod/reports/export
 * Download consolidated marksheets for all groups across stages.
 */
router.get('/hod/reports/export', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2025-26';

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
        `SELECT gm.roll_no, u.name FROM project_group_members gm
         JOIN students st ON gm.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE gm.group_id = $1`,
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

module.exports = router;
