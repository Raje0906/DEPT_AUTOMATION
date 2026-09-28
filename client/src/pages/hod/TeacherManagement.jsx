import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ALL_CLASSES, getClassesForSemester } from '../../utils/academicClasses';
import FacultyModal from '../../components/faculty/FacultyModal';
import facultyService from '../../services/facultyService';

export default function TeacherManagement() {
  const [teachers, setTeachers]             = useState([]);
  const [subjects, setSubjects]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [searchTerm, setSearchTerm]         = useState('');
  const [selectedDept, setSelectedDept]     = useState('all');
  const [activeTab, setActiveTab]           = useState('directory'); // 'directory' | 'allocation'

  // Faculty CRUD Modals
  const [facultyModalOpen, setFacultyModalOpen] = useState(false);
  const [facultyToEdit, setFacultyToEdit]       = useState(null);
  const [deleteConfirmFaculty, setDeleteConfirmFaculty] = useState(null);
  const [deleting, setDeleting]                 = useState(false);

  // Multi-Subject Assignment Form State
  const [modalOpen, setModalOpen]     = useState(false);
  const [ctModalOpen, setCtModalOpen] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const [form, setForm] = useState({
    facultyId: '',
    academicYear: '2026-27',
    isClassTeacher: false,
    classTeacherFor: 'SE Comp 1',
    items: [
      { subjectId: '', division: 'SE Comp 1' },
    ],
  });

  // Dedicated Class Teacher Appointment Form State
  const [ctForm, setCtForm] = useState({
    facultyId: '',
    className: 'SE Comp 1',
    academicYear: '2026-27',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, sRes] = await Promise.all([
        api.get('/hod/teachers'),
        api.get('/hod/all-subjects'),
      ]);
      setTeachers(tRes.data.teachers || []);
      setSubjects(sRes.data.subjects || []);
    } catch (err) {
      console.error('[TeacherManagement] Fetch error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to load faculty and subject data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Faculty Add/Edit/Delete Handlers ─────────────────────────────────────

  const handleOpenAddFaculty = () => {
    setFacultyToEdit(null);
    setFacultyModalOpen(true);
  };

  const handleOpenEditFaculty = (faculty) => {
    setFacultyToEdit(faculty);
    setFacultyModalOpen(true);
  };

  const handleSaveFaculty = async (formData, editId) => {
    try {
      if (editId) {
        const res = await facultyService.updateFaculty(editId, formData);
        toast.success(res.message || 'Faculty member updated successfully');
      } else {
        const res = await facultyService.addFaculty(formData);
        toast.success(res.message || 'Faculty member added successfully');
      }
      await fetchData();
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Operation failed';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const handleDeleteFaculty = async () => {
    if (!deleteConfirmFaculty) return;
    setDeleting(true);
    try {
      const res = await facultyService.deleteFaculty(deleteConfirmFaculty.id);
      toast.success(res.message || 'Faculty member removed successfully');
      setDeleteConfirmFaculty(null);
      await fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to delete faculty member';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Course & Class Teacher Assignment Handlers ───────────────────────────

  const openAssignModal = (prefillFacultyId = '') => {
    const defaultFaculty = prefillFacultyId || (teachers[0] ? String(teachers[0].id) : '');
    const defaultSubject = subjects[0] ? String(subjects[0].id) : '';
    const suggestedClasses = subjects[0] ? getClassesForSemester(subjects[0].semester) : ALL_CLASSES;
    const defaultClass = suggestedClasses[0] || 'SE Comp 1';

    setForm({
      facultyId: defaultFaculty,
      academicYear: '2026-27',
      isClassTeacher: false,
      classTeacherFor: defaultClass,
      items: [
        { subjectId: defaultSubject, division: defaultClass },
      ],
    });
    setModalOpen(true);
  };

  const handleAddItem = () => {
    const defaultSubject = subjects[0] ? String(subjects[0].id) : '';
    const suggestedClasses = subjects[0] ? getClassesForSemester(subjects[0].semester) : ALL_CLASSES;
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { subjectId: defaultSubject, division: suggestedClasses[0] || 'SE Comp 1' },
      ],
    }));
  };

  const handleDuplicateItem = (index) => {
    setForm((f) => {
      const copy = { ...f.items[index] };
      const newItems = [...f.items];
      newItems.splice(index + 1, 0, copy);
      return { ...f, items: newItems };
    });
  };

  const handleRemoveItem = (index) => {
    if (form.items.length <= 1) return;
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemSubjectChange = (index, newSubjectId) => {
    const sub = subjects.find((s) => String(s.id) === String(newSubjectId));
    const suggestedClasses = sub ? getClassesForSemester(sub.semester) : ALL_CLASSES;
    setForm((f) => {
      const newItems = [...f.items];
      const curDiv = newItems[index].division;
      const nextDiv = suggestedClasses.includes(curDiv) ? curDiv : (suggestedClasses[0] || 'SE Comp 1');
      newItems[index] = {
        ...newItems[index],
        subjectId: newSubjectId,
        division: nextDiv,
      };
      return { ...f, items: newItems };
    });
  };

  const handleItemDivisionChange = (index, newDivision) => {
    setForm((f) => {
      const newItems = [...f.items];
      newItems[index] = {
        ...newItems[index],
        division: newDivision,
      };
      return { ...f, items: newItems };
    });
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.facultyId) {
      toast.error('Please select a faculty member');
      return;
    }
    if (!form.items || form.items.length === 0) {
      toast.error('Please add at least one course to assign');
      return;
    }

    const seen = new Set();
    for (let i = 0; i < form.items.length; i++) {
      const it = form.items[i];
      if (!it.subjectId || !it.division) {
        toast.error(`Please select both subject and class for Course #${i + 1}`);
        return;
      }
      const pairKey = `${it.subjectId}_${it.division}`;
      if (seen.has(pairKey)) {
        const sub = subjects.find((s) => String(s.id) === String(it.subjectId));
        toast.error(`Duplicate row: ${sub?.code || 'Subject'} for ${it.division} is selected multiple times.`);
        return;
      }
      seen.add(pairKey);
    }

    setSubmitting(true);
    try {
      const res = await api.post('/hod/teachers/assign', {
        facultyId: parseInt(form.facultyId, 10),
        academicYear: form.academicYear,
        isClassTeacher: form.isClassTeacher,
        classTeacherFor: form.classTeacherFor || (form.items[0] && form.items[0].division),
        assignments: form.items.map((it) => ({
          subjectId: parseInt(it.subjectId, 10),
          division: it.division,
        })),
      });
      toast.success(res.data.message || 'Courses assigned successfully!');
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetClassTeacher = async (e) => {
    e.preventDefault();
    if (!ctForm.facultyId || !ctForm.className) {
      toast.error('Please select teacher and class');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/hod/teachers/set-class-teacher', {
        facultyId: parseInt(ctForm.facultyId, 10),
        className: ctForm.className,
        academicYear: ctForm.academicYear,
      });
      toast.success(res.data.message || 'Class Teacher designated successfully!');
      setCtModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to designate class teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveClassTeacher = async (id, className) => {
    if (!window.confirm(`Are you sure you want to remove Class Teacher designation for ${className}?`)) {
      return;
    }

    try {
      await api.delete(`/hod/teachers/remove-class-teacher/${id}`);
      toast.success(`Removed Class Teacher designation for ${className}`);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove class teacher');
    }
  };

  const handleUnassign = async (mappingId, subjectName, className) => {
    if (!window.confirm(`Are you sure you want to remove assignment for ${subjectName} (${className})?`)) {
      return;
    }

    try {
      await api.delete(`/hod/teachers/unassign/${mappingId}`);
      toast.success('Assignment removed successfully');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove assignment');
    }
  };

  // Derive unique departments
  const departments = ['all', ...Array.from(new Set(teachers.map((t) => t.department).filter(Boolean))).sort()];

  const filteredTeachers = teachers.filter((t) => {
    const matchesDept = selectedDept === 'all' || t.department === selectedDept;
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      (t.name && t.name.toLowerCase().includes(s)) ||
      (t.employee_id && t.employee_id.toLowerCase().includes(s)) ||
      (t.designation && t.designation.toLowerCase().includes(s)) ||
      (t.email && t.email.toLowerCase().includes(s));
    return matchesDept && matchesSearch;
  });

  const totalAssignments = teachers.reduce((acc, t) => acc + (t.assignments?.length || 0), 0);
  const totalClassTeachers = teachers.reduce((acc, t) => acc + (t.classTeacherOf?.length || 0), 0);

  if (loading) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mb-3"></div>
        <p className="text-sm font-medium text-slate-600">Connecting to Supabase faculty database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            !
          </div>
          <h3 className="text-base font-bold text-red-900 mb-1">Failed to Load Faculty Records</h3>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-2"
          >
            ↻ Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-slate-900">
              Faculty &amp; Teaching Staff Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
              {teachers.length} Faculty Members
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Real-time directory synchronized with Supabase <code className="text-xs bg-slate-100 px-1 py-0.5 rounded text-blue-700">faculty</code> table. Manage profiles, course mappings, and class teacher designations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddFaculty}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Add Faculty Member
          </button>

          <button
            onClick={() => openAssignModal()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>📖</span> Assign Course
          </button>

          <button
            onClick={() => {
              setCtForm({
                facultyId: teachers[0] ? String(teachers[0].id) : '',
                className: 'SE Comp 1',
                academicYear: '2026-27',
              });
              setCtModalOpen(true);
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <span>⭐</span> Appoint Class Teacher
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Total Faculty Members</p>
          <p className="font-serif text-3xl font-bold text-slate-900 mt-1">{teachers.length}</p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Synchronized with Supabase DB
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Active Course Mappings</p>
          <p className="font-serif text-3xl font-bold text-blue-700 mt-1">{totalAssignments}</p>
          <p className="text-xs text-slate-500 mt-1">Teaching subject &amp; division links</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Class Teachers Appointed</p>
          <p className="font-serif text-3xl font-bold text-amber-600 mt-1">{totalClassTeachers} / 12</p>
          <p className="text-xs text-slate-500 mt-1">Designated class guardians</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Seminar Coordinators</p>
          <p className="font-serif text-3xl font-bold text-indigo-700 mt-1">
            {teachers.filter((t) => t.is_seminar_coordinator).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">TE Seminar coordinator authority</p>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* Tab Selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'directory'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty Directory ({filteredTeachers.length})
            </button>
            <button
              onClick={() => setActiveTab('allocation')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'allocation'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Workload &amp; Assignments
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredTeachers.length}</strong> of {teachers.length} faculty
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <input
              type="text"
              placeholder="Search faculty by name, employee ID, email, or designation…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-9 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'all' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredTeachers.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            👤
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Faculty Members Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            {searchTerm || selectedDept !== 'all'
              ? 'No faculty matched your active search and department filters.'
              : 'There are currently no faculty members registered in the Supabase database.'}
          </p>
          {(searchTerm || selectedDept !== 'all') ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('all');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleOpenAddFaculty}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              + Add First Faculty Member
            </button>
          )}
        </div>
      )}

      {/* Directory Grid View */}
      {activeTab === 'directory' && filteredTeachers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const assignments = teacher.assignments || [];
            const classTeacherOf = teacher.classTeacherOf || [];

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-blue-700/10 text-blue-800 font-serif font-bold text-sm flex items-center justify-center flex-shrink-0 border border-blue-700/20">
                        {teacher.name
                          .replace('Dr. ', '')
                          .replace('(Mrs.) ', '')
                          .replace('(Miss.) ', '')
                          .replace('(Mr.) ', '')
                          .replace('Mr. ', '')
                          .replace('Mrs. ', '')
                          .replace('Ms. ', '')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-blue-700 font-semibold mt-0.5">
                          {teacher.designation}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                      {teacher.employee_id}
                    </span>
                  </div>

                  {/* Metadata Pills */}
                  <div className="space-y-1.5 text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Email:</span>
                      <span className="font-medium text-slate-800 truncate ml-2">{teacher.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Department:</span>
                      <span className="font-medium text-slate-800">{teacher.department}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    {teacher.is_seminar_coordinator && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        🎓 Seminar Coordinator
                      </span>
                    )}

                    {classTeacherOf.map((ct) => (
                      <span
                        key={ct.class_teacher_id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                      >
                        ⭐ Class Teacher: {ct.class_name}
                      </span>
                    ))}

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      📚 {assignments.length} {assignments.length === 1 ? 'Course' : 'Courses'}
                    </span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openAssignModal(String(teacher.id))}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 px-2.5 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    + Assign Course
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditFaculty(teacher)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      title="Edit faculty details"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmFaculty(teacher)}
                      className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded transition-colors"
                      title="Delete faculty member"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocation / Workload Tab */}
      {activeTab === 'allocation' && filteredTeachers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTeachers.map((teacher) => {
            const assignments = teacher.assignments || [];
            const classTeacherOf = teacher.classTeacherOf || [];

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-serif font-bold text-base flex items-center justify-center flex-shrink-0">
                        {teacher.name
                          .replace('Dr. ', '')
                          .replace('(Mrs.) ', '')
                          .replace('(Miss.) ', '')
                          .replace('(Mr.) ', '')
                          .replace('Mr. ', '')
                          .replace('Mrs. ', '')
                          .replace('Ms. ', '')
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-serif text-base font-bold text-slate-900 leading-tight">
                          {teacher.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                          {teacher.designation} · <span className="font-mono font-bold text-slate-800">{teacher.employee_id}</span>
                        </p>
                        <p className="text-xs text-slate-400">{teacher.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => openAssignModal(String(teacher.id))}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-700 hover:text-white text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors flex-shrink-0"
                    >
                      + Assign
                    </button>
                  </div>

                  {/* Class Teacher Badge(s) */}
                  {classTeacherOf.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {classTeacherOf.map((ct) => (
                          <span
                            key={ct.class_teacher_id}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs"
                          >
                            <span className="flex items-center gap-1">
                              <span>⭐</span>
                              <span>Class Teacher:</span>
                              <span className="underline decoration-amber-400 font-extrabold">{ct.class_name}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveClassTeacher(ct.class_teacher_id, ct.class_name)}
                              className="text-amber-700 hover:text-red-700 font-black text-sm ml-1 cursor-pointer transition-colors"
                              title="Remove Class Teacher designation"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Subjects & Classes */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Teaching Subjects &amp; Classes ({assignments.length})
                    </h4>

                    {assignments.length === 0 ? (
                      <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-400">No subjects assigned yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignments.map((asgn) => (
                          <div
                            key={asgn.mapping_id}
                            className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">{asgn.subject_name}</span>
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {asgn.subject_code}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                  {asgn.division}
                                </span>
                                <span>·</span>
                                <span>Sem {asgn.semester}</span>
                                <span>·</span>
                                <span>{asgn.academic_year}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnassign(asgn.mapping_id, asgn.subject_name, asgn.division)}
                              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors text-sm font-bold flex-shrink-0"
                              title="Remove assignment"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Add / Edit Faculty Modal */}
      <FacultyModal
        isOpen={facultyModalOpen}
        onClose={() => {
          setFacultyModalOpen(false);
          setFacultyToEdit(null);
        }}
        onSave={handleSaveFaculty}
        facultyToEdit={facultyToEdit}
      />

      {/* Modal 2: Delete Faculty Confirmation Dialog */}
      {deleteConfirmFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              🗑
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Faculty Member</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete <strong className="text-slate-900">{deleteConfirmFaculty.name}</strong> ({deleteConfirmFaculty.employee_id})? This will remove their user account and all associated assignments from Supabase.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirmFaculty(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFaculty}
                disabled={deleting}
                className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg shadow-sm transition-all"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Faculty'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Multi-Subject Course Assignment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 flex-shrink-0">
              <div>
                <h2 className="font-serif text-xl font-bold text-slate-900">Assign Teaching Courses</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Allocate single or multiple subjects &amp; divisions to a faculty member for the academic year.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Faculty Member
                  </label>
                  <select
                    value={form.facultyId}
                    onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                    required
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.employee_id} · {t.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                  >
                    <option value="2026-27">2026-27 (Current)</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                  </select>
                </div>
              </div>

              {/* Course Items Table */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Courses to Assign ({form.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2.5 py-1 rounded shadow-2xs hover:bg-blue-50 transition-colors"
                  >
                    + Add Another Course
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, idx) => {
                    const selectedSub = subjects.find((s) => String(s.id) === String(item.subjectId));
                    const allowedClasses = selectedSub
                      ? getClassesForSemester(selectedSub.semester)
                      : ALL_CLASSES;

                    return (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">
                            Course #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(idx)}
                              className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                              title="Duplicate for another division"
                            >
                              Duplicate
                            </button>
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-[11px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Subject
                            </label>
                            <select
                              value={item.subjectId}
                              onChange={(e) => handleItemSubjectChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
                              required
                            >
                              <option value="">-- Choose Subject --</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Sem {s.semester} · {s.code} - {s.name} ({s.credits} Credits)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">
                              Target Class / Division
                            </label>
                            <select
                              value={item.division}
                              onChange={(e) => handleItemDivisionChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-bold text-slate-800"
                              required
                            >
                              {allowedClasses.map((cls) => (
                                <option key={cls} value={cls}>
                                  {cls}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Class Teacher Checkbox */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isClassTeacher}
                    onChange={(e) => setForm({ ...form, isClassTeacher: e.target.checked })}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    Also designate as Class Teacher for a class
                  </span>
                </label>

                {form.isClassTeacher && (
                  <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center gap-3">
                    <label className="text-xs font-bold text-amber-900 flex-shrink-0">
                      Class:
                    </label>
                    <select
                      value={form.classTeacherFor}
                      onChange={(e) => setForm({ ...form, classTeacherFor: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs bg-white font-bold text-amber-950"
                    >
                      <optgroup label="Second Year (SE)">
                        <option value="SE Comp 1">SE Comp 1</option>
                        <option value="SE Comp 2">SE Comp 2</option>
                        <option value="SE Comp 3">SE Comp 3</option>
                        <option value="SE Comp 4">SE Comp 4</option>
                      </optgroup>
                      <optgroup label="Third Year (TE)">
                        <option value="TE Comp 1">TE Comp 1</option>
                        <option value="TE Comp 2">TE Comp 2</option>
                        <option value="TE Comp 3">TE Comp 3</option>
                        <option value="TE Comp 4">TE Comp 4</option>
                      </optgroup>
                      <optgroup label="Final Year (BE)">
                        <option value="BE Comp 1">BE Comp 1</option>
                        <option value="BE Comp 2">BE Comp 2</option>
                        <option value="BE Comp 3">BE Comp 3</option>
                        <option value="BE Comp 4">BE Comp 4</option>
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg shadow-sm transition-all"
                >
                  {submitting
                    ? 'Assigning…'
                    : `Confirm Assignment (${form.items.length} ${form.items.length === 1 ? 'Course' : 'Courses'})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Dedicated Class Teacher Appointment Dialog */}
      {ctModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h2 className="font-serif text-lg font-bold text-slate-900">Designate Class Teacher</h2>
              </div>
              <button
                onClick={() => setCtModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetClassTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Faculty
                </label>
                <select
                  value={ctForm.facultyId}
                  onChange={(e) => setCtForm({ ...ctForm, facultyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.employee_id} · {t.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Class
                </label>
                <select
                  value={ctForm.className}
                  onChange={(e) => setCtForm({ ...ctForm, className: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                  required
                >
                  <optgroup label="Second Year (SE)">
                    <option value="SE Comp 1">SE Comp 1</option>
                    <option value="SE Comp 2">SE Comp 2</option>
                    <option value="SE Comp 3">SE Comp 3</option>
                    <option value="SE Comp 4">SE Comp 4</option>
                  </optgroup>
                  <optgroup label="Third Year (TE)">
                    <option value="TE Comp 1">TE Comp 1</option>
                    <option value="TE Comp 2">TE Comp 2</option>
                    <option value="TE Comp 3">TE Comp 3</option>
                    <option value="TE Comp 4">TE Comp 4</option>
                  </optgroup>
                  <optgroup label="Final Year (BE)">
                    <option value="BE Comp 1">BE Comp 1</option>
                    <option value="BE Comp 2">BE Comp 2</option>
                    <option value="BE Comp 3">BE Comp 3</option>
                    <option value="BE Comp 4">BE Comp 4</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <select
                  value={ctForm.academicYear}
                  onChange={(e) => setCtForm({ ...ctForm, academicYear: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold"
                >
                  <option value="2026-27">2026-27 (Current)</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
                <button
                  type="button"
                  onClick={() => setCtModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg shadow-sm transition-all"
                >
                  {submitting ? 'Appointing…' : 'Appoint Class Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
