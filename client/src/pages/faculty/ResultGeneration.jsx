import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';
import { ALL_CLASSES } from '../../utils/academicClasses';

export default function ResultGeneration() {
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [selectedYearFilter, setSelectedYearFilter] = useState('ALL'); // 'ALL' | 'SE' | 'TE' | 'BE'
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');

  const fetchSubjects = (year) => {
    setLoading(true);
    const url = year ? `/faculty/subjects?academic_year=${encodeURIComponent(year)}` : '/faculty/subjects';
    api.get(url)
      .then(res => {
        setData(res.data);
        if (!academicYear && res.data.selectedYear) {
          setAcademicYear(res.data.selectedYear);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubjects(academicYear);
  }, [academicYear]);

  const allSubjects   = data?.subjects || [];
  const academicYears = data?.academicYears || [];

  // Filter subjects based on Year and Class
  const filteredSubjects = allSubjects.filter(s => {
    const sem = parseInt(s.semester, 10);
    if (selectedYearFilter === 'SE' && sem !== 3 && sem !== 4) return false;
    if (selectedYearFilter === 'TE' && sem !== 5 && sem !== 6) return false;
    if (selectedYearFilter === 'BE' && sem !== 7 && sem !== 8) return false;
    if (selectedClassFilter !== 'ALL' && s.division !== selectedClassFilter) return false;
    return true;
  });

  const pending = filteredSubjects.filter(s => s.submission_status === 'not_started' || s.submission_status === 'draft');

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Result Generation</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Enter Continuous Internal Evaluation (CIE), Practical &amp; End-Sem marks to generate student results
          </p>
        </div>

        {/* Academic Year Selector */}
        {academicYears.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="academic-year-select" className="text-xs font-semibold text-draft uppercase tracking-wider">
              Academic Year:
            </label>
            <select
              id="academic-year-select"
              value={academicYear || data?.selectedYear || ''}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="px-3 py-1.5 bg-white border border-rule rounded text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
            >
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filter Bar: SE / TE / BE & Class */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded border border-rule">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-draft uppercase tracking-wider mr-1">Filter by Year:</span>
          {['ALL', 'SE', 'TE', 'BE'].map((yr) => (
            <button
              key={yr}
              onClick={() => {
                setSelectedYearFilter(yr);
                setSelectedClassFilter('ALL');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                selectedYearFilter === yr
                  ? 'bg-maroon text-white shadow-sm'
                  : 'bg-gray-100 text-ink hover:bg-gray-200'
              }`}
            >
              {yr === 'ALL' ? 'All Classes' : `${yr} Classes`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="class-filter" className="text-xs font-bold text-draft uppercase tracking-wider">
            Class:
          </label>
          <select
            id="class-filter"
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-rule rounded text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
          >
            <option value="ALL">All 4 Classes</option>
            {ALL_CLASSES.filter(c => {
              if (selectedYearFilter === 'SE') return c.startsWith('SE');
              if (selectedYearFilter === 'TE') return c.startsWith('TE');
              if (selectedYearFilter === 'BE') return c.startsWith('BE');
              return true;
            }).map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Required Banner */}
      {pending.length > 0 && (
        <div className="notification-strip mb-8 py-3.5 px-5 text-sm">
          <span className="text-xs font-bold text-navy uppercase tracking-wider mr-2.5 bg-blue-100 px-2 py-0.5 rounded">
            Action required
          </span>
          <span className="font-medium text-ink">
            {pending.length} subject{pending.length > 1 ? 's have' : ' has'} marks not yet submitted for selected classes.
          </span>
        </div>
      )}

      {/* Main Table Panel */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">
            Assigned Subjects — {academicYear || data?.selectedYear || '2025-26'}
          </h2>
          <span className="text-xs font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">
            {filteredSubjects.length} courses displayed
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-draft">Loading subjects…</div>
        ) : filteredSubjects.length === 0 ? (
          <div className="empty-state py-12 text-center">
            <p className="text-base text-draft">
              No subjects found for selected filters ({selectedYearFilter} · {selectedClassFilter}).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="result-table w-full">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th className="numeric">Semester</th>
                  <th>Class</th>
                  <th className="numeric">Enrolled</th>
                  <th className="numeric">Marks entered</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((s, i) => (
                  <tr key={s.map_id || i}>
                    <td className="font-semibold text-ink text-base">{s.name}</td>
                    <td className="font-mono text-sm font-bold text-draft">{s.code}</td>
                    <td className="numeric font-medium text-base">Sem {s.semester}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        {s.division}
                      </span>
                    </td>
                    <td className="numeric font-medium text-base">{s.enrolled_count}</td>
                    <td className="numeric font-semibold text-base">
                      {s.marks_entered} / {s.enrolled_count}
                    </td>
                    <td><StatusBadge status={s.submission_status} /></td>
                    <td className="text-right">
                      {(s.submission_status === 'draft' || s.submission_status === 'not_started') && (
                        <Link
                          to={`/faculty/marks/${s.id}?sem=${s.semester}&ay=${s.academic_year}&div=${encodeURIComponent(s.division)}`}
                          className="inline-flex items-center px-4 py-1.5 bg-maroon hover:bg-[#4E1C27] text-white text-xs font-semibold rounded shadow-sm transition-colors"
                        >
                          Enter marks →
                        </Link>
                      )}
                      {(s.submission_status === 'submitted' || s.submission_status === 'approved' || s.submission_status === 'published') && (
                        <Link
                          to={`/faculty/marks/${s.id}?sem=${s.semester}&ay=${s.academic_year}&div=${encodeURIComponent(s.division)}`}
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
          </div>
        )}
      </div>
    </div>
  );
}
