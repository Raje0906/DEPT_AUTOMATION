const pool = require('../db/pool');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ─── USERS ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(150) NOT NULL,
        role        VARCHAR(20)  NOT NULL CHECK (role IN ('student','faculty','hod')),
        email       VARCHAR(200) UNIQUE NOT NULL,
        password_hash TEXT       NOT NULL,
        department  VARCHAR(100) NOT NULL,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── STUDENTS ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        roll_no           VARCHAR(20)  UNIQUE NOT NULL,
        enrollment_no     VARCHAR(30)  UNIQUE NOT NULL,
        batch             VARCHAR(20)  NOT NULL,
        current_semester  INTEGER      NOT NULL CHECK (current_semester BETWEEN 1 AND 8),
        division          VARCHAR(5)   NOT NULL
      )
    `);

    // ─── FACULTY ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculty (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department    VARCHAR(100) NOT NULL,
        designation   VARCHAR(100) NOT NULL,
        employee_id   VARCHAR(30)  UNIQUE NOT NULL
      )
    `);

    // ─── SUBJECTS ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id              SERIAL PRIMARY KEY,
        name            VARCHAR(200) NOT NULL,
        code            VARCHAR(20)  UNIQUE NOT NULL,
        semester        INTEGER      NOT NULL CHECK (semester BETWEEN 1 AND 8),
        credits         INTEGER      NOT NULL,
        department      VARCHAR(100) NOT NULL,
        max_cie         INTEGER      NOT NULL DEFAULT 30,
        max_practical   INTEGER      NOT NULL DEFAULT 25,
        max_end_sem     INTEGER      NOT NULL DEFAULT 70,
        has_practical   BOOLEAN      DEFAULT TRUE,
        subject_type    VARCHAR(20)  NOT NULL DEFAULT 'theory' CHECK (subject_type IN ('theory','practical','theory_practical'))
      )
    `);

    // ─── FACULTY SUBJECT MAP ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculty_subject_map (
        id              SERIAL PRIMARY KEY,
        faculty_id      INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        semester        INTEGER NOT NULL,
        academic_year   VARCHAR(20) NOT NULL,
        division        VARCHAR(5)  NOT NULL,
        UNIQUE(faculty_id, subject_id, semester, academic_year, division)
      )
    `);

    // ─── MARKS ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id                SERIAL PRIMARY KEY,
        student_id        INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id        INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        semester          INTEGER NOT NULL,
        academic_year     VARCHAR(20) NOT NULL,
        cie_marks         NUMERIC(5,2),
        practical_marks   NUMERIC(5,2),
        end_sem_marks     NUMERIC(5,2),
        total             NUMERIC(6,2),
        grade             VARCHAR(5),
        grade_points      NUMERIC(4,2),
        is_backlog        BOOLEAN DEFAULT FALSE,
        attempt_number    INTEGER DEFAULT 1,
        entered_by        INTEGER REFERENCES faculty(id),
        status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','approved','published')),
        last_modified_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(student_id, subject_id, semester, academic_year, attempt_number)
      )
    `);

    // ─── AUDIT LOG ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id          SERIAL PRIMARY KEY,
        table_name  VARCHAR(100) NOT NULL,
        record_id   INTEGER      NOT NULL,
        changed_by  INTEGER      NOT NULL REFERENCES users(id),
        old_value   JSONB,
        new_value   JSONB,
        action      VARCHAR(20)  NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
        reason      TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── REVALUATION REQUESTS ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS revaluation_requests (
        id              SERIAL PRIMARY KEY,
        student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        semester        INTEGER NOT NULL,
        academic_year   VARCHAR(20) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','under_review','marks_updated','resolved','rejected')),
        student_remark  TEXT,
        faculty_remark  TEXT,
        hod_remark      TEXT,
        requested_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── RESULT PUBLISH STATUS ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS result_publish_status (
        id            SERIAL PRIMARY KEY,
        semester      INTEGER NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        department    VARCHAR(100) NOT NULL,
        division      VARCHAR(5)  NOT NULL,
        status        VARCHAR(20) NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','locked','published')),
        published_by  INTEGER REFERENCES users(id),
        published_at  TIMESTAMPTZ,
        UNIQUE(semester, academic_year, department, division)
      )
    `);

    // ─── PASSWORD RESET TOKENS ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  TEXT    NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        used        BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── INDEXES ──────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_status  ON marks(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_record  ON audit_log(table_name, record_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reval_student ON revaluation_requests(student_id)`);

    await client.query('COMMIT');
    console.log('[Migration] All tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
