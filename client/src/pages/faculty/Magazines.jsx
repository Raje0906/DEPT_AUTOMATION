import React, { useState } from 'react';
import toast from 'react-hot-toast';

const publications = [
  {
    id: 'MAG-2024-02',
    title: 'BYTE — The Annual Tech Magazine (Vol. XII)',
    tag: 'Annual Department Magazine',
    year: '2024–25 Edition',
    editors: 'Prof. Rajan Mehta (Chief Editor), Anuja Aher (Student Editor)',
    theme: 'Frontiers of Generative AI and Quantum Paradigms',
    articlesCount: 24,
    downloads: 412,
    badge: 'Latest Issue',
    status: 'Published',
  },
  {
    id: 'MAG-2024-01',
    title: 'TechnoWadia Research Bulletin (Issue 8)',
    tag: 'Peer-Reviewed Department Journal',
    year: 'Winter 2024',
    editors: 'Dr. Meera Krishnan (HOD), Prof. Sunita Patil',
    theme: 'Edge Computing, Distributed Systems & Green Cloud',
    articlesCount: 16,
    downloads: 328,
    badge: 'Research Digest',
    status: 'Published',
  },
  {
    id: 'MAG-2023-02',
    title: 'Algorithmica — Coding Club & Hackathon Chronicles',
    tag: 'Quarterly Technical Newsletter',
    year: 'Term I 2024',
    editors: 'Prof. Arjun Sharma, Aditya Mishra (TE Comp)',
    theme: 'Smart India Hackathon Winning Submissions & Project Case Studies',
    articlesCount: 18,
    downloads: 290,
    badge: 'Student Special',
    status: 'Archived',
  },
  {
    id: 'MAG-2023-01',
    title: 'CyberChronicle — Information Security Quarterly',
    tag: 'Special Domain Digest',
    year: 'Fall 2023',
    editors: 'Prof. Rajan Mehta, Student Cyber Cell',
    theme: 'Zero-Day Vulnerability Disclosures and Defensive Architecture',
    articlesCount: 14,
    downloads: 195,
    badge: 'Security Cell',
    status: 'Archived',
  },
];

export default function Magazines() {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [article, setArticle] = useState({
    title: '',
    author: '',
    magazine: 'BYTE — The Annual Tech Magazine (Vol. XIII)',
    category: 'Technical Article',
    abstract: '',
  });

  const handleSubmitArticle = (e) => {
    e.preventDefault();
    if (!article.title.trim() || !article.abstract.trim()) {
      toast.error('Please complete all article fields');
      return;
    }
    toast.success('Manuscript submitted successfully for editorial review!');
    setShowSubmitModal(false);
    setArticle({
      title: '',
      author: '',
      magazine: 'BYTE — The Annual Tech Magazine (Vol. XIII)',
      category: 'Technical Article',
      abstract: '',
    });
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Department Magazines &amp; Publications</h1>
          <p className="text-base text-draft mt-1 font-medium">
            MES Wadia COE Computer Engineering · Technical Periodicals, Bulletins &amp; Research Chronicles
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="btn-primary self-start sm:self-auto"
        >
          + Submit Article / Manuscript
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Published Editions</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">12</p>
          <p className="text-xs text-draft mt-1 font-medium">Vol. I through Vol. XII</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Active Editorial Call</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">Vol. XIII</p>
          <p className="text-xs text-pass mt-1 font-medium">Submissions open till 30 Mar</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Faculty Papers</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">48</p>
          <p className="text-xs text-draft mt-1 font-medium">Indexed publications</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Reads &amp; DLs</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">1,225</p>
          <p className="text-xs text-draft mt-1 font-medium">Academic Year 2024–25</p>
        </div>
      </div>

      {/* Magazine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {publications.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-rule rounded-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold text-navy uppercase tracking-wider">
                  {item.year}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-navy">
                  {item.badge}
                </span>
              </div>
              <h2 className="font-serif text-xl font-bold text-ink mb-2 leading-snug">
                {item.title}
              </h2>
              <p className="text-xs font-medium text-maroon mb-3 uppercase tracking-wider">
                Theme: {item.theme}
              </p>
              <p className="text-xs text-draft leading-relaxed mb-4">
                <span className="font-semibold text-ink">Editorial Board:</span> {item.editors}
              </p>
            </div>

            <div className="pt-4 border-t border-rule flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-draft font-mono">
                <span>{item.articlesCount} Articles</span>
                <span>·</span>
                <span>{item.downloads} Downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.success(`Opening digital reader for ${item.title}`)}
                  className="px-3 py-1.5 border border-rule hover:bg-paper text-ink text-xs font-medium rounded transition-colors"
                >
                  Read Issue
                </button>
                <button
                  onClick={() => toast.success(`Initiating PDF download for ${item.title}`)}
                  className="px-3 py-1.5 bg-navy hover:bg-[#162142] text-white text-xs font-semibold rounded shadow-sm transition-colors"
                >
                  Download PDF ↓
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manuscript Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-lg w-full p-6 shadow-xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink mb-2">
              Submit Manuscript to Department Magazine
            </h3>
            <p className="text-xs text-draft mb-4">
              All submissions undergo double-blind review by the Faculty Editorial Board.
            </p>

            <form onSubmit={handleSubmitArticle} className="space-y-4">
              <div>
                <label className="input-label">Article / Paper Title</label>
                <input
                  type="text"
                  value={article.title}
                  onChange={(e) => setArticle({ ...article, title: e.target.value })}
                  placeholder="e.g. Advancements in Quantum Key Distribution Protocols"
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Select Publication</label>
                  <select
                    value={article.magazine}
                    onChange={(e) => setArticle({ ...article, magazine: e.target.value })}
                    className="input-field"
                  >
                    <option>BYTE — Annual Tech Magazine (Vol. XIII)</option>
                    <option>TechnoWadia Research Bulletin (Issue 9)</option>
                    <option>Algorithmica Chronicles</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Category</label>
                  <select
                    value={article.category}
                    onChange={(e) => setArticle({ ...article, category: e.target.value })}
                    className="input-field"
                  >
                    <option>Technical Article</option>
                    <option>Faculty Research Paper</option>
                    <option>Student Project Showcase</option>
                    <option>Industry Case Study</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Primary Author(s) &amp; Designation</label>
                <input
                  type="text"
                  value={article.author}
                  onChange={(e) => setArticle({ ...article, author: e.target.value })}
                  placeholder="e.g. Prof. Rajan Mehta &amp; TE Group 02"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="input-label">Abstract / Summary (Max 250 words)</label>
                <textarea
                  rows={4}
                  value={article.abstract}
                  onChange={(e) => setArticle({ ...article, abstract: e.target.value })}
                  placeholder="Briefly state objectives, methodology, key findings, and technical significance..."
                  className="input-field"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 border border-rule rounded-sm text-xs font-medium text-draft hover:bg-paper transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit for Editorial Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
