import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

const LEVELS = ['College Level', 'University Level', 'State Level', 'National Level', 'International Level'];

const SAMPLE_ACHIEVEMENTS = [
  { id: 1, name: 'Ketan Patil',       class: 'BE II', achievement: 'GitLab CodeForge Hackathon', level: 'National',      date: 'November 2025', position: 'Runner-up', prize: '₹70,000',  description: '', photo: null },
  { id: 2, name: 'Priya Suryawanshi', class: 'TE I',  achievement: 'Smart India Hackathon 2026', level: 'National',      date: 'September 2026', position: 'Runner-up', prize: '₹70,000',  description: '', photo: null },
  { id: 3, name: 'Aakash Deshpande',  class: 'BE I',  achievement: 'IEEE Xtreme 18.0',           level: 'International', date: 'October 2025',   position: 'Top 500',   prize: 'Certificate', description: '', photo: null },
  { id: 4, name: 'Sonal Wagh',        class: 'SE II', achievement: 'Pune District Science Olympiad', level: 'State',     date: 'January 2026',   position: '1st Place', prize: 'Medal + ₹10,000', description: '', photo: null },
];

const LEVEL_BADGE = {
  'International Level': 'bg-purple-50 text-purple-700 border-purple-300',
  'National Level':      'bg-blue-50 text-navy border-navy',
  'State Level':         'bg-amber-50 text-pending border-pending',
  'University Level':    'bg-green-50 text-pass border-pass',
  'College Level':       'bg-gray-100 text-draft border-gray-300',
};

export default function AchievementsEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [achievements, setAchievements] = useState(SAMPLE_ACHIEVEMENTS);
  const [filterLevel, setFilterLevel] = useState('All');

  const save = (list) => { setAchievements(list); updateSection('achievements', list); };

  const add = () => {
    save([...achievements, { id: Date.now(), name: '', class: '', achievement: '', level: 'National Level', date: '', position: '', prize: '', description: '', photo: null }]);
  };

  const update = (id, f, v) => save(achievements.map(a => a.id === id ? { ...a, [f]: v } : a));
  const remove = (id) => save(achievements.filter(a => a.id !== id));

  const filtered = filterLevel === 'All' ? achievements : achievements.filter(a => a.level === filterLevel);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Student Achievements</h2>
        <p className="text-xs text-draft mt-1">
          Record student achievements. Filter by level. Upload Excel or PDF for bulk import.
        </p>
      </div>

      {/* Level filter */}
      <div className="flex flex-wrap gap-1.5">
        {['All', ...LEVELS].map(l => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-sm border transition-colors ${filterLevel === l ? 'bg-navy text-white border-navy' : 'border-rule text-draft hover:border-navy'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex gap-2">
        <button onClick={() => toast('Excel import: Name, Class, Achievement, Level, Date, Position, Prize columns.')} className="text-xs text-draft border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors">Upload Excel</button>
        <button onClick={() => toast('PDF upload: AI will convert unstructured text into structured records.')} className="text-xs text-draft border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors">Upload PDF</button>
      </div>

      {/* Achievements table */}
      <div className="border border-rule rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="result-table text-xs">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Student Name</th>
                <th>Class</th>
                <th>Achievement</th>
                <th>Level</th>
                <th>Position / Prize</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-draft text-xs">No achievements. Click "+ Add Achievement" below.</td></tr>
              ) : (
                filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div className="w-8 h-8 rounded-sm bg-paper border border-rule flex items-center justify-center cursor-pointer hover:border-navy transition-colors" title="Click to upload photo">
                        <svg className="w-4 h-4 text-draft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                      </div>
                    </td>
                    <td>
                      <input className="w-full bg-transparent border-none outline-none text-xs text-ink" value={a.name} onChange={e => update(a.id, 'name', e.target.value)} placeholder="Student name" />
                    </td>
                    <td>
                      <input className="w-16 bg-transparent border-none outline-none text-xs text-ink" value={a.class} onChange={e => update(a.id, 'class', e.target.value)} placeholder="e.g. BE I" />
                    </td>
                    <td>
                      <input className="w-40 bg-transparent border-none outline-none text-xs text-ink" value={a.achievement} onChange={e => update(a.id, 'achievement', e.target.value)} placeholder="Competition name" />
                    </td>
                    <td>
                      <select
                        className="bg-transparent border-none outline-none text-xs"
                        value={a.level}
                        onChange={e => update(a.id, 'level', e.target.value)}
                      >
                        {LEVELS.map(l => <option key={l}>{l}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="w-28 bg-transparent border-none outline-none text-xs text-ink" value={`${a.position}${a.prize ? ' · ' + a.prize : ''}`} onChange={e => update(a.id, 'position', e.target.value)} placeholder="Position · Prize" />
                    </td>
                    <td>
                      <input className="w-28 bg-transparent border-none outline-none text-xs text-ink" value={a.date} onChange={e => update(a.id, 'date', e.target.value)} placeholder="Month YYYY" />
                    </td>
                    <td>
                      <button onClick={() => remove(a.id)} className="text-fail text-xs font-bold">×</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level summary */}
      <div className="flex flex-wrap gap-2">
        {LEVELS.map(l => {
          const count = achievements.filter(a => a.level === l).length;
          if (!count) return null;
          return (
            <span key={l} className={`inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded border ${LEVEL_BADGE[l] || 'bg-gray-100 border-gray-300 text-draft'}`}>
              {l}: {count}
            </span>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={add} className="btn-secondary text-xs py-2 px-4">+ Add Achievement</button>
        <button onClick={() => { completeSection('achievements'); toast.success('Achievements section saved.'); }} className="btn-primary text-xs py-2 px-4">Save Achievements</button>
      </div>
    </div>
  );
}
