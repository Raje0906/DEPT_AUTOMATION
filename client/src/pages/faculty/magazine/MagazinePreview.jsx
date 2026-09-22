import React, { useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMagazine } from '../../../contexts/MagazineContext';
import { useAuth } from '../../../contexts/AuthContext';
import PagePreview, { generateMagazinePages } from '../../../components/magazine/PagePreview';
import PageEditorModal from '../../../components/magazine/PageEditorModal';
import MagazinePrintContainer from '../../../components/magazine/MagazinePrintContainer';
import { generateMagazinePDF } from '../../../services/pdfGenerator';
import toast from 'react-hot-toast';

const APPROVAL_STATUS = [
  { id: 'draft',        label: 'Draft',              color: 'text-draft',   dot: 'bg-rule' },
  { id: 'under_review', label: 'Under Review',        color: 'text-pending', dot: 'bg-pending' },
  { id: 'approved',     label: 'Approved',            color: 'text-blue-600', dot: 'bg-blue-600' },
  { id: 'published',    label: 'Published',           color: 'text-pass',    dot: 'bg-pass' },
];

export default function MagazinePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHOD = user?.role === 'hod';

  const {
    currentMagazine,
    sectionData,
    loadMagazine,
    magazineStatus,
    submitForApproval,
    saveDraft,
    approveMagazine,
    publishMagazine,
    requestChangesMagazine,
  } = useMagazine();

  const [editingPage, setEditingPage] = useState(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [submitted, setSubmitted] = useState(magazineStatus === 'under_review');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');

  const printContainerRef = useRef(null);

  const pages = useMemo(() => {
    return generateMagazinePages(currentMagazine, sectionData);
  }, [currentMagazine, sectionData]);

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

  const handleGeneratePdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfProgress('Initializing PDF generation...');
    const toastId = toast.loading('Generating magazine PDF (A4)...');

    try {
      const filename = await generateMagazinePDF({
        containerElement: printContainerRef.current,
        magazineTitle: currentMagazine?.title || 'Reflection',
        issueNumber: currentMagazine?.issueNumber || '32',
        onProgress: (msg) => {
          setPdfProgress(msg);
          toast.loading(msg, { id: toastId });
        },
      });
      toast.success(`PDF downloaded: ${filename}`, { id: toastId });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error(err.message || 'Failed to generate PDF.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress('');
    }
  };

  const currentStatusIndex = APPROVAL_STATUS.findIndex(s =>
    submitted ? s.id === 'under_review' : s.id === (magazineStatus || 'draft')
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-paper">
      {/* Off-screen A4 container for 1:1 PDF printing */}
      <MagazinePrintContainer
        pages={pages}
        currentMagazine={currentMagazine}
        containerRef={printContainerRef}
      />

      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-rule flex-shrink-0 flex-wrap">
        <button
          onClick={() => navigate(isHOD ? '/hod/magazine-approvals' : `/faculty/magazines/editor/${id || ''}`)}
          className="flex items-center gap-1.5 text-xs text-draft hover:text-navy font-medium transition-colors"
        >
          {isHOD ? '← Back to Approvals' : '← Back to Editor'}
        </button>
        <span className="text-rule">|</span>
        <span className="text-sm font-semibold text-ink flex-1 truncate">
          {currentMagazine?.title || 'Reflection'}{currentMagazine?.issueNumber ? ` — Issue ${currentMagazine.issueNumber}` : ''} ({isHOD ? 'HOD Review' : 'Preview'})
        </span>

        <div className="flex gap-2 flex-shrink-0 items-center flex-wrap">
          {!isHOD && (
            <button
              onClick={() => { saveDraft(); toast.success('Draft saved.'); }}
              className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paper text-draft transition-colors"
            >
              Save Draft
            </button>
          )}

          <button
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
            title="Generate high-fidelity A4 PDF with all magazine sections"
          >
            {isGeneratingPdf ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-navy" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {pdfProgress || 'Generating PDF...'}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Generate PDF
              </>
            )}
          </button>

          {isHOD ? (
            /* HOD Actions */
            <div className="flex items-center gap-2">
              {magazineStatus === 'under_review' && (
                <>
                  <button
                    onClick={() => {
                      approveMagazine(id);
                      toast.success('Magazine approved!');
                    }}
                    className="btn-primary text-xs py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 border-emerald-800"
                  >
                    ✓ Approve Magazine
                  </button>
                  <button
                    onClick={() => {
                      publishMagazine(id);
                      toast.success('Magazine published live!');
                    }}
                    className="btn-primary text-xs py-1.5 px-3 bg-navy hover:bg-[#162142]"
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => {
                      setRevisionFeedback('');
                      setShowRevisionModal(true);
                    }}
                    className="text-xs py-1.5 px-3 rounded-sm border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-medium"
                  >
                    Request Revision
                  </button>
                </>
              )}
              {magazineStatus === 'approved' && (
                <>
                  <span className="badge-approved">Approved</span>
                  <button
                    onClick={() => {
                      publishMagazine(id);
                      toast.success('Magazine published live!');
                    }}
                    className="btn-primary text-xs py-1.5 px-3 bg-navy hover:bg-[#162142]"
                  >
                    Publish Now
                  </button>
                </>
              )}
              {magazineStatus === 'published' && (
                <span className="badge-published">Published</span>
              )}
              {magazineStatus === 'draft' && (
                <span className="badge-draft">Draft</span>
              )}
            </div>
          ) : (
            /* Faculty Actions */
            <>
              {magazineStatus === 'draft' && (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  Submit for Approval
                </button>
              )}
              {magazineStatus === 'under_review' && (
                <span className="badge-submitted self-center">Under Review</span>
              )}
              {magazineStatus === 'approved' && (
                <span className="badge-approved self-center">Approved by HOD</span>
              )}
              {magazineStatus === 'published' && (
                <span className="badge-published self-center">Published</span>
              )}
            </>
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

      {/* HOD Review Context Banner */}
      {isHOD && magazineStatus === 'under_review' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
              HOD Decision Pending
            </span>
            <span>Carefully review each page layout and content below. Once satisfied, click <strong>Approve Magazine</strong> or <strong>Publish</strong>.</span>
          </div>
        </div>
      )}

      {/* Faculty Revision Alert Banner */}
      {!isHOD && currentMagazine?.reviewComment && magazineStatus === 'draft' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="text-xs text-amber-900">
            <strong>HOD Revision Feedback:</strong> {currentMagazine.reviewComment}
          </div>
        </div>
      )}

      {/* Submission confirmation banner */}
      {!isHOD && (submitted || magazineStatus === 'under_review') && (
        <div className="bg-green-50 border-b border-pass px-4 py-2 flex items-center gap-3">
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

      {/* Submit Confirmation Modal (Faculty) */}
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

      {/* Request Changes Modal (HOD) */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-serif text-xl font-bold text-ink">Request Revision</h3>
              <p className="text-xs text-draft mt-1">
                Send magazine back to faculty with feedback remarks.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wide mb-1">
                Revision Remarks
              </label>
              <textarea
                value={revisionFeedback}
                onChange={e => setRevisionFeedback(e.target.value)}
                rows={4}
                placeholder="Explain what needs to be changed (e.g., Update topper rankings, revise principal message, check publication list...)"
                className="w-full text-xs p-2.5 border border-rule rounded-sm focus:outline-none focus:border-navy"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!revisionFeedback.trim()) {
                    toast.error('Please enter revision remarks for the faculty.');
                    return;
                  }
                  requestChangesMagazine(id, revisionFeedback.trim());
                  setShowRevisionModal(false);
                  toast.success('Magazine sent back to faculty for revisions.');
                  navigate('/hod/magazine-approvals');
                }}
                className="btn-primary text-xs bg-red-700 hover:bg-red-800 border-red-800"
              >
                Send Back for Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
