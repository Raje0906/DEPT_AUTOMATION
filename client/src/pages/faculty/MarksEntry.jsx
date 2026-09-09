import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

function gradeFromTotal(totalOutOf100) {
  if (totalOutOf100 >= 90) return 'O';
  if (totalOutOf100 >= 80) return 'A+';
  if (totalOutOf100 >= 70) return 'A';
  if (totalOutOf100 >= 60) return 'B+';
  if (totalOutOf100 >= 55) return 'B';
  if (totalOutOf100 >= 50) return 'C';
  if (totalOutOf100 >= 40) return 'P';
  return 'F';
}

function computeLive(subject, cie, practical, endSem) {
  if (!subject) return { total: null, grade: null };
  const maxTotal = subject.max_cie
    + (subject.has_practical ? subject.max_practical : 0)
    + subject.max_end_sem;
  const raw = (Number(cie) || 0) + (subject.has_practical ? (Number(practical) || 0) : 0) + (Number(endSem) || 0);
  const pct  = (raw / maxTotal) * 100;
  return { total: raw, grade: gradeFromTotal(pct) };
}

export default function MarksEntry() {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const semester    = searchParams.get('sem')  || '6';
  const academicYear = searchParams.get('ay')  || '2024-25';
  const division    = searchParams.get('div')  || 'A';

  const [subject, setSubject]   = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks]       = useState({});   // { studentId: { cie, practical, endSem } }
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendbackNote, setSendbackNote] = useState('');

  useEffect(() => {
    api.get(`/faculty/marks/${subjectId}?semester=${semester}&academic_year=${academicYear}&division=${division}`)
      .then(res => {
        setSubject(res.data.subject);
        setStudents(res.data.students);

        // Pre-fill existing marks
        const initial = {};
        for (const s of res.data.students) {
          initial[s.student_id] = {
            cie:       s.cie_marks ?? '',
            practical: s.practical_marks ?? '',
            endSem:    s.end_sem_marks ?? '',
          };
        }
        setMarks(initial);

        const locked = res.data.students.some(s =>
          s.status === 'submitted' || s.status === 'approved' || s.status === 'published'
        );
        setIsLocked(locked);
        setSendbackNote(res.data.students[0]?.sendback_comment || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [subjectId, semester, academicYear, division]);

  const updateMark = (studentId, field, value) => {
    if (isLocked) return;
    setMarks(m => ({ ...m, [studentId]: { ...m[studentId], [field]: value } }));
  };

  const validateMark = (field, value) => {
    if (value === '' || value === null) return false;
    const num = Number(value);
    if (isNaN(num) || num < 0) return true; // error
    if (field === 'cie'      && subject && num > subject.max_cie)       return true;
    if (field === 'practical' && subject && num > subject.max_practical) return true;
    if (field === 'endSem'   && subject && num > subject.max_end_sem)   return true;
    return false;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const marksData = students.map(s => ({
        studentId: s.student_id,
        cie:      Number(marks[s.student_id]?.cie) || 0,
        practical: Number(marks[s.student_id]?.practical) || 0,
        endSem:    Number(marks[s.student_id]?.endSem) || 0,
      }));
      await api.post('/faculty/marks', {
        subjectId: parseInt(subjectId, 10), semester, academicYear, division, marksData,
      });
      toast.success('Marks saved as draft.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Save first, then submit
      const marksData = students.map(s => ({
        studentId: s.student_id,
        cie:      Number(marks[s.student_id]?.cie) || 0,
        practical: Number(marks[s.student_id]?.practical) || 0,
        endSem:    Number(marks[s.student_id]?.endSem) || 0,
      }));
      await api.post('/faculty/marks', { subjectId: parseInt(subjectId, 10), semester, academicYear, division, marksData });
      await api.post('/faculty/marks/submit', { subjectId: parseInt(subjectId, 10), semester, academicYear });
      toast.success('Marks submitted for HOD approval. Marks are now read-only.');
      setIsLocked(true);
      setShowConfirm(false);
      navigate('/faculty');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit marks');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!students || students.length === 0) {
      toast.error('No students found to export');
      return;
    }

    const exportRows = students.map((s, idx) => {
      const m = marks[s.student_id] || {};
      const row = {
        '#': idx + 1,
        'Roll No.': isNaN(Number(s.roll_no)) ? s.roll_no : Number(s.roll_no),
        'Seat No.': s.enrollment_no?.startsWith('T') ? s.enrollment_no : '',
        'PRN No': s.enrollment_no || '',
        'Name of the Student': s.name,
        [`IN / CIE (Max ${subject.max_cie})`]: m.cie !== '' && m.cie != null ? Number(m.cie) : '',
      };
      if (subject.has_practical) {
        row[`Practical (Max ${subject.max_practical})`] = m.practical !== '' && m.practical != null ? Number(m.practical) : '';
      }
      row[`End-Sem (Max ${subject.max_end_sem})`] = m.endSem !== '' && m.endSem != null ? Number(m.endSem) : '';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marksheet');
    XLSX.writeFile(wb, `${subject.code}_${division}_Marksheet.xlsx`);
    toast.success('Excel marksheet downloaded (.xlsx)!');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          toast.error('The selected Excel file is empty');
          return;
        }

        // Find header row (the row containing Roll No. or Roll)
        let headerRowIdx = -1;
        let rollIdx = -1, nameIdx = -1, inSemIdx = -1, pracIdx = -1, endSemIdx = -1, prnIdx = -1;

        for (let r = 0; r < Math.min(20, jsonRows.length); r++) {
          const row = jsonRows[r].map(c => String(c).trim().toLowerCase());
          const rIdx = row.findIndex(c => c.includes('roll'));
          if (rIdx !== -1) {
            headerRowIdx = r;
            rollIdx = rIdx;
            nameIdx = row.findIndex(c => c.includes('name') || c.includes('student'));
            prnIdx = row.findIndex(c => c.includes('prn') || c.includes('seat'));
            inSemIdx = row.findIndex(c => c === 'in' || c.includes('insem') || c.includes('in-sem') || c.includes('cie'));
            pracIdx = row.findIndex(c => c.includes('prac'));
            endSemIdx = row.findIndex(c => (c.includes('end') || c.includes('sem')) && c !== 'in' && !c.includes('insem'));
            break;
          }
        }

        if (headerRowIdx === -1 || rollIdx === -1) {
          toast.error('Could not locate a "Roll No." column in the Excel file');
          return;
        }

        const newMarks = { ...marks };
        let updatedCount = 0;

        for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
          const row = jsonRows[r];
          if (!row || row.length === 0) continue;

          let rollRaw = String(row[rollIdx] || '').trim();
          if (!rollRaw) continue;

          let rollNo = rollRaw;
          if (!isNaN(Number(rollRaw))) {
            rollNo = String(parseInt(Number(rollRaw), 10));
          }

          const student = students.find(s => {
            const sRoll = String(s.roll_no).trim().toLowerCase();
            const sEnroll = String(s.enrollment_no || '').trim().toLowerCase();
            const sName = String(s.name || '').trim().toLowerCase();
            return (
              sRoll === rollNo.toLowerCase() ||
              sRoll === `ce6a${rollNo.padStart(3, '0')}`.toLowerCase() ||
              (prnIdx !== -1 && sEnroll && sEnroll === String(row[prnIdx]).trim().toLowerCase()) ||
              (nameIdx !== -1 && sName && sName === String(row[nameIdx]).trim().toLowerCase())
            );
          });

          if (!student) continue;

          const current = newMarks[student.student_id] || {};
          let cieVal = inSemIdx !== -1 && row[inSemIdx] !== '' && !isNaN(Number(row[inSemIdx])) ? row[inSemIdx] : current.cie;
          let pracVal = pracIdx !== -1 && row[pracIdx] !== '' && !isNaN(Number(row[pracIdx])) ? row[pracIdx] : current.practical;
          let endSemVal = endSemIdx !== -1 && row[endSemIdx] !== '' && !isNaN(Number(row[endSemIdx])) ? row[endSemIdx] : current.endSem;

          newMarks[student.student_id] = {
            ...current,
            cie: cieVal !== undefined ? Number(cieVal) : '',
            practical: pracVal !== undefined ? Number(pracVal) : '',
            endSem: endSemVal !== undefined ? Number(endSemVal) : '',
          };
          updatedCount++;
        }

        setMarks(newMarks);
        if (updatedCount > 0) {
          toast.success(`Successfully imported marks for ${updatedCount} students from Excel!`);
        } else {
          toast.error('No matching student roll numbers found in the file');
        }
      } catch (err) {
        console.error('Excel parse error:', err);
        toast.error('Error reading Excel file. Please ensure it is a valid .xlsx or .csv');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  if (loading) return <div className="p-8 text-base text-draft">Loading mark entry sheet…</div>;
  if (!subject) return <div className="p-8 text-base text-fail">Subject not found or not assigned to you.</div>;

  const currentStatus = students[0]?.status || 'draft';

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-rule flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">{subject.name}</h1>
          <p className="text-base text-draft mt-1 font-medium">
            {subject.code} · Semester {semester} · Class {division} · {academicYear}
          </p>
          <p className="text-sm text-draft mt-1.5 font-medium">
            Max marks — CIE: <span className="font-bold text-ink">{subject.max_cie}</span>
            {subject.has_practical ? ` | Practical: ` : ''}
            {subject.has_practical ? <span className="font-bold text-ink">{subject.max_practical}</span> : ''}
            {' '}| End-Sem: <span className="font-bold text-ink">{subject.max_end_sem}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isLocked && (
            <span className={`badge text-xs px-3 py-1.5 ${
              currentStatus === 'published' ? 'badge-published' :
              currentStatus === 'approved'  ? 'badge-approved' : 'badge-submitted'
            }`}>
              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)} — read-only
            </span>
          )}
          {!isLocked && (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-secondary text-xs px-4 py-2">
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button onClick={() => setShowConfirm(true)} className="btn-primary text-xs px-4 py-2">
                Submit for approval →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Excel / CSV Operations Bar */}
      <div className="mb-6 p-4 bg-white border border-rule rounded flex items-center justify-between gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2 text-sm text-ink font-medium">
          <span className="text-navy font-semibold text-base">📊 Excel / CSV Sheet Options</span>
          <span className="text-xs text-draft font-medium bg-gray-100 px-2 py-0.5 rounded">
            {students.length} students enrolled
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-paper hover:bg-gray-200 border border-rule text-ink text-xs font-semibold rounded transition-colors shadow-xs"
          >
            <span>📥</span>
            <span>Download Excel Marksheet (.xlsx)</span>
          </button>
          {!isLocked && (
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-[#152042] text-white text-xs font-semibold rounded cursor-pointer transition-colors shadow-sm">
              <span>📤</span>
              <span>Upload Filled Excel / CSV Sheet</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Sendback notice */}
      {sendbackNote && (
        <div className="anomaly-flag mb-4">
          <svg className="w-4 h-4 text-pending flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
          </svg>
          <div>
            <p className="font-semibold text-pending text-sm">Sent back for correction</p>
            <p className="text-xs mt-0.5">{sendbackNote}</p>
          </div>
        </div>
      )}

      {/* Marks table */}
      <div className="panel overflow-x-auto">
        <table className="result-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Roll No</th>
              <th>Student Name</th>
              <th className="numeric">
                CIE <span className="font-normal text-draft">/ {subject.max_cie}</span>
              </th>
              {subject.has_practical && (
                <th className="numeric">
                  Practical <span className="font-normal text-draft">/ {subject.max_practical}</span>
                </th>
              )}
              <th className="numeric">
                End-Sem <span className="font-normal text-draft">/ {subject.max_end_sem}</span>
              </th>
              <th className="numeric">Total</th>
              <th className="text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, idx) => {
              const m = marks[s.student_id] || {};
              const live = computeLive(subject, m.cie, m.practical, m.endSem);
              const cieErr  = validateMark('cie', m.cie);
              const pracErr = validateMark('practical', m.practical);
              const esErr   = validateMark('endSem', m.endSem);
              return (
                <tr key={s.student_id}>
                  <td className="text-gray-400 text-xs font-semibold">{idx + 1}</td>
                  <td className="font-mono text-sm font-bold text-navy">{s.roll_no}</td>
                  <td className="font-semibold text-base text-ink">{s.name}</td>
                  <td className="numeric">
                    {isLocked
                      ? <span className="tabular-num font-semibold text-base">{s.cie_marks ?? '—'}</span>
                      : <input
                          type="number" min="0" max={subject.max_cie} step="0.5"
                          className={`mark-input ${cieErr ? 'error' : ''}`}
                          value={m.cie}
                          onChange={e => updateMark(s.student_id, 'cie', e.target.value)}
                          aria-label={`CIE marks for ${s.name}`}
                        />
                    }
                  </td>
                  {subject.has_practical && (
                    <td className="numeric">
                      {isLocked
                        ? <span className="tabular-num font-semibold text-base">{s.practical_marks ?? '—'}</span>
                        : <input
                            type="number" min="0" max={subject.max_practical} step="0.5"
                            className={`mark-input ${pracErr ? 'error' : ''}`}
                            value={m.practical}
                            onChange={e => updateMark(s.student_id, 'practical', e.target.value)}
                            aria-label={`Practical marks for ${s.name}`}
                          />
                      }
                    </td>
                  )}
                  <td className="numeric">
                    {isLocked
                      ? <span className="tabular-num font-semibold text-base">{s.end_sem_marks ?? '—'}</span>
                      : <input
                          type="number" min="0" max={subject.max_end_sem} step="0.5"
                          className={`mark-input ${esErr ? 'error' : ''}`}
                          value={m.endSem}
                          onChange={e => updateMark(s.student_id, 'endSem', e.target.value)}
                          aria-label={`End-sem marks for ${s.name}`}
                        />
                    }
                  </td>
                  <td className="numeric font-bold text-base tabular-num text-ink">
                    {live.total ?? '—'}
                  </td>
                  <td className="text-center">
                    <span className={`text-base ${
                      live.grade === 'F' ? 'text-fail font-bold' :
                      live.grade === 'O' || live.grade === 'A+' ? 'text-pass font-bold' :
                      'font-bold text-ink'
                    }`}>
                      {live.grade || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Submit confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white border border-rule rounded-sm w-full max-w-md mx-4 p-6 shadow-xl">
            <h2 className="font-serif text-xl font-bold text-ink mb-3">Submit marks for approval?</h2>
            <p className="text-sm text-ink mb-2">
              This will submit marks for <strong>{subject.name}</strong> to the HOD for approval.
            </p>
            <p className="text-sm text-fail font-medium mb-5">
              Once submitted, you will not be able to edit marks until the HOD approves or sends them back.
              This is a one-way action.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                {saving ? 'Submitting…' : 'Yes, submit for approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
