import React, { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, BookOpenIcon, AcademicCapIcon, BeakerIcon } from '@heroicons/react/24/outline';
import api from '../../../api/axios';
import { THEORY_QUESTIONS, PRACTICAL_QUESTIONS } from '../../../utils/feedbackQuestions';

export default function FeedbackPreviewModal({ isOpen, onClose, formId, formInfo }) {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState(null);
  const [selectedElectiveIndex, setSelectedElectiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Fetch allocations based on form criteria
        const res = await api.get('/feedback/allocations', {
          params: {
            academicYear: formInfo?.academic_year || formInfo?.academicYear || '2026-27',
            semester: formInfo?.semester || 5,
            division: formInfo?.division === 'All' ? 'TE Comp 1' : (formInfo?.division || 'TE Comp 1'),
          },
        });
        if (isMounted) {
          setMatrix(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'Failed to load allocations from HOD matrix.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [isOpen, formId, formInfo]);

  if (!isOpen) return null;

  const coreTheory = matrix?.theorySubjects || matrix?.coreTheory || [];
  const electives = matrix?.electiveSubjects || matrix?.electives || [];
  const practicals = matrix?.practicalSubjects || matrix?.practicals || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-paper-light border border-gray-300 rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Modal Bar */}
        <div className="px-6 py-3.5 bg-navy text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white">
              Official Preview
            </span>
            <span className="text-sm font-semibold truncate max-w-md">
              {formInfo?.title || 'TE Mid-Sem Feedback Form'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-4 sm:p-8 space-y-8 bg-[#F0EFEA]/40 text-ink">
          {/* Google Form Style Title Card */}
          <div className="bg-white border-t-8 border-t-navy rounded-lg p-6 sm:p-8 shadow-sm border border-gray-200">
            <div className="text-xs uppercase tracking-widest text-draft font-bold mb-1">
              Department of Computer Engineering
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-navy">
              TE COMP - MID SEM FEEDBACK FORM {formInfo?.academic_year || '2026-27'}
            </h1>
            <p className="text-sm text-gray-700 mt-2 font-medium">
              Modern Education Society's Wadia College of Engineering, Pune - 01
            </p>
            <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-1">
              <p>• Class: <strong>TE Computer Engineering</strong> | Semester: <strong>Sem {formInfo?.semester || 5}</strong> | Division: <strong>{formInfo?.division || 'All'}</strong></p>
              <p>• Rating Scale: <strong className="text-navy">1 = Worst</strong> to <strong className="text-navy">10 = Best</strong> across all questions.</p>
              <p className="text-emerald-700 font-semibold mt-1">
                ✓ Dynamic Single-Source-of-Truth: Subject names & faculty are dynamically loaded from HOD Course Allocation Matrix.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white p-12 text-center rounded-lg border border-gray-200">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy mb-3"></div>
              <p className="text-sm text-gray-600">Resolving current HOD Course Allocation Matrix...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-red-700 text-sm flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Allocation Conflict / Error:</p>
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 1: CORE THEORY SUBJECTS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
                  <BookOpenIcon className="w-5 h-5" />
                  <h2 className="text-lg font-bold uppercase tracking-wide">
                    Section 1: Theory Subjects Feedback
                  </h2>
                </div>

                {coreTheory.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No core theory subjects allocated in HOD matrix for this division.</p>
                ) : (
                  coreTheory.map((subject, idx) => (
                    <div key={subject.mapping_id || idx} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-6">
                      <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-navy">
                            Theory Course {idx + 1}
                          </span>
                          <h3 className="text-base font-bold text-ink mt-1">
                            {subject.subject_name} {subject.subject_code ? `(${subject.subject_code})` : ''}
                          </h3>
                        </div>
                        <div className="text-sm sm:text-right font-medium">
                          <span className="text-draft text-xs">Faculty: </span>
                          <span className="text-navy font-bold">{subject.faculty_name}</span>
                        </div>
                      </div>

                      {/* 7 Theory Questions */}
                      <div className="space-y-5">
                        {THEORY_QUESTIONS.map((q) => (
                          <div key={q.id} className="pt-2">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                              {q.text} <span className="text-red-500">*</span>
                            </p>
                            <div className="flex items-center justify-between max-w-lg bg-gray-50/80 p-2 rounded border border-gray-200">
                              <span className="text-[10px] font-bold text-draft uppercase">1 (Worst)</span>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                  <label key={num} className="flex flex-col items-center gap-1 cursor-not-allowed">
                                    <span className="text-[10px] text-gray-600 font-medium">{num}</span>
                                    <input
                                      type="radio"
                                      disabled
                                      name={`preview_th_${subject.subject_id}_${q.id}`}
                                      className="w-3.5 h-3.5 text-navy border-gray-300"
                                    />
                                  </label>
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-draft uppercase">10 (Best)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SECTION 2: THEORY ELECTIVES (CONDITIONAL NAVIGATION) */}
              {electives.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
                    <AcademicCapIcon className="w-5 h-5" />
                    <h2 className="text-lg font-bold uppercase tracking-wide">
                      Section 2: Theory Elective Selection & Feedback
                    </h2>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-4">
                    <p className="text-xs text-gray-600">
                      <strong>Conditional Navigation Rule:</strong> In Google Form (Page 13), students select their enrolled Elective I course, which conditionally routes them to evaluate only that teacher.
                    </p>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                        Select Enrolled Elective (Simulate Conditional Jump):
                      </label>
                      <select
                        value={selectedElectiveIndex}
                        onChange={(e) => setSelectedElectiveIndex(parseInt(e.target.value, 10))}
                        className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy outline-none bg-white font-medium"
                      >
                        {electives.map((el, i) => (
                          <option key={el.mapping_id || i} value={i}>
                            {el.subject_name} — {el.faculty_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {electives[selectedElectiveIndex] && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-5">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <h4 className="text-sm font-bold text-ink">
                            {electives[selectedElectiveIndex].subject_name}
                          </h4>
                          <span className="text-xs font-bold text-navy">
                            Faculty: {electives[selectedElectiveIndex].faculty_name}
                          </span>
                        </div>

                        {THEORY_QUESTIONS.map((q) => (
                          <div key={q.id} className="pt-2">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                              {q.text} <span className="text-red-500">*</span>
                            </p>
                            <div className="flex items-center justify-between max-w-lg bg-gray-50/80 p-2 rounded border border-gray-200">
                              <span className="text-[10px] font-bold text-draft uppercase">1 (Worst)</span>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                  <label key={num} className="flex flex-col items-center gap-1 cursor-not-allowed">
                                    <span className="text-[10px] text-gray-600 font-medium">{num}</span>
                                    <input
                                      type="radio"
                                      disabled
                                      name={`preview_el_${q.id}`}
                                      className="w-3.5 h-3.5 text-navy border-gray-300"
                                    />
                                  </label>
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-draft uppercase">10 (Best)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3: PRACTICAL / LAB SUBJECTS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
                  <BeakerIcon className="w-5 h-5" />
                  <h2 className="text-lg font-bold uppercase tracking-wide">
                    Section 3: Practical & Laboratory Feedback
                  </h2>
                </div>

                {practicals.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No practical courses allocated in HOD matrix for this division.</p>
                ) : (
                  practicals.map((subject, idx) => (
                    <div key={subject.mapping_id || idx} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-6">
                      <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                            Practical / Lab Course {idx + 1}
                          </span>
                          <h3 className="text-base font-bold text-ink mt-1">
                            {subject.subject_name} {subject.subject_code ? `(${subject.subject_code})` : ''}
                          </h3>
                        </div>
                        <div className="text-sm sm:text-right font-medium">
                          <span className="text-draft text-xs">Faculty: </span>
                          <span className="text-navy font-bold">{subject.faculty_name}</span>
                        </div>
                      </div>

                      {/* 6 Practical Questions */}
                      <div className="space-y-5">
                        {PRACTICAL_QUESTIONS.map((q) => (
                          <div key={q.id} className="pt-2">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2">
                              {q.text} <span className="text-red-500">*</span>
                            </p>
                            <div className="flex items-center justify-between max-w-lg bg-gray-50/80 p-2 rounded border border-gray-200">
                              <span className="text-[10px] font-bold text-draft uppercase">1 (Worst)</span>
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                  <label key={num} className="flex flex-col items-center gap-1 cursor-not-allowed">
                                    <span className="text-[10px] text-gray-600 font-medium">{num}</span>
                                    <input
                                      type="radio"
                                      disabled
                                      name={`preview_pr_${subject.subject_id}_${q.id}`}
                                      className="w-3.5 h-3.5 text-navy border-gray-300"
                                    />
                                  </label>
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-draft uppercase">10 (Best)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500 font-medium">
            Read-only preview matching exact 37-page TE Mid-Sem Feedback structure.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-sm font-semibold text-white bg-navy hover:bg-[#162142] rounded transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
