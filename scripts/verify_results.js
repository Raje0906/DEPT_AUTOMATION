const pool = require('../db/pool');

async function verify() {
  const prn = 'F23112050';
  const res = await pool.query(
    `SELECT s.code, s.name, et.code as exam, sem.marks_obtained, sem.status
     FROM student_exam_marks sem
     JOIN subjects s ON s.id = sem.subject_id
     JOIN exam_types et ON et.id = sem.exam_type_id
     JOIN students st ON st.id = sem.student_id
     WHERE st.enrollment_no = $1 AND sem.academic_year = '2026-27'
     ORDER BY s.code, et.display_order`,
    [prn]
  );

  console.log(`=== MARKS FOR STUDENT ${prn} (Found: ${res.rows.length} entries) ===`);
  res.rows.forEach(r => {
    console.log(`${r.code.padEnd(12)} | ${r.exam.padEnd(15)} | ${String(r.marks_obtained).padStart(5)} | Status: ${r.status}`);
  });

  const twRes = await pool.query(
    `SELECT s.code, tw.attendance_marks, tw.assignment_1_marks, tw.assignment_2_marks, tw.timely_submission_marks, tw.total_tw_marks
     FROM student_term_work_details tw
     JOIN subjects s ON s.id = tw.subject_id
     JOIN students st ON st.id = tw.student_id
     WHERE st.enrollment_no = $1 AND tw.academic_year = '2026-27'`,
    [prn]
  );
  console.log('\n=== TERM WORK BREAKDOWN ===');
  twRes.rows.forEach(tw => {
    console.log(`${tw.code.padEnd(12)} | Att: ${tw.attendance_marks} | A1: ${tw.assignment_1_marks} | A2: ${tw.assignment_2_marks} | Timely: ${tw.timely_submission_marks} | Total: ${tw.total_tw_marks}`);
  });

  pool.end();
}

verify();
