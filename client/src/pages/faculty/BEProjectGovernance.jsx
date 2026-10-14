import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const Icons = {
  search: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  plus: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  edit: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  ),
  trash: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  transfer: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  check: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  overview: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  stages: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  ),
  governance: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0H9.497m5.003 0a3.375 3.375 0 003.375-3.375V6.75A2.25 2.25 0 0015.625 4.5h-7.25A2.25 2.25 0 006.125 6.75v5.25a3.375 3.375 0 003.375 3.375z" />
    </svg>
  ),
  copy: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  ),
  spreadsheet: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v18h16.5V3H3.75zm3 3h10.5v3H6.75V6zm0 4.5h10.5v3H6.75v-3zm0 4.5h10.5v3H6.75v-3z" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
};

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

  // Guide Assignments Export Dropdown & PDF State
  const [guideExportOpen, setGuideExportOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const guideExportRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (guideExportRef.current && !guideExportRef.current.contains(e.target)) {
        setGuideExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  const [unassignMentorsModal, setUnassignMentorsModal] = useState(false);
  const [unassignMentorsScope, setUnassignMentorsScope] = useState('ALL');
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

  // Student Member Management State
  const [studentModal, setStudentModal] = useState(null); // { mode: 'add' | 'edit', group, member }
  const [studentForm, setStudentForm] = useState({
    name: '',
    roll_no: '',
    division: 'BE-1',
    email: '',
    mobile_no: '',
    is_leader: false,
  });
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [prnSuggestions, setPrnSuggestions] = useState([]);
  const [searchingPrn, setSearchingPrn] = useState(false);
  const [prnMatchedStudent, setPrnMatchedStudent] = useState(null);
  const [showPrnDropdown, setShowPrnDropdown] = useState(false);

  const [transferModal, setTransferModal] = useState(null); // { group, member }
  const [transferTargetGroupId, setTransferTargetGroupId] = useState('');
  const [transferMakeLeader, setTransferMakeLeader] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');

  // Group Details Edit Modal State
  const [editGroupModal, setEditGroupModal] = useState(null);
  const [editGroupForm, setEditGroupForm] = useState({
    title: '',
    title_2: '',
    title_3: '',
    domain: '',
    batch: 'BE-1',
  });
  const [submittingGroupEdit, setSubmittingGroupEdit] = useState(false);

  // Staged / Pending Changes State (Apply Changes altogether)
  const [pendingChanges, setPendingChanges] = useState({
    guideDesignations: {}, // facultyId (number) -> boolean (is_guide)
    groupGuides: {},       // groupId (number) -> { guide_id: number | null, guide_name: string }
    panelAssignments: {},  // `${stageId}_${groupId}` -> { stage_id, group_id, panel_member_ids, panel_members }
  });
  const [applyingBatch, setApplyingBatch] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);

  // 1. Effective Groups: overlay staged groupGuides
  const effectiveGroups = useMemo(() => {
    return groups.map((g) => {
      const stagedGuide = pendingChanges.groupGuides[g.id];
      const effectiveGuideId = stagedGuide !== undefined ? stagedGuide.guide_id : (g.guide_id || g.guide_faculty_id || null);
      const effectiveGuideName = stagedGuide !== undefined ? stagedGuide.guide_name : g.guide_name;
      const isGuideStaged = stagedGuide !== undefined;

      return {
        ...g,
        guide_id: effectiveGuideId,
        guide_faculty_id: effectiveGuideId,
        guide_name: effectiveGuideName,
        _isGuideStaged: isGuideStaged,
      };
    });
  }, [groups, pendingChanges.groupGuides]);

  // 2. Base groupPanelistsMap from database panelMatrix
  const baseGroupPanelistsMap = useMemo(() => {
    const map = {};
    for (const item of panelMatrix) {
      map[item.id] = (item.panelists || []).filter(
        (p) =>
          Number(p.faculty_id) !== Number(item.guide_id) &&
          (!item.guide_name || (p.name || '').trim().toLowerCase() !== item.guide_name.trim().toLowerCase())
      );
    }
    return map;
  }, [panelMatrix]);

  // 3. Effective Group Panelists Map: overlay staged panelAssignments
  const effectiveGroupPanelistsMap = useMemo(() => {
    const map = { ...baseGroupPanelistsMap };
    if (panelMatrixStageId) {
      for (const staged of Object.values(pendingChanges.panelAssignments)) {
        if (Number(staged.stage_id) === Number(panelMatrixStageId)) {
          map[staged.group_id] = staged.panel_members || [];
        }
      }
    }
    return map;
  }, [baseGroupPanelistsMap, pendingChanges.panelAssignments, panelMatrixStageId]);

  // 4. Effective Faculty Load: overlay staged guideDesignations, guided_groups counts, and panel_assignments counts
  const effectiveFacultyLoad = useMemo(() => {
    const list = dashboardData?.faculty_load || [];
    return list.map((fac) => {
      const fId = Number(fac.faculty_id);
      const stagedDesig = pendingChanges.guideDesignations[fId];
      const isStaged = stagedDesig !== undefined;
      const isGuide = isStaged ? stagedDesig : Boolean(fac.is_designated_guide);

      // Effective guided groups count
      const guidedCount = effectiveGroups.filter(
        (g) => Number(g.guide_id) === fId
      ).length;

      // Effective panel assignments count
      let panelCount = Number(fac.panel_assignments || 0);
      for (const staged of Object.values(pendingChanges.panelAssignments)) {
        const wasInOriginal = (baseGroupPanelistsMap[staged.group_id] || []).some(
          (p) => Number(p.faculty_id) === fId
        );
        const isInStaged = staged.panel_member_ids.includes(fId);
        if (!wasInOriginal && isInStaged) panelCount++;
        if (wasInOriginal && !isInStaged) panelCount = Math.max(0, panelCount - 1);
      }

      return {
        ...fac,
        is_designated_guide: isGuide,
        guided_groups: guidedCount,
        panel_assignments: panelCount,
        _isDesignationStaged: isStaged,
      };
    });
  }, [dashboardData?.faculty_load, pendingChanges.guideDesignations, effectiveGroups, pendingChanges.panelAssignments, baseGroupPanelistsMap]);

  const guidesCount = useMemo(() => {
    return effectiveFacultyLoad.filter(
      (f) => Boolean(f.is_designated_guide || Number(f.guided_groups) > 0) && Number(f.panel_assignments) === 0
    ).length;
  }, [effectiveFacultyLoad]);

  const mentorsCount = useMemo(() => {
    return effectiveFacultyLoad.filter(
      (f) => Number(f.panel_assignments) > 0
    ).length;
  }, [effectiveFacultyLoad]);

  const eligibleCount = useMemo(() => {
    return effectiveFacultyLoad.filter(
      (f) => !f.is_designated_guide && Number(f.guided_groups) === 0 && Number(f.panel_assignments) === 0
    ).length;
  }, [effectiveFacultyLoad]);

  const filteredFacultyLoad = useMemo(() => {
    return effectiveFacultyLoad.filter((fac) => {
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
  }, [effectiveFacultyLoad, facultySearch, facultyFilter]);

  const effectiveAvailableGuides = useMemo(() => {
    const list = [];
    for (const fac of effectiveFacultyLoad) {
      if (Boolean(fac.is_designated_guide || Number(fac.guided_groups) > 0) && Number(fac.panel_assignments) === 0) {
        list.push({
          faculty_id: fac.faculty_id,
          id: fac.faculty_id,
          name: fac.name,
          employee_id: fac.employee_id,
          email: fac.email,
          designation: fac.designation,
          current_guided_groups: fac.guided_groups,
        });
      }
    }
    return list;
  }, [effectiveFacultyLoad]);

  const filteredModalGuides = useMemo(() => {
    if (!guideModalSearch.trim()) return effectiveAvailableGuides;
    const q = guideModalSearch.toLowerCase().trim();
    return effectiveAvailableGuides.filter((g) => {
      return (
        g.name?.toLowerCase().includes(q) ||
        g.employee_id?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.designation?.toLowerCase().includes(q)
      );
    });
  }, [effectiveAvailableGuides, guideModalSearch]);

  const allDepartmentFaculty = useMemo(() => {
    if (effectiveFacultyLoad && effectiveFacultyLoad.length > 0) {
      return effectiveFacultyLoad;
    }
    return effectiveAvailableGuides;
  }, [effectiveFacultyLoad, effectiveAvailableGuides]);

  // All faculty IDs and names who are designated guides or active guides (guides cannot be panel mentors)
  const allGuideFacultyIds = useMemo(() => {
    const set = new Set();
    effectiveFacultyLoad.forEach((f) => {
      if (f.is_designated_guide || Number(f.guided_groups) > 0) {
        set.add(Number(f.faculty_id));
      }
    });
    effectiveGroups.forEach((g) => {
      if (g.guide_id) set.add(Number(g.guide_id));
    });
    return set;
  }, [effectiveFacultyLoad, effectiveGroups]);

  const allGuideNames = useMemo(() => {
    const set = new Set();
    effectiveFacultyLoad.forEach((f) => {
      if ((f.is_designated_guide || Number(f.guided_groups) > 0) && f.name) {
        set.add(f.name.trim().toLowerCase());
      }
    });
    effectiveGroups.forEach((g) => {
      if (g.guide_name) set.add(g.guide_name.trim().toLowerCase());
    });
    return set;
  }, [effectiveFacultyLoad, effectiveGroups]);

  const filteredPanelMentors = useMemo(() => {
    const selectedGroup = effectiveGroups.find((g) => g.id === Number(selectedGroupId));
    let list = (allDepartmentFaculty || []).filter((f) => {
      const fId = Number(f.faculty_id || f.id);
      const fName = (f.name || '').trim().toLowerCase();
      // Exclude ANY faculty member who is a designated guide or active guide
      if (allGuideFacultyIds.has(fId) || allGuideNames.has(fName)) return false;
      if (f.is_designated_guide || Number(f.guided_groups) > 0) return false;
      // Exclude group's guide
      if (selectedGroup?.guide_id && fId === Number(selectedGroup.guide_id)) return false;
      if (selectedGroup?.guide_faculty_id && fId === Number(selectedGroup.guide_faculty_id)) return false;
      if (selectedGroup?.guide_name && fName === selectedGroup.guide_name.trim().toLowerCase()) return false;
      return true;
    });

    if (!panelMentorSearch.trim()) return list;
    const q = panelMentorSearch.toLowerCase().trim();
    return list.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.designation?.toLowerCase().includes(q) ||
        f.employee_id?.toLowerCase().includes(q)
    );
  }, [allDepartmentFaculty, panelMentorSearch, effectiveGroups, selectedGroupId, allGuideFacultyIds, allGuideNames]);

  const filteredRangeMentors = useMemo(() => {
    let list = (allDepartmentFaculty || []).filter((f) => {
      const fId = Number(f.faculty_id || f.id);
      const fName = (f.name || '').trim().toLowerCase();
      // Exclude ANY faculty member who is a designated guide or active guide
      if (allGuideFacultyIds.has(fId) || allGuideNames.has(fName)) return false;
      if (f.is_designated_guide || Number(f.guided_groups) > 0) return false;
      return true;
    });

    if (!rangeMentorSearch.trim()) return list;
    const q = rangeMentorSearch.toLowerCase().trim();
    return list.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.designation?.toLowerCase().includes(q) ||
        f.employee_id?.toLowerCase().includes(q)
    );
  }, [allDepartmentFaculty, rangeMentorSearch, allGuideFacultyIds, allGuideNames]);

  const groupPanelistsMap = effectiveGroupPanelistsMap;

  const filteredGroups = useMemo(() => {
    return effectiveGroups.filter((g) => {
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
        const mentors = effectiveGroupPanelistsMap[g.id] || [];
        const mentorMatch = mentors.some(m => m.name?.toLowerCase().includes(q));
        if (!codeMatch && !titleMatch && !domainMatch && !guideMatch && !memberMatch && !mentorMatch) return false;
      }
      return true;
    });
  }, [effectiveGroups, selectedDivision, groupSearch, effectiveGroupPanelistsMap]);

  // Pending counts
  const pendingGuideCount = Object.keys(pendingChanges.guideDesignations).length;
  const pendingGroupGuideCount = Object.keys(pendingChanges.groupGuides).length;
  const pendingPanelCount = Object.keys(pendingChanges.panelAssignments).length;
  const totalPendingCount = pendingGuideCount + pendingGroupGuideCount + pendingPanelCount;
  const hasPendingChanges = totalPendingCount > 0;

  // Prevent accidental navigation when changes are staged
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasPendingChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  const fetchHODData = async () => {
    setLoading(true);
    try {
      const ts = Date.now();
      const noCacheConfig = { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } };
      const [dashRes, groupsRes, stagesRes, guidesRes, settingsRes] = await Promise.all([
        api.get(`/projects/hod/dashboard?academic_year=${academicYear}&_t=${ts}`, noCacheConfig).catch((err) => {
          console.error('Error fetching dashboard:', err);
          return { data: { total_groups: 0, group_status_breakdown: [], stages: [], faculty_load: [] } };
        }),
        api.get(`/projects/hod/groups?academic_year=${academicYear}&_t=${ts}`, noCacheConfig).catch((err) => {
          console.error('Error fetching groups:', err);
          return { data: [] };
        }),
        api.get(`/projects/hod/stages?academic_year=${academicYear}&_t=${ts}`, noCacheConfig).catch((err) => {
          console.error('Error fetching stages:', err);
          return { data: [] };
        }),
        api.get(`/projects/student/available-guides?academic_year=${academicYear}&_t=${ts}`, noCacheConfig).catch((err) => {
          console.error('Error fetching guides:', err);
          return { data: [] };
        }),
        api.get(`/projects/registration-settings?academic_year=${academicYear}&_t=${ts}`, noCacheConfig).catch(() => ({ data: { is_registration_open: true, due_date: null, is_open: true } })),
      ]);
      setDashboardData(dashRes.data || {});
      setGroups(groupsRes.data || []);
      setStages(stagesRes.data || []);
      setAvailableGuides(guidesRes.data || []);
      setRegSettings(settingsRes.data || { is_registration_open: true, due_date: null, is_open: true });
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
  const handleToggleDesignatedGuide = (facultyId, currentIsGuide, guidedCount, panelAssignments) => {
    if (Number(panelAssignments) > 0) {
      toast.error('This faculty member is assigned as a Panel Mentor and cannot be a Guide.');
      return;
    }
    if (currentIsGuide && Number(guidedCount) > 0) {
      toast.error(`Cannot remove guide status: Faculty is actively guiding ${guidedCount} project group(s). Reassign them first.`);
      return;
    }

    const originalFac = dashboardData?.faculty_load?.find((f) => Number(f.faculty_id) === Number(facultyId));
    const originalIsGuide = Boolean(originalFac?.is_designated_guide);
    const nextIsGuide = !currentIsGuide;

    setPendingChanges((prev) => {
      const updated = { ...prev.guideDesignations };
      if (nextIsGuide === originalIsGuide) {
        delete updated[facultyId];
      } else {
        updated[facultyId] = nextIsGuide;
      }
      return { ...prev, guideDesignations: updated };
    });

    if (nextIsGuide === originalIsGuide) {
      toast.success('Reverted guide designation to database value');
    } else {
      toast.success(nextIsGuide ? 'Staged: Faculty designated as Guide' : 'Staged: Faculty removed from Guides', {
        icon: '⚡',
      });
    }
  };

  const handleBatchAssignAllGuides = () => {
    const eligible = effectiveFacultyLoad.filter(
      (f) => !f.is_designated_guide && Number(f.guided_groups) === 0 && Number(f.panel_assignments) === 0
    );
    if (eligible.length === 0) {
      toast.info('No additional eligible faculty found to designate as guides');
      return;
    }

    setPendingChanges((prev) => {
      const updated = { ...prev.guideDesignations };
      eligible.forEach((f) => {
        const originalFac = dashboardData?.faculty_load?.find((x) => Number(x.faculty_id) === Number(f.faculty_id));
        const originalIsGuide = Boolean(originalFac?.is_designated_guide);
        if (!originalIsGuide) {
          updated[f.faculty_id] = true;
        }
      });
      return { ...prev, guideDesignations: updated };
    });

    toast.success(`Staged ${eligible.length} eligible faculty as Guides`, { icon: '⚡' });
  };

  const handleAssignGuide = (e) => {
    e.preventDefault();
    if (!guideModalGroup) return;

    const gId = guideModalGroup.id;
    const newGuideId = selectedGuideId ? Number(selectedGuideId) : null;
    const originalGroup = groups.find((g) => g.id === gId);
    const originalGuideId = originalGroup ? (originalGroup.guide_id || originalGroup.guide_faculty_id || null) : null;

    let guideName = null;
    if (newGuideId) {
      const fac = allDepartmentFaculty.find((f) => Number(f.faculty_id || f.id) === newGuideId);
      guideName = fac?.name || 'Faculty';
    }

    setPendingChanges((prev) => {
      const updated = { ...prev.groupGuides };
      if (newGuideId === (originalGuideId ? Number(originalGuideId) : null)) {
        delete updated[gId];
      } else {
        updated[gId] = { guide_id: newGuideId, guide_name: guideName };
      }
      return { ...prev, groupGuides: updated };
    });

    setGuideModalGroup(null);
    setGuideModalSearch('');
    toast.success(
      newGuideId
        ? `Staged guide "${guideName}" for ${guideModalGroup.group_code}`
        : `Staged guide unassignment for ${guideModalGroup.group_code}`,
      { icon: '⚡' }
    );
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

  const handleAssignPanel = (e) => {
    e.preventDefault();
    if (!selectedStageId || !selectedGroupId) {
      return toast.error('Please select stage and group');
    }

    const stageId = Number(selectedStageId);
    const groupId = Number(selectedGroupId);
    const panelMemberIds = selectedPanelistIds.map(Number);
    const key = `${stageId}_${groupId}`;

    const originalPanelists = (baseGroupPanelistsMap[groupId] || []).map((p) => Number(p.faculty_id)).sort();
    const isSameAsOriginal =
      panelMemberIds.length === originalPanelists.length &&
      panelMemberIds.slice().sort().every((val, idx) => val === originalPanelists[idx]);

    const panelMembers = panelMemberIds.map((id) => {
      const fac = allDepartmentFaculty.find((f) => Number(f.faculty_id || f.id) === id);
      return {
        faculty_id: id,
        name: fac?.name || 'Faculty',
        designation: fac?.designation || '',
      };
    });

    setPendingChanges((prev) => {
      const updated = { ...prev.panelAssignments };
      if (isSameAsOriginal) {
        delete updated[key];
      } else {
        updated[key] = {
          stage_id: stageId,
          group_id: groupId,
          panel_member_ids: panelMemberIds,
          panel_members: panelMembers,
        };
      }
      return { ...prev, panelAssignments: updated };
    });

    setPanelModal(false);
    toast.success(
      panelMemberIds.length === 0
        ? 'Staged: Panel mentors unassigned'
        : `Staged: ${panelMemberIds.length} mentor(s) assigned`,
      { icon: '⚡' }
    );
  };

  const handleStageUnassignGroupMentors = (group) => {
    if (!panelMatrixStageId) return;
    const stageId = Number(panelMatrixStageId);
    const groupId = Number(group.id);
    const key = `${stageId}_${groupId}`;

    setPendingChanges((prev) => ({
      ...prev,
      panelAssignments: {
        ...prev.panelAssignments,
        [key]: {
          stage_id: stageId,
          group_id: groupId,
          panel_member_ids: [],
          panel_members: [],
        },
      },
    }));
    toast.success(`Staged: Mentors unassigned for ${group.group_code}`, { icon: '⚡' });
  };

  const handleRangeAssignPanels = (e) => {
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

    const stageId = Number(rangeStageId);
    const rawPanelistIds = rangePanelistIds.map(Number);

    setPendingChanges((prev) => {
      const updated = { ...prev.panelAssignments };
      selectedGroupsToAssign.forEach((grp) => {
        const key = `${stageId}_${grp.id}`;
        const grpGuideId = grp.guide_id || grp.proposed_guide_id;

        const effectivePanelistIds = rawPanelistIds.filter((id) => {
          if (rangeSkipGuideConflict && grpGuideId && Number(id) === Number(grpGuideId)) return false;
          if (allGuideFacultyIds.has(Number(id))) return false;
          return true;
        });

        const panelMembers = effectivePanelistIds.map((id) => {
          const fac = allDepartmentFaculty.find((f) => Number(f.faculty_id || f.id) === id);
          return {
            faculty_id: id,
            name: fac?.name || 'Faculty',
            designation: fac?.designation || '',
          };
        });

        updated[key] = {
          stage_id: stageId,
          group_id: grp.id,
          panel_member_ids: effectivePanelistIds,
          panel_members: panelMembers,
        };
      });
      return { ...prev, panelAssignments: updated };
    });

    setRangeAssignModal(false);
    toast.success(`Staged panel mentors for ${selectedGroupsToAssign.length} groups`, { icon: '⚡' });
  };

  const revertGuideDesignation = (facultyId) => {
    setPendingChanges((prev) => {
      const updated = { ...prev.guideDesignations };
      delete updated[facultyId];
      return { ...prev, guideDesignations: updated };
    });
    toast.success('Reverted guide designation');
  };

  const revertGroupGuide = (groupId) => {
    setPendingChanges((prev) => {
      const updated = { ...prev.groupGuides };
      delete updated[groupId];
      return { ...prev, groupGuides: updated };
    });
    toast.success('Reverted group guide assignment');
  };

  const revertPanelAssignment = (key) => {
    setPendingChanges((prev) => {
      const updated = { ...prev.panelAssignments };
      delete updated[key];
      return { ...prev, panelAssignments: updated };
    });
    toast.success('Reverted mentor assignment');
  };

  const handleDiscardAllChanges = () => {
    if (!hasPendingChanges) return;
    if (
      window.confirm(
        `Discard all ${totalPendingCount} staged changes? All pending guide and mentor assignments will be reverted back to current database values.`
      )
    ) {
      setPendingChanges({
        guideDesignations: {},
        groupGuides: {},
        panelAssignments: {},
      });
      toast.success('All staged changes discarded');
    }
  };

  const handleApplyAllChanges = async () => {
    if (!hasPendingChanges) return;
    setApplyingBatch(true);
    try {
      const payload = {
        academic_year: academicYear,
        guide_designations: Object.entries(pendingChanges.guideDesignations).map(([facId, isGuide]) => ({
          faculty_id: Number(facId),
          is_guide: isGuide,
        })),
        group_guides: Object.entries(pendingChanges.groupGuides).map(([grpId, data]) => ({
          group_id: Number(grpId),
          guide_id: data.guide_id,
        })),
        panel_assignments: Object.values(pendingChanges.panelAssignments).map((item) => ({
          stage_id: item.stage_id,
          group_id: item.group_id,
          panel_member_ids: item.panel_member_ids,
        })),
      };

      const res = await api.post('/projects/hod/governance/batch-apply', payload);
      toast.success(res.data.message || 'All changes saved to database successfully!');
      setPendingChanges({
        guideDesignations: {},
        groupGuides: {},
        panelAssignments: {},
      });
      setShowChangesModal(false);
      await fetchHODData();
      if (panelMatrixStageId) {
        await fetchPanelMatrix(panelMatrixStageId);
      }
    } catch (err) {
      console.error('Error applying batch changes:', err);
      toast.error(err.response?.data?.error || 'Failed to apply changes to database');
    } finally {
      setApplyingBatch(false);
    }
  };

  const handleAcademicYearChange = (newYear) => {
    if (hasPendingChanges) {
      if (
        !window.confirm(
          'You have unsaved staged changes for the current academic year. Switching academic years will discard them. Proceed?'
        )
      ) {
        return;
      }
      setPendingChanges({ guideDesignations: {}, groupGuides: {}, panelAssignments: {} });
    }
    setAcademicYear(newYear);
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
      // Immediately reset guide statuses in state
      setDashboardData((prev) => {
        if (!prev) return prev;
        const updatedLoad = (prev.faculty_load || []).map((f) => ({
          ...f,
          guided_groups: 0,
          is_designated_guide: false,
        }));
        return { ...prev, faculty_load: updatedLoad };
      });
      setAvailableGuides([]);
      setGroups((prev) => prev.map((g) => ({ ...g, guide_id: null, guide_faculty_id: null, guide_name: null })));
      setPendingChanges((prev) => ({
        ...prev,
        guideDesignations: {},
        groupGuides: {},
      }));
      await fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear guide assignments');
    }
  };

  const handleClearAllMentors = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/projects/hod/groups/clear-mentors', {
        academic_year: academicYear,
        stage_id: unassignMentorsScope === 'STAGE' ? panelMatrixStageId : 'ALL',
      });
      toast.success(res.data.message);
      setUnassignMentorsModal(false);
      // Immediately reset panel mentor statuses in state
      if (unassignMentorsScope === 'ALL') {
        setDashboardData((prev) => {
          if (!prev) return prev;
          const updatedLoad = (prev.faculty_load || []).map((f) => ({
            ...f,
            panel_assignments: 0,
          }));
          return { ...prev, faculty_load: updatedLoad };
        });
      }
      setPanelMatrix((prev) => prev.map((item) => ({ ...item, panelists: [] })));
      setPendingChanges((prev) => ({
        ...prev,
        panelAssignments: {},
      }));
      await fetchHODData();
      if (panelMatrixStageId) {
        await fetchPanelMatrix(panelMatrixStageId);
      }
    } catch (err) {
      console.error('Failed to unassign mentors:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to unassign panel mentors');
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

  // Generate and Download Official Guide Assignments PDF
  // Generate and Download Official Guide Assignments PDF (Matrix layout mirroring Excel)
  const handleExportGuideAssignmentsPdf = async () => {
    const targetGroups = (selectedDivision && selectedDivision !== 'ALL') ? filteredGroups : groups;
    if (!targetGroups || targetGroups.length === 0) {
      toast.error('No project groups available to export.');
      return;
    }

    setExportingPdf(true);
    const toastId = toast.loading('Generating Guide Assignments PDF...');

    try {
      const [jspdfModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 28; // Compact printable margin (785.89 pt usable)

      // Institutional Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 28, 56);
      doc.text('MES WADIA COLLEGE OF ENGINEERING, PUNE - 411001', pageWidth / 2, 34, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 80, 95);
      doc.text('(Affiliated to Savitribai Phule Pune University • Approved by AICTE)', pageWidth / 2, 46, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 28, 56);
      doc.text('DEPARTMENT OF COMPUTER ENGINEERING', pageWidth / 2, 60, { align: 'center' });

      // Title Bar
      doc.setDrawColor(27, 94, 32);
      doc.setLineWidth(1);
      doc.line(margin, 68, pageWidth - margin, 68);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(27, 94, 32); // Institutional Forest Green matching Excel
      doc.text('FINAL YEAR B.E. PROJECT — GUIDE ALLOCATION & TOPIC ASSIGNMENT', pageWidth / 2, 81, { align: 'center' });

      // Metadata info row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const divLabel = selectedDivision && selectedDivision !== 'ALL' ? selectedDivision : 'All Divisions';
      doc.text(`Academic Year: AY ${academicYear}`, margin, 94);
      doc.text(`Division: ${divLabel}`, margin + 175, 94);
      doc.text(`Total Project Groups: ${targetGroups.length}`, pageWidth / 2 + 50, 94);
      doc.text(`Date: ${dateStr}`, pageWidth - margin, 94, { align: 'right' });

      // Prepare Matrix Table Rows matching Excel layout with merged cells
      const tableData = [];

      targetGroups.forEach((g, gIdx) => {
        const members = g.members || [];
        const maxRows = Math.max(members.length, 3);
        const groupNum = g.group_code ? (parseInt(g.group_code.split('-').pop(), 10) || (gIdx + 1)) : (gIdx + 1);
        const groupDiv = members[0]?.division || g.batch || 'BE-1';
        const domainName = g.domain || '—';
        const guideName = g.guide_name || g.proposed_guide_name || 'Unassigned';

        for (let r = 0; r < maxRows; r++) {
          const m = members[r] || null;
          let topicText = '';
          if (r === 0 && g.title) topicText = `1. ${g.title}`;
          else if (r === 1 && g.title_2) topicText = `2. ${g.title_2}`;
          else if (r === 2 && g.title_3) topicText = `3. ${g.title_3}`;

          const studentDisplayName = m ? ((m.name || m.student_name || '—') + (m.is_leader ? ' [Leader]' : '')) : '';
          const studentPRN = m ? (m.roll_no || m.prn || '') : '';
          const studentDiv = m ? (m.division || groupDiv) : '';

          if (r === 0) {
            tableData.push([
              {
                content: String(groupNum),
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
              },
              {
                content: studentDisplayName,
                styles: { halign: 'left', valign: 'middle', fontStyle: m?.is_leader ? 'bold' : 'normal' }
              },
              {
                content: studentPRN,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: studentDiv,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: domainName,
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: guideName,
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
              },
              {
                content: topicText,
                styles: { halign: 'left', valign: 'middle' }
              }
            ]);
          } else {
            tableData.push([
              {
                content: studentDisplayName,
                styles: { halign: 'left', valign: 'middle', fontStyle: m?.is_leader ? 'bold' : 'normal' }
              },
              {
                content: studentPRN,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: studentDiv,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: topicText,
                styles: { halign: 'left', valign: 'middle' }
              }
            ]);
          }
        }

        // Blank separator row matching Excel's emptyRow
        if (gIdx < targetGroups.length - 1) {
          tableData.push([
            {
              content: '',
              colSpan: 7,
              styles: {
                minCellHeight: 4,
                cellPadding: 0,
                fillColor: [255, 255, 255],
                lineColor: [225, 230, 238],
                lineWidth: 0.5
              }
            }
          ]);
        }
      });

      autoTable(doc, {
        head: [['Group No', 'Name of Student', 'College PRN', 'Division', 'Domain Name', 'Guide Name', '3 Project Topics']],
        body: tableData,
        startY: 104,
        margin: { top: 32, left: margin, right: margin, bottom: 45 },
        theme: 'grid',
        rowPageBreak: 'avoid',
        headStyles: {
          fillColor: [232, 245, 233], // Excel Light Green #E8F5E9
          textColor: [27, 94, 32],    // Excel Dark Green #1B5E20
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineColor: [165, 214, 167], // #A5D6A7
          lineWidth: 0.75,
          minCellHeight: 22,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 30, 30],
          cellPadding: { top: 3.5, bottom: 3.5, left: 4.5, right: 4.5 },
          valign: 'middle',
          lineColor: [210, 215, 225],
          lineWidth: 0.5
        },
        columnStyles: {
          0: { cellWidth: 46, halign: 'center' },
          1: { cellWidth: 136, halign: 'left' },
          2: { cellWidth: 68, halign: 'center' },
          3: { cellWidth: 44, halign: 'center' },
          4: { cellWidth: 106, halign: 'center' },
          5: { cellWidth: 110, halign: 'center' },
          6: { cellWidth: 275.89, halign: 'left' }
        }
      });

      // Signature Block on final page
      const finalY = doc.lastAutoTable.finalY || 450;
      let signY = finalY + 36;

      if (signY > pageHeight - 65) {
        doc.addPage();
        signY = 70;
      }

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);

      const col1X = margin + 35;
      doc.line(col1X, signY, col1X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Project Coordinator', col1X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. of Computer Engg.', col1X + 65, signY + 25, { align: 'center' });

      const col2X = pageWidth / 2 - 65;
      doc.line(col2X, signY, col2X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Academic Coordinator', col2X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('MES WCOE Pune', col2X + 65, signY + 25, { align: 'center' });

      const col3X = pageWidth - margin - 165;
      doc.line(col3X, signY, col3X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Head of Department', col3X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. of Computer Engg.', col3X + 65, signY + 25, { align: 'center' });

      // Clean footer stamped across all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${p} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 16,
          { align: 'center' }
        );
        doc.text(
          'Department of Computer Engineering • MES WCOE Pune',
          margin,
          pageHeight - 16
        );
        doc.text(
          `Academic Year: AY ${academicYear}`,
          pageWidth - margin,
          pageHeight - 16,
          { align: 'right' }
        );
      }

      const cleanFileName = `BE_Project_Guide_Assignments_${academicYear.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(cleanFileName);
      toast.success(`Downloaded: ${cleanFileName}`, { id: toastId });
    } catch (pdfErr) {
      console.error('Error generating Guide Assignments PDF:', pdfErr);
      toast.error('Failed to generate PDF: ' + (pdfErr.message || 'Unknown error'), { id: toastId });
    } finally {
      setExportingPdf(false);
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
    if (!window.confirm(`Are you sure you want to reset and clear all registered project group forms for Academic Year ${academicYear}?\n\nThis will permanently remove all ${groups.length} registered groups and student choices. This action cannot be undone.`)) {
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

  // Helper to map department divisions (like 'TE Comp 2', 'A', '2', etc.) to standard project batches 'BE-1'..'BE-4'
  const mapToBEDivision = (div, defaultBatch = 'BE-1') => {
    if (!div) return defaultBatch;
    const s = String(div).toUpperCase().trim();
    if (s.includes('BE-1') || s === 'A' || s.endsWith(' 1') || s === '1' || s.includes('COMP 1')) return 'BE-1';
    if (s.includes('BE-2') || s === 'B' || s.endsWith(' 2') || s === '2' || s.includes('COMP 2')) return 'BE-2';
    if (s.includes('BE-3') || s === 'C' || s.endsWith(' 3') || s === '3' || s.includes('COMP 3')) return 'BE-3';
    if (s.includes('BE-4') || s === 'D' || s.endsWith(' 4') || s === '4' || s.includes('COMP 4')) return 'BE-4';
    if (['BE-1', 'BE-2', 'BE-3', 'BE-4'].includes(s)) return s;
    return defaultBatch;
  };

  const handleOpenAddStudent = (group) => {
    const memCount = group.members?.length || group.members_count || 0;
    if (memCount >= 4) {
      toast.error(`Group ${group.group_code} is already full (maximum capacity of 4 members reached).`);
      return;
    }
    setStudentModal({ mode: 'add', group });
    setStudentForm({
      name: '',
      roll_no: '',
      division: group.batch || 'BE-1',
      email: '',
      mobile_no: '',
      is_leader: false,
    });
    setPrnSuggestions([]);
    setSearchingPrn(false);
    setPrnMatchedStudent(null);
    setShowPrnDropdown(false);
  };

  const handleOpenEditStudent = (group, member) => {
    setStudentModal({ mode: 'edit', group, member });
    setStudentForm({
      name: member.name || member.student_name || '',
      roll_no: member.roll_no || '',
      division: member.division || group.batch || 'BE-1',
      email: member.email || '',
      mobile_no: member.mobile_no || '',
      is_leader: Boolean(member.is_leader),
    });
    setPrnSuggestions([]);
    setSearchingPrn(false);
    setPrnMatchedStudent(null);
    setShowPrnDropdown(false);
  };

  const handleSelectStudentSuggestion = (s) => {
    setStudentForm((prev) => ({
      ...prev,
      name: s.name || prev.name,
      roll_no: s.enrollment_no || s.roll_no || prev.roll_no,
      division: mapToBEDivision(s.division, studentModal?.group?.batch || prev.division),
      email: s.email || prev.email,
      mobile_no: s.mobile_no || prev.mobile_no,
    }));
    setPrnMatchedStudent(s);
    setShowPrnDropdown(false);
    setPrnSuggestions([]);
    if (s.current_group_code) {
      toast(`Note: Student is currently registered in ${s.current_group_code} (will be transferred automatically upon saving).`);
    } else {
      toast.success(`Loaded ${s.name} (${s.enrollment_no || s.roll_no})`);
    }
  };

  // Debounced PRN lookup to automatically pop up student name
  useEffect(() => {
    if (!studentModal || studentModal.mode !== 'add') {
      setPrnSuggestions([]);
      setShowPrnDropdown(false);
      return;
    }
    const q = (studentForm.roll_no || '').trim();
    if (q.length < 2) {
      setPrnSuggestions([]);
      setShowPrnDropdown(false);
      setPrnMatchedStudent(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingPrn(true);
      try {
        const res = await api.get(`/projects/hod/students/search?academic_year=${academicYear}&q=${encodeURIComponent(q)}`);
        const list = res.data || [];
        setPrnSuggestions(list);
        if (list.length > 0) {
          setShowPrnDropdown(true);
          // Check for exact match on enrollment_no or roll_no (case-insensitive)
          const queryUpper = q.toUpperCase();
          const exact = list.find((item) => {
            const enr = String(item.enrollment_no || '').trim().toUpperCase();
            const rNo = String(item.roll_no || '').trim().toUpperCase();
            return enr === queryUpper || rNo === queryUpper;
          });
          if (exact) {
            setPrnMatchedStudent(exact);
            setStudentForm((prev) => ({
              ...prev,
              name: exact.name || prev.name,
              division: mapToBEDivision(exact.division, studentModal?.group?.batch || prev.division),
              email: exact.email || prev.email,
              mobile_no: exact.mobile_no || prev.mobile_no,
            }));
          }
        } else {
          setShowPrnDropdown(false);
          setPrnMatchedStudent(null);
        }
      } catch (err) {
        console.error('Failed to search student by PRN:', err);
      } finally {
        setSearchingPrn(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [studentForm.roll_no, studentModal, academicYear]);

  const handleOpenEditGroup = (group) => {
    setEditGroupModal(group);
    setEditGroupForm({
      title: group.title || '',
      title_2: group.title_2 || '',
      title_3: group.title_3 || '',
      domain: group.domain || '',
      batch: group.batch || 'BE-1',
    });
  };

  const handleSaveEditGroup = async (e) => {
    e.preventDefault();
    if (!editGroupModal) return;
    if (!editGroupForm.title.trim()) {
      return toast.error('Primary project title is required');
    }
    setSubmittingGroupEdit(true);
    try {
      const res = await api.patch(`/projects/hod/groups/${editGroupModal.id}`, editGroupForm);
      toast.success(res.data.message || 'Group details updated successfully');
      setEditGroupModal(null);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update group details');
    } finally {
      setSubmittingGroupEdit(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Are you sure you want to delete Project Group "${group.group_code}"?\n\nThis will remove the group and all its members permanently.`)) {
      return;
    }
    try {
      const res = await api.delete(`/projects/hod/groups/${group.id}`);
      toast.success(res.data.message || 'Group deleted successfully');
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete project group');
    }
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();
    if (!studentModal) return;
    if (!studentForm.name.trim() || !studentForm.roll_no.trim()) {
      return toast.error('Student Name and PRN / Roll Number are required.');
    }
    setSubmittingStudent(true);
    try {
      if (studentModal.mode === 'add') {
        const res = await api.post(`/projects/hod/groups/${studentModal.group.id}/members`, studentForm);
        toast.success(res.data.message || 'Student added successfully');
      } else {
        const res = await api.patch(`/projects/hod/groups/${studentModal.group.id}/members/${studentModal.member.id}`, studentForm);
        toast.success(res.data.message || 'Student updated successfully');
      }
      setStudentModal(null);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save student details');
    } finally {
      setSubmittingStudent(false);
    }
  };

  const handleDeleteStudent = async (group, member) => {
    const studentName = member.name || member.student_name || member.roll_no;
    if (!window.confirm(`Are you sure you want to remove "${studentName}" (PRN: ${member.roll_no}) from group ${group.group_code}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/projects/hod/groups/${group.id}/members/${member.id}`);
      toast.success(res.data.message || 'Student removed successfully');
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete student');
    }
  };

  const handleOpenTransferStudent = (group, member) => {
    setTransferModal({ group, member });
    setTransferTargetGroupId('');
    setTransferMakeLeader(false);
    setTransferSearch('');
  };

  const handleSaveTransferStudent = async (e) => {
    e.preventDefault();
    if (!transferModal || !transferTargetGroupId) {
      return toast.error('Please select a destination group to transfer');
    }
    setSubmittingStudent(true);
    try {
      const res = await api.post(`/projects/hod/groups/${transferModal.group.id}/members/${transferModal.member.id}/transfer`, {
        target_group_id: Number(transferTargetGroupId),
        is_leader: transferMakeLeader,
      });
      toast.success(res.data.message || 'Student transferred successfully');
      setTransferModal(null);
      fetchHODData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to transfer student');
    } finally {
      setSubmittingStudent(false);
    }
  };

  // Memoized sorted groups & range/domain selection calculations
  const sortedGroups = useMemo(() => {
    return [...(effectiveGroups || [])].sort((a, b) =>
      (a.group_code || '').localeCompare(b.group_code || '', undefined, { numeric: true })
    );
  }, [effectiveGroups]);

  const filteredTransferGroups = useMemo(() => {
    if (!transferModal) return [];
    const currentGroupId = transferModal.group?.id;
    let list = (sortedGroups || []).filter((g) => g.id !== currentGroupId);
    if (transferSearch.trim()) {
      const q = transferSearch.toLowerCase().trim();
      list = list.filter((g) =>
        g.group_code?.toLowerCase().includes(q) ||
        g.title?.toLowerCase().includes(q) ||
        g.domain?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [sortedGroups, transferModal, transferSearch]);

  // Distinct available domains with group counts
  const availableDomains = useMemo(() => {
    const map = new Map();
    effectiveGroups.forEach((g) => {
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
  const currentSelectedGroupObj = effectiveGroups.find((g) => g.id === Number(selectedGroupId));

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Institutional Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink">BE Project Governance</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-white text-navy border border-rule shadow-2xs">
              Coordinator Console
            </span>
            {isHOD && (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-navy border border-blue-200">
                HOD Oversight
              </span>
            )}
          </div>
          <p className="text-sm text-draft mt-1 font-medium">
            Department of Computer Engineering · Academic Year {academicYear}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <label className="text-xs font-semibold text-draft">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => handleAcademicYearChange(e.target.value)}
            className="input-field py-1 text-xs font-mono font-bold max-w-[140px]"
          >
            <option value="2026-27">2026-27 (Current)</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
          </select>
        </div>
      </div>

      {/* Staged Changes Notification Banner */}
      {hasPendingChanges && (
        <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 text-lg font-bold border border-amber-400/30">
              ⚡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950">
                  {totalPendingCount} Staged Change{totalPendingCount > 1 ? 's' : ''} Pending Database Update
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200/70 text-amber-900 border border-amber-400/40">
                  Unsaved Local Draft
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Changes are previewed live below across all tables. Click <strong>Apply Changes to Database</strong> to commit them altogether.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setShowChangesModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md text-amber-900 hover:bg-amber-100 border border-amber-300 transition-colors"
            >
              Review ({totalPendingCount})
            </button>
            <button
              type="button"
              onClick={handleDiscardAllChanges}
              disabled={applyingBatch}
              className="px-3 py-1.5 text-xs font-semibold rounded-md text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
            >
              Discard All
            </button>
            <button
              type="button"
              onClick={handleApplyAllChanges}
              disabled={applyingBatch}
              className="px-4 py-1.5 text-xs font-bold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {applyingBatch ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Apply Changes to Database</span>
                  <span className="bg-emerald-800 px-1.5 py-0.2 rounded text-[11px] font-mono">
                    {totalPendingCount}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-rule pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border transition-all whitespace-nowrap ${activeTab === 'overview'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink shadow-2xs'
            }`}
        >
          {Icons.overview}
          <span>Overview &amp; Allocation</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border transition-all whitespace-nowrap ${activeTab === 'groups'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink shadow-2xs'
            }`}
        >
          {Icons.users}
          <span>Project Groups &amp; Guides</span>
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
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border transition-all whitespace-nowrap ${activeTab === 'stages'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink shadow-2xs'
            }`}
        >
          {Icons.stages}
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
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border transition-all whitespace-nowrap ${activeTab === 'governance'
            ? 'bg-navy text-white border-navy shadow-xs'
            : 'bg-white text-slate-700 border-rule hover:bg-slate-50 hover:text-ink shadow-2xs'
            }`}
        >
          {Icons.governance}
          <span>Panel Matrix &amp; Scores</span>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBatchAssignAllGuides}
                  className="px-3.5 py-2 bg-navy text-white hover:bg-slate-800 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Designate all eligible non-mentor faculty as Guides for this academic year"
                >
                  <span className="text-emerald-300">{Icons.check}</span> <span>Assign All Eligible as Guides</span>
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
                    className="w-full px-3.5 py-2 pl-9 pr-9 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy focus:border-navy outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">{Icons.search}</span>
                  {facultySearch && (
                    <button
                      type="button"
                      onClick={() => setFacultySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="Clear search"
                    >
                      {Icons.close}
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
                    <th>Designation</th>
                    <th>Role &amp; Status</th>
                    <th className="text-center !text-center">Guided Groups</th>
                    <th className="text-right">Guide Assignment Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacultyLoad.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-draft">
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
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isMentor ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                  <span>Panel Mentor</span>
                                </span>
                              ) : isGuide ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="text-emerald-300">{Icons.check}</span>
                                  <span>BE Project Guide</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  <span>Eligible Faculty</span>
                                </span>
                              )}
                              {fac._isDesignationStaged && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ⚡ Staged
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center !text-center font-mono font-bold text-navy">
                            {fac.guided_groups}
                          </td>
                          <td className="text-right">
                            {fac._isDesignationStaged ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-amber-50 text-amber-900 border border-amber-300">
                                  ⚡ {fac.is_designated_guide ? 'Staged as Guide' : 'Staged: Non-Guide'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => revertGuideDesignation(fac.faculty_id)}
                                  className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded border border-slate-300 hover:border-rose-300 transition-colors"
                                  title="Revert to database value"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : isMentor ? (
                              <span
                                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-md text-xs font-bold italic bg-purple-100/80 text-purple-800 border border-purple-300 shadow-2xs"
                                title="Faculty is assigned as a Panel Mentor"
                              >
                                Panel Mentor
                              </span>
                            ) : isGuide ? (
                              <button
                                type="button"
                                disabled={Number(fac.guided_groups) > 0}
                                onClick={() => handleToggleDesignatedGuide(fac.faculty_id, true, fac.guided_groups, fac.panel_assignments)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${Number(fac.guided_groups) > 0
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                                  }`}
                                title={
                                  Number(fac.guided_groups) > 0
                                    ? `Guiding ${fac.guided_groups} group(s). Reassign them first to remove guide status.`
                                    : 'Click to stage removing guide designation'
                                }
                              >
                                {Number(fac.guided_groups) > 0 ? 'Active Guide' : 'Designated Guide'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleDesignatedGuide(fac.faculty_id, false, fac.guided_groups, fac.panel_assignments)}
                                className="px-3.5 py-1.5 text-xs font-bold bg-navy hover:bg-slate-800 text-white rounded-md transition-colors shadow-2xs"
                              >
                                + Assign as Guide
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
                  {Icons.spreadsheet} <span>Form Responses (Excel)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Controls Panel */}
              <div className="space-y-4 bg-paper/50 p-4 border border-rule rounded-md">
                <h4 className="font-semibold text-sm text-ink flex items-center gap-2">
                  <span>Registration Window &amp; Deadlines</span>
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
                      {regSettings.is_registration_open ? 'Close Registration' : 'Open Registration'}
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
                          <span><strong>Deadline Date:</strong> <span className="text-ink font-bold">{new Date(regSettings.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></span>
                          <span><strong>Deadline Time:</strong> <span className="text-ink font-bold">{new Date(regSettings.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></span>
                        </div>
                        {regSettings.is_past_due_date && <p className="text-red-600 font-semibold text-[11px] mt-1">● Deadline has passed</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone: Delete All Registered Forms */}
              <div className="space-y-4 bg-red-50/40 p-4 border border-red-200 rounded-md flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-red-900 flex items-center gap-2">
                    <span>Administrative Action: Reset Registered Forms</span>
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
                    {Icons.trash} <span>Reset All Registered Forms ({groups.length} Groups)</span>
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
                  <span>Evaluation Stage &amp; Panel Mentors</span>
                </h3>
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
                {Icons.users} <span>Assign Mentors by Range / Domain</span>
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
                {Icons.copy} <span>Copy Stage Panels</span>
              </button>
              <button
                type="button"
                onClick={handleClearStagePanels}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
              >
                {Icons.trash} <span>Clear Stage Panels</span>
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
                {Icons.plus} <span>Manual Group Panel</span>
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
                {/* Guide Assignments Export Dropdown (Excel / PDF) */}
                <div className="relative inline-block" ref={guideExportRef}>
                  <button
                    type="button"
                    onClick={() => setGuideExportOpen((prev) => !prev)}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    title="Export Guide Assignments as Excel or PDF"
                    aria-expanded={guideExportOpen}
                  >
                    {Icons.download}
                    <span>Guide Assignments</span>
                    <svg
                      className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-200 ${guideExportOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {guideExportOpen && (
                    <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-60 bg-white rounded-lg border border-slate-200 shadow-xl z-50 py-1 text-xs animate-fade-in">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                        <span>Export Format</span>
                        <span className="text-[9px] font-normal text-slate-400">AY {academicYear}</span>
                      </div>

                      {/* Option 1: Excel */}
                      <button
                        type="button"
                        onClick={() => {
                          setGuideExportOpen(false);
                          handleExportGuideAssignments();
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors"
                      >
                        <span className="w-7 h-7 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          📊
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-800 text-xs">Excel Spreadsheet</span>
                        </div>
                      </button>

                      {/* Option 2: PDF */}
                      <button
                        type="button"
                        disabled={exportingPdf}
                        onClick={() => {
                          setGuideExportOpen(false);
                          handleExportGuideAssignmentsPdf();
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-rose-50 text-slate-700 hover:text-rose-900 transition-colors disabled:opacity-50"
                      >
                        <span className="w-7 h-7 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs shrink-0">
                          📄
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-800 text-xs">PDF Document</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
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
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-draft pointer-events-none flex items-center">{Icons.search}</span>
                {groupSearch && (
                  <button
                    type="button"
                    onClick={() => setGroupSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-draft hover:text-ink hover:bg-slate-100 rounded transition-colors flex items-center justify-center"
                    title="Clear search"
                  >
                    {Icons.close}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-600">Division:</span>
                <div className="bg-slate-100 p-0.5 rounded-md flex items-center gap-0.5 border border-slate-200/80">
                  {['ALL', 'BE-1', 'BE-2', 'BE-3', 'BE-4'].map((div) => (
                    <button
                      key={div}
                      type="button"
                      onClick={() => setSelectedDivision(div)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                        selectedDivision === div
                          ? 'bg-white text-navy shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      {div}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Group Code</th>
                    <th>Title &amp; Domain</th>
                    <th>Team Members</th>
                    <th>Assigned Guide</th>
                    <th>Assigned Mentors</th>
                    <th>Group Status</th>
                    <th className="text-right">Actions</th>
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
                          <tr
                            onClick={() => setExpandedGroupId(isExpanded ? null : g.id)}
                            className={`cursor-pointer transition-colors group ${
                              isExpanded ? 'bg-blue-50/40 border-l-4 border-l-navy' : 'hover:bg-blue-50/20'
                            }`}
                            title={isExpanded ? 'Click to collapse group details' : 'Click to expand group (view students & 3 topics)'}
                          >
                            <td>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all duration-200 shrink-0 ${
                                    isExpanded
                                      ? 'bg-navy text-white rotate-90 shadow-2xs'
                                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-navy'
                                  }`}
                                >
                                  <svg className="w-3 h-3 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                                <div>
                                  <span className="font-mono text-sm font-bold text-navy whitespace-nowrap group-hover:text-blue-700 transition-colors">
                                    {g.group_code}
                                  </span>
                                  <span className="text-[10px] text-draft block">
                                    {isExpanded ? 'Click to hide' : 'Click to view'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="max-w-xs">
                              <div className="font-semibold text-ink text-sm line-clamp-2 group-hover:text-navy transition-colors" title={g.title}>{g.title}</div>
                              <div className="text-xs text-draft mt-0.5 font-medium">{g.domain}</div>
                            </td>
                            <td>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${(g.members?.length || g.members_count || 0) >= 4
                                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                                    : 'bg-blue-50 border-blue-200 text-navy'
                                    }`}>
                                    {g.members?.length || g.members_count || 0} / 4
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedGroupId(isExpanded ? null : g.id);
                                    }}
                                    className="text-[11px] font-bold text-navy hover:underline"
                                    title="View/manage students in this group"
                                  >
                                    {isExpanded ? 'Hide' : 'Manage Team'}
                                  </button>
                                </div>
                                <div className="text-[11px] text-draft truncate max-w-[190px]" title={g.members?.find(m => m.is_leader)?.name || g.leader_name}>
                                  {g.members?.find(m => m.is_leader)?.name || g.leader_name || 'Leader unassigned'}
                                </div>
                              </div>
                            </td>
                            <td>
                              {g.guide_name ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-emerald-800 text-xs">{g.guide_name}</span>
                                    {g._isGuideStaged && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        ⚡ Staged
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setGuideModalSearch('');
                                        setGuideModalGroup(g);
                                        setSelectedGuideId(g.guide_id ? String(g.guide_id) : '');
                                      }}
                                      className="text-[10px] font-semibold text-navy hover:underline block"
                                    >
                                      Change Guide
                                    </button>
                                    {g._isGuideStaged && (
                                      <>
                                        <span className="text-slate-300">·</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            revertGroupGuide(g.id);
                                          }}
                                          className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline"
                                          title="Revert to database guide"
                                        >
                                          Undo
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-draft text-[11px] italic font-mono block">No guide assigned</span>
                                    {g._isGuideStaged && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        ⚡ Staged
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setGuideModalSearch('');
                                        setGuideModalGroup(g);
                                        setSelectedGuideId(g.guide_id ? String(g.guide_id) : '');
                                      }}
                                      className="px-2 py-0.5 bg-navy hover:bg-navy/90 text-white rounded text-[10px] font-bold block transition-colors"
                                    >
                                      + Assign Guide
                                    </button>
                                    {g._isGuideStaged && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          revertGroupGuide(g.id);
                                        }}
                                        className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline ml-1"
                                        title="Revert to database guide"
                                      >
                                        Undo
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td>
                              {(() => {
                                const rawGroupPanelists = effectiveGroupPanelistsMap[g.id] || [];
                                const groupPanelists = rawGroupPanelists.filter(
                                  (p) =>
                                    Number(p.faculty_id) !== Number(g.guide_id) &&
                                    Number(p.faculty_id) !== Number(g.guide_faculty_id) &&
                                    (!g.guide_name || (p.name || '').trim().toLowerCase() !== g.guide_name.trim().toLowerCase())
                                );
                                const isPanelStaged = Boolean(pendingChanges.panelAssignments[`${panelMatrixStageId}_${g.id}`]);

                                return groupPanelists.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {groupPanelists.map((p) => (
                                          <span
                                            key={p.faculty_id}
                                            className="font-bold text-indigo-950 text-xs block"
                                          >
                                            {p.name}
                                          </span>
                                        ))}
                                        {isPanelStaged && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            ⚡ Staged
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedStageId(panelMatrixStageId);
                                          setSelectedGroupId(String(g.id));
                                          setSelectedPanelistIds(groupPanelists.map((p) => String(p.faculty_id)));
                                          setPanelModal(true);
                                        }}
                                        className="text-[10px] font-semibold text-indigo-700 hover:underline"
                                      >
                                        Edit Mentors
                                      </button>
                                      <span className="text-slate-300">·</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStageUnassignGroupMentors(g);
                                        }}
                                        className="text-[10px] font-semibold text-red-600 hover:underline"
                                      >
                                        Unassign
                                      </button>
                                      {isPanelStaged && (
                                        <>
                                          <span className="text-slate-300">·</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              revertPanelAssignment(`${panelMatrixStageId}_${g.id}`);
                                            }}
                                            className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline"
                                            title="Revert to database mentors"
                                          >
                                            Undo
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-draft text-[11px] italic font-mono block">No mentors assigned</span>
                                      {isPanelStaged && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                          ⚡ Staged
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedStageId(panelMatrixStageId);
                                          setSelectedGroupId(String(g.id));
                                          setSelectedPanelistIds([]);
                                          setPanelModal(true);
                                        }}
                                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold block transition-colors"
                                      >
                                        + Assign Mentors
                                      </button>
                                      {isPanelStaged && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            revertPanelAssignment(`${panelMatrixStageId}_${g.id}`);
                                          }}
                                          className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline ml-1"
                                          title="Revert to database mentors"
                                        >
                                          Undo
                                        </button>
                                      )}
                                    </div>
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
                              {(g.members?.length || g.members_count || 0) < 4 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddStudent(g);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded border bg-slate-100 hover:bg-blue-50 hover:text-navy hover:border-blue-300 text-slate-700 border-slate-300 transition-colors shadow-2xs"
                                  title="Add a student member to this group"
                                >
                                  {Icons.plus} Add
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(g);
                                }}
                                className="px-2 py-1 text-xs font-semibold rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                                title="Delete this group"
                              >
                                {Icons.trash}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr className="bg-blue-50/25 border-b-2 border-blue-200">
                              <td colSpan={7} className="p-4 sm:p-5">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-white p-4 sm:p-5 rounded-lg border border-blue-200 shadow-sm">
                                  {/* 3 Project Topic Choices */}
                                  <div className="lg:col-span-5 xl:col-span-5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-rule pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                                          3 Project Topics
                                        </h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-navy font-mono">
                                          {[g.title, g.title_2, g.title_3].filter((t) => t && t.trim()).length}/3 Submitted
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditGroup(g)}
                                        className="px-2.5 py-1 text-[11px] font-semibold text-navy bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
                                      >
                                        {Icons.edit} <span>Edit Topics</span>
                                      </button>
                                    </div>

                                    <div className="space-y-2.5">
                                      {/* Preference 1 (Primary Topic) */}
                                      <div className="p-3 rounded-md bg-blue-50/70 border border-blue-200 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-bold text-navy block text-[11px] uppercase tracking-wide">
                                            Topic 1 (Primary Preference):
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-navy text-white uppercase tracking-wider">
                                            Primary
                                          </span>
                                        </div>
                                        <p className="text-[13px] sm:text-sm font-semibold text-ink leading-snug mt-1">
                                          {g.title || <span className="text-draft italic font-normal">Primary topic not specified</span>}
                                        </p>
                                        {g.domain && (
                                          <div className="mt-2 flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Domain:</span>
                                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-blue-200 text-navy">
                                              {g.domain}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Preference 2 */}
                                      <div className={`p-3 rounded-md border ${g.title_2?.trim() ? 'bg-slate-50/80 border-slate-200 shadow-2xs' : 'bg-gray-50/40 border-dashed border-slate-200'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                            Topic 2 (Second Preference):
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                                            Preference 2
                                          </span>
                                        </div>
                                        {g.title_2?.trim() ? (
                                          <p className="text-[13px] sm:text-sm font-medium text-ink leading-snug mt-1">
                                            {g.title_2}
                                          </p>
                                        ) : (
                                          <p className="text-xs text-draft italic mt-1 font-mono">
                                            No second topic preference submitted
                                          </p>
                                        )}
                                      </div>

                                      {/* Preference 3 */}
                                      <div className={`p-3 rounded-md border ${g.title_3?.trim() ? 'bg-slate-50/80 border-slate-200 shadow-2xs' : 'bg-gray-50/40 border-dashed border-slate-200'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wide">
                                            Topic 3 (Third Preference):
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                                            Preference 3
                                          </span>
                                        </div>
                                        {g.title_3?.trim() ? (
                                          <p className="text-[13px] sm:text-sm font-medium text-ink leading-snug mt-1">
                                            {g.title_3}
                                          </p>
                                        ) : (
                                          <p className="text-xs text-draft italic mt-1 font-mono">
                                            No third topic preference submitted
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Team Members / Students Present */}
                                  <div className="lg:col-span-7 xl:col-span-7 space-y-3">
                                    <div className="flex items-center justify-between border-b border-rule pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                                          Students Present in Group
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${(g.members?.length || 0) >= 4 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                                          {g.members?.length || 0} / 4 Students Present
                                        </span>
                                      </div>
                                      {(g.members?.length || 0) < 4 ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenAddStudent(g)}
                                          className="px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs bg-navy hover:bg-slate-800 text-white"
                                          title="Manually add a student to this project group"
                                        >
                                          {Icons.plus} <span>Add Student</span>
                                        </button>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                          Full (4/4)
                                        </span>
                                      )}
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-left text-[10px] text-draft uppercase border-b border-rule">
                                            <th className="py-2 px-2 text-left whitespace-nowrap">#</th>
                                            <th className="py-2 px-2 text-left whitespace-nowrap">Role</th>
                                            <th className="py-2 px-2 text-left">Student Name</th>
                                            <th className="py-2 px-2 text-left whitespace-nowrap">PRN / Roll No</th>
                                            <th className="py-2 px-2 text-left whitespace-nowrap">Division</th>
                                            <th className="py-2 px-2 text-right whitespace-nowrap">Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rule/60">
                                          {(g.members || []).length === 0 ? (
                                            <tr>
                                              <td colSpan={6} className="py-6 text-center text-draft text-xs italic bg-slate-50/50 rounded">
                                                No students present in this group yet. Click &quot;+ Add Student&quot; to manually add a member.
                                              </td>
                                            </tr>
                                          ) : (
                                            (g.members || []).map((m, mIdx) => (
                                              <tr key={m.id || mIdx} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="py-2 px-2 text-draft font-mono text-[11px] whitespace-nowrap">
                                                  {mIdx + 1}
                                                </td>
                                                <td className="py-2 px-2 font-medium whitespace-nowrap">
                                                  {m.is_leader ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy text-white shadow-2xs">
                                                      Leader
                                                    </span>
                                                  ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                                      Member
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-2 align-middle">
                                                  <div className="text-xs font-semibold text-ink leading-snug">{m.name}</div>
                                                  {m.email && <div className="text-[10px] text-draft">{m.email}</div>}
                                                  {m.mobile_no && <div className="text-[10px] text-draft">{m.mobile_no}</div>}
                                                </td>
                                                <td className="py-2 px-2 font-mono text-draft whitespace-nowrap font-medium">{m.roll_no || '—'}</td>
                                                <td className="py-2 px-2 font-mono text-slate-700 whitespace-nowrap">{m.division || g.batch || '—'}</td>
                                                <td className="py-2 px-2 text-right whitespace-nowrap space-x-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditStudent(g, m)}
                                                    className="px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-rule rounded transition-colors shadow-2xs"
                                                    title="Edit student details"
                                                  >
                                                    {Icons.edit} <span>Edit</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenTransferStudent(g, m)}
                                                    className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors shadow-2xs"
                                                    title="Transfer student to another project group"
                                                  >
                                                    {Icons.transfer} <span>Transfer</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteStudent(g, m)}
                                                    className="px-2 py-0.5 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors shadow-2xs"
                                                    title="Remove student from this group"
                                                  >
                                                    {Icons.trash} <span>Remove</span>
                                                  </button>
                                                </td>
                                              </tr>
                                            ))
                                          )}
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
              <h2 className="font-mono text-xl font-bold text-ink">Continuous Assessment Evaluation Stages</h2>
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
              {Icons.plus} <span>Add Evaluation Stage</span>
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
                      <span>Delete Stage</span>
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
          <div className="bg-white rounded border border-rule max-w-md w-full p-6 shadow-xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center gap-2">
              Copy Panel Assignments Between Stages
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
          <div className="bg-white rounded-lg border border-rule max-w-4xl w-full p-6 sm:p-7 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-5">
            <div className="border-b border-rule pb-3.5 flex items-center justify-between">
              <h3 className="font-serif text-2xl font-bold text-ink flex items-center gap-2.5">
                Assign Mentors by Range or Domain
              </h3>
              <button type="button" onClick={() => setRangeAssignModal(false)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
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
                    By Group Range
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
                    By Project Domain
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
                    className="w-full px-3 py-1.5 pl-8 pr-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">{Icons.search}</span>
                  {rangeMentorSearch && (
                    <button
                      type="button"
                      onClick={() => setRangeMentorSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="Clear search"
                    >
                      {Icons.close}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3.5 border border-rule rounded-lg bg-paper">
                  {filteredRangeMentors.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500 italic">
                      No eligible non-guide faculty available to assign as mentors.
                    </div>
                  ) : (
                    filteredRangeMentors.map((fac) => {
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
                        </label>
                      );
                    })
                  )}
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
                      Notice: {coiWarningsPreview.length} Group(s) with Guide Overlap
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
                {Icons.spreadsheet} <span>Export Score Report</span>
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
          <div className="bg-white rounded-lg border border-rule max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
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
              <button type="button" onClick={() => setGuideModalGroup(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
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
                    className="w-full px-3 py-2 pl-8 pr-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">{Icons.search}</span>
                  {guideModalSearch && (
                    <button
                      type="button"
                      onClick={() => setGuideModalSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="Clear search"
                    >
                      {Icons.close}
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
          <div className="bg-white rounded-lg border border-rule max-w-3xl w-full p-6 sm:p-7 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto space-y-5">
            <div className="border-b border-rule pb-3.5 flex items-center justify-between">
              <h3 className="font-serif text-2xl font-bold text-ink flex items-center gap-2">
                Assign Panel Mentors
              </h3>
              <button type="button" onClick={() => setPanelModal(false)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
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
                      const grpObj = groups.find((x) => String(x.id) === String(gId));
                      if (groupInMatrix) {
                        const cleanPanelists = (groupInMatrix.panelists || []).filter((p) => {
                          if (grpObj?.guide_id && Number(p.faculty_id) === Number(grpObj.guide_id)) return false;
                          if (grpObj?.guide_name && (p.name || '').trim().toLowerCase() === grpObj.guide_name.trim().toLowerCase()) return false;
                          return true;
                        });
                        setSelectedPanelistIds(cleanPanelists.map((p) => String(p.faculty_id)));
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
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 truncate pr-2">
                    Group: {currentSelectedGroupObj.group_code} — {currentSelectedGroupObj.title || 'No Title'}
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold text-ink">Select Panel Mentors (1 to 3)</label>
                  <div className="flex items-center gap-2.5">
                    {selectedPanelistIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPanelistIds([])}
                        className="text-xs text-red-600 font-semibold hover:underline"
                      >
                        Deselect All (Unassign)
                      </button>
                    )}
                    <span className="text-xs font-mono text-navy font-bold bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                      {selectedPanelistIds.length} of 3 selected
                    </span>
                  </div>
                </div>

                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search mentor by name, employee ID, or designation…"
                    value={panelMentorSearch}
                    onChange={(e) => setPanelMentorSearch(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 pr-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">{Icons.search}</span>
                  {panelMentorSearch && (
                    <button
                      type="button"
                      onClick={() => setPanelMentorSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="Clear search"
                    >
                      {Icons.close}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3.5 border border-rule rounded-lg bg-paper">
                  {filteredPanelMentors.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-slate-500 italic">
                      No eligible non-guide faculty available to assign as mentors.
                    </div>
                  ) : (
                    filteredPanelMentors.map((fac) => (
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
                      </label>
                    ))
                  )}
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
                  className={
                    selectedPanelistIds.length === 0
                      ? 'px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-bold shadow-xs transition-colors'
                      : 'btn-primary py-2.5 px-6 text-sm font-bold shadow-xs'
                  }
                >
                  {submitting
                    ? 'Saving...'
                    : selectedPanelistIds.length === 0
                      ? 'Unassign Mentors for this Group'
                      : 'Save Panel Assignment'}
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
          <div className="bg-white rounded border border-rule max-w-xl w-full p-6 shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl font-bold text-ink border-b border-rule pb-3 mb-4 flex items-center justify-between">
              <span>{stageModal === 'edit' ? 'Edit Evaluation Stage' : 'Add New Evaluation Stage'}</span>
              <button type="button" onClick={() => setStageModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
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
                        >{Icons.close}</button>
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
      {/* STUDENT MODAL (ADD / EDIT) */}
      {studentModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-rule max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="border-b border-rule pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
                  {studentModal.mode === 'add' ? Icons.plus : Icons.edit}
                  <span>{studentModal.mode === 'add' ? 'Add Student Member' : 'Edit Student Member'}</span>
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Group: <strong className="text-navy">{studentModal.group.group_code}</strong> — {studentModal.group.title?.substring(0, 45)}
                </p>
              </div>
              <button type="button" onClick={() => setStudentModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
            </div>

            {/* Reassignment Notice if matched student is currently in another group */}
            {studentModal.mode === 'add' && prnMatchedStudent?.current_group_code && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-start gap-2 animate-fade-in">
                <span className="text-base shrink-0">ℹ️</span>
                <div>
                  <strong className="font-semibold block">Automatic Transfer Notice:</strong>
                  <span>Student is currently in group <strong className="font-bold underline">{prnMatchedStudent.current_group_code}</strong>. Submitting will automatically move them into {studentModal.group.group_code}.</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4 pt-1">
              {/* Row 1: College PRN (Primary Search) + Division */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="input-label block">College PRN / Roll No *</label>
                    {searchingPrn && (
                      <span className="text-[11px] text-draft font-medium animate-pulse">Searching...</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. F23112035"
                      value={studentForm.roll_no}
                      onChange={(e) => setStudentForm({ ...studentForm, roll_no: e.target.value })}
                      onFocus={() => {
                        if (prnSuggestions.length > 0) setShowPrnDropdown(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowPrnDropdown(false), 220);
                      }}
                      className="input-field text-sm font-mono uppercase pr-8"
                      autoFocus
                    />
                    {searchingPrn && (
                      <span className="absolute right-2.5 top-2.5 text-xs text-draft">⏳</span>
                    )}
                    {!searchingPrn && prnMatchedStudent && (
                      <span className="absolute right-2.5 top-2.5 text-xs text-emerald-600 font-bold" title="Student matched">{Icons.check}</span>
                    )}
                  </div>

                  {/* Autocomplete Popup Dropdown */}
                  {showPrnDropdown && prnSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-md shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                      <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-bold text-draft uppercase tracking-wider flex items-center justify-between">
                        <span>Matching Students ({prnSuggestions.length})</span>
                        <span className="text-[9px] font-normal lowercase">click to auto-fill</span>
                      </div>
                      {prnSuggestions.map((s) => {
                        const isEnrolled = Boolean(s.current_group_code);
                        const isExact = (s.enrollment_no && s.enrollment_no.toUpperCase() === studentForm.roll_no.trim().toUpperCase()) ||
                          (s.roll_no && s.roll_no.toUpperCase() === studentForm.roll_no.trim().toUpperCase());
                        return (
                          <div
                            key={s.student_id || s.user_id || s.roll_no}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectStudentSuggestion(s);
                            }}
                            className={`p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors ${isExact ? 'bg-emerald-50/50' : ''
                              }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                                <span>{s.name}</span>
                                {isExact && <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Exact Match</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                <span>PRN: <strong className="text-navy">{s.enrollment_no || s.roll_no}</strong></span>
                                <span>·</span>
                                <span>Div: {s.division || 'BE-1'}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              {isEnrolled ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  In {s.current_group_code} (Move)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200">
                                  Populate →
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="input-label mb-1 block">Division *</label>
                  <select
                    value={studentForm.division}
                    onChange={(e) => setStudentForm({ ...studentForm, division: e.target.value })}
                    className="input-field text-sm font-semibold"
                  >
                    <option value="BE-1">BE-1</option>
                    <option value="BE-2">BE-2</option>
                    <option value="BE-3">BE-3</option>
                    <option value="BE-4">BE-4</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Full Student Name (Auto-filled or manual) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label block">Full Student Name *</label>
                  {prnMatchedStudent ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in">
                      Auto-filled from registry
                    </span>
                  ) : (
                    <span className="text-[10px] text-draft">Auto-fills from PRN or enter manually</span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className={`input-field text-sm transition-all ${prnMatchedStudent ? 'bg-emerald-50/40 border-emerald-300 font-semibold text-slate-900' : ''
                    }`}
                />
              </div>

              {/* Row 3: Email + Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label mb-1 block">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="student@college.edu"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="input-field text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="input-label mb-1 block">Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={studentForm.mobile_no}
                    onChange={(e) => setStudentForm({ ...studentForm, mobile_no: e.target.value })}
                    className="input-field text-xs font-mono"
                  />
                </div>
              </div>

              {/* Row 4: Leader Option */}
              <div className="p-3 bg-paper rounded border border-rule">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={studentForm.is_leader}
                    onChange={(e) => setStudentForm({ ...studentForm, is_leader: e.target.checked })}
                    className="w-4 h-4 rounded text-navy"
                  />
                  <span>Set as Group Leader (will replace existing leader)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setStudentModal(null)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStudent}
                  className="btn-primary py-2 px-5 text-xs font-bold"
                >
                  {submittingStudent ? 'Saving...' : studentModal.mode === 'add' ? 'Add Student' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* TRANSFER STUDENT MODAL */}
      {transferModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-rule max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="border-b border-rule pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
                  {Icons.transfer}
                  <span>Transfer Student to Another Group</span>
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Move student from current group to a different project group.
                </p>
              </div>
              <button type="button" onClick={() => setTransferModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
            </div>

            {/* Student & Source Info */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-md text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-navy">{transferModal.member.name || transferModal.member.student_name}</span>
                <span className="font-mono text-draft font-bold">PRN: {transferModal.member.roll_no}</span>
              </div>
              <div className="text-slate-600 flex items-center gap-2 pt-1 border-t border-blue-200/60">
                <span>Current Group: <strong className="text-navy">{transferModal.group.group_code}</strong></span>
                <span>·</span>
                <span>Division: <strong>{transferModal.member.division || transferModal.group.batch || 'BE-1'}</strong></span>
              </div>
            </div>

            <form onSubmit={handleSaveTransferStudent} className="space-y-4 pt-1">
              <div>
                <label className="input-label mb-1.5 block">Select Destination Project Group *</label>

                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search target group by code, title, or domain…"
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 pr-8 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-navy outline-none placeholder:text-slate-400 font-medium"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">{Icons.search}</span>
                  {transferSearch && (
                    <button
                      type="button"
                      onClick={() => setTransferSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center"
                      title="Clear search"
                    >
                      {Icons.close}
                    </button>
                  )}
                </div>

                <select
                  value={transferTargetGroupId}
                  onChange={(e) => setTransferTargetGroupId(e.target.value)}
                  className="input-field font-semibold text-xs"
                  size={filteredTransferGroups.length > 5 ? 6 : undefined}
                  required
                >
                  <option value="">-- Select Destination Group --</option>
                  {filteredTransferGroups.map((tg) => {
                    const memCount = tg.members?.length || tg.members_count || 0;
                    const isFull = memCount >= 4;
                    return (
                      <option key={tg.id} value={tg.id} disabled={isFull}>
                        {tg.group_code} — {tg.title?.substring(0, 35)}... ({memCount}/4 members){isFull ? ' [FULL]' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-draft mt-1 font-medium">
                  Showing {filteredTransferGroups.length} available groups
                </p>
              </div>

              <div className="p-3 bg-paper rounded border border-rule space-y-2">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferMakeLeader}
                    onChange={(e) => setTransferMakeLeader(e.target.checked)}
                    className="w-4 h-4 rounded text-navy"
                  />
                  <span>Make this student the Team Leader in the destination group</span>
                </label>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 leading-relaxed">
                <span className="font-bold block mb-0.5">Transfer Notice:</span>
                Previous evaluation scores awarded to this student under the source group&apos;s panel assignments will be safely reset so the student can be newly evaluated with their new team.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingStudent || !transferTargetGroupId}
                  className="btn-primary py-2 px-5 text-xs font-bold bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50"
                >
                  {submittingStudent ? 'Transferring...' : 'Confirm Transfer →'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT GROUP DETAILS MODAL */}
      {editGroupModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-rule max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="border-b border-rule pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
                  {Icons.edit}
                  <span>Edit Project Group Details</span>
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Update group code: <strong className="text-navy">{editGroupModal.group_code}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setEditGroupModal(null)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Close">{Icons.close}</button>
            </div>

            <form onSubmit={handleSaveEditGroup} className="space-y-4 pt-1">
              <div>
                <label className="input-label mb-1 block">Preference 1 (Primary Topic) *</label>
                <textarea
                  required
                  rows={2}
                  value={editGroupForm.title}
                  onChange={(e) => setEditGroupForm({ ...editGroupForm, title: e.target.value })}
                  className="input-field text-xs font-medium"
                  placeholder="Primary project title..."
                />
              </div>

              <div>
                <label className="input-label mb-1 block">Preference 2 (Alternate Topic)</label>
                <textarea
                  rows={2}
                  value={editGroupForm.title_2}
                  onChange={(e) => setEditGroupForm({ ...editGroupForm, title_2: e.target.value })}
                  className="input-field text-xs font-medium"
                  placeholder="Second preference title..."
                />
              </div>

              <div>
                <label className="input-label mb-1 block">Preference 3 (Alternate Topic)</label>
                <textarea
                  rows={2}
                  value={editGroupForm.title_3}
                  onChange={(e) => setEditGroupForm({ ...editGroupForm, title_3: e.target.value })}
                  className="input-field text-xs font-medium"
                  placeholder="Third preference title..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label mb-1 block">Domain Name</label>
                  <input
                    type="text"
                    value={editGroupForm.domain}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, domain: e.target.value })}
                    className="input-field text-xs font-semibold"
                    placeholder="e.g. AI-ML, Cloud, IoT"
                  />
                </div>

                <div>
                  <label className="input-label mb-1 block">Division</label>
                  <select
                    value={editGroupForm.batch}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, batch: e.target.value })}
                    className="input-field text-xs font-semibold"
                  >
                    <option value="BE-1">BE-1</option>
                    <option value="BE-2">BE-2</option>
                    <option value="BE-3">BE-3</option>
                    <option value="BE-4">BE-4</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setEditGroupModal(null)}
                  className="px-4 py-2 border border-rule rounded text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGroupEdit}
                  className="btn-primary py-2 px-5 text-xs font-bold"
                >
                  {submittingGroupEdit ? 'Saving...' : 'Save Group Details'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* UNASSIGN ALL MENTORS MODAL */}
      {unassignMentorsModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-rule max-w-md w-full p-6 shadow-xl animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                  {Icons.trash}
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-ink">
                    Unassign All Mentors
                  </h3>
                  <p className="text-xs text-draft font-medium">Academic Year {academicYear}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnassignMentorsModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                {Icons.close}
              </button>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              Are you sure you want to remove panel mentors from project groups? Assigned project guides, student teams, and approved marks remain completely safe.
            </p>

            <div className="space-y-2.5 bg-paper p-3.5 rounded border border-rule text-xs">
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Choose Unassign Scope:
              </p>
              <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent has-[:checked]:border-navy/30 has-[:checked]:bg-blue-50/50">
                <input
                  type="radio"
                  name="unassignMentorsScope"
                  value="ALL"
                  checked={unassignMentorsScope === 'ALL'}
                  onChange={() => setUnassignMentorsScope('ALL')}
                  className="mt-0.5 text-navy"
                />
                <div>
                  <span className="font-semibold text-ink">All Evaluation Stages (AY {academicYear}) — Recommended</span>
                  <span className="block text-[11px] text-draft mt-0.5">
                    Completely resets mentor assignments across all stages and restores faculty to "Eligible Faculty" status.
                  </span>
                </div>
              </label>

              {panelMatrixStageId && (
                <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer border border-transparent has-[:checked]:border-navy/30 has-[:checked]:bg-blue-50/50 pt-2 border-t border-rule/60">
                  <input
                    type="radio"
                    name="unassignMentorsScope"
                    value="STAGE"
                    checked={unassignMentorsScope === 'STAGE'}
                    onChange={() => setUnassignMentorsScope('STAGE')}
                    className="mt-0.5 text-navy"
                  />
                  <div>
                    <span className="font-semibold text-ink">
                      Active Stage Only ({stages.find((s) => String(s.id) === String(panelMatrixStageId))?.name || `Stage #${panelMatrixStageId}`})
                    </span>
                    <span className="block text-[11px] text-draft mt-0.5">
                      Only unassigns mentors for this single stage. Mentors assigned to other stages will stay in "Panel Mentor" status.
                    </span>
                  </div>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-rule">
              <button
                type="button"
                onClick={() => setUnassignMentorsModal(false)}
                className="px-4 py-2 border border-rule rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllMentors}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                {submitting ? 'Unassigning...' : 'Confirm & Unassign Mentors'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FLOATING ACTION BAR FOR STAGED CHANGES */}
      {hasPendingChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/60 p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xl shrink-0">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-white">
                  {totalPendingCount} Staged Change{totalPendingCount > 1 ? 's' : ''} Ready
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Unsaved Draft
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5 flex-wrap">
                {pendingGuideCount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                    <span className="text-amber-400 font-bold">{pendingGuideCount}</span> Guide Designation{pendingGuideCount > 1 ? 's' : ''}
                  </span>
                )}
                {pendingGroupGuideCount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                    <span className="text-blue-400 font-bold">{pendingGroupGuideCount}</span> Group Guide{pendingGroupGuideCount > 1 ? 's' : ''}
                  </span>
                )}
                {pendingPanelCount > 0 && (
                  <span className="inline-flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                    <span className="text-purple-400 font-bold">{pendingPanelCount}</span> Mentor Assignment{pendingPanelCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setShowChangesModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors flex items-center gap-1.5"
            >
              <span>Review Changes</span>
              <span className="bg-slate-700 text-amber-300 px-1.5 py-0.5 rounded font-mono text-[10px]">
                {totalPendingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={handleDiscardAllChanges}
              disabled={applyingBatch}
              className="px-3 py-2 text-xs font-semibold rounded-lg text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 border border-rose-800/60 transition-colors"
            >
              Discard All
            </button>
            <button
              type="button"
              onClick={handleApplyAllChanges}
              disabled={applyingBatch}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {applyingBatch ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <span>✓ Apply Changes to Database</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* REVIEW STAGED CHANGES MODAL */}
      {showChangesModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-rule max-w-3xl w-full shadow-2xl animate-fade-in flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-rule bg-slate-50/70 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl shrink-0 border border-amber-300">
                  ⚡
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-ink">
                    Review Staged Governance Changes
                  </h3>
                  <p className="text-xs text-draft">
                    {totalPendingCount} pending modification{totalPendingCount > 1 ? 's' : ''} across Academic Year {academicYear}. These have not yet been written to the database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title="Close"
              >
                {Icons.close}
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Section 1: Guide Designations */}
              {pendingGuideCount > 0 && (
                <div className="border border-rule rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-amber-50/70 px-4 py-2.5 border-b border-amber-200/60 flex items-center justify-between">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                      <span>⚡</span> Faculty Guide Designations ({pendingGuideCount})
                    </span>
                    <span className="text-[11px] text-amber-800 font-medium">Faculty Overview</span>
                  </div>
                  <div className="divide-y divide-rule">
                    {Object.entries(pendingChanges.guideDesignations).map(([facId, isGuide]) => {
                      const fac = allDepartmentFaculty.find((f) => Number(f.faculty_id || f.id) === Number(facId)) ||
                        dashboardData?.faculty_load?.find((f) => Number(f.faculty_id) === Number(facId));
                      return (
                        <div key={facId} className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                          <div className="truncate">
                            <div className="font-bold text-ink text-sm truncate">{fac?.name || `Faculty #${facId}`}</div>
                            <div className="text-draft text-[11px] truncate">
                              {fac?.designation || 'Faculty'} {fac?.employee_id ? `• ID: ${fac.employee_id}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                              isGuide
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}>
                              {isGuide ? '+ Designate as Guide' : '- Remove Guide Status'}
                            </span>
                            <button
                              type="button"
                              onClick={() => revertGuideDesignation(Number(facId))}
                              className="px-2 py-1 rounded text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-medium border border-rule transition-colors"
                              title="Revert this change"
                            >
                              Undo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2: Group Guides */}
              {pendingGroupGuideCount > 0 && (
                <div className="border border-rule rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-blue-50/70 px-4 py-2.5 border-b border-blue-200/60 flex items-center justify-between">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                      <span>⚡</span> Project Group Guide Assignments ({pendingGroupGuideCount})
                    </span>
                    <span className="text-[11px] text-blue-800 font-medium">Groups Table</span>
                  </div>
                  <div className="divide-y divide-rule">
                    {Object.entries(pendingChanges.groupGuides).map(([grpId, data]) => {
                      const grp = groups.find((g) => Number(g.id) === Number(grpId));
                      return (
                        <div key={grpId} className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                          <div className="truncate">
                            <div className="font-bold text-ink text-sm flex items-center gap-2 truncate">
                              <span className="font-mono text-navy font-bold">{grp?.group_code || `Group #${grpId}`}</span>
                              <span className="text-draft font-normal truncate">— {grp?.title || 'No Title'}</span>
                            </div>
                            <div className="text-draft text-[11px] mt-0.5">
                              Previous: <span className="text-slate-700 font-medium">{grp?.guide_name || 'None'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                              data.guide_id
                                ? 'bg-blue-50 text-blue-900 border-blue-300'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}>
                              {data.guide_name ? `→ ${data.guide_name}` : '→ Unassigned'}
                            </span>
                            <button
                              type="button"
                              onClick={() => revertGroupGuide(Number(grpId))}
                              className="px-2 py-1 rounded text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-medium border border-rule transition-colors"
                              title="Revert this change"
                            >
                              Undo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3: Panel Mentors */}
              {pendingPanelCount > 0 && (
                <div className="border border-rule rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-purple-50/70 px-4 py-2.5 border-b border-purple-200/60 flex items-center justify-between">
                    <span className="font-bold text-purple-950 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                      <span>⚡</span> Panel Mentor Assignments ({pendingPanelCount})
                    </span>
                    <span className="text-[11px] text-purple-800 font-medium">Evaluation Stages</span>
                  </div>
                  <div className="divide-y divide-rule">
                    {Object.entries(pendingChanges.panelAssignments).map(([key, item]) => {
                      const grp = groups.find((g) => Number(g.id) === Number(item.group_id));
                      const stg = stages.find((s) => Number(s.id) === Number(item.stage_id));
                      const mentorNames = (item.panel_members || []).map((m) => m.name).join(', ');
                      const originalMentors = (baseGroupPanelistsMap[item.group_id] || []).map((m) => m.name).join(', ');

                      return (
                        <div key={key} className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                          <div className="truncate">
                            <div className="font-bold text-ink text-sm flex items-center gap-2 truncate">
                              <span className="font-mono text-purple-900 font-bold">{grp?.group_code || `Group #${item.group_id}`}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-rule text-slate-700">
                                {stg?.name || `Stage #${item.stage_id}`}
                              </span>
                            </div>
                            <div className="text-draft text-[11px] mt-0.5 truncate">
                              Previous: <span className="text-slate-700 font-medium">{originalMentors || 'None'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 max-w-[45%]">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border truncate ${
                              item.panel_member_ids?.length > 0
                                ? 'bg-purple-50 text-purple-900 border-purple-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}>
                              {mentorNames ? `→ ${mentorNames}` : '→ Unassigned'}
                            </span>
                            <button
                              type="button"
                              onClick={() => revertPanelAssignment(key)}
                              className="px-2 py-1 rounded text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-medium border border-rule transition-colors shrink-0"
                              title="Revert this change"
                            >
                              Undo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 px-5 border-t border-rule bg-slate-50/70 rounded-b-2xl">
              <button
                type="button"
                onClick={handleDiscardAllChanges}
                disabled={applyingBatch}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 rounded-lg border border-rose-200 transition-colors"
              >
                Discard All Changes
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="px-4 py-2 border border-rule rounded-lg text-xs font-semibold hover:bg-white transition-colors"
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  onClick={handleApplyAllChanges}
                  disabled={applyingBatch || totalPendingCount === 0}
                  className="btn-primary py-2 px-5 text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  {applyingBatch ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <span>✓ Apply Changes to Database</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
