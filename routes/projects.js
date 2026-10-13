const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { buildFormResponsesWorkbook, buildGuideAssignmentsWorkbook, buildExaminerAssignmentsWorkbook, buildScoreReportWorkbook } = require('../services/projectExporter');
const { importBEProjectWorkbook } = require('../services/projectImporter');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

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

    // Fetch assigned panel mentor(s) for this group (excluding the project guide)
    const mentorsRes = await pool.query(
      `SELECT DISTINCT pa.panel_member_id as faculty_id, u.name as mentor_name, f.designation
       FROM project_panel_assignments pa
       JOIN faculty f ON pa.panel_member_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE pa.group_id = $1
         AND pa.panel_member_id != COALESCE($2, -1)
       ORDER BY u.name ASC`,
      [group.id, group.guide_id || group.guide_faculty_id || -1]
    );

    group.mentors = mentorsRes.rows;
    if (mentorsRes.rows.length > 0) {
      group.mentor_name = mentorsRes.rows[0].mentor_name;
      group.mentor_designation = mentorsRes.rows[0].designation;
      group.mentor_faculty_id = mentorsRes.rows[0].faculty_id;
    }

    // Guide requests are deprecated (HOD directly assigns guides)
    const guideReqRes = { rows: [] };

    // Fetch all stages for group's academic year
    const stagesRes = await pool.query(
      `SELECT * FROM project_evaluation_stages
       WHERE academic_year = $1 AND is_active = true
       ORDER BY sequence_order ASC`,
      [group.academic_year]
    );

    // Check which stages have been released for students (no HOD approval bottleneck)
    const releasesRes = await pool.query(
      `SELECT stage_id, group_id FROM project_score_releases
       WHERE (group_id IS NULL OR group_id = $1) AND (status IS NULL OR status != 'REJECTED')`,
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
            `SELECT pes.id, pes.criterion_id, pes.member_id, pes.student_id, pes.marks_awarded, pes.remark,
                    sc.name as criterion_name, sc.max_marks, sc.display_order,
                    COALESCE(u.name, pgm.student_name, 'Student') as student_name,
                    COALESCE(s.enrollment_no, pgm.roll_no) as roll_no,
                    pgm.is_leader
             FROM project_evaluation_scores pes
             JOIN project_stage_criteria sc ON pes.criterion_id = sc.id
             LEFT JOIN project_group_members pgm ON pes.member_id = pgm.id
             LEFT JOIN students s ON (pes.student_id = s.id OR pgm.student_id = s.id)
             LEFT JOIN users u ON s.user_id = u.id
             WHERE pes.evaluation_id = $1
             ORDER BY pgm.is_leader DESC, pgm.id ASC, sc.display_order ASC`,
            [ev.evaluation_id]
          );

          ev.scores = scoresRes.rows;

          // Group scores by student member
          const memberScoresMap = {};
          for (const row of scoresRes.rows) {
            const key = row.member_id || row.student_id || row.student_name;
            if (!memberScoresMap[key]) {
              memberScoresMap[key] = {
                member_id: row.member_id,
                student_id: row.student_id,
                student_name: row.student_name,
                roll_no: row.roll_no,
                is_leader: Boolean(row.is_leader),
                scores: [],
                total_score: 0
              };
            }
            memberScoresMap[key].scores.push({
              id: row.id,
              criterion_id: row.criterion_id,
              criterion_name: row.criterion_name,
              max_marks: Number(row.max_marks),
              marks_awarded: Number(row.marks_awarded),
              remark: row.remark
            });
            memberScoresMap[key].total_score += Number(row.marks_awarded);
          }

          const memberScoresList = Object.values(memberScoresMap);
          memberScoresList.forEach(m => {
            m.total_score = Number(m.total_score.toFixed(2));
          });
          ev.member_scores = memberScoresList;

          // Identify individual score for the logged-in student
          const myScoreRecord = memberScoresList.find(m =>
            (student && m.student_id === student.id) ||
            (m.roll_no && student && (
              m.roll_no.trim().toLowerCase() === (student.roll_no || '').trim().toLowerCase() ||
              m.roll_no.trim().toLowerCase() === (student.enrollment_no || '').trim().toLowerCase()
            ))
          );

          ev.my_score = myScoreRecord ? myScoreRecord.total_score : null;
          ev.my_scores = myScoreRecord ? myScoreRecord.scores : null;

          if (memberScoresList.length > 0) {
            const avg = memberScoresList.reduce((sum, m) => sum + m.total_score, 0) / memberScoresList.length;
            ev.average_score = Number(avg.toFixed(2));
            ev.total_score = ev.my_score !== null ? ev.my_score : ev.average_score;
          } else {
            ev.average_score = 0;
            ev.total_score = 0;
          }
        }

        evaluations = evalsRes.rows;

        if (evaluations.length > 0) {
          const myTotals = evaluations.map(e => e.my_score).filter(s => s !== null);
          if (myTotals.length > 0) {
            if (stage.aggregation_rule === 'SUM') {
              aggregatedScore = myTotals.reduce((a, b) => a + b, 0).toFixed(2);
            } else if (stage.aggregation_rule === 'MAX') {
              aggregatedScore = Math.max(...myTotals).toFixed(2);
            } else {
              aggregatedScore = (myTotals.reduce((a, b) => a + b, 0) / myTotals.length).toFixed(2);
            }
          } else {
            const avgTotals = evaluations.map(e => e.average_score);
            aggregatedScore = (avgTotals.reduce((a, b) => a + b, 0) / avgTotals.length).toFixed(2);
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
      mentors: mentorsRes.rows,
      current_student: {
        id: student.id,
        roll_no: student.roll_no,
        enrollment_no: student.enrollment_no
      },
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
    error: 'Guide selection by students is disabled. Project guides are assigned directly by the BE Project Coordinator or HOD.'
  });
});

/**
 * GET /api/projects/student/available-guides
 * Get list of available faculty members with current guide loads.
 */
