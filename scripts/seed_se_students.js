const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const SE_CLASSES = [
  { division: 'SE Comp 1', divIndex: 1, prefix: 'SE1' },
  { division: 'SE Comp 2', divIndex: 2, prefix: 'SE2' },
  { division: 'SE Comp 3', divIndex: 3, prefix: 'SE3' },
  { division: 'SE Comp 4', divIndex: 4, prefix: 'SE4' },
];

async function seedSEStudents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[Seed SE] Cleaning up any old SE student records...');
    const oldUsersRes = await client.query(`
      SELECT s.user_id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.division IN ('SE Comp 1', 'SE Comp 2', 'SE Comp 3', 'SE Comp 4')
         OR (s.division LIKE '%SE%' AND (u.email LIKE '%test%' OR s.enrollment_no LIKE '72319999%' OR s.enrollment_no LIKE 'SE%'))
    `);
    const oldUserIds = oldUsersRes.rows.map(r => r.user_id);
    if (oldUserIds.length > 0) {
      await client.query('DELETE FROM student_exam_marks WHERE student_id IN (SELECT id FROM students WHERE user_id = ANY($1))', [oldUserIds]);
      await client.query('DELETE FROM student_term_work_details WHERE student_id IN (SELECT id FROM students WHERE user_id = ANY($1))', [oldUserIds]);
      await client.query('DELETE FROM marks WHERE student_id IN (SELECT id FROM students WHERE user_id = ANY($1))', [oldUserIds]);
      await client.query('DELETE FROM students WHERE user_id = ANY($1)', [oldUserIds]);
      await client.query('DELETE FROM users WHERE id = ANY($1)', [oldUserIds]);
      console.log(`[Seed SE] Cleaned up ${oldUserIds.length} old SE student records.`);
    }

    const defaultPasswordHash = await bcrypt.hash('student@123', 10);
    let totalCreated = 0;

    for (const cls of SE_CLASSES) {
      console.log(`[Seed SE] Creating 60 students for ${cls.division}...`);
      for (let roll = 1; roll <= 60; roll++) {
        const name = `test${roll}`;
        const email = `se${cls.divIndex}.test${roll}@meswadiacoe.edu`;
        const rollNo = String(roll);
        const enrollNo = `${cls.prefix}${String(roll).padStart(3, '0')}`; // e.g. SE1001 to SE1060

        // 1. Insert into users
        const userRes = await client.query(
          `INSERT INTO users (name, role, email, password_hash, department)
           VALUES ($1, 'student', $2, $3, 'Computer Engineering')
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
           RETURNING id`,
          [name, email, defaultPasswordHash]
        );
        const userId = userRes.rows[0].id;

        // 2. Insert into students
        await client.query(
          `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division, class_year)
           VALUES ($1, $2, $3, '2024-28', 3, $4, 'SE')
           ON CONFLICT (user_id) DO UPDATE 
           SET roll_no = EXCLUDED.roll_no, enrollment_no = EXCLUDED.enrollment_no, 
               batch = EXCLUDED.batch, current_semester = EXCLUDED.current_semester, 
               division = EXCLUDED.division, class_year = EXCLUDED.class_year`,
          [userId, rollNo, enrollNo, cls.division]
        );

        totalCreated++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Seed SE] Successfully populated ${totalCreated} students across all 4 SE classes!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed SE] Error during seeding:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSEStudents()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
