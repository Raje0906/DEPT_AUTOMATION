'use strict';

const XLSX = require('xlsx');

const INSTITUTION = 'MES Wadia College of Engineering, Pune';
const DEPARTMENT  = 'Department of Computer Engineering';

const COL = { groupNo: 0, domain: 1, guide: 2, name: 3, prn: 4, topic1: 5, topic2: 6, topic3: 7, finalTopic: 8 };
const NUM_COLS = 9;

function getExportLifecycleLabel(session, groupCount) {
  if (session?.status === 'PUBLISHED') {
    const pubDate = session.published_at ? new Date(session.published_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    return `Final — Published ${pubDate}`;
  }
  if (session?.is_locked || session?.status === 'LOCKED') {
    const lockDate = session.locked_at ? new Date(session.locked_at).toLocaleDateString('en-GB') : '';
    return `Draft — Registration Locked${lockDate ? ' [' + lockDate + ']' : ''} (${groupCount} groups)`;
  }
  return `Draft — Registration Open (${groupCount} groups)`;
}

/**
 * Build the XLSX workbook with institution header, column headers, and merged group cells.
 * @param {Object} session - seminar session record
 * @param {Array} groups - array of { id, group_no, domain, guide_name }
 * @param {Map<number, Array>} membersByGroupId - Map from group.id to array of student member objects
 * @returns {Buffer} XLSX file buffer
 */
function buildWorkbook(session, groups, membersByGroupId) {
  const wb = XLSX.utils.book_new();
  const wsData = [];
  const merges = [];
  const emptyRow = () => new Array(NUM_COLS).fill('');

  // Header rows
  wsData.push([INSTITUTION, ...new Array(NUM_COLS - 1).fill('')]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NUM_COLS - 1 } });

  wsData.push([DEPARTMENT, ...new Array(NUM_COLS - 1).fill('')]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: NUM_COLS - 1 } });

  const lifecycleLabel = getExportLifecycleLabel(session, groups.length);
  const title = `${session?.name || 'TE Seminar'} — Guide Assignment List [${lifecycleLabel}]`;
  wsData.push([title, ...new Array(NUM_COLS - 1).fill('')]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: NUM_COLS - 1 } });

  // Column headers
  wsData.push(['Group No.', 'Domain', 'Guide', 'Student Name', 'PRN', 'Topic 1', 'Topic 2', 'Topic 3', 'Final Topic']);

  let currentRow = 4;

  for (const group of groups) {
    const members = membersByGroupId.get(group.id) || [];
    if (members.length === 0) continue;
    const groupStartRow = currentRow;

    members.forEach((m, mi) => {
      const row = new Array(NUM_COLS).fill('');
      if (mi === 0) {
        row[COL.groupNo] = group.group_no;
        row[COL.domain]  = group.domain || '';
        row[COL.guide]   = group.guide_name || 'Unassigned';
      }
      row[COL.name]       = m.student_name || '';
      row[COL.prn]        = m.university_prn || m.prn || '';
      row[COL.topic1]     = m.topic1 || '';
      row[COL.topic2]     = m.topic2 || '';
      row[COL.topic3]     = m.topic3 || '';
      row[COL.finalTopic] = m.final_topic || group.final_topic || '';
      wsData.push(row);
      currentRow++;
    });

    if (members.length > 1) {
      [COL.groupNo, COL.domain, COL.guide].forEach(col => {
        merges.push({ s: { r: groupStartRow, c: col }, e: { r: currentRow - 1, c: col } });
      });
    }

    // Blank separator row between groups
    wsData.push(emptyRow());
    currentRow++;
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 26 },
    { wch: 28 }, { wch: 18 }, { wch: 35 }, { wch: 35 }, { wch: 35 }, { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Group List');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Build official Seminar Evaluation Marksheet XLSX workbook
 * @param {Object} session - seminar session record
 * @param {Array} rows - array of evaluated student objects with marks and guide info
 * @returns {Buffer} XLSX file buffer
 */
function buildMarksWorkbook(session, rows) {
  const wb = XLSX.utils.book_new();
  const wsData = [];
  const merges = [];
  const NUM_MARKS_COLS = 14;

  // Header rows
  wsData.push([INSTITUTION, ...new Array(NUM_MARKS_COLS - 1).fill('')]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: NUM_MARKS_COLS - 1 } });

  wsData.push([DEPARTMENT, ...new Array(NUM_MARKS_COLS - 1).fill('')]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: NUM_MARKS_COLS - 1 } });

  const title = `${session?.name || 'TE Seminar'} — Official Evaluation Marksheet (${session?.academic_year || ''} - Batch ${session?.batch || ''})`;
  wsData.push([title, ...new Array(NUM_MARKS_COLS - 1).fill('')]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: NUM_MARKS_COLS - 1 } });

  // Column headers
  wsData.push([
    'Sr No',
    'Group #',
    'PRN / Roll No',
    'Student Name',
    'Div',
    'Seminar Guide',
    'Attendance (/10)',
    'Presentation (/10)',
    'Subject Understanding (/10)',
    'Publication (/10)',
    'Viva (/10)',
    'Total (/50)',
    'Status',
    'Evaluation Date'
  ]);

  rows.forEach((r, idx) => {
    wsData.push([
      idx + 1,
      r.group_no ? `#${r.group_no}` : '-',
      r.prn || '',
      r.student_name || '',
      r.division || '',
      r.guide_name || 'Unassigned',
      r.attendance_marks != null ? Number(r.attendance_marks) : '-',
      r.presentation_marks != null ? Number(r.presentation_marks) : '-',
      r.subject_understanding_marks != null ? Number(r.subject_understanding_marks) : '-',
      r.publication_marks != null ? Number(r.publication_marks) : '-',
      r.viva_marks != null ? Number(r.viva_marks) : '-',
      r.total_marks != null ? Number(r.total_marks) : '-',
      r.marks_status || 'NOT_STARTED',
      r.evaluation_date ? new Date(r.evaluation_date).toLocaleDateString('en-GB') : (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-GB') : '-')
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 8 },  // Sr No
    { wch: 10 }, // Group No
    { wch: 16 }, // PRN
    { wch: 28 }, // Student Name
    { wch: 8 },  // Div
    { wch: 24 }, // Guide
    { wch: 16 }, // Attendance
    { wch: 18 }, // Presentation
    { wch: 26 }, // Subject Understanding
    { wch: 16 }, // Publication
    { wch: 14 }, // Viva
    { wch: 14 }, // Total
    { wch: 14 }, // Status
    { wch: 16 }  // Date
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Marksheet');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Build consolidated Guide Evaluation Sheet matching the exact specification:
 * Group Number | Student Name | University PRN | Sign | Final Topic | Domain | Guide Name | [Metric columns] | Total
 * Merged cells for Group Number, Guide Name, Final Topic, Domain.
 */
function buildConsolidatedEvaluationWorkbook(session, guide, groups, metrics, marksMap = {}) {
  const wb = XLSX.utils.book_new();
  const wsData = [];
  const merges = [];

  const metricList = Array.isArray(metrics) && metrics.length > 0 ? metrics : [
    { name: 'Literature Survey', max_marks: 5 },
    { name: 'Report Writing', max_marks: 5 },
    { name: 'Topic Understanding', max_marks: 5 },
    { name: 'Attendance & Active Participation', max_marks: 5 },
    { name: 'Presentation Skill', max_marks: 5 },
  ];

  const totalMax = metricList.reduce((acc, m) => acc + Number(m.max_marks || 0), 0);
  const totalCols = 7 + metricList.length + 1; // 7 base cols + metrics + 1 total

  // Header 1: Institution
  wsData.push([INSTITUTION, ...new Array(totalCols - 1).fill('')]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

  // Header 2: Department
  wsData.push([DEPARTMENT, ...new Array(totalCols - 1).fill('')]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

  // Header 3: Sheet Title & Academic Year
  const title = `TE SEMINAR EVALUATION SHEET — ${session?.name || 'AY 2025-26 Sem 1'}`;
  wsData.push([title, ...new Array(totalCols - 1).fill('')]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } });

  // Header 4: Guide & Examiner Info
  const guideName = guide?.name || 'Assigned Guide';
  const examinerName = guide?.examiner_name || 'Not assigned yet';
  const metaText = `Guide Name: ${guideName}        |        Assigned Examiner: ${examinerName}`;
  wsData.push([metaText, ...new Array(totalCols - 1).fill('')]);
  merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } });

  // Empty separator
  wsData.push(new Array(totalCols).fill(''));

  // Column Header Row
  const headerCols = [
    'Group Number',
    'Student Name',
    'University PRN',
    'Sign',
    'Final Topic',
    'Domain',
    'Guide Name',
    ...metricList.map(m => `${m.name} (${Number(m.max_marks)})`),
    `Total (${totalMax})`
  ];
  wsData.push(headerCols);

  let currentRow = 5; // header row is at index 5

  for (const grp of groups) {
    const members = Array.isArray(grp.members) && grp.members.length > 0 ? grp.members : [{ student_name: '—', prn: '—' }];
    const groupStartRow = currentRow + 1; // first student row
    const groupNoText = grp.group_no ? `Group #${grp.group_no}` : '—';
    const finalTopicText = grp.final_topic || grp.topic || (members[0]?.topic1 || '—');
    const domainText = grp.domain || 'General Computing';
    const grpGuideName = grp.guide_name || guideName;

    members.forEach((m, mi) => {
      currentRow++;
      const prnVal = m.university_prn || m.prn || '';
      const marksRecord = marksMap[prnVal] || {};
      const metricScores = marksRecord.metric_scores || {};

      let studentTotal = 0;
      const metricCells = metricList.map(metric => {
        const val = metricScores[metric.name] ?? metricScores[metric.id];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          studentTotal += num;
          return num;
        }
        return '';
      });

      const totalVal = marksRecord.total_marks != null ? Number(marksRecord.total_marks) : (studentTotal > 0 ? studentTotal : '');

      const row = [
        groupNoText,
        m.student_name || '',
        prnVal,
        '', // Sign placeholder
        finalTopicText,
        domainText,
        grpGuideName,
        ...metricCells,
        totalVal !== '' ? totalVal : ''
      ];
      wsData.push(row);
    });

    const groupEndRow = currentRow;
    if (members.length > 1) {
      // Merge Group Number (col 0), Final Topic (col 4), Domain (col 5), Guide Name (col 6)
      [0, 4, 5, 6].forEach(colIdx => {
        merges.push({
          s: { r: groupStartRow, c: colIdx },
          e: { r: groupEndRow, c: colIdx }
        });
      });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 14 }, // Group Number
    { wch: 28 }, // Student Name
    { wch: 18 }, // University PRN
    { wch: 12 }, // Sign
    { wch: 38 }, // Final Topic
    { wch: 24 }, // Domain
    { wch: 26 }, // Guide Name
    ...metricList.map(() => ({ wch: 18 })), // Metric cols
    { wch: 14 }  // Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Evaluation Sheet');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  buildWorkbook,
  buildMarksWorkbook,
  buildConsolidatedEvaluationWorkbook,
  getExportLifecycleLabel
};