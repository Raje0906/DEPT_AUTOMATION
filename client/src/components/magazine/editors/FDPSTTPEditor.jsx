import React, { useState } from 'react';
import { useMagazine } from '../../../contexts/MagazineContext';
import toast from 'react-hot-toast';

const MODES = ['Online', 'Offline', 'Hybrid'];

const SAMPLE_FDP = [
  { id: 1, facultyName: 'Dr. N. F. Shaikh',     activity: 'FDP on Deep Learning & NLP',                  organization: 'IIT Bombay — NPTEL', startDate: '01-Jun-2026', endDate: '30-Jun-2026', mode: 'Online' },
  { id: 2, facultyName: 'Prof. R. K. Joshi',     activity: 'STTP on Cloud Native Application Development', organization: 'VJTI Mumbai',        startDate: '10-Feb-2026', endDate: '14-Feb-2026', mode: 'Offline' },
  { id: 3, facultyName: 'Prof. S. M. Kulkarni',  activity: 'FDP on Outcome-Based Education',              organization: 'AICTE-NITTT',        startDate: '15-Mar-2026', endDate: '04-Apr-2026', mode: 'Online' },
  { id: 4, facultyName: 'Dr. A. V. Deshmukh',    activity: 'Workshop on Research Methodology & Ethics',   organization: 'Savitribai Phule Pune University', startDate: '21-May-2026', endDate: '22-May-2026', mode: 'Offline' },
  { id: 5, facultyName: 'Prof. P. R. Chavan',    activity: 'STTP on Embedded Systems & VLSI Design',      organization: 'NIT Raipur',         startDate: '07-Jul-2026', endDate: '11-Jul-2026', mode: 'Hybrid' },
];

const MODE_BADGE = {
  Online:  'text-pass bg-green-50 border-pass',
  Offline: 'text-navy bg-blue-50 border-navy',
  Hybrid:  'text-pending bg-amber-50 border-pending',
};

export default function FDPSTTPEditor() {
  const { updateSection, completeSection } = useMagazine();
  const [records, setRecords] = useState(SAMPLE_FDP);

  const save = (list) => { setRecords(list); updateSection('fdpSttp', list); };

  const add = () => save([...records, { id: Date.now(), facultyName: '', activity: '', organization: '', startDate: '', endDate: '', mode: 'Online' }]);

  const update = (id, f, v) => save(records.map(r => r.id === id ? { ...r, [f]: v } : r));
  const remove = (id) => save(records.filter(r => r.id !== id));

  // Paginate: 15 per page
  const ITEMS_PER_PAGE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const paged = records.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">FDP / STTP</h2>
        <p className="text-xs text-draft mt-1">
          Enter faculty development programme and STTP records. The table auto-paginates for large datasets.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => toast('Excel upload: Faculty Name, Activity, Organization, Start Date, End Date, Mode columns.')} className="text-xs text-draft border border-rule rounded-sm px-3 py-1.5 hover:bg-paper transition-colors">Upload Excel</button>
        <span className="text-xs text-draft self-center">{records.length} records total</span>
      </div>

      {/* Table */}
      <div className="border border-rule rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="result-table text-xs">
            <thead>
              <tr>
                <th className="w-10">Sr.</th>
                <th>Faculty Name</th>
                <th>Activity Name</th>
                <th>Organization</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Mode</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-draft text-xs">No records. Click "+ Add Record" below.</td></tr>
              ) : (
                paged.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="numeric text-draft font-mono">{(page - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                    <td>
                      <input className="w-32 bg-transparent border-none outline-none text-xs text-ink" value={r.facultyName} onChange={e => update(r.id, 'facultyName', e.target.value)} placeholder="Faculty name" />
                    </td>
                    <td>
                      <input className="w-44 bg-transparent border-none outline-none text-xs text-ink" value={r.activity} onChange={e => update(r.id, 'activity', e.target.value)} placeholder="FDP / STTP title" />
                    </td>
                    <td>
                      <input className="w-36 bg-transparent border-none outline-none text-xs text-ink" value={r.organization} onChange={e => update(r.id, 'organization', e.target.value)} placeholder="Institute" />
                    </td>
                    <td>
                      <input className="w-24 bg-transparent border-none outline-none text-xs font-mono text-ink" value={r.startDate} onChange={e => update(r.id, 'startDate', e.target.value)} placeholder="DD-Mon-YYYY" />
                    </td>
                    <td>
                      <input className="w-24 bg-transparent border-none outline-none text-xs font-mono text-ink" value={r.endDate} onChange={e => update(r.id, 'endDate', e.target.value)} placeholder="DD-Mon-YYYY" />
                    </td>
                    <td>
                      <select
                        className={`text-xs font-semibold border rounded px-1.5 py-0.5 ${MODE_BADGE[r.mode] || ''}`}
                        value={r.mode}
                        onChange={e => update(r.id, 'mode', e.target.value)}
                      >
                        {MODES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </td>
                    <td>
                      <button onClick={() => remove(r.id)} className="text-fail text-xs font-bold">×</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-rule bg-paper">
            <p className="text-xs text-draft">
              Page {page} of {totalPages} · {records.length} records
            </p>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded-sm border transition-colors ${p === page ? 'bg-navy text-white border-navy' : 'border-rule text-draft hover:border-navy'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={add} className="btn-secondary text-xs py-2 px-4">+ Add Record</button>
        <button onClick={() => { toast.success('FDP/STTP table generated with automatic pagination.'); completeSection('fdpSttp'); }} className="btn-primary text-xs py-2 px-4">Generate Table</button>
        <button onClick={() => toast('Preview opens in the Preview tab.')} className="text-xs text-draft border border-rule rounded-sm px-4 py-2 hover:bg-paper transition-colors">Preview</button>
      </div>
    </div>
  );
}
