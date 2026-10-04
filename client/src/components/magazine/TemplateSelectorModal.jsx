import React from 'react';
import { MAGAZINE_TEMPLATES } from '../../utils/magazineTemplates';

/**
 * Visual Mini Preview for each Template
 * Visually depicts the distinctive typography, image placement, section heading,
 * page structure, and spacing of each design.
 */
function TemplateMiniPreview({ templateId }) {
  if (templateId === 'modern-academic') {
    return (
      <div className="w-full h-36 bg-white border border-slate-200 rounded-xs p-2.5 flex flex-col justify-between overflow-hidden shadow-xs">
        {/* Header */}
        <div className="border-b border-[#1E2D5A] pb-1">
          <div className="flex items-center justify-between">
            <span className="text-[6px] font-bold text-[#1E2D5A] uppercase tracking-wider font-sans">Computer Engineering</span>
            <span className="text-[5px] text-slate-400 font-mono">Vol. 32</span>
          </div>
          <p className="text-[8.5px] font-serif font-bold text-slate-900 leading-tight">STUDENT ACHIEVEMENTS</p>
        </div>
        {/* Content: structured grid with photo + article */}
        <div className="flex gap-1.5 items-start my-1 flex-1">
          <div className="w-10 h-11 bg-slate-100 border border-slate-200 rounded-xs flex flex-col items-center justify-center flex-shrink-0 text-[5px] text-slate-400">
            [Photo]
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="h-1.5 w-3/4 bg-slate-800 rounded-2xs" />
            <div className="h-1 w-full bg-slate-200 rounded-2xs" />
            <div className="h-1 w-5/6 bg-slate-200 rounded-2xs" />
            <div className="h-1 w-2/3 bg-slate-200 rounded-2xs" />
          </div>
        </div>
        {/* Triple thumbnail row */}
        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100">
          <div className="h-4 bg-slate-100 rounded-2xs border border-slate-200 text-[4px] text-center flex items-center justify-center text-slate-400">Event</div>
          <div className="h-4 bg-slate-100 rounded-2xs border border-slate-200 text-[4px] text-center flex items-center justify-center text-slate-400">Lab</div>
          <div className="h-4 bg-slate-100 rounded-2xs border border-slate-200 text-[4px] text-center flex items-center justify-center text-slate-400">Project</div>
        </div>
      </div>
    );
  }

  if (templateId === 'editorial') {
    return (
      <div className="w-full h-36 bg-[#FAF8F5] border border-[#E5DFD5] p-2.5 flex flex-col justify-between overflow-hidden">
        {/* Large Editorial Headline */}
        <div className="text-center pb-1">
          <p className="text-[5px] tracking-widest text-[#4A1525] uppercase font-serif">Feature Story</p>
          <h4 className="text-[10px] font-serif font-bold text-[#4A1525] tracking-tight leading-none uppercase mt-0.5">
            ACHIEVEMENTS
          </h4>
          <div className="w-6 h-px bg-[#4A1525] mx-auto mt-1" />
        </div>
        {/* Large Centered Photo Layout */}
        <div className="h-12 bg-[#F2ECE4] border border-[#D5C7B8] flex items-center justify-center text-[5px] font-serif text-[#4A1525] relative">
          <span>[ LARGE PHOTO ]</span>
        </div>
        {/* Editorial Pull Quote & Text */}
        <div className="border-l-2 border-[#4A1525] pl-1.5 py-0.5 mt-1 bg-[#F5EFEB]">
          <p className="text-[6px] font-serif italic text-slate-800 leading-snug">
            "Excellence recognized across national domains."
          </p>
        </div>
        <div className="flex justify-between items-center text-[5px] font-serif text-[#4A1525] opacity-75 mt-0.5">
          <span>Reflection Editorial</span>
          <span>p. 07</span>
        </div>
      </div>
    );
  }

  if (templateId === 'minimal') {
    return (
      <div className="w-full h-36 bg-white border border-slate-100 p-2.5 flex flex-col justify-between overflow-hidden">
        {/* Air & whitespace header */}
        <div className="pb-1 border-b border-slate-100 flex items-baseline justify-between">
          <h4 className="text-[8px] font-sans font-light tracking-wider text-slate-800">
            Achievements
          </h4>
          <span className="text-[5px] font-mono text-slate-400">07</span>
        </div>
        {/* High whitespace single card */}
        <div className="flex-1 flex flex-col justify-center py-1">
          <div className="border border-slate-100 bg-slate-50/50 p-1.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0" />
              <div className="space-y-0.5 flex-1">
                <div className="h-1 w-2/3 bg-slate-800 rounded-2xs" />
                <div className="h-0.5 w-1/2 bg-slate-300 rounded-2xs" />
              </div>
            </div>
            <div className="h-0.5 w-full bg-slate-200 rounded-2xs" />
            <div className="h-0.5 w-4/5 bg-slate-200 rounded-2xs" />
          </div>
        </div>
        <div className="flex justify-between text-[4.5px] font-mono text-slate-400">
          <span>MINIMALIST PREVIEW</span>
          <span>A4 FORMAT</span>
        </div>
      </div>
    );
  }

  if (templateId === 'campus-creative') {
    return (
      <div className="w-full h-36 bg-white border border-sky-100 rounded-xs p-2.5 flex flex-col justify-between overflow-hidden shadow-xs">
        {/* Dynamic header with tag */}
        <div className="flex items-center justify-between pb-1 border-b-2 border-sky-500">
          <span className="text-[6px] font-bold bg-sky-100 text-sky-800 px-1 py-0.5 rounded-full">
            CAMPUS HIGHLIGHTS
          </span>
          <span className="text-[6px] text-sky-600 font-bold">#2026</span>
        </div>
        {/* Energetic 2-column image + card grid */}
        <div className="grid grid-cols-2 gap-1.5 my-1 flex-1">
          <div className="bg-sky-50 border border-sky-100 rounded-xs p-1 flex flex-col justify-between">
            <div className="h-6 bg-sky-200/60 rounded-xs flex items-center justify-center text-[5px] text-sky-800 font-bold">
              [Activity]
            </div>
            <div className="h-1 w-3/4 bg-sky-700 rounded-2xs mt-1" />
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xs p-1 flex flex-col justify-between">
            <div className="h-6 bg-amber-200/60 rounded-xs flex items-center justify-center text-[5px] text-amber-900 font-bold">
              [Hackathon]
            </div>
            <div className="h-1 w-3/4 bg-amber-800 rounded-2xs mt-1" />
          </div>
        </div>
        <div className="text-[5px] font-bold text-sky-700 uppercase flex items-center justify-between">
          <span>Student Showcase</span>
          <span>★★★★★</span>
        </div>
      </div>
    );
  }

  // institutional-premium
  return (
    <div className="w-full h-36 bg-[#FCFDFD] border-2 border-[#1B365D]/30 p-2.5 flex flex-col justify-between overflow-hidden shadow-xs">
      {/* Formal University Crest & Double Rule */}
      <div className="text-center pb-1 border-b-2 border-[#1B365D] border-double">
        <div className="w-3 h-3 mx-auto rounded-full bg-[#1B365D] flex items-center justify-center text-amber-300 text-[5px] font-bold mb-0.5">
          ✦
        </div>
        <p className="text-[5px] tracking-widest text-[#1B365D] font-serif uppercase">
          Departmental Annual Record
        </p>
        <p className="text-[8px] font-serif font-bold text-[#1B365D] uppercase tracking-wider">
          ACADEMIC DISTINCTIONS
        </p>
      </div>
      {/* Stately double-framed card */}
      <div className="border border-[#1B365D]/20 bg-amber-50/20 p-1.5 my-1 flex items-center gap-1.5">
        <div className="w-7 h-8 border border-[#D4AF37] bg-white flex items-center justify-center text-[4px] text-[#1B365D] font-serif">
          Seal
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="h-1.5 w-4/5 bg-[#1B365D] rounded-2xs" />
          <div className="h-1 w-full bg-[#1B365D]/30 rounded-2xs" />
          <div className="h-1 w-2/3 bg-[#D4AF37] rounded-2xs" />
        </div>
      </div>
      <div className="flex justify-between items-center text-[5px] font-serif text-[#1B365D] uppercase tracking-wider">
        <span>Formal University Issue</span>
        <span>Page 07</span>
      </div>
    </div>
  );
}

