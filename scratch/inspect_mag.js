const pool = require('../db/pool');

async function run() {
  const res = await pool.query('SELECT * FROM magazines WHERE id = $1', ['MAG-2026-33']);
  const mag = res.rows[0];
  const { generateMagazinePages } = await import('../client/src/utils/magazinePages.js');
  const pages = generateMagazinePages(mag, mag.section_data);
  console.log('Total pages:', pages.length);
  pages.forEach((p, idx) => console.log(`${idx + 1}. [${p.template}] ${p.title}`));
  await pool.end();
}

run().catch(console.error);
