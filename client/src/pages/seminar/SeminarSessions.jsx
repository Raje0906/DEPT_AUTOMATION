import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const STATUS_META = {
  SETUP:       { label: 'Setup',       color: 'bg-slate-100 text-slate-600 border-slate-200' },
  UPLOAD:      { label: 'Upload',      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  VALIDATION:  { label: 'Validating',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ASSIGNMENT:  { label: 'Assignment',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
  PUBLISHED:   { label: 'Published',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.SETUP;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${m.color}`}>
      {m.label}
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

  const getNextStep = (s) => {
    if (s.status === 'SETUP')      return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'UPLOAD')     return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'VALIDATION') return `/faculty/seminar/${s.id}/upload`;
    if (s.status === 'ASSIGNMENT') return `/faculty/seminar/${s.id}/assign`;
    return `/faculty/seminar/${s.id}/review`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--navy)] mb-1">TE Seminar / Project Sessions</h1>
          <p className="text-sm text-[var(--ink)]/60">
            Manage group formation, guide assignment, and export for each academic term.
          </p>
        </div>
        <button
          id="btn-new-session"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--navy)] text-white text-sm font-medium rounded-md hover:bg-[#2a3d7a] transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-[var(--navy)] mb-4">New Seminar Session</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)]/60 uppercase tracking-wider mb-1">Session Name</label>
                <input
                  id="session-name"
                  className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
                  placeholder="e.g. TE Seminar 2025–26"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)]/60 uppercase tracking-wider mb-1">Academic Year</label>
                  <input
                    id="session-year"
                    className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
                    placeholder="2025–26"
                    value={form.academic_year}
                    onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)]/60 uppercase tracking-wider mb-1">Batch / Class</label>
                  <input
                    id="session-batch"
                    className="w-full border border-[var(--rule)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30"
                    placeholder="TE 2022–25"
                    value={form.batch}
                    onChange={e => setForm(f => ({ ...f, batch: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-[var(--ink)]/60 hover:text-[var(--ink)] transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--navy)] text-white text-sm font-medium rounded-md hover:bg-[#2a3d7a] disabled:opacity-60 transition-colors">
                  {saving ? 'Creating…' : 'Create & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div className="text-center py-16 text-[var(--ink)]/40 text-sm">Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--rule)] rounded-xl">
          <svg className="w-10 h-10 mx-auto text-[var(--ink)]/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-[var(--ink)]/40 mb-3">No sessions yet. Create your first one to get started.</p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-[var(--navy)] text-white text-sm rounded-md hover:bg-[#2a3d7a] transition-colors">
            Create Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="bg-white border border-[var(--rule)] rounded-xl p-5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#EEF0F7] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--navy)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-[var(--ink)] text-sm">{s.name}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-xs text-[var(--ink)]/50">{s.batch} · {s.academic_year} · Created by {s.created_by_name}</p>
                  <p className="text-xs text-[var(--ink)]/50 mt-0.5">
                    {s.group_count} groups · {s.assigned_count} assigned
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {s.status === 'PUBLISHED' && (
                  <button
                    onClick={() => navigate(`/faculty/seminar/${s.id}/review`)}
                    className="px-3 py-1.5 text-xs font-medium border border-emerald-300 text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors"
                  >
                    View & Export
                  </button>
                )}
                <button
                  onClick={() => navigate(getNextStep(s))}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--navy)] text-white rounded-md hover:bg-[#2a3d7a] transition-colors"
                >
                  {s.status === 'PUBLISHED' ? 'Audit Log' : 'Continue →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
