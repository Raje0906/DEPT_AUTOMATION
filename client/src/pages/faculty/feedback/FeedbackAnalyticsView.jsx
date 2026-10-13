import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon, ArrowDownTrayIcon, AcademicCapIcon, UserGroupIcon,
  ChartBarIcon, StarIcon, CheckCircleIcon, ArrowPathIcon,
  DocumentArrowDownIcon, TableCellsIcon
} from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import api from '../../../api/axios';

export default function FeedbackAnalyticsView({ formId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/feedback/analytics/${formId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load feedback analytics report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [formId]);

  // Export 1: Formatted Excel Workbook (.xlsx)
  const handleExportExcel = () => {
    if (!data) return;

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Faculty Performance
      const facultySheetData = [
        ['TE Mid-Sem Feedback Report', data.form?.title || 'Form'],
        ['Academic Year', data.form?.academic_year || ''],
        ['Semester', data.form?.semester || ''],
        ['Division / Target', data.form?.division || ''],
        ['Total Student Submissions', data.totalSubmissions || 0],
        ['Overall Average Score (/10)', data.overallAverage || 'N/A'],
        [],
        ['Sr. No.', 'Faculty Member', 'Allocated Course', 'Theory Avg (/10)', 'Practical Avg (/10)', 'Overall Score (/10)', 'Total Ratings']
      ];

      (data.facultyAverages || []).forEach((f, idx) => {
        facultySheetData.push([
          idx + 1,
          f.faculty_name,
          f.subject_name || 'N/A',
          f.theory_avg ? `${f.theory_avg}` : '—',
          f.practical_avg ? `${f.practical_avg}` : '—',
          Number(f.avg_rating) || f.avg_rating,
          Number(f.total_ratings) || f.total_ratings
        ]);
      });

      const wsFaculty = XLSX.utils.aoa_to_sheet(facultySheetData);
      wsFaculty['!cols'] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 35 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, wsFaculty, 'Faculty Performance');

      // Sheet 2: Question-Wise Evaluation
      if (data.questionAverages && data.questionAverages.length > 0) {
        const questionSheetData = [
          ['Question-Wise Criteria Assessment', data.form?.title || 'Form'],
          [],
          ['Q. No.', 'Section Type', 'Assessment Criterion / Question Statement', 'Average Rating (/10)']
        ];

        data.questionAverages.forEach((q) => {
          questionSheetData.push([
            `Q${q.question_number}`,
            q.section_type ? q.section_type.toUpperCase() : '',
            q.question_text,
            Number(q.avg_rating) || q.avg_rating
          ]);
        });

        const wsQuestions = XLSX.utils.aoa_to_sheet(questionSheetData);
        wsQuestions['!cols'] = [
          { wch: 10 },
          { wch: 16 },
          { wch: 65 },
          { wch: 22 }
        ];
        XLSX.utils.book_append_sheet(wb, wsQuestions, 'Question Evaluation');
      }

      // Sheet 3: Division Response Breakdown (if present)
      if (data.divisionBreakdown && data.divisionBreakdown.length > 0) {
        const divSheetData = [
          ['Division Response Breakdown'],
          [],
          ['Division', 'Number of Submissions']
        ];
        data.divisionBreakdown.forEach((d) => {
          divSheetData.push([d.division, Number(d.count) || d.count]);
        });
        const wsDiv = XLSX.utils.aoa_to_sheet(divSheetData);
        wsDiv['!cols'] = [{ wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsDiv, 'Division Breakdown');
      }

      const cleanTitle = (data.form?.title || 'feedback').replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `TE_MidSem_Feedback_${cleanTitle}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Error exporting Excel sheet. Please try again.');
    }
  };

  // Export 2: Institutional Formatted PDF (.pdf)
  const handleExportPDF = () => {
    if (!data) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36; // 0.5 in

      // Institutional Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 28, 56);
      doc.text('MES WADIA COLLEGE OF ENGINEERING, PUNE - 411001', pageWidth / 2, 42, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('DEPARTMENT OF COMPUTER ENGINEERING', pageWidth / 2, 57, { align: 'center' });

      doc.setDrawColor(20, 28, 56);
      doc.setLineWidth(1);
      doc.line(margin, 66, pageWidth - margin, 66);

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(180, 83, 9); // Amber / Dark Gold
      doc.text('TE MID-SEM STUDENT FEEDBACK & COURSE EVALUATION REPORT', pageWidth / 2, 82, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      // Metadata Info Box
      doc.text(`Title: ${data.form?.title || 'TE Mid-Sem Evaluation'}`, margin, 100);
      doc.text(`Academic Year: ${data.form?.academic_year || 'N/A'} (Sem ${data.form?.semester || 'N/A'})`, pageWidth / 2, 100, { align: 'center' });
      doc.text(`Date: ${dateStr}`, pageWidth - margin, 100, { align: 'right' });

      doc.text(`Target Division: ${data.form?.division || 'All Divisions'}`, margin, 114);
      doc.text(`Total Student Submissions: ${data.totalSubmissions || 0}`, pageWidth / 2, 114, { align: 'center' });
      doc.text(`Overall Average Score: ${data.overallAverage ? `${data.overallAverage} / 10` : 'N/A'}`, pageWidth - margin, 114, { align: 'right' });

      // Faculty Performance Table
      const facultyTableData = (data.facultyAverages || []).map((fac, idx) => [
        idx + 1,
        fac.faculty_name,
        fac.subject_name || 'N/A',
        fac.theory_avg ? `${fac.theory_avg}` : '—',
        fac.practical_avg ? `${fac.practical_avg}` : '—',
        `${fac.avg_rating} / 10`,
        fac.total_ratings
      ]);

      autoTable(doc, {
        head: [['Sr.', 'Faculty Member', 'Course / Subject', 'Theory Avg', 'Practical Avg', 'Overall Score', 'Total Ratings']],
        body: facultyTableData,
        startY: 126,
        margin: { left: margin, right: margin, bottom: 65 },
        theme: 'grid',
        headStyles: {
          fillColor: [20, 28, 56],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 30, 30],
          cellPadding: 3.5,
          rowPageBreak: 'avoid'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 125, halign: 'left', fontStyle: 'bold' },
          2: { cellWidth: 155, halign: 'left' },
          3: { cellWidth: 55, halign: 'center' },
          4: { cellWidth: 55, halign: 'center' },
          5: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 48, halign: 'right' }
        },
        didDrawPage: function (pageInfo) {
          doc.setFontSize(7.5);
          doc.setTextColor(120, 120, 120);
          doc.text(
            `Page ${pageInfo.pageNumber} of ${doc.internal.getNumberOfPages()}`,
            pageWidth / 2,
            pageHeight - 20,
            { align: 'center' }
          );
          doc.text('Department of Computer Engineering • MES WCOE Pune', margin, pageHeight - 20);
          doc.text('Confidential Feedback Record', pageWidth - margin, pageHeight - 20, { align: 'right' });
        }
      });

      // Question Breakdown Table
      if (data.questionAverages && data.questionAverages.length > 0) {
        const startYQuestions = (doc.lastAutoTable?.finalY || 130) + 20;
        let nextY = startYQuestions;
        if (nextY > pageHeight - 160) {
          doc.addPage();
          nextY = 45;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(20, 28, 56);
        doc.text('QUESTION-WISE EVALUATION CRITERIA BREAKDOWN', margin, nextY);

        const questionTableData = data.questionAverages.map((q) => [
          `Q${q.question_number}`,
          (q.section_type || '').toUpperCase(),
          q.question_text,
          `${q.avg_rating} / 10`
        ]);

        autoTable(doc, {
          head: [['Q#', 'Section', 'Criteria / Question Statement', 'Average Rating']],
          body: questionTableData,
          startY: nextY + 6,
          margin: { left: margin, right: margin, bottom: 65 },
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 4
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [30, 30, 30],
            cellPadding: 3.5,
            rowPageBreak: 'avoid'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252]
          },
          columnStyles: {
            0: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 62, halign: 'center' },
            2: { cellWidth: 360, halign: 'left' },
            3: { cellWidth: 72, halign: 'center', fontStyle: 'bold' }
          },
          didDrawPage: function (pageInfo) {
            doc.setFontSize(7.5);
            doc.setTextColor(120, 120, 120);
            doc.text(
              `Page ${pageInfo.pageNumber} of ${doc.internal.getNumberOfPages()}`,
              pageWidth / 2,
              pageHeight - 20,
              { align: 'center' }
            );
            doc.text('Department of Computer Engineering • MES WCOE Pune', margin, pageHeight - 20);
            doc.text('Confidential Feedback Record', pageWidth - margin, pageHeight - 20, { align: 'right' });
          }
        });
      }

      // Institutional Signatures Block
      const finalY = doc.lastAutoTable?.finalY || 500;
      let signY = finalY + 45;

      if (signY > pageHeight - 75) {
        doc.addPage();
        signY = 80;
      }

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);

      // Sign 1: Feedback Coordinator (Ms. C. Y. Vakte)
      const col1X = margin + 15;
      doc.line(col1X, signY, col1X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Ms. C. Y. Vakte', col1X + 65, signY + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Feedback Coordinator', col1X + 65, signY + 23, { align: 'center' });

      // Sign 2: Head of Department
      const col2X = pageWidth - margin - 145;
      doc.line(col2X, signY, col2X + 130, signY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Head of Department', col2X + 65, signY + 13, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Department of Computer Engineering', col2X + 65, signY + 23, { align: 'center' });

      const cleanTitle = (data.form?.title || 'feedback').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`TE_MidSem_Feedback_${cleanTitle}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Error generating PDF report. Please try again.');
    }
  };

  // Export 3: Raw CSV Data
  const handleExportCSV = () => {
    if (!data || !data.facultyAverages) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `TE Mid-Sem Feedback Report - ${data.form?.title || 'Form'}\n`;
    csvContent += `Academic Year: ${data.form?.academic_year || ''}, Semester: ${data.form?.semester || ''}, Division: ${data.form?.division || ''}\n`;
    csvContent += `Total Submissions: ${data.totalSubmissions || 0}, Overall Average: ${data.overallAverage || 'N/A'}/10\n\n`;

    csvContent += 'FACULTY PERFORMANCE BREAKDOWN\n';
    csvContent += 'Faculty Name,Subject Name,Section Type,Average Rating (1-10),Total Ratings\n';
    data.facultyAverages.forEach((f) => {
      csvContent += `"${f.faculty_name}","${f.subject_name || 'N/A'}","${f.theory_avg ? 'Theory' : 'Practical'}",${f.avg_rating},${f.total_ratings}\n`;
    });

    if (data.questionAverages && data.questionAverages.length > 0) {
      csvContent += '\nQUESTION-WISE EVALUATION BREAKDOWN\n';
      csvContent += 'Question No,Section Type,Question Text,Average Rating (1-10)\n';
      data.questionAverages.forEach((q) => {
        csvContent += `${q.question_number},"${q.section_type}","${q.question_text.replace(/"/g, '""')}",${q.avg_rating}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `feedback_report_${data.form?.id || 'te'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded border border-rule">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy mb-3"></div>
        <p className="text-sm text-draft">Compiling analytical metrics and score distributions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700 space-y-3">
        <p className="font-bold text-sm">Error Loading Analytics:</p>
        <p className="text-xs">{error}</p>
        <button
          onClick={onBack}
          className="px-3 py-1 bg-white border border-red-300 rounded text-xs font-semibold text-red-800"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { form, totalSubmissions, overallAverage, facultyAverages = [], questionAverages = [], divisionBreakdown = [] } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rule">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-rule rounded hover:bg-paper transition-colors text-ink"
            title="Return to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-draft">
              Feedback Analytics & Assessment Report
            </span>
            <h1 className="text-2xl font-serif font-bold text-ink">
              {form?.title}
            </h1>
            <p className="text-xs text-draft mt-0.5">
              AY {form?.academic_year} · Semester {form?.semester} · Target: {form?.division}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="px-3 py-2 text-xs font-semibold text-ink bg-white border border-rule rounded hover:bg-paper flex items-center gap-1.5 transition-colors"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={totalSubmissions === 0}
            className="px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1.5 shadow-sm transition-colors"
            title="Download multi-sheet Excel (.xlsx) workbook"
          >
            <TableCellsIcon className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={totalSubmissions === 0}
            className="px-3 py-2 text-xs font-semibold text-white bg-navy hover:bg-[#162142] disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1.5 shadow-sm transition-colors"
            title="Download institutional PDF report"
          >
            <DocumentArrowDownIcon className="w-3.5 h-3.5" />
            <span>Export PDF (.pdf)</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={totalSubmissions === 0}
            className="px-3 py-2 text-xs font-semibold text-ink bg-white border border-rule hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1.5 shadow-sm transition-colors"
            title="Download raw CSV data"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Submissions</span>
            <UserGroupIcon className="w-4 h-4" />
          </div>
          <p className="text-3xl font-serif font-bold text-ink mt-2">
            {totalSubmissions}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Students responded</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Overall Average</span>
            <StarIcon className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-navy mt-2">
            {overallAverage ? `${overallAverage}` : '—'}
            <span className="text-sm font-sans text-draft font-normal"> / 10</span>
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Across all criteria</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Evaluated Faculty</span>
            <AcademicCapIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-ink mt-2">
            {facultyAverages.length}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Dynamic allocation mappings</p>
        </div>

        <div className="p-5 bg-white border border-rule rounded">
          <div className="flex items-center justify-between text-draft mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Status</span>
            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold uppercase tracking-wider text-emerald-600 mt-2">
            {form?.status}
          </p>
          <p className="text-xs text-draft mt-1 font-medium">Verified HOD snapshot</p>
        </div>
      </div>

      {totalSubmissions === 0 ? (
        <div className="bg-white p-12 text-center rounded border border-rule">
          <ChartBarIcon className="w-12 h-12 text-draft mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-ink">No Student Submissions Yet</h3>
          <p className="text-xs text-draft mt-1 max-w-md mx-auto">
            Once students submit feedback, dynamic performance indicators, average scores, and faculty distributions will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Faculty Wise Performance Table */}
          <div className="bg-white rounded border border-rule overflow-hidden">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Faculty-Wise Feedback Performance
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Calculated against actual student responses on the 1–10 scale.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-rule text-draft uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3">Faculty Member</th>
                    <th className="px-4 py-3">Allocated Course</th>
                    <th className="px-4 py-3 text-center">Theory Avg</th>
                    <th className="px-4 py-3 text-center">Practical Avg</th>
                    <th className="px-4 py-3 text-center">Overall Score</th>
                    <th className="px-4 py-3 text-right">Total Ratings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {facultyAverages.map((fac, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-ink">
                        {fac.faculty_name}
                      </td>
                      <td className="px-4 py-3.5 text-gray-700">
                        {fac.subject_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-gray-600">
                        {fac.theory_avg ? `${fac.theory_avg} / 10` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-gray-600">
                        {fac.practical_avg ? `${fac.practical_avg} / 10` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          parseFloat(fac.avg_rating) >= 8.5
                            ? 'bg-emerald-100 text-emerald-800'
                            : parseFloat(fac.avg_rating) >= 7.0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fac.avg_rating} / 10
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-draft font-medium">
                        {fac.total_ratings}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Question-Wise Performance Table */}
          {questionAverages.length > 0 && (
            <div className="bg-white rounded border border-rule overflow-hidden">
              <div className="px-6 py-4 border-b border-rule bg-paper">
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Question-Wise Evaluation Breakdown
                </h3>
                <p className="text-xs text-draft mt-0.5">
                  Exact questions matching the 37-page TE Mid-Sem Feedback form.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-rule text-draft uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-6 py-3 w-16">Q#</th>
                      <th className="px-4 py-3 w-28">Section</th>
                      <th className="px-4 py-3">Question Text</th>
                      <th className="px-6 py-3 text-right w-36">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {questionAverages.map((q, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-6 py-3.5 font-bold text-navy">
                          Q{q.question_number}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                            {q.section_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-800 font-medium">
                          {q.question_text}
                        </td>
                        <td className="px-6 py-3.5 text-right font-bold text-navy">
                          {q.avg_rating} / 10
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Division Response Breakdown */}
          {divisionBreakdown.length > 0 && (
            <div className="bg-white rounded border border-rule p-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                Student Participation by Division
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {divisionBreakdown.map((div, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded border border-rule flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{div.division}</span>
                    <span className="text-xs font-semibold text-navy bg-white px-2 py-0.5 rounded border border-rule">
                      {div.count} responses
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
