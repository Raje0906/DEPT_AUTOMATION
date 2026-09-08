import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HODAnalytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState('');

  useEffect(() => {
    api.get(`/hod/analytics${semester ? `?semester=${semester}` : ''}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [semester]);

  if (loading) return <div className="p-8 text-sm text-draft">Loading analytics…</div>;

  const gradeOrder = ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F'];
  const gradeData = gradeOrder.map(g => ({
    grade: g, count: data?.gradeDistribution?.[g] || 0,
  }));

  // SGPA histogram
  const sgpaRanges = [
    { range: '4–5', min: 4, max: 5 },
    { range: '5–6', min: 5, max: 6 },
    { range: '6–7', min: 6, max: 7 },
    { range: '7–8', min: 7, max: 8 },
    { range: '8–9', min: 8, max: 9 },
    { range: '9–10', min: 9, max: 10 },
  ];
  const sgpaHistogram = sgpaRanges.map(r => ({
    range: r.range,
    count: (data?.sgpaValues || []).filter(v => v >= r.min && v < r.max).length,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 pb-4 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Department Analytics</h1>
          <p className="text-sm text-draft mt-0.5">Published results · Computer Engineering</p>
        </div>
        <select
          value={semester}
          onChange={e => { setSemester(e.target.value); setLoading(true); }}
          className="input-field w-auto py-1.5"
        >
          <option value="">All semesters</option>
          {[5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
        </select>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total marks published', val: data?.total ?? '—' },
          { label: 'Pass', val: data?.passed ?? '—', cls: 'text-pass' },
          { label: 'Fail', val: data?.failed ?? '—', cls: 'text-fail' },
          { label: 'Pass percentage', val: data?.passPercentage != null ? `${data.passPercentage}%` : '—', cls: 'text-navy' },
        ].map((item, i) => (
          <div key={i} className="panel p-5">
            <p className="text-xs text-draft uppercase tracking-wide mb-1">{item.label}</p>
            <p className={`font-serif text-3xl font-bold tabular-num ${item.cls || 'text-ink'}`}>{item.val}</p>
          </div>
        ))}
      </div>

      {/* Grade distribution + SGPA histogram */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-4">Grade distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={gradeData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D4D0C8" vertical={false} />
              <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#1A1F36' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 2, border: '1px solid #D4D0C8', fontSize: 12 }} />
              <Bar dataKey="count" fill="#1E2D5A" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wide mb-4">SGPA distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sgpaHistogram} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D4D0C8" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#1A1F36' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#4A5568' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 2, border: '1px solid #D4D0C8', fontSize: 12 }} />
              <Bar dataKey="count" fill="#6B2737" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-draft mt-2 text-right">
            Dept average SGPA: <strong className="text-navy tabular-num">{data?.averageSGPA?.toFixed(2) || '—'}</strong>
          </p>
        </div>
      </div>

      {/* Faculty compliance */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="font-serif text-lg font-semibold">Faculty submission compliance</h2>
          <p className="text-xs text-draft mt-0.5">Subjects submitted vs total assigned</p>
        </div>
        <table className="result-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Employee ID</th>
              <th className="numeric">Total subjects</th>
              <th className="numeric">Submitted</th>
              <th className="numeric">Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.facultyCompliance || []).map((f, i) => {
              const pending = f.total_subjects - f.submitted_count;
              return (
                <tr key={i}>
                  <td className="font-medium">{f.faculty_name}</td>
                  <td className="font-mono text-xs text-draft">{f.employee_id}</td>
                  <td className="numeric">{f.total_subjects}</td>
                  <td className="numeric text-pass font-semibold">{f.submitted_count}</td>
                  <td className="numeric">
                    {pending > 0 ? <span className="text-fail font-bold">{pending}</span> : <span className="text-pass">—</span>}
                  </td>
                  <td>
                    {pending === 0
                      ? <span className="badge-published">Complete</span>
                      : <span className="badge-submitted">In progress</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
