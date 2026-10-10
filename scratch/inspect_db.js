const pool = require('../db/pool');

async function main() {
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('Tables:', tables.rows.map(r => r.table_name));

  for (const t of ['clubs', 'club_events', 'club_members', 'club_event_registrations', 'coordinator_assignments']) {
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = $1 
       ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\nColumns for ${t}:`, cols.rows);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
