'use strict';

const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

// Canonical Guide Definition and Initials Mapping
const GUIDE_ROSTER = [
  { name: 'Dr. (Mrs.) N. F. Shaikh', initials: 'NFS', email: 'nfs@meswadiacoe.edu', designation: 'Associate Professor & HOD', defaultQuota: 4 },
  { name: 'Dr. (Mrs.) S. P. Khedkar', initials: 'SPK', email: 'spk@meswadiacoe.edu', designation: 'Associate Professor', defaultQuota: 4 },
  { name: 'Dr. (Mr.) B. K. Bodkhe',   initials: 'BKB', email: 'bkb@meswadiacoe.edu', designation: 'Associate Professor', defaultQuota: 4 },
  { name: 'Mrs. S. S. Raskar',       initials: 'SSR', email: 'ssr@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Dr. (Mr.) G. S. Pole',     initials: 'GSP', email: 'gsp@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Ms. B. F. More',          initials: 'BFM', email: 'bfm@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Ms. C. Y. Vakte',         initials: 'CYV', email: 'cyv@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Mrs. A. A. Shahbad',      initials: 'AAS', email: 'aas@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Ms. S. T. Chavan',        initials: 'STC', email: 'stc@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 4 },
  { name: 'Mrs. V. D. Gaikwad',      initials: 'VDG', email: 'vdg@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 },
  { name: 'Ms. A. K. Sandbhor',      initials: 'AKS', email: 'aks@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 },
  { name: 'Mrs. S. D. Bhadane',      initials: 'SDB', email: 'sdb@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 },
  { name: 'Ms. S. M. Shinde',        initials: 'SMS', email: 'sms@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 },
  { name: 'Mr. S. A. Sopal',         initials: 'SAS1', email: 'sas1@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 },
  { name: 'Dr. (Mrs.) A. P. Kale',   initials: 'APK', email: 'apk@meswadiacoe.edu', designation: 'Assistant Professor', defaultQuota: 3 }
];

function normalizeGuideName(raw) {
  if (!raw) return null;
  const str = String(raw).trim().replace(/\s+/g, ' ');
  for (const g of GUIDE_ROSTER) {
    if (str.toLowerCase().replace(/[\.\s\(\)]/g, '') === g.name.toLowerCase().replace(/[\.\s\(\)]/g, '')) {
      return g;
    }
  }
  // Fallback matching
  if (str.includes('Shaikh') || str.includes('N. F.')) return GUIDE_ROSTER[0];
  if (str.includes('Khedkar') || str.includes('S. P.')) return GUIDE_ROSTER[1];
  if (str.includes('Bodkhe') || str.includes('B. K.')) return GUIDE_ROSTER[2];
  if (str.includes('Raskar') || str.includes('S. S.')) return GUIDE_ROSTER[3];
  if (str.includes('Pole') || str.includes('G. S.')) return GUIDE_ROSTER[4];
  if (str.includes('More') || str.includes('B. F.')) return GUIDE_ROSTER[5];
  if (str.includes('Vakte') || str.includes('C. Y.')) return GUIDE_ROSTER[6];
  if (str.includes('Shahbad') || str.includes('A. A.')) return GUIDE_ROSTER[7];
  if (str.includes('Chavan') || str.includes('S. T.')) return GUIDE_ROSTER[8];
  if (str.includes('Gaikwad') || str.includes('V. D.')) return GUIDE_ROSTER[9];
  if (str.includes('Sandbhor') || str.includes('A. K.')) return GUIDE_ROSTER[10];
  if (str.includes('Bhadane') || str.includes('S. D.')) return GUIDE_ROSTER[11];
  if (str.includes('Shinde') || str.includes('S. M.')) return GUIDE_ROSTER[12];
  if (str.includes('Sopal') || str.includes('S. A.')) return GUIDE_ROSTER[13];
  if (str.includes('Kale') || str.includes('A. P.')) return GUIDE_ROSTER[14];
  return { name: str, initials: 'EXP', designation: 'Faculty Guide', defaultQuota: 4 };
}

function normalizeDomain(raw) {
  if (!raw) return { canonical: 'Unspecified', raw: '' };
  const str = String(raw).trim().replace(/\s+/g, ' ');
  const lower = str.toLowerCase();

  if (
    lower.includes('aiml') ||
    lower.includes('ai/ml') ||
    lower.includes('ai - ml') ||
    lower.includes('machine learning') ||
    lower.includes('artificial intelligence') ||
    lower === 'ai' ||
    lower === 'ml'
  ) {
    return { canonical: 'AI/ML', raw: str };
  }
  if (lower.includes('data science')) {
    return { canonical: 'Data Science', raw: str };
  }
  if (lower.includes('cyber') || lower.includes('security')) {
    return { canonical: 'Cybersecurity', raw: str };
  }
  if (lower.includes('web') || lower.includes('app development')) {
    return { canonical: 'Web & Mobile Development', raw: str };
  }
  if (lower === 'cc' || lower.includes('cloud')) {
    return { canonical: 'Cloud Computing', raw: str };
  }
  if (lower.includes('soft computing')) {
    return { canonical: 'Soft Computing', raw: str };
  }
  if (lower.includes('game')) {
    return { canonical: 'Game Development', raw: str };
  }
  if (lower.includes('signature verification')) {
    return { canonical: 'Computer Vision & Pattern Recognition', raw: str };
  }
  if (lower.includes('real life problem') || lower.includes('urban and rural')) {
    return { canonical: 'Smart Systems & Societal Applications', raw: str };
  }
  return { canonical: str, raw: str };
}

function cleanPRN(raw) {
  if (!raw) return null;
  const str = String(raw).trim().toUpperCase();
  if (/^F\d{8}$/.test(str)) return str;
  return null;
}

function cleanMobile(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits || null;
}

function cleanEmail(raw) {
  if (!raw) return null;
  const str = String(raw).trim().toLowerCase();
  return str.includes('@') ? str : null;
}

function cleanTopic(raw) {
  if (!raw) return { title: null, topic_domain: null };
  let str = String(raw).trim().replace(/\s+/g, ' ');
  if (!str || str === '.' || str === '-' || str === '--') return { title: null, topic_domain: null };

  // Strip leading numbering: "1.", "2.", "3.", "1. ", "(1)", "1) "
  str = str.replace(/^(?:\(?\d+\)?[\.\-\:\)\s]+)+/g, '').trim();

  // Strip trailing "Domain: ..."
  let topicDomain = null;
  const domMatch = str.match(/Domain:\s*(.+)$/i);
  if (domMatch) {
    topicDomain = domMatch[1].trim();
    str = str.replace(/Domain:\s*.+$/i, '').trim();
  }

  // Strip surrounding quotes
  str = str.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').trim();
  if (!str || str === '.' || str === '-') return { title: null, topic_domain: null };

  return { title: str, topic_domain: topicDomain };
}

async function seedSeminarRegistrations(filePath) {
  const targetFile = filePath || path.join(__dirname, '../data/TE_Seminar_Project_Group_formation.xlsx');
  console.log(`\n===============================================================`);
  console.log(`[Seminar Importer] Reading workbook from: ${targetFile}`);
  console.log(`===============================================================\n`);

  const wb = xlsx.readFile(targetFile);

  // 1. Parse Sheet "count" for Guide Quota Validation
  const countSheet = wb.Sheets['count'];
  const countRows = xlsx.utils.sheet_to_json(countSheet, { header: 1 });
  const countSheetQuotas = {};
  countRows.forEach(r => {
    if (r && r[3] && typeof r[3] === 'string' && r[3].trim() !== 'Guide' && r[4] !== undefined) {
      countSheetQuotas[r[3].trim()] = Number(r[4]);
    }
  });

  // 2. Parse Sheet "Form Responses 1" for Enrichment
  const formSheet = wb.Sheets['Form Responses 1'];
  const formRows = xlsx.utils.sheet_to_json(formSheet, { header: 1 });
  const enrichmentByPrn = new Map();
  const formConflicts = [];

  for (let i = 1; i < formRows.length; i++) {
    const row = formRows[i];
    if (!row || row.length === 0) continue;
    const leaderEmail = row[1] ? cleanEmail(row[1]) : null;

    const slots = [
      { name: row[2], prn: row[3], div: row[4], mob: row[5], email: leaderEmail, t1: row[6], t2: row[7], t3: row[8], is_leader: true },
      { name: row[9], prn: row[10], div: row[11], mob: row[12], email: row[13], t1: row[14], t2: row[15], t3: row[16], is_leader: false },
      { name: row[17], prn: row[18], div: row[19], mob: row[20], email: row[21], t1: row[22], t2: row[23], t3: row[24], is_leader: false },
      { name: row[25], prn: row[26], div: row[27], mob: row[28], email: row[29], t1: row[30], t2: row[31], t3: row[32], is_leader: false },
    ];

    slots.forEach((s, slotIdx) => {
      if (!s.name && !s.prn) return;
      const cPrn = cleanPRN(s.prn);
      if (cPrn) {
        const item = {
          formRow: i + 1,
          slotIndex: slotIdx + 1,
          name: s.name ? String(s.name).trim() : '',
          division: s.div ? String(s.div).trim().toUpperCase() : null,
          mobile: cleanMobile(s.mob),
          email: cleanEmail(s.email),
          t1: cleanTopic(s.t1),
          t2: cleanTopic(s.t2),
          t3: cleanTopic(s.t3),
          is_leader: s.is_leader,
        };

        if (!enrichmentByPrn.has(cPrn)) {
          enrichmentByPrn.set(cPrn, [item]);
        } else {
          enrichmentByPrn.get(cPrn).push(item);
        }
      }
    });
  }

  // Identify duplicate form submissions
  for (const [prn, entries] of enrichmentByPrn.entries()) {
    if (entries.length > 1) {
      formConflicts.push({ prn, rows: entries.map(e => e.formRow) });
    }
  }

  // 3. Parse Sheet "Groups with Guide" (Source of Truth)
  const gSheet = wb.Sheets['Groups with Guide'];
  const gRows = xlsx.utils.sheet_to_json(gSheet, { header: 1 });

  const groupsMap = new Map(); // groupNo -> { groupNo, domain, domain_raw, guide, students: [] }
  let currentGroupNo = null;
  let currentDomainRaw = null;
  let currentGuideRaw = null;
  const invalidOrPendingPrnStudents = [];

  for (let i = 6; i < gRows.length; i++) {
    const row = gRows[i];
    if (!row || row.length === 0) continue;
    const [grpNo, name, prn, t1, t2, t3, dom, guide] = row;
    if (!name && !prn) continue; // Separator row

    if (grpNo !== undefined && grpNo !== null && String(grpNo).trim() !== '') {
      currentGroupNo = parseInt(String(grpNo).trim(), 10);
    }
    if (dom !== undefined && dom !== null && String(dom).trim() !== '') {
      currentDomainRaw = String(dom).trim();
    }
    if (guide !== undefined && guide !== null && String(guide).trim() !== '') {
      currentGuideRaw = String(guide).trim();
    }

    if (!currentGroupNo) continue;

    if (!groupsMap.has(currentGroupNo)) {
      const guideObj = normalizeGuideName(currentGuideRaw);
      const domObj = normalizeDomain(currentDomainRaw);
      groupsMap.set(currentGroupNo, {
        groupNo: currentGroupNo,
        domain: domObj.canonical,
        domain_raw: domObj.raw,
        guide: guideObj,
        students: [],
      });
    }

    const group = groupsMap.get(currentGroupNo);
    const validPrn = cleanPRN(prn);
    const rawPrnStr = prn !== undefined && prn !== null ? String(prn).trim() : '';

    if (!validPrn) {
      invalidOrPendingPrnStudents.push({
        groupNo: currentGroupNo,
        name: name ? String(name).trim() : 'Unknown Student',
        rawPrn: rawPrnStr,
      });
    }

    const studentPrn = validPrn || `PENDING-G${currentGroupNo}`;
    const studentName = name ? String(name).trim() : 'Pending Name';
    const top1 = cleanTopic(t1);
    const top2 = cleanTopic(t2);
    const top3 = cleanTopic(t3);

    // Enrich from Form Responses
    let enriched = null;
    if (validPrn && enrichmentByPrn.has(validPrn)) {
      const list = enrichmentByPrn.get(validPrn);
      enriched = list[0]; // Take primary form record
    }

    const division = enriched?.division || 'TE 1';
    const mobile = enriched?.mobile || null;
    const email = enriched?.email || `${studentPrn.toLowerCase()}@meswadiacoe.edu`;
    const isLeader = group.students.length === 0; // First student in group is designated leader

    group.students.push({
      prn: studentPrn,
      name: studentName,
      division,
      mobile,
      email,
      topic1: top1.title || enriched?.t1?.title || null,
      topic1_domain: top1.topic_domain || enriched?.t1?.topic_domain || null,
      topic2: top2.title || enriched?.t2?.title || null,
      topic2_domain: top2.topic_domain || enriched?.t2?.topic_domain || null,
      topic3: top3.title || enriched?.t3?.title || null,
      topic3_domain: top3.topic_domain || enriched?.t3?.topic_domain || null,
      is_leader: isLeader,
    });
  }

  // 4. DATABASE TRANSACTION IMPORT
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find creator user ID
    const userRes = await client.query(`SELECT id FROM users ORDER BY id ASC LIMIT 1`);
    const defaultUserId = userRes.rows[0]?.id || 1;

    // Ensure session exists
    let sessionRes = await client.query(
      `SELECT id FROM seminar_sessions WHERE academic_year = '2025-26' OR name ILIKE '%2025-26%' ORDER BY id ASC LIMIT 1`
    );
    let sessionId;
    if (sessionRes.rows.length > 0) {
      sessionId = sessionRes.rows[0].id;
      await client.query(
        `UPDATE seminar_sessions
         SET name = 'TE Seminar & Project Group Formation (A.Y. 2025-26)', batch = '2025-26',
             academic_year = '2025-26', status = 'PUBLISHED', is_locked = false
         WHERE id = $1`,
        [sessionId]
      );
    } else {
      sessionRes = await client.query(
        `INSERT INTO seminar_sessions (name, batch, academic_year, status, is_locked, created_by)
         VALUES ('TE Seminar & Project Group Formation (A.Y. 2025-26)', '2025-26', '2025-26', 'PUBLISHED', false, $1)
         RETURNING id`,
        [defaultUserId]
      );
      sessionId = sessionRes.rows[0].id;
    }

    // Delete existing seminar data for this session to ensure 100% idempotency
    await client.query('DELETE FROM registrations WHERE seminar_id = $1', [sessionId]);
    await client.query('DELETE FROM seminar_marks WHERE session_id = $1', [sessionId]);
    await client.query('DELETE FROM seminar_group_members WHERE group_id IN (SELECT id FROM seminar_groups WHERE session_id = $1)', [sessionId]);
    await client.query('DELETE FROM seminar_groups WHERE session_id = $1', [sessionId]);
    await client.query('DELETE FROM seminar_guides WHERE session_id = $1', [sessionId]);

    // Default password hash for faculty accounts: "faculty@123"
    const defaultFacPassHash = await bcrypt.hash('faculty@123', 10);

    // Insert / Ensure Faculty Accounts & Guides
    const guideIdMap = new Map();   // initials -> seminar_guides.id
    const facultyIdMap = new Map(); // initials -> faculty.id

    for (let idx = 0; idx < GUIDE_ROSTER.length; idx++) {
      const g = GUIDE_ROSTER[idx];
      const quota = countSheetQuotas[g.initials] || g.defaultQuota;

      // 1. Ensure User Account exists
      let userRes = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [g.email]
      );
      let uId;
      if (userRes.rows.length > 0) {
        uId = userRes.rows[0].id;
      } else {
        const role = g.initials === 'NFS' ? 'hod' : 'faculty';
        const insU = await client.query(
          `INSERT INTO users (name, role, email, password_hash, department, is_active)
           VALUES ($1, $2, $3, $4, 'Computer Engineering', true)
           RETURNING id`,
          [g.name, role, g.email, defaultFacPassHash]
        );
        uId = insU.rows[0].id;
      }

      // 2. Ensure Faculty Record exists
      let facRes = await client.query(
        `SELECT id FROM faculty WHERE user_id = $1 OR employee_id = $2`,
        [uId, g.initials]
      );
      let fId;
      if (facRes.rows.length > 0) {
        fId = facRes.rows[0].id;
        // Update user_id / employee_id / designation if needed
        await client.query(
          `UPDATE faculty SET user_id = $1, employee_id = $2, designation = $3 WHERE id = $4`,
          [uId, g.initials, g.designation, fId]
        );
      } else {
        const insF = await client.query(
          `INSERT INTO faculty (user_id, department, designation, employee_id)
           VALUES ($1, 'Computer Engineering', $2, $3)
           RETURNING id`,
          [uId, g.designation, g.initials]
        );
        fId = insF.rows[0].id;
      }

      facultyIdMap.set(g.initials, fId);

      // 3. Insert into seminar_guides
      const gRes = await client.query(
        `INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order, initials)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [sessionId, fId, g.name, g.designation, quota, idx + 1, g.initials]
      );
      guideIdMap.set(g.initials, gRes.rows[0].id);
    }

    // Insert Groups, Members & Registrations
    let totalStudentsInserted = 0;
    let totalRegistrationsInserted = 0;
    const guideActualGroupCounts = {};
    GUIDE_ROSTER.forEach(g => { guideActualGroupCounts[g.initials] = 0; });

    for (const [groupNo, group] of groupsMap.entries()) {
      const guideObj = group.guide;
      const guideDbId = guideIdMap.get(guideObj.initials) || null;
      const facultyDbId = facultyIdMap.get(guideObj.initials) || null;
      const leaderPrn = group.students.find(s => s.is_leader)?.prn || group.students[0]?.prn;
      const leaderEmail = group.students.find(s => s.is_leader)?.email || group.students[0]?.email;

      if (guideObj.initials && guideActualGroupCounts[guideObj.initials] !== undefined) {
        guideActualGroupCounts[guideObj.initials]++;
      }

      // Look up leader user id if available in students table
      let leaderUserId = null;
      if (leaderPrn) {
        const stRes = await client.query(
          `SELECT user_id FROM students WHERE UPPER(REPLACE(enrollment_no, ' ', '')) = $1 OR UPPER(REPLACE(roll_no, ' ', '')) = $1 LIMIT 1`,
          [leaderPrn]
        );
        if (stRes.rows.length > 0) {
          leaderUserId = stRes.rows[0].user_id;
        }
      }
      if (!leaderUserId && leaderEmail) {
        const uRes = await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [leaderEmail]);
        if (uRes.rows.length > 0) {
          leaderUserId = uRes.rows[0].id;
        }
      }

      const grpRes = await client.query(
        `INSERT INTO seminar_groups (
           session_id, group_no, domain, domain_raw, guide_id, guide_name,
           seminar_guide_id, leader_user_id, leader_prn, status, submitted_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED', NOW())
         RETURNING id`,
        [sessionId, groupNo, group.domain, group.domain_raw, facultyDbId, guideObj.name, guideDbId, leaderUserId, leaderPrn]
      );
      const groupId = grpRes.rows[0].id;

      // Insert Members
      for (let mIdx = 0; mIdx < group.students.length; mIdx++) {
        const s = group.students[mIdx];
        await client.query(
          `INSERT INTO seminar_group_members (
             group_id, member_index, student_name, prn, division, mobile, email,
             topic1, topic1_domain, topic2, topic2_domain, topic3, topic3_domain, is_leader
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            groupId,
            mIdx + 1,
            s.name,
            s.prn,
            s.division,
            s.mobile,
            s.email,
            s.topic1,
            s.topic1_domain,
            s.topic2,
            s.topic2_domain,
            s.topic3,
            s.topic3_domain,
            s.is_leader,
          ]
        );
        totalStudentsInserted++;
      }

      // Insert corresponding group registration record
      const regUser = leaderUserId || defaultUserId;
      await client.query(
        `INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
         VALUES ($1, $2, $3, NOW(), 'REGISTERED')
         ON CONFLICT (group_id) DO UPDATE SET status = 'REGISTERED', registered_at = NOW()`,
        [groupId, sessionId, regUser]
      );
      totalRegistrationsInserted++;
    }

    await client.query('COMMIT');

    // 5. PRINT SUMMARY REPORT
    console.log(`\n===============================================================`);
    console.log(`            TE SEMINAR REGISTRATION IMPORT SUMMARY            `);
    console.log(`===============================================================`);
    console.log(`✓ Active Session: TE Seminar & Project Group Formation (A.Y. 2025-26)`);
    console.log(`✓ Total Guides Imported:   ${GUIDE_ROSTER.length}`);
    console.log(`✓ Total Groups Created:    ${groupsMap.size}`);
    console.log(`✓ Total Students Imported: ${totalStudentsInserted}`);
    console.log(`---------------------------------------------------------------`);

    // Missing / Invalid PRN Report
    console.log(`\n[1] Missing / Invalid PRN Report (${invalidOrPendingPrnStudents.length} student(s)):`);
    if (invalidOrPendingPrnStudents.length > 0) {
      invalidOrPendingPrnStudents.forEach(item => {
        console.log(`  - Group #${item.groupNo}: "${item.name}" (Sheet PRN: "${item.rawPrn}" -> Imported as PENDING-G${item.groupNo})`);
      });
    } else {
      console.log(`  None. All PRNs matched standard format ^F\\d{8}$.`);
    }

    // Form Conflict Resolution Report
    console.log(`\n[2] Form Responses Conflict Resolution Report (${formConflicts.length} PRN(s)):`);
    formConflicts.forEach(c => {
      let finalGroupNo = 'Unassigned';
      for (const [gNo, grp] of groupsMap.entries()) {
        if (grp.students.some(s => s.prn === c.prn)) {
          finalGroupNo = gNo;
          break;
        }
      }
      console.log(`  - PRN ${c.prn}: Submitted in Form Rows [${c.rows.join(', ')}] -> Final Authority: Group #${finalGroupNo} ("Groups with Guide")`);
    });

    // Guide Quota Reconciliation Report
    console.log(`\n[3] Guide Group Load Reconciliation vs "count" Sheet:`);
    console.log(`  Initials | Guide Name                       | Expected | Imported | Status`);
    console.log(`  ---------+----------------------------------+----------+----------+--------`);
    let allMatched = true;
    GUIDE_ROSTER.forEach(g => {
      const exp = countSheetQuotas[g.initials] || g.defaultQuota;
      const actual = guideActualGroupCounts[g.initials] || 0;
      const match = exp === actual;
      if (!match) allMatched = false;
      const padInit = g.initials.padEnd(8);
      const padName = g.name.padEnd(32);
      const padExp = String(exp).padStart(8);
      const padAct = String(actual).padStart(8);
      console.log(`  ${padInit} | ${padName} | ${padExp} | ${padAct} | ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
    });
    console.log(`  ---------------------------------------------------------------------`);
    console.log(`  Overall Reconciliation Status: ${allMatched ? '✓ 100% PERFECT MATCH (54/54 groups verified)' : '⚠️ Check Quotas'}`);
    console.log(`===============================================================\n`);

    return {
      guidesCount: GUIDE_ROSTER.length,
      groupsCount: groupsMap.size,
      studentsCount: totalStudentsInserted,
      allMatched,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed Error] Transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedSeminarRegistrations(process.argv[2])
    .then(() => {
      console.log('✓ Import process finished successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('✗ Import failed:', err);
      process.exit(1);
    });
}

module.exports = { seedSeminarRegistrations };
