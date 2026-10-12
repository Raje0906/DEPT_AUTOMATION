const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('./scratch/photos_dump.json', 'utf8'));

dump.forEach((ev, i) => {
  console.log(`Event ${i + 1}: ${ev.title}`);
  (ev.photos || []).forEach((ph, j) => {
    const isBase64 = ph.url && ph.url.startsWith('data:');
    const urlInfo = isBase64 ? `data: (length: ${ph.url.length})` : ph.url;
    console.log(`  Photo ${j + 1}: name="${ph.name}", caption="${ph.caption}", url=${urlInfo}`);
  });
});
