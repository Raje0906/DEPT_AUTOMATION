import React, { useState } from 'react';
import toast from 'react-hot-toast';

const initialProjects = [
  {
    id: 'GRP-2025-01',
    title: 'Autonomous Drone Navigation using Edge AI and Computer Vision',
    domain: 'Artificial Intelligence / Edge Computing',
    guide: 'Prof. Rajan Mehta',
    members: ['Aadish Sonawane (01)', 'Vishwaja Achawale (02)', 'Aditya Mishra (03)'],
    stage: 'Final Defense',
    status: 'Evaluated',
    score: 88,
    grade: 'A+',
  },
  {
    id: 'GRP-2025-04',
    title: 'Zero-Knowledge Proof Identity Verification on Decentralized Ledgers',
    domain: 'Blockchain & Cryptography',
    guide: 'Prof. Sunita Patil',
    members: ['Aditya Patil (04)', 'Anuja Aher (05)', 'Amey Joshi (06)'],
    stage: 'Review Phase II',
    status: 'Pending',
    score: null,
    grade: null,
  },
  {
    id: 'GRP-2025-08',
    title: 'Multi-Tenant Kubernetes Autoscaling via Predictive Traffic Loaders',
    domain: 'Cloud & Distributed Systems',
    guide: 'Prof. Arjun Sharma',
    members: ['Chinmay Deshmukh (08)', 'Divya Kulkarni (09)', 'Gaurav Shinde (10)'],
    stage: 'Final Defense',
    status: 'Evaluated',
    score: 92,
    grade: 'O',
  },
  {
    id: 'GRP-2025-12',
    title: 'IoT Real-time Water Quality Monitoring and Spectral Contaminant Detection',
    domain: 'Embedded Systems & IoT',
    guide: 'Prof. Rajan Mehta',
    members: ['Harsh Vardhan (12)', 'Isha Pawar (13)', 'Karan Jagtap (14)'],
    stage: 'Review Phase II',
    status: 'Pending',
    score: null,
    grade: null,
  },
  {
    id: 'GRP-2025-15',
    title: 'Cross-lingual Indian Legal Document Summarization using LLMs',
    domain: 'NLP & Generative AI',
    guide: 'Prof. Sunita Patil',
    members: ['Manasi Tambe (15)', 'Nikhil Gaikwad (16)', 'Omkar Salunkhe (17)'],
    stage: 'Review Phase I',
    status: 'Evaluated',
    score: 81,
    grade: 'A',
  },
];

