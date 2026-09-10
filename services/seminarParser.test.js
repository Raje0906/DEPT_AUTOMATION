'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseGroups, validateGroups, sequentialFill, normPrn, normText } = require('./services/seminarParser');

// ─── Helper: build a raw rows array (no timestamp column) ─────────────────
// Columns: Name, PRN, Div, Mobile, Email, T1, T2, T3  x4 students, then Domain
function makeRow(students, domain) {
  // students: array of up to 4 { name, prn, div?, mobile?, email?, t1?, t2?, t3? }
  const row = [];
  for (let i = 0; i < 4; i++) {
    const s = students[i] || { name: '', prn: '', div: '', mobile: '', email: '', t1: '', t2: '', t3: '' };
    row.push(s.name || '', s.prn || '', s.div || '', s.mobile || '', s.email || '', s.t1 || '', s.t2 || '', s.t3 || '');
  }
  row.push(domain || '');
  return row;
}

function makeRows(groupDefs) {
  const header = ['Name1','PRN1','Div1','Mob1','Email1','T1a','T2a','T3a',
                  'Name2','PRN2','Div2','Mob2','Email2','T1b','T2b','T3b',
                  'Name3','PRN3','Div3','Mob3','Email3','T1c','T2c','T3c',
                  'Name4','PRN4','Div4','Mob4','Email4','T1d','T2d','T3d',
                  'Domain'];
  return [header, ...groupDefs.map(g => makeRow(g.students, g.domain))];
}

// ─── normPrn / normText ───────────────────────────────────────────────────

test('normPrn strips whitespace and uppercases', () => {
  assert.equal(normPrn('  ce2021150  '), 'CE2021150');
  assert.equal(normPrn(' ce 2021 150 '), 'CE2021150');
  assert.equal(normPrn(null), '');
});

test('normText collapses internal whitespace', () => {
  assert.equal(normText('  Aditya   Deshmukh  '), 'Aditya Deshmukh');
  assert.equal(normText(null), '');
});

// ─── parseGroups ─────────────────────────────────────────────────────────

test('parseGroups: normal 4-person group', () => {
  const rows = makeRows([{
    students: [
      { name: 'Alice', prn: 'CE001' },
      { name: 'Bob',   prn: 'CE002' },
      { name: 'Carol', prn: 'CE003' },
      { name: 'Dave',  prn: 'CE004' },
    ],
    domain: 'Machine Learning',
  }]);
  const { groups } = parseGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 4);
  assert.equal(groups[0].domain, 'Machine Learning');
  assert.equal(groups[0].members[0].is_leader, true);
  assert.equal(groups[0].members[3].is_leader, false);
});

test('parseGroups: 3-person group — no phantom 4th member', () => {
  const rows = makeRows([{
    students: [
      { name: 'Alice', prn: 'CE001' },
      { name: 'Bob',   prn: 'CE002' },
      { name: 'Carol', prn: 'CE003' },
      // 4th block entirely empty
    ],
    domain: 'IoT',
  }]);
  const { groups } = parseGroups(rows);
  assert.equal(groups[0].members.length, 3, 'Should have exactly 3 members, not 4');
});

test('parseGroups: stray whitespace is normalised in name, PRN, email', () => {
  const rows = makeRows([{
    students: [
      { name: '  Alice   Singh ', prn: ' ce 2021 001 ', email: ' ALICE@TEST.COM ' },
      { name: 'Bob',  prn: 'CE002' },
      { name: 'Carol', prn: 'CE003' },
    ],
    domain: 'Web',
  }]);
  const { groups } = parseGroups(rows);
  const m = groups[0].members[0];
  assert.equal(m.student_name, 'Alice Singh');
  assert.equal(m.prn, 'CE2021001');
  assert.equal(m.email, 'alice@test.com');
});

test('parseGroups: entirely blank rows are skipped', () => {
  const header = ['Name1','PRN1','Div1','Mob1','Email1','T1a','T2a','T3a',
                  'Name2','PRN2','Div2','Mob2','Email2','T1b','T2b','T3b',
                  'Name3','PRN3','Div3','Mob3','Email3','T1c','T2c','T3c',
                  'Name4','PRN4','Div4','Mob4','Email4','T1d','T2d','T3d',
                  'Domain'];
  const dataRow = makeRow(
    [{ name:'A', prn:'P1' }, { name:'B', prn:'P2' }, { name:'C', prn:'P3' }],
    'AI'
  );
  const blankRow = new Array(33).fill('');
  const rows = [header, dataRow, blankRow, dataRow];
  const { groups } = parseGroups(rows);
  assert.equal(groups.length, 2, 'Blank row should be skipped');
});

// ─── validateGroups ───────────────────────────────────────────────────────

