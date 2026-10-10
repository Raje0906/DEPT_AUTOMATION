import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function ClubOfficeBearers({ user, academicYear, clubs = [], isClubHead = false, onRefresh }) {
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id || null);
  const [officeBearers, setOfficeBearers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assign modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRole, setAssignRole] = useState('President');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [saving, setSaving] = useState(false);

  // Update selected club if clubs list changes
  useEffect(() => {
    if (clubs.length > 0 && (!selectedClubId || !clubs.some(c => c.id === Number(selectedClubId)))) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs]);

  // Load office bearers when club or academic year changes
  const fetchOfficeBearers = async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      const res = await api.get(`/clubs/${selectedClubId}/office-bearers?academicYear=${academicYear}`);
      setOfficeBearers(res.data.officeBearers || []);
    } catch (err) {
      console.error('Failed to load office bearers:', err);
      toast.error('Failed to load club office bearers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficeBearers();
  }, [selectedClubId, academicYear]);

  const currentClub = clubs.find(c => c.id === Number(selectedClubId)) || clubs[0];
  const president = officeBearers.find(b => b.role === 'President');
  const vicePresident = officeBearers.find(b => b.role === 'Vice President');

  // Search students by name, roll no, or PRN
  const handleSearchStudents = async (query) => {
    setSearchQuery(query);
    if (!query || query.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/clubs/student-lookup?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(res.data.students || []);
    } catch (err) {
      console.error('Error searching students:', err);
    } finally {
      setSearching(false);
    }
  };

  // Open modal to assign or change role
  const handleOpenAssignModal = (role) => {
    setAssignRole(role);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedStudent(null);
    setAssignModalOpen(true);
  };

  // Check if selected student already holds the other role in this club
  const otherRole = assignRole === 'President' ? 'Vice President' : 'President';
  const otherOfficer = otherRole === 'President' ? president : vicePresident;
  const hasConflict = selectedStudent && otherOfficer && (
    Number(selectedStudent.id) === Number(otherOfficer.student_id) ||
    (selectedStudent.prn && otherOfficer.prn && selectedStudent.prn.trim().toUpperCase() === otherOfficer.prn.trim().toUpperCase())
  );

  // Submit assignment
  const handleSaveOfficeBearer = async (e) => {
    e.preventDefault();
    if (!selectedClubId) return;
    if (!selectedStudent) {
      toast.error('Please search and select a student from the list.');
      return;
    }
    if (hasConflict) {
      toast.error(`This student is already designated as ${otherRole} for this club. A student can hold only one office bearer role per club.`);
      return;
    }

    setSaving(true);
    try {
      const res = await api.post(`/clubs/${selectedClubId}/office-bearers`, {
        student_id: selectedStudent.id,
        role: assignRole,
        academic_year: academicYear,
      });
      toast.success(res.data.message || `${assignRole} assigned successfully!`);
      setAssignModalOpen(false);
      await fetchOfficeBearers();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error assigning office bearer:', err);
      toast.error(err.response?.data?.error || 'Failed to assign office bearer');
    } finally {
      setSaving(false);
    }
  };

  // Revoke office bearer role
  const handleRevoke = async (officer) => {
    if (!officer) return;
    const confirmed = window.confirm(
      `Are you sure you want to revoke the ${officer.role} role for ${officer.student_name}? This change takes effect immediately.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/clubs/${selectedClubId}/office-bearers/${officer.id}`);
      toast.success(res.data.message || `${officer.role} role revoked successfully.`);
      await fetchOfficeBearers();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error revoking role:', err);
      toast.error(err.response?.data?.error || 'Failed to revoke role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Club Selector */}
      <div className="panel p-6 border-l-4 border-l-[var(--navy)] bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#EEF0F7] text-[var(--navy)] border border-[#D5D9E8]">
                {currentClub?.code || 'CLUB'}
              </span>
              <span className="text-xs text-[var(--ink)]/60 font-medium">AY {academicYear}</span>
            </div>
            <h2 className="font-serif text-xl font-bold text-[var(--ink)]">
              Manage Club Office Bearers — {currentClub?.name || 'Assigned Club'}
            </h2>
            <p className="text-xs text-[var(--ink)]/60 mt-1 max-w-2xl">
              Designate one President and one Vice President for your club from the student directory. A student can hold only one office bearer role per club. Roles take effect immediately.
            </p>
          </div>

          {/* Club Switcher for Coordinators with multiple clubs */}
          {clubs.length > 1 && (
            <div className="shrink-0 flex items-center gap-2">
              <label htmlFor="club-selector" className="text-xs font-semibold text-[var(--ink)]/70">
                Select Club:
              </label>
              <select
                id="club-selector"
                value={selectedClubId || ''}
                onChange={(e) => setSelectedClubId(Number(e.target.value))}
                className="input-field text-xs py-1.5 px-3 font-semibold bg-white border border-[var(--rule)] rounded"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Office Bearers Status Grid */}
      {loading ? (
        <div className="panel p-8 text-center text-xs text-[var(--ink)]/60">
          Loading office bearer details...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* President Card */}
          <div className="panel p-6 bg-white border border-[var(--rule)] rounded-xl flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--navy)] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Office Bearer
                  </span>
                  <h3 className="text-lg font-serif font-bold text-[var(--ink)] mt-1.5">President</h3>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${
                    president
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {president ? 'Active' : 'Vacant'}
                </span>
              </div>

              {president ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--ink)]">{president.student_name}</p>
                    <p className="text-xs font-mono text-[var(--ink)]/70 mt-0.5">
                      PRN: <span className="font-bold text-[var(--ink)]">{president.prn || 'N/A'}</span>
                      {president.roll_no && <span className="ml-2">· Roll: {president.roll_no}</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Class & Div</span>
                      <span className="font-semibold text-[var(--ink)]">{president.division || 'TE-A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Appointed On</span>
                      <span className="text-[var(--ink)]/80 font-mono text-[11px]">
                        {president.assigned_at ? new Date(president.assigned_at).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                    {president.student_email && (
                      <div className="col-span-2 pt-1 border-t border-slate-200 truncate">
                        <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Email</span>
                        <span className="font-mono text-[11px] text-[var(--ink)]/80">{president.student_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[var(--ink)]/50">
                  <p className="font-medium">No President assigned yet for AY {academicYear}.</p>
                  <p className="text-[11px] text-[var(--ink)]/40 mt-1">
                    Assign a student to enable event hosting and club management.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-[var(--rule)] flex items-center justify-end gap-2">
              {president ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleRevoke(president)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                  >
                    Revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal('President')}
                    className="px-3.5 py-1.5 text-xs font-bold text-[var(--navy)] bg-white hover:bg-slate-50 border border-[var(--navy)]/30 rounded transition-colors shadow-xs"
                  >
                    Change President
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenAssignModal('President')}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy)]/90 rounded transition-colors shadow-xs"
                >
                  Assign President
                </button>
              )}
            </div>
          </div>

          {/* Vice President Card */}
          <div className="panel p-6 bg-white border border-[var(--rule)] rounded-xl flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--navy)] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Office Bearer
                  </span>
                  <h3 className="text-lg font-serif font-bold text-[var(--ink)] mt-1.5">Vice President</h3>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${
                    vicePresident
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {vicePresident ? 'Active' : 'Vacant'}
                </span>
              </div>

              {vicePresident ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--ink)]">{vicePresident.student_name}</p>
                    <p className="text-xs font-mono text-[var(--ink)]/70 mt-0.5">
                      PRN: <span className="font-bold text-[var(--ink)]">{vicePresident.prn || 'N/A'}</span>
                      {vicePresident.roll_no && <span className="ml-2">· Roll: {vicePresident.roll_no}</span>}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3 rounded border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Class & Div</span>
                      <span className="font-semibold text-[var(--ink)]">{vicePresident.division || 'TE-B'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Appointed On</span>
                      <span className="text-[var(--ink)]/80 font-mono text-[11px]">
                        {vicePresident.assigned_at ? new Date(vicePresident.assigned_at).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                    {vicePresident.student_email && (
                      <div className="col-span-2 pt-1 border-t border-slate-200 truncate">
                        <span className="text-[10px] uppercase font-semibold text-[var(--ink)]/50 block">Email</span>
                        <span className="font-mono text-[11px] text-[var(--ink)]/80">{vicePresident.student_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[var(--ink)]/50">
                  <p className="font-medium">No Vice President assigned yet for AY {academicYear}.</p>
                  <p className="text-[11px] text-[var(--ink)]/40 mt-1">
                    Assign a student to assist in club coordination and event hosting.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 mt-6 border-t border-[var(--rule)] flex items-center justify-end gap-2">
              {vicePresident ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleRevoke(vicePresident)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                  >
                    Revoke
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal('Vice President')}
                    className="px-3.5 py-1.5 text-xs font-bold text-[var(--navy)] bg-white hover:bg-slate-50 border border-[var(--navy)]/30 rounded transition-colors shadow-xs"
                  >
                    Change Vice President
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenAssignModal('Vice President')}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy)]/90 rounded transition-colors shadow-xs"
                >
                  Assign Vice President
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Search & Assign Student Office Bearer */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[var(--rule)] my-8">
            <div className="flex items-start justify-between pb-3 border-b border-[var(--rule)]">
              <div>
                <h3 className="font-serif text-lg font-bold text-[var(--ink)]">
                  Assign {assignRole} — {currentClub?.name}
                </h3>
                <p className="text-xs text-[var(--ink)]/60 mt-0.5">
                  Search student directory by Name, Roll Number, or PRN.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOfficeBearer} className="mt-4 space-y-4">
              {/* Search Field */}
              <div>
                <label htmlFor="student-search-input" className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Search Student Directory *
                </label>
                <div className="relative">
                  <input
                    id="student-search-input"
                    type="text"
                    placeholder="Type name, roll number, or PRN (e.g. Rutuja, 16, 72312829E)..."
                    value={searchQuery}
                    onChange={(e) => handleSearchStudents(e.target.value)}
                    className="w-full border border-[var(--rule)] rounded px-3 py-2 text-xs focus:outline-hidden focus:ring-1 focus:ring-[var(--navy)] bg-white"
                    autoFocus
                  />
                  {searching && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-[var(--ink)]/40 font-mono">
                      Searching...
                    </span>
                  )}
                </div>
              </div>

              {/* Search Results Dropdown List */}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-[var(--rule)] rounded divide-y divide-[var(--rule)] bg-slate-50">
                  {searchResults.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(st);
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-2.5 hover:bg-white text-xs transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-[var(--ink)] block">{st.student_name}</span>
                        <span className="text-[11px] text-[var(--ink)]/60 font-mono">
                          PRN: {st.prn} {st.roll_no ? `· Roll: ${st.roll_no}` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold bg-white border border-[var(--rule)] px-1.5 py-0.5 rounded text-[var(--ink)]/70">
                        {st.division || 'TE'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Student Card */}
              {selectedStudent && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-blue-900">Selected Candidate:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="text-[10px] text-red-600 hover:underline font-bold"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-bold text-[var(--ink)] text-sm">{selectedStudent.student_name}</p>
                  <p className="font-mono text-[11px] text-[var(--ink)]/80">
                    PRN: {selectedStudent.prn} {selectedStudent.roll_no && `· Roll: ${selectedStudent.roll_no}`} · Division: {selectedStudent.division || 'TE'}
                  </p>
                </div>
              )}

              {/* Validation Warning if candidate holds other role */}
              {hasConflict && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 space-y-1">
                  <p className="font-bold">Role Conflict Warning</p>
                  <p className="text-[11px] leading-relaxed">
                    This student is already designated as <strong>{otherRole}</strong> for {currentClub?.name}. A student can hold only one office bearer role per club. Please select another student.
                  </p>
                </div>
              )}

              {/* Form Buttons */}
              <div className="pt-3 border-t border-[var(--rule)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)]/70 hover:text-[var(--ink)] border border-[var(--rule)] rounded bg-white hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudent || hasConflict || saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--navy)] hover:bg-[var(--navy)]/90 rounded transition-colors disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : `Confirm & Assign as ${assignRole}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
