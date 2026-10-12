import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homePath = user?.role === 'hod' ? '/hod' : user?.role === 'faculty' ? '/faculty' : user?.role === 'student' ? '/student' : '/login';

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Banner */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-rule">
        <Link to={homePath} className="flex items-center gap-3 group" title="Return to Portal Home">
          <img
            src="/images/college-logo.jpg"
            alt="MES Wadia COE Logo"
            className="h-10 w-auto object-contain flex-shrink-0"
          />
          <div>
            <h1 className="text-sm font-bold text-navy uppercase tracking-tight group-hover:underline">
              MES Wadia College of Engineering
            </h1>
            <p className="text-xs text-slate-600 font-medium">Department of Computer Engineering</p>
          </div>
        </Link>
        <Link
          to={homePath}
          className="text-xs font-semibold text-navy hover:text-blue-900 border border-rule px-3 py-1.5 rounded bg-white hover:bg-slate-50 transition-colors shadow-2xs"
        >
          Portal Home
        </Link>
      </header>

      {/* Main Error Body */}
      <main className="max-w-xl w-full mx-auto my-12 bg-white border border-rule rounded shadow-xs p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 border border-rule text-navy mb-4 font-mono font-bold text-xl">
          404
        </div>
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-navy mb-2">
          Page Not Found / Resource Unavailable
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The requested institutional URL, marksheet record, or module does not exist or has been relocated in the ERP system.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 border border-rule text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded transition-colors shadow-2xs"
          >
            ← Previous Page
          </button>
          <Link
            to={homePath}
            className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-white bg-[#1E2D5A] hover:bg-[#141C38] rounded transition-colors shadow-2xs text-center"
          >
            Return to Dashboard
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500">
          Need academic assistance? Contact department office at{' '}
          <a href="tel:+912026163831" className="text-navy font-semibold underline">
            +91 (020) 2616-3831
          </a>{' '}
          or email{' '}
          <a href="mailto:info@coewadia.mespune.org" className="text-navy font-semibold underline">
            info@coewadia.mespune.org
          </a>.
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto pt-6 border-t border-rule text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Modern Education Society's Wadia College of Engineering, Pune. All rights reserved.
      </footer>
    </div>
  );
}
