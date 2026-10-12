/**
 * Magazine authorization utilities.
 * Strictly restricts magazine creation to Dr. (Mrs.) S. S. Raskar (SSR).
 */

export function isAuthorizedMagazineCreator(user) {
  if (!user) return false;
  const isMatchId = user.id === 10;
  const isMatchEmail = typeof user.email === 'string' && user.email.toLowerCase() === 'ssr@meswadiacoe.edu';
  const isMatchEmp = typeof user.employee_id === 'string' && user.employee_id.toUpperCase() === 'SSR';
  return isMatchId || isMatchEmail || isMatchEmp;
}
