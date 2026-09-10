import React, { useState, useEffect, useMemo } from 'react';
import { useMagazine, normalizeToppersData } from '../../contexts/MagazineContext';

/**
 * PagePreview — renders a simulated A4 magazine page with template-based layout.
 */
const PAGE_TEMPLATES = {
  cover: CoverPage,
  article: ArticlePage,
  twoCol: TwoColumnPage,
  photoGrid: PhotoGridPage,
  table: TablePage,
  toppers: ToppersPage,
};

function CoverPage({ data }) {
  return (
    <div className="w-full h-full flex flex-col" style={{ backgroundColor: '#1E2D5A', color: '#fff' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4">
        <div className="w-16 h-px bg-white opacity-40" />
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">MES Wadia COE · Computer Engineering</p>
        <h1 className="font-serif text-3xl font-bold text-center">{data?.title || 'Reflection'}</h1>
        <p className="text-sm opacity-70">Issue {data?.issueNumber || 'XX'}</p>
        <div className="w-16 h-px bg-white opacity-40" />
        <p className="text-xs opacity-50 text-center px-4 italic">{data?.tagline || ''}</p>
      </div>
      <div className="px-8 py-4 border-t border-white border-opacity-20 flex items-center justify-between">
        <p className="text-[10px] opacity-50">{data?.period || ''}</p>
        <p className="text-[10px] opacity-50">{data?.academicYear || ''}</p>
      </div>
    </div>
  );
}

function ArticlePage({ data }) {
  return (
    <div className="w-full h-full p-8 flex flex-col">
      <div className="mb-4 pb-3 border-b-2 border-ink">
        <p className="text-[8px] font-bold text-navy uppercase tracking-widest mb-1">{data?.section || 'Section'}</p>
        <h2 className="font-serif text-xl font-bold text-ink leading-tight">{data?.title || 'Article Title'}</h2>
        {data?.subtitle && <p className="text-xs text-draft mt-1">{data.subtitle}</p>}
      </div>
      {data?.image && (
        <div className="mb-4 h-40 bg-paper border border-rule rounded-sm overflow-hidden">
          <img src={data.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 space-y-2">
        {(data?.paragraphs || ['Department activities and accomplishments for the academic semester.']).map((p, i) => (
          <p key={i} className="text-[10px] text-ink leading-relaxed text-justify">{p}</p>
        ))}
      </div>
    </div>
  );
}

function TwoColumnPage({ data }) {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      <div className="mb-3 pb-2 border-b border-navy">
        <h2 className="font-serif text-lg font-bold text-ink">{data?.title || 'Title'}</h2>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-5">
        {[0, 1].map(col => (
          <div key={col} className="space-y-2">
            <p className="text-[10px] text-ink leading-relaxed">
              {data?.columns?.[col] || 'Column content goes here.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoGridPage({ data }) {
  const photos = data?.photos || [];
  const gridClass = photos.length <= 2 ? 'grid-cols-2' : photos.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <div className="w-full h-full p-5 flex flex-col">
      <div className="mb-3">
        <h2 className="font-serif text-sm font-bold text-ink">{data?.title || 'Photo Gallery'}</h2>
      </div>
      <div className={`flex-1 grid ${gridClass} gap-2`}>
        {(photos.length ? photos : Array(4).fill(null)).map((ph, i) => (
          <div key={i} className="bg-paper border border-rule rounded-sm overflow-hidden flex items-center justify-center">
            {ph?.url ? (
              <img src={ph.url} alt={ph.caption || ''} className="w-full h-full object-cover" />
            ) : (
              <div className="text-[10px] text-draft opacity-50 font-medium">Photo {i + 1}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TablePage({ data }) {
  const rows = data?.rows || [];
  const cols = data?.columns || ['Sr.', 'Faculty Name', 'Activity', 'Organization', 'Mode'];
  return (
    <div className="w-full h-full p-6 flex flex-col">
      <div className="mb-3 pb-2 border-b border-navy">
        <h2 className="font-serif text-lg font-bold text-ink">{data?.title || 'Table'}</h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <table className="w-full text-[9px] border-collapse">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} className="px-2 py-1.5 text-left font-bold uppercase tracking-wide text-navy border-b-2 border-navy bg-blue-50/50">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : Array(6).fill(null)).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-paper'}>
                {cols.map((c, j) => (
                  <td key={j} className="px-2 py-1 border-b border-rule text-ink">
                    {row?.[j] || (j === 0 ? i + 1 : '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Toppers Preview Components ───────────────────────────────────────────────

function StudentPreviewCard({ student, index }) {
  const photo = student?.photo || student?.photoUrl;

  return (
    <div className="flex flex-col items-center gap-1 p-2.5 border border-rule rounded-sm bg-paper hover:shadow-sm transition-all text-center">
      {/* Photo circle or clean default placeholder */}
      <div className="w-12 h-12 rounded-full overflow-hidden bg-navy/10 border border-rule flex items-center justify-center flex-shrink-0">
        {photo ? (
          <img
            src={photo}
            alt={student.name || 'Student photo'}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-5 h-5 text-draft opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        )}
      </div>

      {/* Student Name */}
      <p className="text-[10px] font-bold text-ink leading-tight truncate w-full" title={student.name}>
        {student.name || 'Student'}
      </p>

      {/* CGPA */}
      <p className="text-[9px] text-navy font-semibold">
        {student.cgpa ? `${student.cgpa} CGPA` : '—'}
      </p>

      {/* Class */}
      <p className="text-[8px] text-draft font-medium uppercase tracking-wide">
        {student.className || student.class || 'SE I'}
      </p>

      {/* Position / Rank */}
      {(student.position || index !== undefined) && (
        <span className="text-[8px] font-bold text-pass bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
          Rank {student.position || index + 1}
        </span>
      )}
    </div>
  );
}

function ToppersPage({ data }) {
  const toppers = data?.toppers || [];
  const grouped = data?.grouped || {};
  const activeClassNames = Object.keys(grouped).filter(cls => grouped[cls]?.length > 0);

  return (
    <div className="w-full h-full p-6 flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="mb-3 pb-2 border-b-2 border-navy flex items-end justify-between flex-shrink-0">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink">{data?.title || 'Class Toppers'}</h2>
          {data?.class && <p className="text-xs text-draft font-medium">{data.class}</p>}
        </div>
        {toppers.length > 0 && (
          <span className="text-[10px] font-bold text-navy bg-navy/10 px-2 py-0.5 rounded-sm">
            {toppers.length} Student{toppers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {toppers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-rule rounded-sm bg-paper/40">
          <svg className="w-10 h-10 text-draft opacity-40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
          <p className="text-xs font-semibold text-draft">No topper records added yet</p>
          <p className="text-[10px] text-draft opacity-70 mt-1">
            Add student records from the Editor to see them in this preview.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {activeClassNames.length > 0 ? (
            activeClassNames.map(cls => (
              <div key={cls} className="space-y-1.5">
                <div className="flex items-center gap-2 border-b border-rule pb-1">
                  <span className="text-[10px] font-bold text-navy uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-sm border border-navy/20">
                    {cls}
                  </span>
                  <span className="text-[9px] text-draft font-medium">
                    {grouped[cls].length} Topper{grouped[cls].length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {grouped[cls].map((student, idx) => (
                    <StudentPreviewCard key={student.id || idx} student={student} index={idx} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {toppers.map((student, idx) => (
                <StudentPreviewCard key={student.id || idx} student={student} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dynamic Page Generator ───────────────────────────────────────────────────

export function generateMagazinePages(currentMagazine, sectionData) {
  const data = sectionData || {};
  const toppersData = normalizeToppersData(data.toppers);
  const allStudents = toppersData.students || [];

  // Categorize students
  const seStudents = allStudents.filter(s => {
    const c = (s.className || s.class || '').toUpperCase();
    return c.startsWith('SE') || c.includes('SECOND');
  });

  const teBeStudents = allStudents.filter(s => {
    const c = (s.className || s.class || '').toUpperCase();
    return c.startsWith('TE') || c.startsWith('BE') || c.includes('THIRD') || c.includes('FINAL');
  });

  // Grouped classes for clean per-class rendering
  const seGrouped = {};
  ['SE I', 'SE II', 'SE III'].forEach(c => {
    const inClass = allStudents.filter(s => (s.className || s.class) === c);
    if (inClass.length > 0) seGrouped[c] = inClass;
  });
  seStudents.forEach(s => {
    const c = s.className || s.class;
    if (!seGrouped[c]) seGrouped[c] = [s];
    else if (!seGrouped[c].some(item => item.id === s.id)) seGrouped[c].push(s);
  });

  const teBeGrouped = {};
  ['TE I', 'TE II', 'TE III', 'BE I', 'BE II', 'BE III'].forEach(c => {
    const inClass = allStudents.filter(s => (s.className || s.class) === c);
    if (inClass.length > 0) teBeGrouped[c] = inClass;
  });
  teBeStudents.forEach(s => {
    const c = s.className || s.class;
    if (!teBeGrouped[c]) teBeGrouped[c] = [s];
    else if (!teBeGrouped[c].some(item => item.id === s.id)) teBeGrouped[c].push(s);
  });

  // Fallback if user added students with non-standard class tags
  const displaySeToppers = seStudents.length > 0
    ? seStudents
    : (teBeStudents.length === 0 && allStudents.length > 0 ? allStudents : []);

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
      },
    },
    {
      id: 2,
      template: 'article',
      title: "Principal's Message",
      data: {
        section: "Principal's Message",
        title: "From the Desk of the Principal",
        paragraphs: data.message?.principal?.message
          ? [data.message.principal.message]
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
        paragraphs: data.message?.hod?.message
          ? [data.message.hod.message]
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
      data: {
        title: 'Class Toppers',
        class: 'Second Year (SE)',
        toppers: displaySeToppers,
        grouped: seGrouped,
      },
    },
    {
      id: 5,
      template: 'toppers',
      title: 'Class Toppers — TE & BE',
      data: {
        title: 'Class Toppers',
        class: 'Third & Final Year (TE, BE)',
        toppers: teBeStudents,
        grouped: teBeGrouped,
      },
    },
    {
      id: 6,
      template: 'article',
      title: 'Department Events',
      data: {
        section: 'Department Events',
        title: 'National Science Day Celebration',
        paragraphs: [
          "The Department of Computer Engineering celebrated National Science Day on 28 February 2026 with great enthusiasm.",
          "The event featured technical presentations, a science quiz, and an inspiring poster exhibition showcasing student projects."
        ],
      },
    },
    {
      id: 7,
      template: 'photoGrid',
      title: 'Events Gallery',
      data: { title: 'National Science Day — Photo Gallery' },
    },
    {
      id: 8,
      template: 'article',
      title: 'Student Workshops',
      data: {
        section: 'Student Workshops',
        title: 'Workshop on Ethical Hacking & Penetration Testing',
        paragraphs: [
          "A two-day hands-on workshop was conducted by Mr. Vivek Ranade from CyberShield Technologies on 18–19 April 2026.",
          "68 students from TE and BE participated in the workshop, gaining practical experience with tools like Metasploit, Burp Suite, and Wireshark."
        ],
      },
    },
    {
      id: 9,
      template: 'article',
      title: 'Guest Lectures',
      data: {
        section: 'Guest Lectures',
        title: 'Generative AI: Opportunities and Challenges',
        paragraphs: [
          "Dr. Prashant Borkar, Principal Research Scientist at Microsoft Research India, delivered a keynote lecture on 5 March 2026.",
          "The lecture covered the transformative impact of LLMs, multimodal AI systems, and emerging career pathways for engineering graduates."
        ],
      },
    },
    {
      id: 10,
      template: 'article',
      title: 'Student Achievements',
      data: {
        section: 'Student Achievements',
        title: 'National & International Achievements 2025–26',
        paragraphs: [
          "Our students have excelled at competitions across national and international platforms this academic year.",
          "Ketan Patil (BE II) and his team secured Runner-up at the GitLab CodeForge Hackathon, winning ₹70,000 prize."
        ],
      },
    },
    {
      id: 11,
      template: 'article',
      title: 'Centre of Excellence',
      data: {
        section: 'Centre of Excellence',
        title: 'Centre of Excellence in AI & Cloud Computing',
        paragraphs: [
          "Established in partnership with IBM India Pvt. Ltd. in 2022, the CoE continues to deliver industry-relevant training.",
          "This year, 42 students received IBM Cloud Practitioner certification and 3 research papers were co-authored with IBM researchers."
        ],
      },
    },
    {
      id: 12,
      template: 'article',
      title: 'Staff Achievements',
      data: {
        section: 'Staff Achievements',
        title: 'Faculty Research & Recognition',
        paragraphs: [
          "Dr. N. F. Shaikh published a research paper in IEEE Access (Impact Factor 3.9) on federated learning in IoT networks.",
          "Prof. R. K. Joshi received an Indian Patent for an AI-based smart irrigation system."
        ],
      },
    },
    {
      id: 13,
      template: 'table',
      title: 'FDP / STTP Table',
      data: {
        title: 'Faculty Development Programmes & STTPs',
        columns: ['Sr.', 'Faculty Name', 'Activity', 'Organization', 'Period', 'Mode'],
      },
    },
    {
      id: 14,
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

// ── Main PagePreview component ────────────────────────────────────────────────

export default function PagePreview({ magazineId, onEditPage }) {
  const { currentMagazine, sectionData, loadMagazine } = useMagazine();
  const [currentPage, setCurrentPage] = useState(4); // Default to Page 4 (Toppers) or first page

  useEffect(() => {
    if (magazineId && (!currentMagazine || currentMagazine.id !== magazineId)) {
      loadMagazine(magazineId);
    }
  }, [magazineId, currentMagazine, loadMagazine]);

  const pages = useMemo(() => {
    return generateMagazinePages(currentMagazine, sectionData);
  }, [currentMagazine, sectionData]);

  const totalPages = pages.length;
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const page = pages[clampedPage - 1];
  const TemplateComponent = PAGE_TEMPLATES[page?.template] || ArticlePage;

  return (
    <div className="flex flex-col h-full">
      {/* Page thumbnails (left strip) - hidden on small screens */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Thumbnail strip */}
        <div className="hidden lg:flex flex-col w-28 border-r border-rule bg-paper overflow-y-auto">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setCurrentPage(i + 1)}
              className={`flex-shrink-0 m-2 border-2 rounded-sm overflow-hidden transition-all ${clampedPage === i + 1 ? 'border-navy' : 'border-transparent hover:border-rule'}`}
            >
              <div className="w-full aspect-[3/4] bg-white flex flex-col">
                <div className={`w-full h-3 flex-shrink-0 ${p.template === 'cover' ? 'bg-navy' : 'bg-paper'}`} />
                <div className="flex-1 p-1">
                  <div className="h-1 bg-rule rounded mb-0.5" />
                  <div className="h-1 bg-rule/60 rounded mb-0.5 w-3/4" />
                  <div className="h-1 bg-rule/40 rounded w-1/2" />
                </div>
              </div>
              <p className="text-[9px] text-center py-0.5 text-draft bg-white">{i + 1}</p>
            </button>
          ))}
        </div>

        {/* Main page view */}
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-200 p-4 lg:p-8 overflow-auto">
          <div className="bg-white shadow-xl" style={{ width: '100%', maxWidth: '500px', aspectRatio: '3/4' }}>
            <TemplateComponent data={page?.data} />
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="border-t border-rule bg-white px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={clampedPage === 1}
            className="px-3 py-1.5 border border-rule rounded-sm text-xs font-medium text-draft hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-draft font-mono px-2">
            Page {clampedPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={clampedPage === totalPages}
            className="px-3 py-1.5 border border-rule rounded-sm text-xs font-medium text-draft hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>

        <p className="text-[10px] text-draft font-medium">{page?.title}</p>

        <div className="flex gap-2">
          <button
            onClick={() => onEditPage?.(page)}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Edit Page
          </button>
          <button
            onClick={() => {
              // Quick regenerate feedback
              alert(`Regenerating layout for ${page?.title}… (updated from current data)`);
            }}
            className="text-xs border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors text-draft"
          >
            Regenerate Page
          </button>
        </div>
      </div>
    </div>
  );
}
