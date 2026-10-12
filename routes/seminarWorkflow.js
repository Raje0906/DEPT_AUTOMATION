'use strict';

const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const {
  validateAndParseFile,
  getSheetPreviewAndRows,
  detectHeaderRow,
  autoMapColumns,
  buildAndCleanGroups,
  suggestGuideAssignments,
  generateWorkflowExcel,
} = require('../services/seminarWorkflowService');

const router = express.Router();

// Multer memory storage: file never touches disk, strictly max 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// In-memory cache for parsed upload sessions (keyed by sessionId)
// Stores buffer & parsed workbook temporarily during the session so re-parsing doesn't require re-upload
const uploadSessionCache = new Map();

// ─── Coordinator Auth Middleware (Strict 403 on every endpoint) ───────────────
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
      console.error('[SeminarWorkflow] Coordinator check error:', e.message);
    }
  }
  return res.status(403).json({
    error: 'Access restricted: Only the designated Seminar Coordinator or HOD can access this workflow.',
  });
}

// All workflow routes require token and coordinator role
router.use(verifyToken, requireCoordinator);

// ─── Session Helpers ──────────────────────────────────────────────────────────
// GET /api/seminar/workflow/sessions — list available seminar sessions (default to active)
router.get('/sessions', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM seminar_groups sg WHERE sg.session_id = s.id) AS group_count,
             (SELECT COUNT(*) FROM seminar_group_members sgm JOIN seminar_groups sg ON sgm.group_id = sg.id WHERE sg.session_id = s.id) AS student_count
      FROM seminar_sessions s
      ORDER BY (CASE WHEN s.status != 'PUBLISHED' AND NOT s.is_locked THEN 1 WHEN NOT s.is_locked THEN 2 ELSE 3 END) ASC, s.created_at DESC
    `);
    const active = r.rows.find(s => s.status !== 'PUBLISHED' && !s.is_locked) || r.rows[0] || null;
    res.json({ sessions: r.rows, activeSessionId: active?.id || null });
  } catch (err) {
    console.error('[SeminarWorkflow] GET sessions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ─── Step 1: Upload & Sheet Detection ─────────────────────────────────────────
// POST /api/seminar/workflow/:sessionId/upload
router.post('/:sessionId/upload', upload.single('file'), async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a .xlsx or .csv file exported from Google Forms.' });
  }

  try {
    const { wb, sheetStats, defaultSheet } = validateAndParseFile(
      req.file.buffer,
      req.file.originalname,
      req.file.size
    );

    // Cache the workbook in memory for subsequent mapping steps
    uploadSessionCache.set(sessionId, {
      wb,
      filename: req.file.originalname,
      uploadedAt: new Date(),
    });

    // Extract default sheet rows
    const { previewRows, totalRows } = getSheetPreviewAndRows(wb, defaultSheet, 5);

    res.json({
      success: true,
      filename: req.file.originalname,
      sheetStats,
      selectedSheet: defaultSheet,
      previewRows,
      totalRows,
    });
  } catch (err) {
    console.error('[SeminarWorkflow] Upload error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/seminar/workflow/:sessionId/sheet-preview?sheetName=...
router.get('/:sessionId/sheet-preview', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const sheetName = req.query.sheetName;
  const cached = uploadSessionCache.get(sessionId);
  if (!cached || !cached.wb) {
    return res.status(400).json({ error: 'No active upload found. Please upload a file first.' });
  }

  try {
    const { previewRows, totalRows } = getSheetPreviewAndRows(cached.wb, sheetName, 5);
    res.json({ sheetName, previewRows, totalRows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Step 2: Auto Column Mapping & Templates ──────────────────────────────────
// GET /api/seminar/workflow/templates — get saved mapping templates
router.get('/templates', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM seminar_mapping_templates ORDER BY updated_at DESC');
    res.json({ templates: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/seminar/workflow/templates — save a mapping template
router.post('/templates', async (req, res) => {
  const { name, template_key, mapping } = req.body;
  if (!name || !mapping) {
    return res.status(400).json({ error: 'Template name and mapping are required' });
  }
  const key = template_key || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  try {
    const r = await pool.query(`
      INSERT INTO seminar_mapping_templates (name, template_key, mapping, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (template_key) DO UPDATE SET name = EXCLUDED.name, mapping = EXCLUDED.mapping, updated_at = NOW()
      RETURNING *
    `, [name.trim(), key, JSON.stringify(mapping)]);
    res.json({ template: r.rows[0] });
  } catch (err) {
    console.error('[SeminarWorkflow] save template error:', err.message);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// POST /api/seminar/workflow/:sessionId/detect-columns
router.post('/:sessionId/detect-columns', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { sheetName, templateKey } = req.body;
  const cached = uploadSessionCache.get(sessionId);
  if (!cached || !cached.wb) {
    return res.status(400).json({ error: 'No active upload found. Please upload a file first.' });
  }

  try {
    const targetSheet = sheetName || cached.wb.SheetNames[0];
    const { rows } = getSheetPreviewAndRows(cached.wb, targetSheet);
    if (rows.length === 0) {
      return res.status(400).json({ error: `Sheet "${targetSheet}" is empty.` });
    }

    const headerRowIdx = detectHeaderRow(rows);
    const headers = rows[headerRowIdx] || [];

    // Check if template mapping requested
    let savedTemplate = null;
    if (templateKey) {
      const tmplRes = await pool.query('SELECT mapping FROM seminar_mapping_templates WHERE template_key = $1', [templateKey]);
      if (tmplRes.rows.length) savedTemplate = tmplRes.rows[0].mapping;
    }

    const autoResult = autoMapColumns(headers, savedTemplate);

    res.json({
      headerRowIndex: headerRowIdx,
      headers,
      ...autoResult,
    });
  } catch (err) {
    console.error('[SeminarWorkflow] detect-columns error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── Step 3: Review, Data Cleaning & Transactional Import ─────────────────────
// POST /api/seminar/workflow/:sessionId/preview-groups
router.post('/:sessionId/preview-groups', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { sheetName, headerRowIndex, mapping, memberCount } = req.body;
  const cached = uploadSessionCache.get(sessionId);
  if (!cached || !cached.wb) {
    return res.status(400).json({ error: 'No active upload found. Please upload a file first.' });
  }

  try {
    const targetSheet = sheetName || cached.wb.SheetNames[0];
    const { rows } = getSheetPreviewAndRows(cached.wb, targetSheet);

    // Fetch existing session groups for cross-registration conflict check
    const existRes = await pool.query(`
      SELECT sg.id, sg.group_no, json_agg(json_build_object('student_name', m.student_name, 'prn', m.prn)) as members
      FROM seminar_groups sg
      LEFT JOIN seminar_group_members m ON m.group_id = sg.id
      WHERE sg.session_id = $1
      GROUP BY sg.id, sg.group_no
      ORDER BY sg.group_no ASC
    `, [sessionId]);

    const existingGroups = existRes.rows || [];
    const maxExistingGroupNo = existingGroups.reduce((max, g) => Math.max(max, g.group_no || 0), 0);
    const startingGroupNo = maxExistingGroupNo + 1;

    const result = buildAndCleanGroups(rows, headerRowIndex || 0, mapping, {
      existingSessionGroups: existingGroups,
      startingGroupNo,
      memberCount: memberCount || 4,
    });

    res.json({
      success: true,
      existingGroupCount: existingGroups.length,
      ...result,
    });
  } catch (err) {
    console.error('[SeminarWorkflow] preview-groups error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/seminar/workflow/:sessionId/commit — Confirm import
router.post('/:sessionId/commit', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { mode = 'ADD', confirmationText, groups, overrides = [] } = req.body;

  if (!Array.isArray(groups) || groups.length === 0) {
    return res.status(400).json({ error: 'No groups provided for import.' });
  }

  // Validate session exists and coordinator authorization
  const sessRes = await pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]);
  if (!sessRes.rows.length) {
    return res.status(404).json({ error: 'Seminar session not found.' });
  }
  const session = sessRes.rows[0];

  // If REPLACE mode, require typed confirmation "REPLACE"
  if (mode === 'REPLACE') {
    if (String(confirmationText || '').trim().toUpperCase() !== 'REPLACE') {
      return res.status(400).json({
        error: 'Confirmation required: Type "REPLACE" to replace all existing groups in this session.',
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let deletedExistingCount = 0;
    if (mode === 'REPLACE') {
      // Delete existing groups strictly scoped to this sessionId only
      const delRes = await client.query('DELETE FROM seminar_groups WHERE session_id = $1 RETURNING id', [sessionId]);
      deletedExistingCount = delRes.rows.length;
    }

    let insertedGroupsCount = 0;
    let insertedStudentsCount = 0;
    let skippedDuplicateGroups = 0;

    // Load existing group signatures in session for idempotency
    const existingGroupSignatures = new Map();
    const curGroups = await client.query(`
      SELECT sg.id, sg.group_no, json_agg(UPPER(TRIM(m.prn))) as prns
      FROM seminar_groups sg
      LEFT JOIN seminar_group_members m ON m.group_id = sg.id
      WHERE sg.session_id = $1
      GROUP BY sg.id, sg.group_no
    `, [sessionId]);

    curGroups.rows.forEach(cg => {
      const sortedPrns = (cg.prns || []).filter(Boolean).sort().join('|');
      if (sortedPrns) existingGroupSignatures.set(sortedPrns, cg.id);
    });

    for (const group of groups) {
      const validMemberPrns = (group.members || [])
        .map(m => (m.prn || '').toUpperCase().trim())
        .filter(Boolean)
        .sort()
        .join('|');

      // Idempotency: if group with identical set of student PRNs already exists in this session, skip
      if (validMemberPrns && existingGroupSignatures.has(validMemberPrns)) {
        skippedDuplicateGroups++;
        continue;
      }

      // Insert seminar_groups
      const insGrp = await client.query(`
        INSERT INTO seminar_groups (
          session_id, group_no, domain, domain_raw, guide_name, guide_id, seminar_guide_id,
          source_row_index, status, submitted_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_GUIDE_ASSIGNMENT', NOW(), NOW(), NOW())
        ON CONFLICT (session_id, group_no) DO UPDATE SET
          domain = EXCLUDED.domain,
          domain_raw = EXCLUDED.domain_raw,
          guide_name = COALESCE(seminar_groups.guide_name, EXCLUDED.guide_name),
          updated_at = NOW()
        RETURNING id
      `, [
        sessionId,
        group.group_no,
        group.domain || 'General Computing',
        group.domain_raw || null,
        group.guide_name || null,
        group.guide_id || null,
        group.seminar_guide_id || null,
        group.source_row_index || null,
      ]);

      const groupId = insGrp.rows[0].id;
      insertedGroupsCount++;

      // Insert members
      const members = group.members || [];
      for (const m of members) {
        await client.query(`
          INSERT INTO seminar_group_members (
            group_id, member_index, student_name, prn, prn_status, division, mobile, email,
            topic1, topic2, topic3, is_leader
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          groupId,
          m.member_index,
          m.name,
          m.prn || `TEMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          m.prn_status || 'valid',
          m.division || 'TE1',
          m.mobile || null,
          m.email || null,
          m.topic1 || null,
          m.topic2 || null,
          m.topic3 || null,
          Boolean(m.is_leader),
        ]);
        insertedStudentsCount++;
      }

      // Record surrogate registration entry
      await client.query(`
        INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
        VALUES ($1, $2, $3, NOW(), 'REGISTERED')
        ON CONFLICT (group_id, seminar_id) DO NOTHING
      `, [groupId, sessionId, req.user.id]);
    }

    // Persist any issue overrides/acknowledgements
    if (Array.isArray(overrides)) {
      for (const ov of overrides) {
        if (ov.issueKey) {
          await client.query(`
            INSERT INTO seminar_issue_overrides (session_id, issue_key, acknowledged_by, note)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (session_id, issue_key) DO UPDATE SET note = EXCLUDED.note
          `, [sessionId, ov.issueKey, req.user.id, ov.note || 'Acknowledged by coordinator']);
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      mode,
      deletedExistingCount,
      insertedGroupsCount,
      insertedStudentsCount,
      skippedDuplicateGroups,
      message: `Successfully imported ${insertedGroupsCount} groups (${insertedStudentsCount} students).`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SeminarWorkflow] Commit import failed:', err.message);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  } finally {
    client.release();
  }
});

// ─── Step 4: Guide Master List & Assignments ──────────────────────────────────
// GET /api/seminar/workflow/:sessionId/guides
router.get('/:sessionId/guides', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  try {
    const r = await pool.query(`
      SELECT sg.id, sg.session_id, sg.faculty_id, sg.quota, sg.display_order,
             COALESCE(sg.guide_name, u.name) as guide_name,
             COALESCE(sg.designation, f.designation, 'Faculty Guide') as designation,
             sg.initials,
             COALESCE(sg.expertise_tags, '{}') as expertise_tags,
             COALESCE(sg.is_active, TRUE) as is_active,
             (SELECT COUNT(*) FROM seminar_groups g WHERE g.session_id = sg.session_id AND (g.seminar_guide_id = sg.id OR g.guide_id = sg.faculty_id)) as current_load
      FROM seminar_guides sg
      LEFT JOIN faculty f ON sg.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE sg.session_id = $1
      ORDER BY sg.display_order ASC, guide_name ASC
    `, [sessionId]);

    res.json({ guides: r.rows });
  } catch (err) {
    console.error('[SeminarWorkflow] get guides error:', err.message);
    res.status(500).json({ error: 'Failed to fetch guides' });
  }
});

// POST /api/seminar/workflow/:sessionId/guides — Add or update guide
router.post('/:sessionId/guides', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { faculty_id, guide_name, designation, initials, quota = 4, expertise_tags = [], is_active = true } = req.body;

  try {
    const r = await pool.query(`
      INSERT INTO seminar_guides (
        session_id, faculty_id, guide_name, designation, initials, quota, expertise_tags, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      sessionId,
      faculty_id || null,
      guide_name ? guide_name.trim() : null,
      designation ? designation.trim() : 'Faculty Guide',
      initials ? initials.trim().toUpperCase() : null,
      parseInt(quota, 10) || 4,
      expertise_tags || [],
      Boolean(is_active),
    ]);

    res.json({ success: true, guide: r.rows[0] });
  } catch (err) {
    console.error('[SeminarWorkflow] add guide error:', err.message);
    res.status(500).json({ error: 'Failed to save guide' });
  }
});

