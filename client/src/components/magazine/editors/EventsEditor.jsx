import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import ImageUploader from '../ImageUploader';
import toast from 'react-hot-toast';

const LAYOUT_OPTIONS = ['Large Image + Text', 'Two Image Grid', 'Three Image Grid', 'Text + Image'];

const SAMPLE_EVENTS = [
  {
    id: 1,
    title: 'National Science Day Celebration',
    date: '28 February 2026',
    venue: 'Seminar Hall, MES Wadia COE',
    organizer: 'Department of Computer Engineering',
    description: 'The department observed National Science Day with a series of technical presentations, quiz competitions, and a poster exhibition. Students from all classes participated enthusiastically.',
    photos: [],
    layout: 'Large Image + Text',
  },
  {
    id: 2,
    title: 'Industrial Visit to Persistent Systems, Pune',
    date: '12 March 2026',
    venue: 'Persistent Systems Ltd., Pune',
    organizer: 'Prof. R. K. Joshi',
    description: 'TE and BE students visited Persistent Systems to gain hands-on exposure to agile software development practices, DevOps pipelines, and cloud infrastructure management.',
    photos: [],
    layout: 'Two Image Grid',
  },
];

export default function EventsEditor() {
  const { sectionData, updateSection, completeSection } = useMagazine();
  const [events, setEvents] = useState(sectionData.events.length ? sectionData.events : SAMPLE_EVENTS);
  const [expandedId, setExpandedId] = useState(null);

  const save = (list) => {
    setEvents(list);
    updateSection('events', list);
  };

  const addEvent = () => {
    const newEvent = {
      id: Date.now(),
      title: '',
      date: '',
      venue: '',
      organizer: '',
      description: '',
      photos: [],
      layout: 'Large Image + Text',
    };
    const updated = [...events, newEvent];
    save(updated);
    setExpandedId(newEvent.id);
  };

  const updateEvent = (id, field, value) => {
    save(events.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEvent = (id) => save(events.filter(e => e.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Department Events</h2>
        <p className="text-xs text-draft mt-1">
          Add departmental events. Upload photos; AI will arrange them with the appropriate layout template.
        </p>
      </div>

      <div className="space-y-3">
        {events.map((event, idx) => (
          <div key={event.id} className="border border-rule rounded-sm bg-white overflow-hidden">
            {/* Event header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors text-left"
              onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex-shrink-0 bg-navy text-white text-[10px] font-bold rounded-sm flex items-center justify-center">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{event.title || 'Untitled Event'}</p>
                  {event.date && <p className="text-xs text-draft">{event.date}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {event.photos.length > 0 && (
                  <span className="text-[10px] text-pass font-semibold">{event.photos.length} photos</span>
                )}
                <svg className={`w-4 h-4 text-draft transition-transform ${expandedId === event.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Event form */}
            {expandedId === event.id && (
              <div className="px-4 pb-4 border-t border-rule space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Event Title</label>
                    <input className="input-field" value={event.title} onChange={e => updateEvent(event.id, 'title', e.target.value)} placeholder="e.g. Annual Tech Fest 2026" />
                  </div>
                  <div>
                    <label className="input-label">Date</label>
                    <input className="input-field" value={event.date} onChange={e => updateEvent(event.id, 'date', e.target.value)} placeholder="e.g. 15 March 2026" />
                  </div>
                  <div>
                    <label className="input-label">Venue</label>
                    <input className="input-field" value={event.venue} onChange={e => updateEvent(event.id, 'venue', e.target.value)} placeholder="e.g. Main Auditorium" />
                  </div>
                  <div>
                    <label className="input-label">Organizer</label>
                    <input className="input-field" value={event.organizer} onChange={e => updateEvent(event.id, 'organizer', e.target.value)} placeholder="e.g. Prof. A. B. Patil" />
                  </div>
                </div>

                <div>
                  <label className="input-label">Description</label>
                  <textarea rows={3} className="input-field resize-none" value={event.description} onChange={e => updateEvent(event.id, 'description', e.target.value)} placeholder="Brief description of the event…" />
                </div>

                <div>
                  <label className="input-label">Layout Template</label>
                  <div className="flex flex-wrap gap-2">
                    {LAYOUT_OPTIONS.map(l => (
                      <button
                        key={l}
                        onClick={() => updateEvent(event.id, 'layout', l)}
                        className={`px-3 py-1 text-xs rounded-sm border transition-colors ${event.layout === l ? 'bg-navy text-white border-navy' : 'border-rule text-draft hover:border-navy'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="input-label">Event Photos</label>
                  <ImageUploader
                    images={event.photos}
                    onChange={photos => updateEvent(event.id, 'photos', photos)}
                    label="Upload Event Photos"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-rule">
                  <button
                    onClick={() => { toast.success('AI arranged content for ' + (event.title || 'this event')); }}
                    className="btn-secondary text-xs py-2 px-4"
                  >
                    ✦ AI Arrange Content
                  </button>
                  <button onClick={() => removeEvent(event.id)} className="text-xs text-fail font-medium hover:underline ml-auto">
                    Remove Event
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={addEvent} className="btn-secondary text-xs py-2 px-4">
          + Add Event
        </button>
        <button
          onClick={() => { completeSection('events'); toast.success('Events section saved.'); }}
          className="btn-primary text-xs py-2 px-4"
        >
          Save Events
        </button>
      </div>
    </div>
  );
}
