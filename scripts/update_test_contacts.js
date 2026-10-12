const pool = require('../db/pool');

async function run() {
  try {
    await pool.query("UPDATE students SET mobile = '9404241539' WHERE UPPER(enrollment_no) = 'F23112035'");
    await pool.query("UPDATE students SET mobile = '9699616876' WHERE UPPER(enrollment_no) = 'F23112050'");
    await pool.query("UPDATE students SET mobile = '8446016602' WHERE UPPER(enrollment_no) = 'F23112061'");
    await pool.query("UPDATE students SET mobile = '9970024042' WHERE UPPER(enrollment_no) = 'F23112151'");

    const r = await pool.query(`
      SELECT s.enrollment_no, u.name, s.mobile 
      FROM students s 
      JOIN users u ON s.user_id = u.id 
      WHERE UPPER(s.enrollment_no) IN ('F23112050', 'F23112035', 'F23112061', 'F23112151')
    `);
    console.log('Updated students:', r.rows);
  } catch (err) {
    console.error('Error updating contacts:', err);
  } finally {
    await pool.end();
  }
}

run();
