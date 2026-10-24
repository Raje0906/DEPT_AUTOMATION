import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Default presets for fast configuration
const RUBRIC_PRESETS = [
  {
    name: 'SPPU / NBA Standard 25M Rubric',
    description: '5 balanced criteria (5 marks each = 25 total), aligned with SPPU seminar assessment guidelines',
    metrics: [
      { name: 'Literature Survey', max_marks: 5 },
      { name: 'Report Writing', max_marks: 5 },
      { name: 'Topic Understanding', max_marks: 5 },
      { name: 'Attendance & Active Participation', max_marks: 5 },
      { name: 'Presentation Skill', max_marks: 5 },
    ],
  },
  {
    name: 'Comprehensive 50-Mark Rubric',
    description: 'Detailed rubric for in-depth evaluations (5 criteria, 10 marks each = 50 total)',
    metrics: [
      { name: 'Problem Formulation & Literature Review', max_marks: 10 },
      { name: 'Methodology & Technical Depth', max_marks: 10 },
      { name: 'Report Quality & Plagiarism Compliance', max_marks: 10 },
      { name: 'Presentation Delivery & Defense', max_marks: 10 },
      { name: 'Continuous Engagement & Viva Voce', max_marks: 10 },
    ],
  },
  {
    name: 'Presentation & Defense Focused (25M)',
    description: 'Emphasizes technical presentation defense (10 marks) and literature/report (5 marks each)',
    metrics: [
      { name: 'Topic Relevance & Literature Review', max_marks: 5 },
      { name: 'Technical Presentation Delivery', max_marks: 5 },
      { name: 'Q&A Viva Voce & Subject Defense', max_marks: 10 },
      { name: 'Report Documentation & Formatting', max_marks: 5 },
    ],
  },
];

