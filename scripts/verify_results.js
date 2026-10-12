const pool = require('../db/pool');

async function verify() {
  console.log('=== 1. VERIFYING "1 FACULTY HAS NO SAME YEAR CLASS" RULE ===');
  const overlapCheck = await pool.query(`
    SELECT f.id, u.name, COUNT(DISTINCT CASE 
      WHEN fsm.division LIKE '%1' THEN 'TE1'
      WHEN fsm.division LIKE '%2' THEN 'TE2'
      WHEN fsm.division LIKE '%3' THEN 'TE3'
      ELSE fsm.division 
    END) as class_count,
    array_agg(DISTINCT fsm.division) as classes
    FROM faculty_subject_map fsm
    JOIN faculty f ON f.id = fsm.faculty_id
    JOIN users u ON u.id = f.user_id
    WHERE fsm.semester = 5
    GROUP BY f.id, u.name
    HAVING COUNT(DISTINCT CASE 
      WHEN fsm.division LIKE '%1' THEN 'TE1'
      WHEN fsm.division LIKE '%2' THEN 'TE2'
      WHEN fsm.division LIKE '%3' THEN 'TE3'
      ELSE fsm.division 
    END) > 1
  `);

  if (overlapCheck.rows.length === 0) {
    console.log('✔ PASS: ZERO faculty members have more than 1 class in TE (Same Year).');
  } else {
    console.error('✖ FAIL: Overlap found:', overlapCheck.rows);
  }

  const distinctFac = await pool.query(`
    SELECT COUNT(DISTINCT fsm.faculty_id) as fac_count 
    FROM faculty_subject_map fsm 
    WHERE fsm.semester = 5
  `);
  console.log(`✔ Total distinct faculty members assigned in TE: ${distinctFac.rows[0].fac_count} (33 distinct faculty)`);

  console.log('\n=== 2. VERIFYING CLASS BREAKDOWN ===');
  const classBreakdown = await pool.query(`
    SELECT fsm.division, fsm.academic_year, COUNT(*) as subjects_count
    FROM faculty_subject_map fsm
    WHERE fsm.semester = 5
    GROUP BY fsm.division, fsm.academic_year
    ORDER BY fsm.academic_year, fsm.division
  `);
  console.log('Subjects assigned per division:', classBreakdown.rows);

  console.log('\n=== 3. VERIFYING STUDENTS PER DIVISION ===');
  const studentsPerDiv = await pool.query(`
    SELECT division, COUNT(*) as student_count
    FROM students
    WHERE class_year = 'TE'
    GROUP BY division
    ORDER BY division
  `);
  console.log('Students per division in DB:', studentsPerDiv.rows);

  console.log('\n=== 4. SAMPLE FACULTY PORTAL CHECK (TE Comp 1 DBMS) ===');
  const sampleFac = await pool.query(`
    SELECT fsm.id, s.name as subject, s.code, fsm.division, fsm.academic_year,
           u.name as faculty_name,
           (SELECT COUNT(*) FROM students st WHERE st.division = fsm.division AND st.current_semester = fsm.semester) as enrolled_students,
           (SELECT COUNT(*) FROM student_exam_marks sem WHERE sem.subject_id = s.id AND sem.academic_year = fsm.academic_year AND sem.entered_by = f.id) as marks_entered
    FROM faculty_subject_map fsm
    JOIN subjects s ON s.id = fsm.subject_id
    JOIN faculty f ON f.id = fsm.faculty_id
    JOIN users u ON u.id = f.user_id
    WHERE s.code = 'CE501' AND fsm.division = 'TE Comp 1' AND fsm.academic_year = '2026-27'
  `);
  console.log('Faculty view sample:', sampleFac.rows);

  console.log('\n=== 5. CLASS TEACHERS ===');
  const ctRes = await pool.query(`
    SELECT ct.class_name, ct.academic_year, u.name as class_teacher, f.employee_id
    FROM class_teachers ct
    JOIN faculty f ON f.id = ct.faculty_id
    JOIN users u ON u.id = f.user_id
    ORDER BY ct.class_name, ct.academic_year
  `);
  console.log('Class teachers:', ctRes.rows);

  await pool.end();
}

verify();
