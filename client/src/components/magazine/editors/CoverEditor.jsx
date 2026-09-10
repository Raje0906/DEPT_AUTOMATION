import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

export default function CoverEditor() {
  const { sectionData, updateSection, completeSection } = useMagazine();
  const data = sectionData.cover;

  const set = (field, value) => updateSection('cover', { ...data, [field]: value });

  const handleGenerate = () => {
    toast.success('Cover design generated. Preview it in the Preview tab.');
    completeSection('cover');
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Cover</h2>
        <p className="text-xs text-draft mt-1">
          Enter magazine cover details. The system will generate a professional academic cover layout.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Magazine Title</label>
          <input
            className="input-field"
            value={data.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Reflection"
          />
        </div>
        <div>
          <label className="input-label">Issue Number</label>
          <input
            className="input-field"
            value={data.issueNumber}
            onChange={e => set('issueNumber', e.target.value)}
            placeholder="e.g. 33"
          />
        </div>
        <div>
          <label className="input-label">Academic Year</label>
          <select className="input-field" value={data.academicYear} onChange={e => set('academicYear', e.target.value)}>
            <option value="">Select year</option>
            {['2026–27', '2025–26', '2024–25', '2023–24'].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Department</label>
          <select className="input-field" value={data.department} onChange={e => set('department', e.target.value)}>
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
          value={data.tagline}
          onChange={e => set('tagline', e.target.value)}
          placeholder="e.g. Knowledge grows when it is shared with others"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">College Logo</label>
          <div className="border border-dashed border-rule rounded-sm py-5 px-4 flex flex-col items-center gap-2 bg-paper cursor-pointer hover:border-navy transition-colors">
            <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-xs text-draft font-medium">Upload College Logo</p>
            <p className="text-[10px] text-draft opacity-70">PNG or SVG recommended</p>
          </div>
        </div>
        <div>
          <label className="input-label">Cover Image / Background</label>
          <div className="border border-dashed border-rule rounded-sm py-5 px-4 flex flex-col items-center gap-2 bg-paper cursor-pointer hover:border-navy transition-colors">
            <svg className="w-6 h-6 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-xs text-draft font-medium">Upload Cover Image</p>
            <p className="text-[10px] text-draft opacity-70">JPG, PNG · min 1200×1800px</p>
          </div>
        </div>
      </div>

      {/* Cover preview card */}
      <div className="border border-rule rounded-sm p-4 bg-paper">
        <p className="text-[10px] font-bold text-draft uppercase tracking-widest mb-3">Cover Preview</p>
        <div
          className="w-40 h-56 mx-auto rounded-sm shadow-md flex flex-col items-center justify-center gap-1.5 text-white relative overflow-hidden"
          style={{ backgroundColor: '#1E2D5A' }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 right-0 h-px bg-white" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-white" />
            <div className="absolute top-8 left-0 right-0 h-px bg-white" />
            <div className="absolute bottom-8 left-0 right-0 h-px bg-white" />
          </div>
          <p className="text-[7px] font-bold uppercase tracking-widest opacity-70 font-serif">MES Wadia COE</p>
          <div className="w-12 h-px bg-white opacity-40" />
          <p className="font-serif text-base font-bold text-center px-2 leading-tight">
            {data.title || 'Reflection'}
          </p>
          <p className="text-[8px] opacity-60 font-semibold">Issue {data.issueNumber || 'XX'}</p>
          <div className="w-12 h-px bg-white opacity-40" />
          <p className="text-[6px] opacity-50 text-center px-3 leading-tight">
            {data.tagline ? data.tagline.substring(0, 40) + (data.tagline.length > 40 ? '…' : '') : ''}
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleGenerate} className="btn-primary text-sm">
          Generate Cover Design
        </button>
        <button onClick={() => toast('Preview opens after generating cover')} className="btn-secondary text-sm">
          Preview
        </button>
      </div>
    </div>
  );
}
