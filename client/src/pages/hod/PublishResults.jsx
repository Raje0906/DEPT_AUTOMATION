import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/ResultTable';

export default function PublishResults() {
  const [dashData, setDashData]         = useState(null);
  const [matrixData, setMatrixData]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [publishing, setPublishing]     = useState(false);
  const [target, setTarget]             = useState({ semester: '5', academicYear: '2025-26', division: 'TE 1' });
  const [activeView, setActiveView]     = useState('publish'); // 'publish' | 'matrix'

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get(`/hod/dashboard?academic_year=${encodeURIComponent(target.academicYear)}&semester=${target.semester}`),
      api.get(`/hod/exam-completion-status?academic_year=${encodeURIComponent(target.academicYear)}&semester=${target.semester}`)
    ])
      .then(([dashRes, matrixRes]) => {
        setDashData(dashRes.data);
        setMatrixData(matrixRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [target.semester, target.academicYear]);

  const handlePublish = async () => {
    if (!window.confirm(`Publish official Semester ${target.semester} results for ${target.division}? Students will be able to view their final mark sheets.`)) {
      return;
    }

    setPublishing(true);
    try {
      const res = await api.post('/hod/publish', {
        semester: parseInt(target.semester, 10),
        academicYear: target.academicYear,
        division: target.division,
        confirmPublish: true,
      });
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const subjects = dashData?.subjects || [];
  const targetSubjects = subjects.filter(s =>
    String(s.semester) === String(target.semester) && s.division === target.division
  );
  const isAlreadyPublished = targetSubjects.length > 0 && targetSubjects.every(s => s.status === 'published');

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">Publish Academic Results</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Review exam completion status across all subjects and publish final semester results.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('publish')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeView === 'publish' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🚀 Publish Console
          </button>
          <button
            onClick={() => setActiveView('matrix')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              activeView === 'matrix' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Exam Completion Matrix
          </button>
        </div>
      </div>

      {/* Target Selection Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Target Evaluation Batch</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Semester</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              value={target.semester}
              onChange={e => setTarget(t => ({ ...t, semester: e.target.value }))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>
                  Semester {s} {s === 5 ? '(TE Sem 1)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Academic Year</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              value={target.academicYear}
              onChange={e => setTarget(t => ({ ...t, academicYear: e.target.value }))}
            >
              {['2025-26', '2024-25'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Division</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              value={target.division}
              onChange={e => setTarget(t => ({ ...t, division: e.target.value }))}
            >
              {['TE 1', 'TE 2', 'TE 3'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Publish CTA */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
          <div className="text-xs text-gray-500">
            {isAlreadyPublished ? (
              <span className="text-emerald-700 font-semibold">✓ Results for this division are currently published and visible to students.</span>
            ) : (
              <span>Ready to freeze and broadcast final grades to all students in {target.division}.</span>
            )}
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing || loading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm transition-all ${
              isAlreadyPublished
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {publishing ? 'Publishing...' : (isAlreadyPublished ? '🔄 Re-Publish Results' : '📢 Publish Results Now')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading status data...</div>
      ) : activeView === 'matrix' ? (
        /* ─── EXAM COMPLETION MATRIX ─── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Exam-Type Breakdown Matrix</h3>
            <span className="text-xs text-gray-500">Semester {target.semester} · {target.academicYear}</span>
          </div>
          <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Division</th>
                  <th className="px-4 py-3 text-left">Faculty</th>
                  <th className="px-4 py-3 text-center">Exam Type</th>
                  <th className="px-4 py-3 text-right">Entered / Enrolled</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matrixData?.completionMatrix?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.subject_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.subject_code}</td>
                    <td className="px-4 py-3 font-bold text-gray-800">{row.division}</td>
                    <td className="px-4 py-3 text-gray-700">{row.faculty_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {row.exam_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {row.entered_count} / {row.total_students || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.current_status || (row.entered_count > 0 ? 'draft' : 'not_started')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── SUBJECTS STATUS LIST ─── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">
              Department Subjects for {target.division} (Semester {target.semester})
            </h3>
            <span className="text-xs text-gray-500">{targetSubjects.length} Assigned Subjects</span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left w-10">#</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Assigned Faculty</th>
                  <th className="px-4 py-3 text-right">Marks Entered</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {targetSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No subjects found for this selection.
                    </td>
                  </tr>
                ) : (
                  targetSubjects.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.subject_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.code}</td>
                      <td className="px-4 py-3 text-gray-700">{s.faculty_name}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {s.marks_entered} marks
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
