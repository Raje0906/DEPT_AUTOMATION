import React, { useCallback, useRef, useState } from 'react';

/**
 * ImageUploader — drag-and-drop multi-image upload with:
 * - thumbnail preview grid
 * - caption editing
 * - delete / replace
 * - AI recommendation badges (simulated)
 */
export default function ImageUploader({ images = [], onChange, maxImages = 20, label = 'Upload Photos' }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const addFiles = useCallback((files) => {
    const newImgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, maxImages - images.length)
      .map((f, i) => ({
        id: `img-${Date.now()}-${i}`,
        file: f,
        url: URL.createObjectURL(f),
        caption: '',
        ai: i === 0 ? 'recommended' : (Math.random() < 0.1 ? 'duplicate' : null),
      }));
    onChange([...images, ...newImgs]);
  }, [images, onChange, maxImages]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const removeImage = (id) => onChange(images.filter(img => img.id !== id));

  const updateCaption = (id, caption) =>
    onChange(images.map(img => img.id === id ? { ...img, caption } : img));

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-sm cursor-pointer flex flex-col items-center justify-center gap-2 py-8 transition-colors ${
          dragging ? 'border-navy bg-blue-50' : 'border-rule bg-paper hover:border-navy hover:bg-blue-50/30'
        }`}
      >
        <svg className="w-8 h-8 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium text-draft">{label}</p>
        <p className="text-xs text-draft opacity-70">Drag & drop or click to browse · JPG, PNG, WEBP</p>
        {images.length > 0 && (
          <p className="text-xs text-navy font-semibold">{images.length} photo{images.length > 1 ? 's' : ''} added</p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div key={img.id} className="border border-rule rounded-sm overflow-hidden bg-white group">
              <div className="relative h-28">
                <img
                  src={img.url}
                  alt={img.caption || 'Uploaded photo'}
                  className="w-full h-full object-cover"
                />
                {/* AI badge */}
                {img.ai === 'recommended' && (
                  <span className="absolute top-1.5 left-1.5 bg-pass text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    ✓ Recommended
                  </span>
                )}
                {img.ai === 'duplicate' && (
                  <span className="absolute top-1.5 left-1.5 bg-pending text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Duplicate
                  </span>
                )}
                {/* Delete overlay */}
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-fail text-white rounded-full text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove photo"
                >
                  ×
                </button>
              </div>
              <div className="px-2 py-1.5">
                <input
                  type="text"
                  value={img.caption}
                  onChange={(e) => updateCaption(img.id, e.target.value)}
                  placeholder="Add caption…"
                  className="w-full text-xs text-ink placeholder-gray-400 bg-transparent border-none outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
