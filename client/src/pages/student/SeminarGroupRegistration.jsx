import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

export const isFieldBlank = (val) => {
  if (val === null || val === undefined) return true;
  return String(val).trim() === '';
};

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

  // Field validation state
  const [fieldErrors, setFieldErrors] = useState({});
  const [summaryErrors, setSummaryErrors] = useState([]);

  // Form Fields
  const [finalSeminarTopic, setFinalSeminarTopic] = useState('');
  const [domain, setDomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [showMember4, setShowMember4] = useState(false);

  const initialMembers = [
    { student_name: '', college_prn: '', university_prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', final_topic: '', is_leader: true },
    { student_name: '', college_prn: '', university_prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', final_topic: '', is_leader: false },
    { student_name: '', college_prn: '', university_prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', final_topic: '', is_leader: false },
    { student_name: '', college_prn: '', university_prn: '', division: '', mobile: '', email: '', topic1: '', topic2: '', topic3: '', final_topic: '', is_leader: false },
  ];
  const [members, setMembers] = useState(initialMembers);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/seminar/my-submission');
      const data = res.data;

      setStandardDomains(data.standard_domains || [
        'Artificial Intelligence & Machine Learning',
        'Data Science & Big Data Analytics',
        'Cyber Security & Cryptography',
        'Cloud Computing & DevOps',
        'Internet of Things (IoT) & Embedded Systems',
        'Blockchain & Distributed Systems',
        'Natural Language Processing & Computer Vision',
        'Full Stack & Mobile Development',
        'Other'
      ]);
      setConflictInfo(data.conflictInfo || null);

      if (data.session) {
        setSession(data.session);
      }

      if (data.prefill) {
        setStudentProfile(data.prefill);
        // Pre-fill Student 1 (Leader) from logged-in student's profile
        setMembers(prev => {
          const copy = [...prev];
          const rawPrn = data.prefill.prn || '';
          const isColPrn = String(rawPrn).trim().toUpperCase().startsWith('F');
          const isUnivPrn = String(rawPrn).trim().startsWith('7');
          copy[0] = {
            ...copy[0],
            student_name: data.prefill.name || user?.name || '',
            college_prn: data.prefill.college_prn || (isColPrn ? rawPrn : '') || (rawPrn && !isUnivPrn ? rawPrn : ''),
            university_prn: data.prefill.university_prn || (isUnivPrn ? rawPrn : '') || '',
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
        setGroupData({
          ...data.group,
          myMarks: data.myMarks,
          guideInfo: data.guideInfo,
          final_topic: data.group.final_topic || data.members?.[0]?.final_topic || data.members?.[0]?.topic1 || ''
        });
        setRegistrationData(data.registration || null);
        setMembersData(data.members || []);
        if (data.group.final_topic) {
          setFinalSeminarTopic(data.group.final_topic);
        }
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

    const key = `member_${index}_${field}`;
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const handleDomainSelect = (e) => {
    const val = e.target.value;
    if (val === 'OTHER_CUSTOM') {
      setIsCustomDomain(true);
      setDomain('');
    } else {
      setIsCustomDomain(false);
      setDomain(val);
      setCustomDomain('');
    }
    if (fieldErrors['domain']) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy['domain'];
        return copy;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const chosenDomain = isCustomDomain ? customDomain.trim() : domain.trim();
    const finalTopic = finalSeminarTopic.trim();
    const activeCount = showMember4 ? 4 : 3;
    const errors = {};
    const summary = [];
    let firstErrorKey = null;

    if (!finalTopic) {
      errors['final_topic'] = 'Final Seminar Topic is required';
      summary.push('Final Seminar Topic is required');
      if (!firstErrorKey) firstErrorKey = 'final_topic';
    }

    if (!chosenDomain) {
      errors['domain'] = 'Project Domain is required';
      summary.push('Project Domain is required');
      if (!firstErrorKey) firstErrorKey = 'domain_select';
    }

    // Relaxed member validation: Name and at least one PRN (College or University) per member
    for (let idx = 0; idx < activeCount; idx++) {
      const m = members[idx];
      const memberNum = idx + 1;

      if (isFieldBlank(m.student_name)) {
        const key = `member_${idx}_student_name`;
        const msg = `Enter student name for Member ${memberNum}`;
        errors[key] = msg;
        summary.push(msg);
        if (!firstErrorKey) firstErrorKey = key;
      }

      if (isFieldBlank(m.college_prn) && isFieldBlank(m.university_prn)) {
        const key = `member_${idx}_college_prn`;
        const msg = `Enter College PRN (e.g. F23...) or University PRN (e.g. 723...) for Member ${memberNum}`;
        errors[key] = msg;
        summary.push(msg);
        if (!firstErrorKey) firstErrorKey = key;
      }
    }

    if (summary.length > 0) {
      setFieldErrors(errors);
      setSummaryErrors(summary);
      toast.error('Please fill in all required fields.');
      if (firstErrorKey) {
        const el = document.getElementById(firstErrorKey);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    setFieldErrors({});
    setSummaryErrors([]);

    const membersToSubmit = members.slice(0, activeCount).map((m, idx) => {
      const cPrn = (m.college_prn || '').trim().toUpperCase();
      const uPrn = (m.university_prn || '').trim().toUpperCase();
      return {
        ...m,
        student_name: m.student_name.trim(),
        college_prn: cPrn,
        university_prn: uPrn,
        prn: cPrn || uPrn,
        division: m.division ? m.division.trim().toUpperCase() : '',
        mobile: m.mobile ? m.mobile.trim() : '',
        email: m.email ? m.email.trim().toLowerCase() : '',
        topic1: m.topic1 ? m.topic1.trim() : (finalTopic || ''),
        topic2: m.topic2 ? m.topic2.trim() : '',
        topic3: m.topic3 ? m.topic3.trim() : '',
        final_topic: m.final_topic ? m.final_topic.trim() : (finalTopic || ''),
        is_leader: idx === 0,
      };
    });

    setSubmitting(true);
    try {
      const payload = {
        session_id: session?.id,
        domain: chosenDomain,
        final_topic: finalTopic,
        members: membersToSubmit,
      };

      const res = await api.post('/seminar/register-group', payload);
      toast.success(res.data?.message || 'TE Seminar group registered successfully.');
      await loadData();
    } catch (err) {
      console.error('Registration submit error:', err);
      const msg = err.response?.data?.error || 'Failed to submit group registration.';
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

  // Guide and examiner display resolution
  const guideAssigned = Boolean(groupData?.guide_assigned || groupData?.guide_name);
  const guideName = groupData?.guide_name || groupData?.guideInfo?.guide_name || 'Guide not assigned yet';
  const guideDesignation = groupData?.guide_designation || groupData?.guideInfo?.guide_designation || (guideAssigned ? 'Faculty Guide' : 'Allocation pending');
  const guideEmail = groupData?.guide_email || groupData?.guideInfo?.guide_email || '—';
  const examinerName = groupData?.examiner_name || 'Not assigned yet';

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 text-slate-900">
      {/* Top Left Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
        >
          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>

        {hasSubmission ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 font-mono">
              Group #{groupData?.group_no || '—'}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-50 border border-emerald-300 text-emerald-800">
              Registration Finalized
            </span>
          </div>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-800">
            Registration Open
          </span>
        )}
      </div>

      {/* Page Title & Context */}
      <div className="border-b border-slate-200 pb-3">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">
          {session?.name || 'AY 2025-26 Sem 1'} &bull; Department of Computer Engineering
        </span>
        <h1 className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
          TE Seminar Registration & Team Portal
        </h1>
      </div>

      {/* Conflict PRN Alert Banner */}
      {conflictInfo && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-xs text-red-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-red-950">
            <span>Notice: PRN Recorded in Group #{conflictInfo.otherGroupNo}</span>
          </div>
          <p className="text-red-800 leading-relaxed">
            This University PRN ({conflictInfo.prn}) is currently mapped to <strong>Group #{conflictInfo.otherGroupNo}</strong> ({conflictInfo.otherStudentName}).
          </p>
        </div>
      )}

      {/* VIEW 1: SINGLE-PAGE REGISTRATION FORM (when student has not yet registered) */}
      {!hasSubmission && (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Top Form Header with Required Legend */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-600">
              Fill in your Final Seminar Topic, Domain, and Team Members. All members will share this record.
            </span>
            <span className="text-xs font-bold text-red-600 flex items-center gap-1">
              <span aria-hidden="true">*</span> Required
            </span>
          </div>

          {/* Error Summary Banner */}
          {summaryErrors.length > 0 && (
            <div className="p-4 rounded border border-red-300 bg-red-50 text-red-900 text-xs space-y-1">
              <p className="font-bold">Please complete the required fields:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-800 pl-2">
                {summaryErrors.map((msg, errIdx) => (
                  <li key={errIdx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: Final Seminar Topic & Domain of Interest */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Final Seminar Topic & Domain
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              {/* Final Seminar Topic */}
              <div>
                <label htmlFor="final_topic" className="block text-[11px] font-semibold text-slate-800 mb-1">
                  Final Seminar Topic <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  id="final_topic"
                  type="text"
                  placeholder="e.g. Distributed Consensus in High-Throughput Blockchain Networks"
                  value={finalSeminarTopic}
                  onChange={(e) => {
                    setFinalSeminarTopic(e.target.value);
                    if (fieldErrors['final_topic']) {
                      setFieldErrors(prev => {
                        const copy = { ...prev };
                        delete copy['final_topic'];
                        return copy;
                      });
                    }
                  }}
                  className={`w-full p-2.5 border rounded outline-none transition-colors text-xs font-medium ${
                    fieldErrors['final_topic']
                      ? 'border-red-500 bg-red-50/30 focus:border-red-600'
                      : 'border-slate-300 focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A]'
                  }`}
                />
                {fieldErrors['final_topic'] && (
                  <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors['final_topic']}</p>
                )}
              </div>

              {/* Domain (Text / Dropdown) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="domain_select" className="block text-[11px] font-semibold text-slate-800 mb-1">
                    Domain / Field of Study <span className="text-red-600 font-bold">*</span>
                  </label>
                  <select
                    id="domain_select"
                    value={isCustomDomain ? 'OTHER_CUSTOM' : domain}
                    onChange={handleDomainSelect}
                    className={`w-full p-2.5 border rounded outline-none text-xs bg-white ${
                      fieldErrors['domain']
                        ? 'border-red-500 bg-red-50/30'
                        : 'border-slate-300 focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A]'
                    }`}
                  >
                    <option value="">-- Select Domain from Dropdown --</option>
                    {standardDomains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="OTHER_CUSTOM">+ Other (Specify Custom Domain)</option>
                  </select>
                </div>

                {/* Custom domain text input if chosen */}
                {isCustomDomain && (
                  <div>
                    <label htmlFor="custom_domain_input" className="block text-[11px] font-semibold text-slate-800 mb-1">
                      Custom Domain Name <span className="text-red-600 font-bold">*</span>
                    </label>
                    <input
                      id="custom_domain_input"
                      type="text"
                      placeholder="e.g. Quantum Computing & Cryptography"
                      value={customDomain}
                      onChange={(e) => {
                        setCustomDomain(e.target.value);
                        if (fieldErrors['domain']) {
                          setFieldErrors(prev => {
                            const copy = { ...prev };
                            delete copy['domain'];
                            return copy;
                          });
                        }
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded text-xs focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A] outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Team Members & University PRNs */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2. Team Members & University PRN
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {showMember4 ? '4 Members' : '3 Members (Standard)'}
              </span>
            </div>

            <div className="space-y-4">
              {members.slice(0, showMember4 ? 4 : 3).map((m, idx) => {
                const memberNum = idx + 1;
                const nameKey = `member_${idx}_student_name`;
                const prnKey = `member_${idx}_university_prn`;

                return (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Student {memberNum}</span>
                        {idx === 0 && (
                          <span className="text-[10px] font-semibold text-[#1E2D5A] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                            TEAM LEADER
                          </span>
                        )}
                      </div>
                      {idx === 3 && (
                        <button
                          type="button"
                          onClick={() => setShowMember4(false)}
                          className="text-xs text-red-600 hover:underline font-medium"
                        >
                          Remove 4th Member Slot
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* Full Name */}
                      <div>
                        <label htmlFor={nameKey} className="block text-[11px] font-medium text-slate-700 mb-1">
                          Student Name <span className="text-red-600 font-bold">*</span>
                        </label>
                        <input
                          id={nameKey}
                          type="text"
                          placeholder="Full Name"
                          value={m.student_name}
                          onChange={(e) => handleMemberChange(idx, 'student_name', e.target.value)}
                          className={`w-full p-2 border rounded outline-none transition-colors ${
                            fieldErrors[nameKey]
                              ? 'border-red-500 bg-red-50/30'
                              : 'border-slate-300 focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A]'
                          }`}
                        />
                        {fieldErrors[nameKey] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors[nameKey]}</p>
                        )}
                      </div>

                      {/* College PRN (starts with F) */}
                      <div>
                        <label htmlFor={`member_${idx}_college_prn`} className="block text-[11px] font-medium text-slate-700 mb-1">
                          College PRN <span className="text-slate-400 font-normal">(starts with F)</span>
                        </label>
                        <input
                          id={`member_${idx}_college_prn`}
                          type="text"
                          placeholder="e.g. F23112001"
                          value={m.college_prn || ''}
                          onChange={(e) => handleMemberChange(idx, 'college_prn', e.target.value)}
                          className={`w-full p-2 border rounded font-mono uppercase outline-none transition-colors ${
                            fieldErrors[`member_${idx}_college_prn`]
                              ? 'border-red-500 bg-red-50/30'
                              : 'border-slate-300 focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A]'
                          }`}
                        />
                        {fieldErrors[`member_${idx}_college_prn`] && (
                          <p className="mt-1 text-[11px] font-medium text-red-600">{fieldErrors[`member_${idx}_college_prn`]}</p>
                        )}
                      </div>

                      {/* University PRN (starts with 723) */}
                      <div>
                        <label htmlFor={`member_${idx}_university_prn`} className="block text-[11px] font-medium text-slate-700 mb-1">
                          University PRN <span className="text-slate-400 font-normal">(starts with 723)</span>
                        </label>
                        <input
                          id={`member_${idx}_university_prn`}
                          type="text"
                          placeholder="e.g. 72312345B"
                          value={m.university_prn || ''}
                          onChange={(e) => handleMemberChange(idx, 'university_prn', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono uppercase outline-none focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A]"
                        />
                      </div>

                      {/* Division */}
                      <div>
                        <label htmlFor={`member_${idx}_division`} className="block text-[11px] font-medium text-slate-600 mb-1">
                          Division
                        </label>
                        <input
                          id={`member_${idx}_division`}
                          type="text"
                          placeholder="TE 1 / TE 2 / TE 3"
                          value={m.division}
                          onChange={(e) => handleMemberChange(idx, 'division', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded uppercase outline-none focus:border-[#1E2D5A]"
                        />
                      </div>

                      {/* Mobile Contact */}
                      <div>
                        <label htmlFor={`member_${idx}_mobile`} className="block text-[11px] font-medium text-slate-600 mb-1">
                          Mobile Number
                        </label>
                        <input
                          id={`member_${idx}_mobile`}
                          type="tel"
                          placeholder="10-digit number"
                          value={m.mobile}
                          onChange={(e) => handleMemberChange(idx, 'mobile', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono outline-none focus:border-[#1E2D5A]"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor={`member_${idx}_email`} className="block text-[11px] font-medium text-slate-600 mb-1">
                          College Email
                        </label>
                        <input
                          id={`member_${idx}_email`}
                          type="email"
                          placeholder="student@meswadiacoe.edu"
                          value={m.email}
                          onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono text-xs outline-none focus:border-[#1E2D5A]"
                        />
                      </div>
                    </div>

                    {/* Member Topics: Topic 1, Topic 2, Topic 3, and Final Topic */}
                    <div className="pt-3 border-t border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Topic Preferences & Final Topic (Student {memberNum})
                        </span>
                        <span className="text-[10px] text-slate-500">
                          3 proposed topics + final topic
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label htmlFor={`member_${idx}_topic1`} className="block text-[11px] font-medium text-slate-700 mb-1">
                            Topic 1 (Primary Preference)
                          </label>
                          <input
                            id={`member_${idx}_topic1`}
                            type="text"
                            placeholder="Proposed seminar topic 1"
                            value={m.topic1 || ''}
                            onChange={(e) => handleMemberChange(idx, 'topic1', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#1E2D5A]"
                          />
                        </div>

                        <div>
                          <label htmlFor={`member_${idx}_topic2`} className="block text-[11px] font-medium text-slate-700 mb-1">
                            Topic 2 (Secondary Preference)
                          </label>
                          <input
                            id={`member_${idx}_topic2`}
                            type="text"
                            placeholder="Proposed seminar topic 2"
                            value={m.topic2 || ''}
                            onChange={(e) => handleMemberChange(idx, 'topic2', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#1E2D5A]"
                          />
                        </div>

                        <div>
                          <label htmlFor={`member_${idx}_topic3`} className="block text-[11px] font-medium text-slate-700 mb-1">
                            Topic 3 (Tertiary Preference)
                          </label>
                          <input
                            id={`member_${idx}_topic3`}
                            type="text"
                            placeholder="Proposed seminar topic 3"
                            value={m.topic3 || ''}
                            onChange={(e) => handleMemberChange(idx, 'topic3', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded outline-none focus:border-[#1E2D5A]"
                          />
                        </div>
                      </div>

                      {/* Final Topic for this student (after their 3 topics) */}
                      <div>
                        <label htmlFor={`member_${idx}_final_topic`} className="block text-[11px] font-semibold text-[#1E2D5A] mb-1">
                          Final Topic for Student {memberNum} (After 3 Topics)
                        </label>
                        <input
                          id={`member_${idx}_final_topic`}
                          type="text"
                          placeholder={finalSeminarTopic ? `Defaults to: ${finalSeminarTopic}` : "Confirmed final seminar topic"}
                          value={m.final_topic !== undefined && m.final_topic !== '' ? m.final_topic : (finalSeminarTopic || '')}
                          onChange={(e) => handleMemberChange(idx, 'final_topic', e.target.value)}
                          className="w-full p-2 border border-blue-200 bg-blue-50/20 rounded text-xs focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A] outline-none font-medium text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
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

          {/* Submission Action Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <span className="text-slate-600">
              Submitting registers your team. Every member will see the shared Final Topic and allocated Guide.
            </span>
            <Button
              type="submit"
              disabled={submitting}
              variant="primary"
              disabledReason="Submitting registration..."
              className="shrink-0"
            >
              {submitting ? 'Submitting registration...' : 'Submit Group Registration'}
            </Button>
          </div>
        </form>
      )}

      {/* VIEW 2: REGISTERED GROUP VIEW (Team-Shared Single Page Portal) */}
      {hasSubmission && (
        <div className="space-y-6">
          {/* Group Topic & Domain Highlight Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Seminar Group Allocation & Topic
              </span>
              <span className="text-xs font-mono font-bold text-[#1E2D5A] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Group #{groupData?.group_no}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px] font-medium">Final Seminar Topic:</span>
                <p className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                  {groupData?.final_topic || 'Not recorded'}
                </p>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-medium">Domain of Interest:</span>
                <p className="text-sm font-semibold text-slate-800 mt-1">
                  {groupData?.domain || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Guide & Examiner Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Faculty Guide Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assigned Faculty Guide
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                  guideAssigned ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  {guideAssigned ? 'Guide Allocated' : 'Allocation Pending'}
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

            {/* Assigned Examiner Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assigned Examiner
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded font-medium border bg-blue-50 border-blue-200 text-blue-800">
                  Evaluation Panel
                </span>
              </div>
              <div className="pt-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {examinerName}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Assigned by Seminar Coordinator for presentations & evaluation
                </p>
              </div>
            </div>
          </div>

          {/* Team Members Roster */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Team Members
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
                    <th className="py-2.5 px-3 font-semibold">College PRN</th>
                    <th className="py-2.5 px-3 font-semibold">University PRN</th>
                    <th className="py-2.5 px-3 font-semibold">Div</th>
                    <th className="py-2.5 px-3 font-semibold">Topic 1</th>
                    <th className="py-2.5 px-3 font-semibold">Topic 2</th>
                    <th className="py-2.5 px-3 font-semibold">Topic 3</th>
                    <th className="py-2.5 px-3 font-semibold text-[#1E2D5A]">Final Topic</th>
                    <th className="py-2.5 px-3 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {membersData.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {m.student_name || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">
                        {m.college_prn || (m.prn && String(m.prn).trim().toUpperCase().startsWith('F') ? m.prn : '') || m.prn || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-800">
                        {m.university_prn || (m.prn && String(m.prn).trim().startsWith('7') ? m.prn : '') || '—'}
                      </td>
                      <td className="py-3 px-3 uppercase">
                        {m.division || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={m.topic1}>
                        {m.topic1 || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={m.topic2}>
                        {m.topic2 || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={m.topic3}>
                        {m.topic3 || '—'}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#1E2D5A] max-w-[180px]" title={m.final_topic || groupData?.final_topic}>
                        {m.final_topic || groupData?.final_topic || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {m.is_leader ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-[#1E2D5A]">
                            Leader
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Member</span>
                        )}
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
