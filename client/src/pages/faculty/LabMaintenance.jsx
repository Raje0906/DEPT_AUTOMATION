import React, { useState } from 'react';
import toast from 'react-hot-toast';

const initialLabs = [
  {
    id: 'LAB-01',
    name: 'Advanced Computing & AI Lab',
    room: 'Room 301',
    systems: 45,
    os: 'Ubuntu 22.04 LTS / NVIDIA CUDA',
    inCharge: 'Prof. Rajan Mehta',
    status: 'Operational',
    lastServiced: '02 Mar 2025',
    nextAudit: '15 Apr 2025',
  },
  {
    id: 'LAB-02',
    name: 'Software Engineering & Web Tech Lab',
    room: 'Room 302',
    systems: 40,
    os: 'Windows 11 Pro / VS Code Suite',
    inCharge: 'Prof. Sunita Patil',
    status: 'Operational',
    lastServiced: '25 Feb 2025',
    nextAudit: '20 Apr 2025',
  },
  {
    id: 'LAB-03',
    name: 'Database & Cloud Computing Lab',
    room: 'Room 304',
    systems: 42,
    os: 'CentOS Stream / PostgreSQL & Docker',
    inCharge: 'Prof. Arjun Sharma',
    status: 'Under Maintenance',
    issue: 'Server rack UPS replacement in progress',
    lastServiced: '05 Mar 2025',
    nextAudit: '10 Mar 2025',
  },
  {
    id: 'LAB-04',
    name: 'Network Security & Systems Lab',
    room: 'Room 305',
    systems: 38,
    os: 'Kali Linux & Cisco Packet Tracer',
    inCharge: 'Prof. Rajan Mehta',
    status: 'Operational',
    lastServiced: '18 Feb 2025',
    nextAudit: '25 Apr 2025',
  },
  {
    id: 'LAB-05',
    name: 'IoT & Embedded Systems Lab',
    room: 'Room 308',
    systems: 32,
    os: 'Raspberry Pi OS / Arduino IDE',
    inCharge: 'Prof. Sunita Patil',
    status: 'Operational',
    lastServiced: '10 Feb 2025',
    nextAudit: '30 Apr 2025',
  },
  {
    id: 'LAB-06',
    name: 'Project & PG Research Lab',
    room: 'Room 310',
    systems: 35,
    os: 'Dual Boot Linux/Windows 11',
    inCharge: 'Prof. Arjun Sharma',
    status: 'Routine Inspection',
    lastServiced: '01 Mar 2025',
    nextAudit: '12 Mar 2025',
  },
];