/**
 * TemplateSelectorGrid
 * The card layout showing the 5 templates with visual mini previews and selection state.
 */
export function TemplateSelectorGrid({ selectedTemplate, onSelectTemplate }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {MAGAZINE_TEMPLATES.map((tmpl) => {
        const isSelected = (selectedTemplate || 'modern-academic') === tmpl.id;

        return (
          <div
            key={tmpl.id}
            onClick={() => onSelectTemplate?.(tmpl.id)}
            className={`cursor-pointer rounded-sm p-3.5 flex flex-col transition-all duration-200 relative ${
              isSelected
                ? 'ring-2 ring-navy bg-blue-50/40 border-navy shadow-md'
                : 'border border-rule bg-white hover:border-navy/60 hover:shadow-sm'
            }`}
          >
            {/* Top Tag & Selection Indicator */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-bold text-navy uppercase tracking-wider px-1.5 py-0.5 bg-paper rounded border border-rule">
                {tmpl.tag}
              </span>
              {isSelected ? (
                <span className="text-xs font-bold text-pass flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  <svg className="w-3.5 h-3.5 text-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Selected
                </span>
              ) : (
                <span className="text-[11px] text-draft font-medium hover:text-navy">
                  Click to select
                </span>
              )}
            </div>

            {/* Visual Mini Preview Demonstration */}
            <div className="mb-3 rounded-sm overflow-hidden bg-paper/50">
              <TemplateMiniPreview templateId={tmpl.id} />
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col">
              <h3 className="font-serif text-base font-bold text-ink flex items-center justify-between">
                {tmpl.name}
              </h3>
              <p className="text-[11px] font-medium text-navy/80 mt-0.5">
                {tmpl.styleName}
              </p>
              <p className="text-xs text-draft mt-1.5 line-clamp-2 leading-relaxed">
                {tmpl.description}
              </p>
            </div>

            {/* Select button */}
            <div className="mt-3 pt-2.5 border-t border-rule/60">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTemplate?.(tmpl.id);
                }}
                className={`w-full py-1.5 px-3 text-xs font-semibold rounded-sm transition-colors ${
                  isSelected
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-white border border-rule text-draft hover:text-navy hover:border-navy'
                }`}
              >
                {isSelected ? '✓ Selected Design' : 'Select This Design'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * TemplateSelectorModal
 * Dialog modal allowing faculty to switch templates anytime without altering content.
 */
export default function TemplateSelectorModal({ isOpen, onClose, selectedTemplate, onSelectTemplate }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-sm border border-rule max-w-4xl w-full p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-rule pb-4 mb-4 flex-shrink-0">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Choose Magazine Design</h2>
            <p className="text-xs text-draft mt-1">
              Select a design theme for your magazine. You can change it later. Your content, students, and events remain intact.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-draft hover:text-ink rounded-sm hover:bg-paper transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <TemplateSelectorGrid
            selectedTemplate={selectedTemplate}
            onSelectTemplate={(id) => {
              onSelectTemplate?.(id);
            }}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-rule pt-4 mt-4 flex-shrink-0">
          <span className="text-xs text-draft">
            Theme applies to all 15 pages in browser preview and generated A4 PDF.
          </span>
          <button
            onClick={onClose}
            className="btn-primary text-xs py-1.5 px-4"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
