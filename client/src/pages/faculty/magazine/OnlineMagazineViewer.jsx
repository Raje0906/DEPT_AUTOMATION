import React, { useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMagazine } from '../../../contexts/MagazineContext';
import { generateMagazinePages } from '../../../components/magazine/PagePreview';
import MagazinePrintContainer from '../../../components/magazine/MagazinePrintContainer';
import { generateMagazinePDF } from '../../../services/pdfGenerator';
import toast from 'react-hot-toast';

const SAMPLE_PAGES_VIEW = [
  { id: 1, label: 'Cover',                   bg: '#1E2D5A', color: '#fff' },
  { id: 2, label: "Principal's Message",      bg: '#F5F3EE', color: '#1A1F36' },
  { id: 3, label: "HOD's Message",            bg: '#F5F3EE', color: '#1A1F36' },
  { id: 4, label: 'Class Toppers — SE',       bg: '#FFFFFF', color: '#1A1F36' },
  { id: 5, label: 'Class Toppers — TE',       bg: '#FFFFFF', color: '#1A1F36' },
  { id: 6, label: 'Class Toppers — BE',       bg: '#FFFFFF', color: '#1A1F36' },
  { id: 7, label: 'Department Events',        bg: '#F5F3EE', color: '#1A1F36' },
  { id: 8, label: 'Events Gallery',           bg: '#FFFFFF', color: '#1A1F36' },
  { id: 9, label: 'Student Workshops',        bg: '#F5F3EE', color: '#1A1F36' },
  { id: 10, label: 'Guest Lectures',          bg: '#FFFFFF', color: '#1A1F36' },
  { id: 11, label: 'Student Achievements',    bg: '#F5F3EE', color: '#1A1F36' },
  { id: 12, label: 'Centre of Excellence',    bg: '#1E2D5A', color: '#fff' },
  { id: 13, label: 'Staff Achievements',      bg: '#FFFFFF', color: '#1A1F36' },
  { id: 14, label: 'FDP / STTP',             bg: '#F5F3EE', color: '#1A1F36' },
  { id: 15, label: 'Publications',            bg: '#FFFFFF', color: '#1A1F36' },
];

