const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const isRemote = hasDatabaseUrl && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

const poolConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'college_results',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD ?? 'postgres'),
      ssl: false,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    };

const pool = new Pool(poolConfig);

let hasLoggedConnection = false;
pool.on('connect', (client) => {
  if (!hasLoggedConnection) {
    console.log(`[DB] Connected to PostgreSQL (${hasDatabaseUrl ? (isRemote ? 'Cloud / Remote' : 'Local URL') : 'Local Config'})`);
    hasLoggedConnection = true;
  }
  // Prevent unhandled error events on individual client sockets (e.g. ECONNRESET from cloud timeouts)
  if (client && !client._hasErrorListener) {
    client._hasErrorListener = true;
    client.on('error', (err) => {
      // Common cloud/pooler resets are safely caught here without crashing Node.js
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === '57P01') {
        console.warn(`[DB] Remote connection reset (${err.code}). Pool will automatically reconnect.`);
      } else {
        console.warn('[DB] Client socket error:', err.message || err);
      }
    });
  }
});

// Idle clients in the pool can receive disconnects/resets from Supabase/AWS poolers.
// Log a warning and allow pg-pool to evict and replace the client on next query.
pool.on('error', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    console.warn(`[DB] Idle client disconnected (${err.code}). Safe to ignore.`);
  } else {
    console.error('[DB] Unexpected error on idle client:', err.message || err);
  }
});

module.exports = pool;

