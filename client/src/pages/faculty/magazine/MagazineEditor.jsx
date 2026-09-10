import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMagazine, MAGAZINE_SECTIONS } from '../../../contexts/MagazineContext';
import SectionSidebar from '../../../components/magazine/SectionSidebar';
import SectionEditor  from '../../../components/magazine/SectionEditor';
import AIPanel        from '../../../components/magazine/AIPanel';
import toast from 'react-hot-toast';

export default function MagazineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentMagazine, loadMagazine, saveDraft, submitForApproval, magazineStatus, activeSection, setActiveSection } = useMagazine();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    if (id && (!currentMagazine || currentMagazine.id !== id)) {
      loadMagazine(id);
    }
  }, [id, currentMagazine, loadMagazine]);

  const sectionLabel = MAGAZINE_SECTIONS.find(s => s.id === activeSection)?.label || '';

  const handleSubmit = () => {
    submitForApproval();
    setShowSubmitConfirm(false);
    toast.success('Magazine submitted for approval. The HOD will review and approve it.');
  };

  const statusBadge = {
    draft: { label: 'Draft', cls: 'badge-draft' },
    under_review: { label: 'Under Review', cls: 'badge-submitted' },
    approved: { label: 'Approved', cls: 'badge-approved' },
    published: { label: 'Published', cls: 'badge-published' },
  }[magazineStatus] || { label: 'Draft', cls: 'badge-draft' };

  return (
    <div className="flex flex-col h-screen bg-paper overflow-hidden">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-rule flex-shrink-0 flex-wrap">
        <button
          onClick={() => navigate('/faculty/magazines')}
          className="flex items-center gap-1.5 text-xs text-draft hover:text-navy font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Dashboard
        </button>
        <span className="text-draft">|</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-ink truncate">
            {currentMagazine?.title || 'New Magazine'}{' '}
            {currentMagazine?.issueNumber && <span className="text-draft font-normal">Issue {currentMagazine.issueNumber}</span>}
          </span>
        </div>
        <span className={statusBadge.cls}>{statusBadge.label}</span>

        {/* Mobile section toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="lg:hidden p-1.5 border border-rule rounded-sm text-draft hover:bg-paper transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { saveDraft(); toast.success('Draft saved.'); }}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Save Draft
          </button>
          <button
            onClick={() => navigate(`/faculty/magazines/preview/${id || 'new'}`)}
            className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors text-draft"
          >
            Preview
          </button>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={magazineStatus === 'under_review'}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit for Approval
          </button>
        </div>
      </header>

      {/* 3-column editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* LEFT — Section sidebar */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-30 w-56 flex-shrink-0
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:flex
        `} style={{ top: 'auto' }}>
          <SectionSidebar onSave={() => setSidebarOpen(false)} />
        </div>

        {/* CENTER — Content editor */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {/* Section breadcrumb */}
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <div className="flex items-center gap-2 text-xs text-draft">
              <span>Sections</span>
              <span>/</span>
              <span className="text-ink font-semibold">{sectionLabel}</span>
            </div>
            <div className="flex gap-1">
              {MAGAZINE_SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-2 h-2 rounded-full transition-colors ${s.id === activeSection ? 'bg-navy' : 'bg-rule hover:bg-draft'}`}
                  title={s.label}
                />
              ))}
            </div>
          </div>
          <SectionEditor />
        </div>

        {/* RIGHT — AI Panel */}
        <aside className="hidden xl:flex w-60 flex-shrink-0 border-l border-rule bg-white overflow-y-auto">
          <div className="p-4 w-full">
            <AIPanel
              onAccept={(result) => {
                toast.success(`AI content accepted: ${result.records?.length || 0} records added to ${result.section}.`);
              }}
            />
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-md w-full p-6 shadow-xl">
            <h3 className="font-serif text-xl font-bold text-ink mb-2">Submit for Approval</h3>
            <p className="text-sm text-draft mb-4">
              The magazine will be sent to the HOD for review and approval. You will not be able to edit it while it is under review.
            </p>
            <div className="bg-amber-50 border border-pending rounded-sm p-3 mb-5 text-xs text-pending font-medium">
              ⚠ Please ensure all sections are complete and content has been reviewed before submitting.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSubmit} className="btn-primary text-sm">Submit for Approval</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
