import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * ImageUploader — drag-and-drop multi-image upload with persistent Base64 conversion:
 * - thumbnail preview grid
 * - caption editing
 * - delete / remove
 * - AI recommendation badges
 * - persistent Base64 Data URLs (survives page navigation, reload, and PDF generation)
 */
export default function ImageUploader({ images = [], onChange, maxImages = 20, label = 'Upload Photos' }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const getImageUrl = (img) => (typeof img === 'string' ? img : img?.url || img?.src || '');
  const getImageId = (img, idx) => (typeof img === 'object' && img?.id ? img.id : `img-${idx}`);

  const addFiles = useCallback(async (files) => {
    const currentList = Array.isArray(images) ? images : [];
    const validFiles = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, Math.max(0, maxImages - currentList.length));

    if (validFiles.length === 0) {
      if (files.length > 0 && !Array.from(files).some(f => f.type.startsWith('image/'))) {
        toast.error('Please select valid image files (JPG, PNG, WEBP).');
      }
      return;
    }

    const toastId = toast.loading(`Uploading ${validFiles.length} photo${validFiles.length > 1 ? 's' : ''}...`);

    const readPromises = validFiles.map((file, i) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}-${i}`,
            url: e.target.result, // Persistent Base64 Data URL
            name: file.name,
            caption: '',
            ai: i === 0 && currentList.length === 0 ? 'recommended' : null,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    const newImgs = (await Promise.all(readPromises)).filter(Boolean);
    if (newImgs.length > 0) {
      onChange([...currentList, ...newImgs]);
      toast.success(`Added ${newImgs.length} photo${newImgs.length > 1 ? 's' : ''}.`, { id: toastId });
    } else {
      toast.error('Failed to read image files.', { id: toastId });
    }
  }, [images, onChange, maxImages]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const removeImage = (idOrIdx) => {
    const currentList = Array.isArray(images) ? images : [];
    onChange(currentList.filter((img, idx) => getImageId(img, idx) !== idOrIdx));
    toast.success('Photo removed.');
  };

  const updateCaption = (idOrIdx, caption) => {
    const currentList = Array.isArray(images) ? images : [];
    onChange(currentList.map((img, idx) =>
      getImageId(img, idx) === idOrIdx
        ? (typeof img === 'string' ? { id: idOrIdx, url: img, caption } : { ...img, caption })
        : img
    ));
  };

  const imgList = Array.isArray(images) ? images : [];

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
        {imgList.length > 0 && (
          <p className="text-xs text-navy font-semibold">{imgList.length} photo{imgList.length > 1 ? 's' : ''} added</p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Thumbnail grid */}
      {imgList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {imgList.map((img, idx) => {
            const url = getImageUrl(img);
            const id = getImageId(img, idx);
            const caption = typeof img === 'object' ? (img.caption || '') : '';
            const ai = typeof img === 'object' ? img.ai : null;

            return (
              <div key={id} className="border border-rule rounded-sm overflow-hidden bg-white group">
                <div className="relative h-28 bg-paper">
                  {url ? (
                    <img
                      src={url}
                      alt={caption || 'Uploaded photo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-draft">No preview</div>
                  )}
                  {/* AI badge */}
                  {ai === 'recommended' && (
                    <span className="absolute top-1.5 left-1.5 bg-pass text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      ✓ Recommended
                    </span>
                  )}
                  {/* Delete overlay */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(id);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-fail text-white rounded-full text-xs font-bold flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm"
                    title="Remove photo"
                  >
                    ×
                  </button>
                </div>
                <div className="px-2 py-1.5 border-t border-rule/50">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => updateCaption(id, e.target.value)}
                    placeholder="Add caption…"
                    className="w-full text-xs text-ink placeholder-gray-400 bg-transparent border-none outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
