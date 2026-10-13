const pool = require('../db/pool');

async function main() {
  const r = await pool.query('SELECT * FROM magazines WHERE id = $1', ['MAG-NEW-1791542342264']);
  const mag = r.rows[0];
  const { generateMagazinePages } = await import('../client/src/utils/magazinePages.js');
  const pages = generateMagazinePages(mag, mag.section_data);
  console.log('Total pages generated:', pages.length);
  pages.forEach((p, i) => {
    console.log(`${i + 1}. [${p.template}] ${p.title}`);
  });
  await pool.end();
}

main().catch(console.error);
