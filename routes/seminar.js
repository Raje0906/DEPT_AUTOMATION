'use strict';
const express  = require('express');
const multer   = require('multer');
const pool     = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { auditRecord } = require('../middleware/auditLogger');
const {
  parseSpreadsheet,
  parseGroups,
  validateGroups,
  sequentialFill,
  STANDARD_DOMAINS,
  validateSingleGroup,
  runStandingValidation,
  normPrn,
  normEmail,
} = require('../services/seminarParser');
const { buildWorkbook, buildMarksWorkbook, getExportLifecycleLabel } = require('../services/seminarExporter');

const router = express.Router();

// multer: memory storage only — file never hits disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv files are accepted'), ok);
  },
});

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function requireCoordinator(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role === 'hod' || req.user.role === 'admin') {
    return next();
  }
  if (req.user.role === 'faculty') {
    try {
      const fac = await pool.query('SELECT is_seminar_coordinator FROM faculty WHERE user_id = $1', [req.user.id]);
      if (fac.rows[0]?.is_seminar_coordinator) {
        req.user.is_seminar_coordinator = true;
        return next();
      }
    } catch (e) {
      console.error('[Seminar] Coordinator check error:', e.message);
    }
    return res.status(403).json({
      error: 'Access restricted: Only the designated Seminar Coordinator or HOD can manage seminar groups and assign guides.',
    });
  }
  return res.status(403).json({ error: 'Seminar Coordinator or HOD access required' });
}

async function getFacultyId(userId) {
  const r = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [userId]);
  return r.rows[0]?.id ?? null;
}

// ─── Seminar Coordinator Management (HOD Governance) ─────────────────────────

// GET /api/seminar/coordinators
router.get('/coordinators', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT f.id, f.user_id, f.employee_id, f.designation, f.department,
              f.is_seminar_coordinator, u.name, u.email
       FROM faculty f
       JOIN users u ON u.id = f.user_id
       ORDER BY f.is_seminar_coordinator DESC, u.name ASC`
    );
    res.json({ faculty: r.rows });
  } catch (err) {
    console.error('[Seminar] GET /coordinators:', err.message);
    res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
});

// POST /api/seminar/coordinators/assign (HOD only)
router.post('/coordinators/assign', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { facultyId, replaceExisting = true } = req.body;
    if (!facultyId) return res.status(400).json({ error: 'Faculty ID is required' });

    const facRes = await pool.query(
      `SELECT f.id, f.user_id, u.name, u.email FROM faculty f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
      [facultyId]
    );
    if (facRes.rows.length === 0) return res.status(404).json({ error: 'Faculty not found' });
    const fac = facRes.rows[0];

    if (replaceExisting) {
      // Find current coordinators to record revocation
      const prevCoords = await pool.query(
        'SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.is_seminar_coordinator = TRUE'
      );
      for (const prev of prevCoords.rows) {
        if (prev.id !== facultyId) {
          await pool.query(
            `INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes)
             VALUES ($1, $2, 'REVOKED', $3, $4)`,
            [prev.id, prev.name, req.user.id, `Replaced by ${fac.name}`]
          );
        }
      }
      await pool.query('UPDATE faculty SET is_seminar_coordinator = FALSE');
    }

    await pool.query(
      'UPDATE faculty SET is_seminar_coordinator = TRUE WHERE id = $1',
      [facultyId]
    );

    await pool.query(
      `INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes)
       VALUES ($1, $2, 'APPOINTED', $3, $4)`,
      [facultyId, fac.name, req.user.id, `Appointed by ${req.user.name || 'HOD'}`]
    );

    await auditRecord({
      tableName: 'faculty',
      recordId: facultyId,
      changedBy: req.user.id,
      action: 'ASSIGN_SEMINAR_COORDINATOR',
      oldValue: null,
      newValue: { facultyId, name: fac.name, email: fac.email, is_seminar_coordinator: true },
      reason: `HOD appointed ${fac.name} as Seminar Coordinator`,
    });

    res.json({
      message: `${fac.name} is now designated as the Seminar Coordinator`,
      coordinator: { id: fac.id, name: fac.name, email: fac.email, is_seminar_coordinator: true },
    });
  } catch (err) {
    console.error('[Seminar] POST /coordinators/assign:', err.message);
    res.status(500).json({ error: 'Failed to assign seminar coordinator' });
  }
});

// POST /api/seminar/coordinators/remove (HOD only)
router.post('/coordinators/remove', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { facultyId } = req.body;
    if (!facultyId) return res.status(400).json({ error: 'Faculty ID is required' });

    const facRes = await pool.query(
      `SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
      [facultyId]
    );
    const facName = facRes.rows[0]?.name || 'Faculty Member';

    await pool.query(
      'UPDATE faculty SET is_seminar_coordinator = FALSE WHERE id = $1',
      [facultyId]
    );

    await pool.query(
      `INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes)
       VALUES ($1, $2, 'REVOKED', $3, $4)`,
      [facultyId, facName, req.user.id, `Revoked by ${req.user.name || 'HOD'}`]
    );

    await auditRecord({
      tableName: 'faculty',
      recordId: facultyId,
      changedBy: req.user.id,
      action: 'REVOKE_SEMINAR_COORDINATOR',
      oldValue: null,
      newValue: { facultyId, is_seminar_coordinator: false },
      reason: `HOD revoked Seminar Coordinator role for ${facName}`,
    });

    res.json({ message: 'Seminar Coordinator role revoked successfully' });
  } catch (err) {
    console.error('[Seminar] POST /coordinators/remove:', err.message);
    res.status(500).json({ error: 'Failed to revoke seminar coordinator' });
  }
});

// GET /api/seminar/coordinators/history (HOD and faculty)
router.get('/coordinators/history', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sch.*, u.name as performed_by_name
       FROM seminar_coordinator_history sch
       LEFT JOIN users u ON sch.performed_by = u.id
       ORDER BY sch.created_at DESC`
    );
    res.json({ history: r.rows });
  } catch (err) {
    console.error('[Seminar] GET /coordinators/history:', err.message);
    res.status(500).json({ error: 'Failed to fetch coordinator history' });
  }
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

