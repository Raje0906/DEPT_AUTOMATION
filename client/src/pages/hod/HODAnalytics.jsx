import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function HODAnalytics() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [semester, setSemester]       = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');

  const fetchAnalytics = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (semester) params.append('semester', semester);
    if (academicYear) params.append('academic_year', academicYear);

    api.get(`/hod/analytics?${params.toString()}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, [semester, academicYear]);

  if (loading) return <div className="p-8 text-sm text-draft">Loading live analytics…</div>;

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
    { range: '9–10', min: 9, max: 10.01 },
  ];
  const sgpaHistogram = sgpaRanges.map(r => ({
    range: r.range,
    count: (data?.sgpaValues || []).filter(v => v >= r.min && v < r.max).length,
  }));

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      <div className="mb-8 pb-5 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-3xl font-bold text-ink">Department Analytics</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Real-Time
            </span>
          </div>
          <p className="text-sm text-draft mt-1 font-medium">Published examination results · Computer Engineering</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
            className="input-field w-auto py-2 px-3 text-xs font-semibold bg-white border border-gray-300 rounded-md shadow-2xs"
          >
            <option value="2026-27">AY 2026-27 (Current)</option>
            <option value="2025-26">AY 2025-26</option>
          </select>
          <select
            value={semester}
            onChange={e => setSemester(e.target.value)}
            className="input-field w-auto py-2 px-3 text-xs font-semibold bg-white border border-gray-300 rounded-md shadow-2xs"
          >
            <option value="">All semesters</option>
            {[3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total marks published', val: data?.total ?? '—' },
          { label: 'Pass', val: data?.passed ?? '—', cls: 'text-pass' },
          { label: 'Fail', val: data?.failed ?? '—', cls: 'text-fail' },
          { label: 'Pass percentage', val: data?.passPercentage != null ? `${data.passPercentage}%` : '—', cls: 'text-navy' },
        ].map((item, i) => (
          <div key={i} className="panel p-5 bg-white border border-rule rounded-sm shadow-2xs">
            <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">{item.label}</p>
            <p className={`font-serif text-3xl font-bold tabular-num ${item.cls || 'text-ink'}`}>{item.val}</p>
          </div>
        ))}
      </div>

      {/* Grade distribution + SGPA histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="panel p-5 bg-white border border-rule rounded-sm shadow-2xs">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-4">Grade distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gradeData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#1A1F36', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }} />
              <Bar dataKey="count" fill="#1E2D5A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-5 bg-white border border-rule rounded-sm shadow-2xs">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-4">SGPA distribution</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={sgpaHistogram} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#1A1F36', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }} />
              <Bar dataKey="count" fill="#6B2737" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-draft mt-3 text-right">
            Dept average SGPA: <strong className="text-navy tabular-num text-sm font-bold">{data?.averageSGPA?.toFixed(2) || '—'}</strong>
          </p>
        </div>
      </div>

      {/* Faculty compliance */}
      <div className="panel bg-white border border-rule rounded-sm shadow-2xs overflow-hidden">
        <div className="panel-header p-5 border-b border-rule">
          <h2 className="font-serif text-lg font-semibold text-ink">Faculty submission compliance</h2>
          <p className="text-xs text-draft mt-0.5">Subjects submitted vs total assigned</p>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table w-full">
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
                    <td className="font-medium text-ink">{f.faculty_name}</td>
                    <td className="font-mono text-xs text-draft">{f.employee_id}</td>
                    <td className="numeric font-medium">{f.total_subjects}</td>
                    <td className="numeric text-pass font-semibold">{f.submitted_count}</td>
                    <td className="numeric">
                      {pending > 0 ? <span className="text-fail font-bold">{pending}</span> : <span className="text-pass font-semibold">—</span>}
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
    </div>
  );
}
