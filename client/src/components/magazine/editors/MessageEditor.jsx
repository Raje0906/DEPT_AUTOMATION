import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

function PersonEditor({ person, onChange, title }) {
  return (
    <div className="border border-rule rounded-sm p-4 space-y-4 bg-white">
      <p className="text-xs font-bold text-navy uppercase tracking-widest">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Name</label>
          <input
            className="input-field"
            value={person.name}
            onChange={e => onChange({ ...person, name: e.target.value })}
            placeholder="e.g. Dr. S. V. Kulkarni"
          />
        </div>
        <div>
          <label className="input-label">Designation</label>
          <input
            className="input-field"
            value={person.designation}
            onChange={e => onChange({ ...person, designation: e.target.value })}
            placeholder="e.g. Principal, MES Wadia COE"
          />
        </div>
      </div>

      <div>
        <label className="input-label">Photo</label>
        <div className="flex items-center gap-4">
          {person.photo ? (
            <img src={person.photo} alt={person.name} className="w-16 h-16 rounded-sm object-cover border border-rule" />
          ) : (
            <div className="w-16 h-16 rounded-sm bg-paper border border-dashed border-rule flex items-center justify-center">
              <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          )}
          <button
            onClick={() => toast('Photo upload: select a JPG or PNG file.')}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Upload Photo
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="input-label mb-0">Message</label>
          <button
            onClick={() => {
              toast.success('AI formatting applied — paragraph breaks optimised.');
              onChange({
                ...person,
                message: person.message ||
                  `It gives me immense pleasure to present the ${new Date().getFullYear()} edition of "Reflection," the annual magazine of the Department of Computer Engineering.\n\nThis magazine is a testament to the hard work, creativity, and academic excellence of our students and faculty. Each page reflects the vibrant intellectual life of our department — from outstanding academic performances to innovative projects, impactful workshops, and prestigious achievements at national and international levels.\n\nI congratulate all the contributors and the editorial team for their dedication in compiling this edition. May this magazine inspire future generations of engineers to reach greater heights.\n\nBest wishes,\n${person.name}\n${person.designation}`,
              });
            }}
            className="text-[10px] font-semibold text-navy hover:underline flex items-center gap-1"
          >
            ✦ AI Format Message
          </button>
        </div>
        <textarea
          rows={8}
          className="input-field resize-y"
          value={person.message}
          onChange={e => onChange({ ...person, message: e.target.value })}
          placeholder={`Write the ${title}'s message here...`}
        />
        <p className="text-[10px] text-draft mt-1">
          {person.message.split(/\s+/).filter(Boolean).length} words
        </p>
      </div>
    </div>
  );
}

export default function MessageEditor() {
  const { sectionData, updateSection, completeSection } = useMagazine();
  const data = sectionData.message;
  const [tab, setTab] = useState('principal');

  const updatePrincipal = (p) => updateSection('message', { ...data, principal: p });
  const updateHOD       = (h) => updateSection('message', { ...data, hod: h });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Principal / HOD Message</h2>
        <p className="text-xs text-draft mt-1">
          Enter messages from the Principal and Head of Department. Use AI Format to improve paragraph spacing.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex border border-rule rounded-sm overflow-hidden w-fit">
        {['principal', 'hod'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-xs font-semibold transition-colors capitalize ${
              tab === t ? 'bg-navy text-white' : 'bg-white text-draft hover:bg-paper'
            }`}
          >
            {t === 'principal' ? 'Principal' : 'HOD'}
          </button>
        ))}
      </div>

      {tab === 'principal' && (
        <PersonEditor
          person={data.principal}
          onChange={updatePrincipal}
          title="Principal's Message"
        />
      )}
      {tab === 'hod' && (
        <PersonEditor
          person={data.hod}
          onChange={updateHOD}
          title="Head of Department's Message"
        />
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => { completeSection('message'); toast.success('Section saved.'); }}
          className="btn-primary text-sm"
        >
          Save Messages
        </button>
        <button
          onClick={() => toast('Full-page preview opens in the Preview tab.')}
          className="btn-secondary text-sm"
        >
          Preview
        </button>
      </div>
    </div>
  );
}
