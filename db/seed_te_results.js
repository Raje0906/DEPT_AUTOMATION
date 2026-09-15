const pool = require('./pool');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const path = require('path');

const EXCEL_PATH = 'C:\\Users\\Rajea\\Downloads\\T.E RESULT 25-26.xlsx';

async function seedTEResults() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Seed TE] Loading workbook from:', EXCEL_PATH);
    const wb = xlsx.readFile(EXCEL_PATH);

    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const defaultStudentPw = hash('student@123');

    // ─── 1. SUBJECT DEFINITIONS FOR TE SEMESTER 1 (SEM 5) ──────────────────────
    const subjectsData = [
      { name: 'Database Management Systems', code: 'CE501', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Theory of Computation', code: 'CE502', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Systems Programming & Operating System', code: 'CE503', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Computer Networks & Security', code: 'CE504', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Elective I - Internet of Things (IOT)', code: 'CE505_IOT', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Elective I - Human Computer Interface (HCI)', code: 'CE505_HCI', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Elective I - Distributed Systems (DS)', code: 'CE505_DS', semester: 5, credits: 3, max_cie: 30, max_practical: 0, max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Database Management Systems Lab (DBMSL)', code: 'CE506_DBMSL', semester: 5, credits: 2, max_cie: 0, max_practical: 25, max_end_sem: 0, has_practical: true, type: 'practical' },
      { name: 'Computer Networks & Security Lab (CNSL)', code: 'CE507_CNSL', semester: 5, credits: 2, max_cie: 0, max_practical: 25, max_end_sem: 0, has_practical: true, type: 'practical' },
      { name: 'Laboratory Practice I (LP 1)', code: 'CE508_LP1', semester: 5, credits: 2, max_cie: 0, max_practical: 25, max_end_sem: 0, has_practical: true, type: 'practical' },
      { name: 'Seminar', code: 'CE509_SEM', semester: 5, credits: 1, max_cie: 0, max_practical: 50, max_end_sem: 0, has_practical: true, type: 'practical' },
    ];

    const subjectMap = {}; // code -> id
    for (const sub of subjectsData) {
      const res = await client.query(
        `INSERT INTO subjects (name, code, semester, credits, department, max_cie, max_practical, max_end_sem, has_practical, subject_type)
         VALUES ($1, $2, $3, $4, 'Computer Engineering', $5, $6, $7, $8, $9)
         ON CONFLICT (code) DO UPDATE SET 
           name = EXCLUDED.name, 
           credits = EXCLUDED.credits, 
           subject_type = EXCLUDED.subject_type,
           has_practical = EXCLUDED.has_practical
         RETURNING id`,
        [sub.name, sub.code, sub.semester, sub.credits, sub.max_cie, sub.max_practical, sub.max_end_sem, sub.has_practical, sub.type]
      );
      subjectMap[sub.code] = res.rows[0].id;
    }
    console.log('[Seed TE] Subjects registered/updated.');

    // ─── 2. FETCH EXAM TYPE IDS ────────────────────────────────────────────────
    const examTypesRes = await client.query(`SELECT id, code FROM exam_types`);
    const examTypeMap = {};
    for (const row of examTypesRes.rows) {
      examTypeMap[row.code] = row.id;
    }

    // ─── 3. ENSURE FACULTY MEMBERS EXIST ───────────────────────────────────────
    const facultyData = [
      { name: 'Prof. Rajan Mehta',      email: 'rajan@meswadiacoe.edu',            emp: 'FAC002', desig: 'Associate Professor' },
      { name: 'Prof. Sunita Patil',     email: 'sunita@meswadiacoe.edu',           emp: 'FAC003', desig: 'Associate Professor' },
      { name: 'Prof. Arjun Sharma',     email: 'arjun@meswadiacoe.edu',            emp: 'FAC004', desig: 'Assistant Professor' },
      { name: 'Prof. Priya Kulkarni',   email: 'priya.kulkarni@meswadiacoe.edu',   emp: 'FAC005', desig: 'Assistant Professor' },
      { name: 'Prof. Rajesh Deshpande', email: 'rajesh.deshpande@meswadiacoe.edu', emp: 'FAC006', desig: 'Associate Professor' },
      { name: 'Prof. Neha Joshi',       email: 'neha.joshi@meswadiacoe.edu',       emp: 'FAC007', desig: 'Assistant Professor' },
      { name: 'Prof. Vikram Shinde',    email: 'vikram.shinde@meswadiacoe.edu',    emp: 'FAC008', desig: 'Assistant Professor' },
      { name: 'Prof. Anjali Gokhale',   email: 'anjali.gokhale@meswadiacoe.edu',   emp: 'FAC009', desig: 'Assistant Professor' },
      { name: 'Prof. Sachin Kadam',     email: 'sachin.kadam@meswadiacoe.edu',     emp: 'FAC010', desig: 'Assistant Professor' },
      { name: 'Prof. Pooja More',       email: 'pooja.more@meswadiacoe.edu',       emp: 'FAC011', desig: 'Assistant Professor' },
    ];
    const facultyIds = [];
    for (const f of facultyData) {
      const u = await client.query(
        `INSERT INTO users (name, role, email, password_hash, department)
         VALUES ($1, 'faculty', $2, $3, 'Computer Engineering')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [f.name, f.email, hash('faculty@123')]
      );
      const fac = await client.query(
        `INSERT INTO faculty (user_id, department, designation, employee_id)
         VALUES ($1, 'Computer Engineering', $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET designation = EXCLUDED.designation RETURNING id`,
        [u.rows[0].id, f.desig, f.emp]
      );
      facultyIds.push(fac.rows[0].id);
    }

    // ─── 4. MAP FACULTY TO TE SUBJECTS ACROSS DIVISIONS ────────────────────────
    const divisions = ['TE 1', 'TE 2', 'TE 3'];
    const academicYear = '2025-26';
    const semester = 5;

    // Clean old faculty maps for this semester/year
    await client.query(
      `DELETE FROM faculty_subject_map WHERE semester = $1 AND academic_year = $2`,
      [semester, academicYear]
    );

    const assignmentList = [
      { code: 'CE501',       fIndex: 0 }, // DBMS -> Prof. Rajan Mehta
      { code: 'CE502',       fIndex: 1 }, // TOC -> Prof. Sunita Patil
      { code: 'CE503',       fIndex: 2 }, // SPOS -> Prof. Arjun Sharma
      { code: 'CE504',       fIndex: 3 }, // CNS -> Prof. Priya Kulkarni
      { code: 'CE505_IOT',   fIndex: 4 }, // IOT -> Prof. Rajesh Deshpande
      { code: 'CE505_HCI',   fIndex: 5 }, // HCI -> Prof. Neha Joshi
      { code: 'CE505_DS',    fIndex: 6 }, // DS -> Prof. Vikram Shinde
      { code: 'CE506_DBMSL', fIndex: 0 }, // DBMSL -> Prof. Rajan Mehta
      { code: 'CE507_CNSL',  fIndex: 3 }, // CNSL -> Prof. Priya Kulkarni
      { code: 'CE508_LP1',   fIndex: 7 }, // LP1 -> Prof. Anjali Gokhale
      { code: 'CE509_SEM',   fIndex: 8 }, // Seminar -> Prof. Sachin Kadam
    ];

    for (const div of divisions) {
      for (const item of assignmentList) {
        const subId = subjectMap[item.code];
        const fId = facultyIds[item.fIndex];
        if (subId && fId) {
          await client.query(
            `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
            [fId, subId, semester, academicYear, div]
          );
        }
      }
    }
    console.log('[Seed TE] Faculty assignments configured.');

    // ─── 5. READ STUDENTS & MARKS FROM EXCEL ───────────────────────────────────
    let totalImportedStudents = 0;
    let totalImportedMarks = 0;

    const parseCellMark = (val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'string') {
        const s = val.trim().toUpperCase();
        if (s === 'AAA' || s === 'AB' || s === 'ABSENT' || s === 'NA') {
          return { isAbsent: true, marks: 0 };
        }
        const num = parseFloat(s);
        if (!isNaN(num)) return { isAbsent: false, marks: num };
        return null;
      }
      if (typeof val === 'number') {
        return { isAbsent: false, marks: val };
      }
      return null;
    };

    for (const divName of divisions) {
      const ws = wb.Sheets[divName];
      if (!ws) {
        console.warn(`[Seed TE] Sheet ${divName} not found!`);
        continue;
      }

      // Convert sheet to row array (0-indexed)
      const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
      console.log(`[Seed TE] Processing sheet "${divName}", total rows: ${data.length}`);

      // In the Excel sheet:
      // Row 4 (index 3): Headers (Sr. No., Roll No, Seat No, PRN, Name, DBMS, TOC, SPOS, CNS, IOT, HCI, DS, DBMSL, CNSL, LP 1, Seminar, SGPA)
      // Row 5 (index 4): Max Marks (30, 70, 100, etc.)
      // Data starts at Row 6 (index 5)
      for (let r = 5; r < data.length; r++) {
        const row = data[r];
        if (!row) continue;

        const rollNoRaw = row[1];
        const seatNoRaw = row[2];
        const prnRaw    = row[3];
        const nameRaw   = row[4];

        if (!prnRaw || !nameRaw) continue; // skip empty rows

        const prn = String(prnRaw).trim().toUpperCase();
        const rollNo = rollNoRaw ? String(Math.round(Number(rollNoRaw)) || rollNoRaw).trim() : prn;
        const name = String(nameRaw).trim();
        const email = `${prn.toLowerCase()}@meswadiacoe.edu`;

        // 1. Insert or update User
        const userRes = await client.query(
          `INSERT INTO users (name, role, email, password_hash, department)
           VALUES ($1, 'student', $2, $3, 'Computer Engineering')
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [name, email, defaultStudentPw]
        );
        const userId = userRes.rows[0].id;

        // 2. Insert or update Student
        const studentRes = await client.query(
          `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (enrollment_no) DO UPDATE SET 
             roll_no = EXCLUDED.roll_no, 
             division = EXCLUDED.division,
             current_semester = EXCLUDED.current_semester,
             batch = EXCLUDED.batch
           RETURNING id`,
          [userId, rollNo, prn, '2025-26', semester, divName]
        );
        const studentId = studentRes.rows[0].id;
        totalImportedStudents++;

        // Helper to insert exam mark
        const insertExamMark = async (subjectCode, examTypeCode, markObj, facultyEmpIdx = 0) => {
          if (!markObj) return;
          const subId = subjectMap[subjectCode];
          const examTypeId = examTypeMap[examTypeCode];
          const fId = facultyIds[facultyEmpIdx] || facultyIds[0];

          if (!subId || !examTypeId) return;

          await client.query(
            `INSERT INTO student_exam_marks (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'published', $8, NOW())
             ON CONFLICT (student_id, subject_id, exam_type_id, semester, academic_year)
             DO UPDATE SET 
               marks_obtained = EXCLUDED.marks_obtained,
               is_absent = EXCLUDED.is_absent,
               status = 'published',
               last_modified_at = NOW()`,
            [studentId, subId, examTypeId, semester, academicYear, markObj.marks, markObj.isAbsent, fId]
          );
          totalImportedMarks++;
        };

        // Helper to record Term Work details
        const insertTWDetails = async (subjectCode, totalTWVal) => {
          if (!totalTWVal) return;
          const subId = subjectMap[subjectCode];
          if (!subId) return;

          const tw = Math.max(0, totalTWVal.marks);
          // Standard decomposition for 25 max: Attendance (5), A1 (7), A2 (7), Timely (6)
          const ratio = tw / 25.0;
          const att = Math.round(5.0 * ratio * 10) / 10;
          const a1  = Math.round(7.0 * ratio * 10) / 10;
          const a2  = Math.round(7.0 * ratio * 10) / 10;
          const tim = Math.max(0, Math.round((tw - (att + a1 + a2)) * 10) / 10);

          await client.query(
            `INSERT INTO student_term_work_details (student_id, subject_id, semester, academic_year, attendance_marks, assignment_1_marks, assignment_2_marks, timely_submission_marks, total_tw_marks, entered_by, last_modified_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (student_id, subject_id, semester, academic_year)
             DO UPDATE SET 
               attendance_marks = EXCLUDED.attendance_marks,
               assignment_1_marks = EXCLUDED.assignment_1_marks,
               assignment_2_marks = EXCLUDED.assignment_2_marks,
               timely_submission_marks = EXCLUDED.timely_submission_marks,
               total_tw_marks = EXCLUDED.total_tw_marks,
               last_modified_at = NOW()`,
            [studentId, subId, semester, academicYear, att, a1, a2, tim, tw, facultyIds[0]]
          );
        };

        // A. DBMS (Col 5: Insem [index 5], Col 6: Endsem [index 6])
        const dbmsInsem = parseCellMark(row[5]);
        const dbmsEndsem = parseCellMark(row[6]);
        await insertExamMark('CE501', 'insem', dbmsInsem, 0);
        await insertExamMark('CE501', 'endsem', dbmsEndsem, 0);

        // B. TOC (Col 8: Insem [index 8], Col 9: Endsem [index 9])
        const tocInsem = parseCellMark(row[8]);
        const tocEndsem = parseCellMark(row[9]);
        await insertExamMark('CE502', 'insem', tocInsem, 1);
        await insertExamMark('CE502', 'endsem', tocEndsem, 1);

        // C. SPOS (Col 11: Insem [index 11], Col 12: Endsem [index 12])
        const sposInsem = parseCellMark(row[11]);
        const sposEndsem = parseCellMark(row[12]);
        await insertExamMark('CE503', 'insem', sposInsem, 2);
        await insertExamMark('CE503', 'endsem', sposEndsem, 2);

        // D. CNS (Col 14: Insem [index 14], Col 15: Endsem [index 15])
        const cnsInsem = parseCellMark(row[14]);
        const cnsEndsem = parseCellMark(row[15]);
        await insertExamMark('CE504', 'insem', cnsInsem, 3);
        await insertExamMark('CE504', 'endsem', cnsEndsem, 3);

        // E. Elective 1: Check IOT (cols 17, 18), HCI (cols 20, 21), DS (cols 23, 24)
        const iotInsem = parseCellMark(row[17]);
        const iotEndsem = parseCellMark(row[18]);
        if (iotInsem !== null || iotEndsem !== null) {
          await insertExamMark('CE505_IOT', 'insem', iotInsem, 4);
          await insertExamMark('CE505_IOT', 'endsem', iotEndsem, 4);
        }

        const hciInsem = parseCellMark(row[20]);
        const hciEndsem = parseCellMark(row[21]);
        if (hciInsem !== null || hciEndsem !== null) {
          await insertExamMark('CE505_HCI', 'insem', hciInsem, 5);
          await insertExamMark('CE505_HCI', 'endsem', hciEndsem, 5);
        }

        const dsInsem = parseCellMark(row[23]);
        const dsEndsem = parseCellMark(row[24]);
        if (dsInsem !== null || dsEndsem !== null) {
          await insertExamMark('CE505_DS', 'insem', dsInsem, 6);
          await insertExamMark('CE505_DS', 'endsem', dsEndsem, 6);
        }

        // F. DBMSL (Col 26: TW [index 26], Col 27: PR [index 27])
        const dbmslTW = parseCellMark(row[26]);
        const dbmslPR = parseCellMark(row[27]);
        await insertExamMark('CE506_DBMSL', 'term_work', dbmslTW, 0);
        await insertExamMark('CE506_DBMSL', 'final_practical', dbmslPR, 0);
        await insertTWDetails('CE506_DBMSL', dbmslTW);

        // G. CNSL (Col 29: TW [index 29], Col 30: OR [index 30])
        const cnslTW = parseCellMark(row[29]);
        const cnslOR = parseCellMark(row[30]);
        await insertExamMark('CE507_CNSL', 'term_work', cnslTW, 3);
        await insertExamMark('CE507_CNSL', 'final_practical', cnslOR, 3);
        await insertTWDetails('CE507_CNSL', cnslTW);

        // H. LP 1 (Col 32: TW [index 32], Col 33: PR [index 33])
        const lp1TW = parseCellMark(row[32]);
        const lp1PR = parseCellMark(row[33]);
        await insertExamMark('CE508_LP1', 'term_work', lp1TW, 7);
        await insertExamMark('CE508_LP1', 'final_practical', lp1PR, 7);
        await insertTWDetails('CE508_LP1', lp1TW);

        // I. Seminar (Col 35: TW/Oral [index 35])
        const semTW = parseCellMark(row[35]);
        await insertExamMark('CE509_SEM', 'term_work', semTW, 8);
      }
    }

    // ─── 6. SET PUBLISHED STATUS FOR TE SEM 1 (2025-26) ───────────────────────
    for (const div of divisions) {
      await client.query(
        `INSERT INTO result_publish_status (semester, academic_year, department, division, status, published_at)
         VALUES ($1, $2, 'Computer Engineering', $3, 'published', NOW())
         ON CONFLICT (semester, academic_year, department, division)
         DO UPDATE SET status = 'published', published_at = NOW()`,
        [semester, academicYear, div]
      );
    }

    await client.query('COMMIT');
    console.log(`[Seed TE] SUCCESS: Imported ${totalImportedStudents} students and ${totalImportedMarks} exam mark entries!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed TE] FAILED:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedTEResults()
    .then(() => {
      console.log('[Seed TE] Finished cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedTEResults };
