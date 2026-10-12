import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function InsemMarksheetAnalysis() {
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
      const res = await api.get(`/faculty/marksheet/insem-cce?subjectId=${selectedSubjectId}&division=${encodeURIComponent(selectedClass)}&academicYear=${encodeURIComponent(academicYear)}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching in-sem marksheet:', err);
      toast.error('Failed to load In-Sem marksheet data');
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
            In-Semester Examination Marksheet &amp; Analysis
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Continuous Comprehensive Evaluation (CCE) — 30 Marks. Performance report and action plan.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Link
            to="/faculty/remedial"
            className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-2xs"
          >
            Remedial Classes
          </Link>
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
        <div className="py-12 text-center text-xs text-gray-400">Loading In-Sem Marksheet...</div>
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
                  IN-SEMESTER EXAMINATION MARKSHEET (INTERNAL ASSESSMENT)
                </h2>
                <p className="text-xs text-gray-500">
                  AY {academicYear} | Semester {data.subject?.semester} | Class: {selectedClass}
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
                <span className="font-semibold text-gray-500 block">Subject Teacher:</span>
                <span className="font-bold text-gray-900">{data.faculty?.faculty_name || 'Assigned Faculty'}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-500 block">Maximum Marks:</span>
                <span className="font-bold text-gray-900">30 Marks (Passing: 12 Marks / 40%)</span>
              </div>
            </div>
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Students</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{data.summary.totalStudents}</p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Appeared</span>
              <p className="text-xl font-bold text-gray-800 mt-1">
                {data.summary.appeared}
                <span className="text-xs font-normal text-gray-500 ml-1">({data.summary.absent} Absent)</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Passed (≥ 12M)</span>
              <p className="text-xl font-bold text-[#3B6B47] mt-1">
                {data.summary.passed}
                <span className="text-xs font-normal text-gray-500 ml-1">({data.summary.passPercentage}%)</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-red-200 rounded-md">
              <span className="text-[11px] text-red-700 uppercase font-semibold">Below 12M (Remedial)</span>
              <p className="text-xl font-bold text-red-700 mt-1">{data.summary.failed}</p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Class Average</span>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {data.summary.averageMark}
                <span className="text-xs font-normal text-gray-500 ml-1">/ 30</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-gray-200 rounded-md">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">Highest Mark</span>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {data.summary.highestMark}
                <span className="text-xs font-normal text-gray-500 ml-1">/ 30</span>
              </p>
            </div>
          </div>

          {/* Remedial Action Plan Notice */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Remedial Action Plan
              </h3>
              <Link
                to="/faculty/remedial"
                className="text-xs text-[#1E2D5A] font-semibold hover:underline"
              >
                Manage Action Plan →
              </Link>
            </div>

            {data.remedialPlan ? (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-1">
                <p className="font-bold text-gray-900">{data.remedialPlan.title}</p>
                <p className="text-gray-600">
                  <strong className="text-gray-700">Topics to address:</strong> {data.remedialPlan.weak_topics || 'General revision'}
                </p>
                <div className="flex gap-4 pt-1 font-medium text-gray-600">
                  <span>Enrolled: <strong>{data.remedialPlan.assigned_students}</strong></span>
                  <span>Attended: <strong>{data.remedialPlan.attended_students}</strong></span>
                  <span>Cleared Retest: <strong className="text-[#3B6B47]">{data.remedialPlan.cleared_students}</strong></span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-600 flex items-center justify-between">
                <span>No remedial action plan linked for this exam yet.</span>
                <Link
                  to="/faculty/remedial"
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded"
                >
                  Create Plan
                </Link>
              </div>
            )}
          </div>

          {/* Marksheet Roster Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Student In-Sem Marks (/30)
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {data.students.length} Students
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                    <th className="py-2 px-3 w-10 text-center">Sr.</th>
                    <th className="py-2 px-3">Roll No</th>
                    <th className="py-2 px-3">PRN</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-3 text-center">Marks Obtained (/30)</th>
                    <th className="py-2 px-3 text-center">Result</th>
                    <th className="py-2 px-3">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.students.map((st, idx) => {
                    const isFail = st.result.includes('FAIL') || st.isAbsent;
                    return (
                      <tr
                        key={st.student_id || idx}
                        className={isFail ? 'bg-red-50/25' : 'hover:bg-gray-50/50'}
                      >
                        <td className="py-2 px-3 text-center font-mono text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-900">
                          {st.roll_no}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-500">
                          {st.enrollment_no}
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-900">
                          {st.student_name}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {st.isAbsent ? (
                            <span className="text-red-600 font-medium">Absent</span>
                          ) : st.numericMark !== null ? (
                            <span className={st.numericMark < 12 ? 'text-red-700' : 'text-gray-900'}>
                              {st.numericMark}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {st.result === 'PASS' ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              PASS
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
                              REMEDIAL REQUIRED
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {st.performanceBand}
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
                <p className="font-bold text-gray-900">Senior Supervisor</p>
                <p className="text-gray-600">Internal Verification</p>
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
