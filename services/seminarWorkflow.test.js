'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const {
  sanitizeFormula,
  normPrn,
  isValidPrn,
  normMobile,
  normEmail,
  cleanTopic,
  normalizeDomain,
  validateAndParseFile,
  detectHeaderRow,
  detectMaxMembersFromHeaders,
  autoMapColumns,
  buildAndCleanGroups,
  suggestGuideAssignments,
  generateWorkflowExcel,
} = require('./seminarWorkflowService');

describe('Seminar Coordinator Workflow Service Tests', () => {

  test('Formula injection sanitization prefixes =, +, -, @ with apostrophe', () => {
    assert.equal(sanitizeFormula('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(sanitizeFormula('+12345'), "'+12345");
    assert.equal(sanitizeFormula('-500'), "'-500");
    assert.equal(sanitizeFormula('@cmd'), "'@cmd");
    assert.equal(sanitizeFormula('Regular Text'), 'Regular Text');
    assert.equal(sanitizeFormula(''), '');
  });

  test('Data cleaning: PRN, mobile, email, topics, and domain normalization', () => {
    // PRN
    assert.equal(normPrn('  f23112001  '), 'F23112001');
    assert.equal(normPrn('.'), '');
    assert.equal(normPrn('..'), '');
    assert.equal(isValidPrn('F23112001'), true);
    assert.equal(isValidPrn('12345'), false);

    // Mobile
    assert.equal(normMobile('+91 98765 43210'), '9876543210');
    assert.equal(normMobile('919876543210'), '9876543210');
    assert.equal(normMobile('09876543210'), '9876543210');

    // Email
    assert.equal(normEmail(' Student.One@College.EDU '), 'student.one@college.edu');

    // Topics
    assert.equal(cleanTopic('1. AI based Healthcare Analysis'), 'AI based Healthcare Analysis');
    assert.equal(cleanTopic('Topic 2: Cyber Threat Hunting'), 'Cyber Threat Hunting');
    assert.equal(cleanTopic('Blockchain Supply Chain - Domain: Blockchain'), 'Blockchain Supply Chain');
    assert.equal(cleanTopic('.'), '');
    assert.equal(cleanTopic('-'), '');

    // Domain
    const d1 = normalizeDomain('Machine Learning');
    assert.equal(d1.isKnown, true);
    assert.equal(d1.canonical, 'Artificial Intelligence / Machine Learning (AI/ML)');
  });

  test('Step 1: Upload validation enforces signatures and rejects macro files', () => {
    // Empty buffer
    assert.throws(() => validateAndParseFile(Buffer.alloc(0), 'test.xlsx', 0), /empty/i);

    // Invalid signature
    assert.throws(() => validateAndParseFile(Buffer.from('not an excel file'), 'test.xlsx', 17), /invalid file signature/i);

    // Reject .xlsm
    assert.throws(() => validateAndParseFile(Buffer.from('dummy'), 'test.xlsm', 5), /only .xlsx or .csv/i);

    // Macro container signature
    const fakeZipWithVba = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      Buffer.from('xl/vbaProject.bin inside workbook'),
    ]);
    assert.throws(() => validateAndParseFile(fakeZipWithVba, 'test.xlsx', fakeZipWithVba.length), /macro-enabled/i);
  });

  test('Step 2: Auto-detects header row and column mapping with up to 6 members', () => {
    const rawData = [
      ['Department of Computer Engineering', '', '', ''],
      ['Student Form Responses (Spring 2026)', '', '', ''],
      ['Timestamp', 'Email Address', 'Name of Student-1', 'College PRN 1', 'Division 1', 'Mobile 1', 'Topic 1 Student 1', 'Student-2 Name', 'Student 2 PRN', 'Topic 1 Student 2', 'Student 3 Name', 'Student 3 PRN', 'Student 4 Name', 'Student 4 PRN', 'Student 5 Name', 'Student 5 PRN'],
      ['2026-03-01 10:00:00', 'lead@test.com', 'Alice Smith', 'F23112001', 'TE1', '9876543210', 'AI Vision', 'Bob Jones', 'F23112002', 'NLP', 'Charlie Brown', 'F23112003', 'David Clark', 'F23112004', 'Eva Green', 'F23112005'],
    ];

    const headerIdx = detectHeaderRow(rawData);
    assert.equal(headerIdx, 2);

    const headers = rawData[headerIdx];
    const detectedMembers = detectMaxMembersFromHeaders(headers);
    assert.equal(detectedMembers, 5);

    const { mapping, missingRequired } = autoMapColumns(headers);
    assert.equal(missingRequired.length, 0);
    assert.ok(mapping.m1_name.colIndex >= 0);
    assert.ok(mapping.m1_prn.colIndex >= 0);
    assert.ok(mapping.m5_name.colIndex >= 0);
    assert.ok(mapping.m5_prn.colIndex >= 0);
  });

  test('Step 3: Builds groups and flags all 7 issue types without crashing', () => {
    const headers = ['Timestamp', 'Email Address', 'Domain', 'Student 1 Name', 'Student 1 PRN', 'Student 1 Mobile', 'Student 2 Name', 'Student 2 PRN'];
    const rows = [
      headers,
      // 1. Regrouped student Alice (F23112001) in row 1
      ['2026-03-01 09:00:00', 'lead1@test.com', 'AI', 'Alice Smith', 'F23112001', '9876543210', 'Bob', 'F23112002'],
      // 1. Regrouped student Alice in row 2 with newer timestamp
      ['2026-03-01 11:00:00', 'lead2@test.com', 'AI', 'Alice Smith', 'F23112001', '9876543210', 'Charlie', 'F23112003'],
      // 2. Shared PRN F23112099 used by two different students
      ['2026-03-01 12:00:00', 'lead3@test.com', 'Web', 'Daniel Wu', 'F23112099', '9876543211', 'Emma Watson', 'F23112004'],
      ['2026-03-01 12:05:00', 'lead4@test.com', 'Web', 'Frank Miller', 'F23112099', '9876543212', 'Grace Hopper', 'F23112005'],
      // 3. Missing and invalid PRN
      ['2026-03-01 12:10:00', 'lead5@test.com', 'Cyber', 'Harry Potter', '.', '9876543213', 'Ian Malcolm', 'INVALID_PRN'],
      // 5. Group size warning (1 member only)
      ['2026-03-01 12:15:00', 'solo@test.com', 'IoT', 'Solo Student', 'F23112010', '9876543214', '', ''],
      // 6. Duplicate leader email lead1@test.com
      ['2026-03-01 12:20:00', 'lead1@test.com', 'Cloud', 'Jack Sparrow', 'F23112011', '9876543215', 'Kate Austen', 'F23112012'],
      // 7. Blank row
      ['', '', '', '', '', '', '', ''],
    ];

    const { mapping } = autoMapColumns(headers);
    const result = buildAndCleanGroups(rows, 0, mapping, { startingGroupNo: 1 });

    assert.ok(result.groups.length >= 6);
    assert.ok(result.issues.length >= 5);

    // Issue 1: Regrouped student detected
    const regrouped = result.issues.find(i => i.type === 'REGROUPED_STUDENT');
    assert.ok(regrouped);
    assert.equal(regrouped.prn, 'F23112001');

    // Issue 2: Shared PRN conflict
    const shared = result.issues.find(i => i.type === 'SHARED_PRN_CONFLICT');
    assert.ok(shared);
    assert.equal(shared.prn, 'F23112099');

    // Issue 3: Missing / invalid PRN
    const missing = result.issues.find(i => i.type === 'MISSING_PRN' || i.type === 'INVALID_PRN');
    assert.ok(missing);

    // Issue 5: Group size warning
    const sizeWarn = result.issues.find(i => i.type === 'GROUP_SIZE_SMALL');
    assert.ok(sizeWarn);

    // Issue 6: Duplicate leader email
    const dupLeader = result.issues.find(i => i.type === 'DUPLICATE_LEADER_EMAIL');
    assert.ok(dupLeader);

    // Issue 7: Blank row skipped
    const skipped = result.issues.find(i => i.type === 'SKIPPED_BLANK_ROWS');
    assert.ok(skipped);
  });

  test('Step 4: Suggest guide assignments balances load and matches expertise tags', () => {
    const groups = [
      { id: 1, group_no: 1, domain: 'Artificial Intelligence / Machine Learning (AI/ML)', members: [{}, {}] },
      { id: 2, group_no: 2, domain: 'Artificial Intelligence / Machine Learning (AI/ML)', members: [{}, {}] },
      { id: 3, group_no: 3, domain: 'Cybersecurity & Information Assurance', members: [{}, {}] },
      { id: 4, group_no: 4, domain: 'Cloud Computing & DevOps', members: [{}, {}] },
    ];

    const guides = [
      { id: 101, faculty_name: 'Dr. AI Expert', quota: 2, expertise_tags: ['ai', 'machine learning'], is_active: true },
      { id: 102, faculty_name: 'Prof. Cyber Expert', quota: 2, expertise_tags: ['cybersecurity'], is_active: true },
      { id: 103, faculty_name: 'Prof. Cloud Expert', quota: 2, expertise_tags: ['cloud'], is_active: true },
    ];

    const suggestions = suggestGuideAssignments(groups, guides);
    assert.equal(suggestions.length, 4);

    // Group 1 should prefer Dr. AI Expert
    const g1Suggest = suggestions.find(s => s.groupNo === 1);
    assert.equal(g1Suggest.guideId, 101);

    // Group 3 should prefer Prof. Cyber Expert
    const g3Suggest = suggestions.find(s => s.groupNo === 3);
    assert.equal(g3Suggest.guideId, 102);
  });

  test('Output Excel: Generates all 4 sheets and prevents formula injection', () => {
    const session = { name: 'AY 2025-26 Sem 1' };
    const groups = [
      {
        id: 1,
        group_no: 1,
        domain: 'AI/ML',
        guide_name: 'Dr. A. P. Kale',
        members: [
          { name: '=cmd|/c calc!A0', prn: 'F23112001', topic1: '+SUM(1,2)', topic2: '-100', topic3: '@formula', is_leader: true, division: 'TE1', mobile: '9876543210', email: 'test@college.edu' },
        ],
      },
    ];
    const guides = [{ id: 1, guide_name: 'Dr. A. P. Kale', quota: 4 }];
    const issues = [{ type: 'SAMPLE_ISSUE', groupNo: 1, studentName: 'Test Student', detail: '=EVIL()', suggestedFix: 'Fix it' }];

    const buf = generateWorkflowExcel(session, groups, guides, issues);
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 0);

    // Read generated workbook back
    const wb = XLSX.read(buf, { type: 'buffer' });
    assert.deepEqual(wb.SheetNames, ['Groups with Guide', 'Guide count', 'Student list', 'Issues']);

    // Check formula injection escaping in Sheet 1
    const s1 = XLSX.utils.sheet_to_json(wb.Sheets['Groups with Guide'], { header: 1 });
    const studentRow = s1.find(r => Array.isArray(r) && r.some(c => String(c).includes('calc')));
    assert.ok(studentRow);
    const escapedName = studentRow[1];
    assert.ok(String(escapedName).startsWith("'="), 'Formula should start with apostrophe');
  });

  test('Fixture test: ./data/te_seminar_groups.xlsx parses 54 groups with issues flagged', () => {
    const fixturePath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');
    if (!fs.existsSync(fixturePath)) {
      console.log('Skipping fixture test: file not found at', fixturePath);
      return;
    }

    const buf = fs.readFileSync(fixturePath);
    const { wb, defaultSheet } = validateAndParseFile(buf, 'te_seminar_groups.xlsx', buf.length);
    assert.ok(wb.SheetNames.includes('Form Responses 1'));

    // Check preview and rows
    const { rows } = require('./seminarWorkflowService').getSheetPreviewAndRows(wb, 'Form Responses 1');
    const headerIdx = detectHeaderRow(rows);
    const headers = rows[headerIdx];
    const { mapping } = autoMapColumns(headers);

    const result = buildAndCleanGroups(rows, headerIdx, mapping, { startingGroupNo: 1 });
    assert.equal(result.groups.length, 54);
    assert.ok(result.summary.studentCount >= 200);

    // Confirm missing-PRN student is flagged and imported
    const missing = result.issues.filter(i => i.type === 'MISSING_PRN');
    assert.ok(missing.length >= 1, 'Missing PRN should be flagged');

    // Confirm shared PRN conflict cases are flagged
    const conflictIssues = result.issues.filter(i => i.type === 'SHARED_PRN_CONFLICT');
    assert.ok(conflictIssues.length >= 3, 'Should have at least 3 shared PRN conflicts flagged');
  });
});
