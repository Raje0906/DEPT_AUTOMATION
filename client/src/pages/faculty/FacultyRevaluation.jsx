import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function FacultyRevaluation() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState(null);
  const [form, setForm]         = useState({ cie: '', practical: '', endSem: '', remark: '' });

  useEffect(() => {
    api.get('/faculty/revaluation')
      .then(res => setRequests(res.data.requests || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (reqId) => {
    if (!form.remark || form.remark.trim().length < 10) {
      toast.error('A detailed remark (at least 10 characters) is required.');
      return;
    }
    try {
      await api.post(`/faculty/revaluation/${reqId}/update`, {
        cie: Number(form.cie), practical: Number(form.practical), endSem: Number(form.endSem),
        remark: form.remark,
      });
      toast.success('Marks updated. Audit log recorded.');
      setUpdating(null);
      setForm({ cie: '', practical: '', endSem: '', remark: '' });
      const res = await api.get('/faculty/revaluation');
      setRequests(res.data.requests || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    }
  };

  if (loading) return <div className="p-8 text-sm text-draft">Loading…</div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">Revaluation Requests</h1>
        <p className="text-sm text-draft mt-0.5">
          Students requesting revaluation of marks in subjects assigned to you.
          Any mark change requires a mandatory remark and is fully audit-logged.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <p className="text-sm text-draft font-medium">No revaluation requests pending.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="panel">
              <div className="panel-header flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">
                    {r.student_name}
                    <span className="ml-2 font-mono text-xs text-draft">{r.roll_no}</span>
                  </p>
                  <p className="text-sm text-draft mt-0.5">
                    {r.subject_name} ({r.subject_code}) — Semester {r.semester}
                  </p>
                  {r.student_remark && (
                    <p className="text-xs text-draft mt-1 italic">"{r.student_remark}"</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-draft">Current</p>
                  <p className="font-bold text-lg text-ink">{r.current_total ?? '—'}</p>
                  <p className="text-xs text-draft">{r.current_grade ?? '—'}</p>
                </div>
              </div>

              {updating === r.id ? (
                <div className="p-5 border-t border-rule space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="input-label">CIE</label>
                      <input type="number" className="input-field" value={form.cie} onChange={e => setForm(f => ({ ...f, cie: e.target.value }))} />
                    </div>
                    <div>
                      <label className="input-label">Practical</label>
                      <input type="number" className="input-field" value={form.practical} onChange={e => setForm(f => ({ ...f, practical: e.target.value }))} />
                    </div>
                    <div>
                      <label className="input-label">End-Sem</label>
                      <input type="number" className="input-field" value={form.endSem} onChange={e => setForm(f => ({ ...f, endSem: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Remark (mandatory — will be recorded in audit log)</label>
                    <textarea
                      className="input-field resize-none"
                      rows={2}
                      value={form.remark}
                      onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
                      placeholder="Explain the reason for this mark change…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(r.id)} className="btn-primary">Update marks</button>
                    <button onClick={() => setUpdating(null)} className="btn-ghost">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-3 border-t border-rule flex items-center justify-between gap-4">
                  <span className={`badge ${
                    r.status === 'marks_updated' || r.status === 'resolved' ? 'badge-published' :
                    r.status === 'under_review' ? 'badge-submitted' : 'badge-draft'
                  }`}>
                    {r.status.replace('_', ' ')}
                  </span>
                  {r.status === 'pending' || r.status === 'under_review' ? (
                    <button
                      onClick={() => {
                        setUpdating(r.id);
                        setForm({ cie: r.current_total || '', practical: '', endSem: '', remark: '' });
                      }}
                      className="text-sm text-maroon hover:underline"
                    >
                      Update marks
                    </button>
                  ) : (
                    <span className="text-xs text-draft">No further action required</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
