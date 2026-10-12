import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMagazine, normalizeToppersData } from '../../contexts/MagazineContext';
import { groupToppersByClassAndDivision, formatClassLabel, sortToppers } from '../../utils/toppersUtils';
import { getTemplate } from '../../utils/magazineTemplates';

// ── Template Components ──────────────────────────────────────────────────────

function CoverPage({ data, theme = getTemplate('modern-academic') }) {
  const overlay = data?.coverOverlay || data?.overlay || {
    type: 'none',
    color: '#000000',
    opacity: 0,
    gradientStart: theme.accentColor || '#1E2D5A',
    gradientEnd: '#0D1B2A',
  };

  const opacity = typeof overlay.opacity === 'number' ? overlay.opacity / 100 : (parseFloat(overlay.opacity) || 0) / 100;
  const hasOverlay = data?.coverImage && overlay.type !== 'none' && opacity > 0;

  const overlayStyle = hasOverlay
    ? overlay.type === 'solid'
      ? { backgroundColor: overlay.color || '#000000', opacity }
      : { backgroundImage: `linear-gradient(to bottom, ${overlay.gradientStart || theme.accentColor}, ${overlay.gradientEnd || '#0D1B2A'})`, opacity }
    : null;

  const defaultBgColor = theme.id === 'editorial' ? '#38101C' : theme.accentColor || '#1E2D5A';

  return (
    <div
      className={`w-full h-full flex flex-col relative overflow-hidden ${theme.fontBody}`}
      style={{
        backgroundColor: defaultBgColor,
        backgroundImage: data?.coverImage ? `url(${data.coverImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#fff',
      }}
    >
      {/* Optional Overlay Layer */}
      {hasOverlay && (
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity"
          style={overlayStyle}
        />
      )}

      {/* Decorative Template Frame */}
      {theme.id === 'institutional-premium' && (
        <div className="absolute inset-4 border-2 border-amber-300/40 pointer-events-none z-10" />
      )}
      {theme.id === 'editorial' && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-200/40 pointer-events-none z-10" />
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-4 relative z-10">
        {data?.collegeLogo && (
          <div className="mb-2 max-h-16 max-w-[150px] flex items-center justify-center p-1.5 bg-white/95 rounded-sm shadow-sm">
            <img src={data.collegeLogo} alt="College Logo" className="max-h-12 max-w-full object-contain" />
          </div>
        )}

        {/* Template-specific Badge / Subtitle */}
        {theme.id === 'institutional-premium' && (
          <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-300/60 flex items-center justify-center text-amber-200 text-xs font-serif font-bold">
            ✦
          </div>
        )}

        {theme.id === 'campus-creative' && (
          <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full border border-white/30 text-white">
            CAMPUS EDITION
          </span>
        )}

        <div className="w-20 h-px bg-white opacity-40" />
        <p className="text-[13px] font-bold uppercase tracking-widest opacity-85">
          MES Wadia COE · {data?.department || 'Computer Engineering'}
        </p>
        
        <h1 className={`${theme.fontHeading} text-5xl font-extrabold text-center leading-tight tracking-tight`}>
          {data?.title || 'Reflection'}
        </h1>
        
        <p className="text-lg opacity-90 font-semibold tracking-wide">
          Issue {data?.issueNumber || 'XX'}
        </p>
        <div className="w-20 h-px bg-white opacity-40" />
        
        <p className="text-[14.5px] opacity-80 text-center px-6 italic max-w-lg leading-relaxed">
          {data?.tagline || ''}
        </p>
      </div>

      <div className="px-10 py-6 border-t border-white border-opacity-20 flex items-center justify-between relative z-10">
        <p className="text-sm opacity-85 font-medium">{data?.period || ''}</p>
        <p className="text-sm opacity-85 font-mono font-medium">{data?.academicYear || ''}</p>
      </div>
    </div>
  );
}

function ArticlePage({ data, theme = getTemplate('modern-academic') }) {
  const isEditorial = theme.id === 'editorial';
  const isMinimal = theme.id === 'minimal';
  const isCampus = theme.id === 'campus-creative';
  const isInstitutional = theme.id === 'institutional-premium';

  return (
    <div
      className={`w-full h-full p-9 pb-12 flex flex-col justify-between ${theme.fontBody}`}
      style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}
    >
      <div>
        {/* Header section styled by active template */}
        <div className={`mb-5 pb-3 ${theme.headerDivider}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
              {data?.section || 'Section'}
            </span>
            {isInstitutional && (
              <span className="text-[10px] font-serif text-[#1B365D] uppercase tracking-widest font-bold">
                Official Publication
              </span>
            )}
          </div>
          <h2 className={`${theme.fontHeading} text-3xl font-bold text-ink leading-tight mt-1.5`}>
            {data?.title || 'Article Title'}
          </h2>
          {data?.subtitle && <p className="text-sm text-draft mt-1 font-medium">{data.subtitle}</p>}
        </div>

        {/* Author Card or Hero Image */}
        {data?.image && (
          data?.author ? (
            <div className={`mb-4 flex items-center gap-4 p-3.5 ${theme.cardStyle} flex-shrink-0`}>
              <img
                src={data.image}
                alt={data.author}
                className={`w-28 h-32 object-cover flex-shrink-0 ${isCampus ? 'rounded-md shadow-sm' : isMinimal ? 'rounded-none' : 'rounded-sm border border-rule'}`}
              />
              <div className="flex-1">
                <h3 className={`${theme.fontHeading} text-lg font-bold text-ink`}>{data.author}</h3>
                <p className="text-sm text-draft font-medium mt-1 leading-snug">{data.designation}</p>
                {isEditorial && (
                  <p className="text-xs text-[#4A1525] font-serif italic mt-1.5 opacity-90">
                    "Leading innovation, academic distinction, and research mentorship."
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className={`mb-4 h-48 ${theme.cardStyle} overflow-hidden flex items-center justify-center flex-shrink-0`}>
              <img src={data.image} alt="" className="w-full h-full object-cover" />
            </div>
          )
        )}

        {/* Pull quote for editorial & campus styles if article has paragraphs */}
        {isEditorial && (data?.paragraphs?.length > 1) && (
          <div className={`my-2 ${theme.quoteStyle}`}>
            <p>"{data.paragraphs[0]}"</p>
          </div>
        )}

        {/* Article Body Paragraphs */}
        <div className="space-y-3.5">
          {(data?.paragraphs || ['Department activities and accomplishments for the academic semester.'])
            .slice(isEditorial && data?.paragraphs?.length > 1 ? 1 : 0)
            .map((p, i) => (
              <p key={i} className={`text-[14.5px] text-ink leading-relaxed ${isMinimal ? 'text-left tracking-wide' : 'text-justify'}`}>
                {p}
              </p>
          ))}
        </div>
      </div>

      {/* Footer author stamp if no image */}
      {data?.author && !data?.image && (
        <div className={`mt-4 pt-3 border-t border-rule flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-bold text-ink ${theme.fontHeading}`}>{data.author}</p>
            {data?.designation && <p className="text-xs text-draft">{data.designation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function TwoColumnPage({ data, theme = getTemplate('modern-academic') }) {
  return (
    <div className={`w-full h-full p-9 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div>
        <div className={`mb-4 pb-2 ${theme.headerDivider}`}>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink`}>{data?.title || 'Title'}</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[0, 1].map(col => (
            <div key={col} className="space-y-3">
              <p className="text-[14px] text-ink leading-relaxed text-justify">
                {data?.columns?.[col] || 'Column content goes here.'}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Academic Documentation</span>
      </div>
    </div>
  );
}

function PhotoGridPage({ data, theme = getTemplate('modern-academic') }) {
  const photos = data?.photos || [];

  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Gallery Archive
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Photo Gallery'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
        {data?.part && data?.totalParts && (
          <span className="text-xs font-semibold text-draft px-2 py-0.5 bg-paper rounded border border-rule">
            Part {data.part} of {data.totalParts}
          </span>
        )}
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 py-2">
        {(photos.length ? photos : Array(4).fill(null)).map((ph, i) => (
          <div key={i} className={`${theme.cardStyle} overflow-hidden flex flex-col justify-between p-2.5 bg-paper/30 border border-rule/70 shadow-2xs`}>
            <div className="w-full h-44 overflow-hidden rounded-xs flex items-center justify-center bg-paper border border-rule/40 flex-shrink-0">
              {ph?.url ? (
                <img src={ph.url} alt={ph.caption || ''} className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-draft opacity-50 font-medium">Photo {i + 1}</div>
              )}
            </div>
            <div className="pt-2 px-1 flex flex-col gap-1 min-h-[46px] justify-center">
              {(ph?.date || ph?.venue) && (
                <div className="flex items-center gap-2 text-[11px] text-draft font-medium flex-wrap">
                  {ph.date && <span>📅 {ph.date}</span>}
                  {ph.venue && <span>📍 {ph.venue}</span>}
                </div>
              )}
              <p className="text-xs font-semibold text-ink leading-snug">
                {ph?.caption || ph?.eventTitle || 'Campus Event Moment'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>MES Wadia COE · Department of Computer Engineering</span>
        <span>Campus Life & Photographic Record</span>
      </div>
    </div>
  );
}

function TablePage({ data, theme = getTemplate('modern-academic') }) {
  const rows = data?.rows || [];
  const cols = data?.columns || ['Sr.', 'Faculty Name', 'Activity', 'Organization', 'Mode'];

  const renderCell = (colName, val) => {
    if (colName === 'Mode') {
      if (val === 'Online') return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-pass border border-green-200">Online</span>;
      if (val === 'Offline') return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-navy border border-blue-200">Offline</span>;
      if (val === 'Hybrid') return <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Hybrid</span>;
    }
    return val;
  };

  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div>
        <div className={`mb-4 pb-2.5 ${theme.headerDivider} flex items-center justify-between`}>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
              Faculty Development
            </span>
            <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink mt-1`}>{data?.title || 'Table'}</h2>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Record Summary
          </span>
        </div>
        <div className="overflow-hidden border border-rule rounded-sm shadow-2xs">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {cols.map(c => (
                  <th
                    key={c}
                    className="px-3 py-2.5 text-left font-bold uppercase tracking-wide border-b-2 text-[11px]"
                    style={{
                      color: theme.accentColor || '#1E2D5A',
                      borderColor: theme.accentColor || '#1E2D5A',
                      backgroundColor: theme.id === 'editorial' ? '#F5EFEB' : theme.id === 'campus-creative' ? '#F0F9FF' : '#F1F5F9',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows.length ? rows : Array(5).fill(null)).map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-paper/40'}>
                  {cols.map((c, j) => (
                    <td key={j} className="px-3 py-2.5 border-b border-rule text-ink leading-relaxed text-[12px]">
                      {renderCell(c, row?.[j] || (j === 0 ? i + 1 : '—'))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Faculty Continuous Professional Development</span>
      </div>
    </div>
  );
}

function EventsPage({ data, theme = getTemplate('modern-academic') }) {
  const events = data?.events || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Department Events
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Department Events'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2 gap-3.5">
        {events.map((ev, idx) => {
          const photoUrl = typeof ev.photos?.[0] === 'string' ? ev.photos[0] : ev.photos?.[0]?.url;
          return (
            <div key={ev.id || idx} className={`${theme.cardStyle} p-4 bg-paper/30 flex flex-col gap-2.5 border border-rule/70 shadow-2xs`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2 flex-wrap min-h-[28px] overflow-visible">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[26px] inline-flex items-center rounded bg-navy text-white leading-normal shadow-2xs">
                      {ev.date || 'Academic Year'}
                    </span>
                    {ev.venue && (
                      <span className="text-xs text-ink/80 font-medium bg-white px-2.5 py-1 min-h-[26px] inline-flex items-center rounded border border-rule leading-normal shadow-2xs">
                        📍 {ev.venue}
                      </span>
                    )}
                    {ev.participants && (
                      <span className="text-xs font-semibold text-pass bg-green-50 px-2.5 py-1 min-h-[26px] inline-flex items-center rounded border border-green-200 leading-normal shadow-2xs">
                        👥 {ev.participants} Participants
                      </span>
                    )}
                  </div>
                  <h3 className={`${theme.fontHeading} text-base font-bold text-ink leading-snug`}>
                    {ev.title}
                  </h3>
                  {ev.organizer && (
                    <p className="text-xs text-draft font-medium mt-1">
                      Organized by: <span className="text-ink font-semibold">{ev.organizer}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3.5 items-center">
                {photoUrl && (
                  <div className="w-36 h-28 flex-shrink-0 overflow-hidden rounded border border-rule bg-paper shadow-2xs">
                    <img src={photoUrl} alt={ev.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="flex-1 text-[13.5px] text-ink leading-relaxed text-justify">
                  {ev.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>MES Wadia COE · Department of Computer Engineering</span>
        <span>Event Highlights & Campus Initiatives</span>
      </div>
    </div>
  );
}

function WorkshopsPage({ data, theme = getTemplate('modern-academic') }) {
  const workshops = data?.workshops || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Student Workshops
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Technical Workshops'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2 gap-4">
        {workshops.map((w, idx) => {
          const photoUrl = typeof w.photos?.[0] === 'string' ? w.photos[0] : w.photos?.[0]?.url;
          return (
            <div key={w.id || idx} className={`${theme.cardStyle} p-4 bg-paper/30 flex flex-col gap-2.5 border border-rule/70 shadow-2xs`}>
              <div className="flex items-center justify-between gap-2 flex-wrap min-h-[28px]">
                {w.date && (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 min-h-[26px] inline-flex items-center rounded bg-blue-100 text-navy border border-blue-200 leading-normal">
                    {w.date}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-xs text-draft">
                  {w.targetClass && <span className="bg-white px-2 py-0.5 rounded border border-rule font-medium">Audience: {w.targetClass}</span>}
                  {w.participants && <span className="bg-green-50 text-pass px-2 py-0.5 rounded border border-green-200 font-semibold">👥 {w.participants} Attended</span>}
                </div>
              </div>

              <h3 className={`${theme.fontHeading} text-base font-bold text-ink leading-snug`}>
                {w.title}
              </h3>

              <div className="flex items-center gap-2 p-2 bg-white rounded border border-rule/60 text-xs flex-wrap">
                <span className="font-bold text-navy text-xs">Speaker:</span>
                <span className="text-ink font-semibold text-xs">{w.speaker}</span>
                {w.designation && <span className="text-draft text-[11px]">({w.designation}, {w.organization})</span>}
              </div>

              <div className="flex gap-3.5 items-center">
                {photoUrl && (
                  <div className="w-36 h-28 flex-shrink-0 overflow-hidden rounded border border-rule bg-paper shadow-2xs">
                    <img src={photoUrl} alt={w.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="flex-1 text-[13px] text-ink leading-relaxed text-justify">
                  {w.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Hands-on Skill Development Series</span>
      </div>
    </div>
  );
}

function LecturesPage({ data, theme = getTemplate('modern-academic') }) {
  const lectures = data?.lectures || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Guest Lectures
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Guest Lectures & Keynotes'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2 gap-4">
        {lectures.map((lec, idx) => {
          const photoUrl = typeof lec.photos?.[0] === 'string' ? lec.photos[0] : lec.photos?.[0]?.url;
          return (
            <div key={lec.id || idx} className={`${theme.cardStyle} p-4 bg-paper/30 flex flex-col gap-2.5 border border-rule/70 shadow-2xs`}>
              <div className="flex items-center justify-between gap-2 flex-wrap min-h-[28px]">
                {lec.date && (
                  <span className="text-xs font-bold uppercase px-2.5 py-1 min-h-[26px] inline-flex items-center rounded bg-purple-100 text-purple-800 border border-purple-200 leading-normal">
                    {lec.date}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-xs text-draft">
                  {lec.venue && <span className="bg-white px-2 py-0.5 rounded border border-rule">📍 {lec.venue}</span>}
                  {lec.participants && <span className="bg-green-50 text-pass px-2 py-0.5 rounded border border-green-200 font-semibold">👥 {lec.participants} Students</span>}
                </div>
              </div>

              <h3 className={`${theme.fontHeading} text-base font-bold text-ink leading-snug`}>
                {lec.topic || lec.title}
              </h3>

              <div className="flex items-center gap-2 p-2 bg-white rounded border border-rule/60 text-xs flex-wrap">
                <span className="font-bold text-navy text-xs">Distinguished Speaker:</span>
                <span className="text-ink font-semibold text-xs">{lec.speaker}</span>
                {lec.designation && <span className="text-draft text-[11px]">({lec.designation}, {lec.organization})</span>}
              </div>

              <div className="flex gap-3.5 items-center">
                {photoUrl && (
                  <div className="w-36 h-28 flex-shrink-0 overflow-hidden rounded border border-rule bg-paper shadow-2xs">
                    <img src={photoUrl} alt={lec.speaker} className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="flex-1 text-[13px] text-ink leading-relaxed text-justify">
                  {lec.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Industry-Academia Keynote Series</span>
      </div>
    </div>
  );
}

function AchievementsPage({ data, theme = getTemplate('modern-academic') }) {
  const achievements = data?.achievements || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Student Laurels
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Student Achievements'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-1 gap-2.5">
        {achievements.map((a, idx) => {
          const photoUrl = a.photo;
          return (
            <div key={a.id || idx} className={`${theme.cardStyle} p-3 bg-paper/30 flex items-center gap-3.5 border border-rule/70 shadow-2xs`}>
              {photoUrl ? (
                <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-rule bg-white shadow-2xs">
                  <img src={photoUrl} alt={a.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center text-lg flex-shrink-0">
                  🏆
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-ink truncate">
                    {a.name} <span className="text-xs text-draft font-semibold">({a.class})</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-navy border border-blue-200">
                      {a.level}
                    </span>
                    {a.position && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        {a.position}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs font-bold text-navy mt-0.5">
                  {a.achievement} {a.prize ? `— ${a.prize}` : ''}
                </p>

                <p className="text-[11.5px] text-ink/90 leading-relaxed text-justify mt-0.5">
                  {a.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Student Recognition & Competitive Excellence</span>
      </div>
    </div>
  );
}

function CoEFeaturePage({ data, theme = getTemplate('modern-academic') }) {
  const coe = data?.coe || {};
  const isPart1 = data?.part === 1;

  if (isPart1) {
    return (
      <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
        <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
          <div>
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
              Centre of Excellence
            </span>
            <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
              {coe.name || 'Centre of Excellence'}
            </h2>
            {coe.partner && (
              <p className="text-sm text-navy font-semibold mt-0.5">
                Industry Partner: {coe.partner} · Established {coe.dateEstablished || '2024'}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-around py-2 gap-3">
          {coe.tagline && (
            <div className="p-2.5 bg-navy/5 border-l-4 border-navy rounded-r text-sm italic text-navy font-medium">
              "{coe.tagline}"
            </div>
          )}

          {coe.photos?.[0]?.url && (
            <div className="w-full h-44 rounded overflow-hidden border border-rule relative shadow-sm">
              <img src={coe.photos[0].url} alt="CoE Lab" className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-black/65 backdrop-blur-xs text-white text-xs px-3 py-1.5">
                {coe.photos[0].caption || 'Advanced Computing & XR Simulation Facility'}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-navy uppercase tracking-wider">About the Centre</h4>
            <p className="text-[13px] text-ink leading-relaxed text-justify">
              {coe.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded border border-rule bg-paper/40">
              <h5 className="text-xs font-bold text-navy mb-1 flex items-center gap-1.5">
                <span>🎯</span> Vision
              </h5>
              <p className="text-[12px] text-ink leading-relaxed text-justify">
                {coe.vision || 'To achieve international recognition in emerging computing architectures and spatial intelligence.'}
              </p>
            </div>
            <div className="p-3 rounded border border-rule bg-paper/40">
              <h5 className="text-xs font-bold text-navy mb-1 flex items-center gap-1.5">
                <span>🚀</span> Mission
              </h5>
              <p className="text-[12px] text-ink leading-relaxed text-justify">
                {coe.mission || 'Equip engineering students with cutting-edge industry competencies, research publications, and patented innovations.'}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
          <span>Department of Computer Engineering</span>
          <span>Centre of Excellence · Strategic Research Hub</span>
        </div>
      </div>
    );
  }

  // Part 2: Activities, Projects & Gallery
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Centre of Excellence
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            CoE Activities, Research & Student Projects
          </h2>
          <p className="text-xs text-draft font-medium mt-0.5">Applied Spatial Computing, VR Simulations & Student Capstones</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2 gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded border border-rule bg-paper/40">
            <h5 className="text-xs font-bold text-navy mb-1.5">Key Activities & Certifications</h5>
            <div className="text-[12px] text-ink leading-relaxed space-y-1">
              {(typeof coe.activities === 'string' ? coe.activities.split('\n') : []).map((line, i) => (
                <p key={i} className="text-justify">{line}</p>
              ))}
            </div>
          </div>

          <div className="p-3 rounded border border-rule bg-paper/40">
            <h5 className="text-xs font-bold text-navy mb-1.5">Achievements & Grants</h5>
            <div className="text-[12px] text-ink leading-relaxed space-y-1">
              {(typeof coe.achievements === 'string' ? coe.achievements.split('\n') : []).map((line, i) => (
                <p key={i} className="text-justify">{line}</p>
              ))}
            </div>
          </div>
        </div>

        {/* 4-Image Grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {(coe.photos?.slice(1, 5) || []).map((p, i) => (
            <div key={i} className="h-26 rounded overflow-hidden border border-rule bg-paper flex flex-col shadow-2xs">
              <img src={p.url} alt={p.caption || ''} className="w-full h-18 object-cover flex-1" />
              <p className="text-[9px] text-ink/80 truncate px-1.5 py-1 bg-white font-medium">{p.caption}</p>
            </div>
          ))}
        </div>

        {coe.futurePlans && (
          <div className="p-3 rounded border border-blue-200 bg-blue-50/50">
            <h5 className="text-xs font-bold text-navy mb-1">Future Expansion Roadmap</h5>
            <p className="text-[12px] text-ink leading-relaxed text-justify">
              {coe.futurePlans}
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Centre of Excellence · Innovation & Technology Transfer</span>
      </div>
    </div>
  );
}

function StaffAchievementsPage({ data, theme = getTemplate('modern-academic') }) {
  const staff = data?.staff || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Faculty Distinction
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Staff Achievements'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-2 gap-3">
        {staff.map((s, idx) => {
          const ach = s.achievements?.[0] || {};
          const photoUrl = ach.photo;
          return (
            <div key={s.id || idx} className={`${theme.cardStyle} p-3.5 bg-paper/30 flex gap-3.5 items-center border border-rule/70 shadow-2xs`}>
              {photoUrl ? (
                <div className="w-16 h-20 rounded border border-rule overflow-hidden flex-shrink-0 bg-white shadow-2xs">
                  <img src={photoUrl} alt={s.facultyName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-20 rounded border border-rule bg-navy/10 flex items-center justify-center text-xl flex-shrink-0">
                  🏅
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                  <div>
                    <h3 className={`${theme.fontHeading} text-sm font-bold text-ink`}>
                      {s.facultyName}
                    </h3>
                    <p className="text-xs text-draft font-medium">{s.designation}</p>
                  </div>
                  {ach.type && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                      {ach.type}
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-navy leading-snug">
                  {ach.title}
                </p>
                {ach.organization && (
                  <p className="text-xs text-draft font-medium">
                    {ach.organization} {ach.date ? `· ${ach.date}` : ''}
                  </p>
                )}

                <p className="text-[12px] text-ink leading-relaxed text-justify mt-1">
                  {ach.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Faculty Excellence & Scholarly Contributions</span>
      </div>
    </div>
  );
}

function PublicationsPage({ data, theme = getTemplate('modern-academic') }) {
  const publications = data?.publications || [];
  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 min-h-[24px] inline-flex items-center rounded-sm ${theme.badgeStyle}`}>
            Research Publications
          </span>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight mt-1`}>
            {data?.title || 'Faculty Publications'}
          </h2>
          {data?.subtitle && <p className="text-xs text-draft font-medium mt-0.5">{data.subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-around py-1 gap-2.5">
        {publications.map((p, idx) => (
          <div key={p.id || idx} className={`${theme.cardStyle} p-3 bg-paper/30 flex flex-col gap-1 border border-rule/70 shadow-2xs`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-100 text-navy border border-blue-200">
                {p.type || 'Research Paper'}
              </span>
              <span className="text-xs text-draft font-mono font-medium">
                {p.date}
              </span>
            </div>

            <h3 className={`${theme.fontHeading} text-xs font-bold text-ink leading-snug mt-0.5`}>
              "{p.title}"
            </h3>

            <p className="text-xs font-bold text-navy">
              {p.facultyName}
            </p>

            <p className="text-xs text-draft italic">
              {p.journal}
            </p>

            {p.description && (
              <p className="text-[11.5px] text-ink leading-relaxed text-justify">
                {p.description}
              </p>
            )}

            {p.doi && (
              <div className="pt-0.5 flex items-center gap-1.5">
                <a
                  href={p.url || `https://doi.org/${p.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10.5px] font-mono text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  🔗 DOI: {p.doi}
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Peer-Reviewed Scholarly Publications</span>
      </div>
    </div>
  );
}

// ── Toppers Card & Page Components ───────────────────────────────────────────

export function StudentPreviewCard({ student, index, theme = getTemplate('modern-academic') }) {
  const photo = student?.photo || student?.photoUrl;
  const displayRank = student?.rank || student?.position || index + 1;

  const rankBadgeStyle = theme.topperRankStyle?.[displayRank] || theme.topperRankStyle?.other || 'bg-blue-50 text-navy border-blue-200 font-semibold';

  return (
    <div className={`flex flex-col items-center justify-between p-3 ${theme.cardStyle} hover:shadow-sm transition-all text-center relative overflow-visible min-h-[160px] border border-rule/70 shadow-2xs`}>
      {/* Top row: Perfectly centered Rank badge with pinned Division tag */}
      <div className="relative w-full mb-1.5 flex items-center justify-center flex-shrink-0 min-h-[22px]">
        <span className={`text-[11px] font-bold px-3 py-0.5 rounded-full border shadow-2xs inline-flex items-center justify-center ${rankBadgeStyle}`}>
          Rank {displayRank}
        </span>
        {student.division && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-draft font-semibold uppercase bg-paper px-1.5 py-0.5 rounded border border-rule/50">
            Div {student.division}
          </span>
        )}
      </div>

      {/* Photo circle or placeholder */}
      <div className={`w-14 h-14 ${theme.id === 'minimal' ? 'rounded-none' : theme.id === 'campus-creative' ? 'rounded-lg' : 'rounded-full'} overflow-hidden bg-navy/10 border-2 border-rule flex items-center justify-center flex-shrink-0 my-1 shadow-2xs`}>
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
          className={`w-6 h-6 text-draft opacity-70 ${photo ? 'hidden' : 'block'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
        </svg>
      </div>

      {/* Student Name */}
      <div
        className="w-full min-h-[42px] flex items-center justify-center px-1 my-0.5"
        style={{ overflow: 'visible' }}
      >
        <p
          className={`text-[14.5px] font-bold text-ink text-center tracking-tight leading-snug ${theme.fontHeading}`}
          style={{
            overflow: 'visible',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            margin: 0,
            padding: 0,
          }}
          title={student.name}
        >
          {student.name || 'Student'}
        </p>
      </div>

      {/* CGPA */}
      <p className="text-[12.5px] font-bold font-mono mt-0.5 flex-shrink-0" style={{ color: theme.accentColor || '#1E2D5A' }}>
        {student.cgpa ? `${student.cgpa} CGPA` : '—'}
      </p>
    </div>
  );
}

function ToppersPage({ data, theme = getTemplate('modern-academic') }) {
  const divisions = data?.divisions || [];
  const totalStudents = data?.totalStudents || 0;
  const classLabel = data?.classLabel || data?.class || 'Class Toppers';
  const classYear = data?.classYear || 'SE';

  return (
    <div className={`w-full h-full p-8 pb-12 flex flex-col overflow-hidden justify-between ${theme.fontBody}`} style={{ backgroundColor: theme.backgroundColor || '#FFFFFF' }}>
      {/* Header */}
      <div className={`pb-2.5 ${theme.headerDivider} flex items-end justify-between flex-shrink-0`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.accentColor || '#1E2D5A' }}>
            Academic Excellence
          </p>
          <h2 className={`${theme.fontHeading} text-2xl font-bold text-ink leading-tight`}>
            Class Toppers — {classYear}
          </h2>
          <p className="text-xs text-draft font-medium">{classLabel}</p>
        </div>
        {totalStudents > 0 && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-sm ${theme.badgeStyle}`}>
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
        <div className="flex-1 flex flex-col justify-around py-2 gap-3.5 overflow-visible">
          {divisions.map((div) => (
            <div key={div.name} className={`${theme.cardStyle} p-3.5 bg-paper/30 border border-rule/70`}>
              {/* Division Header */}
              <div className="flex items-center justify-between border-b border-rule/60 pb-1.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.accentColor || '#1E2D5A' }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.accentColor || '#1E2D5A' }}>
                    {div.name}
                  </span>
                </div>
                <span className="text-[10px] text-draft font-semibold bg-white px-2 py-0.5 rounded border border-rule">
                  {div.students.length} Topper{div.students.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Students Grid */}
              <div className="grid grid-cols-3 gap-3.5">
                {div.students.map((student, idx) => (
                  <StudentPreviewCard key={student.id || idx} student={student} index={idx} theme={theme} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-draft opacity-80 flex-shrink-0">
        <span>Department of Computer Engineering</span>
        <span>Theme: {theme.name} · Auto-arranged by Rank</span>
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
  events: EventsPage,
  workshops: WorkshopsPage,
  lectures: LecturesPage,
  achievements: AchievementsPage,
  coe: CoEFeaturePage,
  staff: StaffAchievementsPage,
  publications: PublicationsPage,
};

// ── Unified A4 Page Sheet Component ──────────────────────────────────────────
/**
 * MagazinePageSheet
 * Single source of truth for rendering standard A4 magazine pages (794px x 1123px).
 * Shared identically by both the interactive browser preview and PDF generation.
 */
export function MagazinePageSheet({ page, pageNumber, totalPages, currentMagazine, templateId }) {
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

  const activeTemplateId = templateId || currentMagazine?.template || 'modern-academic';
  const theme = getTemplate(activeTemplateId);

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
        backgroundColor: isCover ? (theme.accentColor || '#1E2D5A') : (theme.backgroundColor || '#ffffff'),
        position: 'relative',
      }}
    >
      {/* Page Content with Theme */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <TemplateComponent data={page.data} theme={theme} />
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
            borderTop: theme.id === 'editorial' ? '1px solid #E5DFD5' : '1px solid #E2E8F0',
            paddingTop: '6px',
            fontSize: '11px',
            color: '#64748B',
            fontFamily: theme.id === 'editorial' || theme.id === 'institutional-premium' ? 'serif' : 'sans-serif',
          }}
        >
          <span>{currentMagazine?.title || 'Reflection'} · Issue {currentMagazine?.issueNumber || '33'}</span>
          <span style={{ fontWeight: 'bold', color: theme.accentColor || '#1E2D5A' }}>Page {pageNumber}</span>
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
