const pool = require('../db/pool');

const seSyllabusData = [
  // ══════════════════════════════════════════════════════════════════════════
  // SEMESTER III (SE Sem 1 - 2024 Pattern, Level 5.0)
  // ══════════════════════════════════════════════════════════════════════════
  {
    code: 'PCC-201-COM',
    name: 'Data Structures',
    course_type: 'Program Core Course',
    semester: 3,
    credits: 3,
    department: 'Computer Engineering',
    th_hours: 3,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-202-COM',
    name: 'Object Oriented programming and Computer Graphics',
    course_type: 'Program Core Course',
    semester: 3,
    credits: 3,
    department: 'Computer Engineering',
    th_hours: 3,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-203-COM',
    name: 'Operating Systems',
    course_type: 'Program Core Course',
    semester: 3,
    credits: 3,
    department: 'Computer Engineering',
    th_hours: 3,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-204-COM',
    name: 'Data Structures Laboratory',
    course_type: 'Program Core Course',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 4,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 50,
    max_pr: 25,
    max_oral: 0,
    max_practical: 25,
    max_total: 75,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'PCC-205-COM',
    name: 'Object Oriented Programming and Computer Graphics Laboratory',
    course_type: 'Program Core Courses',
    semester: 3,
    credits: 1,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 0,
    max_oral: 25,
    max_practical: 25,
    max_total: 50,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'OE-211-COM',
    name: 'Open Elective - I',
    course_type: 'Open Elective',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 15,
    max_end_sem: 35,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 50,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'MDM-221-COM',
    name: 'Digital Electronics and Logic Design',
    course_type: 'Multi disciplinary Minor',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'EEM-231-COM',
    name: 'Entrepreneurship Development',
    course_type: 'Entrepreneurship Management',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 1,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 0,
    max_oral: 0,
    max_practical: 25,
    max_total: 25,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'VEC-232-COM',
    name: 'Universal Human Values and Professional Ethics',
    course_type: 'Value Education Course',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 15,
    max_end_sem: 35,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 50,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'CEP-241-COM',
    name: 'Community Engagement Project',
    course_type: 'Community Engagement Project',
    semester: 3,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 4,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 0,
    max_oral: 25,
    max_practical: 25,
    max_total: 50,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SEMESTER IV (SE Sem 2 - 2024 Pattern, Level 5.0)
  // ══════════════════════════════════════════════════════════════════════════
  {
    code: 'PCC-251-COM',
    name: 'Database Management systems',
    course_type: 'Program Core Course',
    semester: 4,
    credits: 3,
    department: 'Computer Engineering',
    th_hours: 3,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-252-COM',
    name: 'Discrete Mathematics',
    course_type: 'Program Core Course',
    semester: 4,
    credits: 3,
    department: 'Computer Engineering',
    th_hours: 3,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-253-COM',
    name: 'Computer Organization & Microprocessor',
    course_type: 'Program Core Course',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'PCC-254-COM',
    name: 'Database Management Laboratory',
    course_type: 'Program Core Course',
    semester: 4,
    credits: 1,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 25,
    max_oral: 0,
    max_practical: 25,
    max_total: 50,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'PCC-255-COM',
    name: 'Microprocessor Laboratory',
    course_type: 'Program Core Course',
    semester: 4,
    credits: 1,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 0,
    max_pr: 0,
    max_oral: 25,
    max_practical: 25,
    max_total: 25,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'OE-261-COM',
    name: 'Open Elective - II',
    course_type: 'Open Elective',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 15,
    max_end_sem: 35,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 50,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'MDM-271-COM',
    name: 'Internet of Things',
    course_type: 'Multi Disciplinary Minor',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 30,
    max_end_sem: 70,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 100,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  },
  {
    code: 'VSE-281-COM',
    name: 'Web Development',
    course_type: 'Vocational and Skill Enhancement',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 0,
    pr_hours: 4,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 25,
    max_oral: 0,
    max_practical: 25,
    max_total: 50,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'AEC-282-COM',
    name: 'Modern Indian Language (Marathi)',
    course_type: 'Ability Enhancement',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 1,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 50,
    max_pr: 0,
    max_oral: 0,
    max_practical: 50,
    max_total: 50,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'EEM-283-COM',
    name: 'Engineering Product Design',
    course_type: 'Entrepreneurship / Management',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 0,
    tut_hours: 1,
    pr_hours: 2,
    max_cie: 0,
    max_end_sem: 0,
    max_tw: 25,
    max_pr: 0,
    max_oral: 0,
    max_practical: 25,
    max_total: 25,
    has_practical: true,
    subject_type: 'practical',
    pattern: '2024'
  },
  {
    code: 'VEC-284-COM',
    name: 'Environmental Studies',
    course_type: 'Value Education Course',
    semester: 4,
    credits: 2,
    department: 'Computer Engineering',
    th_hours: 2,
    tut_hours: 0,
    pr_hours: 0,
    max_cie: 15,
    max_end_sem: 35,
    max_tw: 0,
    max_pr: 0,
    max_oral: 0,
    max_practical: 0,
    max_total: 50,
    has_practical: false,
    subject_type: 'theory',
    pattern: '2024'
  }
];

async function seedSESyllabus() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Seed SE] Enhancing subjects schema if needed...');

    // Widen code column if necessary and add metadata columns
    await client.query(`
      ALTER TABLE subjects 
        ALTER COLUMN code TYPE VARCHAR(50);
      
      ALTER TABLE subjects
        ADD COLUMN IF NOT EXISTS course_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS th_hours NUMERIC(3,1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tut_hours NUMERIC(3,1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pr_hours NUMERIC(3,1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_tw INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_pr INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_oral INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS max_total INTEGER DEFAULT 100,
        ADD COLUMN IF NOT EXISTS pattern VARCHAR(20) DEFAULT '2024';
    `);

    console.log(`[Seed SE] Upserting ${seSyllabusData.length} subjects for Semester 3 and Semester 4...`);

    for (const sub of seSyllabusData) {
      await client.query(
        `INSERT INTO subjects (
          code, name, course_type, semester, credits, department,
          th_hours, tut_hours, pr_hours,
          max_cie, max_end_sem, max_tw, max_pr, max_oral, max_practical, max_total,
          has_practical, subject_type, pattern
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19
        )
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          course_type = EXCLUDED.course_type,
          semester = EXCLUDED.semester,
          credits = EXCLUDED.credits,
          department = EXCLUDED.department,
          th_hours = EXCLUDED.th_hours,
          tut_hours = EXCLUDED.tut_hours,
          pr_hours = EXCLUDED.pr_hours,
          max_cie = EXCLUDED.max_cie,
          max_end_sem = EXCLUDED.max_end_sem,
          max_tw = EXCLUDED.max_tw,
          max_pr = EXCLUDED.max_pr,
          max_oral = EXCLUDED.max_oral,
          max_practical = EXCLUDED.max_practical,
          max_total = EXCLUDED.max_total,
          has_practical = EXCLUDED.has_practical,
          subject_type = EXCLUDED.subject_type,
          pattern = EXCLUDED.pattern`,
        [
          sub.code, sub.name, sub.course_type, sub.semester, sub.credits, sub.department,
          sub.th_hours, sub.tut_hours, sub.pr_hours,
          sub.max_cie, sub.max_end_sem, sub.max_tw, sub.max_pr, sub.max_oral, sub.max_practical, sub.max_total,
          sub.has_practical, sub.subject_type, sub.pattern
        ]
      );
    }

    await client.query('COMMIT');
    console.log('[Seed SE] Successfully seeded all Semester 3 & 4 subjects (2024 Pattern)!');

    // Summary verification
    const countRes = await client.query(
      `SELECT semester, count(*) as count, sum(credits) as total_credits, sum(max_total) as total_marks 
       FROM subjects 
       WHERE semester IN (3, 4) 
       GROUP BY semester 
       ORDER BY semester`
    );
    console.table(countRes.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed SE] Error seeding SE syllabus:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSESyllabus();
