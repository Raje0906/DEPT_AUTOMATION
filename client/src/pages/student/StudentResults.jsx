import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import ResultTable, { StatusBadge } from '../../components/ResultTable';
import SppuMarksheet from '../../components/SppuMarksheet';

export default function StudentResults() {
  const { user } = useAuth();
  // Default to Semester 5 (TE Semester 1 AY 2025-26)
  const [semester, setSemester] = useState(5);
  const [activeTab, setActiveTab] = useState('sppu'); // 'sppu' | 'final' | 'internal' | 'term_work' | 'university'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/student/results/${semester}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [semester]);

  const handleDownload = () => {
    window.print();
  };

  const isOtherSemester = semester !== 5 || data?.isOtherSemester;

  return (
    <div className="p-6 lg:p-10 w-full max-w-7xl mx-auto">
      {/* Printable Marksheet Container: Always active during window.print() */}
      <div className="hidden print:block w-full">
        <SppuMarksheet
          student={data?.student || user}
          subjects={data?.subjects || []}
          semester={semester}
          academicYear={data?.academicYear || '2025-26'}
          sgpa={data?.sgpa}
          published={data?.published}
        />
      </div>

      {/* Screen Interface: Hidden during print */}
      <div className="print:hidden">
        {/* Top Header & Semester Picker */}
        <div className="mb-8 pb-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-serif font-bold text-gray-900">Academic Results</h1>
              {data?.published && (
                <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-300">
                  Official SPPU Result
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              {data?.student?.name || user?.name} · PRN: <span className="font-mono text-gray-700">{data?.student?.enrollment_no || user?.enrollment_no}</span> · Division: <span className="font-bold text-gray-800">{data?.student?.division || user?.division}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 no-print">
            <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold whitespace-nowrap">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s} {s === 5 ? '(TE Sem 1 - 2025-26)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-indigo-900 text-white rounded-md text-sm font-semibold hover:bg-indigo-800 transition-colors shadow flex items-center gap-2"
            >
              <span>🖨️</span> Print Result
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 text-sm font-medium">Loading academic records...</div>
        ) : isOtherSemester ? (
          /* Empty / Zeroed View for non-TE Sem 1 */
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3 text-amber-900 text-sm">
              <span className="text-lg">ℹ️</span>
              <div>
                <strong>Semester {semester} Records:</strong> All marks and results are set to <strong>0</strong> (no data entered yet for this semester).
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">SGPA</span>
                <p className="text-2xl font-bold font-mono text-gray-400 mt-1">0.00</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Earned Credits</span>
                <p className="text-2xl font-bold font-mono text-gray-400 mt-1">0 / 22</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</span>
                <p className="text-sm font-semibold text-gray-500 mt-2">Not Entered</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-400">
              <p className="text-base font-semibold text-gray-600">No evaluation data entered yet for Semester {semester}</p>
              <p className="text-xs mt-1 text-gray-400">Please select Semester 5 (TE Sem 1 AY 2025-26) to view your imported results.</p>
            </div>
          </div>
        ) : (
          /* TE Semester 1 Results */
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">SGPA</span>
                <p className="text-3xl font-bold font-mono text-indigo-700 mt-1">
                  {data?.sgpa !== null ? Number(data?.sgpa).toFixed(2) : 'Pending'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Credits</span>
                <p className="text-3xl font-bold font-mono text-gray-800 mt-1">
                  {data?.totalCredits || 22}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Academic Year</span>
                <p className="text-lg font-bold text-gray-800 mt-2">{data?.academicYear}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Result Status</span>
                <div className="mt-2">
                  <StatusBadge status={data?.published ? 'published' : 'draft'} />
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 no-print">
              <nav className="flex flex-wrap gap-2 sm:space-x-4">
                <button
                  onClick={() => setActiveTab('sppu')}
                  className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'sppu'
                      ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/50 rounded-t'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🏛️ SPPU Marksheet View
                </button>
                <button
                  onClick={() => setActiveTab('final')}
                  className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'final'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🏆 Final Consolidated Breakdown
                </button>
                <button
                  onClick={() => setActiveTab('internal')}
                  className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'internal'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📝 Internal (UT1, UT2, Mock)
                </button>
                <button
                  onClick={() => setActiveTab('term_work')}
                  className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'term_work'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📊 Term Work Details
                </button>
                <button
                  onClick={() => setActiveTab('university')}
                  className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'university'
                      ? 'border-indigo-600 text-indigo-600 font-bold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  🏛️ University (Insem/Endsem)
                </button>
              </nav>
            </div>

            {/* Active Tab Content */}
            {activeTab === 'sppu' ? (
              <div className="py-2">
                <SppuMarksheet
                  student={data?.student || user}
                  subjects={data?.subjects || []}
                  semester={semester}
                  academicYear={data?.academicYear || '2025-26'}
                  sgpa={data?.sgpa}
                  published={data?.published}
                />
              </div>
            ) : (
              <ResultTable subjects={data?.subjects} mode={activeTab} showStatus={false} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
