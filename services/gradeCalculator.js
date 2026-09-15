/**
 * Grade calculation service (SPPU 10-point absolute grading scale)
 * O  (Outstanding):   10 grade points (80–100 marks)
 * A+ (Excellent):      9 grade points (70–79 marks)
 * A  (Very Good):      8 grade points (60–69 marks)
 * B+ (Good):           7 grade points (55–59 marks)
 * B  (Above Average):  6 grade points (50–54 marks)
 * C  (Average):        5 grade points (45–49 marks)
 * P  (Pass):           4 grade points (40–44 marks)
 * F  (Fail):           0 grade points (0–39 marks)
 */

function calculateGrade(percentageOutOf100) {
  const pct = Math.round(percentageOutOf100 * 100) / 100;
  if (pct >= 80) return { grade: 'O',  gradePoints: 10.0 };
  if (pct >= 70) return { grade: 'A+', gradePoints: 9.0  };
  if (pct >= 60) return { grade: 'A',  gradePoints: 8.0  };
  if (pct >= 55) return { grade: 'B+', gradePoints: 7.0  };
  if (pct >= 50) return { grade: 'B',  gradePoints: 6.0  };
  if (pct >= 45) return { grade: 'C',  gradePoints: 5.0  };
  if (pct >= 40) return { grade: 'P',  gradePoints: 4.0  };
  return { grade: 'F', gradePoints: 0.0 };
}

/**
 * Compute Term Work Total from attendance, assignments, and timely submission
 */
function computeTermWorkTotal(attendance = 0, assignment1 = 0, assignment2 = 0, timelySubmission = 0) {
  const total = (Number(attendance) || 0) +
                (Number(assignment1) || 0) +
                (Number(assignment2) || 0) +
                (Number(timelySubmission) || 0);
  return Math.round(total * 100) / 100;
}

/**
 * Subject Rollup Calculator for the modular 8-exam-type system.
 * Unit Test 1, Unit Test 2, Mock Theory, and Mock Practical have 0 impact on final result.
 * Final Result:
 *  - Theory: Insem (30) + Endsem (70) = 100
 *  - Practical / Lab: Term Work (25) + Final Practical (25) = 50
 *  - Seminar: Term Work (50) = 50
 */
