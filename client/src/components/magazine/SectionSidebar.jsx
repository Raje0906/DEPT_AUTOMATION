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

export default function SectionSidebar({ onSave }) {
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

      {/* Progress + Save Draft */}
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
