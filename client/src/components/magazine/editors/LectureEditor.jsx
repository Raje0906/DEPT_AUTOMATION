import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import ImageUploader from '../ImageUploader';
import toast from 'react-hot-toast';

const SAMPLE_LECTURES = [
  {
    id: 1,
    topic: 'Generative AI: Opportunities and Challenges for the Engineering Workforce',
    speaker: 'Dr. Prashant Borkar',
    designation: 'Principal Research Scientist',
    organization: 'Microsoft Research India, Bengaluru',
    date: '5 March 2026',
    venue: 'Seminar Hall, MES Wadia COE',
    targetClass: 'TE & BE',
    description: 'Dr. Borkar delivered an insightful talk on the transformative impact of Generative AI on the engineering profession, covering LLMs, multimodal AI, and emerging career pathways.',
    photos: [],
  },
];

export default function LectureEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [lectures, setLectures] = useState(SAMPLE_LECTURES);
  const [expandedId, setExpandedId] = useState(null);

  const save = (list) => { setLectures(list); updateSection('lectures', list); };
  const add  = () => {
    const l = { id: Date.now(), topic: '', speaker: '', designation: '', organization: '', date: '', venue: '', targetClass: '', description: '', photos: [] };
    const updated = [...lectures, l];
    save(updated);
    setExpandedId(l.id);
  };
  const update = (id, f, v) => save(lectures.map(l => l.id === id ? { ...l, [f]: v } : l));
  const remove = (id) => save(lectures.filter(l => l.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Guest Lectures</h2>
        <p className="text-xs text-draft mt-1">Add guest lecture details. Upload photos for automatic layout generation.</p>
      </div>

      <div className="space-y-3">
        {lectures.map((l, idx) => (
          <div key={l.id} className="border border-rule rounded-sm bg-white overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors text-left"
              onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex-shrink-0 bg-pass text-white text-[10px] font-bold rounded-sm flex items-center justify-center">{idx + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{l.topic || 'Untitled Lecture'}</p>
                  {l.speaker && <p className="text-xs text-draft">{l.speaker}{l.organization ? ` · ${l.organization}` : ''}</p>}
                </div>
              </div>
              <svg className={`w-4 h-4 text-draft transition-transform ${expandedId === l.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedId === l.id && (
              <div className="px-4 pb-4 border-t border-rule space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="input-label">Topic / Title</label>
                    <input className="input-field" value={l.topic} onChange={e => update(l.id, 'topic', e.target.value)} placeholder="e.g. Machine Learning in Healthcare" />
                  </div>
                  <div>
                    <label className="input-label">Speaker Name</label>
                    <input className="input-field" value={l.speaker} onChange={e => update(l.id, 'speaker', e.target.value)} placeholder="e.g. Dr. Anita Sharma" />
                  </div>
                  <div>
                    <label className="input-label">Designation</label>
                    <input className="input-field" value={l.designation} onChange={e => update(l.id, 'designation', e.target.value)} placeholder="e.g. Associate Professor" />
                  </div>
                  <div>
                    <label className="input-label">Organization</label>
                    <input className="input-field" value={l.organization} onChange={e => update(l.id, 'organization', e.target.value)} placeholder="e.g. IIT Bombay" />
                  </div>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input-field" value={l.date} onChange={e => update(l.id, 'date', e.target.value)} placeholder="e.g. 20 February 2026" />
                  </div>
                  <div>
                    <label className="input-label">Venue</label>
                    <input className="input-field" value={l.venue} onChange={e => update(l.id, 'venue', e.target.value)} placeholder="e.g. Main Auditorium" />
                  </div>
                  <div>
                    <label className="input-label">Target Class</label>
                    <input className="input-field" value={l.targetClass} onChange={e => update(l.id, 'targetClass', e.target.value)} placeholder="e.g. All Students" />
                  </div>
                </div>

                <div>
                  <label className="input-label">Description</label>
                  <textarea rows={3} className="input-field resize-none" value={l.description} onChange={e => update(l.id, 'description', e.target.value)} placeholder="Summary of the lecture…" />
                </div>

                <div>
                  <label className="input-label">Lecture Photos</label>
                  <ImageUploader images={l.photos} onChange={photos => update(l.id, 'photos', photos)} label="Upload Lecture Photos" />
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-rule">
                  <button onClick={() => toast.success('AI arranged content for: ' + (l.topic || 'this lecture'))} className="btn-secondary text-xs py-2 px-4">✦ AI Arrange</button>
                  <button onClick={() => remove(l.id)} className="text-xs text-fail font-medium hover:underline ml-auto">Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={add} className="btn-secondary text-xs py-2 px-4">+ Add Guest Lecture</button>
        <button onClick={() => { completeSection('lectures'); toast.success('Guest lectures section saved.'); }} className="btn-primary text-xs py-2 px-4">Save Lectures</button>
      </div>
    </div>
  );
}