function computeSubjectRollup(subject, examRows = []) {
  const examMap = {};
  for (const row of examRows) {
    examMap[row.exam_code] = {
      marks: row.marks_obtained !== null && row.marks_obtained !== undefined ? Number(row.marks_obtained) : null,
      isAbsent: Boolean(row.is_absent),
      status: row.status,
    };
  }

  const isSeminar = subject.code.includes('SEM') || subject.name.toLowerCase().includes('seminar');
  const isPractical = subject.subject_type === 'practical' || Boolean(subject.has_practical);

  let totalObtained = 0;
  let maxMarks = 100;
  let isComplete = false;
  let hasAnyMark = false;

  if (isSeminar) {
    maxMarks = 50;
    const tw = examMap['term_work'];
    if (tw && tw.marks !== null) {
      hasAnyMark = true;
      totalObtained = tw.marks;
      isComplete = true;
    }
  } else if (isPractical) {
    maxMarks = 50;
    const tw = examMap['term_work'];
    const pr = examMap['final_practical'];
    if (tw && tw.marks !== null) hasAnyMark = true;
    if (pr && pr.marks !== null) hasAnyMark = true;

    if (tw && tw.marks !== null && pr && pr.marks !== null) {
      isComplete = true;
      totalObtained = (Number(tw.marks) || 0) + (Number(pr.marks) || 0);
    } else {
      totalObtained = (Number(tw?.marks) || 0) + (Number(pr?.marks) || 0);
    }
  } else {
    // Theory subject
    maxMarks = 100;
    const insem = examMap['insem'];
    const endsem = examMap['endsem'];
    if (insem && insem.marks !== null) hasAnyMark = true;
    if (endsem && endsem.marks !== null) hasAnyMark = true;

    if (insem && insem.marks !== null && endsem && endsem.marks !== null) {
      isComplete = true;
      totalObtained = (Number(insem.marks) || 0) + (Number(endsem.marks) || 0);
    } else {
      totalObtained = (Number(insem?.marks) || 0) + (Number(endsem?.marks) || 0);
    }
  }

  const percentage = (totalObtained / maxMarks) * 100;
  const { grade, gradePoints } = calculateGrade(percentage);

  return {
    subjectId: subject.id,
    subject_id: subject.id,
    subjectName: subject.name,
    subject_name: subject.name,
    subjectCode: subject.code,
    subject_code: subject.code,
    credits: Number(subject.credits) || 0,
    subjectType: isSeminar ? 'seminar' : (isPractical ? 'practical' : 'theory'),
    subject_type: isSeminar ? 'seminar' : (isPractical ? 'practical' : 'theory'),
    maxMarks,
    max_marks: maxMarks,
    totalObtained: hasAnyMark ? totalObtained : null,
    total: hasAnyMark ? totalObtained : null,
    percentage: hasAnyMark ? Math.round(percentage * 100) / 100 : null,
    grade: hasAnyMark && isComplete ? grade : null,
    gradePoints: hasAnyMark && isComplete ? gradePoints : null,
    grade_points: hasAnyMark && isComplete ? gradePoints : null,
    earnedCredits: (hasAnyMark && isComplete && grade !== 'F') ? (Number(subject.credits) || 0) : 0,
    earned_credits: (hasAnyMark && isComplete && grade !== 'F') ? (Number(subject.credits) || 0) : 0,
    creditPoints: (hasAnyMark && isComplete && grade !== 'F') ? Math.round((Number(subject.credits) || 0) * (gradePoints || 0)) : 0,
    credit_points: (hasAnyMark && isComplete && grade !== 'F') ? Math.round((Number(subject.credits) || 0) * (gradePoints || 0)) : 0,
    isBacklog: hasAnyMark && isComplete ? grade === 'F' : false,
    is_backlog: hasAnyMark && isComplete ? grade === 'F' : false,
    status: (hasAnyMark && isComplete) ? (grade === 'F' ? 'backlog' : 'published') : 'draft',
    result: !isComplete ? 'PENDING' : (grade === 'F' ? 'FAIL' : 'PASS'),
    isComplete,
    hasAnyMark,
    // Detailed breakdown per exam type
    exams: {
      unit_test_1:     examMap['unit_test_1']?.marks ?? null,
      unit_test_2:     examMap['unit_test_2']?.marks ?? null,
      mock_theory:     examMap['mock_theory']?.marks ?? null,
      mock_practical:  examMap['mock_practical']?.marks ?? null,
      insem:           examMap['insem']?.marks ?? null,
      endsem:          examMap['endsem']?.marks ?? null,
      term_work:       examMap['term_work']?.marks ?? null,
      final_practical: examMap['final_practical']?.marks ?? null,
    }
  };
}

/**
 * Legacy computeMarks function for backward compatibility
 */
function computeMarks(subject, cie, practical, endSem) {
  const maxTotal = (subject.max_cie || 30)
    + (subject.has_practical ? (subject.max_practical || 25) : 0)
    + (subject.max_end_sem || 70);

  const rawTotal = (Number(cie) || 0)
    + (subject.has_practical ? (Number(practical) || 0) : 0)
    + (Number(endSem) || 0);

  const percentage = (rawTotal / maxTotal) * 100;
  const { grade, gradePoints } = calculateGrade(percentage);

  return {
    total: rawTotal,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    gradePoints,
    isBacklog: grade === 'F',
  };
}

/**
 * Compute SGPA for a semester from an array of { credits, gradePoints }
 */
function computeSGPA(subjectResults) {
  const validSubjects = subjectResults.filter(r => r.gradePoints !== null && r.credits > 0);
  const totalCredits = validSubjects.reduce((sum, r) => sum + r.credits, 0);
  const totalPoints  = validSubjects.reduce((sum, r) => sum + r.credits * r.gradePoints, 0);
  if (totalCredits === 0) return 0;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

/**
 * Compute CGPA from array of { sgpa, totalCredits } per semester
 */
function computeCGPA(semesterSGPAs) {
  const totalCredits = semesterSGPAs.reduce((sum, s) => sum + s.totalCredits, 0);
  const weightedSum  = semesterSGPAs.reduce((sum, s) => sum + s.sgpa * s.totalCredits, 0);
  if (totalCredits === 0) return 0;
  return Math.round((weightedSum / totalCredits) * 100) / 100;
}

module.exports = {
  calculateGrade,
  computeTermWorkTotal,
  computeSubjectRollup,
  computeMarks,
  computeSGPA,
  computeCGPA
};
