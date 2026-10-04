import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ProjectEval() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evaluations'); // 'evaluations' | 'guided' | 'requests'
  
  // Backend data states
  const [assignments, setAssignments] = useState([]);
  const [guidedGroups, setGuidedGroups] = useState([]);
  
  // Evaluation modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [formData, setFormData] = useState(null);
  const [scoresInput, setScoresInput] = useState({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFacultyData = async () => {
    setLoading(true);
    try {
      const [assRes, guidedRes] = await Promise.all([
        api.get('/projects/evaluator/assignments'),
        api.get('/projects/guide/my-groups'),
      ]);
      setAssignments(assRes.data);
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
      const res = await api.get(`/projects/evaluations/${ass.assignment_id}`);
      setFormData(res.data);
      setSelectedAssignment(ass);
      
      // Initialize scores map per student member
      const initialMap = {};
      for (const m of res.data.members) {
        initialMap[m.id] = {};
        for (const crit of res.data.criteria) {
          const existingSt = res.data.studentScoresMap?.[m.id]?.[crit.id];
          const legacyGrp = res.data.scoresMap?.[crit.id];
          initialMap[m.id][crit.id] = {
            marks_awarded: existingSt ? existingSt.marks_awarded : (legacyGrp ? legacyGrp.marks_awarded : 0),
            remark: existingSt ? existingSt.remark : (legacyGrp ? legacyGrp.remark : ''),
          };
        }
      }
      setScoresInput(initialMap);
      setOverallRemarks(res.data.evaluation ? res.data.evaluation.overall_remarks || '' : '');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open evaluation form');
    }
  };

  const handleCopyFirstStudentScores = () => {
    if (!formData?.members || formData.members.length === 0) return;
    const firstMemId = formData.members[0].id;
    const firstScores = scoresInput[firstMemId] || {};
    
    const updated = { ...scoresInput };
    for (const m of formData.members) {
      updated[m.id] = { ...firstScores };
    }
    setScoresInput(updated);
    toast.success('Applied Student-1 scores to all team members');
  };

  const handleSaveEvaluation = async (submitStatus) => {
    if (!selectedAssignment || !formData) return;

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

  // Calculate stats
  const pendingAssignments = assignments.filter((a) => a.assignment_status !== 'COMPLETED').length;
  const completedAssignments = assignments.filter((a) => a.assignment_status === 'COMPLETED').length;

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Project Evaluation Portal</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Academic Year 2026-27
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Assigned Panel Groups</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{assignments.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">Across active stages</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Evaluations Completed</p>
          <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">{completedAssignments}</p>
          <p className="text-xs text-emerald-700 mt-1 font-medium">Submitted</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pending Reviews</p>
          <p className="font-serif text-3xl font-bold text-amber-700 mt-1">{pendingAssignments}</p>
          <p className="text-xs text-amber-700 mt-1 font-medium">Awaiting evaluation</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Guided Groups</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">{guidedGroups.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">Under your supervision</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-rule pb-2">
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'evaluations'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Assigned Panel Evaluations ({assignments.length})
        </button>
        <button
          onClick={() => setActiveTab('guided')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'guided'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          My Guided Groups ({guidedGroups.length})
        </button>
      </div>

      {/* TAB 1: PANELIST ASSIGNMENTS */}
      {activeTab === 'evaluations' && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Panel Evaluator Assignments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Group Code</th>
                  <th>Project Title &amp; Domain</th>
                  <th>Team Members</th>
                  <th>Guide</th>
                  <th>Evaluation Stage</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-draft">
                      No panel evaluation assignments found for your account.
                    </td>
                  </tr>
                ) : (
                  assignments.map((ass) => (
                    <tr key={ass.assignment_id}>
                      <td className="font-mono text-sm font-bold text-navy">{ass.group_code}</td>
                      <td className="max-w-md">
                        <div className="font-semibold text-ink text-sm leading-snug">{ass.title}</div>
                        <div className="text-xs text-draft mt-0.5">{ass.domain}</div>
                      </td>
                      <td className="text-xs text-draft">
                        {ass.members.map((m, idx) => (
                          <div key={idx} className="truncate">{m.name} ({m.roll_no})</div>
                        ))}
                      </td>
                      <td className="font-medium text-xs text-ink">{ass.guide_name || 'Unassigned'}</td>
                      <td className="font-mono text-xs text-navy font-semibold">{ass.stage_name}</td>
                      <td>
                        {ass.evaluation_status === 'SUBMITTED' || ass.evaluation_status === 'LOCKED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Submitted
                          </span>
                        ) : ass.evaluation_status === 'DRAFT' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Draft Saved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Assigned
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleOpenEvaluationModal(ass)}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          {ass.evaluation_status === 'SUBMITTED' ? 'View Evaluation' : 'Score Students →'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MY GUIDED GROUPS */}
      {activeTab === 'guided' && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-xl font-semibold">Project Groups Guided by You</h2>
          </div>
          <div className="divide-y divide-rule">
            {guidedGroups.length === 0 ? (
              <div className="p-8 text-center text-draft">You are currently not guiding any active project groups.</div>
            ) : (
              guidedGroups.map((g) => (
                <div key={g.id} className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-navy bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                        {g.group_code}
                      </span>
                      <h3 className="font-serif text-lg font-bold text-ink">{g.title}</h3>
                    </div>
                    <span className="text-xs font-mono font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">
                      {g.academic_year}
                    </span>
                  </div>
                  <p className="text-xs text-draft font-medium">Domain: <span className="text-ink font-semibold">{g.domain}</span></p>
                  <p className="text-xs text-ink">{g.abstract}</p>

                  <div className="pt-2 flex items-center gap-4 text-xs text-draft">
                    <span className="font-bold text-navy">Roster ({g.members.length}):</span>
                    {g.members.map((m, idx) => (
                      <span key={idx} className="bg-paper border border-rule px-2 py-0.5 rounded font-mono">
                        {m.name} ({m.roll_no}) {m.is_leader && '★'}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}



      {/* RUBRIC EVALUATION MODAL (INDIVIDUAL STUDENT SCORING) */}
      {selectedAssignment && formData && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-4xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                    {formData.assignment.group_code} · {formData.assignment.stage_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Individual Student Marks Entry
                  </span>
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
                handleSaveEvaluation('SUBMITTED');
              }}
              className="space-y-6"
            >
              {/* Quick Actions & Guide Info */}
              <div className="p-3 bg-paper border border-rule rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-draft font-bold">Project Guide: </span>
                  <span className="text-navy font-semibold">{formData.assignment.guide_name || 'Unassigned'}</span>
                  <span className="text-draft ml-3">· Evaluator assigns marks <strong>individually</strong> to each student member.</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyFirstStudentScores}
                  className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-navy border border-blue-200 text-xs font-bold rounded flex items-center gap-1 shrink-0"
                  title="Copy Student 1 marks to all team members"
                >
                  <span>⚡</span> Copy Student-1 Scores to All
                </button>
              </div>

              {/* INDIVIDUAL STUDENT RUBRIC SCORING SECTIONS */}
              <div className="space-y-6">
                {formData.members.map((member, mIdx) => {
                  const mScores = scoresInput[member.id] || {};
                  const studentTotal = formData.criteria.reduce(
                    (sum, c) => sum + Number(mScores[c.id]?.marks_awarded || 0),
                    0
                  );

                  return (
                    <div key={member.id} className="border border-rule rounded p-5 bg-white shadow-xs space-y-4">
                      {/* Student Header */}
                      <div className="flex items-center justify-between border-b border-rule pb-2 bg-gray-50 -mx-5 -mt-5 p-4 rounded-t">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center font-mono">
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

                        <div className="text-right">
                          <span className="text-[11px] uppercase tracking-wider text-draft font-semibold block">Total Score</span>
                          <span className="font-serif text-xl font-bold text-navy">
                            {studentTotal} / {formData.assignment.max_marks_total}
                          </span>
                        </div>
                      </div>

                      {/* Criteria Scoring Inputs for this student */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {formData.criteria.map((crit) => {
                          const curr = mScores[crit.id] || { marks_awarded: 0, remark: '' };
                          return (
                            <div key={crit.id} className="p-3 bg-paper border border-rule rounded flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <label className="text-xs font-bold text-ink block">{crit.name}</label>
                                <span className="text-[11px] font-mono text-draft font-medium">Max: {crit.max_marks} Marks</span>
                              </div>
                              <div className="w-28">
                                <input
                                  type="number"
                                  min="0"
                                  max={crit.max_marks}
                                  step="0.5"
                                  value={curr.marks_awarded}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    setScoresInput({
                                      ...scoresInput,
                                      [member.id]: {
                                        ...mScores,
                                        [crit.id]: { ...curr, marks_awarded: e.target.value },
                                      },
                                    })
                                  }
                                  className="input-field font-mono font-bold text-navy text-right focus:bg-blue-50 focus:ring-2 focus:ring-navy"
                                  required
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall Examiner Remarks */}
              <div>
                <label className="input-label font-bold text-ink">Overall Examiner Remarks &amp; Observations</label>
                <textarea
                  rows={3}
                  placeholder="Record overall team performance remarks, demonstration feedback, or Viva notes..."
                  value={overallRemarks}
                  onChange={(e) => setOverallRemarks(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
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
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
