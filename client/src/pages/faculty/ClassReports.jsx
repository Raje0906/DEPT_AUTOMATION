import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function ClassReports() {
  const [selectedClass, setSelectedClass]         = useState('TE Comp 1');
  const [selectedSubject, setSelectedSubject]     = useState('CE504');
  const [selectedYear, setSelectedYear]           = useState('2026-27');
  const [searchTerm, setSearchTerm]               = useState('');
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState(null);
  const [reportData, setReportData]               = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(
        `/faculty/reports/class-performance?division=${encodeURIComponent(selectedClass)}&subject_code=${encodeURIComponent(selectedSubject)}&academic_year=${encodeURIComponent(selectedYear)}`
      );
      setReportData(res.data);
    } catch (err) {
      console.error('[ClassReports] Fetch error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to load real-time class report';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedClass, selectedSubject, selectedYear]);

  const handlePrint = () => {
    window.print();
  };

  const metrics = reportData?.metrics || {
    totalStudents: 0,
    appeared: 0,
    passed: 0,
    failed: 0,
    passPercentage: '0.0%',
    highestScore: 0,
    avgScore: 0,
    median: 0,
    backlogs: 0,
  };

  const gradeDist = reportData?.gradeDist || [];
  const toppers = reportData?.toppers || [];
  const roster = reportData?.roster || [];
  const subjectInfo = reportData?.subject;
  const availableClasses = reportData?.availableClasses || [
    'TE Comp 1', 'TE Comp 2', 'TE Comp 3',
    'SE Comp 1', 'SE Comp 2', 'SE Comp 3',
    'BE Comp 1', 'BE Comp 2', 'BE Comp 3'
  ];
  const availableSubjects = reportData?.availableSubjects || [];

  const filteredRoster = roster.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.roll_no?.toLowerCase().includes(q) ||
      s.enrollment_no?.toLowerCase().includes(q) ||
      s.grade?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-6">
      {/* ─── Header & Filter Controls ─── */}
      <div className="pb-5 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-gray-900">
              Class Performance Reports
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              Live DB
            </span>
          </div>
          <p className="text-xs lg:text-sm text-gray-500 mt-1">
            Subject-wise Grade Analytics, Real-time Pass Percentages &amp; Institutional Documentation
          </p>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Academic Year */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 font-semibold focus:outline-none focus:border-navy cursor-pointer shadow-2xs"
            title="Select Academic Year"
          >
            <option value="2026-27">AY 2026-27 (Current)</option>
            <option value="2025-26">AY 2025-26</option>
          </select>

          {/* Class / Division */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 font-semibold focus:outline-none focus:border-navy cursor-pointer shadow-2xs"
            title="Select Class Division"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          {/* Subject Selector */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 font-semibold focus:outline-none focus:border-navy cursor-pointer shadow-2xs max-w-xs"
            title="Select Course Subject"
          >
            {[5, 6, 3, 4, 7, 8].map((sem) => {
              const semSubs = availableSubjects.filter((s) => s.semester === sem);
              if (semSubs.length === 0) return null;
              return (
                <optgroup key={sem} label={`Semester ${sem}`}>
                  {semSubs.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.name} (Sem {s.semester})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          {/* Export PDF / Print Button */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Print or export official report as PDF"
          >
            <span>Export PDF</span>
            <span>↓</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center bg-white rounded border border-rule">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy mx-auto mb-3"></div>
          <p className="text-xs font-medium text-gray-600">Retrieving live class marks from database…</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-6 bg-red-50 border border-red-200 rounded text-center">
          <p className="text-xs font-bold text-red-900 mb-2">Error Loading Report</p>
          <p className="text-xs text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchReport}
            className="px-3 py-1 bg-[#1E2D5A] text-white rounded text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Active Report Header Summary Banner */}
          <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                ACTIVE REPORT:
              </span>
              <span className="ml-2 font-serif text-sm font-bold text-gray-900">
                {subjectInfo ? `${subjectInfo.name} (${subjectInfo.code})` : selectedSubject}
              </span>
              <span className="mx-2 text-gray-400">·</span>
              <span className="font-semibold text-xs text-navy bg-white px-2 py-0.5 rounded border border-gray-300">
                {selectedClass}
              </span>
              <span className="mx-2 text-gray-400">·</span>
              <span className="text-xs text-gray-600">
                Academic Year {selectedYear}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Total Enrolled Students: <strong className="text-gray-900">{metrics.totalStudents}</strong>
            </div>
          </div>

          {/* ─── 4 Real-Time Metric Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pass Percentage */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                Pass Percentage
              </p>
              <p className="font-serif text-3xl font-bold text-emerald-600 mt-1">
                {metrics.passPercentage}
              </p>
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                {metrics.passed} of {metrics.appeared} students cleared
              </p>
            </div>

            {/* Highest Score */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                Highest Score
              </p>
              <p className="font-serif text-3xl font-bold text-navy mt-1">
                {metrics.highestScore}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                {metrics.highestScore >= 80 ? 'Grade Point: 10 (O)' : 'Top Class Score'}
              </p>
            </div>

            {/* Class Average */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                Class Average
              </p>
              <p className="font-serif text-3xl font-bold text-gray-900 mt-1">
                {metrics.avgScore}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Median: {metrics.median}
              </p>
            </div>

            {/* Backlogs */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-2xs">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                Backlogs
              </p>
              <p className="font-serif text-3xl font-bold text-rose-600 mt-1">
                {metrics.backlogs}
              </p>
              <p className="text-xs text-rose-700 mt-1 font-medium">
                {metrics.backlogs === 0 ? 'No backlogs in class' : 'Eligible for remedial support'}
              </p>
            </div>
          </div>

          {/* ─── Two-Column: Grade Distribution & Subject Toppers ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
              <div className="pb-3 border-b border-gray-200 mb-4 flex items-center justify-between">
                <h2 className="font-serif text-base font-bold text-gray-900">
                  Grade Distribution Breakdown
                </h2>
                <span className="text-xs font-semibold text-gray-500">
                  SPPU 10-Point Scale
                </span>
              </div>

              <div className="space-y-3">
                {gradeDist.map((item, idx) => {
                  let barColor = 'bg-navy';
                  if (item.grade.startsWith('O')) barColor = 'bg-emerald-600';
                  else if (item.grade.startsWith('A+')) barColor = 'bg-teal-600';
                  else if (item.grade.startsWith('A')) barColor = 'bg-[#1E2D5A]';
                  else if (item.grade.startsWith('B+')) barColor = 'bg-indigo-600';
                  else if (item.grade.startsWith('B')) barColor = 'bg-blue-500';
                  else if (item.grade.startsWith('C') || item.grade.startsWith('P')) barColor = 'bg-amber-500';
                  else if (item.grade.startsWith('F')) barColor = 'bg-rose-600';

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-800">
                        <span>{item.grade}</span>
                        <span className="font-mono text-gray-600">
                          {item.count} students ({item.pct})
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-gray-200">
                        <div
                          className={`${barColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: item.pct }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-time Subject Toppers */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
              <div className="pb-3 border-b border-gray-200 mb-4 flex items-center justify-between">
                <h2 className="font-serif text-base font-bold text-gray-900">
                  Subject Toppers (Merit List)
                </h2>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Top Achievers
                </span>
              </div>

              {toppers.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 italic">
                  No topper records available for this selection.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-2">Rank</th>
                        <th className="py-2 px-2">Student Name</th>
                        <th className="py-2 px-2">Roll No</th>
                        <th className="py-2 px-2 text-right">Marks</th>
                        <th className="py-2 px-2 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {toppers.map((t) => (
                        <tr key={t.rank} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-2 font-serif font-bold text-navy text-sm">
                            #{t.rank}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-gray-900">
                            {t.name}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px] text-gray-600">
                            {t.roll}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-900">
                            {t.marks}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {t.grade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ─── Complete Class Student Roster & Mark Register Table ─── */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
            <div className="pb-3 border-b border-gray-200 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-base font-bold text-gray-900">
                  Full Class Evaluation Register ({filteredRoster.length} Students)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Detailed breakdown of In-Sem, End-Sem / TW components and awarded grades.
                </p>
              </div>

              {/* Quick Search */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search by name, roll, grade…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy"
                />
              </div>
            </div>

            {filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 bg-slate-50 rounded border border-dashed border-gray-300">
                No students match your current search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-gray-200 z-10">
                    <tr className="text-gray-600 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">PRN</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-right">In-Sem (30M)</th>
                      <th className="py-2.5 px-3 text-right">End-Sem / Lab</th>
                      <th className="py-2.5 px-3 text-right">Total Marks</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3 text-center">Result Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRoster.map((s) => (
                      <tr key={s.student_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-gray-800">
                          {s.roll_no}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-gray-500">
                          {s.enrollment_no}
                        </td>
                        <td className="py-2 px-3 font-semibold text-gray-900">
                          {s.name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-gray-700">
                          {s.insem_marks !== null ? s.insem_marks : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-gray-700">
                          {s.endsem_marks !== null ? s.endsem_marks : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-navy">
                          {s.total_marks} / {s.max_marks}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.grade === 'F'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : s.grade === 'O' || s.grade === 'A+'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            {s.grade}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {s.is_absent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ABSENT
                            </span>
                          ) : s.is_cleared ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-pass border border-green-200">
                              PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              FAIL / BACKLOG
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
