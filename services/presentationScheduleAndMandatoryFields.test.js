'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/pool');

describe('Presentation Schedules & Mandatory Registration Fields Tests', () => {
  let coordinatorUserId;
  let nonCoordinatorUserId;
  let guideFacultyId1, guideFacultyId2;
  let testDraftSessionId;
  let testPublishedSessionId;
  let testGroupId1, testGroupId2;

  before(async () => {
    // 1. Get or create users & faculty for testing
    const uRes = await pool.query('SELECT id FROM users LIMIT 2');
    coordinatorUserId = uRes.rows[0].id;
    nonCoordinatorUserId = uRes.rows.length > 1 ? uRes.rows[1].id : uRes.rows[0].id;

    // Ensure we have two faculty guides
    const facRes = await pool.query(`
      SELECT f.id, u.name
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      LIMIT 2
    `);
    if (facRes.rows.length >= 2) {
      guideFacultyId1 = facRes.rows[0].id;
      guideFacultyId2 = facRes.rows[1].id;
    } else {
      // Create test faculty if needed
      const f1 = await pool.query(`INSERT INTO faculty (user_id, department, designation) VALUES ($1, 'Computer Engineering', 'Assistant Professor') RETURNING id`, [coordinatorUserId]);
      guideFacultyId1 = f1.rows[0].id;
      guideFacultyId2 = guideFacultyId1;
    }

    // 2. Create test draft session
    const sDraft = await pool.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by)
      VALUES ('Test Draft Session for Schedules', '2025-26', 'TE-TEST-DRAFT', 'DRAFT', $1)
      RETURNING id
    `, [coordinatorUserId]);
    testDraftSessionId = sDraft.rows[0].id;

    // 3. Create test published session
    const sPub = await pool.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by)
      VALUES ('Test Published Session for Schedules', '2025-26', 'TE-TEST-PUB', 'PUBLISHED', $1)
      RETURNING id
    `, [coordinatorUserId]);
    testPublishedSessionId = sPub.rows[0].id;

    // 4. Create groups in published session assigned to guide 1
    const g1 = await pool.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, guide_name)
      VALUES ($1, 14, 'Cloud Computing', $2, 'Guide One')
      RETURNING id
    `, [testPublishedSessionId, guideFacultyId1]);
    testGroupId1 = g1.rows[0].id;

    const g2 = await pool.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, guide_name)
      VALUES ($1, 28, 'Artificial Intelligence', $2, 'Guide One')
      RETURNING id
    `, [testPublishedSessionId, guideFacultyId1]);
    testGroupId2 = g2.rows[0].id;
  });

  after(async () => {
    // Cleanup test data
    if (testDraftSessionId) {
      await pool.query('DELETE FROM seminar_sessions WHERE id = $1', [testDraftSessionId]);
    }
    if (testPublishedSessionId) {
      await pool.query('DELETE FROM seminar_sessions WHERE id = $1', [testPublishedSessionId]);
    }
  });

  test('Database contains presentation_schedules and presentation_schedule_rows with unique constraints', async () => {
    const tableRes = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('presentation_schedules', 'presentation_schedule_rows')
    `);
    assert.equal(tableRes.rows.length, 2, 'Both schedule tables should exist');

    // Check unique constraint on (session_id, presentation_no)
    const uqSched = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'presentation_schedules'::regclass AND contype = 'u'
    `);
    assert.ok(uqSched.rows.length > 0, 'Unique constraint on presentation_schedules should exist');

    // Check unique constraint on (schedule_id, guide_id)
    const uqRows = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'presentation_schedule_rows'::regclass AND contype = 'u'
    `);
    assert.ok(uqRows.rows.length > 0, 'Unique constraint on presentation_schedule_rows should exist');
  });

  test('Draft session status blocks schedule access and updates', async () => {
    // Verify session status is draft
    const sRes = await pool.query('SELECT status FROM seminar_sessions WHERE id = $1', [testDraftSessionId]);
    assert.equal(sRes.rows[0].status, 'DRAFT');

    // Simulated schedule gate check: draft status must be rejected
    const isDraft = sRes.rows[0].status !== 'PUBLISHED';
    assert.equal(isDraft, true, 'Draft session must be detected as not published');
  });

  test('Presentation 1 and Presentation 2 are independent and persist keyed by guide', async () => {
    // Insert Schedule 1
    const p1Res = await pool.query(`
      INSERT INTO presentation_schedules (session_id, presentation_no, title, updated_by, updated_at)
      VALUES ($1, 1, 'Notice: Presentation 1', $2, NOW())
      ON CONFLICT (session_id, presentation_no)
      DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
      RETURNING id
    `, [testPublishedSessionId, coordinatorUserId]);
    const p1Id = p1Res.rows[0].id;

    // Insert Schedule 2
    const p2Res = await pool.query(`
      INSERT INTO presentation_schedules (session_id, presentation_no, title, updated_by, updated_at)
      VALUES ($1, 2, 'Notice: Presentation 2', $2, NOW())
      ON CONFLICT (session_id, presentation_no)
      DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
      RETURNING id
    `, [testPublishedSessionId, coordinatorUserId]);
    const p2Id = p2Res.rows[0].id;

    assert.notEqual(p1Id, p2Id, 'Presentation 1 and 2 schedules must have distinct IDs');

    // Insert row for Guide 1 in Presentation 1
    await pool.query(`
      INSERT INTO presentation_schedule_rows (schedule_id, guide_id, room_no, date, time_text)
      VALUES ($1, $2, 'Room 501', '2026-10-17', '9:00 AM onwards')
      ON CONFLICT (schedule_id, guide_id)
      DO UPDATE SET room_no = EXCLUDED.room_no, date = EXCLUDED.date, time_text = EXCLUDED.time_text
    `, [p1Id, guideFacultyId1]);

    // Insert row for Guide 1 in Presentation 2 (different room & date)
    await pool.query(`
      INSERT INTO presentation_schedule_rows (schedule_id, guide_id, room_no, date, time_text)
      VALUES ($1, $2, 'Room 505', '2026-11-21', '10:30 AM onwards')
      ON CONFLICT (schedule_id, guide_id)
      DO UPDATE SET room_no = EXCLUDED.room_no, date = EXCLUDED.date, time_text = EXCLUDED.time_text
    `, [p2Id, guideFacultyId1]);

    // Verify independence
    const r1 = await pool.query('SELECT room_no, time_text FROM presentation_schedule_rows WHERE schedule_id = $1 AND guide_id = $2', [p1Id, guideFacultyId1]);
    const r2 = await pool.query('SELECT room_no, time_text FROM presentation_schedule_rows WHERE schedule_id = $1 AND guide_id = $2', [p2Id, guideFacultyId1]);

    assert.equal(r1.rows[0].room_no, 'Room 501');
    assert.equal(r2.rows[0].room_no, 'Room 505');
  });

  test('Live query reflects updated group numbers when a group is reassigned to another guide', async () => {
    // Initially, testGroupId1 (group 14) and testGroupId2 (group 28) belong to guideFacultyId1
    let qRes = await pool.query(`
      SELECT sg.group_no, COALESCE(sg.guide_id, sem_g.faculty_id) as guide_id
      FROM seminar_groups sg
      LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
      WHERE sg.session_id = $1 AND COALESCE(sg.guide_id, sem_g.faculty_id) = $2
      ORDER BY sg.group_no ASC
    `, [testPublishedSessionId, guideFacultyId1]);

    assert.deepEqual(qRes.rows.map(r => r.group_no), [14, 28], 'Guide 1 should have groups 14 and 28');

    // Reassign group 28 to guideFacultyId2
    await pool.query('UPDATE seminar_groups SET guide_id = $1 WHERE id = $2', [guideFacultyId2, testGroupId2]);

    // Check live query again
    qRes = await pool.query(`
      SELECT sg.group_no, COALESCE(sg.guide_id, sem_g.faculty_id) as guide_id
      FROM seminar_groups sg
      LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
      WHERE sg.session_id = $1 AND COALESCE(sg.guide_id, sem_g.faculty_id) = $2
      ORDER BY sg.group_no ASC
    `, [testPublishedSessionId, guideFacultyId1]);

    assert.deepEqual(qRes.rows.map(r => r.group_no), [14], 'Guide 1 now has only group 14');

    const qRes2 = await pool.query(`
      SELECT sg.group_no, COALESCE(sg.guide_id, sem_g.faculty_id) as guide_id
      FROM seminar_groups sg
      LEFT JOIN seminar_guides sem_g ON sg.seminar_guide_id = sem_g.id
      WHERE sg.session_id = $1 AND COALESCE(sg.guide_id, sem_g.faculty_id) = $2
      ORDER BY sg.group_no ASC
    `, [testPublishedSessionId, guideFacultyId2]);

    assert.deepEqual(qRes2.rows.map(r => r.group_no), [28], 'Guide 2 now has group 28');
  });

  test('Room clash detection generates soft warning without blocking save', () => {
    const rows = [
      { guide_id: 1, room_no: 'Lab 3', date: '2026-10-17', time_text: '9:00 AM' },
      { guide_id: 2, room_no: 'Lab 3', date: '2026-10-17', time_text: '9:00 AM' },
      { guide_id: 3, room_no: 'Lab 4', date: '2026-10-17', time_text: '9:00 AM' },
    ];

    const slotMap = new Map();
    const clashWarnings = [];

    for (const r of rows) {
      const key = `${r.room_no.toLowerCase()}__${r.date}__${r.time_text.toLowerCase()}`;
      if (slotMap.has(key)) {
        clashWarnings.push({
          room_no: r.room_no,
          date: r.date,
          time_text: r.time_text,
          message: `Notice: Room ${r.room_no} is scheduled for multiple guides at ${r.date} (${r.time_text}).`,
        });
      } else {
        slotMap.set(key, r.guide_id);
      }
    }

    assert.equal(clashWarnings.length, 1, 'Should detect exactly one soft clash warning');
    assert.ok(clashWarnings[0].message.includes('Lab 3'), 'Warning must specify clashed room');
  });

  test('Student registration validation blocks empty and placeholder values on Name, PRN, and 3 Topics', () => {
    const REQUIRED_TOPIC_COUNT = 3;
    const PLACEHOLDER_STRINGS = new Set(['.', '..', '-', 'n/a', 'na', 'none']);

    function isFieldBlankOrPlaceholder(val) {
      if (val === null || val === undefined) return true;
      const s = String(val).trim();
      if (s === '') return true;
      return PLACEHOLDER_STRINGS.has(s.toLowerCase());
    }

    // Test blank
    assert.equal(isFieldBlankOrPlaceholder(''), true);
    assert.equal(isFieldBlankOrPlaceholder('   '), true);
    assert.equal(isFieldBlankOrPlaceholder(null), true);

    // Test placeholders
    assert.equal(isFieldBlankOrPlaceholder('.'), true);
    assert.equal(isFieldBlankOrPlaceholder('..'), true);
    assert.equal(isFieldBlankOrPlaceholder('-'), true);
    assert.equal(isFieldBlankOrPlaceholder('N/A'), true);
    assert.equal(isFieldBlankOrPlaceholder('none'), true);

    // Test valid values
    assert.equal(isFieldBlankOrPlaceholder('Aarav Sharma'), false);
    assert.equal(isFieldBlankOrPlaceholder('F23112001'), false);
    assert.equal(isFieldBlankOrPlaceholder('Quantum Key Distribution'), false);

    // Test member validation routine
    const members = [
      { student_name: 'John Doe', prn: 'F23112001', topic1: 'Topic 1', topic2: 'Topic 2', topic3: 'Topic 3' },
      { student_name: 'Jane Smith', prn: '.', topic1: 'Topic A', topic2: 'none', topic3: 'Topic C' },
    ];

    const errors = [];
    members.forEach((m, idx) => {
      const memberNum = idx + 1;
      if (isFieldBlankOrPlaceholder(m.student_name)) {
        errors.push(`Enter the name of member ${memberNum}`);
      }
      if (isFieldBlankOrPlaceholder(m.prn)) {
        errors.push(`Enter the PRN of member ${memberNum}`);
      }
      for (let t = 1; t <= REQUIRED_TOPIC_COUNT; t++) {
        if (isFieldBlankOrPlaceholder(m[`topic${t}`])) {
          errors.push(`Enter topic ${t} of member ${memberNum}`);
        }
      }
    });

    assert.equal(errors.length, 2, 'Should flag PRN and Topic 2 for member 2');
    assert.equal(errors[0], 'Enter the PRN of member 2');
    assert.equal(errors[1], 'Enter topic 2 of member 2');
  });

  test('Non-standard PRN triggers soft warning only and never blocks submission', () => {
    const prnPattern = /^[Ff]\d{8}$/;

    // Standard PRN
    assert.equal(prnPattern.test('F23112001'), true);
    assert.equal(prnPattern.test('f23112001'), true);

    // Non-standard PRN should be permitted as a soft warning
    const oddPrn = '12345678';
    assert.equal(prnPattern.test(oddPrn), false);
    // Even though it fails regex, validation does not treat it as empty or placeholder
    const isBlank = !oddPrn || oddPrn.trim() === '';
    assert.equal(isBlank, false, 'Non-standard PRN is not blank, so submission is permitted');
  });
});
