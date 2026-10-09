'use strict';

require('dotenv').config();
const path = require('path');
const xlsx = require('xlsx');
const pool = require('../db/pool');

// Canonical domain mapping table
const DOMAIN_MAPPING = {
  'AI': 'AI/ML',
  'AIML': 'AI/ML',
  'ML': 'AI/ML',
  'Machine learning': 'AI/ML',
  'Machine Learning': 'AI/ML',
  'Artificial Intelligence': 'AI/ML',
  'Artificial Intelligence/ML': 'AI/ML',
  'AI/ML': 'AI/ML',
  'AI - ML': 'AI/ML',
  'AI/ML/DL': 'AI/ML',
  'Data Science': 'Data Science',
  'Data science': 'Data Science',
  'Data Science analysis and Visualization': 'Data Science',
  'Data Analytics': 'Data Science',
  'Cyber security': 'Cybersecurity',
  'CyberSecurity': 'Cybersecurity',
  'Cybersecurity': 'Cybersecurity',
  'security': 'Cybersecurity',
  'AI in Cybersecurity': 'Cybersecurity',
  'CC': 'Cloud Computing',
  'Cloud Computing': 'Cloud Computing',
  'soft computing': 'AI/ML',
  'Game Development': 'Software Development / Web / Mobile App',
  'Web Development': 'Software Development / Web / Mobile App',
  'Web Tec and AI': 'Software Development / Web / Mobile App',
  'app development': 'Software Development / Web / Mobile App',
  'Signature verification system': 'AI/ML',
  'Real life problem related to both urban and rural city': 'General Computing',
};

function normalizeDomain(raw) {
  if (!raw) return { domain: 'General Computing', domain_raw: '' };
  const trimmed = String(raw).trim();
  const canonical = DOMAIN_MAPPING[trimmed] || trimmed;
  return { domain: canonical, domain_raw: trimmed };
}

function normalizeName(name) {
  if (!name) return '';
  return String(name).replace(/\s+/g, ' ').trim();
}

function cleanPrn(rawPrn) {
  if (!rawPrn) return { prn: null, status: 'missing' };
  let str = String(rawPrn).replace(/[\s\u00A0\u200B]+/g, '').trim().toUpperCase();
  if (!str || str === '.' || str === '..' || str === '-' || str === 'NULL') {
    return { prn: null, status: 'missing' };
  }
  const isValid = /^F\d{8}$/i.test(str) || /^\d{8}[A-Z]$/i.test(str);
  return {
    prn: str,
    status: isValid ? 'valid' : 'invalid',
  };
}

function cleanMobile(rawMobile) {
  if (!rawMobile) return null;
  const digits = String(rawMobile).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
}

function cleanEmail(rawEmail) {
  if (!rawEmail) return null;
  const str = String(rawEmail).trim().toLowerCase();
  if (str.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return str;
  }
  return null;
}

