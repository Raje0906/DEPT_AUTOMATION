import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function MarksEntry() {
  const { subjectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const semester     = searchParams.get('sem') || '5';
  const academicYear = searchParams.get('ay')  || '2025-26';
  const division     = searchParams.get('div') || 'TE 1';
  const examParam    = searchParams.get('exam');

  const [subject, setSubject]             = useState(null);
  const [examTypes, setExamTypes]         = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [students, setStudents]           = useState([]);
  const [marks, setMarks]                 = useState({});   // studentId -> { marksObtained, isAbsent }
  const [twMarks, setTwMarks]             = useState({});   // studentId -> { attendance, assignment1, assignment2, timelySubmission }
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [isLocked, setIsLocked]           = useState(false);
  const [rbacError, setRbacError]         = useState(null);

  const fetchMarksData = (targetExamId) => {
    setLoading(true);
    setRbacError(null);
    let url = `/faculty/marks/${subjectId}?semester=${semester}&academic_year=${encodeURIComponent(academicYear)}&division=${encodeURIComponent(division)}`;
    if (targetExamId) {
      url += `&exam_type_id=${targetExamId}`;
    }

    api.get(url)
      .then(res => {
        setSubject(res.data.subject);
        setExamTypes(res.data.examTypes);
        setStudents(res.data.students);

        const currentExamId = res.data.selectedExamTypeId;
        setSelectedExamId(currentExamId);

        // Pre-fill existing marks & term work
        const initialMarks = {};
        const initialTw = {};

        for (const s of res.data.students) {
          initialMarks[s.student_id] = {
            marksObtained: s.marks_obtained ?? '',
            isAbsent: Boolean(s.is_absent),
          };

          initialTw[s.student_id] = {
            attendance: s.attendance_marks ?? '',
            assignment1: s.assignment_1_marks ?? '',
            assignment2: s.assignment_2_marks ?? '',
            timelySubmission: s.timely_submission_marks ?? '',
          };
        }

        setMarks(initialMarks);
        setTwMarks(initialTw);

        const locked = res.data.students.some(s => s.status === 'published');
        setIsLocked(locked);
      })
      .catch(err => {
        if (err.response?.status === 403) {
          setRbacError(err.response?.data?.error || 'You are not authorized to view or enter marks for this subject/division.');
        } else {
          toast.error(err.response?.data?.error || 'Failed to load marks');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMarksData(examParam ? parseInt(examParam, 10) : null);
  }, [subjectId, semester, academicYear, division]);

  const currentExam = examTypes.find(e => e.id === selectedExamId) || examTypes[0];
  const isTermWork = currentExam?.code === 'term_work';
  const maxAllowed = Number(currentExam?.default_max_marks || 100);

  const handleExamTypeChange = (newExamId) => {
    const id = parseInt(newExamId, 10);
    setSelectedExamId(id);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('exam', id);
      return p;
    });
    fetchMarksData(id);
  };

  const updateMark = (studentId, val) => {
    if (isLocked) return;
    setMarks(m => ({
      ...m,
      [studentId]: { ...m[studentId], marksObtained: val, isAbsent: false }
    }));
  };

  const toggleAbsent = (studentId) => {
    if (isLocked) return;
    setMarks(m => {
      const curr = m[studentId]?.isAbsent;
      return {
        ...m,
        [studentId]: {
          marksObtained: !curr ? '0' : '',
          isAbsent: !curr
        }
      };
    });
  };

  const updateTWField = (studentId, field, val) => {
    if (isLocked) return;
    setTwMarks(tw => ({
      ...tw,
      [studentId]: { ...tw[studentId], [field]: val }
    }));
  };

  // Save regular marks
  const handleSaveMarks = async () => {
    setSaving(true);
    try {
      const marksData = students.map(s => {
        const entry = marks[s.student_id];
        return {
          studentId: s.student_id,
          marksObtained: entry?.isAbsent ? 0 : (entry?.marksObtained !== '' ? Number(entry?.marksObtained) : null),
          isAbsent: Boolean(entry?.isAbsent)
        };
      });

      const res = await api.post('/faculty/marks', {
        subjectId: parseInt(subjectId, 10),
        examTypeId: selectedExamId,
        semester: parseInt(semester, 10),
        academicYear,
        division,
        marksData
      });

      toast.success(res.data.message || 'Marks saved successfully.');
      fetchMarksData(selectedExamId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Save Term Work
  const handleSaveTermWork = async () => {
    setSaving(true);
    try {
      const termWorkData = students.map(s => {
        const tw = twMarks[s.student_id] || {};
        return {
          studentId: s.student_id,
          attendance: Number(tw.attendance) || 0,
          assignment1: Number(tw.assignment1) || 0,
          assignment2: Number(tw.assignment2) || 0,
          timelySubmission: Number(tw.timelySubmission) || 0,
        };
      });

      const res = await api.post('/faculty/term-work', {
        subjectId: parseInt(subjectId, 10),
        semester: parseInt(semester, 10),
        academicYear,
        division,
        termWorkData
      });

      toast.success(res.data.message || 'Term Work saved.');
      fetchMarksData(selectedExamId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save Term Work');
    } finally {
      setSaving(false);
    }
  };

  // Submit all marks for approval
  const handleSubmitAll = async () => {
    if (!window.confirm('Submit marks to HOD for approval? Marks will become read-only until reviewed.')) return;
    setSaving(true);
    try {
      const res = await api.post('/faculty/marks/submit', {
        subjectId: parseInt(subjectId, 10),
        semester: parseInt(semester, 10),
        academicYear,
        division
      });
      toast.success(res.data.message);
      fetchMarksData(selectedExamId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit marks');
    } finally {
      setSaving(false);
    }
  };

  if (rbacError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-2xl font-bold">
            🛡️
          </div>
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Restricted (Server-Side RBAC)</h2>
          <p className="text-sm text-red-700 max-w-md mx-auto mb-6">{rbacError}</p>
          <Link
            to="/faculty/results"
            className="inline-flex items-center px-4 py-2 bg-red-700 text-white font-medium rounded-lg text-sm hover:bg-red-800 transition-colors"
          >
            ← Return to Assigned Subjects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="mb-6 pb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/faculty/results" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              ← Back to Result Generation
            </Link>
          </div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-gray-900 mt-1">
            {subject?.name || 'Marks Entry'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Subject Code: <span className="font-mono font-bold text-gray-700">{subject?.code}</span> · Division: <span className="font-bold text-gray-800">{division}</span> · Semester {semester} ({academicYear})
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={isTermWork ? handleSaveTermWork : handleSaveMarks}
            disabled={saving || isLocked}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : '💾 Save Draft'}
          </button>
          <button
            onClick={handleSubmitAll}
            disabled={saving || isLocked}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            📤 Submit to HOD
          </button>
        </div>
      </div>

      {/* Lock Notice */}
      {isLocked && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center justify-between">
          <span className="font-semibold">🔒 These marks are published by the HOD and are locked against further edits.</span>
        </div>
      )}

      {/* Exam Type Selection Selector Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="exam-type-select" className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Evaluation Type:
          </label>
          <select
            id="exam-type-select"
            value={selectedExamId || ''}
            onChange={(e) => handleExamTypeChange(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {examTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.name} ({et.code === 'term_work' ? 'Calculated out of 25' : `Max ${et.default_max_marks}`})
              </option>
            ))}
          </select>
        </div>

        {/* Max Marks / Result Impact Pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full font-bold border ${
            currentExam?.has_result_impact
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {currentExam?.has_result_impact ? '★ Contributes to Final Result' : 'ℹ️ Internal Only (0 Weight on Final)'}
          </span>
          <span className="px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Max Marks: {maxAllowed}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading student list...</div>
      ) : students.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <p className="text-base font-medium">No students enrolled in Division {division} for Semester {semester}.</p>
        </div>
      ) : isTermWork ? (
        /* ─── TERM WORK COMPONENT ENTRY ─── */
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-4 py-3 text-left">Roll No</th>
                <th className="px-4 py-3 text-left">PRN</th>
                <th className="px-4 py-3 text-left">Student Name</th>
                <th className="px-3 py-3 text-center">Attendance (5)</th>
                <th className="px-3 py-3 text-center">Assignment 1 (7)</th>
                <th className="px-3 py-3 text-center">Assignment 2 (7)</th>
                <th className="px-3 py-3 text-center">Timely Sub. (6)</th>
                <th className="px-4 py-3 text-right font-bold">Total TW (25)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((st, idx) => {
                const tw = twMarks[st.student_id] || {};
                const att = Number(tw.attendance) || 0;
                const a1  = Number(tw.assignment1) || 0;
                const a2  = Number(tw.assignment2) || 0;
                const tim = Number(tw.timelySubmission) || 0;
                const total = Math.round((att + a1 + a2 + tim) * 10) / 10;

                return (
                  <tr key={st.student_id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-800">{st.roll_no}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{st.enrollment_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{st.name}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.attendance ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'attendance', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.assignment1 ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'assignment1', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.assignment2 ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'assignment2', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max="6"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.timelySubmission ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'timelySubmission', e.target.value)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                      {total} / 25
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ─── STANDARD EXAM TYPE ENTRY (UT1, UT2, Insem, Mock, PR, Endsem) ─── */
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-12">#</th>
                <th className="px-4 py-3 text-left">Roll No</th>
                <th className="px-4 py-3 text-left">PRN</th>
                <th className="px-4 py-3 text-left">Student Name</th>
                <th className="px-4 py-3 text-center">Marks Obtained (Max {maxAllowed})</th>
                <th className="px-4 py-3 text-center">Absent (AAA)</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((st, idx) => {
                const entry = marks[st.student_id] || {};
                const val = entry.marksObtained ?? '';
                const isOver = val !== '' && !entry.isAbsent && Number(val) > maxAllowed;

                return (
                  <tr key={st.student_id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-800">{st.roll_no}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{st.enrollment_no}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{st.name}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex flex-col items-center">
                        <input
                          type="number"
                          min="0"
                          max={maxAllowed}
                          step="0.5"
                          disabled={isLocked || entry.isAbsent}
                          value={entry.isAbsent ? '0' : val}
                          onChange={(e) => updateMark(st.student_id, e.target.value)}
                          className={`w-24 px-3 py-1.5 border rounded text-center text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 ${
                            isOver ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                          } ${entry.isAbsent ? 'bg-gray-100 text-gray-400' : ''}`}
                          placeholder="—"
                        />
                        {isOver && (
                          <span className="text-[10px] text-red-600 font-bold mt-0.5">Exceeds {maxAllowed}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleAbsent(st.student_id)}
                        className={`px-3 py-1 text-xs font-bold rounded-md border transition-colors ${
                          entry.isAbsent
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {entry.isAbsent ? 'ABSENT' : 'Mark Absent'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-600">
                        {st.status || 'draft'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
