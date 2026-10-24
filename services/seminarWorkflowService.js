'use strict';

/**
 * seminarWorkflowService.js
 * 
 * Implements the 4-step "Import responses and assign guides" workflow service:
 *  Step 1: Upload validation (magic bytes, MIME, 5MB limit, reject .xlsm / macros, memory parse)
 *  Step 2: Header auto-detection & fuzzy column mapping (up to 6 members, leader email, timestamp)
 *  Step 3: Group building, data cleaning (PRN ^F\d{8}$, mobile 10 digits, email lowercase @,
 *          topics stripped of numbering/domains, canonical domains), issue detection (1..7)
 *  Step 4: Guide suggestion algorithm (balanced load + domain expertise tags)
 *  Output: 4-sheet formatted Excel with CSV/formula injection prevention.
 */

const XLSX = require('xlsx');

// Canonical domains
const CANONICAL_DOMAINS = [
  'Artificial Intelligence / Machine Learning (AI/ML)',
  'Data Science & Analytics',
  'Cybersecurity & Information Assurance',
  'Cloud Computing & DevOps',
  'Internet of Things (IoT) & Embedded Systems',
  'Full Stack Web Development',
  'Mobile Application Development',
  'Blockchain & Distributed Systems',
  'Computer Vision & Image Processing',
  'Natural Language Processing (NLP)',
  'Robotics & Automation',
  'AR/VR & Game Development',
];

// Clean text / sanitize helpers
function sanitizeFormula(val) {
  if (val == null) return '';
  const s = String(val).trim();
  if (/^[=+\-@]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

function normText(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function normPrn(v) {
  if (v == null) return '';
  const cleaned = String(v).replace(/[\s\u00A0\u200B]+/g, '').toUpperCase().trim();
  if (cleaned === '.' || cleaned === '..' || cleaned === '-' || cleaned === 'NA' || cleaned === 'N/A') {
    return '';
  }
  return cleaned;
}

function isValidPrn(prn) {
  return /^F\d{8}$/.test(prn);
}

function normEmail(v) {
  if (v == null) return '';
  return String(v).replace(/[\s\u00A0]+/g, '').toLowerCase().trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normMobile(v) {
  if (v == null) return '';
  // digits only
  let digits = String(v).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

function isValidMobile(mobile) {
  return /^\d{10}$/.test(mobile);
}

function normDivision(v) {
  if (v == null) return '';
  const s = String(v).toUpperCase().replace(/\s+/g, '').trim();
  if (/^(TE)?[-_]?1$/i.test(s) || s === '1' || s === 'A') return 'TE1';
  if (/^(TE)?[-_]?2$/i.test(s) || s === '2' || s === 'B') return 'TE2';
  if (/^(TE)?[-_]?3$/i.test(s) || s === '3' || s === 'C') return 'TE3';
  if (/^TE[123]$/i.test(s)) return s;
  return s;
}

function cleanTopic(v) {
  if (v == null) return '';
  let s = String(v).trim();
  if (s === '.' || s === '-' || s === '..' || s === 'NA' || s === 'N/A') return '';
  // strip leading "1.", "1 -", "1)", "Topic 1:", etc.
  s = s.replace(/^(?:Topic\s*[123]\s*[:\-.]?\s*|[123]\s*[:.)\-]\s*)/i, '').trim();
  // strip trailing "Domain: ..." or "Domain - ..."
  s = s.replace(/[\s\-,;]+Domain\s*[:\-].*$/i, '').trim();
  return s;
}

function normalizeDomain(raw) {
  if (!raw || !String(raw).trim()) return { canonical: 'General Computing', isKnown: false };
  const s = String(raw).trim().toLowerCase();

  if (/ai|artificial intelligence|ml|machine learning|deep learning|neural/i.test(s)) {
    return { canonical: 'Artificial Intelligence / Machine Learning (AI/ML)', isKnown: true };
  }
  if (/data science|analytics|big data|data engineering|bi\b/i.test(s)) {
    return { canonical: 'Data Science & Analytics', isKnown: true };
  }
  if (/cyber|security|infosec|network security|ethical hack|crypt/i.test(s)) {
    return { canonical: 'Cybersecurity & Information Assurance', isKnown: true };
  }
  if (/cloud|devops|aws|azure|gcp|docker|kubernetes/i.test(s)) {
    return { canonical: 'Cloud Computing & DevOps', isKnown: true };
  }
  if (/iot|embedded|internet of things|arduino|raspberry|sensor/i.test(s)) {
    return { canonical: 'Internet of Things (IoT) & Embedded Systems', isKnown: true };
  }
  if (/web|full stack|mern|react|frontend|backend|django|spring/i.test(s)) {
    return { canonical: 'Full Stack Web Development', isKnown: true };
  }
  if (/app\b|mobile|android|ios|flutter|react native/i.test(s)) {
    return { canonical: 'Mobile Application Development', isKnown: true };
  }
  if (/blockchain|crypto|solidity|smart contract|web3/i.test(s)) {
    return { canonical: 'Blockchain & Distributed Systems', isKnown: true };
  }
  if (/computer vision|vision|image process|opencv/i.test(s)) {
    return { canonical: 'Computer Vision & Image Processing', isKnown: true };
  }
  if (/nlp|natural language|llm|chatgpt|bert/i.test(s)) {
    return { canonical: 'Natural Language Processing (NLP)', isKnown: true };
  }
  if (/robot|automation|ros\b|drone/i.test(s)) {
    return { canonical: 'Robotics & Automation', isKnown: true };
  }
  if (/game|vr\b|ar\b|virtual reality|augmented reality|unity|unreal/i.test(s)) {
    return { canonical: 'AR/VR & Game Development', isKnown: true };
  }

  // Check matching existing canonical strings directly
  const directMatch = CANONICAL_DOMAINS.find(cd => cd.toLowerCase().includes(s) || s.includes(cd.toLowerCase()));
  if (directMatch) {
    return { canonical: directMatch, isKnown: true };
  }

  return { canonical: normText(raw), isKnown: false };
}

// ─── Step 1: Upload Validation ────────────────────────────────────────────────
function validateAndParseFile(buffer, originalname, size) {
  if (!buffer || buffer.length === 0) {
    throw new Error('File is empty.');
  }
  if (size > 5 * 1024 * 1024 || buffer.length > 5 * 1024 * 1024) {
    throw new Error('File exceeds the 5 MB size limit.');
  }

  const ext = (originalname || '').toLowerCase().split('.').pop();
  if (!['xlsx', 'csv'].includes(ext)) {
    throw new Error('Only .xlsx or .csv files are supported. Macro-enabled (.xlsm) and other formats are rejected.');
  }

  // Check file signatures
  if (ext === 'xlsx') {
    // XLSX is a ZIP container: standard signature is PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      throw new Error('Could not read this file: Invalid file signature. Please export it from Google Forms as .xlsx and try again.');
    }

    // Inspect buffer for macro files (.xlsm or vbaProject.bin)
    const bufStr = buffer.toString('binary');
    if (bufStr.includes('vbaProject.bin') || bufStr.includes('macroEnabled')) {
      throw new Error('Macro-enabled workbooks (.xlsm) containing VBA projects are rejected for security reasons.');
    }
  }

  // Parse in memory
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  } catch (err) {
    throw new Error(`Could not read this file: ${err.message}. Export it from Google Forms as .xlsx and try again.`);
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('Workbook contains no sheets.');
  }

  // Sheet stats
  const sheetStats = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    return { name, rowCount };
  });

  // Pick default sheet: prefer "Form Responses 1" or sheet with most rows
  let defaultSheet = sheetStats.find(s => /form\s*responses\s*1/i.test(s.name))?.name;
  if (!defaultSheet) {
    const sorted = [...sheetStats].sort((a, b) => b.rowCount - a.rowCount);
    defaultSheet = sorted[0]?.name || wb.SheetNames[0];
  }

  return { wb, sheetStats, defaultSheet };
}

