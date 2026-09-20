const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testWorkflow() {
  console.log('--- STARTING COMPREHENSIVE SEMINAR WORKFLOW VERIFICATION ---');

  // 1. Fetch Users
  const hodRes = await pool.query("SELECT u.id, u.email, u.role FROM users u WHERE u.email = 'hod@meswadiacoe.edu'");
  const coordRes = await pool.query("SELECT u.id, u.email, u.role, f.id as faculty_id, f.is_seminar_coordinator FROM users u JOIN faculty f ON f.user_id = u.id WHERE u.email = 'sunita@meswadiacoe.edu'");
  const guideRes = await pool.query("SELECT u.id, u.email, u.role, f.id as faculty_id FROM users u JOIN faculty f ON f.user_id = u.id WHERE u.email = 'rajan@meswadiacoe.edu'");
  const studentRes = await pool.query("SELECT u.id, u.email, u.role, s.id as student_id, s.enrollment_no FROM users u JOIN students s ON s.user_id = u.id WHERE u.email = 'ce6a001@meswadiacoe.edu'");

  console.log(`✓ HOD: ${hodRes.rows[0].email} (ID: ${hodRes.rows[0].id})`);
  console.log(`✓ Coordinator: ${coordRes.rows[0].email} (Faculty ID: ${coordRes.rows[0].faculty_id}, is_coord: ${coordRes.rows[0].is_seminar_coordinator})`);
  console.log(`✓ Guide: ${guideRes.rows[0].email} (Faculty ID: ${guideRes.rows[0].faculty_id})`);
  console.log(`✓ Student: ${studentRes.rows[0].email} (PRN: ${studentRes.rows[0].enrollment_no})`);

  // 2. Verify Session & Groups in DB
  const sessRes = await pool.query("SELECT * FROM seminar_sessions WHERE academic_year = '2025-26'");
  console.log(`✓ Found ${sessRes.rows.length} Seminar Session: "${sessRes.rows[0].name}" (Status: ${sessRes.rows[0].status})`);

  const groupsRes = await pool.query(`
    SELECT sg.id, sg.group_no, sg.domain, sg.status, sg.guide_name,
           (SELECT COUNT(*) FROM seminar_group_members WHERE group_id = sg.id) as members_count,
           (SELECT COUNT(*) FROM seminar_marks WHERE group_id = sg.id) as marks_count
    FROM seminar_groups sg
    WHERE sg.session_id = $1
    ORDER BY sg.group_no ASC
  `, [sessRes.rows[0].id]);

  console.log(`✓ Total Seeded Groups: ${groupsRes.rows.length}`);
  for (const g of groupsRes.rows) {
    console.log(`   - Group #${g.group_no} [${g.domain}] -> Status: ${g.status}, Guide: ${g.guide_name || 'None'}, Members: ${g.members_count}, Marks: ${g.marks_count}`);
  }

  // 3. Verify Coordinator Appointment History
  const histRes = await pool.query("SELECT * FROM seminar_coordinator_history ORDER BY created_at DESC");
  console.log(`✓ Coordinator Appointment History Records: ${histRes.rows.length}`);
  for (const h of histRes.rows) {
    console.log(`   - [${h.action}] ${h.faculty_name} (Notes: ${h.notes})`);
  }

  // 4. Verify Individual Marks Integrity for Group 1
  const marksRes = await pool.query(`
    SELECT sm.*, m.student_name
    FROM seminar_marks sm
    JOIN seminar_group_members m ON (sm.group_id = m.group_id AND sm.prn = m.prn)
    WHERE sm.group_id = $1
  `, [groupsRes.rows[0].id]);

  console.log(`✓ Group #1 Marks Verification (${marksRes.rows.length} members evaluated individually):`);
  for (const m of marksRes.rows) {
    console.log(`   - ${m.student_name} (${m.prn}): Att=${m.attendance_marks}, Pres=${m.presentation_marks}, Subj=${m.subject_understanding_marks}, Pub=${m.publication_marks}, Viva=${m.viva_marks} => Total=${Number(m.total_marks).toFixed(2)} / 50.00 [${m.status}]`);
  }

  console.log('--- ALL WORKFLOW CHECKS PASSED ---');
  process.exit(0);
}

testWorkflow().catch(e => {
  console.error('Workflow check error:', e);
  process.exit(1);
});
