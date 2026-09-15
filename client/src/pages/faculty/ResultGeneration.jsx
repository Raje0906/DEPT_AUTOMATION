import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';

export default function ResultGeneration() {
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [selectedSemFilter, setSelectedSemFilter] = useState('5'); // Default to Sem 5 (TE Sem 1 AY 2025-26)
  const [selectedDivFilter, setSelectedDivFilter] = useState('ALL');
  const [viewMode, setViewMode]         = useState('grouped'); // 'grouped' (1 card per subject) | 'cards' (individual)

  const fetchSubjects = (year) => {
    setLoading(true);
    const url = `/faculty/subjects?academic_year=${encodeURIComponent(year || '2025-26')}`;
    api.get(url)
      .then(res => {
        setData(res.data);
        if (res.data.selectedYear) {
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
  const academicYears = data?.academicYears?.length > 0 ? data.academicYears : ['2025-26', '2024-25'];

  // Filter subjects based on Semester and Division
  const filteredSubjects = useMemo(() => {
    return allSubjects.filter(s => {
      if (selectedSemFilter !== 'ALL' && String(s.semester) !== String(selectedSemFilter)) {
        return false;
      }
      if (selectedDivFilter !== 'ALL' && s.division !== selectedDivFilter) {
        return false;
      }
      return true;
    });
  }, [allSubjects, selectedSemFilter, selectedDivFilter]);

  // Group by unique Subject (consolidating multiple divisions into one card)
  const groupedSubjects = useMemo(() => {
    const map = new Map();
    for (const s of filteredSubjects) {
      const key = `${s.id}-${s.semester}`;
      if (!map.has(key)) {
        map.set(key, {
          id: s.id,
          code: s.code,
          name: s.name,
          semester: s.semester,
          credits: s.credits,
          subject_type: s.subject_type,
          academic_year: s.academic_year,
          divisions: []
        });
      }
      map.get(key).divisions.push({
        division: s.division,
        map_id: s.map_id,
        submission_status: s.submission_status,
        enrolled_count: s.enrolled_count,
        marks_entered: s.marks_entered,
        academic_year: s.academic_year
      });
    }
    return Array.from(map.values());
  }, [filteredSubjects]);

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">Result Generation &amp; Marks Entry</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Manage evaluations across 8 exam types (Unit Tests, Insem, Mock Exams, Term Work, Practical &amp; End-Sem).
          </p>
        </div>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="academic-year-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Academic Year:
          </label>
          <select
            id="academic-year-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Control Bar: Filters and Layout Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        {/* Semester Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Semester:</span>
          {[
            { label: 'Sem 5 (Current)', val: '5' },
            { label: 'Sem 6', val: '6' },
            { label: 'All Semesters', val: 'ALL' }
          ].map((sem) => (
            <button
              key={sem.val}
              onClick={() => setSelectedSemFilter(sem.val)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                selectedSemFilter === sem.val
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sem.label}
            </button>
          ))}
        </div>

        {/* Division Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Division:</span>
          {['ALL', 'TE 1', 'TE 2', 'TE 3'].map((div) => (
            <button
              key={div}
              onClick={() => setSelectedDivFilter(div)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                selectedDivFilter === div
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {div === 'ALL' ? 'All' : div}
            </button>
          ))}
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
              viewMode === 'grouped' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Consolidate multiple divisions of the same subject into one card"
          >
            📑 Grouped by Subject
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
              viewMode === 'cards' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Show each division as a separate card"
          >
            🗂️ Separate Cards
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading assigned subjects...</div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">📚</div>
          <p className="text-base font-semibold text-gray-800">No subjects found matching selected filters</p>
          <p className="text-xs text-gray-400 mt-1">Try switching to "All Semesters" or "All Divisions".</p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ─── GROUPED VIEW: 1 Card per Subject with Division Selectors ─── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groupedSubjects.map((sub) => (
            <div
              key={sub.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                    {sub.code}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    Sem {sub.semester} · {sub.credits} Credits · <span className="capitalize">{sub.subject_type}</span>
                  </span>
                </div>

                <h3 className="font-serif font-bold text-xl text-gray-950 mt-2">{sub.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  You are assigned to evaluate <strong>{sub.divisions.length}</strong> {sub.divisions.length === 1 ? 'division' : 'divisions'} for this subject.
                </p>

                {/* Division Action Matrix */}
                <div className="mt-5 space-y-2.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    Assigned Divisions — Select to Enter / Edit Marks:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {sub.divisions.map((divInfo) => {
                      const marksUrl = `/faculty/marks/${sub.id}?sem=${sub.semester}&ay=${encodeURIComponent(divInfo.academic_year || academicYear)}&div=${encodeURIComponent(divInfo.division)}`;
                      return (
                        <Link
                          key={divInfo.division}
                          to={marksUrl}
                          className="flex flex-col justify-between p-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg transition-all group shadow-2xs hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-800">
                              Div {divInfo.division}
                            </span>
                            <StatusBadge status={divInfo.submission_status} />
                          </div>
                          <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-500">
                            <span>{divInfo.marks_entered || 0} marks</span>
                            <span className="font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                              Enter →
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── FLAT CARD VIEW: 1 Card per (Subject, Division) ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubjects.map((sub) => {
            const marksUrl = `/faculty/marks/${sub.id}?sem=${sub.semester}&ay=${encodeURIComponent(sub.academic_year)}&div=${encodeURIComponent(sub.division)}`;

            return (
              <div key={sub.map_id || `${sub.id}-${sub.division}`} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {sub.code}
                    </span>
                    <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      Div {sub.division}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-lg text-gray-900 line-clamp-2">{sub.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>Sem {sub.semester}</span>
                    <span>•</span>
                    <span>{sub.credits} Credits</span>
                    <span>•</span>
                    <span className="capitalize">{sub.subject_type}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Status:</span>
                    <StatusBadge status={sub.submission_status} />
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-gray-100">
                  <Link
                    to={marksUrl}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    ✏️ Enter / Edit Marks
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
