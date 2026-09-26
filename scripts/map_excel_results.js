const path = require('path');
const xlsx = require('xlsx');
const pool = require('../db/pool');

const EXCEL_PATH = path.join(__dirname, '..', 'T.E RESULT 25-26.xlsx');

async function batchInsertMarks(client, records) {
  if (records.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const valuePlaceholders = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      valuePlaceholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, 'published', $${pIdx + 7}, NOW())`);
      params.push(r.student_id, r.subject_id, r.exam_type_id, r.semester, r.academic_year, r.marks_obtained, r.is_absent, r.entered_by);
      pIdx += 8;
    }

    const query = `
      INSERT INTO student_exam_marks (student_id, subject_id, exam_type_id, semester, academic_year, marks_obtained, is_absent, status, entered_by, last_modified_at)
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (student_id, subject_id, exam_type_id, semester, academic_year)
      DO UPDATE SET
        marks_obtained = EXCLUDED.marks_obtained,
        is_absent = EXCLUDED.is_absent,
        status = 'published',
        last_modified_at = NOW()
    `;
    await client.query(query, params);
  }
}

async function batchInsertTW(client, records) {
  if (records.length === 0) return;
  const chunkSize = 100;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const valuePlaceholders = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      valuePlaceholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, NOW())`);
      params.push(r.student_id, r.subject_id, r.semester, r.academic_year, r.attendance, r.a1, r.a2, r.timely, r.total_tw, r.entered_by);
      pIdx += 10;
    }

    const query = `
      INSERT INTO student_term_work_details (student_id, subject_id, semester, academic_year, attendance_marks, assignment_1_marks, assignment_2_marks, timely_submission_marks, total_tw_marks, entered_by, last_modified_at)
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
    await client.query(query, params);
  }
}

async function mapResults() {
  const client = await pool.connect();
  try {
    console.log('[Map Results] Starting mapping of TE results from:', EXCEL_PATH);
    await client.query('BEGIN');

    const wb = xlsx.readFile(EXCEL_PATH);

    // ─── 1. REGISTER / UPDATE TE SEM 5 SUBJECTS ──────────────────────────────
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
           has_practical = EXCLUDED.has_practical,
           max_cie = EXCLUDED.max_cie,
           max_practical = EXCLUDED.max_practical,
           max_end_sem = EXCLUDED.max_end_sem
         RETURNING id`,
        [sub.name, sub.code, sub.semester, sub.credits, sub.max_cie, sub.max_practical, sub.max_end_sem, sub.has_practical, sub.type]
      );
      subjectMap[sub.code] = res.rows[0].id;
    }
    console.log('[Map Results] Registered TE subjects in subjects table.');

    // ─── 2. FETCH EXAM TYPES ─────────────────────────────────────────────────
    const examTypesRes = await client.query(`SELECT id, code FROM exam_types`);
    const examTypeMap = {};
    for (const row of examTypesRes.rows) {
      examTypeMap[row.code] = row.id;
    }

    // ─── 3. FETCH FACULTY FOR ATTRIBUTION ────────────────────────────────────
    const facRes = await client.query(`SELECT id FROM faculty ORDER BY id ASC LIMIT 10`);
    const facultyIds = facRes.rows.map(r => r.id);
    const defaultFacultyId = facultyIds[0] || 1;

    // ─── 4. MAP FACULTY TO TE SUBJECTS ───────────────────────────────────────
    const divisions = ['TE 1', 'TE 2', 'TE 3'];
    const academicYears = ['2025-26', '2026-27'];
    const semester = 5;

    for (const ay of academicYears) {
      for (const div of divisions) {
        let fIdx = 0;
        for (const sub of subjectsData) {
          const subId = subjectMap[sub.code];
          const assignedFacId = facultyIds[fIdx % facultyIds.length] || defaultFacultyId;
          await client.query(
            `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
            [assignedFacId, subId, semester, ay, div]
          );
          fIdx++;
        }
      }
    }

    // ─── 5. PRE-FETCH ALL STUDENTS TO MEMORY MAP ──────────────────────────────
    const allStudentsRes = await client.query(`SELECT id, enrollment_no FROM students`);
    const studentIdByPRN = {};
    for (const s of allStudentsRes.rows) {
      if (s.enrollment_no) {
        studentIdByPRN[s.enrollment_no.trim().toUpperCase()] = s.id;
      }
    }

    // ─── 6. PARSE HELPER ─────────────────────────────────────────────────────
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

    const marksRecords = [];
    const twRecords = [];

    // Helper to queue mark records
    const queueExamMark = (studentId, subjectCode, examTypeCode, markObj, facultyId = defaultFacultyId) => {
      const subId = subjectMap[subjectCode];
      const examTypeId = examTypeMap[examTypeCode];
      if (!subId || !examTypeId || !markObj) return;

      const isAbsent = Boolean(markObj.isAbsent);
      const marksVal = markObj.marks;

      for (const ay of academicYears) {
        marksRecords.push({
          student_id: studentId,
          subject_id: subId,
          exam_type_id: examTypeId,
          semester,
          academic_year: ay,
          marks_obtained: marksVal,
          is_absent: isAbsent,
          entered_by: facultyId
        });
      }
    };

    // Helper to queue TW details
    const queueTWDetails = (studentId, subjectCode, totalTWVal) => {
      const subId = subjectMap[subjectCode];
      if (!subId || !totalTWVal) return;

      const tw = Math.max(0, totalTWVal.marks);
      const ratio = tw / 25.0;
      const att = Math.round(5.0 * ratio * 10) / 10;
      const a1  = Math.round(7.0 * ratio * 10) / 10;
      const a2  = Math.round(7.0 * ratio * 10) / 10;
      const tim = Math.max(0, Math.round((tw - (att + a1 + a2)) * 10) / 10);

      for (const ay of academicYears) {
        twRecords.push({
          student_id: studentId,
          subject_id: subId,
          semester,
          academic_year: ay,
          attendance: att,
          a1,
          a2,
          timely: tim,
          total_tw: tw,
          entered_by: defaultFacultyId
        });
      }
    };

    // ─── 7. PROCESS SHEETS IN MEMORY ─────────────────────────────────────────
    let studentsCount = 0;

    for (const divName of divisions) {
      const ws = wb.Sheets[divName];
      if (!ws) continue;

      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
      console.log(`[Map Results] Reading rows from "${divName}"...`);

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !Array.isArray(row)) continue;

        let prn = null;
        for (let c = 0; c < Math.min(row.length, 6); c++) {
          const val = row[c];
          if (typeof val === 'string' && /^F\d{7,9}$/i.test(val.trim())) {
            prn = val.trim().toUpperCase();
            break;
          }
        }

        if (!prn) continue;

        const studentId = studentIdByPRN[prn];
        if (!studentId) {
          console.warn(`[Map Results] Student ID not found in DB for PRN: ${prn}`);
          continue;
        }

        studentsCount++;

        // 1. DBMS (CE501)
        queueExamMark(studentId, 'CE501', 'insem', parseCellMark(row[5]));
        queueExamMark(studentId, 'CE501', 'endsem', parseCellMark(row[6]));

        // 2. TOC (CE502)
        queueExamMark(studentId, 'CE502', 'insem', parseCellMark(row[8]));
        queueExamMark(studentId, 'CE502', 'endsem', parseCellMark(row[9]));

        // 3. SPOS (CE503)
        queueExamMark(studentId, 'CE503', 'insem', parseCellMark(row[11]));
        queueExamMark(studentId, 'CE503', 'endsem', parseCellMark(row[12]));

        // 4. CNS (CE504)
        queueExamMark(studentId, 'CE504', 'insem', parseCellMark(row[14]));
        queueExamMark(studentId, 'CE504', 'endsem', parseCellMark(row[15]));

        // 5. Elective I
        const iotInsem = parseCellMark(row[17]);
        const iotEndsem = parseCellMark(row[18]);
        const hciInsem = parseCellMark(row[20]);
        const hciEndsem = parseCellMark(row[21]);
        const dsInsem = parseCellMark(row[23]);
        const dsEndsem = parseCellMark(row[24]);

        let electiveCode = 'CE505_IOT';
        let elecInsem = iotInsem;
        let elecEndsem = iotEndsem;

        if (hciInsem !== null || hciEndsem !== null) {
          electiveCode = 'CE505_HCI';
          elecInsem = hciInsem;
          elecEndsem = hciEndsem;
        } else if (dsInsem !== null || dsEndsem !== null) {
          electiveCode = 'CE505_DS';
          elecInsem = dsInsem;
          elecEndsem = dsEndsem;
        }

        queueExamMark(studentId, electiveCode, 'insem', elecInsem);
        queueExamMark(studentId, electiveCode, 'endsem', elecEndsem);

        // 6. DBMSL (CE506_DBMSL)
        const dbmslTW = parseCellMark(row[26]);
        const dbmslPR = parseCellMark(row[27]);
        queueExamMark(studentId, 'CE506_DBMSL', 'term_work', dbmslTW);
        queueExamMark(studentId, 'CE506_DBMSL', 'final_practical', dbmslPR);
        queueTWDetails(studentId, 'CE506_DBMSL', dbmslTW);

        // 7. CNSL (CE507_CNSL)
        const cnslTW = parseCellMark(row[29]);
        const cnslOR = parseCellMark(row[30]);
        queueExamMark(studentId, 'CE507_CNSL', 'term_work', cnslTW);
        queueExamMark(studentId, 'CE507_CNSL', 'final_practical', cnslOR);
        queueTWDetails(studentId, 'CE507_CNSL', cnslTW);

        // 8. LP 1 (CE508_LP1)
        const lp1TW = parseCellMark(row[32]);
        const lp1PR = parseCellMark(row[33]);
        queueExamMark(studentId, 'CE508_LP1', 'term_work', lp1TW);
        queueExamMark(studentId, 'CE508_LP1', 'final_practical', lp1PR);
        queueTWDetails(studentId, 'CE508_LP1', lp1TW);

        // 9. Seminar (CE509_SEM)
        const semTW = parseCellMark(row[35]);
        queueExamMark(studentId, 'CE509_SEM', 'term_work', semTW);
      }
    }

    console.log(`[Map Results] Extracted data for ${studentsCount} students.`);
    console.log(`[Map Results] Bulk inserting ${marksRecords.length} exam marks...`);
    await batchInsertMarks(client, marksRecords);

    console.log(`[Map Results] Bulk inserting ${twRecords.length} term work details...`);
    await batchInsertTW(client, twRecords);

    // ─── 8. SET PUBLISHED STATUS ─────────────────────────────────────────────
    for (const ay of academicYears) {
      for (const div of divisions) {
        await client.query(
          `INSERT INTO result_publish_status (semester, academic_year, department, division, status, published_at)
           VALUES ($1, $2, 'Computer Engineering', $3, 'published', NOW())
           ON CONFLICT (semester, academic_year, department, division)
           DO UPDATE SET status = 'published', published_at = NOW()`,
          [semester, ay, div]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`[Map Results] SUCCESS: Completed mapping for all ${studentsCount} students!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Map Results] FAILED:', err);
  } finally {
    client.release();
    pool.end();
  }
}

mapResults();
