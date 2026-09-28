import React from 'react';
import { useMagazine, MAGAZINE_SECTIONS } from '../../contexts/MagazineContext';

function StatusIcon({ status }) {
  if (status === 'completed') {
    return (
      <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full bg-pass text-white text-[9px] font-bold">
        ✓
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border-2 border-navy bg-white">
        <span className="w-1.5 h-1.5 rounded-full bg-navy" />
      </span>
    );
  }
  return (
    <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full border border-rule bg-white" />
  );
}

export default function SectionSidebar({ onSave, onOpenDesign }) {
  const { activeSection, setActiveSection, sectionStatus, completedCount, saveDraft } = useMagazine();

  return (
    <aside className="flex flex-col h-full bg-white border-r border-rule">
      {/* Panel header */}
      <div className="px-4 py-4 border-b border-rule">
        <p className="text-[10px] font-bold text-navy uppercase tracking-widest">Magazine Sections</p>
      </div>

      {/* Section list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {MAGAZINE_SECTIONS.map((section, idx) => {
          const status = activeSection === section.id
            ? 'active'
            : (sectionStatus[section.id] === 'completed' ? 'completed' : 'pending');
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-blue-50 border-l-2 border-navy text-navy'
                  : 'text-draft hover:bg-paper border-l-2 border-transparent'
              }`}
            >
              <StatusIcon status={status} />
              <span className={`text-xs font-medium flex-1 min-w-0 ${isActive ? 'text-navy font-semibold' : ''}`}>
                {idx + 1}. {section.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Progress + Design Theme + Save Draft */}
      <div className="p-4 border-t border-rule space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-draft uppercase tracking-widest">Progress</p>
            <p className="text-[10px] font-semibold text-ink">{completedCount} / {MAGAZINE_SECTIONS.length}</p>
          </div>
          <div className="w-full h-1.5 bg-rule rounded-full overflow-hidden">
            <div
              className="h-full bg-navy rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / MAGAZINE_SECTIONS.length) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-draft mt-1">
            {MAGAZINE_SECTIONS.length - completedCount} section{MAGAZINE_SECTIONS.length - completedCount !== 1 ? 's' : ''} remaining
          </p>
        </div>

        {onOpenDesign && (
          <button
            type="button"
            onClick={onOpenDesign}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 bg-blue-50/70 border border-navy/20 text-navy font-semibold rounded-sm hover:bg-blue-100/70 transition-colors"
            title="Choose or switch magazine template design"
          >
            <svg className="w-3.5 h-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            Change Design Theme
          </button>
        )}

        <button
          onClick={() => { saveDraft(); onSave?.(); }}
          className="w-full btn-secondary text-xs py-2 justify-center"
        >
          Save Draft
        </button>
      </div>
    </aside>
  );
}
