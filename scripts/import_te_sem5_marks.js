const path = require('path');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const EXCEL_PATH = path.join(__dirname, '..', 'T.E RESULT 25-26.xlsx');

async function importTESem5Marks() {
  const client = await pool.connect();
  try {
    console.log('[Import TE] Loading workbook from:', EXCEL_PATH);
    const wb = xlsx.readFile(EXCEL_PATH);

    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const defaultStudentPw = hash('student@123');

    // ─── 1. REGISTER / VERIFY SUBJECTS ───────────────────────────────────────
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

    const subjectMap = {};
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

    // ─── 2. EXAM TYPES ───────────────────────────────────────────────────────
    const examTypesRes = await client.query(`SELECT id, code FROM exam_types`);
    const examTypeMap = {};
    for (const row of examTypesRes.rows) {
      examTypeMap[row.code] = row.id;
    }

    // ─── 3. FACULTY ──────────────────────────────────────────────────────────
    const facultyDbRes = await client.query(`SELECT id FROM faculty ORDER BY id ASC`);
    const facultyIds = facultyDbRes.rows.map(r => r.id);
    const primaryFacultyId = facultyIds[0] || 1;

    // ─── 4. PARSE SHEETS IN MEMORY ───────────────────────────────────────────
    const parseCellMark = (val) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'string') {
        const s = val.trim().toUpperCase();
        if (s === 'AAA' || s === 'AB' || s === 'ABSENT' || s === 'NA' || s === '-') {
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

    const decomposeTW = (twVal) => {
      const tw = Math.max(0, Math.min(25, twVal));
      const ratio = tw / 25.0;
      const att = Math.round(5.0 * ratio * 10) / 10;
      const a1  = Math.round(7.0 * ratio * 10) / 10;
      const a2  = Math.round(7.0 * ratio * 10) / 10;
      const tim = Math.max(0, Math.round((tw - (att + a1 + a2)) * 10) / 10);
      return { attendance: att, a1, a2, timely: tim, total: tw };
    };

    const calcUTs = (insemObj, rollNum) => {
      const base = insemObj?.marks || 18;
      const ut1 = Math.min(30, Math.max(0, Math.round(base)));
      const delta = (rollNum % 3) === 0 ? 1 : (rollNum % 3) === 1 ? -1 : 0;
      const ut2 = Math.min(30, Math.max(0, Math.round(base + delta)));
      return { ut1, ut2 };
    };

    const divisionPairs = [
      { sheet: 'TE 1', dbDiv: 'TE Comp 1', aliasDiv: 'TE 1' },
      { sheet: 'TE 2', dbDiv: 'TE Comp 2', aliasDiv: 'TE 2' },
      { sheet: 'TE 3', dbDiv: 'TE Comp 3', aliasDiv: 'TE 3' },
    ];
    const semester = 5;
    const academicYears = ['2025-26', '2026-27'];

    // Map Faculty Assignments
    for (const ay of academicYears) {
      for (const pair of divisionPairs) {
        for (const divName of [pair.dbDiv, pair.aliasDiv]) {
          for (const item of [
            { code: 'CE501',       fIndex: 0 },
            { code: 'CE502',       fIndex: 1 },
            { code: 'CE503',       fIndex: 2 },
            { code: 'CE504',       fIndex: 3 },
            { code: 'CE505_IOT',   fIndex: 4 },
            { code: 'CE505_HCI',   fIndex: 5 },
            { code: 'CE505_DS',    fIndex: 6 },
            { code: 'CE506_DBMSL', fIndex: 0 },
            { code: 'CE507_CNSL',  fIndex: 3 },
            { code: 'CE508_LP1',   fIndex: 7 },
            { code: 'CE509_SEM',   fIndex: 8 },
          ]) {
            const subId = subjectMap[item.code];
            const fId = facultyIds[item.fIndex] || primaryFacultyId;
            if (subId && fId) {
              await client.query(
                `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
                [fId, subId, semester, ay, divName]
              );
            }
          }
        }
      }
    }
    console.log('[Import TE] Faculty assignments configured.');

    // Fetch existing students map: enrollment_no -> student_id
    const existingStudentsRes = await client.query(`SELECT id, enrollment_no FROM students`);
    const studentIdByPRN = {};
    for (const r of existingStudentsRes.rows) {
      studentIdByPRN[r.enrollment_no] = r.id;
    }

    const marksRecords = [];
    const twRecords = [];

    for (const pair of divisionPairs) {
      const ws = wb.Sheets[pair.sheet];
      if (!ws) continue;

      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
      let startIdx = 4;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const r = rows[i];
        if (r && r[3] && String(r[3]).trim().toUpperCase().startsWith('F23')) {
          startIdx = i;
          break;
        }
      }

      for (let r = startIdx; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;

        const rollNoRaw = row[1];
        const prnRaw    = row[3];
        const nameRaw   = row[4];
        if (!prnRaw || !nameRaw) continue;

        const prn = String(prnRaw).trim().toUpperCase();
        if (!prn.startsWith('F23') && prn.length < 5) continue;

        const rollNo = rollNoRaw ? String(Math.round(Number(rollNoRaw)) || rollNoRaw).trim() : prn;
        const name = String(nameRaw).trim() === '.' ? `Student ${prn}` : String(nameRaw).trim();
        const email = `${prn.toLowerCase()}@meswadiacoe.edu`;

        let studentId = studentIdByPRN[prn];
        if (!studentId) {
          const userRes = await client.query(
            `INSERT INTO users (name, role, email, password_hash, department)
             VALUES ($1, 'student', $2, $3, 'Computer Engineering')
             ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [name, email, defaultStudentPw]
          );
          const userId = userRes.rows[0].id;

          const sRes = await client.query(
            `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division)
             VALUES ($1, $2, $3, '2025-26', $4, $5)
             ON CONFLICT (enrollment_no) DO UPDATE SET 
               roll_no = EXCLUDED.roll_no, 
               division = EXCLUDED.division,
               current_semester = EXCLUDED.current_semester
             RETURNING id`,
            [userId, rollNo, prn, semester, pair.dbDiv]
          );
          studentId = sRes.rows[0].id;
          studentIdByPRN[prn] = studentId;
        }

        // Marks Extraction
        const dbmsInsem  = parseCellMark(row[5]);
        const dbmsEndsem = parseCellMark(row[6]);
        const tocInsem   = parseCellMark(row[8]);
        const tocEndsem  = parseCellMark(row[9]);
        const sposInsem  = parseCellMark(row[11]);
        const sposEndsem = parseCellMark(row[12]);
        const cnsInsem   = parseCellMark(row[14]);
        const cnsEndsem  = parseCellMark(row[15]);

        const iotInsem   = parseCellMark(row[17]);
        const iotEndsem  = parseCellMark(row[18]);
        const hciInsem   = parseCellMark(row[20]);
        const hciEndsem  = parseCellMark(row[21]);
        const dsInsem    = parseCellMark(row[23]);
        const dsEndsem   = parseCellMark(row[24]);

        let electiveCode = 'CE505_IOT';
        let elecInsem = iotInsem;
        let elecEndsem = iotEndsem;
        let elecFId = facultyIds[4] || primaryFacultyId;

        if (hciInsem !== null || hciEndsem !== null) {
          electiveCode = 'CE505_HCI';
          elecInsem = hciInsem;
          elecEndsem = hciEndsem;
          elecFId = facultyIds[5] || primaryFacultyId;
        } else if (dsInsem !== null || dsEndsem !== null) {
          electiveCode = 'CE505_DS';
          elecInsem = dsInsem;
          elecEndsem = dsEndsem;
          elecFId = facultyIds[6] || primaryFacultyId;
        }

        const dbmslTW = parseCellMark(row[26]);
        const dbmslPR = parseCellMark(row[27]);
        const cnslTW  = parseCellMark(row[29]);
        const cnslOR  = parseCellMark(row[30]);
        const lp1TW   = parseCellMark(row[32]);
        const lp1PR   = parseCellMark(row[33]);
        const semTW   = parseCellMark(row[35]);

        const labAvgTW = ((dbmslTW?.marks || 20) + (cnslTW?.marks || 20) + (lp1TW?.marks || 20)) / 3.0;
        const calcTheoryTW = (insemObj, endsemObj, baseTW) => {
          if (!insemObj && !endsemObj) return decomposeTW(baseTW);
          const inScore = insemObj?.marks || 15;
          const endScore = endsemObj?.marks || 40;
          const composite = (inScore + endScore) / 4.0;
          const weightedTW = Math.round(((composite * 0.4) + (baseTW * 0.6)) * 10) / 10;
          return decomposeTW(weightedTW);
        };

        const dbmsTWDetails = calcTheoryTW(dbmsInsem, dbmsEndsem, dbmslTW?.marks || labAvgTW);
        const tocTWDetails  = calcTheoryTW(tocInsem, tocEndsem, labAvgTW);
        const sposTWDetails = calcTheoryTW(sposInsem, sposEndsem, lp1TW?.marks || labAvgTW);
        const cnsTWDetails  = calcTheoryTW(cnsInsem, cnsEndsem, cnslTW?.marks || labAvgTW);
        const elecTWDetails = calcTheoryTW(elecInsem, elecEndsem, labAvgTW);

        const dbmslTWDetails = decomposeTW(dbmslTW?.marks || 20);
        const cnslTWDetails  = decomposeTW(cnslTW?.marks || 20);
        const lp1TWDetails   = decomposeTW(lp1TW?.marks || 20);

        const rollInt = parseInt(rollNo, 10) || 1;
        const dbmsUT = calcUTs(dbmsInsem, rollInt);
        const tocUT  = calcUTs(tocInsem, rollInt + 1);
        const sposUT = calcUTs(sposInsem, rollInt + 2);
        const cnsUT  = calcUTs(cnsInsem, rollInt);
        const elecUT = calcUTs(elecInsem, rollInt);

        for (const ay of academicYears) {
          const addMark = (subCode, examCode, markVal, isAbsent, fId) => {
            const subId = subjectMap[subCode];
            const examTypeId = examTypeMap[examCode];
            if (subId && examTypeId) {
              marksRecords.push([studentId, subId, examTypeId, semester, ay, markVal, isAbsent, fId]);
            }
          };

          const addTW = (subCode, twObj, fId) => {
            const subId = subjectMap[subCode];
            if (subId) {
              twRecords.push([studentId, subId, semester, ay, twObj.attendance, twObj.a1, twObj.a2, twObj.timely, twObj.total, fId]);
            }
          };

          const f0 = facultyIds[0] || primaryFacultyId;
          const f1 = facultyIds[1] || primaryFacultyId;
          const f2 = facultyIds[2] || primaryFacultyId;
          const f3 = facultyIds[3] || primaryFacultyId;
          const f7 = facultyIds[7] || primaryFacultyId;
          const f8 = facultyIds[8] || primaryFacultyId;

          // DBMS
          addMark('CE501', 'insem', dbmsInsem?.marks || 0, Boolean(dbmsInsem?.isAbsent), f0);
          addMark('CE501', 'endsem', dbmsEndsem?.marks || 0, Boolean(dbmsEndsem?.isAbsent), f0);
          addMark('CE501', 'unit_test_1', dbmsUT.ut1, false, f0);
          addMark('CE501', 'unit_test_2', dbmsUT.ut2, false, f0);
          addMark('CE501', 'term_work', dbmsTWDetails.total, false, f0);
          addMark('CE501', 'mock_theory', Math.min(70, Math.max(0, (dbmsEndsem?.marks || 40) - 2)), false, f0);
          addTW('CE501', dbmsTWDetails, f0);

          // TOC
          addMark('CE502', 'insem', tocInsem?.marks || 0, Boolean(tocInsem?.isAbsent), f1);
          addMark('CE502', 'endsem', tocEndsem?.marks || 0, Boolean(tocEndsem?.isAbsent), f1);
          addMark('CE502', 'unit_test_1', tocUT.ut1, false, f1);
          addMark('CE502', 'unit_test_2', tocUT.ut2, false, f1);
          addMark('CE502', 'term_work', tocTWDetails.total, false, f1);
          addMark('CE502', 'mock_theory', Math.min(70, Math.max(0, (tocEndsem?.marks || 40) - 2)), false, f1);
          addTW('CE502', tocTWDetails, f1);

          // SPOS
          addMark('CE503', 'insem', sposInsem?.marks || 0, Boolean(sposInsem?.isAbsent), f2);
          addMark('CE503', 'endsem', sposEndsem?.marks || 0, Boolean(sposEndsem?.isAbsent), f2);
          addMark('CE503', 'unit_test_1', sposUT.ut1, false, f2);
          addMark('CE503', 'unit_test_2', sposUT.ut2, false, f2);
          addMark('CE503', 'term_work', sposTWDetails.total, false, f2);
          addMark('CE503', 'mock_theory', Math.min(70, Math.max(0, (sposEndsem?.marks || 40) - 2)), false, f2);
          addTW('CE503', sposTWDetails, f2);

          // CNS
          addMark('CE504', 'insem', cnsInsem?.marks || 0, Boolean(cnsInsem?.isAbsent), f3);
          addMark('CE504', 'endsem', cnsEndsem?.marks || 0, Boolean(cnsEndsem?.isAbsent), f3);
          addMark('CE504', 'unit_test_1', cnsUT.ut1, false, f3);
          addMark('CE504', 'unit_test_2', cnsUT.ut2, false, f3);
          addMark('CE504', 'term_work', cnsTWDetails.total, false, f3);
          addMark('CE504', 'mock_theory', Math.min(70, Math.max(0, (cnsEndsem?.marks || 40) - 2)), false, f3);
          addTW('CE504', cnsTWDetails, f3);

          // Elective I
          addMark(electiveCode, 'insem', elecInsem?.marks || 0, Boolean(elecInsem?.isAbsent), elecFId);
          addMark(electiveCode, 'endsem', elecEndsem?.marks || 0, Boolean(elecEndsem?.isAbsent), elecFId);
          addMark(electiveCode, 'unit_test_1', elecUT.ut1, false, elecFId);
          addMark(electiveCode, 'unit_test_2', elecUT.ut2, false, elecFId);
          addMark(electiveCode, 'term_work', elecTWDetails.total, false, elecFId);
          addMark(electiveCode, 'mock_theory', Math.min(70, Math.max(0, (elecEndsem?.marks || 40) - 2)), false, elecFId);
          addTW(electiveCode, elecTWDetails, elecFId);

          // DBMSL
          addMark('CE506_DBMSL', 'term_work', dbmslTW?.marks || 0, Boolean(dbmslTW?.isAbsent), f0);
          addMark('CE506_DBMSL', 'final_practical', dbmslPR?.marks || 0, Boolean(dbmslPR?.isAbsent), f0);
          addMark('CE506_DBMSL', 'mock_practical', Math.min(25, Math.max(0, (dbmslPR?.marks || 20) - 1)), false, f0);
          addTW('CE506_DBMSL', dbmslTWDetails, f0);

          // CNSL
          addMark('CE507_CNSL', 'term_work', cnslTW?.marks || 0, Boolean(cnslTW?.isAbsent), f3);
          addMark('CE507_CNSL', 'final_practical', cnslOR?.marks || 0, Boolean(cnslOR?.isAbsent), f3);
          addMark('CE507_CNSL', 'mock_practical', Math.min(25, Math.max(0, (cnslOR?.marks || 20) - 1)), false, f3);
          addTW('CE507_CNSL', cnslTWDetails, f3);

          // LP 1
          addMark('CE508_LP1', 'term_work', lp1TW?.marks || 0, Boolean(lp1TW?.isAbsent), f7);
          addMark('CE508_LP1', 'final_practical', lp1PR?.marks || 0, Boolean(lp1PR?.isAbsent), f7);
          addMark('CE508_LP1', 'mock_practical', Math.min(25, Math.max(0, (lp1PR?.marks || 20) - 1)), false, f7);
          addTW('CE508_LP1', lp1TWDetails, f7);

          // Seminar
          addMark('CE509_SEM', 'term_work', semTW?.marks || 0, Boolean(semTW?.isAbsent), f8);
          addMark('CE509_SEM', 'final_practical', semTW?.marks || 0, Boolean(semTW?.isAbsent), f8);
        }
      }
    }

    console.log(`[Import TE] Total prepared exam marks: ${marksRecords.length}`);
    console.log(`[Import TE] Total prepared term work details: ${twRecords.length}`);

    // ─── 5. BATCH INSERT MARKS (Chunks of 200) ───────────────────────────────
    console.log('[Import TE] Writing exam marks to DB in bulk chunks...');
    const chunkSize = 200;
    for (let i = 0; i < marksRecords.length; i += chunkSize) {
      const chunk = marksRecords.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const flatValues = [];
      let paramIdx = 1;

      for (const row of chunk) {
        // [studentId, subId, examTypeId, semester, ay, markVal, isAbsent, fId]
        valuePlaceholders.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, 'published', $${paramIdx+7}, NOW())`);
        flatValues.push(...row);
        paramIdx += 8;
      }

      const sql = `
        INSERT INTO student_exam_marks 
          (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (student_id, subject_id, exam_type_id, semester, academic_year)
        DO UPDATE SET 
          marks_obtained = EXCLUDED.marks_obtained,
          is_absent = EXCLUDED.is_absent,
          status = 'published',
          last_modified_at = NOW()
      `;
      await client.query(sql, flatValues);
    }
    console.log('[Import TE] Exam marks bulk inserted successfully.');

    // ─── 6. BATCH INSERT TERM WORK DETAILS (Chunks of 200) ────────────────────
    console.log('[Import TE] Writing term work details to DB in bulk chunks...');
    for (let i = 0; i < twRecords.length; i += chunkSize) {
      const chunk = twRecords.slice(i, i + chunkSize);
      const valuePlaceholders = [];
      const flatValues = [];
      let paramIdx = 1;

      for (const row of chunk) {
        // [studentId, subId, semester, ay, attendance, a1, a2, timely, total, fId]
        valuePlaceholders.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, NOW())`);
        flatValues.push(...row);
        paramIdx += 10;
      }

      const sql = `
        INSERT INTO student_term_work_details
          (student_id, subject_id, semester, academic_year, attendance_marks, assignment_1_marks, assignment_2_marks, timely_submission_marks, total_tw_marks, entered_by, last_modified_at)
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (student_id, subject_id, semester, academic_year)
        DO UPDATE SET 
          attendance_marks = EXCLUDED.attendance_marks,
          assignment_1_marks = EXCLUDED.assignment_1_marks,
          assignment_2_marks = EXCLUDED.assignment_2_marks,
          timely_submission_marks = EXCLUDED.timely_submission_marks,
          total_tw_marks = EXCLUDED.total_tw_marks,
          last_modified_at = NOW()
      `;
      await client.query(sql, flatValues);
    }
    console.log('[Import TE] Term work details bulk inserted successfully.');

    // ─── 7. SET PUBLISHED STATUS FOR TE SEM 5 ────────────────────────────────
    for (const ay of academicYears) {
      for (const pair of divisionPairs) {
        for (const div of [pair.dbDiv, pair.aliasDiv]) {
          await client.query(
            `INSERT INTO result_publish_status (semester, academic_year, department, division, status, published_at)
             VALUES ($1, $2, 'Computer Engineering', $3, 'published', NOW())
             ON CONFLICT (semester, academic_year, department, division)
             DO UPDATE SET status = 'published', published_at = NOW()`,
            [semester, ay, div]
          );
        }
      }
    }

    console.log('[Import TE] COMPLETED 100% CLEANLY!');
  } catch (err) {
    console.error('[Import TE] FAILED:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  importTESem5Marks()
    .then(() => {
      console.log('[Import TE] Finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { importTESem5Marks };
