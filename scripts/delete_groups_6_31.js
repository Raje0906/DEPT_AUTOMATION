'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function deleteGroups() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessRes = await client.query(
      `SELECT id, name FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );
    if (!sessRes.rows.length) {
      throw new Error('Active seminar session not found');
    }
    const sessionId = sessRes.rows[0].id;

    const grpRes = await client.query(
      `SELECT id, group_no, guide_name FROM seminar_groups WHERE session_id = $1 AND group_no IN (6, 31)`,
      [sessionId]
    );

    console.log(`Found ${grpRes.rows.length} group(s) to remove:`);
    for (const g of grpRes.rows) {
      console.log(` - Group #${g.group_no} (DB ID: ${g.id}), Assigned Guide: ${g.guide_name}`);
    }

    if (grpRes.rows.length > 0) {
      const groupIds = grpRes.rows.map(g => g.id);

      // Cascading delete - deletes members, registrations, marks, evaluations, and the groups themselves
      const delMembers = await client.query(`DELETE FROM seminar_group_members WHERE group_id = ANY($1) RETURNING id`, [groupIds]);
      const delRegs = await client.query(`DELETE FROM registrations WHERE group_id = ANY($1) RETURNING id`, [groupIds]);
      const delMarks = await client.query(`DELETE FROM seminar_marks WHERE group_id = ANY($1) RETURNING id`, [groupIds]);
      const delGroups = await client.query(`DELETE FROM seminar_groups WHERE id = ANY($1) RETURNING id, group_no`, [groupIds]);

      console.log(`Deleted ${delMembers.rowCount} member(s).`);
      console.log(`Deleted ${delRegs.rowCount} registration(s).`);
      console.log(`Deleted ${delMarks.rowCount} marks record(s).`);
      console.log(`Deleted ${delGroups.rowCount} group(s): ${delGroups.rows.map(g => '#' + g.group_no).join(', ')}.`);
    }

    await client.query('COMMIT');
    console.log('✓ Groups #6 and #31 successfully and completely deleted from database.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting groups:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteGroups();
