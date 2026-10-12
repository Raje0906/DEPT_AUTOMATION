'use strict';
require('dotenv').config();
const pool = require('../db/pool');

async function main() {
  const res = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'seminar_group_members'::regclass
  `);
  console.log('seminar_group_members constraints:');
  console.table(res.rows);

  const colsGuides = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'seminar_guides'
    ORDER BY ordinal_position
  `);
  console.log('seminar_guides columns:');
  console.table(colsGuides.rows);

  const colsGroups = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'seminar_groups'
    ORDER BY ordinal_position
  `);
  console.log('seminar_groups columns:');
  console.table(colsGroups.rows);

  await pool.end();
}

main().catch(console.error);