// GET /api/seminar/sessions
router.get('/sessions', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.*, u.name as created_by_name,
              (SELECT COUNT(*) FROM seminar_groups sg WHERE sg.session_id = s.id) AS group_count,
              (SELECT COUNT(*) FROM seminar_groups sg WHERE sg.session_id = s.id AND (sg.guide_id IS NOT NULL OR sg.seminar_guide_id IS NOT NULL)) AS assigned_count
       FROM seminar_sessions s
       JOIN users u ON s.created_by = u.id
       ORDER BY s.created_at DESC`
    );
    res.json({ sessions: r.rows });
  } catch (err) {
    console.error('[Seminar] GET /sessions:', err.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST /api/seminar/sessions
router.post('/sessions', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const { name, academic_year, batch } = req.body;
    if (!name || !academic_year || !batch) {
      return res.status(400).json({ error: 'name, academic_year, and batch are required' });
    }
    const r = await pool.query(
      `INSERT INTO seminar_sessions (name, academic_year, batch, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), academic_year.trim(), batch.trim(), req.user.id]
    );
    const session = r.rows[0];
    await auditRecord({ tableName: 'seminar_sessions', recordId: session.id, changedBy: req.user.id, oldValue: null, newValue: session, action: 'INSERT' });
    res.status(201).json({ session });
  } catch (err) {
    console.error('[Seminar] POST /sessions:', err.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/seminar/sessions/:id
router.get('/sessions/:id', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.*, u.name as created_by_name, pu.name as published_by_name
       FROM seminar_sessions s
       JOIN users u ON s.created_by = u.id
       LEFT JOIN users pu ON s.published_by = pu.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// DELETE /api/seminar/sessions/:id
router.delete('/sessions/:id', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const prev = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
    if (!prev.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = prev.rows[0];

    await pool.query('DELETE FROM seminar_sessions WHERE id = $1', [sessionId]);

    await auditRecord({
      tableName: 'seminar_sessions',
      recordId: sessionId,
      changedBy: req.user.id,
      oldValue: session,
      newValue: null,
      action: 'DELETE',
      reason: 'Session deleted by user',
    });

    res.json({ deleted: true, sessionId });
  } catch (err) {
    console.error('[Seminar] DELETE /sessions/:id:', err.message);
    res.status(500).json({ error: 'Failed to delete session: ' + err.message });
  }
});

// ─── V2: Student Direct Registration Endpoints ────────────────────────────────

// GET /api/seminar/active-session
router.get('/active-session', verifyToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT s.*, u.name as created_by_name,
              (SELECT COUNT(*) FROM seminar_groups sg WHERE sg.session_id = s.id) AS group_count
       FROM seminar_sessions s
       JOIN users u ON s.created_by = u.id
       ORDER BY (CASE WHEN s.status != 'PUBLISHED' AND NOT s.is_locked THEN 1 WHEN NOT s.is_locked THEN 2 ELSE 3 END) ASC, s.created_at DESC
       LIMIT 1`
    );
    if (!r.rows.length) {
      return res.json({ session: null, canRegister: false, standard_domains: STANDARD_DOMAINS });
    }
    const session = r.rows[0];
    const canRegister = !session.is_locked && session.status !== 'PUBLISHED';
    res.json({
      session,
      canRegister,
      standard_domains: STANDARD_DOMAINS,
    });
  } catch (err) {
    console.error('[Seminar] GET /active-session:', err.message);
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

// GET /api/seminar/domains
router.get('/domains', verifyToken, (_req, res) => {
  res.json({ domains: STANDARD_DOMAINS });
});

// GET /api/seminar/my-submission
router.get('/my-submission', verifyToken, async (req, res) => {
  try {
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId, 10) : null;

    // Student profile prefill
    let studentProfile = { name: req.user.name, email: req.user.email, prn: '', division: '' };
    if (req.user.role === 'student') {
      const stRes = await pool.query(
        'SELECT roll_no, enrollment_no, division, batch FROM students WHERE user_id = $1',
        [req.user.id]
      );
      if (stRes.rows.length > 0) {
        studentProfile.prn = stRes.rows[0].enrollment_no || stRes.rows[0].roll_no || '';
        studentProfile.division = stRes.rows[0].division || '';
      }
    }

    // Determine target session
    let session = null;
    if (sessionId) {
      const sRes = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
      if (sRes.rows.length) session = sRes.rows[0];
    }
    if (!session) {
      const sRes = await pool.query(
        `SELECT * FROM seminar_sessions ORDER BY (CASE WHEN status != 'PUBLISHED' AND NOT is_locked THEN 1 ELSE 2 END) ASC, created_at DESC LIMIT 1`
      );
      if (sRes.rows.length) session = sRes.rows[0];
    }

    if (!session) {
      return res.json({
        hasSession: false,
        hasSubmission: false,
        prefill: studentProfile,
        standard_domains: STANDARD_DOMAINS,
      });
    }

    // Check if current user is leader of a group in this session
    let groupRes = await pool.query(
      `SELECT sg.*, u.name as leader_name, u.email as leader_email
       FROM seminar_groups sg
       LEFT JOIN users u ON sg.leader_user_id = u.id
       WHERE sg.session_id = $1 AND sg.leader_user_id = $2`,
      [session.id, req.user.id]
    );

    let isLeader = true;

    // If not found by leader_user_id, check if student's PRN or email is in any group's members
    if (groupRes.rows.length === 0 && studentProfile.prn) {
      const memberGroupRes = await pool.query(
        `SELECT sg.*, u.name as leader_name, u.email as leader_email
         FROM seminar_groups sg
         JOIN seminar_group_members sgm ON sgm.group_id = sg.id
         LEFT JOIN users u ON sg.leader_user_id = u.id
         WHERE sg.session_id = $1 AND (UPPER(REPLACE(sgm.prn, ' ', '')) = $2 OR LOWER(sgm.email) = $3)
         LIMIT 1`,
        [session.id, normPrn(studentProfile.prn), normEmail(studentProfile.email)]
      );
      if (memberGroupRes.rows.length > 0) {
        groupRes = memberGroupRes;
        isLeader = groupRes.rows[0].leader_user_id === req.user.id;
      }
    }

    if (groupRes.rows.length === 0) {
      return res.json({
        hasSession: true,
        session,
        hasSubmission: false,
        prefill: studentProfile,
        canEdit: !session.is_locked && session.status !== 'PUBLISHED',
        standard_domains: STANDARD_DOMAINS,
      });
    }

    const group = groupRes.rows[0];
    const membersRes = await pool.query(
      `SELECT * FROM seminar_group_members WHERE group_id = $1 ORDER BY member_index ASC`,
      [group.id]
    );

    const canEdit = isLeader && (!session.is_locked || group.allow_edit) && session.status !== 'PUBLISHED';
    
    // Server-side scrubbing of guide identity before approval
    if (group.status !== 'APPROVED') {
      delete group.guide_id;
      delete group.seminar_guide_id;
      delete group.guide_name;
    }

    // Fetch individual marks for this student if group is approved and marks are submitted
    let myMarks = null;
    if (group.status === 'APPROVED' && studentProfile.prn) {
      const mRes = await pool.query(
        "SELECT * FROM seminar_marks WHERE prn = $1 AND group_id = $2 AND status IN ('SUBMITTED', 'FINALIZED')",
        [studentProfile.prn, group.id]
      );
      if (mRes.rows.length) {
        myMarks = mRes.rows[0];
      }
    }

    res.json({
      hasSession: true,
      session,
      hasSubmission: true,
      group,
      members: membersRes.rows,
      myMarks,
      isLeader,
      canEdit,
      prefill: studentProfile,
      standard_domains: STANDARD_DOMAINS,
    });
  } catch (err) {
    console.error('[Seminar] GET /my-submission:', err.message);
    res.status(500).json({ error: 'Failed to fetch submission details' });
  }
});

// POST /api/seminar/register-group (student creates or edits group)
router.post('/register-group', verifyToken, requireRole('student'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { session_id, domain, members } = req.body;
    const sessionId = parseInt(session_id, 10);
    if (!sessionId) {
      return res.status(400).json({ error: 'Valid session_id is required' });
    }

    // Transaction with advisory lock to prevent double-click race conditions
    await client.query('BEGIN');
    const lockKey = (sessionId * 100000) + (req.user.id % 100000);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // Check session
    const sessRes = await client.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
    if (!sessRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seminar session not found' });
    }
    const session = sessRes.rows[0];
    if (session.status === 'PUBLISHED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This session is published. Registrations are closed.' });
    }

    // Check existing group by this leader
    const existingGroupRes = await client.query(
      'SELECT * FROM seminar_groups WHERE session_id = $1 AND leader_user_id = $2',
      [sessionId, req.user.id]
    );
    const existingGroup = existingGroupRes.rows[0] || null;

    // Check locking
    if (session.is_locked) {
      if (!existingGroup || !existingGroup.allow_edit) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Registration is locked by the coordinator. Further submissions and edits are closed.',
        });
      }
    }

    // In-memory validation of fields, formats, group size, and duplicate PRNs within submission
    const valResult = validateSingleGroup({ domain, members });
    if (!valResult.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: valResult.errors[0],
        errors: valResult.errors,
        warnings: valResult.warnings,
      });
    }

    const { cleanedGroup } = valResult;

    // Database check for duplicate PRNs across OTHER groups in this session
    const prnList = cleanedGroup.members.map(m => m.prn);
    const conflictQuery = `
      SELECT sg.id as group_id, sg.group_no, m.student_name, m.prn
      FROM seminar_group_members m
      JOIN seminar_groups sg ON m.group_id = sg.id
      WHERE sg.session_id = $1
        AND UPPER(REPLACE(m.prn, ' ', '')) = ANY($2)
        AND ($3::int IS NULL OR sg.id != $3)
      LIMIT 1
    `;
    const conflictRes = await client.query(conflictQuery, [
      sessionId,
      prnList,
      existingGroup ? existingGroup.id : null,
    ]);

    if (conflictRes.rows.length > 0) {
      const conflict = conflictRes.rows[0];
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `PRN "${conflict.prn}" (${conflict.student_name}) is already registered in Group ${conflict.group_no}. A student cannot be registered in multiple groups.`,
        conflict: {
          prn: conflict.prn,
          name: conflict.student_name,
          groupNo: conflict.group_no,
        },
      });
    }

    let finalGroupId;
    let finalGroupNo;
    let actionType;

    if (existingGroup) {
      // UPDATE existing group
      finalGroupId = existingGroup.id;
      finalGroupNo = existingGroup.group_no;
      actionType = 'UPDATE';

      await client.query(
        `UPDATE seminar_groups
         SET domain = $1, updated_at = NOW()
         WHERE id = $2`,
        [cleanedGroup.domain, finalGroupId]
      );

      // Re-insert members
      await client.query('DELETE FROM seminar_group_members WHERE group_id = $1', [finalGroupId]);
      for (const m of cleanedGroup.members) {
        await client.query(
          `INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [finalGroupId, m.memberIndex, m.student_name, m.prn, m.division, m.mobile, m.email, m.topic1, m.topic2, m.topic3, m.is_leader]
        );
      }
    } else {
      // INSERT new group
      actionType = 'INSERT';
      const maxNoRes = await client.query(
        'SELECT COALESCE(MAX(group_no), 0) + 1 AS next_no FROM seminar_groups WHERE session_id = $1',
        [sessionId]
      );
      finalGroupNo = maxNoRes.rows[0].next_no;

      const gRow = await client.query(
        `INSERT INTO seminar_groups (session_id, group_no, domain, leader_user_id, allow_edit, submitted_at)
         VALUES ($1, $2, $3, $4, FALSE, NOW()) RETURNING id`,
        [sessionId, finalGroupNo, cleanedGroup.domain, req.user.id]
      );
      finalGroupId = gRow.rows[0].id;

      for (const m of cleanedGroup.members) {
        await client.query(
          `INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [finalGroupId, m.memberIndex, m.student_name, m.prn, m.division, m.mobile, m.email, m.topic1, m.topic2, m.topic3, m.is_leader]
        );
      }
    }

    await client.query('COMMIT');

    await auditRecord({
      tableName: 'seminar_groups',
      recordId: finalGroupId,
      changedBy: req.user.id,
      oldValue: existingGroup ? { domain: existingGroup.domain } : null,
      newValue: { domain: cleanedGroup.domain, memberCount: cleanedGroup.members.length, groupNo: finalGroupNo },
      action: actionType,
      reason: actionType === 'INSERT' ? 'Student group registration' : 'Student group update',
    });

    res.json({
      success: true,
      message: actionType === 'INSERT' ? 'Seminar group registered successfully!' : 'Seminar group registration updated successfully!',
      groupId: finalGroupId,
      groupNo: finalGroupNo,
      warnings: valResult.warnings,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar] POST /register-group:', err.message);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── V2: Coordinator Live Submissions & Standing Validation Endpoints ──────────

// GET /api/seminar/sessions/:id/submissions
router.get('/sessions/:id/submissions', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const sRes = await pool.query(
      `SELECT s.*, u.name as created_by_name, pu.name as published_by_name, lu.name as locked_by_name
       FROM seminar_sessions s
       JOIN users u ON s.created_by = u.id
       LEFT JOIN users pu ON s.published_by = pu.id
       LEFT JOIN users lu ON s.locked_by = lu.id
       WHERE s.id = $1`,
      [sessionId]
    );
    if (!sRes.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sRes.rows[0];

    const groupsRes = await pool.query(
      `SELECT sg.*, u.name as leader_name, u.email as leader_email,
              (SELECT json_agg(json_build_object(
                'id', m.id,
                'member_index', m.member_index,
                'student_name', m.student_name,
                'prn', m.prn,
                'division', m.division,
                'mobile', m.mobile,
                'email', m.email,
                'topic1', m.topic1,
                'topic2', m.topic2,
                'topic3', m.topic3,
                'is_leader', m.is_leader
              ) ORDER BY m.member_index) FROM seminar_group_members m WHERE m.group_id = sg.id) as members
       FROM seminar_groups sg
       LEFT JOIN users u ON sg.leader_user_id = u.id
       WHERE sg.session_id = $1
       ORDER BY sg.group_no ASC`,
      [sessionId]
    );

    const groups = groupsRes.rows.map(g => ({
      ...g,
      members: g.members || [],
    }));

    const standing = runStandingValidation(groups);

    res.json({
      session,
      groups,
      standingValidation: standing,
    });
  } catch (err) {
    console.error('[Seminar] GET /sessions/:id/submissions:', err.message);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// GET /api/seminar/sessions/:id/validation
router.get('/sessions/:id/validation', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const groupsRes = await pool.query(
      `SELECT sg.*,
              (SELECT json_agg(json_build_object(
                'id', m.id,
                'member_index', m.member_index,
                'student_name', m.student_name,
                'prn', m.prn,
                'division', m.division,
                'mobile', m.mobile,
                'email', m.email,
                'topic1', m.topic1,
                'topic2', m.topic2,
                'topic3', m.topic3,
                'is_leader', m.is_leader
              ) ORDER BY m.member_index) FROM seminar_group_members m WHERE m.group_id = sg.id) as members
       FROM seminar_groups sg
       WHERE sg.session_id = $1
       ORDER BY sg.group_no ASC`,
      [sessionId]
    );

    const groups = groupsRes.rows.map(g => ({ ...g, members: g.members || [] }));
    const result = runStandingValidation(groups);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to run validation' });
  }
});

// PATCH /api/seminar/sessions/:id/toggle-lock
router.patch('/sessions/:id/toggle-lock', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const prev = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
    if (!prev.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = prev.rows[0];

    const newLocked = !session.is_locked;
    const r = await pool.query(
      `UPDATE seminar_sessions
       SET is_locked = $1,
           locked_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           locked_by = CASE WHEN $1 THEN $2 ELSE NULL END
       WHERE id = $3 RETURNING *`,
      [newLocked, req.user.id, sessionId]
    );

    await auditRecord({
      tableName: 'seminar_sessions',
      recordId: sessionId,
      changedBy: req.user.id,
      oldValue: { is_locked: session.is_locked },
      newValue: { is_locked: newLocked },
      action: 'UPDATE',
      reason: newLocked ? 'Coordinator locked registration' : 'Coordinator reopened registration',
    });

    res.json({ session: r.rows[0], message: newLocked ? 'Registration locked successfully' : 'Registration reopened successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle lock' });
  }
});

// PATCH /api/seminar/sessions/:id/groups/:groupId/unlock
router.patch('/sessions/:id/groups/:groupId/unlock', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const groupId = parseInt(req.params.groupId, 10);
  try {
    const prev = await pool.query(
      'SELECT * FROM seminar_groups WHERE id = $1 AND session_id = $2',
      [groupId, sessionId]
    );
    if (!prev.rows.length) return res.status(404).json({ error: 'Group not found' });
    const old = prev.rows[0];

    const newAllow = !old.allow_edit;
    const r = await pool.query(
      `UPDATE seminar_groups SET allow_edit = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newAllow, groupId]
    );

    await auditRecord({
      tableName: 'seminar_groups',
      recordId: groupId,
      changedBy: req.user.id,
      oldValue: { allow_edit: old.allow_edit },
      newValue: { allow_edit: newAllow },
      action: 'UPDATE',
      reason: newAllow ? 'Coordinator granted single-group edit exception' : 'Coordinator revoked group edit exception',
    });

    res.json({ group: r.rows[0], message: newAllow ? 'Group edit exception granted' : 'Group edit locked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle group edit exception' });
  }
});

