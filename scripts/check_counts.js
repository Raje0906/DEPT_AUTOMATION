const pool = require('../db/pool');

async function checkConstraints() {
  const r = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'project_group_members'::regclass
  `);
  console.log('project_group_members constraints:', r.rows);
  process.exit(0);
}

checkConstraints().catch(e => { console.error(e); process.exit(1); });
