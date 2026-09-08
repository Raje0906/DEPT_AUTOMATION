import React from 'react';

const gradeClass = {
  'O':  'text-pass font-bold',
  'A+': 'text-pass font-bold',
  'A':  'text-ink font-semibold',
  'B+': 'text-ink font-semibold',
  'B':  'text-ink font-semibold',
  'C':  'text-pending font-semibold',
  'P':  'text-pending font-semibold',
  'F':  'text-fail font-bold',
};

export function StatusBadge({ status }) {
  const map = {
    published:   'badge-published',
    approved:    'badge-approved',
    submitted:   'badge-submitted',
    draft:       'badge-draft',
    not_started: 'badge-not-started',
  };
  const labels = {
    published:   'Published',
    approved:    'Approved',
    submitted:   'Submitted',
    draft:       'Draft',
    not_started: 'Not started',
  };
  return <span className={`badge ${map[status] || 'badge-not-started'}`}>{labels[status] || status}</span>;
}

/**
 * The canonical result table — used across student/faculty/HOD views.
 * Props:
 *   subjects   — array of mark rows
 *   showStatus — show status column (HOD/faculty views)
 *   editable   — show editable inputs (faculty marks entry)
 *   onChange   — called with (studentId, field, value) when input changes
 */
export default function ResultTable({ subjects = [], showStatus = false, compact = false }) {
  if (subjects.length === 0) {
    return (
      <div className="empty-state">
        <p className="text-sm text-draft font-medium">No results to display</p>
        <p className="text-xs text-gray-400 mt-1">Results will appear here once marks have been entered and published.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="result-table">
        <thead>
          <tr>
            <th className="w-12">#</th>
            <th>Subject</th>
            <th>Code</th>
            <th className="numeric">Credits</th>
            <th className="numeric">CIE</th>
            <th className="numeric">Practical</th>
            <th className="numeric">End-Sem</th>
            <th className="numeric">Total</th>
            <th className="text-center">Grade</th>
            <th className="numeric">Grade Points</th>
            {showStatus && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {subjects.map((row, idx) => (
            <tr key={row.subject_id || row.id || idx}>
              <td className="text-gray-400 text-xs">{idx + 1}</td>
              <td>
                <span className="font-medium">{row.subject_name}</span>
                {row.is_backlog && (
                  <span className="ml-2 badge-backlog">Backlog</span>
                )}
              </td>
              <td className="font-mono text-xs text-draft">{row.subject_code || row.code}</td>
              <td className="numeric">{row.credits}</td>
              <td className="numeric">{row.cie_marks != null ? Number(row.cie_marks).toFixed(0) : '—'}</td>
              <td className="numeric">
                {row.has_practical === false
                  ? <span className="text-gray-300">—</span>
                  : (row.practical_marks != null ? Number(row.practical_marks).toFixed(0) : '—')}
              </td>
              <td className="numeric">{row.end_sem_marks != null ? Number(row.end_sem_marks).toFixed(0) : '—'}</td>
              <td className="numeric font-semibold">{row.total != null ? Number(row.total).toFixed(0) : '—'}</td>
              <td className="text-center">
                <span className={gradeClass[row.grade] || ''}>
                  {row.grade || '—'}
                </span>
              </td>
              <td className="numeric text-draft">{row.grade_points != null ? Number(row.grade_points).toFixed(1) : '—'}</td>
              {showStatus && (
                <td><StatusBadge status={row.status} /></td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
