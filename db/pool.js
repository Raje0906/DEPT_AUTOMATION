const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const isRemote = hasDatabaseUrl && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isRemote ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'college_results',
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD ?? 'postgres'),
        ssl: false
      }
);

pool.on('connect', () => {
  console.log(`[DB] Connected to PostgreSQL (${hasDatabaseUrl ? (isRemote ? 'Cloud / Remote' : 'Local URL') : 'Local Config'})`);
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
