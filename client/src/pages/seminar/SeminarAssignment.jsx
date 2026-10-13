import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const StepBar = ({ current = 1 }) => {
  const steps = ['1. Submissions & Validation', '2. Guide Assignment', '3. Review & Final Export'];
  return (
    <ol className="flex items-center gap-0 mb-6 select-none overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center shrink-0">
            <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              active ? 'bg-[var(--navy)] text-white shadow-xs' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-[var(--ink)]/50'
            }`}>
              {done && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-[var(--rule)] mx-2" />}
          </li>
        );
      })}
    </ol>
  );
};

export default function SeminarAssignment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession]         = useState(null);
  const [groups, setGroups]           = useState([]);
  const [guides, setGuides]           = useState([]);
  const [allFaculty, setAllFaculty]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [publishing, setPublishing]   = useState(false);
  
  // UI control states
  const [searchQuery, setSearchQuery]                 = useState('');
  const [filterTab, setFilterTab]                     = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [viewMode, setViewMode]                       = useState('compact'); // 'compact' | 'expanded'
  const [selectedTopicsGroup, setSelectedTopicsGroup] = useState(null);
  const [guideFilter, setGuideFilter]                 = useState('');
  const [selectedGuideFilter, setSelectedGuideFilter] = useState('');
  const [showSummaryModal, setShowSummaryModal]       = useState(false);

  const [showCustomGuide, setShowCustomGuide] = useState(false);
  const [customName, setCustomName]           = useState('');
  const [customDesig, setCustomDesig]         = useState('');
  const [customQuota, setCustomQuota]         = useState(4);
  const [addingGuide, setAddingGuide]         = useState(false);

  const load = useCallback(async () => {
    try {
      const [sessR, grpR, guiR, facR] = await Promise.all([
        api.get(`/seminar/sessions/${id}`),
        api.get(`/seminar/sessions/${id}/assignments`),
        api.get(`/seminar/sessions/${id}/guides`),
        api.get('/seminar/faculty-list'),
      ]);
      setSession(sessR.data.session);
      setGroups(grpR.data.groups || []);
      setGuides(guiR.data.guides || []);
      setAllFaculty(facR.data.faculty || []);
    } catch {
      toast.error('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Robust guide resolver for a group
  const getAssignedGuide = useCallback((g) => {
    if (!g) return null;
    // 1. By seminar_guide_id
    if (g.seminar_guide_id) {
      const match = guides.find(gui => String(gui.id) === String(g.seminar_guide_id));
      if (match) return match;
    }
    // 2. By guide_id (which could match seminar_guides.id OR faculty_id)
    if (g.guide_id) {
      const match = guides.find(gui => String(gui.id) === String(g.guide_id) || (gui.faculty_id && String(gui.faculty_id) === String(g.guide_id)));
      if (match) return match;
    }
    // 3. By faculty_id
    if (g.faculty_id) {
      const match = guides.find(gui => gui.faculty_id && String(gui.faculty_id) === String(g.faculty_id));
      if (match) return match;
    }
    // 4. By guide_name
    if (g.guide_name && g.guide_name !== 'Unassigned' && g.guide_name !== 'Unknown Guide') {
      const match = guides.find(gui => gui.faculty_name && gui.faculty_name.trim().toLowerCase() === g.guide_name.trim().toLowerCase());
      if (match) return match;
    }
    return null;
  }, [guides]);

  const isGroupAssigned = useCallback((g) => {
    return Boolean(getAssignedGuide(g) || (g.guide_name && g.guide_name !== 'Unassigned' && g.guide_name !== 'Unknown Guide'));
  }, [getAssignedGuide]);

  // Derived metrics
  const guideCounts = useMemo(() => {
    const counts = {};
    groups.forEach(g => {
      const assigned = getAssignedGuide(g);
      if (assigned) {
        counts[assigned.id] = (counts[assigned.id] || 0) + 1;
      }
    });
    return counts;
  }, [groups, getAssignedGuide]);

  // Map of guideId -> array of assigned groups
  const guideAssignedGroupsMap = useMemo(() => {
    const map = {};
    guides.forEach(g => { map[g.id] = []; });
    groups.forEach(group => {
      const assigned = getAssignedGuide(group);
      if (assigned && map[assigned.id]) {
        map[assigned.id].push(group);
      }
    });
    return map;
  }, [guides, groups, getAssignedGuide]);

  const totalQuota = guides.reduce((s, g) => s + (g.quota || 0), 0);
  const assignedGroupsCount = groups.filter(isGroupAssigned).length;
  const unassigned = groups.length - assignedGroupsCount;
  const percentAssigned = groups.length > 0 ? Math.round((assignedGroupsCount / groups.length) * 100) : 0;

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const hasGuide = isGroupAssigned(g);
      if (filterTab === 'unassigned' && hasGuide) return false;
      if (filterTab === 'assigned' && !hasGuide) return false;

      const assigned = getAssignedGuide(g);
      if (selectedGuideFilter) {
        if (!assigned || String(assigned.id) !== String(selectedGuideFilter)) {
          return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNo = String(g.group_no).includes(q);
      const matchDomain = g.domain?.toLowerCase().includes(q);
      const matchGuide = (g.guide_name?.toLowerCase().includes(q) || assigned?.faculty_name?.toLowerCase().includes(q));
      const matchMember = (g.members || []).some(m =>
        (m.name || m.student_name)?.toLowerCase().includes(q) ||
        m.prn?.toLowerCase().includes(q) ||
        m.topic1?.toLowerCase().includes(q) ||
        m.topic2?.toLowerCase().includes(q) ||
        m.topic3?.toLowerCase().includes(q)
      );
      return matchNo || matchDomain || matchGuide || matchMember;
    });
  }, [groups, filterTab, selectedGuideFilter, searchQuery, isGroupAssigned, getAssignedGuide]);

  // Guide handlers
  const handleAddGuide = async (facultyId) => {
    if (!facultyId) return;
    if (guides.find(g => String(g.faculty_id) === String(facultyId))) return toast.error('Already added');
    try {
      await api.post(`/seminar/sessions/${id}/guides`, { faculty_id: facultyId, quota: 4, display_order: guides.length + 1 });
      await load();
      toast.success('Guide added');
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); }
  };

  const handleAddCustomGuide = async (e) => {
    if (e) e.preventDefault();
    if (!customName.trim()) return toast.error('Please enter a guide name');
    setAddingGuide(true);
    try {
      await api.post(`/seminar/sessions/${id}/guides`, {
        guide_name: customName.trim(),
        designation: customDesig.trim() || 'Faculty Guide',
        quota: parseInt(customQuota, 10) || 4,
        display_order: guides.length + 1,
      });
      setCustomName('');
      setCustomDesig('');
      setCustomQuota(4);
      setShowCustomGuide(false);
      await load();
      toast.success('Guide added');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add guide');
    } finally {
      setAddingGuide(false);
    }
  };

  const handleQuotaChange = async (guideId, newQuota) => {
    const q = parseInt(newQuota, 10);
    if (isNaN(q) || q < 0) return;
    try {
      await api.patch(`/seminar/sessions/${id}/guides/${guideId}`, { quota: q });
      setGuides(prev => prev.map(x => x.id === guideId ? { ...x, quota: q } : x));
    } catch { toast.error('Failed to update quota'); }
  };

  const handleRemoveGuide = async (guideId) => {
    try {
      await api.delete(`/seminar/sessions/${id}/guides/${guideId}`);
      setGuides(prev => prev.filter(g => g.id !== guideId));
      toast.success('Guide removed');
    } catch { toast.error('Failed to remove guide'); }
  };

  // Auto-load all active department faculty
  const handleLoadAllFaculty = async () => {
    if (!allFaculty || allFaculty.length === 0) {
      toast.error('No registered department faculty found.');
      return;
    }
    const toastId = toast.loading('Adding all faculty to guide roster...');
    try {
      const quotaPerFaculty = Math.max(4, Math.ceil((groups.length || 20) / (allFaculty.length || 1)));
      // Filter out faculty already added to this session
      const existingFacultyIds = new Set(guides.map(g => g.faculty_id).filter(Boolean));
      const toAdd = allFaculty.filter(f => !existingFacultyIds.has(f.id));

      if (toAdd.length === 0) {
        toast.dismiss(toastId);
        toast.info('All registered faculty are already in the guide roster.');
        return;
      }

      // Add each missing faculty using the proven /guides endpoint
      let added = 0;
      for (const fac of toAdd) {
        try {
          await api.post(`/seminar/sessions/${id}/guides`, {
            faculty_id: fac.id,
            quota: quotaPerFaculty,
          });
          added++;
        } catch (e) {
          console.warn('Failed adding guide:', fac.name, e);
        }
      }

      toast.dismiss(toastId);
      toast.success(`Successfully added ${added} faculty to the session guide roster!`);
      await load();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.response?.data?.error || 'Failed to add department faculty');
    }
  };

  // Unassign all groups in session
  const handleUnassignAll = async () => {
    if (!window.confirm('Are you sure you want to unassign guides from all groups in this session? This will clear all current guide allocations.')) return;
    try {
      try {
        await api.post(`/seminar/sessions/${id}/unassign-all`);
      } catch {
        await Promise.allSettled(
          groups.filter(isGroupAssigned).map(g => api.patch(`/seminar/sessions/${id}/assignments/${g.id}`, { guide_id: null }))
        );
      }
      toast.success('All groups have been unassigned!');
      await load();
    } catch {
      toast.error('Failed to unassign groups');
    }
  };

  // Auto-assign strictly unassigned groups
  const handleAutoAssign = async () => {
    const unassignedGroups = groups.filter(g => !isGroupAssigned(g));
    if (unassignedGroups.length === 0) {
      toast.info('All groups are already assigned to guides!');
      return;
    }
    if (guides.length === 0) {
      toast.error('No faculty guides in roster. Please add guides first!');
      return;
    }

    setAutoRunning(true);
    try {
      // 1. Try server-side auto-assign
      try {
        const { data } = await api.post(`/seminar/sessions/${id}/assign`, { confirm: true });
        if (data.assigned > 0) {
          toast.success(`Successfully assigned ${data.assigned} unassigned group(s)! Existing assignments kept.`);
          setFilterTab('all');
          setSelectedGuideFilter('');
          await load();
          return;
        }
      } catch (serverErr) {
        console.warn('Server auto-assign failed, switching to direct assignment fallback:', serverErr);
      }

      // 2. Resilient Fallback: Sequentially assign remaining unassigned groups using PATCH
      // Build available slot queue based on remaining capacity of each guide
      const slotQueue = [];
      guides.forEach(g => {
        const curLoad = (guideCounts[g.id] || 0);
        const q = g.quota || 4;
        const remaining = Math.max(0, q - curLoad);
        for (let s = 0; s < remaining; s++) {
          slotQueue.push(g);
        }
      });

      // If available slots are less than unassigned groups, round-robin expand across all guides
      let guideIndex = 0;
      while (slotQueue.length < unassignedGroups.length && guides.length > 0) {
        slotQueue.push(guides[guideIndex % guides.length]);
        guideIndex++;
      }

      let assignedCount = 0;
      for (let i = 0; i < unassignedGroups.length; i++) {
        if (i >= slotQueue.length) break;
        const grp = unassignedGroups[i];
        const assignedGuide = slotQueue[i];
        try {
          await api.patch(`/seminar/sessions/${id}/assignments/${grp.id}`, { guide_id: assignedGuide.id });
          assignedCount++;
        } catch (reassignErr) {
          console.error('Failed to assign group', grp.group_no, reassignErr);
        }
      }

      if (assignedCount > 0) {
        toast.success(`Successfully assigned ${assignedCount} unassigned group(s)! Existing assignments kept.`);
      } else {
        toast.error('Auto-assign failed to assign groups.');
      }
      setFilterTab('all');
      setSelectedGuideFilter('');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Auto-assign failed');
    } finally {
      setAutoRunning(false);
    }
  };

  // Revert / Depublish session
  const handleUnpublish = async () => {
    if (!window.confirm('Depublish this session to draft? Group responses and members will be kept so you can test.')) return;
    try {
      await api.post(`/seminar/sessions/${id}/publish`, { publish: false });
      toast.success('Session depublished to draft! Group responses are kept.');
      await load();
    } catch {
      toast.error('Failed to depublish session');
    }
  };

  // Manual reassign
  const handleReassign = async (groupId, guideId) => {
    try {
      const res = await api.patch(`/seminar/sessions/${id}/assignments/${groupId}`, { guide_id: guideId || null });
      const parsedGuideId = guideId ? parseInt(guideId, 10) : null;
      const guide = parsedGuideId ? guides.find(x => x.id === parsedGuideId) : null;
      setGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          seminar_guide_id: parsedGuideId,
          guide_id: parsedGuideId,
          faculty_id: guide?.faculty_id || null,
          guide_name: guide?.faculty_name || res.data?.guide_name || null,
        };
      }));
      toast.success(guideId ? 'Guide assigned' : 'Guide unassigned');
    } catch { toast.error('Reassignment failed'); }
  };

  // Submit to HOD
  const handleSubmitToHOD = async () => {
    const groupsToSubmit = groups.filter(g => (g.seminar_guide_id || g.guide_id) && g.status === 'PENDING_GUIDE_ASSIGNMENT');
    if (groupsToSubmit.length === 0) return toast.error('No new assignments to submit');
    if (!window.confirm(`Submit ${groupsToSubmit.length} assignment(s) for HOD approval?`)) return;
    
    try {
      await api.post(`/seminar/sessions/${id}/submit-approvals`, { groupIds: groupsToSubmit.map(g => g.id) });
      toast.success('Assignments submitted for HOD approval');
      await load();
    } catch (err) { toast.error(err?.response?.data?.error || 'Submission failed'); }
  };

  // Publish
  const handlePublish = async () => {
    if (unassigned > 0) return toast.error(`${unassigned} group(s) still unassigned`);
    if (!window.confirm('Publish this session? Guide assignments will be locked and visible to all assigned guides.')) return;
    setPublishing(true);
    try {
      await api.post(`/seminar/sessions/${id}/publish`);
      toast.success('Session published!');
      navigate(`/faculty/seminar/${id}/review`);
    } catch (err) { toast.error(err?.response?.data?.error || 'Publish failed'); }
    finally { setPublishing(false); }
  };

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading seminar assignments…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top-Left Back Button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          id="btn-back-step"
          onClick={() => navigate(`/faculty/seminar/${id}/upload`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--navy)] bg-white hover:bg-slate-100 border border-[var(--rule)] rounded-md transition-colors focus:outline-hidden focus:ring-2 focus:ring-[var(--navy)] shadow-xs"
          aria-label="Back to Step 1: Submissions & Validation"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-[var(--ink)]/50">
          <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">Sessions</Link>
          <span>/</span>
          <span className="text-[var(--ink)]/80 font-medium truncate">{session?.name}</span>
          <span>/</span>
          <span>Step 2: Guide Assignment</span>
        </div>
      </div>

      <StepBar current={1} />

      {/* Header and Actions */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
              session?.status === 'PUBLISHED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {session?.status === 'PUBLISHED' ? 'Published' : 'Draft / Setup'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">Guide Assignment</h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            Review student seminar topics and assign faculty guides based on domain expertise and quotas.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            id="btn-allocation-summary"
            onClick={() => setShowSummaryModal(true)}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="View complete list of which guide is assigned to which groups"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Allocation Matrix ({assignedGroupsCount}/{groups.length})</span>
          </button>
          {assignedGroupsCount > 0 && (
            <button
              type="button"
              id="btn-unassign-all"
              onClick={handleUnassignAll}
              className="px-3 py-2 text-xs font-semibold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Clear all guide assignments across all groups"
            >
              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Unassign All</span>
            </button>
          )}
          <button
            type="button"
            id="btn-auto-assign"
            onClick={handleAutoAssign}
            disabled={autoRunning}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer ${
              unassigned > 0
                ? 'bg-[var(--navy)] text-white hover:bg-[#2a3d7a]'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="Auto-assign faculty guides to unassigned groups only (keeps existing assignments)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span>{autoRunning ? 'Assigning…' : unassigned > 0 ? `Auto-Assign Unassigned (${unassigned})` : `All Assigned (${assignedGroupsCount}/${groups.length})`}</span>
          </button>
          <button
            type="button"
            onClick={handleSubmitToHOD}
            className="px-3.5 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-2xs"
          >
            Submit for HOD Approval
          </button>
          {session?.status === 'PUBLISHED' ? (
            <button
              type="button"
              onClick={handleUnpublish}
              className="px-3.5 py-2 border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs font-bold rounded-md transition-colors shadow-2xs"
            >
              Revert to Draft (Depublish)
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || unassigned > 0}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {publishing ? 'Publishing…' : 'Publish & Finalize →'}
            </button>
          )}
        </div>
      </div>

      {/* Allocation Metrics Bar */}
      <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div>
          <span className="text-[11px] font-semibold text-[var(--ink)]/60 uppercase tracking-wider">Allocation Progress</span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold text-[var(--navy)] font-mono">{assignedGroupsCount}</span>
            <span className="text-xs text-[var(--ink)]/50">of {groups.length} groups assigned</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${percentAssigned === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${percentAssigned}%` }}
            />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--ink)]/60 uppercase tracking-wider">Unassigned Groups</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xl font-bold font-mono ${unassigned > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {unassigned}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${unassigned > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'}`}>
              {unassigned === 0 ? 'All Assigned' : 'Action Needed'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--ink)]/60 uppercase tracking-wider">Total Guide Capacity</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-[var(--navy)] font-mono">{totalQuota}</span>
            <span className="text-xs text-[var(--ink)]/50">slots across {guides.length} guides</span>
          </div>
          {totalQuota < groups.length && (
            <p className="text-[10px] text-red-600 font-medium mt-0.5">
              Shortage: Need +{groups.length - totalQuota} quota slots
            </p>
          )}
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--ink)]/60 uppercase tracking-wider">Topics Status</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-emerald-700 font-mono">100%</span>
            <span className="text-xs text-slate-600 font-medium">Ready for review</span>
          </div>
        </div>
      </div>

      {/* Main Content: 2-Column Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Left: Faculty Guides Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-[var(--rule)] bg-slate-50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--navy)]">Faculty Guides</h3>
                <p className="text-[10px] text-[var(--ink)]/50">{guides.length} active roster</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  id="sidebar-btn-add-all-faculty"
                  onClick={handleLoadAllFaculty}
                  className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer flex items-center gap-1"
                  title="Add all active department faculty members to the guide roster"
                >
                  <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add All Faculty</span>
                </button>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded border border-blue-200">
                  {assignedGroupsCount}/{totalQuota} used
                </span>
              </div>
            </div>

            {/* Guide Quick Search */}
            {guides.length > 5 && (
              <div className="p-2 border-b border-[var(--rule)] bg-white">
                <input
                  type="text"
                  placeholder="Filter guide roster..."
                  value={guideFilter}
                  onChange={(e) => setGuideFilter(e.target.value)}
                  className="w-full text-xs py-1 px-2.5 border border-[var(--rule)] rounded bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <div className="divide-y divide-[var(--rule)] max-h-[460px] overflow-y-auto">
              {guides
                .filter(g => !guideFilter.trim() || g.faculty_name.toLowerCase().includes(guideFilter.toLowerCase()))
                .map(g => {
                  const assigned = guideCounts[g.id] || 0;
                  const assignedGroups = guideAssignedGroupsMap[g.id] || [];
                  const isFull = assigned >= g.quota;
                  const isOver = assigned > g.quota;

                  return (
                    <div
                      key={g.id}
                      className={`p-3 transition-colors ${
                        selectedGuideFilter === String(g.id)
                          ? 'bg-blue-50/70 border-l-4 border-l-[var(--navy)]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[var(--ink)] truncate" title={g.faculty_name}>
                            {g.faculty_name}
                          </p>
                          <p className="text-[10px] text-[var(--ink)]/50 truncate">{g.designation || 'Faculty'}</p>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 border ${
                          isOver ? 'bg-red-100 text-red-800 border-red-300' :
                          isFull ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {assigned}/{g.quota} {isFull ? 'FULL' : ''}
                        </span>
                      </div>

                      {/* Assigned Groups Chips */}
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">Assigned Groups ({assignedGroups.length}):</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGuideFilter(prev => prev === String(g.id) ? '' : String(g.id));
                              setFilterTab('all');
                            }}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                              selectedGuideFilter === String(g.id)
                                ? 'bg-[var(--navy)] text-white'
                                : 'text-blue-700 hover:bg-blue-100 bg-blue-50/60'
                            }`}
                          >
                            {selectedGuideFilter === String(g.id) ? 'Showing Only' : 'Filter Table'}
                          </button>
                        </div>
                        {assignedGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedGroups.map(grp => (
                              <button
                                key={grp.id}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(String(grp.group_no));
                                  setFilterTab('all');
                                }}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-colors"
                                title={`Click to view Group #${grp.group_no} (${grp.domain})`}
                              >
                                #{grp.group_no}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-amber-700 italic">None assigned yet</p>
                        )}
                      </div>

                      {/* Quota Stepper & Delete */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--ink)]/60 font-medium">Quota:</span>
                          <button
                            type="button"
                            onClick={() => handleQuotaChange(g.id, Math.max(0, g.quota - 1))}
                            className="w-5 h-5 flex items-center justify-center rounded border border-[var(--rule)] bg-white text-slate-600 hover:bg-slate-100 font-bold"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-xs px-1 min-w-[20px] text-center">{g.quota}</span>
                          <button
                            type="button"
                            onClick={() => handleQuotaChange(g.id, g.quota + 1)}
                            className="w-5 h-5 flex items-center justify-center rounded border border-[var(--rule)] bg-white text-slate-600 hover:bg-slate-100 font-bold"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuide(g.id)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              {guides.length === 0 && <p className="p-4 text-xs text-[var(--ink)]/40 text-center">No guides added yet.</p>}
            </div>

            {/* Add Guide Section */}
            <div className="p-3 border-t border-[var(--rule)] bg-slate-50 space-y-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCustomGuide(false)}
                  className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${!showCustomGuide ? 'bg-[var(--navy)] text-white' : 'bg-white text-slate-600 border border-[var(--rule)]'}`}
                >
                  Select Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomGuide(true)}
                  className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${showCustomGuide ? 'bg-[var(--navy)] text-white' : 'bg-white text-slate-600 border border-[var(--rule)]'}`}
                >
                  + Custom Name
                </button>
              </div>

              {!showCustomGuide ? (
                <div className="space-y-1.5">
                  <select
                    onChange={e => { handleAddGuide(e.target.value); e.target.value = ''; }}
                    defaultValue=""
                    className="w-full border border-[var(--rule)] rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none"
                  >
                    <option value="">Select registered faculty…</option>
                    {allFaculty.filter(f => !guides.find(g => g.faculty_id === f.id)).map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleLoadAllFaculty}
                    className="w-full py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Add all registered department faculty members to the guide roster"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Add All Faculty ({allFaculty.length || 'All'} available)</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddCustomGuide} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Guide Name (e.g. Dr. S. K. Wagh)"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full border border-[var(--rule)] rounded px-2 py-1 text-xs bg-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Designation"
                      value={customDesig}
                      onChange={e => setCustomDesig(e.target.value)}
                      className="flex-1 border border-[var(--rule)] rounded px-2 py-1 text-xs bg-white"
                    />
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customQuota}
                      onChange={e => setCustomQuota(e.target.value)}
                      className="w-12 border border-[var(--rule)] rounded px-1 text-xs text-center bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={addingGuide || !customName.trim()}
                    className="w-full py-1 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a] disabled:opacity-50"
                  >
                    Add Guide
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right: Groups Table with Topics */}
        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          {/* Table Header Bar */}
          <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterTab === 'all'
                    ? 'bg-[var(--navy)] text-white shadow-2xs'
                    : 'bg-white border border-[var(--rule)] text-slate-700 hover:bg-slate-100'
                }`}
              >
                All ({groups.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('unassigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterTab === 'unassigned'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white border border-[var(--rule)] text-amber-900 hover:bg-amber-50'
                }`}
              >
                Unassigned ({unassigned})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('assigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterTab === 'assigned'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white border border-[var(--rule)] text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                Assigned ({assignedGroupsCount})
              </button>
            </div>

            {/* Search, Guide Filter & Layout View Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter by Guide Selector */}
              <div className="flex items-center gap-1">
                <select
                  value={selectedGuideFilter}
                  onChange={e => setSelectedGuideFilter(e.target.value)}
                  className="border border-[var(--rule)] rounded-md px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 font-medium cursor-pointer"
                  title="Filter groups by assigned guide"
                >
                  <option value="">All Guides ({guides.length})</option>
                  {guides.map(guide => {
                    const count = guideCounts[guide.id] || 0;
                    return (
                      <option key={guide.id} value={guide.id}>
                        {guide.faculty_name} ({count} assigned)
                      </option>
                    );
                  })}
                </select>
                {selectedGuideFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedGuideFilter('')}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded"
                    title="Clear guide filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="w-48">
                <input
                  type="text"
                  placeholder="Search group, student..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full border border-[var(--rule)] rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-md border border-[var(--rule)] bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('compact')}
                  className={`px-2 py-1 rounded font-medium transition-colors ${viewMode === 'compact' ? 'bg-slate-200 text-[var(--navy)] font-bold' : 'text-slate-600 hover:text-black'}`}
                  title="Compact single-row view"
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('expanded')}
                  className={`px-2 py-1 rounded font-medium transition-colors ${viewMode === 'expanded' ? 'bg-slate-200 text-[var(--navy)] font-bold' : 'text-slate-600 hover:text-black'}`}
                  title="Expanded topics view"
                >
                  Detailed Topics
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[68vh]">
            <table className="w-full text-xs text-left">
              <thead className="sticky top-0 bg-[#EEF0F7] z-10 font-semibold text-[var(--navy)] border-b border-[var(--rule)]">
                <tr>
                  <th className="p-3 w-16 text-center">Group</th>
                  <th className="p-3 w-36">Domain</th>
                  <th className="p-3 w-48">Team Members</th>
                  <th className="p-3 min-w-[280px]">Student Seminar Topics</th>
                  <th className="p-3 w-64 text-right">Assigned Guide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {filteredGroups.map(g => {
                  const members = g.members || [];
                  const assignedGuide = getAssignedGuide(g);
                  const isAssigned = Boolean(assignedGuide || (g.guide_name && g.guide_name !== 'Unassigned' && g.guide_name !== 'Unknown Guide'));
                  const leader = members.find(m => m.is_leader) || members[0];
                  const currentGuideName = assignedGuide?.faculty_name || (g.guide_name && g.guide_name !== 'Unassigned' ? g.guide_name : null);
                  const currentGuideDesig = assignedGuide?.designation || g.guide_designation || 'Faculty Guide';

                  return (
                    <tr
                      key={g.id}
                      className={`transition-colors ${!isAssigned ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/70'}`}
                    >
                      {/* Group No. */}
                      <td className="p-3 text-center align-top">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-[var(--navy)] border border-slate-300 px-2 py-0.5 rounded block">
                          #{g.group_no}
                        </span>
                        {isAssigned ? (
                          <span
                            className="inline-block mt-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded"
                            title={`Assigned to ${currentGuideName}`}
                          >
                            ✓ Assigned
                          </span>
                        ) : (
                          <span className="inline-block mt-1 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Domain */}
                      <td className="p-3 align-top">
                        <div className="font-bold text-[var(--ink)]">{g.domain}</div>
                        <div className="mt-1">
                          {isGroupAssigned(g) && g.status === 'APPROVED' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              APPROVED
                            </span>
                          ) : isGroupAssigned(g) && g.status === 'AWAITING_HOD_APPROVAL' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                              WAITING HOD
                            </span>
                          ) : isGroupAssigned(g) ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                              PENDING HOD
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              UNASSIGNED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Members */}
                      <td className="p-3 align-top">
                        <div className="space-y-1">
                          {members.map(m => (
                            <div key={m.prn || m.name} className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-medium text-[var(--ink)] truncate max-w-[120px]">
                                {m.name || m.student_name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                {m.prn}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Student Seminar Topics */}
                      <td className="p-3 align-top">
                        {viewMode === 'compact' ? (
                          (() => {
                            const topicText = leader?.topic1 || members.find(m => m.topic1)?.topic1;
                            return topicText ? (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedTopicsGroup(g)}
                                className="p-1.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded cursor-pointer transition-colors text-[11px] group"
                                title="Click to view all student topic details"
                              >
                                <div className="text-slate-800 font-medium truncate max-w-[220px]" title={topicText}>
                                  {topicText}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                                  <span>{members.length} students</span>
                                  <span className="text-blue-600 font-semibold group-hover:underline">Details ↗</span>
                                </div>
                              </div>
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedTopicsGroup(g)}
                                className="p-1.5 bg-slate-50 hover:bg-blue-50/50 border border-dashed border-slate-200 hover:border-blue-300 rounded cursor-pointer text-slate-400 italic text-[11px] flex items-center justify-between"
                                title="Click to inspect group details"
                              >
                                <span>No topics submitted</span>
                                <span className="text-blue-600 text-[10px] not-italic font-semibold">View ↗</span>
                              </div>
                            );
                          })()
                        ) : (
                          /* Detailed View: Render individual cards inline */
                          <div className="space-y-2">
                            {members.map((m, mi) => (
                              <div key={m.prn || mi} className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] space-y-1 shadow-2xs">
                                <div className="flex items-center justify-between text-[10px] font-bold border-b border-slate-200 pb-1">
                                  <span className="text-[var(--navy)]">{m.name || m.student_name}</span>
                                  <span className="font-mono text-slate-400">{m.prn}</span>
                                </div>
                                {m.topic1 && (
                                  <div className="truncate text-slate-800" title={m.topic1}>
                                    <span className="font-bold text-amber-800 text-[10px]">T1:</span> {m.topic1}
                                  </div>
                                )}
                                {m.topic2 && (
                                  <div className="truncate text-slate-600" title={m.topic2}>
                                    <span className="font-semibold text-slate-500 text-[10px]">T2:</span> {m.topic2}
                                  </div>
                                )}
                                {m.topic3 && (
                                  <div className="truncate text-slate-600" title={m.topic3}>
                                    <span className="font-semibold text-slate-500 text-[10px]">T3:</span> {m.topic3}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Assigned Guide Column */}
                      <td className="p-3 align-top min-w-[220px]">
                        {isAssigned && currentGuideName ? (
                          <div className="space-y-1.5 bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-700 text-white shadow-2xs">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Assigned Guide
                              </span>
                              {assignedGuide?.quota != null && (
                                <span className="text-[10px] font-mono text-emerald-900 font-bold bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                                  Load: {guideCounts[assignedGuide.id] || 0}/{assignedGuide.quota}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-[var(--navy)] leading-snug">
                                {currentGuideName}
                              </p>
                              <p className="text-[10px] text-slate-600">
                                {currentGuideDesig}
                              </p>
                            </div>
                            <div className="pt-1.5 border-t border-emerald-200/80">
                              <select
                                value={assignedGuide?.id || g.seminar_guide_id || ''}
                                onChange={e => handleReassign(g.id, e.target.value)}
                                className="w-full border border-emerald-300 rounded px-2 py-1 text-[11px] bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                                title="Change or reassign guide"
                              >
                                <option value="">— Reassign Guide —</option>
                                {guides.map(guide => {
                                  const count = guideCounts[guide.id] || 0;
                                  const full = count >= guide.quota && guide.id !== assignedGuide?.id;
                                  return (
                                    <option key={guide.id} value={guide.id}>
                                      {guide.faculty_name} ({count}/{guide.quota}{full ? ' - Full' : ''})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 bg-amber-50/70 border border-amber-300 rounded-lg p-2.5">
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white shadow-2xs">
                                ⚠ Unassigned
                              </span>
                            </div>
                            <select
                              value=""
                              onChange={e => handleReassign(g.id, e.target.value)}
                              className="w-full border border-amber-300 bg-white rounded px-2 py-1 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                              <option value="">— Select Faculty Guide —</option>
                              {guides.map(guide => {
                                const count = guideCounts[guide.id] || 0;
                                const full = count >= guide.quota;
                                return (
                                  <option key={guide.id} value={guide.id}>
                                    {guide.faculty_name} ({count}/{guide.quota}{full ? ' - Full' : ''})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── GUIDE ALLOCATION MATRIX / SUMMARY MODAL ────────────────── */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto border border-[var(--rule)] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[var(--rule)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Distribution Matrix
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {assignedGroupsCount} of {groups.length} Groups Assigned
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[var(--navy)] mt-1">
                  Faculty Guide Allocation Breakdown
                </h2>
                <p className="text-xs text-[var(--ink)]/60">
                  Detailed list showing exactly which faculty guide is assigned to which seminar group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {guides.map(g => {
                const assignedGroups = guideAssignedGroupsMap[g.id] || [];
                return (
                  <div key={g.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-3 mb-2 pb-2 border-b border-slate-200">
                      <div>
                        <h3 className="font-bold text-sm text-[var(--navy)] flex items-center gap-2">
                          {g.faculty_name}
                          <span className="text-[10px] font-normal text-slate-500 font-sans">
                            ({g.designation || 'Faculty Guide'})
                          </span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          assignedGroups.length >= g.quota
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {assignedGroups.length} / {g.quota} Groups
                        </span>
                      </div>
                    </div>

                    {assignedGroups.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                        {assignedGroups.map(grp => {
                          const members = grp.members || [];
                          const leader = members.find(m => m.is_leader) || members[0];
                          const topic = leader?.topic1 || members.find(m => m.topic1)?.topic1;

                          return (
                            <div
                              key={grp.id}
                              className="bg-white border border-slate-200 hover:border-blue-300 rounded-md p-2 text-xs space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-[var(--navy)] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                                  Group #{grp.group_no}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[100px]">
                                  {grp.domain}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-800 font-medium truncate" title={leader?.name || leader?.student_name}>
                                Leader: {leader?.name || leader?.student_name || '—'}
                              </p>
                              {topic && (
                                <p className="text-[10px] text-slate-500 truncate" title={topic}>
                                  Topic: {topic}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 italic">No groups currently allocated to this guide.</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--rule)] pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a] transition-colors"
              >
                Close Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOPICS INSPECTOR MODAL ────────────────────────────────────── */}
      {selectedTopicsGroup && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-[var(--rule)] shadow-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded">
                    Group #{selectedTopicsGroup.group_no}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Guide: <strong className="text-[var(--navy)]">{getAssignedGuide(selectedTopicsGroup)?.faculty_name || selectedTopicsGroup.guide_name || 'Unassigned'}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--navy)] mt-1">
                  {selectedTopicsGroup.domain}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTopicsGroup(null)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--navy)]">
                Student Proposed Seminar Topics ({selectedTopicsGroup.members?.length} Students)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTopicsGroup.members?.map((m) => (
                  <div key={m.prn || m.name} className="p-3.5 bg-slate-50 border border-[var(--rule)] rounded-lg text-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div>
                        <span className="font-bold text-[var(--ink)] block text-sm">{m.name || m.student_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Div: {m.division || '—'}</span>
                      </div>
                      <span className="font-mono font-bold text-xs bg-white border border-slate-300 px-2 py-0.5 rounded text-[var(--navy)]">
                        {m.prn}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px]">
                        <span className="font-bold text-amber-900 block text-[10px]">Choice 1:</span>
                        <p className="text-slate-800 font-medium mt-0.5">{m.topic1 || '—'}</p>
                      </div>

                      <div className="p-2 bg-white border border-slate-200 rounded text-[11px]">
                        <span className="font-bold text-slate-500 block text-[10px]">Choice 2:</span>
                        <p className="text-slate-700 mt-0.5">{m.topic2 || '—'}</p>
                      </div>

                      <div className="p-2 bg-white border border-slate-200 rounded text-[11px]">
                        <span className="font-bold text-slate-500 block text-[10px]">Choice 3:</span>
                        <p className="text-slate-700 mt-0.5">{m.topic3 || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--rule)] pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTopicsGroup(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded text-[var(--ink)]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
