import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function SeminarGuideView() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/seminar/my-groups')
      .then(r => setGroups(r.data.groups || []))
      .catch(() => toast.error('Failed to load your assigned groups'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-[var(--ink)]/40">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--navy)] mb-1">My Assigned Groups</h1>
      <p className="text-sm text-[var(--ink)]/50 mb-6">
        {user?.name} — Published sessions only. Contact the coordinator for changes.
      </p>

      {groups.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[var(--rule)] rounded-xl">
          <svg className="w-10 h-10 mx-auto text-[var(--ink)]/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <p className="text-sm text-[var(--ink)]/40">No groups assigned to you in any published session.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Group by session */}
          {Array.from(new Set(groups.map(g => g.session_name))).map(sname => {
            const sg = groups.filter(g => g.session_name === sname);
            return (
              <div key={sname}>
                <h2 className="text-sm font-bold text-[var(--navy)] mb-3 uppercase tracking-wider">
                  {sname} <span className="font-normal text-[var(--ink)]/40 normal-case">— {sg[0]?.batch} · {sg[0]?.academic_year}</span>
                </h2>
                <div className="space-y-4">
                  {sg.map(g => (
                    <div key={g.id} className="bg-white border border-[var(--rule)] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-[#EEF0F7] border-b border-[var(--rule)] flex items-center gap-4">
                        <span className="font-mono font-bold text-[var(--navy)] text-sm">Group {g.group_no}</span>
                        <span className="text-xs text-[var(--ink)]/60 flex-1">{g.domain}</span>
                      </div>
                      <table className="result-table w-full text-xs">
                        <thead>
                          <tr className="bg-[var(--paper)]">
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">PRN</th>
                            <th className="px-3 py-2 text-left">Div</th>
                            <th className="px-3 py-2 text-left">Mobile</th>
                            <th className="px-3 py-2 text-left">Email</th>
                            <th className="px-3 py-2 text-left">Topic 1</th>
                            <th className="px-3 py-2 text-left">Topic 2</th>
                            <th className="px-3 py-2 text-left">Topic 3</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--rule)]">
                          {(g.members || []).map((m, mi) => (
                            <tr key={mi} className={m.is_leader ? 'bg-blue-50/40' : ''}>
                              <td className="px-3 py-2 font-medium text-[var(--ink)]">
                                {m.name}
                                {m.is_leader && <span className="ml-1.5 text-[10px] bg-[var(--navy)] text-white px-1.5 py-0.5 rounded font-bold">Leader</span>}
                              </td>
                              <td className="px-3 py-2 font-mono text-[var(--ink)]/70">{m.prn}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60">{m.division}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60">{m.mobile}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60 truncate max-w-[160px]">{m.email}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60 max-w-[160px] truncate">{m.topic1}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60 max-w-[160px] truncate">{m.topic2}</td>
                              <td className="px-3 py-2 text-[var(--ink)]/60 max-w-[160px] truncate">{m.topic3}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
