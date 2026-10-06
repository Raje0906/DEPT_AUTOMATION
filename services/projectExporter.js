'use strict';

const ExcelJS = require('exceljs');

const rawFormHeaders = [
  'Timestamp',
  'Email Address',
  'Name of Student-1',
  'Student-1 PRN No (College PRN)',
  'Student 1 Division',
  'Student 1 Mobile No',
  'Student 1 Email ID',
  'Name of Student-2',
  'Student-2 PRN No (College PRN)',
  'Student 2 Division',
  'Student 2 Mobile No',
  'Student 2 Email ID',
  'Name of Student-3',
  'Student-3 PRN No (College PRN)',
  'Student 3 Division',
  'Student 3 Mobile No',
  'Student 3 Email ID',
  'Name of Student-4',
  'Student-4 PRN No (College PRN)',
  'Student 4 Division',
  'Student 4 Mobile No',
  'Student 4 Email ID',
  'Domain Name',
  'Project Topic 1',
  'Project Topic 2',
  'Project Topic 3',
  'Guide Name'
];

/**
 * Add Form Responses 1 Worksheet with Purple Header & Styling
 */
function addFormResponsesWorksheet(workbook, groups) {
  const sheet = workbook.addWorksheet('Form Responses 1', {
    properties: { tabColor: { argb: 'FF673AB7' } }
  });

  sheet.columns = [
    { header: 'Timestamp', key: 'ts', width: 20 },
    { header: 'Email Address', key: 'email', width: 28 },
    // Student 1
    { header: 'Name of Student-1', key: 's1_name', width: 25 },
    { header: 'Student-1 PRN No (College PRN)', key: 's1_prn', width: 16 },
    { header: 'Student 1 Division', key: 's1_div', width: 12 },
    { header: 'Student 1 Mobile No', key: 's1_mob', width: 16 },
    { header: 'Student 1 Email ID', key: 's1_email', width: 28 },
    // Student 2
    { header: 'Name of Student-2', key: 's2_name', width: 25 },
    { header: 'Student-2 PRN No (College PRN)', key: 's2_prn', width: 16 },
    { header: 'Student 2 Division', key: 's2_div', width: 12 },
    { header: 'Student 2 Mobile No', key: 's2_mob', width: 16 },
    { header: 'Student 2 Email ID', key: 's2_email', width: 28 },
    // Student 3
    { header: 'Name of Student-3', key: 's3_name', width: 25 },
    { header: 'Student-3 PRN No (College PRN)', key: 's3_prn', width: 16 },
    { header: 'Student 3 Division', key: 's3_div', width: 12 },
    { header: 'Student 3 Mobile No', key: 's3_mob', width: 16 },
    { header: 'Student 3 Email ID', key: 's3_email', width: 28 },
    // Student 4
    { header: 'Name of Student-4', key: 's4_name', width: 25 },
    { header: 'Student-4 PRN No (College PRN)', key: 's4_prn', width: 16 },
    { header: 'Student 4 Division', key: 's4_div', width: 12 },
    { header: 'Student 4 Mobile No', key: 's4_mob', width: 16 },
    { header: 'Student 4 Email ID', key: 's4_email', width: 28 },
    // Domain, Topics, Guide
    { header: 'Domain Name', key: 'domain', width: 30 },
    { header: 'Project Topic 1', key: 't1', width: 45 },
    { header: 'Project Topic 2', key: 't2', width: 45 },
    { header: 'Project Topic 3', key: 't3', width: 45 },
    { header: 'Guide Name', key: 'guide', width: 28 }
  ];

  // Style Header Row (Row 1) with PURPLE Fill Background (#673AB7) & WHITE Bold Text
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF673AB7' }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF512DA8' } },
      bottom: { style: 'medium', color: { argb: 'FF512DA8' } },
      left: { style: 'thin', color: { argb: 'FFD1C4E9' } },
      right: { style: 'thin', color: { argb: 'FFD1C4E9' } }
    };
  });

  // Data rows
  groups.forEach((group) => {
    const members = group.members || [];
    const leader = members.find(m => m.is_leader) || members[0] || {};

    let tsStr = '';
    if (group.created_at) {
      const dt = new Date(group.created_at);
      if (!isNaN(dt.getTime())) {
        const datePart = `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
        const timePart = dt.toTimeString().split(' ')[0];
        tsStr = `${datePart} ${timePart}`;
      }
    }

    const rowValues = [
      tsStr,
      leader.email || group.created_by_email || ''
    ];

    for (let i = 0; i < 4; i++) {
      const m = members[i] || {};
      rowValues.push(m.student_name || m.name || '');
      rowValues.push(m.roll_no || m.prn || '');
      rowValues.push(m.division || '');
      rowValues.push(m.mobile_no || '');
      rowValues.push(m.email || '');
    }

    rowValues.push(group.domain || '');
    rowValues.push(group.title || '');
    rowValues.push(group.title_2 || '');
    rowValues.push(group.title_3 || '');
    rowValues.push(group.guide_name || group.proposed_guide_name || '');

    const addedRow = sheet.addRow(rowValues);
    addedRow.height = 20;
    addedRow.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    });
  });
}

/**
 * Add Guide Assignments Worksheet with Matrix Layout & Merged Cells
 */
function addGuideAssignmentsWorksheet(workbook, groups) {
  const sheet = workbook.addWorksheet('Guide Assignments');

  sheet.columns = [
    { header: 'Group No', key: 'gno', width: 12 },
    { header: 'Name of Student', key: 'sname', width: 30 },
    { header: 'College PRN', key: 'prn', width: 16 },
    { header: 'Division', key: 'div', width: 12 },
    { header: 'Domain Name', key: 'domain', width: 32 },
    { header: 'Guide Name', key: 'guide', width: 28 },
    { header: '3 Project Topics', key: 'topics', width: 80 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF1B5E20' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFA5D6A7' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
      left: { style: 'thin', color: { argb: 'FFA5D6A7' } },
      right: { style: 'thin', color: { argb: 'FFA5D6A7' } }
    };
  });

  let currentRow = 2;

  groups.forEach((group, gIdx) => {
    const members = group.members || [];
    const groupNum = group.group_code ? (parseInt(group.group_code.split('-').pop(), 10) || (gIdx + 1)) : (gIdx + 1);
    const guideName = group.guide_name || group.proposed_guide_name || '';
    const domainName = group.domain || '';
    const groupDiv = members[0]?.division || 'BE-1';

    const maxRows = Math.max(members.length, 3);
    const groupStartRow = currentRow;

    for (let r = 0; r < maxRows; r++) {
      const m = members[r] || {};
      let topicText = '';
      if (r === 0 && group.title) topicText = `1. ${group.title}`;
      else if (r === 1 && group.title_2) topicText = `2. ${group.title_2}`;
      else if (r === 2 && group.title_3) topicText = `3. ${group.title_3}`;

      const rowValues = [
        r === 0 ? groupNum : '',
        m.name || m.student_name || '',
        m.roll_no || m.prn || '',
        m.division || groupDiv,
        r === 0 ? domainName : '',
        r === 0 ? guideName : '',
        topicText
      ];

      const row = sheet.addRow(rowValues);
      row.height = 20;

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNum === 2 || colNum === 7) ? 'left' : 'center',
          wrapText: colNum === 7
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
      });

      currentRow++;
    }

    if (maxRows > 1) {
      sheet.mergeCells(`A${groupStartRow}:A${currentRow - 1}`);
      sheet.mergeCells(`E${groupStartRow}:E${currentRow - 1}`);
      sheet.mergeCells(`F${groupStartRow}:F${currentRow - 1}`);
    }

    const emptyRow = sheet.addRow(['', '', '', '', '', '', '']);
    emptyRow.height = 12;
    currentRow++;
  });
}

/**
 * Add Score Report Worksheet with Matrix Layout & Merged Cells (Similar to Guide Assignments)
 */
function addScoreReportWorksheet(workbook, groups, stages = []) {
  const sheet = workbook.addWorksheet('Score Report');

  const columns = [
    { header: 'Group No', key: 'gno', width: 12 },
    { header: 'Name of Student', key: 'sname', width: 30 },
    { header: 'College PRN', key: 'prn', width: 16 },
    { header: 'Domain Name', key: 'domain', width: 30 },
    { header: 'Guide Name', key: 'guide', width: 28 },
    { header: '3 Project Topics', key: 'topics', width: 70 }
  ];

  stages.forEach((st) => {
    columns.push({
      header: `${st.name} (${st.max_marks_total || 50})`,
      key: `stage_${st.id}`,
      width: 18
    });
  });

  columns.push({ header: 'Total Aggregate', key: 'total_aggregate', width: 18 });

  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF1B5E20' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFA5D6A7' } },
      bottom: { style: 'medium', color: { argb: 'FF2E7D32' } },
      left: { style: 'thin', color: { argb: 'FFA5D6A7' } },
      right: { style: 'thin', color: { argb: 'FFA5D6A7' } }
    };
  });

  let currentRow = 2;

  groups.forEach((group, gIdx) => {
    const members = group.members || [];
    const groupNum = group.group_code ? (parseInt(group.group_code.split('-').pop(), 10) || (gIdx + 1)) : (gIdx + 1);
    const guideName = group.guide_name || group.proposed_guide_name || 'Unassigned';
    const domainName = group.domain || '';

    const maxRows = Math.max(members.length, 3);
    const groupStartRow = currentRow;

    for (let r = 0; r < maxRows; r++) {
      const m = members[r] || {};
      let topicText = '';
      if (r === 0 && group.title) topicText = `1. ${group.title}`;
      else if (r === 1 && group.title_2) topicText = `2. ${group.title_2}`;
      else if (r === 2 && group.title_3) topicText = `3. ${group.title_3}`;

      const rowValues = [
        r === 0 ? groupNum : '',
        m.name || m.student_name || '',
        m.roll_no || m.prn || '',
        r === 0 ? domainName : '',
        r === 0 ? guideName : '',
        topicText
      ];

      if (m.name || m.student_name || m.id) {
        let studentTotal = 0;
        let hasAnyMarks = false;

        stages.forEach((st) => {
          const scoreVal = m.stage_scores?.[st.id];
          if (scoreVal !== undefined && scoreVal !== null && scoreVal !== 'N/A') {
            const numVal = Number(scoreVal);
            if (!isNaN(numVal)) {
              rowValues.push(numVal);
              studentTotal += numVal;
              hasAnyMarks = true;
            } else {
              rowValues.push(scoreVal);
            }
          } else {
            rowValues.push('N/A');
          }
        });

        rowValues.push(hasAnyMarks ? Number(studentTotal.toFixed(2)) : 'N/A');
      } else {
        stages.forEach(() => rowValues.push(''));
        rowValues.push('');
      }

      const row = sheet.addRow(rowValues);
      row.height = 20;

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        const isNumericCol = colNum > 6;
        cell.alignment = {
          vertical: 'middle',
          horizontal: isNumericCol ? 'center' : ((colNum === 2 || colNum === 6) ? 'left' : 'center'),
          wrapText: colNum === 6
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        };
      });

      currentRow++;
    }

    if (maxRows > 1) {
      sheet.mergeCells(`A${groupStartRow}:A${currentRow - 1}`);
      sheet.mergeCells(`D${groupStartRow}:D${currentRow - 1}`);
      sheet.mergeCells(`E${groupStartRow}:E${currentRow - 1}`);
    }

    const emptyRow = sheet.addRow(new Array(columns.length).fill(''));
    emptyRow.height = 12;
    currentRow++;
  });
}

/**
 * Build Form Responses Workbook with Form Responses 1 as Tab 1
 */
async function buildFormResponsesWorkbook(groups, academicYear = '2026-27') {
  const workbook = new ExcelJS.Workbook();
  addFormResponsesWorksheet(workbook, groups);
  addGuideAssignmentsWorksheet(workbook, groups);
  return await workbook.xlsx.writeBuffer();
}

/**
 * Build Guide Assignments Workbook with Guide Assignments as Tab 1
 */
async function buildGuideAssignmentsWorkbook(groups, academicYear = '2026-27') {
  const workbook = new ExcelJS.Workbook();
  addGuideAssignmentsWorksheet(workbook, groups);
  addFormResponsesWorksheet(workbook, groups);
  return await workbook.xlsx.writeBuffer();
}

/**
 * Build Score Report Workbook with Score Report as Tab 1
 */
async function buildScoreReportWorkbook(groups, stages, academicYear = '2026-27') {
  const workbook = new ExcelJS.Workbook();
  addScoreReportWorksheet(workbook, groups, stages);
  addGuideAssignmentsWorksheet(workbook, groups);
  addFormResponsesWorksheet(workbook, groups);
  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  buildFormResponsesWorkbook,
  buildGuideAssignmentsWorkbook,
  buildScoreReportWorkbook,
  addFormResponsesWorksheet,
  addGuideAssignmentsWorksheet,
  addScoreReportWorksheet
};

