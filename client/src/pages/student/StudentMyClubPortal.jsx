import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const EVENT_TYPES = [
  'Workshop',
  'Hackathon',
  'Coding Contest',
  'Seminar',
  'Bootcamp',
  'Guest Lecture',
  'Webinar',
  'Technical Project Showcase',
];

export default function StudentMyClubPortal({ roles = [], academicYear = '2026-27', onEventCreated }) {
  const [selectedClubId, setSelectedClubId] = useState(roles[0]?.club_id || null);
  const [myEvents, setMyEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'Workshop',
    start_date: todayStr,
    end_date: '',
    time: '10:00 AM - 04:00 PM',
    mode: 'Offline',
    venue: '',
    expected_participants: 60,
    speaker_or_trainer: '',
    description: '',
  });

  // Resubmit modal state
  const [resubmitModalEvent, setResubmitModalEvent] = useState(null);
  const [resubmitForm, setResubmitForm] = useState(null);
  const [resubmitting, setResubmitting] = useState(false);

  // Update selected club if roles list changes
  useEffect(() => {
    if (roles.length > 0 && (!selectedClubId || !roles.some(r => r.club_id === selectedClubId))) {
      setSelectedClubId(roles[0].club_id);
    }
  }, [roles]);

  const currentRole = roles.find(r => r.club_id === selectedClubId) || roles[0];

  // Fetch events submitted for this club
  const fetchMyClubEvents = async () => {
    if (!selectedClubId) return;
    setLoadingEvents(true);
    try {
      const res = await api.get(`/clubs/${selectedClubId}/my-club-events?academicYear=${academicYear}`);
      setMyEvents(res.data.events || []);
    } catch (err) {
      console.error('Failed to load my club events:', err);
      toast.error('Failed to load submitted club events');
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchMyClubEvents();
  }, [selectedClubId, academicYear]);

  // Handle Event Creation
  const handleHostEventSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return;

    // Validate date cannot be in the past
    if (formData.start_date < todayStr) {
      toast.error('Event date cannot be in the past.');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Event Title is required.');
      return;
    }
    if (!formData.venue.trim()) {
      toast.error('Venue or Platform is required.');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required.');
      return;
    }
    if (formData.description.trim().length > 2500) {
      toast.error('Description must not exceed 2500 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/clubs/${selectedClubId}/propose-event`, {
        ...formData,
        academic_year: academicYear,
      });
      toast.success(res.data.message || 'Event proposal submitted for Coordinator approval!');
      // Reset form
      setFormData({
        title: '',
        event_type: 'Workshop',
        start_date: todayStr,
        end_date: '',
        time: '10:00 AM - 04:00 PM',
        mode: 'Offline',
        venue: '',
        expected_participants: 60,
        speaker_or_trainer: '',
        description: '',
      });
      await fetchMyClubEvents();
      if (onEventCreated) onEventCreated();
    } catch (err) {
      console.error('Error submitting event proposal:', err);
      toast.error(err.response?.data?.error || 'Failed to submit event proposal');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Resubmit Modal for Rejected Event
  const handleOpenResubmitModal = (ev) => {
    setResubmitModalEvent(ev);
    setResubmitForm({
      title: ev.title || '',
      event_type: ev.event_type || 'Workshop',
      start_date: ev.start_date ? new Date(ev.start_date).toISOString().split('T')[0] : todayStr,
      end_date: ev.end_date ? new Date(ev.end_date).toISOString().split('T')[0] : '',
      time: ev.time || '',
      mode: ev.mode || 'Offline',
      venue: ev.venue || '',
      expected_participants: ev.expected_participants || 60,
      speaker_or_trainer: ev.speaker_or_trainer || '',
      description: ev.description || '',
    });
  };

  // Confirm Resubmit
  const handleConfirmResubmit = async (e) => {
    e.preventDefault();
    if (!resubmitModalEvent || !resubmitForm) return;

    if (resubmitForm.start_date < todayStr) {
      toast.error('Event date cannot be in the past.');
      return;
    }
    if (!resubmitForm.title.trim()) {
      toast.error('Event Title is required.');
      return;
    }
    if (!resubmitForm.venue.trim()) {
      toast.error('Venue or Platform is required.');
      return;
    }
    if (!resubmitForm.description.trim()) {
      toast.error('Description is required.');
      return;
    }

    setResubmitting(true);
    try {
      const res = await api.put(
        `/clubs/${selectedClubId}/events/${resubmitModalEvent.id}/resubmit`,
        resubmitForm
      );
      toast.success(res.data.message || 'Event updated and resubmitted for Coordinator approval!');
      setResubmitModalEvent(null);
      await fetchMyClubEvents();
      if (onEventCreated) onEventCreated();
    } catch (err) {
      console.error('Error resubmitting event:', err);
      toast.error(err.response?.data?.error || 'Failed to resubmit event');
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Office Bearer Header Card */}
      <div className="panel p-6 border-l-4 border-l-[var(--maroon)] bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-[var(--navy)] border border-[#D5D9E8]">
                {currentRole?.club_code || 'CLUB'}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                {currentRole?.role || 'Office Bearer'}
              </span>
              <span className="text-xs text-[var(--ink)]/60 font-medium">AY {academicYear}</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-[var(--ink)]">
              {currentRole?.club_name || 'My Club Portal'}
            </h2>
            <p className="text-xs text-[var(--ink)]/60 mt-1 max-w-2xl leading-relaxed">
              As the club {currentRole?.role}, you can propose events for department approval. Once your faculty coordinator reviews and approves the request, the event will be published to the common Club Activities portal for all students.
            </p>
          </div>

          {/* Multi-Club Selector if applicable */}
          {roles.length > 1 && (
            <div className="shrink-0 flex items-center gap-2">
              <label htmlFor="student-club-select" className="text-xs font-semibold text-[var(--ink)]/70">
                Managing:
              </label>
              <select
                id="student-club-select"
                value={selectedClubId || ''}
                onChange={(e) => setSelectedClubId(Number(e.target.value))}
                className="input-field text-xs py-1.5 px-3 font-semibold bg-white border border-[var(--rule)] rounded"
              >
                {roles.map((r) => (
                  <option key={r.club_id} value={r.club_id}>
                    {r.club_name} ({r.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid: 2 Columns - Event Form & Events Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col (5 cols): Host Event Form */}
        <div className="lg:col-span-5">
          <div className="panel p-6 bg-white border border-[var(--rule)] rounded-xl shadow-xs">
            <div className="pb-3 mb-4 border-b border-[var(--rule)]">
              <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                Host / Propose Event
              </h3>
              <p className="text-[11px] text-[var(--ink)]/60 mt-0.5">
                All fields are required. Submissions undergo faculty coordinator review.
              </p>
            </div>

            <form onSubmit={handleHostEventSubmit} className="space-y-4 text-xs">
              {/* Club Name (Auto-filled, Read-only) */}
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  Club Name (Read-only)
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${currentRole?.club_name || ''} (${currentRole?.club_code || ''})`}
                  className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs bg-slate-100 text-[var(--ink)]/70 font-semibold cursor-not-allowed select-none"
                />
              </div>

              {/* Event Title */}
              <div>
                <label htmlFor="event-title-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  Event Title *
                </label>
                <input
                  id="event-title-input"
                  type="text"
                  required
                  placeholder="e.g. CodeCraft: 24-Hour Hackathon"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white font-medium"
                />
              </div>

              {/* Event Type & Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-type-select" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Event Type *
                  </label>
                  <select
                    id="event-type-select"
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="event-mode-select" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Mode *
                  </label>
                  <select
                    id="event-mode-select"
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white font-medium"
                  >
                    <option value="Offline">Offline (Campus)</option>
                    <option value="Online">Online (Platform)</option>
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-date-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Event Date *
                  </label>
                  <input
                    id="event-date-input"
                    type="date"
                    required
                    min={todayStr}
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white font-medium"
                  />
                  <span className="text-[10px] text-[var(--ink)]/40 mt-0.5 block">Cannot be in past</span>
                </div>

                <div>
                  <label htmlFor="event-time-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Time *
                  </label>
                  <input
                    id="event-time-input"
                    type="text"
                    required
                    placeholder="10:00 AM - 04:00 PM"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white"
                  />
                </div>
              </div>

              {/* Venue / Link (Adapts dynamically to Mode) */}
              <div>
                <label htmlFor="event-venue-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  {formData.mode === 'Online'
                    ? 'Meeting Platform or Link *'
                    : 'Venue / Location *'}
                </label>
                <input
                  id="event-venue-input"
                  type="text"
                  required
                  placeholder={
                    formData.mode === 'Online'
                      ? 'e.g. Google Meet / MS Teams link (https://meet.google.com/...)'
                      : 'e.g. Seminar Hall 1 / Computer Lab 302'
                  }
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white"
                />
              </div>

              {/* Expected Pax & Speaker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-pax-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Expected Pax
                  </label>
                  <input
                    id="event-pax-input"
                    type="number"
                    min="5"
                    max="500"
                    value={formData.expected_participants}
                    onChange={(e) => setFormData({ ...formData, expected_participants: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="event-speaker-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Speaker / Trainer
                  </label>
                  <input
                    id="event-speaker-input"
                    type="text"
                    placeholder="Optional expert name"
                    value={formData.speaker_or_trainer}
                    onChange={(e) => setFormData({ ...formData, speaker_or_trainer: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="event-desc-input" className="block text-[11px] font-bold text-[var(--ink)] uppercase">
                    Description *
                  </label>
                  <span className="text-[10px] text-[var(--ink)]/50 font-mono">
                    {formData.description.length} / 2500
                  </span>
                </div>
                <textarea
                  id="event-desc-input"
                  required
                  rows={4}
                  maxLength={2500}
                  placeholder="Outline event agenda, prerequisites, learning outcomes, and schedule..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded p-2.5 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white leading-relaxed"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-[var(--maroon)] hover:bg-[#680000] text-white text-xs font-bold rounded transition-colors shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Submitting Proposal...' : 'Submit Event for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Col (7 cols): Submitted Events Tracker */}
        <div className="lg:col-span-7 space-y-4">
          <div className="panel p-6 bg-white border border-[var(--rule)] rounded-xl shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                  Submitted Events Tracker
                </h3>
                <p className="text-[11px] text-[var(--ink)]/60 mt-0.5">
                  Track coordinator approval status (Pending / Approved / Rejected) for {currentRole?.club_name}.
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-[var(--ink)]/50">
                {myEvents.length} Recorded
              </span>
            </div>

            {loadingEvents ? (
              <div className="py-12 text-center text-xs text-[var(--ink)]/50">
                Loading submitted events...
              </div>
            ) : myEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--ink)]/50 space-y-1">
                <p className="font-bold text-sm text-[var(--ink)]/70">No Events Submitted Yet</p>
                <p>Use the form on the left to propose your club's first activity for AY {academicYear}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myEvents.map((ev) => {
                  const isApproved = ev.status === 'Approved' || ev.status === 'APPROVED';
                  const isPending = ev.status === 'PENDING' || ev.status === 'Submitted';
                  const isRejected = ev.status === 'REJECTED';

                  return (
                    <div
                      key={ev.id}
                      className="p-4 rounded-lg border border-[var(--rule)] bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-3"
                    >
                      {/* Event Row Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white border border-[var(--rule)] text-[var(--navy)]">
                              {ev.event_type}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isPending
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-red-50 text-red-800 border-red-200'
                              }`}
                            >
                              {isApproved
                                ? 'Approved — Live on Portal'
                                : isPending
                                ? 'Pending Approval'
                                : 'Rejected'}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-[var(--ink)]">{ev.title}</h4>
                        </div>

                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => handleOpenResubmitModal(ev)}
                            className="shrink-0 px-2.5 py-1 text-xs font-bold text-[var(--maroon)] bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                          >
                            Edit &amp; Resubmit
                          </button>
                        )}
                      </div>

                      {/* Event Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-white p-2.5 rounded border border-slate-200">
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Date</span>
                          <span className="font-medium text-[var(--ink)]">
                            {ev.start_date ? new Date(ev.start_date).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Time</span>
                          <span className="text-[var(--ink)]">{ev.time || 'All Day'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Mode</span>
                          <span className="font-medium text-[var(--ink)]">{ev.mode || 'Offline'}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-100 truncate">
                          <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Venue / Platform</span>
                          <span className="text-[var(--ink)]">{ev.venue}</span>
                        </div>
                      </div>

                      {/* Description Preview */}
                      {ev.description && (
                        <p className="text-[11px] text-[var(--ink)]/70 line-clamp-2 leading-relaxed">
                          {ev.description}
                        </p>
                      )}

                      {/* Rejection Remark Callout */}
                      {isRejected && (ev.coordinator_remarks || ev.rejection_remark) && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-900 space-y-0.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider block text-red-800">
                            Coordinator Feedback / Remark:
                          </span>
                          <p className="italic text-[11px] leading-relaxed">
                            "{ev.coordinator_remarks || ev.rejection_remark}"
                          </p>
                        </div>
                      )}

                      {/* Meta Footer */}
                      <div className="text-[10px] text-[var(--ink)]/40 font-mono flex items-center justify-between pt-1 border-t border-slate-200">
                        <span>Submitted on {ev.submitted_at ? new Date(ev.submitted_at).toLocaleDateString() : 'Recently'}</span>
                        {isApproved && <span>Public to all students</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Edit & Resubmit Rejected Event */}
      {resubmitModalEvent && resubmitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[var(--rule)] my-8">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                  Edit &amp; Resubmit Event Proposal
                </h3>
                <p className="text-xs text-[var(--ink)]/60 mt-0.5">
                  Address coordinator feedback and resubmit for approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModalEvent(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Display Previous Rejection Remark */}
            {(resubmitModalEvent.coordinator_remarks || resubmitModalEvent.rejection_remark) && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900">
                <span className="font-bold block text-[10px] uppercase text-red-800">Coordinator Remark to Address:</span>
                <p className="italic mt-0.5">"{resubmitModalEvent.coordinator_remarks || resubmitModalEvent.rejection_remark}"</p>
              </div>
            )}

            <form onSubmit={handleConfirmResubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={resubmitForm.title}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, title: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs focus:ring-1 focus:ring-[var(--navy)] bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Event Type *
                  </label>
                  <select
                    value={resubmitForm.event_type}
                    onChange={(e) => setResubmitForm({ ...resubmitForm, event_type: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs bg-white"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Mode *
                  </label>
                  <select
                    value={resubmitForm.mode}
                    onChange={(e) => setResubmitForm({ ...resubmitForm, mode: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs bg-white"
                  >
                    <option value="Offline">Offline</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={resubmitForm.start_date}
                    onChange={(e) => setResubmitForm({ ...resubmitForm, start_date: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                    Time *
                  </label>
                  <input
                    type="text"
                    required
                    value={resubmitForm.time}
                    onChange={(e) => setResubmitForm({ ...resubmitForm, time: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-2 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  Venue / Meeting Link *
                </label>
                <input
                  type="text"
                  required
                  value={resubmitForm.venue}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, venue: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] uppercase mb-1">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={resubmitForm.description}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, description: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded p-2.5 text-xs bg-white"
                />
              </div>

              <div className="pt-3 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResubmitModalEvent(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]/70 hover:text-[var(--ink)] border border-[var(--rule)] rounded bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[var(--maroon)] hover:bg-[#680000] rounded transition-colors disabled:opacity-50"
                >
                  {resubmitting ? 'Resubmitting...' : 'Resubmit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
