import { normalizeToppersData, groupToppersByClassAndDivision, formatClassLabel } from './toppersUtils.js';

/**
 * Generates the complete 15-page magazine manifest from current magazine metadata and section data.
 * Single source of truth for both MagazinePreview and PDF generation.
 */
export function generateMagazinePages(currentMagazine, sectionData) {
  const data = sectionData || {};
  const toppersData = normalizeToppersData(data.toppers);
  const allStudents = toppersData.students || [];

  // Group by class and division, and sort by rank/CGPA
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

  const sePageData = createClassTopperPageData('SE');
  const tePageData = createClassTopperPageData('TE');
  const bePageData = createClassTopperPageData('BE');

  // Extract uploaded photos helpers
  const getPhotoUrl = (p) => (typeof p === 'string' ? p : p?.url || p?.photo || null);

  const firstEvent = data.events?.[0];
  const firstEventPhoto = getPhotoUrl(firstEvent?.photos?.[0]);
  const allEventPhotos = (data.events || []).flatMap(e =>
    (e.photos || []).map(p => ({
      url: getPhotoUrl(p),
      caption: (typeof p === 'object' && p?.caption) ? p.caption : (e.title || 'Event Photo')
    }))
  ).filter(p => !!p.url);

  const firstWorkshop = data.workshops?.[0];
  const firstWorkshopPhoto = getPhotoUrl(firstWorkshop?.photos?.[0]);

  const firstLecture = data.lectures?.[0];
  const firstLecturePhoto = getPhotoUrl(firstLecture?.photos?.[0]);

  const firstAchievementWithPhoto = (data.achievements || []).find(a => !!a.photo);
  const firstCoePhoto = getPhotoUrl(data.coe?.photos?.[0]);
  const firstStaffWithPhoto = (data.staffAchievements || []).flatMap(s => s.achievements || []).find(a => !!a.photo);

  return [
    {
      id: 1,
      template: 'cover',
      title: 'Cover Page',
      data: {
        title: data.cover?.title || currentMagazine?.title || 'Reflection',
        issueNumber: data.cover?.issueNumber || currentMagazine?.issueNumber || 32,
        tagline: data.cover?.tagline || currentMagazine?.tagline || 'Knowledge grows when it is shared with others',
        period: currentMagazine?.period || 'June – December 2025',
        academicYear: data.cover?.academicYear || currentMagazine?.academicYear || '2025–26',
        department: data.cover?.department || currentMagazine?.department || 'Computer Engineering',
        collegeLogo: data.cover?.collegeLogo || null,
        coverImage: data.cover?.coverImage || null,
        coverOverlay: data.cover?.overlay || { type: 'none', color: '#000000', opacity: 0 },
      },
    },
    {
      id: 2,
      template: 'article',
      title: "Principal's Message",
      data: {
        section: "Principal's Message",
        title: "From the Desk of the Principal",
        author: data.message?.principal?.name || "Dr. S. V. Kulkarni",
        designation: data.message?.principal?.designation || "Principal, MES Wadia College of Engineering",
        image: data.message?.principal?.photo || null,
        paragraphs: data.message?.principal?.message
          ? data.message.principal.message.split('\n\n').filter(Boolean)
          : [
              "It is with immense pride and joy that I present the 32nd edition of 'Reflection,' the annual magazine of the Department of Computer Engineering.",
              "This magazine is a living document of our students' achievements, faculty excellence, and the departmental milestones that define our academic year.",
              "I extend my heartfelt congratulations to all contributors and the editorial team for their tireless dedication."
            ],
      },
    },
    {
      id: 3,
      template: 'article',
      title: "HOD's Message",
      data: {
        section: "Head of Department's Message",
        title: "Message from the HOD",
        author: data.message?.hod?.name || "Dr. A. B. Patil",
        designation: data.message?.hod?.designation || "Head of Department, Computer Engineering",
        image: data.message?.hod?.photo || null,
        paragraphs: data.message?.hod?.message
          ? data.message.hod.message.split('\n\n').filter(Boolean)
          : [
              "The Department of Computer Engineering continues to make significant strides in academic, research, and co-curricular domains.",
              "This edition of Reflection captures the essence of our collective journey — from class toppers to national hackathon winners, from industry certifications to path-breaking research publications."
            ],
      },
    },
    {
      id: 4,
      template: 'toppers',
      title: 'Class Toppers — SE',
      data: sePageData,
    },
    {
      id: 5,
      template: 'toppers',
      title: 'Class Toppers — TE',
      data: tePageData,
    },
    {
      id: 6,
      template: 'toppers',
      title: 'Class Toppers — BE',
      data: bePageData,
    },
    {
      id: 7,
      template: 'article',
      title: 'Department Events',
      data: {
        section: 'Department Events',
        title: firstEvent?.title || 'National Science Day Celebration',
        subtitle: firstEvent?.date ? `${firstEvent.date} · ${firstEvent.venue || ''}` : '',
        image: firstEventPhoto || null,
        paragraphs: firstEvent?.description
          ? firstEvent.description.split('\n\n').filter(Boolean)
          : [
              "The Department of Computer Engineering celebrated National Science Day on 28 February 2026 with great enthusiasm.",
              "The event featured technical presentations, a science quiz, and an inspiring poster exhibition showcasing student projects."
            ],
      },
    },
    {
      id: 8,
      template: 'photoGrid',
      title: 'Events Gallery',
      data: {
        title: 'Department Events & Activities — Photo Gallery',
        photos: allEventPhotos.length > 0 ? allEventPhotos : [],
      },
    },
    {
      id: 9,
      template: 'article',
      title: 'Student Workshops',
      data: {
        section: 'Student Workshops',
        title: firstWorkshop?.title || 'Workshop on Ethical Hacking & Penetration Testing',
        subtitle: firstWorkshop?.speaker ? `Conducted by ${firstWorkshop.speaker} · ${firstWorkshop.date || ''}` : '',
        image: firstWorkshopPhoto || null,
        paragraphs: firstWorkshop?.description
          ? firstWorkshop.description.split('\n\n').filter(Boolean)
          : [
              "A two-day hands-on workshop was conducted by Mr. Vivek Ranade from CyberShield Technologies on 18–19 April 2026.",
              "68 students from TE and BE participated in the workshop, gaining practical experience with tools like Metasploit, Burp Suite, and Wireshark."
            ],
      },
    },
    {
      id: 10,
      template: 'article',
      title: 'Guest Lectures',
      data: {
        section: 'Guest Lectures',
        title: firstLecture?.topic || firstLecture?.title || 'Generative AI: Opportunities and Challenges',
        subtitle: firstLecture?.speaker ? `Speaker: ${firstLecture.speaker} (${firstLecture.organization || ''})` : '',
        image: firstLecturePhoto || null,
        paragraphs: firstLecture?.description
          ? firstLecture.description.split('\n\n').filter(Boolean)
          : [
              "Dr. Prashant Borkar, Principal Research Scientist at Microsoft Research India, delivered a keynote lecture on 5 March 2026.",
              "The lecture covered the transformative impact of LLMs, multimodal AI systems, and emerging career pathways for engineering graduates."
            ],
      },
    },
    {
      id: 11,
      template: 'article',
      title: 'Student Achievements',
      data: {
        section: 'Student Achievements',
        title: firstAchievementWithPhoto
          ? `${firstAchievementWithPhoto.name} (${firstAchievementWithPhoto.class}) — ${firstAchievementWithPhoto.achievement}`
          : 'National & International Achievements 2025–26',
        subtitle: firstAchievementWithPhoto ? `${firstAchievementWithPhoto.position} · ${firstAchievementWithPhoto.level}` : '',
        image: firstAchievementWithPhoto?.photo || null,
        paragraphs: firstAchievementWithPhoto?.description
          ? firstAchievementWithPhoto.description.split('\n\n').filter(Boolean)
          : [
              "Our students have excelled at competitions across national and international platforms this academic year.",
              "Ketan Patil (BE II) and his team secured Runner-up at the GitLab CodeForge Hackathon, winning ₹70,000 prize."
            ],
      },
    },
    {
      id: 12,
      template: 'article',
      title: 'Centre of Excellence',
      data: {
        section: 'Centre of Excellence',
        title: data.coe?.name || 'Centre of Excellence in AI & Cloud Computing',
        subtitle: data.coe?.partner ? `In partnership with ${data.coe.partner}` : '',
        image: firstCoePhoto || null,
        paragraphs: data.coe?.description
          ? [data.coe.description, data.coe.activities, data.coe.achievements].filter(Boolean)
          : [
              "Established in partnership with IBM India Pvt. Ltd. in 2022, the CoE continues to deliver industry-relevant training.",
              "This year, 42 students received IBM Cloud Practitioner certification and 3 research papers were co-authored with IBM researchers."
            ],
      },
    },
    {
      id: 13,
      template: 'article',
      title: 'Staff Achievements',
      data: {
        section: 'Staff Achievements',
        title: firstStaffWithPhoto ? `${firstStaffWithPhoto.title}` : 'Faculty Research & Recognition',
        subtitle: firstStaffWithPhoto ? `${firstStaffWithPhoto.organization || ''} · ${firstStaffWithPhoto.date || ''}` : '',
        image: firstStaffWithPhoto?.photo || null,
        paragraphs: firstStaffWithPhoto?.description
          ? [firstStaffWithPhoto.description]
          : [
              "Dr. N. F. Shaikh published a research paper in IEEE Access (Impact Factor 3.9) on federated learning in IoT networks.",
              "Prof. R. K. Joshi received an Indian Patent for an AI-based smart irrigation system."
            ],
      },
    },
    {
      id: 14,
      template: 'table',
      title: 'FDP / STTP Table',
      data: {
        title: 'Faculty Development Programmes & STTPs',
        columns: ['Sr.', 'Faculty Name', 'Activity', 'Organization', 'Period', 'Mode'],
      },
    },
    {
      id: 15,
      template: 'article',
      title: 'Publications',
      data: {
        section: 'Publications',
        title: 'Research Publications 2025–26',
        paragraphs: [
          "The department faculty published 12 research papers in peer-reviewed journals and conferences this academic year.",
          "Publications appeared in IEEE Access, Elsevier journals, and international conferences including ICML and CVPR."
        ],
      },
    },
  ];
}
