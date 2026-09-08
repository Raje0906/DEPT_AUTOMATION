import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import ResultTable from '../../components/ResultTable';

export default function StudentResults() {
  const { user } = useAuth();
  const [semester, setSemester] = useState(user?.current_semester || 6);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/student/results/${semester}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [semester]);

  const maxSem = user?.current_semester || 6;
  const availableSemesters = Array.from({ length: maxSem }, (_, i) => i + 1);

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">Academic Results</h1>
          <p className="text-base text-draft mt-1 font-medium">{user?.name} · {user?.roll_no}</p>
        </div>

        {/* Semester selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-draft uppercase tracking-wide font-semibold whitespace-nowrap">
            Semester
          </label>
          <select
            value={semester}
            onChange={(e) => setSemester(parseInt(e.target.value, 10))}
            className="input-field w-auto py-1.5 pr-8"
          >
            {availableSemesters.map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
          <button onClick={handleDownload} className="btn-secondary text-sm py-1.5 no-print">
            Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-draft">Loading results…</p>
      ) : !data || data.subjects?.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm font-medium text-draft">No marks entered for Semester {semester} yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Results will appear here once the faculty submits marks and they are published.
          </p>
        </div>
      ) : (
        <>
          {/* Result status notice */}
          {!data.published && (
            <div className="notification-strip mb-4">
              <span className="text-xs font-semibold text-navy uppercase tracking-wide mr-2">Notice</span>
              These results are not yet officially published. Marks may change until published by the HOD.
            </div>
          )}

          {/* Mark sheet header (visible in print) */}
          <div className="mb-4 hidden print:block text-center">
            <h2 className="font-serif text-xl font-bold">MES Wadia COE</h2>
            <p className="text-sm">Department of Computer Engineering</p>
            <p className="text-sm font-medium mt-1">
              Mark Sheet — Semester {semester} — Academic Year {data.subjects?.[0]?.academic_year || '2024-25'}
            </p>
            <div className="mt-3 flex justify-between text-sm border-t pt-2">
              <span>Name: {user?.name}</span>
              <span>Roll No: {user?.roll_no}</span>
              <span>Enrollment No: {user?.enrollment_no}</span>
            </div>
          </div>

          {/* The canonical table */}
          <div className="panel mb-6">
            <div className="panel-header">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-semibold">
                  Semester {semester} — Mark Sheet
                </h2>
                {data.published && (
                  <span className="badge-published">Published</span>
                )}
              </div>
              {data.subjects?.[0]?.academic_year && (
                <p className="text-xs text-draft mt-1">Academic Year {data.subjects[0].academic_year}</p>
              )}
            </div>
            <ResultTable subjects={data.subjects} />
          </div>

          {/* SGPA summary */}
          <div className="panel p-5">
            <div className="flex flex-wrap gap-8 items-start">
              <div>
                <p className="text-xs text-draft uppercase tracking-wide mb-1">SGPA — Semester {semester}</p>
                <p className="font-serif text-3xl font-bold text-navy tabular-num">
                  {data.sgpa?.toFixed(2) || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-draft uppercase tracking-wide mb-1">Total Credits</p>
                <p className="font-serif text-3xl font-bold text-ink tabular-num">{data.totalCredits}</p>
              </div>
              <div>
                <p className="text-xs text-draft uppercase tracking-wide mb-1">Pass / Fail</p>
                <p className="font-serif text-3xl font-bold tabular-num">
                  <span className="text-pass">{data.subjects?.filter(s => s.grade !== 'F').length}</span>
                  <span className="text-rule"> / </span>
                  <span className="text-fail">{data.subjects?.filter(s => s.grade === 'F').length}</span>
                </p>
              </div>

              {/* Backlog subjects */}
              {data.subjects?.some(s => s.is_backlog) && (
                <div className="w-full border-t border-rule pt-4 mt-2">
                  <p className="text-xs font-semibold text-fail uppercase tracking-wide mb-2">
                    Backlog subjects
                  </p>
                  {data.subjects.filter(s => s.is_backlog).map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1">
                      <span className="badge-backlog">Backlog</span>
                      <span>{s.subject_name}</span>
                      <span className="text-draft font-mono text-xs">{s.subject_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