function PageCard({ page, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 cursor-pointer transition-all ${isActive ? 'ring-2 ring-navy' : 'hover:ring-1 hover:ring-rule'}`}
      style={{ width: 80 }}
    >
      <div
        className="w-full rounded-sm shadow-sm flex flex-col items-center justify-center"
        style={{ aspectRatio: '3/4', backgroundColor: page.bg }}
      >
        <div className="p-1 text-center">
          <div className="w-6 h-0.5 mx-auto mb-1 opacity-30" style={{ backgroundColor: page.color }} />
          <p className="text-[6px] font-bold leading-tight opacity-50" style={{ color: page.color, wordBreak: 'break-word' }}>
            {page.label}
          </p>
        </div>
      </div>
      <p className="text-[9px] text-center text-draft mt-0.5">{page.id}</p>
    </div>
  );
}

export default function OnlineMagazineViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { magazines, sectionData } = useMagazine();
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const printContainerRef = useRef(null);

  const totalPages = SAMPLE_PAGES_VIEW.length;
  const page = SAMPLE_PAGES_VIEW[currentPage - 1];
  const magazine = magazines.find(m => m.id === id) || magazines[0];

  const pages = useMemo(() => {
    return generateMagazinePages(magazine, sectionData);
  }, [magazine, sectionData]);

  const changeZoom = (delta) => setZoom(z => Math.min(150, Math.max(60, z + delta)));

  const goTo = (p) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(clamped);
  };

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
    <div className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'} bg-gray-800`}>
      {/* Off-screen A4 container for 1:1 PDF printing */}
      <MagazinePrintContainer
        pages={pages}
        currentMagazine={magazine}
        containerRef={printContainerRef}
      />

      {/* Top toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-rule flex-shrink-0 flex-wrap">
        <button
          onClick={() => navigate('/faculty/magazines')}
          className="flex items-center gap-1.5 text-xs text-draft hover:text-navy font-medium transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink truncate">
            {magazine?.title || 'Reflection'} · Issue {magazine?.issueNumber || '32'}
          </p>
          <p className="text-[10px] text-draft">{magazine?.period} · {magazine?.department}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          {showSearch && (
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in magazine…"
              className="w-40 text-xs px-2.5 py-1.5 border border-rule rounded-sm focus:outline-none focus:border-navy"
              onBlur={() => { if (!search) setShowSearch(false); }}
            />
          )}
          <button onClick={() => setShowSearch(s => !s)} className="p-1.5 border border-rule rounded-sm hover:bg-paper transition-colors" title="Search">
            <svg className="w-4 h-4 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button onClick={() => changeZoom(-10)} className="p-1.5 border border-rule rounded-sm hover:bg-paper transition-colors text-draft font-bold text-sm">−</button>
            <span className="text-xs text-draft font-mono w-10 text-center">{zoom}%</span>
            <button onClick={() => changeZoom(10)} className="p-1.5 border border-rule rounded-sm hover:bg-paper transition-colors text-draft font-bold text-sm">+</button>
          </div>

          {/* Fullscreen */}
          <button onClick={() => setFullscreen(f => !f)} className="p-1.5 border border-rule rounded-sm hover:bg-paper transition-colors" title="Fullscreen">
            <svg className="w-4 h-4 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {fullscreen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              }
            </svg>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isGeneratingPdf ? 'Generating PDF...' : '↓ Download PDF'}
          </button>
        </div>
      </header>

      {/* Main reading area */}
      <div className="flex flex-1 min-h-0">
        {/* Left nav arrow */}
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
          className="hidden md:flex w-12 flex-shrink-0 items-center justify-center text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Page display */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-6">
          <div
            className="bg-white shadow-2xl transition-all duration-200 overflow-hidden"
            style={{
              width: `${Math.min(500 * zoom / 100, window.innerWidth - 160)}px`,
              aspectRatio: '3/4',
            }}
          >
            {/* Simulated page content */}
            <div
              className="w-full h-full flex flex-col"
              style={{ backgroundColor: page.bg, color: page.color }}
            >
              {currentPage === 1 ? (
                // Cover
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
                  <div className="w-20 h-px opacity-30 mb-2" style={{ backgroundColor: page.color }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">MES Wadia COE</p>
                  <p className="text-[10px] opacity-40">Department of Computer Engineering</p>
                  <h1 className="font-serif text-3xl font-bold text-center">{magazine?.title || 'Reflection'}</h1>
                  <p className="text-sm opacity-60">Issue {magazine?.issueNumber || '32'}</p>
                  <div className="w-20 h-px opacity-30" style={{ backgroundColor: page.color }} />
                  <p className="text-[9px] opacity-40 text-center italic max-w-xs">
                    {magazine?.tagline || 'Knowledge grows when it is shared with others'}
                  </p>
                  <div className="mt-4">
                    <p className="text-[9px] opacity-50 text-center">{magazine?.period}</p>
                    <p className="text-[9px] opacity-50 text-center">{magazine?.academicYear}</p>
                  </div>
                </div>
              ) : (
                // Interior page
                <div className="w-full h-full p-8 flex flex-col">
                  <div className="mb-4 pb-2 border-b-2" style={{ borderColor: page.color + '33' }}>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-50 mb-1">{page.label}</p>
                    <h2 className="font-serif text-lg font-bold leading-tight">{page.label}</h2>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-2 rounded opacity-20" style={{ backgroundColor: page.color, width: '90%' }} />
                    <div className="h-2 rounded opacity-15" style={{ backgroundColor: page.color, width: '75%' }} />
                    <div className="h-2 rounded opacity-10" style={{ backgroundColor: page.color, width: '85%' }} />
                    <div className="h-2 rounded opacity-20" style={{ backgroundColor: page.color, width: '60%' }} />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="h-20 rounded-sm opacity-10" style={{ backgroundColor: page.color }} />
                      <div className="h-20 rounded-sm opacity-10" style={{ backgroundColor: page.color }} />
                    </div>
                    <div className="h-2 rounded opacity-15" style={{ backgroundColor: page.color, width: '80%' }} />
                    <div className="h-2 rounded opacity-10" style={{ backgroundColor: page.color, width: '70%' }} />
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-2 opacity-30" style={{ borderTop: `1px solid ${page.color}22` }}>
                    <p className="text-[8px]">{magazine?.title || 'Reflection'} · Issue {magazine?.issueNumber}</p>
                    <p className="text-[8px]">{currentPage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right nav arrow */}
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="hidden md:flex w-12 flex-shrink-0 items-center justify-center text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Bottom thumbnail strip */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {/* Page counter */}
          <div className="flex-shrink-0 flex items-center gap-2 text-white mr-2">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={e => goTo(parseInt(e.target.value))}
              className="w-10 bg-gray-700 text-white text-xs text-center rounded px-1 py-0.5 border-none outline-none"
            />
            <span className="text-gray-400 text-xs">/ {totalPages}</span>
          </div>

          {/* Thumbnails */}
          {SAMPLE_PAGES_VIEW.map((p, i) => (
            <PageCard
              key={p.id}
              page={p}
              isActive={currentPage === i + 1}
              onClick={() => setCurrentPage(i + 1)}
            />
          ))}
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-t border-rule">
        <button onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} className="btn-secondary text-xs py-1.5 px-4 disabled:opacity-40">← Prev</button>
        <span className="text-xs text-draft">{currentPage} / {totalPages}</span>
        <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} className="btn-primary text-xs py-1.5 px-4 disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
