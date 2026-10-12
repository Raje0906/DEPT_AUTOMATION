const pool = require('../db/pool');

async function run() {
  const res = await pool.query('SELECT * FROM magazines WHERE id = $1', ['MAG-NEW-1791542342264']);
  const mag = res.rows[0];
  const { generateMagazinePages } = await import('../client/src/utils/magazinePages.js');
  const pages = generateMagazinePages(mag, mag.section_data);
  console.log('Pages count:', pages.length);
  pages.forEach((p, i) => console.log(`${i + 1}. [${p.template}] ${p.title} - data.title: ${p.data?.title}`));
  await pool.end();
}

run().catch(console.error);
