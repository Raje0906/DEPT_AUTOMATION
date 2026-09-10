'use strict';

/**
 * seminarParser.js
 * Pure service - no DB calls. Handles:
 *  1. Spreadsheet parsing  (parseSpreadsheet)
 *  2. Wide-format row to group  (parseGroups)
 *  3. Validation  (validateGroups)
 *  4. Sequential guide fill  (sequentialFill)
 *
 * Column layout expected (0-indexed):
 *  0: Timestamp
 *  1..8:   Student 1 - Name, PRN, Division, Mobile, Email, Topic1, Topic2, Topic3
 *  9..16:  Student 2 - same 8 fields
 *  17..24: Student 3 - same 8 fields
 *  25..32: Student 4 - same 8 fields
 *  33:     Domain Name
 *
 * Auto-detects if col 0 is a timestamp (shifts student blocks accordingly).
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

function isEmpty(v) {
  return v == null || String(v).trim() === '';
}

const FIELDS_PER_STUDENT = 8;

function parseStudentBlock(row, colOffset, memberIndex) {
  const name  = normText(row[colOffset]);
  const prn   = normPrn(row[colOffset + 1]);
  const div   = normText(row[colOffset + 2]);
  const mob   = normText(row[colOffset + 3]);
  const email = normText(row[colOffset + 4]).toLowerCase();
  const t1    = normText(row[colOffset + 5]);
  const t2    = normText(row[colOffset + 6]);
  const t3    = normText(row[colOffset + 7]);

  const hasName = !isEmpty(name);
  const hasPrn  = !isEmpty(prn);

  if (!hasName && !hasPrn) return null;

  return {
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
    _hasName: hasName,
    _hasPrn: hasPrn,
  };
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

  if (rows.length < 2) return { groups, issues };

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
      const member = parseStudentBlock(row, offset, m + 1);
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
    for (let q = 0; q < guide.quota; q++) {
      slots.push({ guideId: guide.id, facultyId: guide.faculty_id });
    }
  }

  groups.forEach((g, idx) => {
    if (idx < slots.length) {
      assignments.push({ groupIndex: idx, guideId: slots[idx].guideId, facultyId: slots[idx].facultyId });
    } else {
      unassigned.push(idx);
    }
  });

  return { assignments, unassigned };
}

module.exports = { parseSpreadsheet, parseGroups, validateGroups, sequentialFill, normPrn, normText };
