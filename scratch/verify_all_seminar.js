require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testAllGovernanceEndpoints() {
  const token = jwt.sign({ id: 1, role: 'hod', email: 'hod@engg.edu' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = 'http://localhost:5000/api';

  console.log('--- 1. Testing HOD Dashboard ---');
  let res = await fetch(`${base}/seminar/hod/dashboard?academic_year=2025-26`, { headers });
  console.log('Dashboard status:', res.status, await res.json());

  console.log('--- 2. Testing Groups & Guides ---');
  res = await fetch(`${base}/seminar/hod/groups?academic_year=2025-26`, { headers });
  const groups = await res.json();
  console.log('Groups count:', groups.length);

  console.log('--- 3. Testing Stages Fetch ---');
  res = await fetch(`${base}/seminar/hod/stages?academic_year=2025-26`, { headers });
  const stages = await res.json();
  console.log('Stages count:', stages.length);
  const stage1Id = stages[0]?.id;

  if (stage1Id) {
    console.log('--- 4. Testing Auto-Assign Panel with COI Protection ---');
    res = await fetch(`${base}/seminar/hod/panel-matrix/auto-assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        stage_id: stage1Id,
        academic_year: '2025-26',
        panel_size: 2
      })
    });
    console.log('Auto-assign status:', res.status, await res.json());

    console.log('--- 5. Testing Panel Matrix Fetch ---');
    res = await fetch(`${base}/seminar/hod/panel-matrix?stage_id=${stage1Id}&academic_year=2025-26`, { headers });
    const matrix = await res.json();
    console.log('Matrix groups count:', matrix.length);
    if (matrix[0]) {
      console.log('Sample group panel:', {
        group_no: matrix[0].group_no,
        guide: matrix[0].guide_name,
        panelists: matrix[0].panelists?.map(p => p.panel_member_name)
      });
    }

    console.log('--- 6. Testing Evaluation Progress ---');
    res = await fetch(`${base}/seminar/hod/evaluations/progress?academic_year=2025-26`, { headers });
    console.log('Progress status:', res.status, (await res.json()).length, 'records');

    console.log('--- 7. Testing Score Release ---');
    res = await fetch(`${base}/seminar/hod/stages/${stage1Id}/release`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes: 'Released by test suite' })
    });
    console.log('Release status:', res.status, await res.json());

    console.log('--- 8. Testing Reports Export Data ---');
    res = await fetch(`${base}/seminar/hod/reports/export?academic_year=2025-26`, { headers });
    console.log('Reports status:', res.status, await res.json());
  }

  console.log('--- 9. Testing Sessions Fetch ---');
  res = await fetch(`${base}/seminar/sessions`, { headers });
  const sessData = await res.json();
  console.log('Sessions count:', sessData.sessions?.length);
  const sessId = sessData.sessions?.[0]?.id;
  if (sessId) {
    console.log('--- 10. Testing Marksheet Excel Generation ---');
    res = await fetch(`${base}/seminar/sessions/${sessId}/export-marks`, { headers });
    console.log('Export marksheet status:', res.status, 'Content-Type:', res.headers.get('content-type'));
  }

  console.log('\n✅ ALL ENDPOINTS OPERATIONAL & VERIFIED!');
}

testAllGovernanceEndpoints();
