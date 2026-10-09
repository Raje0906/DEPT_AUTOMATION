import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
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
  const [logs, setLogs]                 = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchQuery, setSearchQuery]   = useState('');
  const [loading, setLoading]           = useState(true);
  const [exporting, setExporting]       = useState(false);
  const [selectedLog, setSelectedLog]   = useState(null);
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

  // Handle ESC to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const fetchLimit = total > 0 ? total : 5000;
      const res = await api.get(`/hod/audit-log?page=1&limit=${fetchLimit}`);
      const exportLogs = res.data.logs || logs;

      if (!exportLogs || exportLogs.length === 0) {
        toast.error('No audit records to export');
        return;
      }

      const rows = exportLogs.map(l => ({
        'Log ID': l.id,
        'Timestamp': new Date(l.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }),
        'Action': l.action,
        'User Name': l.changed_by_name || 'Unauthenticated',
        'Role': l.changed_by_role || '—',
        'IP Address': l.ip_address || '—',
        'Client / Device': parseUserAgent(l.user_agent),
        'Target Entity': l.table_name,
        'Record ID': l.record_id || '—',
        'Reason / Details': l.reason || '—',
        'Previous Value (Old)': l.old_value ? JSON.stringify(l.old_value) : '—',
        'New Value (Mutated)': l.new_value ? JSON.stringify(l.new_value) : '—',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },  // Log ID
        { wch: 22 }, // Timestamp
        { wch: 20 }, // Action
        { wch: 24 }, // User Name
        { wch: 12 }, // Role
        { wch: 16 }, // IP Address
        { wch: 26 }, // Client / Device
        { wch: 22 }, // Target Entity
        { wch: 12 }, // Record ID
        { wch: 35 }, // Reason / Details
        { wch: 45 }, // Previous Value
        { wch: 45 }, // New Value
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
      const filename = `Audit_Log_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${rows.length} records to ${filename}`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export audit log to Excel');
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    // Action category filter
    if (filterAction === 'AUTH') {
      if (!(log.action.includes('LOGIN') || log.action.includes('PASSWORD') || log.action.includes('SECURITY'))) return false;
    } else if (filterAction === 'REGISTER') {
      if (!log.action.includes('REGISTER')) return false;
    } else if (filterAction === 'DATA') {
      if (!['INSERT', 'UPDATE', 'DELETE'].includes(log.action)) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = log.changed_by_name?.toLowerCase().includes(q);
      const matchRole = log.changed_by_role?.toLowerCase().includes(q);
      const matchTable = log.table_name?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchIp = log.ip_address?.toLowerCase().includes(q);
      const matchReason = log.reason?.toLowerCase().includes(q);
      const matchRecordId = String(log.record_id || '').includes(q);
      return matchName || matchRole || matchTable || matchAction || matchIp || matchReason || matchRecordId;
    }

    return true;
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-rule">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Cybersecurity & System Audit Log</h1>
          <p className="text-xs sm:text-sm text-draft mt-0.5">
            Immutable forensic trail of authentication events, user activities, mark mutations, and IP telemetry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search by user, table, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field py-1 px-2.5 text-xs w-48 sm:w-56"
          />
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-draft font-medium">Filter:</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="input-field py-1 text-xs"
            >
              <option value="ALL">All Events ({logs.length})</option>
              <option value="AUTH">Auth & Security</option>
              <option value="REGISTER">Registrations</option>
              <option value="DATA">Data Mutations</option>
            </select>
          </div>
          <button
            onClick={fetchLogs}
            className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
            title="Refresh logs"
          >
            <span>↻</span> Refresh
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title="Download complete audit log as an Excel spreadsheet"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 3v13.5" />
            </svg>
            <span>{exporting ? 'Exporting…' : 'Download Excel'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel p-12 text-center text-sm text-draft">Loading audit records…</div>
      ) : filteredLogs.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-sm text-draft">No audit records found matching your filter or search.</p>
        </div>
      ) : (
        <>
          {/* Scrollable Compact Table */}
          <div className="panel table-scroll mb-4 shadow-sm border border-rule">
            <table className="result-table dense w-full">
              <thead>
                <tr>
                  <th className="numeric text-center w-10">#</th>
                  <th className="whitespace-nowrap">Timestamp</th>
                  <th className="whitespace-nowrap">Action</th>
                  <th className="whitespace-nowrap">User / Performer</th>
                  <th className="whitespace-nowrap">Role</th>
                  <th className="whitespace-nowrap">IP Address</th>
                  <th className="whitespace-nowrap">Client / Device</th>
                  <th className="whitespace-nowrap">Target Entity</th>
                  <th className="whitespace-nowrap">Details & Reason</th>
                  <th className="whitespace-nowrap text-center">Mutation Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => (
                  <tr key={log.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="numeric text-gray-400 font-mono text-[11px] text-center">
                      {(page - 1) * limit + i + 1}
                    </td>
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
                    <td className="whitespace-nowrap">
                      <span className={`badge text-[11px] font-semibold tracking-wide ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="font-medium text-ink whitespace-nowrap">
                      {log.changed_by_name || (
                        <span className="text-gray-400 italic font-normal">Unauthenticated</span>
                      )}
                    </td>
                    <td className="capitalize text-draft text-[11px] whitespace-nowrap">
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
                    <td className="text-gray-600 whitespace-nowrap max-w-[150px] truncate" title={log.user_agent || 'Unknown'}>
                      {parseUserAgent(log.user_agent)}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <span className="text-ink font-semibold">{log.table_name}</span>
                      {log.record_id && (
                        <span className="text-draft text-[11px] ml-1">#{log.record_id}</span>
                      )}
                    </td>
                    <td className="text-draft text-xs max-w-[180px] truncate" title={log.reason || ''}>
                      {log.reason || '—'}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {log.new_value || log.old_value ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-navy bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                          title="Click to view formatted JSON payload"
                        >
                          <span className="font-mono font-bold">{'{ }'}</span>
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm py-2">
            <span className="text-draft text-xs">
              Showing {filteredLogs.length} of {total} immutable records &middot; Page {page} of {Math.ceil(total / limit) || 1}
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

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-rule max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-rule flex items-center justify-between bg-paper">
              <div className="flex items-center gap-2.5">
                <span className={`badge text-[11px] font-semibold tracking-wide ${getActionBadge(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <h3 className="font-semibold text-sm text-ink">
                  Audit Record #{selectedLog.id} &middot; {selectedLog.table_name}
                  {selectedLog.record_id && ` #${selectedLog.record_id}`}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-ink text-lg leading-none p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
                <div>
                  <span className="text-draft block text-[10px] uppercase font-semibold">User</span>
                  <span className="font-medium text-ink">{selectedLog.changed_by_name || 'Unauthenticated'}</span>
                </div>
                <div>
                  <span className="text-draft block text-[10px] uppercase font-semibold">Role</span>
                  <span className="capitalize text-ink">{selectedLog.changed_by_role || '—'}</span>
                </div>
                <div>
                  <span className="text-draft block text-[10px] uppercase font-semibold">IP Address</span>
                  <span className="font-mono text-ink">{selectedLog.ip_address || '—'}</span>
                </div>
                <div>
                  <span className="text-draft block text-[10px] uppercase font-semibold">Client</span>
                  <span className="text-ink">{parseUserAgent(selectedLog.user_agent)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-draft block text-[10px] uppercase font-semibold">Timestamp</span>
                  <span className="font-mono text-ink">
                    {new Date(selectedLog.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
                {selectedLog.reason && (
                  <div className="col-span-2 sm:col-span-3 pt-1 border-t border-gray-200">
                    <span className="text-draft block text-[10px] uppercase font-semibold">Reason / Detail</span>
                    <span className="text-ink">{selectedLog.reason}</span>
                  </div>
                )}
              </div>

              {/* Old / Previous Value */}
              {selectedLog.old_value && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-draft text-xs uppercase tracking-wide">
                      Previous Value (Before Mutation)
                    </span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-amber-200 rounded font-mono text-[11px] overflow-auto max-h-48 border border-slate-700">
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
              )}

              {/* New / Mutated Value */}
              {selectedLog.new_value && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-draft text-xs uppercase tracking-wide">
                      {selectedLog.old_value ? 'New Value (After Mutation)' : 'Payload / Recorded Value'}
                    </span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-emerald-300 rounded font-mono text-[11px] overflow-auto max-h-48 border border-slate-700">
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-rule bg-paper flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="btn-secondary py-1.5 px-4 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