router.get('/student/available-guides', verifyToken, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    // Check if there are designated guides configured for this academic year
    const designatedCheck = await pool.query(
      `SELECT COUNT(*) FROM project_designated_guides WHERE academic_year = $1`,
      [acadYear]
    );
    const hasDesignated = parseInt(designatedCheck.rows[0].count, 10) > 0;

    let query = '';
    const params = [acadYear];

    if (hasDesignated) {
      // Return designated guides, excluding faculty who are assigned as mentors
      query = `
        SELECT f.id as faculty_id, u.name, u.email, f.designation, f.employee_id,
               COUNT(DISTINCT g.id) as current_guided_groups,
               true as is_designated_guide
        FROM faculty f
        JOIN users u ON f.user_id = u.id
        JOIN project_designated_guides dg ON dg.faculty_id = f.id AND dg.academic_year = $1
        LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status = 'ACTIVE' AND g.academic_year = $1
        LEFT JOIN (
          SELECT pa.panel_member_id, COUNT(*) as p_count
          FROM project_panel_assignments pa
          JOIN project_evaluation_stages s ON pa.stage_id = s.id
          JOIN project_groups g ON pa.group_id = g.id
          WHERE s.academic_year = $1 AND pa.panel_member_id != COALESCE(g.guide_id, -1)
          GROUP BY pa.panel_member_id
        ) mentors ON mentors.panel_member_id = f.id
        WHERE COALESCE(mentors.p_count, 0) = 0
        GROUP BY f.id, u.name, u.email, f.designation, f.employee_id
        ORDER BY u.name ASC
      `;
    } else {
      // Fallback if none designated yet: all faculty excluding active panel mentors
      query = `
        SELECT f.id as faculty_id, u.name, u.email, f.designation, f.employee_id,
               COUNT(DISTINCT g.id) as current_guided_groups,
               false as is_designated_guide
        FROM faculty f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status = 'ACTIVE' AND g.academic_year = $1
        LEFT JOIN (
          SELECT pa.panel_member_id, COUNT(*) as p_count
          FROM project_panel_assignments pa
          JOIN project_evaluation_stages s ON pa.stage_id = s.id
          JOIN project_groups g ON pa.group_id = g.id
          WHERE s.academic_year = $1 AND pa.panel_member_id != COALESCE(g.guide_id, -1)
          GROUP BY pa.panel_member_id
        ) mentors ON mentors.panel_member_id = f.id
        WHERE COALESCE(mentors.p_count, 0) = 0
        GROUP BY f.id, u.name, u.email, f.designation, f.employee_id
        ORDER BY u.name ASC
      `;
    }

    const resList = await pool.query(query, params);
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

/**
 * POST /api/projects/hod/groups/import-excel
 * Import BE Project groups from Excel workbook (Sheet2 + Form Responses 1).
 * Accessible by BE Project Coordinator or HOD.
 */
router.post('/hod/groups/import-excel', verifyToken, requireProjectCoordinatorOrHOD, upload.single('file'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || req.body.academic_year || '2026-27';
    let wb = null;

    if (req.file && req.file.buffer) {
      wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    } else if (req.body && req.body.file_path) {
      wb = XLSX.readFile(req.body.file_path);
    } else {
      const defaultPath = 'E:\\BE Project Topic Preferences form (AY 2026-27) (Responses).xlsx';
      const fs = require('fs');
      if (fs.existsSync(defaultPath)) {
        wb = XLSX.readFile(defaultPath);
      } else {
        return res.status(400).json({ error: 'Please provide an Excel file (.xlsx) to import.' });
      }
    }

    const result = await importBEProjectWorkbook(wb, acadYear);
    res.json({
      message: `Successfully imported ${result.groupsCount} BE project groups and ${result.membersCount} student members for academic year ${acadYear}!`,
      groupsCount: result.groupsCount,
      membersCount: result.membersCount
    });
  } catch (err) {
    console.error('[Import BE Project Excel Error]', err);
    res.status(500).json({ error: err.message || 'Failed to import BE Project Excel file' });
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
              gu.name as guide_name,
              COUNT(DISTINCT gm.id) as member_count,
              (g.guide_id = $1) as is_guide,
              EXISTS (
                SELECT 1 FROM project_panel_assignments pa
                WHERE pa.group_id = g.id AND pa.panel_member_id = $1
              ) as is_mentor
       FROM project_groups g
       LEFT JOIN faculty gf ON g.guide_id = gf.id
       LEFT JOIN users gu ON gf.user_id = gu.id
       LEFT JOIN project_group_members gm ON g.id = gm.group_id
       WHERE (g.guide_id = $1 OR g.id IN (SELECT pa.group_id FROM project_panel_assignments pa WHERE pa.panel_member_id = $1))
         AND g.status != 'WITHDRAWN'
       GROUP BY g.id, gu.name
       ORDER BY g.group_code ASC`,
      [facultyId]
    );

    for (const group of groupsRes.rows) {
      group.faculty_role = group.is_guide ? 'Guide' : 'Panel Mentor';

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

      // Fetch active continuous assessment evaluation stages for this academic year
      const stagesRes = await pool.query(
        `SELECT s.id as stage_id, s.name as stage_name, s.sequence_order, s.max_marks_total,
                s.scheduled_date_from, s.scheduled_date_to
         FROM project_evaluation_stages s
         WHERE s.academic_year = $1
         ORDER BY s.sequence_order ASC`,
        [group.academic_year || '2026-27']
      );

      group.stages = [];
      for (const st of stagesRes.rows) {
        // Ensure an assignment row exists for this faculty member on this stage & group
        let myAssignRes = await pool.query(
          `SELECT id, status FROM project_panel_assignments
           WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3`,
          [st.stage_id, group.id, facultyId]
        );

        let myAssignId;
        if (myAssignRes.rows.length === 0) {
          const newAssign = await pool.query(
            `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'ASSIGNED')
             RETURNING id, status`,
            [st.stage_id, group.id, facultyId, req.user.id]
          );
          myAssignId = newAssign.rows[0].id;
        } else {
          myAssignId = myAssignRes.rows[0].id;
        }

        // Check if this faculty member has an evaluation (draft or submitted)
        const myEvalRes = await pool.query(
          `SELECT pe.id, pe.status, pe.submitted_at, pe.overall_remarks
           FROM project_evaluations pe
           WHERE pe.panel_assignment_id = $1`,
          [myAssignId]
        );
        const myEval = myEvalRes.rows[0] || null;

        // Check if ANOTHER evaluator (e.g. Mentor if Guide, or Guide if Mentor) has submitted
        const otherEvalRes = await pool.query(
          `SELECT pe.id, pe.status, pe.submitted_at, pe.overall_remarks,
                  pa.id as other_assignment_id, u.name as other_evaluator_name,
                  (pa.panel_member_id = g.guide_id) as other_is_guide
           FROM project_panel_assignments pa
           JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
           JOIN faculty f ON pa.panel_member_id = f.id
           JOIN users u ON f.user_id = u.id
           JOIN project_groups g ON pa.group_id = g.id
           WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pa.panel_member_id != $3
             AND pe.status IN ('SUBMITTED', 'LOCKED')
           ORDER BY pe.submitted_at DESC NULLS LAST
           LIMIT 1`,
          [group.id, st.stage_id, facultyId]
        );
        const otherEval = otherEvalRes.rows[0] || null;

        const isScoredByMe = !!(myEval && ['SUBMITTED', 'LOCKED'].includes(myEval.status));
        const isLockedByOther = !isScoredByMe && !!otherEval;

        const activeEvalId = isScoredByMe
          ? myEval.id
          : (otherEval ? otherEval.id : (myEval ? myEval.id : null));

        let stageScore = null;
        if (activeEvalId) {
          const scoreCalcRes = await pool.query(
            `SELECT ROUND(AVG(mem_total), 1) as avg_score
             FROM (
               SELECT SUM(marks_awarded) as mem_total
               FROM project_evaluation_scores
               WHERE evaluation_id = $1
               GROUP BY member_id
             ) sub`,
            [activeEvalId]
          );
          if (scoreCalcRes.rows[0] && scoreCalcRes.rows[0].avg_score !== null) {
            stageScore = Number(scoreCalcRes.rows[0].avg_score);
          }
        }

        group.stages.push({
          stage_id: st.stage_id,
          stage_name: st.stage_name,
          sequence_order: st.sequence_order,
          max_marks_total: Number(st.max_marks_total),
          assignment_id: myAssignId,
          my_eval_status: myEval ? myEval.status : null,
          is_scored_by_me: isScoredByMe,
          is_locked_by_other: isLockedByOther,
          other_evaluator_name: otherEval ? otherEval.other_evaluator_name : null,
          other_role: otherEval ? (otherEval.other_is_guide ? 'Guide' : 'Mentor') : null,
          other_assignment_id: otherEval ? otherEval.other_assignment_id : null,
          active_assignment_id: isLockedByOther ? otherEval.other_assignment_id : myAssignId,
          score: stageScore,

          // Backward-compatibility aliases:
          guide_eval_status: myEval ? myEval.status : null,
          is_scored_by_guide: isScoredByMe,
          is_locked_by_mentor: isLockedByOther,
          mentor_evaluator_name: otherEval ? otherEval.other_evaluator_name : null,
        });
      }
    }

    res.json(groupsRes.rows);
  } catch (err) {
    console.error('[Project Groups Error]', err);
    res.status(500).json({ error: 'Failed to fetch project groups' });
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

      // Check if ANOTHER evaluator (Guide or other Mentor) has submitted for this (group_id, stage_id)
      const otherEvalRes = await pool.query(
        `SELECT pe.id as other_eval_id, pe.status as other_status, pe.submitted_at,
                u.name as other_evaluator_name,
                pa.id as other_assignment_id,
                (pa.panel_member_id = g.guide_id) as other_is_guide
         FROM project_panel_assignments pa
         JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
         JOIN project_groups g ON pa.group_id = g.id
         JOIN faculty f ON pa.panel_member_id = f.id
         JOIN users u ON f.user_id = u.id
         WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pa.id != $3
           AND pe.status IN ('SUBMITTED', 'LOCKED')
         ORDER BY pe.submitted_at DESC NULLS LAST
         LIMIT 1`,
        [row.group_id, row.stage_id, row.assignment_id]
      );

      if (otherEvalRes.rows.length > 0) {
        const other = otherEvalRes.rows[0];
        row.locked_by_other = true;
        row.other_is_guide = other.other_is_guide;
        row.other_evaluator_name = other.other_evaluator_name;
        row.other_assignment_id = other.other_assignment_id;
        row.other_status = other.other_status;
      } else {
        row.locked_by_other = false;
      }
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
              gu.name as guide_name,
              pu.name as evaluator_name,
              (pa.panel_member_id = g.guide_id) as is_guide_evaluator
       FROM project_panel_assignments pa
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       JOIN project_groups g ON pa.group_id = g.id
       LEFT JOIN faculty gf ON g.guide_id = gf.id
       LEFT JOIN users gu ON gf.user_id = gu.id
       LEFT JOIN faculty pf ON pa.panel_member_id = pf.id
       LEFT JOIN users pu ON pf.user_id = pu.id
       WHERE pa.id = $1`,
      [assignmentId]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    const assign = assignRes.rows[0];
    assign.max_marks_total = Number(assign.max_marks_total);

    // Authorization check
    const isGuide = assign.guide_id === facultyId;
    const isAssigned = assign.panel_member_id === facultyId;
    const panelCheck = await pool.query(
      `SELECT id FROM project_panel_assignments WHERE group_id = $1 AND stage_id = $2 AND panel_member_id = $3`,
      [assign.group_id, assign.stage_id, facultyId]
    );
    const isPanelistForGroup = panelCheck.rows.length > 0;

    if (!isGuide && !isAssigned && !isPanelistForGroup && req.user.role !== 'hod') {
      return res.status(403).json({ error: 'You are not authorized to view this evaluation' });
    }

    // Fetch criteria for this stage
    const criteriaRes = await pool.query(
      `SELECT * FROM project_stage_criteria WHERE stage_id = $1 ORDER BY display_order ASC`,
      [assign.stage_id]
    );
    for (const c of criteriaRes.rows) {
      c.max_marks = Number(c.max_marks);
    }

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
        const marksNum = s.marks_awarded !== null ? Number(s.marks_awarded) : 0;
        scoresMap[s.criterion_id] = { marks_awarded: marksNum, remark: s.remark };
        if (s.member_id) {
          if (!studentScoresMap[s.member_id]) studentScoresMap[s.member_id] = {};
          studentScoresMap[s.member_id][s.criterion_id] = { marks_awarded: marksNum, remark: s.remark };
        }
      }
    }

    // Check if ANOTHER evaluator has submitted scores for this stage and group
    const otherEvalRes = await pool.query(
      `SELECT pe.id, pe.status, pe.submitted_at, u.name as evaluator_name,
              pa.id as other_assignment_id,
              (pa.panel_member_id = g.guide_id) as other_is_guide
       FROM project_panel_assignments pa
       JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
       JOIN project_groups g ON pa.group_id = g.id
       JOIN faculty f ON pa.panel_member_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pa.id != $3
         AND pe.status IN ('SUBMITTED', 'LOCKED')
       ORDER BY pe.submitted_at DESC NULLS LAST
       LIMIT 1`,
      [assign.group_id, assign.stage_id, assignmentId]
    );
    const otherEval = otherEvalRes.rows[0] || null;

    // Determine read-only lock state
    let isReadOnly = false;
    let lockedByOther = false;
    let otherEvaluator = null;
    let otherRole = null;

    if (req.user.role === 'hod') {
      isReadOnly = evaluation?.status === 'SUBMITTED' && !evaluation?.is_unlocked;
    } else if (assign.panel_member_id !== facultyId) {
      // User is viewing someone else's assignment evaluation (e.g. guide viewing mentor's submission or vice-versa)
      isReadOnly = true;
      lockedByOther = true;
      otherEvaluator = assign.evaluator_name;
      otherRole = assign.is_guide_evaluator ? 'Project Guide' : 'Panel Mentor';
    } else if (otherEval) {
      // Someone else has already submitted and locked the score for this group & stage!
      isReadOnly = true;
      lockedByOther = true;
      otherEvaluator = otherEval.evaluator_name;
      otherRole = otherEval.other_is_guide ? 'Project Guide' : 'Panel Mentor';
    } else if (evaluation && ['SUBMITTED', 'LOCKED'].includes(evaluation.status)) {
      isReadOnly = !evaluation.is_unlocked;
    }

    res.json({
      assignment: assign,
      isGuide,
      isReadOnly,
      lockedByOther,
      otherEvaluator,
      otherRole,
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
 * Enforces Mutually Exclusive Evaluation: Only 1 can assign (either Guide or Mentor).
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

    const isAssigned = (assign.panel_member_id === facultyId);
    const isGuide = (assign.guide_id === facultyId);

    if (!isAssigned && !isGuide && req.user.role !== 'hod') {
      return res.status(403).json({ error: 'You are not assigned or authorized to evaluate this group' });
    }

    // Mutually Exclusive Check: Only 1 can assign (either Guide or Mentor)
    const conflictRes = await pool.query(
      `SELECT pe.id, pe.status, pe.submitted_at, u.name as evaluator_name,
              (pa.panel_member_id = g.guide_id) as is_guide
       FROM project_panel_assignments pa
       JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
       JOIN project_groups g ON pa.group_id = g.id
       JOIN faculty f ON pa.panel_member_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE pa.group_id = $1 AND pa.stage_id = $2 AND pa.id != $3
         AND pe.status IN ('SUBMITTED', 'LOCKED')`,
      [assign.group_id, assign.stage_id, assignment_id]
    );

    if (conflictRes.rows.length > 0 && req.user.role !== 'hod') {
      const conf = conflictRes.rows[0];
      const roleName = conf.is_guide ? 'Project Guide' : 'Panel Mentor';
      return res.status(409).json({
        error: `Scores for this stage have already been submitted by ${roleName} (${conf.evaluator_name}). Only 1 evaluator (either Guide or Mentor) can assign scores.`
      });
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

      // Update all panel assignments for this stage & group to COMPLETED if submitted
      if (status === 'SUBMITTED') {
        await client.query(
          `UPDATE project_panel_assignments SET status = 'COMPLETED' WHERE stage_id = $1 AND group_id = $2`,
          [assign.stage_id, assign.group_id]
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

    const [
      groupsCount,
      stagesRes,
      guideLoadRes,
      totalGroupsRes,
      totalAssignedEvals,
      recentActivityRes
    ] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*) FROM project_groups WHERE academic_year = $1 GROUP BY status`,
        [acadYear]
      ),
      pool.query(
        `SELECT * FROM project_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
        [acadYear]
      ),
      pool.query(
        `SELECT f.id as faculty_id, u.name, u.email, f.designation, f.employee_id,
                COUNT(DISTINCT g.id) as guided_groups,
                COUNT(DISTINCT pa.id) as panel_assignments,
                CASE 
                  WHEN dg.id IS NOT NULL OR COUNT(DISTINCT g.id) > 0 THEN true 
                  ELSE false 
                END as is_designated_guide
         FROM faculty f
         JOIN users u ON f.user_id = u.id
         LEFT JOIN project_groups g ON g.guide_id = f.id AND g.status = 'ACTIVE' AND g.academic_year = $1
         LEFT JOIN (
           SELECT pa2.id, pa2.panel_member_id
           FROM project_panel_assignments pa2
           JOIN project_evaluation_stages s2 ON pa2.stage_id = s2.id
           JOIN project_groups g2 ON pa2.group_id = g2.id
           WHERE s2.academic_year = $1 AND pa2.panel_member_id != COALESCE(g2.guide_id, -1)
         ) pa ON pa.panel_member_id = f.id
         LEFT JOIN project_designated_guides dg ON dg.faculty_id = f.id AND dg.academic_year = $1
         GROUP BY f.id, u.name, u.email, f.designation, f.employee_id, dg.id
         ORDER BY u.name ASC`,
        [acadYear]
      ),
      pool.query(
        `SELECT COUNT(*) FROM project_groups WHERE academic_year = $1 AND status != 'WITHDRAWN'`,
        [acadYear]
      ),
      pool.query(
        `SELECT pa.status, COUNT(*) FROM project_panel_assignments pa
         JOIN project_evaluation_stages s ON pa.stage_id = s.id
         WHERE s.academic_year = $1 GROUP BY pa.status`,
        [acadYear]
      ),
      pool.query(
        `SELECT g.id, g.group_code, g.title, u.name as guide_name, g.guide_decided_at as timestamp,
                'GUIDE_ASSIGNED' as type,
                CONCAT('Guide ', u.name, ' assigned to ', g.group_code) as summary
         FROM project_groups g
         JOIN faculty f ON g.guide_id = f.id
         JOIN users u ON f.user_id = u.id
         WHERE g.academic_year = $1 AND g.guide_decided_at IS NOT NULL
         ORDER BY g.guide_decided_at DESC LIMIT 5`,
        [acadYear]
      ).catch(() => ({ rows: [] }))
    ]);

    res.json({
      academic_year: acadYear,
      total_groups: parseInt(totalGroupsRes.rows[0].count, 10),
      group_status_breakdown: groupsCount.rows,
      evaluation_status_breakdown: totalAssignedEvals.rows,
      stages: stagesRes.rows,
      faculty_load: guideLoadRes.rows,
      recent_updates: recentActivityRes.rows,
      pending_approvals: {
        pending_guides_count: 0,
        pending_scores_count: 0,
        total_pending: 0
      }
    });
  } catch (err) {
    console.error('[HOD Dashboard Error]', err);
    res.status(500).json({ error: 'Failed to fetch project dashboard data' });
  }
});

