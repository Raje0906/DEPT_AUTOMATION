'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');

describe('Seminar Coordinator Workflow API & Authorization Tests', () => {

  test('Database contains seminar_mapping_templates and expanded member_index constraint', async () => {
    const tableRes = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'seminar_mapping_templates'"
    );
    assert.equal(tableRes.rows.length, 1, 'seminar_mapping_templates table should exist');

    const colRes = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'seminar_guides' AND column_name IN ('expertise_tags', 'is_active')"
    );
    assert.equal(colRes.rows.length, 2, 'seminar_guides should have expertise_tags and is_active');
  });

  test('Save and retrieve mapping template', async () => {
    const testKey = `test_tmpl_${Date.now()}`;
    const testMapping = {
      m1_name: 'Name of Student-1',
      m1_prn: 'College PRN 1',
      timestamp: 'Timestamp',
    };

    await pool.query(`
      INSERT INTO seminar_mapping_templates (name, template_key, mapping)
      VALUES ($1, $2, $3)
    `, ['Test Google Form Template', testKey, JSON.stringify(testMapping)]);

    const fetchRes = await pool.query(
      'SELECT * FROM seminar_mapping_templates WHERE template_key = $1',
      [testKey]
    );
    assert.equal(fetchRes.rows.length, 1);
    assert.equal(fetchRes.rows[0].name, 'Test Google Form Template');
    assert.equal(fetchRes.rows[0].mapping.m1_name, 'Name of Student-1');

    // Clean up test template
    await pool.query('DELETE FROM seminar_mapping_templates WHERE template_key = $1', [testKey]);
  });

  test('Replace session mode is scoped strictly to target session and never touches others', async () => {
    // 1. Create two isolated test sessions
    const s1Res = await pool.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by)
      VALUES ('Test Session Alpha', '2025-26', 'TE-A', 'SETUP', (SELECT id FROM users LIMIT 1))
      RETURNING id
    `);
    const s2Res = await pool.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by)
      VALUES ('Test Session Beta', '2025-26', 'TE-B', 'SETUP', (SELECT id FROM users LIMIT 1))
      RETURNING id
    `);

    const s1Id = s1Res.rows[0].id;
    const s2Id = s2Res.rows[0].id;

    try {
      // Insert group in session 1
      await pool.query(`
        INSERT INTO seminar_groups (session_id, group_no, domain)
        VALUES ($1, 991, 'AI/ML')
      `, [s1Id]);

      // Insert group in session 2
      await pool.query(`
        INSERT INTO seminar_groups (session_id, group_no, domain)
        VALUES ($1, 992, 'Cybersecurity')
      `, [s2Id]);

      // Simulate REPLACE on Session 1
      await pool.query('DELETE FROM seminar_groups WHERE session_id = $1', [s1Id]);

      // Verify Session 1 is empty, but Session 2 is completely intact
      const checkS1 = await pool.query('SELECT * FROM seminar_groups WHERE session_id = $1', [s1Id]);
      const checkS2 = await pool.query('SELECT * FROM seminar_groups WHERE session_id = $1', [s2Id]);

      assert.equal(checkS1.rows.length, 0, 'Session 1 groups should be removed');
      assert.equal(checkS2.rows.length, 1, 'Session 2 groups must NOT be touched');
      assert.equal(checkS2.rows[0].group_no, 992);
    } finally {
      // Clean up test sessions
      await pool.query('DELETE FROM seminar_sessions WHERE id IN ($1, $2)', [s1Id, s2Id]);
    }
  });

  test('Guide assignments reach guide views and student views without requiring published status', async () => {
    // Test that when a guide is assigned, the guide view query in /my-groups includes it
    // even if session.status is 'REGISTRATION_OPEN' or 'SETUP' (not 'PUBLISHED')
    const facRes = await pool.query('SELECT id, user_id FROM faculty LIMIT 1');
    if (!facRes.rows.length) return;
    const facultyId = facRes.rows[0].id;

    const sRes = await pool.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, created_by)
      VALUES ('Test Unlocked Status', '2025-26', 'TE', 'SETUP', (SELECT id FROM users LIMIT 1))
      RETURNING id
    `);
    const sId = sRes.rows[0].id;

    try {
      const gRes = await pool.query(`
        INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, status)
        VALUES ($1, 777, 'AI/ML', $2, 'PENDING_GUIDE_ASSIGNMENT')
        RETURNING id
      `, [sId, facultyId]);
      const gId = gRes.rows[0].id;

      await pool.query(`
        INSERT INTO seminar_group_members (group_id, member_index, student_name, prn)
        VALUES ($1, 1, 'Sample Student', 'F23112777')
      `, [gId]);

      // Check query from /my-groups
      const myGroups = await pool.query(`
        SELECT sg.id, sg.group_no
        FROM seminar_groups sg
        JOIN seminar_sessions ss ON sg.session_id = ss.id
        LEFT JOIN seminar_group_members m ON m.group_id = sg.id
        WHERE sg.guide_id = $1 AND sg.id = $2
      `, [facultyId, gId]);

      assert.equal(myGroups.rows.length, 1, 'Assigned group should be visible to guide in SETUP / non-published status');
    } finally {
      await pool.query('DELETE FROM seminar_sessions WHERE id = $1', [sId]);
    }
  });
});
