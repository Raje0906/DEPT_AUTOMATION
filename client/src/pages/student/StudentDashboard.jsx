import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge } from '../../components/ResultTable';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentSem = user?.current_semester || 6;

  useEffect(() => {
    Promise.all([
      api.get(`/student/results/${currentSem}`),
      api.get('/student/results'),
      api.get('/student/notifications'),
    ]).then(([semRes, allRes, notifRes]) => {
      setData({ sem: semRes.data, all: allRes.data });
      setNotices(notifRes.data.notifications || []);
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
          {user?.roll_no} · Semester {currentSem} · Division {user?.division} · {user?.batch || '2021–25'}
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
                {semData.subjects.map((s, i) => (
                  <tr key={i}>
                    <td>
                      {s.subject_name}
                      {s.is_backlog && <span className="ml-2 badge-backlog">Backlog</span>}
                    </td>
                    <td className="numeric font-semibold">{s.total != null ? Number(s.total).toFixed(0) : '—'}</td>
                    <td className="text-center">
                      <span className={s.grade === 'F' ? 'text-fail font-bold' : s.grade === 'O' || s.grade === 'A+' ? 'text-pass font-bold' : 'font-semibold'}>
                        {s.grade || '—'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state py-10">
              <p className="text-sm text-draft">No results available for Semester {currentSem} yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/student/results" className="btn-secondary">View detailed results</Link>
        <Link to="/student/cgpa" className="btn-secondary">CGPA overview</Link>
        <Link to="/student/revaluation" className="btn-secondary">Revaluation requests</Link>
      </div>
    </div>
  );
}
