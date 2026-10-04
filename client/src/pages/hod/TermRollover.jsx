import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function TermRollover() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Form State
  const [fromSem, setFromSem] = useState(5);
  const [toSem, setToSem] = useState(6);
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [selectedDivisions, setSelectedDivisions] = useState(['TE 1', 'TE 2', 'TE 3']);
  const [advanceStudents, setAdvanceStudents] = useState(true);
  const [autoAssignFaculty, setAutoAssignFaculty] = useState(true);
  const [initPublishStatus, setInitPublishStatus] = useState(true);

  // Quick switcher target
  const [quickSwitchSem, setQuickSwitchSem] = useState(6);

  const fetchStatus = () => {
    setLoading(true);
    api.get(`/hod/term-rollover/status?academic_year=${encodeURIComponent(academicYear)}`)
      .then(res => {
        setStatusData(res.data);
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to load rollover status');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, [academicYear]);

  // Load preview whenever key parameters change
  useEffect(() => {
    if (fromSem && toSem && fromSem !== toSem && selectedDivisions.length > 0) {
      setLoadingPreview(true);
      api.post('/hod/term-rollover/preview', {
        fromSemester: fromSem,
        toSemester: toSem,
        academicYear,
        divisions: selectedDivisions
      })
        .then(res => setPreviewData(res.data))
        .catch(console.error)
        .finally(() => setLoadingPreview(false));
    } else {
      setPreviewData(null);
    }
  }, [fromSem, toSem, academicYear, selectedDivisions]);

  const toggleDivision = (div) => {
    if (selectedDivisions.includes(div)) {
      if (selectedDivisions.length > 1) {
        setSelectedDivisions(selectedDivisions.filter(d => d !== div));
      }
    } else {
      setSelectedDivisions([...selectedDivisions, div]);
    }
  };

  const handleExecute = async () => {
    if (fromSem === toSem) {
      toast.error('Source and Target semesters cannot be the same!');
      return;
    }

    const confirmMsg = `Are you sure you want to transition ${previewData?.eligibleStudentsCount || 0} students from Semester ${fromSem} to Semester ${toSem} (${academicYear})?\n\nThis will promote students, allocate Semester ${toSem} subjects, and initialize clean marks entry sheets.`;
    if (!window.confirm(confirmMsg)) return;

    setExecuting(true);
    try {
      const res = await api.post('/hod/term-rollover/execute', {
        fromSemester: fromSem,
        toSemester: toSem,
        academicYear,
        divisions: selectedDivisions,
        advanceStudents,
        autoAssignFaculty,
        initPublishStatus
      });

      toast.success(res.data.message || 'Term Rollover completed successfully!');
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rollover execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleQuickSwitch = async () => {
    const confirmMsg = `Switch active working semester to Semester ${quickSwitchSem} for ${selectedDivisions.join(', ')}?`;
    if (!window.confirm(confirmMsg)) return;

    setSwitching(true);
    try {
      const res = await api.post('/hod/term-rollover/switch-active-semester', {
        targetSemester: quickSwitchSem,
        divisions: selectedDivisions
      });
      toast.success(res.data.message);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Switch failed');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="pb-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl shadow-2xs">
              🔄
            </span>
            <div>
              <h1 className="text-3xl font-serif font-bold text-gray-950">Academic Term Rollover</h1>
              <p className="text-sm text-gray-500 font-medium mt-0.5">
                Manage semester progression, auto-assign new semester subjects to faculty, and start fresh evaluation cycles.
              </p>
            </div>
          </div>
        </div>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-2xs">
          <label htmlFor="ay-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            Academic Year:
          </label>
          <select
            id="ay-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {(statusData?.availableYears || ['2026-27', '2025-26', '2024-25']).map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-medium">Loading department semester state...</div>
      ) : (
        <>
          {/* ─── STATUS SUMMARY METRICS ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Cohort Students</span>
              <p className="text-3xl font-bold font-serif text-gray-900 mt-2">
                {statusData?.studentBreakdown?.reduce((sum, r) => sum + parseInt(r.student_count, 10), 0) || 0}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {statusData?.studentBreakdown?.map((b, idx) => (
                  <span key={idx} className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    Sem {b.current_semester} ({b.division}): <strong>{b.student_count}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Metric 2 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Department Faculty</span>
              <p className="text-3xl font-bold font-serif text-indigo-700 mt-2">
                {statusData?.totalFaculty || 0} Teachers
              </p>
              <p className="text-xs text-gray-500 mt-2">Available for allocation across TE &amp; BE divisions</p>
            </div>

            {/* Metric 3 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sem 5 vs Sem 6 Subjects</span>
              <p className="text-3xl font-bold font-serif text-emerald-700 mt-2">
                {statusData?.subjects?.filter(s => s.semester === 5).length || 0} vs {statusData?.subjects?.filter(s => s.semester === 6).length || 0}
              </p>
              <p className="text-xs text-gray-500 mt-2">Core Theory, Elective I, &amp; Lab Practical Courses</p>
            </div>

            {/* Metric 4 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sem 1 Result Status</span>
              <div className="mt-2">
                {statusData?.publishStatuses?.filter(p => p.semester === 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-semibold text-gray-700">{p.division}:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {p.status}
                    </span>
                  </div>
                ))}
                {(!statusData?.publishStatuses || statusData?.publishStatuses?.length === 0) && (
                  <span className="text-xs text-gray-400">No publish record</span>
                )}
              </div>
            </div>
          </div>

          {/* ─── MAIN ROLLOVER CONFIGURATION WIZARD ─── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-navy to-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-serif font-bold text-xl">Semester Transition Wizard</h2>
                <p className="text-xs text-blue-200 mt-1">
                  Transition from your completed semester (e.g. Sem 5) to the upcoming semester (e.g. Sem 6).
                </p>
              </div>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-semibold border border-white/20 text-blue-200">
                Academic Year {academicYear}
              </span>
            </div>

            <div className="p-6 lg:p-8 space-y-8">
              {/* Step 1: Semester Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                {/* Source Semester */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Step 1: Current Completed Semester (Source)
                  </label>
                  <select
                    value={fromSem}
                    onChange={(e) => setFromSem(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(s => (
                      <option key={s} value={s}>
                        Semester {s} {s === 5 ? '(TE Semester 1 - Odd Term)' : s === 3 ? '(SE Sem 1)' : s === 7 ? '(BE Sem 1)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    Existing marks &amp; records for this semester will be safely preserved in history.
                  </p>
                </div>

                {/* Target Semester */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Step 2: Upcoming New Semester (Target)
                  </label>
                  <select
                    value={toSem}
                    onChange={(e) => setToSem(parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-indigo-50/70 border-2 border-indigo-300 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>
                        Semester {s} {s === 6 ? '(TE Semester 2 - Even Term)' : s === 4 ? '(SE Sem 2)' : s === 8 ? '(BE Sem 2)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-indigo-600 font-medium">
                    Fresh evaluations, marks sheets, and assignment trackers will open for this semester.
                  </p>
                </div>
              </div>

              {/* Step 2: Target Divisions */}
              <div className="space-y-3 pb-6 border-b border-gray-100">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Target Class Divisions
                </label>
                <div className="flex flex-wrap gap-3">
                  {['TE 1', 'TE 2', 'TE 3'].map(div => {
                    const isSelected = selectedDivisions.includes(div);
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => toggleDivision(div)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        Class {div}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Automated Actions Checklist */}
              <div className="space-y-4 pb-6 border-b border-gray-100">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Automated Rollover Actions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Action 1 */}
                  <label className="p-4 bg-gray-50 hover:bg-indigo-50/40 border border-gray-200 rounded-xl cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={advanceStudents}
                      onChange={(e) => setAdvanceStudents(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Promote Students</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Advances all {previewData?.eligibleStudentsCount || 0} students from Sem {fromSem} to Sem {toSem}.
                      </p>
                    </div>
                  </label>

                  {/* Action 2 */}
                  <label className="p-4 bg-gray-50 hover:bg-indigo-50/40 border border-gray-200 rounded-xl cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoAssignFaculty}
                      onChange={(e) => setAutoAssignFaculty(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Allocate Faculty</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Maps department teachers to Sem {toSem} subjects across {selectedDivisions.join(', ')}.
                      </p>
                    </div>
                  </label>

                  {/* Action 3 */}
                  <label className="p-4 bg-gray-50 hover:bg-indigo-50/40 border border-gray-200 rounded-xl cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={initPublishStatus}
                      onChange={(e) => setInitPublishStatus(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-sm font-bold text-gray-900 block">Initialize Clean Sheets</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Prepares fresh marks sheets in 'draft' mode ready for evaluation.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 4: Preview Diff Box */}
              {loadingPreview ? (
                <div className="text-center py-6 text-sm text-gray-500">Calculating transition impact...</div>
              ) : previewData ? (
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📋</span>
                    <h3 className="text-sm font-bold text-blue-950 uppercase tracking-wide">
                      Simulation Preview: Transition to Semester {toSem}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-900">
                    <div>
                      <span className="font-bold">Students to Promote:</span>{' '}
                      <span className="text-blue-950 font-bold text-sm">{previewData.eligibleStudentsCount}</span>
                      <p className="text-gray-500 mt-0.5">from {selectedDivisions.join(', ')}</p>
                    </div>

                    <div>
                      <span className="font-bold">New Semester Subjects:</span>{' '}
                      <span className="text-blue-950 font-bold text-sm">{previewData.targetSubjectsCount} Courses</span>
                      <p className="text-gray-500 mt-0.5">
                        {previewData.targetSubjects?.map(s => s.code).join(', ') || 'No subjects registered yet'}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold">Target Evaluation Sheets:</span>{' '}
                      <span className={`font-bold text-sm ${previewData.existingTargetMarksCount > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {previewData.existingTargetMarksCount > 0 ? `${previewData.existingTargetMarksCount} marks recorded` : '100% Fresh & Clean (0 marks)'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Execute Rollover Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>🔒</span>
                  <span>All Sem {fromSem} mark sheets and result transcripts remain intact and viewable anytime.</span>
                </div>

                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={executing || fromSem === toSem}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {executing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Executing Rollover...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>Execute Rollover to Semester {toSem}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ─── QUICK ACTIVE SEMESTER TOGGLE UTILITY ─── */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <h3 className="font-serif font-bold text-base text-gray-900">Active Working Semester Switcher</h3>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                Need to quickly review Semester 5 evaluation sheets or toggle students back and forth during moderation?
                You can instantly switch the active cohort's semester without re-running rollover.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <select
                value={quickSwitchSem}
                onChange={(e) => setQuickSwitchSem(parseInt(e.target.value, 10))}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800"
              >
                <option value={5}>Semester 5 (TE Sem 1)</option>
                <option value={6}>Semester 6 (TE Sem 2)</option>
                <option value={7}>Semester 7 (BE Sem 1)</option>
                <option value={8}>Semester 8 (BE Sem 2)</option>
              </select>

              <button
                type="button"
                onClick={handleQuickSwitch}
                disabled={switching}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
              >
                {switching ? 'Switching...' : `Set Active to Sem ${quickSwitchSem}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
