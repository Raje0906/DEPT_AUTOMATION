require('dotenv').config();
const pool = require('../db/pool');
const query = (text, params) => pool.query(text, params);
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dept_mgmt_secret_key_2026';
const BASE_URL = 'http://localhost:5000/api';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function api(method, endpoint, body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, ok: res.ok };
}

async function runTest() {
  console.log('--- Starting Comprehensive Club Office Bearers & Event Workflow Test ---');

  // 1. Get an existing coordinator and a club they coordinate
  const clubsRes = await query(`
    SELECT c.id, c.name, c.code, c.faculty_coordinator_id, f.user_id as coord_user_id, u.email as coord_email, u.name as coord_name
    FROM clubs c
    JOIN faculty f ON c.faculty_coordinator_id = f.id
    JOIN users u ON f.user_id = u.id
    LIMIT 1
  `);

  if (clubsRes.rows.length === 0) {
    throw new Error('No club with faculty coordinator found in database.');
  }

  const club = clubsRes.rows[0];
  console.log(`[OK] Found Club: ${club.name} (${club.code}), Coordinator: ${club.coord_name} (User ID: ${club.coord_user_id})`);

  // Get two students
  const studentsRes = await query(`
    SELECT s.id, u.name, s.enrollment_no as prn, s.roll_no, s.division, s.class_year, s.user_id, u.email
    FROM students s
    JOIN users u ON s.user_id = u.id
    LIMIT 2
  `);

  if (studentsRes.rows.length < 2) {
    throw new Error('Need at least 2 students in database for test.');
  }

  const student1 = studentsRes.rows[0];
  const student2 = studentsRes.rows[1];
  console.log(`[OK] Student 1: ${student1.name} (ID: ${student1.id}, User ID: ${student1.user_id})`);
  console.log(`[OK] Student 2: ${student2.name} (ID: ${student2.id}, User ID: ${student2.user_id})`);

  // Coordinator token
  const coordToken = makeToken({
    id: club.coord_user_id,
    email: club.coord_email,
    role: 'faculty',
    name: club.coord_name,
  });

  // Student 1 token
  const student1Token = makeToken({
    id: student1.user_id,
    email: student1.email,
    role: 'student',
    name: student1.name,
    student_id: student1.id,
  });

  // Student 2 token
  const student2Token = makeToken({
    id: student2.user_id,
    email: student2.email,
    role: 'student',
    name: student2.name,
    student_id: student2.id,
  });

  // Unauthorized token (another user)
  const outsiderToken = makeToken({
    id: 99999,
    email: 'random@wadia.edu',
    role: 'faculty',
    name: 'Dr. Random Outsider',
  });

  const coordHeaders = { Authorization: `Bearer ${coordToken}` };
  const s1Headers = { Authorization: `Bearer ${student1Token}` };
  const s2Headers = { Authorization: `Bearer ${student2Token}` };
  const outsiderHeaders = { Authorization: `Bearer ${outsiderToken}` };

  const AY = '2026-27';

  // Cleanup any existing office bearers for this test club in AY and for test students
  await query('DELETE FROM club_office_bearers WHERE club_id = $1 AND academic_year = $2', [club.id, AY]);
  await query('DELETE FROM club_office_bearers WHERE student_id IN ($1, $2) AND academic_year = $3', [student1.id, student2.id, AY]);

  // TEST 1: Unauthorized coordinator attempt to manage club
  console.log('\n[TEST 1] Testing Ownership Enforcement on Office Bearers...');
  const unauthorizedRes = await api('POST', `/clubs/${club.id}/office-bearers`, {
    student_id: student1.id,
    role: 'President',
    academic_year: AY,
  }, outsiderHeaders);

  if (unauthorizedRes.status === 403) {
    console.log('[PASS] Outsider correctly blocked with 403 Forbidden.');
  } else {
    throw new Error(`Expected 403 Forbidden, got ${unauthorizedRes.status}`);
  }

  // TEST 2: Coordinator assigns Student 1 as President
  console.log('\n[TEST 2] Coordinator assigns Student 1 as President...');
  const assignPresRes = await api('POST', `/clubs/${club.id}/office-bearers`, {
    student_id: student1.id,
    role: 'President',
    academic_year: AY,
  }, coordHeaders);

  if (!assignPresRes.ok) {
    throw new Error(`Assign President failed: ${JSON.stringify(assignPresRes.data)}`);
  }
  console.log(`[PASS] Assigned President:`, assignPresRes.data.officeBearer.role);

  // TEST 3: Attempt to assign same student as Vice President (Enforce 1 role per club rule)
  console.log('\n[TEST 3] Attempting to assign same student as Vice President (Should Fail)...');
  const dualRoleRes = await api('POST', `/clubs/${club.id}/office-bearers`, {
    student_id: student1.id,
    role: 'Vice President',
    academic_year: AY,
  }, coordHeaders);

  if (dualRoleRes.status === 400) {
    console.log('[PASS] Server rejected dual role for same student with 400 Bad Request:', dualRoleRes.data.error);
  } else {
    throw new Error(`Expected 400 Bad Request, got ${dualRoleRes.status}`);
  }

  // TEST 4: Coordinator assigns Student 2 as Vice President
  console.log('\n[TEST 4] Coordinator assigns Student 2 as Vice President...');
  const assignVpRes = await api('POST', `/clubs/${club.id}/office-bearers`, {
    student_id: student2.id,
    role: 'Vice President',
    academic_year: AY,
  }, coordHeaders);

  if (!assignVpRes.ok) {
    throw new Error(`Assign Vice President failed: ${JSON.stringify(assignVpRes.data)}`);
  }
  console.log(`[PASS] Assigned Vice President:`, assignVpRes.data.officeBearer.role);

  // TEST 5: Student 1 queries my-office-bearer-roles (Immediate effect without re-login)
  console.log('\n[TEST 5] Student 1 queries dynamic roles endpoint...');
  const s1RolesRes = await api('GET', `/clubs/my-office-bearer-roles?academicYear=${AY}`, null, s1Headers);
  if (!s1RolesRes.ok || s1RolesRes.data.roles.length === 0 || s1RolesRes.data.roles[0].role !== 'President') {
    throw new Error(`Student 1 roles invalid: ${JSON.stringify(s1RolesRes.data)}`);
  }
  console.log(`[PASS] Student 1 roles:`, s1RolesRes.data.roles.map((r) => `${r.role} in ${r.club_name}`));

  // TEST 6: Student 1 proposes an event with a past date (Should Fail)
  console.log('\n[TEST 6] Student 1 proposes an event with past date (Should Fail)...');
  const pastDateRes = await api('POST', `/clubs/${club.id}/propose-event`, {
    title: 'Past Event Test',
    event_type: 'Workshop',
    start_date: '2020-01-01',
    time: '10:00 AM',
    mode: 'Offline',
    venue: 'Room 301',
    description: 'Past date event proposal',
    academic_year: AY,
  }, s1Headers);

  if (pastDateRes.status === 400) {
    console.log('[PASS] Server rejected past date with 400:', pastDateRes.data.error);
  } else {
    throw new Error(`Expected 400 for past date, got ${pastDateRes.status}`);
  }

  // TEST 7: Student 1 proposes a valid event (Future date)
  console.log('\n[TEST 7] Student 1 proposes a valid event for AY 2026-27...');
  const tomorrow = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
  const proposeRes = await api('POST', `/clubs/${club.id}/propose-event`, {
    title: 'Automated Test Hackathon 2026',
    event_type: 'Hackathon',
    start_date: tomorrow,
    time: '09:00 AM - 05:00 PM',
    mode: 'Offline',
    venue: 'Computer Center Lab 1',
    speaker_or_trainer: 'Prof. Test Expert',
    description: 'Departmental Hackathon proposed by Student President.',
    academic_year: AY,
  }, s1Headers);

  if (!proposeRes.ok) {
    throw new Error(`Event proposal failed: ${JSON.stringify(proposeRes.data)}`);
  }
  const createdEvent = proposeRes.data.event;
  console.log(`[PASS] Event proposed with ID ${createdEvent.id}, status: ${createdEvent.status}`);
  if (createdEvent.status !== 'PENDING') {
    throw new Error(`Expected PENDING status, got ${createdEvent.status}`);
  }

  // TEST 8: Verify Event does NOT appear in public events endpoint
  console.log('\n[TEST 8] Verifying pending event is hidden from public events endpoint...');
  const publicEventsRes = await api('GET', `/clubs/events?academicYear=${AY}`, null, s2Headers);
  const foundInPublic = (publicEventsRes.data.events || []).find((e) => e.id === createdEvent.id);
  if (foundInPublic) {
    throw new Error('Pending event leaked into public events endpoint!');
  }
  console.log('[PASS] Pending event is strictly hidden from public student view.');

  // TEST 9: Coordinator views pending approvals
  console.log('\n[TEST 9] Coordinator checks Event Approvals queue...');
  const approvalsRes = await api('GET', `/clubs/${club.id}/event-approvals?academicYear=${AY}`, null, coordHeaders);
  const pendingInQueue = (approvalsRes.data.pendingEvents || approvalsRes.data.approvals || []).find((e) => e.id === createdEvent.id);
  if (!pendingInQueue) {
    throw new Error('Proposed event not found in coordinator approvals queue!');
  }
  console.log(`[PASS] Found event "${pendingInQueue.title}" in coordinator queue.`);

  // TEST 10: Coordinator rejects event without remark (Should Fail)
  console.log('\n[TEST 10] Coordinator attempts to reject without remark (Should Fail)...');
  const emptyRemarkRes = await api('PATCH', `/clubs/${club.id}/events/${createdEvent.id}/approval`, {
    decision: 'REJECTED',
    remark: '',
  }, coordHeaders);

  if (emptyRemarkRes.status === 400) {
    console.log('[PASS] Server rejected empty rejection remark: 400:', emptyRemarkRes.data.error);
  } else {
    throw new Error(`Expected 400 for empty remark, got ${emptyRemarkRes.status}`);
  }

  // TEST 11: Coordinator rejects with remark
  console.log('\n[TEST 11] Coordinator rejects with remark...');
  const rejectRes = await api('PATCH', `/clubs/${club.id}/events/${createdEvent.id}/approval`, {
    decision: 'REJECTED',
    remark: 'Please update venue from Lab 1 to Auditorium.',
  }, coordHeaders);

  if (!rejectRes.ok) {
    throw new Error(`Rejection failed: ${JSON.stringify(rejectRes.data)}`);
  }
  console.log(`[PASS] Event rejected with remark: "${rejectRes.data.event.rejection_remark}"`);

  // TEST 12: Student 1 views event status in My Club tracker
  console.log('\n[TEST 12] Student views rejection in My Club tracker...');
  const myEventsRes = await api('GET', `/clubs/${club.id}/my-club-events?academicYear=${AY}`, null, s1Headers);
  const rejectedEventInTracker = (myEventsRes.data.events || []).find((e) => e.id === createdEvent.id);
  if (!rejectedEventInTracker || rejectedEventInTracker.status !== 'REJECTED') {
    throw new Error('Rejected event status not reflected in student tracker!');
  }
  console.log(`[PASS] Student sees status REJECTED with remark: "${rejectedEventInTracker.rejection_remark}"`);

  // TEST 13: Student 1 edits and resubmits rejected event
  console.log('\n[TEST 13] Student 1 edits and resubmits the event with updated venue...');
  const resubmitRes = await api('PUT', `/clubs/${club.id}/events/${createdEvent.id}/resubmit`, {
    title: 'Automated Test Hackathon 2026 (Updated)',
    event_type: 'Hackathon',
    start_date: tomorrow,
    time: '09:00 AM - 05:00 PM',
    mode: 'Offline',
    venue: 'Main Auditorium',
    speaker_or_trainer: 'Prof. Test Expert',
    description: 'Departmental Hackathon in Auditorium as requested.',
  }, s1Headers);

  if (!resubmitRes.ok) {
    throw new Error(`Resubmit failed: ${JSON.stringify(resubmitRes.data)}`);
  }
  console.log(`[PASS] Resubmitted successfully. New status: ${resubmitRes.data.event.status}, remark cleared: ${resubmitRes.data.event.rejection_remark === null}`);

  // TEST 14: Coordinator approves the resubmitted event
  console.log('\n[TEST 14] Coordinator approves the event...');
  const approveRes = await api('PATCH', `/clubs/${club.id}/events/${createdEvent.id}/approval`, {
    decision: 'APPROVED',
  }, coordHeaders);

  if (!approveRes.ok) {
    throw new Error(`Approval failed: ${JSON.stringify(approveRes.data)}`);
  }
  console.log(`[PASS] Event approved! Status: ${approveRes.data.event.status}`);

  // TEST 15: Verify approved event is now visible in public student activities
  console.log('\n[TEST 15] Checking public activities endpoint for approved event...');
  const publicEventsAfterApprove = await api('GET', `/clubs/events?academicYear=${AY}`, null, s2Headers);
  const foundApproved = (publicEventsAfterApprove.data.events || []).find((e) => e.id === createdEvent.id);
  if (!foundApproved) {
    throw new Error('Approved event not found in public activities endpoint!');
  }
  console.log(`[PASS] Approved event "${foundApproved.title}" is now visible to all students!`);

  // TEST 16: Coordinator revokes President role
  console.log('\n[TEST 16] Coordinator revokes President role...');
  const revokeRes = await api('DELETE', `/clubs/${club.id}/office-bearers/${assignPresRes.data.officeBearer.id}`, null, coordHeaders);
  if (!revokeRes.ok) {
    throw new Error(`Revoke failed: ${JSON.stringify(revokeRes.data)}`);
  }
  console.log(`[PASS] Role revoked: ${revokeRes.data.message}`);

  // Verify Student 1 no longer has President role for this club
  const s1RolesAfterRevoke = await api('GET', `/clubs/my-office-bearer-roles?academicYear=${AY}`, null, s1Headers);
  const stillHasClubRole = (s1RolesAfterRevoke.data.roles || []).find((r) => r.club_id === club.id);
  if (stillHasClubRole) {
    throw new Error('Revoked role still returned for Student 1 in this club!');
  }
  console.log('[PASS] Student 1 dynamic role for this club is revoked immediately without re-login.');

  // Clean up test data
  console.log('\n[CLEANUP] Cleaning up test event and remaining office bearer...');
  await query('DELETE FROM club_events WHERE id = $1', [createdEvent.id]);
  await query('DELETE FROM club_office_bearers WHERE club_id = $1 AND academic_year = $2', [club.id, AY]);
  console.log('[CLEANUP] Done.');

  console.log('\n=======================================================');
  console.log('🎉 ALL 16 INTEGRATION AND SECURITY TESTS PASSED SUCCESSFULLY!');
  console.log('=======================================================');
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Failed with Error:', err);
    process.exit(1);
  });
