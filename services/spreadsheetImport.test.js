'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseSpreadsheet,
  parseGroups,
  validateGroups,
  normPrn,
  normText,
} = require('./seminarParser');

const EXCEL_PATH = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');

test('Spreadsheet Importer: parseSpreadsheet correctly reads department workbook', () => {
  assert.ok(fs.existsSync(EXCEL_PATH), 'Spreadsheet file ./data/te_seminar_groups.xlsx must exist');
  const buffer = fs.readFileSync(EXCEL_PATH);
  const result = parseSpreadsheet(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  assert.equal(result.isDepartmentWorkbook, true, 'Must be identified as Department Workbook');
  assert.ok(Array.isArray(result.groups), 'Must return groups array');
  assert.equal(result.groups.length, 54, 'Must parse exactly 54 groups');
});

test('Spreadsheet Importer: parseGroups maps department workbook to standard group model', () => {
  const buffer = fs.readFileSync(EXCEL_PATH);
  const parsedSheet = parseSpreadsheet(buffer);
  const { groups, issues, edgeCases, countQuotas } = parseGroups(parsedSheet);

  assert.equal(groups.length, 54, 'Must produce exactly 54 standard group records');
  
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);
  assert.equal(totalStudents, 201, 'Must extract exactly 201 students');

  const size4 = groups.filter(g => g.members.length === 4).length;
  const size3 = groups.filter(g => g.members.length === 3).length;
  const size2 = groups.filter(g => g.members.length === 2).length;
  assert.equal(size4, 40, '40 groups of 4');
  assert.equal(size3, 13, '13 groups of 3');
  assert.equal(size2, 1, '1 group of 2 (Group 54)');

  // Group 54 verification
  const g54 = groups.find(g => g.group_no === 54);
  assert.ok(g54, 'Group 54 must exist');
  assert.equal(g54.members.length, 2, 'Group 54 has exactly 2 members');
  assert.equal(g54.members[0].prn, 'F22111016');
  assert.equal(g54.members[1].prn, 'F22111037');

  // Quotas verification
  assert.ok(countQuotas, 'Count quotas must be present');
  assert.equal(Object.keys(countQuotas).length, 15, '15 canonical guide quotas recorded');
});

test('Spreadsheet Importer: validateGroups validates department workbook without blocking errors', () => {
  const buffer = fs.readFileSync(EXCEL_PATH);
  const parsedSheet = parseSpreadsheet(buffer);
  const { groups, issues: parseIssues } = parseGroups(parsedSheet);
  const { issues: valIssues } = validateGroups(groups);
  const allIssues = [...parseIssues, ...valIssues];

  // Group 54 size issue should be a warning, not a blocking error
  const g54Issue = allIssues.find(i => i.groupNo === 54 && i.type === 'GROUP_SIZE');
  assert.ok(g54Issue, 'Group 54 size should be flagged');
  assert.equal(g54Issue.severity, 'warning', 'Group 54 size exception must be severity=warning');

  // Conflict PRNs (F23111054, F23111027, F23113048) should be warnings
  const conflictIssues = allIssues.filter(i => i.type === 'CONFLICT_PRN' || i.type === 'DUPLICATE_PRN_ACROSS');
  assert.ok(conflictIssues.length > 0, 'Conflict PRNs must be detected');
  for (const c of conflictIssues) {
    assert.equal(c.severity, 'warning', `Conflict PRN ${c.key} must be severity=warning`);
  }

  // Missing PRN issues (Group 53 Omkar gaykwad) should be warnings
  const missingPrnIssues = allIssues.filter(i => (i.type === 'MISSING_FIELD' || i.type === 'MISSING_PRN') && i.field && i.field.includes('PRN'));
  assert.ok(missingPrnIssues.length > 0, 'Missing PRNs must be detected');
  for (const iss of missingPrnIssues) {
    assert.equal(iss.severity, 'warning', 'Known missing PRNs must have severity=warning');
  }

  // Ensure NO blocking severity=error issues on clean department import
  const blockingErrors = allIssues.filter(i => i.severity === 'error');
  assert.equal(blockingErrors.length, 0, 'Department workbook import must have zero blocking errors');
});

test('Spreadsheet Importer: contact and topic cleaning and dual-key matching', () => {
  const buffer = fs.readFileSync(EXCEL_PATH);
  const parsedSheet = parseSpreadsheet(buffer);
  const { groups } = parseGroups(parsedSheet);

  // Check that student contacts are cleaned (no ".." or "." in phone numbers)
  for (const g of groups) {
    for (const m of g.members) {
      if (m.mobile) {
        assert.match(m.mobile, /^\d{10}$/, `Mobile ${m.mobile} must be exactly 10 digits`);
      }
      if (m.email) {
        assert.ok(m.email.includes('@'), `Email ${m.email} must contain @`);
      }
      if (m.topic1) {
        assert.ok(!m.topic1.startsWith('1.'), `Topic should not retain leading "1.": "${m.topic1}"`);
      }
    }
  }
});

test('Spreadsheet Importer: backward compatibility with legacy 1-row-per-group sheets', () => {
  const legacyRows = [
    ['Name1','PRN1','Div1','Mob1','Email1','T1a','T2a','T3a',
     'Name2','PRN2','Div2','Mob2','Email2','T1b','T2b','T3b',
     'Name3','PRN3','Div3','Mob3','Email3','T1c','T2c','T3c',
     'Name4','PRN4','Div4','Mob4','Email4','T1d','T2d','T3d',
     'Domain'],
    ['Alice Singh', 'CE001', 'TE1', '9876543210', 'alice@test.com', 'Topic 1', 'Topic 2', 'Topic 3',
     'Bob Sharma', 'CE002', 'TE1', '9876543211', 'bob@test.com', 'Topic 1', 'Topic 2', 'Topic 3',
     'Carol Patel', 'CE003', 'TE1', '9876543212', 'carol@test.com', 'Topic 1', 'Topic 2', 'Topic 3',
     '', '', '', '', '', '', '', '',
     'Artificial Intelligence']
  ];

  const { groups } = parseGroups(legacyRows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 3);
  assert.equal(groups[0].domain, 'Artificial Intelligence');
  assert.equal(groups[0].members[0].student_name, 'Alice Singh');
  assert.equal(groups[0].members[0].prn, 'CE001');
});
