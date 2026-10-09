import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';

// Helper: Normalize & extract class string like TE-B, TE-A, BE-A
export function formatStudentClass(classYear, rawDivision) {
  let yr = (classYear || '').toString().trim().toUpperCase();
  let div = (rawDivision || '').toString().trim().toUpperCase();

  // If division contains the year (e.g. "TE 2", "TE-B", "TE-1", "TE A")
  if (yr && div.startsWith(yr)) {
    div = div.slice(yr.length).replace(/^[-_\s]+/, '').trim();
  }

  // If no year specified, check if division starts with FE, SE, TE, BE
  if (!yr) {
    const yrMatch = div.match(/^(FE|SE|TE|BE)/);
    if (yrMatch) {
      yr = yrMatch[1];
      div = div.slice(yr.length).replace(/^[-_\s]+/, '').trim();
    } else {
      yr = 'TE';
    }
  }

  // Map 1 -> A, 2 -> B, 3 -> C, 4 -> D, or Roman I -> A, II -> B, III -> C
  if (div === '1' || div === 'I') div = 'A';
  else if (div === '2' || div === 'II') div = 'B';
  else if (div === '3' || div === 'III') div = 'C';
  else if (div === '4' || div === 'IV') div = 'D';

  if (!div) div = 'A';
  return `${yr}-${div}`;
}

// Helper: Detect class from PRN string pattern as fallback
export function detectClassFromPRN(prn, academicYear = '2026-27') {
  if (!prn) return null;
  const clean = prn.trim().toUpperCase();

  // Pattern 1: College internal PRN / Roll like F23112050 or S24111001
  const fMatch = clean.match(/^([FS])(\d{2})(\d{2})?(\d)?/);
  if (fMatch) {
    const admYear = parseInt(fMatch[2], 10);
    const divDigit = fMatch[4];

    let year = 'TE';
    if (admYear === 22) year = 'BE';
    else if (admYear === 23) year = 'TE';
    else if (admYear === 24) year = 'SE';
    else if (admYear === 25) year = 'FE';
    else if (admYear <= 21) year = 'BE';

    let div = 'A';
    if (divDigit === '1') div = 'A';
    else if (divDigit === '2') div = 'B';
    else if (divDigit === '3') div = 'C';

    return `${year}-${div}`;
  }

  // Pattern 2: SPPU University PRN like 72312799K
  const sppuMatch = clean.match(/^7(\d{2})/);
  if (sppuMatch) {
    const admYear = parseInt(sppuMatch[1], 10);
    let year = 'TE';
    if (admYear === 22) year = 'BE';
    else if (admYear === 23) year = 'TE';
    else if (admYear === 24) year = 'SE';
    else if (admYear <= 21) year = 'BE';
    return `${year}-A`;
  }

  return null;
}

