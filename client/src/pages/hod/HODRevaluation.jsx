import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function HODRevaluation() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/hod/revaluation')
      .then(res => setRequests(res.data.requests || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = { pending: 'Pending', under_review: 'Under review', marks_updated: 'Marks updated', resolved: 'Resolved', rejected: 'Rejected' };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">Revaluation Requests</h1>
        <p className="text-sm text-draft mt-0.5">
          All revaluation requests from students in your department.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-draft">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-draft font-medium">No revaluation requests.</p>
        </div>
      ) : (
        <div className="panel">
          <table className="result-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Subject</th>
                <th>Semester</th>
                <th>Faculty</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Student remark</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium">{r.student_name}</td>
                  <td className="font-mono text-xs">{r.roll_no}</td>
                  <td>{r.subject_name}<span className="ml-1 text-xs text-draft font-mono">{r.code}</span></td>
                  <td className="numeric">{r.semester}</td>
                  <td className="text-draft">{r.faculty_name || '—'}</td>
                  <td className="text-xs text-draft">{new Date(r.requested_at).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={`badge ${
                      r.status === 'resolved' || r.status === 'marks_updated' ? 'badge-published' :
                      r.status === 'under_review' ? 'badge-submitted' :
                      r.status === 'rejected' ? 'badge-fail' : 'badge-draft'
                    }`}>
                      {statusLabel[r.status] || r.status}
                    </span>
                  </td>
                  <td className="text-xs text-draft italic">{r.student_remark || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
