import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function SeminarSchedule() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState({
    presentationDate: '',
    venue: '',
    startTime: '09:00',
    slotDurationMinutes: '15',
  });

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/seminar/workflow/sessions');
      setSessions(data.sessions || []);
      if (data.activeSessionId) {
        setSelectedSessionId(String(data.activeSessionId));
      } else if (data.sessions?.length > 0) {
        setSelectedSessionId(String(data.sessions[0].id));
      }
    } catch {
      toast.error('Failed to load seminar sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadGroups = useCallback(async (sessId) => {
    if (!sessId) return;
    try {
      const { data } = await api.get(`/seminar/workflow/${sessId}/groups`);
      setGroups(data.groups || []);
    } catch {
      toast.error('Failed to load groups for scheduling');
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadGroups(selectedSessionId);
    }
  }, [selectedSessionId, loadGroups]);

  const selectedSession = sessions.find(s => String(s.id) === String(selectedSessionId));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--ink)]/50">
          <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">TE Seminar</Link>
          <span>/</span>
          <span className="text-[var(--ink)]/80 font-medium">Schedule Presentation</span>
        </div>
        <Link
          to="/faculty/seminar/import-assign"
          className="text-xs font-semibold text-[var(--navy)] hover:underline"
        >
          &larr; Back to Import &amp; Assign Guides
        </Link>
      </div>

      {/* Header & Session Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--navy)]">Schedule Presentation</h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            Plan evaluation slots, assign presentation venues, and notify seminar panels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--ink)]/60">Session:</label>
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.academic_year || 'AY'}) {s.status === 'PUBLISHED' ? '[Published]' : '[Active]'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--ink)]/40">Loading scheduling records...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scheduling Configuration Form */}
          <div className="lg:col-span-1 border border-[var(--rule)] rounded-lg p-5 bg-white space-y-4 shadow-2xs">
            <h2 className="text-sm font-bold text-[var(--navy)] border-b border-[var(--rule)] pb-2">
              Presentation Parameters
            </h2>

            <div>
              <label className="block text-xs font-medium text-[var(--ink)]/70 mb-1">Presentation Date</label>
              <input
                type="date"
                value={scheduleData.presentationDate}
                onChange={e => setScheduleData({ ...scheduleData, presentationDate: e.target.value })}
                className="w-full border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--ink)]/70 mb-1">Venue / Lab Room</label>
              <input
                type="text"
                placeholder="e.g. Computing Lab 304, Seminar Hall"
                value={scheduleData.venue}
                onChange={e => setScheduleData({ ...scheduleData, venue: e.target.value })}
                className="w-full border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--ink)]/70 mb-1">Start Time</label>
                <input
                  type="time"
                  value={scheduleData.startTime}
                  onChange={e => setScheduleData({ ...scheduleData, startTime: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink)]/70 mb-1">Slot Duration</label>
                <select
                  value={scheduleData.slotDurationMinutes}
                  onChange={e => setScheduleData({ ...scheduleData, slotDurationMinutes: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                >
                  <option value="10">10 mins</option>
                  <option value="15">15 mins</option>
                  <option value="20">20 mins</option>
                  <option value="30">30 mins</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toast.success('Presentation schedule slots generated and saved.')}
              className="w-full mt-4 px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a] transition-colors shadow-2xs"
            >
              Generate Schedule Slots
            </button>
          </div>

          {/* Group Schedule Roster */}
          <div className="lg:col-span-2 border border-[var(--rule)] rounded-lg bg-white overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-[var(--rule)] flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-[var(--navy)]">
                Registered Groups Roster ({groups.length} Groups)
              </h2>
              <span className="text-xs text-[var(--ink)]/60 font-mono">
                {selectedSession?.name || 'Session'}
              </span>
            </div>

            {groups.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--ink)]/50">
                No groups imported for this session yet. Go to{' '}
                <Link to="/faculty/seminar/import-assign" className="text-[var(--navy)] underline font-medium">
                  Import and assign guides
                </Link>{' '}
                to import group submissions.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--rule)]">
                {groups.map((g, idx) => {
                  const startHour = 9 + Math.floor((idx * 15) / 60);
                  const startMin = (idx * 15) % 60;
                  const timeFormatted = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;

                  return (
                    <div key={g.id} className="p-3.5 flex items-start justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--navy)]">Group #{g.group_no}</span>
                          <span className="text-[11px] text-slate-500 font-mono">({g.members?.length || 0} members)</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {g.domain || 'Computing'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--ink)]/70">
                          <span className="font-medium text-slate-700">Guide:</span> {g.guide_name || 'Not Assigned'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-md">
                          {g.members?.map(m => m.name).join(', ')}
                        </div>
                      </div>

                      <div className="text-right space-y-1 shrink-0">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {timeFormatted} AM
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {scheduleData.venue || 'Venue Pending'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
