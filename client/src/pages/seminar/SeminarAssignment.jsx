import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function SeminarAssignment() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession]     = useState(null);
  const [groups, setGroups]       = useState([]);
  const [guides, setGuides]       = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    } catch (err) {
      toast.error('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Guide roster management
  const handleAddGuide = async (facultyId) => {
    if (!facultyId) return;
    if (guides.find(g => String(g.faculty_id) === String(facultyId))) return toast.error('Already in roster');
    try {
      await api.post(`/seminar/sessions/${id}/guides`, { faculty_id: facultyId, quota: 4, display_order: guides.length + 1 });
      await load();
      toast.success('Guide added');
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); }
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

  const totalQuota = guides.reduce((s, g) => s + (g.quota || 0), 0);
  const unassigned = groups.filter(g => !g.guide_id).length;

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
      await api.patch(`/seminar/sessions/${id}/assignments/${groupId}`, { guide_id: guideId || null });
      setGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        const guide = guides.find(x => x.id === parseInt(guideId));
        return { ...g, guide_id: guideId ? parseInt(guideId) : null, guide_name: guide?.faculty_name || null };
      }));
    } catch { toast.error('Reassignment failed'); }
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

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-1 text-xs text-[var(--ink)]/40">
        <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">Sessions</Link>
        <span>/</span>
        <span className="text-[var(--ink)]/60 truncate">{session?.name}</span>
        <span>/</span>
        <span>Guide Assignment</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--navy)]">Guide Assignment</h1>
        <div className="flex gap-3">
          <button
            onClick={handleAutoAssign}
            disabled={autoRunning || guides.length === 0}
            className="px-4 py-2 text-sm font-medium border border-[var(--navy)] text-[var(--navy)] rounded-md hover:bg-[var(--navy)] hover:text-white disabled:opacity-50 transition-colors"
          >
            {autoRunning ? 'Running…' : '⚡ Auto-Assign'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || unassigned > 0}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {publishing ? 'Publishing…' : 'Publish →'}
          </button>
        </div>
      </div>

      {/* Reconciliation banner */}
      {unassigned > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{unassigned} group(s)</span> not yet assigned.
            Total quota: {totalQuota} · Groups: {groups.length}
            {totalQuota < groups.length && <span className="ml-2 text-red-600 font-medium">(increase guide quotas by {groups.length - totalQuota})</span>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[320px_1fr] gap-6">
        {/* Left: Guide Roster */}
        <div>
          <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--ink)]">Guide Roster</h3>
              <span className="text-xs text-[var(--ink)]/40">Total quota: {totalQuota}</span>
            </div>
            <div className="divide-y divide-[var(--rule)]">
              {guides.map(g => (
                <div key={g.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--ink)] truncate">{g.faculty_name}</p>
                    <p className="text-[10px] text-[var(--ink)]/40">{g.designation}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-[var(--ink)]/50">Q:</label>
                    <input
                      type="number" min="0" max="20"
                      value={g.quota}
                      onChange={e => handleQuotaChange(g.id, e.target.value)}
                      className="w-10 border border-[var(--rule)] rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                    />
                  </div>
                  <button onClick={() => handleRemoveGuide(g.id)} className="text-[var(--ink)]/20 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {guides.length === 0 && <p className="px-4 py-4 text-xs text-[var(--ink)]/40 text-center">No guides added yet.</p>}
            </div>
            <div className="px-4 py-3 border-t border-[var(--rule)] bg-[var(--paper)]">
              <select
                onChange={e => { handleAddGuide(e.target.value); e.target.value = ''; }}
                defaultValue=""
                className="w-full border border-[var(--rule)] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
              >
                <option value="">+ Add guide…</option>
                {allFaculty.filter(f => !guides.find(g => g.faculty_id === f.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Group table */}
        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Group Assignments</h3>
            <span className="text-xs text-[var(--ink)]/40">{groups.length} groups</span>
          </div>
          <div className="overflow-auto max-h-[68vh]">
            <table className="result-table w-full text-xs">
              <thead className="sticky top-0 bg-[#EEF0F7] z-10">
                <tr>
                  <th className="px-3 py-2 text-left">Grp</th>
                  <th className="px-3 py-2 text-left">Domain</th>
                  <th className="px-3 py-2 text-left">Members</th>
                  <th className="px-3 py-2 text-left min-w-[180px]">Guide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {groups.map(g => (
                  <tr key={g.id} className={!g.guide_id ? 'bg-amber-50/50' : 'hover:bg-[var(--paper)]/50'}>
                    <td className="px-3 py-2 font-mono font-semibold text-[var(--navy)]">{g.group_no}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-[var(--ink)]">{g.domain}</td>
                    <td className="px-3 py-2 text-[var(--ink)]/60">
                      {(g.members || []).map(m => (
                        <div key={m.prn} className="truncate">{m.name} <span className="text-[var(--ink)]/30 font-mono">{m.prn}</span></div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={g.guide_id || ''}
                        onChange={e => handleReassign(g.id, e.target.value)}
                        className={`w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 ${!g.guide_id ? 'border-amber-300 bg-amber-50' : 'border-[var(--rule)]'}`}
                      >
                        <option value="">— Unassigned —</option>
                        {guides.map(guide => (
                          <option key={guide.id} value={guide.id}>{guide.faculty_name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
