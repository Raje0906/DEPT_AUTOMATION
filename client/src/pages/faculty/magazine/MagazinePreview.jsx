import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMagazine } from '../../../contexts/MagazineContext';
import PagePreview from '../../../components/magazine/PagePreview';
import PageEditorModal from '../../../components/magazine/PageEditorModal';
import toast from 'react-hot-toast';

const APPROVAL_STATUS = [
  { id: 'draft',        label: 'Draft',              color: 'text-draft',   dot: 'bg-rule' },
  { id: 'ai_generated', label: 'AI Generated',        color: 'text-navy',    dot: 'bg-navy' },
  { id: 'under_review', label: 'Under Review',        color: 'text-pending', dot: 'bg-pending' },
  { id: 'approved',     label: 'Approved',            color: 'text-pass',    dot: 'bg-pass' },
  { id: 'published',    label: 'Published',           color: 'text-pass',    dot: 'bg-pass' },
];

export default function MagazinePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentMagazine, loadMagazine, magazineStatus, submitForApproval, saveDraft } = useMagazine();
  const [editingPage, setEditingPage] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(magazineStatus === 'under_review');

  React.useEffect(() => {
    if (id && (!currentMagazine || currentMagazine.id !== id)) {
      loadMagazine(id);
    }
  }, [id, currentMagazine, loadMagazine]);

  const handleSubmit = () => {
    submitForApproval();
    setSubmitted(true);
    setShowSubmitConfirm(false);
    toast.success('Magazine submitted for HOD approval.');
  };

  const currentStatusIndex = APPROVAL_STATUS.findIndex(s =>
    submitted ? s.id === 'under_review' : s.id === (magazineStatus || 'draft')
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-paper">
      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-rule flex-shrink-0 flex-wrap">
        <button
          onClick={() => navigate(`/faculty/magazines/editor/${id || ''}`)}
          className="flex items-center gap-1.5 text-xs text-draft hover:text-navy font-medium transition-colors"
        >
          ← Back to Editor
        </button>
        <span className="text-rule">|</span>
        <span className="text-sm font-semibold text-ink flex-1 truncate">
          {currentMagazine?.title || 'Reflection'} — Preview
        </span>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => { saveDraft(); toast.success('Draft saved.'); }}
            className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paper text-draft transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => toast('PDF generation starts here.')}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Generate PDF
          </button>
          {!submitted ? (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Submit for Approval
            </button>
          ) : (
            <span className="badge-submitted self-center">Under Review</span>
          )}
        </div>
      </header>

      {/* Approval workflow strip */}
      <div className="bg-white border-b border-rule px-4 py-2 flex items-center gap-2 overflow-x-auto flex-shrink-0">
        {APPROVAL_STATUS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${i <= currentStatusIndex ? s.dot : 'bg-rule'}`} />
              <span className={`text-[10px] font-semibold ${i <= currentStatusIndex ? s.color : 'text-rule'}`}>
                {s.label}
              </span>
            </div>
            {i < APPROVAL_STATUS.length - 1 && (
              <span className={`text-[10px] ${i < currentStatusIndex ? 'text-draft' : 'text-rule'}`}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Submission confirmation banner */}
      {submitted && (
        <div className="bg-green-50 border-b border-pass px-4 py-2.5 flex items-center gap-3">
          <svg className="w-4 h-4 text-pass flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-pass font-semibold">
            Your magazine has been submitted for approval. The HOD will review and publish it.
          </p>
        </div>
      )}

      {/* Page Preview */}
      <div className="flex-1 min-h-0">
        <PagePreview
          magazineId={id}
          onEditPage={(page) => setEditingPage(page)}
        />
      </div>

      {/* Page Editor Modal */}
      {editingPage && (
        <PageEditorModal
          page={editingPage}
          onClose={() => setEditingPage(null)}
          onSave={(updated) => {
            toast.success('Page updated successfully.');
            setEditingPage(null);
          }}
        />
      )}

      {/* Submit Confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-md w-full p-6 shadow-xl">
            <h3 className="font-serif text-xl font-bold text-ink mb-2">Submit for Approval</h3>
            <p className="text-sm text-draft mb-4">
              Once submitted, the magazine will go to the HOD for review. You won't be able to edit it during review.
            </p>
            <div className="bg-amber-50 border border-pending rounded-sm p-3 mb-5 text-xs text-pending font-medium">
              ⚠ Ensure all sections are complete and the preview looks correct before submitting.
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
