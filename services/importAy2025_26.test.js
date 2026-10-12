'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseWorkbook, normalizeDomain, cleanPrn, CANONICAL_GUIDES } = require('../scripts/import_ay2025_26_sem1');

const workbookPath = path.resolve(__dirname, '../data/te_seminar_groups.xlsx');

test('Import Workbook Parser: loads exactly 54 groups and 201 students', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  assert.equal(groups.length, 54, 'Must load exactly 54 groups');
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);
  assert.equal(totalStudents, 201, 'Must load exactly 201 students');
});

test('Import Workbook Parser: group sizes match distribution (40 of 4, 13 of 3, 1 of 2)', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  const size4 = groups.filter(g => g.members.length === 4).length;
  const size3 = groups.filter(g => g.members.length === 3).length;
  const size2 = groups.filter(g => g.members.length === 2).length;

  assert.equal(size4, 40, 'Must have exactly 40 groups of 4');
  assert.equal(size3, 13, 'Must have exactly 13 groups of 3');
  assert.equal(size2, 1, 'Must have exactly 1 group of 2');
  assert.equal(groups.find(g => g.group_no === 54).members.length, 2, 'Group 54 must have 2 members');
});

test('Import Workbook Parser: 15 unique guides assigned matching count sheet quotas', async () => {
  const { groups, countQuotas } = await parseWorkbook(workbookPath);
  const guideCountMap = new Map();
  groups.forEach(g => {
    assert.ok(g.guide_name, `Group ${g.group_no} must have a guide name`);
    guideCountMap.set(g.guide.initials, (guideCountMap.get(g.guide.initials) || 0) + 1);
  });
  assert.equal(guideCountMap.size, 15, 'Must have exactly 15 unique guides');

  CANONICAL_GUIDES.forEach(g => {
    const expected = countQuotas[g.initials] || g.defaultQuota;
    const actual = guideCountMap.get(g.initials) || 0;
    assert.equal(actual, expected, `Guide ${g.initials} (${g.name}) group count must match count sheet quota`);
  });
});

test('Import Edge Case 1: handles duplicate PRNs with prn_status=conflict in separate groups', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  const conflicts = edgeCases.conflictPrns;

  // F23111027: Anuj Nanhe in group 11 and Aditya Survase in group 12
  const g11 = groups.find(g => g.group_no === 11);
  const g12 = groups.find(g => g.group_no === 12);
  const anuj = g11.members.find(m => m.student_name.toLowerCase().includes('anuj'));
  const aditya = g12.members.find(m => m.student_name.toLowerCase().includes('aditya'));
  assert.ok(anuj && anuj.prn === 'F23111027' && anuj.prn_status === 'conflict');
  assert.ok(aditya && aditya.prn === 'F23111027' && aditya.prn_status === 'conflict');

  // F23111054: Prachi Kumar Nailkar in group 2 and Hrishikesh Parshuram Rathod in group 36
  const g2 = groups.find(g => g.group_no === 2);
  const g36 = groups.find(g => g.group_no === 36);
  const prachi = g2.members.find(m => m.student_name.toLowerCase().includes('prachi'));
  const hrishikesh = g36.members.find(m => m.student_name.toLowerCase().includes('hrishikesh'));
  assert.ok(prachi && prachi.prn === 'F23111054' && prachi.prn_status === 'conflict');
  assert.ok(hrishikesh && hrishikesh.prn === 'F23111054' && hrishikesh.prn_status === 'conflict');

  // F23113048: Swanand Sankpal in group 22 and Shrikant Dhore in group 39
  const g22 = groups.find(g => g.group_no === 22);
  const g39 = groups.find(g => g.group_no === 39);
  const swanand = g22.members.find(m => m.student_name.toLowerCase().includes('swanand'));
  const shrikant = g39.members.find(m => m.student_name.toLowerCase().includes('shrikant'));
  assert.ok(swanand && swanand.prn === 'F23113048' && swanand.prn_status === 'conflict');
  assert.ok(shrikant && shrikant.prn === 'F23113048' && shrikant.prn_status === 'conflict');
});

test('Import Edge Case 2: invalid PRN . / .. becomes null with status missing', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  const g53 = groups.find(g => g.group_no === 53);
  assert.ok(g53);
  const omkar = g53.members.find(m => m.student_name.toLowerCase().includes('omkar'));
  assert.ok(omkar);
  assert.equal(omkar.prn, null);
  assert.equal(omkar.prn_status, 'missing');
});

test('Import Edge Case 4: all 7 students with NO form row imported with null contacts without crashing', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  const known7 = ['F23113020', 'F23113028', 'F23113034', 'F23113047', 'F23113050', 'F22111016', 'F22111037'];
  
  known7.forEach(targetPrn => {
    let found = null;
    for (const g of groups) {
      const match = g.members.find(m => m.prn === targetPrn);
      if (match) {
        found = match;
        break;
      }
    }
    assert.ok(found, `Student with PRN ${targetPrn} must exist in groups`);
    assert.equal(found.email, null, `Student ${targetPrn} must have null email`);
    assert.equal(found.mobile, null, `Student ${targetPrn} must have null mobile`);
    assert.equal(found.division, null, `Student ${targetPrn} must have null division`);
  });
});

test('Import Edge Case 5: form-only student F23112060 is NOT in any group and listed in unassigned', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  // Ensure F23112060 is NOT in any group
  for (const g of groups) {
    const hasStudent = g.members.some(m => m.prn === 'F23112060');
    assert.equal(hasStudent, false, `F23112060 must not be assigned to group ${g.group_no}`);
  }
  // Ensure F23112060 is in unassigned list
  const unassigned = edgeCases.unassignedFormSubmissions;
  assert.ok(unassigned.some(u => u.prn === 'F23112060'), 'F23112060 must be in unassignedFormSubmissions');
});

test('Domain Normalization: maps AIML, Data Science, Cybersecurity to canonical values', () => {
  assert.equal(normalizeDomain('AIML').domain, 'AI/ML');
  assert.equal(normalizeDomain('Data Science analysis and Visualization').domain, 'Data Science');
  assert.equal(normalizeDomain('security').domain, 'Cybersecurity');
  assert.equal(normalizeDomain('Web Development').domain, 'Web & Mobile Development');
});
