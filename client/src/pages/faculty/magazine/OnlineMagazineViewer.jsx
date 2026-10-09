import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMagazine } from '../../../contexts/MagazineContext';
import { useAuth } from '../../../contexts/AuthContext';
import { generateMagazinePages, MagazinePageSheet } from '../../../components/magazine/PagePreview';
import MagazinePrintContainer from '../../../components/magazine/MagazinePrintContainer';
import { generateMagazinePDF } from '../../../services/pdfGenerator';
import { getTemplate } from '../../../utils/magazineTemplates';
import toast from 'react-hot-toast';

function ViewerThumbnailCard({ page, pageNumber, isActive, onClick, theme }) {
  const isCover = page.template === 'cover';
  const bg = isCover ? (theme.accentColor || '#1E2D5A') : '#FFFFFF';
  const textColor = isCover ? '#FFFFFF' : '#1E293B';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 cursor-pointer text-left transition-all rounded-xs overflow-hidden ${
        isActive ? 'ring-2 ring-blue-400 scale-105 shadow-md' : 'opacity-70 hover:opacity-100 hover:ring-1 hover:ring-white/50'
      }`}
      style={{ width: 84 }}
    >
      <div
        className="w-full rounded-xs flex flex-col justify-between p-1.5 border border-white/20"
        style={{ aspectRatio: '210/297', backgroundColor: bg }}
      >
        <div className="w-full">
          <div className="w-5 h-0.5 mb-1 opacity-40" style={{ backgroundColor: textColor }} />
          <p
            className="text-[6.5px] font-bold leading-tight line-clamp-2"
            style={{ color: textColor }}
          >
            {page.title || `Page ${pageNumber}`}
          </p>
        </div>
        <span
          className="text-[6px] font-mono font-bold opacity-60 self-end"
          style={{ color: textColor }}
        >
          {pageNumber}
        </span>
      </div>
      <p className="text-[9px] text-center text-gray-300 mt-1 font-medium truncate px-0.5">
        {page.title || `Page ${pageNumber}`}
      </p>
    </button>
  );
}

export default function OnlineMagazineViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { magazines, sectionData, loadMagazine } = useMagazine();

  const isStudent = user?.role === 'student' || location.pathname.startsWith('/student') || location.search.includes('from=student');

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(90);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const printContainerRef = useRef(null);

  const magazine = magazines.find(m => m.id === id) || magazines[0];

  useEffect(() => {
    if (id && (!magazine || magazine.id !== id)) {
      loadMagazine(id);
    }
  }, [id, magazine, loadMagazine]);

  const pages = useMemo(() => {
    return generateMagazinePages(magazine, sectionData);
  }, [magazine, sectionData]);

  const totalPages = pages.length;
  const theme = getTemplate(magazine?.template || 'modern-academic');

  const changeZoom = (delta) => setZoom(z => Math.min(140, Math.max(50, z + delta)));

  const goTo = (p) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(clamped);
  };

  // Search through pages for keywords
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return pages
      .map((p, idx) => {
        const titleMatch = p.title?.toLowerCase().includes(q);
        const dataStr = JSON.stringify(p.data || {}).toLowerCase();
        const contentMatch = dataStr.includes(q);
        return (titleMatch || contentMatch) ? idx + 1 : null;
      })
      .filter(Boolean);
  }, [search, pages]);

  const handleDownloadPdf = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    const toastId = toast.loading('Generating magazine PDF (A4)...');
    try {
      const filename = await generateMagazinePDF({
        containerElement: printContainerRef.current,
        magazineTitle: magazine?.title || 'Reflection',
        issueNumber: magazine?.issueNumber || '32',
        onProgress: (msg) => toast.loading(msg, { id: toastId }),
      });
      toast.success(`Downloaded ${filename}`, { id: toastId });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error(err.message || 'Failed to generate PDF.', { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-slate-900 text-slate-100 overflow-hidden`}>
      {/* Off-screen A4 container for 1:1 PDF printing */}
      <MagazinePrintContainer
        pages={pages}
        currentMagazine={magazine}
        containerRef={printContainerRef}
      />

      {/* Top Header Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex-shrink-0 flex-wrap z-20">
        <button
          onClick={() => navigate(isStudent ? '/student/magazine' : '/faculty/magazines')}
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium transition-colors bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1.5 rounded-sm border border-slate-600"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {isStudent ? 'Return to Magazines' : 'Back to Dashboard'}
        </button>

        <span className="text-slate-600 hidden sm:inline">|</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate flex items-center gap-2">
            <span>{magazine?.title || 'Reflection'} · Issue {magazine?.issueNumber || '32'}</span>
            <span className="text-[10px] font-normal text-blue-300 bg-blue-900/50 border border-blue-700 px-1.5 py-0.2 rounded hidden md:inline">
              {theme.name} Theme
            </span>
          </p>
          <p className="text-[10.5px] text-slate-400 truncate">
            {magazine?.period || 'Academic Year'} · {magazine?.department || 'Computer Engineering'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          {showSearch && (
            <div className="relative">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search in magazine…"
                className="w-44 text-xs px-2.5 py-1.5 bg-slate-700 text-white border border-slate-600 rounded-sm focus:outline-none focus:border-blue-400 placeholder-slate-400"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg p-1.5 z-30 max-h-40 overflow-y-auto">
                  <p className="text-[9px] text-slate-400 px-1 mb-1">Found on pages:</p>
                  <div className="flex flex-wrap gap-1">
                    {searchResults.map(p => (
                      <button
                        key={p}
                        onClick={() => { goTo(p); setShowSearch(false); }}
                        className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500"
                      >
                        P.{p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowSearch(s => !s)}
            className="p-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white"
            title="Search magazine text"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-700/60 border border-slate-600 rounded-sm px-1">
            <button
              onClick={() => changeZoom(-10)}
              className="px-1.5 py-0.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white font-bold text-sm"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-xs text-slate-300 font-mono w-10 text-center">{zoom}%</span>
            <button
              onClick={() => changeZoom(10)}
              className="px-1.5 py-0.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white font-bold text-sm"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600 rounded-sm transition-colors text-slate-300 hover:text-white"
            title={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {fullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              )}
            </svg>
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            title="Download full publication in A4 PDF"
          >
            {isGeneratingPdf ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                PDF…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Reading Viewport */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Nav Arrow */}
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-14 flex-shrink-0 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-15 disabled:cursor-not-allowed transition-all z-10"
          title="Previous page"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Center Canvas: Exact Rendered Page Sheet */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 select-none bg-slate-950/60">
          <div
            className="shadow-2xl transition-all duration-150 overflow-hidden relative bg-white"
            style={{
              width: `${Math.round(794 * (zoom / 100) * 0.72)}px`,
              height: `${Math.round(1123 * (zoom / 100) * 0.72)}px`,
            }}
          >
            <div
              style={{
                width: '794px',
                height: '1123px',
                transform: `scale(${(zoom / 100) * 0.72})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <MagazinePageSheet
                page={pages[currentPage - 1]}
                pageNumber={currentPage}
                totalPages={totalPages}
                currentMagazine={magazine}
                templateId={magazine?.template}
              />
            </div>
          </div>
        </div>

        {/* Right Nav Arrow */}
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-14 flex-shrink-0 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-15 disabled:cursor-not-allowed transition-all z-10"
          title="Next page"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex-shrink-0 z-20">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 max-w-full">
          {/* Quick page input jump */}
          <div className="flex-shrink-0 flex items-center gap-1.5 text-white mr-3 bg-slate-800 border border-slate-700 px-2 py-1 rounded">
            <span className="text-[11px] text-slate-400">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={e => goTo(parseInt(e.target.value) || 1)}
              className="w-8 bg-slate-700 text-white text-xs text-center rounded px-1 py-0.5 border border-slate-600 outline-none"
            />
            <span className="text-slate-400 text-xs font-mono">/ {totalPages}</span>
          </div>

          {/* Page Thumbnails */}
          {pages.map((p, i) => (
            <ViewerThumbnailCard
              key={p.id || i}
              page={p}
              pageNumber={i + 1}
              isActive={currentPage === i + 1}
              onClick={() => setCurrentPage(i + 1)}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
