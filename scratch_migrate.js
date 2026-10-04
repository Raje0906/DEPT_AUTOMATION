const { Pool } = require('pg');
require('dotenv').config({ path: 'services/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    console.log('[DB] Connecting...');
    // Ensure all columns exist on seminar governance tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seminar_evaluation_stages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        academic_year VARCHAR(20) NOT NULL DEFAULT '2025-26',
        sequence_order INT NOT NULL DEFAULT 1,
        scheduled_date_from DATE,
        scheduled_date_to DATE,
        max_marks_total NUMERIC(6,2) NOT NULL DEFAULT 50,
        aggregation_rule VARCHAR(50) NOT NULL DEFAULT 'AVERAGE',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2025-26';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS sequence_order INT DEFAULT 1;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS scheduled_date_from DATE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS scheduled_date_to DATE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS max_marks_total NUMERIC(6,2) DEFAULT 50;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS aggregation_rule VARCHAR(50) DEFAULT 'AVERAGE';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_evaluation_stages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_stage_criteria (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        max_marks NUMERIC(6,2) NOT NULL DEFAULT 10,
        weight NUMERIC(6,2) DEFAULT 1,
        display_order INT DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS max_marks NUMERIC(6,2) DEFAULT 10;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS weight NUMERIC(6,2) DEFAULT 1;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 1;
      ALTER TABLE seminar_stage_criteria ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_assignments (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        group_id INT NOT NULL REFERENCES seminar_groups(id) ON DELETE CASCADE,
        panel_member_id INT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        assigned_by INT REFERENCES users(id),
        status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS group_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS panel_member_id INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS assigned_by INT;
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ASSIGNED';
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_panel_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_evaluations (
        id SERIAL PRIMARY KEY,
        assignment_id INT REFERENCES seminar_panel_assignments(id) ON DELETE CASCADE,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        group_id INT NOT NULL REFERENCES seminar_groups(id) ON DELETE CASCADE,
        evaluator_faculty_id INT NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        student_prn VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT,
        total_score NUMERIC(6,2) DEFAULT 0,
        evaluated_at TIMESTAMPTZ,
        unlocked_at TIMESTAMPTZ,
        unlocked_by INT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS assignment_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS stage_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS group_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS evaluator_faculty_id INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS student_prn VARCHAR(50);
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DRAFT';
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS remarks TEXT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS total_score NUMERIC(6,2) DEFAULT 0;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS unlocked_by INT;
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE seminar_panel_evaluations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_panel_evaluation_scores (
        id SERIAL PRIMARY KEY,
        evaluation_id INT NOT NULL REFERENCES seminar_panel_evaluations(id) ON DELETE CASCADE,
        criteria_id INT NOT NULL REFERENCES seminar_stage_criteria(id) ON DELETE CASCADE,
        score NUMERIC(6,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS evaluation_id INT;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS criteria_id INT;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS score NUMERIC(6,2) DEFAULT 0;
      ALTER TABLE seminar_panel_evaluation_scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS seminar_score_releases (
        id SERIAL PRIMARY KEY,
        stage_id INT NOT NULL REFERENCES seminar_evaluation_stages(id) ON DELETE CASCADE,
        released_by INT NOT NULL REFERENCES users(id),
        released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );
    `);

    console.log('[DB] Migration complete! Let us inspect the columns:');
    const tables = ['seminar_evaluation_stages', 'seminar_stage_criteria', 'seminar_panel_assignments', 'seminar_panel_evaluations', 'seminar_panel_evaluation_scores', 'seminar_score_releases'];
    for (const t of tables) {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [t]);
      console.log(t, '->', cols.rows.map(r => r.column_name).join(', '));
    }
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
