/**
 * Ready-Made Magazine Design Templates Registry
 * Provides 5 distinct, professionally crafted academic magazine design templates.
 * 
 * 1. Modern Academic (Default / Recommended)
 * 2. Editorial
 * 3. Minimal
 * 4. Campus Creative
 * 5. Institutional Premium
 */

export const MAGAZINE_TEMPLATES = [
  {
    id: 'modern-academic',
    name: 'Modern Academic',
    tag: 'Recommended · Default',
    styleName: 'Clean + Sophisticated + Academic',
    description: 'Clean structured layouts with elegant typography, thin dividers, structured grids, and subtle college brand accents. Highly readable and print-perfect.',
    accentColor: '#1E2D5A',
    secondaryColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    fontHeading: 'font-serif',
    fontBody: 'font-sans',
    cardStyle: 'border border-slate-200 bg-white shadow-xs rounded-sm',
    headerDivider: 'border-b-2 border-[#1E2D5A]',
    badgeStyle: 'bg-blue-50 text-[#1E2D5A] border border-blue-200',
    topperRankStyle: {
      1: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
      2: 'bg-slate-100 text-slate-800 border-slate-300 font-bold',
      3: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
      other: 'bg-blue-50 text-[#1E2D5A] border-blue-200 font-semibold',
    },
    quoteStyle: 'border-l-2 border-[#1E2D5A] pl-4 italic text-slate-700 bg-slate-50/50 py-2',
    pageFrame: 'border-slate-100',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    tag: 'University Publication',
    styleName: 'Modern Editorial / Literary',
    description: 'Magazine-style editorial typography with prominent titles, asymmetric balanced layouts, large photography, pull quotes, and sophisticated whitespace.',
    accentColor: '#4A1525', // Deep Maroon / Burgundy editorial accent
    secondaryColor: '#F7F5F0', // Warm paper tint
    backgroundColor: '#FAF9F6',
    fontHeading: 'font-serif tracking-tight',
    fontBody: 'font-serif',
    cardStyle: 'border border-[#E5DFD5] bg-[#FAF8F5] rounded-none shadow-none',
    headerDivider: 'border-b border-[#4A1525]',
    badgeStyle: 'bg-[#F2ECE4] text-[#4A1525] border border-[#D5C7B8] font-serif',
    topperRankStyle: {
      1: 'bg-[#4A1525] text-white border-[#4A1525] font-extrabold',
      2: 'bg-[#7A283D] text-white border-[#7A283D] font-bold',
      3: 'bg-[#F2ECE4] text-[#4A1525] border-[#D5C7B8] font-bold',
      other: 'bg-white text-slate-800 border-[#E5DFD5] font-medium',
    },
    quoteStyle: 'border-l-4 border-[#4A1525] pl-5 italic text-slate-800 bg-[#F5EFEB] py-3 text-sm leading-relaxed',
    pageFrame: 'border-[#EAE3DA]',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    tag: 'Clean & Ultra-Refined',
    styleName: 'Minimalist & Air-Focused',
    description: 'Generous whitespace, ultra-fine hairline dividers, understated modern typography, and clean cards. Maximizes photography and clarity.',
    accentColor: '#0F172A', // Slate 900
    secondaryColor: '#F8FAFC',
    backgroundColor: '#FFFFFF',
    fontHeading: 'font-sans font-light tracking-wide',
    fontBody: 'font-sans',
    cardStyle: 'border border-slate-100 bg-slate-50/40 rounded-none hover:border-slate-300',
    headerDivider: 'border-b border-slate-200',
    badgeStyle: 'bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[9px]',
    topperRankStyle: {
      1: 'bg-slate-900 text-white border-slate-900 font-medium',
      2: 'bg-slate-200 text-slate-900 border-slate-300 font-medium',
      3: 'bg-slate-100 text-slate-800 border-slate-200 font-normal',
      other: 'bg-white text-slate-600 border-slate-100 font-normal',
    },
    quoteStyle: 'border-l border-slate-400 pl-4 text-slate-600 italic py-1.5',
    pageFrame: 'border-slate-50',
  },
  {
    id: 'campus-creative',
    name: 'Campus / Creative',
    tag: 'Dynamic & Engaging',
    styleName: 'Modern Student & Campus Life',
    description: 'Energetic yet officially academic. Strong image grids, geometric accents, modern section tags, dynamic layout flows, and vibrant color highlights.',
    accentColor: '#0284C7', // Vivid Ocean / Sky Blue
    secondaryColor: '#F0F9FF',
    backgroundColor: '#FFFFFF',
    fontHeading: 'font-sans font-extrabold tracking-tight',
    fontBody: 'font-sans',
    cardStyle: 'border border-sky-100 bg-gradient-to-b from-white to-sky-50/30 rounded-md shadow-xs',
    headerDivider: 'border-b-4 border-sky-600',
    badgeStyle: 'bg-sky-100 text-sky-800 border border-sky-200 rounded-full font-bold',
    topperRankStyle: {
      1: 'bg-amber-400 text-amber-950 border-amber-500 font-black shadow-xs',
      2: 'bg-sky-100 text-sky-900 border-sky-300 font-bold',
      3: 'bg-teal-50 text-teal-900 border-teal-200 font-bold',
      other: 'bg-slate-50 text-slate-700 border-slate-200 font-semibold',
    },
    quoteStyle: 'bg-sky-50 border-l-4 border-sky-500 p-3 rounded-r-md text-sky-950 font-medium',
    pageFrame: 'border-sky-100',
  },
  {
    id: 'institutional-premium',
    name: 'Institutional Premium',
    tag: 'Official Annual Edition',
    styleName: 'Formal & Prestigious University',
    description: 'Formal, authoritative university presentation. Refined dark/light contrast banners, institutional crest styling, double borders, and stately typography.',
    accentColor: '#1B365D', // Deep Royal Institutional Navy
    secondaryColor: '#D4AF37', // Academic Gold Accent
    backgroundColor: '#FFFFFF',
    fontHeading: 'font-serif font-bold uppercase tracking-wider',
    fontBody: 'font-serif',
    cardStyle: 'border-2 border-[#1B365D]/15 bg-[#FCFDFD] rounded-xs shadow-xs',
    headerDivider: 'border-b-2 border-[#1B365D] border-double',
    badgeStyle: 'bg-[#1B365D]/10 text-[#1B365D] border border-[#1B365D]/30 uppercase tracking-widest text-[8px]',
    topperRankStyle: {
      1: 'bg-[#D4AF37] text-[#1B365D] border-[#B89628] font-black',
      2: 'bg-slate-200 text-[#1B365D] border-slate-300 font-bold',
      3: 'bg-amber-50 text-[#856404] border-amber-200 font-bold',
      other: 'bg-blue-50/50 text-[#1B365D] border-[#1B365D]/20 font-semibold',
    },
    quoteStyle: 'border-y border-[#D4AF37]/50 py-2.5 px-3 text-center italic text-[#1B365D] font-serif bg-amber-50/20',
    pageFrame: 'border-[#1B365D]/20',
  },
];

/**
 * Returns template configuration by ID with fallback to 'modern-academic'.
 */
export function getTemplate(templateId) {
  if (!templateId) return MAGAZINE_TEMPLATES[0];
  const found = MAGAZINE_TEMPLATES.find(t => t.id === templateId);
  return found || MAGAZINE_TEMPLATES[0];
}
