/**
 * toppersUtils.js
 * Comprehensive utility functions for Class Toppers parsing, sorting, and grouping.
 */

export const CLASS_YEARS = ['SE', 'TE', 'BE'];
export const DEFAULT_DIVISIONS = ['A', 'B', 'C'];

/**
 * Normalizes and extracts class year ('SE', 'TE', 'BE') and division ('A', 'B', 'C', etc.)
 * Supports multiple input formats:
 * - Explicit class: 'SE', division: 'A'
 * - Combined strings: 'SE I', 'SE-A', 'SE Comp A', 'SE Division B', 'TE III', 'BE 1'
 */
export function parseClassAndDivision(student) {
  const rawClass = (student?.class || student?.className || '').toString().trim();
  const rawDiv = (student?.division || '').toString().trim();

  let year = 'SE';
  const upperClass = rawClass.toUpperCase();

  if (/^BE\b/i.test(upperClass) || /FINAL/i.test(upperClass) || /\bBE\b/i.test(upperClass)) {
    year = 'BE';
  } else if (/^TE\b/i.test(upperClass) || /THIRD/i.test(upperClass) || /\bTE\b/i.test(upperClass)) {
    year = 'TE';
  } else if (/^SE\b/i.test(upperClass) || /SECOND/i.test(upperClass) || /\bSE\b/i.test(upperClass)) {
    year = 'SE';
  }

  let division = '';

  if (rawDiv) {
    // If division is already explicitly provided
    let cleanDiv = rawDiv.replace(/^division\s*/i, '').replace(/^div\s*/i, '').trim().toUpperCase();
    if (cleanDiv === 'I' || cleanDiv === '1') cleanDiv = 'A';
    else if (cleanDiv === 'II' || cleanDiv === '2') cleanDiv = 'B';
    else if (cleanDiv === 'III' || cleanDiv === '3') cleanDiv = 'C';
    else if (cleanDiv === 'IV' || cleanDiv === '4') cleanDiv = 'D';
    division = cleanDiv;
  } else {
    // Extract division from class string
    const romanMatch = upperClass.match(/\b(IV|III|II|I)\b/);
    if (romanMatch) {
      const roman = romanMatch[1];
      if (roman === 'I') division = 'A';
      else if (roman === 'II') division = 'B';
      else if (roman === 'III') division = 'C';
      else if (roman === 'IV') division = 'D';
    } else {
      const divMatch = upperClass.match(/(?:DIV(?:ISION)?|COMP(?:UTER)?)\s*[-:]?\s*([A-Z0-9])/i) ||
                       upperClass.match(/[-_/\s]+([A-D])\b/i) ||
                       upperClass.match(/\b([A-D])\b/i) ||
                       upperClass.match(/\b([1-4])\b/);
      if (divMatch) {
        const val = divMatch[1].toUpperCase();
        if (val === '1') division = 'A';
        else if (val === '2') division = 'B';
        else if (val === '3') division = 'C';
        else if (val === '4') division = 'D';
        else division = val;
      }
    }
  }

  if (!division) {
    division = 'A';
  }

  return { year, division };
}

/**
 * Sorts student toppers according to requirement:
 * 1. Primary sorting value: student's Rank field (ascending: Rank 1, Rank 2, Rank 3...)
 * 2. Fallback if Rank is not provided: CGPA/SGPA descending (highest to lowest, e.g. 9.80, 9.40, 8.90)
 * 3. Secondary tie-breaker: CGPA descending, then alphabetical by name
 */
