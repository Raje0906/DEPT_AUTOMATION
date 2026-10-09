import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const StepBar = ({ current = 2 }) => {
  const steps = ['1. Submissions & Validation', '2. Guide Assignment', '3. Review & Final Export'];
  return (
    <ol className="flex items-center gap-0 mb-6 select-none overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center shrink-0">
            <div className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              active ? 'bg-[var(--navy)] text-white shadow-xs' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-[var(--ink)]/50'
            }`}>
              {done && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-[var(--rule)] mx-2" />}
          </li>
        );
      })}
    </ol>
  );
};

export default function SeminarReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const load = useCallback(async () => {
    try {
      const [sR, gR] = await Promise.all([
        api.get(`/seminar/sessions/${id}`),
        api.get(`/seminar/sessions/${id}/assignments`),
      ]);
      setSession(sR.data.session);
      setGroups(gR.data.groups || []);
    } catch { toast.error('Failed to load review data'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/seminar/sessions/${id}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="(.+)"/);
      a.download = match ? match[1] : `GroupList_Session${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setDownloading(false); }
  };

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top-Left Back Button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          id="btn-back-step"
          onClick={() => navigate(`/faculty/seminar/${id}/assign`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--navy)] bg-white hover:bg-slate-100 border border-[var(--rule)] rounded-md transition-colors focus:outline-hidden focus:ring-2 focus:ring-[var(--navy)] shadow-xs"
          aria-label="Back to Step 2: Guide Assignment"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-[var(--ink)]/50">
          <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">Sessions</Link>
          <span>/</span>
          <span className="text-[var(--ink)]/80 font-medium truncate">{session?.name}</span>
          <span>/</span>
          <span>Step 3: Review &amp; Final Export</span>
        </div>
      </div>

      <StepBar current={2} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">Final Group List & Marks Entry</h1>
          <p className="text-sm text-[var(--ink)]/50 mt-0.5">{session?.batch} · {session?.academic_year} · {groups.length} groups</p>
        </div>
        <div className="flex gap-3">
          <button
            id="btn-export"
            onClick={handleExport}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--navy)] text-white text-sm font-medium rounded-md hover:bg-[#2a3d7a] disabled:opacity-60 transition-colors shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            {downloading ? 'Downloading…' : (session?.status === 'PUBLISHED' ? 'Export Final XLSX' : 'Export Draft XLSX')}
          </button>
        </div>
      </div>

      {/* Institution header preview */}
      <div className="bg-[#EEF0F7] border border-[var(--rule)] rounded-t-xl px-6 py-3 text-center">
        <p className="text-sm font-bold text-[var(--navy)]">MES Wadia College of Engineering, Pune</p>
        <p className="text-xs text-[var(--ink)]/60">Department of Computer Engineering</p>
        <p className="text-xs text-[var(--ink)]/80 font-medium mt-0.5">{session?.name} — Guide Assignment List & Evaluation</p>
      </div>

      {/* Group table */}
      <div className="border border-t-0 border-[var(--rule)] rounded-b-xl overflow-hidden bg-white">
        <table className="result-table w-full text-xs">
          <thead className="bg-[#EEF0F7]">
            <tr>
              <th className="px-3 py-2 text-left w-16">Group No.</th>
              <th className="px-3 py-2 text-left">Domain</th>
              <th className="px-3 py-2 text-left">Guide</th>
              <th className="px-3 py-2 text-left">Student Name</th>
              <th className="px-3 py-2 text-left">PRN</th>
              <th className="px-3 py-2 text-left">Topic 1</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => {
              const members = g.members || [];
              return (
                <React.Fragment key={g.id}>
                  {members.map((m, mi) => (
                    <tr key={`${g.id}-${mi}`} className={gi % 2 === 0 ? 'bg-white' : 'bg-[var(--paper)]/40'}>
                      {mi === 0 && (
                        <>
                          <td rowSpan={members.length} className="px-3 py-2 font-mono font-bold text-[var(--navy)] border-b border-[var(--rule)] align-middle text-center bg-[#EEF0F7]/60">
                            {g.group_no}
                          </td>
                          <td rowSpan={members.length} className="px-3 py-2 text-[var(--ink)] border-b border-[var(--rule)] align-middle max-w-[160px]">
                            {g.domain}
                          </td>
                          <td rowSpan={members.length} className="px-3 py-2 text-[var(--ink)] border-b border-[var(--rule)] align-middle">
                            {g.guide_name || <span className="text-amber-600 font-medium">Unassigned</span>}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{m.name}</td>
                      <td className="px-3 py-2 font-mono text-[var(--ink)]/70">{m.prn}</td>
                      <td className="px-3 py-2 text-[var(--ink)]/60 max-w-[180px] truncate">{m.topic1}</td>
                      {mi === 0 && (
                        <td rowSpan={members.length} className="px-3 py-2 text-right border-b border-[var(--rule)] align-middle">
                          {g.status === 'APPROVED' ? (
                            <Link
                              to={`/faculty/seminar/evaluate/${g.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                              Evaluation
                            </Link>
                          ) : (
                            <span className="text-[10px] text-[var(--ink)]/50 italic">Not Approved</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {/* Blank separator */}
                  <tr><td colSpan={7} className="h-2 bg-[var(--paper)]" /></tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
