import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const MARKS_STATUS = {
  NOT_STARTED: { label: 'Not Started', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  DRAFT: { label: 'Draft', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  SUBMITTED: { label: 'Submitted', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-600 animate-pulse' },
  FINALIZED: { label: 'Finalized', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-600' },
};

export default function SeminarMarksOverview() {
  const { id: sessionId } = useParams();
  const [overview, setOverview] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ovRes, sessRes] = await Promise.all([
        api.get(`/seminar/sessions/${sessionId}/marks-overview`),
        api.get(`/seminar/sessions/${sessionId}`),
      ]);
      setOverview(ovRes.data.overview || []);
      setSession(sessRes.data.session || null);
    } catch (err) {
      toast.error('Failed to load marks overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sessionId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/seminar/sessions/${sessionId}/export-marks`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Seminar_${sessionId}_Official_Marksheet.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Marksheet exported successfully');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const totalGroups = overview.length;
  const approvedGroups = overview.filter(g => g.approval_status === 'APPROVED').length;
  const evaluatedGroups = overview.filter(g => g.marks_status === 'SUBMITTED' || g.marks_status === 'FINALIZED').length;
  const draftGroups = overview.filter(g => g.marks_status === 'DRAFT').length;
  const notStartedGroups = overview.filter(g => g.marks_status === 'NOT_STARTED').length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--ink)]/40">Loading marks overview…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--rule)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              to="/faculty/seminar"
              className="text-[var(--ink)]/50 hover:text-[var(--navy)] text-xs font-medium transition-colors flex items-center gap-1"
            >
              ← Sessions
            </Link>
            <span className="text-[var(--ink)]/20">/</span>
            <span className="text-xs text-[var(--ink)]/50">{session?.name || `Session ${sessionId}`}</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)] font-serif">Marks Overview & Control</h1>
          <p className="text-sm text-[var(--ink)]/50 mt-1">
            Monitor evaluation progress, track guide submissions, and export the official marksheet.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--navy)] text-white text-xs font-bold rounded-lg hover:bg-[var(--navy)]/90 disabled:opacity-50 transition-colors shadow-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exporting ? 'Exporting…' : 'Export Official Marksheet'}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Groups', value: totalGroups, color: 'text-[var(--navy)]', bg: 'bg-[var(--paper)]' },
          { label: 'HOD Approved', value: approvedGroups, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Evaluated', value: evaluatedGroups, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Pending Evaluation', value: notStartedGroups + draftGroups, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border border-[var(--rule)] p-4 ${stat.bg}`}>
            <p className="text-xs text-[var(--ink)]/50 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {totalGroups > 0 && (
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--navy)]">Overall Evaluation Progress</span>
            <span className="text-xs font-mono text-[var(--ink)]/60">
              {evaluatedGroups}/{approvedGroups} approved groups evaluated
            </span>
          </div>
          <div className="h-2 bg-[var(--paper)] rounded-full overflow-hidden border border-[var(--rule)]">
            <div
              className="h-full bg-emerald-500 transition-all duration-700 rounded-full"
              style={{ width: `${approvedGroups > 0 ? (evaluatedGroups / approvedGroups) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />Submitted</span>
            <span className="flex items-center gap-1 text-[10px] text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-400" />Draft</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-400" />Not Started</span>
          </div>
        </div>
      )}

      {/* Marks Table */}
      <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-[var(--rule)] bg-[#EEF0F7]">
          <h2 className="text-sm font-bold text-[var(--navy)]">Group-wise Evaluation Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--paper)] border-b border-[var(--rule)] text-xs font-semibold text-[var(--ink)]/60">
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Domain</th>
                <th className="px-4 py-3 text-left">Seminar Guide</th>
                <th className="px-4 py-3 text-center">Approval</th>
                <th className="px-4 py-3 text-center">Evaluation Status</th>
                <th className="px-4 py-3 text-center">Progress</th>
                <th className="px-4 py-3 text-center">Avg Marks</th>
                <th className="px-4 py-3 text-center">Submitted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {overview.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[var(--ink)]/40 text-sm">
                    No groups found in this session.
                  </td>
                </tr>
              ) : (
                overview.map(g => {
                  const mStatus = MARKS_STATUS[g.marks_status] || MARKS_STATUS.NOT_STARTED;
                  const evalPct = g.member_count > 0 ? (g.evaluated_count / g.member_count) * 100 : 0;

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[var(--navy)] text-sm">#{g.group_no}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ink)] max-w-[180px] truncate">{g.domain}</td>
                      <td className="px-4 py-3 text-xs text-[var(--ink)]/70">{g.guide_name || 'Unassigned'}</td>
                      <td className="px-4 py-3 text-center">
                        {g.approval_status === 'APPROVED' ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Approved</span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">{g.approval_status?.replace(/_/g, ' ')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${mStatus.bg} ${mStatus.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${mStatus.dot}`} />
                          {mStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-16 h-1.5 bg-[var(--paper)] rounded-full overflow-hidden border border-[var(--rule)]">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all"
                              style={{ width: `${evalPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[var(--ink)]/50">{g.evaluated_count}/{g.member_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-sm font-bold text-[var(--navy)]">
                          {g.avg_marks != null ? `${g.avg_marks}` : '—'}
                          {g.avg_marks != null && <span className="text-xs font-normal text-[var(--ink)]/30"> /50</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-[var(--ink)]/60">
                        {g.submitted_by_name ? (
                          <div>
                            <p className="font-medium text-[var(--ink)]/80">{g.submitted_by_name}</p>
                            {g.submitted_at && (
                              <p className="text-[10px] text-[var(--ink)]/40">
                                {new Date(g.submitted_at).toLocaleDateString('en-IN')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--ink)]/30">—</span>
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
    </div>
  );
}
