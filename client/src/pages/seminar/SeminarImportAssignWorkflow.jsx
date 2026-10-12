import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function SeminarImportAssignWorkflow() {
  // Session Scope
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Workflow Step State (0: Upload, 1: Column Mapping, 2: Review & Clean, 3: Assign Guides)
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Step 1: Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null); // { filename, sheetStats, selectedSheet, previewRows, totalRows }
  const [selectedSheet, setSelectedSheet] = useState('');

  // Step 2: Mapping
  const [mappingLoading, setMappingLoading] = useState(false);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [headers, setHeaders] = useState([]);
  const [fieldDefs, setFieldDefs] = useState([]);
  const [columnMapping, setColumnMapping] = useState({}); // { [fieldKey]: { colIndex, colName, confidence } }
  const [unmappedColumns, setUnmappedColumns] = useState([]);
  const [missingRequired, setMissingRequired] = useState([]);
  const [memberCount, setMemberCount] = useState(4);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Step 3: Review & Fix
  const [previewLoading, setPreviewLoading] = useState(false);
  const [parsedGroups, setParsedGroups] = useState([]);
  const [parsedIssues, setParsedIssues] = useState([]);
  const [_skippedRows, setSkippedRows] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [importMode, setImportMode] = useState('ADD'); // 'ADD' | 'REPLACE'
  const [replaceConfirmationText, setReplaceConfirmationText] = useState('');
  const [committing, setCommitting] = useState(false);

  // Step 4: Assign Guides
  const [guides, setGuides] = useState([]);
  const [dbGroups, setDbGroups] = useState([]);
  const [_guidesLoading, setGuidesLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [bulkGuideId, setBulkGuideId] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Guide Master Modal
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideForm, setGuideForm] = useState({
    id: null,
    guide_name: '',
    initials: '',
    designation: 'Faculty Guide',
    quota: 4,
    expertise_tags: '',
    is_active: true,
  });

  // ─── 1. Load Sessions ───────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/seminar/workflow/sessions');
      setSessions(data.sessions || []);
      if (data.activeSessionId) {
        setSelectedSessionId(String(data.activeSessionId));
      } else if (data.sessions?.length > 0) {
        setSelectedSessionId(String(data.sessions[0].id));
      }
    } catch {
      toast.error('Failed to load seminar sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load Templates
  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/seminar/workflow/templates');
      setTemplates(data.templates || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Warn about unsaved changes on window unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ─── Step 1: Upload Handlers ───────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!selectedSessionId) return toast.error('Please select an active session first');

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'csv'].includes(ext)) {
      return toast.error('Only .xlsx or .csv files are supported. Macro-enabled (.xlsm) files are rejected.');
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size exceeds the 5 MB limit.');
    }

    setUploadFile(file);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStats(data);
      setSelectedSheet(data.selectedSheet);
      setCompletedSteps(prev => new Set(prev).add(0));
      toast.success(`Parsed ${data.totalRows} rows in "${data.selectedSheet}".`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to upload and parse file');
      setUploadStats(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSheetChange = async (sheetName) => {
    setSelectedSheet(sheetName);
    try {
      const { data } = await api.get(`/seminar/workflow/${selectedSessionId}/sheet-preview?sheetName=${encodeURIComponent(sheetName)}`);
      setUploadStats(prev => ({ ...prev, selectedSheet: sheetName, previewRows: data.previewRows, totalRows: data.totalRows }));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to switch sheet');
    }
  };

  // ─── Step 2: Column Mapping Handlers ───────────────────────────────────────
  const initColumnDetection = async () => {
    if (!selectedSessionId || !selectedSheet) return;
    setMappingLoading(true);
    try {
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/detect-columns`, {
        sheetName: selectedSheet,
        templateKey: selectedTemplateKey || null,
      });
      setHeaderRowIndex(data.headerRowIndex);
      setHeaders(data.headers || []);
      setFieldDefs(data.fieldDefs || []);
      setColumnMapping(data.mapping || {});
      setUnmappedColumns(data.unmappedColumns || []);
      setMissingRequired(data.missingRequired || []);
      setMemberCount(data.memberCount || 4);
      setCurrentStep(1);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to auto-detect columns');
    } finally {
      setMappingLoading(false);
    }
  };

  const handleMappingChange = (fieldKey, colIdx) => {
    const idx = parseInt(colIdx, 10);
    setColumnMapping(prev => {
      const updated = { ...prev };
      if (idx === -1) {
        updated[fieldKey] = { colIndex: -1, colName: '', confidence: 'Ignored', confidenceScore: 0 };
      } else {
        updated[fieldKey] = {
          colIndex: idx,
          colName: headers[idx],
          confidence: 'Manual',
          confidenceScore: 100,
        };
      }
      return updated;
    });
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return toast.error('Enter a template name');
    setSavingTemplate(true);
    try {
      const simplifiedMapping = {};
      Object.keys(columnMapping).forEach(k => {
        if (columnMapping[k]?.colName) {
          simplifiedMapping[k] = columnMapping[k].colName;
        }
      });
      const { data } = await api.post('/seminar/workflow/templates', {
        name: newTemplateName.trim(),
        mapping: simplifiedMapping,
      });
      toast.success('Template saved');
      setNewTemplateName('');
      loadTemplates();
      setSelectedTemplateKey(data.template.template_key);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // ─── Step 3: Review and Fix Handlers ───────────────────────────────────────
  const initPreviewGroups = async () => {
    // Validate required fields
    if (columnMapping.m1_name?.colIndex === -1 || columnMapping.m1_prn?.colIndex === -1) {
      return toast.error('Required fields (Student 1 Name and Student 1 PRN) must be mapped.');
    }

    setPreviewLoading(true);
    try {
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/preview-groups`, {
        sheetName: selectedSheet,
        headerRowIndex,
        mapping: columnMapping,
        memberCount,
      });
      setParsedGroups(data.groups || []);
      setParsedIssues(data.issues || []);
      setSkippedRows(data.skippedRows || []);
      setImportSummary(data.summary || null);
      setCompletedSteps(prev => new Set(prev).add(1));
      setCurrentStep(2);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to parse groups');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Manual inline correction of group or member
  const handleGroupNoChange = (gIdx, newNo) => {
    const val = parseInt(newNo, 10);
    if (isNaN(val)) return;
    setParsedGroups(prev => {
      const copy = [...prev];
      copy[gIdx] = { ...copy[gIdx], group_no: val };
      return copy;
    });
  };

  const handleMemberPrnChange = (gIdx, mIdx, newPrn) => {
    setParsedGroups(prev => {
      const copy = [...prev];
      const grp = { ...copy[gIdx] };
      const members = [...grp.members];
      members[mIdx] = { ...members[mIdx], prn: newPrn.toUpperCase().trim() };
      grp.members = members;
      copy[gIdx] = grp;
      return copy;
    });
  };

  // Handle student regrouping selection: keep student in target group and remove from other
  const handleResolveRegrouped = (prn, keepGroupNo) => {
    setParsedGroups(prev => {
      return prev.map(g => {
        if (g.group_no === keepGroupNo) return g;
        // filter out student with this PRN from other groups
        return {
          ...g,
          members: g.members.filter(m => m.prn !== prn),
        };
      });
    });
    setParsedIssues(prev => prev.filter(i => !(i.type === 'REGROUPED_STUDENT' && i.prn === prn)));
    toast.success(`Student ${prn} kept in Group #${keepGroupNo}.`);
  };

  // Commit Import
  const handleConfirmImport = async () => {
    if (importMode === 'REPLACE' && replaceConfirmationText.trim().toUpperCase() !== 'REPLACE') {
      return toast.error('Type "REPLACE" to confirm replacing this session\'s groups.');
    }

    setCommitting(true);
    try {
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/commit`, {
        mode: importMode,
        confirmationText: replaceConfirmationText,
        groups: parsedGroups,
      });
      toast.success(data.message || 'Groups imported successfully.');
      setCompletedSteps(prev => new Set(prev).add(2));
      initStep4Guides();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to import groups');
    } finally {
      setCommitting(false);
    }
  };

  // ─── Step 4: Guide Assignment Handlers ─────────────────────────────────────
  const initStep4Guides = async () => {
    if (!selectedSessionId) return;
    setGuidesLoading(true);
    try {
      const [guiR, grpR] = await Promise.all([
        api.get(`/seminar/workflow/${selectedSessionId}/guides`),
        api.get(`/seminar/workflow/${selectedSessionId}/groups`),
      ]);
      setGuides(guiR.data.guides || []);
      setDbGroups(grpR.data.groups || []);
      setHasUnsavedChanges(false);
      setCurrentStep(3);
    } catch {
      toast.error('Failed to load guide assignments');
    } finally {
      setGuidesLoading(false);
    }
  };

  // Guide allocation computation
  const guideLoads = useMemo(() => {
    const loads = {};
    guides.forEach(g => {
      loads[g.id] = { count: 0, groupNos: [] };
    });
    dbGroups.forEach(g => {
      if (g.seminar_guide_id && loads[g.seminar_guide_id]) {
        loads[g.seminar_guide_id].count++;
        loads[g.seminar_guide_id].groupNos.push(g.group_no);
      } else if (g.guide_id) {
        const found = guides.find(x => x.faculty_id === g.guide_id);
        if (found && loads[found.id]) {
          loads[found.id].count++;
          loads[found.id].groupNos.push(g.group_no);
        }
      }
    });
    return loads;
  }, [guides, dbGroups]);

  const handleAssignSingle = (groupId, guideId) => {
    setDbGroups(prev => {
      return prev.map(g => {
        if (g.id !== groupId) return g;
        if (!guideId) {
          return { ...g, guide_id: null, seminar_guide_id: null, guide_name: null };
        }
        const selectedGuide = guides.find(x => x.id === parseInt(guideId, 10));
        return {
          ...g,
          seminar_guide_id: selectedGuide?.id || null,
          guide_id: selectedGuide?.faculty_id || null,
          guide_name: selectedGuide?.guide_name || null,
        };
      });
    });
    setHasUnsavedChanges(true);
  };

  const handleBulkAssign = () => {
    if (selectedGroupIds.size === 0) return toast.error('Select groups to assign');
    if (!bulkGuideId) return toast.error('Select a guide');

    const selectedGuide = guides.find(x => x.id === parseInt(bulkGuideId, 10));
    setDbGroups(prev => {
      return prev.map(g => {
        if (!selectedGroupIds.has(g.id)) return g;
        return {
          ...g,
          seminar_guide_id: selectedGuide?.id || null,
          guide_id: selectedGuide?.faculty_id || null,
          guide_name: selectedGuide?.guide_name || null,
        };
      });
    });
    setSelectedGroupIds(new Set());
    setBulkGuideId('');
    setHasUnsavedChanges(true);
    toast.success(`Assigned ${selectedGroupIds.size} groups to ${selectedGuide?.guide_name}.`);
  };

  const handleSuggestAssignments = async () => {
    setSuggesting(true);
    try {
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/suggest-assignments`);
      const suggestions = data.suggestions || [];
      if (suggestions.length === 0) {
        return toast('All groups are already assigned or no active guides found.');
      }

      setDbGroups(prev => {
        return prev.map(g => {
          const matched = suggestions.find(s => s.groupId === g.id || s.groupNo === g.group_no);
          if (matched) {
            const foundGuide = guides.find(x => x.id === matched.guideId);
            return {
              ...g,
              seminar_guide_id: matched.guideId,
              guide_id: matched.facultyId,
              guide_name: foundGuide?.guide_name || matched.guideName,
            };
          }
          return g;
        });
      });
      setHasUnsavedChanges(true);
      toast.success(`Draft suggestions applied for ${suggestions.length} groups. Review and click Save.`);
    } catch {
      toast.error('Failed to generate suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSaveAssignments = async () => {
    setSavingAssignments(true);
    try {
      const assignments = dbGroups.map(g => ({
        groupId: g.id,
        guideId: g.seminar_guide_id || g.guide_id || null,
      }));
      const { data } = await api.post(`/seminar/workflow/${selectedSessionId}/save-assignments`, { assignments });
      setLastSavedTimestamp(new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setHasUnsavedChanges(false);
      toast.success('Guide assignments saved.');
    } catch {
      toast.error('Failed to save assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const response = await api.get(`/seminar/workflow/${selectedSessionId}/export-excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = `TE_Seminar_Groups_${selectedSessionId}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded successfully.');
    } catch {
      toast.error('Failed to export Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  // Guide CRUD
  const handleSaveGuide = async (e) => {
    e.preventDefault();
    if (!guideForm.guide_name.trim()) return toast.error('Guide name is required');
    try {
      const payload = {
        guide_name: guideForm.guide_name.trim(),
        initials: guideForm.initials.trim(),
        designation: guideForm.designation.trim(),
        quota: parseInt(guideForm.quota, 10) || 4,
        expertise_tags: guideForm.expertise_tags ? guideForm.expertise_tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        is_active: guideForm.is_active,
      };

      if (guideForm.id) {
        await api.patch(`/seminar/workflow/${selectedSessionId}/guides/${guideForm.id}`, payload);
        toast.success('Guide updated');
      } else {
        await api.post(`/seminar/workflow/${selectedSessionId}/guides`, payload);
        toast.success('Guide added');
      }
      setShowGuideModal(false);
      // Reload guides
      const { data } = await api.get(`/seminar/workflow/${selectedSessionId}/guides`);
      setGuides(data.guides || []);
    } catch {
      toast.error('Failed to save guide');
    }
  };

  // Selected session record
  const currentSession = sessions.find(s => String(s.id) === String(selectedSessionId));

  // Step names
  const steps = [
    'Step 1: Upload',
    'Step 2: Automatic column mapping',
    'Step 3: Review and fix',
    'Step 4: Assign guides',
  ];

  if (loadingSessions) {
    return <div className="p-8 text-sm text-[var(--ink)]/50">Loading seminar coordinator workflow...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--ink)]/50">
          <Link to="/faculty/seminar" className="hover:text-[var(--navy)]">TE Seminar</Link>
          <span>/</span>
          <span className="text-[var(--ink)]/80 font-medium">Import &amp; Assign Guides</span>
        </div>
        <Link
          to="/faculty/seminar/schedule"
          className="text-xs font-semibold text-[var(--navy)] hover:underline"
        >
          Next: Schedule presentation &rarr;
        </Link>
      </div>

      {/* Header & Session Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--navy)]">Import responses and assign guides</h1>
          <p className="text-xs text-[var(--ink)]/60 mt-0.5">
            Four-step seminar coordinator workflow: upload Google Form responses, map columns, resolve issues, and allocate faculty guides.
          </p>
        </div>

        {/* Session Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--ink)]/60">Active Session:</label>
          <select
            value={selectedSessionId}
            onChange={e => setSelectedSessionId(e.target.value)}
            className="border border-[var(--rule)] rounded px-3 py-1.5 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.academic_year || 'AY'}) {s.status === 'PUBLISHED' ? '[Published]' : '[Registration Open]'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4-Step Indicator */}
      <nav aria-label="Workflow Steps" className="border border-[var(--rule)] rounded-lg bg-white p-2">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {steps.map((label, idx) => {
            const isActive = currentStep === idx;
            const isCompleted = completedSteps.has(idx);
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-[var(--navy)] text-white shadow-2xs'
                      : isCompleted
                      ? 'bg-slate-100 text-[var(--ink)] hover:bg-slate-200'
                      : 'text-[var(--ink)]/50 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{label}</span>
                  {isCompleted && !isActive && (
                    <span className="text-emerald-700 font-bold ml-1 text-[11px]">&check;</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* STEP 1: UPLOAD                                                         */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentStep === 0 && (
        <section className="border border-[var(--rule)] rounded-lg bg-white p-6 space-y-6 shadow-2xs">
          <div className="border-b border-[var(--rule)] pb-3">
            <h2 className="text-base font-bold text-[var(--navy)]">Step 1: Upload responses spreadsheet</h2>
            <p className="text-xs text-[var(--ink)]/60 mt-1">
              Upload a .xlsx or .csv exported from Google Forms (maximum 5 MB). Macro files (.xlsm) are rejected for safety.
            </p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-[var(--rule)] rounded-lg p-8 text-center hover:border-[var(--navy)]/40 transition-colors">
            <input
              type="file"
              id="file-upload-input"
              accept=".xlsx,.csv"
              onChange={e => handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            <label
              htmlFor="file-upload-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[var(--navy)] font-bold text-sm">
                &uarr;
              </div>
              <div className="text-xs font-semibold text-[var(--navy)]">
                {uploadFile ? uploadFile.name : 'Click to select .xlsx or .csv file'}
              </div>
              <div className="text-[11px] text-[var(--ink)]/40">
                Validated in memory. Never executed or stored publicly.
              </div>
            </label>
          </div>

          {uploading && (
            <div className="text-xs text-[var(--ink)]/60 text-center">Uploading and analyzing workbook structure...</div>
          )}

          {/* Detected Sheets & Preview */}
          {uploadStats && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 border border-[var(--rule)] rounded">
                <div>
                  <span className="text-xs font-bold text-[var(--navy)]">Detected Sheets:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {uploadStats.sheetStats?.map(s => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => handleSheetChange(s.name)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          selectedSheet === s.name
                            ? 'bg-[var(--navy)] text-white border-[var(--navy)]'
                            : 'bg-white text-slate-700 border-[var(--rule)] hover:bg-slate-100'
                        }`}
                      >
                        {s.name} ({s.rowCount} rows)
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-right text-[var(--ink)]/60">
                  Total Rows: <strong className="font-mono text-[var(--navy)]">{uploadStats.totalRows}</strong>
                </div>
              </div>

              {/* 5-Row Preview */}
              <div>
                <h3 className="text-xs font-bold text-[var(--navy)] uppercase tracking-wide mb-2">
                  Preview of First 5 Rows ({selectedSheet})
                </h3>
                <div className="overflow-x-auto border border-[var(--rule)] rounded">
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody>
                      {uploadStats.previewRows?.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 font-semibold' : 'border-t border-[var(--rule)] hover:bg-slate-50'}>
                          <td className="p-2 border-r border-[var(--rule)] text-[10px] text-slate-400 font-mono w-10 text-center">
                            {rIdx + 1}
                          </td>
                          {Array.isArray(row) && row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-[var(--rule)] truncate max-w-xs text-slate-700">
                              {String(cell || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={initColumnDetection}
                  disabled={mappingLoading}
                  className="px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a] transition-colors shadow-2xs"
                >
                  {mappingLoading ? 'Analyzing Headers...' : 'Continue to Step 2: Automatic column mapping &rarr;'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* STEP 2: AUTOMATIC COLUMN MAPPING                                       */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <section className="border border-[var(--rule)] rounded-lg bg-white p-6 space-y-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--navy)]">Step 2: Automatic column mapping</h2>
              <p className="text-xs text-[var(--ink)]/60 mt-1">
                Auto-detected header on row {headerRowIndex + 1}. Review detected mappings, adjust assignments, or save template.
              </p>
            </div>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--ink)]/60">Saved Template:</label>
              <select
                value={selectedTemplateKey}
                onChange={e => {
                  setSelectedTemplateKey(e.target.value);
                  initColumnDetection();
                }}
                className="border border-[var(--rule)] rounded px-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
              >
                <option value="">— Default Auto-Mapping —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.template_key}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Warnings Bar */}
          {(missingRequired.length > 0 || unmappedColumns.length > 0) && (
            <div className="space-y-2">
              {missingRequired.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                  <strong>Missing Required Fields:</strong> {missingRequired.map(f => f.label).join(', ')}. Please assign columns manually below.
                </div>
              )}
              {unmappedColumns.length > 0 && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Unmapped Columns ({unmappedColumns.length}):</span>{' '}
                  {unmappedColumns.map(c => `"${c.colName}"`).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Mapping Table */}
          <div className="overflow-x-auto border border-[var(--rule)] rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-[var(--rule)]">
                  <th className="p-2.5 font-bold">Standard Field</th>
                  <th className="p-2.5 font-bold">Required</th>
                  <th className="p-2.5 font-bold">Confidence</th>
                  <th className="p-2.5 font-bold">Mapped Column (From Spreadsheet)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule)]">
                {fieldDefs.map(field => {
                  const currentMapping = columnMapping[field.key] || { colIndex: -1, colName: '', confidence: 'None' };
                  const isMapped = currentMapping.colIndex !== -1;

                  return (
                    <tr key={field.key} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-[var(--ink)]">
                        {field.label}
                      </td>
                      <td className="p-2.5">
                        {field.required ? (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Required
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Optional</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          currentMapping.confidence.startsWith('High')
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : currentMapping.confidence === 'Medium'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : currentMapping.confidence === 'Low'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}>
                          {currentMapping.confidence}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={currentMapping.colIndex}
                          onChange={e => handleMappingChange(field.key, e.target.value)}
                          className={`w-full max-w-sm border rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 ${
                            isMapped ? 'border-[var(--rule)] bg-white text-slate-800' : 'border-amber-300 bg-amber-50/50 text-amber-900'
                          }`}
                        >
                          <option value="-1">— Ignore this column —</option>
                          {headers.map((h, hIdx) => (
                            <option key={hIdx} value={hIdx}>
                              Col {hIdx + 1}: {h || '(Blank Header)'}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save Template Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-slate-50 border border-[var(--rule)] rounded">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Template Name (e.g. Standard TE Google Form)"
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                className="border border-[var(--rule)] rounded px-2.5 py-1 text-xs bg-white w-64 focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
              />
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="px-3 py-1 bg-white border border-[var(--rule)] text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition-colors"
              >
                {savingTemplate ? 'Saving...' : 'Save mapping as template'}
              </button>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className="px-3 py-1.5 border border-[var(--rule)] text-xs text-slate-600 rounded hover:bg-slate-100"
              >
                &larr; Back to Upload
              </button>
              <button
                type="button"
                onClick={initPreviewGroups}
                disabled={previewLoading}
                className="px-4 py-1.5 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a] transition-colors shadow-2xs"
              >
                {previewLoading ? 'Parsing Groups...' : 'Continue to Step 3: Review and fix &rarr;'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* STEP 3: REVIEW AND FIX                                                 */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <section className="border border-[var(--rule)] rounded-lg bg-white p-6 space-y-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-3">
            <div>
              <h2 className="text-base font-bold text-[var(--navy)]">Step 3: Review and fix</h2>
              <p className="text-xs text-[var(--ink)]/60 mt-1">
                Nothing is written to the database until you confirm. Verify cleaned data, resolve flagged issues, and select import mode.
              </p>
            </div>

            {/* Summary Counters */}
            {importSummary && (
              <div className="flex items-center gap-3 text-xs">
                <div className="px-3 py-1.5 bg-slate-100 border border-[var(--rule)] rounded text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Groups</span>
                  <strong className="text-sm font-mono text-[var(--navy)]">{importSummary.groupCount}</strong>
                </div>
                <div className="px-3 py-1.5 bg-slate-100 border border-[var(--rule)] rounded text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Students</span>
                  <strong className="text-sm font-mono text-[var(--navy)]">{importSummary.studentCount}</strong>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded text-center">
                  <span className="text-[10px] text-amber-700 uppercase font-bold block">Warnings</span>
                  <strong className="text-sm font-mono text-amber-900">{importSummary.issueCount}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Issues List with Suggested Fixes & Actions */}
          {parsedIssues.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                <span>Flagged Issues ({parsedIssues.length}) — All are non-blocking warnings</span>
                <span className="text-[10px] font-normal text-amber-800">You may proceed with unresolved warnings</span>
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {parsedIssues.map((issue, idx) => (
                  <div key={idx} className="p-2.5 bg-white border border-amber-200 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--navy)]">
                        {issue.type.replace(/_/g, ' ')} {issue.groupNo ? `(Group #${issue.groupNo})` : ''}
                      </span>
                      <span className="text-[10px] text-slate-500">{issue.studentName || ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-700">{issue.detail}</p>
                    <p className="text-[11px] text-amber-800 font-medium">Suggestion: {issue.suggestedFix}</p>

                    {/* Interactive Fix for Regrouped Student (Issue 1) */}
                    {issue.type === 'REGROUPED_STUDENT' && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-600">Keep student in:</span>
                        {issue.occurrences?.map(occ => (
                          <button
                            key={occ.groupNo}
                            type="button"
                            onClick={() => handleResolveRegrouped(issue.prn, occ.groupNo)}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-[10px] font-semibold text-[var(--navy)]"
                          >
                            Group #{occ.groupNo} {occ.groupNo === issue.recommendedGroupNo ? '(Recommended)' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Groups Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--navy)] uppercase tracking-wide">
              Parsed Group Submissions ({parsedGroups.length})
            </h3>
            <div className="overflow-x-auto border border-[var(--rule)] rounded max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-[var(--rule)]">
                  <tr>
                    <th className="p-2.5 font-bold w-20">Group No.</th>
                    <th className="p-2.5 font-bold">Domain</th>
                    <th className="p-2.5 font-bold">Leader</th>
                    <th className="p-2.5 font-bold">Members, PRNs &amp; Topics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {parsedGroups.map((g, gIdx) => (
                    <tr key={gIdx} className="hover:bg-slate-50 align-top">
                      <td className="p-2.5">
                        <input
                          type="number"
                          value={g.group_no}
                          onChange={e => handleGroupNoChange(gIdx, e.target.value)}
                          className="w-16 border border-[var(--rule)] rounded px-1.5 py-1 text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                        />
                      </td>
                      <td className="p-2.5">
                        <span className="font-semibold text-slate-800">{g.domain}</span>
                        {g.domain_raw && g.domain_raw !== g.domain && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={g.domain_raw}>
                            Raw: {g.domain_raw}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {g.members[0]?.name || 'N/A'}
                        {g.leader_email && (
                          <div className="text-[10px] text-slate-400">{g.leader_email}</div>
                        )}
                      </td>
                      <td className="p-2.5 space-y-1">
                        {g.members.map((m, mIdx) => (
                          <div key={mIdx} className="flex flex-wrap items-center gap-2 text-[11px] p-1 bg-slate-50 border border-slate-200 rounded">
                            <span className="font-medium text-[var(--navy)]">{m.name}</span>
                            <input
                              type="text"
                              value={m.prn}
                              placeholder="PRN"
                              onChange={e => handleMemberPrnChange(gIdx, mIdx, e.target.value)}
                              className={`w-24 border rounded px-1 py-0.5 text-[10px] font-mono ${
                                m.prn_status === 'conflict'
                                  ? 'border-red-400 bg-red-50 text-red-900 font-bold'
                                  : m.prn_status === 'missing'
                                  ? 'border-amber-400 bg-amber-50 text-amber-900'
                                  : 'border-slate-300 bg-white'
                              }`}
                            />
                            <span className="text-[10px] text-slate-400">({m.division || 'TE1'})</span>
                            {m.topic1 && (
                              <span className="text-[10px] text-slate-600 truncate max-w-xs" title={m.topic1}>
                                T1: {m.topic1}
                              </span>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Mode & Confirmation Controls */}
          <div className="p-4 bg-slate-50 border border-[var(--rule)] rounded-lg space-y-4">
            <h4 className="text-xs font-bold text-[var(--navy)] uppercase">Import Mode &amp; Persistence</h4>

            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                <input
                  type="radio"
                  name="importMode"
                  value="ADD"
                  checked={importMode === 'ADD'}
                  onChange={() => setImportMode('ADD')}
                  className="accent-[var(--navy)]"
                />
                <span>Add to existing session (preserve existing groups)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-red-700">
                <input
                  type="radio"
                  name="importMode"
                  value="REPLACE"
                  checked={importMode === 'REPLACE'}
                  onChange={() => setImportMode('REPLACE')}
                  className="accent-red-600"
                />
                <span>Replace this session's groups (destructive, scoped strictly to {currentSession?.name || 'this session'})</span>
              </label>
            </div>

            {importMode === 'REPLACE' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs space-y-2 text-red-900">
                <p>
                  <strong>Dry-run Warning:</strong> All existing groups and guide allocations within <u>{currentSession?.name}</u> will be permanently erased and replaced by these {parsedGroups.length} groups. Sessions outside this ID are never touched.
                </p>
                <div className="flex items-center gap-2">
                  <span>Type <strong>REPLACE</strong> to confirm:</span>
                  <input
                    type="text"
                    value={replaceConfirmationText}
                    onChange={e => setReplaceConfirmationText(e.target.value)}
                    placeholder="REPLACE"
                    className="border border-red-300 rounded px-2.5 py-1 text-xs bg-white uppercase font-mono w-32 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[var(--rule)]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3 py-1.5 border border-[var(--rule)] text-xs text-slate-600 rounded hover:bg-slate-100"
              >
                &larr; Back to Mapping
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={committing}
                className="px-5 py-2 bg-[var(--navy)] text-white text-xs font-bold rounded hover:bg-[#2a3d7a] transition-colors shadow-2xs"
              >
                {committing ? 'Importing In Transaction...' : 'Confirm import and continue to Step 4: Assign guides &rarr;'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* STEP 4: ASSIGN GUIDES                                                  */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <section className="border border-[var(--rule)] rounded-lg bg-white p-6 space-y-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--navy)]">Step 4: Assign faculty guides</h2>
              <p className="text-xs text-[var(--ink)]/60 mt-0.5">
                Allocate guides to imported groups. Session and groups remain in active registered state without forcing published status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGuideForm({
                    id: null,
                    guide_name: '',
                    initials: '',
                    designation: 'Faculty Guide',
                    quota: 4,
                    expertise_tags: '',
                    is_active: true,
                  });
                  setShowGuideModal(true);
                }}
                className="px-3 py-1.5 border border-[var(--rule)] text-xs font-semibold rounded bg-white hover:bg-slate-50 text-[var(--navy)]"
              >
                + Add / Manage Guide
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded transition-colors shadow-2xs"
              >
                {exportingExcel ? 'Generating...' : 'Download Excel (4 Sheets)'}
              </button>
            </div>
          </div>

          {/* Guide Load Summary Panel */}
          <div className="border border-[var(--rule)] rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--navy)] uppercase tracking-wide">
                Live Guide Load Status ({guides.length} Guides in Session)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSuggestAssignments}
                  disabled={suggesting}
                  className="px-3 py-1 bg-white border border-[var(--navy)] text-[var(--navy)] text-xs font-semibold rounded hover:bg-slate-100 transition-colors"
                >
                  {suggesting ? 'Balancing Loads...' : 'Suggest assignment (Load + Domain)'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="px-4 py-1 bg-[var(--navy)] text-white text-xs font-bold rounded hover:bg-[#2a3d7a] transition-colors shadow-2xs"
                >
                  {savingAssignments ? 'Saving...' : 'Save assignments'}
                </button>
              </div>
            </div>

            {/* Guide Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {guides.map(g => {
                const loadInfo = guideLoads[g.id] || { count: 0, groupNos: [] };
                const isOver = loadInfo.count > g.quota;
                const isFull = loadInfo.count === g.quota;

                return (
                  <div
                    key={g.id}
                    className={`p-2.5 rounded border text-xs bg-white space-y-1 cursor-pointer hover:border-[var(--navy)] transition-colors ${
                      isOver
                        ? 'border-red-300 bg-red-50/50'
                        : isFull
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-[var(--rule)]'
                    }`}
                    onClick={() => {
                      setGuideForm({
                        id: g.id,
                        guide_name: g.guide_name,
                        initials: g.initials || '',
                        designation: g.designation || 'Faculty Guide',
                        quota: g.quota || 4,
                        expertise_tags: (g.expertise_tags || []).join(', '),
                        is_active: g.is_active !== false,
                      });
                      setShowGuideModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate" title={g.guide_name}>
                        {g.guide_name}
                      </span>
                      {g.initials && (
                        <span className="font-mono text-[10px] text-slate-400">({g.initials})</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Load:</span>
                      <strong className={`font-mono ${isOver ? 'text-red-700 font-bold' : isFull ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {loadInfo.count} / {g.quota}
                      </strong>
                    </div>
                    {g.expertise_tags && g.expertise_tags.length > 0 && (
                      <div className="text-[10px] text-slate-400 truncate" title={g.expertise_tags.join(', ')}>
                        {g.expertise_tags.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lastSavedTimestamp && (
              <div className="text-[11px] text-emerald-800 text-right font-medium">
                &check; Saved at {lastSavedTimestamp}
              </div>
            )}
          </div>

          {/* Bulk Assign Tool */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white border border-[var(--rule)] rounded">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">
                Selected: <strong className="font-mono text-[var(--navy)]">{selectedGroupIds.size}</strong> groups
              </span>
              <button
                type="button"
                onClick={() => {
                  const unassignedIds = dbGroups.filter(g => !g.guide_id && !g.seminar_guide_id).map(g => g.id);
                  setSelectedGroupIds(new Set(unassignedIds));
                }}
                className="text-[11px] text-[var(--navy)] underline"
              >
                Select All Unassigned
              </button>
              <button
                type="button"
                onClick={() => setSelectedGroupIds(new Set())}
                className="text-[11px] text-slate-500 underline"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={bulkGuideId}
                onChange={e => setBulkGuideId(e.target.value)}
                className="border border-[var(--rule)] rounded px-2.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
              >
                <option value="">— Assign selected to guide —</option>
                {guides.filter(g => g.is_active !== false).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.guide_name} ({guideLoads[g.id]?.count || 0}/{g.quota})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                className="px-3 py-1 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a]"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Group Allocation Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--navy)] uppercase tracking-wide">
              Group Assignments ({dbGroups.length} Groups)
            </h3>
            <div className="overflow-x-auto border border-[var(--rule)] rounded max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-[var(--rule)]">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.size === dbGroups.length && dbGroups.length > 0}
                        onChange={e => {
                          if (e.target.checked) setSelectedGroupIds(new Set(dbGroups.map(g => g.id)));
                          else setSelectedGroupIds(new Set());
                        }}
                      />
                    </th>
                    <th className="p-2.5 font-bold w-20">Group No.</th>
                    <th className="p-2.5 font-bold">Domain</th>
                    <th className="p-2.5 font-bold">Members &amp; Proposed Topics</th>
                    <th className="p-2.5 font-bold w-64">Assigned Guide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {/* Sort: unassigned groups at the top */}
                  {[...dbGroups]
                    .sort((a, b) => {
                      const aAssigned = Boolean(a.guide_id || a.seminar_guide_id);
                      const bAssigned = Boolean(b.guide_id || b.seminar_guide_id);
                      if (!aAssigned && bAssigned) return -1;
                      if (aAssigned && !bAssigned) return 1;
                      return a.group_no - b.group_no;
                    })
                    .map(group => {
                      const isAssigned = Boolean(group.guide_id || group.seminar_guide_id);
                      const isChecked = selectedGroupIds.has(group.id);
                      const activeGuideId = group.seminar_guide_id || group.guide_id || '';

                      return (
                        <tr
                          key={group.id}
                          className={`hover:bg-slate-50 align-top ${!isAssigned ? 'bg-amber-50/20' : ''}`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const next = new Set(selectedGroupIds);
                                if (e.target.checked) next.add(group.id);
                                else next.delete(group.id);
                                setSelectedGroupIds(next);
                              }}
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-[var(--navy)]">
                            #{group.group_no}
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-800">{group.domain}</span>
                          </td>
                          <td className="p-2.5 space-y-1">
                            {group.members?.map((m, mIdx) => (
                              <div key={mIdx} className="text-[11px] text-slate-700">
                                <strong>{m.name}</strong> <span className="font-mono text-slate-400">({m.prn})</span>
                                {m.topic1 && (
                                  <div className="text-[10px] text-slate-500 truncate max-w-md">
                                    T1: {m.topic1}
                                  </div>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className="p-2.5">
                            <select
                              value={activeGuideId}
                              onChange={e => {
                                if (group.marks_count > 0) {
                                  if (!window.confirm('This group already has recorded evaluation marks. Reassigning will move evaluation data to the new guide. Continue?')) {
                                    return;
                                  }
                                }
                                handleAssignSingle(group.id, e.target.value);
                              }}
                              className={`w-full border rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30 ${
                                !isAssigned
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold'
                                  : 'border-[var(--rule)] bg-white text-slate-800'
                              }`}
                            >
                              <option value="">— Unassigned —</option>
                              {guides.map(guide => {
                                const load = guideLoads[guide.id]?.count || 0;
                                const isFull = load >= guide.quota;
                                return (
                                  <option key={guide.id} value={guide.id}>
                                    {guide.guide_name} ({load}/{guide.quota}{isFull ? ' - Full' : ''})
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Guide Master Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--navy)] border-b border-[var(--rule)] pb-2">
              {guideForm.id ? 'Edit Faculty Guide' : 'Add New Faculty Guide'}
            </h3>

            <form onSubmit={handleSaveGuide} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Guide Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. A. P. Kale"
                  value={guideForm.guide_name}
                  onChange={e => setGuideForm({ ...guideForm, guide_name: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initials</label>
                  <input
                    type="text"
                    placeholder="e.g. APK"
                    value={guideForm.initials}
                    onChange={e => setGuideForm({ ...guideForm, initials: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-1.5 text-xs bg-white uppercase font-mono focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Group Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={guideForm.quota}
                    onChange={e => setGuideForm({ ...guideForm, quota: e.target.value })}
                    className="w-full border border-[var(--rule)] rounded px-2.5 py-1.5 text-xs bg-white font-mono focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Assistant Professor"
                  value={guideForm.designation}
                  onChange={e => setGuideForm({ ...guideForm, designation: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expertise Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ai, machine learning, vision, deep learning"
                  value={guideForm.expertise_tags}
                  onChange={e => setGuideForm({ ...guideForm, expertise_tags: e.target.value })}
                  className="w-full border border-[var(--rule)] rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[var(--navy)]/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="guide-is-active"
                  checked={guideForm.is_active}
                  onChange={e => setGuideForm({ ...guideForm, is_active: e.target.checked })}
                  className="accent-[var(--navy)]"
                />
                <label htmlFor="guide-is-active" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Active (available for auto-suggestion &amp; allocation)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-3 py-1.5 border border-[var(--rule)] text-xs text-slate-600 rounded hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--navy)] text-white text-xs font-semibold rounded hover:bg-[#2a3d7a]"
                >
                  Save Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
