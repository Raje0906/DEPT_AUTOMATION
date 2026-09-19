require('dotenv').config();
const pool = require('./pool');

async function ensurePanelData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Panel Data] Checking stages and groups...');

    // 1. Ensure stage 1 exists
    let stageRes = await client.query(`SELECT id FROM project_evaluation_stages WHERE sequence_order = 1 LIMIT 1`);
    let stage1Id;
    if (stageRes.rows.length === 0) {
      const insStage = await client.query(`
        INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, max_marks_total, aggregation_rule, is_active)
        VALUES ('Internal Presentation - 1', '2025-26', 1, 50, 'AVERAGE', true)
        RETURNING id
      `);
      stage1Id = insStage.rows[0].id;
    } else {
      stage1Id = stageRes.rows[0].id;
    }

    // Ensure criteria for stage 1
    const criteriaRes = await client.query(`SELECT COUNT(*) FROM project_stage_criteria WHERE stage_id = $1`, [stage1Id]);
    if (parseInt(criteriaRes.rows[0].count, 10) === 0) {
      const criteria = ['Attendance', 'Presentation', 'Subject Understanding', 'Publication', 'Viva'];
      for (let i = 0; i < criteria.length; i++) {
        await client.query(
          `INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, $2, 10, $3)`,
          [stage1Id, criteria[i], i + 1]
        );
      }
    }

    // 2. Fetch faculty IDs
    const facRes = await client.query(`SELECT id, user_id FROM faculty ORDER BY id ASC`);
    const facultyMap = {};
    for (const f of facRes.rows) {
      facultyMap[f.id] = f;
    }
    const rajanFacId = 2;
    const sunitaFacId = 3;
    const arjunFacId = 4;

    // 3. Ensure Group 2 exists
    let g2Res = await client.query(`SELECT id FROM project_groups WHERE group_code = 'GRP-2025-02'`);
    let g2Id;
    if (g2Res.rows.length === 0) {
      const studentUser = await client.query(`SELECT user_id FROM students ORDER BY id ASC LIMIT 5`);
      const creatorUserId = studentUser.rows[3]?.user_id || 1;

      const insG2 = await client.query(`
        INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
        VALUES (
          'GRP-2025-02',
          '2025-26',
          'BE-1',
          'Zero-Knowledge Proof Identity Verification on Decentralized Ledgers',
          'Blockchain & Cryptography',
          'Privacy-preserving SSI architecture using zk-SNARKs and Ethereum smart contracts.',
          'ACTIVE',
          $1,
          $2
        ) RETURNING id
      `, [sunitaFacId, creatorUserId]);
      g2Id = insG2.rows[0].id;

      // Add group members
      const students = await client.query(`SELECT id, roll_no, user_id FROM students ORDER BY id ASC LIMIT 10`);
      if (students.rows.length >= 6) {
        await client.query(
          `INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING`,
          [g2Id, students.rows[3].id, students.rows[3].roll_no]
        );
        await client.query(
          `INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, $3, false) ON CONFLICT DO NOTHING`,
          [g2Id, students.rows[4].id, students.rows[4].roll_no]
        );
        await client.query(
          `INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, $3, false) ON CONFLICT DO NOTHING`,
          [g2Id, students.rows[5].id, students.rows[5].roll_no]
        );
      }
    } else {
      g2Id = g2Res.rows[0].id;
    }

    // 4. Ensure panel assignments for Group 2 (Prof. Rajan Mehta as Panelist)
    const paRajan = await client.query(
      `SELECT id FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3`,
      [stage1Id, g2Id, rajanFacId]
    );
    if (paRajan.rows.length === 0) {
      await client.query(
        `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
         VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
        [stage1Id, g2Id, rajanFacId, 1]
      );
      console.log('[Panel Data] Assigned Prof. Rajan Mehta to Group 2 for Stage 1');
    }

    // Also assign Prof. Arjun Sharma to Group 2
    const paArjun = await client.query(
      `SELECT id FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3`,
      [stage1Id, g2Id, arjunFacId]
    );
    if (paArjun.rows.length === 0) {
      await client.query(
        `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
         VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
        [stage1Id, g2Id, arjunFacId, 1]
      );
      console.log('[Panel Data] Assigned Prof. Arjun Sharma to Group 2 for Stage 1');
    }

    // Also assign Prof. Sunita Patil to Group 1 (since Rajan is guide for Group 1)
    const g1Res = await client.query(`SELECT id FROM project_groups WHERE group_code = 'GRP-2025-01'`);
    if (g1Res.rows.length > 0) {
      const g1Id = g1Res.rows[0].id;
      const paSunita = await client.query(
        `SELECT id FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2 AND panel_member_id = $3`,
        [stage1Id, g1Id, sunitaFacId]
      );
      if (paSunita.rows.length === 0) {
        await client.query(
          `INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
           VALUES ($1, $2, $3, $4, 'ASSIGNED')`,
          [stage1Id, g1Id, sunitaFacId, 1]
        );
        console.log('[Panel Data] Assigned Prof. Sunita Patil to Group 1 for Stage 1');
      }
    }

    await client.query('COMMIT');
    console.log('[Panel Data] Panel data successfully ensured!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Panel Data] Error:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

ensurePanelData().catch(console.error);