// PATCH /api/seminar/workflow/:sessionId/guides/:guideId
router.patch('/:sessionId/guides/:guideId', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const guideId = parseInt(req.params.guideId, 10);
  const { guide_name, designation, initials, quota, expertise_tags, is_active } = req.body;

  try {
    const r = await pool.query(`
      UPDATE seminar_guides
      SET guide_name = COALESCE($1, guide_name),
          designation = COALESCE($2, designation),
          initials = COALESCE($3, initials),
          quota = COALESCE($4, quota),
          expertise_tags = COALESCE($5, expertise_tags),
          is_active = COALESCE($6, is_active)
      WHERE id = $7 AND session_id = $8
      RETURNING *
    `, [
      guide_name !== undefined ? guide_name.trim() : null,
      designation !== undefined ? designation.trim() : null,
      initials !== undefined ? initials.trim().toUpperCase() : null,
      quota !== undefined ? parseInt(quota, 10) : null,
      expertise_tags !== undefined ? expertise_tags : null,
      is_active !== undefined ? Boolean(is_active) : null,
      guideId,
      sessionId,
    ]);

    if (!r.rows.length) return res.status(404).json({ error: 'Guide not found' });
    res.json({ success: true, guide: r.rows[0] });
  } catch (err) {
    console.error('[SeminarWorkflow] update guide error:', err.message);
    res.status(500).json({ error: 'Failed to update guide' });
  }
});