// DELETE /api/seminar/sessions/:id/groups/:groupId
router.delete('/sessions/:id/groups/:groupId', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const groupId = parseInt(req.params.groupId, 10);
  try {
    const prev = await pool.query('SELECT * FROM seminar_groups WHERE id = $1 AND session_id = $2', [groupId, sessionId]);
    if (!prev.rows.length) return res.status(404).json({ error: 'Group not found' });
    const old = prev.rows[0];

    await pool.query('DELETE FROM seminar_groups WHERE id = $1 AND session_id = $2', [groupId, sessionId]);

    await auditRecord({
      tableName: 'seminar_groups',
      recordId: groupId,
      changedBy: req.user.id,
      oldValue: old,
      newValue: null,
      action: 'DELETE',
      reason: 'Coordinator deleted group',
    });

    res.json({ deleted: true, groupId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ─── Upload & Parse (Legacy Fallback) ─────────────────────────────────────────

// POST /api/seminar/sessions/:id/upload
router.post('/sessions/:id/upload', verifyToken, requireCoordinator,
  upload.single('file'),
  async (req, res) => {
    const sessionId = parseInt(req.params.id, 10);
    try {
      // Verify session exists and is not published
      const sess = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
      if (!sess.rows.length) return res.status(404).json({ error: 'Session not found' });
      if (sess.rows[0].status === 'PUBLISHED') {
        return res.status(409).json({ error: 'Session is published — uploads are locked' });
      }

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      // Check if an upload already exists for this session — warn coordinator
      const existing = await pool.query(
        'SELECT id FROM seminar_uploads WHERE session_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
        [sessionId]
      );
      const hasExisting = existing.rows.length > 0;

      // Parse
      let rows, parseResult, parseError = null;
      try {
        rows = parseSpreadsheet(req.file.buffer, req.file.mimetype);
        const { groups } = parseGroups(rows);
        const { issues } = validateGroups(groups);
        parseResult = { groupCount: groups.length, groups, issues };
      } catch (parseErr) {
        parseError = parseErr.message;
      }

      // Store upload record (raw bytes in DB)
      const uploadRec = await pool.query(
        `INSERT INTO seminar_uploads (session_id, original_filename, file_data, uploaded_by, parse_status, parse_result, parse_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, uploaded_at, parse_status`,
        [
          sessionId,
          req.file.originalname,
          req.file.buffer,
          req.user.id,
          parseError ? 'ERROR' : 'PARSED',
          parseResult ? JSON.stringify(parseResult) : null,
          parseError,
        ]
      );

      // Update session status to UPLOAD (or VALIDATION if parse succeeded)
      const newStatus = parseError ? 'UPLOAD' : 'VALIDATION';
      await pool.query('UPDATE seminar_sessions SET status = $1 WHERE id = $2', [newStatus, sessionId]);

      await auditRecord({
        tableName: 'seminar_uploads', recordId: uploadRec.rows[0].id,
        changedBy: req.user.id, oldValue: null,
        newValue: { filename: req.file.originalname, sessionId, parseStatus: uploadRec.rows[0].parse_status },
        action: 'INSERT',
      });

      res.json({
        uploadId: uploadRec.rows[0].id,
        hadExistingUpload: hasExisting,
        parseStatus: uploadRec.rows[0].parse_status,
        groupCount: parseResult?.groupCount ?? 0,
        issues: parseResult?.issues ?? [],
        error: parseError,
      });
    } catch (err) {
      console.error('[Seminar] upload:', err.message);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  }
);

// GET /api/seminar/sessions/:id/parse-result
router.get('/sessions/:id/parse-result', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT su.id, su.original_filename, su.uploaded_at, su.parse_status, su.parse_result, su.parse_error, u.name as uploaded_by_name
       FROM seminar_uploads su JOIN users u ON su.uploaded_by = u.id
       WHERE su.session_id = $1 ORDER BY su.uploaded_at DESC LIMIT 1`,
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No upload found for this session' });
    const row = r.rows[0];
    // Don't return raw file bytes
    res.json({
      uploadId: row.id,
      filename: row.original_filename,
      uploadedAt: row.uploaded_at,
      uploadedByName: row.uploaded_by_name,
      parseStatus: row.parse_status,
      parseError: row.parse_error,
      result: row.parse_result,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch parse result' });
  }
});

// POST /api/seminar/sessions/:id/override-issue
router.post('/sessions/:id/override-issue', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const { issueKey, note } = req.body;
    if (!issueKey) return res.status(400).json({ error: 'issueKey is required' });
    const r = await pool.query(
      `INSERT INTO seminar_issue_overrides (session_id, issue_key, acknowledged_by, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, issue_key) DO UPDATE SET note = EXCLUDED.note, acknowledged_by = EXCLUDED.acknowledged_by, created_at = NOW()
       RETURNING *`,
      [req.params.id, issueKey, req.user.id, note || null]
    );
    await auditRecord({
      tableName: 'seminar_issue_overrides', recordId: r.rows[0].id,
      changedBy: req.user.id, oldValue: null, newValue: { issueKey, note }, action: 'INSERT',
    });
    res.json({ override: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save override' });
  }
});

// GET /api/seminar/sessions/:id/overrides
router.get('/sessions/:id/overrides', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT o.*, u.name as acknowledged_by_name FROM seminar_issue_overrides o
       JOIN users u ON o.acknowledged_by = u.id WHERE o.session_id = $1`,
      [req.params.id]
    );
    res.json({ overrides: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

// ─── Commit parsed groups to DB ───────────────────────────────────────────────

// POST /api/seminar/sessions/:id/commit
// Saves parsed groups + members to DB (replaces existing groups for this session)
router.post('/sessions/:id/commit', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    // Load latest parse result
    const upRow = await client.query(
      `SELECT parse_result FROM seminar_uploads WHERE session_id = $1 AND parse_status = 'PARSED' ORDER BY uploaded_at DESC LIMIT 1`,
      [sessionId]
    );
    if (!upRow.rows.length) return res.status(400).json({ error: 'No successfully parsed upload found' });

    const { groups, issues } = upRow.rows[0].parse_result;
    const errorIssues = issues.filter(i => i.severity === 'error');

    // Check all errors acknowledged
    if (errorIssues.length > 0) {
      const ackRes = await client.query(
        'SELECT issue_key FROM seminar_issue_overrides WHERE session_id = $1',
        [sessionId]
      );
      const acked = new Set(ackRes.rows.map(r => r.issue_key));
      const unacked = errorIssues.filter(i => !acked.has(i.key));
      if (unacked.length > 0) {
        return res.status(409).json({
          error: `${unacked.length} validation error(s) must be acknowledged before committing.`,
          unacknowledged: unacked,
        });
      }
    }

    await client.query('BEGIN');

    // Delete old groups for this session (cascades to members)
    await client.query('DELETE FROM seminar_groups WHERE session_id = $1', [sessionId]);

    // Insert groups + members
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const gRow = await client.query(
        `INSERT INTO seminar_groups (session_id, group_no, domain, source_row_index)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [sessionId, gi + 1, g.domain || '', g.sourceRowIndex]
      );
      const groupId = gRow.rows[0].id;
      for (const m of g.members) {
        await client.query(
          `INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [groupId, m.memberIndex, m.student_name, m.prn, m.division, m.mobile, m.email, m.topic1, m.topic2, m.topic3, m.is_leader]
        );
      }
    }

    await client.query(`UPDATE seminar_sessions SET status = 'ASSIGNMENT' WHERE id = $1`, [sessionId]);
    await client.query('COMMIT');
    await auditRecord({ tableName: 'seminar_sessions', recordId: sessionId, changedBy: req.user.id, oldValue: { status: 'VALIDATION' }, newValue: { status: 'ASSIGNMENT', groupCount: groups.length }, action: 'UPDATE' });

    res.json({ committed: true, groupCount: groups.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar] commit:', err.message);
    res.status(500).json({ error: 'Commit failed: ' + err.message });
  } finally {
    client.release();
  }
});

// ─── Guides ───────────────────────────────────────────────────────────────────

// GET /api/seminar/sessions/:id/guides
router.get('/sessions/:id/guides', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sg.id, sg.session_id, sg.faculty_id, sg.quota, sg.display_order,
              COALESCE(sg.guide_name, u.name, 'Unknown Guide') as faculty_name,
              COALESCE(sg.designation, f.designation, '') as designation,
              f.employee_id
       FROM seminar_guides sg
       LEFT JOIN faculty f ON sg.faculty_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE sg.session_id = $1
       ORDER BY sg.display_order ASC, sg.id ASC`,
      [req.params.id]
    );
    res.json({ guides: r.rows });
  } catch (err) {
    console.error('[Seminar] get guides:', err.message);
    res.status(500).json({ error: 'Failed to fetch guides' });
  }
});

// GET /api/seminar/faculty-list — all faculty for dropdown
router.get('/faculty-list', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT f.id, u.name, f.designation, f.employee_id FROM faculty f JOIN users u ON f.user_id = u.id WHERE u.is_active = true ORDER BY u.name`
    );
    res.json({ faculty: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch faculty list' });
  }
});

// POST /api/seminar/sessions/:id/guides
router.post('/sessions/:id/guides', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const { faculty_id, guide_name, designation, quota, display_order } = req.body;
    const q = quota != null ? parseInt(quota, 10) : 4;
    const order = display_order != null ? parseInt(display_order, 10) : 1;

    if (faculty_id) {
      const facRes = await pool.query(
        'SELECT u.name, f.designation FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1',
        [faculty_id]
      );
      const name = facRes.rows[0]?.name || null;
      const desig = designation || facRes.rows[0]?.designation || null;

      const r = await pool.query(
        `INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.params.id, faculty_id, name, desig, q, order]
      );
      return res.json({ guide: r.rows[0] });
    }

    if (guide_name && String(guide_name).trim()) {
      const cleanName = String(guide_name).trim();
      const cleanDesig = designation ? String(designation).trim() : null;

      const r = await pool.query(
        `INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order)
         VALUES ($1, NULL, $2, $3, $4, $5)
         RETURNING *`,
        [req.params.id, cleanName, cleanDesig, q, order]
      );
      return res.json({ guide: r.rows[0] });
    }

    return res.status(400).json({ error: 'Either faculty_id or guide_name is required' });
  } catch (err) {
    console.error('[Seminar] save guide:', err.message);
    res.status(500).json({ error: 'Failed to save guide: ' + err.message });
  }
});

// DELETE /api/seminar/sessions/:id/guides/:gid
router.delete('/sessions/:id/guides/:gid', verifyToken, requireCoordinator, async (req, res) => {
  try {
    await pool.query('DELETE FROM seminar_guides WHERE id = $1 AND session_id = $2', [req.params.gid, req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete guide' });
  }
});

// ─── Assignment ───────────────────────────────────────────────────────────────

// GET /api/seminar/sessions/:id/assignments
router.get('/sessions/:id/assignments', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, sg.status,
              COALESCE(sg.seminar_guide_id, sem_g.id) as guide_id,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              COALESCE(sem_g.designation, f.designation, '') as guide_designation,
              (SELECT json_agg(json_build_object('name', m.student_name,'prn',m.prn,'division',m.division,'is_leader',m.is_leader,'topic1',m.topic1,'topic2',m.topic2,'topic3',m.topic3) ORDER BY m.member_index)
               FROM seminar_group_members m WHERE m.group_id = sg.id) as members
       FROM seminar_groups sg
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE sg.session_id = $1
       ORDER BY sg.group_no ASC`,
      [req.params.id]
    );
    res.json({ groups: r.rows });
  } catch (err) {
    console.error('[Seminar] get assignments:', err.message);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// POST /api/seminar/sessions/:id/assign  — run sequential fill
router.post('/sessions/:id/assign', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  const { confirm } = req.body;

  try {
    const existing = await pool.query(
      'SELECT COUNT(*) FROM seminar_groups WHERE session_id = $1 AND (seminar_guide_id IS NOT NULL OR guide_id IS NOT NULL)',
      [sessionId]
    );
    const hasAssignments = parseInt(existing.rows[0].count, 10) > 0;
    if (hasAssignments && !confirm) {
      return res.status(409).json({
        conflict: true,
        message: 'Groups already have guide assignments. Send confirm=true to overwrite.',
      });
    }

    // Load groups
    const groupsRes = await pool.query(
      'SELECT id FROM seminar_groups WHERE session_id = $1 ORDER BY group_no ASC',
      [sessionId]
    );
    // Load guides sorted by display_order
    const guidesRes = await pool.query(
      `SELECT sg.id, sg.session_id, sg.faculty_id, sg.quota, sg.display_order,
              COALESCE(sg.guide_name, u.name, 'Unknown Guide') as faculty_name
       FROM seminar_guides sg
       LEFT JOIN faculty f ON sg.faculty_id = f.id
       LEFT JOIN users u ON f.user_id = u.id
       WHERE sg.session_id = $1 ORDER BY sg.display_order ASC, sg.id ASC`,
      [sessionId]
    );

    const { assignments, unassigned } = sequentialFill(groupsRes.rows, guidesRes.rows);

    // Apply assignments
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const a of assignments) {
        const group = groupsRes.rows[a.groupIndex];
        await client.query(
          `UPDATE seminar_groups
           SET seminar_guide_id = $1, guide_id = $2, guide_name = $3, updated_at = NOW()
           WHERE id = $4`,
          [a.seminarGuideId, a.facultyId, a.guideName, group.id]
        );
      }
      if (unassigned.length > 0) {
        for (const idx of unassigned) {
          await client.query(
            `UPDATE seminar_groups
             SET seminar_guide_id = NULL, guide_id = NULL, guide_name = NULL, updated_at = NOW()
             WHERE id = $1`,
            [groupsRes.rows[idx].id]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await auditRecord({ tableName: 'seminar_sessions', recordId: sessionId, changedBy: req.user.id, oldValue: null, newValue: { autoAssigned: assignments.length, unassigned: unassigned.length }, action: 'UPDATE' });

    res.json({ assigned: assignments.length, unassigned: unassigned.length });
  } catch (err) {
    console.error('[Seminar] assign:', err.message);
    res.status(500).json({ error: 'Assignment failed: ' + err.message });
  }
});

// PATCH /api/seminar/sessions/:id/assignments/:groupId  — manual reassign
router.patch('/sessions/:id/assignments/:groupId', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const { guide_id } = req.body;
    const prev = await pool.query(
      'SELECT guide_id, seminar_guide_id, guide_name FROM seminar_groups WHERE id = $1 AND session_id = $2',
      [req.params.groupId, req.params.id]
    );
    if (!prev.rows.length) return res.status(404).json({ error: 'Group not found' });
    const old = prev.rows[0];

    if (!guide_id) {
      await pool.query(
        'UPDATE seminar_groups SET seminar_guide_id = NULL, guide_id = NULL, guide_name = NULL, updated_at = NOW() WHERE id = $1',
        [req.params.groupId]
      );
    } else {
      const guideRes = await pool.query(
        `SELECT sg.*, COALESCE(sg.guide_name, u.name) as final_name
         FROM seminar_guides sg
         LEFT JOIN faculty f ON sg.faculty_id = f.id
         LEFT JOIN users u ON f.user_id = u.id
         WHERE sg.id = $1 AND sg.session_id = $2`,
        [parseInt(guide_id, 10), req.params.id]
      );
      if (!guideRes.rows.length) return res.status(404).json({ error: 'Guide not found in session roster' });
      const g = guideRes.rows[0];

      await pool.query(
        'UPDATE seminar_groups SET seminar_guide_id = $1, guide_id = $2, guide_name = $3, updated_at = NOW() WHERE id = $4',
        [g.id, g.faculty_id, g.final_name, req.params.groupId]
      );
    }

    await auditRecord({
      tableName: 'seminar_groups',
      recordId: parseInt(req.params.groupId, 10),
      changedBy: req.user.id,
      oldValue: { guide_id: old.seminar_guide_id, guide_name: old.guide_name },
      newValue: { guide_id: guide_id || null },
      action: 'UPDATE',
      reason: 'Manual reassignment'
    });
    res.json({ updated: true });
  } catch (err) {
    console.error('[Seminar] reassign:', err.message);
    res.status(500).json({ error: 'Reassignment failed' });
  }
});

// ─── Publish ──────────────────────────────────────────────────────────────────

// POST /api/seminar/sessions/:id/publish
router.post('/sessions/:id/publish', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const unassigned = await pool.query(
      `SELECT COUNT(*) FROM seminar_groups
       WHERE session_id = $1 AND seminar_guide_id IS NULL AND guide_id IS NULL AND (guide_name IS NULL OR guide_name = '')`,
      [sessionId]
    );
    if (parseInt(unassigned.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: `${unassigned.rows[0].count} group(s) are not yet assigned to a guide` });
    }
    await pool.query(
      `UPDATE seminar_sessions SET status = 'PUBLISHED', published_at = NOW(), published_by = $1 WHERE id = $2`,
      [req.user.id, sessionId]
    );
    await auditRecord({ tableName: 'seminar_sessions', recordId: sessionId, changedBy: req.user.id, oldValue: { status: 'ASSIGNMENT' }, newValue: { status: 'PUBLISHED' }, action: 'UPDATE' });
    res.json({ published: true });
  } catch (err) {
    res.status(500).json({ error: 'Publish failed' });
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────

// GET /api/seminar/sessions/:id/export
router.get('/sessions/:id/export', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const sessRes = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
    if (!sessRes.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessRes.rows[0];

    const groupsRes = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name
       FROM seminar_groups sg
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE sg.session_id = $1 ORDER BY sg.group_no ASC`,
      [sessionId]
    );

    const membersRes = await pool.query(
      `SELECT m.* FROM seminar_group_members m
       JOIN seminar_groups sg ON m.group_id = sg.id
       WHERE sg.session_id = $1 ORDER BY sg.group_no ASC, m.member_index ASC`,
      [sessionId]
    );

    const membersByGroupId = new Map();
    for (const m of membersRes.rows) {
      if (!membersByGroupId.has(m.group_id)) membersByGroupId.set(m.group_id, []);
      membersByGroupId.get(m.group_id).push(m);
    }

    const buffer = buildWorkbook(session, groupsRes.rows, membersByGroupId);
    const statePrefix = session.status === 'PUBLISHED' ? 'Final' : 'Draft';
    const filename = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${statePrefix}_GroupList.xlsx`;

    await auditRecord({ tableName: 'seminar_sessions', recordId: sessionId, changedBy: req.user.id, oldValue: null, newValue: { exported: filename }, action: 'UPDATE' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Seminar] export:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ─── Guide-facing view ────────────────────────────────────────────────────────

// ─── Guide-facing view ────────────────────────────────────────────────────────

// GET /api/seminar/my-groups — guide sees their assigned groups (where HOD has approved or session is published)
router.get('/my-groups', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  try {
    const fid = await getFacultyId(req.user.id);
    if (!fid) return res.status(404).json({ error: 'Faculty record not found' });

    const r = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, sg.status as approval_status,
              ss.id as session_id, ss.name as session_name, ss.academic_year, ss.batch, ss.status as session_status,
              COALESCE(
                (SELECT sm.status FROM seminar_marks sm WHERE sm.group_id = sg.id LIMIT 1),
                'NOT_STARTED'
              ) as evaluation_status,
              (SELECT COUNT(*) FROM seminar_marks sm WHERE sm.group_id = sg.id) as marks_count,
              (SELECT ROUND(AVG(sm.total_marks), 2) FROM seminar_marks sm WHERE sm.group_id = sg.id) as avg_marks,
              (SELECT MAX(sm.submitted_at) FROM seminar_marks sm WHERE sm.group_id = sg.id) as submitted_at,
              json_agg(
                json_build_object(
                  'id', m.id,
                  'name', m.student_name,
                  'prn', m.prn,
                  'division', m.division,
                  'mobile', m.mobile,
                  'email', m.email,
                  'topic1', m.topic1,
                  'topic2', m.topic2,
                  'topic3', m.topic3,
                  'is_leader', m.is_leader
                ) ORDER BY m.member_index
              ) as members
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_group_members m ON m.group_id = sg.id
       WHERE sg.guide_id = $1 AND (sg.status = 'APPROVED' OR ss.status = 'PUBLISHED')
       GROUP BY sg.id, sg.group_no, sg.domain, sg.status, ss.id, ss.name, ss.academic_year, ss.batch, ss.status
       ORDER BY ss.id DESC, sg.group_no ASC`,
      [fid]
    );
    res.json({ groups: r.rows });
  } catch (err) {
    console.error('[Seminar] my-groups:', err.message);
    res.status(500).json({ error: 'Failed to fetch assigned groups' });
  }
});

// ─── Audit trail ─────────────────────────────────────────────────────────────

// GET /api/seminar/sessions/:id/audit
router.get('/sessions/:id/audit', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const groupIds = await pool.query(
      'SELECT id FROM seminar_groups WHERE session_id = $1',
      [sessionId]
    );
    const gids = groupIds.rows.map(r => r.id);

    const logs = await pool.query(
      `SELECT al.*, u.name as changed_by_name FROM audit_log al
       JOIN users u ON al.changed_by = u.id
       WHERE (al.table_name = 'seminar_sessions' AND al.record_id = $1)
          OR (al.table_name = 'seminar_uploads' AND al.record_id IN (
               SELECT id FROM seminar_uploads WHERE session_id = $1))
          OR (al.table_name = 'seminar_groups' AND al.record_id = ANY($2))
          OR (al.table_name = 'seminar_marks' AND al.record_id = ANY($2))
          OR (al.table_name = 'seminar_issue_overrides' AND al.record_id IN (
               SELECT id FROM seminar_issue_overrides WHERE session_id = $1))
       ORDER BY al.created_at DESC`,
      [sessionId, gids]
    );
    res.json({ logs: logs.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ─── Seminar V3: HOD Approval & Guide Assignment State Machine ────────────

// POST /api/seminar/sessions/:id/submit-approvals (Coordinator submits assignments to HOD)
router.post('/sessions/:id/submit-approvals', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const { groupIds } = req.body;
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ error: 'groupIds array is required' });
    }
    await pool.query(
      `UPDATE seminar_groups 
       SET status = 'AWAITING_HOD_APPROVAL', assigned_by = $1, assigned_at = NOW() 
       WHERE id = ANY($2) AND session_id = $3 AND (guide_id IS NOT NULL OR seminar_guide_id IS NOT NULL)`,
      [req.user.id, groupIds, sessionId]
    );
    await auditRecord({
      tableName: 'seminar_sessions',
      recordId: sessionId,
      changedBy: req.user.id,
      action: 'SUBMIT_SEMINAR_APPROVALS',
      oldValue: null,
      newValue: { count: groupIds.length, groupIds },
      reason: 'Coordinator submitted guide assignments for HOD approval'
    });
    res.json({ message: 'Submitted for HOD approval' });
  } catch (err) {
    console.error('[Seminar] submit-approvals:', err.message);
    res.status(500).json({ error: 'Failed to submit approvals' });
  }
});

// GET /api/seminar/hod/pending-approvals (HOD sees pending assignments)
router.get('/hod/pending-approvals', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sg.*, u.name as assigned_by_name,
              ss.name as session_name, ss.academic_year, ss.batch,
              (SELECT json_agg(json_build_object('name',m.student_name,'prn',m.prn,'topic1',m.topic1)) 
               FROM seminar_group_members m WHERE m.group_id = sg.id) as members
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN users u ON sg.assigned_by = u.id
       WHERE sg.status = 'AWAITING_HOD_APPROVAL'
       ORDER BY sg.session_id DESC, sg.group_no ASC`
    );
    res.json({ pending: r.rows });
  } catch (err) {
    console.error('[Seminar] pending-approvals:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

// PATCH /api/seminar/hod/groups/:id/approve (HOD approves assignment)
router.patch('/hod/groups/:id/approve', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE seminar_groups 
       SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), hod_remarks = NULL 
       WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    await auditRecord({
      tableName: 'seminar_groups',
      recordId: parseInt(req.params.id, 10),
      changedBy: req.user.id,
      action: 'APPROVE_SEMINAR_ASSIGNMENT',
      oldValue: { status: 'AWAITING_HOD_APPROVAL' },
      newValue: { status: 'APPROVED' },
      reason: 'HOD approved seminar guide assignment'
    });
    res.json({ message: 'Assignment approved' });
  } catch (err) {
    console.error('[Seminar] approve group:', err.message);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// PATCH /api/seminar/hod/groups/:id/reject (HOD rejects assignment)
router.patch('/hod/groups/:id/reject', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { remark } = req.body;
    await pool.query(
      `UPDATE seminar_groups 
       SET status = 'PENDING_GUIDE_ASSIGNMENT', hod_remarks = $1 
       WHERE id = $2`,
      [remark || null, req.params.id]
    );
    await auditRecord({
      tableName: 'seminar_groups',
      recordId: parseInt(req.params.id, 10),
      changedBy: req.user.id,
      action: 'REJECT_SEMINAR_ASSIGNMENT',
      oldValue: { status: 'AWAITING_HOD_APPROVAL' },
      newValue: { status: 'PENDING_GUIDE_ASSIGNMENT', hod_remarks: remark },
      reason: remark || 'HOD rejected assignment'
    });
    res.json({ message: 'Assignment rejected' });
  } catch (err) {
    console.error('[Seminar] reject group:', err.message);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// ─── Seminar Evaluation & Marks Entry System ───────────────────────────────

// GET /api/seminar/groups/:groupId/evaluation
// Fetch group details, member roster, rubric structure, and existing marks
router.get('/groups/:groupId/evaluation', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const grpRes = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, sg.status as approval_status, sg.guide_id, sg.guide_name,
              ss.id as session_id, ss.name as session_name, ss.academic_year, ss.batch, ss.status as session_status
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       WHERE sg.id = $1`,
      [groupId]
    );
    if (!grpRes.rows.length) return res.status(404).json({ error: 'Seminar group not found' });
    const group = grpRes.rows[0];

    const isHod = req.user.role === 'hod' || req.user.role === 'admin';
    let isCoordinator = false;
    let facultyId = null;

    if (!isHod) {
      const fac = await pool.query('SELECT id, is_seminar_coordinator FROM faculty WHERE user_id = $1', [req.user.id]);
      if (!fac.rows.length) return res.status(403).json({ error: 'Faculty record not found' });
      facultyId = fac.rows[0].id;
      isCoordinator = !!fac.rows[0].is_seminar_coordinator;

      if (!isCoordinator && group.guide_id !== facultyId) {
        return res.status(403).json({ error: 'Access denied: You are not the assigned guide for this seminar group' });
      }
    }

    if (group.approval_status !== 'APPROVED') {
      return res.status(400).json({
        error: 'Evaluation cannot be conducted: This group has not been approved by the HOD yet.',
        approval_status: group.approval_status
      });
    }

    const membersRes = await pool.query(
      `SELECT m.* FROM seminar_group_members m WHERE m.group_id = $1 ORDER BY m.member_index ASC`,
      [groupId]
    );

    const marksRes = await pool.query(
      `SELECT sm.*, u.name as entered_by_name, u2.name as submitted_by_name, u3.name as unlocked_by_name
       FROM seminar_marks sm
       LEFT JOIN users u ON sm.entered_by = u.id
       LEFT JOIN users u2 ON sm.submitted_by = u2.id
       LEFT JOIN users u3 ON sm.unlocked_by = u3.id
       WHERE sm.group_id = $1`,
      [groupId]
    );

    const rubrics = [
      { key: 'attendance_marks', name: 'Attendance', max: 10, required: true, desc: 'Regularity in weekly progress reporting and guide interaction' },
      { key: 'presentation_marks', name: 'Presentation', max: 10, required: false, desc: 'Slide aesthetics, verbal delivery, professional demeanor, and time management' },
      { key: 'subject_understanding_marks', name: 'Subject Understanding', max: 10, required: false, desc: 'Comprehension of domain concepts, technical clarity, and methodology' },
      { key: 'publication_marks', name: 'Publication', max: 10, required: false, desc: 'Research paper manuscript quality, literature depth, and citation integrity' },
      { key: 'viva_marks', name: 'Viva', max: 10, required: false, desc: 'Technical defense, conceptual depth, and response accuracy in viva voce' }
    ];

    const isSubmitted = marksRes.rows.some(m => m.status === 'SUBMITTED' || m.status === 'FINALIZED');
    const isLocked = isSubmitted;
    const canEdit = isHod || isCoordinator || !isLocked;
    const canUnlock = (isHod || isCoordinator) && isLocked;

    res.json({
      group,
      members: membersRes.rows,
      marks: marksRes.rows,
      rubrics,
      maxTotal: 50,
      isLocked,
      canEdit,
      canUnlock,
      userRole: isHod ? 'hod' : isCoordinator ? 'coordinator' : 'guide'
    });
  } catch (err) {
    console.error('[Seminar] GET /groups/:groupId/evaluation:', err.message);
    res.status(500).json({ error: 'Failed to fetch evaluation data' });
  }
});

// POST /api/seminar/groups/:groupId/evaluation
// Save evaluation (Draft or Final Submission)
router.post('/groups/:groupId/evaluation', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const { status = 'DRAFT', marks, overallRemarks } = req.body;

    if (!['DRAFT', 'SUBMITTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be DRAFT or SUBMITTED' });
    }
    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ error: 'Marks list is required' });
    }

    const grpRes = await client.query(
      `SELECT sg.id, sg.session_id, sg.group_no, sg.status as approval_status, sg.guide_id
       FROM seminar_groups sg WHERE sg.id = $1`,
      [groupId]
    );
    if (!grpRes.rows.length) return res.status(404).json({ error: 'Group not found' });
    const group = grpRes.rows[0];

    if (group.approval_status !== 'APPROVED') {
      return res.status(400).json({ error: 'Cannot evaluate: Group is not approved by HOD' });
    }

    const isHod = req.user.role === 'hod' || req.user.role === 'admin';
    let isCoordinator = false;
    if (!isHod) {
      const fac = await client.query('SELECT id, is_seminar_coordinator FROM faculty WHERE user_id = $1', [req.user.id]);
      if (!fac.rows.length) return res.status(403).json({ error: 'Faculty record not found' });
      isCoordinator = !!fac.rows[0].is_seminar_coordinator;
      if (!isCoordinator && group.guide_id !== fac.rows[0].id) {
        return res.status(403).json({ error: 'You are not the assigned guide for this group' });
      }
    }

    // Check if locked
    const existingMarks = await client.query(
      'SELECT status FROM seminar_marks WHERE group_id = $1',
      [groupId]
    );
    const isAlreadySubmitted = existingMarks.rows.some(m => m.status === 'SUBMITTED' || m.status === 'FINALIZED');
    if (isAlreadySubmitted && !isHod && !isCoordinator) {
      return res.status(403).json({
        error: 'Evaluation is finalized and locked. Contact the Seminar Coordinator or HOD to unlock for modifications.'
      });
    }

    // Helper to validate decimal score with up to 2 decimal places and between 0 and max
    const validateScore = (val, fieldName, prn, isRequired = false) => {
      if (val === undefined || val === null || val === '') {
        if (isRequired && status === 'SUBMITTED') {
          throw new Error(`${fieldName} is required for PRN ${prn} before final submission.`);
        }
        return 0;
      }
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 10) {
        throw new Error(`${fieldName} marks for PRN ${prn} must be between 0 and 10`);
      }
      // Round to 2 decimal places
      return Math.round(num * 100) / 100;
    };

    // Validate marks limits
    for (const m of marks) {
      const att = validateScore(m.attendance_marks, 'Attendance', m.prn, true);
      const pres = validateScore(m.presentation_marks, 'Presentation', m.prn, false);
      const sub = validateScore(m.subject_understanding_marks, 'Subject Understanding', m.prn, false);
      const pub = validateScore(m.publication_marks, 'Publication', m.prn, false);
      const viva = validateScore(m.viva_marks, 'Viva', m.prn, false);

      const total = Math.round((att + pres + sub + pub + viva) * 100) / 100;
      if (total > 50) throw new Error(`Total marks for PRN ${m.prn} exceed maximum of 50`);
    }

    await client.query('BEGIN');

    for (const m of marks) {
      const att = validateScore(m.attendance_marks, 'Attendance', m.prn, true);
      const pres = validateScore(m.presentation_marks, 'Presentation', m.prn, false);
      const sub = validateScore(m.subject_understanding_marks, 'Subject Understanding', m.prn, false);
      const pub = validateScore(m.publication_marks, 'Publication', m.prn, false);
      const viva = validateScore(m.viva_marks, 'Viva', m.prn, false);
      const total = Math.round((att + pres + sub + pub + viva) * 100) / 100;

      const stRes = await client.query(
        `SELECT s.id AS student_id 
         FROM students s 
         LEFT JOIN users u ON s.user_id = u.id 
         WHERE s.enrollment_no = $1 
            OR s.roll_no = $1 
            OR u.email = (SELECT email FROM seminar_group_members WHERE prn = $1 AND group_id = $2 LIMIT 1)
         LIMIT 1`,
        [m.prn, groupId]
      );
      const studentId = stRes.rows[0]?.student_id || null;

      const isSubmitted = status === 'SUBMITTED';
      await client.query(
        `INSERT INTO seminar_marks (
           session_id, group_id, student_id, prn,
           attendance_marks, presentation_marks, subject_understanding_marks, publication_marks, viva_marks,
           total_marks, max_marks,
           status, entered_by, entered_at,
           submitted_at, submitted_by, remarks
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 50, $11, $12, NOW(), $13, $14, $15)
         ON CONFLICT (group_id, prn)
         DO UPDATE SET
           attendance_marks = EXCLUDED.attendance_marks,
           presentation_marks = EXCLUDED.presentation_marks,
           subject_understanding_marks = EXCLUDED.subject_understanding_marks,
           publication_marks = EXCLUDED.publication_marks,
           viva_marks = EXCLUDED.viva_marks,
           total_marks = EXCLUDED.total_marks,
           status = EXCLUDED.status,
           entered_by = EXCLUDED.entered_by,
           entered_at = NOW(),
           submitted_at = CASE WHEN EXCLUDED.status = 'SUBMITTED' THEN NOW() ELSE seminar_marks.submitted_at END,
           submitted_by = CASE WHEN EXCLUDED.status = 'SUBMITTED' THEN EXCLUDED.entered_by ELSE seminar_marks.submitted_by END,
           remarks = COALESCE(EXCLUDED.remarks, seminar_marks.remarks)`,
        [
          group.session_id,
          groupId,
          studentId,
          m.prn,
          att,
          pres,
          sub,
          pub,
          viva,
          total,
          status,
          req.user.id,
          isSubmitted ? new Date() : null,
          isSubmitted ? req.user.id : null,
          m.remarks || overallRemarks || null
        ]
      );
    }

    await client.query('COMMIT');

    await auditRecord({
      tableName: 'seminar_marks',
      recordId: groupId,
      changedBy: req.user.id,
      action: status === 'SUBMITTED' ? 'SUBMIT_SEMINAR_EVALUATION' : 'SAVE_SEMINAR_DRAFT',
      oldValue: null,
      newValue: { groupId, status, studentCount: marks.length },
      reason: `${status === 'SUBMITTED' ? 'Finalized evaluation submitted' : 'Draft marks saved'} for Seminar Group #${group.group_no}`
    });

    res.json({
      message: status === 'SUBMITTED' ? 'Evaluation finalized and submitted successfully' : 'Draft evaluation saved successfully',
      status
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar] POST /groups/:groupId/evaluation:', err.message);
    res.status(400).json({ error: err.message || 'Failed to save evaluation' });
  } finally {
    client.release();
  }
});

// POST /api/seminar/groups/:groupId/marks/unlock (HOD or Coordinator only)
router.post('/groups/:groupId/marks/unlock', verifyToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId, 10);
    const { reason = 'Unlocked for corrections' } = req.body;

    const isHod = req.user.role === 'hod' || req.user.role === 'admin';
    if (!isHod) {
      const fac = await pool.query('SELECT is_seminar_coordinator FROM faculty WHERE user_id = $1', [req.user.id]);
      if (!fac.rows[0]?.is_seminar_coordinator) {
        return res.status(403).json({ error: 'Only HOD or Seminar Coordinator can unlock submitted evaluations' });
      }
    }

    const prevMarks = await pool.query("SELECT COUNT(*) FROM seminar_marks WHERE group_id = $1 AND status = 'SUBMITTED'", [groupId]);
    if (parseInt(prevMarks.rows[0].count, 10) === 0) {
      return res.status(400).json({ error: 'No finalized evaluation found to unlock' });
    }

    await pool.query(
      `UPDATE seminar_marks
       SET status = 'DRAFT', unlocked_at = NOW(), unlocked_by = $1
       WHERE group_id = $2`,
      [req.user.id, groupId]
    );

    await auditRecord({
      tableName: 'seminar_marks',
      recordId: groupId,
      changedBy: req.user.id,
      action: 'UNLOCK_SEMINAR_EVALUATION',
      oldValue: { status: 'SUBMITTED' },
      newValue: { status: 'DRAFT', unlocked_by: req.user.id },
      reason
    });

    res.json({ message: 'Evaluation successfully unlocked. The guide can now edit marks.', status: 'DRAFT' });
  } catch (err) {
    console.error('[Seminar] unlock marks error:', err.message);
    res.status(500).json({ error: 'Failed to unlock evaluation' });
  }
});

// GET /api/seminar/sessions/:id/marks-overview (Coordinator & HOD)
router.get('/sessions/:id/marks-overview', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const r = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, sg.status as approval_status,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              COALESCE(
                (SELECT sm.status FROM seminar_marks sm WHERE sm.group_id = sg.id LIMIT 1),
                'NOT_STARTED'
              ) as marks_status,
              (SELECT COUNT(*) FROM seminar_marks sm WHERE sm.group_id = sg.id) as evaluated_count,
              (SELECT COUNT(*) FROM seminar_group_members m WHERE m.group_id = sg.id) as member_count,
              (SELECT ROUND(AVG(sm.total_marks), 2) FROM seminar_marks sm WHERE sm.group_id = sg.id) as avg_marks,
              (SELECT MAX(sm.submitted_at) FROM seminar_marks sm WHERE sm.group_id = sg.id) as submitted_at,
              (SELECT u2.name FROM seminar_marks sm JOIN users u2 ON sm.submitted_by = u2.id WHERE sm.group_id = sg.id LIMIT 1) as submitted_by_name
       FROM seminar_groups sg
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE sg.session_id = $1
       ORDER BY sg.group_no ASC`,
      [sessionId]
    );
    res.json({ overview: r.rows });
  } catch (err) {
    console.error('[Seminar] marks overview:', err.message);
    res.status(500).json({ error: 'Failed to fetch marks overview' });
  }
});

// GET /api/seminar/sessions/:id/export-marks (Coordinator or HOD)
router.get('/sessions/:id/export-marks', verifyToken, requireCoordinator, async (req, res) => {
  const sessionId = parseInt(req.params.id, 10);
  try {
    const sessRes = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
    if (!sessRes.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessRes.rows[0];

    const r = await pool.query(
      `SELECT sg.group_no, m.prn, m.student_name, m.division,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              sm.attendance_marks, sm.presentation_marks, sm.subject_understanding_marks, sm.publication_marks, sm.viva_marks, sm.total_marks,
              COALESCE(sm.status, 'NOT_STARTED') as marks_status,
              sm.evaluation_date, sm.submitted_at
       FROM seminar_groups sg
       JOIN seminar_group_members m ON m.group_id = sg.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN seminar_marks sm ON (sm.group_id = sg.id AND sm.prn = m.prn)
       WHERE sg.session_id = $1
       ORDER BY sg.group_no ASC, m.member_index ASC`,
      [sessionId]
    );

    const buffer = buildMarksWorkbook(session, r.rows);
    const filename = `${session.name.replace(/[^a-z0-9]/gi, '_')}_Official_Seminar_Marksheet.xlsx`;

    await auditRecord({
      tableName: 'seminar_sessions',
      recordId: sessionId,
      changedBy: req.user.id,
      action: 'EXPORT_SEMINAR_MARKSHEET',
      oldValue: null,
      newValue: { count: r.rows.length, filename },
      reason: 'Exported seminar marksheet'
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Seminar] export-marks error:', err.message);
    res.status(500).json({ error: 'Export marksheet failed' });
  }
});

// GET /api/seminar/student/marks
router.get('/student/marks', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const stRes = await pool.query('SELECT enrollment_no, roll_no FROM students WHERE user_id = $1', [req.user.id]);
    if (!stRes.rows.length) return res.status(404).json({ error: 'Student record not found' });
    const prn = stRes.rows[0].enrollment_no || stRes.rows[0].roll_no;
    
    const marksRes = await pool.query(
      `SELECT sm.*, sg.group_no, sg.domain, sg.guide_name,
              ss.name as session_name, ss.academic_year, ss.batch
       FROM seminar_marks sm
       JOIN seminar_groups sg ON sm.group_id = sg.id
       JOIN seminar_sessions ss ON sm.session_id = ss.id
       WHERE sm.prn = $1 AND sm.status IN ('SUBMITTED', 'FINALIZED')`,
      [prn]
    );
    res.json({ marks: marksRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch marks' });
  }
});

// ─── Seminar Governance & Multi-Stage Evaluation Endpoints (HOD & Coordinator) ──

async function ensureSeminarGovernanceSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seminar_evaluation_stages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        academic_year VARCHAR(20) NOT NULL DEFAULT '2026-27',
        sequence_order INT NOT NULL DEFAULT 1,
        scheduled_date_from DATE,
        scheduled_date_to DATE,
        max_marks_total NUMERIC(6,2) NOT NULL DEFAULT 50,
        aggregation_rule VARCHAR(50) NOT NULL DEFAULT 'AVERAGE',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026-27';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS sequence_order INT DEFAULT 1;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS scheduled_date_from DATE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS scheduled_date_to DATE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS max_marks_total NUMERIC(6,2) DEFAULT 50;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS aggregation_rule VARCHAR(50) DEFAULT 'AVERAGE';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_stage_criteria (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        max_marks NUMERIC(6,2) NOT NULL DEFAULT 10,
        weight NUMERIC(6,2) DEFAULT 1,
        display_order INT DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS max_marks NUMERIC(6,2) DEFAULT 10;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS weight NUMERIC(6,2) DEFAULT 1;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 1;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_assignments (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        group_id INT NOT NULL REFERENCES seminar_groups(id) ON DELETE CASCADE,
        panel_member_id INT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        assigned_by INT REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS group_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS panel_member_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS assigned_by INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ASSIGNED';
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_evaluations (
        id SERIAL PRIMARY KEY,
        assignment_id INT REFERENCES seminar_panel_assignments(id) ON DELETE CASCADE,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        group_id INT NOT NULL REFERENCES seminar_groups(id) ON DELETE CASCADE,
        evaluator_faculty_id INT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        student_prn VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT,
        total_score NUMERIC(6,2) DEFAULT 0,
        evaluated_at TIMESTAMPTZ,
        unlocked_at TIMESTAMPTZ,
        unlocked_by INT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS assignment_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS group_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS evaluator_faculty_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS student_prn VARCHAR(50);
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DRAFT';
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS remarks TEXT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS total_score NUMERIC(6,2) DEFAULT 0;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS unlocked_by INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_evaluation_scores (
        id SERIAL PRIMARY KEY,
        evaluation_id INT NOT NULL REFERENCES seminar_panel_evaluations(id) ON DELETE CASCADE,
        criteria_id INT NOT NULL REFERENCES seminar_stage_criteria(id) ON DELETE CASCADE,
        score NUMERIC(6,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS evaluation_id INT;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS criteria_id INT;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS score NUMERIC(6,2) DEFAULT 0;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_score_releases (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        released_by INT NOT NULL REFERENCES users(id),
        released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );
    `);
  } catch (err) {
    console.error('[Seminar Governance] Schema init error:', err.message);
  }
}
ensureSeminarGovernanceSchema();

/**
 * GET /api/seminar/hod/dashboard
 * Governance analytics and workload metrics.
 */
router.get('/hod/dashboard', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, sg.status, sg.guide_id, sg.seminar_guide_id,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE ss.academic_year = $1`,
      [acadYear]
    );

    const stagesRes = await pool.query(
      `SELECT * FROM seminar_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    const facultyLoadRes = await pool.query(
      `SELECT f.id as faculty_id, u.name, f.designation,
              COUNT(DISTINCT sg.id) as guided_groups,
              COUNT(DISTINCT pa.id) as panel_assignments
       FROM faculty f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN seminar_groups sg ON (sg.guide_id = f.id)
       LEFT JOIN seminar_panel_assignments pa ON pa.panel_member_id = f.id
       GROUP BY f.id, u.name, f.designation
       ORDER BY u.name ASC`
    );

    const domainCount = {};
    groupsRes.rows.forEach(g => {
      const d = g.domain || 'Unspecified';
      domainCount[d] = (domainCount[d] || 0) + 1;
    });

    const domainBreakdown = Object.entries(domainCount).map(([domain, count]) => ({ domain, count }));

    res.json({
      academic_year: acadYear,
      total_groups: groupsRes.rows.length,
      groups: groupsRes.rows,
      stages: stagesRes.rows,
      faculty_load: facultyLoadRes.rows,
      domain_breakdown: domainBreakdown,
    });
  } catch (err) {
    console.error('[Seminar HOD Dashboard Error]', err.message);
    res.status(500).json({ error: 'Failed to load seminar dashboard data' });
  }
});