test('validateGroups: duplicate PRN across groups is flagged', () => {
  const rows = makeRows([
    { students: [{ name:'A', prn:'DUP001'}, {name:'B',prn:'B002'}, {name:'C',prn:'C003'}], domain:'D1' },
    { students: [{ name:'X', prn:'DUP001'}, {name:'Y',prn:'Y002'}, {name:'Z',prn:'Z003'}], domain:'D2' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  const dupAcross = issues.filter(i => i.type === 'DUPLICATE_PRN_ACROSS');
  assert.equal(dupAcross.length, 1, 'Should flag one cross-group duplicate');
  assert.match(dupAcross[0].message, /DUP001/);
});

test('validateGroups: duplicate PRN within a group is flagged', () => {
  const rows = makeRows([
    { students: [{ name:'A', prn:'SAME'}, {name:'B',prn:'SAME'}, {name:'C',prn:'C003'}], domain:'D1' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  const dupWithin = issues.filter(i => i.type === 'DUPLICATE_PRN_WITHIN');
  assert.equal(dupWithin.length, 1, 'Should flag intra-group duplicate');
});

test('validateGroups: group with 2 members flagged as too small', () => {
  const rows = makeRows([
    { students: [{ name:'A', prn:'P1'}, {name:'B',prn:'P2'}], domain:'D1' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  const sizeIssues = issues.filter(i => i.type === 'GROUP_SIZE');
  assert.ok(sizeIssues.length > 0, 'Should flag group too small');
});

test('validateGroups: missing domain is flagged', () => {
  const rows = makeRows([
    { students: [{ name:'A', prn:'P1'}, {name:'B',prn:'P2'}, {name:'C',prn:'P3'}], domain:'' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  assert.ok(issues.some(i => i.type === 'MISSING_DOMAIN'), 'Should flag missing domain');
});

test('validateGroups: name without PRN flagged as MISSING_FIELD', () => {
  const rows = makeRows([
    { students: [
      { name:'Alice', prn:'' },  // name but no PRN
      {name:'B',prn:'P2'},
      {name:'C',prn:'P3'},
    ], domain:'AI' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  assert.ok(issues.some(i => i.type === 'MISSING_FIELD' && i.field.includes('PRN')));
});

test('validateGroups: clean data produces no issues', () => {
  const rows = makeRows([
    { students: [{name:'A',prn:'P1'},{name:'B',prn:'P2'},{name:'C',prn:'P3'}], domain:'D1' },
    { students: [{name:'D',prn:'P4'},{name:'E',prn:'P5'},{name:'F',prn:'P6'},{name:'G',prn:'P7'}], domain:'D2' },
  ]);
  const { groups } = parseGroups(rows);
  const { issues } = validateGroups(groups);
  assert.equal(issues.length, 0, 'Clean data should produce no issues');
});

// ─── sequentialFill ───────────────────────────────────────────────────────

test('sequentialFill: 15 groups, 4 guides with quotas [4,4,4,3]', () => {
  const groups = Array.from({ length: 15 }, (_, i) => ({ id: i }));
  const guides = [
    { id: 1, faculty_id: 101, quota: 4, display_order: 1 },
    { id: 2, faculty_id: 102, quota: 4, display_order: 2 },
    { id: 3, faculty_id: 103, quota: 4, display_order: 3 },
    { id: 4, faculty_id: 104, quota: 3, display_order: 4 },
  ];
  const { assignments, unassigned } = sequentialFill(groups, guides);
  assert.equal(assignments.length, 15, 'All 15 groups should be assigned');
  assert.equal(unassigned.length, 0, 'No group should be unassigned');

  // Guide 1 gets groups 0..3
  const g1 = assignments.filter(a => a.guideId === 1);
  assert.equal(g1.length, 4, 'Guide 1 should get exactly 4 groups');

  // Guide 4 gets last 3
  const g4 = assignments.filter(a => a.guideId === 4);
  assert.equal(g4.length, 3, 'Guide 4 should get exactly 3 groups');
});

test('sequentialFill: more groups than total quota leaves remainder unassigned', () => {
  const groups = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  const guides = [
    { id: 1, faculty_id: 101, quota: 3, display_order: 1 },
    { id: 2, faculty_id: 102, quota: 3, display_order: 2 },
  ];
  const { assignments, unassigned } = sequentialFill(groups, guides);
  assert.equal(assignments.length, 6, '6 groups should be assigned (total quota)');
  assert.equal(unassigned.length, 4, '4 groups should be unassigned');
});

test('sequentialFill: empty guides list leaves all groups unassigned', () => {
  const groups = Array.from({ length: 5 }, (_, i) => ({ id: i }));
  const { assignments, unassigned } = sequentialFill(groups, []);
  assert.equal(assignments.length, 0);
  assert.equal(unassigned.length, 5);
});

test('sequentialFill: off-by-one check — quota fills exactly (no extra)', () => {
  const groups = Array.from({ length: 4 }, (_, i) => ({ id: i }));
  const guides = [{ id: 1, faculty_id: 101, quota: 4, display_order: 1 }];
  const { assignments, unassigned } = sequentialFill(groups, guides);
  assert.equal(assignments.length, 4);
  assert.equal(unassigned.length, 0);
  assert.ok(assignments.every(a => a.guideId === 1), 'All groups should go to the single guide');
});
