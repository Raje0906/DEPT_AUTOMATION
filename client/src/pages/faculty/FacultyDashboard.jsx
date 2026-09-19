import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';

export default function FacultyDashboard() {
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

  if (loading && !data) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
        <div className="p-8 text-sm text-draft">Loading faculty dashboard…</div>
      </div>
    );
  }

  const allSubjects               = data?.subjects || [];
  const academicYears             = data?.academicYears || [];
  const faculty                   = data?.faculty;
  const pendingRevals             = data?.pendingRevaluations || 0;
  const panelAssignments         = data?.panelAssignments || [];
  const pendingPanelEvaluations   = data?.pendingPanelEvaluations || 0;
  const completedPanelEvaluations = data?.completedPanelEvaluations || 0;

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

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">Faculty Dashboard</h1>
          <p className="text-base text-draft mt-1 font-medium">
            {faculty?.designation || 'Faculty'} · {faculty?.department || 'Computer Engineering'}
            {faculty?.employee_id ? ` · EMP ID: ${faculty.employee_id}` : ''}
          </p>
          {data?.classTeacherOf?.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs">
                <span>⭐ Designated Class Teacher:</span>
                <span className="font-extrabold text-amber-900">{data.classTeacherOf.join(', ')}</span>
              </span>
            </div>
          )}
        </div>

        {/* Academic Year Selector */}
        {academicYears.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="ay-select" className="text-xs font-semibold text-draft uppercase tracking-wider">
              Academic Year:
            </label>
            <select
              id="ay-select"
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

      {/* Action Banners */}
      <div className="space-y-3 mb-8">
        {pendingSubjects.length > 0 && (
          <div className="notification-strip py-3.5 px-5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center">
              <span className="text-xs font-bold text-navy uppercase tracking-wider mr-2.5 bg-blue-100 px-2 py-0.5 rounded">
                Action required
              </span>
              <span className="font-medium text-ink">
                {pendingSubjects.length} assigned course{pendingSubjects.length > 1 ? 's have' : ' has'} marks pending submission.
              </span>
            </div>
            <Link
              to="/faculty/subjects"
              className="text-xs font-semibold text-maroon hover:underline flex-shrink-0"
            >
              Go to Result Generation →
            </Link>
          </div>
        )}

        {pendingPanelEvaluations > 0 && (
          <div className="notification-strip py-3.5 px-5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-50/90 border-purple-200">
            <div className="flex items-center">
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider mr-2.5 bg-purple-200/80 px-2 py-0.5 rounded">
                Panel Evaluation
              </span>
              <span className="font-medium text-purple-950">
                {pendingPanelEvaluations} BE Project group{pendingPanelEvaluations > 1 ? 's' : ''} assigned for panel rubric evaluation.
              </span>
            </div>
            <Link
              to="/faculty/project-eval"
              className="text-xs font-semibold text-purple-900 hover:text-purple-950 hover:underline flex-shrink-0"
            >
              Evaluate in Portal →
            </Link>
          </div>
        )}

        {pendingRevals > 0 && (
          <div className="notification-strip py-3.5 px-5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border-amber-200">
            <div className="flex items-center">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mr-2.5 bg-amber-100 px-2 py-0.5 rounded">
                Revaluation
              </span>
              <span className="font-medium text-amber-900">
                {pendingRevals} student revaluation request{pendingRevals > 1 ? 's' : ''} awaiting review.
              </span>
            </div>
            <Link
              to="/faculty/revaluation"
              className="text-xs font-semibold text-amber-900 hover:underline flex-shrink-0"
            >
              Review Requests →
            </Link>
          </div>
        )}
      </div>

      {/* Key Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">Assigned Classes</p>
          <p className="font-serif text-3xl font-bold text-ink">{allSubjects.length}</p>
          <p className="text-xs text-draft mt-1">SE, TE &amp; BE classes</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">Marks Pending</p>
          <p className="font-serif text-3xl font-bold text-maroon">{pendingSubjects.length}</p>
          <p className="text-xs text-draft mt-1">Requires mark entry</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">Submitted / Published</p>
          <p className="font-serif text-3xl font-bold text-pass">{completedSubjects.length}</p>
          <p className="text-xs text-draft mt-1">Completed submissions</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">Students Taught</p>
          <p className="font-serif text-3xl font-bold text-ink">{totalEnrolled}</p>
          <p className="text-xs text-draft mt-1">Across 4 divisions per year</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs text-draft uppercase tracking-wider font-semibold mb-1">Panel Evaluations</p>
          <p className="font-serif text-3xl font-bold text-navy">{panelAssignments.length}</p>
          <p className="text-xs mt-1 font-medium">
            {pendingPanelEvaluations > 0 ? (
              <span className="text-amber-700">{pendingPanelEvaluations} pending review</span>
            ) : panelAssignments.length > 0 ? (
              <span className="text-emerald-700">All completed</span>
            ) : (
              <span className="text-draft">No assignments</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="mb-8">
        <h2 className="font-serif text-xl font-semibold text-ink mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/faculty/subjects"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-maroon/10 text-maroon flex items-center justify-center font-bold text-sm">
                📝
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                Result Generation
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Enter CIE, Practical, and End-Sem marks across SE, TE, and BE classes.
            </p>
          </Link>

          <Link
            to="/faculty/reports"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                📊
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                Class Reports
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Generate divisional result gazettes and analytics for Comp 1 to Comp 4.
            </p>
          </Link>

          <Link
            to="/faculty/revaluation"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                🔄
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                Revaluation Cell
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Review and address student revaluation queries and mark verification requests.
            </p>
          </Link>

          <Link
            to="/faculty/lab-maintenance"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                🛠️
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                Lab Maintenance
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Log equipment issues, monitor lab workstation readiness, and manage maintenance tickets.
            </p>
          </Link>

          <Link
            to="/faculty/project-eval"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm">
                🎓
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                BE Project Evaluation
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Guide, review, and evaluate Final Year BE Project batches, milestones, and rubrics.
            </p>
          </Link>

          <Link
            to="/faculty/magazines"
            className="panel p-5 hover:border-maroon/40 hover:shadow-sm transition-all group block"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-sm">
                📖
              </span>
              <h3 className="font-semibold text-ink text-base group-hover:text-maroon transition-colors">
                Magazines &amp; Research
              </h3>
            </div>
            <p className="text-xs text-draft leading-relaxed">
              Access departmental research periodicals, technical magazines, and publications.
            </p>
          </Link>
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
              const entered = parseInt(s.marks_entered, 10) || 0;
              const enrolled = parseInt(s.enrolled_count, 10) || 0;
              const pct = enrolled > 0 ? Math.round((entered / enrolled) * 100) : 0;

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
              {panelAssignments.length} Assigned
            </span>
          </div>
          <Link
            to="/faculty/project-eval"
            className="text-xs font-semibold text-maroon hover:underline"
          >
            Open Evaluation Portal →
          </Link>
        </div>

        {panelAssignments.length === 0 ? (
          <div className="empty-state py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-xl font-bold">
              🎓
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
            {panelAssignments.map((ass) => {
              const isSubmitted = ass.evaluation_status === 'SUBMITTED' || ass.evaluation_status === 'LOCKED';
              const isDraft = ass.evaluation_status === 'DRAFT';
              return (
                <div
                  key={ass.assignment_id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-paper/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-navy bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {ass.group_code}
                      </span>
                      <span className="font-semibold text-ink text-base">
                        {ass.title}
                      </span>
                      {isSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Submitted &amp; Locked
                        </span>
                      ) : isDraft ? (
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
                        <strong className="text-ink font-medium">Domain:</strong> {ass.domain || 'General'}
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-ink font-medium">Stage:</strong> {ass.stage_name} ({Math.round(ass.max_marks_total || 50)} Marks)
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-ink font-medium">Guide:</strong> {ass.guide_name || 'Unassigned'}
                      </span>
                    </div>

                    {ass.members && ass.members.length > 0 && (
                      <p className="text-xs text-draft mt-1.5 flex items-center gap-1 truncate">
                        <span className="font-medium text-ink">Students:</span>
                        <span>{ass.members.map((m) => `${m.name} (${m.roll_no})`).join(', ')}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end flex-shrink-0">
                    <Link
                      to="/faculty/project-eval"
                      className={`inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded transition-all ${
                        isSubmitted
                          ? 'border border-rule text-ink hover:bg-paper'
                          : 'bg-maroon text-white hover:bg-[#4E1C27] shadow-xs'
                      }`}
                    >
                      {isSubmitted ? 'View Rubric Scorecard →' : 'Evaluate Group →'}
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
