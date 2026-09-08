import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function PublishResults() {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm]   = useState(false);
  const [target, setTarget]     = useState({ semester: '6', academicYear: '2024-25', division: 'A' });

  useEffect(() => {
    api.get('/hod/dashboard')
      .then(res => setDashData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await api.post('/hod/publish', {
        semester: parseInt(target.semester, 10),
        academicYear: target.academicYear,
        division: target.division,
        confirmPublish: true,
      });
      toast.success(res.data.message);
      setConfirm(false);
      const updated = await api.get('/hod/dashboard');
      setDashData(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-draft">Loading…</div>;

  const subjects = dashData?.subjects || [];

  // Check if all submitted/approved for the selected semester
  const targetSubjects = subjects.filter(s =>
    String(s.semester) === String(target.semester) && s.division === target.division
  );
  const allApproved = targetSubjects.length > 0 &&
    targetSubjects.every(s => s.status === 'approved' || s.status === 'published');
  const alreadyPublished = targetSubjects.every(s => s.status === 'published');

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 pb-4 border-b border-rule">
        <h1 className="font-serif text-2xl font-bold text-ink">Publish Results</h1>
        <p className="text-sm text-draft mt-0.5">
          Publishing results makes them visible to students. This action is irreversible — published results
          are frozen unless a formal correction workflow is used.
        </p>
      </div>

      {/* Target selection */}
      <div className="panel mb-6 p-5">
        <h2 className="font-serif text-base font-semibold mb-4">Select semester to publish</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="input-label">Semester</label>
            <select className="input-field" value={target.semester}
              onChange={e => setTarget(t => ({ ...t, semester: e.target.value }))}>
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Academic year</label>
            <select className="input-field" value={target.academicYear}
              onChange={e => setTarget(t => ({ ...t, academicYear: e.target.value }))}>
              {['2024-25','2023-24','2022-23'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Division</label>
            <select className="input-field" value={target.division}
              onChange={e => setTarget(t => ({ ...t, division: e.target.value }))}>
              {['A','B','C'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Status of selected semester */}
        {targetSubjects.length > 0 ? (
          <div className="space-y-2">
            {targetSubjects.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-rule last:border-0">
                <span>{s.subject_name}</span>
                <span className={`font-medium ${
                  s.status === 'approved'   ? 'text-navy' :
                  s.status === 'published'  ? 'text-pass' :
                  s.status === 'submitted'  ? 'text-pending' : 'text-fail'
                }`}>
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-draft">No subjects found for this selection.</p>
        )}
      </div>

      {/* Publish trigger */}
      {alreadyPublished ? (
        <div className="notification-strip border-pass bg-green-50">
          <span className="text-xs font-semibold text-pass uppercase tracking-wide mr-2">Published</span>
          Semester {target.semester} results for Division {target.division} have already been published.
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          disabled={!allApproved || publishing}
          className={`btn-primary w-full justify-center py-3 text-base ${!allApproved ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Publish Semester {target.semester} results for Division {target.division}
        </button>
      )}

      {!allApproved && !alreadyPublished && targetSubjects.length > 0 && (
        <p className="text-xs text-fail mt-2 text-center">
          All subjects must be approved before publishing.
          {targetSubjects.filter(s => s.status !== 'approved' && s.status !== 'published').length} subject(s) not yet approved.
        </p>
      )}

      {/* Publish confirmation modal — weighted, serious */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white border border-navy rounded-sm w-full max-w-lg mx-4 p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-navy flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                </svg>
              </div>
              <h2 className="font-serif text-xl font-bold text-ink">Confirm result publication</h2>
            </div>

            <p className="text-sm text-ink mb-2">
              You are about to publish <strong>Semester {target.semester}</strong> results for
              Division <strong>{target.division}</strong> ({target.academicYear}).
            </p>
            <ul className="text-sm text-ink space-y-1.5 mb-5 pl-4 list-disc">
              <li>All students will be able to see their marks immediately.</li>
              <li>All published marks will be frozen — no further edits by faculty.</li>
              <li>This action is logged and cannot be undone without a formal correction request.</li>
            </ul>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handlePublish} disabled={publishing} className="btn-primary">
                {publishing ? 'Publishing…' : 'Confirm — Publish results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
