const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const EXCEL_PATH = path.join(__dirname, '..', 'T.E RESULT 25-26.xlsx');

async function syncStudents() {
  const client = await pool.connect();
  try {
    console.log('[Sync] Reading Excel workbook:', EXCEL_PATH);
    const wb = xlsx.readFile(EXCEL_PATH);
    const sheets = ['TE 1', 'TE 2', 'TE 3'];

    const passwordHash = bcrypt.hashSync('student@123', 10);

    let totalRead = 0;
    let totalUpserted = 0;

    await client.query('BEGIN');

    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS seat_no VARCHAR(50)`);
    await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_roll_no_key`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_students_enrollment_no ON students (enrollment_no)`);

    for (const divName of sheets) {
      const ws = wb.Sheets[divName];
      if (!ws) {
        console.warn(`[Sync] Sheet ${divName} not found!`);
        continue;
      }

      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
      console.log(`[Sync] Processing "${divName}", total rows: ${rows.length}`);

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) continue;

        // Find PRN column: e.g. F23...
        let prn = null;
        let rollNo = null;
        let seatNo = null;
        let name = null;

        for (let colIdx = 0; colIdx < Math.min(row.length, 6); colIdx++) {
          const val = row[colIdx];
          if (typeof val === 'string' && /^F\d{7,9}$/i.test(val.trim())) {
            prn = val.trim().toUpperCase();
            rollNo = row[1] !== null && row[1] !== undefined ? String(row[1]).trim() : null;
            seatNo = row[2] !== null && row[2] !== undefined ? String(row[2]).trim() : null;
            name = row[4] !== null && row[4] !== undefined ? String(row[4]).trim() : (row[colIdx + 1] ? String(row[colIdx + 1]).trim() : null);
            break;
          }
        }

        if (!prn) continue;
        totalRead++;

        if (!name || name === '.' || name === '-') {
          name = `Student ${prn}`;
        }
        if (!rollNo || isNaN(Number(rollNo))) {
          rollNo = row[0] ? String(row[0]).trim() : String(totalRead);
        }

        const email = `${prn.toLowerCase()}@meswadiacoe.edu`;

        // 1. Upsert into users table
        const userRes = await client.query(
          `INSERT INTO users (name, role, email, password_hash, department, is_active)
           VALUES ($1, 'student', $2, $3, 'Computer Engineering', true)
           ON CONFLICT (email) DO UPDATE 
           SET name = EXCLUDED.name,
               password_hash = EXCLUDED.password_hash,
               is_active = true
           RETURNING id`,
          [name, email, passwordHash]
        );
        const userId = userRes.rows[0].id;

        // 2. Upsert into students table (by enrollment_no or user_id)
        const existingStudent = await client.query(
          `SELECT id FROM students WHERE enrollment_no = $1 OR user_id = $2`,
          [prn, userId]
        );

        if (existingStudent.rows.length > 0) {
          await client.query(
            `UPDATE students 
             SET user_id = $1,
                 roll_no = $2,
                 enrollment_no = $3,
                 seat_no = COALESCE(NULLIF($4, ''), seat_no),
                 division = $5,
                 current_semester = 5,
                 class_year = 'TE',
                 batch = '2025-26'
             WHERE id = $6`,
            [userId, rollNo, prn, seatNo || '', divName, existingStudent.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO students (user_id, roll_no, enrollment_no, seat_no, batch, current_semester, division, class_year)
             VALUES ($1, $2, $3, $4, '2025-26', 5, $5, 'TE')`,
            [userId, rollNo, prn, seatNo || '', divName]
          );
        }

        totalUpserted++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Sync] Finished! Found ${totalRead} student records, successfully upserted ${totalUpserted} students into database.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Sync] Error syncing students:', err);
  } finally {
    client.release();
    pool.end();
  }
}

syncStudents();
