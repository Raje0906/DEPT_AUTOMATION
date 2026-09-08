/**
 * Grade calculation service (10-point absolute grading scale)
 * O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0
 */

function calculateGrade(percentageOutOf100) {
  const pct = Math.round(percentageOutOf100 * 100) / 100;
  if (pct >= 90) return { grade: 'O',  gradePoints: 10.0 };
  if (pct >= 80) return { grade: 'A+', gradePoints: 9.0  };
  if (pct >= 70) return { grade: 'A',  gradePoints: 8.0  };
  if (pct >= 60) return { grade: 'B+', gradePoints: 7.0  };
  if (pct >= 55) return { grade: 'B',  gradePoints: 6.0  };
  if (pct >= 50) return { grade: 'C',  gradePoints: 5.0  };
  if (pct >= 40) return { grade: 'P',  gradePoints: 4.0  };
  return { grade: 'F', gradePoints: 0.0 };
}

/**
 * Given raw marks + subject max marks, compute:
 *   total, percentage, grade, gradePoints, isBacklog
 */
function computeMarks(subject, cie, practical, endSem) {
  const maxTotal = subject.max_cie
    + (subject.has_practical ? subject.max_practical : 0)
    + subject.max_end_sem;

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
  const totalCredits = subjectResults.reduce((sum, r) => sum + r.credits, 0);
  const totalPoints  = subjectResults.reduce((sum, r) => sum + r.credits * r.gradePoints, 0);
  if (totalCredits === 0) return 0;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

/**
 * Compute CGPA from array of { sgpa, credits } per semester
 */
function computeCGPA(semesterSGPAs) {
  const totalCredits = semesterSGPAs.reduce((sum, s) => sum + s.totalCredits, 0);
  const weightedSum  = semesterSGPAs.reduce((sum, s) => sum + s.sgpa * s.totalCredits, 0);
  if (totalCredits === 0) return 0;
  return Math.round((weightedSum / totalCredits) * 100) / 100;
}

module.exports = { calculateGrade, computeMarks, computeSGPA, computeCGPA };
