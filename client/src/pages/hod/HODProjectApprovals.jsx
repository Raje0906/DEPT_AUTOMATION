import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODProjectApprovals() {
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [pendingApprovals, setPendingApprovals] = useState({ pendingGuides: [], pendingScoreReleases: [], totalPending: 0 });
  const [groups, setGroups] = useState([]);
  const [submittingId, setSubmittingId] = useState(null);

  const fetchApprovalData = async () => {
    setLoading(true);
    try {
      const [pendingRes, groupsRes] = await Promise.all([
        api.get(`/projects/hod/pending-approvals?academic_year=${academicYear}`),
        api.get(`/projects/hod/groups?academic_year=${academicYear}`),
      ]);
      setPendingApprovals(pendingRes.data);
      setGroups(groupsRes.data);
    } catch (err) {
      toast.error('Failed to load pending project approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalData();
  }, [academicYear]);

  const handleConfirmGuide = async (groupId, action) => {
    setSubmittingId(`guide-${groupId}`);
    try {
      const res = await api.post(`/projects/groups/${groupId}/confirm-guide`, { action });
      toast.success(res.data.message);
      fetchApprovalData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process guide confirmation');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleConfirmScoreRelease = async (releaseId, action) => {
    setSubmittingId(`score-${releaseId}`);
    try {
      const res = await api.post('/projects/confirm-score-release', { release_id: releaseId, action });
      toast.success(res.data.message);
      fetchApprovalData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process score release confirmation');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleExportFormResponses = async () => {
    try {
      const res = await api.get(`/projects/export/form-responses?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Topic Preferences form (AY ${academicYear}) (Responses).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Form responses Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export form responses Excel');
    }
  };

  const handleExportGuideAssignments = async () => {
    try {
      const res = await api.get(`/projects/export/guide-assignments?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Guide Assignments (AY ${academicYear}).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Guide assignments Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export guide assignments Excel');
    }
  };

  const handleExportScoreExcel = async () => {
    try {
      const res = await api.get(`/projects/export/score-excel?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Score Report (AY ${academicYear}).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Score Excel downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export score Excel');
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading HOD Project Approval Center...</p>
        </div>
      </div>
    );
  }

  const pendingGuides = pendingApprovals?.pendingGuides || [];
  const pendingScoreReleases = pendingApprovals?.pendingScoreReleases || [];
  const totalPending = pendingApprovals?.totalPending || (pendingGuides.length + pendingScoreReleases.length);

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">BE Project Approvals</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportFormResponses}
            className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>📥</span> Form Responses (Excel)
          </button>
          <button
            type="button"
            onClick={handleExportGuideAssignments}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>📥</span> Guide Assignments (Excel)
          </button>

          <div className="flex items-center gap-2 border-l border-rule pl-3">
            <label className="text-xs font-semibold text-draft">Academic Year:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="input-field py-1 text-xs font-mono font-bold"
            >
              <option value="2026-27">2026-27 (Current)</option>
              <option value="2025-26">2025-26</option>
              <option value="2024-25">2024-25</option>
            </select>
          </div>
        </div>
      </div>


      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-5">
          <span className="text-xs font-mono font-bold text-draft uppercase">Total Pending Approvals</span>
          <p className="font-serif text-3xl font-bold text-navy mt-1">
            {totalPending}
          </p>
        </div>
        <div className="panel p-5">
          <span className="text-xs font-mono font-bold text-draft uppercase">Pending Guide Confirmations</span>
          <p className="font-serif text-3xl font-bold text-navy mt-1">
            {pendingGuides.length}
          </p>
        </div>
        <div className="panel p-5">
          <span className="text-xs font-mono font-bold text-draft uppercase">Pending Score Releases</span>
          <p className="font-serif text-3xl font-bold text-emerald-700 mt-1">
            {pendingScoreReleases.length}
          </p>
        </div>
      </div>

      {/* SECTION 1: Pending Guide Assignments */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-ink">1. Pending Guide Assignment Confirmations</h3>
          </div>
          <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-amber-100 text-amber-900 border border-amber-300">
            {pendingGuides.length} Pending
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Project Domain &amp; 3 Topics</th>
                <th>Students in Group</th>
                <th>Proposed Guide</th>
                <th>Requested By</th>
                <th className="text-right">HOD Confirmation Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingGuides.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-xs text-draft italic">
                    ✓ No pending guide assignments requiring HOD confirmation.
                  </td>
                </tr>
              ) : (
                pendingGuides.map((g) => (
                  <tr key={g.id}>
                    <td className="font-mono text-sm font-bold text-navy">{g.group_code}</td>
                    <td className="max-w-xs space-y-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 inline-block">
                        Domain: {g.domain || 'Not Specified'}
                      </span>
                      <div className="text-xs space-y-0.5">
                        <div className="font-semibold text-ink">1. {g.title || 'Not specified'}</div>
                        {g.title_2 && <div className="text-draft text-[11px]">2. {g.title_2}</div>}
                        {g.title_3 && <div className="text-draft text-[11px]">3. {g.title_3}</div>}
                      </div>
                    </td>
                    <td className="text-xs max-w-xs">
                      {g.members && g.members.length > 0 ? (
                        <div className="space-y-0.5">
                          {g.members.map((m, mIdx) => (
                            <div key={mIdx} className="text-ink text-[11px]">
                              {mIdx + 1}. {m.name} {m.is_leader && <strong className="text-amber-800 text-[10px]">(Leader)</strong>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-draft italic">No roster</span>
                      )}
                    </td>
                    <td>
                      {g.proposed_guide_name ? (
                        <div>
                          <div className="font-bold text-emerald-800 text-xs">{g.proposed_guide_name}</div>
                          <div className="text-[10px] text-draft">{g.proposed_guide_designation}</div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          Unassign Guide Request
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-draft">{g.requested_by_name || 'BE Project Coordinator'}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={submittingId === `guide-${g.id}`}
                          onClick={() => handleConfirmGuide(g.id, 'APPROVE')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                        >
                          ✓ Confirm &amp; Activate
                        </button>
                        <button
                          disabled={submittingId === `guide-${g.id}`}
                          onClick={() => handleConfirmGuide(g.id, 'REJECT')}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Pending Score Release Requests */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-ink">2. Pending Score Release Requests</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportScoreExcel}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <span>📊</span> Export Score Excel ↓
            </button>
            <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-amber-100 text-amber-900 border border-amber-300">
              {pendingScoreReleases.length} Pending
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th>Evaluation Stage</th>
                <th>Scope</th>
                <th>Requested By</th>
                <th>Requested Date</th>
                <th className="text-right">HOD Confirmation Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingScoreReleases.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-xs text-draft italic">
                    ✓ No pending score release requests requiring HOD confirmation.
                  </td>
                </tr>
              ) : (
                pendingScoreReleases.map((sr) => (
                  <tr key={sr.release_id}>
                    <td className="font-bold text-sm text-ink">{sr.stage_name}</td>
                    <td className="font-mono text-xs font-bold text-navy">{sr.group_code || 'All Stage Groups (Stage-Wide)'}</td>
                    <td className="text-xs text-draft">{sr.requested_by_name || 'BE Project Coordinator'}</td>
                    <td className="text-xs text-draft">{new Date(sr.requested_at).toLocaleString()}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={submittingId === `score-${sr.release_id}`}
                          onClick={() => handleConfirmScoreRelease(sr.release_id, 'APPROVE')}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                        >
                          ✓ Confirm &amp; Publish Scores
                        </button>
                        <button
                          disabled={submittingId === `score-${sr.release_id}`}
                          onClick={() => handleConfirmScoreRelease(sr.release_id, 'REJECT')}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                        >
                          ✕ Reject Request
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Summary Roster of Active BE Project Groups */}
      <div className="panel">
        <div className="panel-header border-b border-rule pb-3">
          <h3 className="font-serif text-lg font-bold text-ink">Department BE Project Groups Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Title &amp; Domain</th>
                <th>Guide Status</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono text-sm font-bold text-navy">{g.group_code}</td>
                  <td className="max-w-xs">
                    <div className="font-semibold text-ink text-sm">{g.title}</div>
                    <div className="text-xs text-draft">{g.domain}</div>
                  </td>
                  <td>
                    {g.guide_approval_status === 'PENDING_HOD_APPROVAL' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Proposed: {g.proposed_guide_name || 'Clear Guide'} (Pending Confirmation)
                      </span>
                    ) : g.guide_name ? (
                      <div>
                        <div className="font-bold text-emerald-800 text-xs">{g.guide_name}</div>
                        <div className="text-[10px] text-draft">{g.guide_designation}</div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${g.status === 'ACTIVE' ? 'badge-published' : 'badge-draft'}`}>
                      {g.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
