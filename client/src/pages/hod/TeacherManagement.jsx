import React, { useEffect, useState, useMemo } from 'react';
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
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll]               = useState(false);
  const [deleteAllYearFilter, setDeleteAllYearFilter] = useState('all');
  const [workloadView, setWorkloadView]             = useState('class'); // 'class' | 'faculty'
  const [selectedClassYear, setSelectedClassYear]   = useState('all'); // 'all' | 'SE' | 'TE' | 'BE'
  const [selectedSemester, setSelectedSemester]     = useState('all'); // 'all' | '3' | '4' | '5' | '6' | '7' | '8'
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2026-27');

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

  const openAssignModal = (prefillFacultyId = '', prefillClass = '', prefillSemester = null) => {
    const defaultFaculty = prefillFacultyId || (teachers[0] ? String(teachers[0].id) : '');
    const defaultClass = prefillClass || 'TE Comp 1';

    let defaultSubject = subjects[0] ? String(subjects[0].id) : '';
    if (prefillSemester) {
      const semNum = parseInt(prefillSemester, 10);
      const matchingSub = subjects.find((s) => s.semester === semNum);
      if (matchingSub) defaultSubject = String(matchingSub.id);
    } else if (prefillClass) {
      const isSE = prefillClass.startsWith('SE');
      const isTE = prefillClass.startsWith('TE');
      const isBE = prefillClass.startsWith('BE');
      const matchingSub = subjects.find((s) => {
        if (isSE) return s.semester === 3 || s.semester === 4;
        if (isTE) return s.semester === 5 || s.semester === 6;
        if (isBE) return s.semester === 7 || s.semester === 8;
        return true;
      });
      if (matchingSub) defaultSubject = String(matchingSub.id);
    }

    setForm({
      facultyId: defaultFaculty,
      academicYear: selectedAcademicYear === 'all' ? '2026-27' : selectedAcademicYear,
      isClassTeacher: false,
      classTeacherFor: defaultClass,
      items: [
        { subjectId: defaultSubject, division: defaultClass },
      ],
    });
    setModalOpen(true);
  };

  const openCtModalForClass = (targetClass) => {
    setCtForm({
      facultyId: teachers[0] ? String(teachers[0].id) : '',
      className: targetClass,
      academicYear: '2026-27',
    });
    setCtModalOpen(true);
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

  const handleUnassignAll = async () => {
    setDeletingAll(true);
    try {
      const url = deleteAllYearFilter === 'all'
        ? '/hod/teachers/unassign-all'
        : `/hod/teachers/unassign-all?academic_year=${deleteAllYearFilter}`;
      const res = await api.delete(url);
      toast.success(res.data?.message || 'All assigned subjects deleted successfully');
      setDeleteAllModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete assigned subjects');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleUnassignFaculty = async (facultyId, facultyName) => {
    if (!window.confirm(`Are you sure you want to delete ALL assigned subjects for ${facultyName}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/hod/teachers/unassign-faculty/${facultyId}`);
      toast.success(res.data?.message || `Removed all assigned subjects for ${facultyName}`);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete assigned subjects for this faculty');
    }
  };

  const handleUnassignClass = async (className) => {
    if (!window.confirm(`Are you sure you want to delete ALL assigned courses for ${className}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/hod/teachers/unassign-class/${encodeURIComponent(className)}`);
      toast.success(res.data?.message || `Removed all course allocations for ${className}`);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to remove course allocations for ${className}`);
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

  // Derive available academic years
  const availableAcademicYears = useMemo(() => {
    const set = new Set();
    teachers.forEach((t) => {
      (t.assignments || []).forEach((a) => { if (a.academic_year) set.add(a.academic_year); });
      (t.classTeacherOf || []).forEach((ct) => { if (ct.academic_year) set.add(ct.academic_year); });
    });
    set.add('2026-27');
    set.add('2025-26');
    return ['all', ...Array.from(set).sort().reverse()];
  }, [teachers]);

  // Flatten all subject assignments across all teachers with faculty metadata, filtered by selected academic year
  const allAssignmentsList = useMemo(() => {
    return teachers.flatMap((t) =>
      (t.assignments || [])
        .filter((asgn) => selectedAcademicYear === 'all' || asgn.academic_year === selectedAcademicYear)
        .map((asgn) => ({
          ...asgn,
          faculty_name: t.name,
          faculty_id: t.id,
          faculty_employee_id: t.employee_id,
          faculty_designation: t.designation,
          faculty_email: t.email,
        }))
    );
  }, [teachers, selectedAcademicYear]);

  // Map of class name to Class Teacher, filtered by selected academic year
  const classTeacherMap = useMemo(() => {
    const map = {};
    teachers.forEach((t) => {
      (t.classTeacherOf || [])
        .filter((ct) => selectedAcademicYear === 'all' || ct.academic_year === selectedAcademicYear)
        .forEach((ct) => {
          map[ct.class_name] = {
            ...ct,
            faculty_name: t.name,
            faculty_id: t.id,
            employee_id: t.employee_id,
            designation: t.designation,
          };
        });
    });
    return map;
  }, [teachers, selectedAcademicYear]);

  const totalAssignments = allAssignmentsList.length;
  const totalClassTeachers = Object.keys(classTeacherMap).length;

  // Complete list of classes: standard classes (SE, TE, BE 1 to 4) plus any existing assignments/class teacher classes
  const allClassesSet = new Set([
    ...ALL_CLASSES,
    ...allAssignmentsList.map((a) => a.division).filter(Boolean),
    ...Object.keys(classTeacherMap),
  ]);
  const allClasses = Array.from(allClassesSet);

  // Filter classes by selectedClassYear, selectedSemester, and searchTerm
  const filteredClasses = allClasses.filter((cls) => {
    if (selectedSemester !== 'all') {
      const sem = parseInt(selectedSemester, 10);
      if (sem === 3 || sem === 4) return cls.startsWith('SE');
      if (sem === 5 || sem === 6) return cls.startsWith('TE');
      if (sem === 7 || sem === 8) return cls.startsWith('BE');
      return true;
    }
    if (selectedClassYear === 'all') return true;
    return cls.startsWith(selectedClassYear);
  }).filter((cls) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const ct = classTeacherMap[cls];
    const classAssgns = allAssignmentsList.filter((a) =>
      a.division === cls && (selectedSemester === 'all' || String(a.semester) === String(selectedSemester))
    );
    const matchesClassName = cls.toLowerCase().includes(s);
    const matchesCT = ct && (ct.faculty_name?.toLowerCase().includes(s) || ct.employee_id?.toLowerCase().includes(s));
    const matchesSubject = classAssgns.some(
      (a) =>
        a.subject_name?.toLowerCase().includes(s) ||
        a.subject_code?.toLowerCase().includes(s) ||
        a.faculty_name?.toLowerCase().includes(s)
    );
    return matchesClassName || Boolean(matchesCT) || Boolean(matchesSubject);
  });

  if (loading) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy mb-3"></div>
        <p className="text-xs font-medium text-slate-600">Retrieving department faculty register…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded p-6 text-center">
          <div className="w-10 h-10 rounded bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-3 text-base font-bold font-mono">
            !
          </div>
          <h3 className="font-serif text-base font-bold text-red-900 mb-1">Failed to Load Faculty Records</h3>
          <p className="text-xs text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-3.5 py-1.5 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors inline-flex items-center gap-1.5"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Institutional Header */}
      <div className="pb-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl lg:text-3xl font-bold text-gray-900">
              Faculty &amp; Teaching Staff Management
            </h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-white text-navy border border-gray-300 shadow-2xs">
              {teachers.length} Faculty Members
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Department of Computer Engineering faculty register, course allocation matrix, and class teacher governance (AY 2026–27).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleOpenAddFaculty}
            className="px-3.5 py-2 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span className="text-sm leading-none">+</span> Add Faculty Member
          </button>

          <button
            type="button"
            onClick={() => openAssignModal()}
            className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-xs font-semibold rounded shadow-2xs transition-colors"
          >
            Assign Course
          </button>

          <button
            type="button"
            onClick={() => {
              setCtForm({
                facultyId: teachers[0] ? String(teachers[0].id) : '',
                className: 'SE Comp 1',
                academicYear: '2026-27',
              });
              setCtModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-xs font-semibold rounded shadow-2xs transition-colors"
          >
            Appoint Class Teacher
          </button>

          <button
            type="button"
            onClick={() => setDeleteAllModalOpen(true)}
            disabled={totalAssignments === 0}
            className="px-3.5 py-2 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-white text-red-700 text-xs font-semibold rounded shadow-2xs transition-colors"
            title="Delete all assigned courses for all faculty members"
          >
            Delete All Assigned Subjects
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total Faculty Members</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">{teachers.length}</p>
          <p className="text-xs text-slate-500 mt-1">Approved department roster</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Active Course Mappings</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">{totalAssignments}</p>
          <p className="text-xs text-slate-500 mt-1">Teaching subject &amp; division links</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Class Teachers Appointed</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">{totalClassTeachers} / 12</p>
          <p className="text-xs text-slate-500 mt-1">Designated class guardians</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded border border-rule shadow-2xs">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Seminar Coordinators</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1 tabular-num">
            {teachers.filter((t) => t.is_seminar_coordinator).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">TE Seminar coordinator authority</p>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white p-4 rounded border border-rule shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-2">
          {/* Tab Selector */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'directory'
                  ? 'border-navy text-navy font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Faculty Directory ({filteredTeachers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('allocation')}
              className={`pb-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'allocation'
                  ? 'border-navy text-navy font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              Workload &amp; Course Assignments
            </button>
          </div>

          <div className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-800 font-semibold">{filteredTeachers.length}</strong> of {teachers.length} faculty members
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <input
              type="text"
              placeholder="Search faculty by name, employee ID, email, or designation…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 pl-8 border border-gray-300 rounded text-xs bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-navy transition-colors"
            />
            <span className="absolute left-2.5 top-2 text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-navy transition-colors font-semibold"
            >
              {availableAcademicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr === 'all' ? 'All Academic Years' : `AY ${yr}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-800 focus:outline-none focus:border-navy transition-colors font-medium"
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
        <div className="bg-white rounded border border-rule p-12 text-center shadow-2xs">
          <div className="w-10 h-10 rounded bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3 text-sm font-bold font-mono">
            N/A
          </div>
          <h3 className="font-serif text-base font-bold text-gray-900 mb-1">No Faculty Members Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
            {searchTerm || selectedDept !== 'all'
              ? 'No faculty matched your active search and department filters.'
              : 'There are currently no faculty members registered in the department faculty register.'}
          </p>
          {(searchTerm || selectedDept !== 'all') ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('all');
              }}
              className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 text-xs font-medium rounded transition-colors"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleOpenAddFaculty}
              className="px-3.5 py-1.5 bg-[#1E2D5A] hover:bg-[#141C38] text-white text-xs font-semibold rounded shadow-2xs transition-colors"
            >
              + Register Faculty Member
            </button>
          )}
        </div>
      )}

      {/* Directory Grid View */}
      {activeTab === 'directory' && filteredTeachers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const assignments = teacher.assignments || [];
            const classTeacherOf = teacher.classTeacherOf || [];

            return (
              <div
                key={teacher.id}
                className="bg-white rounded border border-rule p-4 shadow-2xs hover:border-gray-400 transition-colors flex flex-col justify-between"
              >
                <div>
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded bg-[#FAF8F5] border border-[#D4D0C8] text-slate-800 font-serif font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {(teacher.name || '')
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
                        <h3 className="font-serif font-bold text-gray-900 text-sm leading-tight truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {teacher.designation}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-gray-300 flex-shrink-0">
                      {teacher.employee_id}
                    </span>
                  </div>

                  {/* Metadata Box */}
                  <div className="space-y-1 text-xs text-slate-600 mb-3 bg-[#FAF8F5] p-2.5 rounded border border-[#E8E4DC]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-[11px] text-gray-800 truncate ml-2">{teacher.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-medium text-gray-800">{teacher.department}</span>
                    </div>
                  </div>

                  {/* Institutional Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {teacher.is_seminar_coordinator && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200">
                        Seminar Coordinator
                      </span>
                    )}

                    {classTeacherOf.map((ct) => (
                      <span
                        key={ct.class_teacher_id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300"
                      >
                        Class Teacher: {ct.class_name}
                      </span>
                    ))}

                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {assignments.length} {assignments.length === 1 ? 'Course' : 'Courses'}
                    </span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openAssignModal(String(teacher.id))}
                    className="text-xs font-semibold text-navy hover:underline transition-colors"
                  >
                    + Assign Course
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditFaculty(teacher)}
                      className="px-2 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
                      title="Edit faculty details"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmFaculty(teacher)}
                      className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 rounded transition-colors"
                      title="Delete faculty member"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocation / Workload Tab */}
      {activeTab === 'allocation' && (
        <div className="space-y-4">
          {/* Allocation Control Strip */}
          <div className="bg-white p-3.5 rounded border border-rule shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-sm font-bold text-gray-900">
                  Department Course Allocation &amp; Workload Matrix
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Total active course assignments: <strong className="text-gray-900 font-semibold">{totalAssignments}</strong> across {teachers.filter(t => (t.assignments?.length || 0) > 0).length} faculty members and {allClasses.length} department classes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDeleteAllModalOpen(true)}
                disabled={totalAssignments === 0}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white text-xs font-semibold rounded shadow-2xs transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Delete all assigned courses for all faculty members"
              >
                Delete All Assigned Subjects (All Faculty)
              </button>
            </div>

            {/* View Switcher & Year/Semester Filters */}
            <div className="pt-2.5 border-t border-gray-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* Toggle: Class-Wise vs Faculty-Wise */}
              <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded border border-[#E8E4DC]">
                <button
                  type="button"
                  onClick={() => setWorkloadView('class')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    workloadView === 'class'
                      ? 'bg-[#1E2D5A] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Class-Wise View ({allClasses.length} Classes)
                </button>
                <button
                  type="button"
                  onClick={() => setWorkloadView('faculty')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    workloadView === 'faculty'
                      ? 'bg-[#1E2D5A] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Faculty-Wise View ({filteredTeachers.length} Faculty)
                </button>
              </div>

              {/* Class Year & Semester Filters (in Class-Wise View) */}
              {workloadView === 'class' && (
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {/* Cohort Filter */}
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Cohort:</span>
                    {[
                      { key: 'all', label: 'All Classes' },
                      { key: 'TE', label: 'TE Comp' },
                      { key: 'SE', label: 'SE Comp' },
                      { key: 'BE', label: 'BE Comp' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setSelectedClassYear(f.key);
                          if (f.key === 'TE' && selectedSemester !== '5' && selectedSemester !== '6') {
                            setSelectedSemester('all');
                          } else if (f.key === 'SE' && selectedSemester !== '3' && selectedSemester !== '4') {
                            setSelectedSemester('all');
                          } else if (f.key === 'BE' && selectedSemester !== '7' && selectedSemester !== '8') {
                            setSelectedSemester('all');
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                          selectedClassYear === f.key
                            ? 'bg-navy text-white font-bold'
                            : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Semester Separate Filters */}
                  <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
                    <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Semester:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSemester('all')}
                      className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                        selectedSemester === 'all'
                          ? 'bg-navy text-white font-bold'
                          : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      All Sems
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSemester('5');
                        setSelectedClassYear('TE');
                      }}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSemester === '5'
                          ? 'bg-indigo-700 text-white font-bold shadow-2xs'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300'
                      }`}
                    >
                      Sem 5 (Odd)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSemester('6');
                        setSelectedClassYear('TE');
                      }}
                      className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSemester === '6'
                          ? 'bg-teal-700 text-white font-bold shadow-2xs'
                          : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300'
                      }`}
                    >
                      Sem 6 (Even)
                    </button>
                    {['3', '4', '7', '8'].map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => {
                          setSelectedSemester(sem);
                          if (sem === '3' || sem === '4') setSelectedClassYear('SE');
                          if (sem === '7' || sem === '8') setSelectedClassYear('BE');
                        }}
                        className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                          selectedSemester === sem
                            ? 'bg-navy text-white font-bold'
                            : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        Sem {sem}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── 1. CLASS-WISE ASSIGNMENT VIEW ────────────────────────────── */}
          {workloadView === 'class' && (
            <div>
              {filteredClasses.length === 0 ? (
                <div className="bg-white rounded border border-rule p-8 text-center text-xs text-gray-500">
                  No classes match your current search, year, or semester filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClasses.map((cls) => {
                    const ct = classTeacherMap[cls];
                    const classAssgns = allAssignmentsList.filter((a) => a.division === cls);
                    const isSE = cls.startsWith('SE');
                    const isTE = cls.startsWith('TE');
                    const isBE = cls.startsWith('BE');

                    const semOdd = isSE ? 3 : isTE ? 5 : isBE ? 7 : null;
                    const semEven = isSE ? 4 : isTE ? 6 : isBE ? 8 : null;

                    const oddAssgns = semOdd ? classAssgns.filter((a) => a.semester === semOdd) : [];
                    const evenAssgns = semEven ? classAssgns.filter((a) => a.semester === semEven) : [];
                    const otherAssgns = classAssgns.filter((a) => a.semester !== semOdd && a.semester !== semEven);

                    const cohortSubtitle = selectedSemester !== 'all'
                      ? (isTE ? `Third Year (TE) · Semester ${selectedSemester}` : isSE ? `Second Year (SE) · Semester ${selectedSemester}` : `Final Year (BE) · Semester ${selectedSemester}`)
                      : (isTE ? 'Third Year (TE) · Sem 5 & 6 (Separated)' : isSE ? 'Second Year (SE) · Sem 3 & 4 (Separated)' : isBE ? 'Final Year (BE) · Sem 7 & 8 (Separated)' : 'Computer Engineering');

                    const renderSubjectItem = (asgn) => (
                      <div
                        key={asgn.mapping_id}
                        className="flex items-center justify-between gap-2 p-2 bg-white hover:bg-slate-50 rounded border border-gray-200 text-xs transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-900">
                              {asgn.subject_name}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-gray-600 bg-slate-100 px-1.5 py-0.5 rounded border border-gray-300">
                              {asgn.subject_code}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-1 rounded">
                              Sem {asgn.semester}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-700 flex-wrap">
                            <span className="font-medium text-slate-500">Teacher:</span>
                            <span className="font-semibold text-navy">
                              {asgn.faculty_name}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-gray-200 px-1 rounded">
                              {asgn.faculty_employee_id}
                            </span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-500 truncate">
                              {asgn.faculty_designation}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnassign(asgn.mapping_id, asgn.subject_name, cls)}
                          className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors text-xs font-semibold flex-shrink-0 cursor-pointer"
                          title="Remove this subject assignment"
                        >
                          ✕
                        </button>
                      </div>
                    );

                    return (
                      <div
                        key={cls}
                        className="bg-white rounded border border-rule p-5 shadow-2xs flex flex-col justify-between"
                      >
                        <div>
                          {/* Class Header */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-[#FAF8F5] border border-[#D4D0C8] text-slate-800 font-serif font-bold text-xs flex items-center justify-center flex-shrink-0">
                                {cls.replace(' Comp ', '').replace(' ', '')}
                              </div>
                              <div>
                                <h3 className="font-serif text-base font-bold text-gray-900 leading-tight">
                                  {cls}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">{cohortSubtitle}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => openAssignModal('', cls, selectedSemester !== 'all' ? selectedSemester : semOdd)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-navy text-xs font-semibold rounded border border-gray-300 transition-colors cursor-pointer"
                              >
                                + Assign Course
                              </button>
                              {classAssgns.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleUnassignClass(cls)}
                                  className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded border border-red-200 transition-colors cursor-pointer"
                                  title={`Delete all ${classAssgns.length} assigned courses for ${cls}`}
                                >
                                  Clear All
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Class Teacher (Class Guardian) Designation */}
                          <div className="mb-3">
                            {ct ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold">
                                  <span>Class Teacher:</span>
                                  <span className="font-bold underline decoration-amber-400">
                                    {ct.faculty_name}
                                  </span>
                                  <span className="font-mono text-[10px] text-amber-800">
                                    ({ct.employee_id})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveClassTeacher(ct.class_teacher_id, cls)}
                                    className="text-amber-700 hover:text-red-700 font-bold ml-1 cursor-pointer transition-colors leading-none"
                                    title="Remove Class Teacher designation"
                                  >
                                    ✕
                                  </button>
                                </span>
                              </div>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openCtModalForClass(cls)}
                                  className="text-xs text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer"
                                >
                                  + Appoint Class Teacher
                                </button>
                              </div>
                            )}
                          </div>

                          {/* ─── SEPARATED SEMESTER VIEWS ─── */}
                          {selectedSemester !== 'all' ? (
                            /* Single Selected Semester View */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                  Semester {selectedSemester} Subjects ({
                                    classAssgns.filter((a) => String(a.semester) === String(selectedSemester)).length
                                  })
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openAssignModal('', cls, selectedSemester)}
                                  className="text-[11px] font-semibold text-navy hover:underline cursor-pointer"
                                >
                                  + Assign Sem {selectedSemester}
                                </button>
                              </div>

                              {classAssgns.filter((a) => String(a.semester) === String(selectedSemester)).length === 0 ? (
                                <div className="p-3 bg-slate-50 rounded border border-dashed border-gray-300 text-center">
                                  <p className="text-xs text-gray-500">
                                    No subjects allocated to {cls} for Semester {selectedSemester}.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {classAssgns
                                    .filter((a) => String(a.semester) === String(selectedSemester))
                                    .map(renderSubjectItem)}
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Both Semesters Separated into Clear Blocks */
                            <div className="space-y-4">
                              {/* 1. Odd Semester Section (e.g. Sem 5 for TE) */}
                              <div className="bg-[#FAF8F5] p-3 rounded border border-[#E8E4DC]">
                                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#E8E4DC]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                      Semester {semOdd} (Odd Term)
                                    </span>
                                    <span className="text-[11px] text-gray-500 font-medium">
                                      {oddAssgns.length} {oddAssgns.length === 1 ? 'subject' : 'subjects'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openAssignModal('', cls, semOdd)}
                                    className="text-[11px] font-semibold text-navy hover:underline cursor-pointer"
                                  >
                                    + Assign Sem {semOdd}
                                  </button>
                                </div>

                                {oddAssgns.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic py-1">
                                    No Semester {semOdd} subjects assigned yet.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {oddAssgns.map(renderSubjectItem)}
                                  </div>
                                )}
                              </div>

                              {/* 2. Even Semester Section (e.g. Sem 6 for TE) */}
                              <div className="bg-[#FAF8F5] p-3 rounded border border-[#E8E4DC]">
                                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#E8E4DC]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-200">
                                      Semester {semEven} (Even Term)
                                    </span>
                                    <span className="text-[11px] text-gray-500 font-medium">
                                      {evenAssgns.length} {evenAssgns.length === 1 ? 'subject' : 'subjects'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openAssignModal('', cls, semEven)}
                                    className="text-[11px] font-semibold text-navy hover:underline cursor-pointer"
                                  >
                                    + Assign Sem {semEven}
                                  </button>
                                </div>

                                {evenAssgns.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic py-1">
                                    No Semester {semEven} subjects assigned yet.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {evenAssgns.map(renderSubjectItem)}
                                  </div>
                                )}
                              </div>

                              {/* Other subjects if any */}
                              {otherAssgns.length > 0 && (
                                <div className="bg-slate-50 p-2.5 rounded border border-gray-200">
                                  <div className="text-[11px] font-bold text-gray-600 mb-1.5">
                                    Other Courses ({otherAssgns.length})
                                  </div>
                                  <div className="space-y-1.5">
                                    {otherAssgns.map(renderSubjectItem)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── 2. FACULTY-WISE ASSIGNMENT VIEW ──────────────────────────── */}
          {workloadView === 'faculty' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeachers.map((teacher) => {
                const assignments = (teacher.assignments || []).filter(
                  (a) => selectedAcademicYear === 'all' || a.academic_year === selectedAcademicYear
                );
                const classTeacherOf = (teacher.classTeacherOf || []).filter(
                  (ct) => selectedAcademicYear === 'all' || ct.academic_year === selectedAcademicYear
                );

                return (
                  <div
                    key={teacher.id}
                    className="bg-white rounded border border-rule p-5 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-200 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[#FAF8F5] border border-[#D4D0C8] text-slate-800 font-serif font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {(teacher.name || '')
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
                            <h3 className="font-serif text-sm font-bold text-gray-900 leading-tight">
                              {teacher.name}
                            </h3>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {teacher.designation} · <span className="font-mono font-bold text-slate-700">{teacher.employee_id}</span>
                            </p>
                            <p className="font-mono text-[11px] text-gray-500 mt-0.5">{teacher.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => openAssignModal(String(teacher.id))}
                            className="px-2.5 py-1 bg-white hover:bg-slate-50 text-navy text-xs font-semibold rounded border border-gray-300 transition-colors"
                          >
                            + Assign
                          </button>
                          {assignments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleUnassignFaculty(teacher.id, teacher.name)}
                              className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded border border-red-200 transition-colors"
                              title={`Delete all ${assignments.length} assigned courses for ${teacher.name}`}
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Class Teacher Designation(s) */}
                      {classTeacherOf.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {classTeacherOf.map((ct) => (
                              <span
                                key={ct.class_teacher_id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold"
                              >
                                <span>Class Teacher:</span>
                                <span className="font-bold underline decoration-amber-400">{ct.class_name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveClassTeacher(ct.class_teacher_id, ct.class_name)}
                                  className="text-amber-700 hover:text-red-700 font-bold ml-1 cursor-pointer transition-colors leading-none"
                                  title="Remove Class Teacher designation"
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assigned Subjects & Classes */}
                      <div>
                        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                          Teaching Subjects &amp; Classes ({assignments.length})
                        </h4>

                        {assignments.length === 0 ? (
                          <div className="p-3 bg-slate-50 rounded border border-dashed border-gray-300 text-center">
                            <p className="text-xs text-gray-500">No subjects assigned yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {assignments.map((asgn) => (
                              <div
                                key={asgn.mapping_id}
                                className="flex items-center justify-between gap-2 p-2 bg-[#FAF8F5] hover:bg-[#F3EFEA] rounded border border-[#E8E4DC] text-xs transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-900">{asgn.subject_name}</span>
                                    <span className="font-mono text-[10px] font-bold text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-300">
                                      {asgn.subject_code}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-600">
                                    <span className="font-bold text-navy bg-white border border-gray-300 px-1.5 py-0.5 rounded">
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
                                  className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded transition-colors text-xs font-semibold flex-shrink-0"
                                  title="Remove assignment"
                                >
                                  ✕
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded border border-gray-300 shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-10 h-10 rounded bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-3 text-base font-bold font-mono">
              !
            </div>
            <h3 className="font-serif text-base font-bold text-gray-900 mb-1">Delete Faculty Record</h3>
            <p className="text-xs text-gray-600 mb-6">
              Are you sure you want to delete <strong className="text-gray-900">{deleteConfirmFaculty.name}</strong> ({deleteConfirmFaculty.employee_id})? This will permanently remove their profile and all associated teaching allocations from department records.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => setDeleteConfirmFaculty(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFaculty}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded shadow-2xs transition-colors"
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2b: Delete All Assigned Subjects Dialog */}
      {deleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded border border-gray-300 shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-10 h-10 rounded bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-3 text-base font-bold font-mono">
              !
            </div>
            <h3 className="font-serif text-base font-bold text-gray-900 mb-1">
              Delete All Assigned Subjects
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Are you sure you want to delete all <strong className="text-gray-900">{totalAssignments}</strong> active course allocations across all department faculty?
            </p>

            <div className="text-left bg-[#FAF8F5] p-3 rounded border border-[#E8E4DC] mb-5 space-y-2">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Target Academic Year
              </label>
              <select
                value={deleteAllYearFilter}
                onChange={(e) => setDeleteAllYearFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
              >
                <option value="all">All Academic Years (Full Reset)</option>
                <option value="2026-27">Academic Year 2026–27 Only</option>
                <option value="2025-26">Academic Year 2025–26 Only</option>
                <option value="2024-25">Academic Year 2024–25 Only</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Note: Faculty member user accounts and Class Teacher appointments will be preserved. Only course subject-division links will be cleared.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteAllModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnassignAll}
                disabled={deletingAll}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded shadow-2xs transition-colors"
              >
                {deletingAll ? 'Deleting Allocations…' : 'Confirm Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Multi-Subject Course Assignment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded border border-gray-300 shadow-xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4 flex-shrink-0">
              <div>
                <h2 className="font-serif text-lg font-bold text-gray-900">Assign Teaching Courses</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allocate subjects and divisions to a faculty member for the academic year.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-base font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Faculty Member
                  </label>
                  <select
                    value={form.facultyId}
                    onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
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
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
                  >
                    <option value="2026-27">2026-27 (Current)</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                  </select>
                </div>
              </div>

              {/* Course Items List */}
              <div className="border border-gray-200 rounded p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    Courses to Assign ({form.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-navy hover:underline transition-colors"
                  >
                    + Add Course Row
                  </button>
                </div>

                <div className="space-y-2.5">
                  {form.items.map((item, idx) => {
                    const selectedSub = subjects.find((s) => String(s.id) === String(item.subjectId));
                    const allowedClasses = selectedSub
                      ? getClassesForSemester(selectedSub.semester)
                      : ALL_CLASSES;

                    return (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded border border-gray-300 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold font-mono text-gray-500">
                            COURSE #{idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(idx)}
                              className="text-[11px] font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 px-2 py-0.5 rounded transition-colors"
                              title="Duplicate for another division"
                            >
                              Duplicate
                            </button>
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-[11px] font-medium text-red-600 hover:text-red-800 bg-white hover:bg-red-50 border border-red-200 px-2 py-0.5 rounded transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Subject
                            </label>
                            <select
                              value={item.subjectId}
                              onChange={(e) => handleItemSubjectChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
                              required
                            >
                              <option value="">-- Choose Subject --</option>
                              {[3, 4, 5, 6, 7, 8].map((sem) => {
                                const semSubs = subjects.filter((s) => s.semester === sem);
                                if (semSubs.length === 0) return null;
                                const semTitle = sem % 2 === 1 ? `Semester ${sem} (Odd Term)` : `Semester ${sem} (Even Term)`;
                                return (
                                  <optgroup key={sem} label={semTitle}>
                                    {semSubs.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.code} - {s.name} ({s.credits} Credits)
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">
                              Target Class / Division
                            </label>
                            <select
                              value={item.division}
                              onChange={(e) => handleItemDivisionChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white font-bold text-gray-800 focus:outline-none focus:border-navy"
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
              <div className="p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isClassTeacher}
                    onChange={(e) => setForm({ ...form, isClassTeacher: e.target.checked })}
                    className="rounded border-gray-300 text-navy focus:ring-navy w-4 h-4"
                  />
                  <span className="text-xs font-semibold text-gray-900">
                    Also designate as Class Teacher for a division
                  </span>
                </label>

                {form.isClassTeacher && (
                  <div className="mt-2 pt-2 border-t border-[#E8E4DC] flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-700 flex-shrink-0">
                      Class:
                    </label>
                    <select
                      value={form.classTeacherFor}
                      onChange={(e) => setForm({ ...form, classTeacherFor: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white font-semibold text-gray-900 focus:outline-none focus:border-navy"
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
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E2D5A] hover:bg-[#141C38] disabled:opacity-50 rounded shadow-2xs transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded border border-gray-300 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <div>
                <h2 className="font-serif text-base font-bold text-gray-900">Designate Class Teacher</h2>
                <p className="text-xs text-gray-500 mt-0.5">Assign class guardian responsibilities to a faculty member.</p>
              </div>
              <button
                onClick={() => setCtModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-base font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSetClassTeacher} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Faculty Member
                </label>
                <select
                  value={ctForm.facultyId}
                  onChange={(e) => setCtForm({ ...ctForm, facultyId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
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
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Target Class
                </label>
                <select
                  value={ctForm.className}
                  onChange={(e) => setCtForm({ ...ctForm, className: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-semibold focus:outline-none focus:border-navy"
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
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <select
                  value={ctForm.academicYear}
                  onChange={(e) => setCtForm({ ...ctForm, academicYear: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-900 font-medium focus:outline-none focus:border-navy"
                >
                  <option value="2026-27">2026-27 (Current)</option>
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200 mt-5">
                <button
                  type="button"
                  onClick={() => setCtModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-gray-300 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E2D5A] hover:bg-[#141C38] disabled:opacity-50 rounded shadow-2xs transition-colors"
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
