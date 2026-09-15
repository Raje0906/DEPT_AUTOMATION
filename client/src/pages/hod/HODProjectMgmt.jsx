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

  // Panel Matrix & Auto-Assign state
  const [panelMatrix, setPanelMatrix] = useState([]);
  const [panelMatrixStageId, setPanelMatrixStageId] = useState('');
  const [panelSearchQuery, setPanelSearchQuery] = useState('');

  const [autoAssignModal, setAutoAssignModal] = useState(false);
  const [autoAssignStageId, setAutoAssignStageId] = useState('');
  const [autoAssignPanelSize, setAutoAssignPanelSize] = useState(2);

  const [copyStageModal, setCopyStageModal] = useState(false);
  const [copySourceStageId, setCopySourceStageId] = useState('');
  const [copyTargetStageId, setCopyTargetStageId] = useState('');

  // Modals & form state
  const [guideModalGroup, setGuideModalGroup] = useState(null);
  const [selectedGuideId, setSelectedGuideId] = useState('');

  const [stageModal, setStageModal] = useState(null); // new or edit
  const [stageForm, setStageForm] = useState({
    name: '',
    sequence_order: 1,
    scheduled_date_from: '',
    scheduled_date_to: '',
    max_marks_total: 50,
    aggregation_rule: 'AVERAGE',
    criteria: [
      { name: 'Attendance', max_marks: 10 },
      { name: 'Presentation', max_marks: 10 },
      { name: 'Subject Understanding', max_marks: 10 },
      { name: 'Publication', max_marks: 10 },
      { name: 'Viva', max_marks: 10 },
    ],
  });

  const [panelModal, setPanelModal] = useState(null); // group + stage selection
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPanelistIds, setSelectedPanelistIds] = useState([]);

  const [unlockModalEval, setUnlockModalEval] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPanelMatrix = async (stageId) => {
    if (!stageId) return;
    try {
      const res = await api.get(`/projects/hod/panel-matrix?academic_year=${academicYear}&stage_id=${stageId}`);
      setPanelMatrix(res.data);
    } catch (err) {
      console.error('Failed to fetch panel matrix:', err);
    }
  };

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

      const defaultStage = stagesRes.data?.[0]?.id;
      if (defaultStage) {
        setPanelMatrixStageId(String(defaultStage));
        setSelectedStageId(String(defaultStage));
        fetchPanelMatrix(defaultStage);
      }
    } catch (err) {
      toast.error('Failed to load HOD project data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHODData();
  }, [academicYear]);

  useEffect(() => {
    if (panelMatrixStageId) {
      fetchPanelMatrix(panelMatrixStageId);
    }
  }, [panelMatrixStageId]);

  // Handlers
  const handleAssignGuide = async (e) => {
    e.preventDefault();
    if (!guideModalGroup) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/projects/hod/groups/${guideModalGroup.id}/guide`, {
        guide_id: selectedGuideId ? Number(selectedGuideId) : null,
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
      setStageModal(null);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save stage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStage = async (stageId, stageName) => {
    if (!window.confirm(`Are you sure you want to delete stage "${stageName}"? All panel assignments for this stage will also be removed.`)) {
      return;
    }
    try {
      const res = await api.delete(`/projects/hod/stages/${stageId}`);
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete stage');
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
      if (panelMatrixStageId) fetchPanelMatrix(panelMatrixStageId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Panel assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoAssignPanels = async (e) => {
    e.preventDefault();
    if (!autoAssignStageId) return toast.error('Please select an evaluation stage');
    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/panel-auto-assign', {
        stage_id: Number(autoAssignStageId),
        academic_year: academicYear,
        panel_size: Number(autoAssignPanelSize),
      });
      toast.success(res.data.message);
      setAutoAssignModal(false);
      fetchHODData();
      if (panelMatrixStageId) fetchPanelMatrix(panelMatrixStageId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Auto-assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyStagePanels = async (e) => {
    e.preventDefault();
    if (!copySourceStageId || !copyTargetStageId) {
      return toast.error('Please select source and target stages');
    }
    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/panel-copy-stage', {
        source_stage_id: Number(copySourceStageId),
        target_stage_id: Number(copyTargetStageId),
      });
      toast.success(res.data.message);
      setCopyStageModal(false);
      fetchHODData();
      if (panelMatrixStageId) fetchPanelMatrix(panelMatrixStageId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to copy stage panels');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearStagePanels = async () => {
    if (!panelMatrixStageId) return toast.error('Please select an evaluation stage');
    if (!window.confirm('Are you sure you want to clear/reset all panel assignments for this stage?')) return;
    try {
      const res = await api.post('/projects/hod/panel-clear', { stage_id: Number(panelMatrixStageId) });
      toast.success(res.data.message);
      fetchHODData();
      fetchPanelMatrix(panelMatrixStageId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear panel assignments');
    }
  };

  const handleClearAllGuides = async () => {
    if (!window.confirm(`Are you sure you want to reset/unassign project guides for ALL groups in academic year ${academicYear}?`)) return;
    try {
      const res = await api.post('/projects/hod/groups/clear-guides', { academic_year: academicYear });
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear guide assignments');
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

  // Filter matrix groups
  const filteredMatrix = panelMatrix.filter((g) => {
    if (!panelSearchQuery) return true;
    const q = panelSearchQuery.toLowerCase();
    return (
      g.group_code?.toLowerCase().includes(q) ||
      g.title?.toLowerCase().includes(q) ||
      g.domain?.toLowerCase().includes(q) ||
      g.guide_name?.toLowerCase().includes(q)
    );
  });

  // Find guide of selected group
  const currentSelectedGroupObj = groups.find((g) => g.id === Number(selectedGroupId));

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
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'overview' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          📊 Governance Overview
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'groups' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          👥 Groups &amp; Guides ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'stages' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          📝 Evaluation Stages ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('panels')}
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'panels' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          🛡️ Panel Assignments &amp; COI
        </button>
        <button
          onClick={() => setActiveTab('governance')}
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'governance' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          🔓 Score Release &amp; Unlocks
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 text-xs font-semibold rounded ${
            activeTab === 'reports' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
          }`}
        >
          📋 Marksheet Reports
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Total Project Groups</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">
                {dashboardData.stats?.total_groups ?? dashboardData.total_groups}
              </p>
            </div>
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Guide Assigned Groups</span>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">
                {dashboardData.stats?.guide_assigned_groups ?? (dashboardData.group_status_breakdown?.find((b) => b.status === 'ACTIVE')?.count || 0)}
              </p>
            </div>
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Pending Guide Assignment</span>
              <p className="font-serif text-3xl font-bold text-amber-700 mt-1">
                {dashboardData.stats?.pending_guide_groups ?? groups.filter((g) => !g.guide_id).length}
              </p>
            </div>
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Evaluation Stages</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">
                {dashboardData.stats?.stages_count ?? dashboardData.stages.length}
              </p>
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
            <div>
              <h2 className="font-serif text-xl font-semibold">Department BE Project Groups</h2>
              <span className="text-xs text-draft font-mono font-medium">Total: {groups.length} groups</span>
            </div>
            <button
              type="button"
              onClick={handleClearAllGuides}
              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>🗑️</span> Reset / Unassign All Guides
            </button>
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
                    <td className="max-w-xs">
                      <div className="font-semibold text-ink text-sm">{g.title}</div>
                      <div className="text-xs text-draft">{g.domain}</div>
                    </td>
                    <td>
                      <div className="text-xs text-ink">{g.members_count || g.members?.length || 0} members</div>
                      <div className="text-[10px] text-draft truncate max-w-[180px]">
                        {g.leader_name || g.members?.find(m => m.is_leader)?.name || 'Leader'} (Leader)
                      </div>
                    </td>
                    <td>
                      {g.guide_name ? (
                        <div>
                          <div className="font-bold text-emerald-800 text-xs">{g.guide_name}</div>
                          <div className="text-[10px] text-draft">{g.guide_designation}</div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${g.status === 'ACTIVE' ? 'badge-published' : 'badge-draft'}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          setGuideModalGroup(g);
                          setSelectedGuideId(g.guide_faculty_id ? String(g.guide_faculty_id) : '');
                        }}
                        className="btn-secondary py-1 px-3 text-xs"
                      >
                        {g.guide_name ? 'Change Guide' : 'Assign Guide'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STAGES */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-serif text-xl font-bold text-ink">Continuous Assessment Evaluation Stages</h2>
            <button
              onClick={() => {
                setStageModal('new');
                setStageForm({
                  name: '',
                  sequence_order: stages.length + 1,
                  scheduled_date_from: '',
                  scheduled_date_to: '',
                  max_marks_total: 50,
                  aggregation_rule: 'AVERAGE',
                  criteria: [
                    { name: 'Attendance', max_marks: 10 },
                    { name: 'Presentation', max_marks: 10 },
                    { name: 'Subject Understanding', max_marks: 10 },
                    { name: 'Publication', max_marks: 10 },
                    { name: 'Viva', max_marks: 10 },
                  ],
                });
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
                    <button
                      onClick={() => {
                        setStageModal('edit');
                        setStageForm({
                          id: stage.id,
                          name: stage.name,
                          sequence_order: stage.sequence_order,
                          scheduled_date_from: stage.scheduled_date_from || '',
                          scheduled_date_to: stage.scheduled_date_to || '',
                          max_marks_total: stage.max_marks_total,
                          aggregation_rule: stage.aggregation_rule,
                          criteria: stage.criteria || [],
                        });
                      }}
                      className="btn-secondary py-1 px-3 text-xs font-semibold"
                    >
                      Edit Stage
                    </button>
                    <button
                      onClick={() => handleDeleteStage(stage.id, stage.name)}
                      className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold hover:bg-red-100"
                    >
                      🗑️ Delete Stage
                    </button>
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

      {/* TAB 4: PANEL ASSIGNMENT & COI (BATCH & HIGH PERFORMANCE MATRIX) */}
      {activeTab === 'panels' && (
        <div className="space-y-6">
          {/* Optimization Banners & One-Click Bulk Triggers */}
          <div className="bg-white border border-rule rounded p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rule pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-navy uppercase tracking-wider bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded">
                  High-Performance Panel Center (60+ Groups)
                </span>
                <h2 className="font-serif text-2xl font-bold text-ink mt-1">Batch Panel Assignments</h2>
                <p className="text-xs text-draft mt-0.5">
                  Automate panel distribution &amp; workload balancing across department faculty.
                </p>
              </div>

              {/* Bulk Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (stages.length > 0) setAutoAssignStageId(String(stages[0].id));
                    setAutoAssignModal(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span>⚡</span> Auto-Assign All Groups
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stages.length >= 2) {
                      setCopySourceStageId(String(stages[0].id));
                      setCopyTargetStageId(String(stages[1].id));
                    }
                    setCopyStageModal(true);
                  }}
                  className="px-4 py-2.5 bg-navy hover:bg-blue-900 text-white text-xs font-bold rounded flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span>📋</span> Copy Stage Panels
                </button>
                <button
                  type="button"
                  onClick={handleClearStagePanels}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span>🗑️</span> Clear Stage Panels
                </button>
              </div>
            </div>

            {/* Stage Selector & Search Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-navy whitespace-nowrap">Select Stage Matrix:</label>
                <select
                  value={panelMatrixStageId}
                  onChange={(e) => {
                    const sId = e.target.value;
                    setPanelMatrixStageId(sId);
                    setSelectedStageId(sId);
                    fetchPanelMatrix(sId);
                  }}
                  className="input-field py-1.5 text-xs font-bold border-navy/30 focus:border-navy"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Filter by code, title, domain, or guide..."
                  value={panelSearchQuery}
                  onChange={(e) => setPanelSearchQuery(e.target.value)}
                  className="input-field text-xs py-1.5 pl-8"
                />
                <span className="absolute left-2.5 top-2 text-xs text-draft">🔍</span>
              </div>
            </div>
          </div>

          {/* Interactive Batch Panel Matrix Table */}
          <div className="panel overflow-hidden">
            <div className="panel-header flex items-center justify-between bg-paper/50">
              <h3 className="font-serif text-lg font-bold text-ink">
                Group Panel Assignment Matrix ({filteredMatrix.length} groups)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId('');
                  setSelectedPanelistIds([]);
                  setPanelModal(true);
                }}
                className="btn-primary py-1.5 px-3 text-xs"
              >
                + Manual Single Group Assignment
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="result-table text-xs">
                <thead>
                  <tr className="bg-paper border-b border-rule text-draft font-bold">
                    <th className="p-3 w-28">Group Code</th>
                    <th className="p-3 min-w-[220px]">Project Title &amp; Domain</th>
                    <th className="p-3 min-w-[160px]">Assigned Guide</th>
                    <th className="p-3 min-w-[240px]">Assigned Panel Examiners</th>
                    <th className="p-3 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-draft">
                        No project groups match your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((g) => {
                      const hasPanelists = g.panelists && g.panelists.length > 0;
                      return (
                        <tr key={g.id} className="hover:bg-paper/40 font-medium">
                          <td className="p-3 font-mono font-bold text-navy whitespace-nowrap">{g.group_code}</td>
                          <td className="p-3">
                            <div className="font-semibold text-ink leading-snug">{g.title}</div>
                            <div className="text-[10px] text-draft font-mono mt-0.5">{g.domain}</div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {g.guide_name ? (
                              <div>
                                <span className="font-bold text-ink block">{g.guide_name}</span>
                                <span className="text-[10px] text-draft block">{g.guide_designation}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                Guide Unassigned
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {hasPanelists ? (
                              <div className="flex flex-wrap gap-1.5">
                                {g.panelists.map((p) => (
                                  <span
                                    key={p.faculty_id}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-50 text-navy border border-blue-200"
                                  >
                                    {p.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-draft text-[11px] italic font-mono">No examiners assigned</span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedStageId(panelMatrixStageId);
                                setSelectedGroupId(String(g.id));
                                setSelectedPanelistIds(g.panelists.map((p) => String(p.faculty_id)));
                                setPanelModal(true);
                              }}
                              className="btn-secondary text-[11px] py-1 px-2.5"
                            >
                              Edit Panel
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-ASSIGN MODAL */}
      {autoAssignModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center gap-2">
              <span className="text-emerald-700">⚡</span> One-Click Auto-Assign Panels
            </h3>

            <form onSubmit={handleAutoAssignPanels} className="space-y-4">
              <div>
                <label className="input-label">Target Evaluation Stage *</label>
                <select
                  value={autoAssignStageId}
                  onChange={(e) => setAutoAssignStageId(e.target.value)}
                  className="input-field text-sm"
                  required
                >
                  <option value="">Select Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Examiners per Panel Group *</label>
                <select
                  value={autoAssignPanelSize}
                  onChange={(e) => setAutoAssignPanelSize(Number(e.target.value))}
                  className="input-field text-sm font-mono"
                >
                  <option value={2}>2 Examiners per Panel</option>
                  <option value={3}>3 Examiners per Panel</option>
                </select>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Automated Distribution:</p>
                <p className="leading-relaxed text-[11px]">
                  Automatically distributes all {groups.length} project groups across available department faculty members balancing evaluation workloads.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setAutoAssignModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800"
                >
                  {submitting ? 'Running Auto-Assign...' : 'Run Auto-Assignment →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COPY STAGE PANELS MODAL */}
      {copyStageModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center gap-2">
              <span className="text-navy">📋</span> Copy Panel Assignments Between Stages
            </h3>

            <form onSubmit={handleCopyStagePanels} className="space-y-4">
              <div>
                <label className="input-label">Copy FROM Source Stage *</label>
                <select
                  value={copySourceStageId}
                  onChange={(e) => setCopySourceStageId(e.target.value)}
                  className="input-field text-sm"
                  required
                >
                  <option value="">Select Source Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Copy TO Target Stage *</label>
                <select
                  value={copyTargetStageId}
                  onChange={(e) => setCopyTargetStageId(e.target.value)}
                  className="input-field text-sm"
                  required
                >
                  <option value="">Select Target Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-navy">
                <p className="font-bold">Instant Bulk Replication:</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Copies panel examiners across all groups from the source stage to the target stage in one click.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setCopyStageModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 px-5 text-xs font-bold">
                  {submitting ? 'Copying Panels...' : 'Confirm & Copy Panels'}
                </button>
              </div>
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
                >
                  <option value="">-- Leave Unassigned --</option>
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
                  {selectedGuideId ? 'Assign Guide' : 'Clear / Unassign Guide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PANEL ASSIGNMENT MODAL (SINGLE GROUP) */}
      {panelModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-lg w-full p-6 shadow-2xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <span>Assign Panel Evaluators</span>
              <button
                type="button"
                onClick={() => setPanelModal(false)}
                className="text-draft hover:text-ink font-bold text-base"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleAssignPanel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Select Evaluation Stage *</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="input-field text-xs"
                    required
                  >
                    <option value="">Select Stage...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Stage #{s.sequence_order})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Select Project Group *</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => {
                      const gId = e.target.value;
                      setSelectedGroupId(gId);
                      const groupInMatrix = panelMatrix.find((x) => String(x.id) === String(gId));
                      if (groupInMatrix) {
                        setSelectedPanelistIds(groupInMatrix.panelists.map((p) => String(p.faculty_id)));
                      } else {
                        setSelectedPanelistIds([]);
                      }
                    }}
                    className="input-field text-xs"
                    required
                  >
                    <option value="">Select Group...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_code} — {g.title.substring(0, 30)}...
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

              <div>
                <label className="input-label">Select Panel Examiners (1 to 3) *</label>
                <div className="space-y-2 mt-2 max-h-52 overflow-y-auto p-3 border border-rule rounded bg-paper">
                  {availableGuides.map((fac) => (
                    <label
                      key={fac.faculty_id}
                      className="flex items-center justify-between p-2 rounded text-xs cursor-pointer border bg-white border-rule text-ink hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
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
                      <span className="text-[10px] font-mono text-draft">{fac.current_guided_groups} guided</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setPanelModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2 px-5 text-xs font-bold"
                >
                  {submitting ? 'Saving...' : 'Save Panel Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTO ASSIGN PANELS MODAL */}
      {autoAssignModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-rule pb-2 mb-4">
              ⚡ Batch Auto-Assign Panels
            </h3>
            <form onSubmit={handleAutoAssignPanels} className="space-y-4">
              <div>
                <label className="input-label">Target Evaluation Stage *</label>
                <select
                  value={autoAssignStageId}
                  onChange={(e) => setAutoAssignStageId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">Select Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Panelists Per Group *</label>
                <select
                  value={panelistsPerGroup}
                  onChange={(e) => setPanelistsPerGroup(Number(e.target.value))}
                  className="input-field text-xs"
                >
                  <option value={1}>1 Evaluator per group</option>
                  <option value={2}>2 Evaluators per group</option>
                  <option value={3}>3 Evaluators per group</option>
                </select>
              </div>
              <p className="text-xs text-draft italic">
                Auto-assigns faculty panelists fairly balancing workloads.
              </p>
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setAutoAssignModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 px-5 text-xs font-bold">
                  {submitting ? 'Auto-Assigning...' : 'Run Auto-Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COPY STAGE PANELS MODAL */}
      {copyStageModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-ink border-b border-rule pb-2 mb-4">
              📋 Copy Panel Assignments From Stage
            </h3>
            <form onSubmit={handleCopyStagePanels} className="space-y-4">
              <div>
                <label className="input-label">Source Stage (Copy FROM) *</label>
                <select
                  value={copySourceStageId}
                  onChange={(e) => setCopySourceStageId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">Select Source Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Target Stage (Copy TO) *</label>
                <select
                  value={copyTargetStageId}
                  onChange={(e) => setCopyTargetStageId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">Select Target Stage...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Stage #{s.sequence_order})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setCopyStageModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 px-5 text-xs font-bold">
                  {submitting ? 'Copying Panels...' : 'Confirm & Copy Panels'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVALUATION STAGE MODAL (CREATE / EDIT) */}
      {stageModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <span>{stageModal === 'edit' ? 'Edit Evaluation Stage' : 'Add New Evaluation Stage'}</span>
              <button
                type="button"
                onClick={() => setStageModal(null)}
                className="text-draft hover:text-ink font-bold text-base"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleSaveStage} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Stage Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mid Term Review"
                    value={stageForm.name}
                    onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>

                <div>
                  <label className="input-label">Sequence Order *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stageForm.sequence_order}
                    onChange={(e) => setStageForm({ ...stageForm, sequence_order: Number(e.target.value) })}
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="input-label">Max Marks Total *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stageForm.max_marks_total}
                    onChange={(e) => setStageForm({ ...stageForm, max_marks_total: Number(e.target.value) })}
                    className="input-field text-xs font-mono font-bold text-navy"
                  />
                </div>

                <div>
                  <label className="input-label">Aggregation Rule *</label>
                  <select
                    value={stageForm.aggregation_rule}
                    onChange={(e) => setStageForm({ ...stageForm, aggregation_rule: e.target.value })}
                    className="input-field text-xs"
                  >
                    <option value="AVERAGE">Average Marks across Panelists</option>
                    <option value="SUM">Sum of Marks</option>
                  </select>
                </div>
              </div>

              {/* Rubric Criteria builder */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between border-b border-rule pb-1.5">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider">
                    Rubric Evaluation Criteria ({stageForm.criteria?.length || 0})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStageForm({
                        ...stageForm,
                        criteria: [...(stageForm.criteria || []), { name: '', max_marks: 10 }],
                      });
                    }}
                    className="text-xs font-bold text-navy hover:underline"
                  >
                    + Add Criterion
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-rule rounded bg-paper">
                  {stageForm.criteria?.map((crit, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-rule rounded shadow-2xs">
                      <span className="text-xs font-mono text-draft font-bold w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        placeholder="Criterion Name (e.g. Viva)"
                        value={crit.name}
                        onChange={(e) => {
                          const updated = [...stageForm.criteria];
                          updated[idx].name = e.target.value;
                          setStageForm({ ...stageForm, criteria: updated });
                        }}
                        className="input-field text-xs flex-1"
                      />
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Max"
                          value={crit.max_marks}
                          onChange={(e) => {
                            const updated = [...stageForm.criteria];
                            updated[idx].max_marks = Number(e.target.value);
                            setStageForm({ ...stageForm, criteria: updated });
                          }}
                          className="input-field text-xs font-mono font-bold text-right"
                        />
                      </div>
                      {stageForm.criteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = stageForm.criteria.filter((_, cIdx) => cIdx !== idx);
                            setStageForm({ ...stageForm, criteria: updated });
                          }}
                          className="text-xs font-bold text-red-600 hover:text-red-800 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setStageModal(null)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary py-2 px-5 text-xs font-bold">
                  {submitting ? 'Saving Stage...' : 'Save Evaluation Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