/**
 * GET /api/projects/hod/designated-guides
 * Get list of currently designated guides for an academic year.
 */
router.get('/hod/designated-guides', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';
    const rows = await pool.query(
      `SELECT dg.*, u.name, u.email, f.designation, f.employee_id
       FROM project_designated_guides dg
       JOIN faculty f ON dg.faculty_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE dg.academic_year = $1
       ORDER BY u.name ASC`,
      [acadYear]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error('[Get Designated Guides Error]', err);
    res.status(500).json({ error: 'Failed to fetch designated guides' });
  }
});

/**
 * POST /api/projects/hod/designated-guides/toggle
 * Toggle whether a faculty member is designated as a BE Project Guide for an academic year.
 * Mentors (panel assignments > 0) are strictly excluded from being guides.
 */
router.post('/hod/designated-guides/toggle', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { academic_year, faculty_id, is_guide } = req.body;
    const acadYear = academic_year || '2026-27';

    if (!faculty_id) {
      return res.status(400).json({ error: 'faculty_id is required' });
    }

    if (is_guide) {
      // Check if faculty is currently assigned as a Panel Mentor in this academic year
      const mentorCheck = await pool.query(
        `SELECT COUNT(*) FROM project_panel_assignments pa
         JOIN project_evaluation_stages s ON pa.stage_id = s.id
         JOIN project_groups g ON pa.group_id = g.id
         WHERE pa.panel_member_id = $1 AND s.academic_year = $2
           AND pa.panel_member_id != COALESCE(g.guide_id, -1)`,
        [faculty_id, acadYear]
      );
      if (parseInt(mentorCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          error: 'This faculty member is assigned as a Panel Mentor and cannot be assigned as a Guide.'
        });
      }

      await pool.query(
        `INSERT INTO project_designated_guides (academic_year, faculty_id, designated_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (academic_year, faculty_id) DO NOTHING`,
        [acadYear, faculty_id, req.user?.id || null]
      );

      return res.json({ success: true, message: 'Faculty assigned as BE Project Guide successfully' });
    } else {
      // Check if faculty is actively guiding groups in this academic year
      const activeGroups = await pool.query(
        `SELECT COUNT(*) FROM project_groups
         WHERE guide_id = $1 AND academic_year = $2 AND status = 'ACTIVE'`,
        [faculty_id, acadYear]
      );
      const guidingCount = parseInt(activeGroups.rows[0].count, 10);
      if (guidingCount > 0) {
        return res.status(400).json({
          error: `Cannot remove guide status: Faculty is actively guiding ${guidingCount} project group(s). Reassign those groups first.`
        });
      }

      await pool.query(
        `DELETE FROM project_designated_guides WHERE academic_year = $1 AND faculty_id = $2`,
        [acadYear, faculty_id]
      );

      return res.json({ success: true, message: 'Faculty removed from BE Project Guides' });
    }
  } catch (err) {
    console.error('[Toggle Designated Guide Error]', err);
    res.status(500).json({ error: 'Failed to update guide designation' });
  }
});

