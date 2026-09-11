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
const { buildWorkbook, getExportLifecycleLabel } = require('../services/seminarExporter');

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

function requireCoordinator(req, res, next) {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'hod' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Faculty or HOD access required' });
}

async function getFacultyId(userId) {
  const r = await pool.query('SELECT id FROM faculty WHERE user_id = $1', [userId]);
  return r.rows[0]?.id ?? null;
}

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

    res.json({
      hasSession: true,
      session,
      hasSubmission: true,
      group,
      members: membersRes.rows,
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
      `SELECT sg.id, sg.group_no, sg.domain,
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

// GET /api/seminar/my-groups  — guide sees only their own groups (any published session)
router.get('/my-groups', verifyToken, requireRole('faculty', 'hod'), async (req, res) => {
  try {
    const fid = await getFacultyId(req.user.id);
    if (!fid) return res.status(404).json({ error: 'Faculty record not found' });
    const r = await pool.query(
      `SELECT sg.id, sg.group_no, sg.domain, ss.name as session_name, ss.academic_year, ss.batch,
              json_agg(json_build_object('name',m.student_name,'prn',m.prn,'division',m.division,'mobile',m.mobile,'email',m.email,'topic1',m.topic1,'topic2',m.topic2,'topic3',m.topic3,'is_leader',m.is_leader) ORDER BY m.member_index) as members
       FROM seminar_groups sg
       JOIN seminar_sessions ss ON sg.session_id = ss.id
       LEFT JOIN seminar_group_members m ON m.group_id = sg.id
       WHERE sg.guide_id = $1 AND ss.status = 'PUBLISHED'
       GROUP BY sg.id, sg.group_no, sg.domain, ss.name, ss.academic_year, ss.batch
       ORDER BY ss.id DESC, sg.group_no ASC`,
      [fid]
    );
    res.json({ groups: r.rows });
  } catch (err) {
    console.error('[Seminar] my-groups:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ─── Audit trail ─────────────────────────────────────────────────────────────

// GET /api/seminar/sessions/:id/audit
router.get('/sessions/:id/audit', verifyToken, requireCoordinator, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    // Gather group IDs for this session
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

module.exports = router;
