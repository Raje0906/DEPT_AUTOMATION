import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { ClubLogo } from '../faculty/ManageClubs';

export default function StudentClubActivities() {
  const { user } = useAuth();
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [selectedClubFilter, setSelectedClubFilter] = useState('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'registered' | 'all' | 'clubs'

  // Modal detail view
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedClubDetails, setSelectedClubDetails] = useState(null);
  const [clubMembers, setClubMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Registration modal state
  const [registeringEvent, setRegisteringEvent] = useState(null);
  const [submittingReg, setSubmittingReg] = useState(false);
  const [cancellingReg, setCancellingReg] = useState(false);
  const [regFormData, setRegFormData] = useState({
    student_name: '',
    prn: '',
    roll_no: '',
    division: '',
    class_year: 'TE',
    email: '',
    contact_no: '',
    notes: '',
  });

  // Fetch all activities & clubs
  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, clubsRes] = await Promise.all([
        api.get(`/clubs/events?academicYear=${academicYear}`),
        api.get(`/clubs?academicYear=${academicYear}`),
      ]);
      setEvents(eventsRes.data.events || []);
      setClubs(clubsRes.data.clubs || []);
    } catch (err) {
      console.error('Failed to load club activities', err);
      toast.error('Failed to load club activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear]);

  // Open Registration Modal with prefilled student details
  const handleOpenRegistrationModal = (ev) => {
    setRegisteringEvent(ev);
    const divStr = user?.division
      ? (user.division.startsWith(user?.class_year || 'TE') ? user.division : `${user?.class_year || 'TE'}-${user.division}`)
      : 'TE-B';
    setRegFormData({
      student_name: user?.name || '',
      prn: user?.enrollment_no || user?.roll_no || '',
      roll_no: user?.roll_no || '',
      division: divStr,
      class_year: user?.class_year || 'TE',
      email: user?.email || '',
      contact_no: user?.mobile || '',
      notes: '',
    });
  };

  // Submit Registration
  const handleConfirmRegistration = async (e) => {
    e.preventDefault();
    if (!registeringEvent) return;
    setSubmittingReg(true);
    try {
      const res = await api.post(`/clubs/events/${registeringEvent.id}/register`, regFormData);
      toast.success(res.data.message || `Registered for "${registeringEvent.title}"!`);

      // Update state locally
      setEvents((prev) =>
        prev.map((item) =>
          item.id === registeringEvent.id
            ? {
                ...item,
                is_registered: true,
                registration_status: 'Registered',
                registered_at: new Date().toISOString(),
                registered_count: (item.registered_count || 0) + 1,
              }
            : item
        )
      );

      if (selectedEvent && selectedEvent.id === registeringEvent.id) {
        setSelectedEvent((prev) => ({
          ...prev,
          is_registered: true,
          registration_status: 'Registered',
          registered_at: new Date().toISOString(),
          registered_count: (prev.registered_count || 0) + 1,
        }));
      }

      setRegisteringEvent(null);
    } catch (err) {
      console.error('Registration failed:', err);
      toast.error(err.response?.data?.error || 'Failed to register for event');
    } finally {
      setSubmittingReg(false);
    }
  };

  // Cancel Registration
  const handleCancelRegistration = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to cancel your registration for "${title}"?`)) {
      return;
    }
    setCancellingReg(true);
    try {
      await api.delete(`/clubs/events/${eventId}/register`);
      toast.success('Registration cancelled successfully');

      // Update state locally
      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? {
                ...item,
                is_registered: false,
                registration_status: null,
                registered_at: null,
                registered_count: Math.max(0, (item.registered_count || 1) - 1),
              }
            : item
        )
      );

      if (selectedEvent && selectedEvent.id === eventId) {
        setSelectedEvent((prev) => ({
          ...prev,
          is_registered: false,
          registration_status: null,
          registered_at: null,
          registered_count: Math.max(0, (prev.registered_count || 1) - 1),
        }));
      }

      setRegisteringEvent(null);
    } catch (err) {
      console.error('Failed to cancel registration:', err);
      toast.error('Failed to cancel registration');
    } finally {
      setCancellingReg(false);
    }
  };

  // Load committee members for selected club
  const handleOpenClubModal = async (club) => {
    setSelectedClubDetails(club);
    setMembersLoading(true);
    try {
      const res = await api.get(`/clubs/${club.id}/members?academicYear=${academicYear}`);
      setClubMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to load club members', err);
    } finally {
      setMembersLoading(false);
    }
  };

  // Helper date formatting
  const formatDateBadge = (dateStr) => {
    if (!dateStr) return { day: '—', month: '', full: 'TBA' };
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const full = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return { day, month, full };
  };

  // Filter events
  const today = new Date().toISOString().split('T')[0];

  const filteredEvents = events.filter((ev) => {
    const evDate = ev.start_date ? ev.start_date.split('T')[0] : '';
    const isUpcoming = evDate >= today || ev.status === 'Approved';

    // Tab filter
    if (activeTab === 'upcoming' && !isUpcoming) return false;
    if (activeTab === 'registered' && !ev.is_registered) return false;

    // Club filter
    if (selectedClubFilter !== 'ALL' && String(ev.club_id) !== String(selectedClubFilter)) {
      return false;
    }

    // Type filter
    if (selectedTypeFilter !== 'ALL' && ev.event_type !== selectedTypeFilter) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (ev.title || '').toLowerCase().includes(q);
      const matchClub = (ev.club_name || '').toLowerCase().includes(q);
      const matchSpeaker = (ev.speaker_or_trainer || '').toLowerCase().includes(q);
      const matchDesc = (ev.description || '').toLowerCase().includes(q);
      const matchVenue = (ev.venue || '').toLowerCase().includes(q);
      return matchTitle || matchClub || matchSpeaker || matchDesc || matchVenue;
    }

    return true;
  });

  const upcomingCount = events.filter((e) => {
    const d = e.start_date ? e.start_date.split('T')[0] : '';
    return d >= today || e.status === 'Approved';
  }).length;

  const registeredCount = events.filter((e) => e.is_registered).length;

  const eventTypes = ['ALL', 'Workshop', 'Hackathon', 'Coding Contest', 'Seminar', 'Bootcamp'];

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-rule">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-draft uppercase tracking-wider mb-1">
            <Link to="/student" className="hover:text-navy transition-colors">
              Student Portal
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">Student Clubs &amp; Activities</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            Department Club Activities &amp; Events
          </h1>
          <p className="text-base text-draft mt-1 font-medium">
            Explore and register for workshops, hackathons, coding contests, and guest lectures conducted by departmental clubs and SIH cell.
          </p>
        </div>

        {/* AY Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-rule rounded">
            <label className="text-xs font-bold text-draft uppercase tracking-wider">AY:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="text-xs font-semibold text-ink bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="2026-27">2026-27 (Current)</option>
              <option value="2025-26">2025-26</option>
              <option value="2024-25">2024-25</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="panel p-4 bg-white border border-rule">
          <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Upcoming Activities</p>
          <p className="font-mono text-3xl font-bold text-navy mt-1">{upcomingCount}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Scheduled for AY {academicYear}</p>
        </div>

        <div className="panel p-4 bg-white border border-rule">
          <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">My Registrations</p>
          <p className="font-mono text-3xl font-bold text-maroon mt-1">{registeredCount}</p>
          <p className="text-[11px] text-draft mt-0.5">Activities Enrolled</p>
        </div>

        <div className="panel p-4 bg-white border border-rule">
          <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Department Chapters</p>
          <p className="font-mono text-3xl font-bold text-ink mt-1">{clubs.length || 7}</p>
          <p className="text-[11px] text-draft mt-0.5">6 Technical Clubs + SIH Cell</p>
        </div>

        <div className="panel p-4 bg-white border border-rule">
          <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Open Participation</p>
          <p className="font-mono text-3xl font-bold text-emerald-700 mt-1">SE · TE · BE</p>
          <p className="text-[11px] text-draft mt-0.5">All Computer Engineering students</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-rule mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'border-maroon text-maroon'
              : 'border-transparent text-draft hover:text-ink'
          }`}
        >
          <span>Upcoming Activities</span>
          <span className="badge badge-approved text-[10px] py-0 px-2 font-mono">
            {upcomingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('registered')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'registered'
              ? 'border-maroon text-maroon'
              : 'border-transparent text-draft hover:text-ink'
          }`}
        >
          <span>My Registered Events</span>
          {registeredCount > 0 ? (
            <span className="badge bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] py-0 px-2 font-mono font-bold">
              {registeredCount}
            </span>
          ) : (
            <span className="text-xs text-draft font-mono">(0)</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'all'
              ? 'border-maroon text-maroon'
              : 'border-transparent text-draft hover:text-ink'
          }`}
        >
          <span>All AY Events</span>
          <span className="text-xs text-draft font-mono">({events.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clubs')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'clubs'
              ? 'border-maroon text-maroon'
              : 'border-transparent text-draft hover:text-ink'
          }`}
        >
          <span>Explore Clubs &amp; SIH</span>
          <span className="text-xs text-draft font-mono">({clubs.length})</span>
        </button>
      </div>

      {/* ─── TAB: ACTIVITIES LISTING (UPCOMING / REGISTERED / ALL) ─────────────── */}
      {activeTab !== 'clubs' && (
        <div>
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded border border-rule mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search activities by title, speaker, club, venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-xs pl-8 py-2 w-full"
              />
              <svg
                className="w-3.5 h-3.5 text-draft absolute left-2.5 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Club Dropdown Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-draft font-semibold uppercase tracking-wider text-[10px]">Club:</span>
                <select
                  value={selectedClubFilter}
                  onChange={(e) => setSelectedClubFilter(e.target.value)}
                  className="input-field text-xs py-1.5 px-2 font-medium"
                >
                  <option value="ALL">All Clubs &amp; Chapters</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Type Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-draft font-semibold uppercase tracking-wider text-[10px]">Type:</span>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="input-field text-xs py-1.5 px-2 font-medium"
                >
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>
                      {t === 'ALL' ? 'All Activity Types' : t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Club Filter Quick Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 text-xs scrollbar-thin">
            <span className="text-draft text-[11px] font-semibold uppercase tracking-wider shrink-0 mr-1">
              Filter by Club:
            </span>
            <button
              type="button"
              onClick={() => setSelectedClubFilter('ALL')}
              className={`px-3 py-1 rounded-full font-bold text-xs transition-colors shrink-0 ${
                selectedClubFilter === 'ALL'
                  ? 'bg-navy text-white'
                  : 'bg-paper text-draft hover:text-ink border border-rule'
              }`}
            >
              All Entities ({events.length})
            </button>
            {clubs.map((club) => {
              const count = events.filter((ev) => String(ev.club_id) === String(club.id)).length;
              const isSelected = String(selectedClubFilter) === String(club.id);
              return (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => setSelectedClubFilter(isSelected ? 'ALL' : String(club.id))}
                  className={`px-3 py-1 rounded-full font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-navy text-white'
                      : 'bg-paper text-draft hover:text-ink border border-rule'
                  }`}
                >
                  <span>{club.code}</span>
                  <span className={`text-[10px] px-1.5 py-0 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Activity Cards List */}
          {loading ? (
            <div className="panel p-12 text-center text-draft text-sm">
              Loading club activities calendar...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="panel p-12 text-center border-dashed border-rule">
              <div className="w-12 h-12 rounded bg-paper flex items-center justify-center mx-auto mb-3 text-draft">
                {activeTab === 'registered' ? '🎟️' : '📅'}
              </div>
              <h3 className="font-serif text-lg font-bold text-ink">
                {activeTab === 'registered' ? 'No registered activities yet' : 'No activities found'}
              </h3>
              <p className="text-sm text-draft mt-1 max-w-md mx-auto">
                {activeTab === 'registered'
                  ? 'You have not registered for any club activities yet. Explore upcoming workshops and hackathons below to register!'
                  : searchQuery || selectedClubFilter !== 'ALL' || selectedTypeFilter !== 'ALL'
                  ? 'No club activities matched your search filters. Try clearing filters to see all events.'
                  : 'No activities have been scheduled for this academic year yet.'}
              </p>
              {activeTab === 'registered' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className="btn-primary text-xs mt-4"
                >
                  Browse Upcoming Activities &rarr;
                </button>
              ) : (searchQuery || selectedClubFilter !== 'ALL' || selectedTypeFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedClubFilter('ALL');
                    setSelectedTypeFilter('ALL');
                  }}
                  className="btn-secondary text-xs mt-4"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEvents.map((ev) => {
                const dateInfo = formatDateBadge(ev.start_date);
                const isSIH = ev.club_code === 'SIH';
                const isRegistered = !!ev.is_registered;

                return (
                  <div
                    key={ev.id}
                    className={`panel bg-white border rounded overflow-hidden flex flex-col transition-all group ${
                      isRegistered
                        ? 'border-emerald-400 shadow-sm'
                        : 'border-rule hover:border-navy hover:shadow-md'
                    }`}
                  >
                    {/* Top strip with club code & type badge */}
                    <div className="p-4 border-b border-rule bg-[#FAF9F5] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ClubLogo club={{ code: ev.club_code, name: ev.club_name, logo_url: ev.club_logo_url }} className="w-6 h-6" />
                        <span className="text-[11px] text-ink font-semibold truncate max-w-[140px]" title={ev.club_name}>
                          {ev.club_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRegistered && (
                          <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0.5 px-2 font-bold">
                            ✓ Registered
                          </span>
                        )}
                        <span className="badge badge-approved text-[10px] py-0.5 px-2">
                          {ev.event_type || 'Event'}
                        </span>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Date & Title */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-12 h-13 rounded bg-navy/5 border border-navy/20 flex flex-col items-center justify-center shrink-0 text-center py-1">
                            <span className="text-[10px] font-bold text-navy uppercase leading-none tracking-wider">
                              {dateInfo.month}
                            </span>
                            <span className="text-lg font-bold font-mono text-ink leading-tight">
                              {dateInfo.day}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-serif text-base font-bold text-ink leading-snug group-hover:text-navy transition-colors">
                              {ev.title}
                            </h3>
                            <p className="text-[11px] text-draft font-mono mt-0.5">
                              {dateInfo.full}
                            </p>
                          </div>
                        </div>

                        {/* Description snippet */}
                        <p className="text-xs text-draft line-clamp-3 mb-4 leading-relaxed">
                          {ev.description || 'Comprehensive technical workshop organized by student core committee and faculty coordinator.'}
                        </p>

                        {/* Key Info Meta */}
                        <div className="space-y-1.5 text-xs text-draft bg-paper p-3 rounded border border-rule mb-4 font-mono">
                          {ev.time && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-ink font-semibold">🕒 Time:</span>
                              <span className="truncate">{ev.time}</span>
                            </div>
                          )}
                          {ev.venue && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-ink font-semibold">📍 Venue:</span>
                              <span className="truncate text-navy font-semibold">{ev.venue}</span>
                            </div>
                          )}
                          {ev.speaker_or_trainer && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-ink font-semibold">🎙️ Trainer:</span>
                              <span className="truncate text-ink">{ev.speaker_or_trainer}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-ink font-semibold">🌐 Mode:</span>
                            <span className="badge bg-slate-100 text-slate-800 text-[10px] px-1.5 py-0">
                              {ev.mode || 'Offline'}
                            </span>
                            {ev.expected_participants > 0 && (
                              <span className="text-draft ml-auto font-sans text-[10px]">
                                Seats: {ev.registered_count || ev.actual_participants || 0} / {ev.expected_participants}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions (Register + View Details) */}
                      <div className="flex items-center gap-2 pt-3 border-t border-rule mt-auto">
                        {isRegistered ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRegistrationModal(ev)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded flex-1 flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          >
                            <span>✓</span>
                            <span>Registered</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRegistrationModal(ev)}
                            className="btn-primary text-xs py-1.5 px-3 flex-1 justify-center shadow-sm cursor-pointer"
                          >
                            Register for Event
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedEvent(ev)}
                          className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: EXPLORE ALL 7 CLUBS & CHAPTERS ─────────────────────────────── */}
      {activeTab === 'clubs' && (
        <div className="space-y-6">
          <div className="p-4 bg-[#FAF9F5] border border-rule rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">
                Department Student Chapters &amp; SIH Cell
              </h2>
              <p className="text-xs text-draft mt-0.5">
                Overview of the 6 specialized technical bodies and the national Smart India Hackathon coordination committee.
              </p>
            </div>
            <span className="badge badge-approved text-xs px-3 py-1 font-mono">
              AY {academicYear} Active Units
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {clubs.map((club) => {
              const clubEvents = events.filter((e) => String(e.club_id) === String(club.id));
              const isSIH = club.code === 'SIH';

              return (
                <div
                  key={club.id}
                  className="panel bg-white border border-rule rounded overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-rule bg-[#FAF9F5] flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ClubLogo club={club} className="w-12 h-12" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-base font-bold text-ink leading-snug">
                            {club.name}
                          </h3>
                        </div>
                        {club.motto && (
                          <p className="text-xs text-draft italic mt-0.5 line-clamp-1">
                            “{club.motto}”
                          </p>
                        )}
                        <span className="badge badge-draft text-[10px] mt-1">
                          {club.category}
                        </span>
                      </div>
                    </div>

                    <span className="badge badge-approved text-[10px] py-0.5 px-2 font-mono">
                      {club.status}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-draft leading-relaxed mb-4">
                      {club.description || 'Active technical chapter organizing workshops, hackathons, and certifications.'}
                    </p>

                    {/* Key Leaders Strip */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-paper p-3 rounded border border-rule mb-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-draft block">
                          Student President / Lead
                        </span>
                        <p className="font-bold text-ink mt-0.5 truncate">
                          {club.student_lead_name || 'Designated by Faculty'}
                        </p>
                        {club.student_lead_division && (
                          <span className="text-[10px] font-mono text-draft block">
                            Class: {club.student_lead_division}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-draft block">
                          Faculty In-Charge
                        </span>
                        <p className="font-bold text-ink mt-0.5 truncate">
                          {club.faculty_name || 'Department Faculty'}
                        </p>
                        <span className="text-[10px] text-draft block">
                          {club.faculty_designation || 'Faculty Coordinator'}
                        </span>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-rule mt-auto">
                      <div className="flex items-center gap-3 text-xs font-mono text-draft">
                        <span>Activities: <strong className="text-navy">{clubEvents.length}</strong></span>
                        <span>·</span>
                        <span>Core Team: <strong className="text-ink">{club.member_count || 0}</strong></span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenClubModal(club)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        View Team &amp; Roster
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL: EVENT REGISTRATION ───────────────────────────────────────── */}
      {registeringEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded border border-rule w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-rule flex items-start justify-between gap-4 bg-[#FAF9F5]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-navy text-white text-[10px] font-bold px-2 py-0.5">
                    {registeringEvent.club_code}
                  </span>
                  <span className="badge badge-approved text-[10px] px-2 py-0.5">
                    {registeringEvent.event_type}
                  </span>
                  <span className="text-xs text-draft font-semibold">
                    {registeringEvent.club_name}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-ink leading-snug">
                  {registeringEvent.is_registered ? 'Your Registration Details' : `Register for ${registeringEvent.title}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRegisteringEvent(null)}
                className="text-draft hover:text-ink text-xl font-mono leading-none p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Event Quick Info Banner */}
              <div className="p-3 bg-paper rounded border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-draft">📅 Date &amp; Time: </span>
                  <span className="font-bold text-ink">{formatDateBadge(registeringEvent.start_date).full} ({registeringEvent.time || '10:00 AM'})</span>
                </div>
                <div>
                  <span className="text-draft">📍 Venue: </span>
                  <span className="font-bold text-navy">{registeringEvent.venue || 'Campus Labs'}</span>
                </div>
              </div>

              {/* Already Registered Status Card */}
              {registeringEvent.is_registered ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm mb-1">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">✓</span>
                      <span>You are registered for this activity!</span>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Your seat is confirmed. Please report to <strong>{registeringEvent.venue}</strong> on <strong>{formatDateBadge(registeringEvent.start_date).full}</strong> at <strong>{registeringEvent.time || 'the scheduled time'}</strong>.
                    </p>
                    {registeringEvent.registered_at && (
                      <p className="text-[11px] font-mono text-emerald-700 mt-2">
                        Registered on: {new Date(registeringEvent.registered_at).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-paper rounded border border-rule space-y-2 text-xs">
                    <h5 className="font-bold uppercase tracking-wider text-navy text-[10px]">Registered Student Info</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-draft block">Name:</span>
                        <strong className="text-ink">{user?.name}</strong>
                      </div>
                      <div>
                        <span className="text-draft block">PRN / Roll:</span>
                        <strong className="text-ink">{user?.enrollment_no || user?.roll_no}</strong>
                      </div>
                      <div>
                        <span className="text-draft block">Class:</span>
                        <strong className="text-ink">{user?.division ? `${user?.class_year || 'TE'}-${user.division}` : 'TE-B'}</strong>
                      </div>
                      <div>
                        <span className="text-draft block">Email:</span>
                        <strong className="text-ink">{user?.email}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={cancellingReg}
                      onClick={() => handleCancelRegistration(registeringEvent.id, registeringEvent.title)}
                      className="text-xs text-fail hover:underline font-bold cursor-pointer"
                    >
                      {cancellingReg ? 'Cancelling...' : 'Cancel Registration'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegisteringEvent(null)}
                      className="btn-secondary text-xs py-2 px-5"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* Registration Form */
                <form onSubmit={handleConfirmRegistration} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">Student Name</label>
                      <input
                        type="text"
                        required
                        value={regFormData.student_name}
                        onChange={(e) => setRegFormData({ ...regFormData, student_name: e.target.value })}
                        className="input-field text-xs py-1.5 font-medium"
                      />
                    </div>

                    <div>
                      <label className="input-label">PRN No / Roll No</label>
                      <input
                        type="text"
                        required
                        value={regFormData.prn}
                        onChange={(e) => setRegFormData({ ...regFormData, prn: e.target.value })}
                        className="input-field text-xs py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="input-label">Class &amp; Division</label>
                      <input
                        type="text"
                        required
                        value={regFormData.division}
                        onChange={(e) => setRegFormData({ ...regFormData, division: e.target.value })}
                        className="input-field text-xs py-1.5 font-semibold text-navy"
                      />
                    </div>

                    <div>
                      <label className="input-label">Official Email</label>
                      <input
                        type="email"
                        required
                        value={regFormData.email}
                        onChange={(e) => setRegFormData({ ...regFormData, email: e.target.value })}
                        className="input-field text-xs py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="input-label">Contact / WhatsApp Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={regFormData.contact_no}
                        onChange={(e) => setRegFormData({ ...regFormData, contact_no: e.target.value })}
                        className="input-field text-xs py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="input-label">Target Audience</label>
                      <div className="text-xs font-mono py-2 text-ink font-semibold">
                        SE · TE · BE Computer
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Note / Motivation (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Interested in cloud architectures or national SIH hackathon team registration..."
                      value={regFormData.notes}
                      onChange={(e) => setRegFormData({ ...regFormData, notes: e.target.value })}
                      className="input-field text-xs py-1.5 resize-none"
                    />
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded text-xs text-navy flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>No registration fee. Open to all registered students of Computer Engineering department.</span>
                  </div>

                  <div className="pt-3 border-t border-rule flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisteringEvent(null)}
                      className="btn-secondary text-xs py-2 px-4"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReg}
                      className="btn-primary text-xs py-2 px-5 shadow-sm cursor-pointer"
                    >
                      {submittingReg ? 'Confirming...' : 'Confirm Registration'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: EVENT DETAILS & AGENDA ──────────────────────────────────── */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-rule flex items-start justify-between gap-4 bg-[#FAF9F5]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-navy text-white text-[10px] font-bold px-2 py-0.5">
                    {selectedEvent.club_code}
                  </span>
                  <span className="badge badge-approved text-[10px] px-2 py-0.5">
                    {selectedEvent.event_type}
                  </span>
                  <span className="text-xs text-draft font-semibold">
                    {selectedEvent.club_name}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold text-ink leading-snug">
                  {selectedEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-draft hover:text-ink text-xl font-mono leading-none p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Timing & Venue Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-paper p-4 rounded border border-rule">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-draft block">Date</span>
                  <p className="font-bold text-sm text-ink font-mono mt-0.5">
                    {formatDateBadge(selectedEvent.start_date).full}
                  </p>
                  {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.start_date && (
                    <span className="text-[10px] text-draft block font-mono">
                      to {formatDateBadge(selectedEvent.end_date).full}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-draft block">Time &amp; Mode</span>
                  <p className="font-bold text-sm text-ink mt-0.5">
                    {selectedEvent.time || '10:00 AM - 04:00 PM'}
                  </p>
                  <span className="badge bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0 mt-0.5">
                    {selectedEvent.mode || 'Offline'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-draft block">Venue</span>
                  <p className="font-bold text-sm text-navy mt-0.5">
                    {selectedEvent.venue || 'Seminar Hall / Computer Labs'}
                  </p>
                </div>
              </div>

              {/* Speaker / Trainer Highlight */}
              {selectedEvent.speaker_or_trainer && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-navy text-white flex items-center justify-center font-bold text-sm shrink-0">
                    🎙️
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-navy block">
                      Speaker / Trainer / Industry Mentor
                    </span>
                    <p className="text-sm font-bold text-ink mt-0.5">
                      {selectedEvent.speaker_or_trainer}
                    </p>
                  </div>
                </div>
              )}

              {/* Event Description & Scope */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy mb-2">
                  Activity Overview &amp; Learning Objectives
                </h4>
                <div className="p-4 bg-paper rounded border border-rule text-sm text-ink leading-relaxed whitespace-pre-line">
                  {selectedEvent.description || 'Hands-on technical workshop open to all Computer Engineering students.'}
                </div>
              </div>

              {/* Coordinator Remarks / Instructions */}
              {selectedEvent.coordinator_remarks && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded text-xs text-amber-950">
                  <span className="font-bold block mb-0.5">Coordinator Remarks &amp; Instructions:</span>
                  {selectedEvent.coordinator_remarks}
                </div>
              )}

              {/* Additional Details */}
              <div className="flex flex-wrap items-center justify-between text-xs text-draft pt-2 border-t border-rule">
                <div>
                  <span>Target Audience: </span>
                  <strong className="text-ink">SE, TE &amp; BE Computer Students</strong>
                </div>
                {selectedEvent.expected_participants > 0 && (
                  <div>
                    <span>Batch Capacity: </span>
                    <strong className="font-mono text-ink">
                      {selectedEvent.registered_count || selectedEvent.actual_participants || 0} / {selectedEvent.expected_participants} students
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Register button */}
            <div className="p-5 border-t border-rule bg-[#FAF9F5] flex items-center justify-between gap-3">
              {selectedEvent.is_registered ? (
                <div className="flex items-center gap-2">
                  <span className="badge bg-emerald-100 text-emerald-800 border-emerald-300 text-xs py-1 px-3 font-bold">
                    ✓ You are registered for this event
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const ev = selectedEvent;
                      setSelectedEvent(null);
                      handleOpenRegistrationModal(ev);
                    }}
                    className="text-xs text-navy font-bold hover:underline"
                  >
                    Manage
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const ev = selectedEvent;
                    setSelectedEvent(null);
                    handleOpenRegistrationModal(ev);
                  }}
                  className="btn-primary text-xs py-2 px-5 shadow-sm cursor-pointer"
                >
                  Register for this Event &rarr;
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="btn-secondary text-xs py-2 px-5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CLUB DETAILS & COMMITTEE ROSTER ─────────────────────────── */}
      {selectedClubDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded border border-rule w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-rule flex items-start justify-between gap-4 bg-[#FAF9F5]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-navy text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {selectedClubDetails.code}
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-ink">
                    {selectedClubDetails.name}
                  </h3>
                  <p className="text-xs text-draft mt-0.5">
                    {selectedClubDetails.category} · Founded {selectedClubDetails.founded_year || '2020'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClubDetails(null)}
                className="text-draft hover:text-ink text-xl font-mono leading-none p-1 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Description */}
              <div className="p-4 bg-paper rounded border border-rule text-xs text-draft">
                <span className="font-bold text-ink block mb-1">Mission &amp; Scope:</span>
                {selectedClubDetails.description || 'Promoting technical excellence, hackathon culture, and peer-to-peer programming.'}
              </div>

              {/* Leadership Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-paper rounded border border-rule">
                  <span className="badge bg-navy text-white text-[9px] px-2 py-0.5 font-bold mb-1.5 inline-block">
                    STUDENT PRESIDENT / LEAD
                  </span>
                  <p className="text-sm font-bold text-ink">
                    {selectedClubDetails.student_lead_name || 'Designated by Department'}
                  </p>
                  {selectedClubDetails.student_lead_division && (
                    <span className="text-xs font-mono text-draft block mt-0.5">
                      Class: {selectedClubDetails.student_lead_division}
                    </span>
                  )}
                  {selectedClubDetails.student_lead_phone && (
                    <span className="text-xs font-mono text-draft block mt-0.5">
                      Contact: {selectedClubDetails.student_lead_phone}
                    </span>
                  )}
                </div>

                <div className="p-4 bg-paper rounded border border-rule">
                  <span className="badge bg-slate-700 text-white text-[9px] px-2 py-0.5 font-bold mb-1.5 inline-block">
                    STUDENT VICE PRESIDENT
                  </span>
                  <p className="text-sm font-bold text-ink">
                    {selectedClubDetails.vice_president_name || 'Not Designated'}
                  </p>
                  {selectedClubDetails.vice_president_division && (
                    <span className="text-xs font-mono text-draft block mt-0.5">
                      Class: {selectedClubDetails.vice_president_division}
                    </span>
                  )}
                  {selectedClubDetails.vice_president_phone && (
                    <span className="text-xs font-mono text-draft block mt-0.5">
                      Contact: {selectedClubDetails.vice_president_phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Faculty In-Charge */}
              <div className="p-3 bg-paper rounded border border-rule text-xs text-draft flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink">Faculty In-Charge: </span>
                  <span>{selectedClubDetails.faculty_name || 'Department Faculty'}</span>
                  {selectedClubDetails.faculty_designation && <span> ({selectedClubDetails.faculty_designation})</span>}
                </div>
                {selectedClubDetails.faculty_email && (
                  <span className="font-mono text-draft text-[11px]">{selectedClubDetails.faculty_email}</span>
                )}
              </div>

              {/* Student Executive Committee Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-navy">
                    Student Executive Committee (AY {academicYear})
                  </h4>
                  <span className="text-xs font-mono text-draft">
                    {clubMembers.length} members
                  </span>
                </div>

                {membersLoading ? (
                  <div className="p-4 text-center text-xs text-draft">Loading roster...</div>
                ) : clubMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-draft border border-dashed border-rule rounded">
                    No committee roster recorded yet for AY {academicYear}.
                  </div>
                ) : (
                  <div className="border border-rule rounded overflow-hidden">
                    <table className="result-table dense">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>PRN</th>
                          <th>Class</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clubMembers.map((m) => (
                          <tr key={m.id}>
                            <td className="font-bold text-ink">{m.student_name}</td>
                            <td className="font-mono text-xs text-draft">{m.prn || m.roll_no || '—'}</td>
                            <td className="text-xs font-mono">{m.division || m.class_year}</td>
                            <td>
                              <span className="badge badge-draft text-[10px]">{m.role}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-rule bg-[#FAF9F5] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClubDetails(null)}
                className="btn-primary text-xs py-2 px-5"
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
