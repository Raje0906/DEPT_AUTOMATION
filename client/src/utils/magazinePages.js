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
    // Page 1: Events 0 and 1
    const evChunk1 = eventsList.slice(0, 2);
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

    // Page 2: Events 2, 3, 4
    if (eventsList.length > 2) {
      const evChunk2 = eventsList.slice(2, 5);
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

    // Page 3: Events Photo Gallery (2-column balanced grid, max 4 photos per page)
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

  // 6. Student Workshops (Multi-page display)
  const workshopsList = data.workshops || [];
  if (workshopsList.length > 0) {
    const wsChunk1 = workshopsList.slice(0, 2);
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

    if (workshopsList.length > 2) {
      const wsChunk2 = workshopsList.slice(2, 4);
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

  // 7. Guest Lectures (Multi-page display)
  const lecturesList = data.lectures || [];
  if (lecturesList.length > 0) {
    const lecChunk1 = lecturesList.slice(0, 2);
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

    if (lecturesList.length > 2) {
      const lecChunk2 = lecturesList.slice(2, 4);
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

  // 8. Student Achievements (Multi-page display)
  const achievementsList = data.achievements || [];
  if (achievementsList.length > 0) {
    const achChunk1 = achievementsList.slice(0, 5);
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

    if (achievementsList.length > 5) {
      const achChunk2 = achievementsList.slice(5, 10);
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

  // 10. Staff Achievements (Multi-page display)
  const staffList = data.staffAchievements || [];
  if (staffList.length > 0) {
    const staffChunk1 = staffList.slice(0, 4);
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

    if (staffList.length > 4) {
      const staffChunk2 = staffList.slice(4, 8);
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

  // 11. FDP / STTP (2 Table Pages for clean, unclipped A4 rendering)
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

    const fdpRows1 = fdpList.slice(0, 5).map((r, i) => mapRow(r, i));
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

    if (fdpList.length > 5) {
      const fdpRows2 = fdpList.slice(5, 10).map((r, i) => mapRow(r, i + 5));
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

  // 12. Publications (2 Pages with rich citation cards and DOI links)
  const pubList = data.publications || [];
  if (pubList.length > 0) {
    const pubChunk1 = pubList.slice(0, 5);
    pages.push({
      id: pageCounter++,
      template: 'publications',
      title: 'Publications — Peer-Reviewed Journals',
      data: {
        title: 'Peer-Reviewed Journal Publications',
        subtitle: 'High-Impact Scopus and Web of Science Indexed Research',
        publications: pubChunk1,
      },
    });

    if (pubList.length > 5) {
      const pubChunk2 = pubList.slice(5, 10);
      pages.push({
        id: pageCounter++,
        template: 'publications',
        title: 'Publications — Conferences & Books',
        data: {
          title: 'International Conferences & Book Chapters',
          subtitle: 'Peer-Reviewed Conference Proceedings & Technical Monographs',
          publications: pubChunk2,
        },
      });
    }
  }

  return pages;
}
