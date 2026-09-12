import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

function getActionBadge(action) {
  switch (action) {
    case 'LOGIN_SUCCESS':
      return 'badge-published'; // green
    case 'LOGIN_FAILED':
    case 'SECURITY_ALERT':
    case 'DELETE':
      return 'badge-fail'; // red
    case 'LOGIN_BLOCKED':
    case 'PASSWORD_RESET_REQUEST':
      return 'badge-submitted'; // amber
    case 'STUDENT_REGISTER':
    case 'FACULTY_REGISTER':
    case 'PASSWORD_RESET_SUCCESS':
      return 'badge-approved'; // blue / navy
    case 'INSERT':
      return 'badge-published';
    case 'UPDATE':
      return 'badge-submitted';
    default:
      return 'badge-draft';
  }
}

function parseUserAgent(ua) {
  if (!ua) return '—';
  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('PostmanRuntime')) browser = 'Postman';
  else if (ua.includes('curl/')) browser = 'cURL';

  let os = '';
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return os ? `${browser} (${os})` : browser;
}

export default function AuditLog() {
  const [logs, setLogs]             = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [filterAction, setFilterAction] = useState('ALL');
  const [loading, setLoading]       = useState(true);
  const limit = 50;

  const fetchLogs = () => {
    setLoading(true);
    api.get(`/hod/audit-log?page=${page}&limit=${limit}`)
      .then(res => {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const filteredLogs = logs.filter(log => {
    if (filterAction === 'ALL') return true;
    if (filterAction === 'AUTH') {
      return log.action.includes('LOGIN') || log.action.includes('PASSWORD') || log.action.includes('SECURITY');
    }
    if (filterAction === 'REGISTER') {
      return log.action.includes('REGISTER');
    }
    if (filterAction === 'DATA') {
      return ['INSERT', 'UPDATE', 'DELETE'].includes(log.action);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-rule">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Cybersecurity & System Audit Log</h1>
          <p className="text-sm text-draft mt-0.5">
            Immutable forensic trail of authentication events, user activities, mark mutations, and IP telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-draft font-medium">Filter:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="input-field py-1 text-xs"
          >
            <option value="ALL">All Events ({logs.length})</option>
            <option value="AUTH">Authentication & Security</option>
            <option value="REGISTER">Registrations</option>
            <option value="DATA">Database Mutations</option>
          </select>
          <button
            onClick={fetchLogs}
            className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
            title="Refresh logs"
          >
            <span>↻</span> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-draft">Loading audit records…</div>
      ) : filteredLogs.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-sm text-draft">No audit records found matching your filter.</p>
        </div>
      ) : (
        <>
          <div className="panel overflow-x-auto mb-4 shadow-sm">
            <table className="result-table text-xs">
              <thead>
                <tr>
                  <th className="numeric">#</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User / Performer</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>Client / Device</th>
                  <th>Target Entity</th>
                  <th>Details & Reason</th>
                  <th>Mutation Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="numeric text-gray-400">{(page - 1) * limit + i + 1}</td>
                    <td className="text-draft whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td>
                      <span className={`badge text-[11px] font-semibold tracking-wide ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-medium text-ink">
                      {log.changed_by_name || (
                        <span className="text-gray-400 italic font-normal">Unauthenticated</span>
                      )}
                    </td>
                    <td className="capitalize text-draft text-[11px]">
                      {log.changed_by_role || '—'}
                    </td>
                    <td className="font-mono text-[11px] text-gray-600 whitespace-nowrap">
                      {log.ip_address ? (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                          {log.ip_address}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-gray-600 max-w-[150px] truncate" title={log.user_agent || 'Unknown'}>
                      {parseUserAgent(log.user_agent)}
                    </td>
                    <td className="font-mono text-xs">
                      <span className="text-ink">{log.table_name}</span>
                      {log.record_id && (
                        <span className="text-draft text-[11px] ml-1">#{log.record_id}</span>
                      )}
                    </td>
                    <td className="text-draft max-w-xs truncate" title={log.reason || ''}>
                      {log.reason || '—'}
                    </td>
                    <td className="font-mono text-[11px] text-gray-500 max-w-xs truncate">
                      {log.new_value ? (
                        <span title={JSON.stringify(log.new_value, null, 2)}>
                          {JSON.stringify(log.new_value).slice(0, 50)}
                        </span>
                      ) : log.old_value ? (
                        <span title={JSON.stringify(log.old_value, null, 2)}>
                          prev: {JSON.stringify(log.old_value).slice(0, 45)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm py-2">
            <span className="text-draft text-xs">
              Showing page {page} of {Math.ceil(total / limit) || 1} &middot; {total} total immutable records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost py-1 px-3 text-xs disabled:opacity-40"
              >
                &larr; Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="btn-ghost py-1 px-3 text-xs disabled:opacity-40"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
