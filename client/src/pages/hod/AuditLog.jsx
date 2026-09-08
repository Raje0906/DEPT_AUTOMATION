import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function AuditLog() {
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    api.get(`/hod/audit-log?page=${page}&limit=${limit}`)
      .then(res => {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">Audit Log</h1>
        <p className="text-sm text-draft mt-0.5">
          Every mark creation, edit, approval, and override is recorded here. Immutable record.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-draft">Loading audit records…</p>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-draft">No audit records found.</p>
        </div>
      ) : (
        <>
          <div className="panel overflow-x-auto mb-4">
            <table className="result-table text-xs">
              <thead>
                <tr>
                  <th className="numeric">#</th>
                  <th>Table</th>
                  <th className="numeric">Record ID</th>
                  <th>Action</th>
                  <th>Changed by</th>
                  <th>Role</th>
                  <th>Old value</th>
                  <th>New value</th>
                  <th>Reason</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id}>
                    <td className="numeric text-gray-400">{(page - 1) * limit + i + 1}</td>
                    <td className="font-mono">{log.table_name}</td>
                    <td className="numeric font-mono">{log.record_id}</td>
                    <td>
                      <span className={`badge text-xs ${
                        log.action === 'INSERT' ? 'badge-published' :
                        log.action === 'UPDATE' ? 'badge-submitted' : 'badge-fail'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.changed_by_name}</td>
                    <td className="capitalize text-draft">{log.changed_by_role}</td>
                    <td className="font-mono text-gray-400 max-w-xs truncate">
                      {log.old_value ? JSON.stringify(log.old_value).slice(0, 60) : '—'}
                    </td>
                    <td className="font-mono text-xs max-w-xs truncate">
                      {log.new_value ? JSON.stringify(log.new_value).slice(0, 60) : '—'}
                    </td>
                    <td className="text-draft max-w-xs truncate">{log.reason || '—'}</td>
                    <td className="text-draft whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-draft">
              Page {page} of {Math.ceil(total / limit)} · {total} records total
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="btn-ghost py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
