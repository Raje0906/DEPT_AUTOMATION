import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const DESIGNATIONS = [
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Head of Department / Professor',
  'Adjunct Faculty',
  'Visiting Faculty',
];

const DEPARTMENTS = [
  'Computer Engineering',
  'Information Technology',
  'Electronics & Telecommunication',
  'Mechanical Engineering',
  'Applied Science & Humanities',
];

export default function FacultyModal({ isOpen, onClose, onSave, facultyToEdit = null }) {
  const isEdit = Boolean(facultyToEdit);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employee_id: '',
    designation: 'Assistant Professor',
    department: 'Computer Engineering',
    password: '',
    is_seminar_coordinator: false,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (facultyToEdit) {
      setFormData({
        name: facultyToEdit.name || '',
        email: facultyToEdit.email || '',
        employee_id: facultyToEdit.employee_id || '',
        designation: facultyToEdit.designation || 'Assistant Professor',
        department: facultyToEdit.department || 'Computer Engineering',
        password: '',
        is_seminar_coordinator: Boolean(facultyToEdit.is_seminar_coordinator),
      });
    } else {
      setFormData({
        name: '',
        email: '',
        employee_id: '',
        designation: 'Assistant Professor',
        department: 'Computer Engineering',
        password: '',
        is_seminar_coordinator: false,
      });
    }
  }, [facultyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Please enter the faculty member’s full name');
      return;
    }
    if (!formData.employee_id.trim()) {
      toast.error('Please enter an Employee ID');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Please enter a valid official email address');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        employee_id: formData.employee_id.trim().toUpperCase(),
        designation: formData.designation,
        department: formData.department,
        is_seminar_coordinator: formData.is_seminar_coordinator,
      };

      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const result = await onSave(payload, facultyToEdit?.id);
      if (result?.success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded border border-gray-300 shadow-xl w-full max-w-lg overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Institutional Header */}
        <div className="px-6 py-4 bg-[#1E2D5A] text-white flex items-center justify-between border-b border-[#141C38]">
          <div>
            <h3 className="font-serif text-base font-bold text-white tracking-wide">
              {isEdit ? 'Edit Faculty Record' : 'Register Faculty Member'}
            </h3>
            <p className="text-xs text-slate-200 mt-0.5">
              {isEdit ? `Updating department records for ${facultyToEdit.name}` : 'Register a new faculty member into department records'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded transition-colors text-base font-bold leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. (Mrs.) S. K. Wagh"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SKW or EMP102"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs uppercase font-mono bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Official Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. skw@meswadiacoe.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Designation <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors font-medium"
              >
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors font-medium"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                {isEdit ? 'Update Password (leave blank to keep current)' : 'Account Password'}
              </label>
              <input
                type="password"
                placeholder={isEdit ? '••••••••' : 'Default: faculty@123'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 focus:outline-none focus:border-navy transition-colors"
              />
            </div>

            <div className="md:col-span-2 bg-[#FAF8F5] p-3 rounded border border-[#E8E4DC]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_seminar_coordinator}
                  onChange={(e) => setFormData({ ...formData, is_seminar_coordinator: e.target.checked })}
                  className="rounded border-gray-300 text-navy focus:ring-navy w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-800">
                  Appoint as TE Seminar Coordinator
                </span>
              </label>
              <p className="text-[11px] text-gray-500 mt-1 ml-6">
                Grants coordinator authority for managing TE Seminar sessions, uploads, and guide allocations.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E2D5A] hover:bg-[#141C38] disabled:opacity-50 rounded shadow-2xs transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Saving…</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Register Faculty'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
