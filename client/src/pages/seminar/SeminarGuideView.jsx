import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const APPROVAL_STATUS_BADGE = {
  APPROVED: { label: 'HOD Approved', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  AWAITING_HOD_APPROVAL: { label: 'Awaiting HOD', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', dot: 'bg-amber-400 animate-pulse' },
  PENDING_GUIDE_ASSIGNMENT: { label: 'Pending', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const EVAL_STATUS_BADGE = {
  NOT_STARTED: { label: 'Not Evaluated', bg: 'bg-slate-100', text: 'text-slate-500' },
  DRAFT: { label: 'Draft Saved', bg: 'bg-amber-100', text: 'text-amber-700' },
  SUBMITTED: { label: 'Submitted', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  FINALIZED: { label: 'Finalized', bg: 'bg-blue-100', text: 'text-blue-700' },
};

export default function SeminarGuideView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);

  useEffect(() => {
    api.get('/seminar/my-groups')
      .then(r => setGroups(r.data.groups || []))
      .catch(() => toast.error('Failed to load your assigned seminar groups'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--ink)]/40">Loading assigned groups…</p>
        </div>
      </div>
    );
  }

  // Group by session
  const sessions = [];
  const seen = new Set();
  for (const g of groups) {
    if (!seen.has(g.session_name)) {
      seen.add(g.session_name);
      sessions.push(g.session_name);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--rule)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[var(--navy)] text-white">Guide</span>
            <span className="text-xs text-[var(--ink)]/40">{user?.name}</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-[var(--navy)]">My Assigned Seminar Groups</h1>
          <p className="text-sm text-[var(--ink)]/50 mt-1">
            Groups assigned to you by the Seminar Coordinator and approved by the HOD. Evaluate each group after conducting the seminar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {groups.length > 0 && (
            <div className="bg-[var(--paper)] border border-[var(--rule)] rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-[var(--ink)]/50">Total Groups</p>
              <p className="text-xl font-bold text-[var(--navy)]">{groups.length}</p>
            </div>
          )}
          {groups.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-emerald-700">Evaluated</p>
              <p className="text-xl font-bold text-emerald-800">
                {groups.filter(g => g.evaluation_status === 'SUBMITTED' || g.evaluation_status === 'FINALIZED').length}
              </p>
            </div>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--rule)] rounded-xl">
          <svg className="w-12 h-12 mx-auto text-[var(--ink)]/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm font-medium text-[var(--ink)]/50">No HOD-approved seminar groups assigned to you yet.</p>
          <p className="text-xs text-[var(--ink)]/30 mt-1">Groups will appear here once the Seminar Coordinator assigns them and the HOD approves.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sessions.map(sessionName => {
            const sessionGroups = groups.filter(g => g.session_name === sessionName);
            const meta = sessionGroups[0];
            return (
              <div key={sessionName}>
                {/* Session Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-[var(--rule)]" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EEF0F7] rounded-full border border-[var(--rule)]">
                    <svg className="w-3.5 h-3.5 text-[var(--navy)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                    <span className="text-xs font-bold text-[var(--navy)]">{sessionName}</span>
                    <span className="text-[11px] text-[var(--ink)]/50">{meta?.academic_year} · Batch {meta?.batch}</span>
                  </div>
                  <div className="h-px flex-1 bg-[var(--rule)]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessionGroups.map(g => {
                    const approvalBadge = APPROVAL_STATUS_BADGE[g.approval_status] || APPROVAL_STATUS_BADGE.PENDING_GUIDE_ASSIGNMENT;
                    const evalBadge = EVAL_STATUS_BADGE[g.evaluation_status] || EVAL_STATUS_BADGE.NOT_STARTED;
                    const isExpanded = expandedGroup === g.id;
                    const canEvaluate = g.approval_status === 'APPROVED';

                    return (
                      <div
                        key={g.id}
                        className="bg-white border border-[var(--rule)] rounded-xl shadow-xs overflow-hidden hover:shadow-sm transition-shadow"
                      >
                        {/* Card Header */}
                        <div className="px-4 py-3.5 bg-[#F8FAFC] border-b border-[var(--rule)] flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-[var(--navy)] text-sm">Group #{g.group_no}</span>
                              {/* Approval Status */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${approvalBadge.bg} ${approvalBadge.border} ${approvalBadge.text} border`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${approvalBadge.dot}`} />
                                {approvalBadge.label}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--ink)]/60 truncate max-w-[240px]">{g.domain}</p>
                          </div>

                          {/* Evaluation status pill */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${evalBadge.bg} ${evalBadge.text}`}>
                            {evalBadge.label}
                          </span>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          {/* Average marks if evaluated */}
                          {g.marks_count > 0 && (
                            <div className="flex items-center gap-3 p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                              <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                              </svg>
                              <div>
                                <p className="text-[10px] text-blue-700 font-semibold">Average Score</p>
                                <p className="text-sm font-bold text-blue-900 font-mono">{g.avg_marks ?? '-'} <span className="font-normal text-blue-700/60">/ 50</span></p>
                              </div>
                              <div className="ml-auto text-right">
                                <p className="text-[10px] text-blue-700">Evaluated</p>
                                <p className="text-sm font-bold text-blue-900">{g.marks_count} students</p>
                              </div>
                            </div>
                          )}

                          {/* Members preview (collapsed) */}
                          <div>
                            <button
                              onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                              className="w-full flex items-center justify-between text-xs font-semibold text-[var(--navy)] hover:text-[var(--navy)]/70 py-1 transition-colors"
                            >
                              <span>{g.members?.length || 0} Students in Group</span>
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)]/60 font-semibold">
                                      <th className="px-3 py-1.5 text-left">Name</th>
                                      <th className="px-3 py-1.5 text-left">PRN</th>
                                      <th className="px-3 py-1.5 text-left">Div</th>
                                      <th className="px-3 py-1.5 text-left">Topic 1</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--rule)]">
                                    {(g.members || []).map((m, mi) => (
                                      <tr key={mi} className={`${m.is_leader ? 'bg-blue-50/40' : ''}`}>
                                        <td className="px-3 py-1.5 font-medium text-[var(--ink)]">
                                          {m.name}
                                          {m.is_leader && (
                                            <span className="ml-1.5 text-[9px] bg-[var(--navy)] text-white px-1.5 py-0.5 rounded font-bold">Leader</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-[var(--ink)]/70">{m.prn}</td>
                                        <td className="px-3 py-1.5 text-[var(--ink)]/60">{m.division}</td>
                                        <td className="px-3 py-1.5 text-[var(--ink)]/60 max-w-[140px] truncate">{m.topic1}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          {canEvaluate ? (
                            <Link
                              to={`/faculty/seminar/evaluate/${g.id}`}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--navy)] text-white text-xs font-bold rounded-lg hover:bg-[var(--navy)]/90 transition-colors shadow-sm"
                            >
                              {g.evaluation_status === 'SUBMITTED' ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  View Submitted Evaluation
                                </>
                              ) : g.evaluation_status === 'DRAFT' ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                  </svg>
                                  Continue Evaluation
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                  Start Evaluation
                                </>
                              )}
                            </Link>
                          ) : (
                            <div className="w-full text-center py-2 px-4 bg-[var(--paper)] text-[var(--ink)]/40 text-xs rounded-lg border border-dashed border-[var(--rule)]">
                              Awaiting HOD approval before evaluation can proceed
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
