import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMagazine, normalizeToppersData } from '../../contexts/MagazineContext';
import { groupToppersByClassAndDivision, formatClassLabel, sortToppers } from '../../utils/toppersUtils';

// ── Template Components ──────────────────────────────────────────────────────

function CoverPage({ data }) {
  const overlay = data?.coverOverlay || data?.overlay || {
    type: 'none',
    color: '#000000',
    opacity: 0,
    gradientStart: '#1E2D5A',
    gradientEnd: '#0D1B2A',
  };

  const opacity = typeof overlay.opacity === 'number' ? overlay.opacity / 100 : (parseFloat(overlay.opacity) || 0) / 100;
  const hasOverlay = data?.coverImage && overlay.type !== 'none' && opacity > 0;

  const overlayStyle = hasOverlay
    ? overlay.type === 'solid'
      ? { backgroundColor: overlay.color || '#000000', opacity }
      : { backgroundImage: `linear-gradient(to bottom, ${overlay.gradientStart || '#1E2D5A'}, ${overlay.gradientEnd || '#0D1B2A'})`, opacity }
    : null;

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#1E2D5A',
        backgroundImage: data?.coverImage ? `url(${data.coverImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#fff',
      }}
    >
      {/* Optional Overlay Layer: Default None (0% opacity, pure original image colors) */}
      {hasOverlay && (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity"
          style={overlayStyle}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-4 relative z-10">
        {data?.collegeLogo && (
          <div className="mb-2 max-h-16 max-w-[150px] flex items-center justify-center p-1.5 bg-white/95 rounded-sm shadow-sm">
            <img src={data.collegeLogo} alt="College Logo" className="max-h-12 max-w-full object-contain" />
          </div>
        )}
        <div className="w-20 h-px bg-white opacity-40" />
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-60">MES Wadia COE · Computer Engineering</p>
        <h1 className="font-serif text-4xl font-bold text-center leading-tight">{data?.title || 'Reflection'}</h1>
        <p className="text-base opacity-75 font-medium">Issue {data?.issueNumber || 'XX'}</p>
        <div className="w-20 h-px bg-white opacity-40" />
        <p className="text-sm opacity-60 text-center px-6 italic max-w-md">{data?.tagline || ''}</p>
      </div>
      <div className="px-10 py-6 border-t border-white border-opacity-20 flex items-center justify-between relative z-10">
        <p className="text-xs opacity-60">{data?.period || ''}</p>
        <p className="text-xs opacity-60 font-mono">{data?.academicYear || ''}</p>
      </div>
    </div>
  );
}

function ArticlePage({ data }) {
  return (
    <div className="w-full h-full p-9 flex flex-col bg-white">
      <div className="mb-4 pb-2.5 border-b-2 border-ink">
        <p className="text-[9px] font-bold text-navy uppercase tracking-widest mb-1">{data?.section || 'Section'}</p>
        <h2 className="font-serif text-2xl font-bold text-ink leading-tight">{data?.title || 'Article Title'}</h2>
        {data?.subtitle && <p className="text-xs text-draft mt-1">{data.subtitle}</p>}
      </div>

      {data?.image && (
        data?.author ? (
          <div className="mb-4 flex items-center gap-4 p-3 bg-paper/60 border border-rule rounded-sm flex-shrink-0">
            <img src={data.image} alt={data.author} className="w-24 h-28 object-cover rounded-sm border border-rule shadow-sm flex-shrink-0" />
            <div>
              <h3 className="font-serif text-base font-bold text-ink">{data.author}</h3>
              <p className="text-xs text-draft font-medium mt-0.5">{data.designation}</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 h-48 bg-paper border border-rule rounded-sm overflow-hidden flex items-center justify-center flex-shrink-0">
            <img src={data.image} alt="" className="w-full h-full object-cover" />
          </div>
        )
      )}

      <div className="flex-1 space-y-3">
        {(data?.paragraphs || ['Department activities and accomplishments for the academic semester.']).map((p, i) => (
          <p key={i} className="text-[11px] text-ink leading-relaxed text-justify">{p}</p>
        ))}
      </div>

      {data?.author && !data?.image && (
        <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-ink">{data.author}</p>
            {data?.designation && <p className="text-[10px] text-draft">{data.designation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function TwoColumnPage({ data }) {
  return (
    <div className="w-full h-full p-9 flex flex-col bg-white">
      <div className="mb-4 pb-2 border-b-2 border-navy">
        <h2 className="font-serif text-xl font-bold text-ink">{data?.title || 'Title'}</h2>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-6">
        {[0, 1].map(col => (
          <div key={col} className="space-y-3">
            <p className="text-[11px] text-ink leading-relaxed text-justify">
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
    <div className="w-full h-full p-8 flex flex-col bg-white">
      <div className="mb-4">
        <h2 className="font-serif text-lg font-bold text-ink">{data?.title || 'Photo Gallery'}</h2>
      </div>
      <div className={`flex-1 grid ${gridClass} gap-3`}>
        {(photos.length ? photos : Array(4).fill(null)).map((ph, i) => (
          <div key={i} className="bg-paper border border-rule rounded-sm overflow-hidden flex items-center justify-center">
            {ph?.url ? (
              <img src={ph.url} alt={ph.caption || ''} className="w-full h-full object-cover" />
            ) : (
              <div className="text-xs text-draft opacity-50 font-medium">Photo {i + 1}</div>
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
    <div className="w-full h-full p-8 flex flex-col bg-white">
      <div className="mb-4 pb-2 border-b-2 border-navy">
        <h2 className="font-serif text-xl font-bold text-ink">{data?.title || 'Table'}</h2>
      </div>
      <div className="flex-1 overflow-hidden">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} className="px-2.5 py-2 text-left font-bold uppercase tracking-wide text-navy border-b-2 border-navy bg-blue-50/50">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : Array(6).fill(null)).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-paper'}>
                {cols.map((c, j) => (
                  <td key={j} className="px-2.5 py-1.5 border-b border-rule text-ink">
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

// ── Toppers Card & Page Components ───────────────────────────────────────────

export function StudentPreviewCard({ student, index }) {
  const photo = student?.photo || student?.photoUrl;
  const displayRank = student?.rank || student?.position || index + 1;
  const rankBadgeColor = displayRank === 1
    ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
    : displayRank === 2
    ? 'bg-slate-100 text-slate-800 border-slate-300 font-bold'
    : displayRank === 3
    ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
    : 'bg-green-50 text-pass border-green-200 font-semibold';

  return (
    <div className="flex flex-col items-center justify-between p-2.5 border border-rule rounded-sm bg-white hover:shadow-sm transition-all text-center relative overflow-visible min-h-[145px]">
      {/* Top row: Rank badge + Division tag */}
      <div className="flex items-center justify-between w-full mb-1 flex-shrink-0">
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${rankBadgeColor}`}>
          Rank {displayRank}
        </span>
        {student.division && (
          <span className="text-[8px] text-draft font-semibold uppercase bg-paper px-1 rounded border border-rule/50">
            Div {student.division}
          </span>
        )}
      </div>

      {/* Photo circle or placeholder */}
      <div className="w-11 h-11 rounded-full overflow-hidden bg-navy/10 border border-rule flex items-center justify-center flex-shrink-0 my-1">
        {photo ? (
          <img
            src={photo}
            alt={student.name || 'Student photo'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
            }}
          />
        ) : null}
        <svg
          className={`w-5 h-5 text-draft opacity-70 ${photo ? 'hidden' : 'block'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
      </div>

      {/* Student Name: Prominent magazine typography, readable, never clipped, wraps up to 2 lines cleanly */}
      <div
        className="w-full min-h-[38px] flex items-center justify-center px-1 my-0.5"
        style={{ overflow: 'visible' }}
      >
        <p
          className="text-[14px] font-bold text-ink text-center tracking-tight"
          style={{
            overflow: 'visible',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            lineHeight: '1.25',
            margin: 0,
            padding: 0,
            maxHeight: '40px',
          }}
          title={student.name}
        >
          {student.name || 'Student'}
        </p>
      </div>

      {/* CGPA — smaller supporting information */}
      <p className="text-[10.5px] font-semibold text-navy/85 font-mono mt-0.5 flex-shrink-0">
        {student.cgpa ? `${student.cgpa} CGPA` : '—'}
      </p>
    </div>
  );
}

function ToppersPage({ data }) {
  const divisions = data?.divisions || [];
  const totalStudents = data?.totalStudents || 0;
  const classLabel = data?.classLabel || data?.class || 'Class Toppers';
  const classYear = data?.classYear || 'SE';

  return (
    <div className="w-full h-full p-8 flex flex-col bg-white overflow-hidden justify-between">
      {/* Header */}
      <div className="pb-2.5 border-b-2 border-navy flex items-end justify-between flex-shrink-0">
        <div>
          <p className="text-[8px] font-bold text-navy uppercase tracking-widest">Academic Excellence</p>
          <h2 className="font-serif text-xl font-bold text-ink leading-tight">Class Toppers — {classYear}</h2>
          <p className="text-xs text-draft font-medium">{classLabel}</p>
        </div>
        {totalStudents > 0 && (
          <span className="text-[10px] font-bold text-navy bg-navy/10 px-2 py-0.5 rounded-sm border border-navy/20">
            {totalStudents} Student{totalStudents > 1 ? 's' : ''} · {divisions.length} Division{divisions.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {totalStudents === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-rule rounded-sm bg-paper/40 my-4">
          <svg className="w-10 h-10 text-draft opacity-40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
          <p className="text-xs font-semibold text-draft">No topper records added for {classYear}</p>
          <p className="text-[10px] text-draft opacity-70 mt-1">
            Add student records in the Editor to see them arranged by rank here.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-around py-2 gap-3 overflow-visible">
          {divisions.map((div) => (
            <div key={div.name} className="border border-rule rounded-sm p-3 bg-paper/30">
              {/* Division Header */}
              <div className="flex items-center justify-between border-b border-rule/60 pb-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-navy" />
                  <span className="text-[10px] font-bold text-navy uppercase tracking-wider">
                    {div.name}
                  </span>
                </div>
                <span className="text-[8px] text-draft font-semibold bg-white px-1.5 py-0.5 rounded border border-rule">
                  {div.students.length} Topper{div.students.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Students Grid - 3 columns for neat rank 1, 2, 3 display */}
              <div className="grid grid-cols-3 gap-3">
                {div.students.map((student, idx) => (
                  <StudentPreviewCard key={student.id || idx} student={student} index={idx} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtle Footer */}
      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[8px] text-draft opacity-70 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Auto-arranged by Rank & Merit</span>
      </div>
    </div>
  );
}

export const PAGE_TEMPLATES = {
  cover: CoverPage,
  article: ArticlePage,
  twoCol: TwoColumnPage,
  photoGrid: PhotoGridPage,
  table: TablePage,
  toppers: ToppersPage,
};

// ── Unified A4 Page Sheet Component ──────────────────────────────────────────
/**
 * MagazinePageSheet
 * Single source of truth for rendering standard A4 magazine pages (794px x 1123px).
 * Shared identically by both the interactive browser preview and PDF generation.
 */
export function MagazinePageSheet({ page, pageNumber, totalPages, currentMagazine }) {
  if (!page) {
    return (
      <div
        className="magazine-pdf-page bg-white flex flex-col items-center justify-center p-8 text-center"
        style={{ width: '794px', height: '1123px', boxSizing: 'border-box' }}
      >
        <p className="text-sm text-draft">Page content unavailable</p>
      </div>
    );
  }

  const TemplateComponent = PAGE_TEMPLATES[page.template] || PAGE_TEMPLATES.article;
  const isCover = page.template === 'cover';

  return (
    <div
      className="magazine-pdf-page bg-white relative flex flex-col overflow-hidden select-none"
      data-page-index={pageNumber}
      style={{
        width: '794px',
        height: '1123px',
        boxSizing: 'border-box',
        backgroundColor: isCover ? '#1E2D5A' : '#ffffff',
        position: 'relative',
      }}
    >
      {/* Page Content */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <TemplateComponent data={page.data} />
      </div>

      {/* Running Footer for Interior Pages */}
      {!isCover && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '28px',
            right: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '6px',
            fontSize: '9px',
            color: '#64748B',
            fontFamily: 'sans-serif',
          }}
        >
          <span>{currentMagazine?.title || 'Reflection'} · Issue {currentMagazine?.issueNumber || '32'}</span>
          <span style={{ fontWeight: 'bold' }}>Page {pageNumber}</span>
        </div>
      )}
    </div>
  );
}

// ── Dynamic Page Generator ───────────────────────────────────────────────────
export { generateMagazinePages } from '../../utils/magazinePages';
import { generateMagazinePages } from '../../utils/magazinePages';

// ── Main PagePreview Component ────────────────────────────────────────────────

export default function PagePreview({ magazineId, onEditPage }) {
  const { currentMagazine, sectionData, loadMagazine } = useMagazine();
  const [currentPage, setCurrentPage] = useState(1); // Default to Page 1 (Cover)
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.80);
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'fit-page' | 'fit-width' | 'manual'

  useEffect(() => {
    if (magazineId && (!currentMagazine || currentMagazine.id !== magazineId)) {
      loadMagazine(magazineId);
    }
  }, [magazineId, currentMagazine, loadMagazine]);

  const pages = useMemo(() => {
    return generateMagazinePages(currentMagazine, sectionData);
  }, [currentMagazine, sectionData]);

  const totalPages = pages.length;
  const clampedPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const page = pages[clampedPage - 1];

  // Dynamic proportional viewport scaling for the A4 page preview
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    // Available preview space with comfortable margins (24px horizontal, 24px vertical)
    const availWidth = Math.max(200, clientWidth - 24);
    const availHeight = Math.max(200, clientHeight - 24);

    // Standard A4 dimensions: 794px width x 1123px height (~1:1.414 aspect ratio)
    const fitPageScale = Math.min(availWidth / 794, availHeight / 1123);
    const fitWidthScale = Math.min(availWidth / 794, 1.25);

    if (viewMode === 'fit-page') {
      setScale(Math.max(0.3, Math.min(fitPageScale, 1.25)));
    } else if (viewMode === 'fit-width') {
      setScale(Math.max(0.4, Math.min(fitWidthScale, 1.25)));
    } else if (viewMode === 'auto') {
      // Auto Mode: Fills the available center area efficiently.
      // If fitPageScale is comfortable (>= 0.72, e.g. on 1080p desktop), fits entire page vertically.
      // If fitPageScale is smaller (< 0.72, e.g. on laptops with 768p displays), uses a comfortable
      // readable scale between 0.75 and 0.82 (capped by container width) so text is never tiny.
      if (fitPageScale >= 0.72) {
        setScale(Math.max(0.72, Math.min(fitPageScale, 1.15)));
      } else {
        const readableDefault = Math.min(fitWidthScale, 0.78);
        setScale(Math.max(0.72, Math.min(readableDefault, 1.15)));
      }
    }
  }, [viewMode]);

  useEffect(() => {
    updateScale();

    let observer = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        updateScale();
      });
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateScale);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [updateScale]);

  const handleZoomIn = () => {
    setViewMode('manual');
    setScale(s => Math.min(1.5, Number((s + 0.08).toFixed(2))));
  };

  const handleZoomOut = () => {
    setViewMode('manual');
    setScale(s => Math.max(0.35, Number((s - 0.08).toFixed(2))));
  };

  const handleFitPage = () => {
    setViewMode('fit-page');
  };

  const handleFitWidth = () => {
    setViewMode('fit-width');
  };

  const handleResetAuto = () => {
    setViewMode('auto');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page thumbnails (left strip) + Main center preview area */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Thumbnail strip */}
        <div className="hidden lg:flex flex-col w-28 border-r border-rule bg-paper overflow-y-auto flex-shrink-0">
          {pages.map((p, i) => (
            <button
              key={p.id || i}
              onClick={() => setCurrentPage(i + 1)}
              className={`flex-shrink-0 m-2 border-2 rounded-sm overflow-hidden transition-all text-left ${clampedPage === i + 1 ? 'border-navy ring-1 ring-navy' : 'border-transparent hover:border-rule'}`}
            >
              <div className="w-full aspect-[210/297] bg-white flex flex-col border border-rule/50">
                <div className={`w-full h-2.5 flex-shrink-0 ${p.template === 'cover' ? 'bg-navy' : 'bg-paper'}`} />
                <div className="flex-1 p-1">
                  <div className="h-1 bg-rule rounded mb-0.5" />
                  <div className="h-1 bg-rule/60 rounded mb-0.5 w-3/4" />
                  <div className="h-1 bg-rule/40 rounded w-1/2" />
                </div>
              </div>
              <p className="text-[9px] text-center py-0.5 text-draft bg-white font-medium">{i + 1}</p>
            </button>
          ))}
        </div>

        {/* Main page view with proportional viewport scaling */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-200/90 overflow-auto flex justify-center p-3 relative select-none"
          style={{ minHeight: 0 }}
        >
          {page ? (
            <div
              className="shadow-2xl flex-shrink-0 my-auto transition-transform duration-100 ease-out"
              style={{
                width: `${Math.round(794 * scale)}px`,
                height: `${Math.round(1123 * scale)}px`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '794px',
                  height: '1123px',
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <MagazinePageSheet
                  page={page}
                  pageNumber={clampedPage}
                  totalPages={totalPages}
                  currentMagazine={currentMagazine}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded shadow text-center text-draft my-auto">
              <p className="font-semibold text-sm">No page available to preview</p>
              <p className="text-xs text-draft opacity-75 mt-1">Please select another page from the list.</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation & Zoom Bar */}
      <div className="border-t border-rule bg-white px-4 py-2 flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
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

        {/* Zoom & View Mode Controls */}
        <div className="flex items-center gap-1 bg-paper px-2 py-1 rounded border border-rule">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-draft hover:text-navy hover:bg-white transition-colors"
            title="Zoom Out (-8%)"
          >
            –
          </button>
          <button
            type="button"
            onClick={handleResetAuto}
            className="text-[11px] font-mono font-bold text-navy px-1.5 min-w-[42px] text-center hover:bg-white rounded transition-colors"
            title="Reset Auto Fit"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-draft hover:text-navy hover:bg-white transition-colors"
            title="Zoom In (+8%)"
          >
            +
          </button>
          <span className="w-px h-3.5 bg-rule mx-1" />
          <button
            type="button"
            onClick={handleFitPage}
            className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
              viewMode === 'fit-page' ? 'bg-navy text-white shadow-sm' : 'text-draft hover:text-navy hover:bg-white'
            }`}
            title="Fit whole page within view"
          >
            Fit Page
          </button>
          <button
            type="button"
            onClick={handleFitWidth}
            className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
              viewMode === 'fit-width' ? 'bg-navy text-white shadow-sm' : 'text-draft hover:text-navy hover:bg-white'
            }`}
            title="Fit page width for comfortable reading"
          >
            Fit Width
          </button>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs text-ink font-semibold hidden sm:block">{page?.title}</p>
          <button
            onClick={() => onEditPage?.(page)}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Edit Page
          </button>
        </div>
      </div>
    </div>
  );
}
