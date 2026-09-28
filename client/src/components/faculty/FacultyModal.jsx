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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold">
              {isEdit ? '✎' : '+'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {isEdit ? 'Edit Faculty Details' : 'Add New Faculty Member'}
              </h3>
              <p className="text-xs text-slate-300">
                {isEdit ? `Updating records for ${facultyToEdit.name}` : 'Register a new faculty member into Supabase database'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. (Mrs.) S. K. Wagh"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SKW or EMP102"
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. skw@meswadiacoe.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designation <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isEdit ? 'Update Password (leave blank to keep current)' : 'Account Password'}
              </label>
              <input
                type="password"
                placeholder={isEdit ? '••••••••' : 'Default: faculty@123'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_seminar_coordinator}
                  onChange={(e) => setFormData({ ...formData, is_seminar_coordinator: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Appoint as TE Seminar Coordinator
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Grants coordinator privileges for managing TE Seminar sessions, uploads, and guide allocations.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? 'Save Changes' : 'Add Faculty Member'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
