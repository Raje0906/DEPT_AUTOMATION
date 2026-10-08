'use strict';

const XLSX = require('xlsx');
const pool = require('../db/pool');

/**
 * Import BE Project groups and student members from an Excel workbook
 * @param {object} wb - XLSX workbook instance
 * @param {string} acadYear - Academic year (e.g. '2026-27')
 * @returns {Promise<{ groupsCount: number, membersCount: number }>}
 */
async function importBEProjectWorkbook(wb, acadYear = '2026-27') {
  if (!wb) {
    throw new Error('No workbook provided');
  }

  const s1Sheet = wb.Sheets['Form Responses 1'] || wb.Sheets[wb.SheetNames[0]];
  const s2Sheet = wb.Sheets['Sheet2'] || wb.Sheets[wb.SheetNames[1]];

  const s1 = s1Sheet ? XLSX.utils.sheet_to_json(s1Sheet) : [];
  const s2 = s2Sheet ? XLSX.utils.sheet_to_json(s2Sheet, { header: 1 }) : [];

  // Parse Sheet2 groups if present
  const groupsList = [];
  if (s2.length > 0) {
    let curGroup = null;
    for (const row of s2) {
      if (row[0] !== undefined && row[0] !== null && typeof row[0] === 'number') {
        if (curGroup) groupsList.push(curGroup);
        curGroup = {
          groupNo: row[0],
          domain: row[4] ? String(row[4]).trim() : '',
          guide: row[5] ? String(row[5]).trim() : '',
          titles: row[6] ? [String(row[6]).trim()] : [],
          students: [{
            name: row[1] ? String(row[1]).trim() : '',
            prn: row[2] ? String(row[2]).trim() : '',
            division: row[3] ? String(row[3]).trim() : ''
          }]
        };
      } else if (curGroup && (row[1] || row[2])) {
        const name = row[1] ? String(row[1]).trim() : '';
        const prn = row[2] ? String(row[2]).trim() : '';
        const div = row[3] ? String(row[3]).trim() : '';
        if (name && name !== '-' && prn && prn !== '-') {
          curGroup.students.push({ name, prn, division: div });
        }
        if (row[6]) curGroup.titles.push(String(row[6]).trim());
      } else if (curGroup && row[6]) {
        curGroup.titles.push(String(row[6]).trim());
      }
    }
    if (curGroup) groupsList.push(curGroup);
  }

  // Fallback: If Sheet2 wasn't structured or empty, construct from Form Responses 1
  if (groupsList.length === 0 && s1.length > 0) {
    s1.forEach((resp, idx) => {
      const gNo = idx + 1;
      const students = [];
      for (let k = 1; k <= 4; k++) {
        const name = (resp[`Name of Student${k === 1 ? '1' : `-${k}`}`] || resp[`Name of Student-${k}`] || '').toString().trim();
        const prn = (resp[`Student-${k === 4 ? '' : k} PRN No ${k === 1 || k === 2 ? '(College PRN)' : ''}`] ||
                     resp[`Student-PRN No `] ||
                     resp[`Student-${k} PRN No`] || '').toString().trim();
        const div = (resp[`Student ${k} Division`] || 'BE-1').toString().trim();
        if (name && name !== '-' && prn && prn !== '-') {
          students.push({ name, prn, division: div });
        }
      }
      groupsList.push({
        groupNo: gNo,
        domain: (resp['Project Domain (Write project Domain Name)'] || resp['Domain Name'] || '').toString().trim(),
        guide: '',
        titles: [
          (resp['Project Title 1'] || resp['Project Topic 1'] || '').toString().trim(),
          (resp['Project Title 2'] || resp['Project Topic 2'] || '').toString().trim(),
          (resp['Project Title 3'] || resp['Project Topic 3'] || '').toString().trim(),
        ].filter(Boolean),
        students
      });
    });
  }

  if (groupsList.length === 0) {
    throw new Error('Could not parse any project groups from the provided Excel workbook.');
  }

  // Fetch all existing students and users for foreign key resolution
  const dbStudents = await pool.query(`
    SELECT s.id as student_id, s.user_id, s.roll_no, s.enrollment_no, s.division, s.batch,
           u.name, u.email
    FROM students s
    JOIN users u ON s.user_id = u.id
  `);

  const studentByPRN = new Map();
  const studentByEmail = new Map();

  for (const s of dbStudents.rows) {
    if (s.enrollment_no) studentByPRN.set(s.enrollment_no.trim().toUpperCase(), s);
    if (s.roll_no) studentByPRN.set(s.roll_no.trim().toUpperCase(), s);
    if (s.email) studentByEmail.set(s.email.trim().toLowerCase(), s);
  }

  const typoPrnMap = {
    'F2311007': 'F23111007',
    'F2313051': 'F23113051',
    'F22113077': 'F23113077',
    'F22111037': '72236970M'
  };

  function findStudentMatch(studentObj, formResp) {
    let cleanPrn = (studentObj.prn || '').toUpperCase().trim();
    if (typoPrnMap[cleanPrn]) cleanPrn = typoPrnMap[cleanPrn];

    let match = studentByPRN.get(cleanPrn);

    if (!match && formResp) {
      for (let k = 1; k <= 4; k++) {
        const em = (formResp[`Student ${k} Email ID`] || '').toString().trim().toLowerCase();
        if (em && studentByEmail.get(em)) {
          match = studentByEmail.get(em);
          break;
        }
      }
    }

    if (!match && studentObj.name) {
      const sWords = studentObj.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      match = dbStudents.rows.find(dbS => {
        const dbWords = dbS.name.toLowerCase().split(/\s+/);
        return sWords.every(w => dbWords.some(dw => dw.includes(w) || w.includes(dw)));
      });
    }

    return match || null;
  }

  const hodRes = await pool.query(`SELECT id FROM users WHERE role = 'hod' LIMIT 1`);
  const fallbackUserId = hodRes.rows[0]?.id || 1;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove existing groups for target academic year
    await client.query(`DELETE FROM project_groups WHERE academic_year = $1`, [acadYear]);

    let importedGroupsCount = 0;
    let importedMembersCount = 0;

    for (const g of groupsList) {
      const prns = g.students.map(s => s.prn.toUpperCase());
      const resp = s1.find(r => {
        const rPrns = [
          r['Student-1 PRN No (College PRN)'],
          r['Student-2 PRN No (College PRN)'],
          r['Student-3 PRN No '],
          r['Student- PRN No ']
        ].map(p => (p || '').toString().trim().toUpperCase()).filter(Boolean);
        return prns.some(p => rPrns.includes(p));
      });

      let domain = g.domain;
      if (!domain && resp && resp['Project Domain (Write project Domain Name)']) {
        domain = String(resp['Project Domain (Write project Domain Name)']).trim();
      }
      if (!domain) domain = 'General';

      let t1 = '';
      let t2 = '';
      let t3 = '';
      if (resp) {
        t1 = (resp['Project Title 1'] || g.titles[0] || '').toString().trim().replace(/^[1-3]\.\s*/, '');
        t2 = (resp['Project Title 2'] || g.titles[1] || '').toString().trim().replace(/^[1-3]\.\s*/, '');
        t3 = (resp['Project Title 3'] || g.titles[2] || '').toString().trim().replace(/^[1-3]\.\s*/, '');
      } else {
        t1 = (g.titles[0] || 'Untitled Project').replace(/^[1-3]\.\s*/, '');
        t2 = (g.titles[1] || '').replace(/^[1-3]\.\s*/, '');
        t3 = (g.titles[2] || '').replace(/^[1-3]\.\s*/, '');
      }
      if (!t1) t1 = 'Project Preference Topic 1';

      const yearPrefix = acadYear.split('-')[0];
      const groupCode = `GRP-${yearPrefix}-${String(g.groupNo).padStart(2, '0')}`;
      const batchDiv = g.students[0]?.division || 'BE-1';

      const leaderStudentObj = g.students[0];
      const leaderMatch = leaderStudentObj ? findStudentMatch(leaderStudentObj, resp) : null;
      const createdByUserId = leaderMatch ? leaderMatch.user_id : fallbackUserId;

      const insertGroupRes = await client.query(
        `INSERT INTO project_groups (
          group_code, academic_year, batch, title, title_2, title_3, domain, abstract, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9)
        RETURNING id`,
        [groupCode, acadYear, batchDiv, t1, t2, t3, domain, '', createdByUserId]
      );
      const groupId = insertGroupRes.rows[0].id;
      importedGroupsCount++;

      for (let i = 0; i < g.students.length; i++) {
        const s = g.students[i];
        if (!s.name || s.name === '-' || !s.prn || s.prn === '-') continue;

        const isLeader = (i === 0);
        const match = findStudentMatch(s, resp);

        let email = '';
        let mobile = '';
        if (resp) {
          const sPrnClean = s.prn.toUpperCase().trim();
          for (let k = 1; k <= 4; k++) {
            const rP = (resp[`Student-${k === 4 ? '' : k} PRN No ${k === 1 || k === 2 ? '(College PRN)' : ''}`] ||
                        resp[`Student-PRN No `] ||
                        resp[`Student-${k} PRN No`]) || '';
            if (rP.toString().trim().toUpperCase() === sPrnClean) {
              email = (resp[`Student ${k} Email ID`] || '').toString().trim();
              mobile = (resp[`Student ${k} Mobile No`] || '').toString().trim();
              break;
            }
          }
        }

        if (!email && match?.email) email = match.email;
        if (!email) email = `${s.prn.toLowerCase()}@meswadiacoe.edu`;

        await client.query(
          `INSERT INTO project_group_members (
            group_id, student_id, roll_no, student_name, email, mobile_no, division, is_leader
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            groupId,
            match ? match.student_id : null,
            s.prn,
            match ? match.name : s.name,
            email,
            mobile,
            s.division || batchDiv,
            isLeader
          ]
        );
        importedMembersCount++;
      }
    }

    await client.query('COMMIT');
    return { groupsCount: importedGroupsCount, membersCount: importedMembersCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { importBEProjectWorkbook };
