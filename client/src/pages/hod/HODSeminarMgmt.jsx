import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODSeminarMgmt() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('coordinator'); // 'coordinator' | 'approvals' | 'history'
  const [pendingGroups, setPendingGroups] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [coordinatorHistory, setCoordinatorHistory] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appointing, setAppointing] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectRemark, setRejectRemark] = useState('');

  const fetchPending = async () => {
    try {
      const res = await api.get('/seminar/hod/pending-approvals');
      setPendingGroups(res.data.pending || []);
    } catch (err) {
      toast.error('Failed to load pending seminar approvals');
    }
  };

  const fetchCoordinators = async () => {
    try {
      const res = await api.get('/seminar/coordinators');
      const list = res.data.faculty || [];
      setFacultyList(list);
      // default select first non-coordinator faculty if available
      const nonCoord = list.find(f => !f.is_seminar_coordinator);
      if (nonCoord) setSelectedFacultyId(nonCoord.id);
    } catch (err) {
      console.error('Failed to load coordinators:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/seminar/coordinators/history');
      setCoordinatorHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to load coordinator history:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchPending(), fetchCoordinators(), fetchHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAppointCoordinator = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) return toast.error('Please select a faculty member');
    setAppointing(true);
    try {
      const res = await api.post('/seminar/coordinators/assign', { facultyId: parseInt(selectedFacultyId, 10) });
      toast.success(res.data.message || 'Seminar Coordinator appointed successfully');
      await fetchCoordinators();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to appoint coordinator');
    } finally {
      setAppointing(false);
    }
  };

  const handleRevokeCoordinator = async (facultyId, name) => {
    if (!window.confirm(`Revoke Seminar Coordinator status for ${name}?`)) return;
    setAppointing(true);
    try {
      await api.post('/seminar/coordinators/remove', { facultyId });
      toast.success(`Revoked Seminar Coordinator role for ${name}`);
      await fetchCoordinators();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke coordinator');
    } finally {
      setAppointing(false);
    }
  };

  const currentCoordinators = facultyList.filter(f => f.is_seminar_coordinator);

  const handleApprove = async (groupId) => {
    if (!window.confirm('Approve this guide assignment?')) return;
    setSubmitting(true);
    try {
      await api.patch(`/seminar/hod/groups/${groupId}/approve`);
      toast.success('Assignment approved successfully');
      fetchPending();
    } catch (err) {
      toast.error('Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectRemark.trim()) return toast.error('Please enter a rejection remark');
    setSubmitting(true);
    try {
      await api.patch(`/seminar/hod/groups/${rejectModal.id}/reject`, { remark: rejectRemark });
      toast.success('Assignment rejected');
      setRejectModal(null);
      setRejectRemark('');
      fetchPending();
    } catch (err) {
      toast.error('Rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-[var(--ink)]/40">Loading seminar governance data...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--rule)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-navy text-white">
              HOD Authority
            </span>
            <span className="text-xs text-draft">Department of Computer Engineering</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-[var(--navy)]">
            Seminar Governance &amp; Guide Approvals
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink)]/60 mt-1">
            Designate the Seminar Coordinator and review/approve coordinator-assigned faculty guides.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/hod/seminar"
            className="px-3.5 py-2 rounded-lg border border-navy/30 text-navy bg-blue-50/50 hover:bg-blue-50 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <span>View All Sessions</span>
            <span>→</span>
          </Link>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs">
            {pendingGroups.length} Pending Approval{pendingGroups.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGATION ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[var(--paper)] border border-[var(--rule)] rounded-xl p-1.5">
        {[
          {
            key: 'coordinator',
            label: 'Coordinator Designation',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )
          },
          {
            key: 'approvals',
            label: `Guide Approvals ${pendingGroups.length > 0 ? `(${pendingGroups.length})` : ''}`,
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )
          },
          {
            key: 'history',
            label: 'Appointment History',
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )
          },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[var(--navy)] shadow-sm border border-[var(--rule)]'
                : 'text-[var(--ink)]/50 hover:text-[var(--ink)] hover:bg-white/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── SECTION 1: SEMINAR COORDINATOR DESIGNATION ───────────────────── */}
      {activeTab === 'coordinator' && (
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-navy flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0V12m-5.003 0V9.75a3.375 3.375 0 016.75 0V12m-6.75 0h6.75" />
              </svg>
              Designate Faculty Seminar Coordinator
            </h2>
            <p className="text-xs text-draft mt-0.5">
              The appointed coordinator is granted executive authority to configure sessions, manage group registrations, run guide distribution, and assign guides to student groups.
            </p>
          </div>
          <span className="text-[11px] font-mono text-draft bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
            Role Hierarchy: HOD &gt; Coordinator &gt; Guide &gt; Student
          </span>
        </div>

        {/* Current Coordinator Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 border border-amber-200 rounded-xl p-5 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Current Seminar Coordinator
            </span>
            {currentCoordinators.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-xs text-draft font-medium">No faculty member is currently designated as Seminar Coordinator.</p>
                <p className="text-[11px] text-draft/70 mt-1">Select a faculty member from the panel to appoint them.</p>
              </div>
            ) : (
              currentCoordinators.map(coord => (
                <div key={coord.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg p-3.5 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-ink">{coord.name}</h3>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Active</span>
                    </div>
                    <p className="text-xs text-draft">{coord.designation} · {coord.department}</p>
                    <p className="text-[11px] font-mono text-navy">{coord.email} · Emp ID: {coord.employee_id}</p>
                  </div>
                  <button
                    type="button"
                    disabled={appointing}
                    onClick={() => handleRevokeCoordinator(coord.id, coord.name)}
                    className="px-2.5 py-1 text-xs text-maroon hover:text-red-700 hover:bg-red-50 rounded border border-red-200 font-medium transition-colors"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Appoint New Coordinator Form */}
          <form onSubmit={handleAppointCoordinator} className="bg-slate-50/70 border border-rule rounded-xl p-5 space-y-4">
            <div>
              <label htmlFor="coordinatorSelect" className="block text-xs font-bold text-navy mb-1.5">
                Select Faculty to Appoint as Coordinator
              </label>
              <select
                id="coordinatorSelect"
                value={selectedFacultyId}
                onChange={e => setSelectedFacultyId(e.target.value)}
                className="input-field text-xs sm:text-sm bg-white"
                disabled={appointing || facultyList.length === 0}
              >
                <option value="">-- Choose Faculty Member --</option>
                {facultyList.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.designation}) {f.is_seminar_coordinator ? '★ [Current Coordinator]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-draft max-w-xs leading-tight">
                Appointing a faculty member updates their permission profile instantly. They will see the Coordinator panel upon signing in.
              </p>
              <button
                type="submit"
                disabled={appointing || !selectedFacultyId}
                className="btn-primary py-2 px-4 text-xs font-semibold disabled:opacity-50 whitespace-nowrap shadow-xs"
              >
                {appointing ? 'Updating…' : 'Appoint Coordinator'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* ─── SECTION 2: PENDING SEMINAR GUIDE APPROVALS ───────────────────── */}
      {activeTab === 'approvals' && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">Guide Allocation Approvals</h2>
            <p className="text-xs text-draft">Guide allocations submitted by the Seminar Coordinator for HOD sign-off.</p>
          </div>
        </div>

      <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#EEF0F7] border-b border-[var(--rule)] text-[var(--navy)]">
            <tr>
              <th className="p-4 font-semibold">Group</th>
              <th className="p-4 font-semibold">Session</th>
              <th className="p-4 font-semibold">Domain</th>
              <th className="p-4 font-semibold">Proposed Guide</th>
              <th className="p-4 font-semibold">Submitted By</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--rule)]">
            {pendingGroups.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--ink)]/40">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-[var(--ink)]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">No pending approvals at this time.</span>
                  </div>
                </td>
              </tr>
            ) : (
              pendingGroups.map(g => (
                <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold font-mono text-[var(--navy)]">#{g.group_no}</div>
                    <div className="text-xs text-[var(--ink)]/60 mt-1">
                      {g.members?.length || 0} Members
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-medium text-[var(--ink)]">{g.session_name}</div>
                    <div className="text-[11px] text-[var(--ink)]/50">{g.academic_year} · Batch {g.batch}</div>
                  </td>
                  <td className="p-4 text-[var(--ink)] font-medium max-w-[180px] truncate">{g.domain}</td>
                  <td className="p-4">
                    <div className="font-bold text-emerald-800">{g.guide_name || 'Assigned Guide'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-[var(--ink)] font-medium">{g.assigned_by_name}</div>
                    <div className="text-xs text-[var(--ink)]/50">{g.assigned_at ? new Date(g.assigned_at).toLocaleDateString() : '—'}</div>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      disabled={submitting}
                      onClick={() => handleApprove(g.id)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => setRejectModal(g)}
                      className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--rule)] bg-red-50">
              <h3 className="font-bold text-red-800">Reject Assignment - Group #{rejectModal.group_no}</h3>
            </div>
            <form onSubmit={handleReject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--navy)] mb-1">Rejection Remark / Reason</label>
                <textarea
                  required
                  rows={3}
                  className="w-full border border-[var(--rule)] rounded-md p-2 text-sm focus:outline-none focus:border-red-500"
                  placeholder="Explain why this assignment is rejected..."
                  value={rejectRemark}
                  onChange={e => setRejectRemark(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 border border-[var(--rule)] text-[var(--ink)]/70 text-sm font-semibold rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
      )}

      {/* ─── SECTION 3: COORDINATOR APPOINTMENT HISTORY ───────────────────── */}
      {activeTab === 'history' && (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-navy">Coordinator Appointment History</h2>
          <p className="text-xs text-draft">Immutable record of all coordinator appointments and revocations.</p>
        </div>

        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#EEF0F7] border-b border-[var(--rule)] text-[var(--navy)]">
              <tr>
                <th className="p-4 font-semibold">Action</th>
                <th className="p-4 font-semibold">Faculty Member</th>
                <th className="p-4 font-semibold">Performed By</th>
                <th className="p-4 font-semibold">Notes</th>
                <th className="p-4 font-semibold">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {coordinatorHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--ink)]/40">No coordinator appointment history recorded.</td>
                </tr>
              ) : (
                coordinatorHistory.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        h.action === 'APPOINTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${h.action === 'APPOINTED' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {h.action === 'APPOINTED' ? 'Appointed' : 'Revoked'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-[var(--ink)]">{h.faculty_name}</div>
                    </td>
                    <td className="p-4 text-[var(--ink)]/70 text-xs">{h.performed_by_name || 'HOD'}</td>
                    <td className="p-4 text-[var(--ink)]/60 text-xs max-w-[200px] truncate">{h.notes || '—'}</td>
                    <td className="p-4 text-[var(--ink)]/60 text-xs font-mono">
                      {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

