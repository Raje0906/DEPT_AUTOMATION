import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function WhatsAppNotifyModal({ isOpen, onClose }) {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState('ALL'); // 'ALL' or enrollment_no
  const [type, setType] = useState('custom'); // 'custom', 'defaulter', 'result'
  
  // Custom message state
  const [customMsg, setCustomMsg] = useState('Reminder from Department: Please report to the seminar hall for your project review tomorrow.');
  
  // Defaulter state
  const [defaulterPercent, setDefaulterPercent] = useState('64.5');
  const [subjectShortfall, setSubjectShortfall] = useState('CNS (52%), DBMS (60%)');

  // Result state
  const [resultSem, setResultSem] = useState('5');
  const [resultSgpa, setResultSgpa] = useState('8.45');
  const [resultStatus, setResultStatus] = useState('FIRST CLASS WITH DISTINCTION');

  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get('/notifications/whatsapp/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to get status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get('/notifications/whatsapp/students');
      if (res.data?.students) {
        setStudents(res.data.students);
      }
    } catch (err) {
      console.error('Failed to fetch test students:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchStudents();
      setLastResult(null);
    }
  }, [isOpen]);

  const handleInit = async () => {
    try {
      toast.loading('Initializing WhatsApp...', { id: 'wa-init' });
      await api.post('/notifications/whatsapp/init');
      toast.success('WhatsApp initialized. Check QR in terminal or below.', { id: 'wa-init' });
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      toast.error('Init failed: ' + (err.response?.data?.error || err.message), { id: 'wa-init' });
    }
  };

  const handleSend = async () => {
    setSending(true);
    setLastResult(null);

    try {
      let res;
      if (selectedRecipient === 'ALL') {
        // Broadcast
        let title = 'Department Alert';
        let body = customMsg;
        if (type === 'defaulter') {
          title = 'Attendance Defaulter Warning (<75%)';
          body = `Your overall attendance is below 75.0%. Please contact your class mentor immediately to sign your undertaking.`;
        } else if (type === 'result') {
          title = `Semester ${resultSem} Exam Results Published`;
          body = `Semester ${resultSem} examination marks have been published. Log into the student portal to review your scorecard.`;
        }

        res = await api.post('/notifications/whatsapp/broadcast', {
          title,
          message: body,
        });
        toast.success(`Broadcast dispatched to ${res.data.count || 4} whitelisted students!`);
      } else {
        // Specific whitelisted student
        if (type === 'custom') {
          res = await api.post('/notifications/whatsapp/send-test', {
            enrollment_no: selectedRecipient,
            message: customMsg,
          });
        } else if (type === 'defaulter') {
          res = await api.post('/notifications/whatsapp/send-defaulter', {
            enrollment_no: selectedRecipient,
            overallPercentage: parseFloat(defaulterPercent),
            shortfalls: [
              { code: 'Shortfalls', percentage: defaulterPercent, attended: 'Low', total: 'Mandatory' }
            ],
          });
        } else if (type === 'result') {
          res = await api.post('/notifications/whatsapp/send-result', {
            enrollment_no: selectedRecipient,
            semester: parseInt(resultSem, 10),
            sgpa: parseFloat(resultSgpa),
            resultStatus,
          });
        }
        toast.success(`Notification delivered to ${selectedRecipient}!`);
      }

      setLastResult({ success: true, data: res.data });
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Send failed';
      toast.error(errMsg);
      setLastResult({ success: false, error: errMsg });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-700 to-teal-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl shadow-inner">
              💬
            </div>
            <div>
              <h2 className="font-bold text-base tracking-wide flex items-center gap-2">
                WhatsApp Notification Center
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-200 border border-emerald-500/30">
                  Baileys Engine
                </span>
              </h2>
              <p className="text-xs text-emerald-100">
                Test Dispatcher (Restricted to 4 Approved Students)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Connection Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full animate-pulse ${
                  status?.isConnected
                    ? 'bg-emerald-500'
                    : status?.hasQr
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <div>
                <p className="font-semibold text-xs text-slate-800">
                  Status:{' '}
                  {status?.isConnected
                    ? `Connected (${status?.connectedUser || 'Active'})`
                    : status?.hasQr
                    ? 'QR Ready (Needs Scan)'
                    : 'Disconnected'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {status?.isConnected
                    ? 'Socket linked and ready to dispatch WhatsApp alerts.'
                    : 'Scan the QR code from the server console or below.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchStatus}
                disabled={loadingStatus}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 text-slate-700 font-medium cursor-pointer"
              >
                {loadingStatus ? '...' : 'Refresh'}
              </button>
              {!status?.isConnected && (
                <button
                  onClick={handleInit}
                  className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium cursor-pointer"
                >
                  Pair / Init
                </button>
              )}
            </div>
          </div>

          {/* QR Code Preview if waiting for pairing */}
          {status?.hasQr && !status?.isConnected && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-2">
              <p className="font-bold text-xs text-amber-900">
                Scan with WhatsApp (Linked Devices):
              </p>
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    status.qr
                  )}`}
                  alt="WhatsApp QR Code"
                  className="w-44 h-44 rounded border border-amber-300 shadow-xs bg-white p-2"
                />
              </div>
              <p className="text-[11px] text-amber-800">
                Session credentials will be saved locally in <code>data/whatsapp_session</code>.
              </p>
            </div>
          )}

          {/* Recipient Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Whitelisted Recipient:
            </label>
            <select
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
              className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2.5 bg-white focus:outline-emerald-600 cursor-pointer"
            >
              <option value="ALL">
                📢 Broadcast to All 4 Whitelisted Students
              </option>
              {students.map((st) => (
                <option key={st.enrollment_no} value={st.enrollment_no}>
                  {st.enrollment_no} — {st.name} ({st.mobile || 'No Mobile'})
                </option>
              ))}
              {students.length === 0 && (
                <>
                  <option value="F23112050">F23112050 — RAJE ADITYA YOGESH (9699616876)</option>
                  <option value="F23112035">F23112035 — PAL NIHAR NIKHIL (9404241539)</option>
                  <option value="F23112061">F23112061 — HOLE ANSHU NITIN (8446016602)</option>
                  <option value="F23112151">F23112151 — SOHAM ATUL SHELKE (9970024042)</option>
                </>
              )}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              🔒 Whitelist active: All other students are strictly protected and will not receive any test messages.
            </p>
          </div>

          {/* Notification Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Notification Template Type:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('custom')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  type === 'custom'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-slate-600'
                }`}
              >
                Custom Notice
              </button>
              <button
                type="button"
                onClick={() => setType('defaulter')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  type === 'defaulter'
                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-slate-600'
                }`}
              >
                Defaulter Alert (&lt;75%)
              </button>
              <button
                type="button"
                onClick={() => setType('result')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  type === 'result'
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-slate-600'
                }`}
              >
                Result Published
              </button>
            </div>
          </div>

          {/* Form Fields Based on Type */}
          {type === 'custom' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Message Content:
              </label>
              <textarea
                rows={3}
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-emerald-600"
                placeholder="Type your message here..."
              />
            </div>
          )}

          {type === 'defaulter' && (
            <div className="space-y-3 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Attendance Percentage (%):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={defaulterPercent}
                    onChange={(e) => setDefaulterPercent(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Defaulter Tier:
                  </label>
                  <div className="p-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded">
                    HIGH RISK (&lt; 75%)
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Subjects with Shortfall:
                </label>
                <input
                  type="text"
                  value={subjectShortfall}
                  onChange={(e) => setSubjectShortfall(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                  placeholder="e.g. CNS (52%), DBMS (60%)"
                />
              </div>
            </div>
          )}

          {type === 'result' && (
            <div className="space-y-3 bg-blue-50/50 p-3 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Semester:
                  </label>
                  <select
                    value={resultSem}
                    onChange={(e) => setResultSem(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                  >
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    SGPA:
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={resultSgpa}
                    onChange={(e) => setResultSgpa(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Result Status:
                </label>
                <input
                  type="text"
                  value={resultStatus}
                  onChange={(e) => setResultStatus(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
                />
              </div>
            </div>
          )}

          {/* Feedback Display */}
          {lastResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                lastResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <p className="font-bold">
                {lastResult.success ? '✓ Notification Dispatched' : '✕ Delivery Error'}
              </p>
              <p className="mt-0.5">
                {lastResult.success
                  ? 'The WhatsApp notification was successfully accepted by the Baileys socket!'
                  : lastResult.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !status?.isConnected}
            className={`px-5 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
              status?.isConnected
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-gray-400 cursor-not-allowed opacity-75'
            }`}
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Dispatching WhatsApp...</span>
              </>
            ) : (
              <>
                <span>💬</span>
                <span>Send WhatsApp Notification</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
