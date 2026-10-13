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
      <div className="mb-6 pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Result Generation &amp; Evaluation Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-normal">
            Manage continuous assessments, in-semester examinations, and term marks by class division.
          </p>
        </div>

        {/* Academic Year Selector */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <label htmlFor="academic-year-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Academic Year:
          </label>
          <select
            id="academic-year-select"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1E2D5A] shadow-2xs"
          >
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Class & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Class Selection Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="class-select" className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
            Assigned Class:
          </label>
          <select
            id="class-select"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-[#1E2D5A] rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E2D5A] transition-colors cursor-pointer min-w-[200px]"
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                Class {cls}
              </option>
            ))}
            <option value="ALL">All Assigned Classes ({availableClasses.length})</option>
          </select>
          {selectedClass && selectedClass !== 'ALL' && (
            <span className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded font-medium border border-slate-200">
              Displaying subjects for <strong>{selectedClass}</strong>
            </span>
          )}
        </div>

        {/* Semester Filter Tabs */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Semester:</span>
          {[
            { label: 'All', val: 'ALL' },
            { label: 'Sem 3 (SE)', val: '3' },
            { label: 'Sem 4 (SE)', val: '4' },
            { label: 'Sem 5 (TE)', val: '5' },
            { label: 'Sem 6 (TE)', val: '6' }
          ].map((sem) => (
            <button
              key={sem.val}
              onClick={() => setSelectedSemFilter(sem.val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedSemFilter === sem.val
                  ? 'bg-[#1E2D5A] text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sem.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 text-sm font-medium">Loading course assignments...</div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-2xs">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-base font-bold text-slate-800">No subjects found for {selectedClass === 'ALL' ? 'the selected filters' : `Class ${selectedClass}`}</p>
          <p className="text-xs text-slate-400 mt-1">Please select another class division or clear semester filters above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredSubjects.map((sub) => {
            const baseMarksUrl = `/faculty/marks/${sub.id}?sem=${sub.semester}&ay=${encodeURIComponent(sub.academic_year)}&div=${encodeURIComponent(sub.division)}`;

            return (
              <div
                key={sub.map_id || `${sub.id}-${sub.division}`}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Code, Division & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {sub.code}
                      </span>
                      <span className="text-xs font-semibold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        Class {sub.division}
                      </span>
                    </div>
                    <StatusBadge status={sub.submission_status} />
                  </div>

                  {/* Subject Name & Meta */}
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">{sub.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-500 font-normal">
                    <span>Semester {sub.semester}</span>
                    <span>·</span>
                    <span>{sub.credits} Credits</span>
                    <span>·</span>
                    <span className="capitalize">{sub.subject_type} Course</span>
                    <span>·</span>
                    <span>{sub.enrolled_count || 0} Students</span>
                  </div>

                  {/* Assessment Portals */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      Evaluation Components
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Component 1: Assignments & Term Work */}
                      <Link
                        to={`${baseMarksUrl}&section=assignments`}
                        className="group p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex flex-col justify-between bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E2D5A] group-hover:text-white transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#1E2D5A]">Assignments &amp; TW</p>
                              <p className="text-[11px] text-slate-500 leading-tight">Continuous Term Work</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">25M</span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 group-hover:text-[#1E2D5A]">
                          <span>Enter Marks</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </Link>

                      {/* Component 2: Unit Tests */}
                      <Link
                        to={`${baseMarksUrl}&section=ut`}
                        className="group p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex flex-col justify-between bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E2D5A] group-hover:text-white transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#1E2D5A]">Unit Tests (UT)</p>
                              <p className="text-[11px] text-slate-500 leading-tight">UT1 &amp; UT2 Assessments</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">30M</span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 group-hover:text-[#1E2D5A]">
                          <span>Enter Marks</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </Link>

                      {/* Component 3: In-Sem Exam */}
                      <Link
                        to={`${baseMarksUrl}&section=insem`}
                        className="group p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex flex-col justify-between bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E2D5A] group-hover:text-white transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#1E2D5A]">In-Sem Exam</p>
                              <p className="text-[11px] text-slate-500 leading-tight">Mid-Term CCE Evaluation</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">30M</span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 group-hover:text-[#1E2D5A]">
                          <span>Enter Marks</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </Link>

                      {/* Component 4: End-Sem & Practicals */}
                      <Link
                        to={`${baseMarksUrl}&section=endsem`}
                        className="group p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition-all flex flex-col justify-between bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E2D5A] group-hover:text-white transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 group-hover:text-[#1E2D5A]">End-Sem &amp; Oral</p>
                              <p className="text-[11px] text-slate-500 leading-tight">Theory &amp; Practical Finals</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">70M / 25M</span>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600 group-hover:text-[#1E2D5A]">
                          <span>Enter Marks</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="mt-5 pt-3.5 border-t border-slate-100">
                  <Link
                    to={baseMarksUrl}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#1E2D5A] hover:bg-[#152042] text-white rounded-lg text-xs font-semibold tracking-wide transition-colors shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Open Consolidated Marksheet ({sub.division})</span>
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
