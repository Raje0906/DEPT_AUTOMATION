import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SeminarGroupRegistration() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [registrationData, setRegistrationData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [standardDomains, setStandardDomains] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null);

  // Registration Form State (when !hasSubmission)
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [showMember4, setShowMember4] = useState(false);

  const initialMembers = [
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: true },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
    { student_name: '', prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', is_leader: false },
  ];
  const [members, setMembers] = useState(initialMembers);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/seminar/my-submission');
      const data = res.data;

      setStandardDomains(data.standard_domains || []);
      setConflictInfo(data.conflictInfo || null);

      if (data.session) {
        setSession(data.session);
      }

      if (data.prefill) {
        setStudentProfile(data.prefill);
        // Pre-fill Student 1 (Leader) from logged-in student's profile
        setMembers(prev => {
          const copy = [...prev];
          copy[0] = {
            ...copy[0],
            student_name: data.prefill.name || user?.name || '',
            prn: data.prefill.prn || '',
            division: data.prefill.division || '',
            mobile: data.prefill.mobile || '',
            email: data.prefill.email || user?.email || '',
            is_leader: true,
          };
          return copy;
        });
      }

      if (data.hasSubmission) {
        setHasSubmission(true);
        setGroupData({ ...data.group, myMarks: data.myMarks, guideInfo: data.guideInfo });
        setRegistrationData(data.registration || null);
        setMembersData(data.members || []);
      } else {
        setHasSubmission(false);
        setGroupData(null);
        setRegistrationData(null);
        setMembersData([]);
      }
    } catch (err) {
      console.error('Failed to load seminar registration:', err);
      toast.error('Unable to load TE Seminar registration details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMemberChange = (index, field, value) => {
    setMembers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalDomain = isCustomDomain ? customDomain.trim() : domain;
    if (!finalDomain) {
      toast.error('Please select or specify a domain of interest.');
      return;
    }

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

    if (!membersToSubmit[0]?.student_name || !membersToSubmit[0]?.prn) {
      toast.error('Student 1 (Leader) name and PRN are required.');
      return;
    }

    if (!membersToSubmit[1]?.student_name || !membersToSubmit[1]?.prn) {
      toast.error('Student 2 name and PRN are required.');
      return;
    }

    if (!membersToSubmit[2]?.student_name || !membersToSubmit[2]?.prn) {
      toast.error('Student 3 name and PRN are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        session_id: session?.id,
        domain: finalDomain,
        members: membersToSubmit,
        isEditing: false,
      };

      const res = await api.post('/seminar/register-group', payload);
      toast.success(res.data?.message || 'TE Seminar group registered successfully.');
      await loadData();
    } catch (err) {
      console.error('Registration submit error:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to submit group registration.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Loading seminar details...</p>
        </div>
      </div>
    );
  }

  // Guide display resolution
  const guideAssigned = Boolean(groupData?.guide_assigned || groupData?.guide_name);
  const guideName = groupData?.guide_name || groupData?.guideInfo?.guide_name || 'Guide not assigned yet';
  const guideDesignation = groupData?.guide_designation || groupData?.guideInfo?.guide_designation || (guideAssigned ? 'Faculty Guide' : 'Allocation pending');
  const guideEmail = groupData?.guide_email || groupData?.guideInfo?.guide_email || '—';

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 text-slate-900">
      {/* Page Title & Context */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
            {session?.name || 'AY 2025-26 Sem 1'} &bull; Department of Computer Engineering
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
            TE Seminar & Project Group Registration
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasSubmission ? (
            <>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-700 font-mono">
                Group #{groupData?.group_no || '—'}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-800">
                Registration Finalized
              </span>
            </>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-800">
              New Group Registration Open
            </span>
          )}
        </div>
      </div>

      {/* Conflict PRN Alert Banner (If Applicable) */}
      {conflictInfo && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-red-950">
            <span>Conflict Detected for PRN: {conflictInfo.prn || studentProfile?.prn}</span>
          </div>
          <p className="text-red-800 leading-relaxed">
            This PRN is also recorded in <strong>Group #{conflictInfo.otherGroupNo}</strong> ({conflictInfo.otherStudentName}){' '}
            registered by <strong>{conflictInfo.registeredByName}</strong>. Please contact the Seminar Coordinator to resolve this allocation.
          </p>
        </div>
      )}

      {/* SECTION 1: LOGGED-IN STUDENT PROFILE (Prominent at the very top) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Logged-In Student Profile
          </h2>
          <span className="text-xs text-slate-400">Current Session User</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Full Name</span>
            <span className="font-semibold text-slate-900 block mt-0.5">
              {studentProfile?.name || user?.name || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">College PRN</span>
            <span className="font-mono font-semibold text-slate-900 block mt-0.5">
              {studentProfile?.prn || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Roll Number</span>
            <span className="font-mono text-slate-900 block mt-0.5">
              {studentProfile?.roll_no || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Division / Batch</span>
            <span className="text-slate-900 block mt-0.5">
              {studentProfile?.division || 'TE'}{studentProfile?.batch ? ` (${studentProfile.batch})` : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Email Address</span>
            <span className="text-slate-900 block mt-0.5 font-mono text-[11px]">
              {studentProfile?.email || user?.email || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Mobile Number</span>
            <span className="text-slate-900 block mt-0.5 font-mono">
              {studentProfile?.mobile || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Status</span>
            <span className="text-slate-900 block mt-0.5 font-medium">
              {hasSubmission ? `Enrolled in Group #${groupData?.group_no}` : 'Registration Pending'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Academic Year</span>
            <span className="text-slate-900 block mt-0.5">
              {session?.academic_year || '2025-26'} (Sem 1)
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: REGISTRATION FORM TO FILL (When student has no registered group) */}
      {!hasSubmission && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Domain Selection */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Select Domain / Area of Interest
              </h2>
              <span className="text-xs text-slate-400">Project Specialization</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {standardDomains.map((d) => (
                <label
                  key={d}
                  className={`flex items-center gap-2 p-3 rounded border text-xs cursor-pointer transition-colors ${
                    domain === d && !isCustomDomain
                      ? 'border-slate-800 bg-slate-50 font-bold text-slate-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="domain_option"
                    checked={domain === d && !isCustomDomain}
                    onChange={() => {
                      setDomain(d);
                      setIsCustomDomain(false);
                    }}
                    className="accent-slate-800"
                  />
                  <span>{d}</span>
                </label>
              ))}

              <label
                className={`flex items-center gap-2 p-3 rounded border text-xs cursor-pointer transition-colors ${
                  isCustomDomain
                    ? 'border-slate-800 bg-slate-50 font-bold text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="domain_option"
                  checked={isCustomDomain}
                  onChange={() => {
                    setIsCustomDomain(true);
                    setDomain('Other');
                  }}
                  className="accent-slate-800"
                />
                <span>Other (Custom Domain)</span>
              </label>
            </div>

            {isCustomDomain && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specify Custom Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed Systems, Edge Intelligence, Quantum Computing"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded focus:border-slate-800 outline-none"
                />
              </div>
            )}
          </div>

          {/* Step 2: Member Details & Proposed Topics */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Team Members & Proposed Seminar Topics
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {showMember4 ? '4 Team Members' : '3 Team Members (Standard)'}
              </span>
            </div>

            <div className="space-y-6">
              {members.slice(0, showMember4 ? 4 : 3).map((m, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Student {idx + 1}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-semibold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">
                          GROUP LEADER (YOU)
                        </span>
                      )}
                    </div>
                    {idx === 3 && (
                      <button
                        type="button"
                        onClick={() => setShowMember4(false)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        Remove 4th Member Slot
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="Student full name"
                        value={m.student_name}
                        onChange={(e) => handleMemberChange(idx, 'student_name', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-800 outline-none"
                        required={idx < 3}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">College PRN</label>
                      <input
                        type="text"
                        placeholder="F23112000"
                        value={m.prn}
                        onChange={(e) => handleMemberChange(idx, 'prn', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded font-mono uppercase focus:border-slate-800 outline-none"
                        required={idx < 3}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Division</label>
                      <input
                        type="text"
                        placeholder="TE1 / TE2 / TE3"
                        value={m.division}
                        onChange={(e) => handleMemberChange(idx, 'division', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded uppercase focus:border-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Mobile Contact</label>
                      <input
                        type="tel"
                        placeholder="10-digit number"
                        value={m.mobile}
                        onChange={(e) => handleMemberChange(idx, 'mobile', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded font-mono focus:border-slate-800 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">College Email</label>
                      <input
                        type="email"
                        placeholder="student@meswadiacoe.edu"
                        value={m.email}
                        onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded font-mono text-xs focus:border-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  {/* 3 Topics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                        Topic 1 (Primary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 1"
                        value={m.topic1}
                        onChange={(e) => handleMemberChange(idx, 'topic1', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Topic 2 (Secondary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 2"
                        value={m.topic2}
                        onChange={(e) => handleMemberChange(idx, 'topic2', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Topic 3 (Tertiary Preference)
                      </label>
                      <input
                        type="text"
                        placeholder="Proposed seminar topic 3"
                        value={m.topic3}
                        onChange={(e) => handleMemberChange(idx, 'topic3', e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!showMember4 && (
              <button
                type="button"
                onClick={() => setShowMember4(true)}
                className="w-full py-2.5 border border-dashed border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-md transition-colors"
              >
                + Add 4th Team Member Slot (Optional)
              </button>
            )}
          </div>

          {/* Step 3: Submission Action Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-slate-600">
              Submitting registers your group. All team members will share this registration record.
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-slate-900 text-white rounded font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shrink-0"
            >
              {submitting ? 'Submitting Registration...' : 'Submit Group Registration'}
            </button>
          </div>
        </form>
      )}

      {/* VIEW 2: REGISTERED & ALLOCATED VIEW (Read-Only with No Edit Option) */}
      {hasSubmission && (
        <div className="space-y-6">
          {/* SECTION 2: GUIDE & REGISTRATION STATUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guide Details */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assigned Faculty Guide
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                  guideAssigned ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  {guideAssigned ? 'Assigned' : 'Pending'}
                </span>
              </div>
              <div className="pt-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {guideName}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {guideDesignation}
                </p>
                {guideAssigned && guideEmail !== '—' && (
                  <p className="text-xs font-mono text-slate-700 mt-1">
                    {guideEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Registration Metadata */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Group Allocation Status
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800">
                  Group #{groupData?.group_no}
                </span>
              </div>
              <div className="pt-1 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Domain of Interest:</span>
                  <span className="font-medium text-slate-900">{groupData?.domain || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Registration Status:</span>
                  <span className="font-medium text-slate-900">
                    {registrationData?.status === 'REGISTERED' ? 'Registered & Finalized' : 'Submitted'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Submission Date:</span>
                  <span className="text-slate-700 font-mono text-[11px]">
                    {groupData?.submitted_at ? new Date(groupData.submitted_at).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: TEAM MEMBERS & TOPICS ROSTER */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Team Members & Proposed Seminar Topics
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {membersData.length} Members Enrolled
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Student Name</th>
                    <th className="py-2.5 px-3 font-semibold">PRN</th>
                    <th className="py-2.5 px-3 font-semibold">Div</th>
                    <th className="py-2.5 px-3 font-semibold">Contact Info</th>
                    <th className="py-2.5 px-3 font-semibold">Proposed Seminar Topics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membersData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{m.student_name || '—'}</div>
                        {idx === 0 && (
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                            Leader
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span>{m.prn || '—'}</span>
                        {m.prn_status === 'conflict' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-red-100 border border-red-300 text-red-800 font-sans">
                            Conflict
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 uppercase">
                        {m.division || '—'}
                      </td>
                      <td className="py-3 px-3 space-y-0.5 text-slate-600 font-mono text-[11px]">
                        <div>{m.email || '—'}</div>
                        <div>{m.mobile || '—'}</div>
                      </td>
                      <td className="py-3 px-3 space-y-1 text-slate-800">
                        <div>
                          <span className="text-slate-400 font-semibold mr-1">1.</span>
                          {m.topic1 || '—'}
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold mr-1">2.</span>
                          {m.topic2 || '—'}
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold mr-1">3.</span>
                          {m.topic3 || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
