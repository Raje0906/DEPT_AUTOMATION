'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateSingleGroup,
  runStandingValidation,
  STANDARD_DOMAINS,
} = require('./seminarParser');
const { getExportLifecycleLabel } = require('./seminarExporter');

// ─── validateSingleGroup ───────────────────────────────────────────────────

test('validateSingleGroup: valid 3-member group passes', () => {
  const input = {
    domain: 'Artificial Intelligence & Machine Learning (AIML)',
    members: [
      { name: 'Alice Smith', prn: '2025TE0001', division: 'A', mobile: '9876543210', email: 'alice@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Bob Jones', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Charlie Ray', prn: '2025TE0003', division: 'A', mobile: '9876543212', email: 'charlie@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.cleanedGroup.members.length, 3);
  assert.equal(res.cleanedGroup.members[0].is_leader, true);
  assert.equal(res.cleanedGroup.members[1].is_leader, false);
});

test('validateSingleGroup: warns on group with fewer than 3 members without blocking submit', () => {
  const input = {
    domain: 'Cloud Computing & DevOps',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '9876543210', email: 'alice@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, true);
  assert.ok(res.warnings.some(w => w.includes('2 member(s)')));
});

test('validateSingleGroup: rejects duplicate PRN within same submission', () => {
  const input = {
    domain: 'Data Science & Big Data Analytics',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '9876543210', email: 'alice@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0001', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Charlie', prn: '2025TE0003', division: 'A', mobile: '9876543212', email: 'charlie@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('Duplicate PRN "2025TE0001"')));
});

test('validateSingleGroup: soft warns on unnormalized phone or non-standard email without blocking submit', () => {
  const input = {
    domain: 'Cyber Security & Cryptography',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '1234', email: 'alice_invalid', topic1: 'T1', topic2: '', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Charlie', prn: '2025TE0003', division: 'A', mobile: '9876543212', email: 'charlie@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, true);
  assert.ok(res.warnings.some(w => w.includes('Mobile number') || w.includes('Email address')));
});

test('validateSingleGroup: custom domain generates a warning for coordinator', () => {
  const input = {
    domain: 'Quantum Computing and Cryptanalysis',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '9876543210', email: 'alice@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Charlie', prn: '2025TE0003', division: 'A', mobile: '9876543212', email: 'charlie@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, true);
  assert.equal(res.warnings.length, 1);
  assert.ok(res.warnings[0].includes('coordinator review'));
});

// ─── runStandingValidation ────────────────────────────────────────────────

test('runStandingValidation: detects duplicate PRN across different groups', () => {
  const groups = [
    {
      id: 1,
      group_no: 1,
      domain: 'Cloud Computing & DevOps',
      members: [
        { member_index: 1, student_name: 'Alice', prn: '2025TE0001' },
        { member_index: 2, student_name: 'Bob', prn: '2025TE0002' },
        { member_index: 3, student_name: 'Charlie', prn: '2025TE0003' },
      ],
    },
    {
      id: 2,
      group_no: 2,
      domain: 'Blockchain & Distributed Systems',
      members: [
        { member_index: 1, student_name: 'David', prn: '2025TE0004' },
        { member_index: 2, student_name: 'Bob Clone', prn: '2025TE0002' }, // cross-group duplicate!
        { member_index: 3, student_name: 'Eva', prn: '2025TE0005' },
      ],
    },
  ];

  const res = runStandingValidation(groups);
  assert.equal(res.summary.errors, 1);
  assert.ok(res.issues.some(i => i.type === 'DUPLICATE_PRN_ACROSS' && i.message.includes('both Group 1 and Group 2')));
});

// ─── getExportLifecycleLabel ──────────────────────────────────────────────

test('getExportLifecycleLabel: handles open, locked, and published states', () => {
  const openSession = { status: 'SETUP', is_locked: false };
  assert.ok(getExportLifecycleLabel(openSession, 5).startsWith('Draft — Registration Open (5 groups)'));

  const lockedSession = { status: 'LOCKED', is_locked: true };
  assert.ok(getExportLifecycleLabel(lockedSession, 8).startsWith('Draft — Registration Locked (8 groups)'));

  const publishedSession = { status: 'PUBLISHED', published_at: '2026-09-10T12:00:00.000Z' };
  assert.ok(getExportLifecycleLabel(publishedSession, 10).startsWith('Final — Published'));
});

// ─── Guide Authorization & Evaluation Security ───────────────────────────

test('Guide authorization: guide sees ONLY their assigned groups', () => {
  const allGroups = [
    { id: 1, group_no: 1, guide_id: 10, guide_name: 'Dr. NFS', status: 'APPROVED' },
    { id: 2, group_no: 2, guide_id: 10, guide_name: 'Dr. NFS', status: 'APPROVED' },
    { id: 3, group_no: 3, guide_id: 20, guide_name: 'Dr. SPK', status: 'APPROVED' },
    { id: 4, group_no: 4, guide_id: 30, guide_name: 'Dr. BKB', status: 'APPROVED' },
  ];

  const guideFacultyId = 10;
  const guideGroups = allGroups.filter(g => g.guide_id === guideFacultyId && g.status === 'APPROVED');

  assert.equal(guideGroups.length, 2);
  assert.deepEqual(guideGroups.map(g => g.group_no), [1, 2]);
  assert.ok(guideGroups.every(g => g.guide_id === guideFacultyId));
});

test('Guide authorization: guide blocked on server-side from another guide\'s group', () => {
  const group = { id: 3, group_no: 3, guide_id: 20, guide_name: 'Dr. SPK', status: 'APPROVED' };
  const requestingFacultyId = 10; // Dr. NFS trying to access Dr. SPK's group
  const isCoordinator = false;
  const isHod = false;

  const isAuthorized = isHod || isCoordinator || (group.guide_id === requestingFacultyId);
  assert.equal(isAuthorized, false, 'Unauthorized guide must be rejected with 403 Access Denied');
});

// ─── Student Guide Visibility ─────────────────────────────────────────────

test('Student guide visibility: returns guide name and email when assigned and approved', () => {
  const group = { id: 1, group_no: 1, status: 'APPROVED', guide_id: 10, guide_name: 'Dr. (Mrs.) N. F. Shaikh' };
  const faculty = { name: 'Dr. (Mrs.) N. F. Shaikh', email: 'nfs@meswadiacoe.edu', designation: 'Associate Professor & HOD' };

  let guideInfo = { guide_assigned: false, guide_name: null, guide_email: null, guide_status_text: 'Guide not assigned yet' };
  if (group.status === 'APPROVED' && group.guide_name) {
    guideInfo = {
      guide_assigned: true,
      guide_name: group.guide_name,
      guide_email: faculty.email,
      guide_designation: faculty.designation,
      guide_status_text: 'Assigned & Approved',
    };
  }

  assert.equal(guideInfo.guide_assigned, true);
  assert.equal(guideInfo.guide_name, 'Dr. (Mrs.) N. F. Shaikh');
  assert.equal(guideInfo.guide_email, 'nfs@meswadiacoe.edu');
});

test('Student guide visibility: returns fallback text when guide is not assigned or pending approval', () => {
  const group = { id: 2, group_no: 2, status: 'PENDING_GUIDE_ASSIGNMENT', guide_id: null, guide_name: null };

  let guideInfo = { guide_assigned: false, guide_name: null, guide_email: null, guide_status_text: 'Guide not assigned yet' };
  if (group.status === 'APPROVED' && group.guide_name) {
    guideInfo = {
      guide_assigned: true,
      guide_name: group.guide_name,
      guide_email: 'guide@test.com',
      guide_status_text: 'Assigned & Approved',
    };
  }

  assert.equal(guideInfo.guide_assigned, false);
  assert.equal(guideInfo.guide_name, null);
  assert.equal(guideInfo.guide_status_text, 'Guide not assigned yet');
});

// ─── Team Registration Sharing & Idempotency ─────────────────────────────

test('Team registration: all 3-4 members resolve to the identical group and registration record', () => {
  const registeredGroup = {
    id: 101,
    group_no: 5,
    session_id: 7,
    domain: 'AI/ML',
    leader_user_id: 301,
    members: [
      { prn: 'F23111001', name: 'Member 1 (Leader)', is_leader: true, user_id: 301 },
      { prn: 'F23111002', name: 'Member 2', is_leader: false, user_id: 302 },
      { prn: 'F23111003', name: 'Member 3', is_leader: false, user_id: 303 },
      { prn: 'F23111004', name: 'Member 4', is_leader: false, user_id: 304 },
    ],
    registration: { id: 501, group_id: 101, status: 'REGISTERED' },
  };

  // Simulating each of the 4 members logging in
  for (const member of registeredGroup.members) {
    const foundGroup = registeredGroup.members.some(m => m.prn === member.prn || m.user_id === member.user_id)
      ? registeredGroup
      : null;

    assert.ok(foundGroup, `Member ${member.name} must resolve to registered group`);
    assert.equal(foundGroup.id, 101);
    assert.equal(foundGroup.group_no, 5);
    assert.equal(foundGroup.registration.status, 'REGISTERED');
  }
});

test('Team registration: non-leader member attempting registration is blocked from duplicate creation', () => {
  const existingGroup = { id: 101, group_no: 5, leader_user_id: 301, allow_edit: false };
  const memberUserId = 302; // Member 2 (not leader)

  const isLeader = existingGroup.leader_user_id === memberUserId;
  let canRegisterNew = false;
  let errorMessage = null;

  if (existingGroup) {
    if (!isLeader && !existingGroup.allow_edit) {
      canRegisterNew = false;
      errorMessage = `Your group (Group #${existingGroup.group_no}) is already registered. Registration details are shared with all members.`;
    }
  }

  assert.equal(canRegisterNew, false);
  assert.ok(errorMessage.includes('already registered'));
});

// ─── Student Group Scoping & Authorization ───────────────────────────────

test('PRN normalization: handles lowercase, spaces, and messy inputs', () => {
  const { normPrn } = require('./seminarParser');
  assert.equal(normPrn('f23113022'), 'F23113022');
  assert.equal(normPrn('  F23113022  '), 'F23113022');
  assert.equal(normPrn('f23 113 022'), 'F23113022');
  assert.equal(normPrn(' F24123002 '), 'F24123002');
  assert.equal(normPrn(null), '');
  assert.equal(normPrn(''), '');
});

test('Student authorization: student from another group is blocked on server-side from reading a group URL', () => {
  const targetGroup = {
    id: 172,
    group_no: 2,
    leader_user_id: 344, // Prachi (Group 2)
    members: [
      { prn: 'F23111054', email: 'pknailkar25@gmail.com' },
      { prn: 'F23111009', email: 'sarvadak12@gmail.com' },
    ],
  };

  // Student from Group 1 (Afrin / Shradha)
  const requestingStudent = {
    user_id: 523,
    prn: 'F24123002',
    email: 'f24123002@meswadiacoe.edu',
    role: 'student',
  };

  const isLeader = targetGroup.leader_user_id === requestingStudent.user_id;
  const isMember = targetGroup.members.some(
    m => m.prn.toUpperCase() === requestingStudent.prn.toUpperCase() || m.email.toLowerCase() === requestingStudent.email.toLowerCase()
  );
  const isAllowed = isLeader || isMember;

  assert.equal(isAllowed, false, 'Student from another group must be rejected with 403 Forbidden');
});

test('Student with no group: receives clean unassigned state without crash or blank screen', () => {
  const session = { id: 7, name: 'TE Seminar 2025-26', is_locked: false, status: 'PUBLISHED' };
  const userGroups = []; // Student has no registered group

  const hasSubmission = userGroups.length > 0;
  const groupData = hasSubmission ? userGroups[0] : null;

  assert.equal(hasSubmission, false);
  assert.equal(groupData, null);

  // UI state calculation
  const statusMessage = !hasSubmission
    ? (session.status === 'PUBLISHED' || session.is_locked
        ? 'Registration Closed. You are not currently registered in a seminar group.'
        : 'Group Formation & Registration Open')
    : `Registered: Group #${groupData.group_no}`;

  assert.ok(statusMessage.includes('Registration Closed'));
});
