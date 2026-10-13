import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentProject() {
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState(null);

  // Registration form state matching PDF sheet layout
  const [domain, setDomain] = useState('');
  const [title1, setTitle1] = useState('');
  const [title2, setTitle2] = useState('');
  const [title3, setTitle3] = useState('');
  const [abstract, setAbstract] = useState('');

  const [members, setMembers] = useState([
    { name: '', roll_no: '', division: 'BE-1', mobile_no: '', email: '', is_leader: true },
    { name: '', roll_no: '', division: 'BE-1', mobile_no: '', email: '', is_leader: false },
    { name: '', roll_no: '', division: 'BE-1', mobile_no: '', email: '', is_leader: false },
    { name: '', roll_no: '', division: 'BE-1', mobile_no: '', email: '', is_leader: false },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [regSettings, setRegSettings] = useState({ is_open: true });

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const [resGroup, resSettings] = await Promise.all([
        api.get('/projects/student/my-group'),
        api.get('/projects/registration-settings?academic_year=2026-27').catch(() => ({ data: { is_open: true } }))
      ]);
      setGroupData(resGroup.data);
      setRegSettings(resSettings.data);
    } catch (err) {
      toast.error('Failed to load project group data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, []);

  const handleMemberChange = (index, field, value) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleRegisterGroup = async (e) => {
    e.preventDefault();

    if (!domain.trim()) return toast.error('Please specify Project Domain Name');
    if (!title1.trim()) return toast.error('Please specify Project Title 1');
    if (!title2.trim()) return toast.error('Please specify Project Title 2');
    if (!title3.trim()) return toast.error('Please specify Project Title 3');

    // Filter active members (Student 1, 2, and 3 mandatory, Student 4 optional unless filled)
    const validMembers = members.filter((m, idx) => {
      if (idx < 3) return true;
      return m.name.trim() !== '' || m.roll_no.trim() !== '' || m.email.trim() !== '';
    });

    for (let i = 0; i < validMembers.length; i++) {
      const m = validMembers[i];
      const sNum = i + 1;
      if (!m.name.trim()) return toast.error(`Please enter Name for Student ${sNum}`);
      if (!m.roll_no.trim()) return toast.error(`Please enter College PRN for Student ${sNum}`);
      if (!m.division.trim()) return toast.error(`Please select Division for Student ${sNum}`);
      if (!m.mobile_no.trim()) return toast.error(`Please enter Mobile No for Student ${sNum}`);
      if (!m.email.trim()) return toast.error(`Please enter Email Address for Student ${sNum}`);
    }

    setSubmitting(true);
    try {
      const payload = {
        domain: domain.trim(),
        title_1: title1.trim(),
        title_2: title2.trim(),
        title_3: title3.trim(),
        abstract: abstract.trim(),
        members: validMembers,
      };

      const res = await api.post('/projects/student/groups', payload);
      toast.success(res.data.message || 'Project group registered successfully!');
      fetchProjectData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register project group');
    } finally {
      setSubmitting(false);
    }
  };



  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading BE Project details...</p>
        </div>
      </div>
    );
  }

  // ─── NO GROUP / REGISTRATION FORM VIEW ────────────────────────────────────
  if (!groupData?.hasGroup) {
    return (
      <div className="p-6 lg:p-10 w-full max-w-6xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 border border-rule rounded shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink">Project Group Registration Form</h1>
              <p className="text-sm text-draft mt-1 font-medium">
                Submit team member details and 3 project domain choices (matching departmental PDF sheet format).
              </p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-xs text-draft font-mono block">Academic Year 2026-27</span>
              {regSettings.is_open ? (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded inline-block mt-1">
                  ✓ Portal Open for Registration
                  {regSettings.due_date && (
                    <span className="block text-[10px] font-mono text-emerald-800 font-bold mt-0.5">
                      📅 Date: {new Date(regSettings.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} | ⏰ Time: {new Date(regSettings.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded inline-block mt-1">
                  🔒 Registration Closed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Short Registration Warning Strip */}
        {!regSettings.is_open && (
          <div className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-base text-red-800">
              <span>🔒</span> Registration Portal Closed
            </div>
            <p className="text-xs text-red-700 leading-relaxed font-medium font-mono">
              {regSettings.is_past_due_date
                ? `Registration deadline expired on Date: ${new Date(regSettings.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at Time: ${new Date(regSettings.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}.`
                : 'Project group registration has been closed by the BE Project Coordinator. Students cannot fill or submit this form at this time.'}
            </p>
          </div>
        )}

        {/* Full PDF Sheet Format Registration Form */}
        <form onSubmit={handleRegisterGroup} className="space-y-6">
          <fieldset disabled={!regSettings.is_open || submitting} className="space-y-6 disabled:opacity-70">
            {/* PART A: STUDENT TEAM MEMBERS DETAILS */}
            <div className="bg-white border border-rule rounded shadow-sm p-6 space-y-6">
              <div className="border-b border-rule pb-3">
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-navy text-white text-xs flex items-center justify-center font-sans font-bold">1</span>
                    Student Team Members Details
                  </h2>
                  <p className="text-xs text-draft mt-0.5">Minimum 3 students · Maximum 4 students per group</p>
                </div>
              </div>

              <div className="space-y-6 divide-y divide-rule">
                {members.map((m, idx) => {
                  const sNum = idx + 1;
                  const isRequired = idx < 3;
                  return (
                    <div key={idx} className={idx > 0 ? 'pt-6' : ''}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-serif text-base font-bold text-ink flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${isRequired ? 'bg-navy/10 text-navy border border-navy/20' : 'bg-gray-100 text-draft border border-rule'
                            }`}>
                            Student-{sNum} {idx === 0 && '(Group Leader)'}
                          </span>
                          {isRequired ? (
                            <span className="text-xs text-red-600 font-semibold">* Mandatory</span>
                          ) : (
                            <span className="text-xs text-draft italic">(Optional Member {sNum})</span>
                          )}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Name of Student */}
                        <div className="md:col-span-1 lg:col-span-1">
                          <label className="input-label text-xs font-semibold">
                            Name of Student-{sNum} {isRequired && '*'}
                          </label>
                          <input
                            type="text"
                            required={isRequired}
                            placeholder={`Full Name of Student ${sNum}`}
                            value={m.name}
                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                            className="input-field text-sm"
                          />
                        </div>

                        {/* College PRN */}
                        <div>
                          <label className="input-label text-xs font-semibold">
                            PRN No (College PRN) {isRequired && '*'}
                          </label>
                          <input
                            type="text"
                            required={isRequired}
                            placeholder="e.g. F23111031"
                            value={m.roll_no}
                            onChange={(e) => handleMemberChange(idx, 'roll_no', e.target.value)}
                            className="input-field text-sm uppercase font-mono"
                          />
                        </div>

                        {/* Division */}
                        <div>
                          <label className="input-label text-xs font-semibold">
                            Student-{sNum} Division {isRequired && '*'}
                          </label>
                          <select
                            value={m.division}
                            onChange={(e) => handleMemberChange(idx, 'division', e.target.value)}
                            className="input-field text-sm"
                            required={isRequired}
                          >
                            <option value="BE-1">BE-1</option>
                            <option value="BE-2">BE-2</option>
                            <option value="BE-3">BE-3</option>
                            <option value="BE-4">BE-4</option>
                          </select>
                        </div>

                        {/* Mobile No */}
                        <div>
                          <label className="input-label text-xs font-semibold">
                            Student-{sNum} Mobile No {isRequired && '*'}
                          </label>
                          <input
                            type="tel"
                            required={isRequired}
                            placeholder="10-digit mobile"
                            value={m.mobile_no}
                            onChange={(e) => handleMemberChange(idx, 'mobile_no', e.target.value)}
                            className="input-field text-sm font-mono"
                          />
                        </div>

                        {/* Email Address */}
                        <div>
                          <label className="input-label text-xs font-semibold">
                            Student-{sNum} Email ID {isRequired && '*'}
                          </label>
                          <input
                            type="email"
                            required={isRequired}
                            placeholder="student@gmail.com"
                            value={m.email}
                            onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                            className="input-field text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PART B: PROJECT DOMAIN & TITLE PREFERENCES */}
            <div className="bg-white border border-rule rounded shadow-sm p-6 space-y-6">
              <div className="border-b border-rule pb-3">
                <h2 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-navy text-white text-xs flex items-center justify-center font-sans font-bold">2</span>
                  Project Domain &amp; Topic Preferences
                </h2>
                <p className="text-xs text-draft mt-0.5">Specify your project domain and 3 distinct project title choices in order of preference.</p>
              </div>

              <div className="space-y-4">
                {/* Domain Name */}
                <div>
                  <label className="input-label font-bold text-ink">
                    Project Domain *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Project Domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="input-field"
                  />
                  <p className="text-[11px] text-draft mt-1">
                    Suggestions: AIML, Cyber Security, Web Development, Cloud &amp; DevOps, Data Science
                  </p>
                </div>

                {/* 3 Project Titles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="input-label font-bold text-ink">Project Title 1 (Preference 1) *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter Primary Project Title Topic..."
                      value={title1}
                      onChange={(e) => setTitle1(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>

                  <div>
                    <label className="input-label font-bold text-ink">Project Title 2 (Preference 2) *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter Secondary Project Title Topic..."
                      value={title2}
                      onChange={(e) => setTitle2(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>

                  <div>
                    <label className="input-label font-bold text-ink">Project Title 3 (Preference 3) *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter Tertiary Project Title Topic..."
                      value={title3}
                      onChange={(e) => setTitle3(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 p-4 bg-white border border-rule rounded shadow-xs">
              <button
                type="submit"
                disabled={!regSettings.is_open || submitting}
                className="btn-primary px-8 py-3 font-bold text-base flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!regSettings.is_open ? (
                  <>🔒 Registration Closed</>
                ) : submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Registering Project Group...
                  </>
                ) : (
                  <>Submit Project Registration →</>
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    );
  }

  // ─── REGISTERED / ACTIVE GROUP DASHBOARD VIEW ──────────────────────────────
  const { group, members: groupMembers, mentors: groupMentors = [], current_student, guideRequests, stages, isLeader } = groupData;
  const latestGuideReq = guideRequests.length > 0 ? guideRequests[0] : null;

  const effectiveMentors = (group.mentors && group.mentors.length > 0 ? group.mentors : groupMentors).filter((m) => {
    const guideId = group.guide_faculty_id || group.guide_id;
    const guideName = (group.guide_name || '').trim().toLowerCase();
    if (guideId && Number(m.faculty_id) === Number(guideId)) return false;
    if (guideName && (m.name || m.mentor_name || '').trim().toLowerCase() === guideName) return false;
    return true;
  });

  const isUserStudent = (ms) => {
    if (!current_student || !ms) return false;
    if (current_student.id && ms.student_id && Number(ms.student_id) === Number(current_student.id)) return true;
    if (current_student.roll_no && ms.roll_no && ms.roll_no.trim().toLowerCase() === current_student.roll_no.trim().toLowerCase()) return true;
    if (current_student.enrollment_no && ms.roll_no && ms.roll_no.trim().toLowerCase() === current_student.enrollment_no.trim().toLowerCase()) return true;
    return false;
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-white p-6 border border-rule rounded shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono font-medium text-draft bg-white border border-rule px-2.5 py-1 rounded">
              Academic Year: {group.academic_year}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${group.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
              Status: {group.status}
            </span>
          </div>

          <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink mt-3">
            {group.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-draft mt-2">
            <span>Project Domain: <strong className="text-ink">{group.domain}</strong></span>
          </div>
        </div>
      </div>

      {/* Top Grid: Project Topic Choices (2 cols) & Project Guide (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left 2 Cols: Registered Topic Choices */}
        <div className="lg:col-span-2">
          <div className="panel h-full flex flex-col">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">Registered Project Topic Choices</h2>
                <p className="text-xs text-draft mt-0.5">Submitted project topics in order of team preference</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                {[group.title, group.title_2, group.title_3].filter(Boolean).length} Preferences
              </span>
            </div>
            <div className="p-5 space-y-3 flex-1">
              {/* Primary Topic */}
              <div className="p-4 rounded-lg bg-blue-50/40 border border-blue-200/70 border-l-4 border-l-navy transition-all">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-navy text-white shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Preference 1 • Primary Topic
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink leading-relaxed">
                  {group.title}
                </h4>
              </div>

              {/* Secondary Topic */}
              {group.title_2 && (
                <div className="p-3.5 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-white text-slate-600 border border-slate-200 shadow-2xs">
                      Preference 2 • Alternative
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    {group.title_2}
                  </p>
                </div>
              )}

              {/* Tertiary Topic */}
              {group.title_3 && (
                <div className="p-3.5 rounded-lg bg-slate-50/60 border border-slate-200/80 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-white text-slate-600 border border-slate-200 shadow-2xs">
                      Preference 3 • Alternative
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    {group.title_3}
                  </p>
                </div>
              )}

              {/* Abstract Summary */}
              {group.abstract && (
                <div className="p-3.5 rounded-lg bg-amber-50/30 border border-amber-200/60 mt-3">
                  <span className="text-[11px] font-bold text-draft uppercase tracking-wider block mb-1">
                    Abstract Summary
                  </span>
                  <p className="text-xs text-ink leading-relaxed">
                    {group.abstract}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Project Guide & Mentor */}
        <div className="lg:col-span-1">
          <div className="panel h-full flex flex-col">
            <div className="panel-header">
              <h2 className="font-serif text-lg font-bold text-ink">Project Guide & Mentor</h2>
              <p className="text-xs text-draft mt-0.5">Faculty supervisor & panel mentor</p>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              {/* Top Section: Guide */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Project Guide
                </div>

                {group.guide_id ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-navy text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs border border-navy/20">
                        {(() => {
                          if (!group.guide_name) return 'PG';
                          const parts = group.guide_name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|\(Mr\.\)|\(Mrs\.\))\s*/gi, '').trim().split(/\s+/);
                          if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
                          return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'PG';
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-ink text-sm leading-snug truncate" title={group.guide_name}>
                          {group.guide_name}
                        </h3>
                        <p className="text-xs font-medium text-draft mt-0.5">
                          {group.guide_designation || 'Faculty Supervisor'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold shadow-2xs">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Approved by Project Supervisor</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg">
                      <p className="text-xs font-bold text-amber-900">Pending Coordinator Allocation</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 font-medium leading-relaxed">
                        Your project guide will be allocated directly by the Project Coordinator.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-rule/80"></div>

              {/* Bottom Section: Panel Mentor (in the blank space) */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5 mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block"></span>
                  {effectiveMentors.length > 1 ? 'Panel Mentors' : 'Panel Mentor'}
                </div>

                {effectiveMentors.length > 0 ? (
                  <div className="space-y-3">
                    {effectiveMentors.map((m, mIdx) => {
                      const mentorName = m.mentor_name || m.name || group.mentor_name;
                      const mentorDesignation = m.designation || group.mentor_designation || 'Faculty Mentor';
                      return (
                        <div key={m.faculty_id || mIdx} className="space-y-3">
                          <div className="flex items-start gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-purple-900 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs border border-purple-800/30">
                              {(() => {
                                if (!mentorName) return 'PM';
                                const parts = mentorName.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|\(Mr\.\)|\(Mrs\.\))\s*/gi, '').trim().split(/\s+/);
                                if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
                                return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'PM';
                              })()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-bold text-ink text-sm leading-snug truncate" title={mentorName}>
                                {mentorName}
                              </h3>
                              <p className="text-xs font-medium text-draft mt-0.5">
                                {mentorDesignation}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-xs font-semibold shadow-2xs">
                      <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Assigned Panel Mentor</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Pending Mentor Allocation</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
                      Panel mentor will be assigned by the Project Coordinator.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members Roster (Full-width clean table) */}
      <div className="panel overflow-hidden">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-lg font-bold text-ink">Project Team Members</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {groupMembers.length} Students
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-rule font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">College PRN</th>
                <th className="py-3 px-4">Division</th>
                <th className="py-3 px-4">Mobile No</th>
                <th className="py-3 px-4">Institutional Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {groupMembers.map((m, idx) => (
                <tr key={m.id || idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {m.is_leader ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Leader
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Member #{idx + 1}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        m.is_leader
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {m.name ? m.name.trim().charAt(0) : idx + 1}
                      </div>
                      <span className="font-semibold text-ink text-xs">{m.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono text-xs font-medium text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200">
                      {m.roll_no || m.enrollment_no}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-navy border border-blue-200/60">
                      {m.division}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-700">
                    {m.mobile_no || <span className="text-slate-300 font-mono">—</span>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <a
                      href={`mailto:${m.email}`}
                      className="font-mono text-xs text-draft hover:text-navy hover:underline transition-colors"
                    >
                      {m.email}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Stage Continuous Evaluations & Released Scores */}
      <div className="space-y-6">
        <div className="border-b border-rule pb-3">
          <h2 className="font-serif text-2xl font-bold text-ink">Evaluation Scores</h2>
          <p className="text-xs text-draft mt-0.5">Continuous assessment scores are visible once officially released by HOD.</p>
        </div>

        <div className="space-y-6">
          {stages.map((stage) => (
            <div key={stage.id} className="panel">
              <div className="panel-header flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-navy uppercase tracking-widest">
                    Stage {stage.sequence_order}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-ink">{stage.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {stage.is_released ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Scores Released
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-draft border border-rule">
                      Evaluation In Progress
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                {!stage.is_released ? (
                  <div className="p-6 bg-paper border border-dashed border-rule rounded text-center">
                    <p className="text-sm text-draft font-medium">
                      Scores and detailed panel remarks for <span className="text-ink font-semibold">{stage.name}</span> have not been released by the department yet.
                    </p>
                  </div>
                ) : stage.evaluations.length === 0 ? (
                  <div className="p-6 bg-paper border border-rule rounded text-center">
                    <p className="text-sm text-draft">No submitted evaluation record found for this stage yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {stage.evaluations.map((ev, idx) => {
                      // Derive memberScores whether already grouped by backend or fallback from criteria chunking
                      let memberScores = ev.member_scores || [];
                      if (memberScores.length === 0 && ev.scores && ev.scores.length > 0 && groupMembers && groupMembers.length > 0) {
                        const numCriteria = (stage.criteria && stage.criteria.length > 0) ? stage.criteria.length : 5;
                        memberScores = groupMembers.map((m, mIdx) => {
                          const chunk = ev.scores.slice(mIdx * numCriteria, (mIdx + 1) * numCriteria);
                          const total = chunk.reduce((sum, c) => sum + Number(c.marks_awarded || 0), 0);
                          return {
                            member_id: m.id,
                            student_id: m.student_id,
                            student_name: m.name,
                            roll_no: m.roll_no || m.enrollment_no,
                            is_leader: Boolean(m.is_leader),
                            scores: chunk,
                            total_score: Number(total.toFixed(2))
                          };
                        }).filter((m) => m.scores.length > 0);
                      }

                      const hasMemberScores = memberScores.length > 0;
                      const avgScore = memberScores.length > 0
                        ? (memberScores.reduce((sum, m) => sum + m.total_score, 0) / memberScores.length)
                        : (ev.average_score || 0);

                      return (
                        <div key={ev.evaluation_id} className="border border-rule rounded p-5 bg-white shadow-xs space-y-4">
                          {/* Panel Mentor Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rule pb-3.5">
                            <div>
                              <span className="text-xs text-draft uppercase tracking-wider font-semibold">
                                Panel Mentor #{idx + 1}
                              </span>
                              <p className="font-bold text-ink text-sm mt-0.5">
                                {ev.evaluator_name} {ev.evaluator_designation ? `(${ev.evaluator_designation})` : ''}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="block text-[10px] font-bold text-draft uppercase tracking-wider">
                                Team Average
                              </span>
                              <span className="font-serif text-lg font-bold text-navy">
                                {Number(avgScore).toFixed(2)} / {Number(stage.max_marks_total).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Team Matrix View Mode: side-by-side comparison of all members */}
                          {hasMemberScores ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-rule font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                                    <th className="p-3">Student Member</th>
                                    {stage.criteria.map((c) => (
                                      <th key={c.id} className="p-3 text-center font-mono whitespace-nowrap">
                                        {c.name} ({Number(c.max_marks)})
                                      </th>
                                    ))}
                                    <th className="p-3 text-center font-bold font-mono text-navy whitespace-nowrap">
                                      Total ({Number(stage.max_marks_total)})
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rule">
                                  {memberScores.map((ms) => {
                                    const isMe = isUserStudent(ms);
                                    return (
                                      <tr key={ms.member_id} className={`hover:bg-slate-50/70 ${isMe ? 'bg-blue-50/40 font-semibold' : ''}`}>
                                        <td className="p-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-ink">{ms.student_name}</span>
                                            {isMe && (
                                              <span className="bg-navy text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                                                You
                                              </span>
                                            )}
                                            {ms.is_leader && !isMe && (
                                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                                Leader
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-mono text-draft">{ms.roll_no}</span>
                                        </td>
                                        {stage.criteria.map((c) => {
                                          const sc = ms.scores.find((s) => s.criterion_id === c.id);
                                          return (
                                            <td key={c.id} className="p-3 text-center font-mono text-slate-700">
                                              {sc ? Number(sc.marks_awarded).toFixed(2) : '—'}
                                            </td>
                                          );
                                        })}
                                        <td className="p-3 text-center font-bold font-mono text-navy text-sm">
                                          {Number(ms.total_score).toFixed(2)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            ev.scores && ev.scores.length > 0 && (
                              <table className="w-full text-xs mb-4">
                                <thead>
                                  <tr className="border-b border-rule bg-paper text-draft text-left">
                                    <th className="p-2">Evaluation Criteria</th>
                                    <th className="p-2 text-right">Max Marks</th>
                                    <th className="p-2 text-right">Marks Awarded</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rule">
                                  {ev.scores.map((sc, scIdx) => (
                                    <tr key={sc.id || scIdx}>
                                      <td className="p-2 font-medium text-ink">{sc.criterion_name}</td>
                                      <td className="p-2 text-right text-draft font-mono">{Number(sc.max_marks).toFixed(2)}</td>
                                      <td className="p-2 text-right font-bold font-mono text-navy">{Number(sc.marks_awarded).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )
                          )}

                          {ev.overall_remarks && (
                            <div className="p-3 bg-paper border border-rule rounded text-xs text-ink">
                              <span className="font-bold text-draft uppercase tracking-wide">Overall Panel Remarks: </span>
                              {ev.overall_remarks}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

