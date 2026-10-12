const pool = require('../db/pool');
const fs = require('fs');

async function run() {
  const res = await pool.query('SELECT section_data FROM magazines WHERE id = $1', ['MAG-NEW-1791542342264']);
  const sd = res.rows[0].section_data;
  const events = sd.events || [];
  fs.writeFileSync('./scratch/photos_dump.json', JSON.stringify(events.map(e => ({ title: e.title, photos: e.photos })), null, 2));
  console.log('Saved to ./scratch/photos_dump.json');
  await pool.end();
}

run().catch(console.error);
