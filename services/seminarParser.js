'use strict';

/**
 * seminarParser.js
 * Pure service - no DB calls. Handles:
 *  1. Spreadsheet parsing (parseSpreadsheet)
 *  2. Wide-format row to group with smart column matching & auto-correction (parseGroups)
 *  3. Validation (validateGroups)
 *  4. Sequential guide fill (sequentialFill)
 */

const XLSX = require('xlsx');

// --- Normalisation helpers ---

function normText(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function normPrn(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, '').toUpperCase().trim();
}

function normEmail(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, '').toLowerCase().trim();
}

function normMobile(v) {
  if (v == null) return '';
  return String(v).replace(/[^\d+]/g, '').trim();
}

function isEmpty(v) {
  return v == null || String(v).trim() === '';
}

/**
 * Build column index map by analyzing spreadsheet header names.
 * Supports Google Form exports, custom spreadsheets, and numbered columns.
 */
function buildColumnMap(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return null;

  const map = {
    domainCol: -1,
    students: [
      { name: -1, prn: -1, division: -1, mobile: -1, email: -1, topic1: -1, topic2: -1, topic3: -1 },
      { name: -1, prn: -1, division: -1, mobile: -1, email: -1, topic1: -1, topic2: -1, topic3: -1 },
      { name: -1, prn: -1, division: -1, mobile: -1, email: -1, topic1: -1, topic2: -1, topic3: -1 },
      { name: -1, prn: -1, division: -1, mobile: -1, email: -1, topic1: -1, topic2: -1, topic3: -1 },
    ],
  };

  headers.forEach((hRaw, colIdx) => {
    const h = String(hRaw || '').toLowerCase().trim();
    if (!h) return;

    if (h.includes('domain')) {
      map.domainCol = colIdx;
      return;
    }

    let sIdx = -1;
    if (/student\s*[-_]?\s*1/i.test(h) || /leader/i.test(h) || /(name|prn|div|mob|email)1/i.test(h) || /t[123]a/i.test(h)) {
      sIdx = 0;
    } else if (/student\s*[-_]?\s*2/i.test(h) || /(name|prn|div|mob|email)2/i.test(h) || /t[123]b/i.test(h)) {
      sIdx = 1;
    } else if (/student\s*[-_]?\s*3/i.test(h) || /(name|prn|div|mob|email)3/i.test(h) || /t[123]c/i.test(h)) {
      sIdx = 2;
    } else if (/student\s*[-_]?\s*4/i.test(h) || /(name|prn|div|mob|email)4/i.test(h) || /t[123]d/i.test(h)) {
      sIdx = 3;
    }

    if (sIdx !== -1) {
      const st = map.students[sIdx];
      if (/topic\s*[-_]?\s*1/i.test(h) || /\bt1[a-z]?\b/i.test(h)) st.topic1 = colIdx;
      else if (/topic\s*[-_]?\s*2/i.test(h) || /\bt2[a-z]?\b/i.test(h)) st.topic2 = colIdx;
      else if (/topic\s*[-_]?\s*3/i.test(h) || /\bt3[a-z]?\b/i.test(h)) st.topic3 = colIdx;
      else if (/e[\s\-_]*mail/i.test(h) || /email/i.test(h) || /mail/i.test(h)) st.email = colIdx;
      else if (/prn/i.test(h) || /roll/i.test(h)) st.prn = colIdx;
      else if (/div/i.test(h)) st.division = colIdx;
      else if (/mob/i.test(h) || /phone/i.test(h) || /contact/i.test(h)) st.mobile = colIdx;
      else if (/name/i.test(h)) st.name = colIdx;
    }
  });

  // Verify that at least student 1 name or prn was mapped
  const mappedCount = map.students.reduce((acc, s) => acc + (s.name !== -1 ? 1 : 0) + (s.prn !== -1 ? 1 : 0), 0);
  if (mappedCount === 0) return null;

  return map;
}

/**
 * Intelligent sanitization to ensure:
 * - name contains student's name (not email or PRN)
 * - prn contains student's PRN
 * - email contains valid email format
 * - mobile contains valid contact number
 */
