'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function dryRunReopen(isLive = false) {
  const client = await pool.connect();
  try {
    const sessRes = await client.query(
      `SELECT id, name, academic_year, status, is_locked FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );
    if (!sessRes.rows.length) {
      console.error('Session not found!');
      process.exit(1);
    }
    const session = sessRes.rows[0];

    // Find Groups 6 and 31
    const grpRes = await client.query(
      `SELECT * FROM seminar_groups WHERE session_id = $1 AND group_no IN (6, 31) ORDER BY group_no ASC`,
      [session.id]
    );

    console.log(`\n===============================================================`);
    console.log(`  ${isLive ? 'LIVE DELETE & REOPEN' : 'DRY RUN'}: Groups #6 and #31 in Session "${session.name}"`);
    console.log(`===============================================================\n`);

    const groupDetails = [];

    for (const grp of grpRes.rows) {
      const memRes = await client.query(
        `SELECT * FROM seminar_group_members WHERE group_id = $1 ORDER BY member_index ASC`,
        [grp.id]
      );

      const regRes = await client.query(
        `SELECT * FROM registrations WHERE group_id = $1 AND seminar_id = $2`,
        [grp.id, session.id]
      );

      // Check any related records that exist only because they registered:
      // seminar_marks, seminar_panel_evaluations, seminar_panel_assignments
      const marksRes = await client.query(`SELECT * FROM seminar_marks WHERE group_id = $1`, [grp.id]);
      const panelEvalRes = await client.query(`SELECT * FROM seminar_panel_evaluations WHERE group_id = $1`, [grp.id]);
      const panelAssignRes = await client.query(`SELECT * FROM seminar_panel_assignments WHERE group_id = $1`, [grp.id]);

      groupDetails.push({
        group: grp,
        members: memRes.rows,
        registrations: regRes.rows,
        marks: marksRes.rows,
        panelEvaluations: panelEvalRes.rows,
        panelAssignments: panelAssignRes.rows,
      });
    }

    // Print Detailed Inspection
    for (const item of groupDetails) {
      const g = item.group;
      console.log(`---------------------------------------------------------------`);
      console.log(`GROUP #${g.group_no} (DB Group ID: ${g.id})`);
      console.log(`Guide: ${g.guide_name}`);
      console.log(`Domain: ${g.domain} (Raw: "${g.domain_raw}")`);
      console.log(`Current Status: ${g.status} | allow_edit: ${g.allow_edit}`);
      console.log(`Members (${item.members.length}):`);
      item.members.forEach(m => {
        console.log(`  [Slot ${m.member_index}] ${m.student_name} | PRN: ${m.prn || 'NULL'} | Div: ${m.division || '—'} | Email: ${m.email || '—'} | Mobile: ${m.mobile || '—'}`);
        console.log(`      Topics -> T1: "${m.topic1 || '—'}", T2: "${m.topic2 || '—'}", T3: "${m.topic3 || '—'}"`);
      });

      console.log(`\nItems to be DELETED for Group #${g.group_no}:`);
      console.log(`  Table: registrations -> ${item.registrations.length} row(s):`);
      item.registrations.forEach(r => {
        console.log(`    - ID: ${r.id}, seminar_id: ${r.seminar_id}, group_id: ${r.group_id}, status: "${r.status}", registered_by: ${r.registered_by}, registered_at: ${r.registered_at}`);
      });

      console.log(`  Table: seminar_marks -> ${item.marks.length} row(s)`);
      item.marks.forEach(m => {
        console.log(`    - ID: ${m.id}, student_id: ${m.student_id}, prn: "${m.prn}"`);
      });

      console.log(`  Table: seminar_panel_evaluations -> ${item.panelEvaluations.length} row(s)`);
      console.log(`  Table: seminar_panel_assignments -> ${item.panelAssignments.length} row(s)`);
      console.log(`  Topic fields on members -> topic1, topic2, topic3 will be reset to NULL`);

      console.log(`\nItems to be PRESERVED for Group #${g.group_no}:`);
      console.log(`  ✓ seminar_groups row (ID ${g.id}, Group #${g.group_no})`);
      console.log(`  ✓ Assigned Guide: ${g.guide_name}`);
      console.log(`  ✓ All ${item.members.length} student member rows in seminar_group_members`);
    }

    console.log(`\n===============================================================`);
    console.log(`LOCKING MECHANISM ANALYSIS:`);
    console.log(`1. Global Session: "AY 2025-26 Sem 1" status is "${session.status}", is_locked is ${session.is_locked}.`);
    console.log(`2. Group Registration Lock: In routes/seminar.js, group registration is controlled by:`);
    console.log(`   - Presence of row in 'registrations' (WHERE group_id = sg.id AND status = 'REGISTERED')`);
    console.log(`   - Group level 'allow_edit' boolean flag on 'seminar_groups' table`);
    console.log(`   - Group status ('APPROVED' vs 'PENDING' / 'DRAFT')`);
    console.log(`3. To unlock ONLY Groups #6 and #31 without altering global session status or other groups:`);
    console.log(`   - DELETE FROM registrations WHERE group_id IN (${groupDetails.map(d => d.group.id).join(', ')});`);
    console.log(`   - UPDATE seminar_groups SET status = 'PENDING', allow_edit = true WHERE id IN (${groupDetails.map(d => d.group.id).join(', ')});`);
    console.log(`   - Reset topic choices on seminar_group_members to NULL for these two groups.`);
    console.log(`   - Add [6, 31] to the importer exclusion list (--exclude-registrations 6,31).`);
    console.log(`===============================================================\n`);

    if (isLive) {
      await client.query('BEGIN');
      const groupIds = groupDetails.map(d => d.group.id);

      // 1. Delete dependent evaluation rows if any exist
      await client.query(`DELETE FROM seminar_marks WHERE group_id = ANY($1)`, [groupIds]);
      await client.query(`DELETE FROM seminar_panel_evaluations WHERE group_id = ANY($1)`, [groupIds]);
      await client.query(`DELETE FROM seminar_panel_assignments WHERE group_id = ANY($1)`, [groupIds]);

      // 2. Delete registrations rows
      const delReg = await client.query(`DELETE FROM registrations WHERE group_id = ANY($1) RETURNING id, group_id`, [groupIds]);

      // 3. Reset member topics
      await client.query(
        `UPDATE seminar_group_members SET topic1 = NULL, topic2 = NULL, topic3 = NULL WHERE group_id = ANY($1)`,
        [groupIds]
      );

      // 4. Update group status to allow edit
      await client.query(
        `UPDATE seminar_groups SET status = 'PENDING_GUIDE_ASSIGNMENT', allow_edit = true, submitted_at = NULL WHERE id = ANY($1)`,
        [groupIds]
      );

      await client.query('COMMIT');
      console.log(`✓ LIVE DELETION & UNLOCK EXECUTED SUCCESSFULLY IN 1 TRANSACTION!`);
      console.log(`✓ Deleted ${delReg.rowCount} registration record(s).`);
      console.log(`✓ Groups #6 and #31 are now open and editable.`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

const isLive = process.argv.includes('--execute') || process.argv.includes('--live');
dryRunReopen(isLive).catch(err => {
  console.error('Error during dry run:', err);
  process.exit(1);
});
