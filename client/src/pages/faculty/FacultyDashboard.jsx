import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';

export default function FacultyDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const location              = useLocation();
  const isResultGen           = location.pathname === '/faculty/subjects';

  useEffect(() => {
    api.get('/faculty/subjects')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-draft">Loading…</div>;

  const subjects = data?.subjects || [];
  const pending  = subjects.filter(s => s.submission_status === 'not_started' || s.submission_status === 'draft');

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      <div className="mb-8 pb-5 border-b border-rule">
        <h1 className="font-serif text-3xl font-bold text-ink">
          {isResultGen ? 'Result Generation' : 'Faculty Dashboard'}
        </h1>
        <p className="text-base text-draft mt-1 font-medium">
          {isResultGen
            ? 'Enter Continuous Internal Evaluation (CIE), Practical & End-Sem marks to generate student results'
            : `${data?.faculty?.designation} · ${data?.faculty?.department}`}
        </p>
      </div>

      {pending.length > 0 && (
        <div className="notification-strip mb-8 py-3.5 px-5 text-sm">
          <span className="text-xs font-bold text-navy uppercase tracking-wider mr-2.5 bg-blue-100 px-2 py-0.5 rounded">Action required</span>
          <span className="font-medium text-ink">
            {pending.length} subject{pending.length > 1 ? 's have' : ' has'} marks not yet submitted.
          </span>
        </div>
      )}

      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Assigned subjects — {subjects[0]?.academic_year || '2024-25'}</h2>
          <span className="text-xs font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">{subjects.length} total subjects</span>
        </div>
        {subjects.length === 0 ? (
          <div className="empty-state py-12">
            <p className="text-base text-draft">No subjects assigned this semester.</p>
          </div>
        ) : (
          <table className="result-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th className="numeric">Semester</th>
                <th>Division</th>
                <th className="numeric">Enrolled</th>
                <th className="numeric">Marks entered</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr key={i}>
                  <td className="font-semibold text-ink text-base">{s.name}</td>
                  <td className="font-mono text-sm font-bold text-draft">{s.code}</td>
                  <td className="numeric font-medium text-base">{s.semester}</td>
                  <td className="font-medium text-base">{s.division}</td>
                  <td className="numeric font-medium text-base">{s.enrolled_count}</td>
                  <td className="numeric font-semibold text-base">
                    {s.marks_entered} / {s.enrolled_count}
                  </td>
                  <td><StatusBadge status={s.submission_status} /></td>
                  <td className="text-right">
                    {(s.submission_status === 'draft' || s.submission_status === 'not_started') && (
                      <Link
                        to={`/faculty/marks/${s.id}?sem=${s.semester}&ay=${s.academic_year}&div=${s.division}`}
                        className="inline-flex items-center px-4 py-1.5 bg-maroon hover:bg-[#4E1C27] text-white text-xs font-semibold rounded shadow-sm transition-colors"
                      >
                        Enter marks →
                      </Link>
                    )}
                    {(s.submission_status === 'submitted' || s.submission_status === 'approved' || s.submission_status === 'published') && (
                      <Link
                        to={`/faculty/marks/${s.id}?sem=${s.semester}&ay=${s.academic_year}&div=${s.division}`}
                        className="inline-flex items-center px-4 py-1.5 border border-rule hover:bg-gray-100 text-ink text-xs font-medium rounded transition-colors"
                      >
                        View marks
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