// Helper Component: Club Logo with official fallback emblems
export function ClubLogo({ club, className = 'w-10 h-10' }) {
  if (club?.logo_url) {
    return (
      <img
        src={club.logo_url}
        alt={club.name || 'Club Logo'}
        className={`${className} rounded-lg object-contain bg-white border border-rule shadow-xs p-1`}
      />
    );
  }

  const code = (club?.code || '').toUpperCase();

  if (code === 'CSI') {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#1E3A8A] to-[#172554] border border-blue-900 shadow-xs flex flex-col items-center justify-center text-white shrink-0 p-0.5 select-none`} title="Computer Society of India">
        <span className="font-sans font-black text-xs tracking-wider leading-none text-amber-300">CSI</span>
        <span className="text-[6.5px] font-mono tracking-tight text-blue-200 uppercase leading-none mt-0.5">INDIA</span>
      </div>
    );
  }

  if (code === 'ACM') {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#0284C7] to-[#0369A1] border border-sky-800 shadow-xs flex flex-col items-center justify-center text-white shrink-0 p-0.5 select-none`} title="ACM Student Chapter">
        <div className="w-3.5 h-3.5 border border-white/70 rotate-45 flex items-center justify-center mb-0.5">
          <div className="w-1.5 h-1.5 bg-white -rotate-45" />
        </div>
        <span className="font-sans font-black text-[9px] tracking-widest leading-none">ACM</span>
      </div>
    );
  }

  if (code.includes('GDG')) {
    return (
      <div className={`${className} rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0 p-1 select-none`} title="Google Developer Groups">
        <svg viewBox="0 0 48 48" className="w-6 h-6">
          <path fill="#EA4335" d="M14 14 L6 24 L14 34 L18 30 L12 24 L18 18 Z" />
          <path fill="#4285F4" d="M34 14 L42 24 L34 34 L30 30 L36 24 L30 18 Z" />
          <circle cx="21" cy="24" r="3" fill="#FBBC05" />
          <circle cx="27" cy="24" r="3" fill="#34A853" />
        </svg>
      </div>
    );
  }

  if (code.includes('ALGO') || code.includes('CP')) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#0F172A] to-[#1E293B] border border-slate-700 shadow-xs flex flex-col items-center justify-center text-emerald-400 shrink-0 p-0.5 select-none`} title="Competitive Programming & Algo Club">
        <span className="font-mono font-black text-xs tracking-tighter leading-none">&lt;/&gt;</span>
        <span className="text-[6.5px] font-mono text-slate-300 uppercase leading-none mt-0.5">ALGO</span>
      </div>
    );
  }

  if (code.includes('CYBER') || code.includes('SEC')) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#312E81] to-[#1E1B4B] border border-indigo-900 shadow-xs flex flex-col items-center justify-center text-cyan-300 shrink-0 p-0.5 select-none`} title="Cyber Security Guild">
        <svg className="w-3.5 h-3.5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944z" clipRule="evenodd" />
        </svg>
        <span className="text-[6.5px] font-mono font-bold tracking-wider text-cyan-200 leading-none mt-0.5">CYBER</span>
      </div>
    );
  }

  if (code.includes('AI') || code.includes('ML')) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#581C87] to-[#3B0764] border border-purple-900 shadow-xs flex flex-col items-center justify-center text-fuchsia-300 shrink-0 p-0.5 select-none`} title="Artificial Intelligence & ML Club">
        <svg className="w-3.5 h-3.5 text-fuchsia-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L4.2 15.3" />
        </svg>
        <span className="text-[6.5px] font-mono font-bold tracking-wider text-fuchsia-200 leading-none mt-0.5">AI / ML</span>
      </div>
    );
  }

  if (code.includes('SIH')) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-[#EA580C] via-amber-100 to-[#16A34A] border border-amber-500 shadow-xs flex flex-col items-center justify-center shrink-0 p-0.5 select-none`} title="Smart India Hackathon">
        <span className="font-sans font-black text-[11px] text-[#0F172A] tracking-tight leading-none drop-shadow-xs">SIH</span>
        <span className="text-[6px] font-bold text-navy tracking-tighter uppercase leading-none mt-0.5">INDIA</span>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg bg-navy/10 border border-navy/20 shadow-xs flex items-center justify-center text-navy font-bold text-xs shrink-0 select-none`}>
      {code.slice(0, 3)}
    </div>
  );
}

export default function ManageClubs() {
  const { user, refreshUser } = useAuth();
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    clubs: [],
    headCoordinator: null,
    permissions: {},
    stats: {
      total_clubs: 0,
      active_clubs: 0,
      total_events: 0,
      upcoming_events: 0,
      total_members: 0,
      total_budget_approved: 0,
    },
  });

  const [activeTab, setActiveTab] = useState('allocation'); // 'allocation' | 'my_club' | 'clubs' | 'events'
  const [facultyList, setFacultyList] = useState([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Allocation local selections { [clubId]: facultyId }
  const [allocations, setAllocations] = useState({});
  const [savingAllocationId, setSavingAllocationId] = useState(null);

  // Edit Club Name, Motto & Logo Modal state
  const [editClubDetailsModal, setEditClubDetailsModal] = useState(null);
  const [editClubForm, setEditClubForm] = useState({ name: '', motto: '', logo_url: '' });
  const [savingClubDetails, setSavingClubDetails] = useState(false);

  // Club Modal state
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  const [clubFormData, setClubFormData] = useState({
    name: '',
    code: '',
    category: 'Technical & Coding',
    department: 'Computer Engineering',
    description: '',
    faculty_coordinator_id: '',
    student_lead_name: '',
    student_lead_prn: '',
    student_lead_phone: '',
    student_lead_division: '',
    vice_president_name: '',
    vice_president_prn: '',
    vice_president_phone: '',
    vice_president_division: '',
    academic_year: '2026-27',
    status: 'Active',
    founded_year: '2022',
    website_or_link: '',
  });


  const [fetchingStudentLead, setFetchingStudentLead] = useState(false);
  const [fetchingVicePresident, setFetchingVicePresident] = useState(false);

  // Fetch student details (Name, PRN, Mobile No, Division) directly from database
  const fetchStudentData = async (query, roleType) => {
    if (!query || query.trim().length < 1) return;
    const isVP = roleType === 'vp';
    if (isVP) setFetchingVicePresident(true);
    else setFetchingStudentLead(true);

    try {
      const res = await api.get(`/clubs/student-lookup?q=${encodeURIComponent(query.trim())}`);
      const students = res.data.students || [];
      if (students.length > 0) {
        const student = students[0];
        const formattedClass = formatStudentClass(student.class_year, student.division);
        setClubFormData((prev) => {
          if (isVP) {
            return {
              ...prev,
              vice_president_name: student.student_name || prev.vice_president_name,
              vice_president_prn: student.prn || prev.vice_president_prn,
              vice_president_phone: student.mobile || prev.vice_president_phone,
              vice_president_division: formattedClass || prev.vice_president_division,
            };
          } else {
            return {
              ...prev,
              student_lead_name: student.student_name || prev.student_lead_name,
              student_lead_prn: student.prn || prev.student_lead_prn,
              student_lead_phone: student.mobile || prev.student_lead_phone,
              student_lead_division: formattedClass || prev.student_lead_division,
            };
          }
        });
        toast.success(`Fetched from database: ${student.student_name} (Class: ${formattedClass})`);
      } else {
        toast.error('No matching student found for this PRN / Roll No in records');
      }
    } catch (err) {
      console.error('Failed to lookup student', err);
      toast.error('Failed to fetch student details');
    } finally {
      if (isVP) setFetchingVicePresident(false);
      else setFetchingStudentLead(false);
    }
  };

  // Event Modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    club_id: '',
    title: '',
    event_type: 'Workshop',
    academic_year: '2026-27',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    time: '10:00 AM - 04:00 PM',
    venue: '',
    mode: 'Offline',
    proposed_budget: 0,
    approved_budget: 0,
    expected_participants: 60,
    actual_participants: 0,
    speaker_or_trainer: '',
    description: '',
    status: 'Approved',
    coordinator_remarks: '',
  });

  const [eventsList, setEventsList] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventClubFilter, setEventClubFilter] = useState('ALL');
  const [eventStatusFilter, setEventStatusFilter] = useState('ALL');

  // Selected Club View / Committee Roster Modal
  const [selectedClub, setSelectedClub] = useState(null);
  const [clubMembers, setClubMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newMemberData, setNewMemberData] = useState({
    student_name: '',
    prn: '',
    division: '',
    class_year: 'TE',
    role: 'Core Member',
    is_core: false,
  });
  const [fetchingMemberPRN, setFetchingMemberPRN] = useState(false);
  const [memberAutoDetected, setMemberAutoDetected] = useState(null);
  const prnLookupTimerRef = useRef(null);

  // Auto-detect student class and details when PRN is entered
  const lookupMemberByPRN = async (prnValue, showToast = true) => {
    const cleanPRN = (prnValue || '').trim();
    if (!cleanPRN || cleanPRN.length < 2) {
      setMemberAutoDetected(null);
      return;
    }

    setFetchingMemberPRN(true);
    try {
      const res = await api.get(`/clubs/student-lookup?q=${encodeURIComponent(cleanPRN)}`);
      const students = res.data.students || [];

      // Find exact match first (by PRN or roll_no) or first match
      const exact = students.find(
        (s) =>
          (s.prn && s.prn.trim().toUpperCase() === cleanPRN.toUpperCase()) ||
          (s.roll_no && s.roll_no.trim().toUpperCase() === cleanPRN.toUpperCase())
      ) || students[0];

      if (exact) {
        const detectedClass = formatStudentClass(exact.class_year, exact.division);
        const classParts = detectedClass.split('-');
        const classYear = classParts[0] || exact.class_year || 'TE';

        setNewMemberData((prev) => ({
          ...prev,
          prn: exact.prn || cleanPRN.toUpperCase(),
          student_name: (!prev.student_name || prev.student_name === 'sdawd') ? exact.student_name : prev.student_name,
          division: detectedClass,
          class_year: classYear,
        }));

        setMemberAutoDetected({
          name: exact.student_name,
          class: detectedClass,
          rollNo: exact.roll_no,
          foundInDb: true,
        });

        if (showToast) {
          toast.success(`Class auto-detected: ${detectedClass} (${exact.student_name})`);
        }
      } else {
        // Fallback: Pattern detection from PRN
        const detectedFromPattern = detectClassFromPRN(cleanPRN, academicYear);
        if (detectedFromPattern) {
          const classParts = detectedFromPattern.split('-');
          const classYear = classParts[0] || 'TE';
          setNewMemberData((prev) => ({
            ...prev,
            division: detectedFromPattern,
            class_year: classYear,
          }));
          setMemberAutoDetected({
            class: detectedFromPattern,
            foundInDb: false,
          });
          if (showToast) {
            toast(`Class detected from PRN pattern: ${detectedFromPattern}`, { icon: 'ℹ️' });
          }
        } else {
          setMemberAutoDetected(null);
          if (showToast) {
            toast.error('No student records found for this PRN');
          }
        }
      }
    } catch (err) {
      console.error('Failed to lookup student for committee member', err);
      const detectedFromPattern = detectClassFromPRN(cleanPRN, academicYear);
      if (detectedFromPattern) {
        const classParts = detectedFromPattern.split('-');
        setNewMemberData((prev) => ({
          ...prev,
          division: detectedFromPattern,
          class_year: classParts[0] || 'TE',
        }));
        setMemberAutoDetected({
          class: detectedFromPattern,
          foundInDb: false,
        });
      } else {
        toast.error('Failed to lookup student records');
      }
    } finally {
      setFetchingMemberPRN(false);
    }
  };

  const handleMemberPRNChange = (value) => {
    setNewMemberData((prev) => ({ ...prev, prn: value }));
    if (memberAutoDetected) {
      setMemberAutoDetected(null);
    }
  };

  // Expanded cards state (accordion toggle)
  const [expandedClubIds, setExpandedClubIds] = useState(new Set());

  const toggleExpandClub = (clubId) => {
    setExpandedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        next.add(clubId);
      }
      return next;
    });
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clubs?academicYear=${academicYear}`);
      setData(res.data);

      const allocMap = {};
      (res.data.clubs || []).forEach((c) => {
        allocMap[c.id] = c.faculty_coordinator_id ? String(c.faculty_coordinator_id) : '';
      });
      setAllocations(allocMap);
    } catch (err) {
      console.error('Failed to load clubs overview', err);
      toast.error('Failed to load clubs overview');
    } finally {
      setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const res = await api.get('/clubs/faculty-list');
      setFacultyList(res.data.faculty || []);
    } catch (err) {
      console.error('Failed to load faculty list', err);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const res = await api.get(`/clubs/events?academicYear=${academicYear}`);
      setEventsList(res.data.events || []);
    } catch (err) {
      console.error('Failed to load club events', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchMembers = async (clubId) => {
    setMembersLoading(true);
    try {
      const res = await api.get(`/clubs/${clubId}/members?academicYear=${academicYear}`);
      setClubMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to load club members', err);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFaculty();
    fetchEvents();
  }, [academicYear]);

  const isClubHead = !!user?.is_club_coordinator;
  const facultyId = user?.faculty_id;
  const myAssignedClubs = data.clubs.filter(
    (c) => c.faculty_coordinator_id && Number(c.faculty_coordinator_id) === Number(facultyId)
  );
  const isAssignedFaculty = myAssignedClubs.length > 0;
  const canAccess = isClubHead || isAssignedFaculty;

  // Set default tab based on role
  useEffect(() => {
    if (isClubHead) {
      setActiveTab('allocation');
    } else if (isAssignedFaculty) {
      setActiveTab('my_club');
    }
  }, [isClubHead, isAssignedFaculty]);

  // Handle Faculty Assignment
  const handleSaveFacultyAssignment = async (club) => {
    const selectedFacId = allocations[club.id];
    setSavingAllocationId(club.id);
    try {
      const res = await api.put(`/clubs/${club.id}/assign-faculty`, {
        faculty_id: selectedFacId ? parseInt(selectedFacId, 10) : null,
      });
      toast.success(res.data.message || 'Faculty In-Charge assigned successfully!');
      await fetchData();
      if (refreshUser) refreshUser();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to assign faculty in-charge');
    } finally {
      setSavingAllocationId(null);
    }
  };

  // Open Edit Club Name, Motto & Logo Modal
  const handleOpenEditClubDetails = (club) => {
    setEditClubDetailsModal(club);
    setEditClubForm({
      name: club.name || '',
      motto: club.motto || club.description || '',
      logo_url: club.logo_url || '',
    });
  };

  // Handle Logo File Upload (converts to base64 data URL)
  const handleLogoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditClubForm((prev) => ({ ...prev, logo_url: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  // Save Club Name, Motto & Logo Changes
  const handleSaveClubDetails = async (e) => {
    if (e) e.preventDefault();
    if (!editClubDetailsModal) return;
    setSavingClubDetails(true);
    try {
      const res = await api.put(`/clubs/${editClubDetailsModal.id}`, {
        name: editClubForm.name.trim(),
        motto: editClubForm.motto.trim(),
        description: editClubForm.motto.trim(),
        logo_url: editClubForm.logo_url ? editClubForm.logo_url.trim() : null,
      });
      toast.success(res.data.message || 'Club name, motto and logo updated successfully!');
      setEditClubDetailsModal(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to update club details', err);
      toast.error(err.response?.data?.error || 'Failed to update club details');
    } finally {
      setSavingClubDetails(false);
    }
  };


  // Open Club Modal
  const handleOpenClubModal = (club = null) => {
    if (club) {
      setEditingClub(club);
      setClubFormData({
        name: club.name || '',
        code: club.code || '',
        category: club.category || 'Technical & Coding',
        department: club.department || 'Computer Engineering',
        description: club.description || '',
        faculty_coordinator_id: club.faculty_coordinator_id || '',
        student_lead_name: club.student_lead_name || '',
        student_lead_prn: club.student_lead_prn || '',
        student_lead_phone: club.student_lead_phone || '',
        student_lead_division: club.student_lead_division || '',
        vice_president_name: club.vice_president_name || '',
        vice_president_prn: club.vice_president_prn || '',
        vice_president_phone: club.vice_president_phone || '',
        vice_president_division: club.vice_president_division || '',
        academic_year: club.academic_year || academicYear,
        status: club.status || 'Active',
        founded_year: club.founded_year || '2022',
        website_or_link: club.website_or_link || '',
      });
    } else {
      setEditingClub(null);
      setClubFormData({
        name: '',
        code: '',
        category: 'Technical & Coding',
        department: 'Computer Engineering',
        description: '',
        faculty_coordinator_id: '',
        student_lead_name: '',
        student_lead_prn: '',
        student_lead_phone: '',
        student_lead_division: 'TE-A',
        vice_president_name: '',
        vice_president_prn: '',
        vice_president_phone: '',
        vice_president_division: 'TE-B',
        academic_year: academicYear,
        status: 'Active',
        founded_year: new Date().getFullYear().toString(),
        website_or_link: '',
      });
    }
    setClubModalOpen(true);
  };

  // Save Club
  const handleSaveClub = async (e) => {
    e.preventDefault();
    if (!clubFormData.name || !clubFormData.code || !clubFormData.category) {
      toast.error('Please fill in required fields (Name, Code, Category)');
      return;
    }

    try {
      if (editingClub) {
        await api.put(`/clubs/${editingClub.id}`, clubFormData);
        toast.success(`Club "${clubFormData.name}" updated successfully`);
      } else {
        await api.post('/clubs', clubFormData);
        toast.success(`Club "${clubFormData.name}" created successfully`);
      }
      setClubModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save club');
    }
  };

  // Delete Club
  const handleDeleteClub = async (club) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${club.name} (${club.code})? All associated events and core committee members will also be removed.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/clubs/${club.id}`);
      toast.success('Club removed successfully');
      fetchData();
      if (selectedClub?.id === club.id) setSelectedClub(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to remove club');
    }
  };

  // Open Event Modal
  const handleOpenEventModal = (event = null, defaultClubId = '') => {
    if (event) {
      setEditingEvent(event);
      setEventFormData({
        club_id: event.club_id || '',
        title: event.title || '',
        event_type: event.event_type || 'Workshop',
        academic_year: event.academic_year || academicYear,
        start_date: event.start_date ? event.start_date.split('T')[0] : '',
        end_date: event.end_date ? event.end_date.split('T')[0] : '',
        time: event.time || '',
        venue: event.venue || '',
        mode: event.mode || 'Offline',
        proposed_budget: event.proposed_budget || 0,
        approved_budget: event.approved_budget || 0,
        expected_participants: event.expected_participants || 0,
        actual_participants: event.actual_participants || 0,
        speaker_or_trainer: event.speaker_or_trainer || '',
        description: event.description || '',
        status: event.status || 'Approved',
        coordinator_remarks: event.coordinator_remarks || '',
      });
    } else {
      setEditingEvent(null);
      const initialClubId =
        defaultClubId ||
        (myAssignedClubs.length > 0 ? myAssignedClubs[0].id : data.clubs.length > 0 ? data.clubs[0].id : '');
      setEventFormData({
        club_id: initialClubId,
        title: '',
        event_type: 'Workshop',
        academic_year: academicYear,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        time: '10:00 AM - 04:00 PM',
        venue: 'Seminar Hall / Computer Lab',
        mode: 'Offline',
        proposed_budget: 15000,
        approved_budget: 15000,
        expected_participants: 60,
        actual_participants: 0,
        speaker_or_trainer: '',
        description: '',
        status: isClubHead ? 'Approved' : 'Submitted',
        coordinator_remarks: isClubHead ? 'Approved by Club Governance' : '',
      });
    }
    setEventModalOpen(true);
  };

  // Save Event
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventFormData.club_id || !eventFormData.title || !eventFormData.start_date || !eventFormData.venue) {
      toast.error('Please fill in required fields (Club, Title, Date, Venue)');
      return;
    }

    try {
      if (editingEvent) {
        await api.put(`/clubs/events/${editingEvent.id}`, eventFormData);
        toast.success(`Event "${eventFormData.title}" updated successfully`);
      } else {
        await api.post('/clubs/events', eventFormData);
        toast.success(`Event "${eventFormData.title}" recorded successfully`);
      }
      setEventModalOpen(false);
      fetchData();
      if (activeTab === 'events') fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save event');
    }
  };

  // Inline status update
  const handleUpdateEventStatus = async (eventId, newStatus) => {
    try {
      await api.put(`/clubs/events/${eventId}`, { status: newStatus });
      toast.success(`Event marked as ${newStatus}`);
      fetchEvents();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update event status');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to delete event "${title}"?`)) return;
    try {
      await api.delete(`/clubs/events/${eventId}`);
      toast.success('Event removed');
      fetchEvents();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete event');
    }
  };

  // Open Club Detail / Committee Modal
  const handleViewClubDetails = (club) => {
    setSelectedClub(club);
    fetchMembers(club.id);
  };

  // Add Member to Club
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberData.student_name) {
      toast.error('Please enter student name');
      return;
    }
    // Auto-detect class if not already set
    let finalDiv = newMemberData.division;
    let finalYear = newMemberData.class_year;
    if (!finalDiv && newMemberData.prn) {
      finalDiv = detectClassFromPRN(newMemberData.prn, academicYear) || 'TE-A';
      finalYear = finalDiv.split('-')[0] || 'TE';
    } else if (!finalDiv) {
      finalDiv = 'TE-A';
      finalYear = 'TE';
    }

    try {
      await api.post(`/clubs/${selectedClub.id}/members`, {
        ...newMemberData,
        division: finalDiv,
        class_year: finalYear,
        academic_year: academicYear,
      });
      toast.success('Committee member added');
      setNewMemberData({
        student_name: '',
        prn: '',
        division: '',
        class_year: 'TE',
        role: 'Core Member',
        is_core: false,
      });
      setMemberAutoDetected(null);
      fetchMembers(selectedClub.id);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  };

  // Remove Member
  const handleRemoveMember = async (memberId) => {
    try {
      await api.delete(`/clubs/members/${memberId}`);
      toast.success('Member removed');
      fetchMembers(selectedClub.id);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove member');
    }
  };

  // Gatekeeping: If unassigned faculty tries to view
  if (!loading && !canAccess) {
    return (
      <div className="p-8 lg:p-10 w-full max-w-4xl mx-auto">
        <div className="panel p-12 text-center my-8">
          <div className="w-12 h-12 rounded bg-amber-50 text-amber-900 border border-amber-300 flex items-center justify-center mx-auto mb-4 font-mono font-bold text-xl">
            !
          </div>
          <h2 className="font-serif text-2xl font-bold text-ink">Club In-Charge Access Only</h2>
          <p className="text-sm text-draft mt-2 max-w-lg mx-auto">
            You are not currently designated as the faculty in-charge for any of the 6 department clubs or Smart India Hackathon (SIH) for AY {academicYear}.
          </p>
          <div className="mt-6 p-4 bg-paper rounded border border-rule max-w-md mx-auto text-xs text-draft text-left">
            <span className="font-bold text-ink block mb-1">Department Club Head Coordinator:</span>
            {data.headCoordinator ? (
              <span>
                {data.headCoordinator.faculty_name} ({data.headCoordinator.designation} · {data.headCoordinator.faculty_email})
              </span>
            ) : (
              <span>Coordinator designation pending in HOD portal.</span>
            )}
          </div>
          <Link to={user?.role === 'hod' ? '/hod' : '/faculty'} className="btn-secondary text-xs mt-6 inline-flex">
            {user?.role === 'hod' ? 'Return to HOD Dashboard' : 'Return to Faculty Dashboard'}
          </Link>
        </div>
      </div>
    );
  }

  // Filtered Clubs
  const filteredClubs = data.clubs.filter((club) => {
    const matchesSearch =
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (club.faculty_name && club.faculty_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (club.student_lead_name && club.student_lead_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || club.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || club.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [
    'ALL',
    'Professional Chapter',
    'Technical & Coding',
    'Innovation & AI',
    'Technical & Security',
    'National Hackathon & Innovation',
    'Cultural & Social',
  ];

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-rule">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-draft uppercase tracking-wider mb-1">
            <Link to={user?.role === 'hod' ? '/hod' : '/faculty'} className="hover:text-navy transition-colors">
              {user?.role === 'hod' ? 'HOD Portal' : 'Faculty Portal'}
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold">
              {isClubHead ? 'Club Head Coordinator' : 'Handle Club & Activities'}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">
            {isClubHead ? 'Assign Faculty In-Charge' : 'Handle Assigned Club / SIH'}
          </h1>
          <p className="text-base text-draft mt-1 font-medium">
            {isClubHead
              ? `Designate and allocate faculty in-charge for each of the 6 department student chapters and SIH cell (AY ${academicYear})`
              : `Operational workspace for your designated club/SIH responsibilities (AY ${academicYear})`}
          </p>
        </div>

        {/* AY Selector */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-rule rounded">
            <label className="text-xs font-bold text-draft uppercase tracking-wider">AY:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="text-xs font-semibold text-ink bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="2026-27">2026-27 (Current)</option>
              <option value="2025-26">2025-26</option>
              <option value="2024-25">2024-25</option>
            </select>
          </div>

          {!isClubHead && (
            <button
              type="button"
              onClick={() => handleOpenEventModal()}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              <span>+</span> Propose / Log Activity
            </button>
          )}
        </div>
      </div>

      {/* Governance Banner */}
      <div className="mb-8 p-4 rounded bg-[#FAF9F5] border border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-navy text-white flex items-center justify-center font-bold text-xs">
            {isClubHead ? 'HEAD' : 'IN-CHG'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-navy">
                {isClubHead ? 'Appointed Club Head Coordinator' : 'Your Assigned Role'}
              </span>
              {data.headCoordinator && (
                <span className="badge badge-approved text-[10px] py-0 px-2">AY {academicYear} Active</span>
              )}
            </div>
            <p className="text-sm font-bold text-ink mt-0.5">
              {isClubHead ? (
                data.headCoordinator ? (
                  <>
                    {data.headCoordinator.faculty_name}{' '}
                    <span className="text-draft text-xs font-normal">
                      ({data.headCoordinator.designation || 'Associate Professor'} · {data.headCoordinator.faculty_email})
                    </span>
                  </>
                ) : (
                  <span>Assigned as Head Coordinator</span>
                )
              ) : (
                <>
                  Designated Faculty In-Charge for:{' '}
                  <span className="text-navy font-extrabold">
                    {myAssignedClubs.map((c) => c.name).join(', ')}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="text-xs text-draft font-mono">
          <span>Scope: </span>
          <span className="font-semibold text-ink">
            {isClubHead ? 'Total 6 Clubs + 1 SIH Cell' : `${myAssignedClubs.length} Unit(s) Assigned to You`}
          </span>
        </div>
      </div>

      {/* Summary Strip (For Club Head Coordinator: only allocation counts) */}
      {isClubHead ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="panel p-4 bg-white border border-rule">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Total Entities</p>
            <p className="font-mono text-2xl font-bold text-navy mt-1">7</p>
            <p className="text-[11px] text-draft mt-0.5">6 Technical Chapters + 1 SIH Cell</p>
          </div>

          <div className="panel p-4 bg-white border border-rule">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Allocated Faculty In-Charge</p>
            <p className="font-mono text-2xl font-bold text-pass mt-1">
              {data.clubs.filter((c) => c.faculty_coordinator_id).length} / 7
            </p>
            <p className="text-[11px] text-draft mt-0.5">Faculty members assigned</p>
          </div>

          <div className="panel p-4 bg-white border border-rule">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Pending Allocation</p>
            <p className={`font-mono text-2xl font-bold mt-1 ${
              data.clubs.filter((c) => !c.faculty_coordinator_id).length > 0 ? 'text-amber-600' : 'text-pass'
            }`}>
              {data.clubs.filter((c) => !c.faculty_coordinator_id).length}
            </p>
            <p className="text-[11px] text-draft mt-0.5">
              {data.clubs.filter((c) => !c.faculty_coordinator_id).length > 0 ? 'Units awaiting in-charge' : 'All 7 units allocated'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Your Assigned Units</p>
            <p className="font-mono text-2xl font-bold text-navy mt-1">{myAssignedClubs.length}</p>
            <p className="text-[11px] text-draft mt-0.5">Clubs / SIH in charge</p>
          </div>
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">AY Activities</p>
            <p className="font-mono text-2xl font-bold text-ink mt-1">
              {myAssignedClubs.reduce((acc, c) => acc + (parseInt(c.event_count, 10) || 0), 0)}
            </p>
            <p className="text-[11px] text-draft mt-0.5">Conducted / Scheduled</p>
          </div>
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Core Committee</p>
            <p className="font-mono text-2xl font-bold text-ink mt-1">
              {myAssignedClubs.reduce((acc, c) => acc + (parseInt(c.member_count, 10) || 0), 0)}
            </p>
            <p className="text-[11px] text-draft mt-0.5">Students enrolled</p>
          </div>
          <div className="panel p-4">
            <p className="text-[11px] uppercase tracking-wider text-draft font-semibold">Active Status</p>
            <p className="font-mono text-2xl font-bold text-pass mt-1">Active</p>
            <p className="text-[11px] text-draft mt-0.5">AY {academicYear}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-rule mb-6 overflow-x-auto">
        {isClubHead && (
          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'allocation'
                ? 'border-maroon text-maroon'
                : 'border-transparent text-draft hover:text-ink'
            }`}
          >
            <span>Assign Faculty In-Charge</span>
            <span className="badge badge-approved text-[10px] py-0 px-1.5 font-mono">6 Clubs + 1 SIH</span>
          </button>
        )}

        {isAssignedFaculty && (
          <button
            type="button"
            onClick={() => setActiveTab('my_club')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'my_club'
                ? 'border-maroon text-maroon'
                : 'border-transparent text-draft hover:text-ink'
            }`}
          >
            My Assigned Club ({myAssignedClubs.map((c) => c.code).join(', ')})
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-maroon text-maroon'
              : 'border-transparent text-draft hover:text-ink'
          }`}
        >
          <span>Log Activities</span>
          <span className="badge badge-approved text-[10px] py-0 px-1.5 font-mono">
            {isClubHead
              ? eventsList.length
              : eventsList.filter((ev) => myAssignedClubs.some((c) => Number(c.id) === Number(ev.club_id))).length}
          </span>
        </button>
      </div>

      {/* ─── FEATURE: ASSIGN FACULTY IN-CHARGE (FOR CLUB HEAD COORDINATOR) ──── */}
      {isClubHead && activeTab === 'allocation' && (
        <div className="panel overflow-hidden mb-8">
          <div className="p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F5]">
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">
                Faculty In-Charge Allocation Matrix
              </h2>
              <p className="text-xs text-draft mt-0.5">
                Assign or reassign faculty members in-charge for each of the 6 clubs and SIH cell for AY {academicYear}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-approved text-xs py-1 px-3">
                Total 7 Units (6 Clubs + 1 SIH)
              </span>
              <span className="badge bg-navy text-white text-xs py-1 px-3 font-mono">
                {data.clubs.filter((c) => c.faculty_coordinator_id).length} / 7 Assigned
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="result-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="text-center" style={{ width: '80px' }}>Club Logo</th>
                  <th>Club Name &amp; Motto</th>
                  <th>Category</th>
                  <th>Current Faculty In-Charge</th>
                  <th style={{ minWidth: '320px' }}>Assign / Reassign Faculty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.clubs.map((club, idx) => {
                  const currentFacId = allocations[club.id] || '';
                  const hasChanged = String(currentFacId) !== String(club.faculty_coordinator_id || '');
                  const isSIH = club.code === 'SIH';
                  const isAssigned = !!club.faculty_coordinator_id;

                  return (
                    <tr key={club.id} className={isSIH ? 'bg-amber-50/40' : ''}>
                      <td className="font-mono text-xs text-draft">{idx + 1}</td>
                      
                      {/* Club Logo Column (Replaces Unit Code) */}
                      <td className="text-center">
                        <div className="flex items-center justify-center">
                          <ClubLogo club={club} className="w-12 h-12" />
                        </div>
                      </td>

                      {/* Club Name & Motto Column (with Edit Action) */}
                      <td>
                        <div className="flex items-start justify-between gap-3 group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-ink">{club.name}</span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 bg-paper rounded border border-rule text-draft">
                                {club.code}
                              </span>
                              {isSIH && (
                                <span className="text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded">
                                  SIH CELL
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-draft italic mt-1 leading-relaxed line-clamp-2">
                              {club.motto || club.description ? (
                                `“${club.motto || club.description}”`
                              ) : (
                                <span className="not-italic text-draft/60">No motto configured yet — click Edit to add</span>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEditClubDetails(club)}
                            title="Change Club Name, Motto & Logo"
                            className="btn-secondary text-[11px] py-1 px-2.5 inline-flex items-center gap-1.5 shrink-0 shadow-2xs hover:border-navy cursor-pointer transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-navy"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                              />
                            </svg>
                            <span>Edit Name &amp; Motto</span>
                          </button>
                        </div>
                      </td>

                      <td>
                        <span className="badge bg-paper text-draft border-rule text-[11px]">
                          {club.category}
                        </span>
                      </td>

                      <td>
                        {club.faculty_name ? (
                          <div>
                            <span className="font-bold text-xs text-navy block">{club.faculty_name}</span>
                            <span className="text-[11px] text-draft block">
                              {club.faculty_designation || 'Faculty'} {club.faculty_email ? `· ${club.faculty_email}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="badge bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-bold">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="flex items-center gap-2">
                          <select
                            value={currentFacId}
                            onChange={(e) =>
                              setAllocations({ ...allocations, [club.id]: e.target.value })
                            }
                            className="input-field text-xs py-1.5 font-medium flex-1 bg-white"
                          >
                            <option value="">-- No Faculty Assigned --</option>
                            {facultyList.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({f.designation || 'Faculty'})
                              </option>
                            ))}
                          </select>
                          {hasChanged && (
                            <button
                              type="button"
                              disabled={savingAllocationId === club.id}
                              onClick={() => handleSaveFacultyAssignment(club)}
                              className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap shadow-xs"
                            >
                              {savingAllocationId === club.id ? 'Saving...' : 'Save'}
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        {isAssigned ? (
                          <span className="badge badge-approved text-[10px]">
                            ✓ Assigned
                          </span>
                        ) : (
                          <span className="badge badge-draft text-[10px]">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT CLUB NAME, MOTTO & LOGO ────────────────────────────── */}
      {editClubDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-lg border border-rule shadow-xl max-w-lg w-full p-6 my-8 animate-in fade-in duration-150">
            <div className="flex items-start justify-between pb-4 border-b border-rule">
              <div className="flex items-center gap-3">
                <ClubLogo club={{ ...editClubDetailsModal, logo_url: editClubForm.logo_url }} className="w-12 h-12" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-ink">
                    Edit Club Information
                  </h3>
                  <p className="text-xs text-draft font-mono">
                    Unit Code: <span className="font-bold text-navy">{editClubDetailsModal.code}</span> · {editClubDetailsModal.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditClubDetailsModal(null)}
                className="text-draft hover:text-ink text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveClubDetails} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold uppercase text-draft mb-1">
                  Club / Entity Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editClubForm.name}
                  onChange={(e) => setEditClubForm({ ...editClubForm, name: e.target.value })}
                  placeholder="e.g. Computer Society of India (CSI)"
                  className="input-field text-sm font-semibold w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-draft mb-1">
                  Club Motto / Tagline
                </label>
                <textarea
                  rows={3}
                  value={editClubForm.motto}
                  onChange={(e) => setEditClubForm({ ...editClubForm, motto: e.target.value })}
                  placeholder="e.g. Advancing computing as a science and profession through innovation..."
                  className="input-field text-xs w-full leading-relaxed"
                />
                <p className="text-[11px] text-draft mt-1">
                  This motto appears directly beneath the club name in the faculty allocation matrix and student activity portal.
                </p>
              </div>

              <div className="p-3.5 bg-paper rounded border border-rule space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-navy">
                    Club Logo / Emblem
                  </label>
                  {editClubForm.logo_url && (
                    <button
                      type="button"
                      onClick={() => setEditClubForm({ ...editClubForm, logo_url: '' })}
                      className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                    >
                      Reset to Default Emblem
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <ClubLogo
                    club={{ ...editClubDetailsModal, logo_url: editClubForm.logo_url }}
                    className="w-14 h-14"
                  />
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="text-[11px] text-draft block mb-0.5 font-medium">Upload Image File (PNG, JPG, SVG, WebP):</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-rule file:text-xs file:font-semibold file:bg-white hover:file:bg-paper cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-draft block mb-0.5 font-medium">Or Paste Image URL:</label>
                      <input
                        type="text"
                        placeholder="https://example.com/logo.png"
                        value={editClubForm.logo_url.startsWith('data:') ? '' : editClubForm.logo_url}
                        onChange={(e) => setEditClubForm({ ...editClubForm, logo_url: e.target.value })}
                        className="input-field text-xs py-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setEditClubDetailsModal(null)}
                  className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClubDetails || !editClubForm.name.trim()}
                  className="btn-primary text-xs py-2 px-4 shadow-sm cursor-pointer"
                >
                  {savingClubDetails ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── TAB: MY ASSIGNED CLUB / SIH (FOR ASSIGNED FACULTY) ────────────────── */}
      {activeTab === 'my_club' && (
        <div className="space-y-6 mb-8">
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded text-xs text-navy flex items-center justify-between">
            <div>
              <span className="font-bold">You are designated as Faculty In-Charge for: </span>
              {myAssignedClubs.map((c) => c.name).join(', ')}
            </div>
            <span className="font-mono text-draft text-[11px]">Academic Year {academicYear}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {myAssignedClubs.map((club) => (
              <div key={club.id} className="panel p-6 border-l-4 border-l-navy flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-navy border border-[#D5D9E8]">
                        {club.code}
                      </span>
                      <h2 className="font-serif text-xl font-bold text-ink mt-1">{club.name}</h2>
                      <p className="text-xs text-draft">{club.category}</p>
                    </div>
                    <span className="badge badge-approved text-xs">{club.status}</span>
                  </div>

                  <p className="text-xs text-draft mt-2 mb-4 leading-relaxed">
                    {club.description || 'No description provided.'}
                  </p>

                  {/* Workspace Details Grid: Faculty In-Charge, Student President & Activity Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {/* Faculty In-Charge */}
                    <div className="p-3 bg-paper rounded border border-rule">
                      <p className="text-[10px] font-bold uppercase text-draft">Faculty In-Charge</p>
                      <p className="text-xs font-bold text-navy mt-0.5">{user?.name} (You)</p>
                      <p className="text-[11px] text-draft mt-0.5">{user?.designation || 'Faculty'}</p>
                    </div>

                    {/* Student President */}
                    <div className="p-3 bg-paper rounded border border-rule">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase text-draft">Student President</p>
                        {club.student_lead_division && (
                          <span className="text-[10px] font-mono text-draft bg-white px-1 py-0.2 rounded border border-rule">
                            {club.student_lead_division}
                          </span>
                        )}
                      </div>
                      {club.student_lead_name ? (
                        <>
                          <p className="text-xs font-bold text-ink mt-0.5">
                            {club.student_lead_name}
                          </p>
                          <div className="text-[11px] font-mono text-draft truncate mt-0.5 space-y-0.5">
                            {club.student_lead_prn && <div>PRN: <span className="text-ink font-semibold">{club.student_lead_prn}</span></div>}
                            {club.student_lead_phone && <div>Mob: {club.student_lead_phone}</div>}
                            {!club.student_lead_prn && !club.student_lead_phone && club.student_lead_email && <div>{club.student_lead_email}</div>}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1">
                          <p className="text-xs text-draft italic">Not designated yet</p>
                          <button
                            type="button"
                            onClick={() => handleViewClubDetails(club)}
                            className="text-[10px] text-navy font-bold hover:underline mt-1 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>+</span> Designate President
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Activity Stats */}
                    <div className="p-3 bg-paper rounded border border-rule">
                      <p className="text-[10px] font-bold uppercase text-draft">Activity Stats</p>
                      <p className="text-xs font-bold text-navy mt-0.5">
                        {club.event_count || 0} Events · {club.member_count || 0} Core Members
                      </p>
                      <p className="text-[11px] text-draft mt-0.5">AY {academicYear}</p>
                    </div>
                  </div>

                  {/* Vice President Info */}
                  {club.vice_president_name ? (
                    <div className="p-2.5 bg-paper rounded border border-rule mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-draft mr-2">Vice President:</span>
                        <span className="font-bold text-ink">{club.vice_president_name}</span>
                        {club.vice_president_division && (
                          <span className="text-draft ml-1">({club.vice_president_division})</span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-draft flex items-center gap-3">
                        {club.vice_president_prn && <span>PRN: {club.vice_president_prn}</span>}
                        {club.vice_president_phone && <span>Mob: {club.vice_president_phone}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-paper/60 rounded border border-dashed border-rule mb-4 flex items-center justify-between text-xs text-draft">
                      <span className="text-[11px]">Vice President: <em className="text-draft">Not designated yet</em></span>
                      <button
                        type="button"
                        onClick={() => handleViewClubDetails(club)}
                        className="text-[10px] text-navy hover:underline font-bold cursor-pointer"
                      >
                        + Designate VP
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule">
                  <button
                    type="button"
                    onClick={() => handleViewClubDetails(club)}
                    className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
                  >
                    Core Members
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEventModal(null, club.id)}
                    className="btn-primary text-xs py-1.5 px-3 cursor-pointer"
                  >
                    + Log Activity
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ─── LOGGED ACTIVITIES & EVENTS LEDGER (FOR ASSIGNED CLUBS) ─────────── */}
          {(() => {
            const myAssignedIds = new Set(myAssignedClubs.map((c) => Number(c.id)));
            const myClubEvents = eventsList.filter((ev) => myAssignedIds.has(Number(ev.club_id)));

            return (
              <div className="panel overflow-hidden mt-6 shadow-sm border border-rule">
                <div className="p-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F5]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-lg font-bold text-ink">
                        Logged Activities &amp; Events Ledger
                      </h2>
                      <span className="badge badge-approved text-xs px-2.5 py-0.5 font-bold font-mono">
                        {myClubEvents.length} Recorded
                      </span>
                    </div>
                    <p className="text-xs text-draft mt-0.5">
                      Activities, workshops, competitions, and guest lectures logged for your assigned club(s) (AY {academicYear})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEventModal(null, myAssignedClubs[0]?.id)}
                      className="btn-primary text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="font-bold">+</span> Log New Activity
                    </button>
                  </div>
                </div>

                {eventsLoading ? (
                  <div className="p-10 text-center text-sm text-draft">Loading logged activities...</div>
                ) : myClubEvents.length === 0 ? (
                  <div className="p-10 text-center bg-white">
                    <div className="w-12 h-12 mx-auto rounded-full bg-paper border border-rule flex items-center justify-center text-xl text-draft mb-2">
                      📋
                    </div>
                    <p className="text-sm font-bold text-ink">No activities logged yet for AY {academicYear}</p>
                    <p className="text-xs text-draft mt-1 max-w-md mx-auto">
                      Use "+ Log Activity" to record events, technical workshops, hackathons, and guest lectures conducted under your club.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenEventModal(null, myAssignedClubs[0]?.id)}
                      className="btn-primary text-xs py-2 px-4 mt-4 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>+</span> Log First Activity
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th>Date &amp; Time</th>
                          <th>Club</th>
                          <th>Event Title &amp; Type</th>
                          <th>Venue &amp; Mode</th>
                          <th className="numeric">Budget (₹)</th>
                          <th className="numeric">Participants</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myClubEvents.map((ev) => (
                          <tr key={ev.id}>
                            <td className="whitespace-nowrap">
                              <span className="font-mono text-xs font-bold text-ink block">
                                {ev.start_date ? new Date(ev.start_date).toLocaleDateString('en-GB') : 'TBD'}
                              </span>
                              <span className="text-[11px] text-draft block">{ev.time || 'All Day'}</span>
                            </td>

                            <td className="whitespace-nowrap">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-navy border border-[#D5D9E8]">
                                {ev.club_code}
                              </span>
                            </td>

                            <td>
                              <span className="font-bold text-sm text-ink block">{ev.title}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-draft font-semibold">{ev.event_type}</span>
                                {ev.speaker_or_trainer && (
                                  <span className="text-[11px] text-draft truncate max-w-xs">
                                    · Speaker: {ev.speaker_or_trainer}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="whitespace-nowrap">
                              <span className="text-xs text-ink block">{ev.venue || 'Campus'}</span>
                              <span className="text-[11px] text-draft block">Mode: {ev.mode || 'Offline'}</span>
                            </td>

                            <td className="numeric whitespace-nowrap">
                              <span className="font-mono text-xs font-bold text-navy block">
                                ₹{Number(ev.approved_budget || ev.proposed_budget || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] text-draft block font-mono">
                                {ev.approved_budget ? 'Approved' : 'Proposed'}
                              </span>
                            </td>

                            <td className="numeric whitespace-nowrap">
                              <span className="font-mono text-xs font-bold text-ink block">
                                {ev.actual_participants > 0 ? ev.actual_participants : ev.expected_participants || 0}
                              </span>
                              <span className="text-[10px] text-draft block">
                                {ev.actual_participants > 0 ? 'Attended' : 'Expected'}
                              </span>
                            </td>

                            <td className="whitespace-nowrap">
                              <span
                                className={`badge text-[10px] ${
                                  ev.status === 'Approved'
                                    ? 'badge-approved'
                                    : ev.status === 'Completed'
                                    ? 'badge-published'
                                    : ev.status === 'Submitted'
                                    ? 'badge-submitted'
                                    : 'badge-draft'
                                }`}
                              >
                                {ev.status}
                              </span>
                            </td>

                            <td className="text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEventModal(ev)}
                                  className="btn-secondary text-xs py-1 px-2.5 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                  className="text-xs text-fail hover:underline px-1.5 py-1 cursor-pointer font-semibold"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── TAB: CLUBS & SIH DIRECTORY (ONLY FOR NON-HEAD VIEW) ──────────────── */}
      {!isClubHead && activeTab === 'clubs' && (
        <div>
          {/* Search & Filter Bar */}
          <div className="panel p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search by club name, code, faculty, lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-xs py-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-draft uppercase">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="input-field text-xs py-1.5 px-2.5 w-auto"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-draft uppercase">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field text-xs py-1.5 px-2.5 w-auto"
                >
                  <option value="ALL">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-draft">Loading clubs directory...</div>
          ) : filteredClubs.length === 0 ? (
            <div className="panel p-12 text-center">
              <p className="text-sm font-semibold text-ink">No departmental clubs found matching criteria</p>
              <p className="text-xs text-draft mt-1">Try resetting search filters or register a new club.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map((club) => {
                const isAdvisor = Number(user?.faculty_id) === Number(club.faculty_coordinator_id);
                const isSIH = club.code === 'SIH';
                const isExpanded = expandedClubIds.has(club.id);

                return (
                  <div
                    key={club.id}
                    onClick={() => toggleExpandClub(club.id)}
                    className={`panel flex flex-col justify-between transition-all duration-200 cursor-pointer select-none hover:shadow-md relative ${
                      isExpanded ? 'border-navy ring-1 ring-navy/25 shadow-sm' : 'hover:border-navy'
                    } ${isSIH ? 'border-amber-300 ring-1 ring-amber-200' : ''}`}
                  >
                    <div className="p-6">
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded border ${
                                isSIH
                                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                                  : 'bg-[#EEF0F7] text-navy border-[#D5D9E8]'
                              }`}
                            >
                              {club.code}
                            </span>
                            {isSIH && (
                              <span className="text-[10px] bg-amber-500 text-white font-extrabold px-1.5 py-0.2 rounded">
                                SIH CELL
                              </span>
                            )}
                            <span className="text-[11px] font-medium text-draft">
                              Est. {club.founded_year || '2020'}
                            </span>
                          </div>
                          <h2 className="font-serif text-lg font-bold text-ink leading-snug">
                            {club.name}
                          </h2>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`badge text-[10px] font-bold ${
                              club.status === 'Active' ? 'badge-approved' : 'badge-draft'
                            }`}
                          >
                            {club.status}
                          </span>
                          <span className="text-[10px] font-medium text-draft flex items-center gap-1">
                            {isExpanded ? '▲ Less' : '▼ More'}
                          </span>
                        </div>
                      </div>

                      {/* Category tag */}
                      <div className="mb-3">
                        <span className="inline-block text-[11px] font-semibold text-draft bg-paper px-2 py-0.5 rounded border border-rule">
                          {club.category}
                        </span>
                      </div>

                      {/* Description */}
                      <p className={`text-xs text-draft mb-4 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {club.description || 'No description provided for this student club chapter.'}
                      </p>

                      {/* Faculty In-Charge */}
                      <div
                        className={`p-3 rounded border mb-2.5 ${
                          isAdvisor
                            ? 'bg-blue-50/80 border-navy/40'
                            : 'bg-paper/60 border-rule'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-draft">
                            Designated Faculty In-Charge
                          </p>
                          {isAdvisor && (
                            <span className="badge bg-navy text-white text-[9px] py-0 px-1 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-ink mt-0.5">
                          {club.faculty_name || (
                            <span className="italic text-draft font-normal">Unassigned Advisor</span>
                          )}
                        </p>
                        {club.faculty_email && (
                          <p className="text-[11px] font-mono text-draft truncate mt-0.5">
                            {club.faculty_email}
                          </p>
                        )}
                      </div>

                      {/* Student Core Leadership */}
                      <div className="p-3 bg-paper/60 rounded border border-rule mb-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-draft">
                            President
                          </p>
                          {club.student_lead_division && (
                            <span className="text-[10px] font-mono text-draft bg-white px-1.5 py-0.2 rounded border border-rule">
                              {club.student_lead_division}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-ink">
                          {club.student_lead_name || (
                            <span className="italic text-draft font-normal">TBD</span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-draft">
                          {club.student_lead_prn && <span>PRN: {club.student_lead_prn}</span>}
                          {club.student_lead_phone && <span>Mob: {club.student_lead_phone}</span>}
                        </div>

                        {club.vice_president_name && (
                          <div className="pt-2 border-t border-rule/60 mt-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-draft">
                                Vice President
                              </p>
                              {club.vice_president_division && (
                                <span className="text-[10px] font-mono text-draft bg-white px-1.5 py-0.2 rounded border border-rule">
                                  {club.vice_president_division}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-ink mt-0.5">
                              {club.vice_president_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-draft mt-0.5">
                              {club.vice_president_prn && <span>PRN: {club.vice_president_prn}</span>}
                              {club.vice_president_phone && <span>Mob: {club.vice_president_phone}</span>}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mini Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-rule">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-draft">Events (AY)</p>
                          <p className="font-mono text-sm font-bold text-navy mt-0.5">
                            {club.event_count || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-draft">Core Members</p>
                          <p className="font-mono text-sm font-bold text-ink mt-0.5">
                            {club.member_count || 0}
                          </p>
                        </div>
                      </div>

                      {/* Collapsible Expanded Details Section */}
                      {isExpanded && (
                        <div
                          className="mt-4 pt-4 border-t border-dashed border-rule space-y-3 cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >

                          {/* Student Leadership Direct Contacts */}
                          <div className="p-3 bg-paper/80 rounded border border-rule/80 space-y-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-draft">
                              Student Core Leadership Direct Contacts
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* President Card */}
                              <div className="p-2.5 bg-white rounded border border-rule">
                                <span className="badge bg-navy text-white text-[9px] px-1.5 py-0 font-bold">
                                  PRESIDENT
                                </span>
                                <p className="text-xs font-bold text-ink mt-1">
                                  {club.student_lead_name || 'TBD'}{' '}
                                  {club.student_lead_division ? `(${club.student_lead_division})` : ''}
                                </p>
                                <div className="text-[11px] font-mono text-draft mt-1 space-y-0.5">
                                  {club.student_lead_prn && (
                                    <div>PRN: <span className="text-ink font-semibold">{club.student_lead_prn}</span></div>
                                  )}
                                  {club.student_lead_phone && (
                                    <div>
                                      Mobile:{' '}
                                      <a href={`tel:${club.student_lead_phone}`} className="text-navy hover:underline">
                                        {club.student_lead_phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Vice President Card */}
                              <div className="p-2.5 bg-white rounded border border-rule">
                                <span className="badge bg-slate-700 text-white text-[9px] px-1.5 py-0 font-bold">
                                  VICE PRESIDENT
                                </span>
                                <p className="text-xs font-bold text-ink mt-1">
                                  {club.vice_president_name || (
                                    <span className="italic text-draft font-normal">Not designated</span>
                                  )}{' '}
                                  {club.vice_president_division ? `(${club.vice_president_division})` : ''}
                                </p>
                                <div className="text-[11px] font-mono text-draft mt-1 space-y-0.5">
                                  {club.vice_president_prn && (
                                    <div>PRN: <span className="text-ink font-semibold">{club.vice_president_prn}</span></div>
                                  )}
                                  {club.vice_president_phone && (
                                    <div>
                                      Mobile:{' '}
                                      <a href={`tel:${club.vice_president_phone}`} className="text-navy hover:underline">
                                        {club.vice_president_phone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Official Website or Portal */}
                          {club.website_or_link && (
                            <div className="p-2.5 bg-paper/60 rounded border border-rule flex items-center justify-between gap-2 text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-draft">
                                Portal / Web Link:
                              </span>
                              <a
                                href={club.website_or_link.startsWith('http') ? club.website_or_link : `https://${club.website_or_link}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-navy hover:underline font-mono text-[11px] truncate flex items-center gap-1"
                              >
                                <span>{club.website_or_link}</span>
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expand / Collapse bottom bar indicator */}
                      <div className="mt-3 pt-2 text-center border-t border-rule/40">
                        <span className="text-[10px] font-semibold text-draft group-hover:text-navy transition-colors">
                          {isExpanded ? '▲ Click anywhere to collapse' : '▼ Click card to expand details'}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div
                      className="px-6 py-3 bg-[#FAF9F5] border-t border-rule flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewClubDetails(club);
                        }}
                        className="text-xs font-bold text-navy hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Details &amp; Committee</span>
                        <span>→</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {(isClubHead || isAdvisor) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEventModal(null, club.id);
                            }}
                            title="Add Activity for this club"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-draft hover:text-ink bg-white border border-rule hover:border-rule-dark rounded transition-colors cursor-pointer"
                          >
                            <span>+ Event</span>
                          </button>
                        )}

                        {(isClubHead || isAdvisor) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenClubModal(club);
                            }}
                            title="Edit Club Details"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-navy text-white hover:bg-[#152347] font-bold text-xs rounded shadow-xs hover:shadow transition-all cursor-pointer border border-navy"
                          >
                            <svg
                              className="w-3.5 h-3.5 text-amber-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                              />
                            </svg>
                            <span>Edit</span>
                          </button>
                        )}

                        {isClubHead && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClub(club);
                            }}
                            title="Delete Club"
                            className="text-xs font-semibold text-fail hover:bg-red-50 px-2 py-1 rounded transition-colors cursor-pointer"
                          >
                            Del
                          </button>
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

      {/* ─── TAB: EVENTS & ACTIVITIES LEDGER (FOR HEAD & IN-CHARGE) ─────────── */}
      {activeTab === 'events' && (() => {
        const myAssignedIds = new Set(myAssignedClubs.map((c) => Number(c.id)));
        // For In-Charge, only activities for their own assigned club:
        const baseEvents = isClubHead
          ? eventsList
          : eventsList.filter((ev) => myAssignedIds.has(Number(ev.club_id)));

        const filteredEvents = baseEvents.filter((ev) => {
          if (eventClubFilter !== 'ALL' && String(ev.club_id) !== String(eventClubFilter)) return false;
          if (eventStatusFilter !== 'ALL' && ev.status !== eventStatusFilter) return false;
          if (eventSearchQuery) {
            const q = eventSearchQuery.toLowerCase();
            const matchTitle = (ev.title || '').toLowerCase().includes(q);
            const matchSpeaker = (ev.speaker_or_trainer || '').toLowerCase().includes(q);
            const matchClub = (ev.club_code || '').toLowerCase().includes(q);
            const matchVenue = (ev.venue || '').toLowerCase().includes(q);
            if (!matchTitle && !matchSpeaker && !matchClub && !matchVenue) return false;
          }
          return true;
        });

        // Available clubs for filter dropdown
        const filterClubs = isClubHead ? data.clubs : myAssignedClubs;

        return (
          <div className="panel overflow-hidden">
            <div className="p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F5]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-bold text-ink">
                    Club Activities &amp; Events Ledger
                  </h2>
                  <span className="badge badge-approved text-xs px-2.5 py-0.5 font-bold font-mono">
                    {filteredEvents.length} Recorded
                  </span>
                </div>
                <p className="text-xs text-draft mt-0.5">
                  {isClubHead
                    ? `Activities, workshops, competitions, and guest lectures across all department clubs (AY ${academicYear})`
                    : `Activities, workshops, competitions, and guest lectures logged for your assigned club(s) (AY ${academicYear})`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEventModal(null, myAssignedClubs[0]?.id)}
                  className="btn-primary text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="font-bold">+</span> Log New Activity
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-paper/50 border-b border-rule flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Search activity by title, speaker, venue..."
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  className="input-field text-xs py-1.5 w-full sm:w-64"
                />

                {filterClubs.length > 1 && (
                  <select
                    value={eventClubFilter}
                    onChange={(e) => setEventClubFilter(e.target.value)}
                    className="input-field text-xs py-1.5 w-auto"
                  >
                    <option value="ALL">All Clubs ({filterClubs.length})</option>
                    {filterClubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={eventStatusFilter}
                  onChange={(e) => setEventStatusFilter(e.target.value)}
                  className="input-field text-xs py-1.5 w-auto"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Completed">Completed</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>

              {(eventSearchQuery || eventClubFilter !== 'ALL' || eventStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setEventSearchQuery('');
                    setEventClubFilter('ALL');
                    setEventStatusFilter('ALL');
                  }}
                  className="text-xs text-navy hover:underline font-semibold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {eventsLoading ? (
              <div className="p-12 text-center text-sm text-draft">Loading events ledger...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center bg-white">
                <div className="w-12 h-12 mx-auto rounded-full bg-paper border border-rule flex items-center justify-center text-xl text-draft mb-2">
                  📋
                </div>
                <p className="text-sm font-bold text-ink">
                  {baseEvents.length === 0
                    ? `No club activities recorded for AY ${academicYear}`
                    : 'No activities match the selected filter'}
                </p>
                <p className="text-xs text-draft mt-1 max-w-md mx-auto">
                  {baseEvents.length === 0
                    ? 'Click "+ Log New Activity" above to record workshops, competitions, hackathons, or guest lectures.'
                    : 'Try clearing your search query or selecting "All Clubs" / "All Statuses".'}
                </p>
                {baseEvents.length === 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenEventModal(null, myAssignedClubs[0]?.id)}
                    className="btn-primary text-xs py-2 px-4 mt-4 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span> Log First Activity
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Club</th>
                      <th>Event Title &amp; Type</th>
                      <th>Venue &amp; Mode</th>
                      <th className="numeric">Budget (₹)</th>
                      <th className="numeric">Participants</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-ink block">
                            {ev.start_date ? new Date(ev.start_date).toLocaleDateString('en-GB') : 'TBD'}
                          </span>
                          <span className="text-[11px] text-draft block">{ev.time || 'All Day'}</span>
                        </td>

                        <td className="whitespace-nowrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-navy border border-[#D5D9E8]">
                            {ev.club_code}
                          </span>
                        </td>

                        <td>
                          <span className="font-bold text-sm text-ink block">{ev.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-draft font-semibold">{ev.event_type}</span>
                            {ev.speaker_or_trainer && (
                              <span className="text-[11px] text-draft truncate max-w-xs">
                                · Speaker: {ev.speaker_or_trainer}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="whitespace-nowrap">
                          <span className="text-xs text-ink block">{ev.venue || 'Campus'}</span>
                          <span className="text-[11px] text-draft block">Mode: {ev.mode || 'Offline'}</span>
                        </td>

                        <td className="numeric whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-navy block">
                            ₹{Number(ev.approved_budget || ev.proposed_budget || 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-draft block font-mono">
                            {ev.approved_budget ? 'Approved' : 'Proposed'}
                          </span>
                        </td>

                        <td className="numeric whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-ink block">
                            {ev.actual_participants > 0 ? ev.actual_participants : ev.expected_participants || 0}
                          </span>
                          <span className="text-[10px] text-draft block">
                            {ev.actual_participants > 0 ? 'Attended' : 'Expected'}
                          </span>
                        </td>

                        <td className="whitespace-nowrap">
                          <span
                            className={`badge text-[10px] ${
                              ev.status === 'Approved'
                                ? 'badge-approved'
                                : ev.status === 'Completed'
                                ? 'badge-published'
                                : ev.status === 'Submitted'
                                ? 'badge-submitted'
                                : 'badge-draft'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>

                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {isClubHead && ev.status === 'Submitted' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEventStatus(ev.id, 'Approved')}
                                className="text-xs font-bold text-pass hover:underline px-1.5 cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            {isClubHead && ev.status === 'Approved' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEventStatus(ev.id, 'Completed')}
                                className="text-xs font-bold text-navy hover:underline px-1.5 cursor-pointer"
                              >
                                Complete
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEventModal(ev)}
                              className="btn-secondary text-xs py-1 px-2.5 cursor-pointer"
                            >
                              Edit
                            </button>

                            {(isClubHead || myAssignedIds.has(Number(ev.club_id))) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                className="text-xs font-semibold text-fail hover:underline px-1.5 py-1 cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}


      {/* ─── MODAL 1: REGISTER / EDIT CLUB ───────────────────────────────────── */}
      {clubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-rule rounded-sm shadow-xl max-w-2xl w-full my-8 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-rule">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">
                  {editingClub ? 'Edit Club / Unit Details' : 'Register New Club / Unit'}
                </h3>
                <p className="text-xs text-draft">
                  Departmental club registration, academic advisor assignment, and student leadership
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClubModalOpen(false)}
                className="text-draft hover:text-ink text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveClub} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Unit Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Society of India"
                    value={clubFormData.name}
                    onChange={(e) => setClubFormData({ ...clubFormData, name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Acronym / Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSI, ACM, GDSC, SIH"
                    value={clubFormData.code}
                    onChange={(e) => setClubFormData({ ...clubFormData, code: e.target.value })}
                    className="input-field uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Category *</label>
                  <select
                    value={clubFormData.category}
                    onChange={(e) => setClubFormData({ ...clubFormData, category: e.target.value })}
                    className="input-field"
                  >
                    <option value="Professional Chapter">Professional Chapter</option>
                    <option value="Technical & Coding">Technical & Coding</option>
                    <option value="Innovation & AI">Innovation & AI</option>
                    <option value="Technical & Security">Technical & Security</option>
                    <option value="National Hackathon & Innovation">National Hackathon & Innovation (SIH)</option>
                    <option value="Cultural & Social">Cultural & Social</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Faculty In-Charge</label>
                  <select
                    value={clubFormData.faculty_coordinator_id}
                    onChange={(e) =>
                      setClubFormData({ ...clubFormData, faculty_coordinator_id: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">-- Select Faculty In-Charge --</option>
                    {facultyList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.designation || 'Faculty'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Description / Mission</label>
                <textarea
                  rows={2}
                  placeholder="Outline objectives, technical focus, and expected student activities..."
                  value={clubFormData.description}
                  onChange={(e) => setClubFormData({ ...clubFormData, description: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Student Core Lead (President / Head) */}
              <div className="p-4 bg-paper rounded border border-rule">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-navy uppercase tracking-wider">
                    Student Core Lead (President / Head)
                  </p>
                  <span className="text-[11px] text-draft">
                    Enter PRN / Roll No &amp; click Fetch to auto-pull mobile &amp; details from database
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="input-label">PRN No / Roll No</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 72312799K"
                        value={clubFormData.student_lead_prn}
                        onChange={(e) =>
                          setClubFormData({ ...clubFormData, student_lead_prn: e.target.value })
                        }
                        onBlur={() => {
                          if (clubFormData.student_lead_prn && !clubFormData.student_lead_name) {
                            fetchStudentData(clubFormData.student_lead_prn, 'president');
                          }
                        }}
                        className="input-field font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => fetchStudentData(clubFormData.student_lead_prn, 'president')}
                        disabled={fetchingStudentLead || !clubFormData.student_lead_prn}
                        title="Fetch student info from DB"
                        className="px-2.5 py-1 text-xs font-bold bg-navy text-white rounded hover:bg-[#152347] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                      >
                        {fetchingStudentLead ? '...' : 'Fetch'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Lead Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Yash Vardhan"
                      value={clubFormData.student_lead_name}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, student_lead_name: e.target.value })
                      }
                      className="input-field text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="input-label flex items-center justify-between">
                      <span>Mobile No</span>
                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">FROM DB</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9822012345"
                      value={clubFormData.student_lead_phone}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, student_lead_phone: e.target.value })
                      }
                      className="input-field font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="input-label">Division / Class</label>
                    <input
                      type="text"
                      placeholder="TE-A / BE-B"
                      value={clubFormData.student_lead_division}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, student_lead_division: e.target.value })
                      }
                      className="input-field text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Student Vice President */}
              <div className="p-4 bg-paper rounded border border-rule">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-navy uppercase tracking-wider">
                    Student Vice President
                  </p>
                  <span className="text-[11px] text-draft">
                    Enter PRN / Roll No &amp; click Fetch to auto-pull mobile &amp; details from database
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="input-label">PRN No / Roll No</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. 72312802C"
                        value={clubFormData.vice_president_prn}
                        onChange={(e) =>
                          setClubFormData({ ...clubFormData, vice_president_prn: e.target.value })
                        }
                        onBlur={() => {
                          if (clubFormData.vice_president_prn && !clubFormData.vice_president_name) {
                            fetchStudentData(clubFormData.vice_president_prn, 'vp');
                          }
                        }}
                        className="input-field font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => fetchStudentData(clubFormData.vice_president_prn, 'vp')}
                        disabled={fetchingVicePresident || !clubFormData.vice_president_prn}
                        title="Fetch student info from DB"
                        className="px-2.5 py-1 text-xs font-bold bg-navy text-white rounded hover:bg-[#152347] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                      >
                        {fetchingVicePresident ? '...' : 'Fetch'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Vice President Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sanya Deshmukh"
                      value={clubFormData.vice_president_name}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, vice_president_name: e.target.value })
                      }
                      className="input-field text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="input-label flex items-center justify-between">
                      <span>Mobile No</span>
                      <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">FROM DB</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9822012346"
                      value={clubFormData.vice_president_phone}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, vice_president_phone: e.target.value })
                      }
                      className="input-field font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="input-label">Division / Class</label>
                    <input
                      type="text"
                      placeholder="TE-B / BE-A"
                      value={clubFormData.vice_president_division}
                      onChange={(e) =>
                        setClubFormData({ ...clubFormData, vice_president_division: e.target.value })
                      }
                      className="input-field text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Founded Year</label>
                  <input
                    type="text"
                    placeholder="2020"
                    value={clubFormData.founded_year}
                    onChange={(e) =>
                      setClubFormData({ ...clubFormData, founded_year: e.target.value })
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Status</label>
                  <select
                    value={clubFormData.status}
                    onChange={(e) => setClubFormData({ ...clubFormData, status: e.target.value })}
                    className="input-field"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Probation">Probation</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Portal / Social Link</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={clubFormData.website_or_link}
                    onChange={(e) =>
                      setClubFormData({ ...clubFormData, website_or_link: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-rule flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClubModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-5">
                  {editingClub ? 'Save Changes' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: PROPOSE / LOG EVENT ────────────────────────────────────── */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-rule rounded-sm shadow-xl max-w-2xl w-full my-8 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-rule">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">
                  {editingEvent ? 'Edit Club Activity' : 'Propose / Record Activity'}
                </h3>
                <p className="text-xs text-draft">
                  Workshops, expert sessions, bootcamps, and hackathons
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="text-draft hover:text-ink text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Organizing Unit *</label>
                  <select
                    required
                    value={eventFormData.club_id}
                    onChange={(e) => setEventFormData({ ...eventFormData, club_id: e.target.value })}
                    className="input-field font-semibold"
                  >
                    <option value="">-- Select Unit --</option>
                    {(isClubHead ? data.clubs : myAssignedClubs).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Event Type *</label>
                  <select
                    value={eventFormData.event_type}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, event_type: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="Workshop">Hands-on Workshop</option>
                    <option value="Hackathon">Hackathon / Ideathon</option>
                    <option value="Expert Lecture">Expert / Guest Lecture</option>
                    <option value="Coding Competition">Coding / Algo Contest</option>
                    <option value="Bootcamp">Multi-day Bootcamp</option>
                    <option value="Industrial Visit">Industrial Visit</option>
                    <option value="Orientation">Orientation / Showcase</option>
                    <option value="Other">Other Academic Event</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Activity Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masterclass on Containerization & Docker"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Date *</label>
                  <input
                    type="date"
                    required
                    value={eventFormData.start_date}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, start_date: e.target.value })
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Time</label>
                  <input
                    type="text"
                    placeholder="10:00 AM - 04:00 PM"
                    value={eventFormData.time}
                    onChange={(e) => setEventFormData({ ...eventFormData, time: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Mode</label>
                  <select
                    value={eventFormData.mode}
                    onChange={(e) => setEventFormData({ ...eventFormData, mode: e.target.value })}
                    className="input-field"
                  >
                    <option value="Offline">Offline (Campus)</option>
                    <option value="Online">Online (Virtual)</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Venue / Hall *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auditorium / Computer Lab 4"
                    value={eventFormData.venue}
                    onChange={(e) => setEventFormData({ ...eventFormData, venue: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="input-label">Speaker / Trainer / Guest</label>
                  <input
                    type="text"
                    placeholder="e.g. Mr. Rajesh Sharma (Lead Architect)"
                    value={eventFormData.speaker_or_trainer}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, speaker_or_trainer: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Proposed Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={eventFormData.proposed_budget}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, proposed_budget: e.target.value })
                    }
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="input-label">Approved Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={!isClubHead}
                    value={eventFormData.approved_budget}
                    onChange={(e) =>
                      setEventFormData({ ...eventFormData, approved_budget: e.target.value })
                    }
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="input-label">Expected Participants</label>
                  <input
                    type="number"
                    min="0"
                    value={eventFormData.expected_participants}
                    onChange={(e) =>
                      setEventFormData({
                        ...eventFormData,
                        expected_participants: e.target.value,
                      })
                    }
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Description &amp; Agenda</label>
                <textarea
                  rows={2}
                  placeholder="Event schedule, prerequisites, student target audience..."
                  value={eventFormData.description}
                  onChange={(e) =>
                    setEventFormData({ ...eventFormData, description: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              {isClubHead && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-paper rounded border border-rule">
                  <div>
                    <label className="input-label">Status Governance</label>
                    <select
                      value={eventFormData.status}
                      onChange={(e) =>
                        setEventFormData({ ...eventFormData, status: e.target.value })
                      }
                      className="input-field font-bold"
                    >
                      <option value="Approved">Approved</option>
                      <option value="Submitted">Submitted (Under Review)</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Coordinator Remarks</label>
                    <input
                      type="text"
                      placeholder="Remarks on lab setup, sanction..."
                      value={eventFormData.coordinator_remarks}
                      onChange={(e) =>
                        setEventFormData({
                          ...eventFormData,
                          coordinator_remarks: e.target.value,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-rule flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs py-2 px-5">
                  {editingEvent ? 'Save Activity' : 'Record Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CLUB DETAILS & COMMITTEE ROSTER DRAWER ─────────────────── */}
      {selectedClub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-rule rounded-sm shadow-xl max-w-3xl w-full my-8 p-6">
            <div className="flex items-start justify-between pb-4 border-b border-rule">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-navy border border-[#D5D9E8]">
                    {selectedClub.code}
                  </span>
                  <span className="badge badge-approved text-[10px]">{selectedClub.status}</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-ink">{selectedClub.name}</h3>
                <p className="text-xs text-draft mt-0.5">
                  Faculty In-Charge: {selectedClub.faculty_name || 'Unassigned'} · Category:{' '}
                  {selectedClub.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClub(null)}
                className="text-draft hover:text-ink text-2xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {/* Core Student Leadership Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-paper rounded border border-rule">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="badge bg-navy text-white text-[9px] px-1.5 py-0 font-bold">PRESIDENT</span>
                    {selectedClub.student_lead_division && (
                      <span className="text-[10px] font-mono text-draft">({selectedClub.student_lead_division})</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-ink">{selectedClub.student_lead_name || 'TBD'}</p>
                  <div className="text-[11px] font-mono text-draft mt-0.5 space-y-0.5">
                    {selectedClub.student_lead_prn && <div>PRN: <span className="text-ink font-semibold">{selectedClub.student_lead_prn}</span></div>}
                    {selectedClub.student_lead_phone && <div>Mobile: <a href={`tel:${selectedClub.student_lead_phone}`} className="text-navy hover:underline">{selectedClub.student_lead_phone}</a></div>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="badge bg-slate-700 text-white text-[9px] px-1.5 py-0 font-bold">VICE PRESIDENT</span>
                    {selectedClub.vice_president_division && (
                      <span className="text-[10px] font-mono text-draft">({selectedClub.vice_president_division})</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-ink">{selectedClub.vice_president_name || 'Not Designated'}</p>
                  <div className="text-[11px] font-mono text-draft mt-0.5 space-y-0.5">
                    {selectedClub.vice_president_prn && <div>PRN: <span className="text-ink font-semibold">{selectedClub.vice_president_prn}</span></div>}
                    {selectedClub.vice_president_phone && <div>Mobile: <a href={`tel:${selectedClub.vice_president_phone}`} className="text-navy hover:underline">{selectedClub.vice_president_phone}</a></div>}
                  </div>
                </div>
              </div>

              {/* Mission */}
              <div className="p-3 bg-paper rounded border border-rule text-xs text-draft">
                <span className="font-bold text-ink">Mission &amp; Scope: </span>
                {selectedClub.description || 'No description provided.'}
              </div>

              {/* Committee Members List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif text-sm font-bold text-ink uppercase tracking-wide">
                    Student Executive Committee &amp; Core Members (AY {academicYear})
                  </h4>
                  <span className="text-xs font-mono text-draft">
                    {clubMembers.length} Core Members
                  </span>
                </div>

                {membersLoading ? (
                  <div className="p-4 text-center text-xs text-draft">Loading core members...</div>
                ) : clubMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-draft border border-dashed border-rule rounded">
                    No student core committee members added yet for this academic year.
                  </div>
                ) : (
                  <div className="border border-rule rounded overflow-hidden">
                    <table className="result-table dense">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>PRN No</th>
                          <th>Class</th>
                          <th>Role / Designation</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clubMembers.map((m) => (
                          <tr key={m.id}>
                            <td className="font-bold text-ink">{m.student_name}</td>
                            <td className="font-mono text-xs text-draft">{m.prn || m.roll_no || '—'}</td>
                            <td className="text-xs">{m.division || m.class_year}</td>
                            <td>
                              <span className="badge badge-draft text-[10px]">{m.role}</span>
                            </td>
                            <td className="text-right">
                              {(isClubHead || Number(user?.faculty_id) === Number(selectedClub.faculty_coordinator_id)) && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(m.id)}
                                  className="text-xs text-fail hover:underline"
                                >
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Core Committee Member Form */}
              <div className="p-4 bg-paper rounded border border-rule">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-navy">
                    + Add Core Committee Member / Office Bearer
                  </h5>
                  <span className="text-[11px] text-draft">
                    Enter PRN / Roll No to auto-detect class &amp; student details
                  </span>
                </div>
                <form
                  onSubmit={handleAddMember}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-3">
                    <label className="input-label flex items-center justify-between">
                      <span>PRN No *</span>
                      {fetchingMemberPRN && (
                        <span className="text-[9px] text-navy font-bold animate-pulse">Detecting...</span>
                      )}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        placeholder="e.g. F23112050"
                        value={newMemberData.prn}
                        onChange={(e) => handleMemberPRNChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            lookupMemberByPRN(newMemberData.prn, true);
                          }
                        }}
                        className="input-field text-xs py-1.5 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => lookupMemberByPRN(newMemberData.prn, true)}
                        disabled={fetchingMemberPRN || !newMemberData.prn}
                        title="Click to detect student class and details"
                        className="px-3 py-1 text-xs font-bold bg-[#1B2A4E] text-white rounded hover:bg-[#152347] disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-sm"
                      >
                        {fetchingMemberPRN ? '...' : 'Detect'}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="input-label">Student Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rohan Joshi"
                      value={newMemberData.student_name}
                      onChange={(e) =>
                        setNewMemberData({ ...newMemberData, student_name: e.target.value })
                      }
                      className="input-field text-xs py-1.5 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="input-label flex items-center justify-between">
                      <span>Class *</span>
                      {newMemberData.division && (
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          AUTO
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TE-B"
                      value={newMemberData.division || ''}
                      onChange={(e) =>
                        setNewMemberData({ ...newMemberData, division: e.target.value })
                      }
                      className="input-field text-xs py-1.5 font-bold text-navy"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="input-label">Role</label>
                    <select
                      value={newMemberData.role}
                      onChange={(e) =>
                        setNewMemberData({ ...newMemberData, role: e.target.value })
                      }
                      className="input-field text-xs py-1.5"
                    >
                      <option value="President">President</option>
                      <option value="Vice President">Vice President</option>
                      <option value="Secretary">Secretary</option>
                      <option value="Treasurer">Treasurer</option>
                      <option value="Technical Head">Technical Head</option>
                      <option value="Event Lead">Event Lead</option>
                      <option value="PR & Social Lead">PR & Social Lead</option>
                      <option value="Core Member">Core Member</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button type="submit" className="btn-primary text-xs py-2 w-full justify-center">
                      Add
                    </button>
                  </div>
                </form>

                {memberAutoDetected && (
                  <div className="mt-2.5 text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                      <span>
                        Auto-detected Class: <strong className="font-mono text-emerald-950">{memberAutoDetected.class}</strong>
                        {memberAutoDetected.name && <> · Student: <strong>{memberAutoDetected.name}</strong></>}
                        {memberAutoDetected.rollNo && <span className="text-draft font-mono"> (Roll: {memberAutoDetected.rollNo})</span>}
                      </span>
                    </div>
                    {memberAutoDetected.name && newMemberData.student_name !== memberAutoDetected.name && (
                      <button
                        type="button"
                        onClick={() => setNewMemberData((prev) => ({ ...prev, student_name: memberAutoDetected.name }))}
                        className="text-[10px] text-navy font-bold hover:underline cursor-pointer"
                      >
                        Use Official Name ({memberAutoDetected.name})
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-rule flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedClub(null)}
                  className="btn-secondary text-xs py-2 px-5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