/**
 * GET /api/seminar/hod/groups
 * List all seminar groups with members, guide info, and stage statuses.
 */
router.get('/hod/groups', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const groupsRes = await pool.query(
      `SELECT sg.*, ss.name as session_name, ss.academic_year, ss.batch,
              f.id as guide_faculty_id, COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              f.designation as guide_designation, u.email as guide_email
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE ss.academic_year = $1
       ORDER BY sg.group_no ASC`,
      [acadYear]
    );

    for (const g of groupsRes.rows) {
      const membersRes = await pool.query(
        `SELECT gm.* FROM seminar_group_members gm WHERE gm.group_id = $1 ORDER BY gm.member_index ASC`,
        [g.id]
      );
      g.members = membersRes.rows;
    }

    res.json(groupsRes.rows);
  } catch (err) {
    console.error('[Seminar HOD Groups Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch seminar groups' });
  }
});

/**
 * PATCH /api/seminar/hod/groups/:id/guide
 * Direct HOD guide assignment.
 */
router.patch('/hod/groups/:id/guide', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { guide_id } = req.body;

    let guideName = 'Unassigned';
    if (guide_id) {
      const facRes = await pool.query(
        `SELECT f.id, u.name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1`,
        [guide_id]
      );
      if (facRes.rows.length === 0) return res.status(404).json({ error: 'Faculty member not found' });
      guideName = facRes.rows[0].name;
    }

    await pool.query(
      `UPDATE seminar_groups SET guide_id = $1, guide_name = $2, status = 'APPROVED' WHERE id = $3`,
      [guide_id || null, guideName, groupId]
    );

    await auditRecord({
      tableName: 'seminar_groups',
      recordId: groupId,
      changedBy: req.user.id,
      action: 'ASSIGN_SEMINAR_GUIDE',
      oldValue: null,
      newValue: { guide_id, guideName },
      reason: `Guide assigned to Group #${groupId} by HOD`,
    });

    res.json({ message: `Guide ${guideName} assigned successfully` });
  } catch (err) {
    console.error('[Seminar Assign Guide Error]', err.message);
    res.status(500).json({ error: 'Failed to assign seminar guide' });
  }
});

