import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const roleNav = {
  student: [
    { to: '/student',             label: 'Dashboard',        icon: '⊟' },
    { to: '/student/results',     label: 'Results',          icon: '≡' },
    { to: '/student/cgpa',        label: 'CGPA Overview',    icon: '◈' },
    { to: '/student/revaluation', label: 'Revaluation',      icon: '⟳' },
  ],
  faculty: [
    { to: '/faculty',             label: 'Dashboard',        icon: '⊟' },
    { to: '/faculty/subjects',    label: 'Result Generation', icon: '≡' },
    { to: '/faculty/revaluation', label: 'Revaluation Requests', icon: '⟳' },
    { to: '/faculty/reports',     label: 'Class Reports',    icon: '◈' },
    { to: '/faculty/lab-maintenance', label: 'Lab Maintainence', icon: '⚙' },
    { to: '/faculty/project-eval', label: 'Project Eval',     icon: '📋' },
    { to: '/faculty/magazines',   label: 'Magazines',        icon: '📚' },
  ],
  hod: [
    { to: '/hod',                 label: 'Dashboard',        icon: '⊟' },
    { to: '/hod/approval',        label: 'Mark Approval',    icon: '✓' },
    { to: '/hod/publish',         label: 'Publish Results',  icon: '◉' },
    { to: '/hod/analytics',       label: 'Analytics',        icon: '◈' },
    { to: '/hod/revaluation',     label: 'Revaluation',      icon: '⟳' },
    { to: '/hod/audit',           label: 'Audit Log',        icon: '◷' },
  ],
};

const roleLabels = { student: 'Student', faculty: 'Faculty', hod: 'Head of Department' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = roleNav[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-navy flex flex-col
          transform transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* College identity */}
        <div className="px-6 py-6 border-b border-white border-opacity-10">
          <p className="text-white text-base font-bold leading-snug font-serif tracking-wide">
            MES Wadia COE
          </p>
          <p className="text-blue-200 text-xs mt-1 font-medium tracking-wider uppercase">
            Computer Engineering
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/student' || item.to === '/faculty' || item.to === '/hod'}
              className={({ isActive }) =>
                `nav-link text-sm py-3 px-4 ${isActive ? 'active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <span className="text-lg w-6 text-center leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-6 py-5 border-t border-white border-opacity-10">
          <p className="text-white text-base font-semibold truncate">{user?.name}</p>
          <p className="text-blue-200 text-xs mt-0.5 font-medium">{roleLabels[user?.role]}</p>
          {user?.role === 'student' && (
            <p className="text-blue-300 text-xs mt-1 font-mono font-bold tracking-wider">{user?.roll_no}</p>
          )}
          {(user?.role === 'faculty' || user?.role === 'hod') && (
            <p className="text-blue-300 text-xs mt-1 font-mono font-bold tracking-wider">{user?.employee_id}</p>
          )}
          <button
            onClick={handleLogout}
            className="mt-3 text-xs text-blue-200 hover:text-white transition-colors underline underline-offset-2 font-medium"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-white border-b border-rule">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-sm hover:bg-paper transition-colors"
            aria-label="Open navigation"
          >
            <svg className="w-5 h-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif text-navy font-semibold text-sm">MES Wadia COE</span>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
