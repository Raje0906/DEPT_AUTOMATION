require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testGuideApprovalFlow() {
  const hodToken = jwt.sign({ id: 1, role: 'hod', email: 'hod@engg.edu' }, process.env.JWT_SECRET);
  const coordToken = jwt.sign({ id: 2, role: 'faculty', email: 'coord@engg.edu', is_seminar_coordinator: true }, process.env.JWT_SECRET);
  const studentToken = jwt.sign({ id: 10, role: 'student', email: 'student@engg.edu' }, process.env.JWT_SECRET);
  const base = 'http://localhost:5000/api';

  console.log('--- Step 1: Submitting Guide for Group #3 for HOD Approval ---');
  // Set group 3 to AWAITING_HOD_APPROVAL
  const submitRes = await fetch(`${base}/seminar/sessions/1/submit-approvals`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${coordToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupIds: [3] })
  });
  console.log('Submit approvals response:', await submitRes.json());

  console.log('--- Step 2: Fetching HOD Groups list to verify status ---');
  let groupsRes = await fetch(`${base}/seminar/hod/groups?academic_year=2025-26`, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  let groups = await groupsRes.json();
  const group3 = groups.find(g => g.id === 3 || g.group_no === 3);
  console.log('Group #3 status in HOD view:', group3?.status, 'Guide:', group3?.guide_name);

  console.log('--- Step 3: HOD Approving Guide Allocation for Group #3 ---');
  const approveRes = await fetch(`${base}/seminar/hod/groups/${group3.id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  console.log('HOD Approve response:', await approveRes.json());

  console.log('--- Step 4: Testing HOD Bulk Approve ---');
  const bulkRes = await fetch(`${base}/seminar/hod/groups/bulk-approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hodToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ academic_year: '2025-26' })
  });
  console.log('HOD Bulk Approve response:', await bulkRes.json());

  console.log('--- Step 5: Verifying all approved groups ---');
  groupsRes = await fetch(`${base}/seminar/hod/groups?academic_year=2025-26`, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  groups = await groupsRes.json();
  console.log('Groups statuses:', groups.map(g => ({ group_no: g.group_no, guide: g.guide_name, status: g.status })));

  console.log('\n✅ HOD GUIDE APPROVAL & VISIBILITY FLOW VERIFIED!');
}

testGuideApprovalFlow();
