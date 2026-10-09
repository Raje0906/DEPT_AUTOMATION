import React, { useRef } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

export default function CoverEditor() {
  const { sectionData, updateSection, completeSection } = useMagazine();
  const data = sectionData.cover || {};

  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const set = (field, value) => updateSection('cover', { ...data, [field]: value });

  const handleImageFile = (file, field, label) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      set(field, e.target.result);
      toast.success(`${label} uploaded successfully.`);
    };
    reader.onerror = () => toast.error(`Failed to read ${label.toLowerCase()} file.`);
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    toast.success('Cover design updated. Preview it in the Preview tab.');
    completeSection('cover');
  };

  const overlay = data.overlay || {
    type: 'none',
    color: '#000000',
    opacity: 0,
    gradientStart: '#1E2D5A',
    gradientEnd: '#0D1B2A',
  };

  const setOverlayProp = (key, val) => {
    set('overlay', {
      ...overlay,
      [key]: val,
    });
  };

  const previewOpacity = typeof overlay.opacity === 'number' ? overlay.opacity / 100 : (parseFloat(overlay.opacity) || 0) / 100;
  const hasPreviewOverlay = data.coverImage && overlay.type !== 'none' && previewOpacity > 0;
  const previewOverlayStyle = hasPreviewOverlay
    ? overlay.type === 'solid'
      ? { backgroundColor: overlay.color || '#000000', opacity: previewOpacity }
      : { backgroundImage: `linear-gradient(to bottom, ${overlay.gradientStart || '#1E2D5A'}, ${overlay.gradientEnd || '#0D1B2A'})`, opacity: previewOpacity }
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Cover</h2>
        <p className="text-xs text-draft mt-1">
          Enter magazine cover details and upload branding assets. The system will generate a professional academic cover layout.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Magazine Title</label>
          <input
            className="input-field"
            value={data.title || ''}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Reflection"
          />
        </div>
        <div>
          <label className="input-label">Issue Number</label>
          <input
            className="input-field"
            value={data.issueNumber || ''}
            onChange={e => set('issueNumber', e.target.value)}
            placeholder="e.g. 33"
          />
        </div>
        <div>
          <label className="input-label">Academic Year</label>
          <select
            className="input-field"
            value={data.academicYear || ''}
            onChange={e => set('academicYear', e.target.value)}
          >
            <option value="">Select year</option>
            {['2026–27', '2025–26', '2024–25', '2023–24'].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Department</label>
          <select
            className="input-field"
            value={data.department || ''}
            onChange={e => set('department', e.target.value)}
          >
            {['Computer Engineering', 'Information Technology', 'AI & DS', 'Electronics & Telecommunication', 'Mechanical Engineering'].map(d => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="input-label">Tagline (optional)</label>
        <input
          className="input-field"
          value={data.tagline || ''}
          onChange={e => set('tagline', e.target.value)}
          placeholder="e.g. Knowledge grows when it is shared with others"
        />
      </div>

      {/* Upload Inputs for College Logo & Cover Image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* College Logo */}
        <div>
          <label className="input-label">College Logo</label>
          <input
            id="logo-upload-input"
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleImageFile(e.target.files?.[0], 'collegeLogo', 'College Logo');
              e.target.value = '';
            }}
          />
          {data.collegeLogo ? (
            <div className="border border-rule rounded-sm p-3 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded bg-paper border border-rule flex items-center justify-center p-1 flex-shrink-0">
                  <img src={data.collegeLogo} alt="College Logo" className="w-full h-full object-contain" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-ink truncate">College Logo Uploaded</p>
                  <p className="text-[10px] text-draft opacity-70">PNG, JPG, WEBP</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="text-xs px-2.5 py-1 border border-rule rounded-sm hover:bg-paper text-draft font-medium transition-colors"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => { set('collegeLogo', null); toast.success('Logo removed.'); }}
                  className="text-xs px-2 py-1 border border-red-200 text-fail hover:bg-red-50 rounded-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => logoInputRef.current?.click()}
              className="border border-dashed border-rule rounded-sm py-5 px-4 flex flex-col items-center gap-2 bg-paper cursor-pointer hover:border-navy transition-colors"
            >
              <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-xs text-draft font-medium">Upload College Logo</p>
              <p className="text-[10px] text-draft opacity-70">PNG, JPG or SVG recommended</p>
            </div>
          )}
        </div>

        {/* Cover Image / Background */}
        <div>
          <label className="input-label">Cover Image / Background</label>
          <input
            id="cover-upload-input"
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleImageFile(e.target.files?.[0], 'coverImage', 'Cover Image');
              e.target.value = '';
            }}
          />
          {data.coverImage ? (
            <div className="border border-rule rounded-sm p-3 bg-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded bg-paper border border-rule overflow-hidden flex-shrink-0">
                  <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-ink truncate">Cover Image Uploaded</p>
                  <p className="text-[10px] text-draft opacity-70">JPG, PNG, WEBP</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-xs px-2.5 py-1 border border-rule rounded-sm hover:bg-paper text-draft font-medium transition-colors"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => { set('coverImage', null); toast.success('Cover image removed.'); }}
                  className="text-xs px-2 py-1 border border-red-200 text-fail hover:bg-red-50 rounded-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => coverInputRef.current?.click()}
              className="border border-dashed border-rule rounded-sm py-5 px-4 flex flex-col items-center gap-2 bg-paper cursor-pointer hover:border-navy transition-colors"
            >
              <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-xs text-draft font-medium">Upload Cover Image</p>
              <p className="text-[10px] text-draft opacity-70">JPG, PNG · min 1200×1800px</p>
            </div>
          )}
        </div>
      </div>

      {/* Optional Cover Overlay Controls */}
      <div className="border border-rule rounded-sm p-4 bg-white space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Cover Overlay</h3>
            <p className="text-[11px] text-draft mt-0.5">
              Choose an optional color overlay over the uploaded cover image. Defaults to None (original image colors).
            </p>
          </div>
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-paper border border-rule text-draft font-mono">
            {overlay.type === 'none' || !data.coverImage ? 'Overlay: None (0%)' : `${overlay.type.toUpperCase()}: ${overlay.opacity || 0}%`}
          </span>
        </div>

        {/* Radio options: None | Solid | Gradient */}
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input
              type="radio"
              name="overlayType"
              value="none"
              checked={overlay.type === 'none'}
              onChange={() => setOverlayProp('type', 'none')}
              className="text-navy focus:ring-navy cursor-pointer"
            />
            <span>None (Original Colors)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input
              type="radio"
              name="overlayType"
              value="solid"
              checked={overlay.type === 'solid'}
              onChange={() => setOverlayProp('type', 'solid')}
              className="text-navy focus:ring-navy cursor-pointer"
            />
            <span>Solid Color</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input
              type="radio"
              name="overlayType"
              value="gradient"
              checked={overlay.type === 'gradient'}
              onChange={() => setOverlayProp('type', 'gradient')}
              className="text-navy focus:ring-navy cursor-pointer"
            />
            <span>Gradient</span>
          </label>
        </div>

        {/* If Solid: Color Picker + Opacity Slider */}
        {overlay.type === 'solid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-rule/60">
            <div>
              <label className="input-label flex items-center justify-between">
                <span>Overlay Color</span>
                <span className="text-[10px] text-draft font-mono">{overlay.color || '#000000'}</span>
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={overlay.color || '#000000'}
                  onChange={(e) => setOverlayProp('color', e.target.value)}
                  className="w-10 h-8 rounded border border-rule cursor-pointer p-0.5 bg-white flex-shrink-0"
                />
                <input
                  type="text"
                  value={overlay.color || '#000000'}
                  onChange={(e) => setOverlayProp('color', e.target.value)}
                  placeholder="#000000"
                  className="input-field py-1 text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="input-label mb-0">Opacity</label>
                <span className="text-xs font-bold text-navy font-mono">{overlay.opacity ?? 0}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={overlay.opacity ?? 0}
                onChange={(e) => setOverlayProp('opacity', parseInt(e.target.value, 10))}
                className="w-full accent-navy cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-draft mt-1 font-mono">
                <span>0% (Clear)</span>
                <span>50%</span>
                <span>100% (Solid)</span>
              </div>
            </div>
          </div>
        )}

        {/* If Gradient: Start Color, End Color + Opacity Slider */}
        {overlay.type === 'gradient' && (
          <div className="space-y-3 pt-3 border-t border-rule/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label flex items-center justify-between">
                  <span>Start Color (Top)</span>
                  <span className="text-[10px] text-draft font-mono">{overlay.gradientStart || '#1E2D5A'}</span>
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={overlay.gradientStart || '#1E2D5A'}
                    onChange={(e) => setOverlayProp('gradientStart', e.target.value)}
                    className="w-10 h-8 rounded border border-rule cursor-pointer p-0.5 bg-white flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={overlay.gradientStart || '#1E2D5A'}
                    onChange={(e) => setOverlayProp('gradientStart', e.target.value)}
                    className="input-field py-1 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="input-label flex items-center justify-between">
                  <span>End Color (Bottom)</span>
                  <span className="text-[10px] text-draft font-mono">{overlay.gradientEnd || '#0D1B2A'}</span>
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={overlay.gradientEnd || '#0D1B2A'}
                    onChange={(e) => setOverlayProp('gradientEnd', e.target.value)}
                    className="w-10 h-8 rounded border border-rule cursor-pointer p-0.5 bg-white flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={overlay.gradientEnd || '#0D1B2A'}
                    onChange={(e) => setOverlayProp('gradientEnd', e.target.value)}
                    className="input-field py-1 text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="input-label mb-0">Gradient Opacity</label>
                <span className="text-xs font-bold text-navy font-mono">{overlay.opacity ?? 0}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={overlay.opacity ?? 0}
                onChange={(e) => setOverlayProp('opacity', parseInt(e.target.value, 10))}
                className="w-full accent-navy cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-draft mt-1 font-mono">
                <span>0% (Clear)</span>
                <span>50%</span>
                <span>100% (Solid)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cover preview card */}
      <div className="border border-rule rounded-sm p-4 bg-paper">
        <p className="text-[10px] font-bold text-draft uppercase tracking-widest mb-3">Cover Preview</p>
        <div
          className="w-44 h-60 mx-auto rounded-sm shadow-md flex flex-col items-center justify-between p-3 text-white relative overflow-hidden"
          style={{
            backgroundColor: '#1E2D5A',
            backgroundImage: data.coverImage ? `url(${data.coverImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Optional Overlay Layer on Preview */}
          {previewOverlayStyle && (
            <div
              className="absolute inset-0 z-0 pointer-events-none transition-opacity"
              style={previewOverlayStyle}
            />
          )}

          {/* Logo or Top Header */}
          <div className="flex flex-col items-center gap-1 z-10 w-full pt-1">
            {data.collegeLogo ? (
              <img src={data.collegeLogo} alt="College Logo" className="h-7 max-w-[80px] object-contain drop-shadow" />
            ) : (
              <p className="text-[7px] font-bold uppercase tracking-widest opacity-80 font-serif">MES Wadia COE</p>
            )}
            <div className="w-10 h-px bg-white opacity-40 mt-0.5" />
          </div>

          {/* Title & Issue */}
          <div className="flex flex-col items-center gap-1 text-center z-10 my-auto px-2">
            <h3 className="font-serif text-lg font-bold leading-tight drop-shadow">
              {data.title || 'Reflection'}
            </h3>
            <p className="text-[8px] opacity-75 font-semibold">Issue {data.issueNumber || 'XX'}</p>
            {data.tagline && (
              <p className="text-[6px] opacity-70 italic max-w-[140px] leading-tight line-clamp-2 mt-0.5">
                {data.tagline}
              </p>
            )}
          </div>

          {/* Footer Period */}
          <div className="w-full flex items-center justify-between border-t border-white/20 pt-1.5 z-10 text-[7px] opacity-70">
            <span>{data.period || 'Annual Edition'}</span>
            <span className="font-mono">{data.academicYear || ''}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleGenerate} className="btn-primary text-sm">
          Save Cover Settings
        </button>
      </div>
    </div>
  );
}