/**
 * POST /api/projects/hod/designated-guides/batch-assign-all
 * Assign all eligible non-mentor faculty as guides for this academic year.
 */
router.post('/hod/designated-guides/batch-assign-all', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { academic_year } = req.body;
    const acadYear = academic_year || '2026-27';

    // Insert all faculty who are NOT currently assigned as mentors
    const inserted = await pool.query(
      `INSERT INTO project_designated_guides (academic_year, faculty_id, designated_by)
       SELECT $1, f.id, $2
       FROM faculty f
       LEFT JOIN (
         SELECT pa.panel_member_id, COUNT(*) as p_count
         FROM project_panel_assignments pa
         JOIN project_evaluation_stages s ON pa.stage_id = s.id
         JOIN project_groups g ON pa.group_id = g.id
         WHERE s.academic_year = $1 AND pa.panel_member_id != COALESCE(g.guide_id, -1)
         GROUP BY pa.panel_member_id
       ) mentors ON mentors.panel_member_id = f.id
       WHERE COALESCE(mentors.p_count, 0) = 0
       ON CONFLICT (academic_year, faculty_id) DO NOTHING
       RETURNING id`,
      [acadYear, req.user?.id || null]
    );

    res.json({
      success: true,
      message: `Successfully assigned all eligible non-mentor faculty as Guides (${inserted.rowCount} designated)`
    });
  } catch (err) {
    console.error('[Batch Assign Guides Error]', err);
    res.status(500).json({ error: 'Failed to batch assign guides' });
  }
});

/**
 * POST /api/projects/hod/governance/batch-apply
 * Atomically apply staged project governance changes (guide designations, group guide assignments, panel mentor assignments).
 */
router.post('/hod/governance/batch-apply', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  const { academic_year, guide_designations = [], group_guides = [], panel_assignments = [] } = req.body;
  const acadYear = academic_year || '2026-27';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Process Guide Designations
    for (const item of guide_designations) {
      const facId = Number(item.faculty_id);
      if (!facId) continue;
      if (item.is_guide) {
        await client.query(
          `INSERT INTO project_designated_guides (academic_year, faculty_id, designated_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (academic_year, faculty_id) DO NOTHING`,
          [acadYear, facId, req.user?.id || null]
        );
      } else {
        await client.query(
          `DELETE FROM project_designated_guides
           WHERE academic_year = $1 AND faculty_id = $2`,
          [acadYear, facId]
        );
      }
    }

    // 2. Process Group Guide Assignments
    for (const item of group_guides) {
      const grpId = Number(item.group_id);
      if (!grpId) continue;
      const guideId = item.guide_id ? Number(item.guide_id) : null;

      if (guideId) {
        const guideRes = await client.query(
          `SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
          [guideId]
        );
        const guideName = guideRes.rows[0]?.name || 'Faculty';

        const updateRes = await client.query(
          `UPDATE project_groups
           SET guide_id = $1, proposed_guide_id = $1, guide_approval_status = 'APPROVED',
               guide_requested_by = $2, guide_decided_at = NOW(), status = 'ACTIVE'
           WHERE id = $3
           RETURNING group_code`,
          [guideId, req.user?.id || null, grpId]
        );
        const groupCode = updateRes.rows[0]?.group_code || `Group #${grpId}`;

        await client.query(
          `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'project_groups',
            grpId,
            req.user?.id || null,
            'PROJECT_GUIDE_ASSIGNED',
            `Guide ${guideName} assigned directly to group ${groupCode} by ${req.user?.name || 'Coordinator'} (batch apply)`
          ]
        ).catch(() => {});
      } else {
        const updateRes = await client.query(
          `UPDATE project_groups
           SET guide_id = NULL, proposed_guide_id = NULL, guide_approval_status = 'NONE',
               guide_requested_by = $1, guide_decided_at = NOW(), status = 'DRAFT'
           WHERE id = $2
           RETURNING group_code`,
          [req.user?.id || null, grpId]
        );
        const groupCode = updateRes.rows[0]?.group_code || `Group #${grpId}`;

        await client.query(
          `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            'project_groups',
            grpId,
            req.user?.id || null,
            'PROJECT_GUIDE_UNASSIGNED',
            `Guide unassigned from group ${groupCode} by ${req.user?.name || 'Coordinator'} (batch apply)`
          ]
        ).catch(() => {});
      }
    }

    // 3. Process Panel Mentor Assignments
    for (const item of panel_assignments) {
      const stageId = Number(item.stage_id);
      const grpId = Number(item.group_id);
      const panelMemberIds = Array.isArray(item.panel_member_ids) ? item.panel_member_ids.map(Number) : [];
      if (!stageId || !grpId) continue;

      // Delete existing panel assignments for this stage & group (keeping submitted evaluations intact)
      await client.query(
        `DELETE FROM project_panel_assignments
         WHERE stage_id = $1 AND group_id = $2
           AND panel_member_id != (SELECT COALESCE(guide_id, -1) FROM project_groups WHERE id = $2)
           AND id NOT IN (SELECT panel_assignment_id FROM project_evaluations WHERE status IN ('SUBMITTED','LOCKED'))`,
        [stageId, grpId]
      );

      // Insert new panel assignments
      for (const facId of panelMemberIds) {
        await client.query(
          `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
           SELECT $1, $2, $3, $4, 'ASSIGNED'
           WHERE NOT EXISTS (
             SELECT 1 FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3
           )`,
          [stageId, grpId, facId, req.user?.id || null]
        );
      }
    }

    await client.query('COMMIT');

    const totalApplied = guide_designations.length + group_guides.length + panel_assignments.length;
    res.json({
      success: true,
      message: `Successfully applied ${totalApplied} change(s) to the database!`,
      applied_counts: {
        guide_designations: guide_designations.length,
        group_guides: group_guides.length,
        panel_assignments: panel_assignments.length
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Batch Apply Governance Error]', err);
    res.status(500).json({ error: 'Failed to apply governance changes to database' });
  } finally {
    client.release();
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

    const groupIds = groupsRes.rows.map((g) => g.id);

    if (groupIds.length > 0) {
      const [membersRes, evalProgressRes, mentorsRes] = await Promise.all([
        pool.query(
          `SELECT gm.id, gm.group_id, gm.student_id, gm.roll_no, gm.student_name, gm.is_leader, gm.division, gm.mobile_no,
                  COALESCE(u.name, gm.student_name, 'Student') as name,
                  COALESCE(u.email, gm.email, '') as email
           FROM project_group_members gm
           LEFT JOIN students st ON gm.student_id = st.id
           LEFT JOIN users u ON st.user_id = u.id
           WHERE gm.group_id = ANY($1)
           ORDER BY gm.is_leader DESC, gm.id ASC`,
          [groupIds]
        ),
        pool.query(
          `SELECT pa.group_id, s.id as stage_id, s.name as stage_name, pa.id as assignment_id, pa.panel_member_id,
                  pu.name as evaluator_name, pe.status as eval_status
           FROM project_evaluation_stages s
           LEFT JOIN project_panel_assignments pa ON pa.stage_id = s.id AND pa.group_id = ANY($1)
           LEFT JOIN faculty pf ON pa.panel_member_id = pf.id
           LEFT JOIN users pu ON pf.user_id = pu.id
           LEFT JOIN project_evaluations pe ON pa.id = pe.panel_assignment_id
           WHERE s.academic_year = $2
           ORDER BY s.sequence_order ASC`,
          [groupIds, acadYear]
        ),
        pool.query(
          `SELECT DISTINCT pa.group_id, pa.panel_member_id as faculty_id, u.name as mentor_name, f.designation
           FROM project_panel_assignments pa
           JOIN faculty f ON pa.panel_member_id = f.id
           JOIN users u ON f.user_id = u.id
           JOIN project_evaluation_stages s ON pa.stage_id = s.id
           JOIN project_groups g ON pa.group_id = g.id
           WHERE pa.group_id = ANY($1) AND s.academic_year = $2
             AND pa.panel_member_id != COALESCE(g.guide_id, -1)
           ORDER BY u.name ASC`,
          [groupIds, acadYear]
        )
      ]);

      const membersByGroup = {};
      for (const m of membersRes.rows) {
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
        membersByGroup[m.group_id].push(m);
      }

      const evalsByGroup = {};
      for (const e of evalProgressRes.rows) {
        if (e.group_id) {
          if (!evalsByGroup[e.group_id]) evalsByGroup[e.group_id] = [];
          evalsByGroup[e.group_id].push(e);
        }
      }

      const mentorsByGroup = {};
      for (const m of mentorsRes.rows) {
        if (!mentorsByGroup[m.group_id]) mentorsByGroup[m.group_id] = [];
        mentorsByGroup[m.group_id].push({
          faculty_id: m.faculty_id,
          name: m.mentor_name,
          mentor_name: m.mentor_name,
          designation: m.designation
        });
      }

      for (const g of groupsRes.rows) {
        g.members = membersByGroup[g.id] || [];
        g.stage_evaluations = evalsByGroup[g.id] || [];
        const groupGuideId = g.guide_id || g.guide_faculty_id;
        const groupGuideName = (g.guide_name || '').trim().toLowerCase();
        g.mentors = (mentorsByGroup[g.id] || []).filter((m) => {
          if (groupGuideId && Number(m.faculty_id) === Number(groupGuideId)) return false;
          if (groupGuideName && (m.name || m.mentor_name || '').trim().toLowerCase() === groupGuideName) return false;
          return true;
        });
      }
    }

    res.json(groupsRes.rows);
  } catch (err) {
    console.error('[HOD List Groups Error]', err);
    res.status(500).json({ error: 'Failed to fetch project groups' });
  }
});

/**
 * GET /api/projects/hod/students/search
 * Search students across department with enrollment check for quick adding to groups.
 */
router.get('/hod/students/search', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);

    const acadYear = req.query.academic_year || '2026-27';
    const results = await pool.query(
      `SELECT s.id as student_id, s.user_id, s.roll_no, s.enrollment_no, s.division, s.batch,
              u.name, u.email,
              (SELECT gm2.mobile_no FROM project_group_members gm2 WHERE (gm2.student_id = s.id OR gm2.roll_no = s.enrollment_no OR gm2.roll_no = s.roll_no) AND gm2.mobile_no IS NOT NULL AND gm2.mobile_no != '' LIMIT 1) as mobile_no,
              gm.group_id as current_group_id, g.group_code as current_group_code
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN project_group_members gm ON gm.student_id = s.id
       LEFT JOIN project_groups g ON gm.group_id = g.id AND g.academic_year = $1 AND g.status != 'WITHDRAWN'
       WHERE (
         u.name ILIKE $2
         OR s.roll_no ILIKE $2
         OR s.enrollment_no ILIKE $2
         OR u.email ILIKE $2
       )
       ORDER BY 
         CASE 
           WHEN UPPER(s.enrollment_no) = UPPER($3) THEN 1
           WHEN UPPER(s.roll_no) = UPPER($3) THEN 2
           WHEN UPPER(u.name) = UPPER($3) THEN 3
           WHEN s.enrollment_no ILIKE $4 THEN 4
           ELSE 5
         END, u.name ASC
       LIMIT 15`,
      [acadYear, `%${q}%`, q, `${q}%`]
    );

    let rows = results.rows;
    if (rows.length === 0) {
      const fallback = await pool.query(
        `SELECT DISTINCT ON (gm.roll_no)
                gm.student_id, NULL as user_id, gm.roll_no, gm.roll_no as enrollment_no,
                gm.division, NULL as batch, gm.student_name as name, gm.email, gm.mobile_no,
                gm.group_id as current_group_id, g.group_code as current_group_code
         FROM project_group_members gm
         JOIN project_groups g ON gm.group_id = g.id AND g.academic_year = $1 AND g.status != 'WITHDRAWN'
         WHERE (gm.student_name ILIKE $2 OR gm.roll_no ILIKE $2 OR gm.email ILIKE $2)
         LIMIT 10`,
        [acadYear, `%${q}%`]
      );
      rows = fallback.rows;
    }

    res.json(rows);
  } catch (err) {
    console.error('[Search Students Error]', err);
    res.status(500).json({ error: 'Failed to search students' });
  }
});

/**
 * PATCH /api/projects/hod/groups/:id
 * Update project group details (title, alternate titles, domain, division batch, status).
 */
router.patch('/hod/groups/:id', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { title, title_2, title_3, domain, batch, status } = req.body;

    const groupRes = await pool.query('SELECT * FROM project_groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Project group not found' });

    const updated = await pool.query(
      `UPDATE project_groups
       SET title = COALESCE($1, title),
           title_2 = COALESCE($2, title_2),
           title_3 = COALESCE($3, title_3),
           domain = COALESCE($4, domain),
           batch = COALESCE($5, batch),
           status = COALESCE($6, status)
       WHERE id = $7
       RETURNING *`,
      [
        title !== undefined ? title.trim() : null,
        title_2 !== undefined ? title_2.trim() : null,
        title_3 !== undefined ? title_3.trim() : null,
        domain !== undefined ? domain.trim() : null,
        batch !== undefined ? batch.trim() : null,
        status !== undefined ? status.trim() : null,
        groupId
      ]
    );

    res.json({ message: 'Project group details updated successfully', group: updated.rows[0] });
  } catch (err) {
    console.error('[Update Group Error]', err);
    res.status(500).json({ error: 'Failed to update group details' });
  }
});

/**
 * DELETE /api/projects/hod/groups/:id
 * Delete an entire project group and cascade delete its members.
 */
router.delete('/hod/groups/:id', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const groupRes = await pool.query('SELECT * FROM project_groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Project group not found' });

    await pool.query('DELETE FROM project_groups WHERE id = $1', [groupId]);
    res.json({ message: `Project group ${groupRes.rows[0].group_code} deleted successfully.` });
  } catch (err) {
    console.error('[Delete Group Error]', err);
    res.status(500).json({ error: 'Failed to delete project group' });
  }
});

/**
 * PATCH /api/projects/hod/groups/:id/guide
 * Assign/reassign project guide directly (accessible by BE Project Coordinator or HOD).
 * No HOD confirmation or approval required; updates take effect immediately and guide is active.
 */
router.patch('/hod/groups/:id/guide', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { guide_id } = req.body; // faculty id or null

    if (guide_id) {
      const guideRes = await pool.query(
        `SELECT f.id, u.name, f.designation FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
        [guide_id]
      );
      const guideName = guideRes.rows[0]?.name || 'Faculty';

      const updateRes = await pool.query(
        `UPDATE project_groups
         SET guide_id = $1, proposed_guide_id = $1, guide_approval_status = 'APPROVED',
             guide_requested_by = $2, guide_decided_at = NOW(), status = 'ACTIVE'
         WHERE id = $3
         RETURNING group_code`,
        [guide_id, req.user.id, groupId]
      );
      const groupCode = updateRes.rows[0]?.group_code || `Group #${groupId}`;

      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'project_groups',
          groupId,
          req.user.id,
          'PROJECT_GUIDE_ASSIGNED',
          `Guide ${guideName} assigned directly to group ${groupCode} by ${req.user.name || 'Coordinator'}`
        ]
      ).catch(() => {});

      res.json({
        message: `Guide "${guideName}" assigned to ${groupCode} successfully!`,
        guide_id,
        approval_status: 'APPROVED',
        status: 'ACTIVE'
      });
    } else {
      const updateRes = await pool.query(
        `UPDATE project_groups
         SET guide_id = NULL, proposed_guide_id = NULL, guide_approval_status = 'NONE',
             guide_requested_by = $1, guide_decided_at = NOW(), status = 'DRAFT'
         WHERE id = $2
         RETURNING group_code`,
        [req.user.id, groupId]
      );
      const groupCode = updateRes.rows[0]?.group_code || `Group #${groupId}`;

      await pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'project_groups',
          groupId,
          req.user.id,
          'PROJECT_GUIDE_UNASSIGNED',
          `Guide unassigned from group ${groupCode} by ${req.user.name || 'Coordinator'}`
        ]
      ).catch(() => {});

      res.json({
        message: `Guide unassigned from ${groupCode}.`,
        guide_id: null,
        approval_status: 'NONE',
        status: 'DRAFT'
      });
    }
  } catch (err) {
    console.error('[Assign Guide Error]', err);
    res.status(500).json({ error: 'Failed to assign guide' });
  }
});