/**
 * POST /api/seminar/hod/groups/bulk-approve
 * Bulk approve all awaiting guide allocations for a session or academic year.
 */
router.post('/hod/groups/bulk-approve', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const { academic_year = '2026-27', session_id } = req.body;
    let query = `
      UPDATE seminar_groups sg
      SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
      FROM seminar_sessions ss
      WHERE sg.session_id = ss.id
        AND (sg.guide_id IS NOT NULL OR sg.seminar_guide_id IS NOT NULL)
        AND sg.status = 'AWAITING_HOD_APPROVAL'
    `;
    const params = [req.user.id];
    if (session_id) {
      query += ` AND sg.session_id = $2`;
      params.push(session_id);
    } else {
      query += ` AND ss.academic_year = $2`;
      params.push(academic_year);
    }
    query += ` RETURNING sg.id`;

    const result = await pool.query(query, params);
    
    await auditRecord({
      tableName: 'seminar_groups',
      recordId: 0,
      changedBy: req.user.id,
      action: 'BULK_APPROVE_SEMINAR_GUIDES',
      oldValue: null,
      newValue: { count: result.rows.length, ids: result.rows.map(r => r.id) },
      reason: `HOD bulk approved ${result.rows.length} seminar guide allocations`,
    });

    res.json({ message: `Successfully approved ${result.rows.length} seminar guide allocation(s)`, count: result.rows.length });
  } catch (err) {
    console.error('[Seminar Bulk Approve Error]', err.message);
    res.status(500).json({ error: 'Failed to bulk approve seminar groups' });
  }
});

