import React, { useEffect, useState, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/ResultTable';

function normalizeDiv(d) {
  return (d || '').replace(/\s+Comp\s+/i, ' ').trim().toLowerCase();
}

function isMatchDivision(divA, divB) {
  if (!divA || !divB) return false;
  if (divA.trim().toLowerCase() === divB.trim().toLowerCase()) return true;
  return normalizeDiv(divA) === normalizeDiv(divB);
}

const EXAM_TYPE_SHORT_LABELS = {
  1: 'UT 1',
  2: 'UT 2',
  3: 'In-Sem',
  4: 'Mock Th',
  5: 'Mock Pr',
  6: 'Term Work',
  7: 'PR / OR',
  8: 'End-Sem',
};

export default function PublishResults() {
  const [dashData, setDashData]         = useState(null);
  const [matrixData, setMatrixData]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [publishing, setPublishing]     = useState(false);
  const [target, setTarget]             = useState({ semester: '5', academicYear: '2026-27', division: 'TE Comp 1' });
  const [activeView, setActiveView]     = useState('publish'); // 'publish' | 'matrix'
  const [classFilter, setClassFilter]   = useState('ALL');
  const [matrixMode, setMatrixMode]     = useState('grid'); // 'grid' | 'detailed'

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

  const subjects = dashData?.subjects || [];

  const availableDivisions = useMemo(() => {
    const semSubjects = subjects.filter(s => String(s.semester) === String(target.semester));
    const fromSubjects = Array.from(new Set(semSubjects.map(s => s.division).filter(Boolean)));
    if (fromSubjects.length > 0) return fromSubjects;

    const fromMatrix = Array.from(new Set(
      (matrixData?.completionMatrix || [])
        .filter(m => String(m.semester) === String(target.semester))
        .map(m => m.division)
        .filter(Boolean)
    ));
    if (fromMatrix.length > 0) return fromMatrix;

    const semNum = parseInt(target.semester, 10);
    const prefix = semNum <= 2 ? 'FE Comp' : semNum <= 4 ? 'SE Comp' : semNum <= 6 ? 'TE Comp' : 'BE Comp';
    return [`${prefix} 1`, `${prefix} 2`, `${prefix} 3`];
  }, [subjects, matrixData, target.semester]);

  useEffect(() => {
    if (availableDivisions.length > 0) {
      const match = availableDivisions.find(d => isMatchDivision(d, target.division));
      if (match && target.division !== match) {
        setTarget(t => ({ ...t, division: match }));
      } else if (!match && !availableDivisions.includes(target.division)) {
        setTarget(t => ({ ...t, division: availableDivisions[0] }));
      }
    }
  }, [availableDivisions]);

  const matrixGroupedByClass = useMemo(() => {
    if (!matrixData?.completionMatrix) return [];

    let rows = matrixData.completionMatrix;
    if (classFilter !== 'ALL') {
      rows = rows.filter(r => isMatchDivision(r.division, classFilter));
    }

    const classMap = new Map();
    for (const r of rows) {
      if (!classMap.has(r.division)) {
        classMap.set(r.division, new Map());
      }
      const subjectMap = classMap.get(r.division);
      if (!subjectMap.has(r.subject_id)) {
        subjectMap.set(r.subject_id, {
          map_id: r.map_id,
          subject_id: r.subject_id,
          subject_name: r.subject_name,
          subject_code: r.subject_code,
          division: r.division,
          faculty_name: r.faculty_name,
          total_students: parseInt(r.total_students, 10) || 0,
          exams: {},
        });
      }
      subjectMap.get(r.subject_id).exams[r.exam_type_id] = {
        exam_id: r.exam_type_id,
        exam_name: r.exam_name,
        entered_count: parseInt(r.entered_count, 10) || 0,
        total_students: parseInt(r.total_students, 10) || 0,
        status: r.current_status,
      };
    }

    return Array.from(classMap.entries()).map(([division, subMap]) => ({
      division,
      subjects: Array.from(subMap.values()),
    }));
  }, [matrixData, classFilter]);

  const filteredDetailedRows = useMemo(() => {
    if (!matrixData?.completionMatrix) return [];
    if (classFilter === 'ALL') return matrixData.completionMatrix;
    return matrixData.completionMatrix.filter(r => isMatchDivision(r.division, classFilter));
  }, [matrixData, classFilter]);

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

  const targetSubjects = subjects.filter(s =>
    String(s.semester) === String(target.semester) && isMatchDivision(s.division, target.division)
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
              onChange={e => {
                const newSem = e.target.value;
                setTarget(t => ({ ...t, semester: newSem }));
                setClassFilter('ALL');
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={s}>
                  Semester {s} {s === 5 ? '(TE Sem 1)' : s === 3 ? '(SE Sem 1)' : s === 7 ? '(BE Sem 1)' : ''}
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
              {['2026-27', '2025-26', '2024-25'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Division</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              value={target.division}
              onChange={e => {
                const newDiv = e.target.value;
                setTarget(t => ({ ...t, division: newDiv }));
                setClassFilter(newDiv);
              }}
            >
              {availableDivisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Year and Class Quick Filters */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Engineering Year Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Year:</span>
            {[
              { id: 'SE', label: 'SE (Sem 3)', defaultSem: '3' },
              { id: 'TE', label: 'TE (Sem 5)', defaultSem: '5' },
              { id: 'BE', label: 'BE (Sem 7)', defaultSem: '7' },
            ].map(y => {
              const isActive = (y.id === 'SE' && (target.semester === '3' || target.semester === '4')) ||
                               (y.id === 'TE' && (target.semester === '5' || target.semester === '6')) ||
                               (y.id === 'BE' && (target.semester === '7' || target.semester === '8'));
              return (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => {
                    setTarget(t => ({ ...t, semester: y.defaultSem }));
                    setClassFilter('ALL');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    isActive
                      ? 'bg-navy text-white border-navy shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {y.label}
                </button>
              );
            })}
          </div>

          {/* Class / Division Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Class:</span>
            <button
              type="button"
              onClick={() => setClassFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                classFilter === 'ALL'
                  ? 'bg-navy text-white border-navy shadow-xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              All Classes
            </button>
            {availableDivisions.map(d => {
              const isSelected = isMatchDivision(d, classFilter);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setClassFilter(d);
                    setTarget(t => ({ ...t, division: d }));
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-navy text-white border-navy shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Publish CTA */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
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
        /* ─── EXAM COMPLETION MATRIX (YEAR & CLASS-WISE) ─── */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Exam-Type Breakdown Matrix</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Semester {target.semester} · {target.academicYear} · {classFilter === 'ALL' ? 'All Classes' : `Class: ${classFilter}`}
              </p>
            </div>

            {/* Matrix View Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMatrixMode('grid')}
                className={`px-3 py-1 rounded-md transition-all ${
                  matrixMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Matrix Grid View
              </button>
              <button
                type="button"
                onClick={() => setMatrixMode('list')}
                className={`px-3 py-1 rounded-md transition-all ${
                  matrixMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📋 Detailed Flat List
              </button>
            </div>
          </div>

          {matrixMode === 'grid' ? (
            /* ─── COMPACT MATRIX GRID VIEW ─── */
            <div className="space-y-6">
              {matrixGroupedByClass.length === 0 ? (
                <div className="p-8 bg-white border border-gray-200 rounded-xl text-center text-gray-400 text-sm">
                  No exam records found for this year and class selection.
                </div>
              ) : (
                matrixGroupedByClass.map((grp) => (
                  <div key={grp.division} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-gray-900 text-sm">{grp.division}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">
                          {grp.subjects.length} Subjects
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Semester {target.semester}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50/50 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
                          <tr>
                            <th className="px-3 py-2.5 text-left w-8">#</th>
                            <th className="px-4 py-2.5 text-left min-w-[200px]">Subject</th>
                            <th className="px-3 py-2.5 text-left">Code</th>
                            <th className="px-3 py-2.5 text-left">Faculty</th>
                            {(matrixData?.examTypes || []).map((et) => (
                              <th key={et.id} className="px-2 py-2.5 text-center whitespace-nowrap" title={et.name}>
                                {EXAM_TYPE_SHORT_LABELS[et.id] || et.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {grp.subjects.map((sub, sIdx) => (
                            <tr key={sub.subject_id} className="hover:bg-gray-50/75 transition-colors">
                              <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{sIdx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-900">{sub.subject_name}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-500 font-bold">{sub.subject_code}</td>
                              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{sub.faculty_name}</td>
                              {(matrixData?.examTypes || []).map((et) => {
                                const ex = sub.exams[et.id];
                                if (!ex) {
                                  return (
                                    <td key={et.id} className="px-2 py-2.5 text-center text-gray-300 font-mono">
                                      —
                                    </td>
                                  );
                                }
                                const isDone = ex.entered_count > 0 && ex.entered_count >= ex.total_students;
                                const isPartial = ex.entered_count > 0 && ex.entered_count < ex.total_students;

                                return (
                                  <td key={et.id} className="px-2 py-2.5 text-center whitespace-nowrap">
                                    {isDone ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        title={`${ex.exam_name}: ${ex.entered_count}/${ex.total_students} entered (${ex.status})`}
                                      >
                                        ✓ {ex.entered_count}/{ex.total_students}
                                      </span>
                                    ) : isPartial ? (
                                      <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                        title={`${ex.exam_name}: ${ex.entered_count}/${ex.total_students} entered`}
                                      >
                                        {ex.entered_count}/{ex.total_students}
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-400 bg-gray-50"
                                        title={`${ex.exam_name}: Not entered`}
                                      >
                                        0/{ex.total_students}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* ─── DETAILED FLAT LIST VIEW (FILTERED CLASS-WISE) ─── */
            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Class</th>
                    <th className="px-4 py-3 text-left">Faculty</th>
                    <th className="px-4 py-3 text-center">Exam Type</th>
                    <th className="px-4 py-3 text-right">Entered / Enrolled</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDetailedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No exam records found for this class.
                      </td>
                    </tr>
                  ) : (
                    filteredDetailedRows.map((row, idx) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
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