function getSheetPreviewAndRows(wb, sheetName, maxPreview = 5) {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found.`);
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (rawRows.length === 0) {
    return { rows: [], previewRows: [], totalRows: 0 };
  }

  const previewRows = rawRows.slice(0, maxPreview);
  return { rows: rawRows, previewRows, totalRows: rawRows.length };
}

// ─── Step 2: Header Auto-Detection & Fuzzy Column Mapping ─────────────────────
function detectHeaderRow(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return 0;

  let bestIdx = 0;
  let maxScore = -1;

  // Search first 15 rows for header row
  const limit = Math.min(rawRows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i] || [];
    let textCells = 0;
    let keywordMatches = 0;
    let totalPopulated = 0;

    for (const cell of row) {
      if (cell != null && String(cell).trim() !== '') {
        totalPopulated++;
        const s = String(cell).toLowerCase().trim();
        if (isNaN(Number(s)) && s.length > 1) {
          textCells++;
        }
        if (/student|prn|topic|name|domain|email|timestamp|division|mobile|guide/i.test(s)) {
          keywordMatches++;
        }
      }
    }

    if (totalPopulated > 0) {
      const score = (textCells * 1.5) + (keywordMatches * 3);
      if (score > maxScore && (textCells / totalPopulated >= 0.5 || keywordMatches >= 2)) {
        maxScore = score;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}

/**
 * Fuzzy score between header string and search patterns
 */
function fuzzyScore(headerText, patterns) {
  const h = String(headerText || '').toLowerCase().replace(/[\s\-_.:/()]+/g, ' ').trim();
  let score = 0;
  for (const p of patterns) {
    if (typeof p === 'string') {
      const target = p.toLowerCase();
      if (h === target) score = Math.max(score, 100);
      else if (h.startsWith(target) || h.endsWith(target)) score = Math.max(score, 85);
      else if (h.includes(target)) score = Math.max(score, 70);
    } else if (p instanceof RegExp) {
      if (p.test(h)) score = Math.max(score, 90);
    }
  }
  return score;
}

/**
 * Detect max number of student members represented in headers (up to 6)
 */
function detectMaxMembersFromHeaders(headers) {
  let maxMember = 4; // default minimum baseline
  headers.forEach(h => {
    const str = String(h || '');
    const m = str.match(/student\s*[-_]?\s*([1-6])\b/i) ||
              str.match(/member\s*[-_]?\s*([1-6])\b/i) ||
              str.match(/\b([1-6])(?:st|nd|rd|th)?\s+student\b/i) ||
              str.match(/t[123]([a-f])\b/i);
    if (m) {
      let num = parseInt(m[1], 10);
      if (isNaN(num) && m[1]) {
        // letter a..f -> 1..6
        num = m[1].toLowerCase().charCodeAt(0) - 96;
      }
      if (num >= 1 && num <= 6) {
        if (num > maxMember) maxMember = num;
      }
    }
  });
  return Math.min(Math.max(maxMember, 3), 6);
}

/**
 * Auto-maps columns by fuzzy matching.
 * Returns { mapping, unmappedColumns, missingFields, detectedMembersCount }
 */
function autoMapColumns(headers, savedTemplateMapping = null) {
  const memberCount = detectMaxMembersFromHeaders(headers);

  // Field descriptors
  const fieldDefs = [
    { key: 'timestamp', label: 'Timestamp', required: false, patterns: ['timestamp', 'date', 'submission time'] },
    { key: 'leader_email', label: 'Leader Email / Submitter Email', required: false, patterns: ['email address', 'username', 'submitter email', 'leader email', /^email$/i] },
    { key: 'domain', label: 'Project / Seminar Domain', required: false, patterns: ['domain', 'area of interest', 'specialization', 'technology stack'] },
    { key: 'guide_preference', label: 'Guide Preference (Optional)', required: false, patterns: ['guide preference', 'preferred guide', 'guide name', 'guide'] },
  ];

  for (let m = 1; m <= memberCount; m++) {
    const mLabel = m === 1 ? 'Student 1 (Leader)' : `Student ${m}`;
    fieldDefs.push(
      { key: `m${m}_name`, label: `${mLabel} - Full Name`, required: m === 1, member: m, patterns: [
        new RegExp(`(?:name\\s*of\\s*student|student\\s*name|name).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}\\s*name`, 'i'),
        m === 1 ? 'name of group leader' : null,
        m === 1 ? 'leader name' : null,
      ].filter(Boolean) },
      { key: `m${m}_prn`, label: `${mLabel} - College PRN`, required: m === 1, member: m, patterns: [
        new RegExp(`(?:prn|college\\s*prn|roll\\s*no).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}\\s*prn`, 'i'),
      ] },
      { key: `m${m}_division`, label: `${mLabel} - Division`, required: false, member: m, patterns: [
        new RegExp(`(?:div|division|class).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}\\s*div`, 'i'),
      ] },
      { key: `m${m}_mobile`, label: `${mLabel} - Mobile Number`, required: false, member: m, patterns: [
        new RegExp(`(?:mob|mobile|phone|contact|whatsapp).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}\\s*mob`, 'i'),
      ] },
      { key: `m${m}_email`, label: `${mLabel} - Email`, required: false, member: m, patterns: [
        new RegExp(`(?:email|mail).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}\\s*email`, 'i'),
      ] },
      { key: `m${m}_topic1`, label: `${mLabel} - Topic 1 (Primary)`, required: false, member: m, patterns: [
        new RegExp(`(?:topic\\s*1|topic\\s*[-_]?1|t1).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}.*?topic\\s*1`, 'i'),
        m === 1 ? 't1a' : m === 2 ? 't1b' : m === 3 ? 't1c' : m === 4 ? 't1d' : null,
      ].filter(Boolean) },
      { key: `m${m}_topic2`, label: `${mLabel} - Topic 2`, required: false, member: m, patterns: [
        new RegExp(`(?:topic\\s*2|topic\\s*[-_]?2|t2).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}.*?topic\\s*2`, 'i'),
        m === 1 ? 't2a' : m === 2 ? 't2b' : m === 3 ? 't2c' : m === 4 ? 't2d' : null,
      ].filter(Boolean) },
      { key: `m${m}_topic3`, label: `${mLabel} - Topic 3`, required: false, member: m, patterns: [
        new RegExp(`(?:topic\\s*3|topic\\s*[-_]?3|t3).*?${m}\\b`, 'i'),
        new RegExp(`student\\s*[-_]?\\s*${m}.*?topic\\s*3`, 'i'),
        m === 1 ? 't3a' : m === 2 ? 't3b' : m === 3 ? 't3c' : m === 4 ? 't3d' : null,
      ].filter(Boolean) }
    );
  }

  const assignedCols = new Set();
  const mapping = {};

  // If a saved template mapping is provided, try applying it first
  if (savedTemplateMapping && typeof savedTemplateMapping === 'object') {
    Object.keys(savedTemplateMapping).forEach(fieldKey => {
      const colName = savedTemplateMapping[fieldKey];
      if (colName) {
        const foundIdx = headers.findIndex(h => String(h || '').trim().toLowerCase() === String(colName).trim().toLowerCase());
        if (foundIdx !== -1 && !assignedCols.has(foundIdx)) {
          mapping[fieldKey] = {
            colIndex: foundIdx,
            colName: headers[foundIdx],
            confidence: 'High (Template)',
            confidenceScore: 100,
          };
          assignedCols.add(foundIdx);
        }
      }
    });
  }

  // Next, run auto-detection for unmapped fields
  fieldDefs.forEach(field => {
    if (mapping[field.key]) return; // already mapped via template

    let bestColIdx = -1;
    let bestScore = 0;

    headers.forEach((headerText, colIdx) => {
      if (assignedCols.has(colIdx)) return;
      const score = fuzzyScore(headerText, field.patterns);
      if (score > bestScore) {
        bestScore = score;
        bestColIdx = colIdx;
      }
    });

    if (bestScore >= 50 && bestColIdx !== -1) {
      let confidence = 'Low';
      if (bestScore >= 85) confidence = 'High';
      else if (bestScore >= 65) confidence = 'Medium';

      mapping[field.key] = {
        colIndex: bestColIdx,
        colName: headers[bestColIdx],
        confidence,
        confidenceScore: bestScore,
      };
      assignedCols.add(bestColIdx);
    } else {
      mapping[field.key] = {
        colIndex: -1,
        colName: '',
        confidence: 'None',
        confidenceScore: 0,
      };
    }
  });

  // Calculate unmapped columns
  const unmappedColumns = [];
  headers.forEach((h, colIdx) => {
    if (!assignedCols.has(colIdx) && String(h || '').trim() !== '') {
      unmappedColumns.push({ colIndex: colIdx, colName: h });
    }
  });

  // Calculate required missing fields
  const missingRequired = fieldDefs.filter(f => f.required && (mapping[f.key]?.colIndex === -1));

  return {
    fieldDefs,
    mapping,
    unmappedColumns,
    missingRequired,
    memberCount,
  };
}

// ─── Step 3: Review, Data Cleaning & Issue Detection ──────────────────────────
/**
 * Builds groups from rows and applies cleaning & issue detection rules 1..7.
 */
function buildAndCleanGroups(dataRows, headerRowIdx, mapping, options = {}) {
  const { existingSessionGroups = [], startingGroupNo = 1, memberCount = 4 } = options;

  const rows = dataRows.slice(headerRowIdx + 1);
  const groups = [];
  const issues = [];
  const skippedRows = [];

  // Index existing students in session for cross-group duplicate check (Issue 4)
  const existingPrnMap = new Map();
  existingSessionGroups.forEach(g => {
    (g.members || []).forEach(m => {
      if (m.prn) existingPrnMap.set(normPrn(m.prn), { groupNo: g.group_no, studentName: m.name || m.student_name });
    });
  });

  // Track occurrences within this file
  const prnOccurrences = new Map(); // prn -> Array<{ groupIndex, memberIndex, name, rawRow }>
  const leaderEmailOccurrences = new Map(); // email -> Array<groupIndex>

  let nextGroupNo = startingGroupNo;

  rows.forEach((row, rIdx) => {
    // Check if row is entirely blank
    const isRowBlank = !row || row.every(c => c == null || String(c).trim() === '');
    if (isRowBlank) {
      skippedRows.push({ rowIndex: headerRowIdx + 1 + rIdx + 1, reason: 'Blank row' });
      return;
    }

    // Extract fields
    const timestamp = mapping.timestamp?.colIndex >= 0 ? normText(row[mapping.timestamp.colIndex]) : '';
    const leaderEmail = mapping.leader_email?.colIndex >= 0 ? normEmail(row[mapping.leader_email.colIndex]) : '';
    const domainRaw = mapping.domain?.colIndex >= 0 ? normText(row[mapping.domain.colIndex]) : '';
    const guidePref = mapping.guide_preference?.colIndex >= 0 ? normText(row[mapping.guide_preference.colIndex]) : '';

    const { canonical: domainCanonical, isKnown: isDomainKnown } = normalizeDomain(domainRaw);

    // Extract members
    const members = [];
    for (let m = 1; m <= memberCount; m++) {
      const nameKey = `m${m}_name`;
      const prnKey = `m${m}_prn`;
      const divKey = `m${m}_division`;
      const mobKey = `m${m}_mobile`;
      const emKey = `m${m}_email`;
      const t1Key = `m${m}_topic1`;
      const t2Key = `m${m}_topic2`;
      const t3Key = `m${m}_topic3`;

      const rawName = mapping[nameKey]?.colIndex >= 0 ? row[mapping[nameKey].colIndex] : '';
      const rawPrn = mapping[prnKey]?.colIndex >= 0 ? row[mapping[prnKey].colIndex] : '';
      const rawDiv = mapping[divKey]?.colIndex >= 0 ? row[mapping[divKey].colIndex] : '';
      const rawMob = mapping[mobKey]?.colIndex >= 0 ? row[mapping[mobKey].colIndex] : '';
      const rawEm = mapping[emKey]?.colIndex >= 0 ? row[mapping[emKey].colIndex] : '';
      const rawT1 = mapping[t1Key]?.colIndex >= 0 ? row[mapping[t1Key].colIndex] : '';
      const rawT2 = mapping[t2Key]?.colIndex >= 0 ? row[mapping[t2Key].colIndex] : '';
      const rawT3 = mapping[t3Key]?.colIndex >= 0 ? row[mapping[t3Key].colIndex] : '';

      const name = normText(rawName);
      const prn = normPrn(rawPrn);
      const division = normDivision(rawDiv);
      const mobile = normMobile(rawMob);
      const email = normEmail(rawEm);
      const topic1 = cleanTopic(rawT1);
      const topic2 = cleanTopic(rawT2);
      const topic3 = cleanTopic(rawT3);

      // A student exists if name or prn is present
      if (name || prn) {
        let prnStatus = 'valid';
        let prnWarning = null;

        if (!prn) {
          prnStatus = 'missing';
          prnWarning = 'PRN is missing';
        } else if (!isValidPrn(prn)) {
          prnStatus = 'invalid';
          prnWarning = `PRN "${prn}" does not match standard pattern (e.g. F23112001)`;
        }

        const memberObj = {
          member_index: m,
          is_leader: m === 1,
          name: name || `Student ${m} (Unnamed)`,
          prn: prn || '',
          prn_status: prnStatus,
          prn_warning: prnWarning,
          division: division || 'TE1',
          mobile: mobile || '',
          email: email || (m === 1 ? leaderEmail : ''),
          topic1: topic1 || '',
          topic2: topic2 || '',
          topic3: topic3 || '',
          raw_name: rawName,
          raw_prn: rawPrn,
        };

        // Validate mobile
        if (memberObj.mobile && !isValidMobile(memberObj.mobile)) {
          memberObj.mobile_warning = `Mobile number "${memberObj.mobile}" should be 10 digits`;
        }
        // Validate email
        if (memberObj.email && !isValidEmail(memberObj.email)) {
          memberObj.email_warning = `Email "${memberObj.email}" has invalid format`;
        }

        members.push(memberObj);
      }
    }

    // Skip fully empty submissions
    if (members.length === 0) {
      skippedRows.push({ rowIndex: headerRowIdx + 1 + rIdx + 1, reason: 'Empty submission (no student names or PRNs)' });
      return;
    }

    const groupObj = {
      group_no: nextGroupNo++,
      source_row_index: headerRowIdx + 1 + rIdx + 1,
      timestamp,
      leader_email: leaderEmail,
      domain: domainCanonical,
      domain_raw: domainRaw,
      is_domain_known: isDomainKnown,
      guide_preference: guidePref,
      guide_name: null,
      guide_id: null,
      seminar_guide_id: null,
      members,
    };

    const groupIdx = groups.length;
    groups.push(groupObj);

    // Track leader email for Issue 6
    if (leaderEmail) {
      if (!leaderEmailOccurrences.has(leaderEmail)) leaderEmailOccurrences.set(leaderEmail, []);
      leaderEmailOccurrences.get(leaderEmail).push(groupIdx);
    }

    // Track PRNs for Issue 1 & 2
    members.forEach((m, mi) => {
      if (m.prn && isValidPrn(m.prn)) {
        if (!prnOccurrences.has(m.prn)) prnOccurrences.set(m.prn, []);
        prnOccurrences.get(m.prn).push({
          groupIndex: groupIdx,
          memberIndex: mi,
          studentName: m.name,
          timestamp,
          groupNo: groupObj.group_no,
        });
      }
    });

    // Issue 5: Groups with fewer than 2 or more than 4 members
    if (members.length < 2) {
      issues.push({
        type: 'GROUP_SIZE_SMALL',
        severity: 'warning',
        groupNo: groupObj.group_no,
        groupIndex: groupIdx,
        studentName: members[0]?.name || 'N/A',
        detail: `Group #${groupObj.group_no} has only ${members.length} member (department guideline is 3-4).`,
        suggestedFix: 'Review or merge with another group, or proceed if approved as solo/pair exception.',
      });
    } else if (members.length > 4) {
      issues.push({
        type: 'GROUP_SIZE_LARGE',
        severity: 'warning',
        groupNo: groupObj.group_no,
        groupIndex: groupIdx,
        studentName: members[0]?.name || 'N/A',
        detail: `Group #${groupObj.group_no} has ${members.length} members (exceeds typical maximum of 4).`,
        suggestedFix: 'Confirm coordinator approval for extended group size.',
      });
    }

    // Check invalid/missing PRNs (Issue 3)
    members.forEach(m => {
      if (m.prn_status === 'missing' || m.prn_status === 'invalid') {
        issues.push({
          type: m.prn_status === 'missing' ? 'MISSING_PRN' : 'INVALID_PRN',
          severity: 'warning',
          groupNo: groupObj.group_no,
          groupIndex: groupIdx,
          studentName: m.name,
          detail: `${m.name} in Group #${groupObj.group_no}: ${m.prn_warning}.`,
          suggestedFix: 'Student will be imported with status flagged; PRN can be updated inline or later.',
        });
      }
    });

    // Check unknown domain
    if (!isDomainKnown && domainRaw) {
      issues.push({
        type: 'UNKNOWN_DOMAIN',
        severity: 'info',
        groupNo: groupObj.group_no,
        groupIndex: groupIdx,
        studentName: members[0]?.name || 'N/A',
        detail: `Group #${groupObj.group_no} specified non-canonical domain "${domainRaw}".`,
        suggestedFix: 'Map to a standard department domain or keep raw string.',
      });
    }
  });

  // Process PRN occurrences
  prnOccurrences.forEach((occList, prn) => {
    if (occList.length > 1) {
      // Check if same student regrouped (same name) vs different people using same PRN (different names)
      const uniqueNames = new Set(occList.map(o => o.studentName.toLowerCase().trim()));

      if (uniqueNames.size === 1) {
        // Issue 1: Same PRN in two different submissions (regrouped student)
        // Sort by timestamp if available to suggest most recent
        const sortedOcc = [...occList].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        const recommended = sortedOcc[0];

        issues.push({
          type: 'REGROUPED_STUDENT',
          severity: 'warning',
          prn,
          studentName: occList[0].studentName,
          occurrences: occList.map(o => ({
            groupNo: o.groupNo,
            groupIndex: o.groupIndex,
            timestamp: o.timestamp || 'N/A',
          })),
          recommendedGroupNo: recommended.groupNo,
          detail: `Student ${occList[0].studentName} (${prn}) submitted in multiple groups: ${occList.map(o => `#${o.groupNo}`).join(', ')}.`,
          suggestedFix: `Keep in most recent submission (Group #${recommended.groupNo}) and remove from older submission.`,
        });
      } else {
        // Issue 2: Same PRN used by two different people
        occList.forEach(o => {
          const g = groups[o.groupIndex];
          if (g && g.members[o.memberIndex]) {
            g.members[o.memberIndex].prn_status = 'conflict';
          }
        });

        issues.push({
          type: 'SHARED_PRN_CONFLICT',
          severity: 'warning',
          prn,
          occurrences: occList.map(o => ({
            groupNo: o.groupNo,
            studentName: o.studentName,
            groupIndex: o.groupIndex,
          })),
          detail: `PRN ${prn} is claimed by different students: ${occList.map(o => `"${o.studentName}" in Group #${o.groupNo}`).join(', ')}.`,
          suggestedFix: 'Both imported with prn_status="conflict". Correct the erroneous PRN inline.',
        });
      }
    } else {
      // Single occurrence in file: check against existing registered session groups (Issue 4)
      const occ = occList[0];
      if (existingPrnMap.has(prn)) {
        const exist = existingPrnMap.get(prn);
        issues.push({
          type: 'ALREADY_REGISTERED_IN_SESSION',
          severity: 'warning',
          prn,
          studentName: occ.studentName,
          groupNo: occ.groupNo,
          existingGroupNo: exist.groupNo,
          detail: `Student ${occ.studentName} (${prn}) in Group #${occ.groupNo} is already registered in existing Group #${exist.groupNo} in this session.`,
          suggestedFix: 'Verify if the student transferred groups.',
        });
      }
    }
  });

  // Issue 6: Leader email duplicated across submissions
  leaderEmailOccurrences.forEach((grpIndices, email) => {
    if (grpIndices.length > 1) {
      const groupNos = grpIndices.map(idx => groups[idx]?.group_no).filter(Boolean);
      issues.push({
        type: 'DUPLICATE_LEADER_EMAIL',
        severity: 'warning',
        email,
        groupNos,
        detail: `Leader email "${email}" was used as submitter for multiple groups: ${groupNos.map(g => `#${g}`).join(', ')}.`,
        suggestedFix: 'Informational only — does not block import.',
      });
    }
  });

  // Issue 7: skipped rows summary
  if (skippedRows.length > 0) {
    issues.push({
      type: 'SKIPPED_BLANK_ROWS',
      severity: 'info',
      count: skippedRows.length,
      detail: `Skipped ${skippedRows.length} blank or empty rows in spreadsheet.`,
      suggestedFix: 'No action needed.',
    });
  }

  // Summary counts
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);
  const issuesByType = {};
  issues.forEach(i => {
    issuesByType[i.type] = (issuesByType[i.type] || 0) + 1;
  });

  return {
    groups,
    issues,
    skippedRows,
    summary: {
      groupCount: groups.length,
      studentCount: totalStudents,
      issueCount: issues.length,
      issuesByType,
    },
  };
}

