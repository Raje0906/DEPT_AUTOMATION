const pool = require('../db/pool');

async function testEndpoints() {
  const selectedYear = '2026-27';

  // 1. Breakdown
  const studentBreakdownRes = await pool.query(
    `SELECT current_semester, division, COUNT(*) AS student_count
     FROM students
     GROUP BY current_semester, division
     ORDER BY current_semester, division`
  );

  console.log('=== CURRENT COHORT BREAKDOWN ===');
  console.log(studentBreakdownRes.rows);

  // 2. Preview 5 -> 6
  const eligibleStudentsRes = await pool.query(
    `SELECT COUNT(*) AS count
     FROM students
     WHERE current_semester = $1 AND division = ANY($2::text[])`,
    [5, ['TE 1', 'TE 2', 'TE 3']]
  );
  console.log('Eligible for Sem 5 -> Sem 6 promotion:', eligibleStudentsRes.rows[0].count);

  const targetSubjectsRes = await pool.query(
    `SELECT code, name FROM subjects WHERE semester = 6 ORDER BY code`
  );
  console.log('Sem 6 Subjects ready for allocation:', targetSubjectsRes.rows.map(s => s.code));

  pool.end();
}

testEndpoints();
