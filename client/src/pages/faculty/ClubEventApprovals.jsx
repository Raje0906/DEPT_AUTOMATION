import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function ClubEventApprovals({ user, academicYear, clubs = [], isClubHead = false, onCountChange }) {
  const [selectedClubFilter, setSelectedClubFilter] = useState('ALL');
  const [pendingEvents, setPendingEvents] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

  // Modals
  const [viewDetailModal, setViewDetailModal] = useState(null);
  const [rejectModalEvent, setRejectModalEvent] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fetch pending events and history across coordinator's assigned clubs
  const loadApprovals = async () => {
    setLoading(true);
    try {
      // If specific club selected
      const targetClubs = selectedClubFilter === 'ALL'
        ? clubs
        : clubs.filter(c => c.id === Number(selectedClubFilter));

      if (targetClubs.length === 0) {
        setPendingEvents([]);
        setHistoryEvents([]);
        return;
      }

      // Fetch pending and history for target clubs
      const pendingPromises = targetClubs.map(c =>
        api.get(`/clubs/${c.id}/event-approvals`).catch(() => ({ data: { pendingEvents: [] } }))
      );
      const historyPromises = targetClubs.map(c =>
        api.get(`/clubs/${c.id}/my-club-events?academicYear=${academicYear}`).catch(() => ({ data: { events: [] } }))
      );

      const [pendingResponses, historyResponses] = await Promise.all([
        Promise.all(pendingPromises),
        Promise.all(historyPromises),
      ]);

      const allPending = pendingResponses.flatMap(r => r.data?.pendingEvents || []);
      const allHistory = historyResponses
        .flatMap(r => r.data?.events || [])
        .filter(ev => ev.status === 'APPROVED' || ev.status === 'Approved' || ev.status === 'REJECTED');

      setPendingEvents(allPending);
      setHistoryEvents(allHistory);

      if (onCountChange) {
        onCountChange(allPending.length);
      }
    } catch (err) {
      console.error('Failed to load event approvals:', err);
      toast.error('Failed to load event approval requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [selectedClubFilter, academicYear, clubs]);

  // Handle Approve Event
  const handleApprove = async (event) => {
    if (!event) return;
    const confirmed = window.confirm(`Approve event "${event.title}" for ${event.club_name || 'club'}?\n\nOnce approved, it will be published to the common Club Activities portal for all students.`);
    if (!confirmed) return;

    setSubmittingAction(true);
    try {
      const res = await api.patch(`/clubs/${event.club_id}/events/${event.id}/approval`, {
        action: 'APPROVE',
      });
      toast.success(res.data.message || 'Event approved! Now visible to all students.');
      setViewDetailModal(null);
      await loadApprovals();
    } catch (err) {
      console.error('Error approving event:', err);
      toast.error(err.response?.data?.error || 'Failed to approve event');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (event) => {
    setRejectModalEvent(event);
    setRejectionRemark('');
  };

  // Submit Rejection with required remark
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalEvent) return;
    if (!rejectionRemark.trim()) {
      toast.error('A rejection remark is required to guide the student submitter.');
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await api.patch(`/clubs/${rejectModalEvent.club_id}/events/${rejectModalEvent.id}/approval`, {
        action: 'REJECT',
        remark: rejectionRemark.trim(),
      });
      toast.success(res.data.message || 'Event proposal rejected.');
      setRejectModalEvent(null);
      setViewDetailModal(null);
      await loadApprovals();
    } catch (err) {
      console.error('Error rejecting event:', err);
      toast.error(err.response?.data?.error || 'Failed to reject event');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="panel p-6 border-l-4 border-l-[var(--maroon)] bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Governance Workflow
              </span>
              <span className="text-xs text-[var(--ink)]/60 font-medium">AY {academicYear}</span>
            </div>
            <h2 className="font-serif text-xl font-bold text-[var(--ink)]">
              Event Proposal Approvals
            </h2>
            <p className="text-xs text-[var(--ink)]/60 mt-1 max-w-2xl">
              Review and act on event proposals submitted by your club President and Vice President. Only approved events become visible to the student body.
            </p>
          </div>

          {/* Club Filter */}
          {clubs.length > 1 && (
            <div className="shrink-0 flex items-center gap-2">
              <label htmlFor="approval-club-filter" className="text-xs font-semibold text-[var(--ink)]/70">
                Club:
              </label>
              <select
                id="approval-club-filter"
                value={selectedClubFilter}
                onChange={(e) => setSelectedClubFilter(e.target.value)}
                className="input-field text-xs py-1.5 px-3 font-semibold bg-white border border-[var(--rule)] rounded"
              >
                <option value="ALL">All My Clubs ({clubs.length})</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs: Pending vs History */}
      <div className="flex items-center gap-3 border-b border-[var(--rule)]">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-[var(--maroon)] text-[var(--maroon)]'
              : 'border-transparent text-[var(--ink)]/60 hover:text-[var(--ink)]'
          }`}
        >
          <span>Pending Requests</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
              pendingEvents.length > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {pendingEvents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-[var(--maroon)] text-[var(--maroon)]'
              : 'border-transparent text-[var(--ink)]/60 hover:text-[var(--ink)]'
          }`}
        >
          <span>Approval History</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600">
            {historyEvents.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Pending Approvals Table */}
      {activeTab === 'pending' && (
        <div className="panel bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--ink)]/50">
              Loading pending proposals...
            </div>
          ) : pendingEvents.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ink)]/50 space-y-1">
              <p className="font-bold text-sm text-[var(--ink)]/70">No Pending Requests</p>
              <p>All event proposals submitted by your club office bearers have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#EEF0F7] border-b border-[var(--rule)] font-semibold text-[var(--navy)]">
                    <th className="p-3 w-16">Club</th>
                    <th className="p-3">Event Details</th>
                    <th className="p-3">Schedule</th>
                    <th className="p-3">Mode & Venue</th>
                    <th className="p-3">Submitted By</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {pendingEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 align-top font-mono font-bold text-[var(--navy)]">
                        {ev.club_code}
                      </td>
                      <td className="p-3 align-top max-w-xs">
                        <span className="font-bold text-[var(--ink)] block">{ev.title}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                            {ev.event_type}
                          </span>
                          <span className="text-[10px] text-[var(--ink)]/50">
                            Exp: {ev.expected_participants || 60} pax
                          </span>
                        </div>
                      </td>
                      <td className="p-3 align-top whitespace-nowrap">
                        <span className="font-medium text-[var(--ink)] block">
                          {ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'TBD'}
                        </span>
                        <span className="text-[11px] text-[var(--ink)]/60 font-mono">
                          {ev.time || 'All Day'}
                        </span>
                      </td>
                      <td className="p-3 align-top max-w-xs">
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold border inline-block mb-0.5 ${
                            ev.mode === 'Online'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {ev.mode || 'Offline'}
                        </span>
                        <p className="text-[11px] text-[var(--ink)]/80 truncate" title={ev.venue}>
                          {ev.venue}
                        </p>
                      </td>
                      <td className="p-3 align-top whitespace-nowrap">
                        <span className="font-semibold text-[var(--ink)] block">
                          {ev.submitted_by_name || 'Office Bearer'}
                        </span>
                        <span className="text-[10px] text-[var(--ink)]/50 font-mono">
                          {ev.submitted_at ? new Date(ev.submitted_at).toLocaleDateString() : 'Recently'}
                        </span>
                      </td>
                      <td className="p-3 align-top text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setViewDetailModal(ev)}
                          className="px-2.5 py-1 text-xs font-semibold text-[var(--navy)] bg-white hover:bg-slate-100 border border-[var(--rule)] rounded transition-colors"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() => handleApprove(ev)}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() => handleOpenRejectModal(ev)}
                          className="px-2.5 py-1 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors disabled:opacity-50"
                        >
                          Reject
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

      {/* Tab 2: Approval History Table */}
      {activeTab === 'history' && (
        <div className="panel bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          {historyEvents.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--ink)]/50">
              No historical approvals or rejections found for AY {academicYear}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#EEF0F7] border-b border-[var(--rule)] font-semibold text-[var(--navy)]">
                    <th className="p-3 w-16">Club</th>
                    <th className="p-3">Event Title</th>
                    <th className="p-3">Date & Mode</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Remarks / Feedback</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {historyEvents.map((ev) => {
                    const isApproved = ev.status === 'Approved' || ev.status === 'APPROVED';
                    return (
                      <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 align-top font-mono font-bold text-[var(--navy)]">
                          {ev.club_code}
                        </td>
                        <td className="p-3 align-top">
                          <span className="font-bold text-[var(--ink)] block">{ev.title}</span>
                          <span className="text-[10px] text-[var(--ink)]/50">{ev.event_type}</span>
                        </td>
                        <td className="p-3 align-top whitespace-nowrap">
                          <span className="text-[11px] font-medium text-[var(--ink)] block">
                            {ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--ink)]/50">{ev.mode}</span>
                        </td>
                        <td className="p-3 align-top whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {isApproved ? 'Approved' : 'Rejected'}
                          </span>
                        </td>
                        <td className="p-3 align-top max-w-sm text-[11px]">
                          {ev.coordinator_remarks || ev.rejection_remark ? (
                            <span className="text-[var(--ink)]/80 italic">
                              "{ev.coordinator_remarks || ev.rejection_remark}"
                            </span>
                          ) : (
                            <span className="text-[var(--ink)]/30">—</span>
                          )}
                        </td>
                        <td className="p-3 align-top text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewDetailModal(ev)}
                            className="px-2.5 py-1 text-xs font-semibold text-[var(--navy)] hover:bg-slate-100 border border-[var(--rule)] rounded transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Full Event Details View */}
      {viewDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-[var(--rule)] my-8">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-[var(--navy)] border border-[#D5D9E8]">
                    {viewDetailModal.club_code}
                  </span>
                  <span className="text-xs text-[var(--ink)]/60 font-medium">{viewDetailModal.event_type}</span>
                </div>
                <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                  {viewDetailModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailModal(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Date</span>
                  <span className="font-bold text-[var(--ink)]">
                    {viewDetailModal.start_date ? new Date(viewDetailModal.start_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Time</span>
                  <span className="font-bold text-[var(--ink)]">{viewDetailModal.time || 'All Day'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Mode</span>
                  <span className="font-bold text-[var(--ink)]">{viewDetailModal.mode || 'Offline'}</span>
                </div>
                <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">
                    Venue / Meeting Platform
                  </span>
                  <span className="font-bold text-[var(--ink)] break-all">{viewDetailModal.venue}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-[var(--ink)] uppercase block mb-1">
                  Event Description
                </label>
                <div className="p-3 bg-white border border-[var(--rule)] rounded text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {viewDetailModal.description || 'No description provided.'}
                </div>
              </div>

              {/* Submitter & Metadata */}
              <div className="p-3 bg-slate-50/70 border border-slate-200 rounded text-[11px] space-y-1">
                <span className="font-bold text-[var(--ink)] block">Submission Details:</span>
                <p className="text-[var(--ink)]/80">
                  Submitted by: <strong>{viewDetailModal.submitted_by_name || 'Office Bearer'}</strong>
                  {viewDetailModal.submitted_by_roll_no && ` (Roll: ${viewDetailModal.submitted_by_roll_no})`}
                  {viewDetailModal.submitted_by_prn && ` · PRN: ${viewDetailModal.submitted_by_prn}`}
                </p>
                {viewDetailModal.submitted_at && (
                  <p className="text-[var(--ink)]/60 font-mono text-[10px]">
                    Timestamp: {new Date(viewDetailModal.submitted_at).toLocaleString()}
                  </p>
                )}
                {(viewDetailModal.coordinator_remarks || viewDetailModal.rejection_remark) && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="font-bold text-red-800 block">Existing Remark:</span>
                    <p className="italic text-red-900">{viewDetailModal.coordinator_remarks || viewDetailModal.rejection_remark}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-4 border-t border-[var(--rule)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDetailModal(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]/70 hover:text-[var(--ink)] border border-[var(--rule)] rounded bg-white hover:bg-slate-50"
              >
                Close
              </button>

              {viewDetailModal.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => handleOpenRejectModal(viewDetailModal)}
                    className="px-3.5 py-1.5 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors disabled:opacity-50"
                  >
                    Reject Proposal
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={() => handleApprove(viewDetailModal)}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors disabled:opacity-50 shadow-xs"
                  >
                    Approve Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Reject with Required Remark */}
      {rejectModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[var(--rule)] my-8">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-serif text-lg font-bold text-red-900">
                  Reject Event Proposal
                </h3>
                <p className="text-xs text-[var(--ink)]/60 mt-0.5">
                  {rejectModalEvent.title} ({rejectModalEvent.club_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalEvent(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <label htmlFor="rejection-remark-input" className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Rejection Reason / Coordinator Remark *
                </label>
                <p className="text-[11px] text-[var(--ink)]/60 mb-2 leading-relaxed">
                  Provide specific feedback to the student office bearer explaining why the event was rejected. The student will be able to edit and resubmit their proposal.
                </p>
                <textarea
                  id="rejection-remark-input"
                  required
                  rows={4}
                  placeholder="e.g. Please revise the schedule to avoid conflict with Unit Test 2, and clarify lab requirements with the HOD..."
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  className="w-full border border-[var(--rule)] rounded p-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-red-500 bg-white"
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalEvent(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]/70 hover:text-[var(--ink)] border border-[var(--rule)] rounded bg-white hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rejectionRemark.trim() || submittingAction}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded transition-colors disabled:opacity-50"
                >
                  {submittingAction ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
