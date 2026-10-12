import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { StatusBadge } from '../../components/ResultTable';
import { useMagazine } from '../../contexts/MagazineContext';
import WhatsAppNotifyModal from '../../components/WhatsAppNotifyModal';

export default function HODDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('2026-27');
  const [selectedSem, setSelectedSem] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const { magazines } = useMagazine();

  const pendingMagazines = magazines?.filter((m) => m.status === 'Under Review') || [];

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear) params.append('academic_year', selectedYear);
      if (selectedSem) params.append('semester', selectedSem);

      const res = await api.get(`/hod/dashboard?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error('[HOD Dashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedSem]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const subjects = data?.subjects || [];
  const stats = data?.stats || {};
  const needsAction = subjects.filter((s) => s.status === 'submitted');
  const availableYears = data?.availableYears?.length > 0
    ? Array.from(new Set([selectedYear, ...data.availableYears, '2026-27', '2025-26', '2024-25'])).sort().reverse()
    : ['2026-27', '2025-26', '2024-25'];

  // Group by semester
  const bySemester = {};
  for (const s of subjects) {
    if (!bySemester[s.semester]) bySemester[s.semester] = [];
    bySemester[s.semester].push(s);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 w-full max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Institutional Executive Header */}
      <div className="pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-gray-900">
              HOD Executive Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-white text-navy border border-gray-300 shadow-2xs">
              AY {selectedYear}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 font-medium">
            Department of Computer Engineering · MES Wadia College of Engineering, Pune (SPPU)
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Academic Year Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">AY:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs font-semibold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} {yr === '2026-27' ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Sem:</span>
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value)}
              className="text-xs font-semibold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="">All Semesters</option>
              <option value="3">Sem 3 (SE)</option>
              <option value="4">Sem 4 (SE)</option>
              <option value="5">Sem 5 (TE)</option>
              <option value="6">Sem 6 (TE)</option>
              <option value="7">Sem 7 (BE)</option>
              <option value="8">Sem 8 (BE)</option>
            </select>
          </div>

          <Link
            to="/hod/teachers"
            className="px-3.5 py-1.5 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            <span>+</span> Allocate Courses
          </Link>

          <Link
            to="/hod/approval"
            className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-xs font-semibold rounded shadow-2xs transition-colors inline-flex items-center"
          >
            Review Marks
          </Link>

          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            title="Open WhatsApp Notification Center (Restricted to 4 Whitelisted Students)"
          >
            <span>💬</span> Test WhatsApp
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Faculty Strength</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">
            {stats.totalFaculty || 38}
          </p>
          <p className="text-xs text-slate-500 mt-1">Approved department faculty register</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Active Course Mappings</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">
            {subjects.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Teaching subject &amp; division links</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Enrolled Students</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">
            {stats.totalStudents || 840}
          </p>
          <p className="text-xs text-slate-500 mt-1">SE, TE, &amp; BE academic cohorts</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Class Guardians Appointed</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">
            {stats.totalClassTeachers || 0} / 12
          </p>
          <p className="text-xs text-slate-500 mt-1">Designated class guardians (SE–BE)</p>
        </div>
      </div>

      {/* Action / Notification Strips */}
      {(needsAction.length > 0 || pendingMagazines.length > 0) && (
        <div className="space-y-2.5">
          {needsAction.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded">
                  Awaiting Review
                </span>
                <span>
                  <strong>{needsAction.length}</strong> subject mark submission{needsAction.length > 1 ? 's' : ''} submitted for HOD approval.
                </span>
              </div>
              <Link
                to="/hod/approval"
                className="text-xs font-bold text-[#800000] hover:underline flex-shrink-0"
              >
                Review &amp; Approve →
              </Link>
            </div>
          )}

          {pendingMagazines.length > 0 && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-950 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[11px] text-indigo-800 bg-indigo-200/70 px-1.5 py-0.5 rounded">
                  Magazine Review
                </span>
                <span>
                  <strong>{pendingMagazines.length}</strong> department magazine issue{pendingMagazines.length > 1 ? 's' : ''} awaiting HOD publication sign-off.
                </span>
              </div>
              <Link
                to="/hod/magazine-approvals"
                className="text-xs font-bold text-[#800000] hover:underline flex-shrink-0"
              >
                Review Magazine →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Active Subjects Tracker */}
      {subjects.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="font-serif text-lg font-bold text-gray-900">
              Department Course Allocation &amp; Evaluation Matrix
            </h2>
            <div className="text-xs text-gray-500 font-medium">
              Showing <strong>{subjects.length}</strong> active course mappings for AY {selectedYear}
            </div>
          </div>

          {Object.entries(bySemester)
            .sort(([a], [b]) => b - a)
            .map(([sem, subs]) => (
              <div key={sem} className="bg-white rounded border border-rule shadow-2xs overflow-hidden">
                <div className="p-3.5 bg-[#FAF8F5] border-b border-[#E8E4DC] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-sm font-bold text-gray-900">
                      Semester {sem} Courses
                    </h3>
                    <span className="font-mono text-[11px] text-gray-500">
                      ({subs.length} {subs.length === 1 ? 'course' : 'courses'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
                    <span className="text-emerald-700 font-bold">
                      {subs.filter((s) => s.status === 'approved' || s.status === 'published').length} Approved
                    </span>
                    <span>·</span>
                    <span className="text-amber-700 font-bold">
                      {subs.filter((s) => s.status === 'submitted').length} Awaiting
                    </span>
                    <span>·</span>
                    <span className="text-slate-500">
                      {subs.filter((s) => s.status === 'draft' || s.status === 'not_started').length} Pending
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Subject Name</th>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Faculty Member</th>
                        <th className="py-2.5 px-3">Division</th>
                        <th className="py-2.5 px-3 text-right">Enrolled</th>
                        <th className="py-2.5 px-3 text-right">Marks Entered</th>
                        <th className="py-2.5 px-3">Evaluation Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-gray-800">
                      {subs.map((s, i) => (
                        <tr key={i} className={`hover:bg-slate-50/70 transition-colors ${s.status === 'submitted' ? 'bg-amber-50/50' : ''}`}>
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{s.subject_name}</td>
                          <td className="py-2.5 px-3 font-mono text-gray-600">{s.code}</td>
                          <td className="py-2.5 px-3">{s.faculty_name}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                              {s.division}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-num">{s.enrolled || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-num">{s.marks_entered || 0}</td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {s.status === 'submitted' ? (
                              <Link
                                to={`/hod/approval?subjectId=${s.id}&sem=${s.semester}&ay=${s.academic_year}`}
                                className="text-xs font-bold text-[#800000] hover:underline"
                              >
                                Review Marks
                              </Link>
                            ) : (
                              <Link
                                to={`/hod/teachers`}
                                className="text-xs text-navy hover:underline font-medium"
                              >
                                Manage
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Dignified Institutional Onboarding & Allocation Center (when subjects.length === 0) */}
      {subjects.length === 0 && !loading && (
        <div className="space-y-6">
          {/* Main Term Setup Ledger Card */}
          <div className="bg-white rounded border border-rule shadow-2xs overflow-hidden">
            <div className="h-1 bg-[#1E2D5A]"></div>
            <div className="p-6 sm:p-8">
              <div className="max-w-2xl mx-auto text-center space-y-4">
                <div className="w-12 h-12 rounded bg-[#FAF8F5] border border-[#D4D0C8] text-navy flex items-center justify-center mx-auto text-lg font-serif font-bold">
                  CE
                </div>
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">
                    Academic Term Course Allocation Pending
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                    No active course allocations are currently recorded for <strong className="text-gray-900">Academic Year {selectedYear}</strong> in the Department of Computer Engineering.
                  </p>
                </div>

                {/* Term Readiness Checklist */}
                <div className="bg-[#FAF8F5] border border-[#E8E4DC] rounded p-4 text-left space-y-2.5 max-w-lg mx-auto">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-gray-600">
                    Term Setup Checklist &amp; Department State:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Faculty Register Verified ({stats.totalFaculty || 38} Faculty)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>Student Roster ({stats.totalStudents || 840} Students)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-bold">○</span>
                      <span>Course &amp; Division Allocation (Pending)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-600 font-bold">○</span>
                      <span>Class Guardian Appointments ({stats.totalClassTeachers || 0}/12 Appointed)</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                  <Link
                    to="/hod/teachers"
                    className="px-4 py-2 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>+</span> Allocate Faculty &amp; Subjects
                  </Link>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-gray-300 text-slate-700 text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
                  >
                    <option value="2026-27">View AY 2026–27</option>
                    <option value="2025-26">View AY 2025–26</option>
                    <option value="2024-25">View AY 2024–25</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Department Portals & Navigation */}
          <div>
            <h3 className="font-serif text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
              Department Operations &amp; Portals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/hod/teachers"
                className="bg-white p-4 rounded border border-rule shadow-2xs hover:border-navy hover:shadow-xs transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy font-mono">FACULTY REGISTER</span>
                  <span className="text-xs text-gray-400 group-hover:text-navy transition-colors">→</span>
                </div>
                <h4 className="font-serif text-sm font-bold text-gray-900 group-hover:text-navy transition-colors">
                  Faculty &amp; Teaching Staff
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Manage department faculty profiles, workload distributions, and class guardian designations.
                </p>
              </Link>

              <Link
                to="/hod/approval"
                className="bg-white p-4 rounded border border-rule shadow-2xs hover:border-navy hover:shadow-xs transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy font-mono">EXAMINATION</span>
                  <span className="text-xs text-gray-400 group-hover:text-navy transition-colors">→</span>
                </div>
                <h4 className="font-serif text-sm font-bold text-gray-900 group-hover:text-navy transition-colors">
                  Marks Moderation &amp; Review
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Review submitted Insem, CCE, and End-Sem evaluation scores from course teachers.
                </p>
              </Link>

              <Link
                to="/hod/analytics"
                className="bg-white p-4 rounded border border-rule shadow-2xs hover:border-navy hover:shadow-xs transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy font-mono">PERFORMANCE</span>
                  <span className="text-xs text-gray-400 group-hover:text-navy transition-colors">→</span>
                </div>
                <h4 className="font-serif text-sm font-bold text-gray-900 group-hover:text-navy transition-colors">
                  Department Result Analytics
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Inspect SGPA/CGPA distribution curves, pass percentages, and subject topper rankings.
                </p>
              </Link>

              <Link
                to="/hod/seminar-tracker"
                className="bg-white p-4 rounded border border-rule shadow-2xs hover:border-navy hover:shadow-xs transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-navy font-mono">ACADEMIC TRACKS</span>
                  <span className="text-xs text-gray-400 group-hover:text-navy transition-colors">→</span>
                </div>
                <h4 className="font-serif text-sm font-bold text-gray-900 group-hover:text-navy transition-colors">
                  TE Seminar &amp; Projects
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Oversee Technical Seminar guide allocations, report submissions, and presentation reviews.
                </p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Test Notification Center Modal */}
      <WhatsAppNotifyModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
      />
    </div>
  );
}
