'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function checkAll() {
  const members = await pool.query(
    `SELECT sgm.*, sg.group_no, sg.session_id
     FROM seminar_group_members sgm
     JOIN seminar_groups sg ON sgm.group_id = sg.id
     WHERE sg.session_id = 7
     ORDER BY sg.group_no, sgm.member_index`
  );
  console.log('Total members in session 7:', members.rows.length);

  let matchedUsers = 0;
  let missingUsers = [];

  for (const m of members.rows) {
    const cleanP = m.prn ? m.prn.trim().toUpperCase() : '';
    const cleanE = m.email ? m.email.trim().toLowerCase() : '';

    const u = await pool.query(
      `SELECT u.id, u.name, u.email, s.enrollment_no, s.roll_no
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE (s.enrollment_no IS NOT NULL AND UPPER(REPLACE(s.enrollment_no, ' ', '')) = $1)
          OR LOWER(u.email) = $2
          OR ($1 <> '' AND LOWER(u.email) LIKE $3)`,
      [cleanP, cleanE, `${cleanP.toLowerCase()}@%`]
    );

    if (u.rows.length > 0) {
      matchedUsers++;
    } else {
      missingUsers.push({ group_no: m.group_no, name: m.student_name, prn: m.prn, email: m.email });
    }
  }

  console.log(`Matched Users in users/students table: ${matchedUsers} / ${members.rows.length}`);
  console.log(`Missing Users count: ${missingUsers.length}`);
  if (missingUsers.length > 0) {
    console.log('Missing Sample (up to 20):');
    console.table(missingUsers.slice(0, 20));
  }

  pool.end();
}

checkAll();
