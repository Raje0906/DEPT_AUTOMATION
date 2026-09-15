import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { StatusBadge } from '../../components/ResultTable';

export default function MarksApproval() {
  const [searchParams] = useSearchParams();
  const subjectId    = searchParams.get('subjectId');
  const semester     = searchParams.get('sem') || '5';
  const academicYear = searchParams.get('ay')  || '2025-26';
  const division     = searchParams.get('div') || 'TE 1';

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [comment, setComment]       = useState('');
  const [showSendback, setShowSendback] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadData = () => {
    if (!subjectId) return;
    setLoading(true);
    api.get(`/hod/marks/${subjectId}?semester=${semester}&academic_year=${encodeURIComponent(academicYear)}&division=${encodeURIComponent(division)}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [subjectId, semester, academicYear, division]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await api.post(`/hod/approve/${subjectId}`, { semester, academicYear, division });
      toast.success(res.data.message);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendback = async () => {
    if (!comment || comment.trim().length < 5) {
      toast.error('Please enter a remark explaining what requires correction.');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/hod/sendback/${subjectId}`, { semester, academicYear, division, comment });
      toast.success(res.data.message);
      setShowSendback(false);
      setComment('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send back');
    } finally {
      setProcessing(false);
    }
  };

  if (!subjectId) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center text-gray-500">
        <p className="text-base font-medium">Select a subject from the HOD dashboard to review.</p>
        <Link to="/hod/publish" className="text-sm text-indigo-600 font-semibold mt-2 inline-block">
          Go to Publish Console →
        </Link>
      </div>
    );
  }

  const examTypes = data?.examTypes || [];
  const students  = data?.students  || [];

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link to="/hod/publish" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            ← Back to Publish Console
          </Link>
          <h1 className="text-2xl lg:text-3xl font-serif font-bold text-gray-900 mt-1">
            Review Marks: {data?.subject?.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Subject Code: <span className="font-mono font-bold text-gray-700">{data?.subject?.code}</span> · Division: <span className="font-bold text-gray-800">{division}</span> · Semester {semester} ({academicYear})
          </p>
        </div>

        {/* Actions (Strictly Read-only for HOD, no marks editing) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSendback(true)}
            disabled={processing || loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50"
          >
            ↩ Send Back for Correction
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            ✓ Approve &amp; Lock Marks
          </button>
        </div>
      </div>

      {/* Sendback Remark Modal / Box */}
      {showSendback && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-300 rounded-xl">
          <h3 className="text-sm font-bold text-amber-900 mb-2">Send Marks Back to Faculty for Correction</h3>
          <p className="text-xs text-amber-700 mb-3">
            Provide specific guidance to the faculty member on which exam marks or students need revision.
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            placeholder="e.g., Please verify the Insem marks for roll numbers 12 and 15..."
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setShowSendback(false)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSendback}
              disabled={processing}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700"
            >
              Confirm Sendback
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading mark sheets...</div>
      ) : students.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <p className="text-base font-semibold">No student marks recorded yet for this subject and division.</p>
        </div>
      ) : (
        /* Read-only multi-exam matrix */
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Roll No</th>
                <th className="px-4 py-3 text-left">PRN</th>
                <th className="px-4 py-3 text-left">Student Name</th>
                {examTypes.map(et => (
                  <th key={et.id} className="px-3 py-3 text-right">
                    {et.name} <span className="text-[10px] text-gray-400">({et.default_max_marks})</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((st, idx) => (
                <tr key={st.student_id} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-800">{st.roll_no}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{st.enrollment_no}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{st.student_name}</td>
                  {examTypes.map(et => {
                    const m = st.marks[et.code];
                    if (!m || m.marks === null) {
                      return <td key={et.id} className="px-3 py-3 text-right text-gray-300 font-mono">—</td>;
                    }
                    if (m.isAbsent) {
                      return <td key={et.id} className="px-3 py-3 text-right font-mono text-red-600 font-bold">AB</td>;
                    }
                    return (
                      <td key={et.id} className="px-3 py-3 text-right font-mono font-semibold text-gray-800">
                        {m.marks}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={st.overall_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