// GET /api/seminar/workflow/:sessionId/groups — Get groups with topics for assignment
router.get('/:sessionId/groups', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  try {
    const r = await pool.query(`
      SELECT sg.id, sg.group_no, sg.domain, sg.domain_raw, sg.guide_id, sg.seminar_guide_id, sg.guide_name,
             sg.status,
             (SELECT COUNT(*) FROM seminar_marks sm WHERE sm.group_id = sg.id) as marks_count,
             json_agg(
               json_build_object(
                 'id', m.id,
                 'name', m.student_name,
                 'prn', m.prn,
                 'division', m.division,
                 'topic1', m.topic1,
                 'topic2', m.topic2,
                 'topic3', m.topic3,
                 'is_leader', m.is_leader
               ) ORDER BY m.member_index ASC
             ) as members
      FROM seminar_groups sg
      LEFT JOIN seminar_group_members m ON m.group_id = sg.id
      WHERE sg.session_id = $1
      GROUP BY sg.id, sg.group_no, sg.domain, sg.domain_raw, sg.guide_id, sg.seminar_guide_id, sg.guide_name, sg.status
      ORDER BY sg.group_no ASC
    `, [sessionId]);

    res.json({ groups: r.rows });
  } catch (err) {
    console.error('[SeminarWorkflow] get groups error:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// POST /api/seminar/workflow/:sessionId/suggest-assignments
router.post('/:sessionId/suggest-assignments', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  try {
    const [grpRes, guiRes] = await Promise.all([
      pool.query(`
        SELECT sg.id, sg.group_no, sg.domain, sg.domain_raw, sg.guide_id, sg.seminar_guide_id, sg.guide_name
        FROM seminar_groups sg WHERE sg.session_id = $1 ORDER BY sg.group_no ASC
      `, [sessionId]),
      pool.query(`
        SELECT sg.id, sg.faculty_id, COALESCE(sg.guide_name, u.name) as faculty_name, sg.quota,
               sg.expertise_tags, sg.is_active
        FROM seminar_guides sg
        LEFT JOIN faculty f ON sg.faculty_id = f.id
        LEFT JOIN users u ON f.user_id = u.id
        WHERE sg.session_id = $1 AND COALESCE(sg.is_active, TRUE) = TRUE
      `, [sessionId]),
    ]);

    const suggestions = suggestGuideAssignments(grpRes.rows, guiRes.rows);
    res.json({ suggestions });
  } catch (err) {
    console.error('[SeminarWorkflow] suggest-assignments error:', err.message);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// POST /api/seminar/workflow/:sessionId/save-assignments
router.post('/:sessionId/save-assignments', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { assignments } = req.body; // Array of { groupId, guideId }

  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'Assignments array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch session guides
    const guiRes = await client.query(`
      SELECT sg.id, sg.faculty_id, COALESCE(sg.guide_name, u.name) as guide_name
      FROM seminar_guides sg
      LEFT JOIN faculty f ON sg.faculty_id = f.id
      LEFT JOIN users u ON f.user_id = u.id
      WHERE sg.session_id = $1
    `, [sessionId]);

    const guideLookup = new Map();
    guiRes.rows.forEach(g => {
      guideLookup.set(g.id, g);
      if (g.faculty_id) guideLookup.set(g.faculty_id, g);
    });

    for (const a of assignments) {
      if (!a.groupId) continue;
      if (!a.guideId) {
        // Unassign
        await client.query(`
          UPDATE seminar_groups
          SET seminar_guide_id = NULL, guide_id = NULL, guide_name = NULL, updated_at = NOW()
          WHERE id = $1 AND session_id = $2
        `, [a.groupId, sessionId]);
      } else {
        const targetGuide = guideLookup.get(parseInt(a.guideId, 10));
        if (targetGuide) {
          await client.query(`
            UPDATE seminar_groups
            SET seminar_guide_id = $1, guide_id = $2, guide_name = $3, updated_at = NOW()
            WHERE id = $4 AND session_id = $5
          `, [
            targetGuide.id,
            targetGuide.faculty_id,
            targetGuide.guide_name,
            a.groupId,
            sessionId,
          ]);
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, updatedCount: assignments.length, timestamp: new Date().toISOString() });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SeminarWorkflow] save assignments failed:', err.message);
    res.status(500).json({ error: 'Failed to persist guide assignments' });
  } finally {
    client.release();
  }
});

// ─── Output: Download Formatted Department Excel ──────────────────────────────
// GET /api/seminar/workflow/:sessionId/export-excel
router.get('/:sessionId/export-excel', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  try {
    const [sessRes, grpRes, guiRes] = await Promise.all([
      pool.query('SELECT * FROM seminar_sessions WHERE id = $1', [sessionId]),
      pool.query(`
        SELECT sg.id, sg.group_no, sg.domain, sg.domain_raw, sg.guide_name,
               json_agg(
                 json_build_object(
                   'name', m.student_name,
                   'prn', m.prn,
                   'division', m.division,
                   'mobile', m.mobile,
                   'email', m.email,
                   'topic1', m.topic1,
                   'topic2', m.topic2,
                   'topic3', m.topic3,
                   'is_leader', m.is_leader
                 ) ORDER BY m.member_index ASC
               ) as members
        FROM seminar_groups sg
        LEFT JOIN seminar_group_members m ON m.group_id = sg.id
        WHERE sg.session_id = $1
        GROUP BY sg.id, sg.group_no, sg.domain, sg.domain_raw, sg.guide_name
        ORDER BY sg.group_no ASC
      `, [sessionId]),
      pool.query(`
        SELECT sg.id, COALESCE(sg.guide_name, u.name) as guide_name, sg.quota
        FROM seminar_guides sg
        LEFT JOIN faculty f ON sg.faculty_id = f.id
        LEFT JOIN users u ON f.user_id = u.id
        WHERE sg.session_id = $1
      `, [sessionId]),
    ]);

    if (!sessRes.rows.length) return res.status(404).json({ error: 'Session not found' });
    const session = sessRes.rows[0];

    // Build Excel buffer with 4 sheets and formula sanitization
    const excelBuffer = generateWorkflowExcel(session, grpRes.rows, guiRes.rows, []);

    const dateStr = new Date().toISOString().split('T')[0];
    const safeSessionName = (session.name || `Session_${session.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `TE_Seminar_Groups_${safeSessionName}_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error('[SeminarWorkflow] Export excel error:', err.message);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

module.exports = router;
