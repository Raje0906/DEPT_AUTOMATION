const pool = require('../db/pool');

async function check() {
  const res = await pool.query("SELECT id, title, template, issue_number FROM magazines WHERE id = 'MAG-NEW-1791542342264'");
  console.log('Magazine record:', res.rows[0]);
  process.exit(0);
}

check().catch(console.error);
