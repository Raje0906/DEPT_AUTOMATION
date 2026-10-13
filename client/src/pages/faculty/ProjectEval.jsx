import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// Helper: Format group code by removing 4-digit academic year (e.g., GRP-2026-01 -> GRP-01)
const formatGroupCode = (code) => {
  if (!code) return '';
  return String(code).replace(/-?(?:19|20)\d{2}-?/g, (m) => (m.startsWith('-') && m.endsWith('-') ? '-' : ''));
};

export default function ProjectEval() {
  const [loading, setLoading] = useState(true);
  const [guidedGroups, setGuidedGroups] = useState([]);
  
  // Evaluation modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [formData, setFormData] = useState(null);
  const [scoresInput, setScoresInput] = useState({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedRubrics, setExpandedRubrics] = useState({});

  const fetchFacultyData = async () => {
    setLoading(true);
    try {
      const guidedRes = await api.get('/projects/guide/my-groups');
      setGuidedGroups(guidedRes.data);
    } catch (err) {
      toast.error('Failed to fetch faculty project data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyData();
  }, []);

  const handleOpenEvaluationModal = async (ass) => {
    try {
      const assignmentIdToFetch = ass.assignment_id || ass.active_assignment_id;
      const res = await api.get(`/projects/evaluations/${assignmentIdToFetch}`);
      setFormData(res.data);
      setSelectedAssignment({ ...ass, assignment_id: assignmentIdToFetch });
      
      // Initialize scores map per student member
      const initialMap = {};
      const initialExpanded = {};
      for (const m of res.data.members) {
        initialMap[m.id] = {};
        initialExpanded[m.id] = true;
        for (const crit of res.data.criteria) {
          const existingSt = res.data.studentScoresMap?.[m.id]?.[crit.id];
          const legacyGrp = res.data.scoresMap?.[crit.id];
          initialMap[m.id][crit.id] = {
            marks_awarded: existingSt ? Number(existingSt.marks_awarded) : (legacyGrp ? Number(legacyGrp.marks_awarded) : 0),
            remark: existingSt ? existingSt.remark : (legacyGrp ? legacyGrp.remark : ''),
          };
        }
      }
      setScoresInput(initialMap);
      setOverallRemarks(res.data.evaluation ? res.data.evaluation.overall_remarks || '' : '');
      setExpandedRubrics(initialExpanded);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open evaluation form');
    }
  };

  const toggleStudentRubric = (memberId) => {
    setExpandedRubrics((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const handleSaveEvaluation = async (submitStatus) => {
    if (!selectedAssignment || !formData) return;

    // Validate rubric criteria scores
    for (const m of formData.members) {
      for (const c of formData.criteria) {
        const val = Number(scoresInput[m.id]?.[c.id]?.marks_awarded || 0);
        const max = Number(c.max_marks);
        if (isNaN(val) || val < 0) {
          toast.error(`Marks for "${c.name}" (${m.name}) cannot be negative`);
          return;
        }
        if (val > max) {
          toast.error(`Marks for "${c.name}" (${m.name}) exceed max allowable (${max})`);
          return;
        }
      }
    }

    // Build per-student scores payload
    const studentScoresArray = formData.members.map((m) => ({
      member_id: m.id,
      student_id: m.student_id || null,
      scores: formData.criteria.map((c) => ({
        criterion_id: c.id,
        marks_awarded: Number(scoresInput[m.id]?.[c.id]?.marks_awarded || 0),
        remark: scoresInput[m.id]?.[c.id]?.remark || '',
      })),
    }));

    setSaving(true);
    try {
      const res = await api.post('/projects/evaluations', {
        assignment_id: selectedAssignment.assignment_id,
        status: submitStatus,
        overall_remarks: overallRemarks,
        student_scores: studentScoresArray,
      });
      toast.success(res.data.message);
      setSelectedAssignment(null);
      fetchFacultyData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading faculty evaluation panel...</p>
        </div>
      </div>
    );
  }

  // Calculate stats for guided groups
  const totalStudents = guidedGroups.reduce((acc, g) => acc + (g.members?.length || 0), 0);
  const allStages = guidedGroups.flatMap((g) => g.stages || []);
  const completedStages = allStages.filter((st) => st.is_scored_by_guide || st.is_locked_by_mentor).length;
  const pendingStages = allStages.length - completedStages;

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Project Evaluation Portal</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Academic Year 2026-27 · Continuous Assessment
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Project Groups</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">{guidedGroups.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">As Guide or Panel Mentor</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Students</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{totalStudents}</p>
          <p className="text-xs text-draft mt-1 font-medium">Across assigned teams</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pending Evaluations</p>
          <p className="font-serif text-3xl font-bold text-amber-700 mt-1">{pendingStages}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium">Awaiting evaluation</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Stages Evaluated</p>
          <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">{completedStages}</p>
          <p className="text-xs text-emerald-700 mt-1 font-medium">Scored / Finalized</p>
        </div>
      </div>

      {/* PROJECT GROUPS */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="font-serif text-xl font-semibold">Project Groups</h2>
        </div>
        <div className="divide-y divide-rule">
            {guidedGroups.length === 0 ? (
              <div className="p-8 text-center text-draft">You are currently not assigned to any active project groups as Guide or Panel Mentor.</div>
            ) : (
              guidedGroups.map((g) => (
                <div key={g.id} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-navy bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                        {formatGroupCode(g.group_code)}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-ink">{g.title}</h3>
                      {g.is_guide ? (
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                          Guide
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-300 px-2 py-0.5 rounded">
                          Panel Mentor
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-draft font-medium">
                    <p>Domain: <span className="text-ink font-semibold">{g.domain}</span></p>
                    {!g.is_guide && g.guide_name && (
                      <p>· Project Guide: <span className="text-navy font-semibold">{g.guide_name}</span></p>
                    )}
                  </div>
                  {g.abstract && <p className="text-xs text-ink">{g.abstract}</p>}

                  {/* Evaluation Stages & Continuous Assessment */}
                  <div className="pt-3 border-t border-rule space-y-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                        Continuous Assessment Evaluation Stages
                      </p>
                    </div>

                    {(!g.stages || g.stages.length === 0) ? (
                      <p className="text-xs text-draft italic">No evaluation stages configured.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {g.stages.map((st) => (
                          <div
                            key={st.stage_id}
                            className={`p-3.5 rounded border transition-all ${
                              st.is_scored_by_me || st.is_scored_by_guide
                                ? 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
                                : st.is_locked_by_other || st.is_locked_by_mentor
                                ? 'bg-purple-50/50 border-purple-200 shadow-2xs'
                                : (st.my_eval_status === 'DRAFT' || st.guide_eval_status === 'DRAFT')
                                ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                                : 'bg-paper border-rule'
                            } flex flex-col justify-between gap-3`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-navy">
                                  Stage {st.sequence_order}
                                </span>
                                {st.score !== null && st.score !== undefined ? (
                                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded">
                                    Score: {st.score} / {Number(st.max_marks_total)}
                                  </span>
                                ) : (
                                  <span className="text-xs font-mono font-semibold text-draft">
                                    Max: {Number(st.max_marks_total)} Marks
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-ink mt-1 line-clamp-1" title={st.stage_name}>
                                {st.stage_name}
                              </h4>

                              {/* Status Badge */}
                              <div className="mt-2.5">
                                {st.is_scored_by_me || st.is_scored_by_guide ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Scored by You ({g.is_guide ? 'Guide' : 'Mentor'})
                                  </span>
                                ) : st.is_locked_by_other || st.is_locked_by_mentor ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                    <span>🔒</span>
                                    Scored by {st.other_role || 'Mentor'} ({st.other_evaluator_name || st.mentor_evaluator_name})
                                  </span>
                                ) : (st.my_eval_status === 'DRAFT' || st.guide_eval_status === 'DRAFT') ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Draft Saved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    Pending Evaluation
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-1">
                              {st.is_scored_by_me || st.is_scored_by_guide ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEvaluationModal({
                                      assignment_id: st.assignment_id,
                                      group_code: g.group_code,
                                      title: g.title,
                                      stage_name: st.stage_name,
                                    })
                                  }
                                  className="w-full py-1.5 px-2.5 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 rounded text-xs font-bold shadow-2xs transition-colors"
                                >
                                  View Your Evaluation ({st.score !== null && st.score !== undefined ? `${st.score}/${Number(st.max_marks_total)}` : 'Submitted'})
                                </button>
                              ) : st.is_locked_by_other || st.is_locked_by_mentor ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEvaluationModal({
                                      assignment_id: st.active_assignment_id,
                                      group_code: g.group_code,
                                      title: g.title,
                                      stage_name: st.stage_name,
                                    })
                                  }
                                  className="w-full py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span>👁️</span> View {st.other_role || 'Mentor'} Evaluation (Read-Only)
                                </button>
                              ) : (st.my_eval_status === 'DRAFT' || st.guide_eval_status === 'DRAFT') ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEvaluationModal({
                                      assignment_id: st.assignment_id,
                                      group_code: g.group_code,
                                      title: g.title,
                                      stage_name: st.stage_name,
                                    })
                                  }
                                  className="w-full btn-primary py-1.5 px-2.5 text-xs font-bold"
                                >
                                  Continue Scoring (Draft) →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenEvaluationModal({
                                      assignment_id: st.assignment_id,
                                      group_code: g.group_code,
                                      title: g.title,
                                      stage_name: st.stage_name,
                                    })
                                  }
                                  className="w-full btn-primary py-1.5 px-2.5 text-xs font-bold"
                                >
                                  Score Students as {g.is_guide ? 'Guide' : 'Mentor'} →
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>



      {/* RUBRIC EVALUATION MODAL (SIMPLIFIED STAGE SCORING) */}
      {selectedAssignment && formData && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-4xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                    {formatGroupCode(formData.assignment.group_code)} · {formData.assignment.stage_name}
                  </span>
                  {formData.isReadOnly ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                      Read-Only Mode
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Stage Evaluation
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-lg font-bold text-ink mt-0.5 leading-snug">
                  {formData.assignment.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-draft hover:text-ink font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formData.isReadOnly) {
                  handleSaveEvaluation('SUBMITTED');
                }
              }}
              className="space-y-6"
            >
              {/* Mutual Exclusion / Read-Only Banner */}
              {formData.isReadOnly && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <p className="font-bold">
                    {formData.lockedByOther
                      ? `Scores for this stage were assigned by ${formData.otherRole || 'another evaluator'} (${formData.otherEvaluator || 'Evaluator'}).`
                      : 'This evaluation has been submitted and locked.'}
                  </p>
                </div>
              )}

              {/* Guide Info */}
              <div className="p-3.5 bg-paper border border-rule rounded flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <div>
                  <span className="text-draft font-bold">Project Guide: </span>
                  <span className="text-navy font-semibold">{formData.assignment.guide_name || 'Unassigned'}</span>
                  {formData.isReadOnly ? (
                    <span className="text-draft ml-3">
                      · Evaluated by: <strong className="text-navy">{formData.otherEvaluator || formData.assignment.evaluator_name || 'Assigned Evaluator'}</strong> ({formData.otherRole || 'Evaluator'})
                    </span>
                  ) : (
                    <span className="text-draft ml-3">· Award marks for each individual rubric criterion below.</span>
                  )}
                </div>
              </div>

              {/* STUDENT STAGE SCORING SECTIONS */}
              <div className="space-y-4">
                {formData.members.map((member, mIdx) => {
                  const mScores = scoresInput[member.id] || {};
                  const studentTotal = formData.criteria.reduce(
                    (sum, c) => sum + Number(mScores[c.id]?.marks_awarded || 0),
                    0
                  );
                  const isExpanded = !!expandedRubrics[member.id];

                  return (
                    <div key={member.id} className="border border-rule rounded-lg bg-white shadow-2xs overflow-hidden">
                      {/* Student Header & Calculated Stage Score Display */}
                      <div className="p-4 bg-slate-50/70 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center font-mono shrink-0">
                            {mIdx + 1}
                          </span>
                          <div>
                            <h4 className="font-serif text-base font-bold text-ink flex items-center gap-2">
                              {member.name}
                              {member.is_leader && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                                  LEADER
                                </span>
                              )}
                            </h4>
                            <p className="text-xs font-mono text-draft">PRN / Roll No: <strong className="text-navy">{member.roll_no}</strong></p>
                          </div>
                        </div>

                        {/* Calculated Stage Score from Rubrics */}
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-rule shadow-2xs">
                            <span className="text-xs font-bold text-slate-700">Stage Score:</span>
                            <span className="font-mono text-base font-bold text-navy">
                              {studentTotal} <span className="text-xs font-semibold text-draft">/ {Number(formData.assignment.max_marks_total)}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleStudentRubric(member.id)}
                            className="text-xs text-navy font-semibold hover:text-navy/80 px-2.5 py-1.5 rounded hover:bg-slate-100 flex items-center gap-1 transition-colors"
                            title="Toggle rubric criteria breakdown"
                          >
                            <span>{isExpanded ? '▲ Hide Rubrics' : '▼ View Rubrics'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expandable Criteria Scoring Breakdown */}
                      {isExpanded && (
                        <div className="p-4 bg-paper/50 border-t border-rule space-y-3">
                          <div className="text-xs text-draft font-semibold">
                            Detailed Rubric Breakdown ({formData.criteria.length} criteria)
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {formData.criteria.map((crit) => {
                              const curr = mScores[crit.id] || { marks_awarded: 0, remark: '' };
                              return (
                                <div key={crit.id} className="p-2.5 bg-white border border-rule rounded flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <label className="text-xs font-bold text-ink block">{crit.name}</label>
                                    <span className="text-[11px] font-mono text-draft font-medium">Max: {Number(crit.max_marks)} Marks</span>
                                  </div>
                                  <div className="w-24">
                                    <input
                                      type="number"
                                      min="0"
                                      max={crit.max_marks}
                                      step="0.5"
                                      disabled={formData.isReadOnly}
                                      value={curr.marks_awarded}
                                      onFocus={(e) => !formData.isReadOnly && e.target.select()}
                                      onChange={(e) =>
                                        !formData.isReadOnly &&
                                        setScoresInput({
                                          ...scoresInput,
                                          [member.id]: {
                                            ...mScores,
                                            [crit.id]: { ...curr, marks_awarded: e.target.value },
                                          },
                                        })
                                      }
                                      className={`input-field font-mono font-bold text-navy text-right py-1 px-2 ${
                                        formData.isReadOnly ? 'bg-slate-100 cursor-not-allowed opacity-90' : 'focus:bg-blue-50 focus:ring-2 focus:ring-navy'
                                      }`}
                                      required
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall Remarks */}
              <div>
                <label className="input-label font-bold text-ink">
                  {formData.assignment.is_guide_evaluator ? 'Overall Guide Remarks & Observations' : 'Overall Mentor Remarks & Observations'}
                </label>
                <textarea
                  rows={3}
                  disabled={formData.isReadOnly}
                  placeholder={formData.isReadOnly ? 'No overall remarks entered' : 'Record overall team performance remarks, demonstration feedback, or Viva notes...'}
                  value={overallRemarks}
                  onChange={(e) => !formData.isReadOnly && setOverallRemarks(e.target.value)}
                  className={`input-field text-sm ${formData.isReadOnly ? 'bg-slate-100 cursor-not-allowed opacity-90' : ''}`}
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                {formData.isReadOnly ? (
                  <button
                    type="button"
                    onClick={() => setSelectedAssignment(null)}
                    className="btn-primary py-2 px-6 font-bold"
                  >
                    Close Form
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedAssignment(null)}
                      className="px-4 py-2 border border-rule rounded text-xs font-medium text-draft hover:bg-paper"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveEvaluation('DRAFT')}
                      className="px-4 py-2 border border-navy text-navy hover:bg-blue-50 rounded text-xs font-semibold"
                    >
                      Save Draft
                    </button>
                    <button type="submit" disabled={saving} className="btn-primary py-2 px-6 font-bold">
                      {saving ? 'Saving Scores...' : 'Submit Evaluation →'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
