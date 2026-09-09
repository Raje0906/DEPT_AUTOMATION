import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ALL_CLASSES, getClassesForSemester } from '../../utils/academicClasses';

export default function TeacherManagement() {
  const [teachers, setTeachers]       = useState([]);
  const [subjects, setSubjects]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [ctModalOpen, setCtModalOpen] = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  // Multi-Subject Assignment Form State
  const [form, setForm] = useState({
    facultyId: '',
    academicYear: '2025-26',
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
    academicYear: '2025-26',
  });

  const fetchData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.get('/hod/teachers'),
        api.get('/hod/all-subjects'),
      ]);
      setTeachers(tRes.data.teachers || []);
      setSubjects(sRes.data.subjects || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load faculty and subject data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAssignModal = (prefillFacultyId = '') => {
    const defaultFaculty = prefillFacultyId || (teachers[0] ? String(teachers[0].id) : '');
    const defaultSubject = subjects[0] ? String(subjects[0].id) : '';
    const suggestedClasses = subjects[0] ? getClassesForSemester(subjects[0].semester) : ALL_CLASSES;
    const defaultClass = suggestedClasses[0] || 'SE Comp 1';

    setForm({
      facultyId: defaultFaculty,
      academicYear: '2025-26',
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
      toast.success(res.data.message || 'Class teacher appointed successfully!');
      setCtModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to appoint class teacher');
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

  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAssignments = teachers.reduce((acc, t) => acc + (t.assignments?.length || 0), 0);
  const totalClassTeachers = teachers.reduce((acc, t) => acc + (t.classTeacherOf?.length || 0), 0);

  if (loading) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
        <div className="p-8 text-sm text-draft">Loading faculty management…</div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Faculty Workload Allocation</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Manage the department's 10 teachers, assign courses across SE, TE &amp; BE, and designate Class Teachers
          </p>
        </div>

        <button
          onClick={() => openAssignModal()}
          className="btn-primary flex items-center gap-2 shadow-sm text-xs self-start sm:self-auto"
        >
          <span>+</span> Assign Subject &amp; Class
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Faculty</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{teachers.length}</p>
          <p className="text-xs text-draft mt-1">10 Department Teachers</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Course Mappings</p>
          <p className="font-serif text-3xl font-bold text-navy mt-1">{totalAssignments}</p>
          <p className="text-xs text-draft mt-1">Subject &amp; class allocations</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Class Teachers Appointed</p>
          <p className="font-serif text-3xl font-bold text-amber-700 mt-1">{totalClassTeachers} / 12</p>
          <p className="text-xs text-draft mt-1">Designated class coordinators</p>
        </div>
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Academic Classes</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">12 Classes</p>
          <p className="text-xs text-draft mt-1">SE (4) · TE (4) · BE (4)</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Search teacher by name, EMP ID, or designation…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-3 py-2 text-sm w-full bg-white border border-rule rounded"
          />
        </div>
        <span className="text-xs font-semibold text-draft">
          Showing {filteredTeachers.length} of {teachers.length} teachers
        </span>
      </div>

      {/* Teachers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTeachers.map((teacher) => {
          const assignments = teacher.assignments || [];
          const classTeacherOf = teacher.classTeacherOf || [];

          return (
            <div key={teacher.id} className="panel p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                {/* Teacher Top Info */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-rule mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-navy/10 text-navy font-serif font-bold text-base flex items-center justify-center flex-shrink-0">
                      {teacher.name.replace('Prof. ', '').replace('Dr. ', '').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-ink leading-tight">{teacher.name}</h3>
                      <p className="text-xs font-medium text-draft mt-0.5">
                        {teacher.designation} · <span className="font-mono font-bold text-ink">{teacher.employee_id}</span>
                      </p>
                      <p className="text-xs text-draft">{teacher.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openAssignModal(String(teacher.id))}
                      className="px-3 py-1 bg-maroon/10 hover:bg-maroon hover:text-white text-maroon text-xs font-semibold rounded transition-colors"
                    >
                      + Assign
                    </button>
                  </div>
                </div>

                {/* Class Teacher Badge(s) if assigned */}
                {classTeacherOf.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {classTeacherOf.map((ct) => (
                        <span
                          key={ct.class_teacher_id}
                          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold shadow-2xs"
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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-draft uppercase tracking-wider">
                      Teaching Subjects &amp; Classes ({assignments.length})
                    </h4>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="p-3 bg-gray-50 rounded border border-dashed border-rule text-center">
                      <p className="text-xs text-draft">No subjects assigned yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((asgn) => (
                        <div
                          key={asgn.mapping_id}
                          className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 hover:bg-gray-100 rounded border border-rule text-xs transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-ink">{asgn.subject_name}</span>
                              <span className="font-mono text-[10px] font-bold text-draft bg-white px-1.5 py-0.5 rounded border border-rule">
                                {asgn.subject_code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-draft">
                              <span className="font-bold text-navy bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                {asgn.division}
                              </span>
                              <span>·</span>
                              <span>Sem {asgn.semester}</span>
                              <span>·</span>
                              <span>{asgn.academic_year}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleUnassign(asgn.mapping_id, asgn.subject_name, asgn.division)}
                            title="Remove assignment"
                            className="text-draft hover:text-maroon font-bold text-base px-2 py-1 transition-colors"
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

      {/* Modal 1: Multi-Subject & Class Assignment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-rule animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule shrink-0">
              <div>
                <h2 className="font-serif text-xl font-bold text-ink">Assign Subjects &amp; Classes</h2>
                <p className="text-xs text-draft mt-0.5">
                  Allocate single or multiple courses to a faculty member across divisions
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-draft hover:text-ink text-xl font-bold p-1 leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleAssign} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Teacher & Academic Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="input-label">Select Faculty Member</label>
                  <select
                    value={form.facultyId}
                    onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
                    className="input-field text-sm font-semibold"
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
                  <label className="input-label">Academic Year</label>
                  <select
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    className="input-field text-sm font-semibold"
                  >
                    <option value="2025-26">2025-26 (Current)</option>
                    <option value="2024-25">2024-25</option>
                    <option value="2023-24">2023-24</option>
                  </select>
                </div>
              </div>

              {/* Course Allocation Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                    <span>Courses to Allocate</span>
                    <span className="bg-navy/10 text-navy font-mono text-[11px] px-2 py-0.5 rounded-full font-bold">
                      {form.items.length} {form.items.length === 1 ? 'Course' : 'Courses'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-maroon hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Another Course</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, idx) => {
                    const itemSub = subjects.find((s) => String(s.id) === String(item.subjectId));
                    const itemClasses = itemSub ? getClassesForSemester(itemSub.semester) : ALL_CLASSES;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-gray-50/90 rounded-md border border-rule hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-rule/60 text-xs">
                          <span className="font-bold text-draft flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-white border border-rule flex items-center justify-center text-[10px] font-bold text-ink shadow-2xs">
                              {idx + 1}
                            </span>
                            Course #{idx + 1}
                          </span>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleDuplicateItem(idx)}
                              className="text-[11px] font-semibold text-draft hover:text-navy transition-colors flex items-center gap-1 cursor-pointer"
                              title="Duplicate this row for another class or subject"
                            >
                              <span>📋 Duplicate</span>
                            </button>
                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-[11px] font-semibold text-red-600 hover:text-red-800 transition-colors flex items-center gap-0.5 cursor-pointer"
                                title="Remove this course"
                              >
                                <span>✕ Remove</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Subject Select (2 cols) */}
                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold text-draft block mb-1">Subject</label>
                            <select
                              value={item.subjectId}
                              onChange={(e) => handleItemSubjectChange(idx, e.target.value)}
                              className="input-field text-xs font-semibold py-1.5"
                              required
                            >
                              <optgroup label="Second Year (SE - Sem 3 & 4)">
                                {subjects.filter((s) => s.semester === 3 || s.semester === 4).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} — {s.name} (Sem {s.semester})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Third Year (TE - Sem 5 & 6)">
                                {subjects.filter((s) => s.semester === 5 || s.semester === 6).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} — {s.name} (Sem {s.semester})
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Final Year (BE - Sem 7 & 8)">
                                {subjects.filter((s) => s.semester === 7 || s.semester === 8).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code} — {s.name} (Sem {s.semester})
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {/* Class Select (1 col) */}
                          <div>
                            <label className="text-[11px] font-semibold text-draft block mb-1">
                              Class {itemSub ? `(Sem ${itemSub.semester})` : ''}
                            </label>
                            <select
                              value={item.division}
                              onChange={(e) => handleItemDivisionChange(idx, e.target.value)}
                              className="input-field text-xs font-semibold py-1.5"
                              required
                            >
                              {itemClasses.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-3 w-full py-2 border-2 border-dashed border-rule rounded-md text-xs font-semibold text-draft hover:text-ink hover:border-draft transition-colors flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                >
                  <span className="text-sm font-bold">+</span>
                  <span>Add Another Course / Class</span>
                </button>
              </div>

              {/* Class Teacher Checkbox & Class Selection */}
              <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-md">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="is-class-teacher-cb"
                    checked={form.isClassTeacher}
                    onChange={(e) => setForm({ ...form, isClassTeacher: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-maroon focus:ring-maroon cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="is-class-teacher-cb" className="text-xs text-ink cursor-pointer">
                      <span className="font-bold text-amber-950 flex items-center gap-1.5">
                        <span>⭐ Also designate as Class Teacher</span>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded">
                          Mentor / In-charge
                        </span>
                      </span>
                      <span className="text-draft block mt-0.5">
                        Appoint this faculty member as the official Class Teacher / Mentor.
                      </span>
                    </label>

                    {form.isClassTeacher && (
                      <div className="mt-3 pt-3 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-xs font-bold text-amber-950 whitespace-nowrap">
                          Class Teacher for:
                        </label>
                        <select
                          value={form.classTeacherFor}
                          onChange={(e) => setForm({ ...form, classTeacherFor: e.target.value })}
                          className="input-field text-xs font-bold bg-white text-ink py-1.5 sm:max-w-xs"
                          required={form.isClassTeacher}
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
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
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

      {/* Modal 2: Dedicated Assign Class Teacher Dialog */}
      {ctModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-md shadow-2xl max-w-md w-full p-6 border border-rule animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-rule mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h2 className="font-serif text-xl font-bold text-ink">Designate Class Teacher</h2>
              </div>
              <button
                onClick={() => setCtModalOpen(false)}
                className="text-draft hover:text-ink text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSetClassTeacher} className="space-y-4">
              <div>
                <label className="input-label">Select Teacher</label>
                <select
                  value={ctForm.facultyId}
                  onChange={(e) => setCtForm({ ...ctForm, facultyId: e.target.value })}
                  className="input-field text-sm font-semibold"
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
                <label className="input-label">Select Class</label>
                <select
                  value={ctForm.className}
                  onChange={(e) => setCtForm({ ...ctForm, className: e.target.value })}
                  className="input-field text-sm font-semibold"
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
                <label className="input-label">Academic Year</label>
                <select
                  value={ctForm.academicYear}
                  onChange={(e) => setCtForm({ ...ctForm, academicYear: e.target.value })}
                  className="input-field text-sm font-semibold"
                >
                  <option value="2025-26">2025-26 (Current)</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule mt-6">
                <button
                  type="button"
                  onClick={() => setCtModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
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
