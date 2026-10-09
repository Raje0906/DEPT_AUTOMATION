'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function verifyAllGuides() {
  const guides = [
    { initials: 'NFS', email: 'nfs@meswadiacoe.edu', expected: 4 },
    { initials: 'SPK', email: 'spk@meswadiacoe.edu', expected: 4 },
    { initials: 'BKB', email: 'bkb@meswadiacoe.edu', expected: 4 },
    { initials: 'SSR', email: 'ssr@meswadiacoe.edu', expected: 4 },
    { initials: 'GSP', email: 'gsp@meswadiacoe.edu', expected: 4 },
    { initials: 'BFM', email: 'bfm@meswadiacoe.edu', expected: 4 },
    { initials: 'CYV', email: 'cyv@meswadiacoe.edu', expected: 4 },
    { initials: 'AAS', email: 'aas@meswadiacoe.edu', expected: 4 },
    { initials: 'STC', email: 'stc@meswadiacoe.edu', expected: 4 },
    { initials: 'VDG', email: 'vdg@meswadiacoe.edu', expected: 3 },
    { initials: 'AKS', email: 'aks@meswadiacoe.edu', expected: 3 },
    { initials: 'SDB', email: 'sdb@meswadiacoe.edu', expected: 3 },
    { initials: 'SMS', email: 'sms@meswadiacoe.edu', expected: 3 },
    { initials: 'SAS1', email: 'sas1@meswadiacoe.edu', expected: 3 },
    { initials: 'APK', email: 'apk@meswadiacoe.edu', expected: 3 }
  ];

  console.log('\n--- 15 GUIDES ASSIGNMENT VERIFICATION ---');
  let totalAssigned = 0;
  for (const g of guides) {
    const u = await pool.query(
      'SELECT u.id, u.name, f.id as faculty_id FROM users u JOIN faculty f ON f.user_id = u.id WHERE LOWER(u.email) = LOWER($1)',
      [g.email]
    );
    if (!u.rows.length) {
      console.error(`✗ Guide missing faculty account: ${g.initials} (${g.email})`);
      continue;
    }
    const fid = u.rows[0].faculty_id;
    const grps = await pool.query(
      'SELECT id, group_no, domain, guide_name FROM seminar_groups WHERE guide_id = $1 AND status = $2 ORDER BY group_no ASC',
      [fid, 'APPROVED']
    );
    totalAssigned += grps.rows.length;
    const match = grps.rows.length === g.expected;
    console.log(`[${match ? '✓' : '✗'}] ${g.initials.padEnd(5)} | FacID: ${String(fid).padEnd(3)} | ${u.rows[0].name.padEnd(28)} | Expected: ${g.expected} | Assigned: ${grps.rows.length} | Groups: [${grps.rows.map(x => x.group_no).join(', ')}]`);
  }
  console.log(`Total Groups Assigned across 15 Guides: ${totalAssigned}`);
}

verifyAllGuides()
  .then(() => pool.end())
  .catch(err => { console.error(err); pool.end(); });
