export const ACADEMIC_YEAR_CLASSES = {
  SE: ['SE Comp 1', 'SE Comp 2', 'SE Comp 3', 'SE Comp 4'],
  TE: ['TE Comp 1', 'TE Comp 2', 'TE Comp 3', 'TE Comp 4'],
  BE: ['BE Comp 1', 'BE Comp 2', 'BE Comp 3', 'BE Comp 4'],
};

export const ALL_CLASSES = [
  ...ACADEMIC_YEAR_CLASSES.SE,
  ...ACADEMIC_YEAR_CLASSES.TE,
  ...ACADEMIC_YEAR_CLASSES.BE,
];

export function getClassesForSemester(semester) {
  const sem = parseInt(semester, 10);
  if (sem === 3 || sem === 4) return ACADEMIC_YEAR_CLASSES.SE;
  if (sem === 5 || sem === 6) return ACADEMIC_YEAR_CLASSES.TE;
  if (sem === 7 || sem === 8) return ACADEMIC_YEAR_CLASSES.BE;
  return ALL_CLASSES;
}

export function getYearLabelForSemester(semester) {
  const sem = parseInt(semester, 10);
  if (sem === 3 || sem === 4) return 'SE (Second Year)';
  if (sem === 5 || sem === 6) return 'TE (Third Year)';
  if (sem === 7 || sem === 8) return 'BE (Final Year)';
  return '';
}
