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
  'soft computing': 'AI/ML',
  'Signature verification system': 'AI/ML',
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
  'Web Development': 'Web & Mobile Development',
  'Web Tec and AI': 'Web & Mobile Development',
  'app development': 'Web & Mobile Development',
  'Game Development': 'Web & Mobile Development',
  'Real life problem related to both urban and rural city': 'Smart Systems & Societal Applications',
};

// 15 Canonical Guides Definition
const CANONICAL_GUIDES = [
  { name: 'Dr. (Mrs.) N. F. Shaikh',   initials: 'NFS',  email: 'nfs@meswadiacoe.edu',  designation: 'Associate Professor & HOD', defaultQuota: 4 },
  { name: 'Dr. (Mrs.) S. P. Khedkar',  initials: 'SPK',  email: 'spk@meswadiacoe.edu',  designation: 'Associate Professor',       defaultQuota: 4 },
  { name: 'Dr. (Mr.) B. K. Bodkhe',    initials: 'BKB',  email: 'bkb@meswadiacoe.edu',  designation: 'Associate Professor',       defaultQuota: 4 },
  { name: 'Mrs. S. S. Raskar',        initials: 'SSR',  email: 'ssr@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Dr. (Mr.) G. S. Pole',      initials: 'GSP',  email: 'gsp@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Ms. B. F. More',           initials: 'BFM',  email: 'bfm@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Ms. C. Y. Vakte',          initials: 'CYV',  email: 'cyv@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Mrs. A. A. Shahbad',       initials: 'AAS',  email: 'aas@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Ms. S. T. Chavan',         initials: 'STC',  email: 'stc@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 4 },
  { name: 'Mrs. V. D. Gaikwad',       initials: 'VDG',  email: 'vdg@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 3 },
  { name: 'Ms. A. K. Sandbhor',       initials: 'AKS',  email: 'aks@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 3 },
  { name: 'Mrs. S. D. Bhadane',       initials: 'SDB',  email: 'sdb@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 3 },
  { name: 'Ms. S. M. Shinde',         initials: 'SMS',  email: 'sms@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 3 },
  { name: 'Mr. S. A. Sopal',          initials: 'SAS1', email: 'sas1@meswadiacoe.edu', designation: 'Assistant Professor',       defaultQuota: 3 },
  { name: 'Dr. (Mrs.) A. P. Kale',    initials: 'APK',  email: 'apk@meswadiacoe.edu',  designation: 'Assistant Professor',       defaultQuota: 3 },
];

function normalizeDomain(raw) {
  if (!raw) return { domain: 'Unspecified', domain_raw: '' };
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
  const isValid = /^F\d{8}$/i.test(str);
  return {
    prn: str,
    status: isValid ? 'valid' : 'invalid',
  };
}

function cleanMobile(rawMobile) {
  if (!rawMobile) return { mobile: null, isBad: false };
  const str = String(rawMobile).trim();
  if (!str || str === '.' || str === '-' || str === '..') return { mobile: null, isBad: true };
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) return { mobile: digits, isBad: false };
  if (digits.length === 12 && digits.startsWith('91')) return { mobile: digits.slice(2), isBad: false };
  return { mobile: null, isBad: true };
}

function cleanEmail(rawEmail) {
  if (!rawEmail) return null;
  const str = String(rawEmail).trim().toLowerCase();
  if (!str || str === '.' || str === '-' || str === '..' || !str.includes('@')) {
    return null;
  }
  return str;
}

function cleanTopic(rawTopic) {
  if (!rawTopic) return '';
  let str = String(rawTopic).trim();
  if (!str || str === '.' || str === '-' || str === '..' || str === '--') return '';
  // Strip leading numbering e.g. "1.", "2.", "3.", "1)", "(1)", "1. ", etc.
  str = str.replace(/^(?:\(?\d+\)?[\.\-\:\)\s]+)+/g, '').trim();
  // Strip trailing "Domain: ..."
  str = str.replace(/\s*Domain:.*$/i, '').trim();
  // Strip surrounding quotes
  str = str.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').trim();
  if (str === '.' || str === '-' || str === '..') return '';
  return str;
}

function normalizeGuideName(raw) {
  if (!raw) return null;
  const str = String(raw).trim().replace(/\s+/g, ' ');
  const simplified = str.toLowerCase().replace(/[\.\s\(\)]/g, '');
  for (const g of CANONICAL_GUIDES) {
    if (simplified === g.name.toLowerCase().replace(/[\.\s\(\)]/g, '')) return g;
  }
  if (str.includes('Shaikh') || str.includes('N. F.')) return CANONICAL_GUIDES[0];
  if (str.includes('Khedkar') || str.includes('S. P.')) return CANONICAL_GUIDES[1];
  if (str.includes('Bodkhe') || str.includes('B. K.')) return CANONICAL_GUIDES[2];
  if (str.includes('Raskar') || str.includes('S. S.')) return CANONICAL_GUIDES[3];
  if (str.includes('Pole') || str.includes('G. S.')) return CANONICAL_GUIDES[4];
  if (str.includes('More') || str.includes('B. F.')) return CANONICAL_GUIDES[5];
  if (str.includes('Vakte') || str.includes('C. Y.')) return CANONICAL_GUIDES[6];
  if (str.includes('Shahbad') || str.includes('A. A.')) return CANONICAL_GUIDES[7];
  if (str.includes('Chavan') || str.includes('S. T.')) return CANONICAL_GUIDES[8];
  if (str.includes('Gaikwad') || str.includes('V. D.')) return CANONICAL_GUIDES[9];
  if (str.includes('Sandbhor') || str.includes('A. K.')) return CANONICAL_GUIDES[10];
  if (str.includes('Bhadane') || str.includes('S. D.')) return CANONICAL_GUIDES[11];
  if (str.includes('Shinde') || str.includes('S. M.')) return CANONICAL_GUIDES[12];
  if (str.includes('Sopal') || str.includes('S. A.')) return CANONICAL_GUIDES[13];
  if (str.includes('Kale') || str.includes('A. P.')) return CANONICAL_GUIDES[14];
  return { name: str, initials: 'EXP', designation: 'Assistant Professor', defaultQuota: 4 };
}

// Known conflict PRNs shared between two different people
const CONFLICT_PRNS = new Set(['F23111027', 'F23111054', 'F23113048']);

function isNameMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const cleanA = String(nameA).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const cleanB = String(nameB).toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (cleanA === cleanB) return true;
  const tokensA = cleanA.split(/\s+/).filter(t => t.length > 2);
  const tokensB = cleanB.split(/\s+/).filter(t => t.length > 2);
  return tokensA.some(t => tokensB.includes(t));
}

function parseWorkbookSync(filePathOrBuffer) {
  let wb;
  if (typeof filePathOrBuffer === 'string') {
    wb = xlsx.readFile(filePathOrBuffer);
  } else if (filePathOrBuffer && filePathOrBuffer.SheetNames) {
    wb = filePathOrBuffer;
  } else {
    wb = xlsx.read(filePathOrBuffer, { type: 'buffer' });
  }

  // 1. Read Quotas from "count" sheet
  const countSheet = wb.Sheets['count'];
  if (!countSheet) throw new Error('Sheet "count" not found in workbook!');
  const countRows = xlsx.utils.sheet_to_json(countSheet, { header: 1 });
  const countQuotas = {};
  for (let r = 4; r < countRows.length; r++) {
    const row = countRows[r];
    if (row && row[3] && row[4] !== undefined && row[3] !== 'Guide') {
      countQuotas[String(row[3]).trim()] = Number(row[4]);
    }
  }

  // 2. Read "Form Responses 1" (used strictly for student enrichment)
  const formSheet = wb.Sheets['Form Responses 1'];
  if (!formSheet) throw new Error('Sheet "Form Responses 1" not found in workbook!');
  const formRawRows = xlsx.utils.sheet_to_json(formSheet, { header: 1 });

  const formEntries = [];
  for (let i = 1; i < formRawRows.length; i++) {
    const row = formRawRows[i];
    if (!row || row.length === 0) continue;
    const leaderEmail = row[1] ? cleanEmail(row[1]) : null;

    const slots = [
      { name: row[2], prn: row[3], div: row[4], mob: row[5], email: leaderEmail, t1: row[6], t2: row[7], t3: row[8], is_leader: true },
      { name: row[9], prn: row[10], div: row[11], mob: row[12], email: row[13], t1: row[14], t2: row[15], t3: row[16], is_leader: false },
      { name: row[17], prn: row[18], div: row[19], mob: row[20], email: row[21], t1: row[22], t2: row[23], t3: row[24], is_leader: false },
      { name: row[25], prn: row[26], div: row[27], mob: row[28], email: row[29], t1: row[30], t2: row[31], t3: row[32], is_leader: false },
    ];

    slots.forEach((s, slotIdx) => {
      const rawName = s.name ? String(s.name).trim() : '';
      const rawPrn = s.prn ? String(s.prn).trim() : '';
      if (!rawName && !rawPrn) return;

      const normName = normalizeName(rawName);
      const prnObj = cleanPrn(rawPrn);
      const mobObj = cleanMobile(s.mob);
      const email = cleanEmail(s.email);

      formEntries.push({
        formRow: i + 1,
        slotIndex: slotIdx + 1,
        name: normName,
        rawName,
        prn: prnObj.prn,
        rawPrn,
        division: s.div ? String(s.div).trim().toUpperCase() : null,
        mobile: mobObj.mobile,
        isBadMobile: mobObj.isBad,
        email,
        topic1: cleanTopic(s.t1),
        topic2: cleanTopic(s.t2),
        topic3: cleanTopic(s.t3),
        is_leader: s.is_leader,
      });
    });
  }

  // 3. Read "Groups with Guide" (Source of Truth)
  const gSheet = wb.Sheets['Groups with Guide'];
  if (!gSheet) throw new Error('Sheet "Groups with Guide" not found in workbook!');
  const gRawRows = xlsx.utils.sheet_to_json(gSheet, { header: 1 });

  const groups = [];
  let currentGroup = null;
  let forwardGroupNo = null;
  let forwardDomainRaw = '';
  let forwardGuideRaw = '';

  for (let r = 6; r < gRawRows.length; r++) {
    const row = gRawRows[r];
    if (!row || row.length === 0 || row.every(c => c === undefined || c === null || String(c).trim() === '')) {
      // Blank separator row
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
        if (currentGroup) {
          groups.push(currentGroup);
        }
        forwardGroupNo = parsedGNo;
        forwardDomainRaw = rawDom ? String(rawDom).trim() : '';
        forwardGuideRaw = rawGuide ? String(rawGuide).trim() : '';

        const guideObj = normalizeGuideName(forwardGuideRaw);
        const domObj = normalizeDomain(forwardDomainRaw);

        currentGroup = {
          group_no: forwardGroupNo,
          domain: domObj.domain,
          domain_raw: domObj.domain_raw,
          guide_name: guideObj.name,
          guide: guideObj,
          members: [],
        };
      }
    }

    if (!currentGroup) continue;

    const trimmedName = rawName ? String(rawName).trim() : '';
    const trimmedPrn = rawPrn ? String(rawPrn).trim() : '';

    // Ignore phantom placeholder rows that have NO PRN and NO topics (e.g. Group 15 row 78)
    const hasAnyPrn = trimmedPrn.length > 0;
    const hasAnyTopic = Boolean(rawT1 || rawT2 || rawT3);
    if (!hasAnyPrn && !hasAnyTopic) {
      continue;
    }

    const prnObj = cleanPrn(trimmedPrn);
    let prnStatus = prnObj.status;
    if (prnObj.prn && CONFLICT_PRNS.has(prnObj.prn)) {
      prnStatus = 'conflict';
    }

    const t1 = cleanTopic(rawT1);
    const t2 = cleanTopic(rawT2);
    const t3 = cleanTopic(rawT3);

    currentGroup.members.push({
      student_name: normalizeName(trimmedName),
      prn: prnObj.prn,
      prn_status: prnStatus,
      raw_prn: trimmedPrn,
      topic1: t1,
      topic2: t2,
      topic3: t3,
      source_row: r + 1,
    });
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  // 4. Enrich Groups with Form Responses
  const matchedFormEntries = new Set();
  const edgeCases = {
    conflictPrns: [],
    missingPrns: [],
    noFormStudents: [],
    unassignedFormSubmissions: [],
    badContacts: [],
  };

  groups.forEach(g => {
    g.members.forEach((m, idx) => {
      m.member_index = idx + 1;
      m.is_leader = idx === 0;

      if (m.prn_status === 'conflict') {
        edgeCases.conflictPrns.push({ group_no: g.group_no, name: m.student_name, prn: m.prn });
      }
      if (m.prn_status === 'missing') {
        edgeCases.missingPrns.push({ group_no: g.group_no, name: m.student_name });
      }

      // RULE: Joined by PRN AND Name, never PRN alone
      let formMatch = null;
      if (m.prn) {
        formMatch = formEntries.find(fe => fe.prn === m.prn && isNameMatch(fe.name, m.student_name));
      }

      if (formMatch) {
        matchedFormEntries.add(formMatch);
        m.email = formMatch.email || null;
        m.mobile = formMatch.mobile || null;
        m.division = formMatch.division || null;

        if (formMatch.isBadMobile || (formMatch.rawPrn === 'F23112057' && !m.mobile)) {
          edgeCases.badContacts.push({ prn: m.prn, name: m.student_name, issue: 'Invalid mobile digits' });
        }

        // Topics fallback from form if empty in Groups sheet
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

  // Collect unassigned form submissions (Edge Case 5: F23112060 and "..")
  formEntries.forEach(fe => {
    const isPrnInAnyGroup = fe.prn && groups.some(g => g.members.some(m => m.prn === fe.prn));
    if (!isPrnInAnyGroup && !matchedFormEntries.has(fe)) {
      if (!edgeCases.unassignedFormSubmissions.some(u => u.prn === fe.prn && u.name === fe.name)) {
        edgeCases.unassignedFormSubmissions.push({
          formRow: fe.formRow,
          name: fe.name || fe.rawName || '—',
          prn: fe.prn || fe.rawPrn || '—',
          division: fe.division || '—',
        });
      }
    }
  });

  return { groups, edgeCases, countQuotas };
}

async function parseWorkbook(filePathOrBuffer) {
  return parseWorkbookSync(filePathOrBuffer);
}

async function runDryRun(filePath, options = {}) {
  const excludeRegistrations = options.excludeRegistrations || [];
  console.log('===============================================================');
  console.log('              DRY RUN: AY 2025-26 Sem 1 Import                ');
  console.log('===============================================================');

  const { groups, edgeCases, countQuotas } = await parseWorkbook(filePath);
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);

  console.log(`\n✓ Groups Found: ${groups.length} (Expected: 54)`);
  console.log(`✓ Total Students in Groups: ${totalStudents} (Expected: 201)`);

  const size4 = groups.filter(g => g.members.length === 4).length;
  const size3 = groups.filter(g => g.members.length === 3).length;
  const size2 = groups.filter(g => g.members.length === 2).length;
  console.log(`✓ Group Sizes: 4-member: ${size4} (exp: 40), 3-member: ${size3} (exp: 13), 2-member: ${size2} (exp: 1, Group #54)`);

  const guideActualCounts = {};
  groups.forEach(g => {
    const initials = g.guide.initials;
    guideActualCounts[initials] = (guideActualCounts[initials] || 0) + 1;
  });

  console.log('\n--- Guide Quota Reconciliation vs "count" Sheet ---');
  let quotasMatch = true;
  CANONICAL_GUIDES.forEach(g => {
    const exp = countQuotas[g.initials] || g.defaultQuota;
    const actual = guideActualCounts[g.initials] || 0;
    const ok = exp === actual;
    if (!ok) quotasMatch = false;
    console.log(`  ${g.initials.padEnd(6)} | ${g.name.padEnd(28)} | Expected: ${exp} | Actual: ${actual} | ${ok ? '✓ PASS' : '✗ MISMATCH'}`);
  });
  console.log(`Guide Quota Validation: ${quotasMatch ? '✓ ALL 15 GUIDES MATCH QUOTAS' : '✗ QUOTA MISMATCH'}`);

  console.log('\n--- EDGE CASES REPORT ---');
  console.log(`1. Duplicate / Conflict PRNs (${edgeCases.conflictPrns.length} records):`);
  console.table(edgeCases.conflictPrns);

  console.log(`2. Missing / Invalid PRNs (${edgeCases.missingPrns.length} records):`);
  console.table(edgeCases.missingPrns);

  console.log(`3. Students with NO Form Row (${edgeCases.noFormStudents.length} students):`);
  console.table(edgeCases.noFormStudents);

  console.log(`4. Unassigned Form Submissions (${edgeCases.unassignedFormSubmissions.length}):`);
  console.table(edgeCases.unassignedFormSubmissions);

  if (excludeRegistrations.length > 0) {
    console.log(`\n--- EXCLUSION LIST: Groups to skip registration creation ---`);
    console.log(`Groups: [${excludeRegistrations.join(', ')}]`);
  }

  return { groups, edgeCases, countQuotas };
}

async function executeImport(filePath, options = {}) {
  const excludeRegistrations = options.excludeRegistrations || [];
  const { groups, edgeCases, countQuotas } = await parseWorkbook(filePath);

  // Validate strict expectations before beginning database transaction
  if (groups.length !== 54) {
    throw new Error(`Import validation failed: Expected exactly 54 groups, but parsed ${groups.length}`);
  }
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);
  if (totalStudents !== 201) {
    throw new Error(`Import validation failed: Expected exactly 201 students, but parsed ${totalStudents}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure schema requirements: prn_status column and prn nullable in seminar_group_members
    await client.query(`
      ALTER TABLE seminar_group_members 
      ADD COLUMN IF NOT EXISTS prn_status VARCHAR(20) DEFAULT 'valid';
      ALTER TABLE seminar_group_members ALTER COLUMN prn DROP NOT NULL;
    `);

    // 2. Lookup seminar coordinator user id
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
      // Clean previous session data for idempotency
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

    function findFaculty(canonical) {
      return facultyList.find(f => {
        if (f.employee_id && f.employee_id.toUpperCase() === canonical.initials.toUpperCase()) return true;
        const fNorm = normalizeName(f.name).toLowerCase().replace(/dr\.|mrs\.|mr\.|ms\./gi, '').replace(/[^a-z]/g, '');
        const cNorm = normalizeName(canonical.name).toLowerCase().replace(/dr\.|mrs\.|mr\.|ms\./gi, '').replace(/[^a-z]/g, '');
        return fNorm.includes(cNorm) || cNorm.includes(fNorm);
      });
    }

    const guideMap = new Map();
    for (let i = 0; i < CANONICAL_GUIDES.length; i++) {
      const g = CANONICAL_GUIDES[i];
      const fac = findFaculty(g);
      const quota = countQuotas[g.initials] || g.defaultQuota;

      const gRes = await client.query(
        `INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, initials, quota, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          sessionId,
          fac ? fac.faculty_id : null,
          g.name,
          fac ? fac.designation : g.designation,
          g.initials,
          quota,
          i + 1,
        ]
      );

      guideMap.set(g.name, {
        seminar_guide_id: gRes.rows[0].id,
        faculty_id: fac ? fac.faculty_id : null,
        name: g.name,
        initials: g.initials,
      });
    }

    // 5. Insert Groups, Members, and Registrations
    let registrationsCreated = 0;
    let registrationsSkipped = 0;

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

      const isExcluded = excludeRegistrations.includes(g.group_no);
      const groupStatus = isExcluded ? 'PENDING_GUIDE_ASSIGNMENT' : 'APPROVED';
      const allowEdit = isExcluded ? true : false;

      const grpRes = await client.query(
        `INSERT INTO seminar_groups (
           session_id, group_no, domain, domain_raw, guide_id, seminar_guide_id, guide_name,
           leader_user_id, leader_prn, status, submitted_at, allow_edit
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
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
          groupStatus,
          allowEdit,
        ]
      );
      const groupId = grpRes.rows[0].id;

      // Insert members with surrogate PK
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

      // Handle Registration Record: Skip if in exclusion list
      if (!isExcluded) {
        await client.query(
          `INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
           VALUES ($1, $2, $3, NOW(), 'REGISTERED')
           ON CONFLICT (group_id) DO NOTHING`,
          [groupId, sessionId, leaderUserId || coordId]
        );
        registrationsCreated++;
      } else {
        registrationsSkipped++;
      }
    }

    await client.query('COMMIT');
    console.log('\n===============================================================');
    console.log('       LIVE IMPORT COMPLETED SUCCESSFULLY IN 1 TRANSACTION     ');
    console.log('===============================================================');
    console.log(`✓ 54 Groups and 201 Students active in Session ${sessionId} ("AY 2025-26 Sem 1").`);
    console.log(`✓ Registrations Created: ${registrationsCreated}, Skipped (Exclusion List): ${registrationsSkipped}`);
    return { success: true, sessionId, registrationsCreated, registrationsSkipped };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Import Error] Rolled back transaction:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const filePath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');
  const isExecute = process.argv.includes('--execute');
  const isDryRun = process.argv.includes('--dry-run') || !isExecute;

  let excludeRegistrations = [];
  const exclArgIdx = process.argv.indexOf('--exclude-registrations');
  if (exclArgIdx !== -1 && process.argv[exclArgIdx + 1]) {
    excludeRegistrations = process.argv[exclArgIdx + 1]
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));
  }

  if (isDryRun) {
    await runDryRun(filePath, { excludeRegistrations });
    console.log('\nRun with "--execute" to perform live database import.');
    process.exit(0);
  } else {
    await executeImport(filePath, { excludeRegistrations });
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = {
  parseWorkbook,
  parseWorkbookSync,
  normalizeDomain,
  cleanPrn,
  cleanMobile,
  cleanEmail,
  cleanTopic,
  normalizeGuideName,
  runDryRun,
  executeImport,
  CANONICAL_GUIDES,
};
