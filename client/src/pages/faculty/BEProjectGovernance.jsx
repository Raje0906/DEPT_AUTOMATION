import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function BEProjectGovernance() {
  const { user } = useAuth();
  const isHOD = user?.role === 'hod';
  const isCoordinator = user?.role === 'faculty' && user?.is_project_coordinator;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'groups' | 'stages' | 'governance'
  const [academicYear, setAcademicYear] = useState('2026-27');

  // Backend state
  const [dashboardData, setDashboardData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [stages, setStages] = useState([]);
  const [availableGuides, setAvailableGuides] = useState([]);

  // Panel Matrix state
  const [panelMatrix, setPanelMatrix] = useState([]);
  const [panelMatrixStageId, setPanelMatrixStageId] = useState('');

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

  // Groups Tab Filtering State
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [expandedGroupId, setExpandedGroupId] = useState(null);

  // Governance Overview Faculty Search & Filter State
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('ALL'); // 'ALL' | 'GUIDES' | 'ELIGIBLE' | 'MENTORS'
  const [togglingGuideId, setTogglingGuideId] = useState(null);

  // Guide Modal Search State
  const [guideModalSearch, setGuideModalSearch] = useState('');

  // Mentor Modals Search States
  const [panelMentorSearch, setPanelMentorSearch] = useState('');
  const [rangeMentorSearch, setRangeMentorSearch] = useState('');

  const guidesCount = useMemo(() => {
    return (dashboardData?.faculty_load || []).filter(
      (f) => Boolean(f.is_designated_guide || Number(f.guided_groups) > 0) && Number(f.panel_assignments) === 0
    ).length;
  }, [dashboardData?.faculty_load]);

  const mentorsCount = useMemo(() => {
    return (dashboardData?.faculty_load || []).filter(
      (f) => Number(f.panel_assignments) > 0
    ).length;
  }, [dashboardData?.faculty_load]);

  const eligibleCount = useMemo(() => {
    return (dashboardData?.faculty_load || []).filter(
      (f) => !f.is_designated_guide && Number(f.guided_groups) === 0 && Number(f.panel_assignments) === 0
    ).length;
  }, [dashboardData?.faculty_load]);

  const filteredFacultyLoad = useMemo(() => {
    const list = dashboardData?.faculty_load || [];
    return list.filter((fac) => {
      const isMentor = Number(fac.panel_assignments) > 0;
      const isGuide = Boolean(fac.is_designated_guide || Number(fac.guided_groups) > 0) && !isMentor;

      if (facultyFilter === 'GUIDES' && !isGuide) return false;
      if (facultyFilter === 'ELIGIBLE' && (isGuide || isMentor)) return false;
      if (facultyFilter === 'MENTORS' && !isMentor) return false;

      if (facultySearch.trim()) {
        const q = facultySearch.toLowerCase().trim();
        const nameMatch = fac.name?.toLowerCase().includes(q);
        const empMatch = fac.employee_id?.toLowerCase().includes(q);
        const emailMatch = fac.email?.toLowerCase().includes(q);
        const desigMatch = fac.designation?.toLowerCase().includes(q);
        if (!nameMatch && !empMatch && !emailMatch && !desigMatch) return false;
      }
      return true;
    });
  }, [dashboardData?.faculty_load, facultySearch, facultyFilter]);

  const filteredModalGuides = useMemo(() => {
    if (!guideModalSearch.trim()) return availableGuides;
    const q = guideModalSearch.toLowerCase().trim();
    return availableGuides.filter((g) => {
      return (
        g.name?.toLowerCase().includes(q) ||
        g.employee_id?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.designation?.toLowerCase().includes(q)
      );
    });
  }, [availableGuides, guideModalSearch]);

  const allDepartmentFaculty = useMemo(() => {
    if (dashboardData?.faculty_load && dashboardData.faculty_load.length > 0) {
      return dashboardData.faculty_load;
    }
    return availableGuides;
  }, [dashboardData?.faculty_load, availableGuides]);

  const filteredPanelMentors = useMemo(() => {
    if (!panelMentorSearch.trim()) return allDepartmentFaculty;
    const q = panelMentorSearch.toLowerCase().trim();
    return allDepartmentFaculty.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.designation?.toLowerCase().includes(q) ||
        f.employee_id?.toLowerCase().includes(q)
    );
  }, [allDepartmentFaculty, panelMentorSearch]);

  const filteredRangeMentors = useMemo(() => {
    if (!rangeMentorSearch.trim()) return allDepartmentFaculty;
    const q = rangeMentorSearch.toLowerCase().trim();
    return allDepartmentFaculty.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.designation?.toLowerCase().includes(q) ||
        f.employee_id?.toLowerCase().includes(q)
    );
  }, [allDepartmentFaculty, rangeMentorSearch]);



  const groupPanelistsMap = useMemo(() => {
    const map = {};
    for (const item of panelMatrix) {
      map[item.id] = item.panelists || [];
    }
    return map;
  }, [panelMatrix]);

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
        const mentors = groupPanelistsMap[g.id] || [];
        const mentorMatch = mentors.some(m => m.name?.toLowerCase().includes(q));
        if (!codeMatch && !titleMatch && !domainMatch && !guideMatch && !memberMatch && !mentorMatch) return false;
      }
      return true;
    });
  }, [groups, selectedDivision, groupSearch, groupPanelistsMap]);

  const fetchHODData = async () => {
    setLoading(true);
    try {
      const [dashRes, groupsRes, stagesRes, guidesRes, settingsRes] = await Promise.all([
        api.get(`/projects/hod/dashboard?academic_year=${academicYear}`),
        api.get(`/projects/hod/groups?academic_year=${academicYear}`),
        api.get(`/projects/hod/stages?academic_year=${academicYear}`),
        api.get(`/projects/student/available-guides?academic_year=${academicYear}`),
        api.get(`/projects/registration-settings?academic_year=${academicYear}`).catch(() => ({ data: { is_registration_open: true, due_date: null, is_open: true } })),
      ]);
      setDashboardData(dashRes.data);
      setGroups(groupsRes.data);
      setStages(stagesRes.data);
      setAvailableGuides(guidesRes.data);
      setRegSettings(settingsRes.data);
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

  useEffect(() => {
    fetchHODData();
  }, [academicYear]);

  useEffect(() => {
    if (panelMatrixStageId) {
      fetchPanelMatrix(panelMatrixStageId);
    }
  }, [panelMatrixStageId]);

  // Handlers
  const handleToggleDesignatedGuide = async (facultyId, currentIsGuide, guidedCount, panelAssignments) => {
    if (Number(panelAssignments) > 0) {
      toast.error('This faculty member is assigned as a Panel Mentor and cannot be a Guide.');
      return;
    }
    if (currentIsGuide && Number(guidedCount) > 0) {
      toast.error(`Cannot remove guide status: Faculty is actively guiding ${guidedCount} project group(s). Reassign them first.`);
      return;
    }

    setTogglingGuideId(facultyId);
    try {
      const res = await api.post('/projects/hod/designated-guides/toggle', {
        academic_year: academicYear,
        faculty_id: facultyId,
        is_guide: !currentIsGuide,
      });
      toast.success(res.data.message || 'Guide designation updated');
      await fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update guide designation');
    } finally {
      setTogglingGuideId(null);
    }
  };

  const handleBatchAssignAllGuides = async () => {
    try {
      const res = await api.post('/projects/hod/designated-guides/batch-assign-all', {
        academic_year: academicYear,
      });
      toast.success(res.data.message || 'Eligible faculty designated as Guides');
      await fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to batch assign guides');
    }
  };

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
      setGuideModalSearch('');
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
        const guideObj = allDepartmentFaculty.find((f) => String(f.faculty_id) === String(guideId));
        warnings.push({
          group_code: g.group_code,
          guideName: guideObj ? guideObj.name : (g.guide_name || 'Guide'),
        });
      }
    });
    return warnings;
  }, [rangeSkipGuideConflict, rangePanelistIds, selectedGroupsToAssign, allDepartmentFaculty]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading BE Project Governance console...</p>
        </div>
      </div>
    );
  }


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
                Direct oversight of BE Projects (AY {academicYear}). Guide assignments, continuous assessment stages, and panel scoring are synced in real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2.5 border-b border-rule pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${activeTab === 'overview'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink hover:border-slate-300 shadow-2xs'
            }`}
        >
          <span className="text-sm">📊</span>
          <span>Governance Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${activeTab === 'groups'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink hover:border-slate-300 shadow-2xs'
            }`}
        >
          <span className="text-sm">👥</span>
          <span>Groups, Guides &amp; Mentors</span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeTab === 'groups'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-slate-600'
              }`}
          >
            {groups.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stages')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${activeTab === 'stages'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink hover:border-slate-300 shadow-2xs'
            }`}
        >
          <span className="text-sm">📝</span>
          <span>Evaluation Stages</span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${activeTab === 'stages'
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 text-slate-600'
              }`}
          >
            {stages.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('governance')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${activeTab === 'governance'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink hover:border-slate-300 shadow-2xs'
            }`}
        >
          <span className="text-sm">🔓</span>
          <span>Score Release &amp; Unlocks</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Total Project Groups</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">
                {dashboardData.stats?.total_groups ?? dashboardData.total_groups}
              </p>
            </div>
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Assigned Guide Groups</span>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">
                {dashboardData.stats?.guide_assigned_groups ?? (dashboardData.group_status_breakdown?.find((b) => b.status === 'ACTIVE')?.count || 0)}
              </p>
            </div>
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase">Evaluation Stages</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">
                {dashboardData.stats?.stages_count ?? dashboardData.stages.length}
              </p>
            </div>
          </div>

          {/* Faculty Workload & Guide Designation Matrix */}
          <div className="panel bg-white border border-rule rounded-xl shadow-xs overflow-hidden">
            <div className="panel-header p-5 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-serif text-xl font-bold text-ink">
                    Faculty Workload &amp; Guide Designation
                  </h2>
                </div>
                <p className="text-xs text-draft mt-1 font-medium">
                  Designate which faculty members will serve as BE Project Guides.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchAssignAllGuides}
                  className="px-3.5 py-2 bg-navy text-white hover:bg-slate-800 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Designate all eligible non-mentor faculty as Guides for this academic year"
                >
                  <span>✓</span> Assign All Eligible as Guides
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 bg-paper/60 border-b border-rule space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar matching user's exact specification */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search faculty by name, employee ID, or designation…"
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="w-full px-3.5 py-2 pl-9 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy focus:border-navy outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                  {facultySearch && (
                    <button
                      type="button"
                      onClick={() => setFacultySearch('')}
                      className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-full hover:bg-slate-100"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="text-xs text-draft font-medium shrink-0">
                  Showing <strong className="text-ink">{filteredFacultyLoad.length}</strong> of {dashboardData.faculty_load?.length || 0} faculty
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                <button
                  type="button"
                  onClick={() => setFacultyFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap ${facultyFilter === 'ALL'
                    ? 'bg-navy text-white border-navy shadow-xs'
                    : 'bg-white text-slate-700 border-rule hover:bg-slate-50'
                    }`}
                >
                  All Faculty ({dashboardData.faculty_load?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setFacultyFilter('GUIDES')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap ${facultyFilter === 'GUIDES'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-rule hover:bg-slate-50'
                    }`}
                >
                  Designated Guides ({guidesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFacultyFilter('ELIGIBLE')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap ${facultyFilter === 'ELIGIBLE'
                    ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 border-rule hover:bg-slate-50'
                    }`}
                >
                  Available / Non-Guides ({eligibleCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFacultyFilter('MENTORS')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all whitespace-nowrap ${facultyFilter === 'MENTORS'
                    ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                    : 'bg-white text-slate-700 border-rule hover:bg-slate-50'
                    }`}
                >
                  Panel Mentors ({mentorsCount})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th>Designation &amp; Info</th>
                    <th>Role &amp; Status</th>
                    <th className="numeric">Guided Groups (Max 5)</th>
                    <th className="numeric">Panel Assignments</th>
                    <th className="text-right">Guide Assignment Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacultyLoad.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-draft">
                        No faculty matched your active search or role filters.
                      </td>
                    </tr>
                  ) : (
                    filteredFacultyLoad.map((fac) => {
                      const isMentor = Number(fac.panel_assignments) > 0;
                      const isGuide = Boolean(fac.is_designated_guide || Number(fac.guided_groups) > 0);
                      const isToggling = togglingGuideId === fac.faculty_id;

                      return (
                        <tr key={fac.faculty_id} className="hover:bg-slate-50/50 transition-colors">
                          <td>
                            <div className="font-bold text-sm text-ink">{fac.name}</div>
                            <div className="text-[11px] text-draft font-mono">{fac.email}</div>
                          </td>
                          <td>
                            <div className="text-xs text-ink font-medium">{fac.designation}</div>
                            {fac.employee_id && (
                              <div className="text-[10px] text-draft font-mono">ID: {fac.employee_id}</div>
                            )}
                          </td>
                          <td>
                            {isMentor ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                <span>🛡️</span>
                                <span>Panel Mentor</span>
                              </span>
                            ) : isGuide ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span>✓</span>
                                <span>BE Project Guide</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <span>Eligible Faculty</span>
                              </span>
                            )}
                          </td>
                          <td className="numeric font-mono font-bold text-navy">
                            {fac.guided_groups} / 5
                          </td>
                          <td className="numeric font-mono font-bold text-purple-900">
                            {fac.panel_assignments}
                          </td>
                          <td className="text-right">
                            {isMentor ? (
                              <span
                                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-md text-xs font-bold italic bg-purple-100/80 text-purple-800 border border-purple-300 shadow-2xs"
                                title="Faculty is assigned as a Panel Mentor"
                              >
                                Panel Mentor
                              </span>
                            ) : isGuide ? (
                              <button
                                type="button"
                                disabled={isToggling || Number(fac.guided_groups) > 0}
                                onClick={() => handleToggleDesignatedGuide(fac.faculty_id, true, fac.guided_groups, fac.panel_assignments)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${Number(fac.guided_groups) > 0
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                  }`}
                                title={
                                  Number(fac.guided_groups) > 0
                                    ? `Guiding ${fac.guided_groups} group(s). Reassign them first to remove guide status.`
                                    : 'Click to remove guide designation'
                                }
                              >
                                {isToggling ? 'Updating...' : Number(fac.guided_groups) > 0 ? '✓ Active (Guiding)' : '✓ Guide (Click to Remove)'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => handleToggleDesignatedGuide(fac.faculty_id, false, fac.guided_groups, fac.panel_assignments)}
                                className="px-3.5 py-1.5 text-xs font-bold bg-navy hover:bg-slate-800 text-white rounded-md transition-colors shadow-2xs"
                              >
                                {isToggling ? 'Updating...' : '+ Assign as Guide'}
                              </button>
                            )}
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

      {/* TAB 2: GROUPS & GUIDES */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Registration Form Governance Controls Card */}
          <div className="bg-white border border-rule rounded-lg p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-serif text-lg font-bold text-ink">Registration Form</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${regSettings.is_open ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                  {regSettings.is_open ? '● Registration Form OPEN' : '● Registration Form CLOSED'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportFormResponses}
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>📥</span> Form Responses (Excel)
                </button>
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
                    This will clear all registered group choices and student submissions.
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

          {/* Panel Mentors & Batch Allocation Controls */}
          <div className="bg-white border border-rule rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-rule pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-ink flex items-center gap-2">
                  <span>🛡️</span> Evaluation Stage &amp; Batch Mentor Operations
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Select an evaluation stage to view and manage panel mentors across groups, or use bulk allocation operations.
                </p>
              </div>

              {/* Stage Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-navy whitespace-nowrap">Stage for Mentors:</label>
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
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
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
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <span>🎯</span> Assign Mentors by Range / Domain
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
                className="px-3.5 py-2 bg-navy hover:bg-blue-900 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <span>📋</span> Copy Stage Panels
              </button>
              <button
                type="button"
                onClick={handleClearStagePanels}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <span>🗑️</span> Clear Stage Panels
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStageId(panelMatrixStageId);
                  setSelectedGroupId('');
                  setSelectedPanelistIds([]);
                  setPanelModal(true);
                }}
                className="ml-auto px-3.5 py-2 bg-paper hover:bg-gray-100 text-ink border border-rule text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
              >
                <span>➕</span> Single Group Manual Panel
              </button>
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
                  placeholder="Search by code, title, domain, guide, mentor, student..."
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
                    <th>List</th>
                    <th>Assigned Guide</th>
                    <th>Assigned Mentors</th>
                    <th>Group Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-draft text-sm">
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
                                  title="View full topic choices and team"
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
                                <div className="space-y-1">
                                  <div className="font-bold text-emerald-800 text-xs">{g.guide_name}</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGuideModalSearch('');
                                      setGuideModalGroup(g);
                                      setSelectedGuideId(g.proposed_guide_faculty_id || g.guide_faculty_id ? String(g.proposed_guide_faculty_id || g.guide_faculty_id) : '');
                                    }}
                                    className="text-[10px] font-semibold text-navy hover:underline block"
                                  >
                                    Change Guide
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block">
                                    Unassigned
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGuideModalSearch('');
                                      setGuideModalGroup(g);
                                      setSelectedGuideId(g.proposed_guide_faculty_id || g.guide_faculty_id ? String(g.proposed_guide_faculty_id || g.guide_faculty_id) : '');
                                    }}
                                    className="px-2 py-0.5 bg-navy hover:bg-navy/90 text-white rounded text-[10px] font-bold block transition-colors"
                                  >
                                    + Assign Guide
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>
                              {(() => {
                                const groupPanelists = groupPanelistsMap[g.id] || [];
                                return groupPanelists.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="space-y-0.5">
                                      {groupPanelists.map((p) => (
                                        <div
                                          key={p.faculty_id}
                                          className="font-bold text-indigo-950 text-xs"
                                        >
                                          {p.name}
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedStageId(panelMatrixStageId);
                                        setSelectedGroupId(String(g.id));
                                        setSelectedPanelistIds(groupPanelists.map((p) => String(p.faculty_id)));
                                        setPanelModal(true);
                                      }}
                                      className="text-[10px] font-semibold text-indigo-700 hover:underline block"
                                    >
                                      Edit Mentors
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="text-draft text-[11px] italic font-mono block">No mentors assigned</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedStageId(panelMatrixStageId);
                                        setSelectedGroupId(String(g.id));
                                        setSelectedPanelistIds([]);
                                        setPanelModal(true);
                                      }}
                                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold block transition-colors"
                                    >
                                      + Assign Mentors
                                    </button>
                                  </div>
                                );
                              })()}
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
                                className="px-2.5 py-1 text-xs border border-rule rounded hover:bg-gray-100 text-draft hover:text-ink transition-colors"
                              >
                                {isExpanded ? 'Hide' : 'Topics & Team'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr className="bg-blue-50/20 border-b-2 border-blue-200">
                              <td colSpan={8} className="p-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-4 rounded border border-blue-200 shadow-2xs">
                                  {/* 3 Project Topic Choices */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-navy flex items-center gap-1.5 border-b border-rule pb-2">
                                      <span>📑</span> 3 Project Topic Preferences
                                    </h4>
                                    <div className="space-y-2">
                                      <div className="p-2.5 rounded-md bg-blue-50/70 border border-blue-200">
                                        <span className="font-bold text-navy block text-[11px] uppercase tracking-wide">Preference 1 (Primary Topic):</span>
                                        <p className="text-[13px] sm:text-sm font-semibold text-ink leading-snug mt-0.5">{g.title}</p>
                                      </div>
                                      {g.title_2 && (
                                        <div className="p-2.5 rounded-md bg-paper border border-rule">
                                          <span className="font-bold text-draft block text-[11px] uppercase tracking-wide">Preference 2:</span>
                                          <p className="text-[13px] sm:text-sm font-medium text-ink leading-snug mt-0.5">{g.title_2}</p>
                                        </div>
                                      )}
                                      {g.title_3 && (
                                        <div className="p-2.5 rounded-md bg-paper border border-rule">
                                          <span className="font-bold text-draft block text-[11px] uppercase tracking-wide">Preference 3:</span>
                                          <p className="text-[13px] sm:text-sm font-medium text-ink leading-snug mt-0.5">{g.title_3}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Team Members */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5 border-b border-rule pb-2">
                                      <span>👥</span> Student Team Members ({g.members?.length || 0})
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-left text-[10px] text-draft uppercase border-b border-rule">
                                            <th className="py-1.5 px-2 text-left whitespace-nowrap">Role</th>
                                            <th className="py-1.5 px-2 text-left">Student Name</th>
                                            <th className="py-1.5 px-2 text-left whitespace-nowrap">PRN</th>
                                            <th className="py-1.5 px-3 text-center whitespace-nowrap">Division</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rule/60">
                                          {(g.members || []).map((m, mIdx) => (
                                            <tr key={mIdx} className="hover:bg-gray-50/60">
                                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">
                                                {m.is_leader ? (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-navy text-white">Leader</span>
                                                ) : (
                                                  <span className="text-draft text-[11px]">Member</span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-2 font-semibold text-ink">{m.name}</td>
                                              <td className="py-1.5 px-2 font-mono text-draft whitespace-nowrap">{m.roll_no}</td>
                                              <td className="py-1.5 px-3 text-center whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-paper border border-rule text-ink whitespace-nowrap">
                                                  {m.division || g.batch || 'BE-1'}
                                                </span>
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
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-lg border border-rule max-w-4xl w-full p-6 sm:p-7 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-5">
            <div className="border-b border-rule pb-3.5 flex items-center justify-between">
              <h3 className="font-serif text-2xl font-bold text-ink flex items-center gap-2.5">
                Assign Mentors by Range or Domain
              </h3>
              <button
                type="button"
                onClick={() => setRangeAssignModal(false)}
                className="text-draft hover:text-ink font-bold text-xl p-1 rounded hover:bg-slate-100 transition-colors"
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRangeAssignPanels} className="space-y-5">
              {/* 1. Stage Selection */}
              <div>
                <label className="block text-sm font-bold text-ink mb-1.5">Evaluation Stage *</label>
                <select
                  value={rangeStageId}
                  onChange={(e) => setRangeStageId(e.target.value)}
                  className="input-field text-sm font-semibold py-2 px-3 w-full"
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
              <div className="bg-paper p-5 rounded-lg border border-rule space-y-4">
                {/* Mode Selector Tabs */}
                <div className="flex border border-rule rounded-md p-1 bg-slate-100 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRangeTargetMode('RANGE')}
                    className={`flex-1 py-2 px-4 rounded text-sm font-bold transition-all flex items-center justify-center gap-2 ${rangeTargetMode === 'RANGE'
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
                    className={`flex-1 py-2 px-4 rounded text-sm font-bold transition-all flex items-center justify-center gap-2 ${rangeTargetMode === 'DOMAIN'
                      ? 'bg-white text-indigo-900 shadow-xs border border-rule/60'
                      : 'text-draft hover:text-ink'
                      }`}
                  >
                    <span>🏷️</span> By Project Domain
                  </button>
                </div>

                {/* MODE A: BY NUMERIC RANGE */}
                {rangeTargetMode === 'RANGE' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-ink uppercase tracking-wider">
                        Numeric Group Range
                      </label>
                      <span className="text-xs font-semibold text-draft">
                        Total {sortedGroups.length} groups available
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-navy block mb-1.5">From Group (Start) *</label>
                        <select
                          value={rangeStartGroupId}
                          onChange={(e) => setRangeStartGroupId(e.target.value)}
                          className="input-field text-sm font-mono font-bold py-2 px-3 w-full"
                          required
                        >
                          <option value="">Select Start Group...</option>
                          {sortedGroups.map((g, idx) => (
                            <option key={g.id} value={g.id}>
                              #{idx + 1} {g.group_code} — {g.title?.substring(0, 48)}...
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-navy block mb-1.5">To Group (End) *</label>
                        <select
                          value={rangeEndGroupId}
                          onChange={(e) => setRangeEndGroupId(e.target.value)}
                          className="input-field text-sm font-mono font-bold py-2 px-3 w-full"
                          required
                        >
                          <option value="">Select End Group...</option>
                          {sortedGroups.map((g, idx) => (
                            <option key={g.id} value={g.id}>
                              #{idx + 1} {g.group_code} — {g.title?.substring(0, 48)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Filter Within Range by Domain */}
                    <div className="pt-2.5 border-t border-rule/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-draft shrink-0">Filter within range by domain:</label>
                      <select
                        value={rangeFilterDomain}
                        onChange={(e) => setRangeFilterDomain(e.target.value)}
                        className="input-field py-1.5 px-3 text-sm max-w-xs"
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
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-ink uppercase tracking-wider">
                        Target Groups by Domain
                      </label>
                      <span className="text-xs font-semibold text-draft">
                        {availableDomains.length} domains in AY {academicYear}
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-navy block mb-1.5">Select Project Domain *</label>
                      <select
                        value={rangeSelectedDomain}
                        onChange={(e) => handleSelectDomain(e.target.value)}
                        className="input-field text-sm font-semibold py-2 px-3 w-full"
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
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-bold text-draft uppercase tracking-wider mr-1">Popular:</span>
                        {availableDomains.slice(0, 5).map((d) => {
                          const isSelected = rangeSelectedDomain.trim().toLowerCase() === d.domain.trim().toLowerCase();
                          return (
                            <button
                              key={d.domain}
                              type="button"
                              onClick={() => handleSelectDomain(d.domain)}
                              className={`px-3 py-1 rounded text-xs font-semibold border transition-colors ${isSelected
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
                      <div className="flex items-center justify-between pt-2.5 border-t border-rule text-sm">
                        <span className="font-bold text-ink">
                          {domainSelectedGroupIds.length} of {
                            sortedGroups.filter((g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase()).length
                          } Groups Selected:
                        </span>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={selectAllDomainGroups}
                            className="text-xs text-navy font-bold hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-draft">·</span>
                          <button
                            type="button"
                            onClick={deselectAllDomainGroups}
                            className="text-xs text-maroon font-bold hover:underline"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Preview of Groups Targeted */}
                <div className="pt-3 border-t border-rule">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-ink">
                      Targeted Groups ({selectedGroupsToAssign.length} Groups):
                    </span>
                    {selectedGroupsToAssign.length > 0 && (
                      <span className="text-xs font-mono px-2.5 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded font-bold">
                        {rangeTargetMode === 'DOMAIN' ? `Domain: ${rangeSelectedDomain}` : `${selectedGroupsToAssign[0]?.group_code} → ${selectedGroupsToAssign[selectedGroupsToAssign.length - 1]?.group_code}`}
                      </span>
                    )}
                  </div>

                  {selectedGroupsToAssign.length === 0 ? (
                    <div className="text-sm text-draft italic py-3 text-center bg-white rounded border border-rule">
                      {rangeTargetMode === 'DOMAIN'
                        ? 'Please select a domain above to view and assign groups.'
                        : 'Please select valid Start and End groups above.'}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-white rounded-md border border-rule divide-y divide-rule/60">
                      {rangeTargetMode === 'DOMAIN' ? (
                        sortedGroups
                          .filter((g) => (g.domain || '').trim().toLowerCase() === rangeSelectedDomain.trim().toLowerCase())
                          .map((g) => {
                            const isChecked = domainSelectedGroupIds.includes(String(g.id));
                            return (
                              <label
                                key={g.id}
                                className={`flex items-center justify-between text-xs py-2 px-2.5 rounded cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50/70 font-medium' : 'opacity-60 hover:opacity-100'
                                  }`}
                              >
                                <div className="flex items-center gap-2.5 truncate pr-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleDomainGroup(String(g.id))}
                                    className="w-4 h-4 rounded text-indigo-600"
                                  />
                                  <span className="font-mono font-bold text-navy text-xs">{g.group_code}</span>
                                  <span className="truncate text-ink text-xs">{g.title}</span>
                                </div>
                                <span className="text-xs text-draft whitespace-nowrap">
                                  Guide: <strong className="text-ink">{g.guide_name || 'Unassigned'}</strong>
                                </span>
                              </label>
                            );
                          })
                      ) : (
                        selectedGroupsToAssign.map((g) => (
                          <div key={g.id} className="flex items-center justify-between text-xs py-1.5 px-1 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-2.5 truncate pr-3">
                              <span className="font-mono font-bold text-navy text-xs">{g.group_code}</span>
                              <span className="truncate text-ink text-xs">{g.title}</span>
                            </div>
                            <span className="text-xs text-draft whitespace-nowrap">
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-ink">Select Panel Mentors for this Range (1 to 3) *</label>
                  <span className="text-xs font-mono text-navy font-bold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                    {rangePanelistIds.length} of 3 selected
                  </span>
                </div>

                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search mentor by name, employee ID, or designation…"
                    value={rangeMentorSearch}
                    onChange={(e) => setRangeMentorSearch(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                  {rangeMentorSearch && (
                    <button
                      type="button"
                      onClick={() => setRangeMentorSearch('')}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3.5 border border-rule rounded-lg bg-paper">
                  {filteredRangeMentors.map((fac) => {
                    const isChecked = rangePanelistIds.includes(String(fac.faculty_id));
                    return (
                      <label
                        key={fac.faculty_id}
                        className={`flex items-center justify-between p-2.5 rounded-md text-xs cursor-pointer border transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold shadow-2xs' : 'bg-white border-rule text-ink hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            className="w-4 h-4 rounded text-indigo-600"
                            onChange={(e) => {
                              const idStr = String(fac.faculty_id);
                              if (e.target.checked) {
                                setRangePanelistIds([...rangePanelistIds, idStr]);
                              } else {
                                setRangePanelistIds(rangePanelistIds.filter((x) => x !== idStr));
                              }
                            }}
                          />
                          <div className="truncate">
                            <span className="font-bold text-sm block truncate">{fac.name}</span>
                            <span className="text-[11px] text-draft block truncate">{fac.designation}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-draft bg-slate-100 px-2 py-0.5 rounded border border-rule shrink-0">
                          {fac.guided_groups ?? fac.current_guided_groups ?? 0} guided
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 4. Conflict of Interest (COI) Option & Live Warning Banner */}
              <div className="space-y-2.5">
                <label className="flex items-start gap-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rangeSkipGuideConflict}
                    onChange={(e) => setRangeSkipGuideConflict(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-amber-950 text-sm block">
                      Enforce Conflict of Interest (COI) Protection (Recommended)
                    </span>
                    <span className="text-amber-800 text-xs block mt-0.5">
                      Automatically excludes a mentor from evaluating their own guided group in this range.
                    </span>
                  </div>
                </label>

                {coiWarningsPreview.length > 0 && rangeSkipGuideConflict && (
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-navy space-y-1.5">
                    <p className="font-bold text-sm flex items-center gap-2">
                      <span>🛡️</span> Notice: {coiWarningsPreview.length} Group(s) with Guide Overlap
                    </p>
                    <p className="text-xs text-draft leading-relaxed">
                      The following group(s) have their guide selected as a mentor. The guide will be automatically skipped for these groups to maintain academic evaluation integrity:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {coiWarningsPreview.map((w, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-white border border-blue-200 text-navy shadow-2xs">
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
                  className="px-5 py-2.5 border border-rule rounded-md text-sm font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedGroupsInRange.length === 0 || rangePanelistIds.length === 0}
                  className="btn-primary py-2.5 px-6 text-sm font-bold bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 shadow-xs"
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
                <p className="text-xs text-draft mt-0.5">Publish continuous assessment marks &amp; panel remarks directly to students per stage without requiring HOD approval.</p>
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
            <div className="border-b border-rule pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">
                  Assign Guide for {guideModalGroup.group_code}
                </h3>
                {guideModalGroup.domain && (
                  <p className="text-xs text-draft mt-0.5">
                    Domain: <span className="font-semibold text-indigo-900">{guideModalGroup.domain}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setGuideModalGroup(null)}
                className="text-draft hover:text-ink font-bold text-base p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignGuide} className="space-y-4 pt-1">
              <div>
                <label className="input-label mb-1.5 block">Select Faculty Guide *</label>

                {/* Search Bar matching user's exact specification */}
                <div className="relative mb-2.5">
                  <input
                    type="text"
                    placeholder="Search faculty by name, employee ID, email, or designation…"
                    value={guideModalSearch}
                    onChange={(e) => setGuideModalSearch(e.target.value)}
                    className="w-full px-3 py-2 pl-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                  {guideModalSearch && (
                    <button
                      type="button"
                      onClick={() => setGuideModalSearch('')}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="input-field font-semibold text-sm"
                  size={filteredModalGuides.length > 4 ? 6 : undefined}
                >
                  <option value="">-- Leave Unassigned --</option>
                  {filteredModalGuides.map((g) => (
                    <option key={g.faculty_id} value={g.faculty_id}>
                      {g.name} ({g.designation}) — {g.current_guided_groups} guided
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between text-[11px] text-draft mt-1.5 font-medium">
                  <span>Showing {filteredModalGuides.length} designated guides</span>
                </div>
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
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-lg border border-rule max-w-3xl w-full p-6 sm:p-7 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-5">
            <div className="border-b border-rule pb-3.5 flex items-center justify-between">
              <h3 className="font-serif text-2xl font-bold text-ink flex items-center gap-2">
                <span>🛡️</span> Assign Panel Mentors
              </h3>
              <button
                type="button"
                onClick={() => setPanelModal(false)}
                className="text-draft hover:text-ink font-bold text-xl p-1 rounded hover:bg-slate-100 transition-colors"
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignPanel} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1.5">Select Evaluation Stage *</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="input-field text-sm font-semibold py-2 px-3 w-full"
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
                  <label className="block text-sm font-bold text-ink mb-1.5">Select Project Group *</label>
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
                    className="input-field text-sm font-semibold py-2 px-3 w-full"
                    required
                  >
                    <option value="">Select Group...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.group_code} — {g.title?.substring(0, 40)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currentSelectedGroupObj && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-navy">
                  <p><span className="font-bold">Group Guide:</span> {currentSelectedGroupObj.guide_name || 'Unassigned'} ({currentSelectedGroupObj.domain || 'Domain'})</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-ink">Select Panel Mentors (1 to 3) *</label>
                  <span className="text-xs font-mono text-navy font-bold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                    {selectedPanelistIds.length} of 3 selected
                  </span>
                </div>

                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search mentor by name, employee ID, or designation…"
                    value={panelMentorSearch}
                    onChange={(e) => setPanelMentorSearch(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                  {panelMentorSearch && (
                    <button
                      type="button"
                      onClick={() => setPanelMentorSearch('')}
                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3.5 border border-rule rounded-lg bg-paper">
                  {filteredPanelMentors.map((fac) => (
                    <label
                      key={fac.faculty_id}
                      className={`flex items-center justify-between p-2.5 rounded-md text-xs cursor-pointer border transition-colors ${selectedPanelistIds.includes(String(fac.faculty_id))
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold shadow-2xs'
                        : 'bg-white border-rule text-ink hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-indigo-600"
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
                        <div className="truncate">
                          <span className="font-bold text-sm block truncate">{fac.name}</span>
                          <span className="text-[11px] text-draft block truncate">{fac.designation}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-draft bg-slate-100 px-2 py-0.5 rounded border border-rule shrink-0">
                        {fac.guided_groups ?? fac.current_guided_groups ?? 0} guided
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setPanelModal(false)}
                  className="px-5 py-2.5 border border-rule rounded-md text-sm font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary py-2.5 px-6 text-sm font-bold shadow-xs"
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