// ─── Step 4: Suggest Guide Assignments ─────────────────────────────────────────
/**
 * Suggest guide assignments:
 * - Distributes unassigned groups evenly across active guides by current load.
 * - Prefers guides whose expertise tags match group domain when tags exist.
 * - Returns draft suggestion without silently mutating database.
 */
function suggestGuideAssignments(groups, activeGuides) {
  if (!Array.isArray(groups) || groups.length === 0 || !Array.isArray(activeGuides) || activeGuides.length === 0) {
    return [];
  }

  // Filter only active guides
  const availableGuides = activeGuides.filter(g => g.is_active !== false);
  if (availableGuides.length === 0) return [];

  // Track current loads
  const guideLoads = new Map();
  availableGuides.forEach(g => {
    const existingCount = groups.filter(grp => String(grp.guide_id) === String(g.faculty_id || g.id) || String(grp.seminar_guide_id) === String(g.id)).length;
    guideLoads.set(g.id, {
      guide: g,
      count: existingCount,
      capacity: g.quota || 4,
      tags: (g.expertise_tags || []).map(t => String(t).toLowerCase().trim()),
    });
  });

  const suggestions = [];

  // Iterate over groups without an assigned guide
  groups.forEach(group => {
    if (group.guide_id || group.seminar_guide_id) return; // already assigned

    const groupDomain = (group.domain || group.domain_raw || '').toLowerCase();

    // Find best guide:
    // 1. Guides with domain tag match & capacity not exceeded
    // 2. Guide with lowest current load
    let candidates = [...guideLoads.values()];

    // Score candidates
    candidates.sort((a, b) => {
      const aHasTag = a.tags.some(tag => tag && groupDomain.includes(tag));
      const bHasTag = b.tags.some(tag => tag && groupDomain.includes(tag));

      if (aHasTag && !bHasTag) return -1;
      if (!aHasTag && bHasTag) return 1;

      // Compare load relative to quota
      const aRatio = a.count / (a.capacity || 1);
      const bRatio = b.count / (b.capacity || 1);
      if (aRatio !== bRatio) return aRatio - bRatio;

      return a.count - b.count;
    });

    const chosen = candidates[0];
    if (chosen) {
      chosen.count++;
      suggestions.push({
        groupId: group.id || group.group_no,
        groupNo: group.group_no,
        guideId: chosen.guide.id,
        facultyId: chosen.guide.faculty_id,
        guideName: chosen.guide.guide_name || chosen.guide.faculty_name,
        matchReason: chosen.tags.some(t => t && groupDomain.includes(t)) ? 'Domain expertise match' : 'Balanced load distribution',
      });
    }
  });

  return suggestions;
}

