import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODSeminarMgmt() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals' | 'marks'
  const [academicYear, setAcademicYear] = useState('2025-26');

  // Backend state
  const [groups, setGroups] = useState([]);
  const [marksData, setMarksData] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  // Search & Filter state
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState('ALL');
  const [marksSearchQuery, setMarksSearchQuery] = useState('');
  const [marksStatusFilter, setMarksStatusFilter] = useState('ALL');

  // Modal states
  const [guideModalGroup, setGuideModalGroup] = useState(null);
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [rejectModalGroup, setRejectModalGroup] = useState(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Main Data Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const [groupsRes, marksRes, facultyRes, sessRes] = await Promise.all([
        api.get(`/seminar/hod/groups?academic_year=${academicYear}`),
        api.get(`/seminar/hod/marks?academic_year=${academicYear}`),
        api.get(`/coordinators?academic_year=${academicYear}`),
        api.get('/seminar/sessions').catch(() => ({ data: { sessions: [] } })),
      ]);

      setGroups(groupsRes.data || []);
      setMarksData(marksRes.data || []);
      setFacultyList(facultyRes.data?.facultyList || []);

      const sessList = sessRes.data?.sessions || [];
      setSessions(sessList);
      if (sessList.length > 0) {
        const matchingSess = sessList.find((s) => s.academic_year === academicYear) || sessList[0];
        setActiveSession(matchingSess);
      }
    } catch (err) {
      console.error('Failed to load TE Seminar governance data:', err);
      toast.error('Failed to load TE Seminar governance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academicYear]);

  // ─── GUIDE APPROVAL HANDLERS ────────────────────────────────────────────────

  // Single Approve
  const handleApproveGuide = async (groupId, groupNo) => {
    setSubmitting(true);
    try {
      const res = await api.patch(`/seminar/hod/groups/${groupId}/approve`);
      toast.success(res.data.message || `Guide allocation for Group #${groupNo} approved`);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve guide allocation');
    } finally {
      setSubmitting(false);
    }
  };

  // Single Reject with Remark
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalGroup) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/seminar/hod/groups/${rejectModalGroup.id}/reject`, {
        remark: rejectRemark.trim() || 'Allocation rejected by HOD',
      });
      toast.success(res.data.message || `Guide allocation for Group #${rejectModalGroup.group_no} rejected`);
      setRejectModalGroup(null);
      setRejectRemark('');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject guide allocation');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    const pendingCount = groups.filter((g) => g.status === 'AWAITING_HOD_APPROVAL').length;
    if (pendingCount === 0) return toast('No pending guide allocations to approve');
    if (!window.confirm(`Approve all ${pendingCount} pending guide allocation(s)? Once approved, guides will become active and visible to students and faculty rosters.`)) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/seminar/hod/groups/bulk-approve', { academic_year: academicYear });
      toast.success(res.data.message || 'All pending guide allocations approved');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to bulk approve guide allocations');
    } finally {
      setSubmitting(false);
    }
  };

  // Assign / Reassign Guide directly
  const handleSaveGuideAssignment = async (e) => {
    e.preventDefault();
    if (!guideModalGroup) return;
    setSubmitting(true);
    try {
      const res = await api.patch(`/seminar/hod/groups/${guideModalGroup.id}/guide`, {
        guide_id: selectedGuideId ? Number(selectedGuideId) : null,
      });
      toast.success(res.data.message || 'Guide assigned and approved successfully');
      setGuideModalGroup(null);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign guide');
    } finally {
      setSubmitting(false);
    }
  };

  // Download Marksheet (.xlsx)
  const handleDownloadMarksheet = async () => {
    const targetSessionId = activeSession?.id || sessions[0]?.id;
    if (!targetSessionId) {
      toast.error('No active seminar session found for marksheet export.');
      return;
    }
    setDownloading(true);
    const toastId = toast.loading('Generating official Excel marksheet…');
    try {
      const res = await api.get(`/seminar/sessions/${targetSessionId}/export-marks`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TE_Seminar_${academicYear}_Official_Marksheet.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Marksheet downloaded successfully', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download marksheet', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  // Filtered Groups for Tab 1
  const filteredGroups = groups.filter((g) => {
    const query = groupSearchQuery.toLowerCase();
    const matchesSearch =
      String(g.group_no).includes(query) ||
      g.domain?.toLowerCase().includes(query) ||
      g.guide_name?.toLowerCase().includes(query) ||
      g.members?.some(
        (m) => m.student_name?.toLowerCase().includes(query) || m.prn?.toLowerCase().includes(query)
      );

    if (!matchesSearch) return false;
    if (groupStatusFilter === 'AWAITING') return g.status === 'AWAITING_HOD_APPROVAL';
    if (groupStatusFilter === 'APPROVED') return g.status === 'APPROVED';
    if (groupStatusFilter === 'PENDING') return g.status !== 'APPROVED' && g.status !== 'AWAITING_HOD_APPROVAL';
    return true;
  });

  // Filtered Marks for Tab 2
  const filteredMarks = marksData.filter((item) => {
    const query = marksSearchQuery.toLowerCase();
    const matchesSearch =
      String(item.group_no).includes(query) ||
      item.student_name?.toLowerCase().includes(query) ||
      item.prn?.toLowerCase().includes(query) ||
      item.guide_name?.toLowerCase().includes(query) ||
      item.domain?.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (marksStatusFilter !== 'ALL') return item.marks_status === marksStatusFilter;
    return true;
  });

  // Summary Counts
  const pendingApprovalsCount = groups.filter((g) => g.status === 'AWAITING_HOD_APPROVAL').length;
  const approvedGroupsCount = groups.filter((g) => g.status === 'APPROVED').length;
  const unassignedGroupsCount = groups.filter((g) => !g.guide_name || g.guide_name === 'Unassigned').length;

  const submittedMarksCount = marksData.filter((m) => m.marks_status === 'SUBMITTED' || m.marks_status === 'FINALIZED').length;
  const draftMarksCount = marksData.filter((m) => m.marks_status === 'DRAFT').length;

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">TE Seminar Governance</h1>
          <p className="text-base text-draft mt-1 font-medium">
            HOD Oversight: Guide Assignment Approvals &amp; Faculty Marks Verification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-draft uppercase tracking-wider">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input-field py-1.5 px-3 text-xs font-mono font-bold bg-white border border-rule rounded shadow-xs"
          >
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
            <option value="2026-27">2026-27</option>
          </select>
        </div>
      </div>

      {/* ─── TAB NAVIGATION (EXACT 2-TAB SCOPE) ──────────────────────── */}
      <div className="flex gap-2 border-b border-rule pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 text-xs font-semibold rounded flex items-center gap-2 transition-colors ${
            activeTab === 'approvals'
              ? 'bg-navy text-white shadow-xs'
              : 'bg-paper text-draft hover:text-ink hover:bg-paper/80'
          }`}
        >
          <span>👥 Guide Allocation Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('marks')}
          className={`px-4 py-2 text-xs font-semibold rounded flex items-center gap-2 transition-colors ${
            activeTab === 'marks'
              ? 'bg-navy text-white shadow-xs'
              : 'bg-paper text-draft hover:text-ink hover:bg-paper/80'
          }`}
        >
          <span>📊 Faculty Marks &amp; Evaluations (Read-Only)</span>
          <span className="text-[10px] font-mono text-draft bg-rule/50 px-1.5 py-0.5 rounded">
            {marksData.length}
          </span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: GUIDE ALLOCATION APPROVALS                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Total Seminar Groups</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">{groups.length}</p>
              <p className="text-xs text-draft mt-1">AY {academicYear} cohort</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Approved Guide Allocations</span>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">{approvedGroupsCount}</p>
              <p className="text-xs text-draft mt-1">Active &amp; published to students</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Awaiting HOD Approval</span>
              <p className={`font-serif text-3xl font-bold mt-1 ${pendingApprovalsCount > 0 ? 'text-amber-600' : 'text-draft'}`}>
                {pendingApprovalsCount}
              </p>
              <p className="text-xs text-draft mt-1">Submitted by coordinator</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Pending Guide Allocation</span>
              <p className="font-serif text-3xl font-bold text-draft mt-1">{unassignedGroupsCount}</p>
              <p className="text-xs text-draft mt-1">Awaiting coordinator allocation</p>
            </div>
          </div>

          {/* Actionable Banner for Pending Approvals */}
          {pendingApprovalsCount > 0 && (
            <div className="panel p-4 bg-amber-50/80 border-l-4 border-l-amber-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    {pendingApprovalsCount} Guide Allocation(s) Awaiting HOD Approval
                  </h4>
                  <p className="text-xs text-amber-700">
                    Review the guide assignments submitted below. Approve them to make guides visible in student portals and active for faculty evaluation.
                  </p>
                </div>
              </div>
              <button
                onClick={handleBulkApprove}
                disabled={submitting}
                className="btn-primary bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-4 py-2 flex items-center gap-1.5 whitespace-nowrap shadow-xs disabled:opacity-50"
              >
                <span>✓</span> Approve All Pending Allocations
              </button>
            </div>
          )}

          {/* Toolbar & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-4 rounded border border-rule">
            <div className="flex flex-wrap items-center gap-2">
              {pendingApprovalsCount > 0 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={submitting}
                  className="btn-primary bg-emerald-700 hover:bg-emerald-800 text-white text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <span>✓</span> Approve All Pending ({pendingApprovalsCount})
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-draft">Filter Status:</span>
                <select
                  value={groupStatusFilter}
                  onChange={(e) => setGroupStatusFilter(e.target.value)}
                  className="input-field py-1 px-2.5 text-xs bg-white border border-rule rounded shadow-xs font-medium"
                >
                  <option value="ALL">All Groups ({groups.length})</option>
                  <option value="AWAITING">Awaiting Approval ({pendingApprovalsCount})</option>
                  <option value="APPROVED">Approved ({approvedGroupsCount})</option>
                  <option value="PENDING">Pending Guide ({unassignedGroupsCount})</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search group #, domain, student or guide…"
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="input-field w-full py-1.5 px-3 text-xs bg-white border border-rule rounded shadow-xs"
              />
            </div>
          </div>

          {/* Groups Approvals Table */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <h2 className="font-serif text-xl font-semibold">Seminar Group Guide Allocations</h2>
              <span className="text-xs font-mono text-draft">{filteredGroups.length} Groups Listed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="result-table w-full">
                <thead>
                  <tr>
                    <th>Group #</th>
                    <th>Domain / Topic</th>
                    <th>Student Members</th>
                    <th>Proposed Faculty Guide</th>
                    <th className="text-center">Approval Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((grp) => (
                    <tr key={grp.id} className="hover:bg-paper/60 transition-colors">
                      <td className="font-mono font-bold text-navy text-sm">
                        Group #{grp.group_no}
                      </td>

                      <td>
                        <span className="badge bg-paper border border-rule text-xs font-semibold text-ink">
                          {grp.domain || 'Unassigned Topic'}
                        </span>
                      </td>

                      <td>
                        <div className="space-y-1">
                          {grp.members?.map((m) => (
                            <div key={m.id || m.prn} className="text-xs text-ink flex items-center gap-1.5">
                              <span className="font-mono text-draft font-semibold text-[11px]">{m.prn}</span>
                              <span className="font-medium">{m.student_name}</span>
                              {m.is_leader && (
                                <span className="badge bg-navy/10 text-navy text-[9px] py-0 px-1 font-bold">Leader</span>
                              )}
                            </div>
                          ))}
                          {(!grp.members || grp.members.length === 0) && (
                            <span className="text-xs text-draft italic">No members listed</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <p className="font-bold text-ink text-xs">{grp.guide_name || 'Unassigned'}</p>
                        <p className="text-[10px] text-draft">{grp.guide_designation || 'Faculty'}</p>
                      </td>

                      <td className="text-center">
                        {grp.status === 'APPROVED' && (
                          <span className="badge status-approved text-[10px] font-semibold">
                            ✓ Approved
                          </span>
                        )}
                        {grp.status === 'AWAITING_HOD_APPROVAL' && (
                          <span className="badge bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold animate-pulse">
                            ⏳ Awaiting HOD Approval
                          </span>
                        )}
                        {grp.status !== 'APPROVED' && grp.status !== 'AWAITING_HOD_APPROVAL' && (
                          <span className="badge status-draft text-[10px]">
                            Pending Guide
                          </span>
                        )}
                      </td>

                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {grp.status === 'AWAITING_HOD_APPROVAL' && (
                            <>
                              <button
                                onClick={() => handleApproveGuide(grp.id, grp.group_no)}
                                disabled={submitting}
                                className="btn-primary bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] py-1 px-2.5 shadow-xs disabled:opacity-50"
                                title="Approve Guide Allocation"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModalGroup(grp);
                                  setRejectRemark('');
                                }}
                                disabled={submitting}
                                className="btn-secondary text-fail border-fail/30 hover:bg-fail/10 text-[11px] py-1 px-2 disabled:opacity-50"
                                title="Reject Guide Allocation"
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setGuideModalGroup(grp);
                              setSelectedGuideId(grp.guide_id ? String(grp.guide_id) : '');
                            }}
                            className="btn-secondary text-[11px] py-1 px-2.5"
                          >
                            {grp.status === 'APPROVED' ? 'Reassign' : grp.status === 'AWAITING_HOD_APPROVAL' ? 'Change' : 'Assign Guide'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-xs text-draft italic">
                        {loading ? 'Loading seminar groups…' : 'No seminar groups found matching your filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: FACULTY MARKS & EVALUATIONS (STRICTLY READ-ONLY)        */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'marks' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Total Enrolled Students</span>
              <p className="font-serif text-3xl font-bold text-navy mt-1">{marksData.length}</p>
              <p className="text-xs text-draft mt-1">Across all seminar groups</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Evaluations Submitted</span>
              <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">{submittedMarksCount}</p>
              <p className="text-xs text-draft mt-1">Finalized by faculty</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">In Draft Status</span>
              <p className="font-serif text-3xl font-bold text-amber-600 mt-1">{draftMarksCount}</p>
              <p className="text-xs text-draft mt-1">Pending submission</p>
            </div>

            <div className="panel p-5">
              <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Not Started</span>
              <p className="font-serif text-3xl font-bold text-draft mt-1">
                {marksData.length - submittedMarksCount - draftMarksCount}
              </p>
              <p className="text-xs text-draft mt-1">Awaiting evaluation entry</p>
            </div>
          </div>

          {/* Toolbar with Marksheet Download */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper p-4 rounded border border-rule">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownloadMarksheet}
                disabled={downloading}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <span>⬇</span> {downloading ? 'Downloading…' : 'Download Official Excel Marksheet'}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-draft">Status:</span>
                <select
                  value={marksStatusFilter}
                  onChange={(e) => setMarksStatusFilter(e.target.value)}
                  className="input-field py-1 px-2.5 text-xs bg-white border border-rule rounded shadow-xs font-medium"
                >
                  <option value="ALL">All Records ({marksData.length})</option>
                  <option value="SUBMITTED">Submitted ({submittedMarksCount})</option>
                  <option value="DRAFT">Draft ({draftMarksCount})</option>
                  <option value="NOT_STARTED">Not Started ({marksData.length - submittedMarksCount - draftMarksCount})</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search PRN, student name, group #, or guide…"
                value={marksSearchQuery}
                onChange={(e) => setMarksSearchQuery(e.target.value)}
                className="input-field w-full py-1.5 px-3 text-xs bg-white border border-rule rounded shadow-xs"
              />
            </div>
          </div>

          {/* Read-Only Marks Table */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold">Faculty Evaluation &amp; Marks Register</h2>
                <p className="text-xs text-draft">Strictly Read-Only view of marks entered by seminar faculty</p>
              </div>
              <span className="text-xs font-mono text-draft">{filteredMarks.length} Students Listed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="result-table w-full">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Student (PRN &amp; Name)</th>
                    <th>Guide / Evaluator</th>
                    <th className="numeric">Attendance (10)</th>
                    <th className="numeric">Presentation (10)</th>
                    <th className="numeric">Subject Und. (10)</th>
                    <th className="numeric">Publication (10)</th>
                    <th className="numeric">Viva (10)</th>
                    <th className="numeric font-bold">Total (50)</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarks.map((m) => (
                    <tr key={`${m.group_id}-${m.prn}`} className="hover:bg-paper/60 transition-colors">
                      <td className="font-mono font-bold text-navy text-xs">
                        Group #{m.group_no}
                      </td>

                      <td>
                        <p className="font-bold text-ink text-xs">{m.student_name}</p>
                        <p className="font-mono text-draft text-[11px]">{m.prn} · {m.division || 'TE'}</p>
                      </td>

                      <td>
                        <p className="font-bold text-ink text-xs">{m.guide_name}</p>
                        <p className="text-[10px] text-draft">{m.guide_designation || 'Faculty'}</p>
                      </td>

                      <td className="numeric font-mono text-xs">{Number(m.attendance_marks || 0).toFixed(1)}</td>
                      <td className="numeric font-mono text-xs">{Number(m.presentation_marks || 0).toFixed(1)}</td>
                      <td className="numeric font-mono text-xs">{Number(m.subject_understanding_marks || 0).toFixed(1)}</td>
                      <td className="numeric font-mono text-xs">{Number(m.publication_marks || 0).toFixed(1)}</td>
                      <td className="numeric font-mono text-xs">{Number(m.viva_marks || 0).toFixed(1)}</td>

                      <td className="numeric font-mono font-bold text-navy text-sm">
                        {Number(m.total_marks || 0).toFixed(2)}
                      </td>

                      <td className="text-center">
                        {m.marks_status === 'SUBMITTED' || m.marks_status === 'FINALIZED' ? (
                          <span className="badge status-approved text-[10px] font-semibold">
                            Submitted
                          </span>
                        ) : m.marks_status === 'DRAFT' ? (
                          <span className="badge bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                            Draft
                          </span>
                        ) : (
                          <span className="badge status-draft text-[10px]">
                            Not Started
                          </span>
                        )}
                      </td>

                      <td className="text-right">
                        <button
                          onClick={() => setDetailModalItem(m)}
                          className="btn-secondary text-[11px] py-1 px-2.5"
                          title="View Evaluation Details"
                        >
                          View Rubric
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredMarks.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-xs text-draft italic">
                        {loading ? 'Loading marks records…' : 'No evaluation records found matching your filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALS ─────────────────────────────────────────────────── */}

      {/* Assign / Reassign Guide Modal */}
      {guideModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="panel bg-white w-full max-w-md shadow-2xl rounded border border-rule overflow-hidden">
            <div className="panel-header p-5 bg-paper border-b border-rule flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-ink">
                Assign Guide for Group #{guideModalGroup.group_no}
              </h3>
              <button
                onClick={() => setGuideModalGroup(null)}
                className="text-draft hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGuideAssignment} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-draft mb-2">
                  Domain: <span className="font-semibold text-ink">{guideModalGroup.domain || 'Unassigned'}</span>
                </p>
                <label className="input-label block text-xs font-bold uppercase tracking-wider text-draft mb-1.5">
                  Select Faculty Guide
                </label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="input-field w-full p-2.5 text-sm bg-white border border-rule rounded font-medium"
                >
                  <option value="">-- Unassign Guide --</option>
                  {facultyList.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.designation || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setGuideModalGroup(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Confirm Assignment & Approve'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Guide Allocation Modal */}
      {rejectModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="panel bg-white w-full max-w-md shadow-2xl rounded border border-rule overflow-hidden">
            <div className="panel-header p-5 bg-paper border-b border-rule flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-fail">
                Reject Guide Allocation: Group #{rejectModalGroup.group_no}
              </h3>
              <button
                onClick={() => setRejectModalGroup(null)}
                className="text-draft hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-draft mb-2">
                  Proposed Guide: <span className="font-bold text-ink">{rejectModalGroup.guide_name}</span>
                </p>
                <label className="input-label block text-xs font-bold uppercase tracking-wider text-draft mb-1.5">
                  Rejection Reason / Guidance for Coordinator *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                  placeholder="e.g. Faculty guide capacity exceeded; please reallocate to Prof. Sharma."
                  className="input-field w-full p-2.5 text-sm bg-white border border-rule rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setRejectModalGroup(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !rejectRemark.trim()}
                  className="btn-primary bg-fail hover:bg-fail/90 text-white text-xs disabled:opacity-50"
                >
                  {submitting ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Read-Only Rubric Detail Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="panel bg-white w-full max-w-lg shadow-2xl rounded border border-rule overflow-hidden">
            <div className="panel-header p-5 bg-paper border-b border-rule flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">
                  Evaluation Details: {detailModalItem.student_name}
                </h3>
                <p className="text-xs font-mono text-draft mt-0.5">
                  PRN: {detailModalItem.prn} · Group #{detailModalItem.group_no}
                </p>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-draft hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-paper p-3 rounded border border-rule">
                <div>
                  <span className="text-draft block">Domain / Topic:</span>
                  <span className="font-semibold text-ink">{detailModalItem.domain}</span>
                </div>
                <div>
                  <span className="text-draft block">Guide / Evaluator:</span>
                  <span className="font-semibold text-ink">{detailModalItem.guide_name}</span>
                </div>
                <div>
                  <span className="text-draft block">Status:</span>
                  <span className="font-bold text-ink">{detailModalItem.marks_status}</span>
                </div>
                <div>
                  <span className="text-draft block">Evaluation Date:</span>
                  <span className="font-semibold text-ink">
                    {detailModalItem.evaluation_date ? new Date(detailModalItem.evaluation_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-draft mb-2">Rubric Criteria Marks</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-2 bg-paper/50 rounded border border-rule/50">
                    <span>1. Attendance &amp; Regularity</span>
                    <span className="font-mono font-bold text-navy">{Number(detailModalItem.attendance_marks || 0).toFixed(1)} / 10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 bg-paper/50 rounded border border-rule/50">
                    <span>2. Presentation &amp; Slides</span>
                    <span className="font-mono font-bold text-navy">{Number(detailModalItem.presentation_marks || 0).toFixed(1)} / 10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 bg-paper/50 rounded border border-rule/50">
                    <span>3. Subject Understanding &amp; Technical Depth</span>
                    <span className="font-mono font-bold text-navy">{Number(detailModalItem.subject_understanding_marks || 0).toFixed(1)} / 10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 bg-paper/50 rounded border border-rule/50">
                    <span>4. Publication / Manuscript Quality</span>
                    <span className="font-mono font-bold text-navy">{Number(detailModalItem.publication_marks || 0).toFixed(1)} / 10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 bg-paper/50 rounded border border-rule/50">
                    <span>5. Viva Voce &amp; Technical Defense</span>
                    <span className="font-mono font-bold text-navy">{Number(detailModalItem.viva_marks || 0).toFixed(1)} / 10</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-rule flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-ink">Total Aggregate Score</span>
                  <span className="font-serif font-bold text-xl text-navy">
                    {Number(detailModalItem.total_marks || 0).toFixed(2)} / 50.00
                  </span>
                </div>
              </div>

              {detailModalItem.remarks && (
                <div className="bg-paper p-3 rounded border border-rule text-xs">
                  <span className="font-bold text-ink block mb-1">Faculty Remarks:</span>
                  <p className="text-draft italic">"{detailModalItem.remarks}"</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  className="btn-secondary text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
