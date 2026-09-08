import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODProjectMgmt() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'groups' | 'stages' | 'panels' | 'governance' | 'reports'
  const [academicYear, setAcademicYear] = useState('2025-26');

  // Backend state
  const [dashboardData, setDashboardData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [stages, setStages] = useState([]);
  const [availableGuides, setAvailableGuides] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Modals & form state
  const [guideModalGroup, setGuideModalGroup] = useState(null);
  const [selectedGuideId, setSelectedGuideId] = useState('');

  const [stageModal, setStageModal] = useState(null); // new or edit
  const [stageForm, setStageForm] = useState({
    name: '',
    sequence_order: 1,
    scheduled_date_from: '',
    scheduled_date_to: '',
    max_marks_total: 100,
    aggregation_rule: 'AVERAGE',
    criteria: [{ name: 'Problem Statement & Scope', max_marks: 25 }],
  });

  const [panelModal, setPanelModal] = useState(null); // group + stage selection
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPanelistIds, setSelectedPanelistIds] = useState([]);

  const [unlockModalEval, setUnlockModalEval] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchHODData = async () => {
    setLoading(true);
    try {
      const [dashRes, groupsRes, stagesRes, guidesRes, repRes] = await Promise.all([
        api.get(`/projects/hod/dashboard?academic_year=${academicYear}`),
        api.get(`/projects/hod/groups?academic_year=${academicYear}`),
        api.get(`/projects/hod/stages?academic_year=${academicYear}`),
        api.get('/projects/student/available-guides'),
        api.get(`/projects/hod/reports/export?academic_year=${academicYear}`),
      ]);
      setDashboardData(dashRes.data);
      setGroups(groupsRes.data);
      setStages(stagesRes.data);
      setAvailableGuides(guidesRes.data);
      setReportData(repRes.data);
    } catch (err) {
      toast.error('Failed to load HOD project data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHODData();
  }, [academicYear]);

  // Handlers
  const handleAssignGuide = async (e) => {
    e.preventDefault();
    if (!guideModalGroup || !selectedGuideId) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/projects/hod/groups/${guideModalGroup.id}/guide`, {
        guide_id: Number(selectedGuideId),
      });
      toast.success(res.data.message);
      setGuideModalGroup(null);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign guide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStage = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/stages', {
        ...stageForm,
        academic_year: academicYear,
      });
      toast.success(res.data.message);
      setStageModal(false);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignPanel = async (e) => {
    e.preventDefault();
    if (!selectedStageId || !selectedGroupId || selectedPanelistIds.length === 0) {
      return toast.error('Please select stage, group, and at least one panel member');
    }
    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/panel-assignments', {
        stage_id: Number(selectedStageId),
        group_id: Number(selectedGroupId),
        panel_member_ids: selectedPanelistIds.map(Number),
      });
      toast.success(res.data.message);
      setPanelModal(false);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Panel assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockEvaluation = async (e) => {
    e.preventDefault();
    if (!unlockModalEval || !unlockReason) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/projects/hod/evaluations/${unlockModalEval}/unlock`, {
        unlock_reason: unlockReason,
      });
      toast.success(res.data.message);
      setUnlockModalEval(null);
      setUnlockReason('');
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unlock evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseScores = async (stageId, groupId = null) => {
    try {
      const res = await api.post('/projects/hod/score-releases', { stage_id: stageId, group_id: groupId });
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to release scores');
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading HOD Project Management console...</p>
        </div>
      </div>
    );
  }

  // Find guide of selected group for panel assignment COI check
  const currentSelectedGroupObj = groups.find((g) => g.id === Number(selectedGroupId));
  const isCOIViolated = currentSelectedGroupObj?.guide_faculty_id && selectedPanelistIds.includes(String(currentSelectedGroupObj.guide_faculty_id));

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">BE Project Governance Center</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Department-wide Project Lifecycle Management, Panel Assignments, &amp; Score Governance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-draft">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input-field py-1 text-xs font-mono font-bold"
          >
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-rule pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Executive Overview
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'groups' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Groups &amp; Guides ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'stages' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Stages &amp; Rubrics ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('panels')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'panels' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Panel Assignment (COI Guard)
        </button>
        <button
          onClick={() => setActiveTab('governance')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'governance' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Score Release &amp; Unlock
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
            activeTab === 'reports' ? 'bg-navy text-white' : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Consolidated Reports &amp; Export
        </button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-rule rounded">
              <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total BE Groups</p>
              <p className="font-serif text-3xl font-bold text-navy mt-1">{dashboardData.total_groups}</p>
              <p className="text-xs text-draft mt-1 font-medium">{academicYear} Academic Year</p>
            </div>
            <div className="p-4 bg-white border border-rule rounded">
              <p className="text-xs uppercase tracking-wider text-draft font-semibold">Active Guided Groups</p>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">
                {dashboardData.group_status_breakdown.find((b) => b.status === 'ACTIVE')?.count || 0}
              </p>
              <p className="text-xs text-emerald-700 mt-1 font-medium">Guide assigned</p>
            </div>
            <div className="p-4 bg-white border border-rule rounded">
              <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pending Guide Approval</p>
              <p className="font-serif text-3xl font-bold text-amber-700 mt-1">
                {dashboardData.group_status_breakdown.find((b) => b.status === 'PENDING_GUIDE_APPROVAL')?.count || 0}
              </p>
              <p className="text-xs text-amber-700 mt-1 font-medium">Action required</p>
            </div>
            <div className="p-4 bg-white border border-rule rounded">
              <p className="text-xs uppercase tracking-wider text-draft font-semibold">Evaluation Stages</p>
              <p className="font-serif text-3xl font-bold text-ink mt-1">{dashboardData.stages.length}</p>
              <p className="text-xs text-draft mt-1 font-medium">Configured rubrics</p>
            </div>
          </div>

          {/* Faculty Load Matrix */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="font-serif text-xl font-semibold">Faculty Workload Matrix (Guides &amp; Panel Examiners)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th>Designation</th>
                    <th className="numeric">Guided Groups (Max 5)</th>
                    <th className="numeric">Panel Assignments</th>
                    <th>Capacity Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.faculty_load.map((fac) => (
                    <tr key={fac.faculty_id}>
                      <td className="font-bold text-sm text-ink">{fac.name}</td>
                      <td className="text-xs text-draft">{fac.designation}</td>
                      <td className="numeric font-mono font-bold text-navy">{fac.guided_groups} / 5</td>
                      <td className="numeric font-mono font-bold text-navy">{fac.panel_assignments}</td>
                      <td>
                        {Number(fac.guided_groups) >= 5 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            At Max Capacity
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Available ({5 - Number(fac.guided_groups)} open slots)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GROUPS & GUIDES */}
      {activeTab === 'groups' && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Department BE Project Groups</h2>
            <span className="text-xs text-draft font-mono font-medium">Total: {groups.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Group Code</th>
                  <th>Title &amp; Domain</th>
                  <th>Roster</th>
                  <th>Guide Status</th>
                  <th>Group Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className="font-mono text-sm font-bold text-navy">{g.group_code}</td>
                    <td className="max-w-md">
                      <div className="font-semibold text-ink text-sm leading-snug">{g.title}</div>
                      <div className="text-xs text-draft mt-0.5">{g.domain}</div>
                    </td>
                    <td className="text-xs text-draft">
                      {g.members.map((m, idx) => (
                        <div key={idx} className="truncate">{m.name} ({m.roll_no}) {m.is_leader && '★'}</div>
                      ))}
                    </td>
                    <td className="font-medium text-xs">
                      {g.guide_name ? (
                        <span className="text-emerald-800 font-semibold">{g.guide_name}</span>
                      ) : (
                        <span className="text-amber-800 italic">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
                        g.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          setGuideModalGroup(g);
                          setSelectedGuideId(g.guide_faculty_id ? String(g.guide_faculty_id) : '');
                        }}
                        className="px-3 py-1 bg-paper border border-rule hover:bg-gray-100 rounded text-xs font-semibold text-ink"
                      >
                        {g.guide_name ? 'Reassign Guide' : 'Assign Guide'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STAGES & RUBRICS */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-serif text-2xl font-bold text-ink">Evaluation Stages &amp; Criteria Rubrics</h2>
            <button
              onClick={() => {
                setStageForm({
                  name: '',
                  sequence_order: stages.length + 1,
                  scheduled_date_from: '',
                  scheduled_date_to: '',
                  max_marks_total: 100,
                  aggregation_rule: 'AVERAGE',
                  criteria: [{ name: 'Problem Statement & Scope', max_marks: 25 }],
                });
                setStageModal(true);
              }}
              className="btn-primary py-2 px-4 text-xs font-semibold"
            >
              + Add Evaluation Stage
            </button>
          </div>

          <div className="space-y-6">
            {stages.map((stage) => (
              <div key={stage.id} className="panel">
                <div className="panel-header flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                      Sequence #{stage.sequence_order}
                    </span>
                    <h3 className="font-serif text-lg font-bold text-ink">{stage.name}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-semibold text-draft bg-gray-100 px-2.5 py-1 rounded">
                      Max Marks: {stage.max_marks_total} · Rule: {stage.aggregation_rule}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <table className="w-full text-xs mb-4">
                    <thead>
                      <tr className="border-b border-rule bg-paper text-draft text-left">
                        <th className="p-2">#</th>
                        <th className="p-2">Rubric Criterion Name</th>
                        <th className="p-2 text-right">Max Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {stage.criteria.map((crit, idx) => (
                        <tr key={crit.id}>
                          <td className="p-2 font-mono text-draft">{idx + 1}</td>
                          <td className="p-2 font-bold text-ink">{crit.name}</td>
                          <td className="p-2 text-right font-mono font-bold text-navy">{crit.max_marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PANEL ASSIGNMENT & COI */}
      {activeTab === 'panels' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs font-medium space-y-1">
            <p className="font-bold uppercase tracking-wider text-amber-950">🛡️ Conflict-of-Interest (COI) Enforcement Rule</p>
            <p>The system automatically validates panel assignments against project guides. A project guide cannot be assigned as a panel member for their own group at any stage.</p>
          </div>

          <div className="panel p-6 max-w-2xl mx-auto space-y-6">
            <h2 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3">Assign Panel Evaluators to Group</h2>

            <form onSubmit={handleAssignPanel} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Select Evaluation Stage *</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Select Stage...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Max {s.max_marks_total})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Select Project Group *</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => {
                      setSelectedGroupId(e.target.value);
                      setSelectedPanelistIds([]);
                    }}
                    className="input-field"
                    required
                  >
                    <option value="">Select Group...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_code} — {g.title.substring(0, 35)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currentSelectedGroupObj && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-navy">
                  <p><span className="font-bold">Group Guide:</span> {currentSelectedGroupObj.guide_name || 'Unassigned'}</p>
                </div>
              )}

              {/* Panelist Checkboxes */}
              <div>
                <label className="input-label">Select Panel Examiners (1 to 3) *</label>
                <div className="space-y-2 mt-2 max-h-48 overflow-y-auto p-3 border border-rule rounded bg-paper">
                  {availableGuides.map((fac) => {
                    const isGuideOfThisGroup = currentSelectedGroupObj?.guide_faculty_id === fac.faculty_id;
                    return (
                      <label
                        key={fac.faculty_id}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border ${
                          isGuideOfThisGroup ? 'bg-red-50 border-red-300 text-red-800 font-semibold' : 'bg-white border-rule text-ink'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isGuideOfThisGroup}
                            checked={selectedPanelistIds.includes(String(fac.faculty_id))}
                            onChange={(e) => {
                              const idStr = String(fac.faculty_id);
                              if (e.target.checked) {
                                setSelectedPanelistIds([...selectedPanelistIds, idStr]);
                              } else {
                                setSelectedPanelistIds(selectedPanelistIds.filter((x) => x !== idStr));
                              }
                            }}
                          />
                          <span>{fac.name} ({fac.designation})</span>
                        </div>
                        {isGuideOfThisGroup ? (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-300">
                            GUIDE (COI BLOCKED)
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-draft">{fac.current_guided_groups} guided</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {isCOIViolated && (
                <div className="p-3 bg-red-100 text-red-900 border border-red-300 rounded text-xs font-bold">
                  ❌ Cannot assign: Group Guide is selected as panel examiner! Please uncheck the guide to proceed.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || isCOIViolated}
                className="btn-primary w-full text-center py-2.5"
              >
                {submitting ? 'Saving...' : 'Save Panel Assignment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: SCORE RELEASE & GOVERNANCE */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="panel p-6 space-y-4">
            <h2 className="font-serif text-xl font-bold text-ink">Score Visibility Control (Release to Students)</h2>
            <p className="text-xs text-draft">Publish continuous assessment marks &amp; panel remarks per stage.</p>
            <div className="grid md:grid-cols-3 gap-4 pt-2">
              {stages.map((stage) => (
                <div key={stage.id} className="p-4 border border-rule rounded bg-paper flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-navy uppercase">Stage #{stage.sequence_order}</span>
                    <h3 className="font-serif text-base font-bold text-ink mt-0.5">{stage.name}</h3>
                  </div>
                  <button
                    onClick={() => handleReleaseScores(stage.id)}
                    className="w-full btn-primary py-1.5 text-xs text-center font-semibold"
                  >
                    Release Scores to Students →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS & EXPORT */}
      {activeTab === 'reports' && reportData && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Consolidated BE Project Marksheet Report</h2>
            <button
              onClick={() => {
                const jsonStr = JSON.stringify(reportData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BE_Project_Marksheet_${academicYear}.json`;
                a.click();
                toast.success('Report downloaded');
              }}
              className="px-3 py-1 bg-navy text-white rounded text-xs font-semibold hover:bg-blue-900"
            >
              Export JSON Report ↓
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Group Code</th>
                  <th>Title &amp; Domain</th>
                  <th>Guide</th>
                  <th>Team Members</th>
                  {reportData.stages.map((st, idx) => (
                    <th key={idx} className="numeric">{st}</th>
                  ))}
                  <th className="numeric">Total Aggregate</th>
                </tr>
              </thead>
              <tbody>
                {reportData.report.map((r, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-sm font-bold text-navy">{r.group_code}</td>
                    <td className="max-w-xs">
                      <div className="font-semibold text-ink text-xs">{r.title}</div>
                      <div className="text-[10px] text-draft">{r.domain}</div>
                    </td>
                    <td className="text-xs text-ink font-medium">{r.guide}</td>
                    <td className="text-xs text-draft">{r.members}</td>
                    {reportData.stages.map((st, sIdx) => (
                      <td key={sIdx} className="numeric font-mono font-bold text-ink">
                        {r[st]}
                      </td>
                    ))}
                    <td className="numeric font-serif font-bold text-base text-navy">{r.total_aggregate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ASSIGN GUIDE MODAL */}
      {guideModalGroup && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-xl">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-rule pb-2 mb-4">
              Assign Guide for {guideModalGroup.group_code}
            </h3>
            <form onSubmit={handleAssignGuide} className="space-y-4">
              <div>
                <label className="input-label">Select Faculty Guide *</label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select Guide...</option>
                  {availableGuides.map((g) => (
                    <option key={g.faculty_id} value={g.faculty_id}>
                      {g.name} ({g.designation}) — {g.current_guided_groups} guided
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setGuideModalGroup(null)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  Assign Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
