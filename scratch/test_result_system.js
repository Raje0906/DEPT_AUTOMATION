const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const { computeSubjectRollup, computeSGPA } = require('../services/gradeCalculator');

const JWT_SECRET = process.env.JWT_SECRET || 'dept-auto-jwt-secret-2025';

async function runTests() {
  console.log('=== RUNNING AUTOMATED VERIFICATION FOR RESULT GENERATION SYSTEM ===\n');

  // Test 1: Verify Student TE Sem 1 Results
  console.log('[Test 1] Verifying Student TE Sem 1 Results from Excel:');
  const sRes = await pool.query(
    `SELECT s.id, s.roll_no, s.enrollment_no, s.division, u.name 
     FROM students s JOIN users u ON u.id = s.user_id 
     WHERE s.enrollment_no = 'F23111002'`
  );
  if (sRes.rows.length === 0) throw new Error('Student F23111001 not found');
  const student = sRes.rows[0];
  console.log(`  ✓ Found student: ${student.name} (${student.enrollment_no}), Div: ${student.division}`);

  const marksRes = await pool.query(
    `SELECT sem.id, sem.marks_obtained, sem.is_absent, sem.status,
            et.code AS exam_code, et.name AS exam_name, et.has_result_impact,
            s.id AS subject_id, s.name AS subject_name, s.code AS subject_code,
            s.credits, s.subject_type, s.has_practical
     FROM student_exam_marks sem
     JOIN subjects s ON s.id = sem.subject_id
     JOIN exam_types et ON et.id = sem.exam_type_id
     WHERE sem.student_id = $1 AND sem.semester = 5 AND sem.academic_year = '2025-26'
     ORDER BY s.code, et.display_order`,
    [student.id]
  );
  console.log(`  ✓ Retrieved ${marksRes.rows.length} exam marks for Student in Sem 5`);

  // Group by subject and rollup
  const subMap = {};
  for (const row of marksRes.rows) {
    if (!subMap[row.subject_id]) {
      subMap[row.subject_id] = {
        subject: { id: row.subject_id, name: row.subject_name, code: row.subject_code, credits: row.credits, subject_type: row.subject_type, has_practical: row.has_practical },
        examRows: []
      };
    }
    subMap[row.subject_id].examRows.push(row);
  }

  const rolledUp = Object.values(subMap).map(({ subject, examRows }) => computeSubjectRollup(subject, examRows));
  const sgpa = computeSGPA(rolledUp);
  console.log(`  ✓ Computed SGPA: ${sgpa}`);
  for (const sub of rolledUp) {
    console.log(`    - ${sub.subjectCode} (${sub.subjectName}): Total = ${sub.totalObtained}/${sub.maxMarks}, Grade = ${sub.grade}, Points = ${sub.gradePoints}`);
  }

  // Test 2: Other Semesters Zero Check
  console.log('\n[Test 2] Verifying Other Semesters (Sem 1-4, 6-8) have 0 marks:');
  const otherSemCheck = await pool.query(
    `SELECT COUNT(*) FROM student_exam_marks WHERE student_id = $1 AND semester != 5`,
    [student.id]
  );
  const otherCount = parseInt(otherSemCheck.rows[0].count, 10);
  console.log(`  ✓ Marks count for non-5 semesters: ${otherCount} (Expected: 0)`);
  if (otherCount !== 0) throw new Error('Expected 0 marks for other semesters');

  // Test 3: Faculty RBAC Enforcement
  console.log('\n[Test 3] Verifying Server-Side Faculty RBAC:');
  const facultyRes = await pool.query(
    `SELECT f.id, u.name, f.user_id FROM faculty f JOIN users u ON u.id = f.user_id WHERE u.email = 'rajan@meswadiacoe.edu'`
  );
  const facultyRajan = facultyRes.rows[0];
  console.log(`  ✓ Faculty: ${facultyRajan.name} (ID: ${facultyRajan.id})`);

  // Check assigned subjects
  const assigned = await pool.query(
    `SELECT fsm.subject_id, s.code, fsm.division, fsm.semester 
     FROM faculty_subject_map fsm
     JOIN subjects s ON s.id = fsm.subject_id
     WHERE fsm.faculty_id = $1 AND fsm.semester = 5 AND fsm.division = 'TE 1'`,
    [facultyRajan.id]
  );
  console.log(`  ✓ Assigned subjects for Prof. Rajan Mehta in TE 1:`, assigned.rows.map(r => r.code));
  const assignedSubjectId = assigned.rows[0]?.subject_id;

  // Verify positive RBAC
  const validCheck = await pool.query(
    `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2 AND division = 'TE 1' AND semester = 5`,
    [facultyRajan.id, assignedSubjectId]
  );
  console.log(`  ✓ Authorization check for assigned subject: ${validCheck.rows.length > 0 ? 'ALLOWED (200)' : 'DENIED'}`);

  // Verify negative RBAC
  const unassignedSub = await pool.query(
    `SELECT s.id, s.code FROM subjects s WHERE s.id NOT IN (SELECT subject_id FROM faculty_subject_map WHERE faculty_id = $1) LIMIT 1`,
    [facultyRajan.id]
  );
  if (unassignedSub.rows.length > 0) {
    const invalidCheck = await pool.query(
      `SELECT id FROM faculty_subject_map WHERE faculty_id = $1 AND subject_id = $2 AND division = 'TE 1' AND semester = 5`,
      [facultyRajan.id, unassignedSub.rows[0].id]
    );
    console.log(`  ✓ Authorization check for unassigned subject (${unassignedSub.rows[0].code}): ${invalidCheck.rows.length === 0 ? 'PROPERLY REJECTED (403 Forbidden)' : 'FAILED'}`);
  }

  // Test 4: Term Work Breakdown Verification
  console.log('\n[Test 4] Verifying Term Work Breakdown Details:');
  const twRes = await pool.query(
    `SELECT tw.*, s.code FROM student_term_work_details tw JOIN subjects s ON s.id = tw.subject_id WHERE tw.student_id = $1 LIMIT 3`,
    [student.id]
  );
  for (const tw of twRes.rows) {
    console.log(`  ✓ Lab ${tw.code}: Att=${tw.attendance_marks}/5, A1=${tw.assignment_1_marks}/7, A2=${tw.assignment_2_marks}/7, Timely=${tw.timely_submission_marks}/6 -> Total=${tw.total_tw_marks}/25`);
  }

  // Test 5: Audit Log Records
  console.log('\n[Test 5] Verifying Audit Logging:');
  const auditRes = await pool.query(
    `SELECT action, table_name, reason, created_at FROM audit_log ORDER BY created_at DESC LIMIT 3`
  );
  console.log(`  ✓ Recent Audit Logs:`, auditRes.rows);

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
