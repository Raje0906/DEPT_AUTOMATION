import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';

export default function CGPAView() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/results')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-draft">Loading…</div>;

  const published = data?.semesters?.filter(s => s.published) || [];
  const trendData = published.map(s => ({ sem: `Sem ${s.semester}`, sgpa: s.sgpa }));

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">CGPA Overview</h1>
        <p className="text-sm text-draft mt-0.5">Cumulative performance across all published semesters</p>
      </div>

      {/* CGPA + trend */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="panel p-6 flex flex-col items-start">
          <p className="text-xs text-draft uppercase tracking-wide mb-2">Cumulative GPA</p>
          <p className="font-serif text-5xl font-bold text-navy tabular-num">
            {data?.cgpa?.toFixed(2) || '—'}
          </p>
          <p className="text-xs text-draft mt-2">
            Based on {published.length} published semester{published.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="panel p-5 lg:col-span-2">
          <p className="text-xs text-draft uppercase tracking-wide mb-4">SGPA trend</p>
          {trendData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D4D0C8" vertical={false} />
                <XAxis dataKey="sem" tick={{ fontSize: 11, fill: '#4A5568' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#4A5568' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 2, border: '1px solid #D4D0C8', fontSize: 12 }}
                  formatter={(v) => [v.toFixed(2), 'SGPA']}
                />
                <Line
                  type="monotone" dataKey="sgpa"
                  stroke="#1E2D5A" strokeWidth={1.5} dot={{ r: 3, fill: '#1E2D5A' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-draft py-8 text-center">
              Trend available after 2 or more published semesters.
            </p>
          )}
        </div>
      </div>

      {/* Semester-by-semester breakdown */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="font-serif text-lg font-semibold">Semester Summary</h2>
        </div>
        <table className="result-table">
          <thead>
            <tr>
              <th>Semester</th>
              <th>Academic Year</th>
              <th className="numeric">Credits</th>
              <th className="numeric">SGPA</th>
              <th className="numeric">Pass</th>
              <th className="numeric">Fail / Backlog</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.semesters || []).map((sem, i) => {
              const pass = sem.subjects.filter(s => s.grade !== 'F').length;
              const fail = sem.subjects.filter(s => s.grade === 'F').length;
              return (
                <tr key={i}>
                  <td className="font-semibold">Semester {sem.semester}</td>
                  <td className="text-draft text-sm">{sem.academic_year}</td>
                  <td className="numeric">{sem.totalCredits}</td>
                  <td className="numeric font-semibold tabular-num">
                    {sem.published ? sem.sgpa.toFixed(2) : '—'}
                  </td>
                  <td className="numeric text-pass font-semibold">{pass}</td>
                  <td className="numeric">
                    {fail > 0
                      ? <span className="text-fail font-bold">{fail}</span>
                      : <span className="text-pass">—</span>}
                  </td>
                  <td>
                    {sem.published
                      ? <span className="badge-published">Published</span>
                      : <span className="badge-draft">Pending</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Backlogs section */}
      {(data?.backlogs?.length > 0) && (
        <div className="panel mt-6">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-fail">Backlog subjects</h2>
            <p className="text-xs text-draft mt-0.5">Subjects where you scored below the passing threshold (Grade F)</p>
          </div>
          <table className="result-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th className="numeric">Semester</th>
                <th className="numeric">Total Obtained</th>
                <th className="text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {data.backlogs.map((b, i) => (
                <tr key={i}>
                  <td>{b.subject_name}</td>
                  <td className="font-mono text-xs text-draft">{b.subject_code}</td>
                  <td className="numeric">{b.semester}</td>
                  <td className="numeric text-fail font-bold">{Number(b.total).toFixed(0)}</td>
                  <td className="text-center text-fail font-bold">{b.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
