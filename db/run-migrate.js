#!/usr/bin/env node
/**
 * Standalone migration runner
 * Run: node db/migrate.js
 */
require('dotenv').config();
const { runMigrations } = require('./migrate');

runMigrations()
  .then(() => { console.log('Migration complete.'); process.exit(0); })
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); });
