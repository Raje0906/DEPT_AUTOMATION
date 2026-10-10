const express = require('express');
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Helper: Check if user is the authorized faculty member Dr. (Mrs.) S. S. Raskar (SSR)
function isAuthorizedMagazineCreator(user) {
  if (!user) return false;
  const isMatchId = user.id === 10;
  const isMatchEmail = typeof user.email === 'string' && user.email.toLowerCase() === 'ssr@meswadiacoe.edu';
  const isMatchEmp = typeof user.employee_id === 'string' && user.employee_id.toUpperCase() === 'SSR';
  return isMatchId || isMatchEmail || isMatchEmp;
}

// Helper: optional token check so student or unauthenticated previews still work seamlessly
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // ignore expired / invalid token for optional routes
    }
  }
  next();
}

// Helper: map a database row to the frontend format (supporting camelCase properties)
function formatMagazine(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    issueNumber: row.issue_number,
    academicYear: row.academic_year,
    semester: row.semester || 'Annual',
    department: row.department || 'Department of Computer Engineering',
    period: row.period || '',
    description: row.description || '',
    status: row.status || 'Draft',
    template: row.template || 'modern-academic',
    publishedDate: row.published_date ? (row.published_date.toISOString ? row.published_date.toISOString().split('T')[0] : String(row.published_date).slice(0, 10)) : null,
    coverColor: row.cover_color || '#1E2D5A',
    coverImage: row.cover_image || null,
    totalPages: row.total_pages || 0,
    tagline: row.tagline || '',
    sections: row.sections || {},
    sectionData: row.section_data || {},
    reviewComment: row.review_comment || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── GET /api/magazines ─────────────────────────────────────────────────────────
// List all magazines with metadata and section status (without heavy section_data by default)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, academic_year, include_data } = req.query;
    let query = `
      SELECT id, title, issue_number, academic_year, semester, department, period,
             description, status, template, published_date, cover_color, cover_image,
             total_pages, tagline, sections, review_comment, created_at, updated_at
             ${include_data === 'true' ? ', section_data' : ''}
      FROM magazines
    `;
    const params = [];
    const conditions = [];

    if (status && status !== 'All') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (academic_year) {
      params.push(academic_year);
      conditions.push(`academic_year = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY issue_number DESC, created_at DESC`;

    const result = await pool.query(query, params);
    const magazines = result.rows.map(formatMagazine);
    res.json({ magazines });
  } catch (err) {
    console.error('[Magazines API] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch magazines' });
  }
});

