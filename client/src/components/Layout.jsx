import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Icons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  results: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  resultGen: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  reval: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  reports: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  lab: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
    </svg>
  ),
  project: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  magazines: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  cgpa: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.003 0H9.497m5.003 0a3.375 3.375 0 003.375-3.375V6.75A2.25 2.25 0 0015.625 4.5h-7.25A2.25 2.25 0 006.125 6.75v5.25a3.375 3.375 0 003.375 3.375z" />
    </svg>
  ),
  approval: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  publish: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.455a20.864 20.864 0 01-1.369-3.799m3.031-.42a20.865 20.865 0 002.39-7.92c.074-.593.58-.997 1.177-.997h1.492c.597 0 1.103.404 1.177.997a20.865 20.865 0 002.39 7.92m-7.236 0h7.236m0 0c-.253.962-.584 1.892-.985 2.783-.247.55-.06 1.21.463 1.511l.657.38c.551.318 1.26.117 1.527-.455a20.864 20.864 0 001.369-3.799" />
    </svg>
  ),
  analytics: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  audit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  seminar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  ),
  alumni: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  star: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  teachers: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

const roleNav = {
  student: [
    {
      group: 'Academic Records',
      items: [
        { to: '/student',             label: 'Dashboard',             icon: Icons.dashboard },
        { to: '/student/results',     label: 'Results & Marks',       icon: Icons.results },
        { to: '/student/cgpa',        label: 'CGPA Overview',         icon: Icons.cgpa },
        { to: '/student/revaluation', label: 'Revaluation Cell',      icon: Icons.reval },
        { to: '/student/project',     label: 'BE Capstone Project',   icon: Icons.project },
        { to: '/student/seminar',     label: 'TE Seminar Registration', icon: Icons.seminar },
      ],
    },
  ],
  faculty: [
    {
      group: 'Academics & Exams',
      items: [
        { to: '/faculty',             label: 'Dashboard',             icon: Icons.dashboard },
        { to: '/faculty/subjects',    label: 'Result Generation',     icon: Icons.resultGen },
        { to: '/faculty/reports',     label: 'Class Reports',         icon: Icons.reports },
        { to: '/faculty/revaluation', label: 'Revaluation Requests',  icon: Icons.reval },
      ],
    },
    {
      group: 'Department Administration',
      items: [
        { to: '/faculty/lab-maintenance', label: 'Lab Maintenance',      icon: Icons.lab },
        { to: '/faculty/project-eval',    label: 'Project Evaluation',   icon: Icons.project },
        { to: '/faculty/magazines',       label: 'Magazines & Research', icon: Icons.magazines },
        { to: '/faculty/seminar',         label: 'TE Seminar Tool',      icon: Icons.seminar },
        { to: '/faculty/seminar/my-groups', label: 'My Assigned Groups', icon: Icons.teachers },
      ],
    },
  ],
  hod: [
    {
      group: 'Department Governance',
      items: [
        { to: '/hod',                 label: 'Executive Dashboard',   icon: Icons.dashboard },
        { to: '/hod/teachers',        label: 'Faculty Allocation',    icon: Icons.teachers },
        { to: '/hod/projects',        label: 'BE Project Governance', icon: Icons.project },
        { to: '/hod/seminar',         label: 'TE Seminar Tool',       icon: Icons.seminar },
        { to: '/hod/approval',        label: 'Mark Approvals',        icon: Icons.approval },
        { to: '/hod/publish',         label: 'Publish Results',       icon: Icons.publish },
        { to: '/hod/analytics',       label: 'Academic Analytics',    icon: Icons.analytics },
      ],
    },
    {
      group: 'Compliance & Audit',
      items: [
        { to: '/hod/revaluation',     label: 'Revaluation Oversight', icon: Icons.reval },
        { to: '/hod/audit',           label: 'Audit Log & History',   icon: Icons.audit },
      ],
    },
  ],
};

const roleLabels = { student: 'Student', faculty: 'Faculty', hod: 'Head of Department' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alumniOpen, setAlumniOpen] = useState(false);

  const navGroups = roleNav[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-paper">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-[#141C38] flex flex-col border-r border-[#222E54]
          transform transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex
        `}
      >
        {/* Institutional header */}
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3 bg-[#0F162E]">
          <div className="w-9 h-9 rounded bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold tracking-tight font-serif uppercase leading-snug">
              MES Wadia COE
            </p>
            <p className="text-blue-300 text-[10px] font-semibold tracking-wider uppercase truncate">
              Computer Engineering
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {group.group && (
                <p className="px-3 pb-1 text-[10px] font-bold text-blue-300/60 uppercase tracking-widest">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/student' || item.to === '/faculty' || item.to === '/hod'}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-all duration-150 ${
                      isActive
                        ? 'bg-white/12 text-white font-semibold border-l-2 border-[#E5A93C] shadow-sm'
                        : 'text-blue-200/90 hover:text-white hover:bg-white/6'
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {/* ── Alumni Section (expandable, all roles) ─────────────────── */}
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-bold text-blue-300/60 uppercase tracking-widest">
              Alumni
            </p>
            {/* Section header toggle */}
            <button
              onClick={() => setAlumniOpen((o) => !o)}
              className="group w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-all duration-150 text-blue-200/90 hover:text-white hover:bg-white/6"
              aria-expanded={alumniOpen}
            >
              <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {Icons.alumni}
              </span>
              <span className="flex-1 text-left truncate">Alumni</span>
              <span
                className={`flex-shrink-0 transition-transform duration-200 ${
                  alumniOpen ? 'rotate-180' : ''
                }`}
              >
                {Icons.chevronDown}
              </span>
            </button>

            {/* Submenu */}
            {alumniOpen && (
              <div className="space-y-0.5 pl-4">
                <NavLink
                  to="/alumni/feedback"
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-all duration-150 ${
                      isActive
                        ? 'bg-white/12 text-white font-semibold border-l-2 border-[#E5A93C] shadow-sm'
                        : 'text-blue-200/90 hover:text-white hover:bg-white/6'
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {Icons.results}
                  </span>
                  <span className="truncate">Alumni</span>
                </NavLink>

                <NavLink
                  to="/alumni/distinguished"
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-all duration-150 ${
                      isActive
                        ? 'bg-white/12 text-white font-semibold border-l-2 border-[#E5A93C] shadow-sm'
                        : 'text-blue-200/90 hover:text-white hover:bg-white/6'
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    {Icons.star}
                  </span>
                  <span className="truncate">Distinguished Alumni</span>
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        {/* User Card */}
        <div className="p-3.5 border-t border-white/10 bg-[#0F162E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white/10 border border-white/15 flex items-center justify-center text-xs font-semibold text-white uppercase flex-shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate leading-snug">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-blue-300 text-[10px] font-medium">{roleLabels[user?.role]}</span>
                {(user?.employee_id || user?.roll_no) && (
                  <>
                    <span className="text-blue-400/50 text-[10px]">·</span>
                    <span className="text-blue-300 text-[10px] font-mono">{user?.employee_id || user?.roll_no}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-blue-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              {Icons.logout}
            </button>
          </div>
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
