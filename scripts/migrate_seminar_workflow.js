require('dotenv').config();
const pool = require('../db/pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Widen member_index constraint to 6
    await client.query(`
      ALTER TABLE seminar_group_members DROP CONSTRAINT IF EXISTS seminar_group_members_member_index_check;
      ALTER TABLE seminar_group_members ADD CONSTRAINT seminar_group_members_member_index_check CHECK (member_index >= 1 AND member_index <= 6);
    `);

    // 2. Add expertise_tags and is_active to seminar_guides
    await client.query(`
      ALTER TABLE seminar_guides ADD COLUMN IF NOT EXISTS expertise_tags TEXT[] DEFAULT '{}';
      ALTER TABLE seminar_guides ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);

    // 3. Create mapping templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_mapping_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        template_key VARCHAR(255) UNIQUE,
        mapping JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sem_map_tmpl_key ON seminar_mapping_templates(template_key);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
