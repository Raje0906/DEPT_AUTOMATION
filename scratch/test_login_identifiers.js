const pool = require('../db/pool');

async function testIdentifier(identifier) {
  const trimmed = identifier.trim();
  const lower = trimmed.toLowerCase();
  const cleanId = lower.replace(/\s+/g, '');
  const userPrefix = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;

  let userResult = await pool.query(
    `SELECT u.id, u.name, u.role, u.email
     FROM users u WHERE LOWER(TRIM(u.email)) = $1`,
    [lower]
  );

  if (userResult.rows.length === 0) {
    const rollMatch = cleanId.match(/^(?:ce6a)?0*(\d+)$/i) || userPrefix.match(/^(?:ce6a)?0*(\d+)$/i);
    const parsedRoll = rollMatch ? String(parseInt(rollMatch[1], 10)) : null;

    userResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.email
       FROM users u
       JOIN students s ON s.user_id = u.id
       WHERE LOWER(TRIM(s.roll_no)) = $1 
          OR LOWER(TRIM(s.enrollment_no)) = $1
          OR LOWER(TRIM(s.enrollment_no)) = $2
          OR LOWER(TRIM(s.roll_no)) = $2
          OR ($3::text IS NOT NULL AND (
              s.roll_no = $3 
              OR s.roll_no = LPAD($3, 3, '0') 
              OR LOWER(TRIM(s.roll_no)) = 'ce6a' || LPAD($3, 3, '0')
              OR LOWER(TRIM(s.roll_no)) = 'ce6a' || $3
          ))`,
      [cleanId, userPrefix, parsedRoll]
    );
  }

  if (userResult.rows.length === 0) {
    userResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.email
       FROM users u
       JOIN faculty f ON f.user_id = u.id
       WHERE LOWER(TRIM(f.employee_id)) = $1 OR LOWER(TRIM(f.employee_id)) = $2`,
      [cleanId, userPrefix]
    );
  }

  console.log(`Lookup "${identifier}" => Found:`, userResult.rows[0]?.name || 'NOT FOUND');
}

async function run() {
  const tests = [
    'f23112151',
    'F23112151',
    'f23112151@meswadiacoe.edu',
    '72312799K',
    '72312799k',
    'ce6a001',
    'CE6A001',
    '1',
    '001',
    'ce6a001@meswadiacoe.edu',
    'hod@meswadiacoe.edu',
    'rajan@meswadiacoe.edu',
    'FAC001',
    'fac001',
    'FAC-SR01'
  ];

  for (const t of tests) {
    await testIdentifier(t);
  }
  process.exit(0);
}

run().catch(console.error);
