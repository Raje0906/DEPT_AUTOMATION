import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function StudentProject() {
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState(null);
  const [availableGuides, setAvailableGuides] = useState([]);
  
  // Forms state
  const [activeForm, setActiveForm] = useState('none'); // 'create' | 'join' | 'none'
  const [createForm, setCreateForm] = useState({ title: '', domain: '', abstract: '', batch: 'BE-CE-A' });
  const [joinCode, setJoinCode] = useState('');
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects/student/my-group');
      setGroupData(res.data);
      if (!res.data.hasGroup) {
        // Fetch available guides if user might create a group
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

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/projects/student/groups', createForm);
      toast.success(res.data.message);
      setActiveForm('none');
      fetchProjectData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/projects/student/groups/join', { group_code: joinCode });
      toast.success(res.data.message);
      setActiveForm('none');
      fetchProjectData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join group');
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
          <p className="text-sm font-medium text-draft">Loading BE Project details...</p>
        </div>
      </div>
    );
  }

  // ─── NO GROUP VIEW ────────────────────────────────────────────────────────
  if (!groupData?.hasGroup) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-5xl mx-auto">
        <div className="mb-8 pb-5 border-b border-rule">
          <h1 className="font-serif text-3xl font-bold text-ink">BE Capstone Project</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Final Year (BE) Project Group Registration &amp; Continuous Assessment Portal
          </p>
        </div>

        {activeForm === 'none' ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Group Box */}
            <div className="bg-white p-6 border border-rule rounded shadow-sm hover:border-navy transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-navy mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-bold text-ink">Form a New Project Group</h2>
                <p className="text-sm text-draft mt-2">
                  Create a new BE Project group, define your project title, domain track, and abstract. You will become the group leader and can invite team members.
                </p>
              </div>
              <button
                onClick={() => setActiveForm('create')}
                className="mt-6 w-full btn-primary py-2.5 text-center font-semibold"
              >
                Create Group →
              </button>
            </div>

            {/* Join Group Box */}
            <div className="bg-white p-6 border border-rule rounded shadow-sm hover:border-navy transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197m0 0A9.094 9.094 0 012.25 18.24" />
                  </svg>
                </div>
                <h2 className="font-serif text-xl font-bold text-ink">Join Existing Group</h2>
                <p className="text-sm text-draft mt-2">
                  Already have a group created by your team leader? Enter the unique Group Code (e.g. <code className="font-mono text-navy">GRP-2026-01</code>) to join instantly.
                </p>
              </div>
              <button
                onClick={() => setActiveForm('join')}
                className="mt-6 w-full px-4 py-2.5 bg-paper border border-rule font-semibold text-ink hover:bg-gray-100 rounded transition-colors text-center"
              >
                Join with Code →
              </button>
            </div>
          </div>
        ) : activeForm === 'create' ? (
          <div className="bg-white p-6 border border-rule rounded shadow-md max-w-2xl mx-auto">
            <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
              <h2 className="font-serif text-xl font-bold text-ink">Register Project Group</h2>
              <button onClick={() => setActiveForm('none')} className="text-xs text-draft hover:text-ink">✕ Cancel</button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="input-label">Project Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Autonomous Drone Navigation using Edge AI"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Domain / Track *</label>
                  <select
                    value={createForm.domain}
                    onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Select Domain...</option>
                    <option value="AI / Edge Computing">AI / Edge Computing</option>
                    <option value="Blockchain & Cryptography">Blockchain &amp; Cryptography</option>
                    <option value="Cloud & Distributed Systems">Cloud &amp; Distributed Systems</option>
                    <option value="Embedded Systems & IoT">Embedded Systems &amp; IoT</option>
                    <option value="NLP & Generative AI">NLP &amp; Generative AI</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Division / Batch</label>
                  <input
                    type="text"
                    value={createForm.batch}
                    onChange={(e) => setCreateForm({ ...createForm, batch: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="input-label">Abstract / Brief Summary</label>
                <textarea
                  rows={4}
                  placeholder="Outline the core problem statement, proposed methodology, and expected outcomes..."
                  value={createForm.abstract}
                  onChange={(e) => setCreateForm({ ...createForm, abstract: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setActiveForm('none')}
                  className="px-4 py-2 border border-rule text-xs font-semibold rounded hover:bg-paper"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Creating...' : 'Register Group'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white p-6 border border-rule rounded shadow-md max-w-md mx-auto">
            <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
              <h2 className="font-serif text-xl font-bold text-ink">Join Project Group</h2>
              <button onClick={() => setActiveForm('none')} className="text-xs text-draft hover:text-ink">✕ Cancel</button>
            </div>
            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="input-label">Enter Group Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GRP-2026-01"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="input-field uppercase font-mono tracking-wider font-bold"
                />
                <p className="text-xs text-draft mt-1">Get this code from your project group leader.</p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setActiveForm('none')}
                  className="px-4 py-2 border border-rule text-xs font-semibold rounded hover:bg-paper"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ─── ACTIVE GROUP VIEW ────────────────────────────────────────────────────
  const { group, members, guideRequests, stages, isLeader } = groupData;
  const latestGuideReq = guideRequests.length > 0 ? guideRequests[0] : null;

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-navy bg-blue-50 border border-blue-200 px-3 py-1 rounded">
              {group.group_code}
            </span>
            <span className="text-xs font-mono font-medium text-draft bg-white border border-rule px-2.5 py-1 rounded">
              {group.academic_year} · {group.batch}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold ${
              group.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {group.status}
            </span>
          </div>
          <h1 className="font-serif text-2xl lg:text-3xl font-bold text-ink mt-2">{group.title}</h1>
          <p className="text-sm text-draft mt-1 font-medium">Domain: <span className="text-ink font-semibold">{group.domain}</span></p>
        </div>
      </div>

      {/* Grid Layout: Group Roster & Guide Status */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Group Members & Abstract */}
        <div className="lg:col-span-2 space-y-6">
          {/* Abstract */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="font-serif text-lg font-bold">Project Abstract &amp; Scope</h2>
            </div>
            <div className="p-5 text-sm text-ink leading-relaxed">
              {group.abstract || <span className="text-draft italic">No abstract provided yet.</span>}
            </div>
          </div>

          {/* Roster */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Team Members ({members.length}/4)</h2>
              <span className="text-xs text-draft font-mono">Min 2 · Max 4</span>
            </div>
            <div className="divide-y divide-rule">
              {members.map((m) => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-paper/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy/10 border border-navy/20 flex items-center justify-center font-bold text-navy text-xs">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{m.name}</span>
                        {m.is_leader && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                            LEADER
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-draft font-mono mt-0.5">{m.roll_no} · {m.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium text-draft bg-gray-100 px-2 py-1 rounded">
                    {m.division}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Guide Allocation Status */}
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
                    <label className="input-label">Select Project Guide *</label>
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
        <div className="border-b border-rule pb-3 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Evaluation Stages &amp; Score Cards</h2>
            <p className="text-xs text-draft mt-0.5">Continuous assessment scores are visible once officially released by HOD.</p>
          </div>
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