// ─── Output: 4-Sheet Department Excel Generation ──────────────────────────────
/**
 * Generates official TE Seminar Groups XLSX with:
 * 1. "Groups with Guide" (layout matching department sheet)
 * 2. "Guide count"
 * 3. "Student list"
 * 4. "Issues"
 * With CSV / Formula injection prevention on all cells.
 */
function generateWorkflowExcel(session, groups, guides, issues = []) {
  const wb = XLSX.utils.book_new();

  const sessionName = session?.name || 'AY 2025-26';
  const titleText = `TE Seminar and Project Group Formation, AY ${sessionName}`;

  // ─── Sheet 1: "Groups with Guide" ──────────────────────────────────────────
  const s1Data = [];
  const s1Merges = [];
  const S1_COLS = 9; // Group No, Student Name, College PRN, Topic 1, Topic 2, Topic 3, Final Topic, Domain, Guide

  // Title Row
  s1Data.push([sanitizeFormula(titleText), ...new Array(S1_COLS - 1).fill('')]);
  s1Merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: S1_COLS - 1 } });

  // Header Row
  s1Data.push([
    'Group No.',
    'Student Name',
    'College PRN',
    'Topic 1',
    'Topic 2',
    'Topic 3',
    'Final Topic',
    'Domain',
    'Guide',
  ]);

  let rIdx = 2;
  const sortedGroups = [...groups].sort((a, b) => a.group_no - b.group_no);

  sortedGroups.forEach(g => {
    const members = g.members || [];
    if (members.length === 0) return;
    const startRow = rIdx;

    members.forEach((m, mi) => {
      const row = new Array(S1_COLS).fill('');
      if (mi === 0) {
        row[0] = sanitizeFormula(g.group_no);
        row[7] = sanitizeFormula(g.domain || g.domain_raw || '');
        row[8] = sanitizeFormula(g.guide_name || 'Unassigned');
      }
      row[1] = sanitizeFormula(m.student_name || m.name || '');
      row[2] = sanitizeFormula(m.university_prn || m.prn || '');
      row[3] = sanitizeFormula(m.topic1 || '');
      row[4] = sanitizeFormula(m.topic2 || '');
      row[5] = sanitizeFormula(m.topic3 || '');
      row[6] = sanitizeFormula(m.final_topic || g.final_topic || '');

      s1Data.push(row);
      rIdx++;
    });

    if (members.length > 1) {
      // Merge Group No, Domain, Guide across member rows
      [0, 7, 8].forEach(c => {
        s1Merges.push({ s: { r: startRow, c }, e: { r: rIdx - 1, c } });
      });
    }

    // Blank separator row between groups
    s1Data.push(new Array(S1_COLS).fill(''));
    rIdx++;
  });

  const ws1 = XLSX.utils.aoa_to_sheet(s1Data);
  ws1['!merges'] = s1Merges;
  ws1['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 18 },
    { wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 35 },
    { wch: 26 }, { wch: 26 },
  ];
  // Page setup: landscape, repeat header row
  ws1['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1 };
  XLSX.utils.book_append_sheet(wb, ws1, 'Groups with Guide');

  // ─── Sheet 2: "Guide count" ────────────────────────────────────────────────
  const s2Data = [];
  s2Data.push(['Sr. No.', 'Guide name', 'Number of groups', 'Group nos.', 'Total students']);

  let srNo = 1;
  let totalGroupsAssigned = 0;
  let totalStudentsAssigned = 0;

  // Compute guide counts from groups
  const guideMap = new Map();
  guides.forEach(g => {
    guideMap.set(g.id || g.guide_name, {
      name: g.guide_name || g.faculty_name,
      groupNos: [],
      studentCount: 0,
    });
  });

  sortedGroups.forEach(g => {
    if (g.guide_name) {
      let entry = [...guideMap.values()].find(v => v.name === g.guide_name);
      if (!entry) {
        entry = { name: g.guide_name, groupNos: [], studentCount: 0 };
        guideMap.set(g.guide_name, entry);
      }
      entry.groupNos.push(g.group_no);
      entry.studentCount += (g.members || []).length;
    }
  });

  guideMap.forEach(info => {
    const grpCount = info.groupNos.length;
    s2Data.push([
      srNo++,
      sanitizeFormula(info.name),
      grpCount,
      sanitizeFormula(info.groupNos.join(', ')),
      info.studentCount,
    ]);
    totalGroupsAssigned += grpCount;
    totalStudentsAssigned += info.studentCount;
  });

  // Total row
  s2Data.push([
    'TOTAL',
    '',
    totalGroupsAssigned,
    '',
    totalStudentsAssigned,
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(s2Data);
  ws2['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 26 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Guide count');

  // ─── Sheet 3: "Student list" ───────────────────────────────────────────────
  const s3Data = [];
  s3Data.push([
    'Group No.',
    'Name',
    'PRN',
    'Division',
    'Topic 1',
    'Topic 2',
    'Topic 3',
    'Final Topic',
    'Mobile',
    'Email',
    'Leader (Y/N)',
    'Guide',
  ]);

  sortedGroups.forEach(g => {
    (g.members || []).forEach(m => {
      s3Data.push([
        sanitizeFormula(g.group_no),
        sanitizeFormula(m.student_name || m.name || ''),
        sanitizeFormula(m.university_prn || m.prn || ''),
        sanitizeFormula(m.division || ''),
        sanitizeFormula(m.topic1 || ''),
        sanitizeFormula(m.topic2 || ''),
        sanitizeFormula(m.topic3 || ''),
        sanitizeFormula(m.final_topic || g.final_topic || ''),
        sanitizeFormula(m.mobile || ''),
        sanitizeFormula(m.email || ''),
        m.is_leader ? 'Y' : 'N',
        sanitizeFormula(g.guide_name || 'Unassigned'),
      ]);
    });
  });

  const ws3 = XLSX.utils.aoa_to_sheet(s3Data);
  ws3['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 10 },
    { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 35 },
    { wch: 15 }, { wch: 30 }, { wch: 14 }, { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, 'Student list');

  // ─── Sheet 4: "Issues" ─────────────────────────────────────────────────────
  const s4Data = [];
  s4Data.push(['Type', 'Group No.', 'Student', 'Detail', 'Suggested Fix']);

  issues.forEach(i => {
    s4Data.push([
      sanitizeFormula(i.type || 'ISSUE'),
      sanitizeFormula(i.groupNo || (i.groupNos ? i.groupNos.join(', ') : 'N/A')),
      sanitizeFormula(i.studentName || i.email || 'N/A'),
      sanitizeFormula(i.detail || ''),
      sanitizeFormula(i.suggestedFix || ''),
    ]);
  });

  if (issues.length === 0) {
    s4Data.push(['NONE', 'N/A', 'N/A', 'No unresolved issues detected.', 'All records clean.']);
  }

  const ws4 = XLSX.utils.aoa_to_sheet(s4Data);
  ws4['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Issues');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  CANONICAL_DOMAINS,
  sanitizeFormula,
  normText,
  normPrn,
  isValidPrn,
  normEmail,
  isValidEmail,
  normMobile,
  isValidMobile,
  normDivision,
  cleanTopic,
  normalizeDomain,
  validateAndParseFile,
  getSheetPreviewAndRows,
  detectHeaderRow,
  detectMaxMembersFromHeaders,
  autoMapColumns,
  buildAndCleanGroups,
  suggestGuideAssignments,
  generateWorkflowExcel,
};