/**
 * GET /api/seminar/hod/marks
 * Read-only list of all student marks entered by faculty for the academic year.
 */
router.get('/hod/marks', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const r = await pool.query(
      `SELECT sg.id as group_id, sg.group_no, sg.domain, sg.status as approval_status,
              m.id as member_id, m.prn, m.student_name, m.division, m.topic1,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              f.designation as guide_designation,
              sm.id as marks_id,
              COALESCE(sm.attendance_marks, 0) as attendance_marks,
              COALESCE(sm.presentation_marks, 0) as presentation_marks,
              COALESCE(sm.subject_understanding_marks, 0) as subject_understanding_marks,
              COALESCE(sm.publication_marks, 0) as publication_marks,
              COALESCE(sm.viva_marks, 0) as viva_marks,
              COALESCE(sm.total_marks, 0) as total_marks,
              COALESCE(sm.status, 'NOT_STARTED') as marks_status,
              sm.evaluation_date,
              sm.submitted_at,
              sm.remarks,
              u2.name as evaluated_by_name
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       JOIN seminar_group_members m ON m.group_id = sg.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN seminar_marks sm ON (sm.group_id = sg.id AND sm.prn = m.prn)
       LEFT JOIN users u2 ON sm.submitted_by = u2.id
       WHERE ss.academic_year = $1
       ORDER BY sg.group_no ASC, m.member_index ASC`,
      [acadYear]
    );

    res.json(r.rows);
  } catch (err) {
    console.error('[Seminar HOD Marks Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch seminar marks' });
  }
});

