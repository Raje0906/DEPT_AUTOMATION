import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentProject() {
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState(null);
  const [availableGuides, setAvailableGuides] = useState([]);
  
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

  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects/student/my-group');
      setGroupData(res.data);
      if (!res.data.hasGroup) {
        const gRes = await api.get('/projects/student/available-guides');
        setAvailableGuides(gRes.data);
      } else if (!res.data.group.guide_id && res.data.isLeader) {
        const gRes = await api.get('/projects/student/available-guides');
        setAvailableGuides(gRes.data);
      }
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

    // Filter active members (Student 1 and 2 mandatory, Student 3 & 4 optional unless filled)
    const validMembers = members.filter((m, idx) => {
      if (idx < 2) return true;
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

  const handleRequestGuide = async (e) => {
    e.preventDefault();
    if (!selectedGuideId) return toast.error('Please select a faculty guide');
    setSubmitting(true);
    try {
      const res = await api.post('/projects/student/guide-requests', {
        group_id: groupData.group.id,
        requested_guide_id: Number(selectedGuideId),
      });
      toast.success(res.data.message);
      fetchProjectData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit guide request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-draft">Loading BE Capstone Project details...</p>
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
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-navy font-mono text-xs font-bold rounded mb-2">
                BE CAPSTONE PROJECT REGISTRATION
              </div>
              <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink">Project Group Registration Form</h1>
              <p className="text-sm text-draft mt-1 font-medium">
                Submit team member details and 3 project domain choices (matching departmental PDF sheet format).
              </p>
            </div>
            <div className="text-right hidden md:block">
              <span className="text-xs text-draft font-mono block">Academic Year 2025-26</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded inline-block mt-1">
                Portal Open for Registration
              </span>
            </div>
          </div>
        </div>

        {/* Full PDF Sheet Format Registration Form */}
        <form onSubmit={handleRegisterGroup} className="space-y-6">
          {/* PART A: STUDENT TEAM MEMBERS DETAILS */}
          <div className="bg-white border border-rule rounded shadow-sm p-6 space-y-6">
            <div className="border-b border-rule pb-3 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-navy text-white text-xs flex items-center justify-center font-sans font-bold">1</span>
                  Student Team Members Details
                </h2>
                <p className="text-xs text-draft mt-0.5">Minimum 2 students · Maximum 4 students per group</p>
              </div>
              <span className="text-xs font-mono text-draft bg-paper px-3 py-1 border border-rule rounded">
                Table Format (Sheet Upload)
              </span>
            </div>

            <div className="space-y-6 divide-y divide-rule">
              {members.map((m, idx) => {
                const sNum = idx + 1;
                const isRequired = idx < 2;
                return (
                  <div key={idx} className={idx > 0 ? 'pt-6' : ''}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-serif text-base font-bold text-ink flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                          isRequired ? 'bg-navy/10 text-navy border border-navy/20' : 'bg-gray-100 text-draft border border-rule'
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
                  Project Domain (Write project Domain Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence, AIML, Data Science, Cyber Security, Full Stack Web Development, Blockchain, Cloud Computing, AIDS"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="input-field"
                />
                <p className="text-[11px] text-draft mt-1">
                  Suggestions: Artificial Intelligence &amp; Machine Learning (AIML), Cyber Security &amp; Cryptography, Full Stack Web Development, Cloud &amp; DevOps, Data Science &amp; Data Analytics.
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
              disabled={submitting}
              className="btn-primary px-8 py-3 font-bold text-base flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Registering Project Group...
                </>
              ) : (
                <>Submit Project Registration →</>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── REGISTERED / ACTIVE GROUP DASHBOARD VIEW ──────────────────────────────
  const { group, members: groupMembers, guideRequests, stages, isLeader } = groupData;
  const latestGuideReq = guideRequests.length > 0 ? guideRequests[0] : null;

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-white p-6 border border-rule rounded shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold text-navy bg-blue-50 border border-blue-200 px-3 py-1 rounded">
              {group.group_code}
            </span>
            <span className="text-xs font-mono font-medium text-draft bg-white border border-rule px-2.5 py-1 rounded">
              Academic Year: {group.academic_year} · {group.batch}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
              group.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
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

      {/* Grid Layout: Titles, Roster & Guide */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 3 Project Titles & Team Roster */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Title Preferences */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="font-serif text-lg font-bold">Registered Project Topic Choices</h2>
            </div>
            <div className="p-5 space-y-3 divide-y divide-rule">
              <div>
                <span className="text-[10px] font-mono font-bold text-navy uppercase tracking-wider bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Project Title 1 (Primary Topic)
                </span>
                <p className="text-sm font-semibold text-ink mt-1">{group.title}</p>
              </div>

              {group.title_2 && (
                <div className="pt-3">
                  <span className="text-[10px] font-mono font-bold text-draft uppercase tracking-wider bg-gray-100 border border-rule px-2 py-0.5 rounded">
                    Project Title 2 (Secondary Topic)
                  </span>
                  <p className="text-sm text-ink mt-1">{group.title_2}</p>
                </div>
              )}

              {group.title_3 && (
                <div className="pt-3">
                  <span className="text-[10px] font-mono font-bold text-draft uppercase tracking-wider bg-gray-100 border border-rule px-2 py-0.5 rounded">
                    Project Title 3 (Tertiary Topic)
                  </span>
                  <p className="text-sm text-ink mt-1">{group.title_3}</p>
                </div>
              )}

              {group.abstract && (
                <div className="pt-3">
                  <span className="text-xs font-bold text-draft uppercase tracking-wide">Abstract Summary:</span>
                  <p className="text-xs text-ink leading-relaxed mt-1">{group.abstract}</p>
                </div>
              )}
            </div>
          </div>

          {/* Team Members Roster (PDF Sheet Table Format) */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Student Team Roster ({groupMembers.length}/4)</h2>
              <span className="text-xs text-draft font-mono">Departmental Format</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-paper border-b border-rule font-bold text-draft">
                    <th className="p-3">Role</th>
                    <th className="p-3">Name of Student</th>
                    <th className="p-3">College PRN</th>
                    <th className="p-3">Division</th>
                    <th className="p-3">Mobile No</th>
                    <th className="p-3">Email Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {groupMembers.map((m, idx) => (
                    <tr key={m.id || idx} className="hover:bg-paper/50 font-medium">
                      <td className="p-3 whitespace-nowrap">
                        {m.is_leader ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                            LEADER
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-draft text-[10px] font-bold px-2 py-0.5 rounded border border-rule">
                            MEMBER #{idx + 1}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-ink whitespace-nowrap">{m.name}</td>
                      <td className="p-3 font-mono text-navy whitespace-nowrap">{m.roll_no || m.enrollment_no}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{m.division}</td>
                      <td className="p-3 font-mono whitespace-nowrap">{m.mobile_no || '—'}</td>
                      <td className="p-3 font-mono text-draft whitespace-nowrap">{m.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Project Guide Allocation */}
        <div className="space-y-6">
          <div className="panel">
            <div className="panel-header">
              <h2 className="font-serif text-lg font-bold">Project Guide</h2>
            </div>
            <div className="p-5">
              {group.guide_id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-sm">
                      {group.guide_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm">{group.guide_name}</p>
                      <p className="text-xs text-draft">{group.guide_designation}</p>
                      <p className="text-xs font-mono text-navy mt-0.5">{group.guide_email}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-medium">
                    ✓ Approved Project Supervisor assigned.
                  </div>
                </div>
              ) : latestGuideReq && latestGuideReq.status === 'PENDING' ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Request Pending Approval</p>
                    <p className="text-sm font-semibold text-ink mt-1">{latestGuideReq.requested_guide_name}</p>
                    <p className="text-xs text-draft mt-0.5">{latestGuideReq.designation}</p>
                  </div>
                  <p className="text-xs text-draft italic">
                    Awaiting confirmation from faculty. You will be notified once approved.
                  </p>
                </div>
              ) : isLeader ? (
                <form onSubmit={handleRequestGuide} className="space-y-4">
                  <div>
                    <label className="input-label">Select Faculty Guide *</label>
                    <select
                      value={selectedGuideId}
                      onChange={(e) => setSelectedGuideId(e.target.value)}
                      className="input-field"
                      required
                    >
                      <option value="">Select Faculty Guide...</option>
                      {availableGuides.map((g) => (
                        <option key={g.faculty_id} value={g.faculty_id} disabled={g.current_guided_groups >= 5}>
                          {g.name} ({g.designation}) — {g.current_guided_groups}/5 groups
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" disabled={submitting} className="btn-primary w-full text-center">
                    {submitting ? 'Submitting...' : 'Request Guide Selection'}
                  </button>
                </form>
              ) : (
                <p className="text-xs text-draft italic">
                  Guide request not yet initiated. Group leader must select a guide.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section: Stage Continuous Evaluations & Released Scores */}
      <div className="space-y-6">
        <div className="border-b border-rule pb-3">
          <h2 className="font-serif text-2xl font-bold text-ink">Evaluation Stages &amp; Continuous Assessment Scores</h2>
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
                  {stage.is_released && stage.aggregated_score !== null && (
                    <span className="font-serif text-xl font-bold text-navy bg-blue-50 border border-blue-200 px-3 py-1 rounded">
                      {stage.aggregated_score} / {stage.max_marks_total}
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
                    {stage.evaluations.map((ev, idx) => (
                      <div key={ev.evaluation_id} className="border border-rule rounded p-5 bg-white shadow-xs">
                        <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
                          <div>
                            <span className="text-xs text-draft uppercase tracking-wider font-semibold">Panel Examiner #{idx + 1}</span>
                            <p className="font-bold text-ink text-sm">{ev.evaluator_name} ({ev.evaluator_designation})</p>
                          </div>
                          <span className="font-serif text-lg font-bold text-navy">
                            Score: {ev.total_score} / {stage.max_marks_total}
                          </span>
                        </div>

                        {/* Criteria Scores Table */}
                        <table className="w-full text-xs mb-4">
                          <thead>
                            <tr className="border-b border-rule bg-paper text-draft text-left">
                              <th className="p-2">Evaluation Rubric Criterion</th>
                              <th className="p-2 text-right">Max</th>
                              <th className="p-2 text-right">Awarded</th>
                              <th className="p-2">Examiner Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-rule">
                            {ev.scores.map((sc) => (
                              <tr key={sc.criterion_id}>
                                <td className="p-2 font-medium text-ink">{sc.criterion_name}</td>
                                <td className="p-2 text-right text-draft font-mono">{sc.max_marks}</td>
                                <td className="p-2 text-right font-bold font-mono text-navy">{sc.marks_awarded}</td>
                                <td className="p-2 text-draft italic">{sc.remark || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {ev.overall_remarks && (
                          <div className="p-3 bg-paper border border-rule rounded text-xs text-ink">
                            <span className="font-bold text-draft uppercase tracking-wide">Overall Panel Remarks: </span>
                            {ev.overall_remarks}
                          </div>
                        )}
                      </div>
                    ))}
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

