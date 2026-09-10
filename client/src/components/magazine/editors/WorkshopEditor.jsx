import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import ImageUploader from '../ImageUploader';
import toast from 'react-hot-toast';

const SAMPLE_WORKSHOPS = [
  {
    id: 1,
    title: 'Workshop on Ethical Hacking and Penetration Testing',
    date: '18–19 April 2026',
    speaker: 'Mr. Vivek Ranade',
    organization: 'CyberShield Technologies, Pune',
    participants: 68,
    targetClass: 'TE & BE',
    venue: 'Computer Lab 3, MES Wadia COE',
    description: 'A two-day hands-on workshop covering fundamental and advanced concepts of ethical hacking, vulnerability assessment, and penetration testing using industry-standard tools like Metasploit, Burp Suite, and Wireshark.',
    photos: [],
  },
];

export default function WorkshopEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [workshops, setWorkshops] = useState(SAMPLE_WORKSHOPS);
  const [expandedId, setExpandedId] = useState(null);

  const save = (list) => { setWorkshops(list); updateSection('workshops', list); };

  const addWorkshop = () => {
    const w = { id: Date.now(), title: '', date: '', speaker: '', organization: '', participants: '', targetClass: '', venue: '', description: '', photos: [] };
    const updated = [...workshops, w];
    save(updated);
    setExpandedId(w.id);
  };

  const update = (id, field, value) => save(workshops.map(w => w.id === id ? { ...w, [field]: value } : w));
  const remove  = (id) => save(workshops.filter(w => w.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Student Workshops</h2>
        <p className="text-xs text-draft mt-1">
          Add workshop details. Upload PDFs or reports and AI will extract information automatically.
        </p>
      </div>

      <div className="space-y-3">
        {workshops.map((w, idx) => (
          <div key={w.id} className="border border-rule rounded-sm bg-white overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors text-left"
              onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex-shrink-0 bg-maroon text-white text-[10px] font-bold rounded-sm flex items-center justify-center">{idx + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{w.title || 'Untitled Workshop'}</p>
                  {w.date && <p className="text-xs text-draft">{w.date} {w.speaker ? `· ${w.speaker}` : ''}</p>}
                </div>
              </div>
              <svg className={`w-4 h-4 text-draft transition-transform ${expandedId === w.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedId === w.id && (
              <div className="px-4 pb-4 border-t border-rule space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="input-label">Workshop Title</label>
                    <input className="input-field" value={w.title} onChange={e => update(w.id, 'title', e.target.value)} placeholder="e.g. Workshop on Deep Learning Applications" />
                  </div>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input-field" value={w.date} onChange={e => update(w.id, 'date', e.target.value)} placeholder="e.g. 10 April 2026" />
                  </div>
                  <div>
                    <label className="input-label">Speaker / Trainer</label>
                    <input className="input-field" value={w.speaker} onChange={e => update(w.id, 'speaker', e.target.value)} placeholder="e.g. Dr. Ankit Shah" />
                  </div>
                  <div>
                    <label className="input-label">Organization</label>
                    <input className="input-field" value={w.organization} onChange={e => update(w.id, 'organization', e.target.value)} placeholder="e.g. IIT Bombay" />
                  </div>
                  <div>
                    <label className="input-label">Participants</label>
                    <input className="input-field" type="number" value={w.participants} onChange={e => update(w.id, 'participants', e.target.value)} placeholder="e.g. 60" />
                  </div>
                  <div>
                    <label className="input-label">Target Class</label>
                    <input className="input-field" value={w.targetClass} onChange={e => update(w.id, 'targetClass', e.target.value)} placeholder="e.g. TE, BE" />
                  </div>
                  <div>
                    <label className="input-label">Venue</label>
                    <input className="input-field" value={w.venue} onChange={e => update(w.id, 'venue', e.target.value)} placeholder="e.g. Seminar Hall" />
                  </div>
                </div>

                <div>
                  <label className="input-label">Description</label>
                  <textarea rows={3} className="input-field resize-none" value={w.description} onChange={e => update(w.id, 'description', e.target.value)} placeholder="Brief description of the workshop…" />
                </div>

                <div>
                  <label className="input-label">Upload Documents / Certificate / Poster</label>
                  <div className="border border-dashed border-rule rounded-sm py-4 px-4 flex items-center gap-3 bg-paper cursor-pointer hover:border-navy transition-colors" onClick={() => toast('File upload: PDF, DOCX or images accepted.')}>
                    <svg className="w-5 h-5 text-draft flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-draft">Upload Certificate, Poster or Report</p>
                      <p className="text-[10px] text-draft opacity-70">PDF, DOCX — AI will extract information automatically</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="input-label">Workshop Photos</label>
                  <ImageUploader images={w.photos} onChange={photos => update(w.id, 'photos', photos)} label="Upload Workshop Photos" />
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-rule">
                  <button onClick={() => toast.success('AI arranging content for: ' + w.title)} className="btn-secondary text-xs py-2 px-4">✦ AI Arrange</button>
                  <button onClick={() => toast('Preview opens in Preview tab.')} className="text-xs text-draft border border-rule rounded-sm px-3 py-2 hover:bg-paper transition-colors">Preview</button>
                  <button onClick={() => remove(w.id)} className="text-xs text-fail font-medium hover:underline ml-auto">Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={addWorkshop} className="btn-secondary text-xs py-2 px-4">+ Add Workshop</button>
        <button onClick={() => { completeSection('workshops'); toast.success('Workshops section saved.'); }} className="btn-primary text-xs py-2 px-4">Save Workshops</button>
      </div>
    </div>
  );
}
