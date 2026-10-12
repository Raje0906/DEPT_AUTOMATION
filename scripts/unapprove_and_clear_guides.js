require('dotenv').config();
const pool = require('../db/pool');

async function unapproveAndClear() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Unapprove all groups and clear assigned guides for all groups in all sessions (or session 15)
    const grpRes = await client.query(`
      UPDATE seminar_groups
      SET status = 'PENDING_GUIDE_ASSIGNMENT',
          guide_id = NULL,
          seminar_guide_id = NULL,
          guide_name = NULL,
          assigned_by = NULL,
          assigned_at = NULL,
          approved_by = NULL,
          approved_at = NULL,
          hod_remarks = NULL,
          updated_at = NOW()
      RETURNING id, session_id, group_no
    `);

    // 2. Set sessions status to 'ASSIGNMENT' / non-published so registration is in active registered state
    const sessRes = await client.query(`
      UPDATE seminar_sessions
      SET status = 'ASSIGNMENT',
          published_at = NULL,
          published_by = NULL,
          is_locked = FALSE
      RETURNING id, name, status
    `);

    // 3. Clear any seminar marks just in case
    const marksRes = await client.query(`
      DELETE FROM seminar_marks RETURNING id
    `);

    await client.query('COMMIT');

    console.log(`Successfully unapproved and cleared guides for ${grpRes.rows.length} groups across ${sessRes.rows.length} sessions.`);
    console.log('Sessions updated:', sessRes.rows);
    console.log(`Cleared ${marksRes.rows.length} seminar marks records.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to unapprove and clear guides:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

unapproveAndClear().catch(console.error);