/**
 * POST /api/projects/groups/:id/confirm-guide
 * (Legacy compatibility) Guide assignments are direct; confirm immediately without HOD role bottleneck.
 */
router.post('/groups/:id/confirm-guide', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { action } = req.body; // action: 'APPROVE' | 'REJECT'

    const groupRes = await pool.query(`SELECT * FROM project_groups WHERE id = $1`, [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    const group = groupRes.rows[0];

    if (action === 'REJECT') {
      await pool.query(
        `UPDATE project_groups
         SET proposed_guide_id = NULL, guide_approval_status = 'REJECTED', guide_decided_at = NOW()
         WHERE id = $1`,
        [groupId]
      );
      return res.json({ message: 'Guide assignment cancelled' });
    }

    const newGuideId = group.proposed_guide_id || group.guide_id;
    await pool.query(
      `UPDATE project_groups
       SET guide_id = $1, proposed_guide_id = $1, guide_approval_status = 'APPROVED', guide_decided_at = NOW(),
           status = CASE WHEN $1::int IS NOT NULL THEN 'ACTIVE' ELSE 'DRAFT' END
       WHERE id = $2`,
      [newGuideId, groupId]
    );
    res.json({ message: 'Guide assignment confirmed and activated.' });
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

    const result = await pool.query(
      `UPDATE project_groups
       SET guide_id = NULL, proposed_guide_id = NULL, guide_approval_status = 'NONE', status = 'DRAFT',
           guide_requested_by = $1, guide_decided_at = NOW()
       WHERE academic_year = $2 RETURNING id`,
      [req.user.id, acadYear]
    );

    await pool.query(
      `DELETE FROM project_designated_guides WHERE academic_year = $1`,
      [acadYear]
    );

    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'project_groups',
        null,
        req.user.id,
        'PROJECT_GUIDES_BULK_CLEARED',
        `All guides reset across ${result.rowCount} groups for AY ${acadYear}`
      ]
    ).catch(() => {});

    res.json({ message: `Successfully reset/unassigned project guides for ${result.rowCount} groups!`, cleared_count: result.rowCount });
  } catch (err) {
    console.error('[Clear Guides Error]', err);
    res.status(500).json({ error: 'Failed to clear guide assignments' });
  }
});

