import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function CoordinatorAssignment() {
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [data, setData] = useState({
    beCoordinator: null,
    teCoordinator: null,
    facultyList: [],
    history: [],
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [assignModal, setAssignModal] = useState(null); // 'BE_PROJECT_COORDINATOR' | 'TE_SEMINAR_COORDINATOR' | null
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCoordinators = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/coordinators?academic_year=${academicYear}`);
      setData(res.data);
      if (res.data.facultyList?.length > 0) {
        setSelectedFacultyId(String(res.data.facultyList[0].id));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load coordinator assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, [academicYear]);

  const handleOpenAssignModal = (roleType) => {
    setAssignModal(roleType);
    setAssignNotes('');
    const currentAppointee = roleType === 'BE_PROJECT_COORDINATOR' ? data.beCoordinator : data.teCoordinator;
    if (currentAppointee) {
      setSelectedFacultyId(String(currentAppointee.faculty_id));
    } else if (data.facultyList?.length > 0) {
      setSelectedFacultyId(String(data.facultyList[0].id));
    }
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      toast.error('Please select a faculty member');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/coordinators/assign', {
        facultyId: parseInt(selectedFacultyId, 10),
        roleType: assignModal,
        academicYear,
        notes: assignNotes.trim() || undefined,
      });
      toast.success(res.data.message || 'Coordinator assigned successfully');
      setAssignModal(null);
      await fetchCoordinators();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign coordinator');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (roleType, facultyName) => {
    const roleTitle = roleType === 'BE_PROJECT_COORDINATOR' ? 'BE Project Coordinator' : 'TE Seminar Coordinator';
    if (!window.confirm(`Are you sure you want to revoke the ${roleTitle} assignment for ${facultyName}?`)) return;

    setSubmitting(true);
    try {
      await api.post('/coordinators/remove', {
        roleType,
        academicYear,
      });
      toast.success(`${roleTitle} role revoked`);
      await fetchCoordinators();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke coordinator');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFaculty = (data.facultyList || []).filter((f) => {
    const query = searchTerm.toLowerCase();
    return (
      f.name?.toLowerCase().includes(query) ||
      f.email?.toLowerCase().includes(query) ||
      f.designation?.toLowerCase().includes(query) ||
      f.department?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-8 border-b border-rule">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-draft uppercase tracking-wider mb-1">
            <Link to="/hod/seminar-approvals" className="hover:text-navy transition-colors">TE Seminar Governance</Link>
            <span>/</span>
            <span className="text-ink font-semibold">Coordinator Assignment</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink">Academic Coordinator Governance</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Designate BE Project and TE Seminar coordinators per academic year with role scoping and audit tracking
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <label className="text-xs font-bold text-draft uppercase tracking-wider">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="input-field py-1.5 px-3 text-sm font-semibold bg-white border border-rule rounded shadow-sm"
          >
            <option value="2026-27">2026-27 (Current)</option>
            <option value="2025-26">2025-26</option>
            <option value="2024-25">2024-25</option>
          </select>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">BE Project Coordinator</p>
          <p className="font-serif text-lg font-bold text-navy mt-1 truncate">
            {data.beCoordinator ? data.beCoordinator.faculty_name : 'Unassigned'}
          </p>
          <p className="text-xs text-draft mt-1">
            {data.beCoordinator ? 'Active for AY ' + academicYear : 'Pending appointment'}
          </p>
        </div>

        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">TE Seminar Coordinator</p>
          <p className="font-serif text-lg font-bold text-navy mt-1 truncate">
            {data.teCoordinator ? data.teCoordinator.faculty_name : 'Unassigned'}
          </p>
          <p className="text-xs text-draft mt-1">
            {data.teCoordinator ? 'Active for AY ' + academicYear : 'Pending appointment'}
          </p>
        </div>

        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Department Faculty</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{data.facultyList?.length || 0}</p>
          <p className="text-xs text-draft mt-1">Eligible academic staff</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Tenure Logs</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">{data.history?.length || 0}</p>
          <p className="text-xs text-draft mt-1">Governance audit records</p>
        </div>
      </div>

      {/* Dual Role Appointment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* BE Project Coordinator Card */}
        <div className="panel p-6 border-t-4 border-t-navy flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-rule mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-navy/10 text-navy font-bold flex items-center justify-center text-lg">
                  BE
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">BE Project Coordinator</h2>
                  <p className="text-xs text-draft">Oversees Capstone Projects, Guide Allocations &amp; Final Defenses</p>
                </div>
              </div>
              <span className={`badge ${data.beCoordinator ? 'status-approved' : 'status-draft'}`}>
                {data.beCoordinator ? 'Assigned' : 'Vacant'}
              </span>
            </div>

            {data.beCoordinator ? (
              <div className="bg-paper p-4 rounded border border-rule/60 space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Appointed Faculty:</span>
                  <span className="text-sm font-bold text-ink">{data.beCoordinator.faculty_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Designation:</span>
                  <span className="text-xs text-ink">{data.beCoordinator.designation || 'Faculty'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Email:</span>
                  <span className="text-xs font-mono text-draft">{data.beCoordinator.faculty_email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Academic Year:</span>
                  <span className="badge bg-white border border-rule text-xs font-mono">{academicYear}</span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded text-center text-amber-800 text-sm mb-4">
                No BE Project Coordinator appointed for AY {academicYear}. Click below to designate an in-charge faculty.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
            {data.beCoordinator && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleRevoke('BE_PROJECT_COORDINATOR', data.beCoordinator.faculty_name)}
                className="btn-secondary text-xs text-fail border-fail/40 hover:bg-fail/10"
              >
                Revoke Role
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenAssignModal('BE_PROJECT_COORDINATOR')}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>+</span> {data.beCoordinator ? 'Reassign Coordinator' : 'Appoint Coordinator'}
            </button>
          </div>
        </div>

        {/* TE Seminar Coordinator Card */}
        <div className="panel p-6 border-t-4 border-t-accent flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-rule mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent font-bold flex items-center justify-center text-lg">
                  TE
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-ink">TE Seminar Coordinator</h2>
                  <p className="text-xs text-draft">Oversees Seminar Registration, Guide Allocations &amp; Evaluation Stages</p>
                </div>
              </div>
              <span className={`badge ${data.teCoordinator ? 'status-approved' : 'status-draft'}`}>
                {data.teCoordinator ? 'Assigned' : 'Vacant'}
              </span>
            </div>

            {data.teCoordinator ? (
              <div className="bg-paper p-4 rounded border border-rule/60 space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Appointed Faculty:</span>
                  <span className="text-sm font-bold text-ink">{data.teCoordinator.faculty_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Designation:</span>
                  <span className="text-xs text-ink">{data.teCoordinator.designation || 'Faculty'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Email:</span>
                  <span className="text-xs font-mono text-draft">{data.teCoordinator.faculty_email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-draft font-semibold uppercase">Academic Year:</span>
                  <span className="badge bg-white border border-rule text-xs font-mono">{academicYear}</span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/60 border border-amber-200/80 p-4 rounded text-center text-amber-800 text-sm mb-4">
                No TE Seminar Coordinator appointed for AY {academicYear}. Click below to designate an in-charge faculty.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
            {data.teCoordinator && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleRevoke('TE_SEMINAR_COORDINATOR', data.teCoordinator.faculty_name)}
                className="btn-secondary text-xs text-fail border-fail/40 hover:bg-fail/10"
              >
                Revoke Role
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenAssignModal('TE_SEMINAR_COORDINATOR')}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>+</span> {data.teCoordinator ? 'Reassign Coordinator' : 'Appoint Coordinator'}
            </button>
          </div>
        </div>
      </div>

      {/* Appointment History & Governance Audit Table */}
      <div className="panel p-6 mb-8">
        <div className="flex items-center justify-between pb-4 border-b border-rule mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-ink">Tenure History &amp; Governance Audit</h3>
            <p className="text-xs text-draft">Log of coordinator appointments and revocations for AY {academicYear}</p>
          </div>
          <span className="badge bg-paper border border-rule text-xs font-mono">
            {data.history?.length || 0} Records
          </span>
        </div>

        {data.history && data.history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="result-table w-full text-left">
              <thead>
                <tr>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Faculty Member</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Appointed By</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((record) => (
                  <tr key={record.id} className="hover:bg-paper/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-xs">
                      {record.role_type === 'BE_PROJECT_COORDINATOR' ? (
                        <span className="text-navy">BE Project Coordinator</span>
                      ) : (
                        <span className="text-accent">TE Seminar Coordinator</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-ink text-sm leading-tight">{record.faculty_name}</p>
                      <p className="text-xs text-draft font-mono">{record.faculty_email}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge ${record.is_active ? 'status-approved' : 'status-draft'}`}>
                        {record.is_active ? 'Active' : 'Superseded'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-draft">
                      {record.appointed_by_name || 'HOD'}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-draft">
                      {new Date(record.appointed_at || record.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-draft">
                      {record.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-draft italic py-4 text-center">No appointment logs found for AY {academicYear}.</p>
        )}
      </div>

      {/* Appointment Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="panel bg-white w-full max-w-lg shadow-2xl rounded border border-rule overflow-hidden">
            <div className="panel-header p-5 bg-paper border-b border-rule flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">
                  Appoint {assignModal === 'BE_PROJECT_COORDINATOR' ? 'BE Project Coordinator' : 'TE Seminar Coordinator'}
                </h3>
                <p className="text-xs text-draft mt-0.5">Select a faculty member for AY {academicYear}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="text-draft hover:text-ink text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-6 space-y-4">
              <div>
                <label className="input-label block text-xs font-bold uppercase tracking-wider text-draft mb-1.5">
                  Select Faculty Member <span className="text-fail">*</span>
                </label>
                <select
                  required
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(e.target.value)}
                  className="input-field w-full p-2.5 text-sm bg-white border border-rule rounded"
                >
                  <option value="" disabled>-- Select Faculty --</option>
                  {data.facultyList?.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.designation || 'Faculty'} · {fac.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label block text-xs font-bold uppercase tracking-wider text-draft mb-1.5">
                  Academic Year
                </label>
                <input
                  type="text"
                  disabled
                  value={academicYear}
                  className="input-field w-full p-2.5 text-sm bg-paper border border-rule rounded text-draft font-mono"
                />
              </div>

              <div>
                <label className="input-label block text-xs font-bold uppercase tracking-wider text-draft mb-1.5">
                  Appointment Notes / Justification
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Optional notes regarding this coordinator appointment…"
                  className="input-field w-full p-2.5 text-sm bg-white border border-rule rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs"
                >
                  {submitting ? 'Appointing…' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
