import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function HODProjectMgmt() {
  const { user } = useAuth();
  const isHOD = user?.role === 'hod';
  const isCoordinator = user?.role === 'faculty' && user?.is_project_coordinator;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'approvals' | 'groups' | 'stages' | 'panels' | 'governance'
  const [academicYear, setAcademicYear] = useState('2026-27');

  // Backend state
  const [dashboardData, setDashboardData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [stages, setStages] = useState([]);
  const [availableGuides, setAvailableGuides] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState(null);

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

  // Range & Domain Panel Assignment State
  const [rangeAssignModal, setRangeAssignModal] = useState(false);
  const [rangeTargetMode, setRangeTargetMode] = useState('RANGE'); // 'RANGE' | 'DOMAIN'
  const [rangeStageId, setRangeStageId] = useState('');
  const [rangeStartGroupId, setRangeStartGroupId] = useState('');
  const [rangeEndGroupId, setRangeEndGroupId] = useState('');
  const [rangeFilterDomain, setRangeFilterDomain] = useState('ALL');
  const [rangeSelectedDomain, setRangeSelectedDomain] = useState('');
  const [domainSelectedGroupIds, setDomainSelectedGroupIds] = useState([]);
  const [rangePanelistIds, setRangePanelistIds] = useState([]);
  const [rangeSkipGuideConflict, setRangeSkipGuideConflict] = useState(true);

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

  // Registration Settings State
  const [regSettings, setRegSettings] = useState({ is_registration_open: true, due_date: null, is_open: true });
  const [dueDateInput, setDueDateInput] = useState('');
  const [submittingRegSettings, setSubmittingRegSettings] = useState(false);

  // Groups Tab Filtering & Excel Import State
  const fileInputRef = useRef(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [expandedGroupId, setExpandedGroupId] = useState(null);

  // Live Activity Updates State
  const [activityUpdates, setActivityUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [updateFilter, setUpdateFilter] = useState('ALL');

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setImportingExcel(true);
    const toastId = toast.loading('Importing BE Project Groups from Excel...');
    try {
      const res = await api.post(`/projects/hod/groups/import-excel?academic_year=${academicYear}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'BE Project Groups imported successfully!', { id: toastId });
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to import Excel file', { id: toastId });
    } finally {
      setImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchActivityUpdates = async () => {
    setLoadingUpdates(true);
    try {
      const res = await api.get(`/projects/hod/activity-updates?academic_year=${academicYear}`);
      setActivityUpdates(res.data || []);
      toast.success('Activity updates refreshed');
    } catch (err) {
      console.error('Failed to load activity updates:', err);
      toast.error('Failed to refresh updates');
    } finally {
      setLoadingUpdates(false);
    }
  };

  const filteredUpdates = useMemo(() => {
    if (updateFilter === 'ALL') return activityUpdates;
    return activityUpdates.filter((u) => {
      if (updateFilter === 'GUIDES') return u.type === 'GUIDE_ASSIGNED' || u.type === 'PROJECT_GUIDE_ASSIGNED' || u.type === 'PROJECT_GUIDE_UNASSIGNED';
      if (updateFilter === 'EVALUATIONS') return u.type === 'EVALUATION_SUBMITTED';
      if (updateFilter === 'SCORES') return u.type === 'SCORE_RELEASED' || u.type === 'PROJECT_SCORE_RELEASED';
      if (updateFilter === 'GROUPS') return u.type === 'GROUP_REGISTERED';
      return true;
    });
  }, [activityUpdates, updateFilter]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (selectedDivision !== 'ALL') {
        const matchesBatch = g.batch?.toLowerCase() === selectedDivision.toLowerCase();
        const matchesMemberDiv = g.members?.some(m => m.division?.toLowerCase() === selectedDivision.toLowerCase());
        if (!matchesBatch && !matchesMemberDiv) return false;
      }
      if (groupSearch.trim()) {
        const q = groupSearch.toLowerCase().trim();
        const codeMatch = g.group_code?.toLowerCase().includes(q);
        const titleMatch = g.title?.toLowerCase().includes(q) || g.title_2?.toLowerCase().includes(q) || g.title_3?.toLowerCase().includes(q);
        const domainMatch = g.domain?.toLowerCase().includes(q);
        const guideMatch = g.guide_name?.toLowerCase().includes(q);
        const memberMatch = g.members?.some(m =>
          m.name?.toLowerCase().includes(q) ||
          m.roll_no?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
        );
        if (!codeMatch && !titleMatch && !domainMatch && !guideMatch && !memberMatch) return false;
      }
      return true;
    });
  }, [groups, selectedDivision, groupSearch]);

  const fetchHODData = async () => {
    setLoading(true);
    try {
      const [dashRes, groupsRes, stagesRes, guidesRes, pendingRes, settingsRes, updatesRes] = await Promise.all([
        api.get(`/projects/hod/dashboard?academic_year=${academicYear}`),
        api.get(`/projects/hod/groups?academic_year=${academicYear}`),
        api.get(`/projects/hod/stages?academic_year=${academicYear}`),
        api.get('/projects/student/available-guides'),
        api.get(`/projects/hod/pending-approvals?academic_year=${academicYear}`).catch(() => ({ data: { pendingGuides: [], pendingScoreReleases: [], totalPending: 0 } })),
        api.get(`/projects/registration-settings?academic_year=${academicYear}`).catch(() => ({ data: { is_registration_open: true, due_date: null, is_open: true } })),
        api.get(`/projects/hod/activity-updates?academic_year=${academicYear}`).catch(() => ({ data: [] })),
      ]);
      setDashboardData(dashRes.data);
      setGroups(groupsRes.data);
      setStages(stagesRes.data);
      setAvailableGuides(guidesRes.data);
      setPendingApprovals(pendingRes.data);
      setRegSettings(settingsRes.data);
      setActivityUpdates(updatesRes.data || []);
      if (settingsRes.data?.due_date) {
        const d = new Date(settingsRes.data.due_date);
        const pad = (n) => String(n).padStart(2, '0');
        setDueDateInput(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setDueDateInput('');
      }

      const defaultStage = stagesRes.data?.[0]?.id;
      if (defaultStage) {
        setPanelMatrixStageId(String(defaultStage));
        setSelectedStageId(String(defaultStage));
        fetchPanelMatrix(defaultStage);
      }
    } catch (err) {
      toast.error('Failed to load project management data');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmGuide = async (groupId, action) => {
    try {
      const res = await api.post(`/projects/groups/${groupId}/confirm-guide`, { action });
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process guide confirmation');
    }
  };

  const handleConfirmScoreRelease = async (releaseId, action) => {
    try {
      const res = await api.post('/projects/confirm-score-release', { release_id: releaseId, action });
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process score release confirmation');
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

  const handleRangeAssignPanels = async (e) => {
    e.preventDefault();
    if (!rangeStageId) return toast.error('Please select an evaluation stage');
    if (selectedGroupsToAssign.length === 0) {
      return toast.error(
        rangeTargetMode === 'DOMAIN'
          ? 'Please select a domain and at least 1 group'
          : 'Please select a valid start and end group range'
      );
    }
    if (rangePanelistIds.length === 0) return toast.error('Please select at least 1 panel mentor');

    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/panel-range-assign', {
        stage_id: Number(rangeStageId),
        group_ids: selectedGroupsToAssign.map((g) => g.id),
        panel_member_ids: rangePanelistIds.map(Number),
        skip_guide_conflict: rangeSkipGuideConflict,
      });

      toast.success(res.data.message);
      if (res.data.warnings && res.data.warnings.length > 0) {
        toast((t) => (
          <div className="text-xs">
            <p className="font-bold">⚠️ COI Protection Applied:</p>
            <p>{res.data.warnings.length} guide conflict(s) safely bypassed.</p>
          </div>
        ), { duration: 5000, icon: '🛡️' });
      }

      setRangeAssignModal(false);
      fetchHODData();
      if (panelMatrixStageId) fetchPanelMatrix(panelMatrixStageId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed');
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

  const handleExportFormResponses = async () => {
    try {
      const res = await api.get(`/projects/export/form-responses?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Topic Preferences form (AY ${academicYear}) (Responses).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Form responses Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export form responses Excel');
    }
  };

  const handleExportGuideAssignments = async () => {
    try {
      const res = await api.get(`/projects/export/guide-assignments?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Guide Assignments (AY ${academicYear}).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Guide assignments Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export guide assignments Excel');
    }
  };

  const handleExportScoreExcel = async () => {
    try {
      const res = await api.get(`/projects/export/score-excel?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Score Report (AY ${academicYear}).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Score Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export score Excel');
    }
  };
  const handleToggleRegistration = async (newStatus) => {
    setSubmittingRegSettings(true);
    try {
      const res = await api.patch('/projects/registration-settings', {
        academic_year: academicYear,
        is_registration_open: newStatus,
        due_date: regSettings.due_date,
      });
      toast.success(res.data.message);
      setRegSettings(res.data.settings);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update registration status');
    } finally {
      setSubmittingRegSettings(false);
    }
  };

  const handleSaveDueDate = async () => {
    setSubmittingRegSettings(true);
    try {
      const res = await api.patch('/projects/registration-settings', {
        academic_year: academicYear,
        is_registration_open: regSettings.is_registration_open,
        due_date: dueDateInput ? new Date(dueDateInput).toISOString() : null,
      });
      toast.success(res.data.message);
      setRegSettings(res.data.settings);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update due date');
    } finally {
      setSubmittingRegSettings(false);
    }
  };

  const handleClearDueDate = async () => {
    setDueDateInput('');
    setSubmittingRegSettings(true);
    try {
      const res = await api.patch('/projects/registration-settings', {
        academic_year: academicYear,
        is_registration_open: regSettings.is_registration_open,
        due_date: null,
      });
      toast.success('Registration due date cleared');
      setRegSettings(res.data.settings);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear due date');
    } finally {
      setSubmittingRegSettings(false);
    }
  };

  const handlePurgeAllGroups = async () => {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to DELETE ALL registered project group forms for Academic Year ${academicYear}?\n\nThis will permanently remove all ${groups.length} registered groups and their member details. This action CANNOT be undone.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.delete(`/projects/hod/groups/purge?academic_year=${academicYear}`);
      toast.success(res.data.message);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete registered forms');
    } finally {
      setSubmitting(false);
    }
  };



  // Memoized sorted groups & range/domain selection calculations
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) =>
      (a.group_code || '').localeCompare(b.group_code || '', undefined, { numeric: true })
    );
  }, [groups]);

  // Distinct available domains with group counts
  const availableDomains = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => {
      const d = (g.domain || 'Unspecified').trim();
      if (!map.has(d)) {
        map.set(d, []);
      }
      map.get(d).push(g);
    });
    return Array.from(map.entries())
      .map(([domain, grps]) => ({
        domain,
        count: grps.length,
        groups: grps,
      }))
      .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));
  }, [groups]);

  // Handle domain selection in modal
  const handleSelectDomain = (domain) => {
    setRangeSelectedDomain(domain);
    if (!domain) {
      setDomainSelectedGroupIds([]);
      return;
    }
    const matching = sortedGroups
      .filter((g) => (g.domain || '').trim().toLowerCase() === domain.trim().toLowerCase())
      .map((g) => String(g.id));
    setDomainSelectedGroupIds(matching);
  };

  const toggleDomainGroup = (idStr) => {
    if (domainSelectedGroupIds.includes(idStr)) {
      setDomainSelectedGroupIds(domainSelectedGroupIds.filter((x) => x !== idStr));
    } else {
      setDomainSelectedGroupIds([...domainSelectedGroupIds, idStr]);
    }
  };

  const selectAllDomainGroups = () => {
    if (!rangeSelectedDomain) return;
    const matching = sortedGroups
      .filter((g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase())
      .map((g) => String(g.id));
    setDomainSelectedGroupIds(matching);
  };

  const deselectAllDomainGroups = () => {
    setDomainSelectedGroupIds([]);
  };

  const selectedGroupsToAssign = useMemo(() => {
    if (rangeTargetMode === 'RANGE') {
      if (!rangeStartGroupId || !rangeEndGroupId || sortedGroups.length === 0) return [];
      const startIdx = sortedGroups.findIndex((g) => String(g.id) === String(rangeStartGroupId));
      const endIdx = sortedGroups.findIndex((g) => String(g.id) === String(rangeEndGroupId));
      if (startIdx === -1 || endIdx === -1) return [];
      const min = Math.min(startIdx, endIdx);
      const max = Math.max(startIdx, endIdx);
      let slice = sortedGroups.slice(min, max + 1);
      if (rangeFilterDomain && rangeFilterDomain !== 'ALL') {
        slice = slice.filter((g) => (g.domain || '').trim().toLowerCase() === rangeFilterDomain.trim().toLowerCase());
      }
      return slice;
    } else {
      // DOMAIN mode
      if (!rangeSelectedDomain) return [];
      const domainGroups = sortedGroups.filter(
        (g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase()
      );
      if (domainSelectedGroupIds.length === 0) {
        return domainGroups;
      }
      return domainGroups.filter((g) => domainSelectedGroupIds.includes(String(g.id)));
    }
  }, [rangeTargetMode, rangeStartGroupId, rangeEndGroupId, sortedGroups, rangeFilterDomain, rangeSelectedDomain, domainSelectedGroupIds]);

  const selectedGroupsInRange = selectedGroupsToAssign;

  const coiWarningsPreview = useMemo(() => {
    if (!rangeSkipGuideConflict || rangePanelistIds.length === 0 || selectedGroupsToAssign.length === 0) return [];
    const warnings = [];
    selectedGroupsToAssign.forEach((g) => {
      const guideId = g.guide_id || g.proposed_guide_id;
      if (guideId && rangePanelistIds.includes(String(guideId))) {
        const guideObj = availableGuides.find((f) => String(f.faculty_id) === String(guideId));
        warnings.push({
          group_code: g.group_code,
          guideName: guideObj ? guideObj.name : (g.guide_name || 'Guide'),
        });
      }
    });
    return warnings;
  }, [rangeSkipGuideConflict, rangePanelistIds, selectedGroupsToAssign, availableGuides]);

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
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-draft">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input-field py-1 text-xs font-mono font-bold"
          >
            <option value="2026-27">2026-27 (Current)</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
          </select>
        </div>
      </div>

      {/* Role Banner */}
      {isHOD && (
        <div className="bg-blue-50/70 border border-blue-200 text-blue-950 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏛️</span>
            <div>
              <p className="font-bold text-navy">Head of Department (HOD) Oversight Active</p>
              <p className="text-[11px] text-draft font-normal mt-0.5">
                Full direct oversight of BE Projects (AY {academicYear}). Guide assignments, continuous assessment stages, panel scoring, and live project activity updates are synced in real-time.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('updates')}
            className="px-3.5 py-1.5 bg-navy hover:bg-navy/90 text-white rounded text-xs font-bold transition-colors shadow-xs whitespace-nowrap flex items-center gap-1.5"
          >
            <span>🔔</span> View Live Activity Feed ({activityUpdates.length}) →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-rule pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-semibold rounded ${activeTab === 'overview' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          📊 Governance Overview
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={`px-4 py-2 text-xs font-semibold rounded flex items-center gap-1.5 ${activeTab === 'updates' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          <span>🔔 Activity &amp; Live Updates</span>
          {activityUpdates.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              {activityUpdates.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 text-xs font-semibold rounded ${activeTab === 'groups' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          👥 Groups &amp; Guides ({groups.length})
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 text-xs font-semibold rounded ${activeTab === 'stages' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          📝 Evaluation Stages ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('panels')}
          className={`px-4 py-2 text-xs font-semibold rounded ${activeTab === 'panels' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          🛡️ Panel Assignments
        </button>
        <button
          onClick={() => setActiveTab('governance')}
          className={`px-4 py-2 text-xs font-semibold rounded ${activeTab === 'governance' ? 'bg-navy text-white' : 'bg-paper text-draft hover:text-ink'
            }`}
        >
          🔓 Score Release &amp; Unlocks
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
              <span className="text-xs font-mono font-bold text-draft uppercase">Confirmed Guide Groups</span>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">
                {dashboardData.stats?.guide_assigned_groups ?? (dashboardData.group_status_breakdown?.find((b) => b.status === 'ACTIVE')?.count || 0)}
              </p>
            </div>
            <div
              className="panel p-5 cursor-pointer hover:border-blue-300 transition-colors"
              onClick={() => setActiveTab('updates')}
              title="Click to view full Activity & Updates Feed"
            >
              <div className="flex items-center justify-between text-xs font-mono font-bold text-draft uppercase">
                <span>Recent Updates</span>
                <span className="text-blue-600 text-[10px]">View Feed →</span>
              </div>
              <p className="font-serif text-3xl font-bold text-blue-700 mt-1">
                {activityUpdates.length}
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
              <h2 className="font-serif text-xl font-semibold">Faculty Workload Matrix (Guides &amp; Panel Mentors)</h2>
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

          {/* Recent Activity Quick Preview Widget */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Recent BE Project Activity Updates</h3>
                <span className="text-xs text-draft font-mono">Live updates for AY {academicYear}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('updates')}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors"
              >
                View Full Updates Feed ({activityUpdates.length}) →
              </button>
            </div>
            <div className="p-4">
              {activityUpdates.length === 0 ? (
                <p className="text-xs text-draft italic py-4 text-center">No recent project activities recorded yet.</p>
              ) : (
                <div className="divide-y divide-rule text-xs">
                  {activityUpdates.slice(0, 5).map((act, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm">
                          {act.type === 'GUIDE_ASSIGNED' ? '🎓' : act.type === 'EVALUATION_SUBMITTED' ? '📝' : act.type === 'SCORE_RELEASED' ? '📢' : '👥'}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{act.summary || act.action}</p>
                          {act.actor_name && <p className="text-[10px] text-draft">Action by: {act.actor_name}</p>}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-draft whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(act.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: LIVE ACTIVITY & UPDATES */}
      {activeTab === 'updates' && (
        <div className="space-y-6">
          <div className="panel">
            <div className="panel-header flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
                  <span>🔔</span> BE Project Live Activity &amp; Updates Feed
                </h3>
                <p className="text-xs text-draft mt-0.5 font-medium">
                  Real-time departmental updates of guide assignments, stage scores, panel evaluations, and student project actions for AY {academicYear}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingUpdates}
                  onClick={fetchActivityUpdates}
                  className="px-3.5 py-1.5 bg-navy hover:bg-navy/90 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>🔄</span> {loadingUpdates ? 'Refreshing...' : 'Refresh Feed'}
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="p-4 bg-paper/60 border-b border-rule flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-draft uppercase tracking-wider text-[11px] mr-1">Filter Events:</span>
              {[
                { id: 'ALL', label: 'All Activities', icon: '📋' },
                { id: 'GUIDES', label: 'Guide Assignments', icon: '🎓' },
                { id: 'EVALUATIONS', label: 'Panel Evaluations', icon: '📝' },
                { id: 'SCORES', label: 'Score Releases', icon: '📢' },
                { id: 'GROUPS', label: 'Group Registrations', icon: '👥' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setUpdateFilter(f.id)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${updateFilter === f.id
                      ? 'bg-navy text-white shadow-xs'
                      : 'bg-white hover:bg-gray-100 text-draft border border-rule'
                    }`}
                >
                  <span>{f.icon}</span> {f.label}
                </button>
              ))}
              <span className="ml-auto font-mono text-[11px] text-draft">
                Showing {filteredUpdates.length} of {activityUpdates.length} events
              </span>
            </div>

            {/* Timeline List */}
            <div className="p-6">
              {filteredUpdates.length === 0 ? (
                <div className="text-center py-12 text-draft text-sm space-y-2">
                  <p className="text-3xl">📭</p>
                  <p className="font-semibold text-ink">No updates found for this filter.</p>
                  <p className="text-xs">Events will show up here as guides are assigned, scores are published, or panel members evaluate.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUpdates.map((item, idx) => {
                    const isGuide = item.type === 'GUIDE_ASSIGNED' || item.type === 'PROJECT_GUIDE_ASSIGNED' || item.type === 'PROJECT_GUIDE_UNASSIGNED';
                    const isEval = item.type === 'EVALUATION_SUBMITTED';
                    const isScore = item.type === 'SCORE_RELEASED' || item.type === 'PROJECT_SCORE_RELEASED';
                    const isGroup = item.type === 'GROUP_REGISTERED';

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-rule bg-white hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${isGuide ? 'bg-blue-100 text-blue-800' :
                              isEval ? 'bg-emerald-100 text-emerald-800' :
                                isScore ? 'bg-purple-100 text-purple-800' :
                                  isGroup ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {isGuide ? '🎓' : isEval ? '📝' : isScore ? '📢' : isGroup ? '👥' : 'ℹ️'}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${isGuide ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  isEval ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                    isScore ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                      isGroup ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-700 border border-rule'
                                }`}>
                                {item.type.replace(/_/g, ' ')}
                              </span>
                              {item.group_code && (
                                <span className="font-mono text-xs font-bold text-navy bg-paper px-2 py-0.5 rounded border border-rule">
                                  {item.group_code}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-ink">{item.summary}</p>
                            {item.actor_name && (
                              <p className="text-xs text-draft">Recorded by: <strong className="text-ink">{item.actor_name}</strong></p>
                            )}
                            {item.overall_remarks && (
                              <p className="text-xs text-draft italic bg-paper p-1.5 rounded border border-rule mt-1 max-w-xl">
                                Remarks: &ldquo;{item.overall_remarks}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-semibold text-ink">
                            {new Date(item.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-[11px] font-mono text-draft">
                            {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GROUPS & GUIDES */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Registration Form Governance Controls Card */}
          <div className="bg-white border border-rule rounded-lg p-6 space-y-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-rule pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Registration Form</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${regSettings.is_open ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                  {regSettings.is_open ? '● Registration Form OPEN' : '● Registration Form CLOSED'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Controls Panel */}
              <div className="space-y-4 bg-paper/50 p-4 border border-rule rounded-md">
                <h4 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <span>📅</span> Registration Window
                </h4>

                <div className="space-y-4">
                  {/* Toggle Registration */}
                  <div className="flex items-center justify-between gap-4 p-3 bg-white border border-rule rounded">
                    <div>
                      <p className="text-xs font-bold text-ink">Form Submission Access</p>
                      <p className="text-[11px] text-draft">Enable or close project group registration for students.</p>
                    </div>
                    <button
                      type="button"
                      disabled={submittingRegSettings}
                      onClick={() => handleToggleRegistration(!regSettings.is_registration_open)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${regSettings.is_registration_open
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                      {regSettings.is_registration_open ? '✓ Enabled (Click to Close Form)' : '🔒 Closed (Click to Open Form)'}
                    </button>
                  </div>

                  {/* Due Date & Time Picker */}
                  <div className="p-3 bg-white border border-rule rounded space-y-2">
                    <label className="text-xs font-bold text-ink block">
                      Registration Due Date &amp; Time (Deadline):
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="datetime-local"
                        value={dueDateInput}
                        onChange={(e) => setDueDateInput(e.target.value)}
                        className="input-field text-xs py-1.5 max-w-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDueDate}
                        disabled={submittingRegSettings}
                        className="btn-primary text-xs py-1.5 px-4 font-bold whitespace-nowrap"
                      >
                        Save Due Date &amp; Time
                      </button>
                      {regSettings.due_date && (
                        <button
                          type="button"
                          onClick={handleClearDueDate}
                          disabled={submittingRegSettings}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-rule text-draft rounded text-xs font-semibold"
                        >
                          Clear Date &amp; Time
                        </button>
                      )}
                    </div>
                    {regSettings.due_date && (
                      <div className="text-xs text-draft mt-2 font-mono bg-paper p-2.5 rounded border border-rule space-y-1">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span>📅 <strong>Due Date:</strong> <span className="text-ink font-bold">{new Date(regSettings.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>
                          <span>⏰ <strong>Due Time:</strong> <span className="text-ink font-bold">{new Date(regSettings.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></span>
                        </div>
                        {regSettings.is_past_due_date && <p className="text-red-600 font-bold mt-1">⚠️ Deadline Passed</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone: Delete All Registered Forms */}
              <div className="space-y-4 bg-red-50/40 p-4 border border-red-200 rounded-md flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-red-900 flex items-center gap-2">
                    <span>⚠️</span> Danger Zone: Reset Registered Forms
                  </h4>
                  <p className="text-xs text-red-800 mt-2 leading-relaxed">
                    Delete all registered BE project group forms for Academic Year <strong>{academicYear}</strong> ({groups.length} registered groups).
                    This will clear all registered group choices and student roster submissions.
                  </p>
                </div>

                <div className="pt-4 border-t border-red-200">
                  <button
                    type="button"
                    onClick={handlePurgeAllGroups}
                    disabled={groups.length === 0}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center justify-center gap-2"
                  >
                    <span>🗑️</span> Delete All Forms Registered ({groups.length} Groups)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-semibold">Department BE Project Groups</h2>
                <span className="text-xs text-draft font-mono font-medium">
                  Total: {groups.length} groups {groups.length > 0 && `(Showing ${filteredGroups.length})`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportExcel}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={importingExcel}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="Upload BE Project Topic Preferences Form Excel"
                >
                  <span>📤</span> {importingExcel ? 'Importing...' : 'Import Preferences (Excel)'}
                </button>
                <button
                  type="button"
                  onClick={handleExportFormResponses}
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>📥</span> Form Responses (Excel)
                </button>
                <button
                  type="button"
                  onClick={handleExportGuideAssignments}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>📥</span> Guide Assignments (Excel)
                </button>
                <button
                  type="button"
                  onClick={handleClearAllGuides}
                  className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>🗑️</span> Reset / Unassign All Guides
                </button>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="p-4 bg-paper/60 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-md relative">
                <input
                  type="text"
                  placeholder="Search by code, title, domain, student name, or PRN..."
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  className="input-field text-xs py-1.5 pl-8 pr-8 w-full"
                />
                <span className="absolute left-2.5 top-2 text-draft text-xs">🔍</span>
                {groupSearch && (
                  <button
                    onClick={() => setGroupSearch('')}
                    className="absolute right-2.5 top-1.5 text-draft hover:text-ink text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-draft uppercase tracking-wider mr-1">Division:</span>
                {['ALL', 'BE-1', 'BE-2', 'BE-3', 'BE-4'].map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => setSelectedDivision(div)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${selectedDivision === div
                        ? 'bg-navy text-white shadow-xs'
                        : 'bg-white hover:bg-gray-100 text-draft border border-rule'
                      }`}
                  >
                    {div === 'ALL' ? 'All Divisions' : div}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Group Code</th>
                    <th>Division</th>
                    <th>Title &amp; Domain</th>
                    <th>Roster</th>
                    <th>Guide Status</th>
                    <th>Group Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-draft text-sm">
                        No BE project groups matched the search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((g) => {
                      const isExpanded = expandedGroupId === g.id;
                      return (
                        <React.Fragment key={g.id}>
                          <tr className={isExpanded ? 'bg-blue-50/30' : ''}>
                            <td>
                              <div className="font-mono text-sm font-bold text-navy flex items-center gap-1.5">
                                <span>{g.group_code}</span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedGroupId(isExpanded ? null : g.id)}
                                  className="text-[11px] text-draft hover:text-navy px-1 rounded bg-gray-100 hover:bg-blue-100 transition-colors"
                                  title="View full topic choices and team roster"
                                >
                                  {isExpanded ? '▲' : '▼'}
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-paper border border-rule text-ink">
                                {g.batch || 'BE-1'}
                              </span>
                            </td>
                            <td className="max-w-xs">
                              <div className="font-semibold text-ink text-sm line-clamp-2" title={g.title}>{g.title}</div>
                              <div className="text-xs text-draft mt-0.5 font-medium">{g.domain}</div>
                            </td>
                            <td>
                              <div className="text-xs text-ink font-semibold">{g.members_count || g.members?.length || 0} members</div>
                              <div className="text-[11px] text-draft truncate max-w-[180px]">
                                {g.leader_name || g.members?.find(m => m.is_leader)?.name || 'Leader'} (Leader)
                              </div>
                            </td>
                            <td>
                              {g.guide_name ? (
                                <div>
                                  <div className="font-bold text-emerald-800 text-xs">{g.guide_name}</div>
                                  <div className="text-[10px] text-draft">{g.guide_designation}</div>
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Assigned Guide
                                  </span>
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
                            <td className="text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setExpandedGroupId(isExpanded ? null : g.id)}
                                className="px-2 py-1 text-xs border border-rule rounded hover:bg-gray-100 text-draft hover:text-ink transition-colors"
                              >
                                {isExpanded ? 'Hide' : 'Topics & Team'}
                              </button>
                              <button
                                onClick={() => {
                                  setGuideModalGroup(g);
                                  setSelectedGuideId(g.proposed_guide_faculty_id || g.guide_faculty_id ? String(g.proposed_guide_faculty_id || g.guide_faculty_id) : '');
                                }}
                                className="btn-secondary py-1 px-3 text-xs"
                              >
                                {g.guide_name ? 'Change Guide' : 'Assign Guide'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr className="bg-blue-50/20 border-b-2 border-blue-200">
                              <td colSpan={7} className="p-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded border border-blue-200 shadow-2xs">
                                  {/* 3 Project Topic Choices */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5 border-b border-rule pb-2">
                                      <span>📑</span> 3 Project Topic Preferences
                                    </h4>
                                    <div className="space-y-2 text-xs">
                                      <div className="p-2.5 rounded bg-blue-50/60 border border-blue-200/60">
                                        <span className="font-bold text-navy block text-[10px] uppercase">Preference 1 (Primary Topic):</span>
                                        <p className="text-ink font-semibold mt-0.5">{g.title}</p>
                                      </div>
                                      {g.title_2 && (
                                        <div className="p-2.5 rounded bg-paper border border-rule">
                                          <span className="font-bold text-draft block text-[10px] uppercase">Preference 2 (Secondary Topic):</span>
                                          <p className="text-ink mt-0.5">{g.title_2}</p>
                                        </div>
                                      )}
                                      {g.title_3 && (
                                        <div className="p-2.5 rounded bg-paper border border-rule">
                                          <span className="font-bold text-draft block text-[10px] uppercase">Preference 3 (Tertiary Topic):</span>
                                          <p className="text-ink mt-0.5">{g.title_3}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Team Members Roster */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5 border-b border-rule pb-2">
                                      <span>👥</span> Student Team Members ({g.members?.length || 0})
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-left text-[10px] text-draft uppercase border-b border-rule">
                                            <th className="py-1">Role</th>
                                            <th className="py-1">Student Name</th>
                                            <th className="py-1">PRN</th>
                                            <th className="py-1">Div</th>
                                            <th className="py-1">Contact</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rule/60">
                                          {(g.members || []).map((m, mIdx) => (
                                            <tr key={mIdx} className="hover:bg-gray-50/60">
                                              <td className="py-1.5 font-medium">
                                                {m.is_leader ? (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-navy text-white">Leader</span>
                                                ) : (
                                                  <span className="text-draft text-[11px]">Member</span>
                                                )}
                                              </td>
                                              <td className="py-1.5 font-semibold text-ink">{m.name}</td>
                                              <td className="py-1.5 font-mono text-draft">{m.roll_no}</td>
                                              <td className="py-1.5 font-mono text-draft">{m.division || g.batch}</td>
                                              <td className="py-1.5 text-draft text-[11px]">
                                                <div>{m.email}</div>
                                                {m.mobile_no && <div className="text-[10px] text-draft/80 font-mono">📱 {m.mobile_no}</div>}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAGES */}
      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-ink">Continuous Assessment Evaluation Stages</h2>
              <p className="text-xs text-draft mt-0.5">
                Fully controlled &amp; configured by BE Project Coordinator — Create, order, and edit rubrics &amp; criteria.
              </p>
            </div>
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
                <h2 className="font-serif text-2xl font-bold text-ink mt-1">Batch Panel Assignments</h2>
              </div>

              {/* Bulk Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const selStage = panelMatrixStageId || (stages.length > 0 ? String(stages[0].id) : '');
                    setRangeStageId(selStage);
                    if (sortedGroups.length > 0) {
                      setRangeStartGroupId(String(sortedGroups[0].id));
                      setRangeEndGroupId(String(sortedGroups[Math.min(4, sortedGroups.length - 1)].id));
                    }
                    setRangePanelistIds([]);
                    setRangeAssignModal(true);
                  }}
                  className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded flex items-center gap-2 shadow-xs transition-colors"
                >
                  <span>🎯</span> Assign by Range / Domain
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const selStage = panelMatrixStageId || (stages.length > 0 ? String(stages[0].id) : '');
                    setAutoAssignStageId(selStage);
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
                    <th className="p-3 min-w-[240px]">Assigned Panel Mentors</th>
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
                              <span className="text-draft text-[11px] italic font-mono">No mentors assigned</span>
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
      {autoAssignModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                <label className="input-label">Mentors per Panel Group *</label>
                <select
                  value={autoAssignPanelSize}
                  onChange={(e) => setAutoAssignPanelSize(Number(e.target.value))}
                  className="input-field text-sm font-mono"
                >
                  <option value={2}>2 Mentors per Panel</option>
                  <option value={3}>3 Mentors per Panel</option>
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
        </div>,
        document.body
      )}

      {/* COPY STAGE PANELS MODAL */}
      {copyStageModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                  Copies panel mentors across all groups from the source stage to the target stage in one click.
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
        </div>,
        document.body
      )}

      {/* RANGE & DOMAIN PANEL ASSIGNMENT MODAL */}
      {rangeAssignModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-rule max-w-xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-indigo-700">🎯</span> Assign Mentors by Range or Domain
              </span>
              <button
                type="button"
                onClick={() => setRangeAssignModal(false)}
                className="text-draft hover:text-ink font-bold text-base"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleRangeAssignPanels} className="space-y-4">
              {/* 1. Stage Selection */}
              <div>
                <label className="input-label">Evaluation Stage *</label>
                <select
                  value={rangeStageId}
                  onChange={(e) => setRangeStageId(e.target.value)}
                  className="input-field text-xs font-semibold"
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

              {/* 2. Group Targeting Container */}
              <div className="bg-paper p-4 rounded-md border border-rule space-y-3">
                {/* Mode Selector Tabs */}
                <div className="flex border border-rule rounded-md p-1 bg-slate-100 gap-1">
                  <button
                    type="button"
                    onClick={() => setRangeTargetMode('RANGE')}
                    className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${rangeTargetMode === 'RANGE'
                        ? 'bg-white text-navy shadow-xs border border-rule/60'
                        : 'text-draft hover:text-ink'
                      }`}
                  >
                    <span>🎯</span> By Group Range
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRangeTargetMode('DOMAIN');
                      if (!rangeSelectedDomain && availableDomains.length > 0) {
                        handleSelectDomain(availableDomains[0].domain);
                      }
                    }}
                    className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${rangeTargetMode === 'DOMAIN'
                        ? 'bg-white text-indigo-900 shadow-xs border border-rule/60'
                        : 'text-draft hover:text-ink'
                      }`}
                  >
                    <span>🏷️</span> By Project Domain
                  </button>
                </div>

                {/* MODE A: BY NUMERIC RANGE */}
                {rangeTargetMode === 'RANGE' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-ink uppercase tracking-wider">
                        Numeric Group Range
                      </label>
                      <span className="text-[11px] font-semibold text-draft">
                        Total {sortedGroups.length} groups available
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-navy block mb-1">From Group (Start) *</label>
                        <select
                          value={rangeStartGroupId}
                          onChange={(e) => setRangeStartGroupId(e.target.value)}
                          className="input-field text-xs font-mono font-bold"
                          required
                        >
                          <option value="">Select Start Group...</option>
                          {sortedGroups.map((g, idx) => (
                            <option key={g.id} value={g.id}>
                              #{idx + 1} {g.group_code} — {g.title?.substring(0, 24)}...
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-navy block mb-1">To Group (End) *</label>
                        <select
                          value={rangeEndGroupId}
                          onChange={(e) => setRangeEndGroupId(e.target.value)}
                          className="input-field text-xs font-mono font-bold"
                          required
                        >
                          <option value="">Select End Group...</option>
                          {sortedGroups.map((g, idx) => (
                            <option key={g.id} value={g.id}>
                              #{idx + 1} {g.group_code} — {g.title?.substring(0, 24)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Range Presets */}
                    {sortedGroups.length > 5 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-draft uppercase tracking-wider mr-1">Quick Sets:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRangeStartGroupId(String(sortedGroups[0]?.id));
                            setRangeEndGroupId(String(sortedGroups[sortedGroups.length - 1]?.id));
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-rule text-navy hover:bg-slate-100"
                        >
                          All Groups ({sortedGroups.length})
                        </button>
                        {Array.from({ length: Math.ceil(sortedGroups.length / 5) }).map((_, blockIdx) => {
                          const startG = sortedGroups[blockIdx * 5];
                          const endG = sortedGroups[Math.min((blockIdx + 1) * 5 - 1, sortedGroups.length - 1)];
                          if (!startG || !endG) return null;
                          return (
                            <button
                              key={blockIdx}
                              type="button"
                              onClick={() => {
                                setRangeStartGroupId(String(startG.id));
                                setRangeEndGroupId(String(endG.id));
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-rule text-draft hover:text-ink hover:bg-slate-100"
                            >
                              Groups {blockIdx * 5 + 1}–{Math.min((blockIdx + 1) * 5, sortedGroups.length)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Filter Within Range by Domain */}
                    <div className="pt-2 border-t border-rule/70 flex items-center justify-between gap-2">
                      <label className="text-[11px] font-semibold text-draft shrink-0">Filter within range by domain:</label>
                      <select
                        value={rangeFilterDomain}
                        onChange={(e) => setRangeFilterDomain(e.target.value)}
                        className="input-field py-1 text-xs"
                      >
                        <option value="ALL">All Domains in Range</option>
                        {availableDomains.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.domain} ({d.count} groups)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* MODE B: BY PROJECT DOMAIN */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-ink uppercase tracking-wider">
                        Target Groups by Domain
                      </label>
                      <span className="text-[11px] font-semibold text-draft">
                        {availableDomains.length} domains in AY {academicYear}
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-navy block mb-1">Select Project Domain *</label>
                      <select
                        value={rangeSelectedDomain}
                        onChange={(e) => handleSelectDomain(e.target.value)}
                        className="input-field text-xs font-semibold"
                        required
                      >
                        <option value="">Select a Domain...</option>
                        {availableDomains.map((d) => (
                          <option key={d.domain} value={d.domain}>
                            {d.domain} ({d.count} {d.count === 1 ? 'group' : 'groups'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Domain Chips */}
                    {availableDomains.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-draft uppercase tracking-wider mr-1">Popular:</span>
                        {availableDomains.slice(0, 5).map((d) => {
                          const isSelected = rangeSelectedDomain.trim().toLowerCase() === d.domain.trim().toLowerCase();
                          return (
                            <button
                              key={d.domain}
                              type="button"
                              onClick={() => handleSelectDomain(d.domain)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${isSelected
                                  ? 'bg-indigo-100 border-indigo-400 text-indigo-950 font-bold'
                                  : 'bg-white border-rule text-draft hover:text-ink hover:bg-slate-50'
                                }`}
                            >
                              {d.domain} ({d.count})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Domain Group Checklist Header */}
                    {rangeSelectedDomain && (
                      <div className="flex items-center justify-between pt-2 border-t border-rule text-xs">
                        <span className="font-bold text-ink">
                          {domainSelectedGroupIds.length} of {
                            sortedGroups.filter((g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase()).length
                          } Groups Selected:
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={selectAllDomainGroups}
                            className="text-[11px] text-navy font-semibold hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-draft">·</span>
                          <button
                            type="button"
                            onClick={deselectAllDomainGroups}
                            className="text-[11px] text-maroon font-semibold hover:underline"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Preview of Groups Targeted */}
                <div className="pt-2 border-t border-rule">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-ink">
                      Targeted Groups ({selectedGroupsToAssign.length} Groups):
                    </span>
                    {selectedGroupsToAssign.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded font-bold">
                        {rangeTargetMode === 'DOMAIN' ? `Domain: ${rangeSelectedDomain}` : `${selectedGroupsToAssign[0]?.group_code} → ${selectedGroupsToAssign[selectedGroupsToAssign.length - 1]?.group_code}`}
                      </span>
                    )}
                  </div>

                  {selectedGroupsToAssign.length === 0 ? (
                    <div className="text-xs text-draft italic py-2 text-center bg-white rounded border border-rule">
                      {rangeTargetMode === 'DOMAIN'
                        ? 'Please select a domain above to view and assign groups.'
                        : 'Please select valid Start and End groups above.'}
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-white rounded border border-rule divide-y divide-rule/60">
                      {rangeTargetMode === 'DOMAIN' ? (
                        sortedGroups
                          .filter((g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase())
                          .map((g) => {
                            const isChecked = domainSelectedGroupIds.includes(String(g.id));
                            return (
                              <label
                                key={g.id}
                                className={`flex items-center justify-between text-xs py-1.5 px-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50/60 font-medium' : 'opacity-60 hover:opacity-100'
                                  }`}
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleDomainGroup(String(g.id))}
                                    className="rounded"
                                  />
                                  <span className="font-mono font-bold text-navy text-[11px]">{g.group_code}</span>
                                  <span className="truncate text-ink text-[11px]">{g.title}</span>
                                </div>
                                <span className="text-[10px] text-draft whitespace-nowrap">
                                  Guide: <strong className="text-ink">{g.guide_name || 'Unassigned'}</strong>
                                </span>
                              </label>
                            );
                          })
                      ) : (
                        selectedGroupsToAssign.map((g) => (
                          <div key={g.id} className="flex items-center justify-between text-xs py-1 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="font-mono font-bold text-navy text-[11px]">{g.group_code}</span>
                              <span className="truncate text-ink text-[11px]">{g.title}</span>
                            </div>
                            <span className="text-[10px] text-draft whitespace-nowrap">
                              Guide: <strong className="text-ink">{g.guide_name || 'Unassigned'}</strong>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Panel Mentors Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label">Select Panel Mentors for this Range (1 to 3) *</label>
                  <span className="text-[11px] font-mono text-navy font-bold">
                    {rangePanelistIds.length} selected
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto p-3 border border-rule rounded bg-paper">
                  {availableGuides.map((fac) => {
                    const isChecked = rangePanelistIds.includes(String(fac.faculty_id));
                    return (
                      <label
                        key={fac.faculty_id}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-medium' : 'bg-white border-rule text-ink hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const idStr = String(fac.faculty_id);
                              if (e.target.checked) {
                                setRangePanelistIds([...rangePanelistIds, idStr]);
                              } else {
                                setRangePanelistIds(rangePanelistIds.filter((x) => x !== idStr));
                              }
                            }}
                          />
                          <span>{fac.name} ({fac.designation})</span>
                        </div>
                        <span className="text-[10px] font-mono text-draft">{fac.current_guided_groups} guided</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Conflict of Interest (COI) Option & Live Warning Banner */}
              <div className="space-y-2">
                <label className="flex items-start gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rangeSkipGuideConflict}
                    onChange={(e) => setRangeSkipGuideConflict(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-amber-900 block">
                      Enforce Conflict of Interest (COI) Protection (Recommended)
                    </span>
                    <span className="text-amber-800 text-[11px] block mt-0.5">
                      Automatically excludes a mentor from evaluating their own guided group in this range.
                    </span>
                  </div>
                </label>

                {coiWarningsPreview.length > 0 && rangeSkipGuideConflict && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-navy space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>🛡️</span> Notice: {coiWarningsPreview.length} Group(s) with Guide Overlap
                    </p>
                    <p className="text-[11px] text-draft leading-relaxed">
                      The following group(s) have their guide selected as a mentor. The guide will be automatically skipped for these groups to maintain academic evaluation integrity:
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {coiWarningsPreview.map((w, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white border border-blue-200 text-navy">
                          {w.group_code}: {w.guideName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setRangeAssignModal(false)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedGroupsInRange.length === 0 || rangePanelistIds.length === 0}
                  className="btn-primary py-2 px-5 text-xs font-bold bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50"
                >
                  {submitting
                    ? 'Assigning Mentors...'
                    : `Assign to ${selectedGroupsInRange.length} Groups →`}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* TAB 5: SCORE RELEASE & GOVERNANCE */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="panel p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">Score Visibility Control (Release to Students)</h2>
                <p className="text-xs text-draft mt-0.5">Publish continuous assessment marks &amp; panel remarks per stage or export formatted score excel.</p>
              </div>
              <button
                type="button"
                onClick={handleExportScoreExcel}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-2 transition-colors shadow-xs self-start sm:self-auto"
              >
                <span>📊</span> Export Score Excel ↓
              </button>
            </div>
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
      {/* ASSIGN GUIDE MODAL */}
      {guideModalGroup && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-rule max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 flex items-center justify-between">
              <span>Assign Guide for {guideModalGroup.group_code}</span>
              <button
                type="button"
                onClick={() => setGuideModalGroup(null)}
                className="text-draft hover:text-ink font-bold text-base"
              >
                ✕
              </button>
            </h3>

            {/* Group Details Section: Domain, Student Names, and 3 Project Topics */}
            <div className="bg-paper p-4 rounded-md border border-rule space-y-3">
              {/* 1. Project Domain */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-draft uppercase tracking-wider">Project Domain:</span>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                  {guideModalGroup.domain || 'Not Specified'}
                </span>
              </div>

              {/* 2. Students in Group (Each Student Name) */}
              <div>
                <span className="text-xs font-semibold text-draft uppercase tracking-wider block mb-1">
                  Students in Group ({guideModalGroup.members?.length || 0}):
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {guideModalGroup.members && guideModalGroup.members.length > 0 ? (
                    guideModalGroup.members.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-rule">
                        <span className="font-semibold text-ink">
                          {idx + 1}. {m.name || m.student_name || 'Student'}
                          {m.is_leader && (
                            <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              Leader
                            </span>
                          )}
                        </span>
                        {m.roll_no && <span className="font-mono text-[11px] text-draft">{m.roll_no}</span>}
                      </div>
                    ))
                  ) : (
                    <span className="text-draft italic">No student details available</span>
                  )}
                </div>
              </div>

              {/* 3. 3 Project Topics */}
              <div>
                <span className="text-xs font-semibold text-draft uppercase tracking-wider block mb-1">
                  3 Project Topics:
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2.5 bg-white rounded border border-rule">
                    <span className="font-bold text-navy text-[11px] block">Topic Preference 1:</span>
                    <span className="text-ink font-semibold leading-tight block mt-0.5">{guideModalGroup.title || 'Not Specified'}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-rule">
                    <span className="font-bold text-draft text-[11px] block">Topic Preference 2:</span>
                    <span className="text-ink font-medium leading-tight block mt-0.5">{guideModalGroup.title_2 || <em className="text-draft">Not provided</em>}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-rule">
                    <span className="font-bold text-draft text-[11px] block">Topic Preference 3:</span>
                    <span className="text-ink font-medium leading-tight block mt-0.5">{guideModalGroup.title_3 || <em className="text-draft">Not provided</em>}</span>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleAssignGuide} className="space-y-4 pt-1">
              <div>
                <label className="input-label">Select Faculty Guide *</label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="input-field font-semibold"
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
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {selectedGuideId ? 'Assign Guide' : 'Clear / Unassign Guide'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PANEL ASSIGNMENT MODAL (SINGLE GROUP) */}
      {panelModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                <label className="input-label">Select Panel Mentors (1 to 3) *</label>
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
        </div>,
        document.body
      )}

      {/* EVALUATION STAGE MODAL (CREATE / EDIT) */}
      {stageModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
        </div>,
        document.body
      )}
    </div>
  );
}
