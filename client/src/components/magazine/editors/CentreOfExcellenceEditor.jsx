import React from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import ImageUploader from '../ImageUploader';
import toast from 'react-hot-toast';

export default function CentreOfExcellenceEditor() {
  const { sectionData, updateSection, completeSection } = useMagazine();
  const data = sectionData.coe || {};

  const set = (field, value) => updateSection('coe', { ...data, [field]: value });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Centre of Excellence</h2>
        <p className="text-xs text-draft mt-1">
          Describe the department's Centre of Excellence. This section uses a feature layout to highlight institutional partnerships.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="input-label">Centre Name</label>
          <input className="input-field" value={data.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Centre of Excellence in AI & Cloud Computing" />
        </div>
        <div>
          <label className="input-label">Date Established</label>
          <input className="input-field" type="date" value={data.dateEstablished || ''} onChange={e => set('dateEstablished', e.target.value)} />
        </div>
        <div>
          <label className="input-label">Partner Organization</label>
          <input className="input-field" value={data.partner || ''} onChange={e => set('partner', e.target.value)} placeholder="e.g. IBM India Pvt. Ltd." />
        </div>
        <div className="sm:col-span-2">
          <label className="input-label">Tagline</label>
          <input className="input-field" value={data.tagline || ''} onChange={e => set('tagline', e.target.value)} placeholder="e.g. Empowering tomorrow's engineers with industry-ready skills" />
        </div>
      </div>

      <div>
        <label className="input-label">Description</label>
        <textarea rows={4} className="input-field resize-y" value={data.description || ''} onChange={e => set('description', e.target.value)} placeholder="Overview of the centre, its objectives and academic significance…" />
      </div>

      <div>
        <label className="input-label">Major Activities</label>
        <textarea rows={3} className="input-field resize-y" value={data.activities || ''} onChange={e => set('activities', e.target.value)} placeholder="e.g. IBM Cloud Certification tracks, AI Bootcamp series, Industry mentoring sessions…" />
      </div>

      <div>
        <label className="input-label">Achievements</label>
        <textarea rows={3} className="input-field resize-y" value={data.achievements || ''} onChange={e => set('achievements', e.target.value)} placeholder="e.g. 42 students received IBM Cloud Practitioner certification, 3 research papers published…" />
      </div>

      <div>
        <label className="input-label">Centre Photographs</label>
        <ImageUploader
          images={data.photos || []}
          onChange={imgs => set('photos', imgs)}
          label="Upload Centre Photos"
          maxImages={8}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => { completeSection('coe'); toast.success('Centre of Excellence section saved.'); }}
          className="btn-primary text-sm"
        >
          Save Centre of Excellence
        </button>
      </div>
    </div>
  );
}
