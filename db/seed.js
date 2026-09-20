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

    await client.query(`
      TRUNCATE project_score_releases, project_evaluation_scores, project_evaluations,
               project_panel_assignments, project_guide_requests, project_group_members,
               project_groups, project_stage_criteria, project_evaluation_stages
      RESTART IDENTITY CASCADE;
    `);

    // 1. Evaluation Stages
    const stage1 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Internal Presentation', '2025-26', 1, '2025-08-01', '2025-08-15', 50, 'AVERAGE', true)
      RETURNING id
    `);
    const stage1Id = stage1.rows[0].id;

    const stage2 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Mid-Term Review (Phase I)', '2025-26', 2, '2025-10-15', '2025-10-30', 50, 'AVERAGE', true)
      RETURNING id
    `);
    const stage2Id = stage2.rows[0].id;

    const stage3 = await client.query(`
      INSERT INTO project_evaluation_stages (name, academic_year, sequence_order, scheduled_date_from, scheduled_date_to, max_marks_total, aggregation_rule, is_active)
      VALUES ('Final Presentation & Viva (Phase II)', '2025-26', 3, '2026-04-10', '2026-04-25', 50, 'AVERAGE', true)
      RETURNING id
    `);
    const stage3Id = stage3.rows[0].id;

    // 2. Stage Criteria (Attendance, Presentation, Subject Understanding, Publication, Viva - 10 marks each = Total 50)
    async function seedCriteriaForStage(stageId) {
      const c1 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Attendance', 10, 1) RETURNING id`, [stageId]);
      const c2 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Presentation', 10, 2) RETURNING id`, [stageId]);
      const c3 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Subject Understanding', 10, 3) RETURNING id`, [stageId]);
      const c4 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Publication', 10, 4) RETURNING id`, [stageId]);
      const c5 = await client.query(`INSERT INTO project_stage_criteria (stage_id, name, max_marks, display_order) VALUES ($1, 'Viva', 10, 5) RETURNING id`, [stageId]);
      return [c1.rows[0].id, c2.rows[0].id, c3.rows[0].id, c4.rows[0].id, c5.rows[0].id];
    }

    const [s1c1, s1c2, s1c3, s1c4, s1c5] = await seedCriteriaForStage(stage1Id);
    const [s2c1, s2c2, s2c3, s2c4, s2c5] = await seedCriteriaForStage(stage2Id);
    const [s3c1, s3c2, s3c3, s3c4, s3c5] = await seedCriteriaForStage(stage3Id);

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

    // Group 4: Legal Doc Summarization (Unassigned Guide - Pending HOD Assignment)
    const grp4User = await client.query(`SELECT user_id FROM students WHERE id=$1`, [studentIds[9]]);
    const g4 = await client.query(`
      INSERT INTO project_groups (group_code, academic_year, batch, title, domain, abstract, status, guide_id, created_by)
      VALUES ('GRP-2026-04', '2025-26', 'BE-CE-A', 'Cross-lingual Indian Legal Document Summarization using LLMs', 'NLP & Generative AI', 'Fine-tuning LLaMA 3 for Marathi & Hindi high court judgment summarization.', 'DRAFT', NULL, $1)
      RETURNING id
    `, [grp4User.rows[0].user_id]);
    const g4Id = g4.rows[0].id;
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A010', true)`, [g4Id, studentIds[9]]);
    await client.query(`INSERT INTO project_group_members (group_id, student_id, roll_no, is_leader) VALUES ($1, $2, 'CE6A011', false)`, [g4Id, studentIds[10]]);

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
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval1Id, s1c1]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval1Id, s1c2]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval1Id, s1c3]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval1Id, s1c4]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval1Id, s1c5]);

    // G1 Stage 1 - Evaluator Arjun Sharma
    const eval2 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Very impressive AI model pruning approach for edge board deployment.')
      RETURNING id
    `, [paG1S1_P2.rows[0].id]);
    const eval2Id = eval2.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval2Id, s1c1]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval2Id, s1c2]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval2Id, s1c3]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval2Id, s1c4]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval2Id, s1c5]);

    // G1 Stage 2 - Evaluator Sunita Patil (Draft)
    const eval3 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, overall_remarks)
      VALUES ($1, 'DRAFT', 'Initial test bench demo observed, waiting for hardware benchmark numbers.')
      RETURNING id
    `, [paG1S2_P1.rows[0].id]);
    const eval3Id = eval3.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval3Id, s2c1]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval3Id, s2c2]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval3Id, s2c3]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 7, '')`, [eval3Id, s2c4]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval3Id, s2c5]);

    // G2 Stage 1 - Evaluator Rajan Mehta
    const eval4 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Sound cryptographic foundation, good understanding of zk-SNARK constraints.')
      RETURNING id
    `, [paG2S1_P1.rows[0].id]);
    const eval4Id = eval4.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval4Id, s1c1]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval4Id, s1c2]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval4Id, s1c3]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval4Id, s1c4]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval4Id, s1c5]);

    // G3 Stage 1 - Evaluator Rajan Mehta
    const eval5 = await client.query(`
      INSERT INTO project_evaluations (panel_assignment_id, status, submitted_at, overall_remarks)
      VALUES ($1, 'SUBMITTED', NOW(), 'Outstanding architecture proposal and clear benchmark plan.')
      RETURNING id
    `, [paG3S1_P1.rows[0].id]);
    const eval5Id = eval5.rows[0].id;
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval5Id, s1c1]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval5Id, s1c2]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval5Id, s1c3]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 8, '')`, [eval5Id, s1c4]);
    await client.query(`INSERT INTO project_evaluation_scores (evaluation_id, criterion_id, marks_awarded, remark) VALUES ($1, $2, 9, '')`, [eval5Id, s1c5]);

    // 6. Release Scores for Stage 1 (Synopsis Review)
    await client.query(`
      INSERT INTO project_score_releases (stage_id, released_by)
      VALUES ($1, $2)
    `, [stage1Id, hodUser.rows[0].id]);

    // ─── SEMINAR MODULE SEEDING ───────────────────────────────────────────────
    console.log('[Seed] Seeding Seminar Module (Coordinator, Sessions, Guides, Groups, Marks)...');

    await client.query(`
      TRUNCATE seminar_marks, seminar_group_members, seminar_groups,
               seminar_guides, seminar_issue_overrides, seminar_uploads,
               seminar_coordinator_history, seminar_sessions
      RESTART IDENTITY CASCADE;
    `);

    // 1. Appoint Prof. Sunita Patil (facultyIds[1]) as Seminar Coordinator
    await client.query('UPDATE faculty SET is_seminar_coordinator = (id = $1)', [facultyIds[1]]);
    
    // Fetch faculty user_ids for audit history
    const coordUserRes = await client.query('SELECT user_id, name FROM faculty f JOIN users u ON f.user_id = u.id WHERE f.id = $1', [facultyIds[1]]);
    const coordUserId = coordUserRes.rows[0].user_id;

    // Seed appointment history
    await client.query(`
      INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes, created_at)
      VALUES ($1, 'Prof. Rajan Mehta', 'APPOINTED', $2, 'Appointed for AY 2024-25 term', NOW() - INTERVAL '6 months')
    `, [facultyIds[0], hodUser.rows[0].id]);

    await client.query(`
      INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes, created_at)
      VALUES ($1, 'Prof. Rajan Mehta', 'REVOKED', $2, 'Term concluded; designated Prof. Sunita Patil for AY 2025-26', NOW() - INTERVAL '1 month')
    `, [facultyIds[0], hodUser.rows[0].id]);

    await client.query(`
      INSERT INTO seminar_coordinator_history (faculty_id, faculty_name, action, performed_by, notes, created_at)
      VALUES ($1, 'Prof. Sunita Patil', 'APPOINTED', $2, 'Appointed as Seminar Coordinator for AY 2025-26', NOW() - INTERVAL '1 month')
    `, [facultyIds[1], hodUser.rows[0].id]);

    // 2. Seminar Session
    const sessRes = await client.query(`
      INSERT INTO seminar_sessions (name, academic_year, batch, status, is_locked, created_by, created_at)
      VALUES ('TE Seminar 2025–26', '2025-26', 'TE-2025', 'ASSIGNMENT', false, $1, NOW() - INTERVAL '20 days')
      RETURNING id
    `, [hodUser.rows[0].id]);
    const sessionId = sessRes.rows[0].id;

    // 3. Seminar Guides Roster
    const sg1 = await client.query(`INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order) VALUES ($1, $2, 'Prof. Rajan Mehta', 'Associate Professor', 4, 1) RETURNING id`, [sessionId, facultyIds[0]]);
    const sg2 = await client.query(`INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order) VALUES ($1, $2, 'Prof. Sunita Patil', 'Associate Professor', 4, 2) RETURNING id`, [sessionId, facultyIds[1]]);
    const sg3 = await client.query(`INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order) VALUES ($1, $2, 'Prof. Arjun Sharma', 'Assistant Professor', 4, 3) RETURNING id`, [sessionId, facultyIds[2]]);
    const sg4 = await client.query(`INSERT INTO seminar_guides (session_id, faculty_id, guide_name, designation, quota, display_order) VALUES ($1, $2, 'Prof. Priya Kulkarni', 'Assistant Professor', 4, 4) RETURNING id`, [sessionId, facultyIds[3]]);

    // Helper: get student user_id and PRN
    const studentUsers = [];
    for (let i = 0; i < 15 && i < studentIds.length; i++) {
      const su = await client.query('SELECT s.id as student_id, s.user_id, s.roll_no, s.enrollment_no, u.name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = $1', [studentIds[i]]);
      studentUsers.push(su.rows[0]);
    }

    // 4. Sample Seminar Groups (covering all lifecycle states)

    // ─── Group 1: Approved & Evaluated (Guide: Prof. Rajan Mehta) ─────────────
    const g1Res = await client.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, seminar_guide_id, guide_name, leader_user_id, status, assigned_by, assigned_at, approved_by, approved_at, submitted_at)
      VALUES ($1, 1, 'Artificial Intelligence & Machine Learning', $2, $3, 'Prof. Rajan Mehta', $4, 'APPROVED', $5, NOW() - INTERVAL '10 days', $6, NOW() - INTERVAL '9 days', NOW() - INTERVAL '15 days')
      RETURNING id
    `, [sessionId, facultyIds[0], sg1.rows[0].id, studentUsers[0].user_id, coordUserId, hodUser.rows[0].id]);
    const semG1Id = g1Res.rows[0].id;

    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 1, $2, $3, 'A', '9822012345', $4, 'Deep Learning for Autonomous Drone Obstacle Detection', 'Transformer-based Vision Systems', 'Real-time Object Detection', true)`, [semG1Id, studentUsers[0].name, studentUsers[0].enrollment_no, studentUsers[0].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 2, $2, $3, 'A', '9822012346', $4, 'Edge AI Inference on Embedded Devices', 'Model Quantization Techniques', 'FPGA Acceleration for Neural Nets', false)`, [semG1Id, studentUsers[1].name, studentUsers[1].enrollment_no, studentUsers[1].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 3, $2, $3, 'A', '9822012347', $4, 'Real-time Object Classification using YOLOv8', 'Zero-shot Learning for Aerial Imagery', 'Semantic Segmentation in Robotics', false)`, [semG1Id, studentUsers[2].name, studentUsers[2].enrollment_no, studentUsers[2].email]);

    // Group 1 Individual Marks (5 criteria: attendance, presentation, subject_understanding, publication, viva)
    await client.query(`
      INSERT INTO seminar_marks (session_id, group_id, student_id, prn, attendance_marks, presentation_marks, subject_understanding_marks, publication_marks, viva_marks, total_marks, max_marks, status, entered_by, submitted_by, submitted_at, remarks)
      VALUES ($1, $2, $3, $4, 9.5, 9.0, 9.5, 8.5, 9.5, 46.0, 50, 'SUBMITTED', $5, $5, NOW() - INTERVAL '3 days', 'Excellent presentation delivery and comprehensive literature survey.')
    `, [sessionId, semG1Id, studentUsers[0].student_id, studentUsers[0].enrollment_no, facultyIds[0]]);

    await client.query(`
      INSERT INTO seminar_marks (session_id, group_id, student_id, prn, attendance_marks, presentation_marks, subject_understanding_marks, publication_marks, viva_marks, total_marks, max_marks, status, entered_by, submitted_by, submitted_at, remarks)
      VALUES ($1, $2, $3, $4, 9.0, 8.5, 8.5, 8.0, 8.5, 42.5, 50, 'SUBMITTED', $5, $5, NOW() - INTERVAL '3 days', 'Strong technical defense and thorough analysis.')
    `, [sessionId, semG1Id, studentUsers[1].student_id, studentUsers[1].enrollment_no, facultyIds[0]]);

    await client.query(`
      INSERT INTO seminar_marks (session_id, group_id, student_id, prn, attendance_marks, presentation_marks, subject_understanding_marks, publication_marks, viva_marks, total_marks, max_marks, status, entered_by, submitted_by, submitted_at, remarks)
      VALUES ($1, $2, $3, $4, 10.0, 9.5, 9.0, 9.0, 9.5, 47.0, 50, 'SUBMITTED', $5, $5, NOW() - INTERVAL '3 days', 'Outstanding technical depth, flawless answers in Q&A session.')
    `, [sessionId, semG1Id, studentUsers[2].student_id, studentUsers[2].enrollment_no, facultyIds[0]]);

    // ─── Group 2: Approved, Pending Evaluation (Guide: Prof. Sunita Patil) ─────
    const g2Res = await client.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, seminar_guide_id, guide_name, leader_user_id, status, assigned_by, assigned_at, approved_by, approved_at, submitted_at)
      VALUES ($1, 2, 'Blockchain & Decentralized Systems', $2, $3, 'Prof. Sunita Patil', $4, 'APPROVED', $5, NOW() - INTERVAL '8 days', $6, NOW() - INTERVAL '7 days', NOW() - INTERVAL '14 days')
      RETURNING id
    `, [sessionId, facultyIds[1], sg2.rows[0].id, studentUsers[3].user_id, coordUserId, hodUser.rows[0].id]);
    const semG2Id = g2Res.rows[0].id;

    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 1, $2, $3, 'A', '9822012348', $4, 'Zero-Knowledge Proofs for Healthcare Privacy', 'zk-SNARKs on Layer 2', 'Decentralized Key Management', true)`, [semG2Id, studentUsers[3].name, studentUsers[3].enrollment_no, studentUsers[3].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 2, $2, $3, 'A', '9822012349', $4, 'Layer-2 Optimistic Rollups on Ethereum', 'State Channel Protocols', 'Cross-chain Interoperability Bridges', false)`, [semG2Id, studentUsers[4].name, studentUsers[4].enrollment_no, studentUsers[4].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 3, $2, $3, 'A', '9822012350', $4, 'Decentralized Identity Verification using DIDs', 'Verifiable Credentials in Education', 'SBTs for Academic Records', false)`, [semG2Id, studentUsers[5].name, studentUsers[5].enrollment_no, studentUsers[5].email]);

    // ─── Group 3: Awaiting HOD Approval (Proposed Guide: Prof. Arjun Sharma) ──
    const g3Res = await client.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, guide_id, seminar_guide_id, guide_name, leader_user_id, status, assigned_by, assigned_at, submitted_at)
      VALUES ($1, 3, 'Cloud Computing & Distributed Systems', $2, $3, 'Prof. Arjun Sharma', $4, 'AWAITING_HOD_APPROVAL', $5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 days')
      RETURNING id
    `, [sessionId, facultyIds[2], sg3.rows[0].id, studentUsers[6].user_id, coordUserId]);
    const semG3Id = g3Res.rows[0].id;

    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 1, $2, $3, 'A', '9822012351', $4, 'Serverless Microservice Orchestration with Event-Driven Architecture', 'KEDA Autoscaling', 'Distributed Tracing with OpenTelemetry', true)`, [semG3Id, studentUsers[6].name, studentUsers[6].enrollment_no, studentUsers[6].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 2, $2, $3, 'A', '9822012352', $4, 'Kubernetes Dynamic Resource Scheduling using Reinforcement Learning', 'Pod Disruption Budgets', 'Service Mesh Security with Istio', false)`, [semG3Id, studentUsers[7].name, studentUsers[7].enrollment_no, studentUsers[7].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 3, $2, $3, 'A', '9822012353', $4, 'Predictive Autoscaling in Hybrid Cloud Microservices', 'Cost Optimization in AWS/GCP', 'eBPF for Cloud Observability', false)`, [semG3Id, studentUsers[8].name, studentUsers[8].enrollment_no, studentUsers[8].email]);

    // ─── Group 4: Pending Guide Assignment (Fresh Student Registration) ───────
    const g4Res = await client.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, leader_user_id, status, submitted_at)
      VALUES ($1, 4, 'Cybersecurity & Network Defense', $2, 'PENDING_GUIDE_ASSIGNMENT', NOW() - INTERVAL '3 days')
      RETURNING id
    `, [sessionId, studentUsers[9].user_id]);
    const semG4Id = g4Res.rows[0].id;

    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 1, $2, $3, 'A', '9822012354', $4, 'Automated Threat Hunting using Graph Neural Networks', 'SIEM Integration with AI', 'MITRE ATT&CK Mapping', true)`, [semG4Id, studentUsers[9].name, studentUsers[9].enrollment_no, studentUsers[9].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 2, $2, $3, 'A', '9822012355', $4, 'Zero Trust Architecture Implementation in Enterprise Clouds', 'Micro-segmentation Strategies', 'Software-Defined Perimeter Protocols', false)`, [semG4Id, studentUsers[10].name, studentUsers[10].enrollment_no, studentUsers[10].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 3, $2, $3, 'A', '9822012356', $4, 'Post-Quantum Cryptographic Key Exchange Mechanisms', 'Kyber Algorithm Optimization', 'Quantum Resistant TLS Handshakes', false)`, [semG4Id, studentUsers[11].name, studentUsers[11].enrollment_no, studentUsers[11].email]);

    // ─── Group 5: Rejected by HOD with Remark (Returned to Coordinator) ───────
    const g5Res = await client.query(`
      INSERT INTO seminar_groups (session_id, group_no, domain, leader_user_id, status, hod_remarks, submitted_at)
      VALUES ($1, 5, 'Internet of Things & Embedded AI', $2, 'PENDING_GUIDE_ASSIGNMENT', 'Please reassign to faculty with specialized Embedded Systems / IoT laboratory experience.', NOW() - INTERVAL '4 days')
      RETURNING id
    `, [sessionId, studentUsers[12].user_id]);
    const semG5Id = g5Res.rows[0].id;

    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 1, $2, $3, 'A', '9822012357', $4, 'TinyML for Predictive Equipment Maintenance on Microcontrollers', 'BLE 5.3 Sensor Meshes', 'Ultra-low Power Edge Inference', true)`, [semG5Id, studentUsers[12].name, studentUsers[12].enrollment_no, studentUsers[12].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 2, $2, $3, 'A', '9822012358', $4, 'LoRaWAN Long-Range Mesh Protocols for Precision Agriculture', 'Gateway Optimization', 'End-to-end AES-128 Encryption in LoRaWAN', false)`, [semG5Id, studentUsers[13].name, studentUsers[13].enrollment_no, studentUsers[13].email]);
    await client.query(`INSERT INTO seminar_group_members (group_id, member_index, student_name, prn, division, mobile, email, topic1, topic2, topic3, is_leader) VALUES ($1, 3, $2, $3, 'A', '9822012359', $4, 'Secure OTA Firmware Update Protocols for Industrial IoT', 'Rollback Protection', 'Hardware Root of Trust Integration', false)`, [semG5Id, studentUsers[14].name, studentUsers[14].enrollment_no, studentUsers[14].email]);

    await client.query('COMMIT');
    console.log(`[Seed] Successfully seeded ${studentIds.length} MES Wadia students and full Seminar module dataset!`);
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
