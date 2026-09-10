import React, { createContext, useContext, useState, useCallback } from 'react';

const MagazineContext = createContext(null);

// ── Sample magazine issues ────────────────────────────────────────────────────
const SAMPLE_MAGAZINES = [
  {
    id: 'MAG-2025-32',
    title: 'Reflection',
    issueNumber: 32,
    academicYear: '2025–26',
    semester: 'Annual',
    department: 'Computer Engineering',
    period: 'June – December 2025',
    description: 'The annual departmental magazine capturing student achievements, academic milestones, and departmental events of the first half of academic year 2025–26.',
    status: 'Published',
    publishedDate: '2026-01-15',
    coverColor: '#1E2D5A',
    totalPages: 20,
    tagline: 'Knowledge grows when it is shared with others',
    sections: {
      cover: { completed: true },
      message: { completed: true },
      toppers: { completed: true },
      events: { completed: true },
      workshops: { completed: true },
      lectures: { completed: true },
      achievements: { completed: true },
      coe: { completed: true },
      staffAchievements: { completed: true },
      fdpSttp: { completed: true },
      publications: { completed: true },
    },
  },
  {
    id: 'MAG-2024-31',
    title: 'Reflection',
    issueNumber: 31,
    academicYear: '2024–25',
    semester: 'Annual',
    department: 'Computer Engineering',
    period: 'January – May 2025',
    description: 'Departmental magazine for the second semester of academic year 2024–25.',
    status: 'Published',
    publishedDate: '2025-06-10',
    coverColor: '#6B2737',
    totalPages: 18,
    tagline: 'Excellence in Engineering, Innovation in Thought',
    sections: {
      cover: { completed: true },
      message: { completed: true },
      toppers: { completed: true },
      events: { completed: true },
      workshops: { completed: true },
      lectures: { completed: true },
      achievements: { completed: true },
      coe: { completed: true },
      staffAchievements: { completed: true },
      fdpSttp: { completed: true },
      publications: { completed: true },
    },
  },
  {
    id: 'MAG-2024-30',
    title: 'Reflection',
    issueNumber: 30,
    academicYear: '2024–25',
    semester: 'Semester I',
    department: 'Computer Engineering',
    period: 'June – December 2024',
    description: 'First-semester edition covering departmental achievements and academic highlights.',
    status: 'Archived',
    publishedDate: '2025-01-20',
    coverColor: '#3B6B47',
    totalPages: 16,
    tagline: '',
    sections: {
      cover: { completed: true },
      message: { completed: true },
      toppers: { completed: true },
      events: { completed: true },
      workshops: { completed: true },
      lectures: { completed: true },
      achievements: { completed: true },
      coe: { completed: true },
      staffAchievements: { completed: true },
      fdpSttp: { completed: true },
      publications: { completed: true },
    },
  },
];

// ── Default section data for a new magazine ───────────────────────────────────
// ── Default section data for a new magazine ───────────────────────────────────
export const CLASS_OPTIONS = ['SE I', 'SE II', 'SE III', 'TE I', 'TE II', 'TE III', 'BE I', 'BE II', 'BE III'];

