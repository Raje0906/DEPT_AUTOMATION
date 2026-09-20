import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_COLORS = {
  DRAFT: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-400', label: 'Draft — Not Submitted' },
  SUBMITTED: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Finalized & Submitted' },
  FINALIZED: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Finalized' },
  NOT_STARTED: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Not Started' },
};

function ScoreBadge({ value, max }) {
  const numVal = Number(value ?? 0);
  const pct = max > 0 ? (numVal / max) : 0;
  const color = pct >= 0.8 ? 'text-emerald-700' : pct >= 0.5 ? 'text-amber-700' : 'text-red-600';
  return (
    <span className={`font-mono font-bold text-sm ${color}`}>
      {numVal.toFixed(2)} <span className="text-[var(--ink)]/30 font-normal">/ {max.toFixed(2)}</span>
    </span>
  );
}

export default function SeminarEvaluation() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [data, setData] = useState(null); // { group, members, marks, rubrics, isLocked, canEdit, canUnlock, userRole }
  const [marksInput, setMarksInput] = useState({}); // { [prn]: { attendance_marks, presentation_marks, subject_understanding_marks, publication_marks, viva_marks, remarks } }
  const [overallRemarks, setOverallRemarks] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/seminar/groups/${groupId}/evaluation`);
      const d = res.data;
      setData(d);

      // Initialize marks input from existing marks
      const init = {};
      for (const m of d.members) {
        const existing = d.marks.find(mk => mk.prn === m.prn);
        init[m.prn] = {
          attendance_marks: existing ? (existing.attendance_marks != null ? existing.attendance_marks : '') : '',
          presentation_marks: existing ? (existing.presentation_marks != null ? existing.presentation_marks : 0) : 0,
          subject_understanding_marks: existing ? (existing.subject_understanding_marks != null ? existing.subject_understanding_marks : 0) : 0,
          publication_marks: existing ? (existing.publication_marks != null ? existing.publication_marks : 0) : 0,
          viva_marks: existing ? (existing.viva_marks != null ? existing.viva_marks : 0) : 0,
          remarks: existing?.remarks || '',
        };
      }
      setMarksInput(init);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load evaluation form';
      toast.error(msg);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleMarkChange = (prn, field, value) => {
    if (value === '') {
      setMarksInput(prev => ({
        ...prev,
        [prn]: { ...prev[prn], [field]: '' },
      }));
      return;
    }

    const num = parseFloat(value);
    if (isNaN(num)) return;

    if (num < 0) {
      toast.error('Marks cannot be negative');
      return;
    }
    if (num > 10) {
      toast.error('Maximum marks for each criterion is 10');
      return;
    }

    // Limit to 2 decimal places
    const rounded = Math.round(num * 100) / 100;
    setMarksInput(prev => ({
      ...prev,
      [prn]: { ...prev[prn], [field]: rounded },
    }));
  };

  const getTotal = (prn) => {
    const m = marksInput[prn] || {};
    const att = Number(m.attendance_marks || 0);
    const pres = Number(m.presentation_marks || 0);
    const sub = Number(m.subject_understanding_marks || 0);
    const pub = Number(m.publication_marks || 0);
    const viva = Number(m.viva_marks || 0);
    return Math.round((att + pres + sub + pub + viva) * 100) / 100;
  };

  const validateBeforeSubmit = () => {
    const members = data?.members || [];
    for (const m of members) {
      const input = marksInput[m.prn] || {};
      if (input.attendance_marks === '' || input.attendance_marks === undefined || input.attendance_marks === null) {
        toast.error(`Attendance mark is required for ${m.student_name} (${m.prn})`);
        return false;
      }
      const att = Number(input.attendance_marks);
      if (isNaN(att) || att < 0 || att > 10) {
        toast.error(`Attendance marks for ${m.student_name} must be between 0 and 10`);
        return false;
      }
      const fields = [
        { name: 'Presentation', val: Number(input.presentation_marks || 0) },
        { name: 'Subject Understanding', val: Number(input.subject_understanding_marks || 0) },
        { name: 'Publication', val: Number(input.publication_marks || 0) },
        { name: 'Viva', val: Number(input.viva_marks || 0) },
      ];
      for (const f of fields) {
        if (isNaN(f.val) || f.val < 0 || f.val > 10) {
          toast.error(`${f.name} marks for ${m.student_name} must be between 0 and 10`);
          return false;
        }
      }
    }
    return true;
  };

  const buildPayload = (status) => ({
    status,
    overallRemarks,
    marks: (data?.members || []).map(m => ({
      prn: m.prn,
      attendance_marks: marksInput[m.prn]?.attendance_marks !== '' ? Number(marksInput[m.prn]?.attendance_marks) : null,
      presentation_marks: Number(marksInput[m.prn]?.presentation_marks || 0),
      subject_understanding_marks: Number(marksInput[m.prn]?.subject_understanding_marks || 0),
      publication_marks: Number(marksInput[m.prn]?.publication_marks || 0),
      viva_marks: Number(marksInput[m.prn]?.viva_marks || 0),
      remarks: marksInput[m.prn]?.remarks || overallRemarks || '',
    })),
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await api.post(`/seminar/groups/${groupId}/evaluation`, buildPayload('DRAFT'));
      toast.success('Draft marks saved successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeClick = () => {
    if (!validateBeforeSubmit()) return;
    setConfirmSubmit(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setConfirmSubmit(false);
    try {
      await api.post(`/seminar/groups/${groupId}/evaluation`, buildPayload('SUBMITTED'));
      toast.success('Evaluation finalized and submitted successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to finalize evaluation');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async () => {
    if (!window.confirm('Unlock this evaluation? The guide will be able to modify marks again.')) return;
    setUnlocking(true);
    try {
      await api.post(`/seminar/groups/${groupId}/marks/unlock`, { reason: 'Unlocked for correction' });
      toast.success('Evaluation unlocked successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unlock evaluation');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[var(--navy)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--ink)]/40">Loading evaluation form…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { group, members, marks, rubrics, isLocked, canEdit, canUnlock } = data;

  const marksStatusRaw = marks.length > 0 ? marks[0].status : 'NOT_STARTED';
  const marksStatus = STATUS_COLORS[marksStatusRaw] || STATUS_COLORS.NOT_STARTED;

  const evaluatedCount = marks.length;
  const memberCount = members.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              onClick={() => navigate('/faculty/seminar/my-groups')}
              className="text-[var(--ink)]/50 hover:text-[var(--navy)] text-xs font-medium transition-colors flex items-center gap-1"
            >
              ← My Groups
            </button>
            <span className="text-[var(--ink)]/20">/</span>
            <span className="text-xs text-[var(--ink)]/50">Seminar Evaluation</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)] font-serif">
            Seminar Evaluation
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="font-mono text-xs font-bold bg-[var(--navy)] text-white px-2 py-0.5 rounded">
              Group #{group.group_no}
            </span>
            <span className="text-xs text-[var(--ink)]/60 truncate max-w-[280px]">{group.domain}</span>
            <span className="text-xs text-[var(--ink)]/40">{group.session_name} · {group.academic_year} · Batch {group.batch}</span>
          </div>
        </div>

        {/* Evaluation Status Badge */}
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${marksStatus.bg} ${marksStatus.border} shrink-0`}>
          <span className={`w-2 h-2 rounded-full ${marksStatus.dot} ${marksStatusRaw === 'NOT_STARTED' ? '' : 'animate-pulse'}`} />
          <span className={`text-xs font-bold ${marksStatus.text}`}>{marksStatus.label}</span>
          {evaluatedCount > 0 && (
            <span className="text-[10px] text-[var(--ink)]/40">{evaluatedCount}/{memberCount} evaluated</span>
          )}
        </div>
      </div>

      {/* Lock notice */}
      {isLocked && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <svg className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Evaluation Finalized &amp; Locked</p>
            <p className="text-xs text-emerald-700/80 mt-0.5">
              This evaluation has been submitted. Marks are now locked and visible to students.
              {canUnlock && ' Use the unlock button to make corrections.'}
            </p>
          </div>
          {canUnlock && (
            <button
              disabled={unlocking}
              onClick={handleUnlock}
              className="px-3 py-1.5 text-xs font-bold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors shrink-0"
            >
              {unlocking ? 'Unlocking…' : '🔓 Unlock'}
            </button>
          )}
        </div>
      )}

      {/* Rubrics Reference Card */}
      <div className="bg-white border border-[var(--rule)] rounded-xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-[var(--navy)] mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          Evaluation Rubrics (5 Criteria · 10 Marks Each · Total: 50.00 marks)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {rubrics.map(r => (
            <div key={r.key} className="bg-[var(--paper)] border border-[var(--rule)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--navy)] flex items-center">
                  {r.name}
                  {r.required && <span className="text-red-500 font-bold ml-0.5" title="Mandatory Field">*</span>}
                </span>
                <span className="text-[11px] font-mono font-bold bg-[var(--navy)] text-white px-1.5 py-0.5 rounded">{r.max} pts</span>
              </div>
              <p className="text-[11px] text-[var(--ink)]/60 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Marks Entry Table */}
      <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-[var(--rule)] bg-[#EEF0F7] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--navy)]">Student Individual Evaluation</h2>
          <span className="text-xs text-[var(--ink)]/50">{memberCount} student{memberCount !== 1 ? 's' : ''} in this group</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--paper)] text-[var(--ink)]/60 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">Student</th>
                <th className="px-3 py-2.5 text-left font-semibold">PRN / Roll No</th>
                <th className="px-2 py-2.5 text-center font-semibold">
                  <div className="flex items-center justify-center gap-1">
                    <span>Attendance</span>
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Mandatory field"></span>
                  </div>
                  <span className="font-normal text-[10px] text-[var(--ink)]/40">(max 10)</span>
                </th>
                <th className="px-2 py-2.5 text-center font-semibold">
                  Presentation<br /><span className="font-normal text-[10px] text-[var(--ink)]/40">(max 10)</span>
                </th>
                <th className="px-2 py-2.5 text-center font-semibold">
                  Subject Understanding<br /><span className="font-normal text-[10px] text-[var(--ink)]/40">(max 10)</span>
                </th>
                <th className="px-2 py-2.5 text-center font-semibold">
                  Publication<br /><span className="font-normal text-[10px] text-[var(--ink)]/40">(max 10)</span>
                </th>
                <th className="px-2 py-2.5 text-center font-semibold">
                  Viva<br /><span className="font-normal text-[10px] text-[var(--ink)]/40">(max 10)</span>
                </th>
                <th className="px-3 py-2.5 text-center font-semibold">
                  Total<br /><span className="font-normal text-[10px] text-[var(--ink)]/40">(max 50.00)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {members.map((m, idx) => {
                const total = getTotal(m.prn);
                const pct = total / 50;
                const totalColor = pct >= 0.8 ? 'text-emerald-700 bg-emerald-50' : pct >= 0.5 ? 'text-amber-700 bg-amber-50' : total > 0 ? 'text-red-600 bg-red-50' : 'text-[var(--ink)]/40 bg-[var(--paper)]';

                return (
                  <tr key={m.prn || idx} className={`transition-colors ${idx % 2 === 0 ? '' : 'bg-[#FAFBFD]'} ${m.is_leader ? 'ring-1 ring-inset ring-[var(--navy)]/10' : ''}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--navy)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--navy)] shrink-0">
                          {m.student_name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--ink)] text-xs">{m.student_name}</p>
                          {m.is_leader && (
                            <span className="text-[9px] bg-[var(--navy)] text-white px-1.5 py-0.5 rounded font-bold">Leader</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-[var(--ink)]/70">{m.prn}</td>

                    {/* Attendance (Required) */}
                    <td className="px-2 py-2 text-center">
                      {canEdit && !isLocked ? (
                        <div className="relative inline-block">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            required
                            placeholder="Req *"
                            value={marksInput[m.prn]?.attendance_marks ?? ''}
                            onChange={e => handleMarkChange(m.prn, 'attendance_marks', e.target.value)}
                            className={`w-16 text-center border rounded-md px-1.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20 ${
                              marksInput[m.prn]?.attendance_marks === '' ? 'border-red-300 bg-red-50/30' : 'border-[var(--rule)] bg-white'
                            }`}
                          />
                        </div>
                      ) : (
                        <ScoreBadge value={marksInput[m.prn]?.attendance_marks ?? 0} max={10} />
                      )}
                    </td>

                    {/* Presentation */}
                    <td className="px-2 py-2 text-center">
                      {canEdit && !isLocked ? (
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          value={marksInput[m.prn]?.presentation_marks ?? 0}
                          onChange={e => handleMarkChange(m.prn, 'presentation_marks', e.target.value)}
                          className="w-16 text-center border border-[var(--rule)] rounded-md px-1.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20 bg-white"
                        />
                      ) : (
                        <ScoreBadge value={marksInput[m.prn]?.presentation_marks ?? 0} max={10} />
                      )}
                    </td>

                    {/* Subject Understanding */}
                    <td className="px-2 py-2 text-center">
                      {canEdit && !isLocked ? (
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          value={marksInput[m.prn]?.subject_understanding_marks ?? 0}
                          onChange={e => handleMarkChange(m.prn, 'subject_understanding_marks', e.target.value)}
                          className="w-16 text-center border border-[var(--rule)] rounded-md px-1.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20 bg-white"
                        />
                      ) : (
                        <ScoreBadge value={marksInput[m.prn]?.subject_understanding_marks ?? 0} max={10} />
                      )}
                    </td>

                    {/* Publication */}
                    <td className="px-2 py-2 text-center">
                      {canEdit && !isLocked ? (
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          value={marksInput[m.prn]?.publication_marks ?? 0}
                          onChange={e => handleMarkChange(m.prn, 'publication_marks', e.target.value)}
                          className="w-16 text-center border border-[var(--rule)] rounded-md px-1.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20 bg-white"
                        />
                      ) : (
                        <ScoreBadge value={marksInput[m.prn]?.publication_marks ?? 0} max={10} />
                      )}
                    </td>

                    {/* Viva */}
                    <td className="px-2 py-2 text-center">
                      {canEdit && !isLocked ? (
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          value={marksInput[m.prn]?.viva_marks ?? 0}
                          onChange={e => handleMarkChange(m.prn, 'viva_marks', e.target.value)}
                          className="w-16 text-center border border-[var(--rule)] rounded-md px-1.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20 bg-white"
                        />
                      ) : (
                        <ScoreBadge value={marksInput[m.prn]?.viva_marks ?? 0} max={10} />
                      )}
                    </td>

                    {/* Total (e.g. 43 / 50.00) */}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${totalColor}`}>
                        {total.toFixed(2)} / 50.00
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Overall Remarks */}
        {canEdit && !isLocked && (
          <div className="border-t border-[var(--rule)] p-4">
            <label className="block text-xs font-bold text-[var(--navy)] mb-1.5">
              Evaluation Remarks / Comments <span className="font-normal text-[var(--ink)]/40">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={overallRemarks}
              onChange={e => setOverallRemarks(e.target.value)}
              placeholder="Overall evaluation notes, areas for improvement, or commendations…"
              className="w-full border border-[var(--rule)] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--navy)] focus:ring-1 focus:ring-[var(--navy)]/20"
            />
          </div>
        )}

        {/* Existing remarks display when locked */}
        {isLocked && marks[0]?.remarks && (
          <div className="border-t border-[var(--rule)] px-4 py-3 bg-slate-50">
            <p className="text-xs font-bold text-[var(--navy)] mb-0.5">Evaluation Remarks</p>
            <p className="text-xs text-[var(--ink)]/70 italic">{marks[0].remarks}</p>
          </div>
        )}

        {/* Action Bar */}
        {canEdit && !isLocked && (
          <div className="border-t border-[var(--rule)] bg-[var(--paper)] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--ink)]/50">
              <span className="font-medium text-[var(--ink)]/70">Save as draft</span> to continue later,
              or <span className="font-medium text-[var(--ink)]/70">finalize</span> to lock and publish marks to students.
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={saving}
                onClick={handleSaveDraft}
                className="px-4 py-2 border border-[var(--rule)] text-[var(--ink)] text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                disabled={saving}
                onClick={handleFinalizeClick}
                className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded-lg hover:bg-[var(--navy)]/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? 'Submitting…' : 'Finalize & Submit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary Card */}
      {evaluatedCount > 0 && (
        <div className="bg-white border border-[var(--rule)] rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-[var(--navy)] mb-3">Evaluation Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-[var(--paper)] rounded-lg">
              <p className="text-xs text-[var(--ink)]/50 mb-1">Students Evaluated</p>
              <p className="text-xl font-bold text-[var(--navy)]">{evaluatedCount}/{memberCount}</p>
            </div>
            <div className="text-center p-3 bg-[var(--paper)] rounded-lg">
              <p className="text-xs text-[var(--ink)]/50 mb-1">Class Average</p>
              <p className="text-xl font-bold text-[var(--navy)]">
                {evaluatedCount > 0
                  ? (members.reduce((sum, m) => sum + getTotal(m.prn), 0) / memberCount).toFixed(2)
                  : '-'}
              </p>
            </div>
            <div className="text-center p-3 bg-[var(--paper)] rounded-lg">
              <p className="text-xs text-[var(--ink)]/50 mb-1">Highest Score</p>
              <p className="text-xl font-bold text-emerald-700">
                {members.length > 0 ? Math.max(...members.map(m => getTotal(m.prn))).toFixed(2) : '-'}
              </p>
            </div>
            <div className="text-center p-3 bg-[var(--paper)] rounded-lg">
              <p className="text-xs text-[var(--ink)]/50 mb-1">Lowest Score</p>
              <p className="text-xl font-bold text-amber-700">
                {members.length > 0 ? Math.min(...members.map(m => getTotal(m.prn))).toFixed(2) : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--rule)] bg-[#EEF0F7]">
              <h3 className="font-bold text-[var(--navy)] text-base">Confirm Finalization</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-800">This action will lock the evaluation</p>
                  <p className="text-xs text-amber-700/80 mt-1">
                    Once submitted, marks for all <strong>{memberCount}</strong> student(s) in Group #{group.group_no} will be locked and made visible to students.
                    Only the Seminar Coordinator or HOD can unlock them for corrections.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setConfirmSubmit(false)}
                  className="px-4 py-2 border border-[var(--rule)] text-[var(--ink)]/70 text-sm font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={saving}
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'Submitting…' : 'Yes, Finalize Evaluation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
