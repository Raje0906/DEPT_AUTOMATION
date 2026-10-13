import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import api from '../../../api/axios';

export default function CreateFeedbackModal({ isOpen, onClose, onFormCreated }) {
  const [title, setTitle] = useState('TE Sem 5 Mid-Semester Feedback 2026-27');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [semester, setSemester] = useState(5);
  const [classYear, setClassYear] = useState('TE');
  const [division, setDivision] = useState('All');
  const [description, setDescription] = useState('Official TE Mid-Semester Faculty & Course Feedback');

  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocations, setAllocations] = useState(null);
  const [allocError, setAllocError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch live allocations preview from HOD matrix whenever academicYear, semester, division change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadMatrix() {
      setLoadingAllocations(true);
      setAllocError(null);
      try {
        const res = await api.get('/feedback/allocations', {
          params: { academicYear, semester, division },
        });
        if (isMounted) {
          setAllocations(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setAllocations(null);
          setAllocError(err.response?.data?.error || 'Unable to load HOD Course Allocation Matrix for selected criteria.');
        }
      } finally {
        if (isMounted) setLoadingAllocations(false);
      }
    }

    loadMatrix();
    return () => { isMounted = false; };
  }, [isOpen, academicYear, semester, division]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await api.post('/feedback/forms', {
        title,
        academicYear,
        semester,
        classYear,
        division,
        formConfig: { description },
      });

      if (onFormCreated) {
        onFormCreated(res.data.form);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create feedback form draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const theoryCount = allocations?.theorySubjects?.length || allocations?.coreTheory?.length || 0;
  const electiveCount = allocations?.electiveSubjects?.length || allocations?.electives?.length || 0;
  const practicalCount = allocations?.practicalSubjects?.length || allocations?.practicals?.length || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-navy text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold font-serif">Create TE Feedback Form</h3>
            <p className="text-xs text-blue-200 mt-0.5">
              Authorized Feedback Coordinator: Ms. C. Y. Vakte
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
              Form Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none"
              placeholder="e.g. TE Sem 5 Mid-Semester Feedback 2026-27"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                Academic Year
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none bg-white"
              >
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none bg-white"
              >
                <option value={5}>Semester 5 (TE Sem 1)</option>
                <option value={6}>Semester 6 (TE Sem 2)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                Target Division
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none bg-white"
              >
                <option value="All">All Divisions (TE Comp 1, 2, 3)</option>
                <option value="TE Comp 1">TE Comp 1</option>
                <option value="TE Comp 2">TE Comp 2</option>
                <option value="TE Comp 3">TE Comp 3</option>
              </select>
            </div>
          </div>

          {/* Dynamic HOD Matrix Status Box */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>HOD Course Allocation Matrix Integration</span>
                {loadingAllocations && (
                  <svg className="w-3.5 h-3.5 animate-spin text-navy" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                )}
              </span>
              {allocations?.available && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircleIcon className="w-3.5 h-3.5" /> Live Synced
                </span>
              )}
            </div>

            {loadingAllocations ? (
              <p className="text-xs text-gray-500 italic">Querying Department Allocation Matrix in real-time...</p>
            ) : allocError ? (
              <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 flex items-start gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Allocations Unavailable:</p>
                  <p>{allocError}</p>
                </div>
              </div>
            ) : allocations?.available ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <div className="text-base font-bold text-navy">{theoryCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-medium">Theory Subjects</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <div className="text-base font-bold text-navy">{electiveCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-medium">Electives</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-gray-200">
                    <div className="text-base font-bold text-navy">{practicalCount}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-medium">Labs & Practical</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  Subjects and faculty allocations will be dynamically retrieved at runtime.
                </p>
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
              Form Instructions / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none"
              placeholder="Instructions presented to students on the feedback form..."
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (allocError && !allocations?.available)}
              className="px-4 py-2 text-xs font-semibold text-white bg-navy hover:bg-[#162142] disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-sm transition-colors flex items-center gap-1.5"
            >
              {submitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              )}
              <span>Create Draft Form</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