export function sortToppers(students = []) {
  if (!Array.isArray(students)) return [];

  return [...students].sort((a, b) => {
    const rawRankA = a.rank !== undefined && a.rank !== null && a.rank !== ''
      ? a.rank
      : (a.position !== undefined && a.position !== null && a.position !== '' ? a.position : null);
    const rawRankB = b.rank !== undefined && b.rank !== null && b.rank !== ''
      ? b.rank
      : (b.position !== undefined && b.position !== null && b.position !== '' ? b.position : null);

    const rankA = rawRankA !== null ? parseInt(rawRankA, 10) : null;
    const rankB = rawRankB !== null ? parseInt(rawRankB, 10) : null;

    const hasRankA = rankA !== null && !isNaN(rankA) && rankA > 0;
    const hasRankB = rankB !== null && !isNaN(rankB) && rankB > 0;

    if (hasRankA && hasRankB) {
      if (rankA !== rankB) {
        return rankA - rankB; // Ascending: Rank 1, 2, 3...
      }
    } else if (hasRankA && !hasRankB) {
      return -1; // Ranked student comes before unranked
    } else if (!hasRankA && hasRankB) {
      return 1;
    }

    // Fallback sorting: Highest CGPA → Lowest CGPA
    const cgpaA = parseFloat(a.cgpa);
    const cgpaB = parseFloat(b.cgpa);
    const hasCgpaA = !isNaN(cgpaA);
    const hasCgpaB = !isNaN(cgpaB);

    if (hasCgpaA && hasCgpaB) {
      if (cgpaB !== cgpaA) {
        return cgpaB - cgpaA; // Descending: 9.80, 9.40, 8.90...
      }
    } else if (hasCgpaA && !hasCgpaB) {
      return -1;
    } else if (!hasCgpaA && hasCgpaB) {
      return 1;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Groups students by class year (SE, TE, BE), then by division (Division A, B, C...),
 * and sorts students in each division according to sortToppers().
 */
export function groupToppersByClassAndDivision(students = []) {
  const result = {
    SE: {},
    TE: {},
    BE: {},
  };

  students.forEach(student => {
    if (!student) return;
    const { year, division } = parseClassAndDivision(student);

    if (!result[year]) {
      result[year] = {};
    }

    const divKey = `Division ${division}`;
    if (!result[year][divKey]) {
      result[year][divKey] = [];
    }

    result[year][divKey].push({
      ...student,
      class: year,
      division,
      className: `${year} - Div ${division}`,
    });
  });

  // Sort students in each division
  Object.keys(result).forEach(year => {
    Object.keys(result[year]).forEach(divKey => {
      result[year][divKey] = sortToppers(result[year][divKey]);
    });
  });

  return result;
}

/**
 * Returns human-readable full label for class year.
 */
export function formatClassLabel(year) {
  switch (year) {
    case 'SE': return 'Second Year (SE)';
    case 'TE': return 'Third Year (TE)';
    case 'BE': return 'Final Year (BE)';
    default: return `${year} Year`;
  }
}

export const CLASS_OPTIONS = [
  'SE - Div A', 'SE - Div B', 'SE - Div C',
  'TE - Div A', 'TE - Div B', 'TE - Div C',
  'BE - Div A', 'BE - Div B', 'BE - Div C',
  'SE I', 'SE II', 'SE III',
  'TE I', 'TE II', 'TE III',
  'BE I', 'BE II', 'BE III'
];

export function normalizeToppersData(toppersInput) {
  if (!toppersInput) {
    const emptyClasses = {};
    CLASS_OPTIONS.forEach(c => { emptyClasses[c] = []; });
    return { students: [], classes: emptyClasses };
  }

  let rawStudents = [];
  if (Array.isArray(toppersInput.students)) {
    rawStudents = [...toppersInput.students];
  } else if (toppersInput.classes && typeof toppersInput.classes === 'object') {
    Object.entries(toppersInput.classes).forEach(([cls, list]) => {
      if (Array.isArray(list)) {
        list.forEach(item => {
          rawStudents.push({
            ...item,
            class: item.class || cls,
            className: item.className || item.class || cls,
          });
        });
      }
    });
  }

  const cleanStudents = [];
  const seenIds = new Set();
  rawStudents.forEach((s, idx) => {
    if (!s) return;
    const id = s.id || `student-${idx + 1}-${Date.now()}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const { year, division } = parseClassAndDivision(s);
      const rawRank = s.rank !== undefined && s.rank !== null && s.rank !== ''
        ? s.rank
        : (s.position !== undefined && s.position !== null && s.position !== '' ? s.position : '');
      const parsedRank = rawRank !== '' ? parseInt(rawRank, 10) : '';

      cleanStudents.push({
        id,
        name: s.name || '',
        class: year,
        division,
        className: `${year} - Div ${division}`,
        cgpa: s.cgpa !== undefined && s.cgpa !== null ? String(s.cgpa) : '',
        position: parsedRank,
        rank: parsedRank,
        photo: s.photo || s.photoUrl || null,
        photoUrl: s.photo || s.photoUrl || null,
      });
    }
  });

  const classes = {};
  CLASS_OPTIONS.forEach(c => {
    classes[c] = cleanStudents.filter(s => {
      const formatted = `${s.class} - Div ${s.division}`;
      return s.className === c || s.class === c || formatted === c;
    });
  });

  return {
    students: cleanStudents,
    classes,
  };
}
