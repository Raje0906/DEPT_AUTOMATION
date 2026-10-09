'use strict';

require('dotenv').config();
const pool = require('../db/pool');

async function diagnose() {
  const prns = [
    { label: 'Group 1 Leader', prn: 'F24123002' },
    { label: 'Group 1 Member (non-leader)', prn: 'F23113022' },
    { label: 'Group 2 Leader', prn: 'F23111054' },
    { label: 'Group 2 Member (non-leader)', prn: 'F23111009' }
  ];

  for (const item of prns) {
    console.log(`\n======================================================================`);
    console.log(`DIAGNOSING: ${item.label} (PRN: ${item.prn})`);
    console.log(`======================================================================`);

    // 1. Check users table
    const userRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department, u.is_active
       FROM users u
       WHERE u.email ILIKE $1 OR u.name ILIKE $2`,
      [`%${item.prn}%`, `%${item.prn}%`]
    );
    console.log('1. User Accounts found by email/name:', userRes.rows);

    // 2. Check students table
    const studentRes = await pool.query(
      `SELECT s.*, u.name as user_name, u.email as user_email
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE UPPER(REPLACE(s.enrollment_no, ' ', '')) = $1
          OR UPPER(REPLACE(s.roll_no, ' ', '')) = $1
          OR u.email ILIKE $2`,
      [item.prn, `%${item.prn}%`]
    );
    console.log('2. Student Records linked to Users:', studentRes.rows);

    // 3. Check seminar_group_members table
    const memberRes = await pool.query(
      `SELECT sgm.id, sgm.group_id, sgm.member_index, sgm.student_name, sgm.prn, sgm.division, sgm.email, sgm.is_leader,
              sg.group_no, sg.session_id, sg.guide_id, sg.guide_name, sg.status as group_status, sg.leader_user_id, sg.leader_prn
       FROM seminar_group_members sgm
       JOIN seminar_groups sg ON sgm.group_id = sg.id
       WHERE UPPER(REPLACE(sgm.prn, ' ', '')) = $1`,
      [item.prn]
    );
    console.log('3. Seminar Group Member Records:', memberRes.rows);

    // 4. Trace what GET /api/seminar/my-submission would execute for this student
    if (studentRes.rows.length > 0) {
      const loggedInUser = studentRes.rows[0];
      console.log(`\n--- SIMULATING GET /my-submission for User ID: ${loggedInUser.user_id} (${loggedInUser.user_name}, email: ${loggedInUser.user_email}) ---`);
      
      const sessionRes = await pool.query(
        `SELECT * FROM seminar_sessions ORDER BY (CASE WHEN academic_year = '2025-26' THEN 1 ELSE 2 END) ASC, created_at DESC LIMIT 1`
      );
      const session = sessionRes.rows[0];
      console.log(`Target Session: ID ${session.id} ("${session.name}")`);

      // Hop A: Check if current user is leader
      const leaderGrp = await pool.query(
        `SELECT sg.*, u.name as leader_name, u.email as leader_email
         FROM seminar_groups sg
         LEFT JOIN users u ON sg.leader_user_id = u.id
         WHERE sg.session_id = $1 AND sg.leader_user_id = $2`,
        [session.id, loggedInUser.user_id]
      );
      console.log(`Hop A (By leader_user_id = ${loggedInUser.user_id}): Found ${leaderGrp.rows.length} group(s)`);

      // Hop B: Check by PRN / email membership
      const prnNorm = loggedInUser.enrollment_no ? loggedInUser.enrollment_no.trim().toUpperCase() : item.prn;
      const emailNorm = loggedInUser.user_email.trim().toLowerCase();
      const memGrp = await pool.query(
        `SELECT sg.*, u.name as leader_name, u.email as leader_email
         FROM seminar_groups sg
         JOIN seminar_group_members sgm ON sgm.group_id = sg.id
         LEFT JOIN users u ON sg.leader_user_id = u.id
         WHERE sg.session_id = $1
           AND (
             ($2 <> '' AND UPPER(REPLACE(sgm.prn, ' ', '')) = $2)
             OR ($3 <> '' AND LOWER(sgm.email) = $3)
             OR ($2 <> '' AND sgm.prn ILIKE $4)
           )
         ORDER BY sg.id ASC
         LIMIT 1`,
        [session.id, prnNorm, emailNorm, `%${prnNorm}%`]
      );
      console.log(`Hop B (By PRN "${prnNorm}" or email "${emailNorm}"): Found ${memGrp.rows.length} group(s)`);
      if (memGrp.rows.length > 0) {
        console.log(`  -> Group #${memGrp.rows[0].group_no} (ID: ${memGrp.rows[0].id}), Domain: "${memGrp.rows[0].domain}", Guide: "${memGrp.rows[0].guide_name}"`);
      }

      // Hop C: Check registration record
      if (memGrp.rows.length > 0 || leaderGrp.rows.length > 0) {
        const grp = leaderGrp.rows[0] || memGrp.rows[0];
        const regRes = await pool.query(
          `SELECT * FROM registrations WHERE group_id = $1`,
          [grp.id]
        );
        console.log(`Hop C (Registrations table for group_id ${grp.id}): Found ${regRes.rows.length} registration(s)`, regRes.rows);
      }
    } else {
      console.log(`❌ No User/Student record found in users/students table for PRN ${item.prn}!`);
    }
  }

  pool.end();
}

diagnose();
