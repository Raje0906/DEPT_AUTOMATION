import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';
import { useAuth } from '../../contexts/AuthContext';
import { isAuthorizedFeedbackCoordinator } from '../../utils/feedbackPermissions';
import {
  AcademicCapIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentChartBarIcon,
  NewspaperIcon,
  ShieldCheckIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

export default function FacultyDashboard() {
  const { user }                      = useAuth();
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [activeTab, setActiveTab]     = useState('ALL'); // 'ALL' | 'SE' | 'TE' | 'BE'

  const fetchDashboard = (year) => {
    setLoading(true);
    const url = year ? `/faculty/dashboard?academic_year=${encodeURIComponent(year)}` : '/faculty/dashboard';
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
    fetchDashboard(academicYear);
  }, [academicYear]);

  const allSubjects               = data?.subjects || [];
  const academicYears             = data?.academicYears || [];
  const faculty                   = data?.faculty;
  const panelAssignments         = data?.panelAssignments || [];
  const pendingPanelEvaluations   = data?.pendingPanelEvaluations || 0;
  const completedPanelEvaluations = data?.completedPanelEvaluations || 0;

  const groupedPanelAssignments = useMemo(() => {
    const map = new Map();
    for (const ass of panelAssignments) {
      const gid = ass.group_id || ass.group_code || ass.assignment_id;
      if (!map.has(gid)) {
        map.set(gid, {
          group_id: ass.group_id,
          group_code: ass.group_code,
          title: ass.title,
          domain: ass.domain,
          guide_name: ass.guide_name,
          members: ass.members || [],
          stages: [],
        });
      }
      map.get(gid).stages.push(ass);
    }
    return Array.from(map.values());
  }, [panelAssignments]);

  if (loading && !data) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
        <div className="p-8 text-sm text-draft">Loading faculty dashboard…</div>
      </div>
    );
  }

  // Filter by SE, TE, BE
  const subjects = allSubjects.filter(s => {
    const sem = parseInt(s.semester, 10);
    if (activeTab === 'SE') return sem === 3 || sem === 4;
    if (activeTab === 'TE') return sem === 5 || sem === 6;
    if (activeTab === 'BE') return sem === 7 || sem === 8;
    return true;
  });

  const pendingSubjects     = allSubjects.filter(s => s.submission_status === 'not_started' || s.submission_status === 'draft');
  const completedSubjects   = allSubjects.filter(s => s.submission_status === 'approved' || s.submission_status === 'published');
  const totalEnrolled       = allSubjects.reduce((sum, s) => sum + (parseInt(s.enrolled_count, 10) || 0), 0);

  const facultyName = faculty?.name || 'Faculty Member';
  const facultyInitials = facultyName
    .replace(/(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)/gi, '')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .filter(c => /[A-Za-z]/.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FC';

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Editorial Faculty Profile Header */}
      <div className="bg-white border border-rule rounded-xl p-6 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-xl shadow-xs border border-white/20 flex-shrink-0">
              {facultyInitials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink">
                  {faculty?.name || 'Faculty Dashboard'}
                </h1>
                {faculty?.employee_id && (
                  <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-gray-100 text-draft border border-gray-200">
                    EMP: {faculty.employee_id}
                  </span>
                )}
                {data?.classTeacherOf?.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>Class Teacher: {data.classTeacherOf.join(', ')}</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-draft mt-1 font-medium flex items-center gap-2 flex-wrap">
                <span>{faculty?.designation || 'Assistant Professor'}</span>
                <span>·</span>
                <span>{faculty?.department || 'Department of Computer Engineering'}</span>
              </p>
            </div>
          </div>

          {/* Academic Session Selector */}
          {academicYears.length > 0 && (
            <div className="flex items-center gap-2.5 bg-paper/60 border border-rule px-3.5 py-2 rounded-lg self-start md:self-center">
              <CalendarDaysIcon className="w-4 h-4 text-draft" />
              <div className="text-left">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-draft">Academic Session</span>
                <select
                  id="ay-select"
                  value={academicYear || data?.selectedYear || ''}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="bg-transparent text-xs font-bold text-ink focus:outline-none cursor-pointer pr-4"
                >
                  {academicYears.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Priority Action Task Advisory */}
      {(pendingSubjects.length > 0 || pendingPanelEvaluations > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {pendingSubjects.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50/90 to-amber-100/40 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded">
                      Action Required
                    </span>
                    <span className="text-xs font-bold text-ink">Marks Submission Pending</span>
                  </div>
                  <p className="text-xs text-draft mt-0.5">
                    {pendingSubjects.length} assigned subject{pendingSubjects.length > 1 ? 's require' : ' requires'} CIE / semester mark entry.
                  </p>
                </div>
              </div>
              <Link
                to="/faculty/subjects"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-amber-900 text-white rounded-lg hover:bg-amber-950 transition-all shadow-2xs flex-shrink-0"
              >
                <span>Enter Marks</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {pendingPanelEvaluations > 0 && (
            <div className="bg-gradient-to-r from-purple-50/90 to-purple-100/40 border border-purple-200/80 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center flex-shrink-0">
                  <AcademicCapIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 bg-purple-200/80 px-2 py-0.5 rounded">
                      Panel Evaluation
                    </span>
                    <span className="text-xs font-bold text-ink">BE Project Rubrics</span>
                  </div>
                  <p className="text-xs text-draft mt-0.5">
                    {pendingPanelEvaluations} project group{pendingPanelEvaluations > 1 ? 's have' : ' has'} pending evaluation stages.
                  </p>
                </div>
              </div>
              <Link
                to="/faculty/project-eval?tab=evaluations"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-purple-900 text-white rounded-lg hover:bg-purple-950 transition-all shadow-2xs flex-shrink-0"
              >
                <span>Evaluate</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {isAuthorizedFeedbackCoordinator(user) && (
            <div className="bg-gradient-to-r from-blue-50/90 to-blue-100/40 border border-blue-200/80 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-navy flex items-center justify-center flex-shrink-0">
                  <DocumentChartBarIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-navy bg-blue-200/80 px-2 py-0.5 rounded border border-blue-200">
                      Feedback Coordinator
                    </span>
                    <span className="text-xs font-bold text-ink">TE Mid-Sem Evaluations</span>
                  </div>
                  <p className="text-xs text-draft mt-0.5">
                    You are the designated Coordinator for TE Mid-Sem Feedback. Manage forms, monitor submissions, and review reports.
                  </p>
                </div>
              </div>
              <Link
                to="/faculty/feedback"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-navy text-white rounded-lg hover:bg-slate-900 transition-all shadow-2xs flex-shrink-0"
              >
                <span>Dashboard</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Institutional Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-rule rounded-xl p-4 shadow-xs hover:border-navy/40 transition-all">
          <div className="flex items-center justify-between text-draft mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Assigned Classes</span>
            <UserGroupIcon className="w-4 h-4 text-navy" />
          </div>
          <p className="font-serif text-3xl font-bold text-ink">{allSubjects.length}</p>
          <p className="text-[11px] text-draft mt-1 font-medium">SE, TE &amp; BE Teaching Load</p>
        </div>

        <div className="bg-white border border-rule rounded-xl p-4 shadow-xs hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-draft mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Marks Pending</span>
            <ClockIcon className="w-4 h-4 text-amber-600" />
          </div>
          <p className={`font-serif text-3xl font-bold ${pendingSubjects.length > 0 ? 'text-amber-700' : 'text-pass'}`}>
            {pendingSubjects.length}
          </p>
          <p className="text-[11px] text-draft mt-1 font-medium">
            {pendingSubjects.length > 0 ? 'Requires mark entry' : 'All marks submitted'}
          </p>
        </div>

        <div className="bg-white border border-rule rounded-xl p-4 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between text-draft mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Finalized &amp; Published</span>
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-serif text-3xl font-bold text-pass">{completedSubjects.length}</p>
          <p className="text-[11px] text-draft mt-1 font-medium">Approved / Published courses</p>
        </div>

        <div className="bg-white border border-rule rounded-xl p-4 shadow-xs hover:border-navy/40 transition-all">
          <div className="flex items-center justify-between text-draft mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Students Taught</span>
            <BookOpenIcon className="w-4 h-4 text-navy" />
          </div>
          <p className="font-serif text-3xl font-bold text-ink">{totalEnrolled}</p>
          <p className="text-[11px] text-draft mt-1 font-medium">Enrolled across all divisions</p>
        </div>

        <div className="bg-white border border-rule rounded-xl p-4 shadow-xs hover:border-purple-400 transition-all col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-draft mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Panel Evaluations</span>
            <AcademicCapIcon className="w-4 h-4 text-purple-600" />
          </div>
          <p className="font-serif text-3xl font-bold text-purple-900">{groupedPanelAssignments.length}</p>
          <p className="text-[11px] mt-1 font-medium">
            {pendingPanelEvaluations > 0 ? (
              <span className="text-amber-700 font-semibold">{pendingPanelEvaluations} stages pending</span>
            ) : panelAssignments.length > 0 ? (
              <span className="text-emerald-700 font-semibold">All stages completed</span>
            ) : (
              <span className="text-draft">No assignments</span>
            )}
          </p>
        </div>
      </div>

      {/* Workspace Hub */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Academic Workspace</h2>
            <p className="text-xs text-draft">Direct access to core grading, supervision, and documentation tools</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/faculty/subjects"
            className="group bg-white border border-rule rounded-xl p-5 hover:border-maroon/60 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-maroon/10 text-maroon flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <ClipboardDocumentCheckIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-maroon transition-colors">
                Result Generation
              </h3>
              <p className="text-xs text-draft mt-1 leading-relaxed">
                Enter CIE, In-Sem, Practical, and End-Sem marks across assigned divisions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-maroon">
              <span>Open Gradebook</span>
              <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/faculty/reports"
            className="group bg-white border border-rule rounded-xl p-5 hover:border-navy/60 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-navy flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <DocumentChartBarIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-navy transition-colors">
                Class Reports &amp; Gazettes
              </h3>
              <p className="text-xs text-draft mt-1 leading-relaxed">
                Generate divisional result gazettes, pass/fail analysis, and ledger summaries.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-navy">
              <span>View Reports</span>
              <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/faculty/project-eval"
            className="group bg-white border border-rule rounded-xl p-5 hover:border-purple-600 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <AcademicCapIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-purple-900 transition-colors">
                BE Project Evaluation
              </h3>
              <p className="text-xs text-draft mt-1 leading-relaxed">
                Guide project groups, assess rubrics, and record panel scorecard evaluations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-purple-900">
              <span>Supervision Portal</span>
              <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            to="/faculty/magazines"
            className="group bg-white border border-rule rounded-xl p-5 hover:border-emerald-600 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <NewspaperIcon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-sm group-hover:text-emerald-900 transition-colors">
                Newsletter &amp; Periodicals
              </h3>
              <p className="text-xs text-draft mt-1 leading-relaxed">
                Browse published departmental newsletters, research digests, and student works.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-900">
              <span>Read Editions</span>
              <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {isAuthorizedFeedbackCoordinator(user) && (
            <Link
              to="/faculty/feedback"
              className="group bg-white border border-blue-200 rounded-xl p-5 hover:border-navy hover:shadow-md transition-all flex flex-col justify-between bg-blue-50/20"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-navy flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <DocumentChartBarIcon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-navy">
                    Coordinator Desk
                  </span>
                </div>
                <h3 className="font-bold text-ink text-sm group-hover:text-navy transition-colors">
                  TE Mid-Sem Feedback
                </h3>
                <p className="text-xs text-draft mt-1 leading-relaxed">
                  Create, configure, publish, and view live analytics for student course evaluations.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-navy">
                <span>Manage Feedback</span>
                <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Teaching Assignments Status Overview */}
      <div className="panel">
        <div className="panel-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl font-semibold">Course Progress Overview</h2>
            {/* Year filter tabs */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded text-xs font-semibold">
              {['ALL', 'SE', 'TE', 'BE'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-ink shadow-xs font-bold'
                      : 'text-draft hover:text-ink'
                  }`}
                >
                  {tab === 'ALL' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>
          <Link
            to="/faculty/subjects"
            className="text-xs font-semibold text-maroon hover:underline"
          >
            Open in Result Generation →
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="empty-state py-10 text-center">
            <p className="text-base text-draft">No subjects assigned for {activeTab} in {academicYear || data?.selectedYear}.</p>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {subjects.map((s, i) => {
              const enrolled = parseInt(s.enrolled_count, 10) || 0;
              const rawEntered = parseInt(s.marks_entered, 10) || 0;
              const entered = enrolled > 0 ? Math.min(rawEntered, enrolled) : rawEntered;
              const pct = enrolled > 0 ? Math.min(100, Math.round((entered / enrolled) * 100)) : 0;

              return (
                <div key={s.map_id || i} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-ink text-base">{s.name}</span>
                      <span className="font-mono text-xs font-bold text-draft bg-gray-100 px-2 py-0.5 rounded">
                        {s.code}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        {s.division}
                      </span>
                      <StatusBadge status={s.submission_status} />
                    </div>
                    <p className="text-xs text-draft">
                      Semester {s.semester} · {s.credits} Credits · {enrolled} Students Enrolled
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full md:w-64 flex-shrink-0">
                    <div className="flex items-center justify-between text-xs text-draft mb-1.5 font-medium">
                      <span>Marks Progress</span>
                      <span>{entered} / {enrolled} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pct === 100 ? 'bg-pass' : pct > 0 ? 'bg-[#E5A93C]' : 'bg-transparent'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      to={`/faculty/marks/${s.id}?sem=${s.semester}&ay=${s.academic_year}&div=${encodeURIComponent(s.division)}`}
                      className="text-xs font-semibold text-maroon hover:text-[#4E1C27] hover:underline"
                    >
                      {s.submission_status === 'not_started' || s.submission_status === 'draft' ? 'Enter Marks →' : 'View Marks →'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BE Project Panel Evaluations Overview */}
      <div className="panel mt-8">
        <div className="panel-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl font-semibold">Assigned Panel Evaluations</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
              {groupedPanelAssignments.length} Group{groupedPanelAssignments.length !== 1 ? 's' : ''} ({panelAssignments.length} Stages)
            </span>
          </div>
          <Link
            to="/faculty/project-eval"
            className="text-xs font-semibold text-maroon hover:underline"
          >
            Open Evaluation Portal →
          </Link>
        </div>

        {groupedPanelAssignments.length === 0 ? (
          <div className="empty-state py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-ink">No Panel Evaluations Assigned</p>
            <p className="text-xs text-draft mt-1 max-w-md mx-auto">
              You do not have any project groups assigned for panel evaluation in {academicYear || data?.selectedYear} yet.
              When assigned by the HOD or Project Coordinator, they will appear here with rubric evaluation links.
            </p>
            <Link
              to="/faculty/project-eval"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-maroon hover:underline"
            >
              <span>Open Project Supervision Center</span>
              <span>→</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {groupedPanelAssignments.map((grp) => {
              const allSubmitted = grp.stages.every(
                (s) => s.evaluation_status === 'SUBMITTED' || s.evaluation_status === 'LOCKED'
              );
              const hasDraft = grp.stages.some((s) => s.evaluation_status === 'DRAFT');

              return (
                <div
                  key={grp.group_id || grp.group_code}
                  className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-paper/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-navy bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {grp.group_code}
                      </span>
                      <span className="font-semibold text-ink text-base">
                        {grp.title}
                      </span>
                      {allSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          All Stages Evaluated
                        </span>
                      ) : hasDraft ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Draft Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          Pending Evaluation
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-draft">
                      <span>
                        <strong className="text-ink font-medium">Domain:</strong> {grp.domain || 'General'}
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-ink font-medium">Guide:</strong> {grp.guide_name || 'Unassigned'}
                      </span>
                    </div>

                    {Array.isArray(grp.members) && grp.members.length > 0 && (
                      <p className="text-xs text-draft mt-1.5 flex items-center gap-1 truncate">
                        <span className="font-medium text-ink">Students:</span>
                        <span>{grp.members.map((m) => `${m?.name || 'Student'} (${m?.roll_no || '-'})`).join(', ')}</span>
                      </p>
                    )}

                    {/* Evaluation Stages Breakdown */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-draft uppercase tracking-wider">Evaluation Stages:</span>
                      {grp.stages.map((st) => {
                        const isSubmitted =
                          st.evaluation_status === 'SUBMITTED' || st.evaluation_status === 'LOCKED';
                        const isDraft = st.evaluation_status === 'DRAFT';
                        return (
                          <div
                            key={st.assignment_id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-50 border border-gray-200 text-xs"
                          >
                            <span className="font-medium text-ink">{st.stage_name}</span>
                            <span className="text-[10px] text-draft">({Math.round(st.max_marks_total || 50)} Marks)</span>
                            {isSubmitted ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">✓ Completed</span>
                            ) : isDraft ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">Draft</span>
                            ) : (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end flex-shrink-0 pt-1">
                    <Link
                      to="/faculty/project-eval"
                      className={`inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded transition-all ${
                        allSubmitted
                          ? 'border border-rule text-ink hover:bg-paper'
                          : 'bg-maroon text-white hover:bg-[#4E1C27] shadow-xs'
                      }`}
                    >
                      {allSubmitted ? 'View Rubric Scorecards →' : 'Evaluate Group →'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
