const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const wadiaStudents = require('./wadia_students.json');

// ─── Grade Calculation (10-point absolute scale) ─────────────────────────────
// O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0

function calculateGrade(totalOutOf100) {
  if (totalOutOf100 >= 90) return { grade: 'O',  gradePoints: 10 };
  if (totalOutOf100 >= 80) return { grade: 'A+', gradePoints: 9  };
  if (totalOutOf100 >= 70) return { grade: 'A',  gradePoints: 8  };
  if (totalOutOf100 >= 60) return { grade: 'B+', gradePoints: 7  };
  if (totalOutOf100 >= 55) return { grade: 'B',  gradePoints: 6  };
  if (totalOutOf100 >= 50) return { grade: 'C',  gradePoints: 5  };
  if (totalOutOf100 >= 40) return { grade: 'P',  gradePoints: 4  };
  return { grade: 'F', gradePoints: 0 };
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Seed] Starting with MES Wadia COE students...');

    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const defaultStudentPw = hash('student@123');

    // ─── HOD ──────────────────────────────────────────────────────────────────
    const hodUser = await client.query(
      `INSERT INTO users (name, role, email, password_hash, department)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
       RETURNING id`,
      ['Dr. Meera Krishnan', 'hod', 'hod@meswadiacoe.edu', hash('hod@123'), 'Computer Engineering']
    );
    await client.query(
      `INSERT INTO faculty (user_id, department, designation, employee_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO NOTHING`,
      [hodUser.rows[0].id, 'Computer Engineering', 'Head of Department', 'FAC001']
    );

    // ─── FACULTY ──────────────────────────────────────────────────────────────
    const facultyData = [
      { name: 'Prof. Rajan Mehta',   email: 'rajan@meswadiacoe.edu',   emp: 'FAC002', desig: 'Associate Professor' },
      { name: 'Prof. Sunita Patil',  email: 'sunita@meswadiacoe.edu',  emp: 'FAC003', desig: 'Assistant Professor' },
      { name: 'Prof. Arjun Sharma',  email: 'arjun@meswadiacoe.edu',   emp: 'FAC004', desig: 'Assistant Professor' },
    ];
    const facultyIds = [];
    for (const f of facultyData) {
      const u = await client.query(
        `INSERT INTO users (name, role, email, password_hash, department)
         VALUES ($1,'faculty',$2,$3,'Computer Engineering')
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [f.name, f.email, hash('faculty@123')]
      );
      const fac = await client.query(
        `INSERT INTO faculty (user_id, department, designation, employee_id)
         VALUES ($1,'Computer Engineering',$2,$3)
         ON CONFLICT (user_id) DO UPDATE SET designation=EXCLUDED.designation RETURNING id`,
        [u.rows[0].id, f.desig, f.emp]
      );
      facultyIds.push(fac.rows[0].id);
    }

    // ─── SUBJECTS ─────────────────────────────────────────────────────────────
    const subjectsData = [
      // Semester 5
      { name: 'Data Structures & Algorithms', code: 'CE501', semester: 5, credits: 4, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true,  type: 'theory_practical' },
      { name: 'Operating Systems',            code: 'CE502', semester: 5, credits: 4, max_cie: 30, max_practical: 0,  max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Database Management Systems',  code: 'CE503', semester: 5, credits: 4, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true,  type: 'theory_practical' },
      { name: 'Computer Networks',            code: 'CE504', semester: 5, credits: 3, max_cie: 30, max_practical: 0,  max_end_sem: 70, has_practical: false, type: 'theory' },
      // Semester 6
      { name: 'Software Engineering',         code: 'CE601', semester: 6, credits: 4, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true,  type: 'theory_practical' },
      { name: 'Compiler Design',              code: 'CE602', semester: 6, credits: 3, max_cie: 30, max_practical: 0,  max_end_sem: 70, has_practical: false, type: 'theory' },
      { name: 'Machine Learning',             code: 'CE603', semester: 6, credits: 4, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true,  type: 'theory_practical' },
      { name: 'Web Technologies',             code: 'CE604', semester: 6, credits: 3, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true,  type: 'theory_practical' },
      { name: 'Data Science & Big Data Analytics (DSBDA)', code: 'DSBDA', semester: 6, credits: 4, max_cie: 30, max_practical: 25, max_end_sem: 70, has_practical: true, type: 'theory_practical' },
    ];
    const subjectIds = {};
    for (const s of subjectsData) {
      const res = await client.query(
        `INSERT INTO subjects (name, code, semester, credits, department, max_cie, max_practical, max_end_sem, has_practical, subject_type)
         VALUES ($1,$2,$3,$4,'Computer Engineering',$5,$6,$7,$8,$9)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [s.name, s.code, s.semester, s.credits, s.max_cie, s.max_practical, s.max_end_sem, s.has_practical, s.type]
      );
      subjectIds[s.code] = res.rows[0].id;
    }

    // ─── FACULTY SUBJECT MAP ───────────────────────────────────────────────────
    const fsMap = [
      // Sem 5 - Div A
      { fid: facultyIds[0], code: 'CE501', sem: 5 },
      { fid: facultyIds[0], code: 'CE502', sem: 5 },
      { fid: facultyIds[1], code: 'CE503', sem: 5 },
      { fid: facultyIds[2], code: 'CE504', sem: 5 },
      // Sem 6 - Div A
      { fid: facultyIds[0], code: 'CE601', sem: 6 },
      { fid: facultyIds[1], code: 'CE602', sem: 6 },
      { fid: facultyIds[1], code: 'CE603', sem: 6 },
      { fid: facultyIds[2], code: 'CE604', sem: 6 },
      { fid: facultyIds[0], code: 'DSBDA', sem: 6 },
    ];
    for (const m of fsMap) {
      await client.query(
        `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
         VALUES ($1,$2,$3,'2025-26','A')
         ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
        [m.fid, subjectIds[m.code], m.sem]
      );
      // also ensure academic year 2024-25 exists for compatibility
      await client.query(
        `INSERT INTO faculty_subject_map (faculty_id, subject_id, semester, academic_year, division)
         VALUES ($1,$2,$3,'2024-25','A')
         ON CONFLICT (faculty_id, subject_id, semester, academic_year, division) DO NOTHING`,
        [m.fid, subjectIds[m.code], m.sem]
      );
    }

    // ─── STUDENTS (Real MES Wadia Students from Excel) ─────────────────────────
    const studentIds = [];
    const studentDataList = [];

    for (const item of wadiaStudents) {
      const rollNo = String(item.roll_no);
      const enrollNo = item.prn_no || item.seat_no || `2025TE${rollNo.padStart(4, '0')}`;
      const email = `ce6a${rollNo.padStart(3, '0')}@meswadiacoe.edu`;
      const name = item.name;

      const u = await client.query(
        `INSERT INTO users (name, role, email, password_hash, department)
         VALUES ($1,'student',$2,$3,'Computer Engineering')
         ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [name, email, defaultStudentPw]
      );
      const s = await client.query(
        `INSERT INTO students (user_id, roll_no, enrollment_no, batch, current_semester, division)
         VALUES ($1,$2,$3,'2025-26',6,'A')
         ON CONFLICT (user_id) DO UPDATE SET roll_no=EXCLUDED.roll_no, enrollment_no=EXCLUDED.enrollment_no RETURNING id`,
        [u.rows[0].id, rollNo, enrollNo]
      );
      studentIds.push(s.rows[0].id);
      studentDataList.push({ studentId: s.rows[0].id, rollNo, inSem: item.in_sem });
    }

    // ─── MARKS: DSBDA with actual in-sem marks from Excel ─────────────────────
    const dsbdaId = subjectIds['DSBDA'];
    for (const s of studentDataList) {
      const inSem = s.inSem != null ? Number(s.inSem) : 0;
      const prac = Math.min(25, Math.round(inSem * 0.8));
      const es = Math.min(70, Math.round(inSem * 2.2));
      const rawTotal = inSem + prac + es;
      const normalized = Math.round((rawTotal / 125) * 100);
      const { grade, gradePoints } = calculateGrade(normalized);

      await client.query(
        `INSERT INTO marks (student_id, subject_id, semester, academic_year, cie_marks, practical_marks, end_sem_marks, total, grade, grade_points, is_backlog, entered_by, status)
         VALUES ($1,$2,6,'2025-26',$3,$4,$5,$6,$7,$8,FALSE,$9,'draft')
         ON CONFLICT (student_id, subject_id, semester, academic_year, attempt_number) DO UPDATE
         SET cie_marks=EXCLUDED.cie_marks, total=EXCLUDED.total, grade=EXCLUDED.grade`,
        [s.studentId, dsbdaId, inSem, prac, es, rawTotal, grade, gradePoints, facultyIds[0]]
      );
    }

    // Insert Sem 5 published marks and Sem 6 marks for other subjects
    const marksProfiles = [
      { cie: 27, prac: 22, es: 62 }, { cie: 25, prac: 20, es: 58 },
      { cie: 29, prac: 24, es: 65 }, { cie: 22, prac: 18, es: 55 },
      { cie: 28, prac: 23, es: 67 }, { cie: 18, prac: 15, es: 38 },
      { cie: 26, prac: 21, es: 60 }, { cie: 30, prac: 25, es: 70 },
      { cie: 24, prac: 19, es: 56 }, { cie: 21, prac: 17, es: 48 },
    ];

    const sem5Subjects = ['CE501','CE502','CE503','CE504'];
    for (let si = 0; si < studentIds.length; si++) {
      for (const code of sem5Subjects) {
        const subj = subjectsData.find(s => s.code === code);
        const mp = marksProfiles[(si + sem5Subjects.indexOf(code)) % marksProfiles.length];
        const cie = mp.cie;
        const prac = subj.has_practical ? mp.prac : null;
        const es = mp.es;
        const maxTotal = subj.max_cie + (subj.has_practical ? subj.max_practical : 0) + subj.max_end_sem;
        const rawTotal = cie + (prac || 0) + es;
        const normalizedTo100 = Math.round((rawTotal / maxTotal) * 100);
        const { grade, gradePoints } = calculateGrade(normalizedTo100);
        const isBacklog = grade === 'F';

        await client.query(
          `INSERT INTO marks (student_id, subject_id, semester, academic_year, cie_marks, practical_marks, end_sem_marks, total, grade, grade_points, is_backlog, entered_by, status)
           VALUES ($1,$2,5,'2024-25',$3,$4,$5,$6,$7,$8,$9,$10,'published')
           ON CONFLICT (student_id, subject_id, semester, academic_year, attempt_number) DO NOTHING`,
          [studentIds[si], subjectIds[code], cie, prac, es, rawTotal, grade, gradePoints, isBacklog, facultyIds[0]]
        );
      }
    }

    // Result publish status
    await client.query(
      `INSERT INTO result_publish_status (semester, academic_year, department, division, status, published_by, published_at)
       VALUES (5,'2024-25','Computer Engineering','A','published',$1,NOW())
       ON CONFLICT (semester, academic_year, department, division) DO UPDATE SET status='published'`,
      [hodUser.rows[0].id]
    );
    await client.query(
      `INSERT INTO result_publish_status (semester, academic_year, department, division, status)
       VALUES (6,'2025-26','Computer Engineering','A','open')
       ON CONFLICT (semester, academic_year, department, division) DO NOTHING`
    );

    await client.query('COMMIT');
    console.log(`[Seed] Successfully seeded ${studentIds.length} MES Wadia students!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seed };
