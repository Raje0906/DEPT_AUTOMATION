import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ACTION_COLORS = { INSERT: 'bg-emerald-50 text-emerald-700', UPDATE: 'bg-blue-50 text-blue-700', DELETE: 'bg-red-50 text-red-700' };

export default function SeminarAuditLog() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/seminar/sessions/${id}`),
      api.get(`/seminar/sessions/${id}/audit`),
    ]).then(([sR, aR]) => {
      setSession(sR.data.session);
      setLogs(aR.data.logs || []);
    }).catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1 text-xs text-[var(--ink)]/40">
        <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">Sessions</Link>
        <span>/</span>
        <span className="text-[var(--ink)]/60 truncate">{session?.name}</span>
        <span>/</span><span>Audit Log</span>
      </div>
      <h1 className="text-2xl font-bold text-[var(--navy)] mb-6">Audit Trail</h1>

      {logs.length === 0 ? (
        <p className="text-sm text-[var(--ink)]/40 text-center py-12">No audit entries yet.</p>
      ) : (
        <div className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden">
          <table className="result-table w-full text-xs">
            <thead className="bg-[#EEF0F7]">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Who</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Table</th>
                <th className="px-3 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-[var(--paper)]/50">
                  <td className="px-3 py-2 font-mono text-[var(--ink)]/50 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--ink)]">{l.changed_by_name}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-600'}`}>{l.action}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--ink)]/50">{l.table_name}</td>
                  <td className="px-3 py-2 text-[var(--ink)]/60 max-w-xs">
                    {l.reason && <span className="italic">{l.reason} — </span>}
                    {l.new_value && (
                      <span className="font-mono text-[10px] bg-[var(--paper)] px-1 py-0.5 rounded">
                        {JSON.stringify(l.new_value).slice(0, 120)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
