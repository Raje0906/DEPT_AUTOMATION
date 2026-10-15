import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  EyeIcon,
  ChartBarIcon,
  GlobeAltIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { isAuthorizedFeedbackCoordinator, isStrictFeedbackCreator } from '../../../utils/feedbackPermissions';
import CreateFeedbackModal from './CreateFeedbackModal';
import FeedbackPreviewModal from './FeedbackPreviewModal';
import FeedbackAnalyticsView from './FeedbackAnalyticsView';

export default function FeedbackDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Active Views
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState(null);
  const [activeAnalyticsFormId, setActiveAnalyticsFormId] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState('ALL'); // 'ALL' | 'MID_SEM' | 'END_SEM'

  const isCoordinator = isAuthorizedFeedbackCoordinator(user);
  const isStrictCreator = isStrictFeedbackCreator(user);

  const fetchForms = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/feedback/forms');
      setForms(res.data.forms || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retrieve feedback forms.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const handleTogglePublish = async (form) => {
    const nextStatus = form.status === 'published' ? 'draft' : 'published';
    const actionLabel = nextStatus === 'published' ? 'publish' : 'unpublish';

    // Check for conflicting published forms of the other phase
    if (nextStatus === 'published') {
      const conflictingForm = forms.find(
        (other) =>
          other.id !== form.id &&
          other.status === 'published' &&
          other.academic_year === form.academic_year &&
          Number(other.semester) === Number(form.semester) &&
          (other.division === form.division || other.division === 'All' || form.division === 'All')
      );

      let confirmMsg = `Are you sure you want to publish "${form.title}"?`;
      if (conflictingForm) {
        const otherPhase = conflictingForm.feedback_type === 'END_SEM' ? 'End-Sem' : 'Mid-Sem';
        const thisPhase = form.feedback_type === 'END_SEM' ? 'End-Sem' : 'Mid-Sem';
        confirmMsg = `⚠️ Mutual Exclusivity Notice:\n\nAn active ${otherPhase} form ("${conflictingForm.title}") is currently published for Semester ${form.semester}.\n\nPublishing this ${thisPhase} form will automatically unpublish/archive the active form so students only see ONE feedback form at a time.\n\nDo you want to proceed?`;
      }

      if (!window.confirm(confirmMsg)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to unpublish "${form.title}"?`)) {
        return;
      }
    }

    try {
      await api.put(`/feedback/forms/${form.id}`, { status: nextStatus });
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${actionLabel} form.`);
    }
  };

  const handleDeleteForm = async (form) => {
    if (!window.confirm(`Are you sure you want to delete "${form.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/feedback/forms/${form.id}`);
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete form.');
    }
  };

  if (activeAnalyticsFormId) {
    return (
      <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
        <FeedbackAnalyticsView
          formId={activeAnalyticsFormId}
          onBack={() => {
            setActiveAnalyticsFormId(null);
            fetchForms();
          }}
        />
      </div>
    );
  }

  const publishedCount = forms.filter((f) => f.status === 'published').length;
  const draftCount = forms.filter((f) => f.status === 'draft').length;
  const totalSubmissions = forms.reduce((acc, f) => acc + parseInt(f.submission_count || 0, 10), 0);

  const filteredForms = forms.filter((f) => {
    if (phaseFilter === 'ALL') return true;
    return (f.feedback_type || 'MID_SEM') === phaseFilter;
  });

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-draft uppercase tracking-widest">
              Department Evaluation Governance
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-navy border border-blue-200">
              <ShieldCheckIcon className="w-3 h-3" /> Coordinator: Ms. C. Y. Vakte
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            TE Course Feedback Governance
          </h1>
          <p className="text-sm text-draft mt-1 font-medium">
            Manage Mid-Semester &amp; End-Semester course evaluation forms dynamically synchronized with the HOD Course Allocation Matrix.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchForms}
            className="px-3 py-2 text-xs font-semibold text-ink bg-white border border-rule rounded hover:bg-paper flex items-center gap-1.5 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          {isStrictCreator && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-3 py-2 text-xs font-semibold text-white bg-navy rounded hover:bg-[#162142] flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Create Feedback Form</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Forms</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{forms.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">Draft &amp; Published</p>
        </div>

        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Live / Published</p>
          <p className="font-serif text-3xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">Active for students</p>
        </div>

        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">In Draft Mode</p>
          <p className="font-serif text-3xl font-bold text-amber-600 mt-1">{draftCount}</p>
          <p className="text-xs text-draft mt-1 font-medium">Pending publication</p>
        </div>

        <div className="p-4 bg-white border border-rule rounded">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Submissions</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">{totalSubmissions}</p>
          <p className="text-xs text-draft mt-1 font-medium">Recorded student responses</p>
        </div>
      </div>

      {/* Critical Data Separation Alert Banner */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start gap-3">
        <BookOpenIcon className="w-5 h-5 text-navy flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong className="font-semibold">Automated Mutual Exclusivity:</strong>
          <span className="ml-1 text-blue-800">
            Students are guaranteed to see at most <strong>one active evaluation phase</strong> (Mid-Sem OR End-Sem) at any given time. Publishing an End-Semester form automatically archives prior Mid-Sem evaluations for that cohort.
          </span>
        </div>
      </div>

      {/* Forms Table */}
      <div className="bg-white rounded border border-rule overflow-hidden">
        <div className="px-6 py-4 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-paper">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
              All Feedback Forms
            </h2>
            <p className="text-xs text-draft mt-0.5">
              Forms applicable to TE Computer Engineering batches.
            </p>
          </div>

          {/* Phase Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
            <button
              onClick={() => setPhaseFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                phaseFilter === 'ALL'
                  ? 'bg-white text-navy shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              All Forms ({forms.length})
            </button>
            <button
              onClick={() => setPhaseFilter('MID_SEM')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                phaseFilter === 'MID_SEM'
                  ? 'bg-white text-navy shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              Mid-Sem ({forms.filter(f => (f.feedback_type || 'MID_SEM') === 'MID_SEM').length})
            </button>
            <button
              onClick={() => setPhaseFilter('END_SEM')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                phaseFilter === 'END_SEM'
                  ? 'bg-white text-navy shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-navy'
              }`}
            >
              End-Sem ({forms.filter(f => f.feedback_type === 'END_SEM').length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-navy mx-auto mb-2" />
            <p className="text-sm text-draft">Loading feedback forms...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            <ExclamationCircleIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-bold text-ink">No feedback forms match the selected phase.</p>
            <p className="text-xs text-draft mt-1">
              Click &quot;Create Feedback Form&quot; above to initialize a new TE feedback form.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-rule text-draft uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Title &amp; Academic Year</th>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Target Scope</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Submissions</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {filteredForms.map((form) => {
                  const isPublished = form.status === 'published';
                  const isEndSem = form.feedback_type === 'END_SEM';
                  const subCount = parseInt(form.submission_count || 0, 10);

                  return (
                    <tr key={form.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-ink">{form.title}</div>
                        <div className="text-[11px] text-draft mt-0.5">
                          AY {form.academic_year} · Semester {form.semester} ({form.class_year})
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isEndSem
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : 'bg-blue-50 text-navy border-blue-200'
                          }`}
                        >
                          {isEndSem ? 'End-Sem (Phase 2)' : 'Mid-Sem (Phase 1)'}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">
                          {form.division === 'All' ? 'All Divisions' : form.division}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPublished
                              ? 'bg-emerald-100 text-emerald-800'
                              : form.status === 'archived'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPublished ? (
                            <>
                              <CheckCircleIcon className="w-3 h-3" /> Live
                            </>
                          ) : form.status === 'archived' ? (
                            <>Archived</>
                          ) : (
                            <>
                              <ClockIcon className="w-3 h-3" /> Draft
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-sm text-ink">{subCount}</span>
                        <span className="text-[10px] text-draft block">students</span>
                      </td>

                      <td className="px-4 py-4 text-draft">
                        <span className="font-medium text-gray-700">{form.creator_name || 'Ms. C. Y. Vakte'}</span>
                        <span className="text-[10px] block text-draft">
                          {new Date(form.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Preview Form */}
                          <button
                            onClick={() => setPreviewForm(form)}
                            className="px-2.5 py-1 text-xs font-semibold text-ink bg-white border border-rule rounded hover:bg-paper flex items-center gap-1 transition-colors"
                            title="Preview official form layout and questions"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          {/* Analytics Report */}
                          <button
                            onClick={() => setActiveAnalyticsFormId(form.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-navy bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1 transition-colors"
                            title="View detailed ratings and reports"
                          >
                            <ChartBarIcon className="w-3.5 h-3.5" />
                            <span>Reports</span>
                          </button>

                          {/* Publish / Unpublish (Strict Coordinator Only) */}
                          {isStrictCreator && (
                            <button
                              onClick={() => handleTogglePublish(form)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
                                isPublished
                                  ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                                  : 'text-white bg-navy hover:bg-[#162142]'
                              }`}
                              title={isPublished ? 'Unpublish form' : 'Publish to students'}
                            >
                              <GlobeAltIcon className="w-3.5 h-3.5" />
                              <span>{isPublished ? 'Unpublish' : 'Publish'}</span>
                            </button>
                          )}

                          {/* Delete Draft */}
                          {isStrictCreator && subCount === 0 && (
                            <button
                              onClick={() => handleDeleteForm(form)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Delete Draft Form"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateFeedbackModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onFormCreated={() => {
          fetchForms();
        }}
      />

      {/* Preview Modal */}
      {previewForm && (
        <FeedbackPreviewModal
          isOpen={!!previewForm}
          onClose={() => setPreviewForm(null)}
          formId={previewForm.id}
          formInfo={previewForm}
        />
      )}
    </div>
  );
}
