const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, res => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch (e) {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- TESTING FACULTY PERMISSIONS ---');

  // 1. Login as unauthorized faculty: Dr. (Mrs.) S. K. Wagh (skw@meswadiacoe.edu)
  const loginOther = await post('/api/auth/login', {
    identifier: 'skw@meswadiacoe.edu',
    password: 'faculty@123'
  });
  console.log('Login Dr. S. K. Wagh status:', loginOther.status, 'user:', loginOther.body?.user?.name, 'role:', loginOther.body?.user?.role);
  const otherToken = loginOther.body?.token;

  if (!otherToken) {
    throw new Error('Failed to login as Dr. S. K. Wagh');
  }

  // 2. Attempt unauthorized magazine creation via API with other faculty token
  const unauthCreate = await post('/api/magazines', {
    title: 'Unauthorized Magazine',
    academicYear: '2026–27',
    semester: 'Odd',
    department: 'Computer Engineering'
  }, { 'Authorization': `Bearer ${otherToken}` });

  console.log('Unauthorized creation status (expected 403):', unauthCreate.status, 'body:', unauthCreate.body);

  if (unauthCreate.status === 403) {
    console.log('PASS: Unauthorized faculty was rejected with HTTP 403 Forbidden!');
  } else {
    console.error('FAIL: Expected HTTP 403, got:', unauthCreate.status);
  }

  // 3. Attempt creation with NO token
  const noTokenCreate = await post('/api/magazines', {
    title: 'No Token Magazine'
  });
  console.log('No token creation status (expected 401):', noTokenCreate.status, 'body:', noTokenCreate.body);

  // 4. Login as authorized faculty: Dr. (Mrs.) S. S. Raskar (ssr@meswadiacoe.edu)
  const loginSSR = await post('/api/auth/login', {
    identifier: 'ssr@meswadiacoe.edu',
    password: 'faculty@123'
  });
  console.log('Login Dr. S. S. Raskar status:', loginSSR.status, 'user:', loginSSR.body?.user?.name, 'role:', loginSSR.body?.user?.role, 'employee_id:', loginSSR.body?.user?.employee_id);
  const ssrToken = loginSSR.body?.token;

  // 5. Attempt authorized magazine creation via API
  const authCreate = await post('/api/magazines', {
    title: 'Reflection',
    academicYear: '2026–27',
    semester: 'Odd',
    department: 'Department of Computer Engineering',
    tagline: 'Authorized Test by Dr. S. S. Raskar'
  }, { 'Authorization': `Bearer ${ssrToken}` });

  console.log('Authorized creation status (expected 201):', authCreate.status, 'created ID:', authCreate.body?.magazine?.id);

  if (authCreate.status === 201) {
    console.log('PASS: Dr. (Mrs.) S. S. Raskar successfully created magazine!');
    // Clean up test magazine if created
    const pool = require('../db/pool');
    await pool.query('DELETE FROM magazines WHERE id = $1', [authCreate.body.magazine.id]);
    console.log('Cleaned up test magazine record.');
    await pool.end();
  } else {
    console.error('FAIL: Expected HTTP 201, got:', authCreate.status);
  }
}

run().catch(console.error);
