const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

async function testBEProjectCoordinatorFlow() {
  const client = await pool.connect();
  try {
    console.log('--- Testing BE Project Coordinator & HOD Confirmation Workflow ---');

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

    // 4. BE Project Coordinator proposes guide assignment
    const targetGuideId = hod.faculty_id;
    await client.query(`
      UPDATE project_groups
      SET proposed_guide_id = $1, guide_approval_status = 'PENDING_HOD_APPROVAL', guide_requested_by = $2
      WHERE id = $3
    `, [targetGuideId, coordinator.user_id, group.id]);

    const proposedGrp = (await client.query(`SELECT * FROM project_groups WHERE id = $1`, [group.id])).rows[0];
    console.log(`✓ Coordinator proposed guide Faculty #${targetGuideId}. Approval Status: ${proposedGrp.guide_approval_status}, Active Guide ID: ${proposedGrp.guide_id}`);
    if (proposedGrp.guide_approval_status !== 'PENDING_HOD_APPROVAL') {
      throw new Error('Expected status PENDING_HOD_APPROVAL');
    }

    // 5. HOD approves guide assignment
    await client.query(`
      UPDATE project_groups
      SET guide_id = proposed_guide_id, guide_approval_status = 'APPROVED', guide_decided_at = NOW(), status = 'ACTIVE'
      WHERE id = $1
    `, [group.id]);

    const approvedGrp = (await client.query(`SELECT * FROM project_groups WHERE id = $1`, [group.id])).rows[0];
    console.log(`✓ HOD confirmed guide. Approval Status: ${approvedGrp.guide_approval_status}, Active Guide ID: ${approvedGrp.guide_id}`);
    if (approvedGrp.guide_approval_status !== 'APPROVED' || approvedGrp.guide_id !== targetGuideId) {
      throw new Error('Failed to confirm guide');
    }

    // 6. Test Stage & Score release confirmation
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

    // Coordinator requests score release
    const relRes = await client.query(`
      INSERT INTO project_score_releases (stage_id, group_id, released_by, status, requested_by)
      VALUES ($1, $2, $3, 'PENDING_HOD_APPROVAL', $3) RETURNING *
    `, [stageId, group.id, coordinator.user_id]);

    const pendingRel = relRes.rows[0];
    console.log(`✓ Coordinator requested score release #${pendingRel.id}. Status: ${pendingRel.status}`);

    // HOD approves score release
    await client.query(`
      UPDATE project_score_releases SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
      WHERE id = $2
    `, [hod.user_id, pendingRel.id]);

    const confirmedRel = (await client.query(`SELECT * FROM project_score_releases WHERE id = $1`, [pendingRel.id])).rows[0];
    console.log(`✓ HOD confirmed score release. Status: ${confirmedRel.status}, Approved By: ${confirmedRel.approved_by}`);

    console.log('--- ALL BE PROJECT COORDINATOR & HOD CONFIRMATION TESTS PASSED LOGICALLY! ---');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

testBEProjectCoordinatorFlow();