/**
 * GET /api/seminar/hod/stages
 * Evaluation stages and criteria.
 */
router.get('/hod/stages', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const stagesRes = await pool.query(
      `SELECT * FROM seminar_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    for (const st of stagesRes.rows) {
      const critRes = await pool.query(
        `SELECT * FROM seminar_stage_criteria WHERE stage_id = $1 ORDER BY id ASC`,
        [st.id]
      );
      st.criteria = critRes.rows;

      const relRes = await pool.query(
        `SELECT * FROM seminar_score_releases WHERE stage_id = $1`,
        [st.id]
      );
      st.is_released = relRes.rows.length > 0;
    }

    res.json(stagesRes.rows);
  } catch (err) {
    console.error('[Seminar Stages Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
});

/**
 * POST /api/seminar/hod/stages
 * Create or update evaluation stage with criteria.
 */
router.post('/hod/stages', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, name, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, academic_year = '2026-27', criteria = [] } = req.body;

    if (!name) return res.status(400).json({ error: 'Stage name is required' });

    await client.query('BEGIN');

    let stageId = id;
    if (id) {
      await client.query(
        `UPDATE seminar_evaluation_stages
         SET name = $1, sequence_order = $2, scheduled_date_from = $3, scheduled_date_to = $4,
             max_marks_total = $5, aggregation_rule = $6, updated_at = NOW()
         WHERE id = $7`,
        [name, sequence_order || 1, scheduled_date_from || null, scheduled_date_to || null, max_marks_total || 50, aggregation_rule || 'AVERAGE', id]
      );
      await client.query(`DELETE FROM seminar_stage_criteria WHERE stage_id = $1`, [id]);
    } else {
      const insRes = await client.query(
        `INSERT INTO seminar_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [name, academic_year, sequence_order || 1, scheduled_date_from || null, scheduled_date_to || null, max_marks_total || 50, aggregation_rule || 'AVERAGE']
      );
      stageId = insRes.rows[0].id;
    }

    for (const c of criteria) {
      if (c.name && c.max_marks > 0) {
        await client.query(
          `INSERT INTO seminar_stage_criteria (stage_id, name, max_marks) VALUES ($1, $2, $3)`,
          [stageId, c.name, c.max_marks]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Stage saved successfully', stage_id: stageId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar Stage Save Error]', err.message);
    res.status(500).json({ error: 'Failed to save stage' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/seminar/hod/stages/:id
 */
router.delete('/hod/stages/:id', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM seminar_evaluation_stages WHERE id = $1', [id]);
    res.json({ message: 'Stage deleted successfully' });
  } catch (err) {
    console.error('[Seminar Stage Delete Error]', err.message);
    res.status(500).json({ error: 'Failed to delete stage' });
  }
});

/**
 * GET /api/seminar/hod/panel-matrix
 * Panel examiner assignments matrix.
 */
router.get('/hod/panel-matrix', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const { stage_id, academic_year = '2026-27' } = req.query;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const groupsRes = await pool.query(
      `SELECT sg.id as group_id, sg.group_no, sg.domain,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              f.id as guide_faculty_id
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE ss.academic_year = $1
       ORDER BY sg.group_no ASC`,
      [academic_year]
    );

    const matrix = [];
    for (const grp of groupsRes.rows) {
      const panelRes = await pool.query(
        `SELECT pa.id as assignment_id, pa.panel_member_id, u.name as panel_member_name, f.designation,
                COALESCE(pe.status, 'PENDING') as eval_status,
                COALESCE((SELECT SUM(marks_awarded) FROM seminar_panel_evaluation_scores WHERE evaluation_id = pe.id), 0) as total_score,
                pe.id as evaluation_id
         FROM seminar_panel_assignments pa
         JOIN faculty f ON pa.panel_member_id = f.id
         JOIN users u ON f.user_id = u.id
         LEFT JOIN seminar_panel_evaluations pe ON pe.panel_assignment_id = pa.id
         WHERE pa.stage_id = $1 AND pa.group_id = $2`,
        [stage_id, grp.group_id]
      );

      matrix.push({
        group_id: grp.group_id,
        group_no: grp.group_no,
        domain: grp.domain,
        guide_name: grp.guide_name,
        guide_faculty_id: grp.guide_faculty_id,
        panel_members: panelRes.rows.map(p => ({
          faculty_id: p.panel_member_id,
          faculty_name: p.panel_member_name,
          designation: p.designation,
          status: p.eval_status,
          total_score: p.total_score,
          assignment_id: p.assignment_id,
        })),
        panelists: panelRes.rows,
      });
    }

    res.json(matrix);
  } catch (err) {
    console.error('[Seminar Panel Matrix Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch panel matrix' });
  }
});

/**
 * POST /api/seminar/hod/panel-matrix
 * Manual assignment of panel members for a group.
 */
router.post('/hod/panel-matrix', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { stage_id, group_id, panel_member_ids = [] } = req.body;
    if (!stage_id || !group_id) {
      return res.status(400).json({ error: 'stage_id and group_id are required' });
    }

    await client.query('BEGIN');
    await client.query(
      `DELETE FROM seminar_panel_assignments WHERE stage_id = $1 AND group_id = $2`,
      [stage_id, group_id]
    );

    for (const pid of panel_member_ids) {
      await client.query(
        `INSERT INTO seminar_panel_assignments (stage_id, group_id, panel_member_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [stage_id, group_id, pid, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Panel assignments updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar Panel Save Error]', err.message);
    res.status(500).json({ error: 'Failed to save panel assignments' });
  } finally {
    client.release();
  }
});

/**
 * Handler: Auto-assign panel examiners with automatic guide COI exclusion.
 */
async function handleAutoAssignPanels(req, res) {
  const client = await pool.connect();
  try {
    const { stage_id, academic_year = '2026-27', panel_size = 2 } = req.body;
    if (!stage_id) return res.status(400).json({ error: 'stage_id is required' });

    const groupsRes = await pool.query(
      `SELECT sg.id, sg.guide_id, sem_g.faculty_id as seminar_guide_faculty_id
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       WHERE ss.academic_year = $1`,
      [academic_year]
    );

    const facultyRes = await pool.query(`SELECT id FROM faculty ORDER BY id ASC`);
    const allFaculty = facultyRes.rows;

    if (allFaculty.length < panel_size) {
      return res.status(400).json({ error: `At least ${panel_size} faculty members are required` });
    }

    const workload = {};
    allFaculty.forEach(f => { workload[f.id] = 0; });

    await client.query('BEGIN');
    await client.query(`DELETE FROM seminar_panel_assignments WHERE stage_id = $1`, [stage_id]);

    let assignedCount = 0;
    for (const grp of groupsRes.rows) {
      const guideId = grp.guide_id || grp.seminar_guide_faculty_id;
      // Exclude guide to prevent conflict of interest
      const eligible = allFaculty.filter(f => f.id !== guideId);
      eligible.sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));

      const selected = eligible.slice(0, panel_size);
      for (const p of selected) {
        await client.query(
          `INSERT INTO seminar_panel_assignments (stage_id, group_id, panel_member_id, assigned_by)
           VALUES ($1, $2, $3, $4)`,
          [stage_id, grp.id, p.id, req.user.id]
        );
        workload[p.id] = (workload[p.id] || 0) + 1;
      }
      assignedCount++;
    }

    await client.query('COMMIT');
    res.json({ message: `Successfully auto-assigned panels for ${assignedCount} seminar groups!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar Auto Assign Error]', err.message);
    res.status(500).json({ error: 'Failed to auto-assign panels' });
  } finally {
    client.release();
  }
}

router.post('/hod/panel-matrix/auto-assign', verifyToken, requireRole('hod'), handleAutoAssignPanels);
router.post('/hod/panel-auto-assign', verifyToken, requireRole('hod'), handleAutoAssignPanels);

/**
 * Handler: Copy panel assignments from source stage to target stage.
 */
