import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SeminarGroupRegistration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [isLeader, setIsLeader] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [standardDomains, setStandardDomains] = useState([]);
  const [hasDraftNotice, setHasDraftNotice] = useState(false);

  // Form State
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [showMember4, setShowMember4] = useState(false);

  // Initial 3 members
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
        setGroupData(data.group);
        setMembersData(data.members || []);
        setIsLeader(data.isLeader);
        setCanEdit(data.canEdit);
      } else {
        setHasSubmission(false);
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

  // Autosave to localStorage on changes (debounced)
  useEffect(() => {
    if (!draftKey || hasSubmission || loading || !isEditing && hasSubmission) return;

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
    }, 1000);

    return () => clearTimeout(timer);
  }, [domain, customDomain, isCustomDomain, showMember4, members, draftKey, hasSubmission, loading, isEditing]);

  const handleRestoreDraft = () => {
    if (!draftKey) return;
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.domain) setDomain(parsed.domain);
        if (parsed.customDomain) setCustomDomain(parsed.customDomain);
        if (parsed.isCustomDomain !== undefined) setIsCustomDomain(parsed.isCustomDomain);
        if (parsed.showMember4 !== undefined) setShowMember4(parsed.showMember4);
        if (Array.isArray(parsed.members)) setMembers(parsed.members);
        toast.success('Restored unsaved draft!');
        setHasDraftNotice(false);
      }
    } catch {
      toast.error('Failed to restore draft');
    }
  };

  const handleDiscardDraft = () => {
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
    setHasDraftNotice(false);
    toast('Draft discarded', { icon: '🗑️' });
  };

  const handleMemberChange = (index, field, value) => {
    setMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleStartEdit = () => {
    if (!groupData) return;
    setIsEditing(true);

    const isStd = standardDomains.includes(groupData.domain);
    if (isStd) {
      setDomain(groupData.domain);
      setIsCustomDomain(false);
      setCustomDomain('');
    } else {
      setDomain('Other / Emerging Technologies');
      setIsCustomDomain(true);
      setCustomDomain(groupData.domain);
    }

    const newMembers = [...initialMembers];
    membersData.forEach((m, idx) => {
      if (idx < 4) {
        newMembers[idx] = {
          student_name: m.student_name || '',
          prn: m.prn || '',
          division: m.division || '',
          mobile: m.mobile || '',
          email: m.email || '',
          topic1: m.topic1 || '',
          topic2: m.topic2 || '',
          topic3: m.topic3 || '',
          is_leader: idx === 0,
        };
      }
    });

    if (membersData.length === 4) {
      setShowMember4(true);
    } else {
      setShowMember4(false);
    }

    setMembers(newMembers);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // Find duplicate PRNs across current members in real-time
  const getDuplicatePrns = () => {
    const activeCount = showMember4 ? 4 : 3;
    const seen = new Map();
    const duplicates = new Set();

    for (let i = 0; i < activeCount; i++) {
      const p = members[i].prn?.trim().toUpperCase();
      if (p) {
        if (seen.has(p)) {
          duplicates.add(p);
        } else {
          seen.set(p, i);
        }
      }
    }
    return duplicates;
  };

  const duplicatePrns = getDuplicatePrns();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      return toast.error('No active seminar session found');
    }

    const effectiveDomain = isCustomDomain ? customDomain.trim() : domain.trim();
    if (!effectiveDomain) {
      return toast.error('Please select or specify a Project Domain Name');
    }

    const activeMembersCount = showMember4 ? 4 : 3;
    const activeMembers = members.slice(0, activeMembersCount);

    // Client-side required field and format check
    for (let i = 0; i < activeMembers.length; i++) {
      const m = activeMembers[i];
      const sNum = i + 1;
      const sLabel = `Student ${sNum}${i === 0 ? ' (Leader)' : ''}`;

      if (!m.student_name?.trim()) return toast.error(`${sLabel}: Please enter Student Name`);
      if (!m.prn?.trim()) return toast.error(`${sLabel}: Please enter College PRN`);
      if (!m.division?.trim()) return toast.error(`${sLabel}: Please select or enter Division`);
      if (!m.mobile?.trim()) return toast.error(`${sLabel}: Please enter Mobile Number`);

      const cleanMobile = m.mobile.replace(/\D/g, '');
      if (cleanMobile.length !== 10 && !(cleanMobile.length === 12 && cleanMobile.startsWith('91'))) {
        return toast.error(`${sLabel}: Mobile number must be a valid 10-digit number`);
      }

      if (!m.email?.trim() || !m.email.includes('@')) {
        return toast.error(`${sLabel}: Please enter a valid Email Address`);
      }

      if (!m.topic1?.trim()) return toast.error(`${sLabel}: Please specify Proposed Topic 1`);
      if (!m.topic2?.trim()) return toast.error(`${sLabel}: Please specify Proposed Topic 2`);
      if (!m.topic3?.trim()) return toast.error(`${sLabel}: Please specify Proposed Topic 3`);
    }

    if (duplicatePrns.size > 0) {
      return toast.error(`Duplicate PRN detected: ${Array.from(duplicatePrns).join(', ')}. Each student must have a unique PRN.`);
    }

    setSubmitting(true);
    try {
      const payload = {
        session_id: session.id,
        domain: effectiveDomain,
        members: activeMembers.map((m, idx) => ({
          student_name: m.student_name.trim(),
          prn: m.prn.trim(),
          division: m.division.trim(),
          mobile: m.mobile.trim(),
          email: m.email.trim(),
          topic1: m.topic1.trim(),
          topic2: m.topic2.trim(),
          topic3: m.topic3.trim(),
          is_leader: idx === 0,
        })),
      };

      const res = await api.post('/seminar/register-group', payload);
      toast.success(res.data.message || 'Seminar group registered successfully!');

      if (res.data.warnings?.length > 0) {
        res.data.warnings.forEach(w => toast(w, { icon: '⚠️', duration: 5000 }));
      }

      // Clear draft
      if (draftKey) localStorage.removeItem(draftKey);

      setIsEditing(false);
      await loadData();
    } catch (err) {
      console.error('Registration submission error:', err);
      const msg = err.response?.data?.error || 'Registration failed. Please check your inputs.';
      toast.error(msg, { duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-8 h-8 border-3 border-[var(--navy)] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-[var(--ink)]/60 font-medium mt-3">Loading TE Seminar registration portal...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white border border-[var(--rule)] rounded-xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h2 className="text-lg font-bold text-[var(--navy)]">No Active Seminar Session</h2>
          <p className="text-xs text-[var(--ink)]/60 max-w-md mx-auto">
            There is currently no active TE Seminar session open for group registration. Please contact your Seminar Coordinator or Department Administrator.
          </p>
        </div>
      </div>
    );
  }

  // ─── VIEW MODE: GROUP ALREADY REGISTERED ────────────────────────────────────
  if (hasSubmission && !isEditing) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                TE Seminar Group #{groupData.group_no}
              </span>
              <span className="text-[10px] font-mono text-[var(--ink)]/50">
                {session.name} · {session.academic_year} (Batch {session.batch})
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--navy)]">Your Seminar Group Registration</h1>
            <p className="text-xs text-[var(--ink)]/60 mt-0.5">
              Domain: <span className="font-semibold text-[var(--ink)]">{groupData.domain}</span> · {membersData.length} team members registered
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canEdit ? (
              <button
                id="btn-edit-submission"
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded-md hover:bg-[#2a3d7a] transition-colors shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                </svg>
                Edit Group Details
              </button>
            ) : (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border border-gray-300 text-gray-700 text-xs font-semibold rounded">
                  🔒 Registration Locked
                </span>
                <p className="text-[10px] text-[var(--ink)]/50 mt-1">Read-only view</p>
              </div>
            )}
          </div>
        </div>

        {/* Lock / Notice Banners */}
        {session.is_locked && !groupData.allow_edit && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <span className="text-base leading-none">ℹ️</span>
            <div>
              <p className="font-bold">Registration Closed by Coordinator</p>
              <p className="mt-0.5 text-amber-800/80">
                The registration deadline has passed and the list is frozen for faculty guide assignment. If your group requires a genuine correction, please request the coordinator to unlock your group.
              </p>
            </div>
          </div>
        )}

        {session.is_locked && groupData.allow_edit && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-3">
            <span className="text-base leading-none">✨</span>
            <div>
              <p className="font-bold">Special Edit Exception Granted</p>
              <p className="mt-0.5 text-emerald-800/80">
                The coordinator has granted an individual edit exception for your group. You can edit your submission and save corrections.
              </p>
            </div>
          </div>
        )}

        {!isLeader && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            ℹ️ You are listed as a team member in this group. Modifications can only be submitted by the group leader ({groupData.leader_name || 'Leader'}).
          </div>
        )}

        {/* Group Details Card */}
        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-[var(--rule)] bg-[#F8FAFC] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--navy)]">Group Roster &amp; Topics</h2>
            <span className="text-xs font-mono text-[var(--ink)]/50">
              Submitted: {new Date(groupData.submitted_at || groupData.created_at).toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#EEF0F7] border-b border-[var(--rule)] font-semibold text-[var(--navy)]">
                  <th className="p-3 w-16">Role</th>
                  <th className="p-3">Student Name</th>
                  <th className="p-3">College PRN</th>
                  <th className="p-3">Div</th>
                  <th className="p-3">Contact Details</th>
                  <th className="p-3">Proposed Seminar Topics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {membersData.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">
                      {m.is_leader ? (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded text-[10px]">
                          LEADER
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 font-medium px-2 py-0.5 rounded text-[10px]">
                          Member #{m.member_index || idx + 1}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-[var(--ink)] whitespace-nowrap">
                      {m.student_name}
                    </td>
                    <td className="p-3 font-mono text-[var(--navy)] font-semibold whitespace-nowrap">
                      {m.prn}
                    </td>
                    <td className="p-3 font-mono whitespace-nowrap">{m.division}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-[var(--ink)]">{m.mobile}</div>
                      <div className="text-[10px] text-[var(--ink)]/60 truncate max-w-[180px]">{m.email}</div>
                    </td>
                    <td className="p-3 min-w-[260px] space-y-1">
                      <div className="flex items-start gap-1">
                        <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 px-1 rounded border border-blue-200 shrink-0">T1</span>
                        <span className="text-xs text-[var(--ink)]">{m.topic1}</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1 rounded border border-slate-200 shrink-0">T2</span>
                        <span className="text-xs text-[var(--ink)]/80">{m.topic2}</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1 rounded border border-slate-200 shrink-0">T3</span>
                        <span className="text-xs text-[var(--ink)]/80">{m.topic3}</span>
                      </div>
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

  // ─── FORM MODE: NEW REGISTRATION OR EDITING ──────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Draft Recovery Banner */}
      {hasDraftNotice && !isEditing && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <span>You have an unsaved registration draft from a previous session.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRestoreDraft}
              className="px-3 py-1 bg-amber-600 text-white font-semibold rounded hover:bg-amber-700 transition-colors"
            >
              Restore Draft
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1 border border-amber-300 text-amber-800 font-semibold rounded hover:bg-amber-100 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-[var(--rule)] rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
              TE Seminar Registration
            </span>
            <span className="text-[10px] font-mono text-[var(--ink)]/50">
              {session.academic_year} · Batch {session.batch}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">
            {isEditing ? `Edit Group #${groupData?.group_no}` : 'Group Formation & Registration'}
          </h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            Group Leader submits on behalf of 3 to 4 team members. Data updates in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-[var(--rule)] text-[var(--ink)]/70 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel Edit
            </button>
          )}
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {session.is_locked ? 'Locked (Edit Override)' : 'Portal Open'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* GROUP LEVEL: DOMAIN NAME */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 space-y-4 shadow-xs">
          <div className="border-b border-[var(--rule)] pb-3">
            <h2 className="text-base font-bold text-[var(--navy)] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[var(--navy)] text-white text-[10px] flex items-center justify-center font-mono">1</span>
              Project / Seminar Domain
            </h2>
            <p className="text-xs text-[var(--ink)]/60 mt-0.5">
              Select the primary technical domain for your seminar group from the department list.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label text-xs font-bold text-[var(--navy)]">
                Domain Name <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={domain}
                onChange={(e) => {
                  const val = e.target.value;
                  setDomain(val);
                  setIsCustomDomain(val === 'Other / Emerging Technologies');
                }}
                className="input-field text-sm"
              >
                <option value="">Select Domain...</option>
                {standardDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {isCustomDomain && (
              <div>
                <label className="input-label text-xs font-bold text-amber-800">
                  Specify Custom Domain Name <span className="text-red-500">*</span>
                  <span className="text-[10px] font-normal text-amber-700 ml-1.5">(Flagged for Coordinator Review)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quantum Computing, Embedded Robotics..."
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="input-field text-sm border-amber-300 focus:border-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* STUDENT BLOCKS (1..4) */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-6 space-y-6 shadow-xs">
          <div className="border-b border-[var(--rule)] pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--navy)] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--navy)] text-white text-[10px] flex items-center justify-center font-mono">2</span>
                Student Team Members Roster
              </h2>
              <p className="text-xs text-[var(--ink)]/60 mt-0.5">
                Students 1, 2, and 3 are mandatory. Student 4 is optional (groups must have 3–4 members).
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-semibold text-[var(--navy)] bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                {showMember4 ? '4 Members' : '3 Members'}
              </span>
            </div>
          </div>

          <div className="space-y-6 divide-y divide-[var(--rule)]">
            {members.slice(0, showMember4 ? 4 : 3).map((m, idx) => {
              const sNum = idx + 1;
              const isLeaderBlock = idx === 0;
              const isRequired = idx < 3;
              const isPrnDuplicate = m.prn && duplicatePrns.has(m.prn.trim().toUpperCase());

              return (
                <div key={idx} className={idx > 0 ? 'pt-6 space-y-4' : 'space-y-4'}>
                  {/* Block Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                        isLeaderBlock
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        Student {sNum} {isLeaderBlock ? '(Group Leader / Submitter)' : ''}
                      </span>
                      {isRequired ? (
                        <span className="text-[11px] text-red-600 font-semibold">* Mandatory</span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">Optional Member</span>
                      )}
                    </div>

                    {sNum === 4 && (
                      <button
                        type="button"
                        onClick={() => setShowMember4(false)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        ✕ Remove 4th Member
                      </button>
                    )}
                  </div>

                  {/* Basic Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Name */}
                    <div>
                      <label className="input-label text-xs font-semibold">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Student full name"
                        value={m.student_name}
                        onChange={(e) => handleMemberChange(idx, 'student_name', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>

                    {/* College PRN */}
                    <div>
                      <label className="input-label text-xs font-semibold">
                        College PRN <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2025TE0001"
                        value={m.prn}
                        onChange={(e) => handleMemberChange(idx, 'prn', e.target.value)}
                        className={`input-field text-sm uppercase font-mono ${
                          isPrnDuplicate ? 'border-red-500 bg-red-50 text-red-900' : ''
                        }`}
                      />
                      {isPrnDuplicate && (
                        <p className="text-[10px] text-red-600 font-semibold mt-1">
                          ⚠️ Duplicate PRN within this group!
                        </p>
                      )}
                    </div>

                    {/* Division */}
                    <div>
                      <label className="input-label text-xs font-semibold">
                        Division <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. A or B"
                        value={m.division}
                        onChange={(e) => handleMemberChange(idx, 'division', e.target.value)}
                        className="input-field text-sm uppercase"
                      />
                    </div>

                    {/* Mobile No */}
                    <div>
                      <label className="input-label text-xs font-semibold">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={13}
                        placeholder="10-digit mobile"
                        value={m.mobile}
                        onChange={(e) => handleMemberChange(idx, 'mobile', e.target.value)}
                        className="input-field text-sm font-mono"
                      />
                    </div>

                    {/* Email ID */}
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="input-label text-xs font-semibold">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="college.email@meswadiacoe.edu"
                        value={m.email}
                        onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>

                  {/* 3 Topics Preferences */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="input-label text-[11px] font-semibold text-[var(--navy)]">
                        Topic 1 (Primary Choice) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Proposed seminar topic 1"
                        value={m.topic1}
                        onChange={(e) => handleMemberChange(idx, 'topic1', e.target.value)}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="input-label text-[11px] font-semibold text-[var(--ink)]/80">
                        Topic 2 (Secondary Choice) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Proposed seminar topic 2"
                        value={m.topic2}
                        onChange={(e) => handleMemberChange(idx, 'topic2', e.target.value)}
                        className="input-field text-xs"
                      />
                    </div>
                    <div>
                      <label className="input-label text-[11px] font-semibold text-[var(--ink)]/80">
                        Topic 3 (Tertiary Choice) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
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

          {/* Add 4th Member Control */}
          {!showMember4 && (
            <div className="pt-2 border-t border-dashed border-[var(--rule)]">
              <button
                type="button"
                id="btn-add-member-4"
                onClick={() => setShowMember4(true)}
                className="w-full py-2.5 border-2 border-dashed border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add 4th Team Member (Optional)
              </button>
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-[var(--ink)]/60">
            <span className="font-semibold text-[var(--ink)]">Submission note:</span> Only one submission is permitted per group. You can update your details until the coordinator locks registration.
          </div>
          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-[var(--rule)] text-[var(--ink)]/70 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              id="btn-submit-registration"
              disabled={submitting || duplicatePrns.size > 0}
              className="px-6 py-2.5 bg-[var(--navy)] text-white text-xs font-bold rounded-md hover:bg-[#2a3d7a] disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2"
            >
              {submitting && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              {isEditing ? 'Save Registration Changes' : 'Submit Group Registration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
