/**
 * Feedback coordinator authorization utilities.
 * Strictly restricts form creation, publication, editing, and configuration
 * to Chanchal Vakte Ma'am (Ms. C. Y. Vakte, employee ID: CYV).
 * HOD can also view oversight and reports.
 */

export function isAuthorizedFeedbackCoordinator(user) {
  if (!user) return false;
  const isMatchId = user.id === 280 || user.faculty_id === 40;
  const isMatchEmail = typeof user.email === 'string' && user.email.toLowerCase() === 'cyv@meswadiacoe.edu';
  const isMatchEmp = typeof user.employee_id === 'string' && user.employee_id.toUpperCase() === 'CYV';
  const isMatchName = typeof user.name === 'string' && (user.name.includes('Vakte') || user.name.includes('Chanchal'));
  const isHod = user.role === 'hod';
  return isMatchId || isMatchEmail || isMatchEmp || isMatchName || isHod;
}

export function isStrictFeedbackCreator(user) {
  if (!user) return false;
  const isMatchId = user.id === 280 || user.faculty_id === 40;
  const isMatchEmail = typeof user.email === 'string' && user.email.toLowerCase() === 'cyv@meswadiacoe.edu';
  const isMatchEmp = typeof user.employee_id === 'string' && user.employee_id.toUpperCase() === 'CYV';
  const isMatchName = typeof user.name === 'string' && (user.name.includes('Vakte') || user.name.includes('Chanchal'));
  return isMatchId || isMatchEmail || isMatchEmp || isMatchName;
}
