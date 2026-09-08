import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ProjectEval() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evaluations'); // 'evaluations' | 'guided' | 'requests'
  
  // Backend data states
  const [assignments, setAssignments] = useState([]);
  const [guidedGroups, setGuidedGroups] = useState([]);
  const [guideRequests, setGuideRequests] = useState([]);
  
  // Evaluation modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [formData, setFormData] = useState(null);
  const [scoresInput, setScoresInput] = useState({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFacultyData = async () => {
    setLoading(true);
    try {
      const [assRes, guidedRes, reqRes] = await Promise.all([
        api.get('/projects/evaluator/assignments'),
        api.get('/projects/guide/my-groups'),
        api.get('/projects/guide/requests'),
      ]);
      setAssignments(assRes.data);
      setGuidedGroups(guidedRes.data);
      setGuideRequests(reqRes.data);
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
      
      // Initialize scores map
      const initialMap = {};
      for (const crit of res.data.criteria) {
        const existing = res.data.scoresMap[crit.id];
        initialMap[crit.id] = {
          marks_awarded: existing ? existing.marks_awarded : 0,
          remark: existing ? existing.remark : '',
        };
      }
      setScoresInput(initialMap);
      setOverallRemarks(res.data.evaluation ? res.data.evaluation.overall_remarks || '' : '');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open evaluation form');
    }
  };

  const handleSaveEvaluation = async (submitStatus) => {
    if (!selectedAssignment || !formData) return;

    // Build scores array
    const scoresArray = formData.criteria.map((c) => ({
      criterion_id: c.id,
      marks_awarded: Number(scoresInput[c.id]?.marks_awarded || 0),
      remark: scoresInput[c.id]?.remark || '',
    }));

    setSaving(true);
    try {
      const res = await api.post('/projects/evaluations', {
        assignment_id: selectedAssignment.assignment_id,
        status: submitStatus,
        overall_remarks: overallRemarks,
        scores: scoresArray,
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

  const handleGuideRequestDecision = async (requestId, status) => {
    try {
      const res = await api.patch(`/projects/guide/requests/${requestId}`, { status });
      toast.success(res.data.message);
      fetchFacultyData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update request');
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
            Continuous Rubric Assessment &amp; Project Supervision Center · 2025–26
          </p>
        </div>
        {guideRequests.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            {guideRequests.length} Pending Guide Requests
          </span>
        )}
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
          <p className="text-xs text-emerald-700 mt-1 font-medium">Locked &amp; Submitted</p>
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
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors relative ${
            activeTab === 'requests'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Pending Requests
          {guideRequests.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-mono font-bold">
              {guideRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PANELIST ASSIGNMENTS */}
      {activeTab === 'evaluations' && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Panel Evaluator Assignments</h2>
            <span className="text-xs font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">
              Continuous Assessment Rubric
            </span>
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
                            Submitted &amp; Locked
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
                          {ass.evaluation_status === 'SUBMITTED' ? 'View Evaluation' : 'Score Group →'}
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
                      {g.batch} · {g.academic_year}
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

      {/* TAB 3: PENDING GUIDE REQUESTS */}
      {activeTab === 'requests' && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-xl font-semibold">Pending Guide Requests</h2>
          </div>
          <div className="divide-y divide-rule">
            {guideRequests.length === 0 ? (
              <div className="p-8 text-center text-draft">No pending guide requests.</div>
            ) : (
              guideRequests.map((req) => (
                <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-navy bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {req.group_code}
                      </span>
                      <h3 className="font-serif text-base font-bold text-ink">{req.title}</h3>
                    </div>
                    <p className="text-xs text-draft mt-1 font-medium">Domain: <span className="text-ink font-semibold">{req.domain}</span></p>
                    <p className="text-xs text-draft mt-1">Requested by Leader: <span className="font-semibold text-ink">{req.leader_name}</span> ({req.leader_email})</p>
                    <p className="text-xs text-ink italic mt-2 bg-paper p-2.5 border border-rule rounded">{req.abstract || 'No abstract provided'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleGuideRequestDecision(req.id, 'REJECTED')}
                      className="px-4 py-2 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded text-xs font-semibold"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleGuideRequestDecision(req.id, 'APPROVED')}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-xs"
                    >
                      Approve &amp; Supervise →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* RUBRIC EVALUATION MODAL */}
      {selectedAssignment && formData && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-2xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                  {formData.assignment.group_code} · {formData.assignment.stage_name}
                </span>
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

            {/* COI Warning Box if applicable */}
            {formData.isGuide ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-semibold space-y-1">
                <p className="font-bold uppercase tracking-wider text-red-900">⚠️ Conflict of Interest Warning</p>
                <p>You are recorded as the Project Guide for this group. Per departmental governance rules, guides cannot submit panel evaluation scores for their own guided groups.</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEvaluation('SUBMITTED');
                }}
                className="space-y-5"
              >
                {/* Roster & Guide Info */}
                <div className="p-3 bg-paper border border-rule rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-draft font-bold">Team Members: </span>
                    <span className="text-ink">{formData.members.map((m) => `${m.name} (${m.roll_no})`).join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-draft font-bold">Guide: </span>
                    <span className="text-navy font-semibold">{formData.assignment.guide_name || 'Unassigned'}</span>
                  </div>
                </div>

                {/* Criteria Scoring Inputs */}
                <div className="space-y-4">
                  <h4 className="font-serif text-sm font-bold text-ink uppercase tracking-wider border-b border-rule pb-1">
                    Continuous Evaluation Rubric Criteria
                  </h4>
                  {formData.criteria.map((crit) => {
                    const curr = scoresInput[crit.id] || { marks_awarded: 0, remark: '' };
                    return (
                      <div key={crit.id} className="p-4 bg-gray-50/50 border border-rule rounded space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-ink">{crit.name}</label>
                          <span className="text-xs font-mono text-draft font-semibold">Max: {crit.max_marks} Marks</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <input
                              type="number"
                              min="0"
                              max={crit.max_marks}
                              step="0.5"
                              value={curr.marks_awarded}
                              onChange={(e) =>
                                setScoresInput({
                                  ...scoresInput,
                                  [crit.id]: { ...curr, marks_awarded: e.target.value },
                                })
                              }
                              className="input-field font-mono font-bold text-navy"
                              required
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="Criterion specific feedback / observation..."
                              value={curr.remark}
                              onChange={(e) =>
                                setScoresInput({
                                  ...scoresInput,
                                  [crit.id]: { ...curr, remark: e.target.value },
                                })
                              }
                              className="input-field text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Score Summary Box */}
                <div className="p-4 bg-navy text-white rounded flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Calculated Marks</span>
                  <span className="font-serif text-2xl font-bold">
                    {formData.criteria.reduce(
                      (sum, c) => sum + Number(scoresInput[c.id]?.marks_awarded || 0),
                      0
                    )}{' '}
                    / {formData.assignment.max_marks_total}
                  </span>
                </div>

                {/* Overall Examiner Remarks */}
                <div>
                  <label className="input-label">Overall Examiner Remarks &amp; Feedback</label>
                  <textarea
                    rows={3}
                    placeholder="Record overall observations, demonstration performance, or suggestions..."
                    value={overallRemarks}
                    onChange={(e) => setOverallRemarks(e.target.value)}
                    className="input-field"
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
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Submit & Lock Evaluation →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
