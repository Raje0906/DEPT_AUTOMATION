import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMagazine } from '../../contexts/MagazineContext';
import MagazinePrintContainer from '../../components/magazine/MagazinePrintContainer';
import { generateMagazinePages } from '../../components/magazine/PagePreview';
import { generateMagazinePDF } from '../../services/pdfGenerator';
import { getTemplate } from '../../utils/magazineTemplates';
import toast from 'react-hot-toast';

// Beautiful stylized cover preview thumbnail for Student view
function MagazineCoverThumbnail({ magazine }) {
  const theme = getTemplate(magazine.template || 'modern-academic');
  const bg = magazine.coverColor || theme.accentColor || '#1E2D5A';

  return (
    <div
      className="w-full h-full flex flex-col justify-between p-4 text-white relative overflow-hidden shadow-inner select-none"
      style={{
        backgroundColor: bg,
        backgroundImage: magazine.coverImage ? `url(${magazine.coverImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Decorative overlay */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-2xs pointer-events-none" />

      {/* Decorative border frame */}
      <div className="absolute inset-2 border border-white/20 pointer-events-none" />

      {/* Top institution tag */}
      <div className="relative z-10 text-center">
        <p className="text-[8px] font-bold uppercase tracking-widest text-white/80 font-sans">
          MES Wadia COE
        </p>
        <p className="text-[7.5px] uppercase tracking-wider text-white/60">
          Computer Engineering
        </p>
      </div>

      {/* Center Magazine Name & Issue */}
      <div className="relative z-10 text-center my-auto py-2">
        <div className="w-8 h-px bg-white/40 mx-auto mb-1.5" />
        <h3 className="font-serif text-2xl font-bold text-white tracking-tight leading-none drop-shadow-sm">
          {magazine.title || 'Reflection'}
        </h3>
        <p className="text-xs font-semibold text-white/90 mt-1 font-sans">
          Issue {magazine.issueNumber}
        </p>
        <div className="w-8 h-px bg-white/40 mx-auto mt-1.5" />
        {magazine.academicYear && (
          <p className="text-[9px] text-white/75 font-mono mt-1">
            {magazine.academicYear}
          </p>
        )}
      </div>

      {/* Bottom Period and Department */}
      <div className="relative z-10 flex items-center justify-between text-[8px] text-white/70 border-t border-white/20 pt-1.5 font-sans">
        <span>{magazine.period || 'Academic Edition'}</span>
        <span className="font-medium bg-white/15 px-1.5 py-0.5 rounded text-[7.5px]">
          {theme.name}
        </span>
      </div>
    </div>
  );
}

export default function StudentMagazine() {
  const navigate = useNavigate();
  const { magazines, sectionData } = useMagazine();

  // Strict Filter: ONLY show Published magazines to students
  const publishedMagazines = useMemo(() => {
    return magazines.filter(m => m.status === 'Published');
  }, [magazines]);

  const [downloadingMagId, setDownloadingMagId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState('');
  const printContainerRef = useRef(null);

  // Latest published magazine (Current Issue)
  const currentIssue = publishedMagazines.length > 0 ? publishedMagazines[0] : null;

  // Previous published magazines
  const previousIssues = publishedMagazines.length > 1 ? publishedMagazines.slice(1) : [];

  // Active magazine for background PDF rendering
  const [activeDownloadMag, setActiveDownloadMag] = useState(currentIssue);

  const downloadPages = useMemo(() => {
    if (!activeDownloadMag) return [];
    return generateMagazinePages(activeDownloadMag, sectionData);
  }, [activeDownloadMag, sectionData]);

  const handleDownloadPdf = async (mag) => {
    if (downloadingMagId) return;
    setDownloadingMagId(mag.id);
    setActiveDownloadMag(mag);
    setDownloadProgress('Preparing pages...');
    const toastId = toast.loading(`Preparing "${mag.title} Issue ${mag.issueNumber}" PDF...`);

    // Give React one tick to populate the offscreen print container with the target magazine pages
    await new Promise(r => setTimeout(r, 150));

    try {
      const filename = await generateMagazinePDF({
        containerElement: printContainerRef.current,
        magazineTitle: mag.title || 'Reflection',
        issueNumber: mag.issueNumber || '32',
        onProgress: (msg) => {
          setDownloadProgress(msg);
          toast.loading(msg, { id: toastId });
        },
      });
      toast.success(`Downloaded: ${filename}`, { id: toastId });
    } catch (err) {
      console.error('Student PDF download error:', err);
      toast.error('Failed to generate magazine PDF. Please try again.', { id: toastId });
    } finally {
      setDownloadingMagId(null);
      setDownloadProgress('');
    }
  };

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Hidden offscreen container for clean A4 PDF rendering */}
      {activeDownloadMag && (
        <MagazinePrintContainer
          pages={downloadPages}
          currentMagazine={activeDownloadMag}
          containerRef={printContainerRef}
        />
      )}

      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-rule">
        <p className="text-[10px] font-bold text-navy uppercase tracking-widest mb-1">
          Department Publications
        </p>
        <h1 className="font-serif text-3xl lg:text-4xl font-bold text-ink">
          College Magazine
        </h1>
        <p className="text-sm text-draft mt-1.5 font-medium max-w-2xl">
          Explore the latest college publications, achievements and campus highlights.
        </p>
      </div>

      {publishedMagazines.length === 0 ? (
        <div className="bg-white border border-rule rounded-sm p-12 text-center my-8">
          <svg className="w-12 h-12 text-draft opacity-40 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <h3 className="font-serif text-xl font-bold text-ink mb-1">No Published Magazines Yet</h3>
          <p className="text-sm text-draft max-w-md mx-auto">
            The department editorial board is currently preparing upcoming editions. Please check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* ── CURRENT ISSUE HERO ───────────────────────────────────────────── */}
          {currentIssue && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-pass animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-navy">
                  CURRENT ISSUE
                </h2>
              </div>

              <div className="bg-white border-2 border-navy/20 rounded-sm shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
                  {/* Left: Prominent Magazine Cover Thumbnail */}
                  <div className="md:col-span-4 lg:col-span-3 bg-paper p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-rule">
                    <div className="w-48 aspect-[210/297] rounded-sm shadow-lg overflow-hidden transform hover:scale-[1.02] transition-transform duration-200">
                      <MagazineCoverThumbnail magazine={currentIssue} />
                    </div>
                  </div>

                  {/* Right: Current Issue Details & Actions */}
                  <div className="md:col-span-8 lg:col-span-9 p-6 lg:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-[11px] font-bold text-navy uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {currentIssue.academicYear} · {currentIssue.semester || 'Annual'}
                        </span>
                        <span className="text-[11px] font-semibold text-pass bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          Official Publication
                        </span>
                      </div>

                      <h3 className="font-serif text-2xl lg:text-3xl font-bold text-ink">
                        {currentIssue.title} — Issue {currentIssue.issueNumber}
                      </h3>

                      <p className="text-xs text-draft mt-1 font-medium">
                        Department of {currentIssue.department || 'Computer Engineering'}
                      </p>

                      <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-3xl">
                        {currentIssue.description ||
                          'The annual departmental magazine capturing student achievements, academic milestones, and departmental events with curated faculty and student articles.'}
                      </p>

                      {currentIssue.tagline && (
                        <div className="mt-4 p-3 bg-paper/60 border-l-2 border-navy text-xs italic text-slate-700">
                          "{currentIssue.tagline}"
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-rule">
                        <div>
                          <p className="text-[10px] text-draft uppercase tracking-wider font-semibold">Publication Period</p>
                          <p className="text-xs font-bold text-ink mt-0.5">{currentIssue.period || 'Annual Edition'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-draft uppercase tracking-wider font-semibold">Total Content Pages</p>
                          <p className="text-xs font-bold text-ink mt-0.5">{currentIssue.totalPages || 15} Pages</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-draft uppercase tracking-wider font-semibold">Design Layout</p>
                          <p className="text-xs font-bold text-navy mt-0.5">{getTemplate(currentIssue.template).name}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 mt-8 pt-4">
                      <button
                        onClick={() => navigate(`/student/magazine/view/${currentIssue.id}`)}
                        className="btn-primary text-sm py-2 px-5 flex items-center gap-2 shadow-xs"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        Read Magazine
                      </button>

                      <button
                        onClick={() => handleDownloadPdf(currentIssue)}
                        disabled={downloadingMagId === currentIssue.id}
                        className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 disabled:opacity-50"
                        title="Download full magazine in high-resolution PDF"
                      >
                        {downloadingMagId === currentIssue.id ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-navy" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {downloadProgress || 'Generating PDF...'}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download PDF
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIOUS ISSUES ───────────────────────────────────────────────── */}
          {previousIssues.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-rule">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-ink">Previous Issues</h2>
                  <p className="text-xs text-draft mt-0.5">Explore earlier department publications and student archives.</p>
                </div>
                <span className="text-xs text-draft font-mono">
                  {previousIssues.length} Previous Edition{previousIssues.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {previousIssues.map((mag) => (
                  <div
                    key={mag.id}
                    className="bg-white border border-rule rounded-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                  >
                    {/* Cover Thumbnail Area */}
                    <div className="h-48 bg-paper p-4 flex items-center justify-center border-b border-rule">
                      <div className="h-full aspect-[210/297] rounded-xs shadow-sm overflow-hidden transform hover:scale-105 transition-transform duration-200">
                        <MagazineCoverThumbnail magazine={mag} />
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-[10px] font-mono font-bold text-navy uppercase tracking-wider">
                            Issue {mag.issueNumber}
                          </p>
                          <h3 className="font-serif text-lg font-bold text-ink leading-snug">
                            {mag.title}
                          </h3>
                        </div>
                        <span className="text-[10px] font-semibold text-draft bg-paper px-2 py-0.5 rounded border border-rule">
                          {mag.academicYear}
                        </span>
                      </div>

                      <p className="text-xs text-draft mb-1">
                        <span className="font-semibold text-ink">Period:</span> {mag.period || 'Academic Period'}
                      </p>
                      <p className="text-xs text-draft mb-3">
                        <span className="font-semibold text-ink">Theme:</span> {getTemplate(mag.template).name}
                      </p>

                      {/* Actions */}
                      <div className="mt-auto pt-4 border-t border-rule flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/student/magazine/view/${mag.id}`)}
                          className="btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                          Read
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(mag)}
                          disabled={downloadingMagId === mag.id}
                          className="btn-secondary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {downloadingMagId === mag.id ? (
                            'Downloading...'
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              Download PDF
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