export default function LabMaintenance() {
  const [labs, setLabs] = useState(initialLabs);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [newLog, setNewLog] = useState({
    labId: 'LAB-01',
    type: 'Hardware Issue',
    description: '',
    urgency: 'Medium',
  });

  const filteredLabs = labs.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'operational') return l.status === 'Operational';
    if (filter === 'maintenance') return l.status === 'Under Maintenance' || l.status === 'Routine Inspection';
    return true;
  });

  const handleCreateLog = (e) => {
    e.preventDefault();
    if (!newLog.description.trim()) {
      toast.error('Please enter an issue description');
      return;
    }
    toast.success(`Maintenance ticket created for ${newLog.labId}`);
    setShowModal(false);
    setNewLog({ labId: 'LAB-01', type: 'Hardware Issue', description: '', urgency: 'Medium' });
  };

  const getStatusBadge = (status) => {
    if (status === 'Operational') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Operational
        </span>
      );
    }
    if (status === 'Under Maintenance') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          Under Maintenance
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        Routine Inspection
      </span>
    );
  };

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Lab Maintenance</h1>
          <p className="text-base text-draft mt-1 font-medium">
            Department of Computer Engineering · Equipment Calibration &amp; Service Logs
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary self-start sm:self-auto"
        >
          + Log Service / Issue
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Labs</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">6</p>
          <p className="text-xs text-pass mt-1 font-medium">All department sanctioned</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Workstations</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">232</p>
          <p className="text-xs text-draft mt-1 font-medium">98.2% functional</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Under Repair</p>
          <p className="font-serif text-3xl font-bold text-[#8B3A3A] mt-1">1</p>
          <p className="text-xs text-draft mt-1 font-medium">Lab 3 (UPS Rack)</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Next Audit</p>
          <p className="font-serif text-2xl font-bold text-navy mt-2">12 Mar 2025</p>
          <p className="text-xs text-draft mt-1 font-medium">Internal review team</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            filter === 'all'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          All Labs ({labs.length})
        </button>
        <button
          onClick={() => setFilter('operational')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            filter === 'operational'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Operational (4)
        </button>
        <button
          onClick={() => setFilter('maintenance')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
            filter === 'maintenance'
              ? 'bg-navy text-white'
              : 'bg-white border border-rule text-ink hover:bg-paper'
          }`}
        >
          Maintenance / Inspection (2)
        </button>
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-header flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Department Laboratory Directory</h2>
          <span className="text-xs font-medium text-draft bg-gray-100 px-2.5 py-1 rounded">
            AY 2024–25 Term II
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="result-table">
            <thead>
              <tr>
                <th>Lab ID</th>
                <th>Lab Name &amp; Room</th>
                <th className="numeric">Systems</th>
                <th>Environment / OS</th>
                <th>Faculty In-Charge</th>
                <th>Status</th>
                <th>Last Inspection</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLabs.map((lab) => (
                <tr key={lab.id}>
                  <td className="font-mono text-sm font-bold text-navy">{lab.id}</td>
                  <td>
                    <div className="font-semibold text-ink text-base">{lab.name}</div>
                    <div className="text-xs text-draft font-mono">{lab.room}</div>
                  </td>
                  <td className="numeric font-semibold text-base">{lab.systems}</td>
                  <td className="text-xs text-draft font-mono max-w-[200px] truncate">
                    {lab.os}
                  </td>
                  <td className="font-medium text-sm text-ink">{lab.inCharge}</td>
                  <td>{getStatusBadge(lab.status)}</td>
                  <td className="text-xs font-mono text-draft">{lab.lastServiced}</td>
                  <td className="text-right">
                    <button
                      onClick={() => toast.success(`Viewing log history for ${lab.name}`)}
                      className="inline-flex items-center px-3 py-1 border border-rule hover:bg-gray-100 text-ink text-xs font-medium rounded transition-colors"
                    >
                      View Log
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm border border-rule max-w-md w-full p-6 shadow-xl animate-fade-in">
            <h3 className="font-serif text-xl font-bold text-ink mb-4">Log Maintenance / Issue</h3>
            <form onSubmit={handleCreateLog} className="space-y-4">
              <div>
                <label className="input-label">Select Laboratory</label>
                <select
                  value={newLog.labId}
                  onChange={(e) => setNewLog({ ...newLog, labId: e.target.value })}
                  className="input-field"
                >
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} — {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Issue Category</label>
                <select
                  value={newLog.type}
                  onChange={(e) => setNewLog({ ...newLog, type: e.target.value })}
                  className="input-field"
                >
                  <option>Hardware Breakdown / Peripheral</option>
                  <option>OS / Software License Update</option>
                  <option>Networking &amp; LAN Port</option>
                  <option>Power &amp; UPS Conditioning</option>
                  <option>Air Conditioning &amp; Facilities</option>
                </select>
              </div>

              <div>
                <label className="input-label">Severity Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Low', 'Medium', 'Critical'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setNewLog({ ...newLog, urgency: level })}
                      className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                        newLog.urgency === level
                          ? 'bg-maroon text-white border-maroon'
                          : 'bg-white border-rule text-ink hover:bg-paper'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label">Issue Details</label>
                <textarea
                  rows={3}
                  value={newLog.description}
                  onChange={(e) => setNewLog({ ...newLog, description: e.target.value })}
                  placeholder="Provide system numbers, error codes or replacement requirements..."
                  className="input-field"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-rule">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-rule rounded-sm text-xs font-medium text-draft hover:bg-paper transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
