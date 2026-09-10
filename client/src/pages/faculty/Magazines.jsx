import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMagazine } from '../../contexts/MagazineContext';
import MagazineCard from '../../components/magazine/MagazineCard';
import { useAuth } from '../../contexts/AuthContext';

export default function MagazineDashboard() {
  const { magazines } = useMagazine();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');

  const FILTERS = ['All', 'Published', 'Draft', 'Under Review', 'Archived'];

  const filtered = filter === 'All' ? magazines : magazines.filter(m => m.status === filter);

  const published = magazines.filter(m => m.status === 'Published').length;
  const drafts    = magazines.filter(m => m.status === 'Draft' || m.status === 'Under Review').length;

  return (
    <div className="p-8 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8 pb-5 border-b border-rule flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-draft uppercase tracking-widest mb-1">Department Publications</p>
          <h1 className="font-serif text-3xl font-bold text-ink">College Magazine</h1>
          <p className="text-sm text-draft mt-1 font-medium">
            Manage previous issues and create a new magazine.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-shrink-0">
          <span className="text-xs text-draft hidden sm:block">
            Welcome, <span className="font-semibold text-ink">{user?.name}</span>
          </span>
          <button
            onClick={() => navigate('/faculty/magazines/create')}
            className="btn-primary self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create New Magazine
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Total Issues</p>
          <p className="font-serif text-3xl font-bold text-ink mt-1">{magazines.length}</p>
          <p className="text-xs text-draft mt-1 font-medium">All editions</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Published</p>
          <p className="font-serif text-3xl font-bold text-pass mt-1">{published}</p>
          <p className="text-xs text-pass mt-1 font-medium">Live on website</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">In Progress</p>
          <p className="font-serif text-3xl font-bold text-pending mt-1">{drafts}</p>
          <p className="text-xs text-pending mt-1 font-medium">Draft / Under review</p>
        </div>
        <div className="p-4 bg-white border border-rule rounded-sm">
          <p className="text-xs uppercase tracking-wider text-draft font-semibold">Latest Issue</p>
          <p className="font-serif text-xl font-bold text-navy mt-1">Issue 32</p>
          <p className="text-xs text-draft mt-1 font-medium">Reflection · 2025–26</p>
        </div>
      </div>

      {/* Primary action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div
          onClick={() => navigate('/faculty/magazines/create')}
          className="border-2 border-dashed border-navy rounded-sm p-6 flex items-center gap-5 cursor-pointer hover:bg-blue-50/30 transition-colors group"
        >
          <div className="w-12 h-12 rounded-sm bg-navy text-white flex items-center justify-center flex-shrink-0 group-hover:bg-[#162142] transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-navy">Create New Magazine</p>
            <p className="text-xs text-draft mt-0.5">Start a new edition of Reflection or any departmental publication.</p>
          </div>
        </div>

        <div
          onClick={() => document.getElementById('previous-issues')?.scrollIntoView({ behavior: 'smooth' })}
          className="border border-rule rounded-sm p-6 flex items-center gap-5 cursor-pointer hover:bg-paper transition-colors group bg-white"
        >
          <div className="w-12 h-12 rounded-sm bg-paper border border-rule text-navy flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-ink">Browse Previous Issues</p>
            <p className="text-xs text-draft mt-0.5">View, edit, or download previously published editions.</p>
          </div>
        </div>
      </div>

      {/* Previous Issues */}
      <div id="previous-issues">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-bold text-ink">Previous Issues</h2>
          {/* Filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${filter === f ? 'bg-navy text-white border-navy' : 'border-rule text-draft hover:border-navy'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <svg className="w-12 h-12 text-draft mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-sm font-medium text-draft">No magazines found for "{filter}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(magazine => (
              <MagazineCard
                key={magazine.id}
                magazine={magazine}
                onEdit={m => navigate(`/faculty/magazines/editor/${m.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
