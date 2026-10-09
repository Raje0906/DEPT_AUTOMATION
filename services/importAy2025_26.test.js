'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseWorkbook, normalizeDomain, cleanPrn } = require('../scripts/import_ay2025_26_sem1');

const workbookPath = path.resolve(__dirname, '../data/TE_Seminar_Project_Group_formation.xlsx');

test('Import Workbook Parser: loads exactly 54 groups and 202 students', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  assert.equal(groups.length, 54);
  const totalStudents = groups.reduce((acc, g) => acc + g.members.length, 0);
  assert.equal(totalStudents, 202);
});

test('Import Workbook Parser: group sizes match distribution (41 of 4, 12 of 3, 1 of 2)', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  const size4 = groups.filter(g => g.members.length === 4).length;
  const size3 = groups.filter(g => g.members.length === 3).length;
  const size2 = groups.filter(g => g.members.length === 2).length;

  assert.equal(size4, 41);
  assert.equal(size3, 12);
  assert.equal(size2, 1);
  assert.equal(groups.find(g => g.group_no === 54).members.length, 2);
});

test('Import Workbook Parser: 15 unique guides assigned across all 54 groups', async () => {
  const { groups } = await parseWorkbook(workbookPath);
  const guideMap = new Map();
  groups.forEach(g => {
    assert.ok(g.guide_name, `Group ${g.group_no} must have a guide name`);
    guideMap.set(g.guide_name, (guideMap.get(g.guide_name) || 0) + 1);
  });
  assert.equal(guideMap.size, 15);
});

test('Import Edge Case 1: handles duplicate PRNs with prn_status=conflict', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  const conflicts = edgeCases.conflictPrns;

  assert.ok(conflicts.some(c => c.prn === 'F23111027' && c.name.includes('Anuj Nanhe')));
  assert.ok(conflicts.some(c => c.prn === 'F23111027' && c.name.includes('Aditya Survase')));
  assert.ok(conflicts.some(c => c.prn === 'F23111054' && c.name.includes('Prachi Kumar Nailkar')));
  assert.ok(conflicts.some(c => c.prn === 'F23111054' && c.name.includes('Hrishikesh Parshuram Rathod')));
  assert.ok(conflicts.some(c => c.prn === 'F23113048' && c.name.toLowerCase().includes('swanand')));
  assert.ok(conflicts.some(c => c.prn === 'F23113048' && c.name.toLowerCase().includes('shrikant')));
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

test('Import Edge Case 4: students with NO form row imported with null contacts without crashing', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  const noForm = edgeCases.noFormStudents;

  assert.ok(noForm.some(s => s.prn === 'F23113047'));
  assert.ok(noForm.some(s => s.prn === 'F23113034'));
  assert.ok(noForm.some(s => s.prn === 'F23113050'));
  assert.ok(noForm.some(s => s.prn === 'F23113020'));
  assert.ok(noForm.some(s => s.prn === 'F22111016'));
  assert.ok(noForm.some(s => s.prn === 'F22111037'));
});

test('Import Edge Case 5: form-only student F23112060 listed as unassigned form submission', async () => {
  const { groups, edgeCases } = await parseWorkbook(workbookPath);
  const unassigned = edgeCases.unassignedFormSubmissions;
  assert.ok(unassigned.some(u => u.prn === 'F23112060'));
});

test('Domain Normalization: maps AIML, Data Science, and Cybersecurity to canonical values', () => {
  assert.equal(normalizeDomain('AIML').domain, 'AI/ML');
  assert.equal(normalizeDomain('Data Science analysis and Visualization').domain, 'Data Science');
  assert.equal(normalizeDomain('security').domain, 'Cybersecurity');
  assert.equal(normalizeDomain('Web Development').domain, 'Software Development / Web / Mobile App');
});
