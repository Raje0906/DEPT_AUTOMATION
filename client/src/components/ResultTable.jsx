import React from 'react';

export const gradeClass = {
  'O':  'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200',
  'A+': 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200',
  'A':  'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200',
  'B+': 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200',
  'B':  'text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200',
  'C':  'text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200',
  'P':  'text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200',
  'F':  'text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold border border-red-200',
};

export function StatusBadge({ status }) {
  const map = {
    published:   'bg-emerald-100 text-emerald-800 border-emerald-300',
    approved:    'bg-blue-100 text-blue-800 border-blue-300',
    submitted:   'bg-amber-100 text-amber-800 border-amber-300',
    draft:       'bg-gray-100 text-gray-700 border-gray-300',
    not_started: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const labels = {
    published:   'Published',
    approved:    'Approved',
    submitted:   'Submitted for Approval',
    draft:       'Draft',
    not_started: 'Not Started',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] || map.not_started}`}>
      {labels[status] || status}
    </span>
  );
}

/**
 * Universal Result Table component supporting:
 * - 'final': Consolidated Final Result
 * - 'internal': Unit Test 1, Unit Test 2, Mock Theory, Mock Practical (No impact on final result)
 * - 'term_work': Attendance, Assignments, Timely Submission, Total TW
 * - 'university': Insem, Endsem, Final Practical
 */
export default function ResultTable({ subjects = [], mode = 'final', showStatus = false }) {
  if (!subjects || subjects.length === 0) {
    return (
      <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
        <p className="text-sm font-medium text-gray-600">No results to display</p>
        <p className="text-xs text-gray-400 mt-1">Results will appear here once marks have been entered and published.</p>
      </div>
    );
  }

  // 1. FINAL CONSOLIDATED VIEW
  if (mode === 'final') {
    return (
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-10">#</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-center">Type</th>
              <th className="px-4 py-3 text-right">Credits</th>
              <th className="px-4 py-3 text-right">Insem / TW</th>
              <th className="px-4 py-3 text-right">Endsem / PR</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 text-center">Grade</th>
              <th className="px-4 py-3 text-right">Points</th>
              {showStatus && <th className="px-4 py-3 text-center">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subjects.map((row, idx) => {
              const isInsem = row.exams?.insem !== null && row.exams?.insem !== undefined;
              const isEndsem = row.exams?.endsem !== null && row.exams?.endsem !== undefined;
              const isTW = row.exams?.term_work !== null && row.exams?.term_work !== undefined;
              const isPR = row.exams?.final_practical !== null && row.exams?.final_practical !== undefined;

              const col1 = isInsem ? `${row.exams.insem} / 30` : (isTW ? `${row.exams.term_work} / ${row.subjectType === 'seminar' ? 50 : 25}` : '—');
              const col2 = isEndsem ? `${row.exams.endsem} / 70` : (isPR ? `${row.exams.final_practical} / 25` : (row.subjectType === 'seminar' ? 'N/A' : '—'));

              return (
                <tr key={row.subjectId || row.id || idx} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.subjectName}
                    {row.isBacklog && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 font-bold rounded">Backlog</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.subjectCode}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded uppercase font-semibold bg-slate-100 text-slate-600">
                      {row.subjectType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{row.credits}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">{col1}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-mono">{col2}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                    {row.totalObtained !== null ? `${row.totalObtained} / ${row.maxMarks}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={gradeClass[row.grade] || 'text-gray-400'}>
                      {row.grade || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.gradePoints !== null ? Number(row.gradePoints).toFixed(1) : '—'}
                  </td>
                  {showStatus && (
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.status || (row.isComplete ? 'published' : 'draft')} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // 2. INTERNAL ASSESSMENTS VIEW (UT1, UT2, Mock Theory, Mock Practical)
  if (mode === 'internal') {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
          <span className="font-semibold">Internal Continuous Assessments</span>
          <span className="text-amber-700">📌 These exams track preparation and have <strong>no impact</strong> on the final semester result.</span>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-right">Unit Test 1 (30)</th>
                <th className="px-4 py-3 text-right">Unit Test 2 (30)</th>
                <th className="px-4 py-3 text-right">Mock Theory (70)</th>
                <th className="px-4 py-3 text-right">Mock Practical (25)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subjects.map((row, idx) => (
                <tr key={row.subjectId || row.id || idx} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.subjectName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.subjectCode}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.exams?.unit_test_1 != null ? `${row.exams.unit_test_1} / 30` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.exams?.unit_test_2 != null ? `${row.exams.unit_test_2} / 30` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.subjectType === 'theory'
                      ? (row.exams?.mock_theory != null ? `${row.exams.mock_theory} / 70` : <span className="text-gray-300">—</span>)
                      : <span className="text-gray-300">N/A</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {row.subjectType === 'practical'
                      ? (row.exams?.mock_practical != null ? `${row.exams.mock_practical} / 25` : <span className="text-gray-300">—</span>)
                      : <span className="text-gray-300">N/A</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 3. TERM WORK VIEW (Attendance, Assignment 1, Assignment 2, Timely Submission, Total TW)
  if (mode === 'term_work') {
    const twSubjects = subjects.filter(s => s.subjectType === 'practical' || s.subjectType === 'seminar' || s.exams?.term_work != null);
    return (
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
          <span className="font-semibold">Term Work Evaluation Breakdown</span>
          <span>Calculated from Attendance (5), Assignment 1 (7), Assignment 2 (7), and Timely Submission (6).</span>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-right">Attendance (5)</th>
                <th className="px-4 py-3 text-right">Assignment 1 (7)</th>
                <th className="px-4 py-3 text-right">Assignment 2 (7)</th>
                <th className="px-4 py-3 text-right">Timely Submission (6)</th>
                <th className="px-4 py-3 text-right font-bold">Total TW (25)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {twSubjects.map((row, idx) => {
                const tw = row.termWorkDetail || {};
                const totalTW = row.exams?.term_work ?? tw.total_tw_marks ?? null;
                return (
                  <tr key={row.subjectId || row.id || idx} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.subjectName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.subjectCode}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {tw.attendance_marks != null ? `${tw.attendance_marks} / 5` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {tw.assignment_1_marks != null ? `${tw.assignment_1_marks} / 7` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {tw.assignment_2_marks != null ? `${tw.assignment_2_marks} / 7` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {tw.timely_submission_marks != null ? `${tw.timely_submission_marks} / 6` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                      {totalTW != null ? `${totalTW} / ${row.subjectType === 'seminar' ? 50 : 25}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 4. UNIVERSITY EXAMS VIEW (Insem, Endsem, Final Practical)
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left w-10">#</th>
            <th className="px-4 py-3 text-left">Subject</th>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-right">Insem Exam (30)</th>
            <th className="px-4 py-3 text-right">Endsem Exam (70)</th>
            <th className="px-4 py-3 text-right">Final Practical/Oral (25)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {subjects.map((row, idx) => (
            <tr key={row.subjectId || row.id || idx} className="hover:bg-gray-50/75 transition-colors">
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{row.subjectName}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.subjectCode}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {row.exams?.insem != null ? `${row.exams.insem} / 30` : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {row.exams?.endsem != null ? `${row.exams.endsem} / 70` : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {row.exams?.final_practical != null ? `${row.exams.final_practical} / 25` : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
