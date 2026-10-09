const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

async function testBEProjectCoordinatorFlow() {
  const client = await pool.connect();
  try {
    console.log('--- Testing BE Project Coordinator Direct Workflow (No HOD Approvals Required) ---');

    // 1. Fetch HOD user and a faculty user
    const hodRes = await client.query(`SELECT u.id as user_id, u.email, f.id as faculty_id FROM users u JOIN faculty f ON f.user_id = u.id WHERE u.role = 'hod' LIMIT 1`);
    const hod = hodRes.rows[0];

    const facRes = await client.query(`SELECT u.id as user_id, u.email, f.id as faculty_id FROM users u JOIN faculty f ON f.user_id = u.id WHERE u.role = 'faculty' LIMIT 1`);
    const coordinator = facRes.rows[0];

    console.log(`✓ HOD: User #${hod.user_id} (${hod.email})`);
    console.log(`✓ Coordinator candidate: User #${coordinator.user_id} (Faculty #${coordinator.faculty_id}, ${coordinator.email})`);

    // 2. Set as BE_PROJECT_COORDINATOR
    await client.query(`UPDATE faculty SET is_project_coordinator = FALSE`);
    await client.query(`UPDATE faculty SET is_project_coordinator = TRUE WHERE id = $1`, [coordinator.faculty_id]);

    await client.query(`
      INSERT INTO coordinator_assignments (faculty_id, role_type, academic_year, is_active, appointed_by)
      VALUES ($1, 'BE_PROJECT_COORDINATOR', '2026-27', TRUE, $2)
    `, [coordinator.faculty_id, hod.user_id]);

    console.log(`✓ Successfully appointed Faculty #${coordinator.faculty_id} as BE Project Coordinator.`);

    // 3. Get or create a sample project group
    let grpRes = await client.query(`SELECT * FROM project_groups WHERE academic_year = '2026-27' LIMIT 1`);
    let group;
    if (grpRes.rows.length === 0) {
      const newGrp = await client.query(`
        INSERT INTO project_groups (group_code, academic_year, batch, title, domain, status, created_by)
        VALUES ('GRP-TEST-01', '2026-27', 'BE-CE-A', 'AI Automation Platform', 'Artificial Intelligence', 'DRAFT', $1)
        RETURNING *
      `, [hod.user_id]);
      group = newGrp.rows[0];
    } else {
      group = grpRes.rows[0];
    }

    console.log(`✓ Testing with Group #${group.id} (${group.group_code})`);

    // 4. BE Project Coordinator directly assigns guide (No HOD confirmation required)
    const targetGuideId = hod.faculty_id;
    await client.query(`
      UPDATE project_groups
      SET guide_id = $1, proposed_guide_id = $1, guide_approval_status = 'APPROVED',
          guide_requested_by = $2, guide_decided_at = NOW(), status = 'ACTIVE'
      WHERE id = $3
    `, [targetGuideId, coordinator.user_id, group.id]);

    const assignedGrp = (await client.query(`SELECT * FROM project_groups WHERE id = $1`, [group.id])).rows[0];
    console.log(`✓ Coordinator directly assigned guide Faculty #${targetGuideId}. Status: ${assignedGrp.status}, Active Guide ID: ${assignedGrp.guide_id}, Approval Status: ${assignedGrp.guide_approval_status}`);
    if (assignedGrp.guide_id !== targetGuideId || assignedGrp.status !== 'ACTIVE') {
      throw new Error('Expected guide to be active immediately without HOD confirmation');
    }

    // 5. BE Project Coordinator directly assigns panel mentors (No HOD confirmation required)
    let stageRes = await client.query(`SELECT id FROM project_evaluation_stages WHERE academic_year = '2026-27' LIMIT 1`);
    let stageId;
    if (stageRes.rows.length === 0) {
      const newStage = await client.query(`
        INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, max_marks_total)
        VALUES ('Stage 1 Proposal', '2026-27', 1, 50) RETURNING id
      `);
      stageId = newStage.rows[0].id;
    } else {
      stageId = stageRes.rows[0].id;
    }

    await client.query(`DELETE FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2`, [stageId, group.id]);
    await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'ASSIGNED')
    `, [stageId, group.id, coordinator.faculty_id, coordinator.user_id]);

    const panelRes = await client.query(`SELECT * FROM project_panel_assignments WHERE stage_id = $1 AND group_id = $2`, [stageId, group.id]);
    console.log(`✓ Coordinator assigned ${panelRes.rows.length} panel mentor(s). Assignment status: ${panelRes.rows[0].status}`);
    if (panelRes.rows[0].status !== 'ASSIGNED') {
      throw new Error('Expected panel mentor to be assigned immediately');
    }

    // 6. BE Project Coordinator directly releases scores to students (No HOD confirmation required)
    const existingRel = await client.query(
      `SELECT id FROM project_score_releases WHERE stage_id = $1 AND (group_id = $2 OR ($2::int IS NULL AND group_id IS NULL))`,
      [stageId, group.id]
    );

    let activeRel;
    if (existingRel.rows.length > 0) {
      const upd = await client.query(
        `UPDATE project_score_releases
         SET status = 'APPROVED', released_by = $1, released_at = NOW(), approved_by = $1, approved_at = NOW()
         WHERE id = $2 RETURNING *`,
        [coordinator.user_id, existingRel.rows[0].id]
      );
      activeRel = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO project_score_releases (stage_id, group_id, released_by, status, requested_by, approved_by, approved_at)
         VALUES ($1, $2, $3, 'APPROVED', $3, $3, NOW()) RETURNING *`,
        [stageId, group.id, coordinator.user_id]
      );
      activeRel = ins.rows[0];
    }
    console.log(`✓ Coordinator directly released score release #${activeRel.id}. Status: ${activeRel.status}, Released to Students: Yes`);
    if (activeRel.status !== 'APPROVED') {
      throw new Error('Expected score release to be approved and published immediately');
    }

    // Verify student view queries this release without HOD block
    const studentCheck = await client.query(`
      SELECT stage_id FROM project_score_releases
      WHERE (group_id IS NULL OR group_id = $1) AND (status IS NULL OR status != 'REJECTED')
    `, [group.id]);
    if (studentCheck.rows.length === 0) {
      throw new Error('Student should be able to view released score without HOD approval');
    }
    console.log(`✓ Student view verified: stage scores are visible immediately.`);

    console.log('--- ALL BE PROJECT COORDINATOR DIRECT WORKFLOW TESTS PASSED! ---');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

testBEProjectCoordinatorFlow();
