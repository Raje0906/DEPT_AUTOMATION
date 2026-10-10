const pool = require('../db/pool');

async function test() {
  console.log('Testing club backend...');
  const clubs = await pool.query('SELECT id, name, code, faculty_coordinator_id FROM clubs LIMIT 3');
  console.log('Clubs sample:', clubs.rows);

  const students = await pool.query(`
    SELECT s.id, s.user_id, s.enrollment_no, s.roll_no, u.name 
    FROM students s 
    JOIN users u ON u.id = s.user_id 
    LIMIT 3
  `);
  console.log('Students sample:', students.rows);

  const officeBearers = await pool.query('SELECT * FROM club_office_bearers');
  console.log('Current office bearers count:', officeBearers.rows.length);

  const events = await pool.query('SELECT id, title, status FROM club_events LIMIT 5');
  console.log('Events sample:', events.rows);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
