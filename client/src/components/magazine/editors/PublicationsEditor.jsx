import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

const PUB_TYPES = ['Journal Article', 'Conference Paper', 'Book Chapter', 'Book', 'Patent', 'Review Article'];

const SAMPLE_PUBS = [
  { id: 1, facultyName: 'Dr. N. F. Shaikh',    title: 'Privacy-Preserving Federated Learning in Heterogeneous IoT Networks', journal: 'IEEE Access', type: 'Journal Article', date: 'August 2025', doi: '10.1109/ACCESS.2025.1234567', url: '', description: 'Impact Factor 3.9. Explores differential privacy and gradient compression in federated settings.' },
  { id: 2, facultyName: 'Prof. R. K. Joshi',   title: 'Automated Crop Disease Detection using Vision Transformers', journal: 'ICAICST 2026, Springer', type: 'Conference Paper', date: 'March 2026', doi: '', url: '', description: 'Presented at the International Conference on AI and Computer Science Technology.' },
  { id: 3, facultyName: 'Dr. A. V. Deshmukh',  title: 'Quantum-Classical Hybrid Algorithms for Combinatorial Optimisation', journal: 'Journal of Computational Science, Elsevier', type: 'Journal Article', date: 'June 2026', doi: '10.1016/j.jocs.2026.101234', url: '', description: 'Published in collaboration with IIT Bombay. Q1 ranked journal.' },
];

export default function PublicationsEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [pubs, setPubs] = useState(SAMPLE_PUBS);
  const [expandedId, setExpandedId] = useState(null);

  const save = (list) => { setPubs(list); updateSection('publications', list); };

  const add = () => {
    const p = { id: Date.now(), facultyName: '', title: '', journal: '', type: 'Journal Article', date: '', doi: '', url: '', description: '' };
    save([...pubs, p]);
    setExpandedId(p.id);
  };

  const update = (id, f, v) => save(pubs.map(p => p.id === id ? { ...p, [f]: v } : p));
  const remove = (id) => save(pubs.filter(p => p.id !== id));

  const TYPE_COLOR = {
    'Journal Article':   'bg-blue-50 text-navy border-navy',
    'Conference Paper':  'bg-purple-50 text-purple-700 border-purple-300',
    'Book Chapter':      'bg-amber-50 text-pending border-pending',
    'Book':              'bg-green-50 text-pass border-pass',
    'Patent':            'bg-red-50 text-fail border-fail',
    'Review Article':    'bg-gray-100 text-draft border-gray-300',
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">Publications</h2>
        <p className="text-xs text-draft mt-1">
          Add faculty publications. Include DOI links where available for digital edition linking.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => toast('Excel upload: Faculty, Title, Journal/Conference, Type, Date, DOI, URL columns.')} className="text-xs text-draft border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors">Upload Excel</button>
        <span className="text-xs text-draft self-center">{pubs.length} publication{pubs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Type summary */}
      <div className="flex flex-wrap gap-2">
        {PUB_TYPES.map(t => {
          const count = pubs.filter(p => p.type === t).length;
          if (!count) return null;
          return (
            <span key={t} className={`inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded border ${TYPE_COLOR[t] || 'bg-gray-100 border-gray-300 text-draft'}`}>
              {t}: {count}
            </span>
          );
        })}
      </div>

      <div className="space-y-3">
        {pubs.map((p, idx) => (
          <div key={p.id} className="border border-rule rounded-sm bg-white overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors text-left"
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-draft font-mono w-6">{idx + 1}.</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{p.title || 'Untitled Publication'}</p>
                  <p className="text-xs text-draft">
                    {p.facultyName || 'Faculty'}{p.journal ? ` · ${p.journal}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.type && (
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded border ${TYPE_COLOR[p.type] || ''}`}>{p.type}</span>
                )}
                <svg className={`w-4 h-4 text-draft transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedId === p.id && (
              <div className="px-4 pb-4 border-t border-rule space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Faculty Name</label>
                    <input className="input-field" value={p.facultyName} onChange={e => update(p.id, 'facultyName', e.target.value)} placeholder="e.g. Dr. N. F. Shaikh" />
                  </div>
                  <div>
                    <label className="input-label">Publication Type</label>
                    <select className="input-field" value={p.type} onChange={e => update(p.id, 'type', e.target.value)}>
                      {PUB_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Publication Title</label>
                    <input className="input-field" value={p.title} onChange={e => update(p.id, 'title', e.target.value)} placeholder="Full title of the paper / book / patent" />
                  </div>
                  <div>
                    <label className="input-label">Journal / Conference</label>
                    <input className="input-field" value={p.journal} onChange={e => update(p.id, 'journal', e.target.value)} placeholder="e.g. IEEE Access, ICML 2026" />
                  </div>
                  <div>
                    <label className="input-label">Publication Date</label>
                    <input className="input-field" value={p.date} onChange={e => update(p.id, 'date', e.target.value)} placeholder="Month YYYY" />
                  </div>
                  <div>
                    <label className="input-label">DOI</label>
                    <input className="input-field font-mono" value={p.doi} onChange={e => update(p.id, 'doi', e.target.value)} placeholder="10.xxxx/xxxxx" />
                  </div>
                  <div>
                    <label className="input-label">URL (optional)</label>
                    <input className="input-field" value={p.url} onChange={e => update(p.id, 'url', e.target.value)} placeholder="https://…" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="input-label">Description / Abstract (optional)</label>
                    <textarea rows={2} className="input-field resize-none" value={p.description} onChange={e => update(p.id, 'description', e.target.value)} placeholder="Brief summary or impact note…" />
                  </div>
                </div>
                <div className="flex items-center pt-1">
                  <button onClick={() => remove(p.id)} className="text-xs text-fail font-medium hover:underline ml-auto">Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={add} className="btn-secondary text-xs py-2 px-4">+ Add Publication</button>
        <button onClick={() => { completeSection('publications'); toast.success('Publications section saved.'); }} className="btn-primary text-xs py-2 px-4">Save Publications</button>
      </div>
    </div>
  );
}
