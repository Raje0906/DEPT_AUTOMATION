import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axios';
import { parseClassAndDivision } from '../utils/toppersUtils';
import { DEMO_MAGAZINE_METADATA, DEMO_MAGAZINE_SECTION_DATA } from '../utils/demoMagazineData';

const MagazineContext = createContext(null);

// ── Sample magazine issues ────────────────────────────────────────────────────
const SAMPLE_MAGAZINES = [
  DEMO_MAGAZINE_METADATA,
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
    template: 'modern-academic',
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
    template: 'editorial',
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
    template: 'institutional-premium',
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
export const CLASS_OPTIONS = [
  'SE - Div A', 'SE - Div B', 'SE - Div C',
  'TE - Div A', 'TE - Div B', 'TE - Div C',
  'BE - Div A', 'BE - Div B', 'BE - Div C',
  'SE I', 'SE II', 'SE III',
  'TE I', 'TE II', 'TE III',
  'BE I', 'BE II', 'BE III'
];

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
      const { year, division } = parseClassAndDivision(s);
      const rawRank = s.rank !== undefined && s.rank !== null && s.rank !== ''
        ? s.rank
        : (s.position !== undefined && s.position !== null && s.position !== '' ? s.position : '');
      const parsedRank = rawRank !== '' ? parseInt(rawRank, 10) : '';

      cleanStudents.push({
        id,
        name: s.name || '',
        class: year,
        division,
        className: `${year} - Div ${division}`,
        cgpa: s.cgpa !== undefined && s.cgpa !== null ? String(s.cgpa) : '',
        position: parsedRank,
        rank: parsedRank,
        photo: s.photo || s.photoUrl || null,
        photoUrl: s.photo || s.photoUrl || null,
      });
    }
  });

  const classes = {};
  CLASS_OPTIONS.forEach(c => {
    classes[c] = cleanStudents.filter(s => {
      const formatted = `${s.class} - Div ${s.division}`;
      return s.className === c || s.class === c || formatted === c;
    });
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
      overlay: {
        type: 'none',
        color: '#000000',
        opacity: 0,
        gradientStart: '#1E2D5A',
        gradientEnd: '#0D1B2A',
      },
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee MAG-2026-33 is present as the published issue at the top
          const exists = parsed.some(m => m.id === DEMO_MAGAZINE_METADATA.id);
          if (!exists) {
            const updated = [DEMO_MAGAZINE_METADATA, ...parsed];
            localStorage.setItem(STORAGE_KEY_MAGAZINES, JSON.stringify(updated));
            return updated;
          }
          return parsed;
        }
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

  // Load magazines from database on mount, keeping localStorage as fast fallback
  useEffect(() => {
    let isMounted = true;
    async function loadFromDb() {
      try {
        const res = await api.get('/magazines');
        if (isMounted && res.data?.magazines && Array.isArray(res.data.magazines) && res.data.magazines.length > 0) {
          setMagazines(res.data.magazines);
          try {
            localStorage.setItem(STORAGE_KEY_MAGAZINES, JSON.stringify(res.data.magazines));
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        // Fall back gracefully to local storage
      }
    }
    loadFromDb();
    return () => { isMounted = false; };
  }, []);

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
    if (magId === DEMO_MAGAZINE_METADATA.id) {
      const demoData = JSON.parse(JSON.stringify(DEMO_MAGAZINE_SECTION_DATA));
      demoData.toppers = normalizeToppersData(demoData.toppers);
      return demoData;
    }
    return fallbackData || defaultSectionData();
  }, []);

  // Create a new magazine
  const createMagazine = useCallback((info) => {
    const id = `MAG-NEW-${Date.now()}`;
    const newMag = {
      id,
      ...info,
      template: info.template || 'modern-academic',
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

    // Sync created magazine with database
    api.post('/magazines', {
      id,
      title: info.title,
      issueNumber: info.issueNumber,
      academicYear: info.academicYear,
      department: info.department,
      template: info.template || 'modern-academic',
      status: 'Draft',
      sections: {},
      sectionData: initialData,
    }).catch(err => console.warn('[Magazine] DB create sync:', err.message));

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

      // Sync section to database
      api.put(`/magazines/${currentMagazine.id}/sections/${sectionId}`, cleanData)
        .catch(err => console.warn(`[Magazine] DB updateSection sync error for ${sectionId}:`, err.message));
    }
  }, [currentMagazine?.id, persistSectionData]);

  // Canonical helper: Add a student topper
  const addTopperStudent = useCallback((student) => {
    setSectionData(prev => {
      const currentToppers = normalizeToppersData(prev.toppers);
      const { year, division } = parseClassAndDivision(student);
      const rawRank = student.rank !== undefined && student.rank !== null && student.rank !== ''
        ? student.rank
        : (student.position !== undefined && student.position !== null && student.position !== '' ? student.position : '');
      const parsedRank = rawRank !== '' ? parseInt(rawRank, 10) : '';

      const newStudent = {
        id: student.id || `student-${Date.now()}`,
        name: student.name || '',
        class: year,
        division,
        className: `${year} - Div ${division}`,
        cgpa: String(student.cgpa || ''),
        position: parsedRank,
        rank: parsedRank,
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
          const merged = { ...s, ...updatedFields };
          const { year, division } = parseClassAndDivision(merged);
          const rawRank = merged.rank !== undefined && merged.rank !== null && merged.rank !== ''
            ? merged.rank
            : (merged.position !== undefined && merged.position !== null && merged.position !== '' ? merged.position : '');
          const parsedRank = rawRank !== '' ? parseInt(rawRank, 10) : '';

          return {
            ...merged,
            class: year,
            division,
            className: `${year} - Div ${division}`,
            position: parsedRank,
            rank: parsedRank,
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

      api.put(`/magazines/${currentMagazine.id}`, {
        sectionData,
        status: 'Draft'
      }).catch(err => console.warn('[Magazine] DB saveDraft sync error:', err.message));
    }
  }, [currentMagazine?.id, sectionData, persistSectionData, saveMagazinesList]);

  // Submit for approval
  const submitForApproval = useCallback(() => {
    setMagazineStatus('under_review');
    if (currentMagazine?.id) {
      persistSectionData(currentMagazine.id, sectionData);
      setMagazines(prev => {
        const updated = prev.map(m =>
          m.id === currentMagazine.id
            ? { ...m, status: 'Under Review', submittedAt: new Date().toISOString() }
            : m
        );
        saveMagazinesList(updated);
        return updated;
      });
      setCurrentMagazine(prev => prev ? { ...prev, status: 'Under Review' } : null);

      api.patch(`/magazines/${currentMagazine.id}/status`, {
        status: 'Under Review'
      }).catch(err => console.warn('[Magazine] DB submitForApproval sync error:', err.message));
    }
  }, [currentMagazine?.id, sectionData, persistSectionData, saveMagazinesList]);

  // Approve magazine (HOD)
  const approveMagazine = useCallback((magId) => {
    const targetId = magId || currentMagazine?.id;
    if (!targetId) return;
    setMagazines(prev => {
      const updated = prev.map(m =>
        m.id === targetId
          ? { ...m, status: 'Approved', approvedAt: new Date().toISOString(), reviewComment: null }
          : m
      );
      saveMagazinesList(updated);
      return updated;
    });
    if (currentMagazine?.id === targetId) {
      setMagazineStatus('approved');
      setCurrentMagazine(prev => prev ? { ...prev, status: 'Approved', reviewComment: null } : null);
    }

    api.patch(`/magazines/${targetId}/status`, {
      status: 'Approved'
    }).catch(err => console.warn('[Magazine] DB approve sync error:', err.message));
  }, [currentMagazine?.id, saveMagazinesList]);

  // Publish magazine (HOD / Faculty)
  const publishMagazine = useCallback((magId) => {
    const targetId = magId || currentMagazine?.id;
    if (!targetId) return;
    const nowStr = new Date().toISOString().split('T')[0];
    setMagazines(prev => {
      const updated = prev.map(m =>
        m.id === targetId
          ? { ...m, status: 'Published', publishedDate: nowStr }
          : m
      );
      saveMagazinesList(updated);
      return updated;
    });
    if (currentMagazine?.id === targetId) {
      setMagazineStatus('published');
      setCurrentMagazine(prev => prev ? { ...prev, status: 'Published', publishedDate: nowStr } : null);
    }

    api.patch(`/magazines/${targetId}/status`, {
      status: 'Published'
    }).catch(err => console.warn('[Magazine] DB publish sync error:', err.message));
  }, [currentMagazine?.id, saveMagazinesList]);

  // Request changes / Reject (HOD)
  const requestChangesMagazine = useCallback((magId, comment) => {
    const targetId = magId || currentMagazine?.id;
    if (!targetId) return;
    setMagazines(prev => {
      const updated = prev.map(m =>
        m.id === targetId
          ? { ...m, status: 'Draft', reviewComment: comment || 'Please make updates and resubmit.' }
          : m
      );
      saveMagazinesList(updated);
      return updated;
    });
    if (currentMagazine?.id === targetId) {
      setMagazineStatus('draft');
      setCurrentMagazine(prev => prev ? { ...prev, status: 'Draft', reviewComment: comment } : null);
    }
    api.patch(`/magazines/${targetId}/status`, {
      status: 'Draft',
      reviewComment: comment
    }).catch(err => console.warn('[Magazine] DB requestChanges sync error:', err.message));
  }, [currentMagazine?.id, saveMagazinesList]);

  // Update magazine design template (presentation only, content untouched)
  const updateMagazineTemplate = useCallback((templateId, magId) => {
    const targetId = magId || currentMagazine?.id;
    if (!targetId) return;
    setMagazines(prev => {
      const updated = prev.map(m => m.id === targetId ? { ...m, template: templateId } : m);
      saveMagazinesList(updated);
      return updated;
    });
    if (currentMagazine?.id === targetId) {
      setCurrentMagazine(prev => prev ? { ...prev, template: templateId } : null);
    }

    api.put(`/magazines/${targetId}`, {
      template: templateId
    }).catch(err => console.warn('[Magazine] DB template sync error:', err.message));
  }, [currentMagazine?.id, saveMagazinesList]);

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
        template: 'modern-academic',
        sections: {},
      };
      setMagazines(prev => [mag, ...prev]);
    }

    if (mag) {
      if (!mag.template) {
        mag = { ...mag, template: 'modern-academic' };
      }
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

    // Also fetch from API in background to ensure database-level consistency
    if (id) {
      api.get(`/magazines/${id}`)
        .then(res => {
          const dbMag = res.data?.magazine;
          if (dbMag) {
            setCurrentMagazine(prev => ({ ...(prev || {}), ...dbMag }));
            if (dbMag.sectionData && Object.keys(dbMag.sectionData).length > 0) {
              const normalizedData = {
                ...dbMag.sectionData,
                toppers: normalizeToppersData(dbMag.sectionData.toppers)
              };
              setSectionData(normalizedData);
              persistSectionData(dbMag.id, normalizedData);
            }
            if (dbMag.sections) {
              setSectionStatus(
                Object.fromEntries(
                  Object.entries(dbMag.sections || {}).map(([k, v]) => [k, v.completed ? 'completed' : 'pending'])
                )
              );
            }
            if (dbMag.status) {
              setMagazineStatus(dbMag.status.toLowerCase().replace(' ', '_'));
            }
          }
        })
        .catch(err => {
          // Fall back gracefully to local state
        });
    }
  }, [magazines, getPersistedSectionData, persistSectionData]);

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
      approveMagazine,
      publishMagazine,
      requestChangesMagazine,
      loadMagazine,
      setCurrentMagazine,
      updateMagazineTemplate,
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
