import React from 'react';
import { MagazinePageSheet } from './PagePreview';

/**
 * MagazinePrintContainer
 * Renders all pages of the magazine off-screen in exact standard A4 proportions (794px x 1123px).
 * Shared single source of truth between preview and PDF generation.
 */
export default function MagazinePrintContainer({ pages, currentMagazine, containerRef }) {
  if (!pages || pages.length === 0) return null;

  return (
    <div
      ref={containerRef}
      id="magazine-print-container"
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '0',
        width: '794px',
        zIndex: -1000,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {pages.map((p, index) => (
        <MagazinePageSheet
          key={p.id || index}
          page={p}
          pageNumber={index + 1}
          totalPages={pages.length}
          currentMagazine={currentMagazine}
        />
      ))}
    </div>
  );
}
