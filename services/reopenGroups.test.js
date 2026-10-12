'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const pool = require('../db/pool');

test('Task 2: Groups #6 and #31 are completely removed from Session "AY 2025-26 Sem 1"', async () => {
  const client = await pool.connect();
  try {
    const sessRes = await client.query(
      `SELECT id, name FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );
    assert.ok(sessRes.rows.length, 'Active seminar session must exist');
    const sessionId = sessRes.rows[0].id;

    // Check total groups in session: exactly 52 remain
    const grpRes = await client.query(
      `SELECT id, group_no, status, allow_edit, guide_name FROM seminar_groups WHERE session_id = $1 ORDER BY group_no ASC`,
      [sessionId]
    );
    assert.equal(grpRes.rows.length, 52, 'Must have exactly 52 groups in session (6 and 31 removed)');

    const groupNos = new Set(grpRes.rows.map(g => g.group_no));
    assert.equal(groupNos.has(6), false, 'Group 6 must NOT exist in seminar_groups');
    assert.equal(groupNos.has(31), false, 'Group 31 must NOT exist in seminar_groups');

    // Check registrations
    const regRes = await client.query(
      `SELECT r.group_id, sg.group_no
       FROM registrations r
       JOIN seminar_groups sg ON r.group_id = sg.id
       WHERE r.seminar_id = $1 AND r.status = 'REGISTERED'`,
      [sessionId]
    );
    assert.equal(regRes.rows.length, 52, 'Exactly 52 registrations must exist');

    // Check members table: neither group has any members
    const memRes = await client.query(
      `SELECT sgm.id FROM seminar_group_members sgm
       JOIN seminar_groups sg ON sgm.group_id = sg.id
       WHERE sg.session_id = $1 AND sg.group_no IN (6, 31)`,
      [sessionId]
    );
    assert.equal(memRes.rows.length, 0, 'No members should exist for groups 6 and 31');

    // Students from removed groups have no group allocation
    const formerStudents = ['F23112002', 'F23112077', 'F23112050', 'F23112035'];
    for (const prn of formerStudents) {
      const checkRes = await client.query(
        `SELECT sgm.id, sg.group_no FROM seminar_group_members sgm
         JOIN seminar_groups sg ON sgm.group_id = sg.id
         WHERE sg.session_id = $1 AND UPPER(REPLACE(sgm.prn, ' ', '')) = $2`,
        [sessionId, prn]
      );
      assert.equal(checkRes.rows.length, 0, `Student ${prn} must have no assigned group or guide`);
    }

    // All 52 remaining groups
    for (const g of grpRes.rows) {
      assert.equal(g.allow_edit, false, `Group ${g.group_no} must have allow_edit = false`);
      assert.ok(['APPROVED', 'AWAITING_HOD_APPROVAL', 'PENDING_GUIDE_ASSIGNMENT', 'REGISTERED'].includes(g.status), `Group ${g.group_no} status valid: ${g.status}`);
    }
  } finally {
    client.release();
  }
});

test('Task 2: Manual registration simulation: when group is manually registered, all members resolve to it', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessRes = await client.query(
      `SELECT id, name FROM seminar_sessions WHERE name = 'AY 2025-26 Sem 1' OR academic_year = '2025-26' ORDER BY id DESC LIMIT 1`
    );
    const sessionId = sessRes.rows[0].id;

    // Simulate manual group registration for Group #31
    const gInsert = await client.query(
      `INSERT INTO seminar_groups (session_id, group_no, domain, domain_raw, status, allow_edit, submitted_at)
       VALUES ($1, 31, 'Cybersecurity', 'CyberSecurity', 'APPROVED', false, NOW())
       RETURNING id`,
      [sessionId]
    );
    const newGroupId = gInsert.rows[0].id;

    const testMembers = [
      { name: 'Aditya Raje', prn: 'F23112050', div: 'TE2', email: 'aditya@wadia.edu', mobile: '9699616876' },
      { name: 'nihar pal', prn: 'F23112035', div: 'TE2', email: 'nihar@wadia.edu', mobile: '9404241539' },
      { name: 'Anshu Hole', prn: 'F23112061', div: 'TE2', email: 'anshu@wadia.edu', mobile: '8446016602' },
      { name: 'Harshawardhan Gharal', prn: 'F23112049', div: 'TE2', email: 'harsh@wadia.edu', mobile: '9922493547' },
    ];

    for (let i = 0; i < testMembers.length; i++) {
      const m = testMembers[i];
      await client.query(
        `INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, email, mobile, topic1, topic2, topic3, is_leader)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Topic 1', 'Topic 2', 'Topic 3', $8)`,
        [newGroupId, i + 1, m.name, m.prn, m.div, m.email, m.mobile, i === 0]
      );
    }

    // Insert registration
    await client.query(
      `INSERT INTO registrations (group_id, seminar_id, registered_by, registered_at, status)
       VALUES ($1, $2, 1, NOW(), 'REGISTERED')`,
      [newGroupId, sessionId]
    );

    // Verify all members resolve to registered Group 31
    for (const m of testMembers) {
      const checkRes = await client.query(
        `SELECT sg.id, sg.group_no, sg.status, r.status as reg_status
         FROM seminar_group_members sgm
         JOIN seminar_groups sg ON sgm.group_id = sg.id
         JOIN registrations r ON (r.group_id = sg.id AND r.seminar_id = sg.session_id)
         WHERE sg.session_id = $1 AND UPPER(REPLACE(sgm.prn, ' ', '')) = $2`,
        [sessionId, m.prn]
      );
      assert.equal(checkRes.rows.length, 1, `Member ${m.name} must resolve to registered group`);
      assert.equal(checkRes.rows[0].group_no, 31);
      assert.equal(checkRes.rows[0].reg_status, 'REGISTERED');
    }

    // Rollback so DB remains cleanly in removed state
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});
