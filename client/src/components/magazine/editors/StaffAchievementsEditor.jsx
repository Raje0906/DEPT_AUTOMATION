import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

const ACHIEVEMENT_TYPES = [
  'Best Paper Award', 'Research Publication', 'Patent Granted', 'Book / Chapter Published',
  'Award & Recognition', 'Administrative Achievement', 'Conference Presentation', 'Other',
];

const SAMPLE_STAFF = [
  {
    id: 1, facultyName: 'Dr. N. F. Shaikh', achievements: [
      { id: 'a1', type: 'Research Publication', title: 'Federated Learning in IoT Edge Networks', organization: 'IEEE Access', date: 'August 2025', description: 'Published in IEEE Access (Impact Factor: 3.9), exploring privacy-preserving FL for heterogeneous IoT environments.', photo: null },
      { id: 'a2', type: 'Best Paper Award', title: 'Best Paper Award — ICICT 2026', organization: 'International Conference on ICT, NIT Surathkal', date: 'February 2026', description: '', photo: null },
    ],
  },
  {
    id: 2, facultyName: 'Prof. R. K. Joshi', achievements: [
      { id: 'a3', type: 'Patent Granted', title: 'Smart Irrigation System using ML — Indian Patent No. 2026/IN/01234', organization: 'Patent Office of India', date: 'March 2026', description: '', photo: null },
    ],
  },
];

export default function StaffAchievementsEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [staff, setStaff] = useState(SAMPLE_STAFF);
  const [expandedId, setExpandedId] = useState(null);

  const save = (list) => { setStaff(list); updateSection('staffAchievements', list); };

  const addFaculty = () => {
    const s = { id: Date.now(), facultyName: '', achievements: [] };
    save([...staff, s]);
    setExpandedId(s.id);
  };

  const updateName = (id, name) => save(staff.map(s => s.id === id ? { ...s, facultyName: name } : s));

  const addAchievement = (sid) => {
    const newA = { id: `a${Date.now()}`, type: 'Award & Recognition', title: '', organization: '', date: '', description: '', photo: null };
    save(staff.map(s => s.id === sid ? { ...s, achievements: [...s.achievements, newA] } : s));
  };

  const updateAchievement = (sid, aid, f, v) =>
    save(staff.map(s => s.id === sid ? { ...s, achievements: s.achievements.map(a => a.id === aid ? { ...a, [f]: v } : a) } : s));

  const removeAchievement = (sid, aid) =>
    save(staff.map(s => s.id === sid ? { ...s, achievements: s.achievements.filter(a => a.id !== aid) } : s));

  const removeFaculty = (id) => save(staff.filter(s => s.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Staff Achievements</h2>
        <p className="text-xs text-draft mt-1">Record faculty achievements. Multiple achievements per faculty member are supported.</p>
      </div>

      <div className="space-y-3">
        {staff.map((s) => (
          <div key={s.id} className="border border-rule rounded-sm bg-white overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors text-left"
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 flex-shrink-0 bg-[#141C38] text-white text-[10px] font-bold rounded-sm flex items-center justify-center uppercase">
                  {s.facultyName?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{s.facultyName || 'New Faculty Member'}</p>
                  <p className="text-xs text-draft">{s.achievements.length} achievement{s.achievements.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-draft transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedId === s.id && (
              <div className="px-4 pb-4 border-t border-rule space-y-4 pt-4">
                <div>
                  <label className="input-label">Faculty Name</label>
                  <input className="input-field" value={s.facultyName} onChange={e => updateName(s.id, e.target.value)} placeholder="e.g. Dr. N. F. Shaikh" />
                </div>

                {s.achievements.map((a, aidx) => (
                  <div key={a.id} className="border border-rule rounded-sm p-3 space-y-3 bg-paper">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-navy uppercase tracking-wider">Achievement {aidx + 1}</p>
                      <button onClick={() => removeAchievement(s.id, a.id)} className="text-xs text-fail font-bold">× Remove</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="input-label">Achievement Type</label>
                        <select className="input-field" value={a.type} onChange={e => updateAchievement(s.id, a.id, 'type', e.target.value)}>
                          {ACHIEVEMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="input-label">Date</label>
                        <input className="input-field" value={a.date} onChange={e => updateAchievement(s.id, a.id, 'date', e.target.value)} placeholder="Month YYYY" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="input-label">Title</label>
                        <input className="input-field" value={a.title} onChange={e => updateAchievement(s.id, a.id, 'title', e.target.value)} placeholder="e.g. Best Paper Award — ICICT 2026" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="input-label">Organization / Publisher / Conference</label>
                        <input className="input-field" value={a.organization} onChange={e => updateAchievement(s.id, a.id, 'organization', e.target.value)} placeholder="e.g. IEEE Xplore" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="input-label">Description (optional)</label>
                        <textarea rows={2} className="input-field resize-none" value={a.description} onChange={e => updateAchievement(s.id, a.id, 'description', e.target.value)} placeholder="Additional details…" />
                      </div>
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      {a.photo ? (
                        <div className="flex items-center gap-2">
                          <img src={a.photo} alt="Achievement" className="w-12 h-12 object-cover rounded border border-rule" />
                          <button
                            type="button"
                            onClick={() => updateAchievement(s.id, a.id, 'photo', null)}
                            className="text-xs text-fail hover:underline"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <label className="text-xs text-draft border border-rule rounded-sm px-3 py-1.5 hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-1.5">
                          <span>Upload Certificate / Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                updateAchievement(s.id, a.id, 'photo', ev.target.result);
                                toast.success('Achievement photo uploaded.');
                              };
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => addAchievement(s.id)} className="text-xs text-navy font-semibold hover:underline">+ Add Achievement</button>
                  <button onClick={() => removeFaculty(s.id)} className="text-xs text-fail font-medium hover:underline ml-auto">Remove Faculty</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={addFaculty} className="btn-secondary text-xs py-2 px-4">+ Add Faculty Member</button>
        <button onClick={() => { completeSection('staffAchievements'); toast.success('Staff achievements section saved.'); }} className="btn-primary text-xs py-2 px-4">Save Staff Achievements</button>
      </div>
    </div>
  );
}
