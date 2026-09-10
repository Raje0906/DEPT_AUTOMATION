import React, { useState, useRef, useMemo } from 'react';
import { useMagazine, CLASS_OPTIONS, normalizeToppersData } from '../../../contexts/MagazineContext';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

const SAMPLE_TOPPERS = {
  'SE I': [
    { id: 'sample-se-1', name: 'Rahul Patil',    class: 'SE I', className: 'SE I', cgpa: '9.59', position: 1, photo: null, photoUrl: null },
    { id: 'sample-se-2', name: 'Siddhi Gaikwad', class: 'SE I', className: 'SE I', cgpa: '9.45', position: 2, photo: null, photoUrl: null },
    { id: 'sample-se-3', name: 'Neha Shinde',    class: 'SE I', className: 'SE I', cgpa: '9.38', position: 3, photo: null, photoUrl: null },
  ],
  'SE II': [
    { id: 'sample-se2-1', name: 'Ojaswi Shinde', class: 'SE II', className: 'SE II', cgpa: '9.45', position: 1, photo: null, photoUrl: null },
    { id: 'sample-se2-2', name: 'Anmol Singh',   class: 'SE II', className: 'SE II', cgpa: '9.32', position: 2, photo: null, photoUrl: null },
  ],
  'TE I': [
    { id: 'sample-te-1', name: 'Arjun Kulkarni', class: 'TE I', className: 'TE I', cgpa: '9.71', position: 1, photo: null, photoUrl: null },
    { id: 'sample-te-2', name: 'Pooja Bhosale',  class: 'TE I', className: 'TE I', cgpa: '9.62', position: 2, photo: null, photoUrl: null },
  ],
  'BE I': [
    { id: 'sample-be-1', name: 'Ketan Mahajan',  class: 'BE I', className: 'BE I', cgpa: '9.80', position: 1, photo: null, photoUrl: null },
    { id: 'sample-be-2', name: 'Snehal Joshi',   class: 'BE I', className: 'BE I', cgpa: '9.74', position: 2, photo: null, photoUrl: null },
    { id: 'sample-be-3', name: 'Rohan Deshmukh', class: 'BE I', className: 'BE I', cgpa: '9.68', position: 3, photo: null, photoUrl: null },
  ],
};

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
  const [activeClass, setActiveClass] = useState('SE I');

  // Form State
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('SE I');
  const [cgpa, setCgpa] = useState('');
  const [position, setPosition] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoName, setPhotoName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [validationError, setValidationError] = useState('');

  const fileInputRef = useRef(null);

  // Sync default form class with active tab if adding new
  const handleSelectTab = (cls) => {
    setActiveClass(cls);
    if (!editingId && cls !== 'ALL') {
      setStudentClass(cls);
    }
  };

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
    e.target.value = ''; // Reset input so same file can be chosen again if needed
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoName('');
    toast.success('Photo removed. Default avatar will be used.');
  };

  // Populate form for editing existing student
  const startEditing = (student) => {
    setEditingId(student.id);
    setName(student.name || '');
    setStudentClass(student.className || student.class || 'SE I');
    setCgpa(student.cgpa || '');
    setPosition(student.position || '');
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
    const cleanClass = studentClass.trim();
    const cleanCgpa = String(cgpa).trim();
    const cleanPos = String(position).trim();

    if (!cleanName) {
      setValidationError('Student Name is required.');
      return;
    }
    if (!cleanClass) {
      setValidationError('Class is required.');
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
    if (!cleanPos || isNaN(parseInt(cleanPos, 10)) || parseInt(cleanPos, 10) <= 0) {
      setValidationError('Please enter a valid Position/Rank (e.g. 1, 2, 3).');
      return;
    }

    setValidationError('');

    if (editingId) {
      // Update existing student by unique ID
      updateTopperStudent(editingId, {
        name: cleanName,
        class: cleanClass,
        className: cleanClass,
        cgpa: cleanCgpa,
        position: parseInt(cleanPos, 10),
        photo,
        photoUrl: photo,
      });
      toast.success(`Updated student record for ${cleanName}.`);
      cancelEditing();
    } else {
      // Add new student to canonical dataset
      const newStudent = {
        id: `student-${Date.now()}`,
        name: cleanName,
        class: cleanClass,
        className: cleanClass,
        cgpa: cleanCgpa,
        position: parseInt(cleanPos, 10),
        photo,
        photoUrl: photo,
      };
      addTopperStudent(newStudent);
      toast.success(`Added ${cleanName} to ${cleanClass}.`);
      // Reset fields except class for quick entry of next student
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

  // Load sample toppers for active class
  const handleLoadSample = () => {
    const targetClass = activeClass === 'ALL' ? 'SE I' : activeClass;
    const samples = SAMPLE_TOPPERS[targetClass] || [];
    if (samples.length === 0) {
      toast('No sample records for this class.');
      return;
    }

    // Merge samples without duplicate IDs
    const existingIds = new Set(allStudents.map(s => s.id));
    const newSamples = samples.filter(s => !existingIds.has(s.id));

    if (newSamples.length === 0) {
      toast('Sample students already added.');
      return;
    }

    const updated = [...allStudents, ...newSamples];
    updateSection('toppers', { students: updated });
    completeSection('toppers');
    toast.success(`Loaded ${newSamples.length} sample toppers for ${targetClass}.`);
  };

  // Filter students for display based on activeClass tab
  const displayedStudents = activeClass === 'ALL'
    ? allStudents
    : (toppersData.classes[activeClass] || []);

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
            Add topper records per class with photo, CGPA, and rank. All student data updates the magazine preview in real time.
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
                placeholder="e.g. Rahul Patil"
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-paper"
              />
            </div>

            {/* Class Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                Class <span className="text-fail">*</span>
              </label>
              <select
                value={studentClass}
                onChange={(e) => { setStudentClass(e.target.value); setValidationError(''); }}
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-white"
              >
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* CGPA */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                CGPA / SGPA <span className="text-fail">*</span>
              </label>
              <input
                type="text"
                value={cgpa}
                onChange={(e) => { setCgpa(e.target.value); setValidationError(''); }}
                placeholder="e.g. 9.59"
                className="w-full px-3 py-2 text-xs border border-rule rounded-sm focus:outline-none focus:border-navy bg-paper"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Position / Rank */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                Position / Rank <span className="text-fail">*</span>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">
                Student Photo
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Photo Thumbnail or Default Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden border border-rule bg-paper flex items-center justify-center flex-shrink-0">
                  {photo ? (
                    <img src={photo} alt="Student preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-draft opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                    </svg>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs px-3 py-1.5 border border-rule rounded-sm hover:bg-paper text-draft hover:text-navy font-medium transition-colors"
                  >
                    {photo ? 'Replace Photo' : 'Upload Photo'}
                  </button>

                  {photo && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs px-2.5 py-1.5 border border-red-200 text-fail hover:bg-red-50 rounded-sm font-medium transition-colors"
                    >
                      Delete Photo
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
              Changes sync immediately to preview
            </span>
          </div>
        </form>
      </div>

      {/* Class Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-ink uppercase tracking-wider">
            Filter by Class:
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

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSelectTab('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
              activeClass === 'ALL'
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-draft border-rule hover:border-navy'
            }`}
          >
            All Classes ({allStudents.length})
          </button>

          {CLASS_OPTIONS.map(cls => {
            const count = (toppersData.classes[cls] || []).length;
            const hasData = count > 0;
            return (
              <button
                key={cls}
                onClick={() => handleSelectTab(cls)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors ${
                  activeClass === cls
                    ? 'bg-navy text-white border-navy'
                    : hasData
                    ? 'bg-blue-50 text-navy border-navy'
                    : 'bg-white text-draft border-rule hover:border-navy'
                }`}
              >
                {cls}
                {hasData && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toppers Table */}
      <div className="border border-rule rounded-sm overflow-hidden bg-white shadow-sm">
        <div className="px-4 py-2.5 bg-paper border-b border-rule flex items-center justify-between">
          <p className="text-xs font-bold text-navy">
            {activeClass === 'ALL' ? 'All Classes' : activeClass} — Topper Records ({displayedStudents.length})
          </p>
          <p className="text-[10px] text-draft">
            Click "Edit" to modify any student's data or photo
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-blue-50/50 border-b border-navy/20 text-navy font-bold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 w-12 text-center">Photo</th>
                <th className="px-3 py-2">Student Name</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2 text-right">CGPA</th>
                <th className="px-3 py-2 text-center">Position / Rank</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-draft text-xs">
                    No topper records added for {activeClass === 'ALL' ? 'any class' : activeClass}.
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

                      {/* Class */}
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold text-navy bg-navy/10 px-2 py-0.5 rounded-sm">
                          {student.className || student.class}
                        </span>
                      </td>

                      {/* CGPA */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-navy">
                        {student.cgpa}
                      </td>

                      {/* Position / Rank */}
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] font-bold text-pass bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          Rank {student.position}
                        </span>
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
