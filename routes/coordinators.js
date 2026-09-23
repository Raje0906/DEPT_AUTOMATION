'use strict';
const express = require('express');
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { auditRecord } = require('../middleware/auditLogger');

const router = express.Router();

// Ensure coordinator_assignments table exists
async function ensureCoordinatorSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS coordinator_assignments (
        id SERIAL PRIMARY KEY,
        faculty_id INT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        role_type VARCHAR(50) NOT NULL, -- 'BE_PROJECT_COORDINATOR' | 'TE_SEMINAR_COORDINATOR'
        academic_year VARCHAR(20) NOT NULL DEFAULT '2025-26',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        appointed_by INT REFERENCES users(id),
        appointed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS appointed_by INT REFERENCES users(id);
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS appointed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) NOT NULL DEFAULT '2025-26';
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE coordinator_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      CREATE INDEX IF NOT EXISTS idx_coord_assign ON coordinator_assignments (role_type, academic_year, is_active);
    `);
  } catch (err) {
    console.error('[Coordinators] Schema init error:', err.message);
  }
}
ensureCoordinatorSchema();

/**
 * GET /api/coordinators
 * Fetch current coordinators and faculty list for assignment.
 */
router.get('/', verifyToken, requireRole('hod', 'faculty'), async (req, res) => {
  try {
    const academicYear = req.query.academic_year || '2025-26';

    // 1. Get faculty list
    const facultyRes = await pool.query(`
      SELECT f.id, f.user_id, f.employee_id, f.designation, f.department,
             f.is_seminar_coordinator, u.name, u.email
      FROM faculty f
      JOIN users u ON u.id = f.user_id
      ORDER BY u.name ASC
    `);

    // 2. Get active coordinator assignments for this academic year
    const assignRes = await pool.query(`
      SELECT ca.*, f.user_id, u.name as faculty_name, u.email as faculty_email,
             f.designation, f.department,
             u2.name as appointed_by_name
      FROM coordinator_assignments ca
      JOIN faculty f ON ca.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      LEFT JOIN users u2 ON ca.appointed_by = u2.id
      WHERE ca.academic_year = $1 AND ca.is_active = TRUE
      ORDER BY ca.appointed_at DESC
    `, [academicYear]);

    let beCoordinator = assignRes.rows.find(r => r.role_type === 'BE_PROJECT_COORDINATOR') || null;
    let teCoordinator = assignRes.rows.find(r => r.role_type === 'TE_SEMINAR_COORDINATOR') || null;

    // Fallback: If no assignment record yet, check faculty is_seminar_coordinator flag
    if (!teCoordinator) {
      const flagCoord = facultyRes.rows.find(f => f.is_seminar_coordinator);
      if (flagCoord) {
        teCoordinator = {
          faculty_id: flagCoord.id,
          faculty_name: flagCoord.name,
          faculty_email: flagCoord.email,
          designation: flagCoord.designation,
          department: flagCoord.department,
          role_type: 'TE_SEMINAR_COORDINATOR',
          academic_year: academicYear,
          is_active: true,
        };
      }
    }

    // 3. Get tenure history
    const historyRes = await pool.query(`
      SELECT ca.*, u.name as faculty_name, u.email as faculty_email,
             f.designation, f.department,
             u2.name as appointed_by_name
      FROM coordinator_assignments ca
      JOIN faculty f ON ca.faculty_id = f.id
      JOIN users u ON f.user_id = u.id
      LEFT JOIN users u2 ON ca.appointed_by = u2.id
      WHERE ca.academic_year = $1
      ORDER BY ca.created_at DESC
    `, [academicYear]);

    res.json({
      academicYear,
      beCoordinator,
      teCoordinator,
      facultyList: facultyRes.rows,
      history: historyRes.rows,
    });
  } catch (err) {
    console.error('[Coordinators] GET /:', err.message);
    res.status(500).json({ error: 'Failed to fetch coordinator status' });
  }
});

/**
 * POST /api/coordinators/assign (HOD only)
 * Appoint a coordinator for a specific role and academic year.
 */
router.post('/assign', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { facultyId, roleType, academicYear = '2025-26', notes } = req.body;

    if (!facultyId || !roleType) {
      return res.status(400).json({ error: 'facultyId and roleType are required' });
    }

    if (!['BE_PROJECT_COORDINATOR', 'TE_SEMINAR_COORDINATOR'].includes(roleType)) {
      return res.status(400).json({ error: 'Invalid roleType. Must be BE_PROJECT_COORDINATOR or TE_SEMINAR_COORDINATOR' });
    }

    await client.query('BEGIN');

    // Fetch target faculty
    const facRes = await client.query(
      `SELECT f.id, f.user_id, u.name, u.email FROM faculty f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
      [facultyId]
    );
    if (facRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Faculty member not found' });
    }
    const faculty = facRes.rows[0];

    // Deactivate existing coordinator for this role & academic year
    await client.query(`
      UPDATE coordinator_assignments
      SET is_active = FALSE, revoked_at = NOW()
      WHERE role_type = $1 AND academic_year = $2 AND is_active = TRUE
    `, [roleType, academicYear]);

    // Insert new assignment
    const insertRes = await client.query(`
      INSERT INTO coordinator_assignments (faculty_id, role_type, academic_year, is_active, appointed_by, notes)
      VALUES ($1, $2, $3, TRUE, $4, $5)
      RETURNING *
    `, [facultyId, roleType, academicYear, req.user.id, notes || `Appointed by ${req.user.name || 'HOD'}`]);

    // Update faculty table flags for backwards compatibility
    if (roleType === 'TE_SEMINAR_COORDINATOR') {
      await client.query('UPDATE faculty SET is_seminar_coordinator = FALSE');
      await client.query('UPDATE faculty SET is_seminar_coordinator = TRUE WHERE id = $1', [facultyId]);
    }

    await client.query('COMMIT');

    const roleLabel = roleType === 'BE_PROJECT_COORDINATOR' ? 'BE Project Coordinator' : 'TE Seminar Coordinator';

    await auditRecord({
      tableName: 'coordinator_assignments',
      recordId: insertRes.rows[0].id,
      changedBy: req.user.id,
      action: `APPOINT_${roleType}`,
      oldValue: null,
      newValue: { facultyId, name: faculty.name, roleType, academicYear },
      reason: `HOD appointed ${faculty.name} as ${roleLabel} for AY ${academicYear}`,
    });

    res.json({
      message: `${faculty.name} has been appointed as ${roleLabel} for AY ${academicYear}`,
      assignment: insertRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Coordinators] POST /assign:', err.message);
    res.status(500).json({ error: 'Failed to appoint coordinator' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/coordinators/remove (HOD only)
 * Revoke an active coordinator assignment.
 */
router.post('/remove', verifyToken, requireRole('hod'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { assignmentId, facultyId, roleType, academicYear = '2025-26' } = req.body;

    await client.query('BEGIN');

    let target;
    if (assignmentId) {
      const resTarget = await client.query('SELECT * FROM coordinator_assignments WHERE id = $1', [assignmentId]);
      target = resTarget.rows[0];
      await client.query('UPDATE coordinator_assignments SET is_active = FALSE, revoked_at = NOW() WHERE id = $1', [assignmentId]);
    } else if (facultyId && roleType) {
      const resTarget = await client.query(
        'SELECT * FROM coordinator_assignments WHERE faculty_id = $1 AND role_type = $2 AND academic_year = $3 AND is_active = TRUE',
        [facultyId, roleType, academicYear]
      );
      target = resTarget.rows[0];
      await client.query(
        'UPDATE coordinator_assignments SET is_active = FALSE, revoked_at = NOW() WHERE faculty_id = $1 AND role_type = $2 AND academic_year = $3',
        [facultyId, roleType, academicYear]
      );
    }

    if (roleType === 'TE_SEMINAR_COORDINATOR' || target?.role_type === 'TE_SEMINAR_COORDINATOR') {
      if (facultyId) {
        await client.query('UPDATE faculty SET is_seminar_coordinator = FALSE WHERE id = $1', [facultyId]);
      } else if (target?.faculty_id) {
        await client.query('UPDATE faculty SET is_seminar_coordinator = FALSE WHERE id = $1', [target.faculty_id]);
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'Coordinator role revoked successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Coordinators] POST /remove:', err.message);
    res.status(500).json({ error: 'Failed to revoke coordinator' });
  } finally {
    client.release();
  }
});

module.exports = router;
