require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testStageSave() {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    const token = jwt.sign({ id: 1, role: 'hod', email: 'hod@engg.edu' }, JWT_SECRET, { expiresIn: '1h' });

    console.log('[Test] Creating new stage...');
    const createRes = await fetch('http://localhost:5000/api/seminar/hod/stages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Stage 1: Topic Synopsis & Literature Review',
        academic_year: '2025-26',
        sequence_order: 1,
        scheduled_date_from: '2025-08-01',
        scheduled_date_to: '2025-08-15',
        max_marks_total: 50,
        aggregation_rule: 'AVERAGE',
        criteria: [
          { name: 'Literature Survey & Depth', max_marks: 20 },
          { name: 'Problem Formulation', max_marks: 15 },
          { name: 'Presentation & Q&A', max_marks: 15 }
        ]
      })
    });
    const createData = await createRes.json();
    console.log('[Test] Create stage response:', createData);
    const stageId = createData.stage_id;

    console.log('[Test] Updating created stage (ID:', stageId, ')...');
    const updateRes = await fetch('http://localhost:5000/api/seminar/hod/stages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        id: stageId,
        name: 'Stage 1: Topic Synopsis & Literature Review (Updated)',
        academic_year: '2025-26',
        sequence_order: 1,
        scheduled_date_from: '2025-08-01',
        scheduled_date_to: '2025-08-20',
        max_marks_total: 50,
        aggregation_rule: 'AVERAGE',
        criteria: [
          { name: 'Literature Survey & Depth', max_marks: 25 },
          { name: 'Problem Formulation', max_marks: 15 },
          { name: 'Presentation & Q&A', max_marks: 10 }
        ]
      })
    });
    const updateData = await updateRes.json();
    console.log('[Test] Update stage response:', updateData);

    console.log('[Test] Fetching stages list...');
    const listRes = await fetch('http://localhost:5000/api/seminar/hod/stages?academic_year=2025-26', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    console.log('[Test] Stages fetched count:', listData.length);
    console.log(JSON.stringify(listData, null, 2));

  } catch (err) {
    console.error('[Test Failed]:', err);
  }
}

testStageSave();
