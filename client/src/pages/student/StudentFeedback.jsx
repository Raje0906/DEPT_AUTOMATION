import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  BookOpenIcon,
  AcademicCapIcon,
  BeakerIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  StarIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentFeedback() {
  const { user } = useAuth();

  const [availableForms, setAvailableForms] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  // Active form filling state
  const [activeFormId, setActiveFormId] = useState(null);
  const [formData, setFormData] = useState(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [formError, setFormError] = useState(null);

  // Responses state: { [key: string]: number } where key = `${sectionType}_${subjectId}_${questionId}`
  const [ratings, setRatings] = useState({});
  const [selectedElectiveIndex, setSelectedElectiveIndex] = useState('');
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // 1. Fetch available forms
  const fetchAvailableForms = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await api.get('/feedback/student/available');
      setAvailableForms(res.data.forms || []);
    } catch (err) {
      setListError(err.response?.data?.error || 'Failed to retrieve published feedback forms.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAvailableForms();
  }, []);

  // 2. Fetch specific form details
  const handleOpenForm = async (formId) => {
    setActiveFormId(formId);
    setLoadingForm(true);
    setFormError(null);
    setRatings({});
    setSelectedElectiveIndex('');
    setGeneralFeedback('');
    setSubmitSuccess(false);
    setSubmitError(null);

    try {
      const res = await api.get(`/feedback/student/form/${formId}`);
      setFormData(res.data);
      if (res.data.matrix?.electiveSubjects?.length > 0) {
        setSelectedElectiveIndex('0');
      }
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to load feedback form schema.');
    } finally {
      setLoadingForm(false);
    }
  };

  const handleRatingChange = (sectionType, subjectId, questionId, value) => {
    const key = `${sectionType}_${subjectId}_${questionId}`;
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData) return;

    const matrix = formData.matrix;
    const theorySubjects = matrix?.theorySubjects || matrix?.coreTheory || [];
    const practicalSubjects = matrix?.practicalSubjects || matrix?.practicals || [];
    const electives = matrix?.electiveSubjects || matrix?.electives || [];
    const chosenElective = selectedElectiveIndex !== '' ? electives[parseInt(selectedElectiveIndex, 10)] : null;

    const payloadResponses = [];

    // 1. Collect theory responses
    for (const sub of theorySubjects) {
      for (const q of formData.theoryQuestions) {
        const qNum = q.id || q.number;
        const key = `theory_${sub.subject_id}_${qNum}`;
        const ratingVal = ratings[key];
        if (!ratingVal) {
          setSubmitError(`Please answer Question ${qNum} for "${sub.subject_name}" (${sub.faculty_name}).`);
          return;
        }
        payloadResponses.push({
          subjectId: sub.subject_id,
          subjectName: sub.subject_name,
          subjectCode: sub.subject_code,
          facultyId: sub.faculty_id,
          facultyName: sub.faculty_name,
          sectionType: 'theory',
          questionNumber: qNum,
          questionText: q.text,
          rating: ratingVal,
        });
      }
    }

    // 2. Collect elective responses (if applicable)
    if (chosenElective) {
      for (const q of formData.theoryQuestions) {
        const qNum = q.id || q.number;
        const key = `elective_${chosenElective.subject_id}_${qNum}`;
        const ratingVal = ratings[key];
        if (!ratingVal) {
          setSubmitError(`Please answer Question ${qNum} for your elective "${chosenElective.subject_name}" (${chosenElective.faculty_name}).`);
          return;
        }
        payloadResponses.push({
          subjectId: chosenElective.subject_id,
          subjectName: chosenElective.subject_name,
          subjectCode: chosenElective.subject_code,
          facultyId: chosenElective.faculty_id,
          facultyName: chosenElective.faculty_name,
          sectionType: 'theory_elective',
          questionNumber: qNum,
          questionText: q.text,
          rating: ratingVal,
        });
      }
    }

    // 3. Collect practical responses
    for (const sub of practicalSubjects) {
      for (const q of formData.practicalQuestions) {
        const qNum = q.id || q.number;
        const key = `practical_${sub.subject_id}_${qNum}`;
        const ratingVal = ratings[key];
        if (!ratingVal) {
          setSubmitError(`Please answer Question ${qNum} for Lab "${sub.subject_name}" (${sub.faculty_name}).`);
          return;
        }
        payloadResponses.push({
          subjectId: sub.subject_id,
          subjectName: sub.subject_name,
          subjectCode: sub.subject_code,
          facultyId: sub.faculty_id,
          facultyName: sub.faculty_name,
          sectionType: 'practical',
          questionNumber: qNum,
          questionText: q.text,
          rating: ratingVal,
        });
      }
    }

    if (payloadResponses.length === 0) {
      setSubmitError('No question responses to submit.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/feedback/student/submit/${activeFormId}`, {
        selectedElective: chosenElective ? chosenElective.subject_name : null,
        responses: payloadResponses,
        generalFeedback,
      });

      setSubmitSuccess(true);
      fetchAvailableForms();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // If viewing the form list
  if (!activeFormId) {
    return (
      <div className="p-6 lg:p-10 w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
        <div className="pb-5 border-b border-rule">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-draft uppercase tracking-widest">
              Student Academic Portal
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            TE Mid-Semester Course Feedback
          </h1>
          <p className="text-sm text-draft mt-1 font-medium">
            Confidential course and faculty teaching evaluation. Your feedback directly improves educational quality.
          </p>
        </div>

        {loadingList ? (
          <div className="p-12 text-center bg-white rounded border border-rule">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-navy mx-auto mb-2" />
            <p className="text-sm text-draft">Checking available feedback forms for your division...</p>
          </div>
        ) : listError ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <ExclamationCircleIcon className="w-5 h-5 mb-1 text-red-600" />
            <p className="font-bold">Error:</p>
            <p>{listError}</p>
          </div>
        ) : availableForms.length === 0 ? (
          <div className="p-12 text-center bg-white rounded border border-rule space-y-3">
            <BookOpenIcon className="w-12 h-12 text-draft mx-auto opacity-30" />
            <h3 className="text-base font-bold text-ink">No Feedback Forms Active</h3>
            <p className="text-xs text-draft max-w-md mx-auto">
              There are currently no open feedback forms published for your semester and division. Forms will appear here once published by the Feedback Coordinator (Ms. C. Y. Vakte).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {availableForms.map((form) => {
              const hasSubmitted = !!form.submission_id;

              return (
                <div
                  key={form.id}
                  className="p-6 bg-white border border-rule rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-navy transition-colors shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-navy">
                        AY {form.academicYear} · Semester {form.semester}
                      </span>
                      {hasSubmitted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircleIcon className="w-3 h-3" /> Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          <ClockIcon className="w-3 h-3" /> Pending Submission
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-ink">{form.title}</h3>
                    <p className="text-xs text-draft">
                      Target Scope: {form.division === 'All' ? 'All TE Divisions' : form.division}
                    </p>
                  </div>

                  <div>
                    {hasSubmitted ? (
                      <button
                        onClick={() => handleOpenForm(form.id)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                      >
                        View Submission Status
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenForm(form.id)}
                        className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 shadow-sm"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        <span>Fill Feedback</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Active form view
  if (loadingForm) {
    return (
      <div className="p-12 text-center max-w-4xl mx-auto">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-navy mx-auto mb-3" />
        <p className="text-sm text-draft">Loading feedback questions and current HOD allocations...</p>
      </div>
    );
  }

  if (formError || !formData) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <button
          onClick={() => setActiveFormId(null)}
          className="text-xs font-semibold text-navy flex items-center gap-1"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Forms
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <p className="font-bold">Error:</p>
          <p>{formError || 'Unable to display form.'}</p>
        </div>
      </div>
    );
  }

  // If student has already submitted this form
  if (formData.hasSubmitted || submitSuccess) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
        <button
          onClick={() => setActiveFormId(null)}
          className="text-xs font-semibold text-navy flex items-center gap-1.5 hover:underline"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to Available Forms
        </button>

        <div className="bg-white border border-emerald-200 rounded-lg p-8 sm:p-10 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircleIcon className="w-10 h-10" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-ink">
            Feedback Submitted Successfully!
          </h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Your responses for <span className="font-semibold text-navy">{formData.form.title}</span> have been securely recorded.
          </p>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 max-w-md mx-auto space-y-1">
            <p>• Student: <strong>{formData.student.name}</strong></p>
            <p>• Division: <strong>{formData.student.division}</strong> | Roll No: <strong>{formData.student.rollNo}</strong></p>
            <p>• Submission Rule: Single submission enforced per student.</p>
          </div>
          <button
            onClick={() => setActiveFormId(null)}
            className="px-6 py-2.5 text-xs font-bold text-white bg-navy hover:bg-[#162142] rounded shadow-sm transition-colors mt-2"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { form, student, matrix, theoryQuestions, practicalQuestions } = formData;
  const coreTheory = matrix?.theorySubjects || matrix?.coreTheory || [];
  const electives = matrix?.electiveSubjects || matrix?.electives || [];
  const practicals = matrix?.practicalSubjects || matrix?.practicals || [];
  const chosenElective = selectedElectiveIndex !== '' ? electives[parseInt(selectedElectiveIndex, 10)] : null;

  return (
    <div className="p-4 sm:p-8 w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={() => setActiveFormId(null)}
        className="text-xs font-semibold text-navy flex items-center gap-1.5 hover:underline"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back to Available Forms
      </button>

      {/* Google Form Style Title Banner */}
      <div className="bg-white border-t-8 border-t-navy rounded-lg p-6 sm:p-8 shadow-sm border border-gray-200 space-y-3">
        <div className="text-xs uppercase tracking-widest text-draft font-bold">
          Modern Education Society&apos;s Wadia College of Engineering, Pune - 01
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-navy">
          {form.title}
        </h1>
        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">
          Department of Computer Engineering — Confidential TE Mid-Semester Evaluation.
        </p>

        <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span>Student: <strong>{student.name}</strong></span> ({student.email})
          </div>
          <div>
            <span>Division: <strong>{student.division}</strong> | Roll No: <strong>{student.rollNo}</strong></span>
          </div>
        </div>

        <div className="p-3 bg-blue-50/80 rounded border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-navy flex-shrink-0" />
          <span>
            Rating Scale: <strong className="text-navy">1 = Worst</strong> to <strong className="text-navy">10 = Best</strong> across all questions.
          </span>
        </div>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
          <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: CORE THEORY */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
            <BookOpenIcon className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide">
              Section 1: Theory Subjects Feedback
            </h2>
          </div>

          {coreTheory.map((subject, idx) => (
            <div
              key={subject.mapping_id || idx}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-6"
            >
              <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-navy">
                    Course {idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-ink mt-1">
                    {subject.subject_name} {subject.subject_code ? `(${subject.subject_code})` : ''}
                  </h3>
                </div>
                <div className="text-sm font-medium sm:text-right">
                  <span className="text-draft text-xs">Faculty: </span>
                  <span className="text-navy font-bold">{subject.faculty_name}</span>
                </div>
              </div>

              {/* 7 Theory Questions */}
              <div className="space-y-6">
                {theoryQuestions.map((q) => {
                  const qNum = q.id || q.number;
                  const key = `theory_${subject.subject_id}_${qNum}`;
                  const currentVal = ratings[key];

                  return (
                    <div key={qNum} className="pt-2">
                      <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2.5">
                        {q.text} <span className="text-red-500">*</span>
                      </p>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/90 p-3.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] font-bold text-draft uppercase sm:w-16">1 (Worst)</span>
                        <div className="grid grid-cols-10 gap-1 sm:gap-2 flex-1 max-w-xl">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                            const isSelected = currentVal === num;
                            return (
                              <label
                                key={num}
                                className={`flex flex-col items-center justify-center cursor-pointer py-2 px-1 rounded-md border text-center transition-all duration-150 select-none ${
                                  isSelected
                                    ? 'bg-navy text-white border-navy font-bold shadow-md ring-2 ring-navy/30 scale-105'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-navy/60 hover:bg-gray-100'
                                }`}
                              >
                                <span className={`text-xs leading-none mb-1.5 ${isSelected ? 'font-black text-white' : 'font-semibold text-gray-700'}`}>
                                  {num}
                                </span>
                                <input
                                  type="radio"
                                  required
                                  name={key}
                                  value={num}
                                  checked={isSelected}
                                  onChange={() => handleRatingChange('theory', subject.subject_id, qNum, num)}
                                  className="w-3.5 h-3.5 text-navy accent-navy cursor-pointer"
                                />
                              </label>
                            );
                          })}
                        </div>
                        <span className="text-[10px] font-bold text-draft uppercase sm:w-16 text-right">10 (Best)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* SECTION 2: THEORY ELECTIVE (CONDITIONAL NAVIGATION) */}
        {electives.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
              <AcademicCapIcon className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide">
                Section 2: Theory Elective Selection & Feedback
              </h2>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1.5">
                  Select Your Enrolled Elective Subject <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedElectiveIndex}
                  onChange={(e) => setSelectedElectiveIndex(e.target.value)}
                  className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy outline-none bg-white font-medium"
                >
                  <option value="" disabled>-- Choose your elective course --</option>
                  {electives.map((el, i) => (
                    <option key={el.mapping_id || i} value={i}>
                      {el.subject_name} — {el.faculty_name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  You will evaluate only the faculty member teaching your selected elective.
                </p>
              </div>

              {chosenElective && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-1">
                    <h3 className="text-base font-bold text-ink">
                      {chosenElective.subject_name}
                    </h3>
                    <span className="text-xs font-bold text-navy">
                      Faculty: {chosenElective.faculty_name}
                    </span>
                  </div>

                  {theoryQuestions.map((q) => {
                    const qNum = q.id || q.number;
                    const key = `elective_${chosenElective.subject_id}_${qNum}`;
                    const currentVal = ratings[key];

                    return (
                      <div key={qNum} className="pt-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2.5">
                          {q.text} <span className="text-red-500">*</span>
                        </p>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/90 p-3.5 rounded-lg border border-gray-200">
                          <span className="text-[10px] font-bold text-draft uppercase sm:w-16">1 (Worst)</span>
                          <div className="grid grid-cols-10 gap-1 sm:gap-2 flex-1 max-w-xl">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const isSelected = currentVal === num;
                              return (
                                <label
                                  key={num}
                                  className={`flex flex-col items-center justify-center cursor-pointer py-2 px-1 rounded-md border text-center transition-all duration-150 select-none ${
                                    isSelected
                                      ? 'bg-navy text-white border-navy font-bold shadow-md ring-2 ring-navy/30 scale-105'
                                      : 'bg-white text-gray-700 border-gray-300 hover:border-navy/60 hover:bg-gray-100'
                                  }`}
                                >
                                  <span className={`text-xs leading-none mb-1.5 ${isSelected ? 'font-black text-white' : 'font-semibold text-gray-700'}`}>
                                    {num}
                                  </span>
                                  <input
                                    type="radio"
                                    required
                                    name={key}
                                    value={num}
                                    checked={isSelected}
                                    onChange={() => handleRatingChange('elective', chosenElective.subject_id, qNum, num)}
                                    className="w-3.5 h-3.5 text-navy accent-navy cursor-pointer"
                                  />
                                </label>
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-bold text-draft uppercase sm:w-16 text-right">10 (Best)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: PRACTICAL & LABS */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-navy text-navy">
            <BeakerIcon className="w-5 h-5" />
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide">
              Section 3: Practical & Laboratory Feedback
            </h2>
          </div>

          {practicals.map((subject, idx) => (
            <div
              key={subject.mapping_id || idx}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-6"
            >
              <div className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                    Lab Course {idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-ink mt-1">
                    {subject.subject_name} {subject.subject_code ? `(${subject.subject_code})` : ''}
                  </h3>
                </div>
                <div className="text-sm font-medium sm:text-right">
                  <span className="text-draft text-xs">Faculty: </span>
                  <span className="text-navy font-bold">{subject.faculty_name}</span>
                </div>
              </div>

              {/* 6 Practical Questions */}
              <div className="space-y-6">
                {practicalQuestions.map((q) => {
                  const qNum = q.id || q.number;
                  const key = `practical_${subject.subject_id}_${qNum}`;
                  const currentVal = ratings[key];

                  return (
                    <div key={qNum} className="pt-2">
                      <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-2.5">
                        {q.text} <span className="text-red-500">*</span>
                      </p>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/90 p-3.5 rounded-lg border border-gray-200">
                        <span className="text-[10px] font-bold text-draft uppercase sm:w-16">1 (Worst)</span>
                        <div className="grid grid-cols-10 gap-1 sm:gap-2 flex-1 max-w-xl">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                            const isSelected = currentVal === num;
                            return (
                              <label
                                key={num}
                                className={`flex flex-col items-center justify-center cursor-pointer py-2 px-1 rounded-md border text-center transition-all duration-150 select-none ${
                                  isSelected
                                    ? 'bg-navy text-white border-navy font-bold shadow-md ring-2 ring-navy/30 scale-105'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-navy/60 hover:bg-gray-100'
                                }`}
                              >
                                <span className={`text-xs leading-none mb-1.5 ${isSelected ? 'font-black text-white' : 'font-semibold text-gray-700'}`}>
                                  {num}
                                </span>
                                <input
                                  type="radio"
                                  required
                                  name={key}
                                  value={num}
                                  checked={isSelected}
                                  onChange={() => handleRatingChange('practical', subject.subject_id, qNum, num)}
                                  className="w-3.5 h-3.5 text-navy accent-navy cursor-pointer"
                                />
                              </label>
                            );
                          })}
                        </div>
                        <span className="text-[10px] font-bold text-draft uppercase sm:w-16 text-right">10 (Best)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* SECTION 4: GENERAL SUGGESTIONS */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-ink">
            General Suggestions / Constructive Comments (Optional)
          </label>
          <textarea
            rows={3}
            value={generalFeedback}
            onChange={(e) => setGeneralFeedback(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-navy focus:border-navy outline-none"
            placeholder="Share any additional feedback on teaching methodologies, lab infrastructure, or syllabus pace..."
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            • By submitting, your evaluation will be recorded permanently and cannot be re-submitted.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-8 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md"
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>Recording Responses...</span>
              </>
            ) : (
              <>
                <PaperAirplaneIcon className="w-4 h-4" />
                <span>Submit TE Feedback</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
