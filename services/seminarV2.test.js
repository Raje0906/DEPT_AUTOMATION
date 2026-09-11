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

test('validateSingleGroup: rejects group with fewer than 3 members', () => {
  const input = {
    domain: 'Cloud Computing & DevOps',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '9876543210', email: 'alice@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('at least 3 members')));
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

test('validateSingleGroup: rejects invalid phone and empty topic', () => {
  const input = {
    domain: 'Cyber Security & Cryptography',
    members: [
      { name: 'Alice', prn: '2025TE0001', division: 'A', mobile: '1234', email: 'alice@test.com', topic1: 'T1', topic2: '', topic3: 'T3' },
      { name: 'Bob', prn: '2025TE0002', division: 'A', mobile: '9876543211', email: 'bob@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
      { name: 'Charlie', prn: '2025TE0003', division: 'A', mobile: '9876543212', email: 'charlie@test.com', topic1: 'T1', topic2: 'T2', topic3: 'T3' },
    ],
  };
  const res = validateSingleGroup(input);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some(e => e.includes('Mobile number') && e.includes('invalid')));
  assert.ok(res.errors.some(e => e.includes('Proposed Topic 2 is required')));
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
