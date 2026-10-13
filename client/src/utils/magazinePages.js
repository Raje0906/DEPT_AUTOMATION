import { normalizeToppersData, groupToppersByClassAndDivision, formatClassLabel } from './toppersUtils.js';

/**
 * Generates the complete magazine pages manifest from magazine metadata and section data.
 * Single source of truth for MagazinePreview, OnlineMagazineViewer, and PDF generation.
 */
export function generateMagazinePages(currentMagazine, sectionData) {
  const data = sectionData || {};
  const pages = [];
  let pageCounter = 1;

  // 1. Cover Page
  pages.push({
    id: pageCounter++,
    template: 'cover',
    title: 'Cover Page',
    data: {
      title: data.cover?.title || currentMagazine?.title || 'Reflection',
      issueNumber: data.cover?.issueNumber || currentMagazine?.issueNumber || 33,
      tagline: data.cover?.tagline || currentMagazine?.tagline || 'Connecting Ideas, Innovation and Impact',
      period: data.cover?.period || currentMagazine?.period || 'June – December 2026',
      academicYear: data.cover?.academicYear || currentMagazine?.academicYear || '2026–27',
      department: data.cover?.department || currentMagazine?.department || 'Department of Computer Engineering',
      collegeLogo: data.cover?.collegeLogo || '/images/college-logo.jpg',
      coverImage: data.cover?.coverImage || currentMagazine?.coverImage || '/images/reflection-cover-issue33.jpg',
      coverOverlay: data.cover?.overlay || { type: 'none', color: '#000000', opacity: 0 },
    },
  });

  // 2. Head of Department's Message (Always prominent)
  const hod = data.message?.hod;
  if (hod?.message || hod?.name) {
    pages.push({
      id: pageCounter++,
      template: 'article',
      title: "HOD's Message",
      data: {
        section: "Head of Department's Message",
        title: "From the Desk of the Head of Department",
        author: hod?.name || "Dr. Neha Sharma",
        designation: hod?.designation || "Head of Department, Department of Computer Engineering",
        image: hod?.photo || '/images/hod-neha-sharma.jpg',
        paragraphs: typeof hod?.message === 'string'
          ? hod.message.split('\n\n').filter(Boolean)
          : [
              "It is with immense pride and joy that I present Issue 33 of 'Reflection', the flagship publication of the Department of Computer Engineering.",
              "Our department continues to pioneer excellence in computing education, research, and industry-oriented innovation.",
            ],
      },
    });
  }

  // 3. Principal's Message
  const principal = data.message?.principal;
  if (principal?.message || principal?.name) {
    pages.push({
      id: pageCounter++,
      template: 'article',
      title: "Principal's Message",
      data: {
        section: "Principal's Message",
        title: "From the Desk of the Principal",
        author: principal?.name || "Dr. S. V. Kulkarni",
        designation: principal?.designation || "Principal, MES Wadia College of Engineering",
        image: principal?.photo || '/images/college-emblem.jpg',
        paragraphs: typeof principal?.message === 'string'
          ? principal.message.split('\n\n').filter(Boolean)
          : [
              "I extend my warmest greetings to the faculty, staff, and students of the Department of Computer Engineering on the publication of Reflection.",
              "This living record mirrors our shared pursuit of academic distinction and technological leadership.",
            ],
      },
    });
  }

  // 4. Class Toppers (SE, TE, BE)
  const toppersData = normalizeToppersData(data.toppers);
  const allStudents = toppersData.students || [];
  const groupedByClassAndDiv = groupToppersByClassAndDivision(allStudents);

  function createClassTopperPageData(year) {
    const classDivs = groupedByClassAndDiv[year] || {};
    const divNames = Object.keys(classDivs).sort();

    const divisions = divNames.length > 0
      ? divNames.map(name => ({
          name,
          division: name.replace(/^Division\s*/i, ''),
          students: classDivs[name], // already sorted by sortToppers
        }))
      : [];

    const totalStudents = divisions.reduce((sum, d) => sum + d.students.length, 0);

    return {
      title: 'Class Toppers',
      classYear: year,
      classLabel: formatClassLabel(year),
      divisions,
      totalStudents,
      toppers: divisions.flatMap(d => d.students),
    };
  }

  const seData = createClassTopperPageData('SE');
  const teData = createClassTopperPageData('TE');
  const beData = createClassTopperPageData('BE');

  pages.push({
    id: pageCounter++,
    template: 'toppers',
    title: 'Class Toppers — SE',
    data: seData,
  });

  pages.push({
    id: pageCounter++,
    template: 'toppers',
    title: 'Class Toppers — TE',
    data: teData,
  });

  pages.push({
    id: pageCounter++,
    template: 'toppers',
    title: 'Class Toppers — BE',
    data: beData,
  });

  // 5. Department Events (Multi-page display + photo gallery)
  const eventsList = data.events || [];
  if (eventsList.length > 0) {
    if (eventsList.length <= 3) {
      pages.push({
        id: pageCounter++,
        template: 'events',
        title: 'Department Events — Highlights',
        data: {
          title: 'Department Technical & Academic Events',
          subtitle: 'Fostering Innovation, Collaboration & Student Leadership',
          events: eventsList,
        },
      });
    } else {
      const splitIdx = Math.ceil(eventsList.length / 2);
      const evChunk1 = eventsList.slice(0, splitIdx);
      const evChunk2 = eventsList.slice(splitIdx);

      pages.push({
        id: pageCounter++,
        template: 'events',
        title: 'Department Events — Highlights',
        data: {
          title: 'Department Technical & Academic Events',
          subtitle: 'Fostering Innovation, Collaboration & Student Leadership',
          events: evChunk1,
        },
      });

      pages.push({
        id: pageCounter++,
        template: 'events',
        title: 'Department Events — Conclaves & Showcase',
        data: {
          title: 'Industry Connect & Annual Celebrations',
          subtitle: 'Bridging Academia with Industry Leadership',
          events: evChunk2,
        },
      });
    }

    // Events Photo Gallery (2-column balanced grid, max 4 photos per page)
    const allPhotos = eventsList.flatMap(e =>
      (e.photos || []).map(p => ({
        url: typeof p === 'string' ? p : p?.url || '',
        caption: (typeof p === 'object' && p?.caption) ? p.caption : (e.title || 'Campus Event Moment'),
        eventTitle: e.title || '',
        date: e.date || '',
        venue: e.venue || '',
      }))
    ).filter(p => !!p.url);

    if (allPhotos.length > 0) {
      const photosPerPage = 4;
      const totalPhotoPages = Math.ceil(allPhotos.length / photosPerPage);
      for (let pIdx = 0; pIdx < totalPhotoPages; pIdx++) {
        const photoSlice = allPhotos.slice(pIdx * photosPerPage, (pIdx + 1) * photosPerPage);
        pages.push({
          id: pageCounter++,
          template: 'photoGrid',
          title: totalPhotoPages > 1
            ? `Events & Campus Life Gallery (Part ${pIdx + 1})`
            : 'Events & Campus Life Gallery',
          data: {
            title: 'Campus Life & Event Moments',
            subtitle: totalPhotoPages > 1
              ? `Highlights & Campus Moments · Part ${pIdx + 1} of ${totalPhotoPages}`
              : 'Highlights & Campus Moments',
            part: pIdx + 1,
            totalParts: totalPhotoPages,
            photos: photoSlice,
          },
        });
      }
    }
  }

  // 6. Student Workshops (Multi-page display with balanced pagination)
  const workshopsList = data.workshops || [];
  if (workshopsList.length > 0) {
    if (workshopsList.length <= 3) {
      pages.push({
        id: pageCounter++,
        template: 'workshops',
        title: 'Student Workshops',
        data: {
          title: 'Hands-on Technical Workshops',
          subtitle: 'Skill Enhancement & Emerging Technology Bootcamps',
          workshops: workshopsList,
        },
      });
    } else {
      const splitIdx = Math.ceil(workshopsList.length / 2);
      const wsChunk1 = workshopsList.slice(0, splitIdx);
      const wsChunk2 = workshopsList.slice(splitIdx);

      pages.push({
        id: pageCounter++,
        template: 'workshops',
        title: 'Student Workshops — Advanced Computing',
        data: {
          title: 'Hands-on Technical Workshops',
          subtitle: 'Skill Enhancement & Emerging Technology Bootcamps',
          workshops: wsChunk1,
        },
      });

      pages.push({
        id: pageCounter++,
        template: 'workshops',
        title: 'Student Workshops — Systems & Security',
        data: {
          title: 'Software Systems & Cybersecurity Workshops',
          subtitle: 'Industry-Grade Toolchains & Practical Labs',
          workshops: wsChunk2,
        },
      });
    }
  }

  // 7. Guest Lectures (Multi-page display with balanced pagination)
  const lecturesList = data.lectures || [];
  if (lecturesList.length > 0) {
    if (lecturesList.length <= 3) {
      pages.push({
        id: pageCounter++,
        template: 'lectures',
        title: 'Guest Lectures',
        data: {
          title: 'Distinguished Guest Lectures',
          subtitle: 'Insights from Global Technology Leaders & Researchers',
          lectures: lecturesList,
        },
      });
    } else {
      const splitIdx = Math.ceil(lecturesList.length / 2);
      const lecChunk1 = lecturesList.slice(0, splitIdx);
      const lecChunk2 = lecturesList.slice(splitIdx);

      pages.push({
        id: pageCounter++,
        template: 'lectures',
        title: 'Guest Lectures — Industry Insights',
        data: {
          title: 'Distinguished Guest Lectures',
          subtitle: 'Insights from Global Technology Leaders & Researchers',
          lectures: lecChunk1,
        },
      });

      pages.push({
        id: pageCounter++,
        template: 'lectures',
        title: 'Guest Lectures — Scale & Entrepreneurship',
        data: {
          title: 'Architecture & Startup Keynotes',
          subtitle: 'Transforming Academic Prototypes into Enterprise Products',
          lectures: lecChunk2,
        },
      });
    }
  }

  // 8. Student Achievements (Multi-page display with clean pagination)
  const achievementsList = data.achievements || [];
  if (achievementsList.length > 0) {
    if (achievementsList.length <= 6) {
      pages.push({
        id: pageCounter++,
        template: 'achievements',
        title: 'Student Achievements',
        data: {
          title: 'Student Honors & Hackathon Victories',
          subtitle: 'Recognizing Distinction at National & International Arenas',
          achievements: achievementsList,
        },
      });
    } else {
      const splitIdx = Math.min(6, Math.ceil(achievementsList.length / 2));
      const achChunk1 = achievementsList.slice(0, splitIdx);
      const achChunk2 = achievementsList.slice(splitIdx, splitIdx + 6);
      pages.push({
        id: pageCounter++,
        template: 'achievements',
        title: 'Student Achievements — National Triumphs',
        data: {
          title: 'Student Honors & Hackathon Victories',
          subtitle: 'Recognizing Distinction at National & International Arenas',
          achievements: achChunk1,
        },
      });
      pages.push({
        id: pageCounter++,
        template: 'achievements',
        title: 'Student Achievements — Research & Patents',
        data: {
          title: 'Patents, Certifications & Technical Laurels',
          subtitle: 'Demonstrating Engineering Excellence & Research Rigor',
          achievements: achChunk2,
        },
      });
    }
  }

  // 9. Centre of Excellence (2 Feature Pages)
  const coe = data.coe;
  if (coe && (coe.name || coe.description)) {
    // CoE Page 1: Vision, Mission & Infrastructure
    pages.push({
      id: pageCounter++,
      template: 'coe',
      title: 'Centre of Excellence — Overview',
      data: {
        title: coe.name || 'Centre of Excellence',
        subtitle: 'Advanced Computing & Simulation Research Facility',
        part: 1,
        coe,
      },
    });

    // CoE Page 2: Activities, Student Projects & Gallery
    pages.push({
      id: pageCounter++,
      template: 'coe',
      title: 'Centre of Excellence — Activities & Innovation',
      data: {
        title: 'CoE Activities, Research & Student Projects',
        subtitle: 'Applied Spatial Computing, VR Simulations & Student Capstones',
        part: 2,
        coe,
      },
    });
  }

  // 10. Staff Achievements (Balanced display without underfilled pages)
  const staffList = data.staffAchievements || [];
  if (staffList.length > 0) {
    if (staffList.length <= 5) {
      pages.push({
        id: pageCounter++,
        template: 'staff',
        title: 'Faculty Achievements',
        data: {
          title: 'Faculty Excellence & Academic Distinction',
          subtitle: 'Recognizing Patents, Doctoral Concurrences & Professional Honors',
          staff: staffList,
        },
      });
    } else {
      const splitIdx = Math.min(5, Math.ceil(staffList.length / 2));
      const staffChunk1 = staffList.slice(0, splitIdx);
      const staffChunk2 = staffList.slice(splitIdx, splitIdx + 5);
      pages.push({
        id: pageCounter++,
        template: 'staff',
        title: 'Faculty Achievements — Research & Patents',
        data: {
          title: 'Faculty Excellence & Academic Distinction',
          subtitle: 'Recognizing Patents, Doctoral Concurrences & Professional Honors',
          staff: staffChunk1,
        },
      });
      pages.push({
        id: pageCounter++,
        template: 'staff',
        title: 'Faculty Achievements — Grants & Keynotes',
        data: {
          title: 'Research Grants, Textbooks & Keynotes',
          subtitle: 'Advancing Frontiers of Computer Science & Engineering',
          staff: staffChunk2,
        },
      });
    }
  }

  // 11. FDP / STTP (Full page tables without half-empty void)
  const fdpList = data.fdpSttp || [];
  if (fdpList.length > 0) {
    const mapRow = (r, idx) => [
      idx + 1,
      r.facultyName || '—',
      r.activity || '—',
      r.organization || '—',
      r.duration ? `${r.duration} (${r.startDate} to ${r.endDate})` : `${r.startDate} to ${r.endDate}`,
      r.mode || 'Online',
    ];

    if (fdpList.length <= 8) {
      pages.push({
        id: pageCounter++,
        template: 'table',
        title: 'FDP / STTP Records',
        data: {
          title: 'Faculty Development Programmes & STTPs',
          columns: ['Sr.', 'Faculty Name', 'Programme Title', 'Organizing Body', 'Period / Duration', 'Mode'],
          rows: fdpList.map((r, i) => mapRow(r, i)),
        },
      });
    } else {
      const splitIdx = Math.min(8, Math.ceil(fdpList.length / 2));
      const fdpRows1 = fdpList.slice(0, splitIdx).map((r, i) => mapRow(r, i));
      const fdpRows2 = fdpList.slice(splitIdx, splitIdx + 8).map((r, i) => mapRow(r, i + splitIdx));
      pages.push({
        id: pageCounter++,
        template: 'table',
        title: 'FDP / STTP Records — Part I',
        data: {
          title: 'Faculty Development Programmes & STTPs (Part I)',
          columns: ['Sr.', 'Faculty Name', 'Programme Title', 'Organizing Body', 'Period / Duration', 'Mode'],
          rows: fdpRows1,
        },
      });
      pages.push({
        id: pageCounter++,
        template: 'table',
        title: 'FDP / STTP Records — Part II',
        data: {
          title: 'Faculty Development Programmes & STTPs (Part II)',
          columns: ['Sr.', 'Faculty Name', 'Programme Title', 'Organizing Body', 'Period / Duration', 'Mode'],
          rows: fdpRows2,
        },
      });
    }
  }

  // 12. Staff Publications (Styled with institutional Table & Reflection Team Box)
  const pubList = data.publications || [];
  if (pubList.length > 0) {
    const facultyMap = new Map();
    pubList.forEach((p) => {
      const name = (p.facultyName || p.author || p.faculty || '').trim() || 'Faculty Member';
      if (!facultyMap.has(name)) {
        facultyMap.set(name, []);
      }
      facultyMap.get(name).push(p);
    });

    const facultyGroups = Array.from(facultyMap.entries()).map(([facultyName, items]) => ({
      facultyName,
      items,
    }));

    const issueNumber = currentMagazine?.issueNumber || data.cover?.issueNumber || '33';

    // Up to 8 publications comfortably fit on a single page with the Reflection Team Box
    if (pubList.length <= 8) {
      pages.push({
        id: pageCounter++,
        template: 'publications',
        title: 'Staff Publications',
        data: {
          title: 'Staff Publications',
          publications: pubList,
          facultyGroups,
          part: 1,
          totalParts: 1,
          isFinalPage: true,
          startSr: 1,
          startNumber: 1,
          issueNumber,
        },
      });
    } else {
      // For more than 8 publications, split across 2 pages cleanly:
      // Page 1 has NO reflection team box, so it comfortably takes 8 to 9 publications.
      // Page 2 takes the remaining publications AND the reflection team box.
      const splitIdx = Math.min(9, Math.ceil(pubList.length * 0.55));
      const pubs1 = pubList.slice(0, splitIdx);
      const pubs2 = pubList.slice(splitIdx);

      const groups1 = facultyGroups.slice(0, Math.ceil(facultyGroups.length * 0.55));
      const groups2 = facultyGroups.slice(Math.ceil(facultyGroups.length * 0.55));

      pages.push({
        id: pageCounter++,
        template: 'publications',
        title: 'Staff Publications — Part 1',
        data: {
          title: 'Staff Publications',
          publications: pubs1,
          facultyGroups: groups1,
          part: 1,
          totalParts: 2,
          isFinalPage: false,
          startSr: 1,
          startNumber: 1,
          issueNumber,
          quote: '―A person who never made a mistake nev er tried anything new.‖ — Albert Einstein',
        },
      });

      pages.push({
        id: pageCounter++,
        template: 'publications',
        title: 'Staff Publications — Part 2',
        data: {
          title: 'Staff Publications',
          publications: pubs2,
          facultyGroups: groups2,
          part: 2,
          totalParts: 2,
          isFinalPage: true,
          startSr: pubs1.length + 1,
          startNumber: groups1.length + 1,
          issueNumber,
          quote: '―Anyone who has ever made anything of importance was disciplined.‖ — Andrew Hendrixson.',
        },
      });
    }
  }

  return pages;
}