async function handleCopyStagePanels(req, res) {
  const client = await pool.connect();
  try {
    const { source_stage_id, target_stage_id } = req.body;
    if (!source_stage_id || !target_stage_id) {
      return res.status(400).json({ error: 'source_stage_id and target_stage_id are required' });
    }

    await client.query('BEGIN');
    const sourceRes = await client.query(
      `SELECT group_id, panel_member_id FROM seminar_panel_assignments WHERE stage_id = $1`,
      [source_stage_id]
    );

    if (sourceRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No panel assignments found in source stage' });
    }

    await client.query(`DELETE FROM seminar_panel_assignments WHERE stage_id = $1`, [target_stage_id]);

    for (const r of sourceRes.rows) {
      await client.query(
        `INSERT INTO seminar_panel_assignments (stage_id, group_id, panel_member_id, assigned_by)
         VALUES ($1, $2, $3, $4)`,
        [target_stage_id, r.group_id, r.panel_member_id, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Successfully copied ${sourceRes.rows.length} panel assignments!` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar Copy Panel Error]', err.message);
    res.status(500).json({ error: 'Failed to copy panel assignments' });
  } finally {
    client.release();
  }
}

router.post('/hod/panel-matrix/copy', verifyToken, requireRole('hod'), handleCopyStagePanels);
router.post('/hod/panel-copy-stage', verifyToken, requireRole('hod'), handleCopyStagePanels);

/**
 * GET /api/seminar/evaluator/assignments
 * Get assigned seminar groups for the logged in faculty examiner.
 */
router.get('/evaluator/assignments', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  try {
    const facRes = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [req.user.id]);
    if (facRes.rows.length === 0) return res.status(404).json({ error: 'Faculty record not found' });
    const facultyId = facRes.rows[0].id;

    const assignRes = await pool.query(
      `SELECT pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
              st.id as stage_id, st.name as stage_name, st.sequence_order, st.max_marks_total,
              sg.id as group_id, sg.group_no, sg.domain,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name,
              pe.id as evaluation_id, COALESCE(pe.status, 'PENDING') as evaluation_status,
              COALESCE((SELECT SUM(marks_awarded) FROM seminar_panel_evaluation_scores WHERE evaluation_id = pe.id), 0) as total_score
       FROM seminar_panel_assignments pa
       JOIN seminar_evaluation_stages st ON pa.stage_id = st.id
       JOIN seminar_groups sg ON pa.group_id = sg.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN seminar_panel_evaluations pe ON pe.panel_assignment_id = pa.id
       WHERE pa.panel_member_id = $1
       ORDER BY st.sequence_order ASC, sg.group_no ASC`,
      [facultyId]
    );

    for (const row of assignRes.rows) {
      const memRes = await pool.query(
        `SELECT student_name, prn, division FROM seminar_group_members WHERE group_id = $1 ORDER BY member_index ASC`,
        [row.group_id]
      );
      row.members = memRes.rows;
    }

    res.json(assignRes.rows);
  } catch (err) {
    console.error('[Seminar Evaluator Assignments Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch examiner assignments' });
  }
});

/**
 * GET /api/seminar/evaluations/:assignmentId
 * Evaluation rubric form details for a seminar panel assignment.
 */
router.get('/evaluations/:assignmentId', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    const assignRes = await pool.query(
      `SELECT pa.*, st.name as stage_name, st.max_marks_total,
              sg.group_no, sg.domain,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name
       FROM seminar_panel_assignments pa
       JOIN seminar_evaluation_stages st ON pa.stage_id = st.id
       JOIN seminar_groups sg ON pa.group_id = sg.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE pa.id = $1`,
      [assignmentId]
    );

    if (assignRes.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    const assign = assignRes.rows[0];

    const criteriaRes = await pool.query(
      `SELECT * FROM seminar_stage_criteria WHERE stage_id = $1 ORDER BY id ASC`,
      [assign.stage_id]
    );

    const memRes = await pool.query(
      `SELECT student_name, prn, division FROM seminar_group_members WHERE group_id = $1 ORDER BY member_index ASC`,
      [assign.group_id]
    );

    const evalRes = await pool.query(
      `SELECT * FROM seminar_panel_evaluations WHERE panel_assignment_id = $1`,
      [assignmentId]
    );

    res.json({
      assignment: assign,
      criteria: criteriaRes.rows,
      members: memRes.rows,
      evaluation: evalRes.rows[0] || null,
    });
  } catch (err) {
    console.error('[Seminar Evaluation Form Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch evaluation form' });
  }
});

/**
 * POST /api/seminar/evaluations and POST /api/seminar/evaluations/:assignmentId
 * Submit scores for a seminar panel assignment.
 */
async function handleEvaluationSubmit(req, res) {
  const client = await pool.connect();
  try {
    const assignmentId = parseInt(req.params.assignmentId || req.body.panel_assignment_id || req.body.assignment_id, 10);
    const { scores = [], remarks, status = 'SUBMITTED' } = req.body;

    if (!assignmentId) return res.status(400).json({ error: 'panel_assignment_id is required' });

    const assignRes = await client.query(
      `SELECT * FROM seminar_panel_assignments WHERE id = $1`,
      [assignmentId]
    );
    if (assignRes.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

    let totalScore = 0;
    scores.forEach(s => {
      totalScore += parseFloat(s.marks_awarded || s.score || 0);
    });

    await client.query('BEGIN');

    let evalId;
    const prevEval = await client.query(
      `SELECT id FROM seminar_panel_evaluations WHERE panel_assignment_id = $1`,
      [assignmentId]
    );

    if (prevEval.rows.length > 0) {
      evalId = prevEval.rows[0].id;
      await client.query(
        `UPDATE seminar_panel_evaluations
         SET status = $1, overall_remarks = $2, submitted_at = NOW()
         WHERE id = $3`,
        [status, remarks || '', evalId]
      );
      await client.query(`DELETE FROM seminar_panel_evaluation_scores WHERE evaluation_id = $1`, [evalId]);
    } else {
      const insEval = await client.query(
        `INSERT INTO seminar_panel_evaluations (panel_assignment_id, status, overall_remarks, submitted_at)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [assignmentId, status, remarks || '']
      );
      evalId = insEval.rows[0].id;
    }

    for (const sc of scores) {
      const cId = sc.criterion_id || sc.criteria_id;
      const scoreVal = parseFloat(sc.marks_awarded || sc.score || 0);
      if (cId) {
        await client.query(
          `INSERT INTO seminar_panel_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark)
           VALUES ($1, $2, $3, $4)`,
          [evalId, cId, scoreVal, sc.remark || '']
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Evaluation submitted successfully', totalScore });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seminar Evaluation Submit Error]', err.message);
    res.status(500).json({ error: 'Failed to submit evaluation' });
  } finally {
    client.release();
  }
}

router.post('/evaluations/:assignmentId', verifyToken, requireRole('faculty', 'hod'), handleEvaluationSubmit);
router.post('/evaluations', verifyToken, requireRole('faculty', 'hod'), handleEvaluationSubmit);

/**
 * GET /api/seminar/hod/evaluations/progress
 */
router.get('/hod/evaluations/progress', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const evalsRes = await pool.query(
      `SELECT pe.id as eval_id, pa.stage_id, pa.group_id, pa.panel_member_id as evaluator_faculty_id, pe.status,
              COALESCE((SELECT SUM(marks_awarded) FROM seminar_panel_evaluation_scores WHERE evaluation_id = pe.id), 0) as total_score,
              pe.submitted_at as evaluated_at, pe.unlocked_at,
              st.name as stage_name, sg.group_no, sg.domain,
              u.name as evaluator_name, f.designation as evaluator_designation
       FROM seminar_panel_evaluations pe
       JOIN seminar_panel_assignments pa ON pe.panel_assignment_id = pa.id
       JOIN seminar_evaluation_stages st ON pa.stage_id = st.id
       JOIN seminar_groups sg ON pa.group_id = sg.id
       JOIN faculty f ON pa.panel_member_id = f.id
       JOIN users u ON f.user_id = u.id
       WHERE st.academic_year = $1
       ORDER BY st.sequence_order ASC, sg.group_no ASC`,
      [acadYear]
    );

    res.json(evalsRes.rows);
  } catch (err) {
    console.error('[Seminar Progress Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch evaluation progress' });
  }
});

/**
 * POST /api/seminar/hod/evaluations/:id/unlock
 */
router.post('/hod/evaluations/:id/unlock', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    const { reason = 'Unlocked for corrections' } = req.body;

    await pool.query(
      `UPDATE seminar_panel_evaluations SET status = 'DRAFT', is_unlocked = TRUE, unlocked_at = NOW(), unlocked_by = $1, unlock_reason = $2 WHERE id = $3`,
      [req.user.id, reason, evalId]
    );

    await auditRecord({
      tableName: 'seminar_panel_evaluations',
      recordId: evalId,
      changedBy: req.user.id,
      action: 'UNLOCK_SEMINAR_EVALUATION',
      oldValue: { status: 'SUBMITTED' },
      newValue: { status: 'DRAFT', unlocked_by: req.user.id },
      reason,
    });

    res.json({ message: 'Evaluation successfully unlocked for corrections' });
  } catch (err) {
    console.error('[Seminar Unlock Error]', err.message);
    res.status(500).json({ error: 'Failed to unlock evaluation' });
  }
});

/**
 * POST /api/seminar/hod/stages/:id/release
 */
router.post('/hod/stages/:id/release', verifyToken, requireRole('hod'), async (req, res) => {
  try {
    const stageId = parseInt(req.params.id, 10);
    const { notes } = req.body;

    await pool.query(
      `INSERT INTO seminar_score_releases (stage_id, released_by, released_at) VALUES ($1, $2, NOW())`,
      [stageId, req.user.id]
    );

    await auditRecord({
      tableName: 'seminar_score_releases',
      recordId: stageId,
      changedBy: req.user.id,
      action: 'RELEASE_SEMINAR_STAGE_SCORES',
      oldValue: null,
      newValue: { stageId, notes },
      reason: 'Stage scores released to students',
    });

    res.json({ message: 'Stage scores have been published and released to students!' });
  } catch (err) {
    console.error('[Seminar Release Error]', err.message);
    res.status(500).json({ error: 'Failed to release scores' });
  }
});

/**
 * GET /api/seminar/hod/reports/export
 */
router.get('/hod/reports/export', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const acadYear = req.query.academic_year || '2026-27';

    const stagesRes = await pool.query(
      `SELECT id, name, sequence_order FROM seminar_evaluation_stages WHERE academic_year = $1 ORDER BY sequence_order ASC`,
      [acadYear]
    );

    const groupsRes = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain,
              COALESCE(sg.guide_name, sem_g.guide_name, u.name, 'Unassigned') as guide_name
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
       LEFT JOIN faculty f ON (sg.guide_id = f.id OR sem_g.faculty_id = f.id)
       LEFT JOIN users u ON f.user_id = u.id
       WHERE ss.academic_year = $1
       ORDER BY sg.group_no ASC`,
      [acadYear]
    );

    const data = [];
    for (const grp of groupsRes.rows) {
      const stageScores = {};
      let totalAll = 0;

      for (const st of stagesRes.rows) {
        const evalsRes = await pool.query(
          `SELECT AVG(sub.score_sum) as avg_score FROM (
             SELECT pe.id, SUM(sc.marks_awarded) as score_sum
             FROM seminar_panel_evaluations pe
             JOIN seminar_panel_assignments pa ON pe.panel_assignment_id = pa.id
             JOIN seminar_panel_evaluation_scores sc ON sc.evaluation_id = pe.id
             WHERE pa.stage_id = $1 AND pa.group_id = $2 AND pe.status = 'SUBMITTED'
             GROUP BY pe.id
           ) sub`,
          [st.id, grp.id]
        );
        const avg = evalsRes.rows[0]?.avg_score ? Number(evalsRes.rows[0].avg_score).toFixed(2) : 'N/A';
        stageScores[st.name] = avg;
        if (avg !== 'N/A') totalAll += Number(avg);
      }

      data.push({
        group_no: grp.group_no,
        domain: grp.domain,
        guide_name: grp.guide_name,
        ...stageScores,
        total_aggregate: totalAll.toFixed(2),
      });
    }

    res.json({
      stages: stagesRes.rows.map(s => s.name),
      data,
    });
  } catch (err) {
    console.error('[Seminar Reports Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch seminar report data' });
  }
});

module.exports = router;