// ─── GET /api/magazines/published ──────────────────────────────────────────────
// List only published magazines (for students & public portal)
router.get('/published', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, issue_number, academic_year, semester, department, period,
             description, status, template, published_date, cover_color, cover_image,
             total_pages, tagline, sections, section_data, created_at, updated_at
      FROM magazines
      WHERE status = 'Published'
      ORDER BY issue_number DESC, published_date DESC
    `);
    const magazines = result.rows.map(formatMagazine);
    res.json({ magazines });
  } catch (err) {
    console.error('[Magazines API] GET /published error:', err);
    res.status(500).json({ error: 'Failed to fetch published magazines' });
  }
});

// ─── GET /api/magazines/:id ────────────────────────────────────────────────────
// Get full details and full section_data of a specific magazine
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM magazines WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine not found' });
    }

    res.json({ magazine: formatMagazine(result.rows[0]) });
  } catch (err) {
    console.error('[Magazines API] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch magazine details' });
  }
});

// ─── POST /api/magazines ───────────────────────────────────────────────────────
// Create a new magazine issue (Strictly restricted to Dr. (Mrs.) S. S. Raskar - SSR)
router.post('/', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  let decodedUser;
  try {
    decodedUser = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedUser;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!isAuthorizedMagazineCreator(decodedUser)) {
    return res.status(403).json({
      error: 'Access denied: Only Dr. (Mrs.) S. S. Raskar (SSR) is authorized to create magazines.'
    });
  }

  try {
    const body = req.body || {};
    const id = body.id || `MAG-${Date.now()}`;
    const title = body.title || 'Reflection';
    const issueNumber = parseInt(body.issueNumber || body.issue_number || 1, 10);
    const academicYear = body.academicYear || body.academic_year || '2026–27';
    const semester = body.semester || 'Annual';
    const department = body.department || 'Department of Computer Engineering';
    const period = body.period || '';
    const description = body.description || '';
    const status = body.status || 'Draft';
    const template = body.template || 'modern-academic';
    const coverColor = body.coverColor || body.cover_color || '#1E2D5A';
    const coverImage = body.coverImage || body.cover_image || null;
    const totalPages = parseInt(body.totalPages || body.total_pages || 0, 10);
    const tagline = body.tagline || '';
    const sections = body.sections || {};
    const sectionData = body.sectionData || body.section_data || {};
    const createdBy = req.user?.id || null;

    const result = await pool.query(`
      INSERT INTO magazines (
        id, title, issue_number, academic_year, semester, department, period,
        description, status, template, cover_color, cover_image, total_pages,
        tagline, sections, section_data, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, NOW(), NOW()
      )
      RETURNING *
    `, [
      id, title, issueNumber, academicYear, semester, department, period,
      description, status, template, coverColor, coverImage, totalPages,
      tagline, JSON.stringify(sections), JSON.stringify(sectionData), createdBy
    ]);

    res.status(201).json({ magazine: formatMagazine(result.rows[0]) });
  } catch (err) {
    console.error('[Magazines API] POST / error:', err);
    res.status(500).json({ error: 'Failed to create magazine', details: err.message });
  }
});

// ─── PUT /api/magazines/:id ────────────────────────────────────────────────────
// Update magazine metadata and/or full section data
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    // First check existence
    const existing = await pool.query('SELECT * FROM magazines WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine not found' });
    }

    const cur = existing.rows[0];
    const title = body.title !== undefined ? body.title : cur.title;
    const issueNumber = body.issueNumber !== undefined ? parseInt(body.issueNumber, 10) : cur.issue_number;
    const academicYear = body.academicYear !== undefined ? body.academicYear : cur.academic_year;
    const semester = body.semester !== undefined ? body.semester : cur.semester;
    const department = body.department !== undefined ? body.department : cur.department;
    const period = body.period !== undefined ? body.period : cur.period;
    const description = body.description !== undefined ? body.description : cur.description;
    const status = body.status !== undefined ? body.status : cur.status;
    const template = body.template !== undefined ? body.template : cur.template;
    const publishedDate = body.publishedDate !== undefined ? body.publishedDate : cur.published_date;
    const coverColor = body.coverColor !== undefined ? body.coverColor : cur.cover_color;
    const coverImage = body.coverImage !== undefined ? body.coverImage : cur.cover_image;
    const totalPages = body.totalPages !== undefined ? parseInt(body.totalPages, 10) : cur.total_pages;
    const tagline = body.tagline !== undefined ? body.tagline : cur.tagline;
    const sections = body.sections !== undefined ? body.sections : cur.sections;
    const sectionData = (body.sectionData !== undefined || body.section_data !== undefined) 
      ? (body.sectionData || body.section_data) 
      : cur.section_data;
    const reviewComment = body.reviewComment !== undefined ? body.reviewComment : cur.review_comment;

    const result = await pool.query(`
      UPDATE magazines SET
        title = $1,
        issue_number = $2,
        academic_year = $3,
        semester = $4,
        department = $5,
        period = $6,
        description = $7,
        status = $8,
        template = $9,
        published_date = $10,
        cover_color = $11,
        cover_image = $12,
        total_pages = $13,
        tagline = $14,
        sections = $15,
        section_data = $16,
        review_comment = $17,
        updated_at = NOW()
      WHERE id = $18
      RETURNING *
    `, [
      title, issueNumber, academicYear, semester, department, period,
      description, status, template, publishedDate, coverColor, coverImage,
      totalPages, tagline, JSON.stringify(sections), JSON.stringify(sectionData),
      reviewComment, id
    ]);

    res.json({ magazine: formatMagazine(result.rows[0]) });
  } catch (err) {
    console.error('[Magazines API] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update magazine' });
  }
});

// ─── PUT /api/magazines/:id/sections/:sectionId ────────────────────────────────
// Update a single section's content efficiently
router.put('/:id/sections/:sectionId', optionalAuth, async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const sectionPayload = req.body;

    const existing = await pool.query('SELECT sections, section_data FROM magazines WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine not found' });
    }

    const curSections = existing.rows[0].sections || {};
    const curSectionData = existing.rows[0].section_data || {};

    curSectionData[sectionId] = sectionPayload;
    curSections[sectionId] = { completed: true };

    const result = await pool.query(`
      UPDATE magazines SET
        section_data = $1,
        sections = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [JSON.stringify(curSectionData), JSON.stringify(curSections), id]);

    res.json({
      success: true,
      sectionId,
      magazine: formatMagazine(result.rows[0])
    });
  } catch (err) {
    console.error('[Magazines API] PUT /:id/sections/:sectionId error:', err);
    res.status(500).json({ error: 'Failed to update magazine section' });
  }
});

// ─── PATCH /api/magazines/:id/status ───────────────────────────────────────────
// Update magazine status (Draft, Under Review, Approved, Published, Archived)
router.patch('/:id/status', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewComment } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    let publishedDateClause = '';
    const params = [status, id];

    if (status === 'Published') {
      publishedDateClause = `, published_date = COALESCE(published_date, CURRENT_DATE)`;
    }

    let commentClause = '';
    if (reviewComment !== undefined) {
      params.push(reviewComment);
      commentClause = `, review_comment = $${params.length}`;
    }

    const query = `
      UPDATE magazines SET
        status = $1
        ${publishedDateClause}
        ${commentClause},
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine not found' });
    }

    res.json({ magazine: formatMagazine(result.rows[0]) });
  } catch (err) {
    console.error('[Magazines API] PATCH /:id/status error:', err);
    res.status(500).json({ error: 'Failed to update magazine status' });
  }
});

// ─── DELETE /api/magazines/:id ─────────────────────────────────────────────────
// Delete a magazine issue
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM magazines WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine not found' });
    }
    res.json({ success: true, message: `Magazine ${id} deleted successfully` });
  } catch (err) {
    console.error('[Magazines API] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete magazine' });
  }
});

module.exports = router;
