import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMagazine, MAGAZINE_SECTIONS } from '../../contexts/MagazineContext';
import toast from 'react-hot-toast';

export default function HODMagazineApprovals() {
  const navigate = useNavigate();
  const {
    magazines,
    approveMagazine,
    publishMagazine,
    requestChangesMagazine,
  } = useMagazine();

  const [activeTab, setActiveTab] = useState('All');
  const [rejectModalMag, setRejectModalMag] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const pendingList = magazines.filter(m => m.status === 'Under Review');
  const approvedList = magazines.filter(m => m.status === 'Approved');
  const publishedList = magazines.filter(m => m.status === 'Published');
  const draftList = magazines.filter(m => m.status === 'Draft');

  const filteredMagazines = activeTab === 'All'
    ? magazines
    : magazines.filter(m => m.status === activeTab);

  const handleApprove = (mag) => {
    approveMagazine(mag.id);
    toast.success(`Magazine "${mag.title}" (Issue ${mag.issueNumber || ''}) has been approved.`);
  };

  const handlePublish = (mag) => {
    publishMagazine(mag.id);
    toast.success(`Magazine "${mag.title}" (Issue ${mag.issueNumber || ''}) is now published.`);
  };

  const handleSendBack = () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason or revision note for the faculty.');
      return;
    }
    setSubmittingAction(true);
    requestChangesMagazine(rejectModalMag.id, rejectReason.trim());
    toast.success(`Magazine sent back to draft with revision remarks.`);
    setSubmittingAction(false);
    setRejectModalMag(null);
    setRejectReason('');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Under Review':
        return <span className="badge-submitted">Under Review</span>;
      case 'Approved':
        return <span className="badge-approved">Approved</span>;
      case 'Published':
        return <span className="badge-published">Published</span>;
      case 'Draft':
        return <span className="badge-draft">Draft</span>;
      case 'Archived':
        return <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300 font-semibold">Archived</span>;
      default:
        return <span className="badge-draft">{status}</span>;
    }
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-draft uppercase tracking-widest mb-1">Department Governance</p>
          <h1 className="font-serif text-3xl font-bold text-ink">Department Magazine Approvals</h1>
          <p className="text-sm text-draft mt-1 font-medium">
            Review submissions from faculty, inspect draft content, approve, or request revisions.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 bg-white border rounded-sm ${pendingList.length > 0 ? 'border-amber-400 bg-amber-50/20' : 'border-rule'}`}>
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pending Review</p>
          <p className={`font-serif text-3xl font-bold mt-1 ${pendingList.length > 0 ? 'text-amber-600' : 'text-ink'}`}>
            {pendingList.length}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Awaiting HOD decision</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Approved</p>
          <p className="font-serif text-3xl font-bold text-blue-800 mt-1">{approvedList.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">Ready for publication</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Published</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">{publishedList.length}</p>
          <p className="text-xs text-pass mt-1 font-medium">Live on department website</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Issues</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{magazines.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">All department editions</p>
        </div>
      </div>

      {/* ── Action Required: Pending Approval Section ────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-serif text-xl font-bold text-ink">Action Required: Submitted for Approval</h2>
          {pendingList.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {pendingList.length} Pending
            </span>
          )}
        </div>

        {pendingList.length === 0 ? (
          <div className="bg-white border border-rule rounded-sm p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink">No magazines currently awaiting review</p>
            <p className="text-xs text-draft mt-1">When faculty submits a magazine for review, it will appear here for your approval.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingList.map(mag => {
              const completedSections = Object.values(mag.sections || {}).filter(s => s.completed).length;
              return (
                <div key={mag.id} className="bg-white border-2 border-amber-300/80 rounded-sm p-6 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rule">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-serif text-xl font-bold text-ink">{mag.title}</span>
                        {mag.issueNumber && (
                          <span className="text-xs font-bold text-navy bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            Issue {mag.issueNumber}
                          </span>
                        )}
                        <span className="badge-submitted">Under Review</span>
                      </div>
                      <p className="text-xs text-draft">
                        Academic Year: <strong className="text-ink">{mag.academicYear || '2025–26'}</strong> · Semester: <strong className="text-ink">{mag.semester || 'Annual'}</strong> · Period: {mag.period || 'Current'}
                      </p>
                      {mag.submittedAt && (
                        <p className="text-[11px] text-draft mt-0.5">
                          Submitted on {new Date(mag.submittedAt).toLocaleDateString()} at {new Date(mag.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => navigate(`/hod/magazines/preview/${mag.id}`)}
                        className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Review & Preview
                      </button>

                      <button
                        onClick={() => handleApprove(mag)}
                        className="btn-primary text-xs py-2 px-3 bg-emerald-700 hover:bg-emerald-800 border-emerald-800 flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Approve Magazine
                      </button>

                      <button
                        onClick={() => handlePublish(mag)}
                        className="btn-primary text-xs py-2 px-3 bg-navy hover:bg-[#162142] flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        Publish Directly
                      </button>

                      <button
                        onClick={() => {
                          setRejectModalMag(mag);
                          setRejectReason('');
                        }}
                        className="text-xs py-2 px-3 rounded-sm border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-medium transition-colors"
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>

                  {/* Section summary */}
                  <div className="pt-3">
                    <p className="text-xs font-semibold text-draft mb-2">Sections Summary:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MAGAZINE_SECTIONS.map(sec => {
                        const isDone = mag.sections?.[sec.id]?.completed;
                        return (
                          <span
                            key={sec.id}
                            className={`text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                              isDone
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {sec.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── All Department Magazines Table ───────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-bold text-ink">All Department Magazines</h2>
          {/* Filter Pills */}
          <div className="flex gap-1.5 flex-wrap">
            {['All', 'Under Review', 'Approved', 'Published', 'Draft'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${
                  activeTab === tab
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white border-rule text-draft hover:border-navy'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="result-table w-full text-left">
              <thead>
                <tr>
                  <th>Title & Issue</th>
                  <th>Academic Year</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Remarks / Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMagazines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-draft">
                      No magazines found for filter "{activeTab}".
                    </td>
                  </tr>
                ) : (
                  filteredMagazines.map(mag => (
                    <tr key={mag.id}>
                      <td>
                        <div>
                          <span className="font-medium text-ink">{mag.title}</span>
                          {mag.issueNumber && (
                            <span className="ml-2 text-xs font-mono text-draft">
                              Issue {mag.issueNumber}
                            </span>
                          )}
                          <p className="text-[11px] font-mono text-draft">{mag.id}</p>
                        </div>
                      </td>
                      <td className="text-xs text-ink">{mag.academicYear || '—'}</td>
                      <td className="text-xs text-draft">{mag.period || '—'}</td>
                      <td>{getStatusBadge(mag.status)}</td>
                      <td className="max-w-xs">
                        {mag.reviewComment ? (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-1.5 rounded line-clamp-2" title={mag.reviewComment}>
                            <strong>Remark:</strong> {mag.reviewComment}
                          </p>
                        ) : mag.publishedDate ? (
                          <span className="text-xs text-pass">Published {mag.publishedDate}</span>
                        ) : (
                          <span className="text-xs text-draft">—</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => navigate(`/hod/magazines/preview/${mag.id}`)}
                            className="text-xs text-navy hover:underline font-semibold"
                          >
                            Preview
                          </button>
                          {mag.status === 'Under Review' && (
                            <>
                              <span className="text-rule">|</span>
                              <button
                                onClick={() => handleApprove(mag)}
                                className="text-xs text-emerald-700 hover:underline font-semibold"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {mag.status === 'Approved' && (
                            <>
                              <span className="text-rule">|</span>
                              <button
                                onClick={() => handlePublish(mag)}
                                className="text-xs text-navy hover:underline font-semibold"
                              >
                                Publish
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Request Changes Modal ─────────────────────────────────────────── */}
      {rejectModalMag && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-serif text-xl font-bold text-ink">Request Revision</h3>
              <p className="text-xs text-draft mt-1">
                Send magazine <strong>{rejectModalMag.title} (Issue {rejectModalMag.issueNumber})</strong> back to faculty with remarks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wide mb-1">
                Revision Notes & Feedback
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Explain what needs to be changed (e.g., Update topper rankings, revise principal message, check publication list...)"
                className="w-full text-xs p-2.5 border border-rule rounded-sm focus:outline-none focus:border-navy"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectModalMag(null)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSendBack}
                className="btn-primary text-xs bg-red-700 hover:bg-red-800 border-red-800"
              >
                Send Back for Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
