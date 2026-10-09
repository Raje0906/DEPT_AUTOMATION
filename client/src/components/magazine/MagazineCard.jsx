import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_BADGE = {
  Published:    'badge-published',
  'Under Review': 'badge-submitted',
  Draft:        'badge-draft',
  Archived:     'badge-not-started',
};

// Minimal magazine cover thumbnail rendered with CSS
function CoverThumb({ magazine }) {
  const bg = magazine.coverColor || '#1E2D5A';
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1 text-white relative overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      {/* decorative lines */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 right-0 h-px bg-white" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white" />
        <div className="absolute top-6 left-0 right-0 h-px bg-white" />
      </div>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 font-serif">Reflection</p>
      <p className="text-lg font-serif font-bold leading-none">#{magazine.issueNumber}</p>
      <p className="text-[8px] uppercase tracking-wider opacity-60 mt-0.5">
        {magazine.period?.split(' – ')[0] || ''}
      </p>
    </div>
  );
}

export default function MagazineCard({ magazine, onEdit }) {
  const navigate = useNavigate();
  const badgeClass = STATUS_BADGE[magazine.status] || 'badge-draft';

  return (
    <div className="bg-white border border-rule rounded-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Cover thumbnail */}
      <div className="h-36 border-b border-rule rounded-t-sm overflow-hidden">
        <CoverThumb magazine={magazine} />
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-[10px] font-mono font-bold text-navy uppercase tracking-wider">
              Issue {magazine.issueNumber}
            </p>
            <h2 className="font-serif text-lg font-bold text-ink leading-snug mt-0.5">
              {magazine.title}
            </h2>
          </div>
          <span className={`${badgeClass} flex-shrink-0 mt-1`}>{magazine.status}</span>
        </div>

        <p className="text-xs text-draft mb-1">
          <span className="font-semibold text-ink">Period:</span> {magazine.period}
        </p>
        <p className="text-xs text-draft mb-1">
          <span className="font-semibold text-ink">Dept:</span> {magazine.department}
        </p>
        {magazine.publishedDate && (
          <p className="text-xs text-draft mb-1">
            <span className="font-semibold text-ink">Published:</span>{' '}
            {new Date(magazine.publishedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-rule flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/faculty/magazines/view/${magazine.id}`)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            View Magazine
          </button>
          {(magazine.status === 'Draft' || magazine.status === 'Under Review') && (
            <button
              onClick={() => onEdit ? onEdit(magazine) : navigate(`/faculty/magazines/editor/${magazine.id}`)}
              className="btn-ghost text-xs px-3 py-1.5 border border-rule"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => navigate(`/faculty/magazines/preview/${magazine.id}`)}
            className="btn-ghost text-xs px-3 py-1.5 border border-rule"
            title="Open preview to generate PDF"
          >
            ↓ PDF
          </button>
        </div>
      </div>
    </div>
  );
}
