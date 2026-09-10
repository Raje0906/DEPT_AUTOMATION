import React, { useState, useRef } from 'react';

const AI_STEPS = [
  { id: 'upload',    label: 'Uploading' },
  { id: 'extract',   label: 'Extracting Text' },
  { id: 'identify',  label: 'Identifying Information' },
  { id: 'classify',  label: 'Classifying Content' },
  { id: 'photos',    label: 'Matching Photos' },
  { id: 'layout',    label: 'Generating Layout' },
  { id: 'ready',     label: 'Ready for Review' },
];

const SAMPLE_AI_RESULT = {
  section: 'Student Achievements',
  title: 'Smart India Hackathon 2026',
  date: '25 September 2026',
  description:
    'Team "Neural Nexus" from the Department of Computer Engineering secured Runner-up position at the national-level Smart India Hackathon 2026, organised by the Ministry of Education, Government of India. The team developed an AI-powered crop disease detection system achieving 94.7% accuracy.',
  photosFound: 4,
  records: [
    { name: 'Ketan Patil', class: 'BE II', achievement: 'Smart India Hackathon 2026', level: 'National', result: 'Runner-up', prize: '₹70,000' },
    { name: 'Priya Suryawanshi', class: 'BE II', achievement: 'Smart India Hackathon 2026', level: 'National', result: 'Runner-up', prize: '₹70,000' },
    { name: 'Rohit Marathe', class: 'BE II', achievement: 'Smart India Hackathon 2026', level: 'National', result: 'Runner-up', prize: '₹70,000' },
  ],
};

/**
 * AIPanel — right sidebar panel for AI Organize feature.
 * Shows file upload, processing animation, and extracted result.
 */
export default function AIPanel({ onAccept }) {
  const [phase, setPhase]         = useState('idle'); // idle | processing | result
  const [currentStep, setStep]    = useState(0);
  const [fileName, setFileName]   = useState('');
  const fileRef = useRef(null);

  const runProcessing = (name) => {
    setFileName(name);
    setPhase('processing');
    setStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setStep(step);
      if (step >= AI_STEPS.length - 1) {
        clearInterval(interval);
        setTimeout(() => setPhase('result'), 600);
      }
    }, 550);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) runProcessing(file.name);
  };

  const handleAccept = () => {
    onAccept?.(SAMPLE_AI_RESULT);
    setPhase('idle');
    setFileName('');
  };

  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-rule">
        <h3 className="text-xs font-bold text-navy uppercase tracking-widest">AI Organise</h3>
        <p className="text-xs text-draft mt-1">
          Upload a Word, PDF, or Excel file. AI will extract and classify the content automatically.
        </p>
      </div>

      {phase === 'idle' && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full btn-secondary text-xs py-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload Document
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls" className="hidden" onChange={handleFileChange} />

          {/* Demo trigger */}
          <button
            onClick={() => runProcessing('Smart India Hackathon Report.pdf')}
            className="w-full text-xs text-navy border border-rule rounded-sm py-2 hover:bg-paper transition-colors"
          >
            ▶ Run Demo Extract
          </button>

          <div className="border-t border-rule pt-3 space-y-2">
            <p className="text-[10px] font-bold text-draft uppercase tracking-wider">Accepted Formats</p>
            {['.pdf', '.docx', '.xlsx', '.jpg / .png (bulk)'].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-draft">
                <span className="w-1.5 h-1.5 rounded-full bg-rule flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'processing' && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-ink truncate mb-3">{fileName}</div>
          {AI_STEPS.map((step, idx) => {
            const done    = idx < currentStep;
            const active  = idx === currentStep;
            const pending = idx > currentStep;
            return (
              <div key={step.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-sm transition-colors ${active ? 'bg-blue-50' : ''}`}>
                <span className={`w-4 h-4 flex items-center justify-center flex-shrink-0 text-[10px] font-bold rounded-full ${
                  done    ? 'bg-pass text-white' :
                  active  ? 'border-2 border-navy text-navy animate-pulse' :
                  'border border-rule text-draft'
                }`}>
                  {done ? '✓' : idx + 1}
                </span>
                <span className={`text-xs ${active ? 'text-navy font-semibold' : done ? 'text-pass font-medium' : 'text-draft'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-pass text-xs font-semibold">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Analysis Complete
          </div>

          <div className="border border-rule rounded-sm p-3 space-y-2 text-xs">
            <div><span className="font-semibold text-ink">Uploaded:</span> <span className="text-draft">{fileName}</span></div>
            <div className="border-t border-rule pt-2">
              <p className="font-bold text-navy mb-1.5">AI Detected:</p>
              <div><span className="font-semibold">Section:</span> <span className="text-draft">{SAMPLE_AI_RESULT.section}</span></div>
              <div><span className="font-semibold">Title:</span> <span className="text-draft">{SAMPLE_AI_RESULT.title}</span></div>
              <div><span className="font-semibold">Date:</span> <span className="text-draft">{SAMPLE_AI_RESULT.date}</span></div>
              <div><span className="font-semibold">Photos:</span> <span className="text-draft">{SAMPLE_AI_RESULT.photosFound} relevant photos found</span></div>
              <div className="mt-1"><span className="font-semibold">Records:</span> <span className="text-draft">{SAMPLE_AI_RESULT.records.length} student records identified</span></div>
            </div>
          </div>

          <div className="bg-amber-50 border border-pending rounded-sm p-2.5 text-xs text-pending font-medium">
            ⚠ Review before accepting. AI does not publish automatically.
          </div>

          <div className="flex flex-col gap-1.5">
            <button onClick={handleAccept} className="btn-primary text-xs w-full justify-center py-2">
              Accept & Add to Section
            </button>
            <button
              onClick={() => setPhase('idle')}
              className="w-full text-xs text-draft border border-rule rounded-sm py-2 hover:bg-paper transition-colors"
            >
              Edit Manually
            </button>
            <button
              onClick={() => runProcessing(fileName)}
              className="w-full text-xs text-draft border border-rule rounded-sm py-2 hover:bg-paper transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