export function normalizeToppersData(toppersInput) {
  if (!toppersInput) {
    const emptyClasses = {};
    CLASS_OPTIONS.forEach(c => { emptyClasses[c] = []; });
    return { students: [], classes: emptyClasses };
  }

  let rawStudents = [];
  if (Array.isArray(toppersInput.students)) {
    rawStudents = [...toppersInput.students];
  } else if (toppersInput.classes && typeof toppersInput.classes === 'object') {
    Object.entries(toppersInput.classes).forEach(([cls, list]) => {
      if (Array.isArray(list)) {
        list.forEach(item => {
          rawStudents.push({
            ...item,
            class: item.class || cls,
            className: item.className || item.class || cls,
          });
        });
      }
    });
  }

  const cleanStudents = [];
  const seenIds = new Set();
  rawStudents.forEach((s, idx) => {
    if (!s) return;
    const id = s.id || `student-${idx + 1}-${Date.now()}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const cls = s.className || s.class || 'SE I';
      cleanStudents.push({
        id,
        name: s.name || '',
        class: cls,
        className: cls,
        cgpa: s.cgpa !== undefined && s.cgpa !== null ? String(s.cgpa) : '',
        position: s.position !== undefined && s.position !== null ? Number(s.position) || s.position : '',
        photo: s.photo || s.photoUrl || null,
        photoUrl: s.photo || s.photoUrl || null,
      });
    }
  });

  const classes = {};
  CLASS_OPTIONS.forEach(c => {
    classes[c] = cleanStudents.filter(s => (s.className || s.class) === c);
  });

  return {
    students: cleanStudents,
    classes,
  };
}

const defaultSectionData = () => {
  const emptyClasses = {};
  CLASS_OPTIONS.forEach(c => { emptyClasses[c] = []; });
  return {
    cover: {
      title: 'Reflection',
      issueNumber: '',
      academicYear: '',
      department: 'Computer Engineering',
      tagline: 'Knowledge grows when it is shared with others',
      collegeLogo: null,
      coverImage: null,
    },
    message: {
      principal: {
        name: 'Dr. S. V. Kulkarni',
        designation: 'Principal, MES Wadia College of Engineering',
        photo: null,
        message: '',
      },
      hod: {
        name: 'Dr. A. B. Patil',
        designation: 'Head of Department, Computer Engineering',
        photo: null,
        message: '',
      },
    },
    toppers: {
      students: [],
      classes: emptyClasses,
    },
    events: [],
    workshops: [],
    lectures: [],
    achievements: [],
    coe: {
      name: 'Centre of Excellence in AI & Cloud Computing',
      dateEstablished: '2022-08-15',
      partner: 'IBM India Pvt. Ltd.',
      tagline: 'Empowering tomorrow\'s engineers with industry-ready skills',
      description: '',
      activities: '',
      achievements: '',
      photos: [],
    },
    staffAchievements: [],
    fdpSttp: [],
    publications: [],
  };
};

// ── Ordered sections definition ───────────────────────────────────────────────
export const MAGAZINE_SECTIONS = [
  { id: 'cover',            label: 'Cover' },
  { id: 'message',          label: 'Principal / HOD Message' },
  { id: 'toppers',          label: 'Class Toppers' },
  { id: 'events',           label: 'Department Events' },
  { id: 'workshops',        label: 'Student Workshops' },
  { id: 'lectures',         label: 'Guest Lectures' },
  { id: 'achievements',     label: 'Student Achievements' },
  { id: 'coe',              label: 'Centre of Excellence' },
  { id: 'staffAchievements',label: 'Staff Achievements' },
  { id: 'fdpSttp',          label: 'FDP / STTP' },
  { id: 'publications',     label: 'Publications' },
];

const STORAGE_KEY_MAGAZINES = 'dept_automation_magazines_v2';
const STORAGE_KEY_DATA_PREFIX = 'dept_automation_mag_data_v2_';

export function MagazineProvider({ children }) {
  const [magazines, setMagazines] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MAGAZINES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read saved magazines from localStorage:', e);
    }
    return SAMPLE_MAGAZINES;
  });

  const [currentMagazine, setCurrentMagazine] = useState(null);
  const [sectionData, setSectionData]         = useState(defaultSectionData());
  const [sectionStatus, setSectionStatus]     = useState({});
  const [activeSection, setActiveSection]     = useState('cover');
  const [magazineStatus, setMagazineStatus]   = useState('draft');

  // Persist magazines list changes
  const saveMagazinesList = useCallback((updatedList) => {
    setMagazines(updatedList);
    try {
      localStorage.setItem(STORAGE_KEY_MAGAZINES, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Could not save magazines list to localStorage:', e);
    }
  }, []);

  // Save specific magazine's sectionData to localStorage
  const persistSectionData = useCallback((magId, data) => {
    if (!magId) return;
    try {
      localStorage.setItem(STORAGE_KEY_DATA_PREFIX + magId, JSON.stringify(data));
    } catch (e) {
      console.warn(`Could not persist sectionData for ${magId}:`, e);
    }
  }, []);

  // Load sectionData from localStorage or fallback
  const getPersistedSectionData = useCallback((magId, fallbackData) => {
    if (!magId) return fallbackData || defaultSectionData();
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DATA_PREFIX + magId);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.toppers) {
          parsed.toppers = normalizeToppersData(parsed.toppers);
        }
        return parsed;
      }
    } catch (e) {
      console.warn(`Could not load sectionData for ${magId}:`, e);
    }
    return fallbackData || defaultSectionData();
  }, []);

  // Create a new magazine
  const createMagazine = useCallback((info) => {
    const id = `MAG-NEW-${Date.now()}`;
    const newMag = {
      id,
      ...info,
      status: 'Draft',
      publishedDate: null,
      coverColor: '#1E2D5A',
      totalPages: 0,
      sections: {},
    };
    const updatedMagazines = [newMag, ...magazines];
    saveMagazinesList(updatedMagazines);
    setCurrentMagazine(newMag);

    const initialData = {
      ...defaultSectionData(),
      cover: {
        ...defaultSectionData().cover,
        title: info.title,
        issueNumber: info.issueNumber,
        academicYear: info.academicYear,
        department: info.department,
      },
    };
    setSectionData(initialData);
    persistSectionData(id, initialData);

    setSectionStatus({});
    setActiveSection('cover');
    setMagazineStatus('draft');
    return id;
  }, [magazines, saveMagazinesList, persistSectionData]);

  // Update section content
  const updateSection = useCallback((sectionId, data) => {
    let cleanData = data;
    if (sectionId === 'toppers') {
      cleanData = normalizeToppersData(data);
    }

    setSectionData(prev => {
      const updated = { ...prev, [sectionId]: cleanData };
      if (currentMagazine?.id) {
        persistSectionData(currentMagazine.id, updated);
      }
      return updated;
    });

    if (currentMagazine?.id) {
      setMagazines(prev => {
        const updated = prev.map(m => {
          if (m.id === currentMagazine.id) {
            return {
              ...m,
              sections: {
                ...m.sections,
                [sectionId]: { completed: true },
              },
            };
          }
          return m;
        });
        try {
          localStorage.setItem(STORAGE_KEY_MAGAZINES, JSON.stringify(updated));
        } catch (e) {
          // ignore
        }
        return updated;
      });
    }
  }, [currentMagazine?.id, persistSectionData]);

  // Canonical helper: Add a student topper
  const addTopperStudent = useCallback((student) => {
    setSectionData(prev => {
      const currentToppers = normalizeToppersData(prev.toppers);
      const newStudent = {
        id: student.id || `student-${Date.now()}`,
        name: student.name || '',
        class: student.className || student.class || 'SE I',
        className: student.className || student.class || 'SE I',
        cgpa: String(student.cgpa || ''),
        position: student.position !== undefined ? Number(student.position) || student.position : '',
        photo: student.photo || student.photoUrl || null,
        photoUrl: student.photo || student.photoUrl || null,
      };
      const updatedToppers = normalizeToppersData({
        students: [...currentToppers.students, newStudent],
      });
      const updated = { ...prev, toppers: updatedToppers };
      if (currentMagazine?.id) {
        persistSectionData(currentMagazine.id, updated);
      }
      return updated;
    });
    setSectionStatus(prev => ({ ...prev, toppers: 'completed' }));
  }, [currentMagazine?.id, persistSectionData]);

  // Canonical helper: Update an existing student topper
  const updateTopperStudent = useCallback((studentId, updatedFields) => {
    setSectionData(prev => {
      const currentToppers = normalizeToppersData(prev.toppers);
      const updatedStudents = currentToppers.students.map(s => {
        if (s.id === studentId) {
          const cls = updatedFields.className || updatedFields.class || s.className || s.class;
          return {
            ...s,
            ...updatedFields,
            class: cls,
            className: cls,
            photo: updatedFields.photo !== undefined ? updatedFields.photo : s.photo,
            photoUrl: updatedFields.photo !== undefined ? updatedFields.photo : s.photoUrl,
          };
        }
        return s;
      });
      const updatedToppers = normalizeToppersData({ students: updatedStudents });
      const updated = { ...prev, toppers: updatedToppers };
      if (currentMagazine?.id) {
        persistSectionData(currentMagazine.id, updated);
      }
      return updated;
    });
  }, [currentMagazine?.id, persistSectionData]);

  // Canonical helper: Delete a student topper
  const deleteTopperStudent = useCallback((studentId) => {
    setSectionData(prev => {
      const currentToppers = normalizeToppersData(prev.toppers);
      const updatedStudents = currentToppers.students.filter(s => s.id !== studentId);
      const updatedToppers = normalizeToppersData({ students: updatedStudents });
      const updated = { ...prev, toppers: updatedToppers };
      if (currentMagazine?.id) {
        persistSectionData(currentMagazine.id, updated);
      }
      return updated;
    });
  }, [currentMagazine?.id, persistSectionData]);

  // Mark section as completed
  const completeSection = useCallback((sectionId) => {
    setSectionStatus(prev => ({ ...prev, [sectionId]: 'completed' }));
  }, []);

  // Save draft
  const saveDraft = useCallback(() => {
    setMagazineStatus('draft');
    if (currentMagazine?.id) {
      persistSectionData(currentMagazine.id, sectionData);
      setMagazines(prev => {
        const updated = prev.map(m => m.id === currentMagazine.id ? { ...m, status: 'Draft' } : m);
        saveMagazinesList(updated);
        return updated;
      });
    }
  }, [currentMagazine?.id, sectionData, persistSectionData, saveMagazinesList]);

  // Submit for approval
  const submitForApproval = useCallback(() => {
    setMagazineStatus('under_review');
    if (currentMagazine?.id) {
      persistSectionData(currentMagazine.id, sectionData);
      const updated = magazines.map(m =>
        m.id === currentMagazine.id ? { ...m, status: 'Under Review' } : m
      );
      saveMagazinesList(updated);
    }
  }, [currentMagazine?.id, magazines, sectionData, persistSectionData, saveMagazinesList]);

  // Load an existing magazine for editing/preview
  const loadMagazine = useCallback((id) => {
    let mag = magazines.find(m => m.id === id);
    if (!mag && id && id.startsWith('MAG-')) {
      // If it's a new ID created in URL or session
      mag = {
        id,
        title: 'Reflection',
        issueNumber: 32,
        academicYear: '2025–26',
        semester: 'Annual',
        department: 'Computer Engineering',
        period: 'June – December 2025',
        status: 'Draft',
        sections: {},
      };
      setMagazines(prev => [mag, ...prev]);
    }

    if (mag) {
      setCurrentMagazine(mag);
      const loadedData = getPersistedSectionData(mag.id, mag.sectionData || defaultSectionData());
      setSectionData(loadedData);
      setSectionStatus(
        Object.fromEntries(
          Object.entries(mag.sections || {}).map(([k, v]) => [k, v.completed ? 'completed' : 'pending'])
        )
      );
      setMagazineStatus((mag.status || 'draft').toLowerCase().replace(' ', '_'));
    }
  }, [magazines, getPersistedSectionData]);

  const completedCount = MAGAZINE_SECTIONS.filter(s => sectionStatus[s.id] === 'completed').length;

  return (
    <MagazineContext.Provider value={{
      magazines,
      currentMagazine,
      sectionData,
      sectionStatus,
      activeSection,
      magazineStatus,
      completedCount,
      setActiveSection,
      createMagazine,
      updateSection,
      completeSection,
      saveDraft,
      submitForApproval,
      loadMagazine,
      setCurrentMagazine,
      addTopperStudent,
      updateTopperStudent,
      deleteTopperStudent,
    }}>
      {children}
    </MagazineContext.Provider>
  );
}

export function useMagazine() {
  const ctx = useContext(MagazineContext);
  if (!ctx) throw new Error('useMagazine must be used inside MagazineProvider');
  return ctx;
}
