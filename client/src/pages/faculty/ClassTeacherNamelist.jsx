import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ClassTeacherNamelist() {
  const { user } = useAuth();

  // Class Selection state
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [isHod, setIsHod] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Source options
  const [sourceMode, setSourceMode] = useState('pdf'); // 'pdf' or 'db'
  const [classPdfFile, setClassPdfFile] = useState(null);
  const [masterPdfFile, setMasterPdfFile] = useState(null);
  const [defaultMasterPath, setDefaultMasterPath] = useState('TE COMP.pdf');
  const [masterAvailable, setMasterAvailable] = useState(true);

  // Processing & Segregated Data state
  const [processing, setProcessing] = useState(false);
  const [segregatedResult, setSegregatedResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('seat_no'); // 'seat_no' | 'student_name' | 'sr_no'
  const [sortAsc, setSortAsc] = useState(true);

  // Fetch Class Teacher assignments
  useEffect(() => {
    fetchClassAssignments();
  }, []);

  const fetchClassAssignments = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/faculty/namelist/classes');
      setAssignedClasses(res.data.classes || []);
      setIsHod(!!res.data.isHod);
      setMasterAvailable(res.data.masterAvailable ?? true);
      setDefaultMasterPath(res.data.defaultMasterPath || 'TE COMP.pdf');

      if (res.data.classes?.length > 0) {
        setSelectedClass(res.data.classes[0]);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      toast.error(err.response?.data?.error || 'Unable to load class teacher information.');
    } finally {
      setLoadingConfig(false);
    }
  };

  // Handle class PDF file selection
  const handleClassPdfChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a valid PDF document.');
        return;
      }
      setClassPdfFile(file);
      toast.success(`Loaded Class PDF: ${file.name}`);
    }
  };

  // Handle master PDF file selection
  const handleMasterPdfChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please upload a valid PDF document.');
        return;
      }
      setMasterPdfFile(file);
      toast.success(`Loaded University Master PDF: ${file.name}`);
    }
  };

  const handleRemoveMaster = () => {
    setMasterPdfFile(null);
  };

  // Run Namelist Segregation
  const handleRunSegregation = async () => {
    if (!masterPdfFile) {
      toast.error('Please upload the University Master Namelist PDF (Step 1).');
      return;
    }
    if (sourceMode === 'pdf' && !classPdfFile) {
      toast.error('Please select or upload your Class PDF (with PRN & Student Name).');
      return;
    }
    if (sourceMode === 'db' && !selectedClass) {
      toast.error('Please choose an assigned class/division.');
      return;
    }

    setProcessing(true);
    const formData = new FormData();
    formData.append('class_name', selectedClass);

    if (sourceMode === 'pdf' && classPdfFile) {
      formData.append('class_pdf', classPdfFile);
    }

    if (masterPdfFile) {
      formData.append('master_pdf', masterPdfFile);
    }

    try {
      const res = await api.post('/faculty/namelist/segregate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setSegregatedResult(res.data);
        toast.success(`Successfully segregated ${res.data.matched_count} students!`);
      } else {
        toast.error(res.data?.error || 'Failed to segregate namelist.');
      }
    } catch (err) {
      console.error('Segregation error:', err);
      toast.error(err.response?.data?.error || err.message || 'Error processing PDF');
    } finally {
      setProcessing(false);
    }
  };

  // Filter & Sort matched students
  const filteredStudents = useMemo(() => {
    if (!segregatedResult?.students) return [];
    let list = [...segregatedResult.students];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        s =>
          (s.seat_no && s.seat_no.toLowerCase().includes(q)) ||
          (s.student_name && s.student_name.toLowerCase().includes(q)) ||
          (s.mother_name && s.mother_name.toLowerCase().includes(q)) ||
          (s.university_prn && s.university_prn.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [segregatedResult, searchTerm, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Generate and Download Official Segregated PDF
  const handleDownloadPdf = () => {
    if (!segregatedResult || !segregatedResult.students?.length) {
      toast.error('No segregated students to generate PDF for.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36; // 0.5 inch

      // Institutional Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 28, 56);
      doc.text('MES WADIA COLLEGE OF ENGINEERING, PUNE - 411001', pageWidth / 2, 45, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(70, 80, 95);
      doc.text('(Affiliated to Savitribai Phule Pune University • Approved by AICTE)', pageWidth / 2, 58, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 28, 56);
      doc.text('DEPARTMENT OF COMPUTER ENGINEERING', pageWidth / 2, 73, { align: 'center' });

      // Title Box
      doc.setDrawColor(20, 28, 56);
      doc.setLineWidth(1);
      doc.line(margin, 82, pageWidth - margin, 82);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(180, 83, 9); // Amber / Dark Gold
      doc.text('UNIVERSITY EXAMINATION — CANDIDATE SEAT & NAMELIST LEDGER', pageWidth / 2, 96, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);

      const targetClassName = segregatedResult.target_class || selectedClass;

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      // Metadata info row
      doc.text(`Class / Division: ${targetClassName}`, margin, 114);
      doc.text(`Exam Session: OCT / NOV 2025 (SPPU)`, pageWidth / 2, 114, { align: 'center' });
      doc.text(`Date: ${dateStr}`, pageWidth - margin, 114, { align: 'right' });

      doc.text(`Course: T.E. Computer Engineering (2019 Course)`, margin, 127);
      doc.text(`Master File: TE COMP.pdf`, pageWidth / 2, 127, { align: 'center' });
      doc.text(`Total Candidates: ${segregatedResult.matched_count}`, pageWidth - margin, 127, { align: 'right' });

      // Table Data strictly formatted with required 4 columns
      const tableData = segregatedResult.students.map((st, idx) => [
        idx + 1,
        st.seat_no || '-',
        st.student_name || '-',
        st.mother_name || '-',
        st.university_prn || '-'
      ]);

      autoTable(doc, {
        head: [['Sr.', 'Seat No', 'Student Name', 'Mother Name', 'University PRN']],
        body: tableData,
        startY: 136,
        margin: { left: margin, right: margin, bottom: 65 },
        theme: 'grid',
        headStyles: {
          fillColor: [20, 28, 56],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4.5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 30, 30],
          cellPadding: 4,
          rowPageBreak: 'avoid'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 72, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 190, halign: 'left' },
          3: { cellWidth: 125, halign: 'left' },
          4: { cellWidth: 85, halign: 'center', fontStyle: 'bold' }
        },
        didDrawPage: function (data) {
          // Footer on each page
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text(
            `Page ${data.pageNumber} of ${doc.internal.getNumberOfPages()}`,
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
          );
          doc.text(
            'Department of Computer Engineering • MES WCOE Pune',
            margin,
            pageHeight - 20
          );
          doc.text(
            `Class: ${targetClassName}`,
            pageWidth - margin,
            pageHeight - 20,
            { align: 'right' }
          );
        }
      });

      // Add Institutional Signatures block on the final page
      const finalY = doc.lastAutoTable.finalY || 600;
      let signY = finalY + 45;

      // If not enough room on the last page for signatures, add a new page
      if (signY > pageHeight - 75) {
        doc.addPage();
        signY = 80;
      }

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);

      // Sign line 1: Class Teacher
      const col1X = margin + 10;
      doc.line(col1X, signY, col1X + 110, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Class Teacher', col1X + 55, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(user?.name || 'Class Teacher', col1X + 55, signY + 25, { align: 'center' });

      // Sign line 2: Exam / Academic Coordinator
      const col2X = pageWidth / 2 - 55;
      doc.line(col2X, signY, col2X + 110, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Exam Coordinator', col2X + 55, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. Exam Cell', col2X + 55, signY + 25, { align: 'center' });

      // Sign line 3: Head of Department
      const col3X = pageWidth - margin - 120;
      doc.line(col3X, signY, col3X + 110, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Head of Department', col3X + 55, signY + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Dept. of Computer Engg.', col3X + 55, signY + 25, { align: 'center' });

      // Save PDF
      const cleanFileName = `Segregated_Namelist_${targetClassName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      doc.save(cleanFileName);
      toast.success(`Downloaded: ${cleanFileName}`);
    } catch (pdfErr) {
      console.error('Error generating PDF:', pdfErr);
      toast.error('Failed to generate PDF: ' + pdfErr.message);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!segregatedResult?.students?.length) return;
    const headers = ['Sr No,Seat No,Student Name,Mother Name,University PRN'];
    const rows = segregatedResult.students.map((st, i) =>
      [
        i + 1,
        `"${st.seat_no || ''}"`,
        `"${st.student_name || ''}"`,
        `"${st.mother_name || ''}"`,
        `"${st.university_prn || ''}"`
      ].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Segregated_Students_${selectedClass || 'Class'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported CSV file.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─── Header & Breadcrumb ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#141C38] via-[#1E2B58] to-[#141C38] rounded-xl p-6 text-white shadow-md border border-[#222E54]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Class Teacher Desk
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                SPPU OCT/NOV 2025
              </span>
              {isHod && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  HOD Access
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold font-serif tracking-tight text-white flex items-center gap-3">
              University Namelist Segregator
            </h1>
            <p className="text-blue-200/80 text-xs mt-1 max-w-2xl leading-relaxed">
              Extract, match, and segregate official university exam roll sheets (Seat No, Student Name, Mother Name, and PRN)
              for your specific class division with complete accuracy.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3 self-start md:self-auto">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
              TE
            </div>
            <div>
              <p className="text-[11px] text-blue-200 uppercase font-semibold">Assigned Classes</p>
              <p className="text-sm font-bold text-white">
                {assignedClasses.length > 0 ? assignedClasses.join(', ') : (isHod ? 'All Divisions (HOD)' : 'No classes assigned')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Control Panels: 2 Column Setup ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Source 1: University Master Namelist Upload */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Upload University Master Namelist
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${
                masterPdfFile ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${masterPdfFile ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                {masterPdfFile ? 'File Ready' : 'Upload Required'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Upload the university master examination PDF (e.g. <strong>TE COMP.pdf</strong> sent by SPPU containing Seat No, Name, Mother Name, and PRN).
            </p>

            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <label className="cursor-pointer">
                <span className="text-xs font-bold text-blue-600 hover:text-blue-700">
                  Choose University Master PDF
                </span>
                <span className="text-xs text-slate-500"> or drag and drop</span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleMasterPdfChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload TE COMP.pdf from Savitribai Phule Pune University
              </p>
            </div>

            {masterPdfFile && (
              <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                <div className="flex items-center gap-2 truncate">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold truncate">{masterPdfFile.name}</span>
                  {masterPdfFile.size && (
                    <span className="text-[11px] text-emerald-600">({(masterPdfFile.size / 1024).toFixed(1)} KB)</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveMaster}
                  className="text-xs text-emerald-700 hover:text-red-600 font-bold ml-2"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Source 2: Class Students Input */}
        <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                  Class List Input
                </h2>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSourceMode('pdf')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    sourceMode === 'pdf'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upload Class PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('db')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    sourceMode === 'db'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Select from Database
                </button>
              </div>
            </div>

            {/* TAB A: UPLOAD CLASS PDF */}
            {sourceMode === 'pdf' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload the class PDF provided with <strong>PRN and Student Name</strong> (e.g., TE_COMP_Name_PRN.pdf or your class division roster).
                </p>

                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center transition-colors bg-slate-50/50">
                  <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-blue-600 hover:text-blue-700">
                      Choose Class PDF
                    </span>
                    <span className="text-xs text-slate-500"> or drag and drop</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleClassPdfChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Accepts standard PDF containing Student Name and University PRN
                  </p>
                </div>

                {classPdfFile && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <div className="flex items-center gap-2 truncate">
                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs font-semibold truncate">{classPdfFile.name}</span>
                      <span className="text-[11px] text-emerald-600">({(classPdfFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClassPdfFile(null)}
                      className="text-xs text-emerald-700 hover:text-red-600 font-bold ml-2"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 flex items-start gap-2">
                  <span className="text-blue-600 font-bold">ℹ️</span>
                  <span>
                    <strong>Division Isolation:</strong> The output PDF will be segregated strictly for <strong>{selectedClass}</strong>. Students belonging to other classes are automatically excluded.
                  </span>
                </div>
              </div>
            ) : (
              /* TAB B: SELECT FROM DB */
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Select your assigned class division from the database to instantly match all enrolled students.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isHod ? 'Select Class Division to Segregate' : 'Your Assigned Class Division'}
                  </label>
                  {isHod ? (
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {assignedClasses.length > 0 ? (
                        assignedClasses.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))
                      ) : (
                        <option value="">No classes available</option>
                      )}
                    </select>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                      <span className="text-xs font-bold text-slate-800">{selectedClass}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                        Assigned Class Teacher
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-lg text-blue-900 text-xs">
                  <div className="flex items-center gap-2 font-semibold">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Class Roster Segregation
                  </div>
                  <p className="text-[11px] text-blue-700 mt-1">
                    Target Class: <strong>{selectedClass || 'None'}</strong>. Students belonging to this division will be matched with university seat numbers, mother names, and PRNs.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {!masterPdfFile
                ? 'Step 1: Upload University Master PDF'
                : sourceMode === 'pdf'
                ? classPdfFile
                  ? 'Both PDFs ready to segregate'
                  : 'Step 2: Upload Class PDF'
                : 'Ready to segregate'}
            </span>
            <button
              type="button"
              onClick={handleRunSegregation}
              disabled={processing || !masterPdfFile || (sourceMode === 'pdf' && !classPdfFile)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#141C38] hover:bg-[#1E2B58] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Processing Namelist...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Segregate & Process Class PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Results Section ─────────────────────────────────────────── */}
      {segregatedResult && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Metric Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Master Total</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{segregatedResult.master_total}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">University Master records</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Class Total</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{segregatedResult.class_total}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Students in target list</p>
            </div>
            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Matched Candidates</p>
              <p className="text-xl font-bold text-emerald-800 mt-1">{segregatedResult.matched_count}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">
                {segregatedResult.class_total > 0
                  ? `${Math.round((segregatedResult.matched_count / segregatedResult.class_total) * 100)}% match rate`
                  : 'Ready'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unmatched</p>
              <p className={`text-xl font-bold mt-1 ${segregatedResult.unmatched_count > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {segregatedResult.unmatched_count}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Excluded from class</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            {/* Table Header Bar */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Segregated Class Namelist ({segregatedResult.class_name})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official format with Seat No, Student Name, Mother Name, and University PRN.
                </p>
              </div>

              {/* Table Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search candidate, PRN, seat..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-52"
                  />
                  <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* CSV */}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Export CSV
                </button>

                {/* Download Official Segregated PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs"
                >
                  <svg className="w-4 h-4 text-emerald-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download Segregated PDF
                </button>
              </div>
            </div>

            {/* Candidate Table */}
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#141C38] text-white sticky top-0 z-10 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th
                      className="py-2.5 px-3 w-14 text-center cursor-pointer hover:bg-white/10"
                      onClick={() => toggleSort('sr_no')}
                    >
                      Sr. {sortField === 'sr_no' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                      onClick={() => toggleSort('seat_no')}
                    >
                      Seat No {sortField === 'seat_no' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                      onClick={() => toggleSort('student_name')}
                    >
                      Student Name {sortField === 'student_name' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                      onClick={() => toggleSort('mother_name')}
                    >
                      Mother Name {sortField === 'mother_name' && (sortAsc ? '▲' : '▼')}
                    </th>
                    <th
                      className="py-2.5 px-4 cursor-pointer hover:bg-white/10"
                      onClick={() => toggleSort('university_prn')}
                    >
                      University PRN {sortField === 'university_prn' && (sortAsc ? '▲' : '▼')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((st, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-400">
                          {st.sr_no || idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 tracking-wide">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            {st.seat_no}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {st.student_name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-medium">
                          {st.mother_name || '-'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-blue-900">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200/60">
                            {st.university_prn}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400">
                        No students match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Showing <strong>{filteredStudents.length}</strong> of <strong>{segregatedResult.matched_count}</strong> segregated students
              </span>
              <span className="text-[11px] text-slate-400">
                Official Exam Session: OCT / NOV 2025 • SPPU
              </span>
            </div>
          </div>

          {/* Unmatched Students warning (if any) */}
          {segregatedResult.unmatched?.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Unmatched Students from Class List ({segregatedResult.unmatched.length})
              </div>
              <p className="text-xs text-amber-800 mt-1">
                The following students were in the provided class input but could not be located in the university master examination list.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-amber-200 text-amber-900 font-semibold">
                      <th className="py-1 px-2">Name</th>
                      <th className="py-1 px-2">PRN</th>
                      <th className="py-1 px-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segregatedResult.unmatched.map((u, i) => (
                      <tr key={i} className="border-b border-amber-100 text-amber-800">
                        <td className="py-1 px-2 font-medium">{u.name}</td>
                        <td className="py-1 px-2 font-mono">{u.prn || 'N/A'}</td>
                        <td className="py-1 px-2 text-amber-700">{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