export default function SeminarMetricsConfig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('session_id') || searchParams.get('sessionId');

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(sessionIdParam || '');
  const [metrics, setMetrics] = useState([]);
  const [initialMetrics, setInitialMetrics] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [saving, setSaving] = useState(false);

  // Authority check: Seminar Coordinator or HOD
  const isAuthorized = user?.role === 'hod' || !!user?.is_seminar_coordinator;

  // 1. Fetch available sessions
  useEffect(() => {
    let mounted = true;
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const res = await api.get('/seminar/sessions');
        const list = res.data.sessions || [];
        if (mounted) {
          setSessions(list);
          if (list.length > 0) {
            // If URL param is valid, keep it; otherwise default to first session
            const exists = list.some(s => String(s.id) === String(sessionIdParam));
            if (!exists) {
              setSelectedSessionId(String(list[0].id));
              setSearchParams({ session_id: String(list[0].id) });
            } else {
              setSelectedSessionId(String(sessionIdParam));
            }
          }
        }
      } catch (err) {
        toast.error('Failed to load seminar sessions');
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    };
    fetchSessions();
    return () => { mounted = false; };
  }, []);

  // 2. Fetch metrics whenever selectedSessionId changes
  const fetchMetrics = useCallback(async (sid) => {
    if (!sid) return;
    setLoadingMetrics(true);
    try {
      const res = await api.get(`/seminar/sessions/${sid}/metrics`);
      const loaded = (res.data.metrics || []).map((m, idx) => ({
        id: m.id || idx + 1,
        name: m.name || '',
        max_marks: parseFloat(m.max_marks) || 5,
        display_order: m.display_order ?? idx + 1,
      }));
      setMetrics(loaded);
      setInitialMetrics(JSON.parse(JSON.stringify(loaded)));
    } catch (err) {
      toast.error('Failed to load evaluation metrics for this session');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchMetrics(selectedSessionId);
    }
  }, [selectedSessionId, fetchMetrics]);

  // Handle session change in dropdown
  const handleSessionChange = (e) => {
    const newId = e.target.value;
    setSelectedSessionId(newId);
    setSearchParams({ session_id: newId });
  };

  // Metrics calculations
  const totalMaxMarks = useMemo(() => {
    return metrics.reduce((sum, m) => sum + (parseFloat(m.max_marks) || 0), 0);
  }, [metrics]);

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (metrics.length !== initialMetrics.length) return true;
    return metrics.some((m, i) => {
      const init = initialMetrics[i];
      return !init || m.name !== init.name || parseFloat(m.max_marks) !== parseFloat(init.max_marks);
    });
  }, [metrics, initialMetrics]);

  // Actions on metric rows
  const handleNameChange = (index, val) => {
    setMetrics(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: val };
      return updated;
    });
  };

  const handleMaxMarksChange = (index, val) => {
    setMetrics(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], max_marks: val };
      return updated;
    });
  };

  const handleAddMetric = () => {
    setMetrics(prev => [
      ...prev,
      {
        id: Date.now(),
        name: `Evaluation Metric ${prev.length + 1}`,
        max_marks: 5,
        display_order: prev.length + 1,
      },
    ]);
  };

  const handleRemoveMetric = (index) => {
    if (metrics.length <= 1) {
      toast.error('Evaluation rubric must contain at least one metric criterion.');
      return;
    }
    setMetrics(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    setMetrics(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index) => {
    if (index === metrics.length - 1) return;
    setMetrics(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const applyPreset = (preset) => {
    setMetrics(preset.metrics.map((m, idx) => ({
      id: Date.now() + idx,
      name: m.name,
      max_marks: m.max_marks,
      display_order: idx + 1,
    })));
    toast.success(`Applied "${preset.name}"`);
  };

  const handleResetToSaved = () => {
    setMetrics(JSON.parse(JSON.stringify(initialMetrics)));
    toast('Reset to currently saved server configuration', { icon: '🔄' });
  };

  // Save handler
  const handleSave = async () => {
    if (!isAuthorized) {
      toast.error('Only Seminar Coordinators and HODs have authority to configure metrics.');
      return;
    }
    if (!selectedSessionId) {
      toast.error('Please select a seminar session.');
      return;
    }

    // Validation
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      if (!m.name || !m.name.trim()) {
        toast.error(`Criterion #${i + 1} cannot have an empty name.`);
        return;
      }
      const num = parseFloat(m.max_marks);
      if (isNaN(num) || num <= 0) {
        toast.error(`Criterion "${m.name}" must have a maximum marks value greater than 0.`);
        return;
      }
    }

    const payload = metrics.map((m, idx) => ({
      name: m.name.trim(),
      max_marks: parseFloat(m.max_marks),
      display_order: idx + 1,
    }));

    setSaving(true);
    try {
      const res = await api.put(`/seminar/sessions/${selectedSessionId}/metrics`, {
        metrics: payload,
      });
      const saved = (res.data.metrics || payload).map((m, idx) => ({
        id: m.id || idx + 1,
        name: m.name,
        max_marks: parseFloat(m.max_marks),
        display_order: m.display_order ?? idx + 1,
      }));
      setMetrics(saved);
      setInitialMetrics(JSON.parse(JSON.stringify(saved)));
      toast.success('Seminar evaluation rubric metrics saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save evaluation metrics');
    } finally {
      setSaving(false);
    }
  };

  const currentSession = sessions.find(s => String(s.id) === String(selectedSessionId));
  const baseBackUrl = user?.role === 'hod' ? '/hod/seminar-approvals' : '/faculty/seminar';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={baseBackUrl}
              className="text-xs font-medium text-slate-500 hover:text-[var(--navy)] transition-colors flex items-center gap-1"
            >
              ← Back to Seminar Governance
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-medium">Evaluation Rubrics</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--navy)] font-serif tracking-tight">
            Seminar Evaluation Metrics Configuration
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            Configure the evaluation criteria, maximum marks, and display order. Configured metrics automatically update Guide Marksheets, Seminar Coordinator Consolidated Evaluation, and official Excel/PDF exports.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedSessionId && (
            <Link
              to={`/faculty/seminar/evaluate?session_id=${selectedSessionId}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Consolidated Sheet
            </Link>
          )}
          {selectedSessionId && (
            <Link
              to={`/faculty/seminar/${selectedSessionId}/marks-overview`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1E2D5A] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs"
            >
              <svg className="w-4 h-4 text-[#1E2D5A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Marks Overview
            </Link>
          )}
        </div>
      </div>

      {/* Authority Notice */}
      {!isAuthorized && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-xs text-amber-800">
            <span className="font-bold">Read-Only View:</span> Evaluation metrics can only be modified by the designated <strong>Seminar Coordinator</strong> or the <strong>Head of Department (HOD)</strong>. You are currently viewing the active criteria.
          </div>
        </div>
      )}

      {/* Session Selector & Live Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Session Selector Dropdown Card */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-2xs md:col-span-2 flex flex-col justify-between">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Active Seminar Session
            </label>
            {loadingSessions ? (
              <div className="h-9 bg-slate-100 animate-pulse rounded-md" />
            ) : sessions.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No seminar sessions found.</div>
            ) : (
              <select
                value={selectedSessionId}
                onChange={handleSessionChange}
                className="w-full h-9 px-3 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30 focus:border-[var(--navy)] transition-colors"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.academic_year || 'AY'} ({s.batch || 'Batch'}) [{s.status || 'DRAFT'}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {currentSession && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                AY: {currentSession.academic_year || 'Current'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">
                Batch: {currentSession.batch || 'All'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {currentSession.group_count || 0} Registered Groups
              </span>
            </div>
          )}
        </div>

        {/* Stat 1: Total Evaluation Marks */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Max Marks</span>
            <span className="p-1.5 bg-blue-50 rounded-md text-[var(--navy)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-[var(--navy)] tracking-tight">
              {totalMaxMarks} <span className="text-sm font-semibold text-slate-500">Marks</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Sum of all {metrics.length} rubric criteria
            </div>
          </div>
        </div>

        {/* Stat 2: Rubric Criteria Count & Compliance */}
        <div className="bg-white border border-[var(--rule)] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rubric Structure</span>
            <span className="p-1.5 bg-emerald-50 rounded-md text-emerald-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-800">
              {metrics.length} <span className="text-xs font-semibold text-slate-500">Criteria</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-700 mt-0.5">
              {totalMaxMarks === 25 ? '✓ SPPU Standard 25M Format' : `${totalMaxMarks}M Custom Rubric`}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Metrics Editor & Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Criteria Editor (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[var(--rule)] rounded-xl shadow-2xs overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--rule)] flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Evaluation Criteria Table</span>
                  {isDirty && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Unsaved Changes
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order determines column sequence on Guide sheets, Excel marksheets, and official PDF exports.
                </p>
              </div>

              {isAuthorized && (
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleResetToSaved}
                      className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddMetric}
                    className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--navy)] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Criterion
                  </button>
                </div>
              )}
            </div>

            {/* Criteria List */}
            {loadingMetrics ? (
              <div className="p-8 text-center text-xs font-medium text-slate-500 animate-pulse">
                Loading rubric metrics for session…
              </div>
            ) : metrics.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No metrics found. Click "Add Criterion" or apply a standard preset to create the rubric.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {metrics.map((m, idx) => {
                  const weightPct = totalMaxMarks > 0 ? ((parseFloat(m.max_marks) || 0) / totalMaxMarks) * 100 : 0;
                  return (
                    <div
                      key={m.id || idx}
                      className="p-3.5 sm:px-5 sm:py-3 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      {/* Order Controls & Index */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isAuthorized && (
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveUp(idx)}
                              disabled={idx === 0}
                              className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                              title="Move Up"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveDown(idx)}
                              disabled={idx === metrics.length - 1}
                              className="w-5 h-5 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                              title="Move Down"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                        <span className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                      </div>

                      {/* Criterion Name Input */}
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5 sm:hidden">
                          Criterion Name
                        </label>
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleNameChange(idx, e.target.value)}
                          disabled={!isAuthorized}
                          placeholder="Criterion name (e.g., Literature Survey)"
                          className="w-full h-9 px-3 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30 focus:border-[var(--navy)] disabled:bg-slate-50 transition-colors"
                        />
                      </div>

                      {/* Max Marks & Weightage */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5 sm:hidden">
                            Max Marks
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              max="100"
                              value={m.max_marks}
                              onChange={(e) => handleMaxMarksChange(idx, e.target.value)}
                              disabled={!isAuthorized}
                              className="w-24 h-9 pl-3 pr-8 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30 focus:border-[var(--navy)] disabled:bg-slate-50 transition-colors text-right"
                            />
                            <span className="absolute right-2.5 top-2.5 text-[10px] font-semibold text-slate-400 pointer-events-none">
                              M
                            </span>
                          </div>
                        </div>

                        {/* Weightage Badge */}
                        <div className="w-16 text-right">
                          <span className="inline-block text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded" title="Percentage of Total Marks">
                            {weightPct.toFixed(1)}%
                          </span>
                        </div>

                        {/* Delete Button */}
                        {isAuthorized && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMetric(idx)}
                            disabled={metrics.length <= 1}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-20 disabled:hover:bg-transparent flex items-center justify-center transition-colors"
                            title="Delete Criterion"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-[var(--rule)] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-medium">
                Total Criteria: <span className="font-bold text-slate-900">{metrics.length}</span> | Total Evaluation Marks: <span className="font-bold text-[var(--navy)]">{totalMaxMarks}</span>
              </div>

              {isAuthorized && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className="h-9 px-4 inline-flex items-center gap-2 text-xs font-bold text-white bg-[var(--navy)] hover:bg-[#2a3d7a] disabled:opacity-50 rounded-lg transition-colors shadow-xs"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving Rubric…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Save Metrics Configuration
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Standard Presets & Guidelines (1 col) */}
        <div className="space-y-4">
          {/* Presets Card */}
          <div className="bg-white border border-[var(--rule)] rounded-xl p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Standard Rubric Presets
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Apply institutional default templates with a single click. You can further adjust criteria and marks before saving.
            </p>

            <div className="space-y-2.5 pt-1">
              {RUBRIC_PRESETS.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors text-left flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{p.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{p.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.metrics.map((m, mIdx) => (
                        <span
                          key={mIdx}
                          className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                        >
                          {m.name} ({m.max_marks})
                        </span>
                      ))}
                    </div>
                  </div>

                  {isAuthorized && (
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="text-xs font-semibold text-[var(--navy)] hover:text-blue-800 flex items-center gap-1 hover:underline"
                      >
                        Apply Preset →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Academic Governance Guidelines Card */}
          <div className="bg-white border border-[var(--rule)] rounded-xl p-5 shadow-2xs space-y-2.5 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evaluation & Export Impact
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-500 leading-relaxed">
              <li>
                <strong>Guide Marksheet:</strong> Every assigned faculty will evaluate students using the exact metrics defined here.
              </li>
              <li>
                <strong>Excel & PDF Reports:</strong> The columns are generated dynamically in the exact order specified above.
              </li>
              <li>
                <strong>Total Calculation:</strong> Guide marks for each student are clamped to the criterion maximum marks and summed to compute the final total out of {totalMaxMarks}.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live Marksheet & Header Preview Card */}
      <div className="bg-white border border-[var(--rule)] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--rule)] bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--navy)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
              Live Marksheet Header & Column Preview
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview of how the evaluation table columns appear on the guide portal and in exported sheets.
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[var(--navy)] border border-blue-200">
            Total Columns: {8 + metrics.length + 1}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider text-center">
                <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-200/50">Group No</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Student Name</th>
                <th className="px-3 py-2.5 border-r border-slate-200">University PRN</th>
                <th className="px-3 py-2.5 border-r border-slate-200">College PRN</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Sign</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Final Seminar Topic</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Domain</th>
                <th className="px-3 py-2.5 border-r border-slate-200">Guide Name</th>
                {metrics.map((m, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2.5 border-r border-slate-200 bg-blue-50/60 text-[#1E2D5A] font-extrabold whitespace-nowrap"
                  >
                    <div>{m.name || `Metric ${idx + 1}`}</div>
                    <div className="text-[9px] font-semibold text-blue-700">({m.max_marks || 0})</div>
                  </th>
                ))}
                <th className="px-4 py-2.5 bg-indigo-50/70 text-indigo-900 font-black">
                  <div>TOTAL</div>
                  <div className="text-[9px]">({totalMaxMarks})</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 text-center">
              <tr className="hover:bg-slate-50/50">
                <td className="px-3 py-3 border-r border-slate-100 font-bold text-slate-900 bg-slate-50/50">1</td>
                <td className="px-3 py-3 border-r border-slate-100 text-left font-medium text-slate-800">Sample Student A</td>
                <td className="px-3 py-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">72345678B</td>
                <td className="px-3 py-3 border-r border-slate-100 font-mono text-[11px] text-slate-500">F2211001</td>
                <td className="px-3 py-3 border-r border-slate-100 text-slate-300">—</td>
                <td className="px-3 py-3 border-r border-slate-100 text-left text-slate-700 italic">Edge AI Inference for Smart Grid</td>
                <td className="px-3 py-3 border-r border-slate-100 font-semibold text-slate-700">Machine Learning</td>
                <td className="px-3 py-3 border-r border-slate-100 font-semibold text-[var(--navy)]">Prof. Guide Name</td>
                {metrics.map((m, idx) => (
                  <td key={idx} className="px-3 py-3 border-r border-slate-100 font-bold text-[#1E2D5A] bg-blue-50/20">
                    {Math.min(m.max_marks, 4.5)}
                  </td>
                ))}
                <td className="px-4 py-3 font-black text-indigo-900 bg-indigo-50/30">
                  {Math.min(totalMaxMarks, Math.round(totalMaxMarks * 0.9))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
