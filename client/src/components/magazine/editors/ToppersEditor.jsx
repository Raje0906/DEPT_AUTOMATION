import React, { useState, useRef, useMemo } from 'react';
import { useMagazine, normalizeToppersData } from '../../../contexts/MagazineContext';
import { parseClassAndDivision, sortToppers, CLASS_YEARS, DEFAULT_DIVISIONS } from '../../../utils/toppersUtils';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const SAMPLE_TOPPERS = [
  // SE
  { id: 'sample-se-1', name: 'Amit Joshi',      class: 'SE', division: 'A', className: 'SE - Div A', cgpa: '9.80', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-se-2', name: 'Priya Sharma',    class: 'SE', division: 'A', className: 'SE - Div A', cgpa: '9.40', rank: 2, position: 2, photo: null, photoUrl: null },
  { id: 'sample-se-3', name: 'Rahul Patil',     class: 'SE', division: 'A', className: 'SE - Div A', cgpa: '8.90', rank: 3, position: 3, photo: null, photoUrl: null },
  { id: 'sample-se-4', name: 'Rohan Deshmukh',  class: 'SE', division: 'B', className: 'SE - Div B', cgpa: '9.70', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-se-5', name: 'Sneha Kulkarni',  class: 'SE', division: 'B', className: 'SE - Div B', cgpa: '9.30', rank: 2, position: 2, photo: null, photoUrl: null },
  { id: 'sample-se-6', name: 'Karan Malhotra',  class: 'SE', division: 'C', className: 'SE - Div C', cgpa: '9.60', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-se-7', name: 'Pooja Bhosale',   class: 'SE', division: 'C', className: 'SE - Div C', cgpa: '9.20', rank: 2, position: 2, photo: null, photoUrl: null },
  { id: 'sample-se-8', name: 'Neha Shinde',     class: 'SE', division: 'C', className: 'SE - Div C', cgpa: '8.80', rank: 3, position: 3, photo: null, photoUrl: null },
  // TE
  { id: 'sample-te-1', name: 'Arjun Verma',     class: 'TE', division: 'A', className: 'TE - Div A', cgpa: '9.85', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-te-2', name: 'Tanvi Gaikwad',   class: 'TE', division: 'A', className: 'TE - Div A', cgpa: '9.50', rank: 2, position: 2, photo: null, photoUrl: null },
  { id: 'sample-te-3', name: 'Nikhil Rane',     class: 'TE', division: 'B', className: 'TE - Div B', cgpa: '9.75', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-te-4', name: 'Ananya Roy',      class: 'TE', division: 'C', className: 'TE - Div C', cgpa: '9.65', rank: 1, position: 1, photo: null, photoUrl: null },
  // BE
  { id: 'sample-be-1', name: 'Ketan Mahajan',   class: 'BE', division: 'A', className: 'BE - Div A', cgpa: '9.90', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-be-2', name: 'Snehal Jagtap',   class: 'BE', division: 'A', className: 'BE - Div A', cgpa: '9.60', rank: 2, position: 2, photo: null, photoUrl: null },
  { id: 'sample-be-3', name: 'Vikram Mehta',    class: 'BE', division: 'B', className: 'BE - Div B', cgpa: '9.82', rank: 1, position: 1, photo: null, photoUrl: null },
  { id: 'sample-be-4', name: 'Deepika Nair',    class: 'BE', division: 'C', className: 'BE - Div C', cgpa: '9.78', rank: 1, position: 1, photo: null, photoUrl: null },
];

export default function ToppersEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    sectionData,
    updateSection,
    completeSection,
    currentMagazine,
    addTopperStudent,
    updateTopperStudent,
    deleteTopperStudent,
  } = useMagazine();

  // Normalize toppers state to ensure single canonical source of truth
  const toppersData = useMemo(() => {
    return normalizeToppersData(sectionData.toppers);
  }, [sectionData.toppers]);

  const allStudents = toppersData.students;

  // Filter States
  const [activeClassFilter, setActiveClassFilter] = useState('ALL');
  const [activeDivFilter, setActiveDivFilter] = useState('ALL');

  // Form State
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('SE');
  const [studentDivision, setStudentDivision] = useState('A');
  const [cgpa, setCgpa] = useState('');
  const [position, setPosition] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [validationError, setValidationError] = useState('');

  const fileInputRef = useRef(null);

  // Handle Photo selection and convert to persistent Base64 Data URL
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result;
      setPhoto(base64Url);
      setPhotoName(file.name);
      toast.success(`Photo "${file.name}" uploaded.`);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input so same file can be chosen again
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoName('');
    toast.success('Photo removed. Default avatar will be used.');
  };

  // Populate form for editing existing student
  const startEditing = (student) => {
    const { year, division } = parseClassAndDivision(student);
    setEditingId(student.id);
    setName(student.name || '');
    setStudentClass(year);
    setStudentDivision(division || 'A');
    setCgpa(student.cgpa || '');
    setPosition(student.rank || student.position || '');
    setPhoto(student.photo || student.photoUrl || null);
    setPhotoName(student.photo ? 'Uploaded Photo' : '');
    setValidationError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setName('');
    setCgpa('');
    setPosition('');
    setPhoto(null);
    setPhotoName('');
    setValidationError('');
  };

  // Submit Handler for Add / Save Student
  const handleSaveStudent = (e) => {
    e?.preventDefault();

    // Validation
    const cleanName = name.trim();
    const cleanYear = studentClass.trim() || 'SE';
    const cleanDiv = studentDivision.trim() || 'A';
    const cleanCgpa = String(cgpa).trim();
    const cleanPos = String(position).trim();

    if (!cleanName) {
      setValidationError('Student Name is required.');
      return;
    }
    if (!cleanCgpa) {
      setValidationError('CGPA / SGPA is required.');
      return;
    }
    const numCgpa = parseFloat(cleanCgpa);
    if (isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
      setValidationError('Please enter a valid CGPA between 0.00 and 10.00.');
      return;
    }

    // Rank is optional: if provided, validate positive number
    let parsedRank = '';
    if (cleanPos) {
      const p = parseInt(cleanPos, 10);
      if (isNaN(p) || p <= 0) {
        setValidationError('Please enter a valid Rank (positive number, e.g. 1, 2, 3) or leave blank.');
        return;
      }
      parsedRank = p;
    }

    setValidationError('');

    const studentPayload = {
      name: cleanName,
      class: cleanYear,
      division: cleanDiv,
      className: `${cleanYear} - Div ${cleanDiv}`,
      cgpa: cleanCgpa,
      position: parsedRank,
      rank: parsedRank,
      photo,
      photoUrl: photo,
    };

    if (editingId) {
      updateTopperStudent(editingId, studentPayload);
      toast.success(`Updated student record for ${cleanName}.`);
      cancelEditing();
    } else {
      addTopperStudent({
        id: `student-${Date.now()}`,
        ...studentPayload,
      });
      toast.success(`Added ${cleanName} to ${cleanYear} - Division ${cleanDiv}.`);
      // Reset fields except class and division for quick successive entries
      setName('');
      setCgpa('');
      setPosition('');
      setPhoto(null);
      setPhotoName('');
    }
  };

  // Delete student
  const handleDeleteStudent = (studentId, studentName) => {
    deleteTopperStudent(studentId);
    if (editingId === studentId) {
      cancelEditing();
    }
    toast.success(`Removed ${studentName || 'student'} from toppers.`);
  };

  // Load sample toppers
  const handleLoadSample = () => {
    const existingIds = new Set(allStudents.map(s => s.id));
    const toAdd = SAMPLE_TOPPERS.filter(s => !existingIds.has(s.id));

    if (toAdd.length === 0) {
      toast('All sample students are already present.');
      return;
    }

    const updated = [...allStudents, ...toAdd];
    updateSection('toppers', { students: updated });
    completeSection('toppers');
    toast.success(`Loaded ${toAdd.length} sample toppers across SE, TE, and BE.`);
  };

  // Filter students for display based on active class & division filters
  const displayedStudents = useMemo(() => {
    let filtered = allStudents;

    if (activeClassFilter !== 'ALL') {
      filtered = filtered.filter(s => {
        const { year } = parseClassAndDivision(s);
        return year === activeClassFilter;
      });
    }

    if (activeDivFilter !== 'ALL') {
      filtered = filtered.filter(s => {
        const { division } = parseClassAndDivision(s);
        return division === activeDivFilter;
      });
    }

    // Auto sort by Rank (ascending) and fallback to CGPA (descending)
    return sortToppers(filtered);
  }, [allStudents, activeClassFilter, activeDivFilter]);

  const totalCount = allStudents.length;
  const magId = id || currentMagazine?.id || 'new';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with real-time student count */}
      <div className="flex items-start justify-between flex-wrap gap-4 border-b border-rule pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-2xl font-bold text-ink">Class Toppers</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-navy/10 text-navy border border-navy/20">
              {totalCount} Student{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-draft mt-1">
            Add topper records per class (SE, TE, BE) and division. Students are automatically sorted by rank (or CGPA) in the magazine preview and PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/faculty/magazines/preview/${magId}`)}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View in Preview
          </button>
        </div>
      </div>

      {/* Student Information Form Card */}
      <div className="bg-white border-2 border-navy/20 rounded-sm p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-navy" />
            <h3 className="text-sm font-bold text-navy uppercase tracking-wider">
              {editingId ? 'Edit Student Topper' : 'Add Student Information'}
            </h3>
          </div>
          {editingId && (
            <span className="text-xs text-draft italic">
              Editing student ID: {editingId}
            </span>
          )}
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-sm flex items-center gap-2 text-xs text-red-700">
            <svg className="w-4 h-4 text-fail flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{validationError}</span>
          </div>
        )}

        {/* Form Inputs Grid */}
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Student Name */}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                Student Name <span className="text-fail">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setValidationError(''); }}
                placeholder="e.g. Amit Joshi"
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-paper"
              />
            </div>

            {/* Class Dropdown (SE, TE, BE) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                Class <span className="text-fail">*</span>
              </label>
              <select
                value={studentClass}
                onChange={(e) => { setStudentClass(e.target.value); setValidationError(''); }}
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-white font-medium"
              >
                <option value="SE">SE (Second Year)</option>
                <option value="TE">TE (Third Year)</option>
                <option value="BE">BE (Final Year)</option>
              </select>
            </div>

            {/* Division Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                Division <span className="text-fail">*</span>
              </label>
              <select
                value={studentDivision}
                onChange={(e) => { setStudentDivision(e.target.value); setValidationError(''); }}
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-white font-medium"
              >
                <option value="A">Division A</option>
                <option value="B">Division B</option>
                <option value="C">Division C</option>
                <option value="D">Division D</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
            {/* CGPA */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                CGPA / SGPA <span className="text-fail">*</span>
              </label>
              <input
                type="text"
                value={cgpa}
                onChange={(e) => { setCgpa(e.target.value); setValidationError(''); }}
                placeholder="e.g. 9.80"
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-paper"
              />
            </div>

            {/* Position / Rank (Optional, with fallback note) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center justify-between">
                <span>Rank / Position</span>
                <span className="text-[10px] text-draft font-normal">(Optional — sorts by CGPA if blank)</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={position}
                onChange={(e) => { setPosition(e.target.value); setValidationError(''); }}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-paper"
              />
            </div>

            {/* Photo Upload & Preview */}
            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-semibold text-ink">
                Student Photo
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Photo Thumbnail or Default Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden border border-rule bg-paper flex items-center justify-center flex-shrink-0">
                  {photo ? (
                    <img src={photo} alt="Student preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5 text-draft opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-2.5 py-1.5 border border-rule rounded-sm hover:bg-paper text-draft hover:text-navy font-medium transition-colors"
                  >
                    {photo ? 'Replace' : 'Upload Photo'}
                  </button>

                  {photo && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs px-2 py-1.5 border border-red-200 text-fail hover:bg-red-50 rounded-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {photoName && (
                <p className="text-[10px] text-draft truncate max-w-xs">{photoName}</p>
              )}
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="btn-primary text-xs py-2 px-5 font-semibold"
            >
              {editingId ? 'Save Changes' : 'Save Student'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="text-xs py-2 px-4 border border-rule rounded-sm hover:bg-paper text-draft font-medium transition-colors"
              >
                Cancel
              </button>
            )}

            <span className="text-xs text-draft ml-auto">
              Changes instantly update preview and auto-sort
            </span>
          </div>
        </form>
      </div>

      {/* Filter Tabs Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-bold text-ink uppercase tracking-wider">
            Filter Toppers:
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleLoadSample}
              className="text-xs text-draft hover:text-navy font-medium px-3 py-1 border border-rule rounded-sm hover:bg-white transition-colors"
            >
              Load Sample Data
            </button>
          </div>
        </div>

        {/* Class Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setActiveClassFilter('ALL'); setActiveDivFilter('ALL'); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              activeClassFilter === 'ALL'
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-draft border-rule hover:border-navy'
            }`}
          >
            All Classes ({allStudents.length})
          </button>

          {CLASS_YEARS.map(yr => {
            const count = allStudents.filter(s => parseClassAndDivision(s).year === yr).length;
            return (
              <button
                key={yr}
                onClick={() => { setActiveClassFilter(yr); setActiveDivFilter('ALL'); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
                  activeClassFilter === yr
                    ? 'bg-navy text-white border-navy'
                    : count > 0
                    ? 'bg-blue-50 text-navy border-navy'
                    : 'bg-white text-draft border-rule hover:border-navy'
                }`}
              >
                {yr} ({count})
              </button>
            );
          })}

          {/* Division Filter Sub-pills when a class is selected */}
          {activeClassFilter !== 'ALL' && (
            <div className="flex items-center gap-1 ml-3 pl-3 border-l border-rule">
              <span className="text-[10px] text-draft font-semibold uppercase">Div:</span>
              <button
                onClick={() => setActiveDivFilter('ALL')}
                className={`px-2 py-1 text-[11px] rounded-sm font-semibold transition-colors ${
                  activeDivFilter === 'ALL'
                    ? 'bg-navy text-white'
                    : 'bg-paper text-draft hover:text-navy'
                }`}
              >
                All
              </button>
              {DEFAULT_DIVISIONS.map(div => {
                const divCount = allStudents.filter(s => {
                  const parsed = parseClassAndDivision(s);
                  return parsed.year === activeClassFilter && parsed.division === div;
                }).length;
                return (
                  <button
                    key={div}
                    onClick={() => setActiveDivFilter(div)}
                    className={`px-2 py-1 text-[11px] rounded-sm font-semibold transition-colors ${
                      activeDivFilter === div
                        ? 'bg-navy text-white'
                        : 'bg-paper text-draft hover:text-navy'
                    }`}
                  >
                    Div {div} ({divCount})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toppers Table */}
      <div className="border border-rule rounded-sm overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-2.5 bg-paper border-b border-rule flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-bold text-navy">
            {activeClassFilter === 'ALL' ? 'All Classes' : activeClassFilter}
            {activeDivFilter !== 'ALL' ? ` · Division ${activeDivFilter}` : ''}
            {' '}— Sorted Records ({displayedStudents.length})
          </p>
          <p className="text-[10px] text-draft">
            Automatically sorted by Rank (or fallback CGPA)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-blue-50/50 border-b border-navy/20 text-navy font-bold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 w-12 text-center">Photo</th>
                <th className="px-3 py-2">Student Name</th>
                <th className="px-3 py-2">Class & Div</th>
                <th className="px-3 py-2 text-right">CGPA</th>
                <th className="px-3 py-2 text-center">Rank</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-draft text-xs">
                    No topper records matching filter.
                    <br />
                    <span className="text-[11px] opacity-70">
                      Use the form above or click "Load Sample Data" to add students.
                    </span>
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student, idx) => {
                  const studentPhoto = student.photo || student.photoUrl;
                  const isEditingThis = editingId === student.id;
                  const { year, division } = parseClassAndDivision(student);
                  const displayRank = student.rank || student.position;

                  return (
                    <tr
                      key={student.id}
                      className={`border-b border-rule transition-colors ${
                        isEditingThis ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-paper/40'
                      } hover:bg-blue-50/30`}
                    >
                      {/* Photo */}
                      <td className="px-3 py-2 text-center">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-rule bg-paper mx-auto flex items-center justify-center">
                          {studentPhoto ? (
                            <img src={studentPhoto} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-4 h-4 text-draft opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                            </svg>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2 font-medium text-ink">
                        {student.name}
                        {isEditingThis && (
                          <span className="ml-2 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Editing
                          </span>
                        )}
                      </td>

                      {/* Class & Division */}
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold text-navy bg-navy/10 px-2 py-0.5 rounded-sm">
                          {year} · Div {division}
                        </span>
                      </td>

                      {/* CGPA */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-navy">
                        {student.cgpa}
                      </td>

                      {/* Position / Rank */}
                      <td className="px-3 py-2 text-center">
                        {displayRank ? (
                          <span className="text-[10px] font-bold text-pass bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            Rank {displayRank}
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-draft bg-paper px-1.5 py-0.5 rounded border border-rule" title="Sorted by CGPA fallback">
                            Auto (#{idx + 1})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => startEditing(student)}
                          className="text-xs font-semibold text-navy hover:underline"
                        >
                          Edit
                        </button>
                        <span className="text-rule">|</span>
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="text-xs font-semibold text-fail hover:text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
