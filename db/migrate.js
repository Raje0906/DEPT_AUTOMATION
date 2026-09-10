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
        division          VARCHAR(30)  NOT NULL
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
        division        VARCHAR(30) NOT NULL,
        UNIQUE(faculty_id, subject_id, semester, academic_year, division)
      )
    `);

    // ─── CLASS TEACHERS ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_teachers (
        id            SERIAL PRIMARY KEY,
        faculty_id    INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        class_name    VARCHAR(30) NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        assigned_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(class_name, academic_year)
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
        division      VARCHAR(30) NOT NULL,
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

    // ─── PROJECT GROUPS ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_groups (
        id            SERIAL PRIMARY KEY,
        group_code    VARCHAR(50) UNIQUE NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        batch         VARCHAR(20) NOT NULL,
        title         TEXT NOT NULL,
        title_2       TEXT,
        title_3       TEXT,
        domain        VARCHAR(150) NOT NULL,
        abstract      TEXT,
        status        VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','PENDING_GUIDE_APPROVAL','ACTIVE','COMPLETED','WITHDRAWN')),
        guide_id      INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
        created_by    INTEGER NOT NULL REFERENCES users(id),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── PROJECT GROUP MEMBERS ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_group_members (
        id           SERIAL PRIMARY KEY,
        group_id     INTEGER NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
        student_id   INTEGER REFERENCES students(id) ON DELETE CASCADE,
        roll_no      VARCHAR(50) NOT NULL,
        student_name VARCHAR(150),
        email        VARCHAR(200),
        mobile_no    VARCHAR(30),
        division     VARCHAR(30),
        is_leader    BOOLEAN DEFAULT FALSE
      )
    `);

    // Alter queries for existing database tables upgrade
    await client.query(`ALTER TABLE project_groups ADD COLUMN IF NOT EXISTS title_2 TEXT`);
    await client.query(`ALTER TABLE project_groups ADD COLUMN IF NOT EXISTS title_3 TEXT`);
    await client.query(`ALTER TABLE project_group_members ALTER COLUMN student_id DROP NOT NULL`);
    await client.query(`ALTER TABLE project_group_members ADD COLUMN IF NOT EXISTS student_name VARCHAR(150)`);
    await client.query(`ALTER TABLE project_group_members ADD COLUMN IF NOT EXISTS email VARCHAR(200)`);
    await client.query(`ALTER TABLE project_group_members ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(30)`);
    await client.query(`ALTER TABLE project_group_members ADD COLUMN IF NOT EXISTS division VARCHAR(30)`);

    // ─── PROJECT GUIDE REQUESTS ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_guide_requests (
        id                 SERIAL PRIMARY KEY,
        group_id           INTEGER NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
        requested_guide_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        status             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        requested_at       TIMESTAMPTZ DEFAULT NOW(),
        decided_at         TIMESTAMPTZ,
        decided_by         INTEGER REFERENCES users(id),
        remarks            TEXT
      )
    `);

    // ─── PROJECT EVALUATION STAGES ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_evaluation_stages (
        id                  SERIAL PRIMARY KEY,
        name                VARCHAR(100) NOT NULL,
        academic_year       VARCHAR(20) NOT NULL,
        sequence_order      INTEGER NOT NULL,
        scheduled_date_from DATE,
        scheduled_date_to   DATE,
        max_marks_total     NUMERIC(5,2) NOT NULL DEFAULT 100,
        aggregation_rule   VARCHAR(20) NOT NULL DEFAULT 'AVERAGE'
                           CHECK (aggregation_rule IN ('AVERAGE','SUM','MAX')),
        is_active           BOOLEAN DEFAULT TRUE
      )
    `);

    // ─── PROJECT STAGE CRITERIA ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_stage_criteria (
        id            SERIAL PRIMARY KEY,
        stage_id      INTEGER NOT NULL REFERENCES project_evaluation_stages(id) ON DELETE CASCADE,
        name          VARCHAR(150) NOT NULL,
        max_marks     NUMERIC(5,2) NOT NULL,
        weight        NUMERIC(5,2) DEFAULT 1.0,
        display_order INTEGER NOT NULL DEFAULT 1
      )
    `);

    // ─── PROJECT PANEL ASSIGNMENTS ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_panel_assignments (
        id              SERIAL PRIMARY KEY,
        stage_id        INTEGER NOT NULL REFERENCES project_evaluation_stages(id) ON DELETE CASCADE,
        group_id        INTEGER NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
        panel_member_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        assigned_by     INTEGER REFERENCES users(id),
        assigned_at     TIMESTAMPTZ DEFAULT NOW(),
        status          VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'
                        CHECK (status IN ('ASSIGNED','COMPLETED','REASSIGNED'))
      )
    `);

    // ─── PROJECT EVALUATIONS ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_evaluations (
        id                  SERIAL PRIMARY KEY,
        panel_assignment_id INTEGER UNIQUE NOT NULL REFERENCES project_panel_assignments(id) ON DELETE CASCADE,
        status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT','SUBMITTED','LOCKED')),
        submitted_at        TIMESTAMPTZ,
        overall_remarks     TEXT,
        is_unlocked         BOOLEAN DEFAULT FALSE,
        unlocked_by         INTEGER REFERENCES users(id),
        unlocked_at         TIMESTAMPTZ,
        unlock_reason       TEXT
      )
    `);

    // ─── PROJECT EVALUATION SCORES ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_evaluation_scores (
        id            SERIAL PRIMARY KEY,
        evaluation_id INTEGER NOT NULL REFERENCES project_evaluations(id) ON DELETE CASCADE,
        criterion_id  INTEGER NOT NULL REFERENCES project_stage_criteria(id) ON DELETE CASCADE,
        marks_awarded NUMERIC(5,2) NOT NULL,
        remark        TEXT,
        UNIQUE(evaluation_id, criterion_id)
      )
    `);

    // ─── PROJECT SCORE RELEASES ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_score_releases (
        id          SERIAL PRIMARY KEY,
        stage_id    INTEGER NOT NULL REFERENCES project_evaluation_stages(id) ON DELETE CASCADE,
        group_id    INTEGER REFERENCES project_groups(id) ON DELETE CASCADE,
        released_by INTEGER NOT NULL REFERENCES users(id),
        released_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ─── INDEXES ──────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marks_status  ON marks(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_record  ON audit_log(table_name, record_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reval_student ON revaluation_requests(student_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_group_code ON project_groups(group_code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_group_guide ON project_groups(guide_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_panel_group ON project_panel_assignments(group_id, stage_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_panel_member ON project_panel_assignments(panel_member_id)`);

    // ─── SEMINAR TOOL — Faculty coordinator flag ───────────────────────────────
    await client.query(`ALTER TABLE faculty ADD COLUMN IF NOT EXISTS is_seminar_coordinator BOOLEAN DEFAULT FALSE`);

    // ─── SEMINAR SESSIONS ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_sessions (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(150) NOT NULL,
        academic_year VARCHAR(20)  NOT NULL,
        batch         VARCHAR(20)  NOT NULL,
        status        VARCHAR(20)  NOT NULL DEFAULT 'SETUP'
                      CHECK (status IN ('SETUP','UPLOAD','VALIDATION','ASSIGNMENT','PUBLISHED')),
        created_by    INTEGER NOT NULL REFERENCES users(id),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        published_at  TIMESTAMPTZ,
        published_by  INTEGER REFERENCES users(id)
      )
    `);

    // ─── SEMINAR UPLOADS ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_uploads (
        id                SERIAL PRIMARY KEY,
        session_id        INTEGER NOT NULL REFERENCES seminar_sessions(id) ON DELETE CASCADE,
        original_filename VARCHAR(255) NOT NULL,
        file_data         BYTEA NOT NULL,
        uploaded_by       INTEGER NOT NULL REFERENCES users(id),
        uploaded_at       TIMESTAMPTZ DEFAULT NOW(),
        parse_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                          CHECK (parse_status IN ('PENDING','PARSED','ERROR')),
        parse_result      JSONB,
        parse_error       TEXT
      )
    `);

    // ─── SEMINAR GROUPS ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_groups (
        id               SERIAL PRIMARY KEY,
        session_id       INTEGER NOT NULL REFERENCES seminar_sessions(id) ON DELETE CASCADE,
        group_no         INTEGER NOT NULL,
        domain           VARCHAR(300) NOT NULL,
        guide_id         INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
        source_row_index INTEGER,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(session_id, group_no)
      )
    `);

    // ─── SEMINAR GROUP MEMBERS ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_group_members (
        id           SERIAL PRIMARY KEY,
        group_id     INTEGER NOT NULL REFERENCES seminar_groups(id) ON DELETE CASCADE,
        member_index INTEGER NOT NULL CHECK (member_index BETWEEN 1 AND 4),
        student_name VARCHAR(200) NOT NULL,
        prn          VARCHAR(60)  NOT NULL,
        division     VARCHAR(20),
        mobile       VARCHAR(30),
        email        VARCHAR(200),
        topic1       TEXT,
        topic2       TEXT,
        topic3       TEXT,
        is_leader    BOOLEAN DEFAULT FALSE
      )
    `);

    // ─── SEMINAR GUIDES ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_guides (
        id            SERIAL PRIMARY KEY,
        session_id    INTEGER NOT NULL REFERENCES seminar_sessions(id) ON DELETE CASCADE,
        faculty_id    INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
        quota         INTEGER NOT NULL DEFAULT 4,
        display_order INTEGER NOT NULL DEFAULT 1,
        UNIQUE(session_id, faculty_id)
      )
    `);

    // ─── SEMINAR VALIDATION OVERRIDES ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS seminar_issue_overrides (
        id           SERIAL PRIMARY KEY,
        session_id   INTEGER NOT NULL REFERENCES seminar_sessions(id) ON DELETE CASCADE,
        issue_key    VARCHAR(200) NOT NULL,
        acknowledged_by INTEGER NOT NULL REFERENCES users(id),
        note         TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(session_id, issue_key)
      )
    `);

    // ─── SEMINAR INDEXES ──────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_session_status ON seminar_sessions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_group_session  ON seminar_groups(session_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_group_guide    ON seminar_groups(guide_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_member_group   ON seminar_group_members(group_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_member_prn     ON seminar_group_members(prn)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sem_guide_session  ON seminar_guides(session_id)`);

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
