require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getCredentials() {
  const users = await pool.query(`
    SELECT u.id, u.name, u.email, u.role, f.designation, f.is_seminar_coordinator, f.is_project_coordinator
    FROM users u
    LEFT JOIN faculty f ON u.id = f.user_id
    WHERE u.role IN ('faculty', 'hod', 'admin')
    ORDER BY u.role DESC, u.id ASC
  `);
  console.log(JSON.stringify(users.rows, null, 2));
  await pool.end();
}

getCredentials();
