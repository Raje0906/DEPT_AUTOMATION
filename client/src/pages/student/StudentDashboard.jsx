import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/ResultTable';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [notices, setNotices] = useState([]);
  const [upcomingClubEvents, setUpcomingClubEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentSem = user?.current_semester || 5;

  useEffect(() => {
    Promise.all([
      api.get(`/student/results/${currentSem}`),
      api.get('/student/results'),
      api.get('/student/notifications'),
      api.get('/clubs/events?academicYear=2026-27').catch(() => ({ data: { events: [] } })),
    ]).then(([semRes, allRes, notifRes, clubEventsRes]) => {
      setData({ sem: semRes.data, all: allRes.data });
      setNotices(notifRes.data.notifications || []);
      setUpcomingClubEvents((clubEventsRes.data?.events || []).slice(0, 3));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [currentSem]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-draft">Loading your results…</div>
    );
  }

  const semData = data?.sem;
  const allData = data?.all;
  const backlogs = allData?.backlogs || [];

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8 pb-5 border-b border-rule">
        <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">
          Welcome, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-base text-draft mt-1 font-medium">
          {user?.roll_no} · Semester {currentSem} · Division {user?.division} · {user?.batch || '2025–26'}
        </p>
      </div>

      {/* Notifications */}
      {notices.length > 0 && (
        <div className="mb-6 space-y-2">
          {notices.map((n, i) => (
            <div key={i} className="notification-strip">
              <span className="text-xs font-semibold text-navy uppercase tracking-wide mr-2">
                {n.type === 'result_published' ? 'Result' : 'Update'}
              </span>
              {n.message}
            </div>
          ))}
        </div>
      )}

      {/* GPA summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-2">CGPA</p>
          <p className="gpa-display">{allData?.cgpa?.toFixed(2) || '—'}</p>
          <p className="text-xs text-draft mt-1">All published semesters</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-2">Semester {currentSem} SGPA</p>
          <p className="gpa-display">{semData?.sgpa?.toFixed(2) || '—'}</p>
          <p className="text-xs text-draft mt-1">
            {semData?.published ? 'Published' : 'Not yet published'}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-2">Subjects this semester</p>
          <p className="gpa-display">{semData?.subjects?.length ?? '—'}</p>
          <p className="text-xs text-draft mt-1">{semData?.totalCredits || 0} total credits</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-2">Active backlogs</p>
          <p className={`gpa-display ${backlogs.length > 0 ? 'text-fail' : 'text-pass'}`}>
            {backlogs.length}
          </p>
          <p className="text-xs text-draft mt-1">
            {backlogs.length === 0 ? 'No backlogs' : 'Pending clearance'}
          </p>
        </div>
      </div>

      {/* Current semester quick status */}
      <div className="panel mb-6">
        <div className="panel-header flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Semester {currentSem} — Quick Status</h2>
          <Link to="/student/results" className="text-sm text-maroon hover:underline">
            View full result
          </Link>
        </div>
        <div className="p-0">
          {semData?.subjects?.length > 0 ? (
            <table className="result-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="numeric">Total</th>
                  <th className="text-center">Grade</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {semData.subjects.map((s, i) => {
                  const name = s.subject_name || s.subjectName || 'Subject';
                  const code = s.subject_code || s.subjectCode || '';
                  const totalVal = s.total ?? s.totalObtained;
                  const isBacklog = s.is_backlog || s.isBacklog;
                  const st = s.status || (s.isComplete ? 'published' : 'draft');
                  return (
                    <tr key={i}>
                      <td>
                        <span className="font-semibold text-ink">{name}</span>
                        {code && <span className="text-xs text-draft ml-2 font-mono">({code})</span>}
                        {isBacklog && <span className="ml-2 badge-backlog">Backlog</span>}
                      </td>
                      <td className="numeric font-semibold">{totalVal != null ? Number(totalVal).toFixed(0) : '—'}</td>
                      <td className="text-center">
                        <span className={s.grade === 'F' ? 'text-fail font-bold' : (s.grade === 'O' || s.grade === 'A+' || s.grade === 'A') ? 'text-pass font-bold' : 'font-semibold'}>
                          {s.grade || '—'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={st} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state py-10">
              <p className="text-sm text-draft">No results available for Semester {currentSem} yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Club Activities Widget */}
      {upcomingClubEvents.length > 0 && (
        <div className="panel mb-6">
          <div className="panel-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-navy animate-pulse"></span>
              <h2 className="font-serif text-lg font-semibold text-ink">Upcoming Club &amp; SIH Activities</h2>
            </div>
            <Link to="/student/clubs" className="text-sm text-maroon hover:underline font-semibold flex items-center gap-1">
              <span>View all club activities</span>
              <span>&rarr;</span>
            </Link>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingClubEvents.map((ev) => {
              const d = ev.start_date ? new Date(ev.start_date) : null;
              const dateStr = d
                ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'TBA';
              return (
                <div key={ev.id} className="p-4 rounded bg-paper border border-rule hover:border-navy transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="badge bg-navy text-white text-[10px] font-bold px-2 py-0.5">
                        {ev.club_code || 'CLUB'}
                      </span>
                      <span className="badge badge-approved text-[10px] py-0 px-1.5">
                        {ev.event_type || 'Event'}
                      </span>
                    </div>
                    <h3 className="font-serif font-bold text-sm text-ink line-clamp-2 mb-1">
                      {ev.title}
                    </h3>
                    <p className="text-[11px] text-draft font-mono mb-2">
                      📅 {dateStr} {ev.time ? `· ${ev.time}` : ''}
                    </p>
                    {ev.venue && (
                      <p className="text-[11px] text-draft truncate">
                        📍 {ev.venue}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-rule/60 flex items-center justify-between">
                    <span className="text-[10px] text-navy font-semibold truncate max-w-[150px]">
                      {ev.club_name}
                    </span>
                    <Link
                      to="/student/clubs"
                      className="text-xs text-maroon font-bold hover:underline"
                    >
                      Details &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/student/results" className="btn-secondary">View detailed results</Link>
        <Link to="/student/cgpa" className="btn-secondary">CGPA overview</Link>
        <Link to="/student/clubs" className="btn-secondary flex items-center gap-1.5">
          <span>🏛️</span>
          <span>Explore Club Activities</span>
        </Link>
      </div>
    </div>
  );
}
