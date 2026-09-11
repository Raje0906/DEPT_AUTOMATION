import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';

export default function HODDashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/hod/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-draft">Loading department status…</div>;

  const subjects = data?.subjects || [];
  const needsAction = subjects.filter(s => s.status === 'submitted');
  const notStarted  = subjects.filter(s => s.status === 'not_started' || s.status === 'draft');

  // Group by semester
  const bySemester = {};
  for (const s of subjects) {
    if (!bySemester[s.semester]) bySemester[s.semester] = [];
    bySemester[s.semester].push(s);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 lg:p-10 py-6 w-full max-w-7xl mx-auto">
      <div className="mb-8 pb-5 border-b border-rule">
        <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">HOD Dashboard</h1>
        <p className="text-base text-draft mt-1 font-medium">Department of Computer Engineering — Academic Year 2024–25</p>
      </div>

      {/* Alert strip */}
      {(needsAction.length > 0 || data?.pendingRevaluations > 0) && (
        <div className="space-y-2 mb-6">
          {needsAction.length > 0 && (
            <div className="notification-strip">
              <span className="text-xs font-semibold text-navy uppercase tracking-wide mr-2">Awaiting review</span>
              {needsAction.length} subject{needsAction.length > 1 ? 's' : ''} submitted for approval.
              <Link to="/hod/approval" className="ml-2 text-maroon font-medium hover:underline">Review now</Link>
            </div>
          )}
          {data?.pendingRevaluations > 0 && (
            <div className="notification-strip">
              <span className="text-xs font-semibold text-navy uppercase tracking-wide mr-2">Revaluation</span>
              {data.pendingRevaluations} pending revaluation request{data.pendingRevaluations > 1 ? 's' : ''}.
              <Link to="/hod/revaluation" className="ml-2 text-maroon font-medium hover:underline">View</Link>
            </div>
          )}
        </div>
      )}

      {/* Dept-wide subject tracker — the key HOD view, must be scannable at speed */}
      {Object.entries(bySemester).sort(([a],[b]) => b - a).map(([sem, subs]) => (
        <div key={sem} className="panel mb-6">
          <div className="panel-header flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Semester {sem}</h2>
            <div className="flex gap-2 text-xs text-draft">
              <span className="text-pass">{subs.filter(s => s.status === 'approved' || s.status === 'published').length} approved</span>
              <span>·</span>
              <span className="text-pending">{subs.filter(s => s.status === 'submitted').length} awaiting</span>
              <span>·</span>
              <span className="text-draft">{subs.filter(s => s.status === 'draft' || s.status === 'not_started').length} pending</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Faculty</th>
                  <th>Class</th>
                  <th className="numeric">Enrolled</th>
                  <th className="numeric">Entered</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s, i) => (
                  <tr key={i} className={s.status === 'submitted' ? 'bg-amber-50' : ''}>
                    <td className="font-medium">{s.subject_name}</td>
                    <td className="font-mono text-xs text-draft">{s.code}</td>
                    <td>{s.faculty_name}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        {s.division}
                      </span>
                    </td>
                    <td className="numeric">{s.enrolled}</td>
                    <td className="numeric">{s.marks_entered}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {s.status === 'submitted' && (
                        <Link to={`/hod/approval?subjectId=${s.id}&sem=${s.semester}&ay=${s.academic_year}`}
                          className="text-sm text-maroon hover:underline font-medium whitespace-nowrap">
                          Review
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {subjects.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-lg font-serif font-bold text-ink">No course allocations yet</p>
          <p className="text-sm text-draft mt-1 mb-5 max-w-md mx-auto">
            You can assign subjects and classes (SE, TE, and BE Comp 1 to 4) to the 10 department teachers anytime.
          </p>
          <Link to="/hod/teachers" className="btn-primary inline-flex items-center gap-2 shadow-sm">
            <span>+</span> Allocate Faculty &amp; Subjects
          </Link>
        </div>
      )}
    </div>
  );
}
