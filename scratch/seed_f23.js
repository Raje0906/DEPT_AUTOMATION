const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

async function seedStudent() {
  const email = 'f23112151@meswadiacoe.edu';
  const prn = 'F23112151';
  const rollNo = 'CE6A251';
  const name = 'PRN STUDENT (F23112151)';
  const passwordHash = await bcrypt.hash('student@123', 10);

  const uRes = await pool.query(
    `INSERT INTO users (name, role, email, password_hash, department)
     VALUES ($1, 'student', $2, $3, 'Computer Engineering')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [name, email, passwordHash]
  );

  const userId = uRes.rows[0].id;

  await pool.query(
    `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division)
     VALUES ($1, $2, $3, '2025-26', 6, 'A')
     ON CONFLICT (user_id) DO UPDATE SET roll_no = EXCLUDED.roll_no, enrollment_no = EXCLUDED.enrollment_no`,
    [userId, rollNo, prn]
  );

  console.log(`Student ${prn} successfully seeded with user_id ${userId}`);
  process.exit(0);
}

seedStudent().catch(e => { console.error(e); process.exit(1); });