function sanitizeStudent(member) {
  if (!member) return null;
  let { student_name, prn, division, mobile, email, topic1, topic2, topic3 } = member;

  // Swap name & email if email address is in name
  if (student_name && student_name.includes('@') && (!email || !email.includes('@'))) {
    const temp = student_name;
    student_name = email;
    email = temp;
  }

  // Swap name & prn if prn looks like name and name looks like prn
  // Real PRNs almost always contain digits (e.g. F23112008, 2021001, CE101)
  const looksLikePrn = (s) => {
    const p = normPrn(s);
    return /\d/.test(p) && /^[A-Z0-9]{4,20}$/i.test(p);
  };
  const looksLikeName = (s) => {
    const n = normText(s);
    return /[a-zA-Z]/.test(n) && !/\d{3,}/.test(n);
  };

  if (looksLikePrn(student_name) && looksLikeName(prn) && !looksLikePrn(prn)) {
    const temp = student_name;
    student_name = prn;
    prn = temp;
  }

  // Swap division & prn if PRN is in division
  if (looksLikePrn(division) && !looksLikePrn(prn)) {
    const temp = prn;
    prn = division;
    division = temp;
  }

  // If prn contains email
  if (prn && prn.includes('@') && isEmpty(email)) {
    email = prn;
    prn = '';
  }

  const cleanedName = normText(student_name);
  const cleanedPrn  = normPrn(prn);
  const hasName     = !isEmpty(cleanedName);
  const hasPrn      = !isEmpty(cleanedPrn);

  if (!hasName && !hasPrn) return null;

  return {
    ...member,
    student_name: cleanedName,
    prn: cleanedPrn,
    division: normText(division),
    mobile: normMobile(mobile),
    email: normEmail(email),
    topic1: normText(topic1),
    topic2: normText(topic2),
    topic3: normText(topic3),
    _hasName: hasName,
    _hasPrn: hasPrn,
  };
}

const FIELDS_PER_STUDENT = 8;

function parseStudentBlockFallback(row, colOffset, memberIndex) {
  const name  = normText(row[colOffset]);
  const prn   = normPrn(row[colOffset + 1]);
  const div   = normText(row[colOffset + 2]);
  const mob   = normText(row[colOffset + 3]);
  const email = normEmail(row[colOffset + 4]);
  const t1    = normText(row[colOffset + 5]);
  const t2    = normText(row[colOffset + 6]);
  const t3    = normText(row[colOffset + 7]);

  return sanitizeStudent({
    memberIndex,
    student_name: name,
    prn,
    division: div,
    mobile: mob,
    email,
    topic1: t1,
    topic2: t2,
    topic3: t3,
    is_leader: memberIndex === 1,
  });
}

// --- 1. parseSpreadsheet ---

function parseSpreadsheet(buffer, mimetype) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return rows;
}

// --- 2. parseGroups ---

function parseGroups(rows) {
  const groups = [];
  const issues = [];

  if (!Array.isArray(rows) || rows.length < 2) return { groups, issues };

  const headerRow = rows[0];
  const colMap = buildColumnMap(headerRow);

  if (colMap) {
    // Dynamic header-mapped parser
    const domainCol = colMap.domainCol !== -1 ? colMap.domainCol : rows[1].length - 1;

    for (let ri = 1; ri < rows.length; ri++) {
      const row = rows[ri];
      if (row.every(isEmpty)) continue;

      const domain = normText(row[domainCol]);
      const members = [];

      for (let m = 0; m < 4; m++) {
        const stCols = colMap.students[m];
        const raw = {
          memberIndex: m + 1,
          student_name: stCols.name !== -1 ? row[stCols.name] : '',
          prn:          stCols.prn !== -1 ? row[stCols.prn] : '',
          division:     stCols.division !== -1 ? row[stCols.division] : '',
          mobile:       stCols.mobile !== -1 ? row[stCols.mobile] : '',
          email:        stCols.email !== -1 ? row[stCols.email] : '',
          topic1:       stCols.topic1 !== -1 ? row[stCols.topic1] : '',
          topic2:       stCols.topic2 !== -1 ? row[stCols.topic2] : '',
          topic3:       stCols.topic3 !== -1 ? row[stCols.topic3] : '',
          is_leader:    m === 0,
        };

        const cleaned = sanitizeStudent(raw);
        if (cleaned !== null) {
          members.push(cleaned);
        }
      }

      groups.push({
        sourceRowIndex: ri,
        domain,
        members,
        rawRow: row,
      });
    }
  } else {
    // Positional fallback
    const firstData = rows[1];
    const col0 = String(firstData[0] || '').trim();

    const looksLikeTimestamp =
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(col0) ||
      /\d{2}:\d{2}/.test(col0) ||
      (!isNaN(Number(col0)) && Number(col0) > 40000);

    const colShift = looksLikeTimestamp ? 1 : 0;
    const domainCol = colShift + 4 * FIELDS_PER_STUDENT;

    for (let ri = 1; ri < rows.length; ri++) {
      const row = rows[ri];
      if (row.every(isEmpty)) continue;

      const domain = normText(row[domainCol]);
      const members = [];

      for (let m = 0; m < 4; m++) {
        const offset = colShift + m * FIELDS_PER_STUDENT;
        const member = parseStudentBlockFallback(row, offset, m + 1);
        if (member !== null) {
          members.push(member);
        }
      }

      groups.push({
        sourceRowIndex: ri,
        domain,
        members,
        rawRow: row,
      });
    }
  }

  return { groups, issues };
}

// --- 3. validateGroups ---

