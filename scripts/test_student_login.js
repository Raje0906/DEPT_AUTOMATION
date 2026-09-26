const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

async function testLogin() {
  const identifier = 'F23112050';
  const password = 'student@123';

  const cleanId = identifier.trim().toLowerCase().replace(/\s+/g, '');
  const userPrefix = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;

  // 1. Try email
  let userResult = await pool.query(
    `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active
     FROM users u 
     WHERE LOWER(TRIM(u.email)) = $1`,
    [cleanId]
  );

  // 2. Try student enrollment_no (PRN)
  if (userResult.rows.length === 0) {
    userResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.email, u.password_hash, u.department, u.is_active, s.roll_no, s.enrollment_no, s.division
       FROM users u
       JOIN students s ON s.user_id = u.id
       WHERE LOWER(TRIM(s.roll_no)) = $1 
          OR LOWER(TRIM(s.enrollment_no)) = $1
          OR LOWER(TRIM(s.enrollment_no)) = $2
          OR LOWER(TRIM(s.roll_no)) = $2`,
      [cleanId, userPrefix]
    );
  }

  if (userResult.rows.length === 0) {
    console.error('USER NOT FOUND!');
    pool.end();
    return;
  }

  const user = userResult.rows[0];
  console.log('Found user:', {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roll_no: user.roll_no,
    enrollment_no: user.enrollment_no,
    division: user.division,
    is_active: user.is_active
  });

  const valid = await bcrypt.compare(password, user.password_hash);
  console.log('Password check (student@123):', valid ? 'MATCH SUCCESSFUL!' : 'FAILED');

  pool.end();
}

testLogin();
