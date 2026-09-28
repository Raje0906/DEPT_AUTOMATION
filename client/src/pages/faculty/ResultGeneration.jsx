import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';

export default function ResultGeneration() {
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [selectedClass, setSelectedClass] = useState(''); // Selected division/class
  const [selectedSemFilter, setSelectedSemFilter] = useState('ALL');

  const fetchSubjects = (year) => {
    setLoading(true);
    const url = `/faculty/subjects?academic_year=${encodeURIComponent(year || '2026-27')}`;
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
  const academicYears = data?.academicYears?.length > 0 ? data.academicYears : ['2026-27', '2025-26', '2024-25'];

  // Dynamically extract unique classes/divisions assigned to this faculty
  const availableClasses = useMemo(() => {
    const set = new Set();
    allSubjects.forEach(s => {
      if (s.division) set.add(s.division);
    });
    return Array.from(set).sort();
  }, [allSubjects]);

  // Set default selected class to the first available class once loaded
  useEffect(() => {
    if (!selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Filter subjects strictly based on the chosen class (or ALL) and semester
  const filteredSubjects = useMemo(() => {
    return allSubjects.filter(s => {
      if (selectedClass && selectedClass !== 'ALL' && s.division !== selectedClass) {
        return false;
      }
      if (selectedSemFilter !== 'ALL' && String(s.semester) !== String(selectedSemFilter)) {
        return false;
      }
      return true;
    });
  }, [allSubjects, selectedClass, selectedSemFilter]);

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900">Result Generation &amp; Marks Entry</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Select a class to enter marks in dedicated sections: Assignments, Unit Tests, In-Sem, and End-Sem/Practicals.
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
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          >
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Class & Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Class Selection Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base">
              🎓
            </span>
            <label htmlFor="class-select" className="text-sm font-bold text-gray-800 whitespace-nowrap">
              Select Class:
            </label>
          </div>
          <select
            id="class-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 bg-indigo-50/50 border-2 border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 rounded-xl text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer min-w-[220px]"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                Class {cls}
              </option>
            ))}
            <option value="ALL">All Assigned Classes ({availableClasses.length})</option>
          </select>
          {selectedClass && selectedClass !== 'ALL' && (
            <span className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full font-semibold border border-indigo-100">
              Showing subjects for <strong>{selectedClass}</strong> only
            </span>
          )}
        </div>

        {/* Semester Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Semester:</span>
          {[
            { label: 'All', val: 'ALL' },
            { label: 'Sem 5', val: '5' },
            { label: 'Sem 6', val: '6' }
          ].map((sem) => (
            <button
              key={sem.val}
              onClick={() => setSelectedSemFilter(sem.val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedSemFilter === sem.val
                  ? 'bg-gray-900 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {sem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading subjects for selected class...</div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-2xs">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">📚</div>
          <p className="text-lg font-bold text-gray-800">No subjects found for {selectedClass === 'ALL' ? 'the selected filters' : `Class ${selectedClass}`}</p>
          <p className="text-sm text-gray-400 mt-1">Please select another class from the dropdown above or switch to "All Classes".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredSubjects.map((sub) => {
            const baseMarksUrl = `/faculty/marks/${sub.id}?sem=${sub.semester}&ay=${encodeURIComponent(sub.academic_year)}&div=${encodeURIComponent(sub.division)}`;

            return (
              <div
                key={sub.map_id || `${sub.id}-${sub.division}`}
                className="bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                        {sub.code}
                      </span>
                      <span className="text-xs font-bold text-gray-800 bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md">
                        Class {sub.division}
                      </span>
                    </div>
                    <StatusBadge status={sub.submission_status} />
                  </div>

                  {/* Subject Name & Meta */}
                  <h2 className="font-serif font-bold text-2xl text-gray-900 tracking-tight">{sub.name}</h2>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 font-medium">
                    <span>Semester {sub.semester}</span>
                    <span>•</span>
                    <span>{sub.credits} Credits</span>
                    <span>•</span>
                    <span className="capitalize">{sub.subject_type} Course</span>
                    <span>•</span>
                    <span>{sub.enrolled_count || 0} Students Enrolled</span>
                  </div>

                  {/* ─── SEPARATE EVALUATION SECTIONS ─── */}
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Enter Marks By Section:
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Section 1: Assignments & Term Work */}
                      <Link
                        to={`${baseMarksUrl}&section=assignments`}
                        className="p-3 bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/80 rounded-xl transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">📚</span>
                            <span className="text-xs font-bold text-amber-900 group-hover:text-amber-950">
                              Assignments &amp; TW
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-700 leading-tight">
                            Assignment 1 &amp; 2, Attendance, Timely Sub.
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-[11px] font-bold text-amber-900 group-hover:underline">
                            Enter Marks (25M) →
                          </span>
                        </div>
                      </Link>

                      {/* Section 2: Unit Tests */}
                      <Link
                        to={`${baseMarksUrl}&section=ut`}
                        className="p-3 bg-blue-50/60 hover:bg-blue-100/70 border border-blue-200/80 rounded-xl transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">📝</span>
                            <span className="text-xs font-bold text-blue-900 group-hover:text-blue-950">
                              Unit Tests (UT)
                            </span>
                          </div>
                          <p className="text-[11px] text-blue-700 leading-tight">
                            Unit Test 1 (30M) &amp; Unit Test 2 (30M)
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-[11px] font-bold text-blue-900 group-hover:underline">
                            Enter UT Marks →
                          </span>
                        </div>
                      </Link>

                      {/* Section 3: In-Sem Exam */}
                      <Link
                        to={`${baseMarksUrl}&section=insem`}
                        className="p-3 bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-xl transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">📋</span>
                            <span className="text-xs font-bold text-emerald-900 group-hover:text-emerald-950">
                              In-Sem Exam
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-700 leading-tight">
                            In-Semester Midterm Exam (30 Marks)
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-[11px] font-bold text-emerald-900 group-hover:underline">
                            Enter In-Sem →
                          </span>
                        </div>
                      </Link>

                      {/* Section 4: End-Sem & Practicals */}
                      <Link
                        to={`${baseMarksUrl}&section=endsem`}
                        className="p-3 bg-purple-50/60 hover:bg-purple-100/70 border border-purple-200/80 rounded-xl transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-base">🎓</span>
                            <span className="text-xs font-bold text-purple-900 group-hover:text-purple-950">
                              End-Sem &amp; Oral
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-700 leading-tight">
                            End-Sem (70M), Practical &amp; Mock Exams
                          </p>
                        </div>
                        <div className="mt-3 text-right">
                          <span className="text-[11px] font-bold text-purple-900 group-hover:underline">
                            Enter End-Sem →
                          </span>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Open Master Sheet Action */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    to={baseMarksUrl}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-900 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    <span>✏️</span> Open Full Marks Sheet for {sub.division}
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
