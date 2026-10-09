'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function runCleanup(dryRun = true) {
  const client = await pool.connect();
  try {
    console.log('\n===============================================================');
    console.log(`[Session Cleanup] Mode: ${dryRun ? 'DRY-RUN (Simulated)' : 'REAL DELETE (Live Transaction)'}`);
    console.log('===============================================================\n');

    await client.query('BEGIN');

    // 1. Identify the current AY 2025-26 session
    const curSessRes = await client.query(
      `SELECT id, name, batch, academic_year, status, created_at
       FROM seminar_sessions
       WHERE academic_year = '2025-26' OR name ILIKE '%2025-26%'
       ORDER BY id DESC
       LIMIT 1`
    );

    if (curSessRes.rows.length === 0) {
      throw new Error('Current session AY 2025-26 not found in seminar_sessions table!');
    }

    const currentSession = curSessRes.rows[0];
    const currentSessionId = currentSession.id;

    console.log(`✓ Current Session to KEEP:`);
    console.log(`  - ID: ${currentSession.id}`);
    console.log(`  - Name: "${currentSession.name}"`);
    console.log(`  - Academic Year: ${currentSession.academic_year}`);
    console.log(`  - Status: ${currentSession.status}\n`);

    // 2. Query old sessions
    const oldSessRes = await client.query(
      `SELECT id, name, batch, academic_year, status FROM seminar_sessions WHERE id != $1 ORDER BY id ASC`,
      [currentSessionId]
    );

    console.log(`Found ${oldSessRes.rows.length} old/previous session(s) to remove:`);
    oldSessRes.rows.forEach(s => {
      console.log(`  - ID ${s.id}: "${s.name}" (AY: ${s.academic_year}, Batch: ${s.batch}, Status: ${s.status})`);
    });
    console.log('');

    // 3. Count records to delete vs records to keep per table
    const tables = [
      {
        name: 'registrations',
        countDeleteSql: `SELECT count(*) FROM registrations WHERE seminar_id != $1 OR seminar_id IS NULL`,
        countKeepSql: `SELECT count(*) FROM registrations WHERE seminar_id = $1`,
        deleteSql: `DELETE FROM registrations WHERE seminar_id != $1 OR seminar_id IS NULL`
      },
      {
        name: 'seminar_marks',
        countDeleteSql: `SELECT count(*) FROM seminar_marks WHERE session_id != $1 OR session_id IS NULL`,
        countKeepSql: `SELECT count(*) FROM seminar_marks WHERE session_id = $1`,
        deleteSql: `DELETE FROM seminar_marks WHERE session_id != $1 OR session_id IS NULL`
      },
      {
        name: 'seminar_group_members',
        countDeleteSql: `SELECT count(*) FROM seminar_group_members WHERE group_id IN (SELECT id FROM seminar_groups WHERE session_id != $1)`,
        countKeepSql: `SELECT count(*) FROM seminar_group_members WHERE group_id IN (SELECT id FROM seminar_groups WHERE session_id = $1)`,
        deleteSql: `DELETE FROM seminar_group_members WHERE group_id IN (SELECT id FROM seminar_groups WHERE session_id != $1)`
      },
      {
        name: 'seminar_groups',
        countDeleteSql: `SELECT count(*) FROM seminar_groups WHERE session_id != $1`,
        countKeepSql: `SELECT count(*) FROM seminar_groups WHERE session_id = $1`,
        deleteSql: `DELETE FROM seminar_groups WHERE session_id != $1`
      },
      {
        name: 'seminar_guides',
        countDeleteSql: `SELECT count(*) FROM seminar_guides WHERE session_id != $1`,
        countKeepSql: `SELECT count(*) FROM seminar_guides WHERE session_id = $1`,
        deleteSql: `DELETE FROM seminar_guides WHERE session_id != $1`
      },
      {
        name: 'seminar_issue_overrides',
        countDeleteSql: `SELECT count(*) FROM seminar_issue_overrides WHERE session_id != $1`,
        countKeepSql: `SELECT count(*) FROM seminar_issue_overrides WHERE session_id = $1`,
        deleteSql: `DELETE FROM seminar_issue_overrides WHERE session_id != $1`
      },
      {
        name: 'seminar_sessions',
        countDeleteSql: `SELECT count(*) FROM seminar_sessions WHERE id != $1`,
        countKeepSql: `SELECT count(*) FROM seminar_sessions WHERE id = $1`,
        deleteSql: `DELETE FROM seminar_sessions WHERE id != $1`
      }
    ];

    const summaryReport = [];

    for (const t of tables) {
      const delCountRes = await client.query(t.countDeleteSql, [currentSessionId]);
      const keepCountRes = await client.query(t.countKeepSql, [currentSessionId]);
      const toDelete = parseInt(delCountRes.rows[0].count, 10);
      const toKeep = parseInt(keepCountRes.rows[0].count, 10);

      summaryReport.push({
        table: t.name,
        records_to_delete: toDelete,
        records_to_keep: toKeep
      });

      if (!dryRun && toDelete > 0) {
        await client.query(t.deleteSql, [currentSessionId]);
      }
    }

    console.table(summaryReport);

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n[Dry-Run Complete] 0 rows deleted. Database unchanged.');
    } else {
      await client.query('COMMIT');
      console.log('\n✓ [Cleanup Complete] All previous session data successfully deleted.');
    }

    return { currentSession, summaryReport };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Session Cleanup Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const isReal = process.argv.includes('--execute') || process.argv.includes('--real');
  runCleanup(!isReal)
    .then(() => pool.end())
    .catch(() => pool.end());
}

module.exports = { runCleanup };
