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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab]     = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [viewMode, setViewMode]       = useState('compact'); // 'compact' | 'expanded'
  const [selectedTopicsGroup, setSelectedTopicsGroup] = useState(null);
  const [guideFilter, setGuideFilter] = useState('');

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

  // Derived metrics
  const guideCounts = useMemo(() => {
    const counts = {};
    groups.forEach(g => {
      if (g.guide_id) {
        counts[g.guide_id] = (counts[g.guide_id] || 0) + 1;
      }
    });
    return counts;
  }, [groups]);

  const totalQuota = guides.reduce((s, g) => s + (g.quota || 0), 0);
  const assignedGroupsCount = groups.filter(g => g.guide_id).length;
  const unassigned = groups.length - assignedGroupsCount;
  const percentAssigned = groups.length > 0 ? Math.round((assignedGroupsCount / groups.length) * 100) : 0;

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (filterTab === 'unassigned' && g.guide_id) return false;
      if (filterTab === 'assigned' && !g.guide_id) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchNo = String(g.group_no).includes(q);
      const matchDomain = g.domain?.toLowerCase().includes(q);
      const matchGuide = g.guide_name?.toLowerCase().includes(q);
      const matchMember = (g.members || []).some(m =>
        (m.name || m.student_name)?.toLowerCase().includes(q) ||
        m.prn?.toLowerCase().includes(q) ||
        m.topic1?.toLowerCase().includes(q) ||
        m.topic2?.toLowerCase().includes(q) ||
        m.topic3?.toLowerCase().includes(q)
      );
      return matchNo || matchDomain || matchGuide || matchMember;
    });
  }, [groups, filterTab, searchQuery]);

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
      const g = guides.find(x => x.id === guideId);
      await api.post(`/seminar/sessions/${id}/guides`, { faculty_id: g.faculty_id, quota: q, display_order: g.display_order });
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

  // Auto-assign
  const handleAutoAssign = async () => {
    const hasAssignments = groups.some(g => g.guide_id);
    if (hasAssignments) {
      if (!window.confirm('Groups already have assignments. Overwrite with auto-assign?')) return;
    }
    setAutoRunning(true);
    try {
      const { data } = await api.post(`/seminar/sessions/${id}/assign`, { confirm: true });
      toast.success(`Assigned ${data.assigned} groups${data.unassigned > 0 ? ` (${data.unassigned} unassigned — increase quotas)` : ''}`);
      await load();
    } catch (err) { toast.error(err?.response?.data?.error || 'Auto-assign failed'); }
    finally { setAutoRunning(false); }
  };

  // Manual reassign
  const handleReassign = async (groupId, guideId) => {
    try {
      const res = await api.patch(`/seminar/sessions/${id}/assignments/${groupId}`, { guide_id: guideId || null });
      setGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        const guide = guides.find(x => x.id === parseInt(guideId, 10));
        return {
          ...g,
          seminar_guide_id: guideId ? parseInt(guideId, 10) : null,
          guide_id: guide?.faculty_id || (guideId ? parseInt(guideId, 10) : null),
          guide_name: guide?.faculty_name || res.data?.guide_name || null,
        };
      }));
      toast.success(guideId ? 'Guide assigned' : 'Guide unassigned');
    } catch { toast.error('Reassignment failed'); }
  };

  // Submit to HOD
  const handleSubmitToHOD = async () => {
    const groupsToSubmit = groups.filter(g => g.guide_id && g.status === 'PENDING_GUIDE_ASSIGNMENT');
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
          <h1 className="text-2xl font-bold text-[var(--navy)]">Guide Assignment</h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            Review student seminar topics and assign faculty guides based on domain expertise and quotas.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAutoAssign}
            disabled={autoRunning || guides.length === 0}
            className="px-3.5 py-2 text-xs font-semibold border border-[var(--navy)] text-[var(--navy)] rounded-md hover:bg-[var(--navy)] hover:text-white disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>{autoRunning ? 'Assigning…' : 'Sequential Auto-Assign'}</span>
          </button>
          <button
            onClick={handleSubmitToHOD}
            className="px-3.5 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-2xs"
          >
            Submit for HOD Approval
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || unassigned > 0}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
          >
            {publishing ? 'Publishing…' : 'Publish & Finalize →'}
          </button>
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
            <div className="px-4 py-3 border-b border-[var(--rule)] bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--navy)]">Faculty Guides</h3>
                <p className="text-[10px] text-[var(--ink)]/50">{guides.length} active roster</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded border border-blue-200">
                {assignedGroupsCount}/{totalQuota} used
              </span>
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
                  const isFull = assigned >= g.quota;
                  const isOver = assigned > g.quota;

                  return (
                    <div key={g.id} className="p-3 hover:bg-slate-50 transition-colors">
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

            {/* Search & Layout View Toggle */}
            <div className="flex items-center gap-2">
              <div className="w-56">
                <input
                  type="text"
                  placeholder="Search group, topic, student..."
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
                  <th className="p-3 w-14 text-center">Group</th>
                  <th className="p-3 w-36">Domain</th>
                  <th className="p-3 w-48">Team Members</th>
                  <th className="p-3 min-w-[280px]">Student Seminar Topics</th>
                  <th className="p-3 w-56 text-right">Assigned Guide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {filteredGroups.map(g => {
                  const members = g.members || [];
                  const isAssigned = Boolean(g.guide_id);
                  const leader = members.find(m => m.is_leader) || members[0];

                  return (
                    <tr
                      key={g.id}
                      className={`transition-colors ${!isAssigned ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/70'}`}
                    >
                      {/* Group No. */}
                      <td className="p-3 text-center align-top">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-[var(--navy)] border border-slate-300 px-2 py-0.5 rounded">
                          #{g.group_no}
                        </span>
                      </td>

                      {/* Domain */}
                      <td className="p-3 align-top">
                        <div className="font-bold text-[var(--ink)]">{g.domain}</div>
                        <div className="mt-1">
                          {g.status === 'APPROVED' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              APPROVED
                            </span>
                          ) : g.status === 'AWAITING_HOD_APPROVAL' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                              WAITING HOD
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                              DRAFT
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
                          <div className="space-y-1.5">
                            {/* Primary Choice Topic Preview */}
                            {leader?.topic1 ? (
                              <div className="p-1.5 bg-amber-50/60 border border-amber-200/70 rounded text-[11px]">
                                <div className="text-[10px] text-amber-900 font-bold flex items-center gap-1">
                                  <span>⭐ Primary Topic ({leader.name || leader.student_name}):</span>
                                </div>
                                <div className="text-slate-800 truncate mt-0.5 font-medium" title={leader.topic1}>
                                  {leader.topic1}
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic text-[11px]">No primary topic recorded</div>
                            )}

                            {/* View All Topics Button */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedTopicsGroup(g)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--navy)] bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
                              >
                                <span>📖 View All Topics ({members.length} Students)</span>
                              </button>
                            </div>
                          </div>
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

                      {/* Guide Selector */}
                      <td className="p-3 align-top text-right">
                        <select
                          value={g.seminar_guide_id || (guides.find(x => x.faculty_id === g.guide_id)?.id) || ''}
                          onChange={e => handleReassign(g.id, e.target.value)}
                          className={`w-full border rounded-md px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 ${
                            !isAssigned
                              ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                              : 'border-[var(--rule)] bg-white text-[var(--ink)]'
                          }`}
                        >
                          <option value="">— Unassigned —</option>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                  <span className="text-xs font-semibold text-slate-500">
                    Guide: {selectedTopicsGroup.guide_name || 'Unassigned'}
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
                        <span className="font-bold text-amber-900 block text-[10px]">Choice 1 (Primary Topic):</span>
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
