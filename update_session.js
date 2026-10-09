require('dotenv').config();
const pool = require('./db/pool');
pool.query("UPDATE seminar_sessions SET status = 'REGISTRATION_OPEN'")
  .then(() => { console.log('Successfully updated session status to REGISTRATION_OPEN'); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
