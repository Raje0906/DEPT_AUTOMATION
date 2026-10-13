import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon, ArrowDownTrayIcon, AcademicCapIcon, UserGroupIcon,
  ChartBarIcon, StarIcon, CheckCircleIcon, ArrowPathIcon
} from '@heroicons/react/24/outline';
import api from '../../../api/axios';

export default function FeedbackAnalyticsView({ formId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/feedback/analytics/${formId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load feedback analytics report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [formId]);

  const handleExportCSV = () => {
    if (!data || !data.facultyAverages) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `TE Mid-Sem Feedback Report - ${data.form?.title || 'Form'}\n`;
    csvContent += `Academic Year: ${data.form?.academic_year || ''}, Semester: ${data.form?.semester || ''}, Division: ${data.form?.division || ''}\n`;
    csvContent += `Total Submissions: ${data.totalSubmissions || 0}, Overall Average: ${data.overallAverage || 'N/A'}/10\n\n`;

    csvContent += 'FACULTY PERFORMANCE BREAKDOWN\n';
    csvContent += 'Faculty Name,Subject Name,Section Type,Average Rating (1-10),Total Ratings\n';
    data.facultyAverages.forEach((f) => {
      csvContent += `"${f.faculty_name}","${f.subject_name || 'N/A'}","${f.theory_avg ? 'Theory' : 'Practical'}",${f.avg_rating},${f.total_ratings}\n`;
    });

    if (data.questionAverages && data.questionAverages.length > 0) {
      csvContent += '\nQUESTION-WISE EVALUATION BREAKDOWN\n';
      csvContent += 'Question No,Section Type,Question Text,Average Rating (1-10)\n';
      data.questionAverages.forEach((q) => {
        csvContent += `${q.question_number},"${q.section_type}","${q.question_text.replace(/"/g, '""')}",${q.avg_rating}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `feedback_report_${data.form?.id || 'te'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded border border-rule">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy mb-3"></div>
        <p className="text-sm text-draft">Compiling analytical metrics and score distributions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700 space-y-3">
        <p className="font-bold text-sm">Error Loading Analytics:</p>
        <p className="text-xs">{error}</p>
        <button
          onClick={onBack}
          className="px-3 py-1 bg-white border border-red-300 rounded text-xs font-semibold text-red-800"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { form, totalSubmissions, overallAverage, facultyAverages = [], questionAverages = [], divisionBreakdown = [] } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-rule rounded hover:bg-paper transition-colors text-ink"
            title="Return to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-draft">
              Feedback Analytics & Assessment Report
            </span>
            <h1 className="text-2xl font-serif font-bold text-ink">
              {form?.title}
            </h1>
            <p className="text-xs text-draft mt-0.5">
              AY {form?.academic_year} · Semester {form?.semester} · Target: {form?.division}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="px-3 py-2 text-xs font-semibold text-ink bg-white border border-rule rounded hover:bg-paper flex items-center gap-1.5 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={totalSubmissions === 0}
            className="px-3 py-2 text-xs font-semibold text-white bg-navy rounded hover:bg-[#162142] disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Submissions</span>
            <UserGroupIcon className="w-4 h-4" />
          </div>
          <p className="text-3xl font-serif font-bold text-ink mt-2">
            {totalSubmissions}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Students responded</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Overall Average</span>
            <StarIcon className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-navy mt-2">
            {overallAverage ? `${overallAverage}` : '—'}
            <span className="text-sm font-sans text-draft font-normal"> / 10</span>
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Across all criteria</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Evaluated Faculty</span>
            <AcademicCapIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-ink mt-2">
            {facultyAverages.length}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Dynamic allocation mappings</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Status</span>
            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold uppercase tracking-wider text-emerald-600 mt-2">
            {form?.status}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Verified HOD snapshot</p>
        </div>
      </div>

      {totalSubmissions === 0 ? (
        <div className="bg-white p-12 text-center rounded border border-rule">
          <ChartBarIcon className="w-12 h-12 text-draft mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-ink">No Student Submissions Yet</h3>
          <p className="text-xs text-draft mt-1 max-w-md mx-auto">
            Once students submit feedback, dynamic performance indicators, average scores, and faculty distributions will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Faculty Wise Performance Table */}
          <div className="bg-white rounded border border-rule overflow-hidden">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Faculty-Wise Feedback Performance
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Calculated against actual student responses on the 1–10 scale.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-rule text-draft uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3">Faculty Member</th>
                    <th className="px-4 py-3">Allocated Course</th>
                    <th className="px-4 py-3 text-center">Theory Avg</th>
                    <th className="px-4 py-3 text-center">Practical Avg</th>
                    <th className="px-4 py-3 text-center">Overall Score</th>
                    <th className="px-4 py-3 text-right">Total Ratings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {facultyAverages.map((fac, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-ink">
                        {fac.faculty_name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {fac.subject_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-gray-600">
                        {fac.theory_avg ? `${fac.theory_avg} / 10` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-gray-600">
                        {fac.practical_avg ? `${fac.practical_avg} / 10` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          parseFloat(fac.avg_rating) >= 8.5
                            ? 'bg-emerald-100 text-emerald-800'
                            : parseFloat(fac.avg_rating) >= 7.0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fac.avg_rating} / 10
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-draft font-medium">
                        {fac.total_ratings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Question-Wise Performance Table */}
          {questionAverages.length > 0 && (
            <div className="bg-white rounded border border-rule overflow-hidden">
              <div className="px-6 py-4 border-b border-rule bg-paper">
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Question-Wise Evaluation Breakdown
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Exact questions matching the 37-page TE Mid-Sem Feedback form.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-rule text-draft uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-6 py-3 w-16">Q#</th>
                      <th className="px-4 py-3 w-28">Section</th>
                      <th className="px-4 py-3">Question Text</th>
                      <th className="px-6 py-3 text-right w-36">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {questionAverages.map((q, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-navy">
                          Q{q.question_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                            {q.section_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-800 font-medium">
                          {q.question_text}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-navy">
                          {q.avg_rating} / 10
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Division Response Breakdown */}
          {divisionBreakdown.length > 0 && (
            <div className="bg-white rounded border border-rule p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                Student Participation by Division
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {divisionBreakdown.map((div, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded border border-rule flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{div.division}</span>
                    <span className="text-xs font-semibold text-navy bg-white px-2 py-0.5 rounded border border-rule">
                      {div.count} responses
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
