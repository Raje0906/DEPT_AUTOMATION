import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function ClassReports() {
  const [selectedSubject, setSelectedSubject] = useState('DSBDA');

  const reportStats = {
    totalStudents: 79,
    appeared: 79,
    passed: 74,
    passPercentage: '93.7%',
    highestScore: 94,
    avgScore: 71.4,
    gradeDist: [
      { grade: 'O (Outstanding)', count: 8, pct: '10.1%' },
      { grade: 'A+ (Excellent)', count: 22, pct: '27.8%' },
      { grade: 'A (Very Good)', count: 28, pct: '35.4%' },
      { grade: 'B+ (Good)', count: 12, pct: '15.2%' },
      { grade: 'B (Above Avg)', count: 4, pct: '5.1%' },
      { grade: 'F (Backlog)', count: 5, pct: '6.3%' },
    ],
    toppers: [
      { rank: 1, name: 'ACHAWALE VISHWAJA PRADEEP', roll: 'CE6A002', marks: '94/100', grade: 'O' },
      { rank: 2, name: 'AADISH PRAMOD SONAWANE', roll: 'CE6A001', marks: '91/100', grade: 'O' },
      { rank: 3, name: 'ADITYA KUMAR MISHRA', roll: 'CE6A003', marks: '89/100', grade: 'A+' },
      { rank: 4, name: 'ADITYA SANTOSH PATIL', roll: 'CE6A004', marks: '88/100', grade: 'A+' },
    ],
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Class Performance Reports</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Subject-wise Grade Analytics, Pass Percentages &amp; Institutional Documentation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="input-field text-sm font-semibold"
          >
            <option value="DSBDA">DSBDA — Data Science &amp; Big Data (Sem 6)</option>
            <option value="CE501">CE501 — Data Structures &amp; Algorithms (Sem 5)</option>
            <option value="CE502">CE502 — Operating Systems (Sem 5)</option>
            <option value="CE601">CE601 — Software Engineering (Sem 6)</option>
          </select>
          <button
            onClick={() => toast.success('Exporting official departmental report as PDF...')}
            className="btn-primary flex-shrink-0"
          >
            Export PDF ↓
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pass Percentage</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">{reportStats.passPercentage}</p>
          <p className="text-xs text-pass mt-1 font-medium">74 of 79 students cleared</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Highest Score</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">{reportStats.highestScore}</p>
          <p className="text-xs text-draft mt-1 font-medium">Grade Point: 10 (O)</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Class Average</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{reportStats.avgScore}</p>
          <p className="text-xs text-draft mt-1 font-medium">Median: 73.0</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Backlogs</p>
          <p className="font-serif text-3xl font-bold text-[#8B3A3A] mt-1">5</p>
          <p className="text-xs text-draft mt-1 font-medium">Eligible for revaluation / remedial</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Grade Distribution */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold">Grade Distribution Breakdown</h2>
          </div>
          <div className="p-5 space-y-3">
            {reportStats.gradeDist.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-ink">
                  <span>{item.grade}</span>
                  <span className="font-mono">{item.count} students ({item.pct})</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-navy h-full rounded-full transition-all duration-500"
                    style={{ width: item.pct }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subject Merit / Toppers */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold">Subject Toppers</h2>
          </div>
          <table className="result-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student Name</th>
                <th>Roll No</th>
                <th className="numeric">Marks</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {reportStats.toppers.map((t) => (
                <tr key={t.rank}>
                  <td className="font-serif font-bold text-navy text-base">#{t.rank}</td>
                  <td className="font-semibold text-ink text-sm">{t.name}</td>
                  <td className="font-mono text-xs font-bold text-draft">{t.roll}</td>
                  <td className="numeric font-mono font-bold text-ink">{t.marks}</td>
                  <td>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-pass">
                      {t.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
