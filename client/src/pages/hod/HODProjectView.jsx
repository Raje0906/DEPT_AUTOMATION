import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODProjectView() {
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [groups, setGroups] = useState([]);
  const [selectedGroupModal, setSelectedGroupModal] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [guideFilter, setGuideFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED'

  // Fetch groups
  const fetchData = async () => {
    setLoading(true);
    try {
      const groupsRes = await api.get(`/projects/hod/groups?academic_year=${academicYear}`);
      setGroups(groupsRes.data || []);
    } catch (err) {
      console.error('Failed to load project groups:', err);
      toast.error('Failed to load BE project groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [academicYear]);

  // Extract clean group number for sorting & display
  const getGroupNumber = (groupCode) => {
    if (!groupCode) return 0;
    const match = groupCode.match(/(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Filter groups based on search query, division, and guide assignment status
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Division filter
      if (selectedDivision !== 'ALL' && g.batch !== selectedDivision) {
        return false;
      }

      // Guide filter
      if (guideFilter === 'ASSIGNED' && !g.guide_name) {
        return false;
      }
      if (guideFilter === 'UNASSIGNED' && g.guide_name) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const groupNum = getGroupNumber(g.group_code).toString();
        const matchCode = (g.group_code || '').toLowerCase().includes(query);
        const matchNum = groupNum === query || `group ${groupNum}`.includes(query);
        const matchDomain = (g.domain || '').toLowerCase().includes(query);
        const matchBatch = (g.batch || '').toLowerCase().includes(query);
        const matchTitle = (g.title || '').toLowerCase().includes(query);
        const matchTitle2 = (g.title_2 || '').toLowerCase().includes(query);
        const matchTitle3 = (g.title_3 || '').toLowerCase().includes(query);
        const matchGuide = (g.guide_name || '').toLowerCase().includes(query);
        const matchMember = (g.members || []).some(
          (m) =>
            (m.name || '').toLowerCase().includes(query) ||
            (m.roll_no || '').toLowerCase().includes(query) ||
            (m.email || '').toLowerCase().includes(query)
        );

        return matchCode || matchNum || matchDomain || matchBatch || matchTitle || matchTitle2 || matchTitle3 || matchGuide || matchMember;
      }

      return true;
    });
  }, [groups, selectedDivision, guideFilter, searchQuery]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalGroups = groups.length;
    let totalStudents = 0;
    let assignedCount = 0;
    const domainSet = new Set();
    const divisions = new Set();

    groups.forEach((g) => {
      totalStudents += (g.members || []).length;
      if (g.guide_name) assignedCount++;
      if (g.domain) domainSet.add(g.domain.trim());
      if (g.batch) divisions.add(g.batch);
    });

    return {
      totalGroups,
      totalStudents,
      assignedCount,
      unassignedCount: totalGroups - assignedCount,
      totalDomains: domainSet.size,
      divisions: Array.from(divisions).sort(),
    };
  }, [groups]);

  // Excel Downloads
  const handleExportFormResponses = async () => {
    try {
      const res = await api.get(`/projects/export/form-responses?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Topic Preferences form (AY ${academicYear}) (Responses).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Form responses Excel downloaded!');
    } catch (err) {
      toast.error('Failed to export form responses Excel');
    }
  };

  const handleExportGuideAssignments = async () => {
    try {
      const res = await api.get(`/projects/export/guide-assignments?academic_year=${academicYear}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BE Project Guide Assignments (AY ${academicYear}).xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Guide assignments Excel downloaded!');
    } catch (err) {
      toast.error('Failed to export guide assignments Excel');
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto flex items-center justify-center min-h-[420px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-draft">Loading BE Project Groups Roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto space-y-6">
      {/* 1. Header Bar */}
      <div className="pb-5 border-b border-rule flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-3xl font-bold text-ink">BE Project Groups</h1>
          </div>
          <p className="text-sm text-draft mt-1 font-medium">
            Department of Computer Engineering · Academic Year {academicYear}
          </p>
        </div>

        {/* Global Controls & Exports */}
        <div className="flex flex-wrap items-center gap-2.5">

          <button
            type="button"
            onClick={handleExportFormResponses}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>📥</span> Form Responses (Excel)
          </button>

          <button
            type="button"
            onClick={handleExportGuideAssignments}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-md shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>📥</span> Guide Assignments (Excel)
          </button>

          <div className="flex items-center gap-2 border-l border-rule pl-2.5 ml-1">
            <label className="text-xs font-semibold text-draft hidden sm:inline">AY:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="py-1.5 px-2 bg-white border border-rule rounded text-xs font-mono font-bold text-ink focus:outline-none focus:ring-1 focus:ring-navy"
            >
              <option value="2026-27">2026-27 (Current)</option>
              <option value="2025-26">2025-26</option>
              <option value="2024-25">2024-25</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Overview Statistics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="panel p-4 flex flex-col justify-between">
          <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Total Groups</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-serif text-3xl font-bold text-navy">{stats.totalGroups}</span>
            <span className="text-xs font-medium text-draft">AY {academicYear}</span>
          </div>
        </div>

        <div className="panel p-4 flex flex-col justify-between">
          <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Total Students</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-serif text-3xl font-bold text-ink">{stats.totalStudents}</span>
            <span className="text-xs font-medium text-draft">Across all groups</span>
          </div>
        </div>

        <div className="panel p-4 flex flex-col justify-between">
          <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Assigned Faculty</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-serif text-3xl font-bold text-pass">{stats.assignedCount}</span>
            <span className="text-xs font-medium text-draft">of {stats.totalGroups} groups</span>
          </div>
        </div>

        <div className="panel p-4 flex flex-col justify-between">
          <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">Unassigned</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`font-serif text-3xl font-bold ${stats.unassignedCount > 0 ? 'text-amber-700' : 'text-draft'}`}>
              {stats.unassignedCount}
            </span>
            <span className="text-xs font-medium text-draft">Awaiting guide</span>
          </div>
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-draft">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by student name, roll no, group no, faculty guide, domain, or project topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-rule rounded-md focus:outline-none focus:ring-1 focus:ring-navy"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-draft hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          {/* Division Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-draft mr-1">Division:</span>
            {['ALL', 'BE-1', 'BE-2', 'BE-3', 'BE-4'].map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => setSelectedDivision(div)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${selectedDivision === div
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-white border border-rule text-draft hover:text-ink hover:bg-slate-50'
                  }`}
              >
                {div}
              </button>
            ))}
          </div>

          {/* Guide Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-draft mr-1">Guide:</span>
            <select
              value={guideFilter}
              onChange={(e) => setGuideFilter(e.target.value)}
              className="py-1 px-2.5 bg-white border border-rule rounded text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-navy"
            >
              <option value="ALL">All ({groups.length})</option>
              <option value="ASSIGNED">Assigned ({stats.assignedCount})</option>
              <option value="UNASSIGNED">Unassigned ({stats.unassignedCount})</option>
            </select>
          </div>
        </div>

        {/* Status text */}
        <div className="flex items-center justify-between text-xs text-draft pt-1 border-t border-rule/50">
          <div>
            Showing <strong className="text-ink font-semibold">{filteredGroups.length}</strong> of{' '}
            <strong className="text-ink font-semibold">{groups.length}</strong> project groups
            {(searchQuery || selectedDivision !== 'ALL' || guideFilter !== 'ALL') && (
              <span className="ml-2 text-navy font-semibold">(Filtered)</span>
            )}
          </div>
          {(searchQuery || selectedDivision !== 'ALL' || guideFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDivision('ALL');
                setGuideFilter('ALL');
              }}
              className="text-xs text-maroon hover:underline font-semibold"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Tabular View Form */}
      <div className="panel overflow-hidden">
        <div className="panel-header flex items-center justify-between bg-slate-50/70 border-b border-rule px-5 py-3.5">
          <h2 className="font-serif text-lg font-bold text-ink">
            BE Project Groups Master Table
          </h2>
          <span className="text-xs text-draft font-mono">
            {filteredGroups.length} records listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th className="w-32">Group No</th>
                <th className="w-72">Student Names</th>
                <th className="w-56">Assigned Faculty</th>
                <th>Project Domain &amp; Topics</th>
                <th className="w-20 text-center">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-draft">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">📋</span>
                      <p className="font-semibold text-sm">No project groups matched the filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedDivision('ALL');
                          setGuideFilter('ALL');
                        }}
                        className="mt-2 text-xs text-navy hover:underline font-semibold"
                      >
                        Clear filters and show all
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => {
                  const groupNum = getGroupNumber(g.group_code);
                  return (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: Group No */}
                      <td className="align-top py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-base font-bold text-navy">
                              Group {groupNum || g.group_code}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-draft px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {g.group_code}
                            </span>
                            {g.batch && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {g.batch}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Student Names */}
                      <td className="align-top py-3.5">
                        {g.members && g.members.length > 0 ? (
                          <div className="space-y-1.5">
                            {g.members.map((m, mIdx) => (
                              <div
                                key={m.roll_no || mIdx}
                                className={`text-xs p-1.5 rounded transition-colors ${m.is_leader
                                    ? 'bg-amber-50/70 border border-amber-200/80'
                                    : 'bg-white/80 border border-rule/50'
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="font-semibold text-ink flex items-center gap-1">
                                    <span>{mIdx + 1}.</span>
                                    <span>{m.name}</span>
                                  </div>
                                  {m.is_leader && (
                                    <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                      👑 Leader
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-draft flex items-center gap-2 mt-0.5 pl-3.5">
                                  <span>{m.roll_no || 'No PRN'}</span>
                                  {m.division && (
                                    <span className="text-[10px] text-slate-500">
                                      ({m.division})
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-draft italic">No student members listed</span>
                        )}
                      </td>

                      {/* Column 3: Assigned Faculty */}
                      <td className="align-top py-3.5">
                        {g.guide_name ? (
                          <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-700 text-xs">👨‍🏫</span>
                              <span className="font-bold text-xs text-emerald-900">
                                {g.guide_name}
                              </span>
                            </div>
                            <div className="text-[11px] text-emerald-800/80 pl-4 font-medium">
                              {g.guide_designation || 'Faculty Member'}
                            </div>
                            <div className="pt-1 pl-4">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ Assigned Guide
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded bg-slate-50 border border-rule/70 space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200">
                              <span>⏳</span> Not Assigned
                            </span>
                            <p className="text-[11px] text-draft italic">
                              Guide allocation pending by coordinator
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Project Domain & Topics */}
                      <td className="align-top py-3.5">
                        <div className="space-y-2">
                          {/* Domain Badge */}
                          <div>
                            <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs">
                              Domain: {g.domain || 'Not Specified'}
                            </span>
                          </div>

                          {/* Primary Topic Preference */}
                          <div className="text-xs space-y-1">
                            <div className="font-semibold text-ink leading-snug">
                              <span className="text-draft font-bold mr-1">Topic 1:</span>
                              {g.title || 'Topic preference not specified'}
                            </div>

                            {/* Secondary preferences */}
                            {(g.title_2 || g.title_3) && (
                              <div className="pt-1 space-y-0.5 text-[11px] text-draft pl-2 border-l-2 border-rule">
                                {g.title_2 && (
                                  <div>
                                    <strong className="text-slate-600">Pref 2:</strong> {g.title_2}
                                  </div>
                                )}
                                {g.title_3 && (
                                  <div>
                                    <strong className="text-slate-600">Pref 3:</strong> {g.title_3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Read-only Details View */}
                      <td className="align-top py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupModal(g)}
                          className="px-2.5 py-1 text-xs font-semibold text-navy bg-navy/5 hover:bg-navy/15 rounded border border-navy/20 transition-colors"
                          title="View complete group information"
                        >
                          👁️ View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Group Details Modal (Read-Only) */}
      {selectedGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-rule animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-serif text-xl font-bold text-ink">
                  Group {getGroupNumber(selectedGroupModal.group_code)} Details
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-bold text-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {selectedGroupModal.group_code}
                  </span>
                  <span className="text-xs font-semibold text-draft">
                    Division: {selectedGroupModal.batch || 'N/A'}
                  </span>
                  <span className="text-xs text-draft">·</span>
                  <span className="text-xs font-semibold text-draft">
                    AY: {selectedGroupModal.academic_year || academicYear}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="text-draft hover:text-ink text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Domain & Topic Preferences */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">
                  Project Domain &amp; Topic Preferences
                </span>
                <div className="p-3.5 rounded bg-slate-50 border border-rule space-y-2.5">
                  <div>
                    <span className="text-xs font-semibold text-draft">Project Domain:</span>
                    <p className="text-sm font-bold text-indigo-900 mt-0.5">
                      {selectedGroupModal.domain || 'Not Specified'}
                    </p>
                  </div>
                  <div className="space-y-1.5 pt-1 border-t border-rule/60">
                    <div>
                      <span className="text-xs font-bold text-ink">1. Primary Topic:</span>
                      <p className="text-xs text-ink mt-0.5">{selectedGroupModal.title || 'N/A'}</p>
                    </div>
                    {selectedGroupModal.title_2 && (
                      <div>
                        <span className="text-xs font-bold text-draft">2. Second Choice:</span>
                        <p className="text-xs text-draft mt-0.5">{selectedGroupModal.title_2}</p>
                      </div>
                    )}
                    {selectedGroupModal.title_3 && (
                      <div>
                        <span className="text-xs font-bold text-draft">3. Third Choice:</span>
                        <p className="text-xs text-draft mt-0.5">{selectedGroupModal.title_3}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned Faculty Guide */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">
                  Assigned Faculty Guide
                </span>
                {selectedGroupModal.guide_name ? (
                  <div className="p-3.5 rounded bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-emerald-950">
                        {selectedGroupModal.guide_name}
                      </div>
                      <div className="text-xs text-emerald-800">
                        {selectedGroupModal.guide_designation || 'Faculty Member'}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-200 text-emerald-900">
                      ✓ Guide Assigned
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded bg-slate-50 border border-rule text-xs text-draft italic">
                    ⏳ No faculty guide has been assigned to this group yet.
                  </div>
                )}
              </div>

              {/* Student Roster */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-draft uppercase tracking-wider">
                  Team Members ({selectedGroupModal.members?.length || 0})
                </span>
                <div className="border border-rule rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-draft font-semibold border-b border-rule">
                      <tr>
                        <th className="p-2.5 text-left">#</th>
                        <th className="p-2.5 text-left">Student Name</th>
                        <th className="p-2.5 text-left">Roll No / PRN</th>
                        <th className="p-2.5 text-left">Division</th>
                        <th className="p-2.5 text-left">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {(selectedGroupModal.members || []).map((m, idx) => (
                        <tr key={idx} className={m.is_leader ? 'bg-amber-50/50' : 'bg-white'}>
                          <td className="p-2.5 text-draft">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-ink">
                            {m.name}{' '}
                            {m.is_leader && (
                              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                                Leader
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-draft">{m.roll_no || '—'}</td>
                          <td className="p-2.5">{m.division || selectedGroupModal.batch || '—'}</td>
                          <td className="p-2.5 text-draft space-y-0.5">
                            {m.email && <div>{m.email}</div>}
                            {m.mobile_no && <div>{m.mobile_no}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-rule bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-ink text-xs font-semibold rounded"
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
