import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ISSUE_TYPE_LABELS = {
  MISSING_DOMAIN: 'Missing Domain',
  GROUP_SIZE: 'Group Size',
  MISSING_FIELD: 'Missing Field',
  DUPLICATE_PRN_WITHIN: 'Duplicate PRN (within group)',
  DUPLICATE_PRN_ACROSS: 'Duplicate PRN (across groups)',
};

const StepBar = ({ current }) => {
  const steps = ['Upload', 'Validate', 'Assign', 'Review', 'Export'];
  return (
    <ol className="flex items-center gap-0 mb-8 select-none">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-[var(--navy)] text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--rule)] text-[var(--ink)]/40'}`}>
              {done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-6 h-px bg-[var(--rule)] mx-1" />}
          </li>
        );
      })}
    </ol>
  );
};

export default function SeminarUpload() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [session, setSession]       = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [overrides, setOverrides]   = useState(new Set());
  const [dragging, setDragging]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [committing, setCommitting] = useState(false);
  const [loading, setLoading]       = useState(true);

  const loadState = useCallback(async () => {
    try {
      const [sessRes, prRes, ovRes] = await Promise.allSettled([
        api.get(`/seminar/sessions/${id}`),
        api.get(`/seminar/sessions/${id}/parse-result`),
        api.get(`/seminar/sessions/${id}/overrides`),
      ]);
      if (sessRes.status === 'fulfilled') setSession(sessRes.value.data.session);
      if (prRes.status === 'fulfilled')   setParseResult(prRes.value.data);
      if (ovRes.status === 'fulfilled')   setOverrides(new Set(ovRes.value.data.overrides.map(o => o.issue_key)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadState(); }, [loadState]);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) return toast.error('Only .xlsx, .xls, or .csv files are accepted');

    // Warn if re-uploading
    if (parseResult) {
      if (!window.confirm('A file has already been uploaded for this session. Re-uploading will replace the current parse results. Continue?')) return;
    }

    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post(`/seminar/sessions/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Parsed ${data.groupCount} groups`);
      await loadState();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAcknowledge = async (issue) => {
    try {
      await api.post(`/seminar/sessions/${id}/override-issue`, { issueKey: issue.key, note: `Acknowledged by coordinator` });
      setOverrides(prev => new Set([...prev, issue.key]));
      toast.success('Issue acknowledged');
    } catch { toast.error('Failed to acknowledge'); }
  };

  const handleCommit = async () => {
    const issues = parseResult?.result?.issues || [];
    const errorCount = issues.filter(i => i.severity === 'error' && !overrides.has(i.key)).length;
    if (errorCount > 0) return toast.error(`${errorCount} unacknowledged error(s) must be resolved first`);
    if (!window.confirm('Save parsed groups to database and proceed to guide assignment?')) return;
    setCommitting(true);
    try {
      await api.post(`/seminar/sessions/${id}/commit`);
      toast.success('Groups saved — proceeding to guide assignment');
      navigate(`/faculty/seminar/${id}/assign`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const issues = parseResult?.result?.issues || [];
  const errorCount = issues.filter(i => i.severity === 'error' && !overrides.has(i.key)).length;

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/faculty/seminar" className="text-xs text-[var(--ink)]/40 hover:text-[var(--navy)] transition-colors">Sessions</Link>
        <span className="text-xs text-[var(--ink)]/30">/</span>
        <span className="text-xs text-[var(--ink)]/60 truncate">{session?.name || `Session ${id}`}</span>
      </div>
      <h1 className="text-2xl font-bold text-[var(--navy)] mb-6">Upload & Validate</h1>
      <StepBar current={parseResult ? 1 : 0} />

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${dragging ? 'border-[var(--navy)] bg-blue-50' : 'border-[var(--rule)] hover:border-[var(--navy)]/40 hover:bg-[var(--paper)]'}`}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        {uploading ? (
          <p className="text-sm text-[var(--navy)] font-medium">Uploading & parsing…</p>
        ) : (
          <>
            <svg className="w-8 h-8 mx-auto text-[var(--ink)]/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
            <p className="text-sm font-medium text-[var(--ink)]/60">Drop your Google Form export here</p>
            <p className="text-xs text-[var(--ink)]/30 mt-1">XLSX, XLS, or CSV · Max 10 MB</p>
            {parseResult && <p className="mt-2 text-xs text-[var(--ink)]/40">Previously uploaded: <span className="font-mono">{parseResult.filename}</span></p>}
          </>
        )}
      </div>

      {/* Parse result */}
      {parseResult?.result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[var(--rule)] rounded-lg p-4">
              <p className="text-2xl font-bold text-[var(--navy)]">{parseResult.result.groupCount}</p>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Groups parsed</p>
            </div>
            <div className="bg-white border border-[var(--rule)] rounded-lg p-4">
              <p className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{errorCount}</p>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Unresolved errors</p>
            </div>
            <div className="bg-white border border-[var(--rule)] rounded-lg p-4">
              <p className="text-2xl font-bold text-[var(--ink)]">{overrides.size}</p>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Acknowledged issues</p>
            </div>
          </div>

          {/* Issues list */}
          {issues.length > 0 && (
            <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--ink)]">Validation Issues</h3>
                <span className="text-xs text-[var(--ink)]/40">{issues.length} total</span>
              </div>
              <div className="divide-y divide-[var(--rule)]">
                {issues.map(issue => {
                  const acked = overrides.has(issue.key);
                  return (
                    <div key={issue.key} className={`px-4 py-3 flex items-start justify-between gap-4 ${acked ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${acked ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'}`}>
                            {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                          </span>
                          <span className="text-xs text-[var(--ink)]/40">Group {issue.groupNo} · Row {issue.rowIndex + 1}</span>
                        </div>
                        <p className="text-xs text-[var(--ink)]/80 leading-relaxed">{issue.message}</p>
                      </div>
                      {!acked ? (
                        <button
                          onClick={() => handleAcknowledge(issue)}
                          className="flex-shrink-0 px-3 py-1 text-xs font-medium border border-amber-300 text-amber-700 rounded hover:bg-amber-50 transition-colors"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="flex-shrink-0 px-3 py-1 text-xs font-medium text-emerald-600">✓ Acknowledged</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {issues.length === 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <p className="text-sm text-emerald-700 font-medium">No validation issues — all groups look good.</p>
            </div>
          )}

          {/* Commit button */}
          <div className="flex justify-end pt-2">
            <button
              id="btn-commit"
              onClick={handleCommit}
              disabled={committing || errorCount > 0}
              className="px-5 py-2.5 bg-[var(--navy)] text-white text-sm font-medium rounded-md hover:bg-[#2a3d7a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {committing ? 'Saving…' : errorCount > 0 ? `Resolve ${errorCount} error(s) first` : 'Save Groups & Assign Guides →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
