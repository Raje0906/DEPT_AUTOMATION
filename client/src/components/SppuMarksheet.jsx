import React from 'react';

const SPPU_CODE_MAP = {
  'CE501': '310241',
  'CE502': '310242',
  'CE503': '310243',
  'CE504': '310244',
  'CE505_HCI': '310245B',
  'CE505_IOT': '310245A',
  'CE505_DS': '310245C',
  'CE506_DBMSL': '310246',
  'CE507_CNSL': '310247',
  'CE508_LP1': '310248',
  'CE509_SEM': '310249',
};

export default function SppuMarksheet({ student, subjects = [], semester = 5, academicYear = '2025-26', sgpa, published = true }) {
  const currentDate = new Date().toLocaleDateString('en-GB');

  // Format seat number: e.g. T400320531 or derived from roll_no
  const roll = student?.roll_no || '001';
  const seatNo = student?.seat_no || `T40032${String(roll).padStart(4, '0')}`;
  const prn = student?.enrollment_no || '72313148B';
  const studentName = (student?.name || 'STUDENT NAME').toUpperCase();
  const motherName = student?.mother_name || 'RASHMI';

  // Calculate totals and credit points
  let totalCredits = 0;
  let earnedCredits = 0;
  let totalCreditPoints = 0;

  const subjectRows = subjects.map((s) => {
    const code = s.subject_code || s.subjectCode || '';
    const sppuCode = SPPU_CODE_MAP[code] || code.replace(/^CE/, '3102');
    const name = (s.subject_name || s.subjectName || '').toUpperCase();
    const crd = Number(s.credits) || 0;
    const isBacklog = s.is_backlog || s.isBacklog || s.grade === 'F';
    const ernCrd = isBacklog ? 0 : crd;
    const grd = s.grade || (published ? '—' : 'PND');
    const gp = (s.grade_points ?? s.gradePoints ?? (isBacklog ? 0 : null));
    const crdPnt = ernCrd * (gp !== null && gp !== undefined ? Number(gp) : 0);

    totalCredits += crd;
    earnedCredits += ernCrd;
    totalCreditPoints += crdPnt;

    return {
      sem: semester,
      subCode: `* ${sppuCode}`,
      name,
      crd,
      ernCrd,
      grd,
      gp: gp !== null && gp !== undefined ? gp : '—',
      crdPnt,
    };
  });

  // Ensure total credits displays 22 as required
  const displayTotalCredits = totalCredits > 0 ? totalCredits : 22;
  const computedSgpa = sgpa !== null && sgpa !== undefined
    ? Number(sgpa).toFixed(2)
    : (displayTotalCredits > 0 ? (totalCreditPoints / displayTotalCredits).toFixed(2) : '0.00');

  const semName = semester === 5 ? 'Fifth' : `Semester ${semester}`;

  return (
    <div className="sppu-marksheet-container bg-white text-black font-sans border border-gray-400 p-6 sm:p-8 max-w-4xl mx-auto shadow-sm print:shadow-none print:border print:border-black print:p-2 print:max-w-none print:w-full">
      {/* ─── Top College Header ────────────────────────────────────────── */}
      <div className="border-b-2 border-black pb-3 mb-4 print:pb-1.5 print:mb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-700 mb-2 print:mb-1 print:text-[10px]">
          <span className="font-bold tracking-wider uppercase text-gray-900">MES WADIA COE</span>
          <span className="font-mono text-[11px] print:text-[10px]">Download Date: {currentDate}</span>
        </div>
        <div className="text-center space-y-1 print:space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-serif font-black tracking-wide uppercase text-black print:text-lg">
            MES wadia COE
          </h1>
          <p className="text-xs font-bold text-gray-800 tracking-wide uppercase print:text-[10px]">
            Pune, 411001
          </p>
          <div className="pt-1.5 print:pt-0.5">
            <span className="inline-block bg-gray-100 border border-gray-400 px-4 py-1 text-xs font-bold text-gray-950 uppercase tracking-wider print:py-0.5 print:px-2 print:text-[10px]">
              MESWCOE Online Result Display
            </span>
          </div>
        </div>
      </div>

      {/* ─── Student Information Matrix ───────────────────────────────────── */}
      <div className="border border-black mb-4 text-xs print:mb-2 print:text-[10px]">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black border-b border-black">
          <div className="p-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Branch/Course:</span>
            <span className="font-semibold text-gray-900 block mt-0.5 print:text-[10px]">
              T.E. (2019 Credit Pattern) Winter Session 2025
            </span>
          </div>
          <div className="p-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Seat No:</span>
            <span className="font-mono font-bold text-gray-900 block mt-0.5 print:text-[10px]">{seatNo}</span>
          </div>
          <div className="p-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Center:</span>
            <span className="font-mono font-semibold text-gray-900 block mt-0.5 print:text-[10px]">[CEGP011350] [32]</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black border-b border-black">
          <div className="p-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Perm Reg No (PRN):</span>
            <span className="font-mono font-bold text-gray-900 block mt-0.5 print:text-[10px]">{prn}</span>
          </div>
          <div className="p-2 md:col-span-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Student Name:</span>
            <span className="font-bold text-gray-900 block mt-0.5 print:text-[10px]">{studentName}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black">
          <div className="p-2 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">Mother Name:</span>
            <span className="font-semibold text-gray-900 block mt-0.5 print:text-[10px]">{motherName}</span>
          </div>
          <div className="p-2 md:col-span-2 bg-gray-50 print:p-1">
            <span className="text-[10px] uppercase font-bold text-gray-600 block print:text-[9px]">College Name:</span>
            <div className="mt-0.5">
              <span className="font-mono text-xs font-semibold text-gray-700 mr-1.5 print:text-[10px]">[CEGP011350] [32]</span>
              <strong className="text-sm font-bold text-gray-950 uppercase tracking-wide print:text-[11px]">
                MES Wadia College of Engineering
              </strong>
              <span className="block text-[11px] text-gray-600 font-normal italic tracking-normal mt-0.5 lowercase print:text-[9.5px]">
                affiliated to sppu
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Result Table in Exact SPPU Columns ───────────────────────────── */}
      <div className="overflow-x-auto border border-black mb-4 print:mb-2">
        <table className="w-full text-left text-xs border-collapse font-sans print:text-[10px]">
          <thead>
            <tr className="bg-gray-100 border-b border-black text-[11px] font-bold text-gray-900 uppercase print:text-[9.5px]">
              <th className="p-2 border-r border-black text-center w-12 print:p-1">Sem</th>
              <th className="p-2 border-r border-black text-center w-24 print:p-1">SubCode</th>
              <th className="p-2 border-r border-black print:p-1">Subject Name</th>
              <th className="p-2 border-r border-black text-center w-14 print:p-1">Crd</th>
              <th className="p-2 border-r border-black text-center w-16 print:p-1">Ern Crd</th>
              <th className="p-2 border-r border-black text-center w-14 print:p-1">Grd</th>
              <th className="p-2 border-r border-black text-center w-12 print:p-1">GP</th>
              <th className="p-2 text-center w-16 print:p-1">Crd Pnt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300 font-mono">
            {subjectRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="p-2 border-r border-black text-center font-sans font-medium print:p-0.5">{row.sem}</td>
                <td className="p-2 border-r border-black text-center font-bold text-gray-800 print:p-0.5">{row.subCode}</td>
                <td className="p-2 border-r border-black font-sans font-semibold text-gray-950 text-[11px] print:p-0.5 print:text-[10px]">
                  {row.name}
                </td>
                <td className="p-2 border-r border-black text-center print:p-0.5">{row.crd}</td>
                <td className="p-2 border-r border-black text-center font-bold print:p-0.5">{row.ernCrd}</td>
                <td className={`p-2 border-r border-black text-center font-bold font-sans print:p-0.5 ${row.grd === 'F' ? 'text-red-700 bg-red-50' : 'text-gray-900'}`}>
                  {row.grd}
                </td>
                <td className="p-2 border-r border-black text-center print:p-0.5">{row.gp}</td>
                <td className="p-2 text-center font-bold print:p-0.5">{row.crdPnt}</td>
              </tr>
            ))}
            {/* Standard SPPU Audit Course Row */}
            <tr className="bg-gray-50 border-t border-gray-300">
              <td className="p-2 border-r border-black text-center font-sans font-medium print:p-0.5">{semester}</td>
              <td className="p-2 border-r border-black text-center font-bold text-gray-800 print:p-0.5">* 310250C</td>
              <td className="p-2 border-r border-black font-sans font-semibold text-gray-950 text-[11px] print:p-0.5 print:text-[10px]">
                LEARN NEW SKILLS (AUDIT COURSE)
              </td>
              <td className="p-2 border-r border-black text-center text-gray-400 print:p-0.5">—</td>
              <td className="p-2 border-r border-black text-center text-gray-400 print:p-0.5">—</td>
              <td className="p-2 border-r border-black text-center font-bold font-sans text-emerald-800 print:p-0.5">AC</td>
              <td className="p-2 border-r border-black text-center text-gray-400 print:p-0.5">—</td>
              <td className="p-2 text-center text-gray-400 print:p-0.5">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── SPPU Summary Bar ─────────────────────────────────────────────── */}
      <div className="border border-black p-3 mb-3 bg-gray-50 text-xs font-semibold print:p-1.5 print:mb-1.5 print:text-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono print:gap-2">
          <div>
            <span className="font-sans font-bold text-gray-700 uppercase">{semName} Semester SGPA : </span>
            <span className="text-sm font-black text-indigo-900 underline underline-offset-4 decoration-2 print:text-xs">
              {computedSgpa}
            </span>
          </div>
          <div>
            <span className="font-sans font-bold text-gray-700 uppercase">Credits Earned/Total : </span>
            <span className="text-sm font-black text-gray-950 print:text-xs">
              {earnedCredits}/{displayTotalCredits}
            </span>
          </div>
          <div>
            <span className="font-sans font-bold text-gray-700 uppercase">Total Credit Points : </span>
            <span className="text-sm font-black text-gray-950 print:text-xs">
              {totalCreditPoints}
            </span>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-gray-300 flex flex-wrap justify-between items-center text-[11px] text-gray-600 font-sans print:mt-1 print:pt-1 print:text-[9.5px]">
          <div>
            <strong className="text-gray-800">RESULT DATE:</strong> 10 February 2026
          </div>
          <div>
            <strong className="text-gray-800">SUB:</strong> COMPUTER ENGINEERING
          </div>
          <div className="font-mono text-gray-500">
            Page 1 of 1
          </div>
        </div>
      </div>

      {/* ─── Official Disclaimer ───────────────────────────────────────────── */}
      <div className="text-[10px] text-gray-600 leading-relaxed border-t border-gray-300 pt-2 text-justify font-sans print:pt-1 print:text-[8.5px] print:leading-normal">
        <p>
          <strong>Disclaimer:</strong> The results published online are for immediate information only. These cannot be treated as original statement of marks. Please verify the information from original statement of marks issued by the Savitribai Phule Pune University separately.
        </p>
      </div>
    </div>
  );
}
