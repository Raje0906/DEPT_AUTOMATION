import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const statusLabels = {
  pending:       'Pending HOD review',
  under_review:  'Under review',
  marks_updated: 'Marks updated',
  resolved:      'Resolved',
  rejected:      'Rejected',
};

export default function StudentRevaluation() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [applying, setApplying] = useState(false);

  // Form state
  const [form, setForm] = useState({ subjectId: '', semester: user?.current_semester || 6, academicYear: '2024-25', remark: '' });

  useEffect(() => {
    Promise.all([
      api.get('/student/revaluation'),
      api.get(`/student/results/${user?.current_semester || 6}`),
    ]).then(([revRes, resRes]) => {
      setRequests(revRes.data.requests || []);
      setResults(resRes.data.subjects || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.subjectId) { toast.error('Select a subject'); return; }
    if (!form.remark.trim()) { toast.error('A reason is required'); return; }
    setApplying(true);
    try {
      await api.post('/student/revaluation', {
        subjectId: parseInt(form.subjectId, 10),
        semester: form.semester,
        academicYear: form.academicYear,
        remark: form.remark,
      });
      toast.success('Revaluation request submitted.');
      const revRes = await api.get('/student/revaluation');
      setRequests(revRes.data.requests || []);
      setForm(f => ({ ...f, subjectId: '', remark: '' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-draft">Loading…</div>;

  const publishedSubjects = results.filter(s => s.status === 'published');

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">Revaluation Requests</h1>
        <p className="text-sm text-draft mt-0.5">
          Apply for revaluation on a published subject. Requests are reviewed by the HOD and then assigned to the concerned faculty.
        </p>
      </div>

      {/* Apply form */}
      <div className="panel mb-8">
        <div className="panel-header">
          <h2 className="font-serif text-base font-semibold">Apply for revaluation</h2>
        </div>
        <form onSubmit={handleApply} className="p-5 space-y-4">
          {publishedSubjects.length === 0 ? (
            <p className="text-sm text-draft">No published results available for revaluation at this time.</p>
          ) : (
            <>
              <div>
                <label className="input-label">Subject</label>
                <select
                  className="input-field"
                  value={form.subjectId}
                  onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                  required
                >
                  <option value="">— Select a subject —</option>
                  {publishedSubjects.map(s => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_name} ({s.subject_code}) — Grade: {s.grade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Reason for revaluation</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.remark}
                  onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                  placeholder="Describe the discrepancy or reason for requesting revaluation…"
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={applying}>
                {applying ? 'Submitting…' : 'Submit request'}
              </button>
            </>
          )}
        </form>
      </div>

      {/* Existing requests */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="font-serif text-base font-semibold">Your requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="empty-state py-10">
            <p className="text-sm text-draft">No revaluation requests submitted yet.</p>
          </div>
        ) : (
          <table className="result-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Semester</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Faculty remark</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="font-medium">{r.subject_name}</span>
                    <span className="ml-1 text-xs text-draft font-mono">{r.subject_code}</span>
                  </td>
                  <td>{r.semester}</td>
                  <td className="text-xs text-draft">{new Date(r.requested_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`badge ${
                      r.status === 'resolved'      ? 'badge-published' :
                      r.status === 'marks_updated' ? 'badge-approved' :
                      r.status === 'under_review'  ? 'badge-submitted' :
                      r.status === 'rejected'      ? 'badge-fail' : 'badge-draft'
                    }`}>
                      {statusLabels[r.status] || r.status}
                    </span>
                  </td>
                  <td className="text-xs text-draft">{r.faculty_remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
