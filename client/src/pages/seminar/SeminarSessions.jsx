import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const StatusBadge = ({ session }) => {
  if (session?.status === 'PUBLISHED') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
        Published
      </span>
    );
  }
  if (session?.status === 'ASSIGNMENT') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-purple-50 text-purple-800 border-purple-200">
        Guide Allocation
      </span>
    );
  }
  if (session?.is_locked) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-800 border-amber-200">
        Registration Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-blue-50 text-blue-800 border-blue-200">
      Registration Open
    </span>
  );
};

export default function SeminarSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', academic_year: '', batch: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/seminar/sessions');
      setSessions(data.sessions || []);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePublishSession = async (s) => {
    setPublishingId(s.id);
    try {
      await api.post(`/seminar/sessions/${s.id}/publish`, { publish: true, force: true });
      toast.success(`Session "${s.name}" published successfully`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to publish session');
    } finally {
      setPublishingId(null);
    }
  };

  const handleUnpublishSession = async (s) => {
    if (!window.confirm(`Depublish "${s.name}" to draft? Groups and student responses will be preserved.`)) return;
    setPublishingId(s.id);
    try {
      await api.post(`/seminar/sessions/${s.id}/publish`, { publish: false });
      toast.success(`Session "${s.name}" reverted to draft. Responses are kept.`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to depublish session');
    } finally {
      setPublishingId(null);
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.academic_year || !form.batch) return toast.error('All fields are required');
    setSaving(true);
    try {
      const { data } = await api.post('/seminar/sessions', form);
      toast.success('Session created');
      setShowForm(false);
      setForm({ name: '', academic_year: '', batch: '' });
      navigate(`/faculty/seminar/${data.session.id}/upload`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create session');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Are you sure you want to remove session "${s.name}"?\n\nThis will permanently delete this session along with its uploads, parsed groups, and guide assignments.`)) {
      return;
    }
    setDeletingId(s.id);
    try {
      await api.delete(`/seminar/sessions/${s.id}`);
      setSessions(prev => prev.filter(x => x.id !== s.id));
      toast.success('Session removed successfully');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove session');
    } finally {
      setDeletingId(null);
    }
  };

  const getNextStep = (s) => {
    if (s.status === 'SETUP')      return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'UPLOAD')     return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'VALIDATION') return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'ASSIGNMENT') return `/faculty/seminar/${s.id}/assign`;
    return `/faculty/seminar/${s.id}/review`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[var(--rule)]">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--navy)] tracking-tight">TE Seminar Governance</h1>
          <p className="text-xs sm:text-sm text-[var(--ink)]/65 font-medium">
            Manage academic sessions, student registrations, guide allocations, and presentations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-new-session"
            type="button"
            onClick={() => setShowForm(true)}
            className="h-8 px-3.5 inline-flex items-center gap-1.5 bg-[var(--navy)] text-white text-xs font-semibold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-2xs shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-[var(--rule)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--navy)]">New Seminar Session</h2>
                <p className="text-xs text-[var(--ink)]/60 mt-0.5">Initialize a term for group registrations and guide allocation.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 -mr-1 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Session Name</label>
                <input
                  id="session-name"
                  className="w-full h-9 border border-[var(--rule)] rounded-md px-3 text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 hover:border-slate-300 transition-colors"
                  placeholder="e.g. TE Seminar 2025–26"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Academic Year</label>
                  <input
                    id="session-year"
                    className="w-full h-9 border border-[var(--rule)] rounded-md px-3 text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 hover:border-slate-300 transition-colors"
                    placeholder="2025–26"
                    value={form.academic_year}
                    onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Batch / Class</label>
                  <input
                    id="session-batch"
                    className="w-full h-9 border border-[var(--rule)] rounded-md px-3 text-xs bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 hover:border-slate-300 transition-colors"
                    placeholder="TE 2022–25"
                    value={form.batch}
                    onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-8 px-3.5 inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors border border-[var(--rule)] rounded-md bg-white hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-8 px-3.5 inline-flex items-center text-xs font-semibold bg-[var(--navy)] text-white rounded-md hover:bg-[#2a3d7a] disabled:opacity-60 transition-colors shadow-2xs"
                >
                  {saving ? 'Creating…' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs font-medium">Loading seminar sessions…</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-[var(--rule)] rounded-xl bg-white p-6 space-y-3">
          <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs text-slate-500">No seminar sessions created yet. Create a session to get started.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-8 px-3.5 inline-flex items-center text-xs font-semibold bg-[var(--navy)] text-white rounded-md hover:bg-[#2a3d7a] transition-colors shadow-2xs"
          >
            Create Session
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {sessions.map(s => (
            <div
              key={s.id}
              className="bg-white border border-[var(--rule)] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:shadow-xs transition-shadow"
            >
              {/* Session Profile */}
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 text-[var(--navy)]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold text-slate-900 text-sm tracking-tight">{s.name}</span>
                    <StatusBadge session={s} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{s.academic_year || 'AY'} · {s.batch}</span>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-slate-800">{s.group_count || 0} groups registered</span>
                    <span className="text-slate-300">•</span>
                    <span className={s.assigned_count > 0 ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                      {s.assigned_count || 0} assigned
                    </span>
                    {s.created_by_name && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400">by {s.created_by_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--rule)]">
                {s.status === 'PUBLISHED' && (
                  <button
                    type="button"
                    id={`btn-schedule-session-${s.id}`}
                    onClick={() => navigate('/faculty/seminar/schedule', { state: { sessionId: s.id } })}
                    className="h-8 px-3 inline-flex items-center text-xs font-semibold border border-[#D4D0C8] text-[#1E2D5A] rounded-md bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    Schedule presentation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/faculty/seminar/${s.id}/upload`)}
                  className="h-8 px-3 inline-flex items-center text-xs font-semibold border border-[var(--rule)] text-slate-700 rounded-md bg-white hover:bg-slate-50 hover:text-[var(--navy)] transition-colors shadow-2xs"
                >
                  Submissions ({s.group_count || 0})
                </button>
                <button
                  type="button"
                  onClick={() => navigate(getNextStep(s))}
                  className="h-8 px-3.5 inline-flex items-center text-xs font-semibold bg-[var(--navy)] text-white rounded-md hover:bg-[#2a3d7a] transition-colors shadow-2xs"
                >
                  {s.status === 'PUBLISHED' ? 'Review & Export' : 'Continue →'}
                </button>
                {s.status === 'PUBLISHED' ? (
                  <button
                    type="button"
                    onClick={() => handleUnpublishSession(s)}
                    disabled={publishingId === s.id}
                    className="h-8 px-2.5 inline-flex items-center text-xs font-medium border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors shadow-2xs"
                    title="Depublish session back to draft (keeps all group responses)"
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePublishSession(s)}
                    disabled={publishingId === s.id}
                    className="h-8 px-2.5 inline-flex items-center text-xs font-medium border border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors shadow-2xs"
                    title="Publish session to make schedules active"
                  >
                    Publish session
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  disabled={deletingId === s.id}
                  title="Remove Session"
                  className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border border-[var(--rule)] hover:border-red-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
