const pool = require('../db/pool');
const { calculateGrade, computeSubjectRollup } = require('../services/gradeCalculator');

async function test() {
  const subRes = await pool.query("SELECT * FROM subjects WHERE code = 'CE504'");
  const subject = subRes.rows[0];
  console.log('Subject:', subject.name, 'ID:', subject.id);

  const stRes = await pool.query(
    "SELECT s.id, s.roll_no, s.enrollment_no, u.name FROM students s JOIN users u ON s.user_id = u.id WHERE s.division = 'TE Comp 2' ORDER BY CAST(NULLIF(regexp_replace(s.roll_no, '[^0-9]', '', 'g'), '') AS INTEGER)"
  );
  console.log('Total students in TE Comp 2:', stRes.rows.length);

  const studentIds = stRes.rows.map(r => r.id);
  const mRes = await pool.query(
    `SELECT sem.student_id, sem.marks_obtained, sem.is_absent, et.code as exam_code 
     FROM student_exam_marks sem 
     JOIN exam_types et ON sem.exam_type_id = et.id 
     WHERE sem.subject_id = $1 AND sem.academic_year = '2026-27' AND sem.student_id = ANY($2::int[])`,
    [subject.id, studentIds]
  );
  console.log('Marks rows retrieved:', mRes.rows.length);

  const marksByStudent = {};
  for (const m of mRes.rows) {
    if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
    marksByStudent[m.student_id].push(m);
  }

  const scores = [];
  for (const st of stRes.rows) {
    const rows = marksByStudent[st.id] || [];
    const rollup = computeSubjectRollup(subject, rows);
    scores.push({
      roll: st.roll_no,
      prn: st.enrollment_no,
      name: st.name,
      total: rollup.total,
      percentage: rollup.percentage,
      grade: rollup.grade,
      gradePoints: rollup.gradePoints,
    });
  }

  scores.sort((a, b) => b.total - a.total);
  console.log('Top 4 Toppers:');
  console.log(scores.slice(0, 4));

  const passed = scores.filter(s => s.grade !== 'F').length;
  const highest = Math.max(...scores.map(s => s.total));
  const avg = scores.reduce((s, x) => s + x.total, 0) / scores.length;

  console.log('Pass Percentage:', (passed / scores.length * 100).toFixed(1) + '%');
  console.log('Highest:', highest);
  console.log('Average:', avg.toFixed(1));
  console.log('Backlogs:', scores.length - passed);
}

test()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
