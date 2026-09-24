import React, { useEffect, useState, useMemo } from 'react';
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
  const sectionParam = searchParams.get('section') || 'assignments'; // 'assignments' | 'ut' | 'insem' | 'endsem'

  const [subject, setSubject]                     = useState(null);
  const [examTypes, setExamTypes]                 = useState([]);
  const [availableDivisions, setAvailableDivisions] = useState([]);
  const [activeSection, setActiveSection]         = useState(sectionParam);
  const [selectedExamId, setSelectedExamId]       = useState(null);
  const [students, setStudents]                   = useState([]);
  const [marks, setMarks]                         = useState({});   // studentId -> { marksObtained, isAbsent }
  const [twMarks, setTwMarks]                     = useState({});   // studentId -> { attendance, assignment1, assignment2, timelySubmission }
  const [loading, setLoading]                     = useState(true);
  const [saving, setSaving]                       = useState(false);
  const [isLocked, setIsLocked]                   = useState(false);
  const [rbacError, setRbacError]                 = useState(null);

  // Group exam types by section category
  const categorizedExams = useMemo(() => {
    const utExams = examTypes.filter(e => e.code === 'unit_test_1' || e.code === 'unit_test_2');
    const insemExam = examTypes.find(e => e.code === 'insem');
    const twExam = examTypes.find(e => e.code === 'term_work');
    const endsemExams = examTypes.filter(e => ['endsem', 'final_practical', 'mock_theory', 'mock_practical'].includes(e.code));

    return {
      ut: utExams,
      insem: insemExam,
      tw: twExam,
      endsem: endsemExams
    };
  }, [examTypes]);

  // Sync active section from URL
  useEffect(() => {
    if (sectionParam && ['assignments', 'ut', 'insem', 'endsem'].includes(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  // Determine current active exam type based on activeSection
  useEffect(() => {
    if (examTypes.length === 0) return;

    if (activeSection === 'assignments') {
      const tw = categorizedExams.tw;
      if (tw && selectedExamId !== tw.id) {
        setSelectedExamId(tw.id);
      }
    } else if (activeSection === 'insem') {
      const ins = categorizedExams.insem;
      if (ins && selectedExamId !== ins.id) {
        setSelectedExamId(ins.id);
      }
    } else if (activeSection === 'ut') {
      const currentIsUt = categorizedExams.ut.some(e => e.id === selectedExamId);
      if (!currentIsUt && categorizedExams.ut.length > 0) {
        setSelectedExamId(categorizedExams.ut[0].id);
      }
    } else if (activeSection === 'endsem') {
      const currentIsEndsem = categorizedExams.endsem.some(e => e.id === selectedExamId);
      if (!currentIsEndsem && categorizedExams.endsem.length > 0) {
        // Default to endsem theory (70M)
        const def = categorizedExams.endsem.find(e => e.code === 'endsem') || categorizedExams.endsem[0];
        setSelectedExamId(def.id);
      }
    }
  }, [activeSection, examTypes, categorizedExams, selectedExamId]);

  const fetchMarksData = (targetExamId, targetDivision) => {
    setLoading(true);
    setRbacError(null);
    const divToUse = targetDivision || division;
    let url = `/faculty/marks/${subjectId}?semester=${semester}&academic_year=${encodeURIComponent(academicYear)}&division=${encodeURIComponent(divToUse)}`;
    if (targetExamId) {
      url += `&exam_type_id=${targetExamId}`;
    }

    api.get(url)
      .then(res => {
        setSubject(res.data.subject);
        setExamTypes(res.data.examTypes || []);
        setStudents(res.data.students || []);
        if (res.data.availableDivisions) {
          setAvailableDivisions(res.data.availableDivisions);
        }

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
    fetchMarksData(selectedExamId, division);
  }, [subjectId, semester, academicYear, division]);

  // When selectedExamId changes, reload students for that specific exam
  const handleSelectExam = (examId) => {
    setSelectedExamId(examId);
    fetchMarksData(examId, division);
  };

  // Switch class / division directly from dropdown
  const handleClassChange = (newDivision) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('div', newDivision);
      return p;
    });
  };

  // Switch main section
  const handleSectionTabClick = (sectionKey) => {
    setActiveSection(sectionKey);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('section', sectionKey);
      return p;
    });

    // Auto-select corresponding exam type
    if (sectionKey === 'assignments') {
      const tw = examTypes.find(e => e.code === 'term_work');
      if (tw) handleSelectExam(tw.id);
    } else if (sectionKey === 'insem') {
      const ins = examTypes.find(e => e.code === 'insem');
      if (ins) handleSelectExam(ins.id);
    } else if (sectionKey === 'ut') {
      const ut = examTypes.find(e => e.code === 'unit_test_1');
      if (ut) handleSelectExam(ut.id);
    } else if (sectionKey === 'endsem') {
      const es = examTypes.find(e => e.code === 'endsem') || examTypes.find(e => e.code === 'final_practical');
      if (es) handleSelectExam(es.id);
    }
  };

  const currentExam = examTypes.find(e => e.id === selectedExamId) || examTypes[0];
  const isTermWork = activeSection === 'assignments' || currentExam?.code === 'term_work';
  const maxAllowed = Number(currentExam?.default_max_marks || 100);

  const updateMark = (studentId, val) => {
    if (isLocked) return;
    let cleanVal = val;
    if (val !== '' && val !== null && val !== undefined) {
      const num = Number(val);
      if (isNaN(num)) return;
      if (num > maxAllowed) {
        toast.error(`Marks cannot exceed maximum allowed (${maxAllowed}) for ${currentExam?.name || 'this exam'}`, { id: `max-exam-${currentExam?.id}` });
        cleanVal = String(maxAllowed);
      } else if (num < 0) {
        toast.error('Marks cannot be negative', { id: 'neg-mark' });
        cleanVal = '0';
      }
    }
    setMarks(m => ({
      ...m,
      [studentId]: { ...m[studentId], marksObtained: cleanVal, isAbsent: false }
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
    const maxLimits = {
      attendance: 5,
      assignment1: 7,
      assignment2: 7,
      timelySubmission: 6,
    };
    const fieldLabels = {
      attendance: 'Attendance',
      assignment1: 'Assignment 1',
      assignment2: 'Assignment 2',
      timelySubmission: 'Timely Submission',
    };
    const max = maxLimits[field] ?? 100;
    let cleanVal = val;

    if (val !== '' && val !== null && val !== undefined) {
      const num = Number(val);
      if (isNaN(num)) return;
      if (num > max) {
        toast.error(`Maximum allowed for ${fieldLabels[field] || field} is ${max} marks`, { id: `max-tw-${field}` });
        cleanVal = String(max);
      } else if (num < 0) {
        toast.error('Marks cannot be negative', { id: 'neg-tw' });
        cleanVal = '0';
      }
    }

    setTwMarks(tw => ({
      ...tw,
      [studentId]: { ...tw[studentId], [field]: cleanVal }
    }));
  };

  // Save regular marks
  const handleSaveMarks = async () => {
    // Strict client-side validation
    for (const s of students) {
      const entry = marks[s.student_id];
      if (entry && !entry.isAbsent && entry.marksObtained !== '' && entry.marksObtained !== null) {
        const num = Number(entry.marksObtained);
        if (isNaN(num) || num < 0 || num > maxAllowed) {
          toast.error(`Roll ${s.roll_no} (${s.name}): Marks must be between 0 and ${maxAllowed}.`);
          return;
        }
      }
    }

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
      fetchMarksData(selectedExamId, division);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // Save Term Work & Assignments
  const handleSaveTermWork = async () => {
    // Strict client-side validation
    for (const s of students) {
      const tw = twMarks[s.student_id] || {};
      const att = tw.attendance !== '' && tw.attendance !== undefined ? Number(tw.attendance) : 0;
      const a1  = tw.assignment1 !== '' && tw.assignment1 !== undefined ? Number(tw.assignment1) : 0;
      const a2  = tw.assignment2 !== '' && tw.assignment2 !== undefined ? Number(tw.assignment2) : 0;
      const tim = tw.timelySubmission !== '' && tw.timelySubmission !== undefined ? Number(tw.timelySubmission) : 0;
      const total = Math.round((att + a1 + a2 + tim) * 100) / 100;

      if (att < 0 || att > 5) {
        toast.error(`Roll ${s.roll_no} (${s.name}): Attendance marks must be between 0 and 5.`);
        return;
      }
      if (a1 < 0 || a1 > 7) {
        toast.error(`Roll ${s.roll_no} (${s.name}): Assignment 1 marks must be between 0 and 7.`);
        return;
      }
      if (a2 < 0 || a2 > 7) {
        toast.error(`Roll ${s.roll_no} (${s.name}): Assignment 2 marks must be between 0 and 7.`);
        return;
      }
      if (tim < 0 || tim > 6) {
        toast.error(`Roll ${s.roll_no} (${s.name}): Timely Submission marks must be between 0 and 6.`);
        return;
      }
      if (total < 0 || total > 25) {
        toast.error(`Roll ${s.roll_no} (${s.name}): Total Term Work cannot exceed 25.`);
        return;
      }
    }

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

      toast.success(res.data.message || 'Assignments & Term Work saved.');
      fetchMarksData(selectedExamId, division);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save Term Work');
    } finally {
      setSaving(false);
    }
  };

  // Submit all marks for approval
  const handleSubmitAll = async () => {
    if (!window.confirm(`Submit all marks of Class ${division} to HOD for approval? Marks will become read-only until reviewed.`)) return;
    setSaving(true);
    try {
      const res = await api.post('/faculty/marks/submit', {
        subjectId: parseInt(subjectId, 10),
        semester: parseInt(semester, 10),
        academicYear,
        division
      });
      toast.success(res.data.message || 'Marks submitted to HOD.');
      fetchMarksData(selectedExamId, division);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit marks');
    } finally {
      setSaving(false);
    }
  };

  if (rbacError) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-2xl font-bold">
            🛡️
          </div>
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Restricted (Server-Side RBAC)</h2>
          <p className="text-sm text-red-700 max-w-md mx-auto mb-6">{rbacError}</p>
          <Link
            to="/faculty/subjects"
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
      {/* ─── TOP BREADCRUMB & HEADER ─── */}
      <div className="mb-6 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/faculty/subjects" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <span>←</span> Back to Result Generation
            </Link>
          </div>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-gray-900 mt-2">
            {subject?.name || 'Marks Entry Portal'}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-gray-500 font-medium">
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {subject?.code}
            </span>
            <span>•</span>
            <span>Semester {semester} ({academicYear})</span>
            <span>•</span>
            <span className="capitalize">{subject?.subject_type} Course</span>
          </div>
        </div>

        {/* ─── CLASS SELECTOR & ACTIONS ─── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Class Dropdown */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-indigo-200 rounded-xl shadow-2xs">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Class:</span>
            <select
              value={division}
              onChange={(e) => handleClassChange(e.target.value)}
              className="bg-transparent text-sm font-bold text-indigo-900 focus:outline-none cursor-pointer"
            >
              {(availableDivisions.length > 0 ? availableDivisions : [division]).map(divName => (
                <option key={divName} value={divName}>
                  {divName}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <button
            onClick={isTermWork ? handleSaveTermWork : handleSaveMarks}
            disabled={saving || isLocked}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>💾</span> {saving ? 'Saving...' : 'Save Section Draft'}
          </button>
          <button
            onClick={handleSubmitAll}
            disabled={saving || isLocked}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>📤</span> Submit Class to HOD
          </button>
        </div>
      </div>

      {/* Lock Notice */}
      {isLocked && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-3 shadow-2xs">
          <span className="text-xl">🔒</span>
          <div>
            <span className="font-bold">Marks are officially Published by HOD.</span>
            <span className="ml-1 text-emerald-700">Edits are locked to preserve the autonomous academic audit trail.</span>
          </div>
        </div>
      )}

      {/* ─── 4 DEDICATED EVALUATION SECTIONS TABS ─── */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Select Evaluation Section:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Section 1: Assignments & Term Work */}
          <button
            onClick={() => handleSectionTabClick('assignments')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              activeSection === 'assignments'
                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">📚</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                activeSection === 'assignments' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-900'
              }`}>
                25 Marks Total
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold leading-tight">Assignments &amp; TW</p>
              <p className={`text-[11px] mt-0.5 leading-snug ${activeSection === 'assignments' ? 'text-amber-100' : 'text-gray-400'}`}>
                Assignment 1, 2, Att., Timely
              </p>
            </div>
          </button>

          {/* Section 2: Unit Tests (UT) */}
          <button
            onClick={() => handleSectionTabClick('ut')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              activeSection === 'ut'
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-500/20'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">📝</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                activeSection === 'ut' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900'
              }`}>
                30 Marks Each
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold leading-tight">Unit Tests (UT)</p>
              <p className={`text-[11px] mt-0.5 leading-snug ${activeSection === 'ut' ? 'text-blue-100' : 'text-gray-400'}`}>
                Unit Test 1 &amp; Unit Test 2
              </p>
            </div>
          </button>

          {/* Section 3: In-Sem Exam */}
          <button
            onClick={() => handleSectionTabClick('insem')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              activeSection === 'insem'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">📋</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                activeSection === 'insem' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-900'
              }`}>
                SPPU 30M
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold leading-tight">In-Sem Exam</p>
              <p className={`text-[11px] mt-0.5 leading-snug ${activeSection === 'insem' ? 'text-emerald-100' : 'text-gray-400'}`}>
                Midterm Theory Exam (30M)
              </p>
            </div>
          </button>

          {/* Section 4: End-Sem & Practicals */}
          <button
            onClick={() => handleSectionTabClick('endsem')}
            className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
              activeSection === 'endsem'
                ? 'bg-purple-600 text-white border-purple-700 shadow-md ring-2 ring-purple-500/20'
                : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🎓</span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                activeSection === 'endsem' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-900'
              }`}>
                70M / 25M
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold leading-tight">End-Sem &amp; Practicals</p>
              <p className={`text-[11px] mt-0.5 leading-snug ${activeSection === 'endsem' ? 'text-purple-100' : 'text-gray-400'}`}>
                End-Sem, Practical &amp; Mocks
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ─── SUB-NAVIGATION PILLS (for sections with multiple exam types) ─── */}
      {activeSection === 'ut' && categorizedExams.ut.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-6 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Unit Test:</span>
            {categorizedExams.ut.map(exam => (
              <button
                key={exam.id}
                onClick={() => handleSelectExam(exam.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedExamId === exam.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {exam.name} (Max {exam.default_max_marks})
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
            Internal Academic Assessment
          </span>
        </div>
      )}

      {activeSection === 'endsem' && categorizedExams.endsem.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-6 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Exam:</span>
            {categorizedExams.endsem.map(exam => (
              <button
                key={exam.id}
                onClick={() => handleSelectExam(exam.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedExamId === exam.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {exam.name} ({exam.default_max_marks}M)
              </button>
            ))}
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
            currentExam?.has_result_impact
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {currentExam?.has_result_impact ? '★ Final Result Impact' : 'Internal Mock / Practice'}
          </span>
        </div>
      )}

      {/* ─── SECTION HEADER INFORMATION BANNER ─── */}
      {activeSection === 'assignments' && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">💡</span>
            <div>
              <p className="text-sm font-bold text-amber-950">Assignments &amp; Term Work Breakup</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Calculated automatically out of <strong>25 Marks</strong>: Attendance (max 5) + Assignment 1 (max 7) + Assignment 2 (max 7) + Timely Submission (max 6).
              </p>
            </div>
          </div>
          <button
            onClick={handleSaveTermWork}
            disabled={saving || isLocked}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs whitespace-nowrap self-end md:self-auto cursor-pointer"
          >
            {saving ? 'Saving...' : '💾 Save Assignments & TW'}
          </button>
        </div>
      )}

      {/* ─── TABLE CONTENT ─── */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">
          Loading student list for Class {division}...
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-2xs">
          <p className="text-base font-bold text-gray-800">No students found in Class {division} for Semester {semester}.</p>
          <p className="text-xs text-gray-400 mt-1">Please ensure students are enrolled in this division.</p>
        </div>
      ) : isTermWork ? (
        /* ══════════════════════════════════════════════════════════════════════ */
        /* ─── SECTION 1: ASSIGNMENTS & TERM WORK TABLE ───────────────────────── */
        /* ══════════════════════════════════════════════════════════════════════ */
        <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-amber-50/50 text-gray-700 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5 text-left w-12">#</th>
                <th className="px-4 py-3.5 text-left">Roll No</th>
                <th className="px-4 py-3.5 text-left">PRN</th>
                <th className="px-4 py-3.5 text-left">Student Name</th>
                <th className="px-3 py-3.5 text-center bg-amber-100/40 text-amber-950">Attendance (Max 5)</th>
                <th className="px-3 py-3.5 text-center bg-blue-50/40 text-blue-950">Assignment 1 (Max 7)</th>
                <th className="px-3 py-3.5 text-center bg-blue-50/40 text-blue-950">Assignment 2 (Max 7)</th>
                <th className="px-3 py-3.5 text-center bg-emerald-50/40 text-emerald-950">Timely Sub. (Max 6)</th>
                <th className="px-5 py-3.5 text-right font-extrabold text-amber-900 bg-amber-100/60">Total TW (25)</th>
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
                const isPassing = total >= 10;

                return (
                  <tr key={st.student_id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{st.roll_no}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{st.enrollment_no}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{st.name}</td>

                    {/* Attendance (Max 5) */}
                    <td className="px-3 py-2 text-center bg-amber-50/10">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.attendance ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'attendance', e.target.value)}
                        className={`w-16 px-2 py-1.5 border rounded-lg text-center text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 ${
                          att > 5 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                    </td>

                    {/* Assignment 1 (Max 7) */}
                    <td className="px-3 py-2 text-center bg-blue-50/10">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.assignment1 ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'assignment1', e.target.value)}
                        className={`w-16 px-2 py-1.5 border rounded-lg text-center text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 ${
                          a1 > 7 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                    </td>

                    {/* Assignment 2 (Max 7) */}
                    <td className="px-3 py-2 text-center bg-blue-50/10">
                      <input
                        type="number"
                        min="0"
                        max="7"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.assignment2 ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'assignment2', e.target.value)}
                        className={`w-16 px-2 py-1.5 border rounded-lg text-center text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 ${
                          a2 > 7 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                    </td>

                    {/* Timely Submission (Max 6) */}
                    <td className="px-3 py-2 text-center bg-emerald-50/10">
                      <input
                        type="number"
                        min="0"
                        max="6"
                        step="0.5"
                        disabled={isLocked}
                        value={tw.timelySubmission ?? ''}
                        onChange={(e) => updateTWField(st.student_id, 'timelySubmission', e.target.value)}
                        className={`w-16 px-2 py-1.5 border rounded-lg text-center text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 ${
                          tim > 6 ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                    </td>

                    {/* Total Term Work (Out of 25) */}
                    <td className="px-5 py-3 text-right bg-amber-50/20">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full font-mono font-extrabold text-sm border ${
                        total > 25
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : isPassing
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {total} / 25
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════ */
        /* ─── SECTION 2, 3, 4: STANDARD MARKS TABLE (UT, INSEM, ENDSEM) ─────── */
        /* ══════════════════════════════════════════════════════════════════════ */
        <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3.5 text-left w-12">#</th>
                <th className="px-4 py-3.5 text-left">Roll No</th>
                <th className="px-4 py-3.5 text-left">PRN</th>
                <th className="px-4 py-3.5 text-left">Student Name</th>
                <th className="px-4 py-3.5 text-center">
                  Marks Obtained (Max {maxAllowed})
                </th>
                <th className="px-4 py-3.5 text-center">Absent Status</th>
                <th className="px-4 py-3.5 text-right">Approval Status</th>
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
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{st.roll_no}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{st.enrollment_no}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{st.name}</td>

                    {/* Marks Input */}
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
                          className={`w-28 px-3 py-1.5 border rounded-xl text-center text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 ${
                            isOver ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
                          } ${entry.isAbsent ? 'bg-gray-100 text-gray-400' : ''}`}
                          placeholder="—"
                        />
                        {isOver && (
                          <span className="text-[10px] text-red-600 font-bold mt-0.5">Exceeds {maxAllowed}</span>
                        )}
                      </div>
                    </td>

                    {/* Absent Toggle Button */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleAbsent(st.student_id)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          entry.isAbsent
                            ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {entry.isAbsent ? 'ABSENT (AAA)' : 'Mark Absent'}
                      </button>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-700 capitalize">
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
