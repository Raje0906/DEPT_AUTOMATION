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
    <div className="p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Academic Term Rollover</h1>
          <p className="text-xs text-draft font-medium mt-1">
            Manage semester progression, allocate new semester course mappings to faculty, and start fresh evaluation cycles.
          </p>
        </div>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-2.5">
          <label htmlFor="ay-select" className="text-xs font-semibold text-draft uppercase tracking-wider">
            Academic Year:
          </label>
          <select
            id="ay-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input-field w-auto py-1.5 text-xs font-bold font-mono"
          >
            {(statusData?.availableYears || ['2026-27', '2025-26', '2024-25']).map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-sm text-draft font-medium">Loading department semester state…</div>
      ) : (
        <>
          {/* ─── STATUS SUMMARY METRICS ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1 */}
            <div className="panel p-5">
              <span className="text-xs font-semibold text-draft uppercase tracking-wider">Active Cohort Students</span>
              <p className="text-3xl font-bold font-mono text-ink mt-2 tabular-num">
                {statusData?.studentBreakdown?.reduce((sum, r) => sum + parseInt(r.student_count, 10), 0) || 0}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {statusData?.studentBreakdown?.map((b, idx) => (
                  <span key={idx} className="text-[11px] font-medium bg-paper text-ink px-2 py-0.5 rounded border border-rule">
                    Sem {b.current_semester} ({b.division}): <strong className="font-mono">{b.student_count}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Metric 2 */}
            <div className="panel p-5">
              <span className="text-xs font-semibold text-draft uppercase tracking-wider">Department Faculty</span>
              <p className="text-3xl font-bold font-mono text-navy mt-2 tabular-num">
                {statusData?.totalFaculty || 0}
              </p>
              <p className="text-xs text-draft mt-2">Available academic teaching staff</p>
            </div>

            {/* Metric 3 */}
            <div className="panel p-5">
              <span className="text-xs font-semibold text-draft uppercase tracking-wider">Sem 5 vs Sem 6 Subjects</span>
              <p className="text-3xl font-bold font-mono text-pass mt-2 tabular-num">
                {statusData?.subjects?.filter(s => s.semester === 5).length || 0} / {statusData?.subjects?.filter(s => s.semester === 6).length || 0}
              </p>
              <p className="text-xs text-draft mt-2">Core Theory, Elective I &amp; Practicals</p>
            </div>

            {/* Metric 4 */}
            <div className="panel p-5">
              <span className="text-xs font-semibold text-draft uppercase tracking-wider">Sem 5 Result Status</span>
              <div className="mt-2 space-y-1">
                {statusData?.publishStatuses?.filter(p => p.semester === 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-medium text-ink">{p.division}:</span>
                    <span className="badge-published text-[10px] uppercase font-bold">
                      {p.status}
                    </span>
                  </div>
                ))}
                {(!statusData?.publishStatuses || statusData?.publishStatuses?.length === 0) && (
                  <span className="text-xs text-draft italic">No published records</span>
                )}
              </div>
            </div>
          </div>

          {/* ─── MAIN ROLLOVER CONFIGURATION WIZARD ─── */}
          <div className="panel overflow-hidden">
            <div className="px-6 py-4 bg-navy text-white flex items-center justify-between border-b border-navy">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Semester Transition Wizard</h2>
                <p className="text-xs text-blue-200 mt-0.5 font-normal">
                  Transition from your completed semester (e.g. Sem 5) to the upcoming semester (e.g. Sem 6).
                </p>
              </div>
              <span className="px-3 py-1 bg-white/10 rounded text-xs font-mono font-medium text-white border border-white/20">
                Academic Year {academicYear}
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Semester Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 border-b border-rule">
                {/* Source Semester */}
                <div className="space-y-1.5">
                  <label className="input-label">
                    Step 1: Current Completed Semester (Source)
                  </label>
                  <select
                    value={fromSem}
                    onChange={(e) => setFromSem(parseInt(e.target.value, 10))}
                    className="input-field font-semibold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map(s => (
                      <option key={s} value={s}>
                        Semester {s} {s === 5 ? '(TE Semester 1 - Odd Term)' : s === 3 ? '(SE Sem 1)' : s === 7 ? '(BE Sem 1)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-draft">
                    Existing marks and records for this semester will be safely preserved in history.
                  </p>
                </div>

                {/* Target Semester */}
                <div className="space-y-1.5">
                  <label className="input-label">
                    Step 2: Upcoming New Semester (Target)
                  </label>
                  <select
                    value={toSem}
                    onChange={(e) => setToSem(parseInt(e.target.value, 10))}
                    className="input-field font-semibold border-navy"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>
                        Semester {s} {s === 6 ? '(TE Semester 2 - Even Term)' : s === 4 ? '(SE Sem 2)' : s === 8 ? '(BE Sem 2)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-navy font-medium">
                    Fresh evaluations, marks sheets, and assignment trackers will open for this semester.
                  </p>
                </div>
              </div>

              {/* Step 2: Target Divisions */}
              <div className="space-y-2 pb-6 border-b border-rule">
                <label className="input-label">
                  Target Class Divisions
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {['TE 1', 'TE 2', 'TE 3'].map(div => {
                    const isSelected = selectedDivisions.includes(div);
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => toggleDivision(div)}
                        className={`px-4 py-2 text-xs font-semibold rounded border transition-colors ${
                          isSelected
                            ? 'bg-navy text-white border-navy'
                            : 'bg-white text-ink border-rule hover:bg-paper'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}Class {div}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Automated Actions Checklist */}
              <div className="space-y-3 pb-6 border-b border-rule">
                <label className="input-label">
                  Automated Rollover Actions
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Action 1 */}
                  <label className="p-3.5 bg-paper/60 hover:bg-paper border border-rule rounded cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={advanceStudents}
                      onChange={(e) => setAdvanceStudents(e.target.checked)}
                      className="mt-0.5 rounded text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Promote Students</span>
                      <p className="text-xs text-draft mt-1 leading-normal">
                        Advances all {previewData?.eligibleStudentsCount || 0} students from Sem {fromSem} to Sem {toSem}.
                      </p>
                    </div>
                  </label>

                  {/* Action 2 */}
                  <label className="p-3.5 bg-paper/60 hover:bg-paper border border-rule rounded cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoAssignFaculty}
                      onChange={(e) => setAutoAssignFaculty(e.target.checked)}
                      className="mt-0.5 rounded text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Allocate Faculty</span>
                      <p className="text-xs text-draft mt-1 leading-normal">
                        Maps department teachers to Sem {toSem} subjects across {selectedDivisions.join(', ')}.
                      </p>
                    </div>
                  </label>

                  {/* Action 3 */}
                  <label className="p-3.5 bg-paper/60 hover:bg-paper border border-rule rounded cursor-pointer flex items-start gap-3 transition-colors">
                    <input
                      type="checkbox"
                      checked={initPublishStatus}
                      onChange={(e) => setInitPublishStatus(e.target.checked)}
                      className="mt-0.5 rounded text-navy focus:ring-navy"
                    />
                    <div>
                      <span className="text-xs font-bold text-ink block">Initialize Clean Sheets</span>
                      <p className="text-xs text-draft mt-1 leading-normal">
                        Prepares fresh marks sheets in 'draft' mode ready for evaluation.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 4: Preview Diff Box */}
              {loadingPreview ? (
                <div className="text-center py-4 text-xs text-draft">Calculating transition impact…</div>
              ) : previewData ? (
                <div className="bg-blue-50/70 border border-blue-200 rounded p-4">
                  <div className="mb-2">
                    <h3 className="text-xs font-bold text-navy uppercase tracking-wider">
                      Simulation Preview: Transition to Semester {toSem}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-ink">
                    <div>
                      <span className="font-semibold text-draft">Students to Promote:</span>{' '}
                      <span className="text-ink font-bold font-mono text-sm ml-1">{previewData.eligibleStudentsCount}</span>
                      <p className="text-draft text-[11px] mt-0.5">from {selectedDivisions.join(', ')}</p>
                    </div>

                    <div>
                      <span className="font-semibold text-draft">New Semester Subjects:</span>{' '}
                      <span className="text-ink font-bold font-mono text-sm ml-1">{previewData.targetSubjectsCount} Courses</span>
                      <p className="text-draft text-[11px] mt-0.5 truncate">
                        {previewData.targetSubjects?.map(s => s.code).join(', ') || 'None registered'}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-draft">Target Evaluation Sheets:</span>{' '}
                      <span className={`font-bold font-mono text-sm ml-1 ${previewData.existingTargetMarksCount > 0 ? 'text-amber-800' : 'text-pass'}`}>
                        {previewData.existingTargetMarksCount > 0 ? `${previewData.existingTargetMarksCount} records` : '100% Fresh (0 marks)'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Execute Rollover Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-draft">
                  All Sem {fromSem} mark sheets and result transcripts remain intact and viewable anytime.
                </p>

                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={executing || fromSem === toSem}
                  className="btn-primary text-xs flex items-center justify-center gap-2"
                >
                  {executing ? 'Executing Rollover…' : `Execute Rollover to Semester ${toSem}`}
                </button>
              </div>
            </div>
          </div>

          {/* ─── QUICK ACTIVE SEMESTER TOGGLE UTILITY ─── */}
          <div className="panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-ink">Active Working Semester Switcher</h3>
              <p className="text-xs text-draft mt-0.5 max-w-xl">
                Quickly toggle active review between Semester 5 and Semester 6 evaluation sheets without re-running rollover.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <select
                value={quickSwitchSem}
                onChange={(e) => setQuickSwitchSem(parseInt(e.target.value, 10))}
                className="input-field w-auto py-1.5 text-xs font-semibold"
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
                className="btn-secondary text-xs"
              >
                {switching ? 'Switching…' : `Set Active to Sem ${quickSwitchSem}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
