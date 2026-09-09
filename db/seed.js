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

    // ─── FACULTY (10 Default Teachers) ─────────────────────────────────────────
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

    // ─── BE PROJECT EVALUATION SEEDING ────────────────────────────────────────
    console.log('[Seed] Seeding BE Project Evaluation stages, criteria, and groups...');

    // 1. Evaluation Stages
    const stage1 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Synopsis Review', '2025-26', 1, '2025-08-01', '2025-08-15', 100, 'AVERAGE', true)
      RETURNING id
    `);
    const stage1Id = stage1.rows[0].id;

    const stage2 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Mid-Term Review (Phase I)', '2025-26', 2, '2025-10-15', '2025-10-30', 100, 'AVERAGE', true)
      RETURNING id
    `);
    const stage2Id = stage2.rows[0].id;

    const stage3 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Final Presentation & Viva (Phase II)', '2025-26', 3, '2026-04-10', '2026-04-25', 100, 'AVERAGE', true)
      RETURNING id
    `);
    const stage3Id = stage3.rows[0].id;

    // 2. Stage Criteria
    // Stage 1 Criteria
    const s1c1 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Problem Statement & Objectives', 25, 1) RETURNING id`, [stage1Id]);
    const s1c2 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Literature Review & Scope', 25, 2) RETURNING id`, [stage1Id]);
    const s1c3 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Proposed Methodology', 30, 3) RETURNING id`, [stage1Id]);
    const s1c4 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Presentation & Viva', 20, 4) RETURNING id`, [stage1Id]);

    // Stage 2 Criteria
    const s2c1 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'System Architecture & Design', 30, 1) RETURNING id`, [stage2Id]);
    const s2c2 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Module Implementation Progress', 30, 2) RETURNING id`, [stage2Id]);
    const s2c3 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Toolchain & Test Bench Setup', 20, 3) RETURNING id`, [stage2Id]);
    const s2c4 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Viva & Q&A', 20, 4) RETURNING id`, [stage2Id]);

    // Stage 3 Criteria
    await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Full Prototype & Working Demo', 35, 1)`, [stage3Id]);
    await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Code Quality & Performance', 25, 2)`, [stage3Id]);
    await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Final Project Report / Paper', 20, 3)`, [stage3Id]);
    await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Comprehensive Viva', 20, 4)`, [stage3Id]);

    // 3. Project Groups
    // Group 1: Autonomous Drone Navigation (Guide: Rajan Mehta - facultyIds[0])
    const grp1User = await client.query(`SELECT user_id FROM students WHERE id=$1`, [studentIds[0]]);
    const g1 = await client.query(`
      INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
      VALUES ('GRP-2026-01', '2025-26', 'BE-CE-A', 'Autonomous Drone Navigation using Edge AI and Computer Vision', 'AI / Edge Computing', 'Real-time obstacle avoidance and path planning using Jetson Nano and MobileNetV3.', 'ACTIVE', $1, $2)
      RETURNING id
    `, [facultyIds[0], grp1User.rows[0].user_id]);
    const g1Id = g1.rows[0].id;
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A001', true)`, [g1Id, studentIds[0]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A002', false)`, [g1Id, studentIds[1]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A003', false)`, [g1Id, studentIds[2]]);

    // Guide request for G1 (approved)
    await client.query(`
      INSERT INTO project_guide_requests (group_id, requested_guide_id, status, decided_at, decided_by, remarks)
      VALUES ($1, $2, 'APPROVED', NOW(), $3, 'Approved. Strong technical proposal.')
    `, [g1Id, facultyIds[0], facultyIds[0]]);

    // Group 2: ZK Proof Identity (Guide: Sunita Patil - facultyIds[1])
    const grp2User = await client.query(`SELECT user_id FROM students WHERE id=$1`, [studentIds[3]]);
    const g2 = await client.query(`
      INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
      VALUES ('GRP-2026-02', '2025-26', 'BE-CE-A', 'Zero-Knowledge Proof Identity Verification on Decentralized Ledgers', 'Blockchain & Cryptography', 'Privacy-preserving SSI architecture using zk-SNARKs and Ethereum smart contracts.', 'ACTIVE', $1, $2)
      RETURNING id
    `, [facultyIds[1], grp2User.rows[0].user_id]);
    const g2Id = g2.rows[0].id;
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A004', true)`, [g2Id, studentIds[3]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A005', false)`, [g2Id, studentIds[4]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A006', false)`, [g2Id, studentIds[5]]);

    await client.query(`
      INSERT INTO project_guide_requests (group_id, requested_guide_id, status, decided_at, decided_by, remarks)
      VALUES ($1, $2, 'APPROVED', NOW(), $3, 'Approved guide request.')
    `, [g2Id, facultyIds[1], facultyIds[1]]);

    // Group 3: K8s Autoscaling (Guide: Arjun Sharma - facultyIds[2])
    const grp3User = await client.query(`SELECT user_id FROM students WHERE id=$1`, [studentIds[6]]);
    const g3 = await client.query(`
      INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
      VALUES ('GRP-2026-03', '2025-26', 'BE-CE-A', 'Multi-Tenant Kubernetes Autoscaling via Predictive Traffic Loaders', 'Cloud & Distributed Systems', 'LSTM-driven predictive autoscaler for microservice clusters in hybrid cloud.', 'ACTIVE', $1, $2)
      RETURNING id
    `, [facultyIds[2], grp3User.rows[0].user_id]);
    const g3Id = g3.rows[0].id;
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A007', true)`, [g3Id, studentIds[6]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A008', false)`, [g3Id, studentIds[7]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A009', false)`, [g3Id, studentIds[8]]);

    // Group 4: Legal Doc Summarization (Pending Guide Request to Rajan Mehta)
    const grp4User = await client.query(`SELECT user_id FROM students WHERE id=$1`, [studentIds[9]]);
    const g4 = await client.query(`
      INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
      VALUES ('GRP-2026-04', '2025-26', 'BE-CE-A', 'Cross-lingual Indian Legal Document Summarization using LLMs', 'NLP & Generative AI', 'Fine-tuning LLaMA 3 for Marathi & Hindi high court judgment summarization.', 'PENDING_GUIDE_APPROVAL', NULL, $1)
      RETURNING id
    `, [grp4User.rows[0].user_id]);
    const g4Id = g4.rows[0].id;
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A010', true)`, [g4Id, studentIds[9]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A011', false)`, [g4Id, studentIds[10]]);

    await client.query(`
      INSERT INTO project_guide_requests (group_id, requested_guide_id, status)
      VALUES ($1, $2, 'PENDING')
    `, [g4Id, facultyIds[0]]);

    // 4. Panel Assignments (Respecting Conflict of Interest: Guide cannot evaluate own group!)
    // For G1 (Guide = Rajan Mehta/facultyIds[0]), Panelists = Sunita Patil (facultyIds[1]) & Arjun Sharma (facultyIds[2])
    const paG1S1_P1 = await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id
    `, [stage1Id, g1Id, facultyIds[1], hodUser.rows[0].id]);
    const paG1S1_P2 = await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id
    `, [stage1Id, g1Id, facultyIds[2], hodUser.rows[0].id]);

    const paG1S2_P1 = await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'ASSIGNED') RETURNING id
    `, [stage2Id, g1Id, facultyIds[1], hodUser.rows[0].id]);

    // For G2 (Guide = Sunita Patil/facultyIds[1]), Panelists = Rajan Mehta & Arjun Sharma
    const paG2S1_P1 = await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id
    `, [stage1Id, g2Id, facultyIds[0], hodUser.rows[0].id]);

    // For G3 (Guide = Arjun Sharma/facultyIds[2]), Panelists = Rajan Mehta & Sunita Patil
    const paG3S1_P1 = await client.query(`
      INSERT INTO project_panel_assignments (stage_id, group_id, panel_member_id, assigned_by, status)
      VALUES ($1, $2, $3, $4, 'COMPLETED') RETURNING id
    `, [stage1Id, g3Id, facultyIds[0], hodUser.rows[0].id]);

    // 5. Evaluations & Criteria Scores
    // G1 Stage 1 - Evaluator Sunita Patil
    const eval1 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Excellent problem definition and clear hardware design specifications.')
      RETURNING id
    `, [paG1S1_P1.rows[0].id]);
    const eval1Id = eval1.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 23, 'Clear objectives')`, [eval1Id, s1c1.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 22, 'Comprehensive survey')`, [eval1Id, s1c2.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 26, 'Solid architecture')`, [eval1Id, s1c3.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 18, 'Good viva performance')`, [eval1Id, s1c4.rows[0].id]);

    // G1 Stage 1 - Evaluator Arjun Sharma
    const eval2 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Very impressive AI model pruning approach for edge board deployment.')
      RETURNING id
    `, [paG1S1_P2.rows[0].id]);
    const eval2Id = eval2.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 24, 'Well stated')`, [eval2Id, s1c1.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 23, 'Good references')`, [eval2Id, s1c2.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 27, 'Strong methodology')`, [eval2Id, s1c3.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 19, 'Confident defense')`, [eval2Id, s1c4.rows[0].id]);

    // G1 Stage 2 - Evaluator Sunita Patil (Draft)
    const eval3 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, overall_remarks)
      VALUES ($1, 'DRAFT', 'Initial test bench demo observed, waiting for hardware benchmark numbers.')
      RETURNING id
    `, [paG1S2_P1.rows[0].id]);
    const eval3Id = eval3.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 27, 'Clean modular design')`, [eval3Id, s2c1.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 25, 'Pipeline 70% complete')`, [eval3Id, s2c2.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 17, 'Jetson board configured')`, [eval3Id, s2c3.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 17, 'Satisfactory Q&A')`, [eval3Id, s2c4.rows[0].id]);

    // G2 Stage 1 - Evaluator Rajan Mehta
    const eval4 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Sound cryptographic foundation, good understanding of zk-SNARK constraints.')
      RETURNING id
    `, [paG2S1_P1.rows[0].id]);
    const eval4Id = eval4.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 22, 'Realistic problem statement')`, [eval4Id, s1c1.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 21, 'Thorough lit survey')`, [eval4Id, s1c2.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 24, 'Circuit design solid')`, [eval4Id, s1c3.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 17, 'Clear slides')`, [eval4Id, s1c4.rows[0].id]);

    // G3 Stage 1 - Evaluator Rajan Mehta
    const eval5 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Outstanding architecture proposal and clear benchmark plan.')
      RETURNING id
    `, [paG3S1_P1.rows[0].id]);
    const eval5Id = eval5.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 24, 'High industry relevance')`, [eval5Id, s1c1.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 24, 'Thorough baseline comparison')`, [eval5Id, s1c2.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 28, 'Excellent LSTM model choice')`, [eval5Id, s1c3.rows[0].id]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 18, 'Great presentation')`, [eval5Id, s1c4.rows[0].id]);

    // 6. Release Scores for Stage 1 (Synopsis Review)
    await client.query(`
      INSERT INTO project_score_releases (stage_id, released_by)
      VALUES ($1, $2)
    `, [stage1Id, hodUser.rows[0].id]);

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

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[Seed] Seeding completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err);
      process.exit(1);
    });
}
