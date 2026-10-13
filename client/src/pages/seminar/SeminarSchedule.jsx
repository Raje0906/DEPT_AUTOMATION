import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';

// Presentation numbers configuration — adding a 3rd presentation only needs a new constant entry
export const PRESENTATIONS = [
  { no: 1, label: 'Presentation 1', defaultTitle: 'Seminar Presentation 1 Schedule' },
  { no: 2, label: 'Presentation 2', defaultTitle: 'Seminar Presentation 2 Schedule' },
];

export function formatWeekdayDate(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = weekdays[dateObj.getDay()];
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dayName}, ${dd}/${mm}/${y}`;
}

export default function SeminarSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [session, setSession] = useState(null);
  const [guides, setGuides] = useState([]);
  const [unassignedGroups, setUnassignedGroups] = useState([]);
  const [activeTab, setActiveTab] = useState(1); // 1 or 2
  const [scheduleData, setScheduleData] = useState({}); // { [presNo]: { title, rows: { [guideId]: { room_no, date, time_text } }, updated_at, updated_by_name } }
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk date and time inputs
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');

  // 1. Initial Load of Sessions
  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/seminar/sessions');
      const allSessions = data.sessions || [];
      setSessions(allSessions);

      const targetId = location.state?.sessionId ? String(location.state.sessionId) : null;
      const targetSession = targetId ? allSessions.find(s => String(s.id) === targetId) : null;
      const published = allSessions.find(s => s.status === 'PUBLISHED');
      const chosen = targetSession || published;

      if (!chosen || chosen.status !== 'PUBLISHED') {
        toast.error('Schedule presentation is only accessible for published sessions.');
        navigate('/faculty/seminar', { replace: true });
        return;
      }

      setSelectedSessionId(String(chosen.id));
    } catch (err) {
      toast.error('Failed to load seminar sessions');
      navigate('/faculty/seminar', { replace: true });
    }
  }, [navigate, location.state]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 2. Load Presentation Schedules for Selected Session
  const loadSchedule = useCallback(async (sessId) => {
    if (!sessId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/seminar/sessions/${sessId}/presentation-schedules`);
      if (data.session?.status !== 'PUBLISHED') {
        toast.error('Schedule presentation is only accessible for published sessions.');
        navigate('/faculty/seminar', { replace: true });
        return;
      }
      setSession(data.session);
      setGuides(data.guides || []);
      setUnassignedGroups(data.unassigned_groups || []);

      // Build structured schedules state
      const initialSchedules = {};
      PRESENTATIONS.forEach((p) => {
        const saved = data.schedules?.[p.no] || {};
        const rowsObj = {};
        (data.guides || []).forEach((g) => {
          const savedRow = saved.rows?.[g.guide_id] || {};
          rowsObj[g.guide_id] = {
            guide_id: g.guide_id,
            room_no: savedRow.room_no || '',
            date: savedRow.date || '',
            time_text: savedRow.time_text || '',
          };
        });

        initialSchedules[p.no] = {
          title: saved.title || p.defaultTitle,
          updated_at: saved.updated_at || null,
          updated_by_name: saved.updated_by_name || null,
          rows: rowsObj,
        };
      });

      setScheduleData(initialSchedules);
      setIsDirty(false);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Schedule presentation is only accessible for published sessions.');
        navigate('/faculty/seminar', { replace: true });
      } else {
        toast.error(err.response?.data?.error || 'Failed to load schedule');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSchedule(selectedSessionId);
    }
  }, [selectedSessionId, loadSchedule]);

  // Warn when leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Current presentation state
  const currentSchedule = scheduleData[activeTab] || {
    title: PRESENTATIONS.find(p => p.no === activeTab)?.defaultTitle || '',
    rows: {},
    updated_at: null,
    updated_by_name: null,
  };

  // Row update handler
  const handleRowChange = (guideId, field, value) => {
    setScheduleData(prev => {
      const pres = prev[activeTab] || { title: '', rows: {} };
      const row = pres.rows[guideId] || { guide_id: guideId, room_no: '', date: '', time_text: '' };
      return {
        ...prev,
        [activeTab]: {
          ...pres,
          rows: {
            ...pres.rows,
            [guideId]: {
              ...row,
              [field]: value,
            },
          },
        },
      };
    });
    setIsDirty(true);
  };

  // Title update handler
  const handleTitleChange = (newTitle) => {
    setScheduleData(prev => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] || {}),
        title: newTitle,
      },
    }));
    setIsDirty(true);
  };

  // Set date and time for all rows
  const handleApplyToAllRows = () => {
    if (!bulkDate && !bulkTime) {
      toast.error('Enter a date or time to apply to all rows');
      return;
    }
    setScheduleData(prev => {
      const pres = prev[activeTab] || { title: '', rows: {} };
      const updatedRows = { ...pres.rows };
      guides.forEach(g => {
        const existing = updatedRows[g.guide_id] || { guide_id: g.guide_id, room_no: '', date: '', time_text: '' };
        updatedRows[g.guide_id] = {
          ...existing,
          date: bulkDate !== '' ? bulkDate : existing.date,
          time_text: bulkTime !== '' ? bulkTime : existing.time_text,
        };
      });
      return {
        ...prev,
        [activeTab]: {
          ...pres,
          rows: updatedRows,
        },
      };
    });
    setIsDirty(true);
    toast.success('Applied date and time to all rows');
  };

  // Copy from other presentation
  const otherPresentationNo = activeTab === 1 ? 2 : 1;
  const handleCopyFromOther = () => {
    const sourceSchedule = scheduleData[otherPresentationNo];
    if (!sourceSchedule || !sourceSchedule.rows) {
      toast.error(`Presentation ${otherPresentationNo} has no rows to copy`);
      return;
    }
    const confirmed = window.confirm(
      `Copy schedule rows from Presentation ${otherPresentationNo}? This will overwrite room and date/time values for matching guides in Presentation ${activeTab}.`
    );
    if (!confirmed) return;

    setScheduleData(prev => {
      const currentPres = prev[activeTab] || { title: '', rows: {} };
      const newRows = { ...currentPres.rows };
      guides.forEach(g => {
        const sourceRow = sourceSchedule.rows[g.guide_id];
        if (sourceRow) {
          newRows[g.guide_id] = {
            guide_id: g.guide_id,
            room_no: sourceRow.room_no || '',
            date: sourceRow.date || '',
            time_text: sourceRow.time_text || '',
          };
        }
      });
      return {
        ...prev,
        [activeTab]: {
          ...currentPres,
          rows: newRows,
        },
      };
    });
    setIsDirty(true);
    toast.success(`Copied schedule values from Presentation ${otherPresentationNo}`);
  };

  // Save schedule
  const handleSave = async () => {
    if (!selectedSessionId) return;
    setSaving(true);
    try {
      const payloadRows = guides.map(g => {
        const row = currentSchedule.rows[g.guide_id] || {};
        return {
          guide_id: g.guide_id,
          room_no: row.room_no || '',
          date: row.date || null,
          time_text: row.time_text || '',
        };
      });

      const { data } = await api.put(
        `/seminar/sessions/${selectedSessionId}/presentation-schedules/${activeTab}`,
        {
          title: currentSchedule.title,
          rows: payloadRows,
        }
      );

      setScheduleData(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          updated_at: data.updated_at,
          updated_by_name: data.updated_by_name,
        },
      }));
      setIsDirty(false);
      toast.success(`Presentation ${activeTab} schedule saved successfully`);

      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(w => toast(w.message));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Soft room clash detection
  const roomClashes = useMemo(() => {
    const clashes = [];
    const slotMap = new Map();

    guides.forEach(g => {
      const r = currentSchedule.rows[g.guide_id];
      if (r && r.room_no && r.date && r.time_text) {
        const key = `${r.room_no.trim().toLowerCase()}__${r.date.trim()}__${r.time_text.trim().toLowerCase()}`;
        if (slotMap.has(key)) {
          const other = slotMap.get(key);
          clashes.push({
            room: r.room_no,
            date: r.date,
            time: r.time_text,
            guides: [other.guide_name, g.guide_name],
          });
        } else {
          slotMap.set(key, g);
        }
      }
    });

    return clashes;
  }, [guides, currentSchedule]);

  // Download PDF
  const handleDownloadPdf = () => {
    if (guides.length === 0) {
      toast.error('No guide records available to generate PDF');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;

      // Notice Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 45, 90); // #1E2D5A
      doc.text('M.E.S. Wadia College of Engineering, Pune-01', pageWidth / 2, 45, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 45, 90);
      doc.text('Department of Computer Engineering', pageWidth / 2, 62, { align: 'center' });

      // Title & Academic Year
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(26, 31, 54); // #1A1F36
      const scheduleTitle = currentSchedule.title || `Seminar Presentation ${activeTab} Schedule`;
      doc.text(scheduleTitle.toUpperCase(), pageWidth / 2, 82, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70, 80, 95);
      doc.text(`Academic Year: ${session?.academic_year || '2025-26'}`, pageWidth / 2, 96, { align: 'center' });

      // Divider line
      doc.setDrawColor(212, 208, 200); // #D4D0C8
      doc.setLineWidth(1);
      doc.line(margin, 105, pageWidth - margin, 105);

      // Check if every row has the same date and time
      const firstRow = currentSchedule.rows[guides[0]?.guide_id] || {};
      const allSameDateTime =
        guides.length > 0 &&
        Boolean(firstRow.date && firstRow.time_text) &&
        guides.every(g => {
          const r = currentSchedule.rows[g.guide_id] || {};
          return r.date === firstRow.date && r.time_text === firstRow.time_text;
        });

      const combinedDateTimeText = allSameDateTime
        ? `${formatWeekdayDate(firstRow.date)}\n${firstRow.time_text}`
        : '';

      const tableRows = guides.map((g, idx) => {
        const r = currentSchedule.rows[g.guide_id] || {};
        const srNo = String(idx + 1);
        const guideName = g.guide_name || '—';
        const groupNos = (g.group_nos || []).join(', ') || '—';
        const roomNo = r.room_no || '—';
        const rowDateTime = r.date
          ? `${formatWeekdayDate(r.date)} ${r.time_text || ''}`.trim()
          : (r.time_text || '—');

        if (allSameDateTime) {
          if (idx === 0) {
            return [
              srNo,
              guideName,
              groupNos,
              roomNo,
              {
                content: combinedDateTimeText,
                rowSpan: guides.length,
                styles: { valign: 'middle', halign: 'center' },
              },
            ];
          }
          return [srNo, guideName, groupNos, roomNo];
        }

        return [srNo, guideName, groupNos, roomNo, rowDateTime];
      });

      autoTable(doc, {
        startY: 115,
        margin: { left: margin, right: margin },
        head: [['Sr. No.', 'Name of the project guide', 'Group nos.', 'Room no.', 'Date and time']],
        body: tableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [245, 243, 238], // #F5F3EE
          textColor: [30, 45, 90],
          fontStyle: 'bold',
          fontSize: 9,
          lineColor: [212, 208, 200],
          lineWidth: 0.5,
          halign: 'left',
        },
        bodyStyles: {
          textColor: [26, 31, 54],
          fontSize: 8.5,
          lineColor: [212, 208, 200],
          lineWidth: 0.5,
          cellPadding: 7,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 42, halign: 'center' },
          1: { cellWidth: 155 },
          2: { cellWidth: 115 },
          3: { cellWidth: 70 },
          4: { cellWidth: 140 },
        },
      });

      doc.save(`${scheduleTitle.replace(/\s+/g, '_')}_Notice.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const lastSavedText = currentSchedule.updated_at
    ? `Last saved ${new Date(currentSchedule.updated_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}${currentSchedule.updated_by_name ? ` by ${currentSchedule.updated_by_name}` : ''}`
    : 'Not saved yet';

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-left">
        <p className="text-xs text-slate-500 font-medium">Loading presentation schedules...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-left">
      {/* Page Header */}
      <div className="border-b border-[#D4D0C8] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/faculty/seminar')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E2D5A] bg-white border border-[#D4D0C8] rounded hover:bg-slate-50 transition-colors shrink-0 mt-0.5"
            title="Back to Seminar Governance"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              TE Seminar Coordination &bull; M.E.S. Wadia College of Engineering
            </span>
            <h1 className="text-xl font-bold text-[#1E2D5A] mt-0.5">
              Schedule presentation
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Department notice schedule for seminar presentations. Values stay with the assigned guide.
            </p>
          </div>
        </div>

        {/* Session selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="session-select" className="text-xs font-medium text-slate-600">
            Session:
          </label>
          <select
            id="session-select"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="border border-[#D4D0C8] rounded px-3 py-1.5 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-[#1E2D5A]"
          >
            {sessions.filter(s => s.status === 'PUBLISHED').map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.academic_year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Warnings & Notices */}
      {unassignedGroups.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 font-medium">
          Groups without a guide: {unassignedGroups.join(', ')}
        </div>
      )}

      {roomClashes.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 space-y-1">
          <p className="font-bold">Schedule soft warnings (room clashes):</p>
          {roomClashes.map((c, i) => (
            <p key={i}>
              Room &quot;{c.room}&quot; is used by multiple guides ({c.guides.join(' & ')}) on {formatWeekdayDate(c.date)} ({c.time}).
            </p>
          ))}
        </div>
      )}

      {/* Presentation Tabs */}
      <div className="border-b border-[#D4D0C8] flex items-center gap-2">
        {PRESENTATIONS.map((p) => {
          const isActive = activeTab === p.no;
          return (
            <button
              key={p.no}
              id={`tab-presentation-${p.no}`}
              type="button"
              onClick={() => {
                if (isDirty) {
                  const proceed = window.confirm('You have unsaved changes. Switch tabs without saving?');
                  if (!proceed) return;
                }
                setActiveTab(p.no);
                setIsDirty(false);
              }}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                isActive
                  ? 'border-[#1E2D5A] text-[#1E2D5A] bg-white'
                  : 'border-transparent text-slate-500 hover:text-[#1E2D5A]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main Schedule Content */}
      {guides.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500 border border-[#D4D0C8] rounded bg-white">
          No seminar groups with assigned guides found in this session.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Title, Bulk Apply, Copy, Save, PDF */}
          <div className="p-4 bg-white border border-[#D4D0C8] rounded space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1 max-w-md">
                <label htmlFor="schedule-title-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Editable schedule title (for department notice & PDF)
                </label>
                <input
                  id="schedule-title-input"
                  type="text"
                  value={currentSchedule.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-xs p-2 border border-[#D4D0C8] rounded focus:border-[#1E2D5A] focus:outline-none"
                  placeholder="e.g. TE Seminar Presentation 1 Schedule"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  id="btn-copy-presentation"
                  variant="secondary"
                  onClick={handleCopyFromOther}
                >
                  Copy from Presentation {otherPresentationNo}
                </Button>
                <Button
                  id="btn-download-pdf"
                  variant="secondary"
                  onClick={handleDownloadPdf}
                >
                  Download PDF
                </Button>
                <Button
                  id="btn-save-schedule"
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                  disabledReason={saving ? 'Saving...' : ''}
                >
                  {saving ? 'Saving...' : 'Save schedule'}
                </Button>
              </div>
            </div>

            {/* Bulk Date & Time Setter */}
            <div className="pt-3 border-t border-[#D4D0C8] flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">Set date and time for all rows:</span>
              <div className="flex items-center gap-2">
                <input
                  id="bulk-date-input"
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="border border-[#D4D0C8] rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1E2D5A]"
                  title="Choose bulk date"
                />
                {bulkDate && (
                  <span className="text-[11px] text-[#1E2D5A] font-medium font-mono">
                    {formatWeekdayDate(bulkDate)}
                  </span>
                )}
              </div>
              <input
                id="bulk-time-input"
                type="text"
                placeholder="e.g. 9:00 AM onwards"
                value={bulkTime}
                onChange={(e) => setBulkTime(e.target.value)}
                className="border border-[#D4D0C8] rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1E2D5A] w-48"
              />
              <Button
                id="btn-apply-all-rows"
                variant="secondary"
                onClick={handleApplyToAllRows}
                className="min-h-[36px] py-1.5"
              >
                Apply to all rows
              </Button>
            </div>

            {/* Last saved indicator */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>{lastSavedText}</span>
              {isDirty && (
                <span className="text-amber-700 font-semibold">
                  You have unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* Department Notice Table */}
          <div className="border border-[#D4D0C8] rounded overflow-x-auto bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D4D0C8] bg-slate-50 text-[#1E2D5A] font-bold">
                  <th className="p-3 w-16 text-center border-r border-[#D4D0C8]">Sr. No.</th>
                  <th className="p-3 border-r border-[#D4D0C8]">Name of the project guide</th>
                  <th className="p-3 border-r border-[#D4D0C8]">Group nos.</th>
                  <th className="p-3 border-r border-[#D4D0C8] w-44">Room no.</th>
                  <th className="p-3">Date and time</th>
                </tr>
              </thead>
              <tbody>
                {guides.map((g, idx) => {
                  const row = currentSchedule.rows[g.guide_id] || {
                    room_no: '',
                    date: '',
                    time_text: '',
                  };
                  const weekdayFormatted = formatWeekdayDate(row.date);

                  return (
                    <tr
                      key={g.guide_id}
                      className="border-b border-[#D4D0C8] last:border-b-0 hover:bg-slate-50/50"
                    >
                      {/* Sr. No. */}
                      <td className="p-3 text-center font-mono text-slate-600 border-r border-[#D4D0C8]">
                        {idx + 1}
                      </td>

                      {/* Guide Name */}
                      <td className="p-3 font-medium text-slate-900 border-r border-[#D4D0C8]">
                        {g.guide_name}
                      </td>

                      {/* Group Nos. */}
                      <td className="p-3 font-mono text-slate-800 border-r border-[#D4D0C8]">
                        {g.group_nos.join(', ')}
                      </td>

                      {/* Room No. */}
                      <td className="p-3 border-r border-[#D4D0C8]">
                        <input
                          id={`room-input-${g.guide_id}`}
                          type="text"
                          placeholder="Room no."
                          value={row.room_no}
                          onChange={(e) => handleRowChange(g.guide_id, 'room_no', e.target.value)}
                          className="w-full p-1.5 border border-transparent hover:border-[#D4D0C8] focus:border-[#1E2D5A] rounded text-xs bg-transparent focus:bg-white focus:outline-none transition-colors"
                        />
                      </td>

                      {/* Date and time */}
                      <td className="p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              id={`date-input-${g.guide_id}`}
                              type="date"
                              value={row.date}
                              onChange={(e) => handleRowChange(g.guide_id, 'date', e.target.value)}
                              className="p-1.5 border border-[#D4D0C8] rounded text-xs bg-white focus:border-[#1E2D5A] focus:outline-none"
                            />
                            {weekdayFormatted && (
                              <span className="text-[11px] text-[#1E2D5A] font-medium whitespace-nowrap">
                                {weekdayFormatted}
                              </span>
                            )}
                          </div>
                          <input
                            id={`time-input-${g.guide_id}`}
                            type="text"
                            placeholder="e.g. 9:00 AM onwards"
                            value={row.time_text}
                            onChange={(e) => handleRowChange(g.guide_id, 'time_text', e.target.value)}
                            className="flex-1 p-1.5 border border-transparent hover:border-[#D4D0C8] focus:border-[#1E2D5A] rounded text-xs bg-transparent focus:bg-white focus:outline-none transition-colors"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
