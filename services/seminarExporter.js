'use strict';

const XLSX = require('xlsx');

const INSTITUTION = 'MES Wadia College of Engineering, Pune';
const DEPARTMENT  = 'Department of Computer Engineering';

const COL = { groupNo: 0, domain: 1, guide: 2, name: 3, prn: 4, topic1: 5, topic2: 6, topic3: 7 };
const NUM_COLS = 8;

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
  wsData.push(['Group No.', 'Domain', 'Guide', 'Student Name', 'PRN', 'Topic 1', 'Topic 2', 'Topic 3']);

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
      row[COL.name]   = m.student_name || '';
      row[COL.prn]    = m.prn || '';
      row[COL.topic1] = m.topic1 || '';
      row[COL.topic2] = m.topic2 || '';
      row[COL.topic3] = m.topic3 || '';
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
    { wch: 10 }, { wch: 32 }, { wch: 28 },
    { wch: 30 }, { wch: 16 }, { wch: 40 }, { wch: 40 }, { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Group List');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildWorkbook, getExportLifecycleLabel };