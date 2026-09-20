const pool = require('../db/pool');

async function run() {
  const res = await pool.query(`SELECT s.id, s.roll_no, s.enrollment_no, u.email, u.name FROM students s JOIN users u ON u.id = s.user_id WHERE s.enrollment_no ILIKE '%23112151%' OR s.roll_no ILIKE '%23112151%'`);
  console.log('Match 23112151:', res.rows);

  const sample = await pool.query(`SELECT s.roll_no, s.enrollment_no, u.email FROM students s JOIN users u ON u.id = s.user_id LIMIT 5`);
  console.log('Sample students:', sample.rows);
  
  process.exit(0);
}

run().catch(console.error);