export default function ProjectEval() {
  const [projects, setProjects] = useState(initialProjects);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [rubric, setRubric] = useState({
    litReview: 18,
    designArch: 22,
    codeQuality: 26,
    vivaDemo: 22,
    remarks: 'Consistent technical progress and solid hardware test bench demonstration.',
  });

  const filtered = projects.filter((p) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return p.status === 'Pending';
    if (activeTab === 'evaluated') return p.status === 'Evaluated';
    return true;
  });

  const handleOpenEvaluate = (proj) => {
    setSelectedGroup(proj);
    setRubric({
      litReview: 18,
      designArch: 22,
      codeQuality: 25,
      vivaDemo: 23,
      remarks: proj.score ? `Review complete. Grade ${proj.grade}` : 'Good demonstration of working prototype.',
    });
  };

  const handleSaveEvaluation = (e) => {
    e.preventDefault();
    const total = Number(rubric.litReview) + Number(rubric.designArch) + Number(rubric.codeQuality) + Number(rubric.vivaDemo);
    let grade = 'P';
    if (total >= 90) grade = 'O';
    else if (total >= 80) grade = 'A+';
    else if (total >= 70) grade = 'A';
    else if (total >= 60) grade = 'B+';
    else if (total >= 50) grade = 'B';

    setProjects(
      projects.map((p) =>
        p.id === selectedGroup.id
          ? { ...p, status: 'Evaluated', score: total, grade }
          : p
      )
    );
    toast.success(`Evaluation recorded for ${selectedGroup.id} (Score: ${total}/100, Grade: ${grade})`);
    setSelectedGroup(null);
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Project Evaluation</h1>
          <p className="text-base text-draft mt-1 font-medium">
            BE Capstone &amp; TE Mini-Project Continuous Evaluation Rubrics · 2024–25
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-draft bg-white border border-rule px-3 py-1.5 rounded">
            Stage: Phase II / Final Viva
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Assigned Groups</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{projects.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">Total 15 students</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Evaluated</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">
            {projects.filter((p) => p.status === 'Evaluated').length}
          </p>
          <p className="text-xs text-pass mt-1 font-medium">Rubrics uploaded</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Pending Review</p>
          <p className="font-serif text-3xl font-bold text-[#7A6830] mt-1">
            {projects.filter((p) => p.status === 'Pending').length}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Viva scheduled this week</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Avg Group Score</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">87.0</p>
          <p className="text-xs text-draft mt-1 font-medium">Scale out of 100</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            activeTab === 'all'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          All Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            activeTab === 'pending'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Pending Review (2)
        </button>
        <button
          onClick={() => setActiveTab('evaluated')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            activeTab === 'evaluated'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Completed (3)
        </button>
      </div>

      {/* Projects Table */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Project Groups &amp; Viva Assessment</h2>
          <span className="text-xs font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">
            Internal Examiner Panel
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th>Group ID</th>
                <th>Project Title &amp; Domain</th>
                <th>Team Members</th>
                <th>Project Guide</th>
                <th>Current Stage</th>
                <th className="numeric">Score (100)</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proj) => (
                <tr key={proj.id}>
                  <td className="font-mono text-sm font-bold text-navy">{proj.id}</td>
                  <td className="max-w-md">
                    <div className="font-semibold text-ink text-sm leading-snug">{proj.title}</div>
                    <div className="text-xs text-draft mt-0.5">{proj.domain}</div>
                  </td>
                  <td className="text-xs text-draft">
                    {proj.members.map((m, idx) => (
                      <div key={idx} className="truncate">{m}</div>
                    ))}
                  </td>
                  <td className="font-medium text-xs text-ink">{proj.guide}</td>
                  <td className="font-mono text-xs text-navy font-semibold">{proj.stage}</td>
                  <td className="numeric font-bold text-base">
                    {proj.score !== null ? (
                      <span>
                        {proj.score}{' '}
                        <span className="text-xs font-semibold text-pass">({proj.grade})</span>
                      </span>
                    ) : (
                      <span className="text-draft font-normal">—</span>
                    )}
                  </td>
                  <td>
                    {proj.status === 'Evaluated' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Evaluated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleOpenEvaluate(proj)}
                      className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded shadow-sm transition-colors ${
                        proj.status === 'Pending'
                          ? 'bg-maroon hover:bg-[#4E1C27] text-white'
                          : 'border border-rule hover:bg-gray-100 text-ink'
                      }`}
                    >
                      {proj.status === 'Pending' ? 'Score Group →' : 'Edit Rubric'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rubric Evaluation Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-lg w-full p-6 shadow-xl animate-fade-in">
            <div className="border-b border-rule pb-3 mb-4">
              <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                {selectedGroup.id} · {selectedGroup.stage}
              </span>
              <h3 className="font-serif text-lg font-bold text-ink mt-1 leading-snug">
                {selectedGroup.title}
              </h3>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Literature Review &amp; Scope (Max 20)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={rubric.litReview}
                    onChange={(e) => setRubric({ ...rubric, litReview: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">System Architecture (Max 25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={rubric.designArch}
                    onChange={(e) => setRubric({ ...rubric, designArch: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Implementation &amp; Code (Max 30)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={rubric.codeQuality}
                    onChange={(e) => setRubric({ ...rubric, codeQuality: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Live Viva &amp; Demo (Max 25)</label>
                  <input
                    type="number"
                    min="0"
                    max="25"
                    value={rubric.vivaDemo}
                    onChange={(e) => setRubric({ ...rubric, vivaDemo: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-paper border border-rule rounded-sm flex items-center justify-between">
                <span className="text-xs font-semibold text-draft uppercase tracking-wide">
                  Calculated Total Score
                </span>
                <span className="text-xl font-bold font-serif text-navy">
                  {Number(rubric.litReview || 0) +
                    Number(rubric.designArch || 0) +
                    Number(rubric.codeQuality || 0) +
                    Number(rubric.vivaDemo || 0)}{' '}
                  / 100
                </span>
              </div>

              <div>
                <label className="input-label">Examiner Remarks &amp; Suggestions</label>
                <textarea
                  rows={3}
                  value={rubric.remarks}
                  onChange={(e) => setRubric({ ...rubric, remarks: e.target.value })}
                  className="input-field"
                  placeholder="Record strengths, bug observations or suggestions for publication..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
                  className="px-4 py-2 border border-rule rounded-sm text-xs font-medium text-draft hover:bg-paper transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
