import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import ResultTable from '../../components/ResultTable';
import toast from 'react-hot-toast';

export default function MarksApproval() {
  const [searchParams] = useSearchParams();
  const subjectId  = searchParams.get('subjectId');
  const semester   = searchParams.get('sem') || '6';
  const academicYear = searchParams.get('ay') || '2024-25';

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showSendback, setShowSendback] = useState(false);
  const [processing, setProcessing] = useState(false);

  const load = () => {
    if (!subjectId) return;
    setLoading(true);
    api.get(`/hod/marks/${subjectId}?semester=${semester}&academicYear=${academicYear}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [subjectId, semester, academicYear]);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await api.post(`/hod/approve/${subjectId}`, { semester, academicYear });
      toast.success('Marks approved and locked.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendback = async () => {
    if (!comment || comment.trim().length < 10) {
      toast.error('Please provide a detailed comment before sending back.');
      return;
    }
    setProcessing(true);
    try {
      await api.post(`/hod/sendback/${subjectId}`, { semester, academicYear, comment });
      toast.success('Marks sent back to faculty for correction.');
      setShowSendback(false);
      setComment('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send back');
    } finally {
      setProcessing(false);
    }
  };

  if (!subjectId) {
    return (
      <div className="p-8">
        <p className="text-sm text-draft">Select a submitted subject from the dashboard to review.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 pb-4 border-b border-rule flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Mark Review</h1>
          <p className="text-sm text-draft mt-0.5">Semester {semester} · {academicYear}</p>
        </div>
        {data && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowSendback(true)}
              className="btn-secondary"
              disabled={processing}
            >
              Send back for correction
            </button>
            <button
              onClick={handleApprove}
              className="btn-primary"
              disabled={processing}
            >
              {processing ? 'Processing…' : 'Approve and lock marks'}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-draft">Loading marks…</p>}

      {data && (
        <>
          {/* Anomaly flags */}
          {data.anomalies?.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-pending uppercase tracking-wide">
                Anomalies detected — review before approving
              </p>
              {data.anomalies.map((a, i) => (
                <div key={i} className="anomaly-flag">
                  <svg className="w-4 h-4 text-pending flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  <div>
                    <span className="font-mono text-xs font-semibold mr-2">{a.rollNo}</span>
                    <span>{a.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Class stats */}
          <div className="flex gap-6 mb-4 text-sm">
            <span className="text-draft">Class average: <strong className="text-ink tabular-num">{data.classAverage}</strong></span>
            <span className="text-draft">Total students: <strong className="text-ink tabular-num">{data.marks?.length}</strong></span>
            <span className="text-draft">Pass: <strong className="text-pass">{data.marks?.filter(m => m.grade !== 'F').length}</strong></span>
            <span className="text-draft">Fail: <strong className="text-fail">{data.marks?.filter(m => m.grade === 'F').length}</strong></span>
          </div>

          {/* Marks table */}
          <div className="panel">
            <ResultTable subjects={data.marks?.map(m => ({
              ...m,
              subject_name: m.subject_name,
              subject_code: m.code,
            })) || []} showStatus />
          </div>
        </>
      )}

      {/* Send back modal */}
      {showSendback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white border border-rule rounded-sm w-full max-w-md mx-4 p-6">
            <h2 className="font-serif text-xl font-bold text-ink mb-2">Send back for correction</h2>
            <p className="text-sm text-draft mb-4">
              This will unlock the marks for the faculty to revise. A comment is mandatory.
            </p>
            <label className="input-label">Comment for faculty</label>
            <textarea
              className="input-field resize-none mb-4"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe what needs to be corrected…"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSendback(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSendback} disabled={processing} className="btn-danger">
                {processing ? 'Sending…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
