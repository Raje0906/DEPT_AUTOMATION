import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function RemedialClasses() {
  const { user } = useAuth();
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [selectedClass, setSelectedClass] = useState('TE 1');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedExamCode, setSelectedExamCode] = useState('insem');
  
  const [subjects, setSubjects] = useState([]);
  const [availableDivisions, setAvailableDivisions] = useState(['TE 1', 'TE 2', 'SE 1', 'SE 2', 'BE 1', 'BE 2']);
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  
  // Remedial Plan States
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [studentUpdates, setStudentUpdates] = useState({});
  const [savingStudents, setSavingStudents] = useState(false);
  
  // Create Plan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    title: '',
    benchmarkMarks: 12,
    weakTopics: '',
    actionPlan: '',
    schedule: [
      { date: '', time: '04:00 PM - 05:30 PM', room: 'Classroom 302', topic: 'Concept Revision' }
    ]
  });

  // Filter tab for learner categorization
  const [learnerFilter, setLearnerFilter] = useState('slow'); // 'slow' | 'average' | 'advanced' | 'all'

  // Fetch subjects available
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
      }
    };
    fetchSubjects();
  }, [academicYear]);

  // Load Analysis & Plans
  const loadData = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const [analysisRes, plansRes] = await Promise.all([
        api.get(`/faculty/analysis/exam?subjectId=${selectedSubjectId}&division=${encodeURIComponent(selectedClass)}&academicYear=${encodeURIComponent(academicYear)}&examCode=${selectedExamCode}`),
        api.get(`/faculty/remedial/plans?subjectId=${selectedSubjectId}&division=${encodeURIComponent(selectedClass)}&academicYear=${encodeURIComponent(academicYear)}`)
      ]);
      setAnalysisData(analysisRes.data);
      const loadedPlans = plansRes.data?.plans || [];
      setPlans(loadedPlans);

      if (loadedPlans.length > 0) {
        loadPlanDetails(loadedPlans[0].id);
      } else {
        setActivePlan(null);
      }
    } catch (err) {
      console.error('Error loading remedial analysis:', err);
      toast.error('Failed to load examination analysis data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSubjectId, selectedClass, academicYear, selectedExamCode]);

  const loadPlanDetails = async (planId) => {
    setPlanLoading(true);
    try {
      const res = await api.get(`/faculty/remedial/plans/${planId}`);
      setActivePlan(res.data);
      const initialUpdates = {};
      (res.data?.records || []).forEach(r => {
        initialUpdates[r.student_id] = {
          studentId: r.student_id,
          attendanceStatus: r.attendance_status || 'SCHEDULED',
          retestMarks: r.retest_marks !== null && r.retest_marks !== undefined ? r.retest_marks : '',
          improvementRemarks: r.improvement_remarks || '',
          outcomeStatus: r.outcome_status || 'PENDING'
        };
      });
      setStudentUpdates(initialUpdates);
    } catch (err) {
      console.error('Error fetching plan details:', err);
      toast.error('Failed to load remedial plan details');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!newPlanForm.title.trim()) {
      toast.error('Please enter a title for the action plan.');
      return;
    }

    setCreatingPlan(true);
    try {
      const payload = {
        subjectId: parseInt(selectedSubjectId, 10),
        semester: analysisData?.subject?.semester || 5,
        academicYear,
        division: selectedClass,
        examCode: selectedExamCode,
        title: newPlanForm.title,
        benchmarkMarks: Number(newPlanForm.benchmarkMarks) || 12,
        weakTopics: newPlanForm.weakTopics,
        actionPlan: newPlanForm.actionPlan,
        scheduleDetails: newPlanForm.schedule
      };

      const res = await api.post('/faculty/remedial/plans', payload);
      toast.success(res.data?.message || 'Remedial Action Plan created.');
      setShowCreateModal(false);
      loadData();
      if (res.data?.plan?.id) {
        loadPlanDetails(res.data.plan.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create plan');
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleUpdateStudentField = (studentId, field, value) => {
    setStudentUpdates(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveStudentProgress = async () => {
    if (!activePlan?.plan?.id) return;
    setSavingStudents(true);
    try {
      const updatesList = Object.values(studentUpdates);
      const res = await api.put(`/faculty/remedial/plans/${activePlan.plan.id}/students`, {
        studentUpdates: updatesList
      });
      toast.success(res.data.message || 'Records updated successfully.');
      loadPlanDetails(activePlan.plan.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save student progress');
    } finally {
      setSavingStudents(false);
    }
  };

  const addScheduleRow = () => {
    setNewPlanForm(prev => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        { date: '', time: '04:00 PM - 05:30 PM', room: 'Classroom 302', topic: '' }
      ]
    }));
  };

  const removeScheduleRow = (idx) => {
    setNewPlanForm(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== idx)
    }));
  };

  const currentSubjectObj = useMemo(() => {
    return subjects.find(s => String(s.id) === String(selectedSubjectId)) || analysisData?.subject;
  }, [subjects, selectedSubjectId, analysisData]);

  const filteredStudents = useMemo(() => {
    if (!analysisData?.students) return [];
    if (learnerFilter === 'slow') return analysisData.categories?.slowLearners || [];
    if (learnerFilter === 'average') return analysisData.categories?.averageLearners || [];
    if (learnerFilter === 'advanced') return analysisData.categories?.advancedLearners || [];
    return analysisData.students;
  }, [analysisData, learnerFilter]);

  return (
    <div className="p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src="/images/college-logo.jpg"
            alt="MES Wadia COE Logo"
            className="h-12 w-auto object-contain flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">
              Remedial Classes &amp; Action Plan
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Performance analysis, slow-learner identification, schedule formulation, and retest tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-xs font-semibold shadow-2xs"
          >
            Print Action Plan
          </button>
          <button
            onClick={() => {
              setNewPlanForm({
                title: `${currentSubjectObj?.code || 'Course'} Remedial Action Plan (${selectedClass})`,
                benchmarkMarks: selectedExamCode === 'insem' ? 12 : 28,
                weakTopics: 'Unit 1 & Unit 2 Core Topics',
                actionPlan: 'Tutorial sessions, question bank discussion, and retest evaluation.',
                schedule: [
                  { date: '', time: '04:00 PM - 05:30 PM', room: 'Room 302', topic: 'Theory Revision' },
                  { date: '', time: '04:00 PM - 05:30 PM', room: 'Room 302', topic: 'Question Paper Solving' }
                ]
              });
              setShowCreateModal(true);
            }}
            className="px-3.5 py-2 bg-[#1E2D5A] hover:bg-[#152042] text-white rounded-md text-xs font-semibold shadow-2xs"
          >
            New Action Plan
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
              {availableDivisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800 max-w-xs"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} (Sem {s.semester})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Examination
            </label>
            <select
              value={selectedExamCode}
              onChange={(e) => setSelectedExamCode(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800"
            >
              <option value="insem">Univ In-Sem / CCE (30 Marks)</option>
              <option value="unit_test_1">Unit Test 1 (30 Marks)</option>
              <option value="unit_test_2">Unit Test 2 (30 Marks)</option>
              <option value="mock_theory">End-Sem Mock Theory (70 Marks)</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary KPI Cards */}
      {analysisData?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white border border-gray-200 rounded-md">
            <span className="text-[11px] text-gray-500 uppercase font-semibold">Total Enrolled</span>
            <p className="text-xl font-bold text-gray-900 mt-1">{analysisData.metrics.totalStudents}</p>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-md">
            <span className="text-[11px] text-gray-500 uppercase font-semibold">Appeared</span>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {analysisData.metrics.appeared}
              <span className="text-xs font-normal text-gray-500 ml-1">({analysisData.metrics.absent} Absent)</span>
            </p>
          </div>

          <div className="p-3 bg-white border border-red-200 rounded-md">
            <span className="text-[11px] text-red-700 uppercase font-semibold">Below 40% (Remedial)</span>
            <p className="text-xl font-bold text-red-700 mt-1">
              {analysisData.categories?.slowLearners?.length || 0}
            </p>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-md">
            <span className="text-[11px] text-gray-500 uppercase font-semibold">Passed (≥ 40%)</span>
            <p className="text-xl font-bold text-[#3B6B47] mt-1">
              {analysisData.metrics.passed}
              <span className="text-xs font-normal text-gray-500 ml-1">({analysisData.metrics.passPercentage}%)</span>
            </p>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-md">
            <span className="text-[11px] text-gray-500 uppercase font-semibold">Class Average</span>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {analysisData.metrics.averageMarks}
              <span className="text-xs font-normal text-gray-500 ml-1">/ {analysisData.maxMarks}</span>
            </p>
          </div>

          <div className="p-3 bg-white border border-gray-200 rounded-md">
            <span className="text-[11px] text-gray-500 uppercase font-semibold">Highest Score</span>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {analysisData.metrics.highestMarks}
              <span className="text-xs font-normal text-gray-500 ml-1">/ {analysisData.maxMarks}</span>
            </p>
          </div>
        </div>
      )}

      {/* Student Performance Roster */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Student Categorization &amp; Assessment List
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Passing benchmark: {analysisData?.benchmark || 12} marks (40% threshold)
            </p>
          </div>

          {/* Classification Tabs */}
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-xs font-medium">
            <button
              onClick={() => setLearnerFilter('slow')}
              className={`px-3 py-1 rounded transition-colors ${
                learnerFilter === 'slow'
                  ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Below 40% ({analysisData?.categories?.slowLearners?.length || 0})
            </button>
            <button
              onClick={() => setLearnerFilter('average')}
              className={`px-3 py-1 rounded transition-colors ${
                learnerFilter === 'average'
                  ? 'bg-gray-100 text-gray-900 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              40% – 69% ({analysisData?.categories?.averageLearners?.length || 0})
            </button>
            <button
              onClick={() => setLearnerFilter('advanced')}
              className={`px-3 py-1 rounded transition-colors ${
                learnerFilter === 'advanced'
                  ? 'bg-gray-100 text-gray-900 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              70% &amp; Above ({analysisData?.categories?.advancedLearners?.length || 0})
            </button>
            <button
              onClick={() => setLearnerFilter('all')}
              className={`px-3 py-1 rounded transition-colors ${
                learnerFilter === 'all'
                  ? 'bg-gray-100 text-gray-900 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Students ({analysisData?.students?.length || 0})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <th className="py-2.5 px-4">Roll No</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">PRN</th>
                <th className="py-2.5 px-4 text-center">Marks Obtained</th>
                <th className="py-2.5 px-4 text-center">Percentage</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No students recorded under this category.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isSlow = s.requiresRemedial;
                  return (
                    <tr
                      key={s.student_id || idx}
                      className={isSlow ? 'bg-red-50/25' : 'hover:bg-gray-50/50'}
                    >
                      <td className="py-2 px-4 font-mono font-bold text-gray-800">
                        {s.roll_no}
                      </td>
                      <td className="py-2 px-4 font-medium text-gray-900">
                        {s.name}
                      </td>
                      <td className="py-2 px-4 font-mono text-gray-500">
                        {s.enrollment_no}
                      </td>
                      <td className="py-2 px-4 text-center font-mono font-bold">
                        {s.isAbsent ? (
                          <span className="text-red-600 font-medium">Absent</span>
                        ) : s.numericMark !== null ? (
                          <span className={s.numericMark < (analysisData?.benchmark || 12) ? 'text-red-700' : 'text-gray-800'}>
                            {s.numericMark} / {analysisData?.maxMarks}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-center font-mono">
                        {s.isAbsent ? '0%' : `${s.percentage}%`}
                      </td>
                      <td className="py-2 px-4">
                        {isSlow ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
                            Remedial Required
                          </span>
                        ) : s.category?.startsWith('Advanced') ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Distinction / Advanced
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                            Clear
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-gray-600">
                        {isSlow ? (
                          <span className="text-red-700 font-medium">Attend remedial batch &amp; retest</span>
                        ) : (
                          <span>Regular tutorial practice</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remedial Plan Details & Retest Entry */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-2xs p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Remedial Batch Schedule &amp; Retest Tracking
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Record attendance for remedial lectures and improvement retest marks.
            </p>
          </div>

          {plans.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">Plan:</label>
              <select
                value={activePlan?.plan?.id || ''}
                onChange={(e) => loadPlanDetails(e.target.value)}
                className="px-2.5 py-1 bg-gray-50 border border-gray-300 rounded text-xs font-medium text-gray-800"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({new Date(p.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {planLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading plan records...</div>
        ) : !activePlan?.plan ? (
          <div className="py-10 text-center border border-dashed border-gray-200 rounded bg-gray-50/50 space-y-2">
            <p className="text-sm font-semibold text-gray-700">No active remedial plan for this selection.</p>
            <p className="text-xs text-gray-500">
              Create an action plan to schedule sessions and enroll students scoring below 40%.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-3.5 py-1.5 bg-[#1E2D5A] text-white rounded text-xs font-semibold"
            >
              Create Action Plan
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Plan Info Banner */}
            <div className="bg-gray-50 border border-gray-200 rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-2 space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Course Plan
                </span>
                <p className="font-bold text-sm text-gray-900">{activePlan.plan.title}</p>
                <p className="text-gray-600">
                  <strong className="text-gray-700">Topics:</strong> {activePlan.plan.weak_topics || 'General revision'}
                </p>
                <p className="text-gray-600">
                  <strong className="text-gray-700">Action:</strong> {activePlan.plan.action_plan || 'Extra tutorials'}
                </p>
              </div>

              <div className="p-3 bg-white border border-gray-200 rounded space-y-1">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Enrolled Students</span>
                <p className="text-lg font-bold text-gray-900">{activePlan.statistics?.totalAssigned || 0}</p>
                <p className="text-[11px] text-gray-500">{activePlan.statistics?.attendedCount || 0} Attended</p>
              </div>

              <div className="p-3 bg-white border border-gray-200 rounded space-y-1">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Cleared Retest</span>
                <p className="text-lg font-bold text-[#3B6B47]">{activePlan.statistics?.clearedCount || 0}</p>
                <p className="text-[11px] text-gray-500">{activePlan.statistics?.clearanceRate || 0}% Clearance</p>
              </div>
            </div>

            {/* Scheduled Sessions */}
            {activePlan.plan.schedule_details && activePlan.plan.schedule_details.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Scheduled Sessions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {activePlan.plan.schedule_details.map((sess, idx) => (
                    <div key={idx} className="p-2.5 bg-white border border-gray-200 rounded text-xs space-y-0.5">
                      <div className="flex justify-between font-semibold text-gray-800">
                        <span>Session {idx + 1}</span>
                        <span className="text-gray-500 font-normal">{sess.room || 'Room TBA'}</span>
                      </div>
                      <p className="text-gray-600">{sess.time || '04:00 PM - 05:30 PM'}</p>
                      <p className="text-gray-700 truncate">{sess.topic || 'Revision'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student Retest Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Student Retest &amp; Clearance Records
                </span>
                <button
                  onClick={handleSaveStudentProgress}
                  disabled={savingStudents}
                  className="px-3.5 py-1.5 bg-[#1E2D5A] hover:bg-[#152042] text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {savingStudents ? 'Saving...' : 'Save Records'}
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 text-center">Initial Score</th>
                      <th className="py-2.5 px-3">Attendance</th>
                      <th className="py-2.5 px-3 text-center">Retest Score (/30)</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activePlan.records?.map((rec) => {
                      const update = studentUpdates[rec.student_id] || {};
                      const isCleared = (Number(update.retestMarks) >= Number(activePlan.plan.benchmark_marks)) || update.outcomeStatus === 'REMEDIAL_CLEARED';

                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-gray-800">
                            {rec.roll_no}
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-900">
                            {rec.student_name}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-red-700">
                            {rec.initial_marks !== null ? rec.initial_marks : 0}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={update.attendanceStatus || 'SCHEDULED'}
                              onChange={(e) => handleUpdateStudentField(rec.student_id, 'attendanceStatus', e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                            >
                              <option value="SCHEDULED">Scheduled</option>
                              <option value="ATTENDED">Attended</option>
                              <option value="ABSENT">Absent</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max="30"
                              placeholder="Score"
                              value={update.retestMarks ?? ''}
                              onChange={(e) => handleUpdateStudentField(rec.student_id, 'retestMarks', e.target.value)}
                              className="w-16 px-2 py-1 text-xs font-mono font-semibold text-center border border-gray-300 rounded"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={update.outcomeStatus || (isCleared ? 'REMEDIAL_CLEARED' : 'PENDING')}
                              onChange={(e) => handleUpdateStudentField(rec.student_id, 'outcomeStatus', e.target.value)}
                              className={`px-2 py-1 text-xs font-medium rounded border ${
                                isCleared
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              <option value="PENDING">Pending Evaluation</option>
                              <option value="REMEDIAL_CLEARED">Cleared</option>
                              <option value="IMPROVED">Improved</option>
                              <option value="NEEDS_FURTHER_ATTENTION">Needs Retest</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Optional remarks"
                              value={update.improvementRemarks || ''}
                              onChange={(e) => handleUpdateStudentField(rec.student_id, 'improvementRemarks', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-xl w-full p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">New Remedial Action Plan</h3>
                <p className="text-xs text-gray-500">
                  {currentSubjectObj?.code} — {currentSubjectObj?.name} ({selectedClass})
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Plan Title *
                </label>
                <input
                  type="text"
                  required
                  value={newPlanForm.title}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Benchmark Cutoff (40%)
                  </label>
                  <input
                    type="number"
                    value={newPlanForm.benchmarkMarks}
                    onChange={(e) => setNewPlanForm(prev => ({ ...prev, benchmarkMarks: e.target.value }))}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Target Students
                  </label>
                  <div className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded font-medium text-gray-700">
                    {analysisData?.categories?.slowLearners?.length || 0} students below cutoff
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Weak Topics Identified
                </label>
                <textarea
                  rows={2}
                  value={newPlanForm.weakTopics}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, weakTopics: e.target.value }))}
                  placeholder="e.g. Unit 1 Memory management, Unit 2 Virtual memory algorithms..."
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Action Plan &amp; Remedial Measures
                </label>
                <textarea
                  rows={2}
                  value={newPlanForm.actionPlan}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, actionPlan: e.target.value }))}
                  placeholder="e.g. Dedicated tutorial sessions, practice question bank, and retest..."
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-700">
                    Lecture Sessions
                  </label>
                  <button
                    type="button"
                    onClick={addScheduleRow}
                    className="text-[#1E2D5A] font-semibold hover:underline"
                  >
                    + Add Session
                  </button>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {newPlanForm.schedule.map((sess, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded border">
                      <input
                        type="text"
                        placeholder="Time (e.g. 4 PM)"
                        value={sess.time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPlanForm(prev => {
                            const sc = [...prev.schedule];
                            sc[idx].time = val;
                            return { ...prev, schedule: sc };
                          });
                        }}
                        className="w-28 px-1.5 py-1 border rounded bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Room"
                        value={sess.room}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPlanForm(prev => {
                            const sc = [...prev.schedule];
                            sc[idx].room = val;
                            return { ...prev, schedule: sc };
                          });
                        }}
                        className="w-24 px-1.5 py-1 border rounded bg-white text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Topic"
                        value={sess.topic}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewPlanForm(prev => {
                            const sc = [...prev.schedule];
                            sc[idx].topic = val;
                            return { ...prev, schedule: sc };
                          });
                        }}
                        className="flex-1 px-1.5 py-1 border rounded bg-white text-xs"
                      />
                      {newPlanForm.schedule.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeScheduleRow(idx)}
                          className="text-red-500 font-bold px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPlan}
                  className="px-4 py-1.5 bg-[#1E2D5A] hover:bg-[#152042] text-white rounded text-xs font-semibold"
                >
                  {creatingPlan ? 'Creating...' : 'Create Action Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Signature Block */}
      <div className="hidden print:block pt-12 mt-8 border-t border-gray-400 space-y-12 text-xs">
        <div className="text-center space-y-0.5">
          <p className="font-bold text-gray-900 uppercase">Department of Computer Engineering</p>
          <p className="font-semibold text-gray-700">Remedial Action Plan &amp; Retest Audit Report</p>
          <p className="text-gray-500">Course: {currentSubjectObj?.code} — {currentSubjectObj?.name} | Division: {selectedClass} | AY: {academicYear}</p>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center pt-6">
          <div className="border-t border-gray-800 pt-2">
            <p className="font-bold text-gray-900">{user?.name || 'Subject Teacher'}</p>
            <p className="text-gray-600">Subject Teacher</p>
          </div>
          <div className="border-t border-gray-800 pt-2">
            <p className="font-bold text-gray-900">Class Teacher</p>
            <p className="text-gray-600">Class Coordinator</p>
          </div>
          <div className="border-t border-gray-800 pt-2">
            <p className="font-bold text-gray-900">Head of Department</p>
            <p className="text-gray-600">HOD (Computer Engg)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
