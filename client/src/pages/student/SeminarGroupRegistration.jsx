import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SeminarGroupRegistration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [registrationData, setRegistrationData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [isLeader, setIsLeader] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [standardDomains, setStandardDomains] = useState([]);
  const [hasDraftNotice, setHasDraftNotice] = useState(false);

  // Form State (Single Page)
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [showMember4, setShowMember4] = useState(false);

  // Initial 4 member slots
  const initialMembers = [
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: true },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
  ];
  const [members, setMembers] = useState(initialMembers);

  const draftKey = user?.id ? `seminar_draft_${user.id}` : null;

  // Load active session and existing submission
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/seminar/my-submission');
      const data = res.data;

      setStandardDomains(data.standard_domains || []);

      if (data.session) {
        setSession(data.session);
      }

      if (data.hasSubmission) {
        setHasSubmission(true);
        setGroupData({ ...data.group, myMarks: data.myMarks });
        setRegistrationData(data.registration || null);
        setMembersData(data.members || []);
        setIsLeader(data.isLeader);
        setCanEdit(data.canEdit);
      } else {
        setHasSubmission(false);
        setRegistrationData(null);
        setCanEdit(data.canEdit);
        // Pre-fill Student 1 from login
        if (data.prefill) {
          setMembers(prev => {
            const copy = [...prev];
            copy[0] = {
              ...copy[0],
              student_name: data.prefill.name || user?.name || '',
              email: data.prefill.email || user?.email || '',
              prn: data.prefill.prn || '',
              division: data.prefill.division || '',
              is_leader: true,
            };
            return copy;
          });
        }

        // Check for local draft
        if (draftKey) {
          try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
              const parsed = JSON.parse(savedDraft);
              if (parsed && (parsed.domain || parsed.members?.[1]?.student_name)) {
                setHasDraftNotice(true);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (err) {
      console.error('Failed to load submission data:', err);
      toast.error('Could not load TE Seminar registration details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Autosave to localStorage on changes
  useEffect(() => {
    if (!draftKey || hasSubmission || loading || (!isEditing && hasSubmission)) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          domain,
          customDomain,
          isCustomDomain,
          showMember4,
          members,
          updatedAt: Date.now(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // LocalStorage quota or access error
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [domain, customDomain, isCustomDomain, showMember4, members, draftKey, hasSubmission, loading, isEditing]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.domain) setDomain(parsed.domain);
      if (parsed.customDomain) setCustomDomain(parsed.customDomain);
      if (parsed.isCustomDomain !== undefined) setIsCustomDomain(parsed.isCustomDomain);
      if (parsed.showMember4 !== undefined) setShowMember4(parsed.showMember4);
      if (parsed.members && Array.isArray(parsed.members)) setMembers(parsed.members);
      setHasDraftNotice(false);
      toast.success('Draft restored from your last visit');
    } catch {
      toast.error('Failed to restore draft');
    }
  };

  const discardDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setHasDraftNotice(false);
    toast.success('Saved draft discarded');
  };

  // Member field updates
  const handleMemberChange = (index, field, value) => {
    setMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Start editing existing submission
  const handleStartEdit = () => {
    if (!groupData) return;
    setIsEditing(true);

    const isCustom = !standardDomains.includes(groupData.domain);
    if (isCustom) {
      setIsCustomDomain(true);
      setDomain('Other');
      setCustomDomain(groupData.domain || '');
    } else {
      setIsCustomDomain(false);
      setDomain(groupData.domain || '');
    }

    if (membersData.length >= 4) {
      setShowMember4(true);
    }

    const newMembers = initialMembers.map((m, idx) => {
      const existing = membersData[idx];
      if (existing) {
        return {
          student_name: existing.student_name || '',
          prn: existing.prn || '',
          division: existing.division || '',
          mobile: existing.mobile || '',
          email: existing.email || '',
          topic1: existing.topic1 || '',
          topic2: existing.topic2 || '',
          topic3: existing.topic3 || '',
          is_leader: idx === 0,
        };
      }
      return m;
    });

    setMembers(newMembers);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    loadData();
  };

  // Soft Validation Check (Non-blocking: returns warnings instead of halting)
  const getValidationWarnings = () => {
    const warnings = [];
    const activeCount = showMember4 ? 4 : 3;
    const finalDomain = isCustomDomain ? customDomain.trim() : domain;

    if (!finalDomain) {
      warnings.push('Domain of interest is not selected.');
    }

    // Check duplicate PRNs
    const prnMap = new Map();
    for (let i = 0; i < activeCount; i++) {
      const prn = (members[i].prn || '').trim().toUpperCase();
      if (prn) {
        if (prnMap.has(prn)) {
          warnings.push(`PRN "${prn}" is entered multiple times (Student ${prnMap.get(prn) + 1} and Student ${i + 1}).`);
        } else {
          prnMap.set(prn, i);
        }
      }
    }

    return warnings;
  };

  // Submission handler with relaxed validation
  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalDomain = isCustomDomain ? customDomain.trim() : domain;
    const activeCount = showMember4 ? 4 : 3;
    const membersToSubmit = members.slice(0, activeCount).map((m, idx) => ({
      ...m,
      student_name: m.student_name ? m.student_name.trim() : '',
      prn: m.prn ? m.prn.trim().toUpperCase() : '',
      division: m.division ? m.division.trim().toUpperCase() : '',
      mobile: m.mobile ? m.mobile.trim() : '',
      email: m.email ? m.email.trim().toLowerCase() : '',
      topic1: m.topic1 ? m.topic1.trim() : '',
      topic2: m.topic2 ? m.topic2.trim() : '',
      topic3: m.topic3 ? m.topic3.trim() : '',
      is_leader: idx === 0,
    }));

    // Check if at least leader has a name
    if (!membersToSubmit[0]?.student_name && !membersToSubmit[0]?.prn) {
      toast.error('Please enter at least Student 1 name or PRN to register.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        domain: finalDomain || 'General Computing',
        members: membersToSubmit,
        isEditing,
      };

      const res = await api.post('/seminar/register-group', payload);
      toast.success(res.data?.message || 'TE Seminar group registered successfully!');
      if (draftKey) localStorage.removeItem(draftKey);
      setIsEditing(false);
      await loadData();
    } catch (err) {
      console.error('Registration submit error:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit seminar registration.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[var(--navy)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-[var(--ink)]/60 font-medium">Loading TE Seminar registration details...</p>
        </div>
      </div>
    );
  }

  // State: Registration is closed/locked and student has no submission
  if (!hasSubmission && session && (session.status === 'PUBLISHED' || session.is_locked)) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="bg-white border border-[var(--rule)] rounded-xl p-8 shadow-xs text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-serif font-bold text-[var(--ink)] mb-2">Group Allocation Finalized</h2>
          <p className="text-xs sm:text-sm text-[var(--ink)]/70 max-w-lg mx-auto mb-6">
            The seminar group formation and guide allocation for <strong>{session.academic_year || 'AY 2025-26'}</strong> has been published by the department coordinator.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md mx-auto text-left text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-900">Next Steps:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>If you formed a group, contact your Seminar Coordinator (Dr. S. S. Raskar) with your team details.</li>
              <li>If your PRN needs correction, coordinator can resolve your membership in the system.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // State: Has Submission / Registered View (Read-Only)
  if (hasSubmission && !isEditing) {
    const guideName = groupData?.guide_name;
    const guideAssigned = groupData?.guide_assigned || !!guideName;

    return (
      <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Registered
              </span>
              <span className="text-xs font-semibold text-[var(--ink)]/60">
                Group #{groupData?.group_no || '—'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[var(--ink)] tracking-tight">
              TE Seminar & Project Group Registration
            </h1>
            <p className="text-xs text-[var(--ink)]/60 mt-1">
              Domain: <strong className="text-[var(--ink)]">{groupData?.domain || '—'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && isLeader && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Edit Group Details
              </button>
            )}
          </div>
        </div>

        {/* Assigned Guide Card */}
        <div className={`rounded-xl border p-5 shadow-xs ${
          guideAssigned ? 'bg-blue-50/70 border-blue-200' : 'bg-amber-50/70 border-amber-200'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                guideAssigned ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Assigned Faculty Guide
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {guideAssigned ? guideName : 'Guide not assigned yet'}
                </h3>
                {guideAssigned ? (
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                    {groupData?.guide_designation && (
                      <span>{groupData.guide_designation}</span>
                    )}
                    {groupData?.guide_email && (
                      <span className="font-mono text-[11px] text-blue-700">{groupData.guide_email}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 mt-1">
                    Your group is registered. Guide allocation will be assigned by the seminar coordinator soon.
                  </p>
                )}
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
              guideAssigned ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              {guideAssigned ? 'Guide Allocated' : 'Pending Allocation'}
            </span>
          </div>
        </div>

        {/* Team Members & Topics Grid */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs space-y-6">
          <h2 className="text-base font-serif font-bold text-[var(--ink)]">Registered Team Members</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {membersData.map((m, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{m.student_name || '—'}</span>
                      {m.is_leader && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          LEADER
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-600 mt-0.5">
                      PRN: <strong>{m.prn || '—'}</strong> | Div: <strong>{m.division || '—'}</strong>
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">Member {idx + 1}</span>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5 border-t border-slate-200/60 pt-2">
                  <p>Email: <span className="font-mono text-[11px] text-slate-800">{m.email || '—'}</span></p>
                  <p>Mobile: <span className="font-mono text-[11px] text-slate-800">{m.mobile || '—'}</span></p>
                </div>

                {/* Topics */}
                <div className="bg-white border border-slate-200 rounded p-2.5 text-xs space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Proposed Topics:</p>
                  <p className="text-slate-800"><strong className="text-blue-700">1.</strong> {m.topic1 || '—'}</p>
                  <p className="text-slate-800"><strong className="text-slate-600">2.</strong> {m.topic2 || '—'}</p>
                  <p className="text-slate-800"><strong className="text-slate-600">3.</strong> {m.topic3 || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // State: Single-Page Registration / Editing Form
  const warnings = getValidationWarnings();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Page Title & Instructions */}
      <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[var(--ink)] tracking-tight">
              {isEditing ? 'Edit TE Seminar Group Registration' : 'TE Seminar & Project Group Registration'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink)]/70 mt-1">
              AY 2025-26 &bull; Department of Computer Engineering &bull; MES Wadia College of Engineering
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 self-start">
            Single-Page Form
          </span>
        </div>

        {/* Draft Notice */}
        {hasDraftNotice && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3 text-xs text-blue-900">
            <span>You have an unsaved draft from a previous session.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={restoreDraft}
                className="px-2.5 py-1 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="px-2.5 py-1 border border-blue-300 text-blue-800 rounded font-semibold hover:bg-blue-100"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Single Page Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Domain Selection */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[var(--rule)] pb-3">
            <span className="w-6 h-6 rounded-full bg-[var(--navy)] text-white text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-serif font-bold text-[var(--ink)]">Domain / Area of Interest</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {standardDomains.map((d) => (
              <label
                key={d}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  domain === d && !isCustomDomain
                    ? 'border-[var(--navy)] bg-blue-50/60 text-[var(--navy)] font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="domain-choice"
                  checked={domain === d && !isCustomDomain}
                  onChange={() => {
                    setDomain(d);
                    setIsCustomDomain(false);
                  }}
                  className="accent-[var(--navy)]"
                />
                <span>{d}</span>
              </label>
            ))}

            {/* Other / Custom Domain Option */}
            <label
              className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                isCustomDomain
                  ? 'border-[var(--navy)] bg-blue-50/60 text-[var(--navy)] font-bold shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
              }`}
            >
              <input
                type="radio"
                name="domain-choice"
                checked={isCustomDomain}
                onChange={() => {
                  setIsCustomDomain(true);
                  setDomain('Other');
                }}
                className="accent-[var(--navy)]"
              />
              <span>Other (Custom Domain)</span>
            </label>
          </div>

          {isCustomDomain && (
            <div className="pt-2">
              <label className="input-label text-xs font-semibold">Specify Custom Domain</label>
              <input
                type="text"
                placeholder="e.g. Quantum Computing, Bioinformatics, Edge AI"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          )}
        </div>

        {/* Section 2: Team Members & Topic Preferences */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[var(--navy)] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-base font-serif font-bold text-[var(--ink)]">Team Members & Topic Preferences</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {showMember4 ? '4 Team Members' : '3 Team Members (Standard)'}
            </span>
          </div>

          <div className="space-y-6">
            {members.slice(0, showMember4 ? 4 : 3).map((m, idx) => {
              const isLeaderSlot = idx === 0;

              return (
                <div key={idx} className="border border-slate-200 rounded-xl p-5 bg-slate-50/40 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Student {idx + 1}</span>
                      {isLeaderSlot && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          GROUP LEADER
                        </span>
                      )}
                    </div>
                    {idx === 3 && (
                      <button
                        type="button"
                        onClick={() => setShowMember4(false)}
                        className="text-xs text-red-600 hover:underline font-semibold"
                      >
                        Remove 4th Member
                      </button>
                    )}
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="input-label text-xs font-semibold">Full Name</label>
                      <input
                        type="text"
                        placeholder="Student full name"
                        value={m.student_name}
                        onChange={(e) => handleMemberChange(idx, 'student_name', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>

                    <div>
                      <label className="input-label text-xs font-semibold">College PRN</label>
                      <input
                        type="text"
                        placeholder="e.g. F23113022"
                        value={m.prn}
                        onChange={(e) => handleMemberChange(idx, 'prn', e.target.value)}
                        className="input-field text-sm uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="input-label text-xs font-semibold">Division</label>
                      <input
                        type="text"
                        placeholder="e.g. TE1, TE2, TE3"
                        value={m.division}
                        onChange={(e) => handleMemberChange(idx, 'division', e.target.value)}
                        className="input-field text-sm uppercase"
                      />
                    </div>

                    <div>
                      <label className="input-label text-xs font-semibold">Mobile Number</label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile"
                        value={m.mobile}
                        onChange={(e) => handleMemberChange(idx, 'mobile', e.target.value)}
                        className="input-field text-sm font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="input-label text-xs font-semibold">College Email</label>
                      <input
                        type="email"
                        placeholder="f23113022@meswadiacoe.edu"
                        value={m.email}
                        onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>

                  {/* 3 Topics Preferences */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-slate-200/60">
                    <div>
                      <label className="input-label text-[11px] font-semibold text-[var(--navy)]">
                        Topic 1 (Primary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 1"
                        value={m.topic1}
                        onChange={(e) => handleMemberChange(idx, 'topic1', e.target.value)}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="input-label text-[11px] font-semibold text-slate-700">
                        Topic 2 (Secondary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 2"
                        value={m.topic2}
                        onChange={(e) => handleMemberChange(idx, 'topic2', e.target.value)}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="input-label text-[11px] font-semibold text-slate-700">
                        Topic 3 (Tertiary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 3"
                        value={m.topic3}
                        onChange={(e) => handleMemberChange(idx, 'topic3', e.target.value)}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional 4th Member Button */}
          {!showMember4 && (
            <button
              type="button"
              onClick={() => setShowMember4(true)}
              className="w-full py-2.5 border-2 border-dashed border-blue-200 text-blue-700 bg-blue-50/40 hover:bg-blue-50 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add 4th Team Member (Optional)
            </button>
          )}
        </div>

        {/* Soft Warnings Banner (If any) */}
        {warnings.length > 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-amber-950">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Notice / Information:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Bar */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-[var(--ink)]/60">
            <span className="font-semibold text-[var(--ink)]">Note:</span> One registration is shared across all members of your group.
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[var(--navy)] text-white text-xs font-bold rounded-md hover:bg-[#2a3d7a] disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2"
            >
              {submitting && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              {isEditing ? 'Save Changes' : 'Submit Group Registration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
