'use strict';

require('dotenv').config();
const path = require('path');
const pool = require('../db/pool');
const { parseWorkbook } = require('./import_ay2025_26_sem1');

async function recreateSessionAndImport() {
  const filePath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');
  console.log(`Loading workbook from: ${filePath}`);
  const { groups } = await parseWorkbook(filePath);

  // Filter out Groups 6 and 31 ("leaving these 2")
  const filteredGroups = groups.filter(g => g.group_no !== 6 && g.group_no !== 31);
  console.log(`Parsed total ${groups.length} groups. Excluded #6 and #31 -> ${filteredGroups.length} groups to import.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete existing session for AY 2025-26 Sem 1 (cascades all previous groups, registrations, etc.)
    console.log('Deleting existing session(s) for AY 2025-26...');
    await client.query(`DELETE FROM seminar_sessions WHERE academic_year = '2025-26' OR name = 'AY 2025-26 Sem 1'`);

    // 2. Identify coordinator user ID
    const coordRes = await client.query(
      `SELECT id FROM users WHERE email LIKE '%raskar%' OR role IN ('faculty', 'hod') ORDER BY id LIMIT 1`
    );
    const coordId = coordRes.rows.length ? coordRes.rows[0].id : 1;

    // 3. Create fresh new session
    console.log('Creating fresh new session: "AY 2025-26 Sem 1"...');
    const sessRes = await client.query(
      `INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by, created_at, published_at, published_by, is_locked)
       VALUES ('AY 2025-26 Sem 1', '2025-26', 'TE', 'PUBLISHED', $1, NOW(), NOW(), $1, FALSE)
       RETURNING id, name, academic_year, status, is_locked`,
      [coordId]
    );
    const session = sessRes.rows[0];
    const sessionId = session.id;
    console.log(`Created Session ID: ${sessionId} ("${session.name}") - Status: ${session.status}, is_locked: ${session.is_locked}`);

    // 4. Import all 52 groups with NO guides assigned and complete registration
    console.log(`Importing 52 groups with NO assigned guides and completing registration...`);
    let memberCount = 0;
    let regCount = 0;

    for (const g of filteredGroups) {
      const leaderMember = g.members[0];
      let leaderUserId = null;

      if (leaderMember && leaderMember.prn) {
        const uRes = await client.query(
          `SELECT u.id FROM users u
           LEFT JOIN students s ON s.user_id = u.id
           WHERE (s.enrollment_no IS NOT NULL AND UPPER(REPLACE(s.enrollment_no, ' ', '')) = $1)
              OR LOWER(u.email) LIKE $2
           LIMIT 1`,
          [leaderMember.prn, `${leaderMember.prn.toLowerCase()}@%`]
        );
        if (uRes.rows.length > 0) leaderUserId = uRes.rows[0].id;
      }

      // Group: NO guides assigned (guide_id, seminar_guide_id, guide_name all NULL)
      const grpRes = await client.query(
        `INSERT INTO seminar_groups (
           session_id, group_no, domain, domain_raw, guide_id, seminar_guide_id, guide_name,
           leader_user_id, leader_prn, status, submitted_at, allow_edit
         )
         VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, $6, 'APPROVED', NOW(), FALSE)
         RETURNING id`,
        [
          sessionId,
          g.group_no,
          g.domain,
          g.domain_raw,
          leaderUserId,
          leaderMember ? leaderMember.prn : null,
        ]
      );
      const groupId = grpRes.rows[0].id;

      // Insert members
      for (const m of g.members) {
        await client.query(
          `INSERT INTO seminar_group_members (
             group_id, member_index, student_name, prn, prn_status, division, mobile, email,
             topic1, topic2, topic3, is_leader
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            groupId,
            m.member_index,
            m.student_name,
            m.prn,
            m.prn_status,
            m.division,
            m.mobile,
            m.email,
            m.topic1,
            m.topic2,
            m.topic3,
            m.is_leader,
          ]
        );
        memberCount++;
      }

      // Complete registration for new session
      await client.query(
        `INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
         VALUES ($1, $2, $3, NOW(), 'REGISTERED')`,
        [groupId, sessionId, leaderUserId || coordId]
      );
      regCount++;
    }

    await client.query('COMMIT');

    console.log(`\n===============================================================`);
    console.log(`  SESSION RECREATION & REGISTRATION COMPLETE`);
    console.log(`===============================================================`);
    console.log(`✓ Session ID: ${sessionId} ("${session.name}")`);
    console.log(`✓ Groups Imported: ${filteredGroups.length} (Groups #6 and #31 left out)`);
    console.log(`✓ Total Members Enrolled: ${memberCount}`);
    console.log(`✓ Total Registrations Completed: ${regCount}`);
    console.log(`✓ Assigned Guides: 0 (No guides assigned, as requested)`);
    console.log(`✓ Session Status: PUBLISHED (is_locked: false)`);
    console.log(`===============================================================\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Fatal error recreating session and importing:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

recreateSessionAndImport();
