import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function EndTermInternalMarksheet() {
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [selectedClass, setSelectedClass] = useState('TE 1');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [availableDivisions, setAvailableDivisions] = useState(['TE 1', 'TE 2', 'SE 1', 'SE 2']);
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.get(`/faculty/subjects?academic_year=${encodeURIComponent(academicYear)}`);
        const subList = res.data?.subjects || [];
        setSubjects(subList);
        if (subList.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(String(subList[0].id));
          if (subList[0].division) setSelectedClass(subList[0].division);
        }
        const divs = Array.from(new Set(subList.map(s => s.division).filter(Boolean)));
        if (divs.length > 0) setAvailableDivisions(divs);
      } catch (err) {
        console.error('Error fetching subjects:', err);
        toast.error('Failed to load subject list');
      }
    };
    fetchSubjects();
  }, [academicYear]);

  const loadMarksheet = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/faculty/marksheet/end-term-internal?subjectId=${selectedSubjectId}&division=${encodeURIComponent(selectedClass)}&academicYear=${encodeURIComponent(academicYear)}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching end-term internal marksheet:', err);
      toast.error('Failed to load End-Term Internal marksheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarksheet();
  }, [selectedSubjectId, selectedClass, academicYear]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">
            End-Term Internal Evaluation Marksheet
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Consolidated Continuous Evaluation: Term Work (25M), Practical / Oral (25M), and Internal Mock Theory.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-[#1E2D5A] hover:bg-[#152042] text-white rounded-md text-xs font-semibold shadow-2xs"
          >
            Print Marksheet
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Academic Year
            </label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800"
            >
              <option value="2026-27">2026-27</option>
              <option value="2025-26">2025-26</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Class / Division
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800"
            >
              {availableDivisions.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Course / Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={loadMarksheet}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Loading End-Term Internal Marksheet...</div>
      ) : !data ? (
        <div className="py-12 text-center text-xs text-gray-400">Select course and class to view marksheet.</div>
      ) : (
        <div className="space-y-6">
          {/* Institutional Marksheet Header */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs space-y-3">
            <div className="text-center border-b border-gray-200 pb-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <img
                src="/images/college-logo.jpg"
                alt="MES Wadia COE Logo"
                className="h-14 w-auto object-contain flex-shrink-0"
              />
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                  MES WADIA COLLEGE OF ENGINEERING · DEPT. OF COMPUTER ENGINEERING
                </p>
                <h2 className="font-serif text-lg font-bold text-gray-900 mt-0.5">
                  CONSOLIDATED INTERNAL ASSESSMENT &amp; TERM WORK LEDGER
                </h2>
                <p className="text-xs text-gray-500">
                  AY {academicYear} | Semester {data.subject?.semester} | Class: {selectedClass} | {data.subject?.has_practical ? 'Theory & Practical' : 'Theory Only'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="font-semibold text-gray-500 block">Course Name:</span>
                <span className="font-bold text-gray-900">{data.subject?.name}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 block">Course Code:</span>
                <span className="font-mono font-bold text-gray-800">{data.subject?.code}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 block">Course Teacher:</span>
                <span className="font-bold text-gray-900">{data.faculty?.faculty_name || 'Assigned Faculty'}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 block">Eligibility Criterion:</span>
                <span className="font-bold text-gray-900">Minimum 40% (TW: 10/25, PR: 10/25)</span>
              </div>
            </div>
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Students</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.totalStudents}</p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Qualified for University Exam</span>
              <p className="text-xl font-bold text-[#3B6B47] mt-1">
                {data.summary.qualified}
                <span className="text-xs font-normal text-gray-500 ml-1">({data.summary.qualificationPercentage}%)</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-red-200 rounded-md">
              <span className="text-[11px] text-red-700 uppercase font-semibold">Detention / Shortfall Risk</span>
              <p className="text-xl font-bold text-red-700 mt-1">{data.summary.atRisk}</p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Class Avg Internal</span>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {data.summary.averageInternal}
                <span className="text-xs font-normal text-gray-500 ml-1">/ {data.subject?.has_practical ? '50' : '25'}</span>
              </p>
            </div>
          </div>

          {/* Internal Mark Ledger */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Consolidated Internal Evaluation Ledger
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {data.students.length} Candidates
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-[11px] font-semibold">
                    <th className="py-2 px-3 w-10 text-center">Sr.</th>
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-2 text-center text-gray-500">Att. (5)</th>
                    <th className="py-2 px-2 text-center text-gray-500">Ass 1 (7)</th>
                    <th className="py-2 px-2 text-center text-gray-500">Ass 2 (7)</th>
                    <th className="py-2 px-2 text-center text-gray-500">Time (6)</th>
                    <th className="py-2 px-3 text-center font-bold text-gray-800 bg-gray-50">Total TW (/25)</th>
                    {data.subject?.has_practical && (
                      <th className="py-2 px-3 text-center font-bold text-gray-800 bg-gray-50">PR/Oral (/25)</th>
                    )}
                    <th className="py-2 px-3 text-center text-gray-700">Mock Theory (/70)</th>
                    <th className="py-2 px-3 text-center font-bold text-gray-900">Total Internal</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.students.map((st, idx) => {
                    const isAtRisk = st.internalStatus === 'DETENTION_RISK';
                    return (
                      <tr
                        key={st.student_id || idx}
                        className={isAtRisk ? 'bg-red-50/25' : 'hover:bg-gray-50/50'}
                      >
                        <td className="py-2 px-3 text-center font-mono text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-900">
                          {st.roll_no}
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-900">
                          {st.student_name}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {st.termWork?.attendance_marks || 0}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {st.termWork?.assignment_1_marks || 0}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {st.termWork?.assignment_2_marks || 0}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-gray-600">
                          {st.termWork?.timely_submission_marks || 0}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold bg-gray-50/40">
                          <span className={st.twTotal < 10 ? 'text-red-700' : 'text-gray-900'}>
                            {st.twTotal}
                          </span>
                        </td>
                        {data.subject?.has_practical && (
                          <td className="py-2 px-3 text-center font-mono font-bold bg-gray-50/40">
                            {st.isPracticalAbsent ? (
                              <span className="text-red-600">AB</span>
                            ) : (
                              <span className={st.practicalMarks < 10 ? 'text-red-700' : 'text-gray-900'}>
                                {st.practicalMarks}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3 text-center font-mono text-gray-800">
                          {st.isMockAbsent ? (
                            <span className="text-red-600">AB</span>
                          ) : (
                            st.mockTheoryMarks
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-gray-900">
                          {st.totalInternal} / {st.maxInternal}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {st.internalStatus === 'QUALIFIED' ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Qualified
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                              Detention Risk
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print Signature Block */}
          <div className="hidden print:block pt-12 mt-8 border-t border-gray-400 space-y-12 text-xs">
            <div className="grid grid-cols-3 gap-6 text-center pt-6">
              <div className="border-t border-gray-800 pt-2">
                <p className="font-bold text-gray-900">{data.faculty?.faculty_name || 'Subject Teacher'}</p>
                <p className="text-gray-600">Subject Teacher</p>
              </div>
              <div className="border-t border-gray-800 pt-2">
                <p className="font-bold text-gray-900">Academic Coordinator</p>
                <p className="text-gray-600">Academic Monitoring</p>
              </div>
              <div className="border-t border-gray-800 pt-2">
                <p className="font-bold text-gray-900">Head of Department</p>
                <p className="text-gray-600">HOD (Computer Engg)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
