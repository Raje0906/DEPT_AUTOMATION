'use strict';

const XLSX = require('xlsx');
const { importBEProjectWorkbook } = require('../services/projectImporter');

async function main() {
  const filePath = process.argv[2] || 'E:\\BE Project Topic Preferences form (AY 2026-27) (Responses).xlsx';
  console.log(`[Import Script] Reading workbook from: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const result = await importBEProjectWorkbook(wb, '2026-27');
  console.log(`[Import Script Success] Created ${result.groupsCount} groups and ${result.membersCount} members!`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Import Script Fatal]', err);
      process.exit(1);
    });
}
