import React, { useState } from 'react';
import toast from 'react-hot-toast';

const RATING_LABELS = [
  'Course Relevance',
  'Infrastructure / Lab Facilities',
  'Faculty',
  'Canteen',
  'Library',
  'Office Staff',
  'Hostel',
  'Educational Resources',
  'Admission Procedure',
  'Overall College Rating',
];

const RATING_OPTIONS = [
  { value: '5', label: 'Excellent' },
  { value: '4', label: 'Very Good' },
  { value: '3', label: 'Good' },
  { value: '2', label: 'Average' },
  { value: '1', label: 'Poor' },
];

const initialRatings = Object.fromEntries(RATING_LABELS.map((k) => [k, '']));

export default function AlumniFeedback() {
  const [form, setForm] = useState({
    name: '',
    address: '',
    contact: '',
    email: '',
    course: '',
    occupation: '',
    ratings: { ...initialRatings },
    proudAlumnus: '',
    contribution: '',
    grievances: '',
    associationMember: '',
    suggestions: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRating = (label, value) => {
    setForm((prev) => ({
      ...prev,
      ratings: { ...prev.ratings, [label]: value },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const missingRating = RATING_LABELS.find((l) => !form.ratings[l]);
    if (missingRating) {
      toast.error(`Please rate: ${missingRating}`);
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success('Thank you! Your feedback has been submitted.');
    }, 800);
  };

  if (submitted) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-3xl mx-auto">
        <div className="panel p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 border border-pass flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-ink mb-2">Feedback Submitted</h2>
          <p className="text-sm text-draft mb-6">
            Thank you for taking the time to share your experience with us. Your feedback helps
            MESCOE continue to improve.
          </p>
          <button
            className="btn-secondary"
            onClick={() => {
              setForm({
                name: '', address: '', contact: '', email: '',
                course: '', occupation: '',
                ratings: { ...initialRatings },
                proudAlumnus: '', contribution: '', grievances: '',
                associationMember: '', suggestions: '',
              });
              setSubmitted(false);
            }}
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 w-full max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8 pb-5 border-b border-rule">
        <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">Alumni Feedback</h1>
        <p className="text-base text-draft mt-1">
          MES College of Engineering — Alumni Feedback Form
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Personal Details */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-ink">Personal Details</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="input-label" htmlFor="af-name">Name</label>
              <input
                id="af-name"
                type="text"
                required
                className="input-field"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="af-contact">Contact Number</label>
              <input
                id="af-contact"
                type="tel"
                required
                className="input-field"
                placeholder="+91 XXXXX XXXXX"
                value={form.contact}
                onChange={(e) => handleChange('contact', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="af-email">Email</label>
              <input
                id="af-email"
                type="email"
                required
                className="input-field"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="input-label" htmlFor="af-address">Address</label>
              <textarea
                id="af-address"
                rows={2}
                className="input-field resize-none"
                placeholder="Current postal address"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Academic / Career */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-ink">Academic &amp; Career</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="input-label" htmlFor="af-course">Course Completed</label>
              <input
                id="af-course"
                type="text"
                required
                className="input-field"
                placeholder="e.g. B.E. Computer Engineering"
                value={form.course}
                onChange={(e) => handleChange('course', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="af-occupation">Present Occupation / Designation</label>
              <input
                id="af-occupation"
                type="text"
                className="input-field"
                placeholder="e.g. Software Engineer at XYZ"
                value={form.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Feedback Ratings */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-ink">Feedback Ratings</h2>
            <p className="text-xs text-draft mt-0.5">Rate each aspect of your college experience</p>
          </div>
          <div className="divide-y divide-rule">
            {RATING_LABELS.map((label) => (
              <div
                key={label}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <span className="text-sm font-medium text-ink min-w-0 flex-1">{label}</span>
                <div className="flex gap-2 flex-wrap">
                  {RATING_OPTIONS.map((opt) => {
                    const selected = form.ratings[label] === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`
                          inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                          border rounded-sm cursor-pointer transition-colors duration-100 select-none
                          ${selected
                            ? 'bg-navy text-white border-navy'
                            : 'bg-white text-draft border-rule hover:border-navy hover:text-navy'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name={`rating-${label}`}
                          value={opt.value}
                          className="sr-only"
                          onChange={() => handleRating(label, opt.value)}
                          checked={selected}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alumni Questions */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-ink">Alumni Questions</h2>
          </div>
          <div className="p-6 space-y-5">

            <div>
              <label className="input-label">
                Are you proud to be an alumnus of MESCOE?
              </label>
              <div className="flex gap-4 mt-1">
                {['Yes', 'No'].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="proudAlumnus"
                      value={v}
                      checked={form.proudAlumnus === v}
                      onChange={() => handleChange('proudAlumnus', v)}
                      className="accent-[#1E2D5A]"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="af-contribution">
                Have you contributed / would you like to contribute to college development activities?
              </label>
              <textarea
                id="af-contribution"
                rows={2}
                className="input-field resize-none"
                placeholder="Describe your contribution or willingness to contribute…"
                value={form.contribution}
                onChange={(e) => handleChange('contribution', e.target.value)}
              />
            </div>

            <div>
              <label className="input-label" htmlFor="af-grievances">
                Grievances (as a student / as an alumnus)
              </label>
              <textarea
                id="af-grievances"
                rows={3}
                className="input-field resize-none"
                placeholder="Please describe any grievances you experienced…"
                value={form.grievances}
                onChange={(e) => handleChange('grievances', e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">
                Are you a member of the Alumni Association?
              </label>
              <div className="flex flex-wrap gap-4 mt-1">
                {['Yes', 'No', 'Would like to join'].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="associationMember"
                      value={v}
                      checked={form.associationMember === v}
                      onChange={() => handleChange('associationMember', v)}
                      className="accent-[#1E2D5A]"
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Suggestions */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="font-serif text-lg font-semibold text-ink">Suggestions / Comments</h2>
          </div>
          <div className="p-6">
            <label className="input-label" htmlFor="af-suggestions">
              Your suggestions for the college
            </label>
            <textarea
              id="af-suggestions"
              rows={4}
              className="input-field resize-none"
              placeholder="Share any suggestions or additional comments…"
              value={form.suggestions}
              onChange={(e) => handleChange('suggestions', e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4 pb-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            id="af-submit"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Submitting…
              </>
            ) : 'Submit Feedback'}
          </button>
          <p className="text-xs text-draft">All ratings are required before submission.</p>
        </div>

      </form>
    </div>
  );
}
