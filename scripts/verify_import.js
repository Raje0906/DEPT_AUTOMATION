'use strict';

require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../db/pool');
const { CANONICAL_GUIDES } = require('./import_ay2025_26_sem1');

async function verifyDatabase() {
  const filePath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');
  const wb = xlsx.readFile(filePath);
  const countSheet = wb.Sheets['count'];
  const countRows = xlsx.utils.sheet_to_json(countSheet, { header: 1 });
  const expectedQuotas = {};
  for (let r = 4; r < countRows.length; r++) {
    const row = countRows[r];
    if (row && row[3] && row[4] !== undefined && row[3] !== 'Guide') {
      expectedQuotas[String(row[3]).trim()] = Number(row[4]);
    }
  }

  const client = await pool.connect();
  let passCount = 0;
  let failCount = 0;

  function report(name, passed, detail = '') {
    if (passed) {
      console.log(`[PASS] ${name}${detail ? ' -> ' + detail : ''}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ' -> ' + detail : ''}`);
      failCount++;
    }
  }

  try {
    const sessRes = await client.query(
      `SELECT id, name, academic_year, status FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );
    if (!sessRes.rows.length) {
      console.error('[FAIL] Active Session "AY 2025-26 Sem 1" not found in database!');
      process.exit(1);
    }
    const sessionId = sessRes.rows[0].id;
    console.log(`\n===============================================================`);
    console.log(`       SEMINAR DATABASE VERIFICATION (Session ID: ${sessionId})     `);
    console.log(`===============================================================\n`);

    // 1. Group Count = 54
    const grpRes = await client.query(
      `SELECT * FROM seminar_groups WHERE session_id = $1 ORDER BY group_no ASC`,
      [sessionId]
    );
    report('54 groups exist in active session', grpRes.rows.length === 54, `Count: ${grpRes.rows.length}`);

    // 2. Student Count = 201
    const memRes = await client.query(
      `SELECT sgm.*, sg.group_no, sg.guide_name, sg.domain 
       FROM seminar_group_members sgm
       JOIN seminar_groups sg ON sg.id = sgm.group_id
       WHERE sg.session_id = $1 ORDER BY sg.group_no, sgm.member_index`,
      [sessionId]
    );
    report('201 students exist across groups', memRes.rows.length === 201, `Count: ${memRes.rows.length}`);

    // 3. Unique Guides = 15
    const guiRes = await client.query(
      `SELECT * FROM seminar_guides WHERE session_id = $1 ORDER BY display_order ASC`,
      [sessionId]
    );
    report('Exactly 15 unique guides configured', guiRes.rows.length === 15, `Count: ${guiRes.rows.length}`);

    // 4. Per-guide counts match "count" sheet
    const guideGrpCounts = {};
    grpRes.rows.forEach(g => {
      // Find matching initials
      const match = CANONICAL_GUIDES.find(cg => cg.name === g.guide_name);
      const init = match ? match.initials : g.guide_name;
      guideGrpCounts[init] = (guideGrpCounts[init] || 0) + 1;
    });

    let allQuotasMatch = true;
    CANONICAL_GUIDES.forEach(g => {
      const exp = expectedQuotas[g.initials] || g.defaultQuota;
      const actual = guideGrpCounts[g.initials] || 0;
      if (exp !== actual) allQuotasMatch = false;
    });
    report('All 15 guides match group counts from "count" sheet', allQuotasMatch, '54 groups allocated');

    // 5. Conflict PRNs: both people exist in their own groups
    // F23111027: Anuj Nanhe in G11, Aditya Survase in G12
    const anuj = memRes.rows.find(m => m.group_no === 11 && m.prn === 'F23111027');
    const aditya = memRes.rows.find(m => m.group_no === 12 && m.prn === 'F23111027');
    const c1Pass = Boolean(anuj && aditya && anuj.prn_status === 'conflict' && aditya.prn_status === 'conflict');
    report('Conflict PRN F23111027: Anuj Nanhe (G11) and Aditya Survase (G12) both exist', c1Pass);

    // F23111054: Prachi Kumar Nailkar in G2, Hrishikesh Parshuram Rathod in G36
    const prachi = memRes.rows.find(m => m.group_no === 2 && m.prn === 'F23111054');
    const hrishi = memRes.rows.find(m => m.group_no === 36 && m.prn === 'F23111054');
    const c2Pass = Boolean(prachi && hrishi && prachi.prn_status === 'conflict' && hrishi.prn_status === 'conflict');
    report('Conflict PRN F23111054: Prachi (G2) and Hrishikesh (G36) both exist', c2Pass);

    // F23113048: Swanand Sankpal in G22, Shrikant Dhore in G39
    const swanand = memRes.rows.find(m => m.group_no === 22 && m.prn === 'F23113048');
    const shrikant = memRes.rows.find(m => m.group_no === 39 && m.prn === 'F23113048');
    const c3Pass = Boolean(swanand && shrikant && swanand.prn_status === 'conflict' && shrikant.prn_status === 'conflict');
    report('Conflict PRN F23113048: Swanand (G22) and Shrikant (G39) both exist', c3Pass);

    // 6. Invalid-PRN student exists (Omkar gaykwad in Group 53 with prn IS NULL and prn_status = 'missing')
    const omkar = memRes.rows.find(m => m.group_no === 53 && m.student_name.toLowerCase().includes('omkar'));
    const omkarPass = Boolean(omkar && omkar.prn === null && omkar.prn_status === 'missing');
    report('Invalid PRN student Omkar gaykwad exists with prn NULL & prn_status missing', omkarPass, `Group ${omkar?.group_no}`);

    // 7. All 7 no-form students exist with null contacts
    const known7 = ['F23113020', 'F23113028', 'F23113034', 'F23113047', 'F23113050', 'F22111016', 'F22111037'];
    let all7Pass = true;
    known7.forEach(p => {
      const found = memRes.rows.find(m => m.prn === p);
      if (!found || found.email !== null || found.mobile !== null || found.division !== null) {
        all7Pass = false;
      }
    });
    report('All 7 no-form students exist with null email/mobile/division', all7Pass, known7.join(', '));

    // 8. F23112060 is NOT in any group in the database
    const formOnly = memRes.rows.find(m => m.prn === 'F23112060');
    report('Form-only student F23112060 is NOT assigned to any group', formOnly === undefined);

    console.log(`\n---------------------------------------------------------------`);
    console.log(`Total Checks: ${passCount + failCount} | Passed: ${passCount} | Failed: ${failCount}`);
    console.log(`===============================================================\n`);

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDatabase().catch(err => {
  console.error('[Verification Fatal Error]', err);
  process.exit(1);
});