function validateGroups(groups) {
  const issues = [];
  const prnRegistry = new Map();

  groups.forEach((g, idx) => {
    const groupNo  = idx + 1;
    const rowLabel = `Row ${g.sourceRowIndex + 1}`;

    if (isEmpty(g.domain)) {
      issues.push({
        key: `missing_domain:row${g.sourceRowIndex}`,
        type: 'MISSING_DOMAIN',
        severity: 'error',
        rowIndex: g.sourceRowIndex,
        groupNo,
        field: 'Domain',
        message: `${rowLabel} (Group ${groupNo}): Domain name is missing.`,
      });
    }

    if (g.members.length < 3) {
      issues.push({
        key: `group_too_small:row${g.sourceRowIndex}`,
        type: 'GROUP_SIZE',
        severity: 'error',
        rowIndex: g.sourceRowIndex,
        groupNo,
        field: 'Members',
        message: `${rowLabel} (Group ${groupNo}): Only ${g.members.length} member(s) found - minimum is 3.`,
      });
    }
    if (g.members.length > 4) {
      issues.push({
        key: `group_too_large:row${g.sourceRowIndex}`,
        type: 'GROUP_SIZE',
        severity: 'error',
        rowIndex: g.sourceRowIndex,
        groupNo,
        field: 'Members',
        message: `${rowLabel} (Group ${groupNo}): ${g.members.length} members found - maximum is 4.`,
      });
    }

    const seenPrnsInGroup = new Map();

    g.members.forEach((m) => {
      if (m._hasName && !m._hasPrn) {
        issues.push({
          key: `missing_prn:row${g.sourceRowIndex}:m${m.memberIndex}`,
          type: 'MISSING_FIELD',
          severity: 'error',
          rowIndex: g.sourceRowIndex,
          groupNo,
          field: `Student ${m.memberIndex} PRN`,
          message: `${rowLabel} (Group ${groupNo}), Student ${m.memberIndex} "${m.student_name}": PRN is missing.`,
        });
      }
      if (!m._hasName && m._hasPrn) {
        issues.push({
          key: `missing_name:row${g.sourceRowIndex}:m${m.memberIndex}`,
          type: 'MISSING_FIELD',
          severity: 'error',
          rowIndex: g.sourceRowIndex,
          groupNo,
          field: `Student ${m.memberIndex} Name`,
          message: `${rowLabel} (Group ${groupNo}), Student ${m.memberIndex} PRN "${m.prn}": Name is missing.`,
        });
      }

      if (!m._hasPrn) return;

      if (seenPrnsInGroup.has(m.prn)) {
        issues.push({
          key: `dup_prn_within:row${g.sourceRowIndex}:${m.prn}`,
          type: 'DUPLICATE_PRN_WITHIN',
          severity: 'error',
          rowIndex: g.sourceRowIndex,
          groupNo,
          field: `Student ${m.memberIndex} PRN`,
          message: `${rowLabel} (Group ${groupNo}): PRN "${m.prn}" appears twice in this group (Students ${seenPrnsInGroup.get(m.prn)} and ${m.memberIndex}).`,
        });
      } else {
        seenPrnsInGroup.set(m.prn, m.memberIndex);
      }

      if (prnRegistry.has(m.prn)) {
        const prev = prnRegistry.get(m.prn);
        issues.push({
          key: `dup_prn_across:${m.prn}`,
          type: 'DUPLICATE_PRN_ACROSS',
          severity: 'error',
          rowIndex: g.sourceRowIndex,
          groupNo,
          field: `Student ${m.memberIndex} PRN`,
          message: `PRN "${m.prn}" appears in both Group ${prev.groupNo} (Row ${prev.rowIndex + 1}) and Group ${groupNo} (${rowLabel}).`,
        });
      } else {
        prnRegistry.set(m.prn, { groupNo, rowIndex: g.sourceRowIndex, memberIndex: m.memberIndex });
      }
    });
  });

  return { issues };
}

// --- 4. sequentialFill ---

function sequentialFill(groups, guides) {
  const assignments = [];
  const unassigned  = [];

  const slots = [];
  for (const guide of guides) {
    for (let q = 0; q < (guide.quota || 0); q++) {
      slots.push({
        seminarGuideId: guide.id,
        facultyId: guide.faculty_id || null,
        guideName: guide.faculty_name || guide.guide_name || null,
      });
    }
  }

  groups.forEach((g, idx) => {
    if (idx < slots.length) {
      assignments.push({
        groupIndex: idx,
        guideId: slots[idx].seminarGuideId,
        seminarGuideId: slots[idx].seminarGuideId,
        facultyId: slots[idx].facultyId,
        guideName: slots[idx].guideName,
      });
    } else {
      unassigned.push(idx);
    }
  });

  return { assignments, unassigned };
}

module.exports = {
  parseSpreadsheet,
  parseGroups,
  validateGroups,
  sequentialFill,
  normPrn,
  normText,
  normEmail,
  normMobile,
  buildColumnMap,
  sanitizeStudent,
};
