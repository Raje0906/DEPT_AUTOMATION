import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function SeminarEvaluation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState(null);
  const [guide, setGuide] = useState(null);
  const [groups, setGroups] = useState([]);
  const [guideOptions, setGuideOptions] = useState([]);
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [isHodOrCoordinator, setIsHodOrCoordinator] = useState(false);

  // Metrics state
  const [metrics, setMetrics] = useState([
    { id: '1', name: 'Literature Survey', max_marks: 5, display_order: 1 },
    { id: '2', name: 'Report Writing', max_marks: 5, display_order: 2 },
    { id: '3', name: 'Topic Understanding', max_marks: 5, display_order: 3 },
    { id: '4', name: 'Attendance & Active Participation', max_marks: 5, display_order: 4 },
    { id: '5', name: 'Presentation Skill', max_marks: 5, display_order: 5 },
  ]);

  // Marks inputs keyed by student PRN: { [prn]: { metric_scores: { [metricName]: score }, remarks: '' } }
  const [marksState, setMarksState] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // Metrics editor modal state
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [editingMetrics, setEditingMetrics] = useState([]);

  // Calculate total max marks from metrics
  const totalMaxMarks = useMemo(() => {
    return metrics.reduce((acc, m) => acc + (parseFloat(m.max_marks) || 0), 0);
  }, [metrics]);

  // Load evaluation sheet data
  const loadData = useCallback(async (guideId = null) => {
    setLoading(true);
    try {
      const params = {};
      if (guideId) params.guide_id = guideId;
      else if (selectedGuideId) params.guide_id = selectedGuideId;

      const res = await api.get('/seminar/evaluation-sheet', { params });
      const d = res.data;

      setSession(d.session);
      setGuide(d.guide);
      setGroups(d.groups || []);
      setGuideOptions(d.guideOptions || []);
      setIsHodOrCoordinator(Boolean(d.isHodOrCoordinator));
      if (d.guide?.id) setSelectedGuideId(String(d.guide.id));

      if (Array.isArray(d.metrics) && d.metrics.length > 0) {
        setMetrics(d.metrics);
      }

      // Initialize marksState from fetched marks
      const initMarks = {};
      const fetchedMarks = d.marks || {};

      (d.groups || []).forEach(grp => {
        (grp.members || []).forEach(m => {
          const prnVal = m.university_prn || m.prn;
          const existing = fetchedMarks[prnVal] || {};
          let scores = existing.metric_scores || {};
          if (typeof scores === 'string') {
            try { scores = JSON.parse(scores); } catch (e) { scores = {}; }
          }
          initMarks[prnVal] = {
            metric_scores: scores,
            remarks: existing.remarks || '',
            status: existing.status || 'DRAFT',
          };
        });
      });

      setMarksState(initMarks);
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load evaluation sheet:', err);
      toast.error(err.response?.data?.error || 'Failed to load evaluation sheet');
    } finally {
      setLoading(false);
    }
  }, [selectedGuideId]);

  useEffect(() => {
    const guideParam = searchParams.get('guide_id');
    loadData(guideParam);
  }, []);

  // Update mark score for a student and metric
  const handleScoreChange = (prn, metricName, value, maxAllowed) => {
    const rawVal = value === '' ? '' : parseFloat(value);
    if (value !== '' && (isNaN(rawVal) || rawVal < 0)) return;

    setMarksState(prev => {
      const studentData = prev[prn] || { metric_scores: {}, remarks: '' };
      return {
        ...prev,
        [prn]: {
          ...studentData,
          metric_scores: {
            ...studentData.metric_scores,
            [metricName]: value === '' ? '' : Math.min(rawVal, maxAllowed),
          },
        },
      };
    });
    setIsDirty(true);
  };

  // Calculate sum of marks for a specific student
  const getStudentTotal = (prn) => {
    const studentData = marksState[prn];
    if (!studentData || !studentData.metric_scores) return 0;
    let sum = 0;
    metrics.forEach(m => {
      const val = studentData.metric_scores[m.name];
      if (val !== undefined && val !== null && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) sum += num;
      }
    });
    return Math.round(sum * 100) / 100;
  };

  // Save marks (Draft or Final Submission)
  const handleSaveEvaluation = async (status = 'DRAFT') => {
    if (!session?.id) return;

    // Validate marks before submitting
    if (status === 'SUBMITTED') {
      let missingCount = 0;
      groups.forEach(grp => {
        (grp.members || []).forEach(m => {
          const prnVal = m.university_prn || m.prn;
          const scores = marksState[prnVal]?.metric_scores || {};
          metrics.forEach(metric => {
            const v = scores[metric.name];
            if (v === '' || v === undefined || v === null) {
              missingCount++;
            }
          });
        });
      });

      if (missingCount > 0) {
        const confirmSubmit = window.confirm(
          `There are ${missingCount} unfilled score field(s). Do you still wish to finalize and submit the evaluation?`
        );
        if (!confirmSubmit) return;
      }
    }

    setSaving(true);
    try {
      const marksPayload = [];
      groups.forEach(grp => {
        (grp.members || []).forEach(m => {
          const prnVal = m.university_prn || m.prn;
          const studentData = marksState[prnVal] || {};
          const totalVal = getStudentTotal(prnVal);
          marksPayload.push({
            group_id: grp.id,
            prn: prnVal,
            metric_scores: studentData.metric_scores || {},
            total_marks: totalVal,
            max_marks: totalMaxMarks,
            remarks: studentData.remarks || '',
          });
        });
      });

      const res = await api.post('/seminar/evaluation-sheet', {
        session_id: session.id,
        status,
        marks: marksPayload,
      });

      toast.success(res.data?.message || 'Evaluation saved successfully');
      setIsDirty(false);
      await loadData();
    } catch (err) {
      console.error('Save evaluation error:', err);
      toast.error(err.response?.data?.error || 'Failed to save evaluation');
    } finally {
      setSaving(false);
    }
  };

  // Open Metrics Config Modal
  const openMetricsModal = () => {
    setEditingMetrics(metrics.map(m => ({ ...m })));
    setShowMetricsModal(true);
  };

  // Add new metric
  const handleAddMetric = () => {
    setEditingMetrics(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: `Criterion ${prev.length + 1}`,
        max_marks: 5,
        display_order: prev.length + 1,
      },
    ]);
  };

  // Update metric attribute in modal
  const handleEditMetricChange = (index, field, value) => {
    setEditingMetrics(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Delete metric
  const handleDeleteMetric = (index) => {
    if (editingMetrics.length <= 1) {
      toast.error('At least one evaluation metric is required.');
      return;
    }
    setEditingMetrics(prev => prev.filter((_, i) => i !== index));
  };

  // Move metric up / down
  const handleMoveMetric = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= editingMetrics.length) return;
    setEditingMetrics(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Save metrics changes
  const handleSaveMetrics = async () => {
    if (!session?.id) return;
    try {
      const payloadMetrics = editingMetrics.map((m, idx) => ({
        ...m,
        name: m.name.trim() || `Criterion ${idx + 1}`,
        max_marks: parseFloat(m.max_marks) || 5,
        display_order: idx + 1,
      }));

      const res = await api.put(`/seminar/sessions/${session.id}/metrics`, {
        metrics: payloadMetrics,
      });

      setMetrics(res.data.metrics || payloadMetrics);
      setShowMetricsModal(false);
      toast.success('Evaluation metrics updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update metrics');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [];
      const merges = [];

      const totalCols = 7 + metrics.length + 1;

      // Header Rows
      wsData.push(['M.E.S. WADIA COLLEGE OF ENGINEERING, PUNE', ...new Array(totalCols - 1).fill('')]);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });

      wsData.push(['DEPARTMENT OF COMPUTER ENGINEERING', ...new Array(totalCols - 1).fill('')]);
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });

      wsData.push([`TE SEMINAR EVALUATION SHEET — ${session?.name || 'AY 2025-26 Sem 1'}`, ...new Array(totalCols - 1).fill('')]);
      merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } });

      const metaText = `Guide Name: ${guide?.name || 'Guide'}        |        Assigned Examiner: ${guide?.examiner_name || 'Not assigned yet'}`;
      wsData.push([metaText, ...new Array(totalCols - 1).fill('')]);
      merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } });

      wsData.push(new Array(totalCols).fill(''));

      // Column Header Row
      const headerCols = [
        'Group Number',
        'Student Name',
        'University PRN',
        'Sign',
        'Final Topic',
        'Domain',
        'Guide Name',
        ...metrics.map(m => `${m.name} (${m.max_marks})`),
        `Total (${totalMaxMarks})`,
      ];
      wsData.push(headerCols);

      let currentRow = 5;

      groups.forEach(grp => {
        const members = grp.members && grp.members.length > 0 ? grp.members : [{ student_name: '—', prn: '—' }];
        const startRow = currentRow + 1;
        const grpNoText = grp.group_no ? `Group #${grp.group_no}` : '—';
        const finalTopicText = grp.final_topic || grp.topic || (members[0]?.topic1 || '—');
        const domainText = grp.domain || 'General Computing';
        const grpGuideName = grp.guide_name || guide?.name || 'Assigned Guide';

        members.forEach(m => {
          currentRow++;
          const prnVal = m.university_prn || m.prn || '';
          const studentScores = marksState[prnVal]?.metric_scores || {};
          const studentTotal = getStudentTotal(prnVal);

          const metricCells = metrics.map(metric => {
            const val = studentScores[metric.name];
            return val !== undefined && val !== null && val !== '' ? Number(val) : '';
          });

          const row = [
            grpNoText,
            m.student_name || '',
            prnVal,
            '', // Sign
            finalTopicText,
            domainText,
            grpGuideName,
            ...metricCells,
            studentTotal > 0 ? studentTotal : '',
          ];
          wsData.push(row);
        });

        const endRow = currentRow;
        if (members.length > 1) {
          [0, 4, 5, 6].forEach(colIdx => {
            merges.push({
              s: { r: startRow, c: colIdx },
              e: { r: endRow, c: colIdx },
            });
          });
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!merges'] = merges;
      ws['!cols'] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 18 },
        { wch: 12 },
        { wch: 38 },
        { wch: 24 },
        { wch: 26 },
        ...metrics.map(() => ({ wch: 18 })),
        { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Evaluation Sheet');
      const filename = `Seminar_Evaluation_Sheet_${(guide?.name || 'Guide').replace(/[^a-z0-9]/gi, '_')}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Evaluation sheet exported to Excel');
    } catch (err) {
      console.error('Export Excel error:', err);
      toast.error('Failed to export Excel');
    }
  };

  // Export to PDF
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Notice Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(30, 45, 90);
      doc.text('M.E.S. WADIA COLLEGE OF ENGINEERING, PUNE', pageWidth / 2, 35, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 45, 90);
      doc.text('DEPARTMENT OF COMPUTER ENGINEERING', pageWidth / 2, 50, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(26, 31, 54);
      doc.text(`TE SEMINAR EVALUATION SHEET — ${session?.name || 'AY 2025-26 Sem 1'}`, pageWidth / 2, 66, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70, 80, 95);
      const metaLine = `Guide Name: ${guide?.name || 'Assigned Guide'}       |       Assigned Examiner: ${guide?.examiner_name || 'Not assigned yet'}`;
      doc.text(metaLine, pageWidth / 2, 80, { align: 'center' });

      // Table columns & rows
      const tableHead = [[
        'Group #',
        'Student Name',
        'University PRN',
        'Sign',
        'Final Topic',
        'Domain',
        'Guide Name',
        ...metrics.map(m => `${m.name}\n(${m.max_marks})`),
        `Total\n(${totalMaxMarks})`,
      ]];

      const tableBody = [];

      groups.forEach(grp => {
        const members = grp.members && grp.members.length > 0 ? grp.members : [{ student_name: '—', prn: '—' }];
        const grpNoText = grp.group_no ? `Group #${grp.group_no}` : '—';
        const finalTopicText = grp.final_topic || grp.topic || (members[0]?.topic1 || '—');
        const domainText = grp.domain || 'General Computing';
        const grpGuideName = grp.guide_name || guide?.name || 'Assigned Guide';

        members.forEach((m, mi) => {
          const prnVal = m.university_prn || m.prn || '';
          const studentScores = marksState[prnVal]?.metric_scores || {};
          const studentTotal = getStudentTotal(prnVal);

          const metricCells = metrics.map(metric => {
            const val = studentScores[metric.name];
            return val !== undefined && val !== null && val !== '' ? String(val) : '-';
          });

          // Row object with rowSpan for group columns on first member row
          tableBody.push([
            mi === 0 ? { content: grpNoText, rowSpan: members.length, styles: { valign: 'middle', halign: 'center' } } : null,
            m.student_name || '—',
            prnVal || '—',
            '', // Sign space
            mi === 0 ? { content: finalTopicText, rowSpan: members.length, styles: { valign: 'middle' } } : null,
            mi === 0 ? { content: domainText, rowSpan: members.length, styles: { valign: 'middle' } } : null,
            mi === 0 ? { content: grpGuideName, rowSpan: members.length, styles: { valign: 'middle' } } : null,
            ...metricCells,
            studentTotal > 0 ? String(studentTotal) : '-',
          ].filter(cell => cell !== null));
        });
      });

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: 92,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: 3.5,
          font: 'helvetica',
          textColor: [26, 31, 54],
          lineColor: [210, 215, 225],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [30, 45, 90],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { top: 92, left: 24, right: 24, bottom: 30 },
      });

      const filename = `Seminar_Evaluation_Sheet_${(guide?.name || 'Guide').replace(/[^a-z0-9]/gi, '_')}.pdf`;
      doc.save(filename);
      toast.success('Evaluation sheet exported to PDF');
    } catch (err) {
      console.error('Export PDF error:', err);
      toast.error('Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-3 border-[#1E2D5A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">Loading evaluation marksheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 space-y-5 text-slate-900">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate('/faculty/seminar/my-groups')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1 shadow-xs hover:bg-slate-50"
            >
              ← Assigned Groups
            </button>
            <span className="text-[11px] text-slate-400">&bull;</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1E2D5A]">
              TE Seminar Evaluation
            </span>
          </div>
          <h1 className="text-xl font-bold font-serif text-slate-900">
            Guide Evaluation Marksheet
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fill and record seminar marks for students across all assigned groups. Values auto-recalculate from the active rubric criteria.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* HOD/Coordinator Guide Switcher */}
          {isHodOrCoordinator && guideOptions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
              <span className="text-slate-500 font-medium text-[11px]">Guide:</span>
              <select
                value={selectedGuideId}
                onChange={(e) => {
                  setSelectedGuideId(e.target.value);
                  loadData(e.target.value);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none"
              >
                {guideOptions.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.faculty_name} ({g.designation || 'Guide'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={openMetricsModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E2D5A] bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 12h9.75M10.5 18h9.75M3 6h.008v.008H3V6zm0 6h.008v.008H3V12zm0 6h.008v.008H3V18z" />
            </svg>
            Configure Metrics ({metrics.length})
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export to Excel
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 rounded hover:bg-rose-100 transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.03-.48-2.91.12-4.14 0 0 1.2-1.68 3.96-1.68.72 0 1.32.12 1.8.36 0 0 .84.36 1.44 1.44 0 0 .48 1.08.36 2.04-.12 1.32-.96 2.16-1.56 2.64-1.2.96-2.64 1.44-4.32 1.56-.84.06-1.44-.06-1.8-.22z" />
            </svg>
            Export to PDF
          </button>
        </div>
      </div>

      {/* Guide, Examiner & Metric Information Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 block text-[11px]">Faculty Guide</span>
          <span className="font-bold text-slate-900 block mt-0.5 text-sm">
            {guide?.name || user?.name || 'Assigned Guide'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Assigned Examiner</span>
          <span className="font-bold text-[#1E2D5A] block mt-0.5 text-sm">
            {guide?.examiner_name || 'Not assigned yet'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Assigned Groups & Students</span>
          <span className="font-semibold text-slate-800 block mt-0.5">
            {groups.length} Groups &bull; {groups.reduce((acc, g) => acc + (g.members?.length || 0), 0)} Students
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Evaluation Max Total</span>
          <span className="font-mono font-bold text-slate-900 block mt-0.5 text-sm">
            {totalMaxMarks} Marks
          </span>
        </div>
      </div>

      {/* Main Consolidated Evaluation Sheet Table */}
      {groups.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/50">
          <p className="text-sm font-semibold text-slate-700">No seminar groups assigned to this guide.</p>
          <p className="text-xs text-slate-500 mt-1">Groups assigned by the Seminar Coordinator will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1E2D5A] text-white text-[11px] font-semibold divide-x divide-slate-700">
                  <th className="py-3 px-3 w-24 text-center whitespace-nowrap">Group Number</th>
                  <th className="py-3 px-3.5 min-w-[160px]">Student Name</th>
                  <th className="py-3 px-3 w-32 whitespace-nowrap">University PRN</th>
                  <th className="py-3 px-2 w-14 text-center">Sign</th>
                  <th className="py-3 px-3.5 min-w-[200px]">Final Topic</th>
                  <th className="py-3 px-3 min-w-[130px]">Domain</th>
                  <th className="py-3 px-3 min-w-[130px]">Guide Name</th>
                  {metrics.map(m => (
                    <th key={m.id || m.name} className="py-3 px-2 w-28 text-center bg-[#283b72]">
                      <div className="leading-tight">{m.name}</div>
                      <div className="text-[10px] opacity-80 mt-0.5 font-normal">Max: {m.max_marks}</div>
                    </th>
                  ))}
                  <th className="py-3 px-3 w-24 text-center bg-[#152042] font-bold">
                    Total
                    <div className="text-[10px] opacity-80 mt-0.5 font-normal">/ {totalMaxMarks}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {groups.map((grp) => {
                  const members = grp.members && grp.members.length > 0 ? grp.members : [{ student_name: '—', prn: '—' }];
                  const rowSpan = members.length;
                  const finalTopic = grp.final_topic || grp.topic || (members[0]?.topic1 || '—');
                  const domainText = grp.domain || 'General Computing';
                  const grpGuideName = grp.guide_name || guide?.name || 'Assigned Guide';

                  return members.map((m, mIdx) => {
                    const prnVal = m.university_prn || m.prn || '';
                    const studentTotal = getStudentTotal(prnVal);
                    const isEvenGroup = grp.group_no % 2 === 0;

                    return (
                      <tr
                        key={`${grp.id}_${prnVal}_${mIdx}`}
                        className={`${isEvenGroup ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/30 transition-colors divide-x divide-slate-100`}
                      >
                        {/* Group Number (Merged cell) */}
                        {mIdx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="py-3 px-2.5 text-center align-middle font-mono font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200"
                          >
                            <span className="inline-block px-2 py-1 rounded bg-white border border-slate-200 shadow-2xs">
                              Group #{grp.group_no}
                            </span>
                          </td>
                        )}

                        {/* Student Name */}
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                          {m.student_name || '—'}
                          {m.is_leader && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded">
                              Leader
                            </span>
                          )}
                        </td>

                        {/* University PRN */}
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                          {prnVal || '—'}
                        </td>

                        {/* Sign (Placeholder Box) */}
                        <td className="py-2 px-1 text-center align-middle">
                          <div className="w-9 h-7 border border-dashed border-slate-300 rounded mx-auto bg-slate-50/60" title="Signature"></div>
                        </td>

                        {/* Final Topic (Merged cell) */}
                        {mIdx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="py-3 px-3.5 align-middle text-slate-800 font-medium leading-relaxed bg-white border-r border-slate-200"
                          >
                            {finalTopic}
                          </td>
                        )}

                        {/* Domain (Merged cell) */}
                        {mIdx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="py-3 px-3 align-middle text-slate-700 font-medium bg-white border-r border-slate-200"
                          >
                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 text-[11px] block">
                              {domainText}
                            </span>
                          </td>
                        )}

                        {/* Guide Name (Merged cell) */}
                        {mIdx === 0 && (
                          <td
                            rowSpan={rowSpan}
                            className="py-3 px-3 align-middle text-slate-800 font-semibold bg-white border-r border-slate-200"
                          >
                            <div>{grpGuideName}</div>
                            {guide?.examiner_name && (
                              <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                Examiner: {guide.examiner_name}
                              </div>
                            )}
                          </td>
                        )}

                        {/* Metric Input Columns */}
                        {metrics.map(metric => {
                          const studentData = marksState[prnVal] || {};
                          const scoreVal = studentData.metric_scores?.[metric.name] ?? '';
                          const maxAllowed = parseFloat(metric.max_marks) || 5;
                          const isInvalid = scoreVal !== '' && parseFloat(scoreVal) > maxAllowed;

                          return (
                            <td key={metric.id || metric.name} className="py-2 px-2 text-center align-middle">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={maxAllowed}
                                value={scoreVal}
                                onChange={(e) => handleScoreChange(prnVal, metric.name, e.target.value, maxAllowed)}
                                placeholder="0"
                                className={`w-16 px-1.5 py-1 text-center font-mono font-bold text-xs rounded border transition-colors outline-none ${
                                  isInvalid
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-300 focus:border-[#1E2D5A] focus:ring-1 focus:ring-[#1E2D5A] bg-white'
                                }`}
                              />
                            </td>
                          );
                        })}

                        {/* Auto-recalculated Total Column */}
                        <td className="py-2.5 px-3 text-center align-middle font-mono font-bold text-xs text-[#1E2D5A] bg-slate-50/50">
                          <span className={`px-2 py-0.5 rounded ${
                            studentTotal > 0 ? 'bg-blue-100 text-[#1E2D5A]' : 'text-slate-400'
                          }`}>
                            {studentTotal.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky Bottom Bar for Submission */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    Unsaved mark entries present
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">All marks saved</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveEvaluation('DRAFT')}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 bg-white font-semibold hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft Marks'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveEvaluation('SUBMITTED')}
                className="px-4 py-2 rounded text-white bg-[#1E2D5A] font-semibold hover:bg-[#152042] transition-colors shadow-xs disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Finalize & Submit Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Configure Metrics (Add, Rename, Delete, Reorder, Set Max Marks) */}
      {showMetricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Evaluation Rubric Metrics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add, rename, reorder, delete metrics, and customize their max marks. Total max automatically calculates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMetricsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Metric Rows */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {editingMetrics.map((em, idx) => (
                <div
                  key={em.id || idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs"
                >
                  <span className="font-mono text-slate-400 font-bold w-5 text-center">
                    {idx + 1}
                  </span>

                  {/* Reorder Up / Down */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveMetric(idx, -1)}
                      className="text-slate-500 hover:text-slate-900 disabled:opacity-20 text-[10px] leading-none"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === editingMetrics.length - 1}
                      onClick={() => handleMoveMetric(idx, 1)}
                      className="text-slate-500 hover:text-slate-900 disabled:opacity-20 text-[10px] leading-none"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Metric Name Input */}
                  <input
                    type="text"
                    value={em.name}
                    onChange={(e) => handleEditMetricChange(idx, 'name', e.target.value)}
                    placeholder="Criterion Name"
                    className="flex-1 p-2 border border-slate-300 rounded bg-white text-xs font-medium focus:border-[#1E2D5A] outline-none"
                  />

                  {/* Max Marks Input */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Max:</span>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={em.max_marks}
                      onChange={(e) => handleEditMetricChange(idx, 'max_marks', e.target.value)}
                      className="w-16 p-2 text-center border border-slate-300 rounded bg-white font-mono font-bold text-xs focus:border-[#1E2D5A] outline-none"
                    />
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMetric(idx)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete Criterion"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAddMetric}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E2D5A] hover:underline"
              >
                + Add Another Metric
              </button>

              <div className="text-xs font-bold text-slate-800">
                Total Max Marks:{' '}
                <span className="font-mono text-sm text-[#1E2D5A]">
                  {editingMetrics.reduce((acc, m) => acc + (parseFloat(m.max_marks) || 0), 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMetricsModal(false)}
                className="px-3.5 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetrics}
                className="px-4 py-2 bg-[#1E2D5A] text-white rounded text-xs font-semibold hover:bg-[#152042] shadow-xs"
              >
                Save Metrics Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