function cleanTopic(rawTopic) {
  if (!rawTopic) return '';
  let str = String(rawTopic).trim();
  if (str === '.' || str === '-' || str === '..') return '';
  // Strip leading numbering e.g. "1.", "2.", "3.", "1)", etc.
  str = str.replace(/^[1-3][\.\)\-]\s*/, '').trim();
  // Strip trailing "Domain: ..." fragment
  str = str.replace(/\s*Domain:.*$/i, '').trim();
  // Strip leading/trailing quotes
  str = str.replace(/^["']|["']$/g, '').trim();
  return str;
}

// Known shared/conflict PRNs
const CONFLICT_PRNS = new Set(['F23111027', 'F23111054', 'F23113048']);

async function parseWorkbook(filePath) {
  const wb = xlsx.readFile(filePath);

  // 1. Read Form Responses 1
  const formSheet = wb.Sheets['Form Responses 1'];
  const formRows = xlsx.utils.sheet_to_json(formSheet, { defval: '' });
  
  const formStudents = [];
  formRows.forEach((row, formIdx) => {
    // Find leader email & mobile from row keys
    let leaderEmail = null;
    let leaderMobile = null;
    Object.keys(row).forEach(k => {
      if (/e-?mail.*(leader|student-?1)/i.test(k)) leaderEmail = cleanEmail(row[k]);
      if (/mobile.*(leader|student-?1)/i.test(k)) leaderMobile = cleanMobile(row[k]);
    });

    for (let st = 1; st <= 4; st++) {
      let rawName = '';
      let rawPrn = '';
      let rawDiv = '';
      let rawEmail = '';
      let rawMobile = '';
      let rawT1 = '';
      let rawT2 = '';
      let rawT3 = '';

      const stPattern = new RegExp(`student[\\s\\-_]*${st}\\b`, 'i');

      Object.keys(row).forEach(k => {
        if (stPattern.test(k)) {
          if (/name/i.test(k)) rawName = row[k];
          else if (/prn/i.test(k)) rawPrn = row[k];
          else if (/div/i.test(k)) rawDiv = row[k];
          else if (/e-?mail/i.test(k)) rawEmail = row[k];
          else if (/mob/i.test(k) || /phone/i.test(k)) rawMobile = row[k];
          else if (/topic1/i.test(k) || /topic\s*1/i.test(k)) rawT1 = row[k];
          else if (/topic2/i.test(k) || /topic\s*2/i.test(k)) rawT2 = row[k];
          else if (/topic3/i.test(k) || /topic\s*3/i.test(k)) rawT3 = row[k];
        }
      });

      const name = normalizeName(rawName);
      const prnInfo = cleanPrn(rawPrn);
      const div = normalizeName(rawDiv);
      const email = cleanEmail(rawEmail) || (st === 1 ? leaderEmail : null);
      const mobile = cleanMobile(rawMobile) || (st === 1 ? leaderMobile : null);
      const t1 = cleanTopic(rawT1);
      const t2 = cleanTopic(rawT2);
      const t3 = cleanTopic(rawT3);

      if (name || prnInfo.prn || rawPrn === '..' || rawName === '..') {
        formStudents.push({
          formIdx: formIdx + 1,
          stIndex: st,
          name,
          prn: prnInfo.prn,
          rawPrn: String(rawPrn || ''),
          rawName: String(rawName || ''),
          division: div,
          email,
          mobile,
          topic1: t1,
          topic2: t2,
          topic3: t3,
          isLeader: st === 1,
        });
      }
    }
  });

  // 2. Read Groups with Guide (Source of Truth)
  const groupSheet = wb.Sheets['Groups with Guide'];
  const groupRawRows = xlsx.utils.sheet_to_json(groupSheet, { header: 1 });

  const groups = [];
  let currentGroup = null;
  let forwardGroupNo = null;
  let forwardDomain = '';
  let forwardGuide = '';

  for (let r = 6; r < groupRawRows.length; r++) {
    const row = groupRawRows[r];
    if (!row || row.length === 0 || row.every(c => c === undefined || c === null || String(c).trim() === '')) {
      if (currentGroup && currentGroup.members.length > 0) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      continue;
    }

    const rawGNo = row[0];
    const rawName = row[1];
    const rawPrn = row[2];
    const rawT1 = row[3];
    const rawT2 = row[4];
    const rawT3 = row[5];
    const rawDom = row[6];
    const rawGuide = row[7];

    if (rawGNo !== undefined && rawGNo !== null && String(rawGNo).trim() !== '') {
      const parsedGNo = parseInt(String(rawGNo).trim(), 10);
      if (!isNaN(parsedGNo)) {
        if (currentGroup && currentGroup.members.length > 0) {
          groups.push(currentGroup);
        }
        forwardGroupNo = parsedGNo;
        forwardDomain = rawDom ? String(rawDom).trim() : '';
        forwardGuide = rawGuide ? String(rawGuide).trim() : '';

        currentGroup = {
          group_no: forwardGroupNo,
          domain_raw: forwardDomain,
          guide_name: normalizeName(forwardGuide),
          members: [],
        };
      }
    }

    if (currentGroup && (rawName || rawPrn)) {
      const studentName = normalizeName(rawName);
      const prnObj = cleanPrn(rawPrn);
      
      let prnStatus = prnObj.status;
      if (prnObj.prn && CONFLICT_PRNS.has(prnObj.prn)) {
        prnStatus = 'conflict';
      }

      let t1 = cleanTopic(rawT1);
      let t2 = cleanTopic(rawT2);
      let t3 = cleanTopic(rawT3);

      currentGroup.members.push({
        student_name: studentName,
        prn: prnObj.prn,
        prn_status: prnStatus,
        topic1: t1,
        topic2: t2,
        topic3: t3,
        source_row: r + 1,
      });
    }
  }

  if (currentGroup && currentGroup.members.length > 0) {
    groups.push(currentGroup);
  }

  // 3. Enrich Groups with Form Responses
  const matchedFormEntries = new Set();
  const edgeCases = {
    conflictPrns: [],
    missingPrns: [],
    noFormStudents: [],
    unassignedFormSubmissions: [],
  };

  groups.forEach(g => {
    const { domain, domain_raw } = normalizeDomain(g.domain_raw);
    g.domain = domain;
    g.domain_raw = domain_raw;

    g.members.forEach((m, idx) => {
      m.member_index = idx + 1;
      m.is_leader = idx === 0;

      if (m.prn_status === 'conflict') {
        edgeCases.conflictPrns.push({ group_no: g.group_no, name: m.student_name, prn: m.prn });
      }
      if (m.prn_status === 'missing') {
        edgeCases.missingPrns.push({ group_no: g.group_no, name: m.student_name });
      }

      // Match to form data
      let formMatch = null;
      if (m.prn && m.prn_status === 'conflict') {
        // Must match PRN AND Name for conflict cases
        formMatch = formStudents.find(fs => fs.prn === m.prn && (
          fs.name.toLowerCase().includes(m.student_name.toLowerCase().split(' ')[0]) ||
          m.student_name.toLowerCase().includes(fs.name.toLowerCase().split(' ')[0])
        ));
      } else if (m.prn) {
        formMatch = formStudents.find(fs => fs.prn === m.prn);
      } else if (m.student_name) {
        formMatch = formStudents.find(fs => fs.name && fs.name.toLowerCase() === m.student_name.toLowerCase());
      }

      if (formMatch) {
        matchedFormEntries.add(formMatch);
        m.email = formMatch.email || null;
        m.mobile = formMatch.mobile || null;
        m.division = formMatch.division || null;

        if (!m.topic1 && formMatch.topic1) m.topic1 = formMatch.topic1;
        if (!m.topic2 && formMatch.topic2) m.topic2 = formMatch.topic2;
        if (!m.topic3 && formMatch.topic3) m.topic3 = formMatch.topic3;
      } else {
        m.email = null;
        m.mobile = null;
        m.division = null;
        edgeCases.noFormStudents.push({ group_no: g.group_no, name: m.student_name, prn: m.prn });
      }
    });
  });

  // Collect unassigned form submissions (Edge Case 5)
  formStudents.forEach(fs => {
    if (!matchedFormEntries.has(fs)) {
      edgeCases.unassignedFormSubmissions.push({
        formRow: fs.formIdx,
        name: fs.name || fs.rawName || '—',
        prn: fs.prn || fs.rawPrn || '—',
        division: fs.division || '—',
      });
    }
  });

  return { groups, edgeCases };
}

async function runDryRun(filePath) {
  console.log('===============================================================');
  console.log('              DRY RUN: AY 2025-26 Sem 1 Import                ');
  console.log('===============================================================');

  const { groups, edgeCases } = await parseWorkbook(filePath);
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);

  console.log(`\n✓ Groups Found: ${groups.length}`);
  console.log(`✓ Total Students in Groups: ${totalStudents}`);

  const size4 = groups.filter(g => g.members.length === 4).length;
  const size3 = groups.filter(g => g.members.length === 3).length;
  const size2 = groups.filter(g => g.members.length === 2).length;
  console.log(`✓ Group Sizes: 4-member: ${size4}, 3-member: ${size3}, 2-member: ${size2}`);

  const guideMap = new Map();
  groups.forEach(g => {
    guideMap.set(g.guide_name, (guideMap.get(g.guide_name) || 0) + 1);
  });
  console.log(`\n✓ Unique Guides (${guideMap.size}):`);
  console.table(Array.from(guideMap.entries()).map(([guide, count]) => ({ guide, groups: count })));

  console.log('\n--- EDGE CASES REPORT ---');
  console.log(`1. Duplicate / Conflict PRNs (${edgeCases.conflictPrns.length}):`);
  console.table(edgeCases.conflictPrns);

  console.log(`2. Missing / Invalid PRNs (${edgeCases.missingPrns.length}):`);
  console.table(edgeCases.missingPrns);

  console.log(`3. Students with NO Form Row (${edgeCases.noFormStudents.length}):`);
  console.table(edgeCases.noFormStudents);

  console.log(`4. Unassigned Form Submissions (${edgeCases.unassignedFormSubmissions.length}):`);
  console.table(edgeCases.unassignedFormSubmissions);

  const existingSessions = await pool.query('SELECT id, name, academic_year, status, created_at FROM seminar_sessions ORDER BY id');
  console.log('\n--- EXISTING SESSIONS IN DATABASE ---');
  console.table(existingSessions.rows);

  return { groups, edgeCases, existingSessions: existingSessions.rows };
}

