import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import crestLogo from '../../assets/images/mes-wadia-crest.jpg';
import campusPhoto from '../../assets/images/mes-wadia-campus.jpg';

const BATCH_OPTIONS = [
  '2022–26',
  '2023–27',
  '2024–28',
  '2025–29',
  '2026–30',
];

const CLASS_YEAR_OPTIONS = ['SE', 'TE', 'BE'];

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

const DIVISION_OPTIONS = ['Comp 1', 'Comp 2', 'Comp 3', 'Comp 4'];

const DESIGNATION_OPTIONS = [
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Adjunct Faculty',
  'Visiting Faculty',
];

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState('student'); // 'student' | 'faculty'
  const [loading, setLoading] = useState(false);

  // Student Form State
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    roll_no: '',
    enrollment_no: '',
    class_year: 'TE',
    current_semester: '6',
    batch: '2024–28',
    division: 'Comp 1',
    password: '',
    confirmPassword: '',
  });

  // Faculty Form State
  const [facultyForm, setFacultyForm] = useState({
    name: '',
    email: '',
    employee_id: '',
    designation: 'Assistant Professor',
    password: '',
    confirmPassword: '',
    passcode: '',
  });

  const handleStudentChange = (e) => {
    setStudentForm({ ...studentForm, [e.target.name]: e.target.value });
  };

  const handleFacultyChange = (e) => {
    setFacultyForm({ ...facultyForm, [e.target.name]: e.target.value });
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (studentForm.password !== studentForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (studentForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register-student', {
        name: studentForm.name.trim(),
        email: studentForm.email.trim(),
        roll_no: studentForm.roll_no.trim(),
        enrollment_no: studentForm.enrollment_no.trim(),
        current_semester: parseInt(studentForm.current_semester, 10),
        batch: studentForm.batch,
        division: studentForm.division,
        class_year: studentForm.class_year,
        password: studentForm.password,
      });

      toast.success(res.data?.message || 'Student registration successful!');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please check your inputs.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFacultySubmit = async (e) => {
    e.preventDefault();
    if (facultyForm.password !== facultyForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (facultyForm.password.length < 8) {
      toast.error('Password must be at least 8 characters long.');
      return;
    }
    if (!facultyForm.passcode.trim()) {
      toast.error('Department Staff Passcode is required for faculty registration.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register-faculty', {
        name: facultyForm.name.trim(),
        email: facultyForm.email.trim(),
        employee_id: facultyForm.employee_id.trim(),
        designation: facultyForm.designation,
        password: facultyForm.password,
        passcode: facultyForm.passcode.trim(),
      });

      toast.success(res.data?.message || 'Faculty registered successfully!');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Check your passcode or inputs.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col lg:flex-row">
      {/* Left — Institutional identity panel */}
      <div className="hidden lg:flex flex-col justify-between w-[36%] max-w-lg bg-navy px-10 xl:px-14 py-12 shadow-2xl relative z-10 overflow-hidden">
        {/* Campus background photo with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none scale-105"
          style={{ backgroundImage: `url(${campusPhoto})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/85 via-navy/90 to-navy pointer-events-none" />

        <div className="relative z-10">
          <div className="w-16 h-16 rounded-full bg-white p-1.5 shadow-xl border-2 border-white/40 flex items-center justify-center mb-6 overflow-hidden">
            <img
              src={crestLogo}
              alt="MES Wadia COE Emblem"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="font-serif text-white text-3xl font-bold leading-tight mb-2">
            MES Wadia COE
          </h1>
          <p className="text-blue-100 text-sm font-normal tracking-wide">
            Department of Computer Engineering
          </p>
          <div className="mt-8 pt-6 border-t border-white/15 space-y-2">
            <p className="text-blue-200/90 text-xs">
              Autonomous Institution · Affiliated to SPPU
            </p>
            <p className="text-blue-200/90 text-xs">
              Academic Year 2026–27
            </p>
          </div>

          <div className="mt-8 p-4 rounded bg-white/5 border border-white/10 text-xs text-blue-100/90 space-y-2">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <span>📋</span> Registration Notice
            </p>
            <p className="text-[11px] leading-relaxed text-blue-200/80">
              Department is locked to <strong>Computer Engineering</strong>. Ensure your Roll Number and SPPU PRN match your official college records.
            </p>
          </div>
        </div>

        <div className="pt-6 relative z-10">
          <div className="h-px w-14 bg-white/20 mb-3" />
          <p className="text-blue-200/80 text-xs tracking-wide">
            Department Automation &amp; Academic Activity Portal
          </p>
        </div>
      </div>

      {/* Right — Registration Form with full-bleed campus building background */}
      <div className="flex-1 flex flex-col justify-start items-center p-4 sm:p-8 lg:p-12 overflow-y-auto relative">
        {/* Full-bleed Campus Building Photo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          <img
            src={campusPhoto}
            alt="MES Wadia Campus Building"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
        </div>

        <div className="w-full max-w-2xl bg-white/95 backdrop-blur-md p-6 sm:p-10 rounded-xl shadow-2xl border border-white/80 my-4 relative z-10">
          {/* Mobile Header */}
          <div className="lg:hidden mb-6 pb-4 border-b border-rule">
            <div className="w-12 h-12 rounded-full bg-white p-1 shadow-sm border border-rule flex items-center justify-center mb-2.5 overflow-hidden">
              <img
                src={crestLogo}
                alt="MES Wadia COE Emblem"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="font-serif text-2xl font-bold text-navy">MES Wadia COE</h2>
            <p className="text-xs text-draft mt-0.5">Department of Computer Engineering · SPPU</p>
          </div>

          {/* Header & Role Switcher */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule/80">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink tracking-tight">
                {role === 'student' ? 'Student Registration' : 'Faculty Onboarding'}
              </h2>
              <p className="text-xs sm:text-sm text-draft mt-1">
                {role === 'student'
                  ? 'Register your profile to access your results and portal'
                  : 'Authorized Computer Engineering staff registration'}
              </p>
            </div>

            {/* Role Tabs */}
            <div className="inline-flex rounded border border-rule p-1 bg-paper/60 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  role === 'student'
                    ? 'bg-navy text-white shadow-xs'
                    : 'text-draft hover:text-ink'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole('faculty')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  role === 'faculty'
                    ? 'bg-navy text-white shadow-xs'
                    : 'text-draft hover:text-ink'
                }`}
              >
                Faculty / Staff
              </button>
            </div>
          </div>

          {/* Locked Department Banner */}
          <div className="mb-6 px-3.5 py-2.5 rounded bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs font-medium text-navy">Department:</span>
              <span className="text-xs font-bold text-navy">Computer Engineering</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-navy/70 bg-navy/10 px-2 py-0.5 rounded">
              Locked
            </span>
          </div>

          {/* ────────────────── STUDENT FORM ────────────────── */}
          {role === 'student' ? (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label htmlFor="student-name" className="input-label">
                    Full Name <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-name"
                    name="name"
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={handleStudentChange}
                    placeholder="e.g. Aditya Deshmukh"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Email */}
                <div className="sm:col-span-2">
                  <label htmlFor="student-email" className="input-label">
                    Email Address <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-email"
                    name="email"
                    type="email"
                    required
                    value={studentForm.email}
                    onChange={handleStudentChange}
                    placeholder="e.g. aditya.d@meswadiacoe.edu"
                    className="input-field"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-draft mt-1">Institutional or personal email for login.</p>
                </div>

                {/* Roll Number */}
                <div>
                  <label htmlFor="student-roll" className="input-label">
                    Roll Number <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-roll"
                    name="roll_no"
                    type="text"
                    required
                    value={studentForm.roll_no}
                    onChange={handleStudentChange}
                    placeholder="e.g. CE6A045 or 45"
                    className="input-field uppercase"
                    disabled={loading}
                  />
                </div>

                {/* Enrollment / PRN */}
                <div>
                  <label htmlFor="student-prn" className="input-label">
                    SPPU PRN / Enrollment No <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-prn"
                    name="enrollment_no"
                    type="text"
                    required
                    value={studentForm.enrollment_no}
                    onChange={handleStudentChange}
                    placeholder="e.g. 72123456B"
                    className="input-field uppercase"
                    disabled={loading}
                  />
                </div>

                {/* Year (Class) */}
                <div>
                  <label htmlFor="student-year" className="input-label">
                    Year (Class) <span className="text-maroon">*</span>
                  </label>
                  <select
                    id="student-year"
                    name="class_year"
                    value={studentForm.class_year}
                    onChange={handleStudentChange}
                    className="input-field bg-white font-medium"
                    disabled={loading}
                  >
                    {CLASS_YEAR_OPTIONS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Semester */}
                <div>
                  <label htmlFor="student-sem" className="input-label">
                    Current Semester <span className="text-maroon">*</span>
                  </label>
                  <select
                    id="student-sem"
                    name="current_semester"
                    value={studentForm.current_semester}
                    onChange={handleStudentChange}
                    className="input-field bg-white"
                    disabled={loading}
                  >
                    {SEMESTER_OPTIONS.map((sem) => (
                      <option key={sem} value={sem}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Division */}
                <div>
                  <label htmlFor="student-division" className="input-label">
                    Division <span className="text-maroon">*</span>
                  </label>
                  <select
                    id="student-division"
                    name="division"
                    value={studentForm.division}
                    onChange={handleStudentChange}
                    className="input-field bg-white"
                    disabled={loading}
                  >
                    {DIVISION_OPTIONS.map((div) => (
                      <option key={div} value={div}>
                        {div}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch */}
                <div>
                  <label htmlFor="student-batch" className="input-label">
                    Batch <span className="text-maroon">*</span>
                  </label>
                  <select
                    id="student-batch"
                    name="batch"
                    value={studentForm.batch}
                    onChange={handleStudentChange}
                    className="input-field bg-white"
                    disabled={loading}
                  >
                    {BATCH_OPTIONS.map((batch) => (
                      <option key={batch} value={batch}>
                        {batch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="student-password" className="input-label">
                    Password <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    value={studentForm.password}
                    onChange={handleStudentChange}
                    placeholder="Min 8 characters"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="student-confirm" className="input-label">
                    Confirm Password <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="student-confirm"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    value={studentForm.confirmPassword}
                    onChange={handleStudentChange}
                    placeholder="Re-enter password"
                    className="input-field"
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full justify-center py-2.5 mt-6 shadow-sm font-semibold tracking-wide text-sm"
                disabled={loading}
              >
                {loading ? 'Creating Student Account…' : 'Complete Student Registration'}
              </button>
            </form>
          ) : (
            /* ────────────────── FACULTY FORM ────────────────── */
            <form onSubmit={handleFacultySubmit} className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded text-xs text-amber-900 mb-4 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  <strong>Staff Security Gate:</strong> Registration requires the Computer Engineering Department Staff Passcode provided by the HOD / administration.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label htmlFor="faculty-name" className="input-label">
                    Full Name (with title) <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="faculty-name"
                    name="name"
                    type="text"
                    required
                    value={facultyForm.name}
                    onChange={handleFacultyChange}
                    placeholder="e.g. Prof. Rajan Sharma"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="faculty-email" className="input-label">
                    Official Email <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="faculty-email"
                    name="email"
                    type="email"
                    required
                    value={facultyForm.email}
                    onChange={handleFacultyChange}
                    placeholder="e.g. rajan@meswadiacoe.edu"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label htmlFor="faculty-empid" className="input-label">
                    Employee ID <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="faculty-empid"
                    name="employee_id"
                    type="text"
                    required
                    value={facultyForm.employee_id}
                    onChange={handleFacultyChange}
                    placeholder="e.g. FAC025"
                    className="input-field uppercase"
                    disabled={loading}
                  />
                </div>

                {/* Designation */}
                <div className="sm:col-span-2">
                  <label htmlFor="faculty-desig" className="input-label">
                    Designation <span className="text-maroon">*</span>
                  </label>
                  <select
                    id="faculty-desig"
                    name="designation"
                    value={facultyForm.designation}
                    onChange={handleFacultyChange}
                    className="input-field bg-white"
                    disabled={loading}
                  >
                    {DESIGNATION_OPTIONS.map((des) => (
                      <option key={des} value={des}>
                        {des}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="faculty-password" className="input-label">
                    Password <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="faculty-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    value={facultyForm.password}
                    onChange={handleFacultyChange}
                    placeholder="Min 8 characters"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="faculty-confirm" className="input-label">
                    Confirm Password <span className="text-maroon">*</span>
                  </label>
                  <input
                    id="faculty-confirm"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    value={facultyForm.confirmPassword}
                    onChange={handleFacultyChange}
                    placeholder="Re-enter password"
                    className="input-field"
                    disabled={loading}
                  />
                </div>

                {/* Department Staff Passcode */}
                <div className="sm:col-span-2">
                  <label htmlFor="faculty-passcode" className="input-label flex items-center justify-between">
                    <span>Department Staff Passcode <span className="text-maroon">*</span></span>
                    <span className="text-[10px] text-draft font-normal">Confidential key</span>
                  </label>
                  <input
                    id="faculty-passcode"
                    name="passcode"
                    type="password"
                    required
                    value={facultyForm.passcode}
                    onChange={handleFacultyChange}
                    placeholder="Enter department security key"
                    className="input-field"
                    disabled={loading}
                  />
                  <p className="text-[10px] text-draft mt-1">
                    Provided internally to Computer Engineering teaching staff.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full justify-center py-2.5 mt-6 shadow-sm font-semibold tracking-wide text-sm"
                disabled={loading}
              >
                {loading ? 'Verifying & Registering…' : 'Register as Faculty Member'}
              </button>
            </form>
          )}

          {/* Footer Navigation */}
          <div className="mt-6 pt-5 border-t border-rule text-center">
            <p className="text-xs text-draft">
              Already registered on the portal?{' '}
              <Link to="/login" className="text-navy font-semibold hover:underline">
                Sign in to your account →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
