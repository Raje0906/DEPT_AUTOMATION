import React, { useState } from 'react';

const TEXT_CONTROLS = ['Heading', 'Subheading', 'Body Text', 'Caption'];
const TEMPLATES = ['Article', 'Article + Image', 'Two Column', 'Photo Grid', 'Full Width Photo', 'Data Table', 'Toppers Grid'];

export default function PageEditorModal({ page, onClose, onSave }) {
  const [activeControl, setActiveControl] = useState('Text');
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [heading, setHeading] = useState(page?.data?.title || '');
  const [body, setBody] = useState((page?.data?.paragraphs || []).join('\n\n'));

  if (!page) return null;

  const handleSave = () => {
    onSave?.({ ...page, data: { ...page.data, title: heading } });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-sm shadow-2xl border border-rule flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold text-draft uppercase tracking-widest">Page Editor</p>
            <h3 className="font-serif text-lg font-bold text-ink">{page?.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-paper rounded-sm transition-colors text-draft hover:text-ink">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal body — 2 columns */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Page preview */}
          <div className="flex-1 bg-gray-200 flex items-center justify-center p-6 overflow-auto">
            <div className="bg-white shadow-lg w-full max-w-xs aspect-[3/4] overflow-hidden">
              <div className="w-full h-full p-6 flex flex-col">
                <div className="mb-3 pb-2 border-b-2 border-ink">
                  <p className="text-[8px] font-bold text-navy uppercase tracking-widest mb-1">{page?.data?.section || 'Section'}</p>
                  <p className="font-serif text-sm font-bold text-ink leading-tight">{heading || 'Page Title'}</p>
                </div>
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {(body || '').split('\n\n').filter(Boolean).slice(0, 3).map((p, i) => (
                    <p key={i} className="text-[8px] text-ink leading-relaxed text-justify line-clamp-3">{p}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="w-72 flex-shrink-0 border-l border-rule flex flex-col">
            {/* Control tabs */}
            <div className="flex border-b border-rule">
              {['Text', 'Image', 'Layout', 'Template'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveControl(tab)}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${activeControl === tab ? 'text-navy border-b-2 border-navy bg-blue-50' : 'text-draft hover:text-ink hover:bg-paper'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeControl === 'Text' && (
                <>
                  <div>
                    <label className="input-label">Heading</label>
                    <input className="input-field" value={heading} onChange={e => setHeading(e.target.value)} placeholder="Page heading" />
                  </div>
                  <div>
                    <label className="input-label">Body Text</label>
                    <textarea rows={8} className="input-field resize-none text-xs" value={body} onChange={e => setBody(e.target.value)} placeholder="Body text…" />
                  </div>
                </>
              )}

              {activeControl === 'Image' && (
                <div className="space-y-3">
                  <p className="text-xs text-draft">Current page images:</p>
                  <div className="border border-dashed border-rule rounded-sm py-6 flex flex-col items-center gap-2 bg-paper cursor-pointer hover:border-navy transition-colors">
                    <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-xs text-draft font-medium">Replace Image</p>
                  </div>
                  <button className="w-full text-xs text-fail border border-fail rounded-sm py-2 hover:bg-red-50 transition-colors">Remove Image</button>
                </div>
              )}

              {activeControl === 'Layout' && (
                <div className="space-y-3">
                  <p className="text-xs text-draft font-medium">Spacing</p>
                  <div className="space-y-1">
                    {['Compact', 'Normal', 'Spacious'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="spacing" defaultChecked={s === 'Normal'} className="text-navy" />
                        <span className="text-xs text-ink">{s}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-draft font-medium mt-3">Content Order</p>
                  <div className="space-y-1">
                    {['Text then Image', 'Image then Text', 'Side by Side'].map(o => (
                      <label key={o} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="order" defaultChecked={o === 'Text then Image'} className="text-navy" />
                        <span className="text-xs text-ink">{o}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {activeControl === 'Template' && (
                <div className="space-y-2">
                  <p className="text-xs text-draft">Select page template:</p>
                  {TEMPLATES.map(t => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={`w-full text-left px-3 py-2 text-xs rounded-sm border transition-colors ${template === t ? 'bg-navy text-white border-navy' : 'border-rule text-draft hover:border-navy hover:text-ink'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            <div className="p-4 border-t border-rule flex gap-2">
              <button onClick={handleSave} className="flex-1 btn-primary text-xs py-2 justify-center">Save Changes</button>
              <button onClick={onClose} className="flex-1 btn-ghost text-xs py-2 border border-rule">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
