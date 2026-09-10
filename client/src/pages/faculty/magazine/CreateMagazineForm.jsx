import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

const ACADEMIC_YEARS = ['2026–27', '2025–26', '2024–25', '2023–24', '2022–23'];
const SEMESTERS = ['Semester I', 'Semester II', 'Annual'];
const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'AI & DS',
  'Electronics & Telecommunication',
  'Mechanical Engineering',
  'Civil Engineering',
];

export default function CreateMagazineForm() {
  const navigate = useNavigate();
  const { createMagazine } = useMagazine();

  const [form, setForm] = useState({
    title: 'Reflection',
    issueNumber: '33',
    academicYear: '2026–27',
    semester: 'Semester I',
    department: 'Computer Engineering',
    period: 'June – December 2026',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.title.trim())       { toast.error('Magazine title is required'); return false; }
    if (!form.issueNumber.trim()) { toast.error('Issue number is required');   return false; }
    if (!form.academicYear)       { toast.error('Academic year is required');  return false; }
    return true;
  };

  const handleSaveDraft = () => {
    if (!validate()) return;
    const id = createMagazine({ ...form, status: 'Draft' });
    toast.success('Magazine saved as draft.');
    navigate('/faculty/magazines');
  };

  const handleContinue = () => {
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      const id = createMagazine({ ...form, status: 'Draft' });
      setSaving(false);
      navigate(`/faculty/magazines/editor/${id}`);
    }, 600);
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-draft mb-6">
        <button onClick={() => navigate('/faculty/magazines')} className="hover:text-navy font-medium transition-colors">Magazines</button>
        <span>/</span>
        <span className="text-ink font-semibold">Create New Magazine</span>
      </nav>

      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule">
        <h1 className="font-serif text-3xl font-bold text-ink">Create New Magazine</h1>
        <p className="text-sm text-draft mt-1.5">
          Enter the basic information about the magazine. You can edit these details later in the editor.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Title & Issue */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="sm:col-span-2">
            <label className="input-label">Magazine Title</label>
            <input
              id="mag-title"
              className="input-field"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Reflection"
            />
            <p className="text-[10px] text-draft mt-1">The official name of this publication.</p>
          </div>
          <div>
            <label className="input-label">Issue Number</label>
            <input
              id="mag-issue"
              className="input-field"
              value={form.issueNumber}
              onChange={e => set('issueNumber', e.target.value)}
              placeholder="e.g. 33"
            />
          </div>
        </div>

        <div className="h-px bg-rule" />

        {/* Year, Semester, Dept */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="input-label">Academic Year</label>
            <select id="mag-year" className="input-field" value={form.academicYear} onChange={e => set('academicYear', e.target.value)}>
              {ACADEMIC_YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Semester</label>
            <select id="mag-semester" className="input-field" value={form.semester} onChange={e => set('semester', e.target.value)}>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Department</label>
            <select id="mag-department" className="input-field" value={form.department} onChange={e => set('department', e.target.value)}>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="input-label">Publication Period</label>
          <input
            id="mag-period"
            className="input-field"
            value={form.period}
            onChange={e => set('period', e.target.value)}
            placeholder="e.g. June – December 2026"
          />
          <p className="text-[10px] text-draft mt-1">The time period this magazine covers.</p>
        </div>

        <div>
          <label className="input-label">Description / Introduction <span className="text-draft font-normal">(optional)</span></label>
          <textarea
            id="mag-description"
            rows={4}
            className="input-field resize-none"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Brief introduction to this issue — purpose, highlights, editorial note…"
          />
        </div>

        {/* Preview card */}
        <div className="bg-paper border border-rule rounded-sm p-5 flex items-center gap-5">
          <div
            className="w-16 h-20 rounded-sm flex-shrink-0 flex flex-col items-center justify-center text-white text-center"
            style={{ backgroundColor: '#1E2D5A' }}
          >
            <p className="text-[7px] font-bold uppercase tracking-widest opacity-60 font-serif">Reflection</p>
            <p className="text-base font-serif font-bold leading-none">#{form.issueNumber || '?'}</p>
          </div>
          <div>
            <p className="text-base font-bold text-ink">{form.title || 'Untitled Magazine'}</p>
            <p className="text-xs text-draft">Issue {form.issueNumber || '?'} · {form.academicYear} · {form.semester}</p>
            <p className="text-xs text-draft">{form.department}</p>
            {form.period && <p className="text-xs text-draft">{form.period}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleContinue}
            disabled={saving}
            className="btn-primary order-1 sm:order-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Setting up…
              </>
            ) : 'Continue to Editor →'}
          </button>
          <button onClick={handleSaveDraft} className="btn-secondary order-2 sm:order-1">
            Save Draft
          </button>
          <button onClick={() => navigate('/faculty/magazines')} className="btn-ghost order-3 text-draft">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
