const pool = require('../db/pool');

async function main() {
  const r = await pool.query('SELECT id, section_data->\'publications\' as pubs FROM magazines WHERE id = $1', ['MAG-NEW-1791542342264']);
  console.log('MAG-NEW pubs:', JSON.stringify(r.rows[0].pubs, null, 2));

  const r2 = await pool.query('SELECT id, section_data->\'publications\' as pubs FROM magazines WHERE id = $1', ['MAG-2026-33']);
  console.log('MAG-2026-33 pubs length:', r2.rows[0].pubs ? r2.rows[0].pubs.length : 'none');
  if (r2.rows[0].pubs) {
    console.log('First 2 pubs of MAG-2026-33:', JSON.stringify(r2.rows[0].pubs.slice(0, 2), null, 2));
  }
  await pool.end();
}

main().catch(console.error);
