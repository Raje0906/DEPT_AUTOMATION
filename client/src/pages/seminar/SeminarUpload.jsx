import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const StepBar = ({ current = 0 }) => {
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

export default function SeminarUpload() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [groups, setGroups] = useState([]);
  const [validation, setValidation] = useState({ issues: [], summary: { errors: 0, warnings: 0, totalIssues: 0 } });
  const [overrides, setOverrides] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('submissions'); // 'submissions' | 'validation' | 'import'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupModal, setSelectedGroupModal] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  // File import fallback state
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [subRes, ovRes] = await Promise.allSettled([
        api.get(`/seminar/sessions/${id}/submissions`),
        api.get(`/seminar/sessions/${id}/overrides`),
      ]);

      if (subRes.status === 'fulfilled') {
        setSession(subRes.value.data.session);
        setGroups(subRes.value.data.groups || []);
        if (subRes.value.data.standingValidation) {
          setValidation(subRes.value.data.standingValidation);
        }
      }

      if (ovRes.status === 'fulfilled') {
        setOverrides(new Set(ovRes.value.data.overrides.map(o => o.issue_key)));
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
      toast.error('Failed to load session submissions');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle registration lock
  const handleToggleLock = async () => {
    setTogglingLock(true);
    try {
      const { data } = await api.patch(`/seminar/sessions/${id}/toggle-lock`);
      setSession(data.session);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle registration lock');
    } finally {
      setTogglingLock(false);
    }
  };

  // Toggle individual group edit allowance
  const handleToggleGroupUnlock = async (group) => {
    try {
      const { data } = await api.patch(`/seminar/sessions/${id}/groups/${group.id}/unlock`);
      setGroups(prev => prev.map(g => (g.id === group.id ? { ...g, allow_edit: data.group.allow_edit } : g)));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update group permission');
    }
  };

  // Delete a group
  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Are you sure you want to remove Group #${group.group_no} (${group.domain})?`)) return;
    try {
      await api.delete(`/seminar/sessions/${id}/groups/${group.id}`);
      toast.success(`Group #${group.group_no} deleted`);
      setGroups(prev => prev.filter(g => g.id !== group.id));
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete group');
    }
  };

  // Acknowledge validation issue
  const handleAcknowledge = async (issue) => {
    try {
      await api.post(`/seminar/sessions/${id}/override-issue`, {
        issueKey: issue.key,
        note: 'Acknowledged by coordinator',
      });
      setOverrides(prev => new Set([...prev, issue.key]));
      toast.success('Issue acknowledged');
    } catch {
      toast.error('Failed to acknowledge issue');
    }
  };

  // Export current XLSX at any time
  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/seminar/sessions/${id}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `${session?.name || 'Session'}_GroupList.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Spreadsheet exported successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  // Fallback spreadsheet upload handler
  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) return toast.error('Only .xlsx, .xls, or .csv files are accepted');

    if (groups.length > 0) {
      if (!window.confirm('Groups already exist in this session. Uploading a spreadsheet may replace existing groups once committed. Continue?')) {
        return;
      }
    }

    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/seminar/sessions/${id}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Parsed ${data.groupCount} groups from spreadsheet. You can review and commit them.`);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Spreadsheet parse failed');
    } finally {
      setUploading(false);
    }
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchNo = String(g.group_no).includes(q);
    const matchDomain = g.domain?.toLowerCase().includes(q);
    const matchLeader = g.leader_name?.toLowerCase().includes(q) || g.leader_email?.toLowerCase().includes(q);
    const matchMember = g.members?.some(m => m.student_name?.toLowerCase().includes(q) || m.prn?.toLowerCase().includes(q));
    return matchNo || matchDomain || matchLeader || matchMember;
  });

  const unacknowledgedErrors = validation.issues.filter(
    i => i.severity === 'error' && !overrides.has(i.key)
  );

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/50">Loading seminar session...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--ink)]/50">
        <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">Sessions</Link>
        <span>/</span>
        <span className="text-[var(--ink)]/80 font-medium truncate">{session?.name}</span>
        <span>/</span>
        <span>Submissions &amp; Validation</span>
      </div>

      {/* Header & Controls */}
      <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              session?.is_locked
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {session?.is_locked ? '🔒 Registration Locked' : '🟢 Registration Open'}
            </span>
            <span className="text-xs font-mono text-[var(--ink)]/50">
              {session?.batch} · {session?.academic_year}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">
            Student Submissions &amp; Live Validation
          </h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            {groups.length} groups submitted · {unacknowledgedErrors.length} pending validation issues
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Lock Button */}
          <button
            id="btn-toggle-lock"
            onClick={handleToggleLock}
            disabled={togglingLock}
            className={`px-3.5 py-2 text-xs font-bold rounded-md transition-colors border shadow-xs flex items-center gap-1.5 ${
              session?.is_locked
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            {session?.is_locked ? '🔓 Reopen Registration' : '🔒 Lock Registration'}
          </button>

          {/* Download Draft Export */}
          <button
            id="btn-export-draft"
            onClick={handleExport}
            disabled={downloading || groups.length === 0}
            className="px-3.5 py-2 text-xs font-semibold rounded-md border border-[var(--rule)] text-[var(--navy)] hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? 'Exporting...' : 'Download XLSX'}
          </button>

          {/* Proceed to Guide Assignment */}
          <button
            id="btn-proceed-assignment"
            onClick={() => navigate(`/faculty/seminar/${id}/assign`)}
            className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-xs flex items-center gap-1.5"
          >
            Assign Guides
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <StepBar current={0} />

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[var(--rule)] pb-1">
        <div className="flex items-center gap-2">
          <button
            id="tab-submissions"
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-1 ${
              activeTab === 'submissions'
                ? 'border-[var(--navy)] text-[var(--navy)] bg-white'
                : 'border-transparent text-[var(--ink)]/60 hover:text-[var(--ink)]'
            }`}
          >
            Live Submissions ({groups.length})
          </button>

          <button
            id="tab-validation"
            onClick={() => setActiveTab('validation')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-1 flex items-center gap-1.5 ${
              activeTab === 'validation'
                ? 'border-[var(--navy)] text-[var(--navy)] bg-white'
                : 'border-transparent text-[var(--ink)]/60 hover:text-[var(--ink)]'
            }`}
          >
            Standing Validation
            {unacknowledgedErrors.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                {unacknowledgedErrors.length}
              </span>
            )}
          </button>

          <button
            id="tab-import"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-1 ${
              activeTab === 'import'
                ? 'border-[var(--navy)] text-[var(--navy)] bg-white'
                : 'border-transparent text-[var(--ink)]/40 hover:text-[var(--ink)]'
            }`}
          >
            Spreadsheet Import (Fallback)
          </button>
        </div>

        {/* Quick Search */}
        {activeTab === 'submissions' && (
          <div className="w-64">
            <input
              type="text"
              placeholder="Search group, PRN, student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-xs py-1.5 px-3"
            />
          </div>
        )}
      </div>

      {/* ─── TAB 1: LIVE SUBMISSIONS ROSTER ─────────────────────────────────── */}
      {activeTab === 'submissions' && (
        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          {groups.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl">
                ⏳
              </div>
              <h3 className="text-base font-bold text-[var(--navy)]">No Student Submissions Yet</h3>
              <p className="text-xs text-[var(--ink)]/60 max-w-sm mx-auto">
                Students submit their groups directly via the student portal. Submissions will populate here in real time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#EEF0F7] border-b border-[var(--rule)] font-semibold text-[var(--navy)]">
                    <th className="p-3 w-16 text-center">Group</th>
                    <th className="p-3">Domain</th>
                    <th className="p-3">Leader</th>
                    <th className="p-3">Team Members ({groups.length} total)</th>
                    <th className="p-3">Submitted At</th>
                    <th className="p-3 text-center">Edit Permission</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {filteredGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center font-mono font-bold text-[var(--navy)] whitespace-nowrap">
                        #{g.group_no}
                      </td>

                      <td className="p-3 font-semibold text-[var(--ink)] whitespace-nowrap">
                        {g.domain}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium text-[var(--ink)]">{g.leader_name || '—'}</div>
                        <div className="text-[10px] text-[var(--ink)]/60 font-mono truncate max-w-[150px]">
                          {g.leader_email}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {g.members?.map((m) => (
                            <span
                              key={m.id || m.member_index}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                                m.is_leader
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              <span>{m.student_name}</span>
                              <span className="text-[var(--ink)]/40">({m.prn})</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-[var(--ink)]/60 whitespace-nowrap">
                        {new Date(g.submitted_at || g.created_at).toLocaleDateString()}{' '}
                        {new Date(g.submitted_at || g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        {session?.is_locked ? (
                          g.allow_edit ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Unlocked (Exception)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Locked
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Open
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupModal(g)}
                          className="px-2 py-1 text-[11px] font-medium border border-[var(--rule)] rounded hover:bg-slate-100 text-[var(--navy)]"
                        >
                          Details
                        </button>

                        {session?.is_locked && (
                          <button
                            type="button"
                            onClick={() => handleToggleGroupUnlock(g)}
                            className={`px-2 py-1 text-[11px] font-medium border rounded transition-colors ${
                              g.allow_edit
                                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            {g.allow_edit ? 'Revoke Edit' : 'Allow Edit'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(g)}
                          className="px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: STANDING VALIDATION VIEW ───────────────────────────────── */}
      {activeTab === 'validation' && (
        <div className="space-y-4">
          {/* Validation Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 border border-[var(--rule)] rounded-xl">
              <span className="text-xs text-[var(--ink)]/60 font-medium block">Total Groups Scanned</span>
              <span className="text-2xl font-bold font-mono text-[var(--navy)] mt-1 block">
                {groups.length}
              </span>
            </div>
            <div className={`p-4 border rounded-xl ${validation.summary?.errors > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <span className="text-xs font-semibold uppercase tracking-wider block text-[var(--ink)]/70">
                Blocking Errors
              </span>
              <span className={`text-2xl font-bold font-mono mt-1 block ${validation.summary?.errors > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {validation.summary?.errors || 0}
              </span>
            </div>
            <div className="bg-white p-4 border border-[var(--rule)] rounded-xl">
              <span className="text-xs text-[var(--ink)]/60 font-medium block">Advisory Warnings</span>
              <span className="text-2xl font-bold font-mono text-amber-600 mt-1 block">
                {validation.summary?.warnings || 0}
              </span>
            </div>
          </div>

          {/* Issue Cards */}
          {validation.issues.length === 0 ? (
            <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center space-y-2">
              <span className="text-3xl">🎉</span>
              <h3 className="text-base font-bold text-emerald-900">Zero Validation Conflicts Detected</h3>
              <p className="text-xs text-emerald-800/80 max-w-md mx-auto">
                All submitted groups comply with group size limits, unique PRN constraints, and required fields.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {validation.issues.map((issue) => {
                const isAcked = overrides.has(issue.key);
                const isErr = issue.severity === 'error';

                return (
                  <div
                    key={issue.key}
                    className={`bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isAcked
                        ? 'border-gray-200 opacity-60'
                        : isErr
                        ? 'border-red-300 shadow-xs'
                        : 'border-amber-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isErr ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isErr ? '✕' : '⚠️'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--navy)]">
                            {issue.type.replace(/_/g, ' ')}
                          </span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                            isErr ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                          }`}>
                            Group #{issue.groupNo}
                          </span>
                          {isAcked && (
                            <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded">
                              Acknowledged
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--ink)] mt-0.5">{issue.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isAcked && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(issue)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-[var(--ink)] text-xs font-medium rounded border border-[var(--rule)] transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SPREADSHEET IMPORT (FALLBACK) ──────────────────────────── */}
      {activeTab === 'import' && (
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 space-y-4 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-[var(--navy)]">Legacy Spreadsheet Import</h2>
            <p className="text-xs text-[var(--ink)]/60 mt-0.5">
              If students submitted via an external spreadsheet or historical file, you may upload it here. Direct web submissions remain the primary intake method.
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-[var(--navy)] bg-blue-50/40' : 'border-[var(--rule)] hover:border-[var(--navy)]/50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <div className="w-10 h-10 bg-blue-50 text-[var(--navy)] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--navy)]">
              {uploading ? 'Processing spreadsheet...' : 'Drop .xlsx or .csv file here'}
            </p>
            <p className="text-xs text-[var(--ink)]/50 mt-1">Accepts Google Form exports or Excel sheets up to 10MB</p>
          </div>
        </div>
      )}

      {/* ─── GROUP DETAILS MODAL ───────────────────────────────────────────── */}
      {selectedGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-[var(--rule)] shadow-lg p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                  Group #{selectedGroupModal.group_no}
                </span>
                <h3 className="text-lg font-bold text-[var(--navy)] mt-1">
                  {selectedGroupModal.domain}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--navy)]">
                Team Members ({selectedGroupModal.members?.length})
              </h4>
              <div className="space-y-3">
                {selectedGroupModal.members?.map((m) => (
                  <div key={m.id || m.member_index} className="p-3.5 bg-slate-50 border border-[var(--rule)] rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          m.is_leader ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          Student {m.member_index} {m.is_leader && '(Leader)'}
                        </span>
                        <span className="font-bold text-[var(--ink)] text-sm">{m.student_name}</span>
                      </div>
                      <span className="font-mono font-semibold text-[var(--navy)]">PRN: {m.prn}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-[var(--ink)]/70 font-mono">
                      <div>Div: <span className="text-[var(--ink)]">{m.division || '—'}</span></div>
                      <div>Mobile: <span className="text-[var(--ink)]">{m.mobile || '—'}</span></div>
                      <div className="truncate">Email: <span className="text-[var(--ink)]">{m.email || '—'}</span></div>
                    </div>

                    <div className="pt-2 border-t border-[var(--rule)] space-y-1">
                      <div className="text-[11px]"><span className="font-semibold text-[var(--navy)]">Topic 1:</span> {m.topic1 || '—'}</div>
                      <div className="text-[11px]"><span className="font-semibold text-[var(--ink)]/70">Topic 2:</span> {m.topic2 || '—'}</div>
                      <div className="text-[11px]"><span className="font-semibold text-[var(--ink)]/70">Topic 3:</span> {m.topic3 || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--rule)] pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded text-[var(--ink)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