/**
 * POST /api/projects/hod/groups/clear-mentors
 * Bulk unassign/remove panel mentors across project groups for an academic year (and optional stage).
 */
router.post('/hod/groups/clear-mentors', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { academic_year, stage_id } = req.body;
    const acadYear = academic_year || '2026-27';

    let result;
    if (stage_id && stage_id !== 'ALL') {
      result = await pool.query(
        `DELETE FROM project_panel_assignments
         WHERE stage_id = $1`,
        [Number(stage_id)]
      );
    } else {
      result = await pool.query(
        `DELETE FROM project_panel_assignments
         WHERE stage_id IN (SELECT id FROM project_evaluation_stages WHERE academic_year = $1)`,
        [acadYear]
      );
    }

    res.json({
      message: `Successfully unassigned panel mentors (${result.rowCount} assignments removed)!`,
      cleared_count: result.rowCount,
    });
  } catch (err) {
    console.error('[Clear Mentors Error]', err);
    res.status(500).json({ error: 'Failed to unassign panel mentors' });
  }
});

/**
 * POST /api/projects/hod/groups/:groupId/members
 * Manually add a student member to a project group.
 */
router.post('/hod/groups/:groupId/members', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, roll_no, division, email, mobile_no, is_leader } = req.body;

    const studentName = (name || '').trim();
    const rollNo = (roll_no || '').trim();
    const studentEmail = (email || '').trim();
    const studentDivision = (division || '').trim();
    const studentMobile = (mobile_no || '').trim();

    if (!studentName) return res.status(400).json({ error: 'Student name is required' });
    if (!rollNo) return res.status(400).json({ error: 'PRN / Roll Number is required' });

    const groupRes = await pool.query('SELECT * FROM project_groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Project group not found' });
    const group = groupRes.rows[0];

    // Check if student already enrolled in another group in the same academic year
    const existingRes = await pool.query(
      `SELECT g.id, g.group_code, gm.student_name, gm.roll_no, gm.id as member_id
       FROM project_group_members gm
       JOIN project_groups g ON gm.group_id = g.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
         AND (
           LOWER(TRIM(gm.roll_no)) = LOWER($2)
           OR ($3 != '' AND LOWER(TRIM(gm.email)) = LOWER($3))
         ) LIMIT 1`,
      [group.academic_year, rollNo, studentEmail]
    );

    let transferNotice = '';
    if (existingRes.rows.length > 0) {
      const prevMember = existingRes.rows[0];
      if (Number(prevMember.id) === Number(groupId)) {
        return res.status(400).json({
          error: `Student with PRN "${rollNo}" is already a member of this group (${group.group_code}).`
        });
      }
      // Reassign / move student from previous group to this group
      await pool.query('DELETE FROM project_group_members WHERE id = $1', [prevMember.member_id]);
      transferNotice = ` (transferred from ${prevMember.group_code})`;
    }

    // Capacity check (strictly max 4 members)
    const countRes = await pool.query('SELECT COUNT(*) FROM project_group_members WHERE group_id = $1', [groupId]);
    const curCount = parseInt(countRes.rows[0].count, 10);
    if (curCount >= 4) {
      return res.status(400).json({ error: `Group ${group.group_code} already has maximum capacity of 4 members.` });
    }

    // Match student_id from students/users table if present
    let matchedStudentId = null;
    const matchRes = await pool.query(
      `SELECT s.id FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE (
         LOWER(TRIM(s.roll_no)) = LOWER($1)
         OR LOWER(TRIM(s.enrollment_no)) = LOWER($1)
         OR ($2 != '' AND LOWER(TRIM(u.email)) = LOWER($2))
       ) LIMIT 1`,
      [rollNo, studentEmail]
    );
    if (matchRes.rows.length > 0) {
      matchedStudentId = matchRes.rows[0].id;
    }

    const shouldBeLeader = Boolean(is_leader) || curCount === 0;
    if (shouldBeLeader) {
      await pool.query('UPDATE project_group_members SET is_leader = false WHERE group_id = $1', [groupId]);
    }

    const insertRes = await pool.query(
      `INSERT INTO project_group_members (group_id, student_id, roll_no, student_name, email, mobile_no, division, is_leader)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        groupId,
        matchedStudentId,
        rollNo,
        studentName,
        studentEmail,
        studentMobile,
        studentDivision || group.batch || 'BE-1',
        shouldBeLeader
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'project_groups',
        groupId,
        req.user.id,
        'PROJECT_STUDENT_ADDED',
        `Student ${studentName} (${rollNo}) manually added to group ${group.group_code}${transferNotice} by ${req.user.name || 'Coordinator'}`
      ]
    ).catch(() => {});

    res.status(201).json({
      message: `Student "${studentName}" added to group ${group.group_code}${transferNotice} successfully!`,
      member: {
        ...insertRes.rows[0],
        name: insertRes.rows[0].student_name
      }
    });
  } catch (err) {
    console.error('[Add Student Member Error]', err);
    res.status(500).json({ error: 'Failed to add student to group' });
  }
});

/**
 * PATCH /api/projects/hod/groups/:groupId/members/:memberId
 * Update/edit an existing student member's details.
 */
router.patch('/hod/groups/:groupId/members/:memberId', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { name, roll_no, division, email, mobile_no, is_leader } = req.body;

    const groupRes = await pool.query('SELECT * FROM project_groups WHERE id = $1', [groupId]);
    if (groupRes.rows.length === 0) return res.status(404).json({ error: 'Project group not found' });
    const group = groupRes.rows[0];

    const memberRes = await pool.query('SELECT * FROM project_group_members WHERE id = $1 AND group_id = $2', [memberId, groupId]);
    if (memberRes.rows.length === 0) return res.status(404).json({ error: 'Student member not found in this group' });
    const current = memberRes.rows[0];

    const studentName = name !== undefined ? name.trim() : (current.student_name || '');
    const rollNo = roll_no !== undefined ? roll_no.trim() : current.roll_no;
    const studentDivision = division !== undefined ? division.trim() : (current.division || group.batch || 'BE-1');
    const studentEmail = email !== undefined ? email.trim() : (current.email || '');
    const studentMobile = mobile_no !== undefined ? mobile_no.trim() : (current.mobile_no || '');
    const newIsLeader = is_leader !== undefined ? Boolean(is_leader) : current.is_leader;

    if (!studentName) return res.status(400).json({ error: 'Student name is required' });
    if (!rollNo) return res.status(400).json({ error: 'PRN / Roll Number is required' });

    // Conflict check with other groups in the same academic year
    const conflictRes = await pool.query(
      `SELECT g.group_code, gm.student_name, gm.roll_no
       FROM project_group_members gm
       JOIN project_groups g ON gm.group_id = g.id
       WHERE g.academic_year = $1 AND g.status != 'WITHDRAWN'
         AND gm.id != $2
         AND (
           LOWER(TRIM(gm.roll_no)) = LOWER($3)
           OR ($4 != '' AND LOWER(TRIM(gm.email)) = LOWER($4))
         ) LIMIT 1`,
      [group.academic_year, memberId, rollNo, studentEmail]
    );
    if (conflictRes.rows.length > 0) {
      return res.status(400).json({
        error: `PRN "${rollNo}" is already assigned to a student in group ${conflictRes.rows[0].group_code}.`
      });
    }

    let studentIdToSet = current.student_id;
    if (rollNo !== current.roll_no || studentEmail !== current.email) {
      const matchRes = await pool.query(
        `SELECT s.id FROM students s JOIN users u ON s.user_id = u.id
         WHERE LOWER(TRIM(s.roll_no)) = LOWER($1) OR LOWER(TRIM(s.enrollment_no)) = LOWER($1)
            OR ($2 != '' AND LOWER(TRIM(u.email)) = LOWER($2)) LIMIT 1`,
        [rollNo, studentEmail]
      );
      if (matchRes.rows.length > 0) studentIdToSet = matchRes.rows[0].id;
    }

    if (newIsLeader) {
      await pool.query('UPDATE project_group_members SET is_leader = false WHERE group_id = $1 AND id != $2', [groupId, memberId]);
    }

    const updateRes = await pool.query(
      `UPDATE project_group_members
       SET student_name = $1, roll_no = $2, division = $3, email = $4, mobile_no = $5, is_leader = $6, student_id = $7
       WHERE id = $8 AND group_id = $9
       RETURNING *`,
      [studentName, rollNo, studentDivision, studentEmail, studentMobile, newIsLeader, studentIdToSet, memberId, groupId]
    );

    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'project_groups',
        groupId,
        req.user.id,
        'PROJECT_STUDENT_UPDATED',
        `Student ${studentName} (${rollNo}) details updated in group ${group.group_code} by ${req.user.name || 'Coordinator'}`
      ]
    ).catch(() => {});

    res.json({
      message: `Student "${studentName}" updated successfully!`,
      member: {
        ...updateRes.rows[0],
        name: updateRes.rows[0].student_name
      }
    });
  } catch (err) {
    console.error('[Update Student Member Error]', err);
    res.status(500).json({ error: 'Failed to update student member' });
  }
});

/**
 * DELETE /api/projects/hod/groups/:groupId/members/:memberId
 * Delete/remove a student member from a project group.
 */
router.delete('/hod/groups/:groupId/members/:memberId', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const memberRes = await pool.query(
      `SELECT gm.*, g.group_code
       FROM project_group_members gm
       JOIN project_groups g ON gm.group_id = g.id
       WHERE gm.id = $1 AND gm.group_id = $2`,
      [memberId, groupId]
    );
    if (memberRes.rows.length === 0) return res.status(404).json({ error: 'Student member not found in this group' });
    const member = memberRes.rows[0];

    // If deleting leader, elect another member as leader if available
    if (member.is_leader) {
      const nextMember = await pool.query(
        `SELECT id FROM project_group_members WHERE group_id = $1 AND id != $2 ORDER BY id ASC LIMIT 1`,
        [groupId, memberId]
      );
      if (nextMember.rows.length > 0) {
        await pool.query('UPDATE project_group_members SET is_leader = true WHERE id = $1', [nextMember.rows[0].id]);
      }
    }

    await pool.query('DELETE FROM project_group_members WHERE id = $1 AND group_id = $2', [memberId, groupId]);

    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'project_groups',
        groupId,
        req.user.id,
        'PROJECT_STUDENT_REMOVED',
        `Student ${member.student_name || member.roll_no} removed from group ${member.group_code} by ${req.user.name || 'Coordinator'}`
      ]
    ).catch(() => {});

    res.json({ message: `Student "${member.student_name || member.roll_no}" removed from group ${member.group_code} successfully.` });
  } catch (err) {
    console.error('[Delete Student Member Error]', err);
    res.status(500).json({ error: 'Failed to delete student member' });
  }
});

/**
 * POST /api/projects/hod/groups/:groupId/members/:memberId/transfer
 * Transfer a student member from one project group to another.
 */
router.post('/hod/groups/:groupId/members/:memberId/transfer', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { target_group_id, is_leader } = req.body;

    const srcGroupId = parseInt(groupId, 10);
    const memId = parseInt(memberId, 10);
    const targetGroupId = parseInt(target_group_id, 10);

    if (!targetGroupId || targetGroupId === srcGroupId) {
      return res.status(400).json({ error: 'Please select a valid different target group for transfer' });
    }

    const [sourceRes, targetRes, memberRes] = await Promise.all([
      pool.query('SELECT * FROM project_groups WHERE id = $1', [srcGroupId]),
      pool.query('SELECT * FROM project_groups WHERE id = $1', [targetGroupId]),
      pool.query('SELECT * FROM project_group_members WHERE id = $1 AND group_id = $2', [memId, srcGroupId])
    ]);

    if (sourceRes.rows.length === 0) return res.status(404).json({ error: 'Source group not found' });
    if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Target destination group not found' });
    if (memberRes.rows.length === 0) return res.status(404).json({ error: 'Student member not found in source group' });

    const sourceGroup = sourceRes.rows[0];
    const targetGroup = targetRes.rows[0];
    const member = memberRes.rows[0];

    const targetCountRes = await pool.query('SELECT COUNT(*) FROM project_group_members WHERE group_id = $1', [targetGroupId]);
    const targetCount = parseInt(targetCountRes.rows[0].count, 10);
    if (targetCount >= 4) {
      return res.status(400).json({ error: `Target group ${targetGroup.group_code} already has maximum capacity of 4 members.` });
    }

    const makeLeader = Boolean(is_leader) || targetCount === 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If member was leader in source group, promote next member in source group
      if (member.is_leader) {
        const nextSource = await client.query(
          'SELECT id FROM project_group_members WHERE group_id = $1 AND id != $2 ORDER BY id ASC LIMIT 1',
          [srcGroupId, memId]
        );
        if (nextSource.rows.length > 0) {
          await client.query('UPDATE project_group_members SET is_leader = true WHERE id = $1', [nextSource.rows[0].id]);
        }
      }

      if (makeLeader) {
        await client.query('UPDATE project_group_members SET is_leader = false WHERE group_id = $1', [targetGroupId]);
      }

      // Reset previous evaluation scores for this member since scores were for old group
      await client.query('DELETE FROM project_evaluation_scores WHERE member_id = $1', [memId]);

      // Update member record to target group
      const updRes = await client.query(
        `UPDATE project_group_members
         SET group_id = $1, is_leader = $2
         WHERE id = $3`,
        [targetGroupId, makeLeader, memId]
      );

      if (updRes.rowCount === 0) {
        throw new Error(`Failed to update group for member ID ${memId}`);
      }

      await client.query('COMMIT');

      pool.query(
        `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'project_groups',
          targetGroupId,
          req.user.id,
          'PROJECT_STUDENT_TRANSFERRED',
          `Student ${member.student_name || member.roll_no} transferred from ${sourceGroup.group_code} to ${targetGroup.group_code} by ${req.user.name || 'Coordinator'}`
        ]
      ).catch(() => {});

      res.json({
        message: `Student "${member.student_name || member.roll_no}" successfully transferred from ${sourceGroup.group_code} to ${targetGroup.group_code}!`,
        target_group_code: targetGroup.group_code,
        member_id: memId,
        new_group_id: targetGroupId
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Transfer Student Error]', err);
      res.status(500).json({ error: err.message || 'Failed to transfer student' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Transfer Student Precheck Error]', err);
    res.status(500).json({ error: err.message || 'Failed to process student transfer' });
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

    const stageIds = stagesRes.rows.map((s) => s.id);
    if (stageIds.length > 0) {
      const critRes = await pool.query(
        `SELECT * FROM project_stage_criteria WHERE stage_id = ANY($1) ORDER BY display_order ASC`,
        [stageIds]
      );
      const critByStage = {};
      for (const c of critRes.rows) {
        if (!critByStage[c.stage_id]) critByStage[c.stage_id] = [];
        critByStage[c.stage_id].push(c);
      }
      for (const stage of stagesRes.rows) {
        stage.criteria = critByStage[stage.id] || [];
      }
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

      const grpRes = await client.query('SELECT guide_id, proposed_guide_id, academic_year FROM project_groups WHERE id = $1', [group_id]);
      const grpGuideId = grpRes.rows[0]?.guide_id || grpRes.rows[0]?.proposed_guide_id;
      const grpAcadYear = grpRes.rows[0]?.academic_year || '2026-27';

      // Disallow any guide (designated guide or active group guide) from being assigned as panel mentor
      const guidesRes = await client.query(
        `SELECT DISTINCT f.id FROM faculty f
         WHERE f.id IN (SELECT faculty_id FROM project_designated_guides WHERE academic_year = $1)
            OR f.id IN (SELECT guide_id FROM project_groups WHERE academic_year = $1 AND guide_id IS NOT NULL)`,
        [grpAcadYear]
      );
      const allGuidesSet = new Set(guidesRes.rows.map((r) => Number(r.id)));
      if (grpGuideId) allGuidesSet.add(Number(grpGuideId));

      const cleanPanelMemberIds = panel_member_ids
        .map(Number)
        .filter((id) => !allGuidesSet.has(Number(id)));

      await client.query(
        `DELETE FROM project_panel_assignments
         WHERE stage_id = $1 AND group_id = $2
           AND panel_member_id != (SELECT COALESCE(guide_id, -1) FROM project_groups WHERE id = $2)
           AND id NOT IN (SELECT panel_assignment_id FROM project_evaluations WHERE status IN ('SUBMITTED','LOCKED'))`,
        [stage_id, group_id]
      );

      for (const facId of cleanPanelMemberIds) {
        await client.query(
          `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
           SELECT $1, $2, $3, $4, 'ASSIGNED'
           WHERE NOT EXISTS (
             SELECT 1 FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3
           )`,
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
 * POST /api/projects/hod/panel-range-assign
 * Assign panel examiners to a range/list of project groups for a stage.
 * Supports Conflict of Interest (COI) check (skipping the group's guide).
 */
router.post('/hod/panel-range-assign', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id, group_ids, panel_member_ids, skip_guide_conflict = true } = req.body;
    if (!stage_id || !Array.isArray(group_ids) || group_ids.length === 0 || !Array.isArray(panel_member_ids) || panel_member_ids.length === 0) {
      return res.status(400).json({ error: 'stage_id, group_ids (non-empty array), and panel_member_ids (non-empty array) are required' });
    }

    const stageCheck = await pool.query('SELECT id, name FROM project_evaluation_stages WHERE id = $1', [stage_id]);
    if (stageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation stage not found' });
    }

    // Fetch the groups with guide details
    const groupsRes = await pool.query(
      `SELECT g.id, g.group_code, g.guide_id, g.proposed_guide_id, u.name as guide_name
       FROM project_groups g
       LEFT JOIN faculty f ON g.guide_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE g.id = ANY($1::int[]) AND g.status != 'WITHDRAWN'
       ORDER BY g.group_code ASC`,
      [group_ids.map(Number)]
    );

    if (groupsRes.rows.length === 0) {
      return res.status(400).json({ error: 'No matching active project groups found in selected range' });
    }

    const client = await pool.connect();
    const coiWarnings = [];
    let assignedCount = 0;

    try {
      await client.query('BEGIN');

      // Fetch all designated guides and active group guides for this academic year
      const allGuidesRes = await client.query(
        `SELECT DISTINCT f.id FROM faculty f
         JOIN project_evaluation_stages s ON s.id = $1
         WHERE f.id IN (SELECT faculty_id FROM project_designated_guides WHERE academic_year = s.academic_year)
            OR f.id IN (SELECT guide_id FROM project_groups WHERE academic_year = s.academic_year AND guide_id IS NOT NULL)`,
        [stage_id]
      );
      const globalGuideIds = new Set(allGuidesRes.rows.map((r) => Number(r.id)));

      for (const grp of groupsRes.rows) {
        const guideId = grp.guide_id || grp.proposed_guide_id;

        // Filter out ANY guide (both department guides and group guide)
        let effectivePanelists = panel_member_ids
          .map(Number)
          .filter((id) => !globalGuideIds.has(id) && (!guideId || id !== Number(guideId)));

        // Delete existing panel assignments for this stage and group (preserving guide assignment & submitted evals)
        await client.query(
          `DELETE FROM project_panel_assignments
           WHERE stage_id = $1 AND group_id = $2
             AND panel_member_id != (SELECT COALESCE(guide_id, -1) FROM project_groups WHERE id = $2)
             AND id NOT IN (SELECT panel_assignment_id FROM project_evaluations WHERE status IN ('SUBMITTED','LOCKED'))`,
          [stage_id, grp.id]
        );

        // Insert new panel assignments
        for (const facId of effectivePanelists) {
          await client.query(
            `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
             SELECT $1, $2, $3, $4, 'ASSIGNED'
             WHERE NOT EXISTS (
               SELECT 1 FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3
             )`,
            [stage_id, grp.id, facId, req.user.id]
          );
        }

        assignedCount++;
      }

      await client.query('COMMIT');
      res.json({
        message: `Successfully assigned panel mentors to ${assignedCount} project groups!`,
        assigned_count: assignedCount,
        warnings: coiWarnings
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Panel Range Assign Error]', err);
    res.status(500).json({ error: 'Failed to assign panels to range of groups' });
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
         JOIN project_groups g ON pa.group_id = g.id
         WHERE pa.stage_id = $1
           AND pa.panel_member_id != COALESCE(g.guide_id, -1)`,
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
      const rawPanelists = panelMap[g.id] || [];
      const guideId = g.guide_id;
      const guideName = (g.guide_name || '').trim().toLowerCase();
      const panelists = rawPanelists.filter((p) => {
        if (guideId && Number(p.faculty_id) === Number(guideId)) return false;
        if (guideName && (p.name || '').trim().toLowerCase() === guideName) return false;
        return true;
      });
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
        `SELECT pa.group_id, pa.panel_member_id
         FROM project_panel_assignments pa
         JOIN project_groups g ON pa.group_id = g.id
         WHERE pa.stage_id = $1 AND pa.panel_member_id != COALESCE(g.guide_id, -1)`,
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
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ('project_evaluations', $1, $2, 'UPDATE', $3)`,
      [evalId, req.user.id, `Unlocked evaluation: ${unlock_reason}`]
    ).catch(() => {});

    res.json({ message: 'Evaluation unlocked for re-editing' });
  } catch (err) {
    console.error('[Unlock Evaluation Error]', err);
    res.status(500).json({ error: 'Failed to unlock evaluation' });
  }
});

/**
 * POST /api/projects/hod/score-releases
 * Directly release scores for an evaluation stage (accessible by BE Project Coordinator or HOD).
 * Scores are published directly to students immediately without requiring HOD confirmation/approval.
 */
router.post('/hod/score-releases', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { stage_id, group_id } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const existing = await pool.query(
      `SELECT id FROM project_score_releases WHERE stage_id = $1 AND (group_id = $2 OR ($2::int IS NULL AND group_id IS NULL))`,
      [stage_id, group_id || null]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE project_score_releases
         SET status = 'APPROVED', released_by = $1, released_at = NOW(), approved_by = $1, approved_at = NOW()
         WHERE id = $2 RETURNING *`,
        [req.user.id, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO project_score_releases (stage_id, group_id, released_by, status, requested_by, approved_by, approved_at)
         VALUES ($1, $2, $3, 'APPROVED', $3, $3, NOW()) RETURNING *`,
        [stage_id, group_id || null, req.user.id]
      );
    }

    const stageRes = await pool.query(`SELECT name FROM project_evaluation_stages WHERE id = $1`, [stage_id]);
    const stageName = stageRes.rows[0]?.name || `Stage #${stage_id}`;

    await pool.query(
      `INSERT INTO audit_logs (entity_type, entity_id, user_id, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'project_score_releases',
        result.rows[0]?.id,
        req.user.id,
        'PROJECT_SCORE_RELEASED',
        `Scores released to students for stage "${stageName}" ${group_id ? `(Group #${group_id})` : '(All Groups)'} by ${req.user.name || 'Coordinator'}`
      ]
    ).catch(() => {});

    res.json({
      message: `Scores released to students for "${stageName}" successfully!`,
      release: result.rows[0],
      status: 'APPROVED'
    });
  } catch (err) {
    console.error('[Score Release Error]', err);
    res.status(500).json({ error: 'Failed to release scores' });
  }
});

/**
 * POST /api/projects/confirm-score-release
 * Direct score release confirmation (No HOD approval bottleneck; accessible by BE Project Coordinator or HOD).
 */
router.post('/confirm-score-release', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const { release_id, action } = req.body; // action: 'APPROVE' | 'REJECT'
    if (!release_id) {
      return res.status(400).json({ error: 'release_id is required' });
    }

    if (action === 'REJECT') {
      await pool.query(
        `UPDATE project_score_releases SET status = 'REJECTED' WHERE id = $1`,
        [release_id]
      );
      return res.json({ message: 'Score release revoked.' });
    }

    await pool.query(
      `UPDATE project_score_releases
       SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
       WHERE id = $2`,
      [req.user.id, release_id]
    );
    res.json({ message: 'Score release confirmed and published to students successfully!' });
  } catch (err) {
    console.error('[Confirm Score Release Error]', err);
    res.status(500).json({ error: 'Failed to confirm score release' });
  }
});

/**
 * GET /api/projects/hod/pending-approvals
 * Returns pending approvals count (0 since HOD approvals are not required for BE coordinator).
 */
router.get('/hod/pending-approvals', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  res.json({
    pendingGuides: [],
    pendingScoreReleases: [],
    totalPending: 0
  });
});

/**
 * GET /api/projects/hod/activity-updates
 * Real-time activity feed and status updates regarding BE Projects.
 * Accessible by HOD and BE Project Coordinator.
 */
router.get('/hod/activity-updates', verifyToken, requireProjectCoordinatorOrHOD, async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    // 1. Guide assignments & changes
    const guideUpdates = await pool.query(
      `SELECT g.id as record_id, g.group_code, g.title as group_title, g.domain,
              u.name as guide_name, f.designation as guide_designation,
              req_u.name as actor_name, g.guide_decided_at as timestamp,
              'GUIDE_ASSIGNED' as type,
              CONCAT('Guide ', u.name, ' assigned to group ', g.group_code) as summary
       FROM project_groups g
       JOIN faculty f ON g.guide_id = f.id
       JOIN users u ON f.user_id = u.id
       LEFT JOIN users req_u ON g.guide_requested_by = req_u.id
       WHERE g.academic_year = $1 AND g.guide_decided_at IS NOT NULL
       ORDER BY g.guide_decided_at DESC LIMIT 25`,
      [acadYear]
    );

    // 2. Score releases
    const scoreUpdates = await pool.query(
      `SELECT sr.id as record_id, g.group_code, s.name as stage_name,
              u.name as actor_name, sr.released_at as timestamp,
              'SCORE_RELEASED' as type,
              CONCAT('Scores released for stage "', s.name, '"', CASE WHEN g.group_code IS NOT NULL THEN CONCAT(' (', g.group_code, ')') ELSE ' (All Groups)' END) as summary
       FROM project_score_releases sr
       JOIN project_evaluation_stages s ON sr.stage_id = s.id
       LEFT JOIN project_groups g ON sr.group_id = g.id
       LEFT JOIN users u ON sr.released_by = u.id
       WHERE s.academic_year = $1
       ORDER BY sr.released_at DESC LIMIT 25`,
      [acadYear]
    );

    // 3. Evaluations submitted by panel examiners
    const evalUpdates = await pool.query(
      `SELECT pe.id as record_id, g.group_code, s.name as stage_name,
              u.name as actor_name, pe.submitted_at as timestamp,
              'EVALUATION_SUBMITTED' as type,
              CONCAT(u.name, ' submitted evaluation marks for ', g.group_code, ' in stage "', s.name, '"') as summary,
              pe.overall_remarks
       FROM project_evaluations pe
       JOIN project_panel_assignments pa ON pe.panel_assignment_id = pa.id
       JOIN project_groups g ON pa.group_id = g.id
       JOIN project_evaluation_stages s ON pa.stage_id = s.id
       JOIN faculty f ON pa.panel_member_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE s.academic_year = $1 AND pe.status IN ('SUBMITTED','LOCKED') AND pe.submitted_at IS NOT NULL
       ORDER BY pe.submitted_at DESC LIMIT 25`,
      [acadYear]
    );

    // 4. Group registrations / imports
    const groupUpdates = await pool.query(
      `SELECT g.id as record_id, g.group_code, g.batch, g.domain, g.created_at as timestamp,
              'GROUP_REGISTERED' as type,
              CONCAT('BE Project Group ', g.group_code, ' (', g.batch, ') registered in domain "', g.domain, '"') as summary
       FROM project_groups g
       WHERE g.academic_year = $1
       ORDER BY g.created_at DESC, g.id DESC LIMIT 25`,
      [acadYear]
    );

    // Merge and sort by timestamp DESC
    const allUpdates = [
      ...guideUpdates.rows,
      ...scoreUpdates.rows,
      ...evalUpdates.rows,
      ...groupUpdates.rows
    ]
      .filter(item => item.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json(allUpdates);
  } catch (err) {
    console.error('[Activity Updates Error]', err);
    res.status(500).json({ error: 'Failed to fetch BE project activity updates' });
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
        AND pa.panel_member_id != COALESCE(g.guide_id, -1)
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
