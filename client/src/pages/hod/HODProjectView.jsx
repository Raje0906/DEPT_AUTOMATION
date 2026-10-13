import React, { useState, useEffect, useMemo, useRef } from 'react';
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

  // Guide Assignments Export Dropdown & PDF State
  const [guideExportOpen, setGuideExportOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const guideExportRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (guideExportRef.current && !guideExportRef.current.contains(event.target)) {
        setGuideExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch groups
  const fetchData = async () => {
    setLoading(true);
    try {
      const groupsRes = await api.get(`/projects/hod/groups?academic_year=${academicYear}`);
      const rawGroups = groupsRes.data || [];
      const sanitizedGroups = rawGroups.map((g) => {
        const guideId = g.guide_faculty_id || g.guide_id;
        const guideName = (g.guide_name || '').trim().toLowerCase();
        return {
          ...g,
          mentors: (g.mentors || []).filter((m) => {
            if (guideId && Number(m.faculty_id) === Number(guideId)) return false;
            if (guideName && (m.name || m.mentor_name || '').trim().toLowerCase() === guideName) return false;
            return true;
          }),
        };
      });
      setGroups(sanitizedGroups);
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
        const matchMentor = (g.mentors || []).some(
          (m) => (m.name || m.mentor_name || '').toLowerCase().includes(query)
        );

        return matchCode || matchNum || matchDomain || matchBatch || matchTitle || matchTitle2 || matchTitle3 || matchGuide || matchMember || matchMentor;
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

  // Generate and Download Official Guide Assignments PDF (Matrix layout mirroring Excel)
  const handleExportGuideAssignmentsPdf = async () => {
    const targetGroups = (selectedDivision && selectedDivision !== 'ALL') ? filteredGroups : groups;
    if (!targetGroups || targetGroups.length === 0) {
      toast.error('No project groups available to export.');
      return;
    }

    setExportingPdf(true);
    const toastId = toast.loading('Generating Guide Assignments PDF...');

    try {
      const [jspdfModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 28; // Compact printable margin (785.89 pt usable)

      // Institutional Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 28, 56);
      doc.text('MES WADIA COLLEGE OF ENGINEERING, PUNE - 411001', pageWidth / 2, 34, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 80, 95);
      doc.text('(Affiliated to Savitribai Phule Pune University • Approved by AICTE)', pageWidth / 2, 46, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 28, 56);
      doc.text('DEPARTMENT OF COMPUTER ENGINEERING', pageWidth / 2, 60, { align: 'center' });

      // Title Bar
      doc.setDrawColor(27, 94, 32);
      doc.setLineWidth(1);
      doc.line(margin, 68, pageWidth - margin, 68);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(27, 94, 32); // Institutional Forest Green matching Excel
      doc.text('FINAL YEAR B.E. PROJECT — GUIDE ALLOCATION & TOPIC ASSIGNMENT', pageWidth / 2, 81, { align: 'center' });

      // Metadata info row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const divLabel = selectedDivision && selectedDivision !== 'ALL' ? selectedDivision : 'All Divisions';
      doc.text(`Academic Year: AY ${academicYear}`, margin, 94);
      doc.text(`Division: ${divLabel}`, margin + 175, 94);
      doc.text(`Total Project Groups: ${targetGroups.length}`, pageWidth / 2 + 50, 94);
      doc.text(`Date: ${dateStr}`, pageWidth - margin, 94, { align: 'right' });

      // Prepare Matrix Table Rows matching Excel layout with merged cells
      const tableData = [];

      targetGroups.forEach((g, gIdx) => {
        const members = g.members || [];
        const maxRows = Math.max(members.length, 3);
        const groupNum = g.group_code ? (parseInt(g.group_code.split('-').pop(), 10) || (gIdx + 1)) : (gIdx + 1);
        const groupDiv = members[0]?.division || g.batch || 'BE-1';
        const domainName = g.domain || '—';
        const guideName = g.guide_name || g.proposed_guide_name || 'Unassigned';

        for (let r = 0; r < maxRows; r++) {
          const m = members[r] || null;
          let topicText = '';
          if (r === 0 && g.title) topicText = `1. ${g.title}`;
          else if (r === 1 && g.title_2) topicText = `2. ${g.title_2}`;
          else if (r === 2 && g.title_3) topicText = `3. ${g.title_3}`;

          const studentDisplayName = m ? ((m.name || m.student_name || '—') + (m.is_leader ? ' [Leader]' : '')) : '';
          const studentPRN = m ? (m.roll_no || m.prn || '') : '';
          const studentDiv = m ? (m.division || groupDiv) : '';

          if (r === 0) {
            tableData.push([
              {
                content: String(groupNum),
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
              },
              {
                content: studentDisplayName,
                styles: { halign: 'left', valign: 'middle', fontStyle: m?.is_leader ? 'bold' : 'normal' }
              },
              {
                content: studentPRN,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: studentDiv,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: domainName,
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: guideName,
                rowSpan: maxRows,
                styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' }
              },
              {
                content: topicText,
                styles: { halign: 'left', valign: 'middle' }
              }
            ]);
          } else {
            tableData.push([
              {
                content: studentDisplayName,
                styles: { halign: 'left', valign: 'middle', fontStyle: m?.is_leader ? 'bold' : 'normal' }
              },
              {
                content: studentPRN,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: studentDiv,
                styles: { halign: 'center', valign: 'middle' }
              },
              {
                content: topicText,
                styles: { halign: 'left', valign: 'middle' }
              }
            ]);
          }
        }

        // Blank separator row matching Excel's emptyRow
        if (gIdx < targetGroups.length - 1) {
          tableData.push([
            {
              content: '',
              colSpan: 7,
              styles: {
                minCellHeight: 4,
                cellPadding: 0,
                fillColor: [255, 255, 255],
                lineColor: [225, 230, 238],
                lineWidth: 0.5
              }
            }
          ]);
        }
      });

      autoTable(doc, {
        head: [['Group No', 'Name of Student', 'College PRN', 'Division', 'Domain Name', 'Guide Name', '3 Project Topics']],
        body: tableData,
        startY: 104,
        margin: { top: 32, left: margin, right: margin, bottom: 45 },
        theme: 'grid',
        rowPageBreak: 'avoid',
        headStyles: {
          fillColor: [232, 245, 233], // Excel Light Green #E8F5E9
          textColor: [27, 94, 32],    // Excel Dark Green #1B5E20
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          lineColor: [165, 214, 167], // #A5D6A7
          lineWidth: 0.75,
          minCellHeight: 22,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 30, 30],
          cellPadding: { top: 3.5, bottom: 3.5, left: 4.5, right: 4.5 },
          valign: 'middle',
          lineColor: [210, 215, 225],
          lineWidth: 0.5
        },
        columnStyles: {
          0: { cellWidth: 46, halign: 'center' },
          1: { cellWidth: 136, halign: 'left' },
          2: { cellWidth: 68, halign: 'center' },
          3: { cellWidth: 44, halign: 'center' },
          4: { cellWidth: 106, halign: 'center' },
          5: { cellWidth: 110, halign: 'center' },
          6: { cellWidth: 275.89, halign: 'left' }
        }
      });

      // Signature Block on final page
      const finalY = doc.lastAutoTable.finalY || 450;
      let signY = finalY + 36;

      if (signY > pageHeight - 65) {
        doc.addPage();
        signY = 70;
      }

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);

      const col1X = margin + 35;
      doc.line(col1X, signY, col1X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Project Coordinator', col1X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. of Computer Engg.', col1X + 65, signY + 25, { align: 'center' });

      const col2X = pageWidth / 2 - 65;
      doc.line(col2X, signY, col2X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Academic Coordinator', col2X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('MES WCOE Pune', col2X + 65, signY + 25, { align: 'center' });

      const col3X = pageWidth - margin - 165;
      doc.line(col3X, signY, col3X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Head of Department', col3X + 65, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. of Computer Engg.', col3X + 65, signY + 25, { align: 'center' });

      // Clean footer stamped across all pages
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Page ${p} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 16,
          { align: 'center' }
        );
        doc.text(
          'Department of Computer Engineering • MES WCOE Pune',
          margin,
          pageHeight - 16
        );
        doc.text(
          `Academic Year: AY ${academicYear}`,
          pageWidth - margin,
          pageHeight - 16,
          { align: 'right' }
        );
      }

      const cleanFileName = `BE_Project_Guide_Assignments_${academicYear.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(cleanFileName);
      toast.success(`Downloaded: ${cleanFileName}`, { id: toastId });
    } catch (pdfErr) {
      console.error('Error generating Guide Assignments PDF:', pdfErr);
      toast.error('Failed to generate PDF: ' + (pdfErr.message || 'Unknown error'), { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto flex items-center justify-center min-h-[420px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-draft">Loading BE Project Groups...</p>
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
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-md text-xs font-semibold shadow-2xs transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Responses (Excel)</span>
          </button>

          {/* Guide Assignments Export Dropdown (Excel / PDF) */}
          <div className="relative inline-block" ref={guideExportRef}>
            <button
              type="button"
              onClick={() => setGuideExportOpen((prev) => !prev)}
              className="px-3.5 py-2 bg-navy hover:bg-navy/90 text-white rounded-md text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
              title="Export Guide Assignments as Excel or PDF"
              aria-expanded={guideExportOpen}
            >
              <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Allocations</span>
              <svg
                className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${guideExportOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {guideExportOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-lg border border-slate-200 shadow-xl z-50 py-1 text-xs animate-fade-in">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Export Format</span>
                  <span className="text-[9px] font-normal text-slate-400">AY {academicYear}</span>
                </div>

                {/* Option 1: Excel */}
                <button
                  type="button"
                  onClick={() => {
                    setGuideExportOpen(false);
                    handleExportGuideAssignments();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <span className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 4h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 text-xs">Excel Spreadsheet</span>
                    <span className="text-[10px] text-slate-500">Official matrix layout (.xlsx)</span>
                  </div>
                </button>

                {/* Option 2: PDF */}
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={() => {
                    setGuideExportOpen(false);
                    handleExportGuideAssignmentsPdf();
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors border-t border-slate-100"
                >
                  <span className="w-7 h-7 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-slate-800 text-xs">PDF Document</span>
                    <span className="text-[10px] text-slate-500">Official printable format (.pdf)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-l border-rule pl-2.5 ml-1">
            <label className="text-xs font-semibold text-draft hidden sm:inline">AY:</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="py-1.5 px-2 bg-white border border-rule rounded text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-navy"
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
        <div className="p-4 bg-white border border-slate-200/90 rounded-lg shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Groups</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-navy font-mono">{stats.totalGroups}</span>
            <span className="text-xs text-slate-500 font-medium">AY {academicYear}</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-lg shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono">{stats.totalStudents}</span>
            <span className="text-xs text-slate-500 font-medium">Across all teams</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-lg shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned Faculty</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono">{stats.assignedCount}</span>
            <span className="text-xs text-slate-500 font-medium">of {stats.totalGroups} groups</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-lg shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unassigned</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono ${stats.unassignedCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
              {stats.unassignedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {stats.unassignedCount > 0 ? 'Awaiting guide' : 'All assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="p-3.5 bg-white border border-slate-200/90 rounded-lg shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by student name, roll no, group no, faculty guide, domain, or project topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-2 text-xs bg-slate-50/60 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400 hover:text-slate-700"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Division Filter Segmented Control */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1">Division:</span>
            <div className="bg-slate-100 p-0.5 rounded-md flex items-center gap-0.5 border border-slate-200/80">
              {['ALL', 'BE-1', 'BE-2', 'BE-3', 'BE-4'].map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setSelectedDivision(div)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${selectedDivision === div
                      ? 'bg-white text-navy shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                >
                  {div}
                </button>
              ))}
            </div>
          </div>

          {/* Guide Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1">Guide:</span>
            <select
              value={guideFilter}
              onChange={(e) => setGuideFilter(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50/60 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-navy focus:bg-white"
            >
              <option value="ALL">All ({groups.length})</option>
              <option value="ASSIGNED">Assigned ({stats.assignedCount})</option>
              <option value="UNASSIGNED">Unassigned ({stats.unassignedCount})</option>
            </select>
          </div>
        </div>

        {/* Status text */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Showing <strong className="text-slate-800 font-semibold">{filteredGroups.length}</strong> of{' '}
            <strong className="text-slate-800 font-semibold">{groups.length}</strong> project groups
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

      {/* 4. Tabular View Directory */}
      <div className="bg-white border border-slate-200/90 rounded-lg shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between bg-slate-50/80 border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            BE Project Groups Directory
          </h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
            {filteredGroups.length} records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Group</th>
                <th className="py-3 px-4 w-72">Students &amp; PRN</th>
                <th className="py-3 px-4 w-56">Faculty Allocation</th>
                <th className="py-3 px-4">Domain &amp; Topic Preferences</th>
                <th className="py-3 px-4 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="font-semibold text-sm text-slate-700">No project groups matched the filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedDivision('ALL');
                          setGuideFilter('ALL');
                        }}
                        className="mt-1 text-xs text-navy hover:underline font-semibold"
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
                    <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Column 1: Group No */}
                      <td className="align-top py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-900">
                            Group {groupNum || g.group_code}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                              {g.group_code}
                            </span>
                            {g.batch && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {g.batch}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Student Names */}
                      <td className="align-top py-3.5 px-4">
                        {g.members && g.members.length > 0 ? (
                          <div className="space-y-1.5">
                            {g.members.map((m, mIdx) => (
                              <div
                                key={m.roll_no || mIdx}
                                title={m.roll_no ? `PRN / Roll No: ${m.roll_no}${m.division ? ` (${m.division})` : ''}` : undefined}
                                className={`text-xs p-2 rounded transition-colors ${
                                  m.is_leader
                                    ? 'bg-amber-50/70 border border-amber-300 shadow-2xs'
                                    : 'bg-white border border-slate-200 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="font-semibold text-slate-900 flex items-center gap-1 leading-snug">
                                    <span className="text-slate-800">{mIdx + 1}.</span>
                                    <span>{m.name}</span>
                                  </div>
                                  {m.is_leader && (
                                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1">
                                      <span>👑</span> Leader
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No student members listed</span>
                        )}
                      </td>

                      {/* Column 3: Assigned Faculty */}
                      <td className="align-top py-3.5 px-4">
                        <div className="space-y-2.5">
                          {/* Guide */}
                          {g.guide_name ? (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                Guide
                              </div>
                              <div className="font-semibold text-xs text-slate-900 mt-0.5">
                                {g.guide_name}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guide</div>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Unassigned
                              </span>
                            </div>
                          )}

                          {/* Mentors */}
                          {(() => {
                            const effectiveMentors = (g.mentors || []).filter((m) => {
                              const guideId = g.guide_faculty_id || g.guide_id;
                              const guideName = (g.guide_name || '').trim().toLowerCase();
                              if (guideId && Number(m.faculty_id) === Number(guideId)) return false;
                              if (guideName && (m.name || m.mentor_name || '').trim().toLowerCase() === guideName) return false;
                              return true;
                            });
                            return effectiveMentors.length > 0 ? (
                              <div className="pt-1.5 border-t border-slate-100">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
                                  {effectiveMentors.length > 1 ? 'Panel Mentors' : 'Panel Mentor'}
                                </div>
                                <div className="space-y-0.5 mt-0.5">
                                  {effectiveMentors.map((m, mIdx) => (
                                    <div key={m.faculty_id || mIdx} className="font-semibold text-xs text-slate-800">
                                      {m.name || m.mentor_name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </td>

                      {/* Column 4: Project Domain & Topics */}
                      <td className="align-top py-3.5 px-4">
                        <div className="space-y-1.5">
                          {/* Domain Pill */}
                          {g.domain && (
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {g.domain}
                              </span>
                            </div>
                          )}

                          {/* Primary Topic */}
                          <div>
                            <div className="text-xs sm:text-[13px] font-semibold text-slate-900 leading-snug">
                              {g.title || 'Topic preference not specified'}
                            </div>

                            {/* Secondary choices (neatly formatted, no giant paragraphs) */}
                            {(g.title_2 || g.title_3) && (
                              <div className="mt-1.5 space-y-1 text-xs text-slate-500 pl-2.5 border-l-2 border-slate-200">
                                {g.title_2 && (
                                  <div className="truncate max-w-lg" title={`Choice 2: ${g.title_2}`}>
                                    <span className="font-bold text-slate-600 text-[11px] uppercase mr-1">Opt 2:</span>
                                    <span>{g.title_2}</span>
                                  </div>
                                )}
                                {g.title_3 && (
                                  <div className="truncate max-w-lg" title={`Choice 3: ${g.title_3}`}>
                                    <span className="font-bold text-slate-600 text-[11px] uppercase mr-1">Opt 3:</span>
                                    <span>{g.title_3}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Actions */}
                      <td className="align-top py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedGroupModal(g)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-navy bg-white hover:bg-slate-50 rounded-md border border-slate-300 hover:border-slate-400 shadow-2xs transition-all"
                          title="View complete group information"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>View</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Group {getGroupNumber(selectedGroupModal.group_code)} Dossier
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-bold text-navy bg-white px-2 py-0.5 rounded border border-slate-200">
                    {selectedGroupModal.group_code}
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    Division: {selectedGroupModal.batch || 'N/A'}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-semibold text-slate-600">
                    AY: {selectedGroupModal.academic_year || academicYear}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                title="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Domain & Topic Preferences */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Project Domain &amp; Topic Preferences
                </span>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">Domain</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedGroupModal.domain || 'Not Specified'}
                    </p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-700">1. Primary Topic</span>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug">{selectedGroupModal.title || 'N/A'}</p>
                    </div>
                    {selectedGroupModal.title_2 && (
                      <div>
                        <span className="text-xs font-bold text-slate-500">2. Second Choice</span>
                        <p className="text-xs sm:text-[13px] text-slate-700 mt-0.5 leading-snug">{selectedGroupModal.title_2}</p>
                      </div>
                    )}
                    {selectedGroupModal.title_3 && (
                      <div>
                        <span className="text-xs font-bold text-slate-500">3. Third Choice</span>
                        <p className="text-xs sm:text-[13px] text-slate-700 mt-0.5 leading-snug">{selectedGroupModal.title_3}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned Faculty Guide & Mentors */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Assigned Faculty
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedGroupModal.guide_name ? (
                    <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Project Guide</span>
                        <div className="font-bold text-sm text-slate-900 mt-0.5">
                          {selectedGroupModal.guide_name}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 text-emerald-800">
                        Assigned
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No guide assigned
                    </div>
                  )}

                  {(() => {
                    const effectiveMentors = (selectedGroupModal.mentors || []).filter((m) => {
                      const guideId = selectedGroupModal.guide_faculty_id || selectedGroupModal.guide_id;
                      const guideName = (selectedGroupModal.guide_name || '').trim().toLowerCase();
                      if (guideId && Number(m.faculty_id) === Number(guideId)) return false;
                      if (guideName && (m.name || m.mentor_name || '').trim().toLowerCase() === guideName) return false;
                      return true;
                    });
                    return effectiveMentors.length > 0 ? (
                      <div className="p-3.5 rounded-lg bg-purple-50/50 border border-purple-200/80 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                          {effectiveMentors.length > 1 ? 'Panel Mentors' : 'Panel Mentor'}
                        </span>
                        {effectiveMentors.map((m, mIdx) => (
                          <div key={m.faculty_id || mIdx} className="font-bold text-sm text-slate-900">
                            {m.name || m.mentor_name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        No mentor assigned
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Student Roster */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Team Members ({selectedGroupModal.members?.length || 0})
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-left w-10">#</th>
                        <th className="p-2.5 text-left">Student Name</th>
                        <th className="p-2.5 text-left">Roll No / PRN</th>
                        <th className="p-2.5 text-left">Division</th>
                        <th className="p-2.5 text-left">Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedGroupModal.members || []).map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-slate-900">
                            {m.name}{' '}
                            {m.is_leader && (
                              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Leader
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">{m.roll_no || '—'}</td>
                          <td className="p-2.5">{m.division || selectedGroupModal.batch || '—'}</td>
                          <td className="p-2.5 text-slate-500 space-y-0.5">
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
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGroupModal(null)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded shadow-2xs transition-colors"
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