async function executeImport(filePath) {
  const { groups, edgeCases } = await parseWorkbook(filePath);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Ensure prn_status column exists and prn is nullable in seminar_group_members
    await client.query(`
      ALTER TABLE seminar_group_members 
      ADD COLUMN IF NOT EXISTS prn_status VARCHAR(20) DEFAULT 'valid';
      ALTER TABLE seminar_group_members ALTER COLUMN prn DROP NOT NULL;
    `);

    // 2. Lookup seminar coordinator user id (SSR)
    let coordId = 10;
    const coordRes = await client.query('SELECT id FROM users WHERE email = $1', ['ssr@meswadiacoe.edu']);
    if (coordRes.rows.length > 0) coordId = coordRes.rows[0].id;

    // 3. Create or update active session "AY 2025-26 Sem 1"
    let sessionId;
    const sessCheck = await client.query(
      `SELECT id FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );

    if (sessCheck.rows.length > 0) {
      sessionId = sessCheck.rows[0].id;
      await client.query(
        `UPDATE seminar_sessions 
         SET name = 'AY 2025-26 Sem 1', academic_year = '2025-26', batch = 'TE', status = 'PUBLISHED', is_locked = false
         WHERE id = $1`,
        [sessionId]
      );
      await client.query('DELETE FROM registrations WHERE seminar_id = $1', [sessionId]);
      await client.query('DELETE FROM seminar_group_members WHERE group_id IN (SELECT id FROM seminar_groups WHERE session_id = $1)', [sessionId]);
      await client.query('DELETE FROM seminar_groups WHERE session_id = $1', [sessionId]);
      await client.query('DELETE FROM seminar_guides WHERE session_id = $1', [sessionId]);
    } else {
      const newSess = await client.query(
        `INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by, is_locked)
         VALUES ('AY 2025-26 Sem 1', '2025-26', 'TE', 'PUBLISHED', $1, false)
         RETURNING id`,
        [coordId]
      );
      sessionId = newSess.rows[0].id;
    }

    console.log(`[Import] Target Session ID: ${sessionId} ("AY 2025-26 Sem 1")`);

    // 4. Map Guides to Faculty Table
    const facultyRes = await client.query(`
      SELECT f.id as faculty_id, f.employee_id, f.designation, u.name, u.email
      FROM faculty f
      JOIN users u ON f.user_id = u.id
    `);
    const facultyList = facultyRes.rows;

    function findFaculty(guideName) {
      const gNorm = normalizeName(guideName).toLowerCase().replace(/dr\.|mrs\.|mr\.|ms\./gi, '').replace(/[^a-z]/g, '');
      return facultyList.find(f => {
        const fNorm = normalizeName(f.name).toLowerCase().replace(/dr\.|mrs\.|mr\.|ms\./gi, '').replace(/[^a-z]/g, '');
        return fNorm.includes(gNorm) || gNorm.includes(fNorm) || f.employee_id.toLowerCase() === gNorm;
      });
    }

    // Insert seminar_guides
    const guideMap = new Map();
    const uniqueGuideNames = Array.from(new Set(groups.map(g => g.guide_name)));

    for (let i = 0; i < uniqueGuideNames.length; i++) {
      const gName = uniqueGuideNames[i];
      const fac = findFaculty(gName);
      const quota = groups.filter(g => g.guide_name === gName).length;

      const gRes = await client.query(
        `INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, initials, quota, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          sessionId,
          fac ? fac.faculty_id : null,
          gName,
          fac ? fac.designation : 'Assistant Professor',
          fac ? fac.employee_id : null,
          quota,
          i + 1,
        ]
      );
      guideMap.set(gName, {
        seminar_guide_id: gRes.rows[0].id,
        faculty_id: fac ? fac.faculty_id : null,
      });
    }

    // 5. Insert Groups, Members, and Registrations
    for (const g of groups) {
      const guideInfo = guideMap.get(g.guide_name) || {};

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

      const grpRes = await client.query(
        `INSERT INTO seminar_groups (
           session_id, group_no, domain, domain_raw, guide_id, seminar_guide_id, guide_name,
           leader_user_id, leader_prn, status, submitted_at, allow_edit
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', NOW(), false)
         RETURNING id`,
        [
          sessionId,
          g.group_no,
          g.domain,
          g.domain_raw,
          guideInfo.faculty_id || null,
          guideInfo.seminar_guide_id || null,
          g.guide_name,
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
      }

      // Insert shared group registration
      await client.query(
        `INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
         VALUES ($1, $2, $3, NOW(), 'REGISTERED')
         ON CONFLICT (group_id) DO NOTHING`,
        [groupId, sessionId, leaderUserId || coordId]
      );
    }

    await client.query('COMMIT');
    console.log('\n✓ LIVE IMPORT COMPLETED SUCCESSFULLY IN SINGLE TRANSACTION!');
    console.log(`✓ 54 Groups and 201 Students active in Session ${sessionId} ("AY 2025-26 Sem 1").`);
    return { success: true, sessionId };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Import Error] Rolled back transaction:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const filePath = path.resolve(__dirname, '../data/TE_Seminar_Project_Group_formation.xlsx');
  const isExecute = process.argv.includes('--execute');

  if (!isExecute) {
    await runDryRun(filePath);
    console.log('\nRun with "node scripts/import_ay2025_26_sem1.js --execute" to execute live import.');
    process.exit(0);
  } else {
    await executeImport(filePath);
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseWorkbook, normalizeDomain, cleanPrn, cleanMobile, cleanEmail, cleanTopic };
