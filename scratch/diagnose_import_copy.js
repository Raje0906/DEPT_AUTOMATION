'use strict';

require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../db/pool');

async function runDiagnosis() {
  const filePath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');
  console.log(`[Diagnosis] Reading workbook: ${filePath}`);
  const wb = xlsx.readFile(filePath);

  const gSheet = wb.Sheets['Groups with Guide'];
  const formSheet = wb.Sheets['Form Responses 1'];
  const countSheet = wb.Sheets['count'];

  const gRows = xlsx.utils.sheet_to_json(gSheet, { header: 1 });
  const formRows = xlsx.utils.sheet_to_json(formSheet, { header: 1 });
  const countRows = xlsx.utils.sheet_to_json(countSheet, { header: 1 });

  console.log(`Groups with Guide raw rows: ${gRows.length}`);
  console.log(`Form Responses 1 raw rows: ${formRows.length}`);
  console.log(`count raw rows: ${countRows.length}`);

  // Query Current Database state
  const client = await pool.connect();
  try {
    const sessRes = await client.query(`SELECT id, name, academic_year, status FROM seminar_sessions ORDER BY id DESC LIMIT 5`);
    console.log('\n--- Active Sessions in Database ---');
    console.table(sessRes.rows);

    const activeSessionId = sessRes.rows[0]?.id;
    let dbGroups = [];
    let dbMembers = [];
    let dbGuides = [];
    let dbRegistrations = [];

    if (activeSessionId) {
      const grpRes = await client.query(`SELECT * FROM seminar_groups WHERE session_id = $1 ORDER BY group_no`, [activeSessionId]);
      dbGroups = grpRes.rows;
      const memRes = await client.query(
        `SELECT sgm.*, sg.group_no FROM seminar_group_members sgm
         JOIN seminar_groups sg ON sg.id = sgm.group_id
         WHERE sg.session_id = $1 ORDER BY sg.group_no, sgm.member_index`,
        [activeSessionId]
      );
      dbMembers = memRes.rows;
      const guiRes = await client.query(`SELECT * FROM seminar_guides WHERE session_id = $1 ORDER BY display_order`, [activeSessionId]);
      dbGuides = guiRes.rows;
      const regRes = await client.query(`SELECT * FROM registrations WHERE seminar_id = $1`, [activeSessionId]);
      dbRegistrations = regRes.rows;
    }

    console.log(`\n--- Current DB Counts for Session ${activeSessionId} ---`);
    console.log(`Groups: ${dbGroups.length}`);
    console.log(`Members: ${dbMembers.length}`);
    console.log(`Guides: ${dbGuides.length}`);
    console.log(`Registrations: ${dbRegistrations.length}`);

    // Parse Expected Workbook Data
    // count sheet expected guides
    const expectedQuotas = {};
    for (let r = 4; r < countRows.length; r++) {
      const row = countRows[r];
      if (row && row[3] && row[4] !== undefined && row[3] !== 'Guide') {
        expectedQuotas[String(row[3]).trim()] = Number(row[4]);
      }
    }

    // Inspect Groups with Guide
    const workbookGroups = new Map();
    let curG = null;
    let curDom = null;
    let curGuide = null;
    const strayRows = [];

    for (let r = 6; r < gRows.length; r++) {
      const row = gRows[r];
      if (!row || row.length === 0 || row.every(c => !c || String(c).trim() === '')) continue;
      
      const rawGNo = row[0];
      const name = row[1] ? String(row[1]).trim() : '';
      const prn = row[2] ? String(row[2]).trim() : '';
      const t1 = row[3] ? String(row[3]).trim() : '';
      const t2 = row[4] ? String(row[4]).trim() : '';
      const t3 = row[5] ? String(row[5]).trim() : '';
      const dom = row[6] ? String(row[6]).trim() : '';
      const guide = row[7] ? String(row[7]).trim() : '';

      if (rawGNo !== undefined && rawGNo !== null && String(rawGNo).trim() !== '') {
        const parsed = parseInt(String(rawGNo).trim(), 10);
        if (!isNaN(parsed)) {
          curG = parsed;
          curDom = dom;
          curGuide = guide;
        }
      }

      if (!curG) {
        strayRows.push({ rowIdx: r + 1, row });
        continue;
      }

      if (!workbookGroups.has(curG)) {
        workbookGroups.set(curG, {
          group_no: curG,
          domain_raw: curDom,
          guide_raw: curGuide,
          students: [],
        });
      }

      // Check if student row has actual student data or empty row like row 78
      if (name || prn) {
        workbookGroups.get(curG).students.push({
          rowIdx: r + 1,
          name,
          prn,
          t1,
          t2,
          t3,
          dom: curDom,
          guide: curGuide,
        });
      }
    }

    console.log(`\n--- Workbook Groups Parsed ---`);
    console.log(`Total Groups: ${workbookGroups.size}`);
    let wbTotalStudents = 0;
    const sizeDistribution = {};
    for (const [gNo, grp] of workbookGroups.entries()) {
      const count = grp.students.length;
      wbTotalStudents += count;
      sizeDistribution[count] = (sizeDistribution[count] || 0) + 1;
    }
    console.log(`Total Students across all rows (including row 78 Harsh Pandav): ${wbTotalStudents}`);
    console.log('Group Size Distribution:', sizeDistribution);

    // Form responses extraction
    const formStudents = [];
    for (let i = 1; i < formRows.length; i++) {
      const row = formRows[i];
      if (!row || row.length === 0) continue;
      const leaderEmail = row[1] ? String(row[1]).trim() : '';

      const slots = [
        { name: row[2], prn: row[3], div: row[4], mob: row[5], email: leaderEmail, t1: row[6], t2: row[7], t3: row[8], is_leader: true },
        { name: row[9], prn: row[10], div: row[11], mob: row[12], email: row[13], t1: row[14], t2: row[15], t3: row[16], is_leader: false },
        { name: row[17], prn: row[18], div: row[19], mob: row[20], email: row[21], t1: row[22], t2: row[23], t3: row[24], is_leader: false },
        { name: row[25], prn: row[26], div: row[27], mob: row[28], email: row[29], t1: row[30], t2: row[31], t3: row[32], is_leader: false },
      ];

      slots.forEach((s, idx) => {
        const sName = s.name ? String(s.name).trim() : '';
        const sPrn = s.prn ? String(s.prn).trim() : '';
        if (sName || sPrn) {
          formStudents.push({
            formRow: i + 1,
            slot: idx + 1,
            name: sName,
            prn: sPrn,
            div: s.div ? String(s.div).trim() : '',
            mob: s.mob ? String(s.mob).trim() : '',
            email: s.email ? String(s.email).trim() : '',
            t1: s.t1 ? String(s.t1).trim() : '',
            t2: s.t2 ? String(s.t2).trim() : '',
            t3: s.t3 ? String(s.t3).trim() : '',
            is_leader: s.is_leader,
          });
        }
      });
    }

    console.log(`\nTotal Form Submissions slots populated: ${formStudents.length}`);

    // Check Differences & Edge Cases
    console.log('\n--- 1. Shared PRNs (Conflict Cases) ---');
    const conflictPrns = ['F23111027', 'F23111054', 'F23113048'];
    conflictPrns.forEach(cPrn => {
      console.log(`Conflict PRN: ${cPrn}`);
      const matches = [];
      for (const [gNo, grp] of workbookGroups.entries()) {
        grp.students.forEach(st => {
          if (st.prn.toUpperCase() === cPrn) {
            matches.push({ group_no: gNo, name: st.name, row: st.rowIdx });
          }
        });
      }
      console.table(matches);
    });

    console.log('\n--- 2. Invalid / Blank PRN ---');
    for (const [gNo, grp] of workbookGroups.entries()) {
      grp.students.forEach(st => {
        if (!st.prn || st.prn === '.' || st.prn === '..' || !/^F\d{8}$/i.test(st.prn)) {
          console.log(`Group ${gNo}, Row ${st.rowIdx}: "${st.name}", PRN: "${st.prn}"`);
        }
      });
    }

    console.log('\n--- 3. 7 Students with No Form Row ---');
    const known7 = ['F23113020', 'F23113028', 'F23113034', 'F23113047', 'F23113050', 'F22111016', 'F22111037'];
    known7.forEach(prn => {
      const inForm = formStudents.find(fs => fs.prn.toUpperCase() === prn);
      let inGroups = null;
      for (const [gNo, grp] of workbookGroups.entries()) {
        const found = grp.students.find(s => s.prn.toUpperCase() === prn);
        if (found) inGroups = { gNo, name: found.name };
      }
      console.log(`PRN ${prn}: inGroups=${JSON.stringify(inGroups)}, inForm=${Boolean(inForm)}`);
    });

    console.log('\n--- 4. Form-Only Submissions ---');
    const allGroupPrns = new Set();
    for (const grp of workbookGroups.values()) {
      grp.students.forEach(s => {
        if (s.prn) allGroupPrns.add(s.prn.toUpperCase());
      });
    }
    const unassignedForm = formStudents.filter(fs => !allGroupPrns.has(fs.prn.toUpperCase()));
    console.log(`Unassigned count: ${unassignedForm.length}`);
    console.table(unassignedForm.map(u => ({ formRow: u.formRow, name: u.name, prn: u.prn, div: u.div })));

    console.log('\n--- 5. Empty Topics in Groups with Guide (Fallback needed) ---');
    const emptyTopicGroups = [12, 19, 24, 43, 53, 54];
    emptyTopicGroups.forEach(gNo => {
      const grp = workbookGroups.get(gNo);
      const studentSummary = grp?.students.map(s => ({
        name: s.name,
        prn: s.prn,
        t1: s.t1,
        t2: s.t2,
        t3: s.t3,
      }));
      console.log(`Group ${gNo} Topics in Groups Sheet:`, studentSummary);
    });

    console.log('\n--- 6. Row 78 in Group 15 (Harsh Pandav) ---');
    const g15 = workbookGroups.get(15);
    console.log('Group 15 student rows in workbook:', g15.students);

  } finally {
    client.release();
    await pool.end();
  }
}

runDiagnosis().catch(err => {
  console.error('[Diagnosis Error]', err);
  process.exit(1);
});
