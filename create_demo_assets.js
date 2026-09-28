import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toppersDir = path.join(__dirname, 'client', 'public', 'images', 'toppers');
const assetsDir = path.join(__dirname, 'client', 'public', 'images', 'demo');

if (!fs.existsSync(toppersDir)) fs.mkdirSync(toppersDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// 27 distinct realistic student profiles for toppers
const studentProfiles = [
  // SE - Div A
  { id: 1, name: 'Aarav Kulkarni', gender: 'm', hair: '#2c221e', skin: '#e0a97a', bg1: '#3b82f6', bg2: '#1e3a8a', glasses: false, tie: true, shirt: '#ffffff' },
  { id: 2, name: 'Ananya Patil', gender: 'f', hair: '#1a110d', skin: '#e8b894', bg1: '#ec4899', bg2: '#831843', glasses: true, tie: false, shirt: '#fdf2f8' },
  { id: 3, name: 'Rohan Deshmukh', gender: 'm', hair: '#1f2937', skin: '#cf9260', bg1: '#06b6d4', bg2: '#0e7490', glasses: false, tie: true, shirt: '#f0fdfa' },
  // SE - Div B
  { id: 4, name: 'Siddhi Joshi', gender: 'f', hair: '#261c14', skin: '#f3c7a5', bg1: '#8b5cf6', bg2: '#4c1d95', glasses: false, tie: false, shirt: '#faf5ff' },
  { id: 5, name: 'Pranav Kadam', gender: 'm', hair: '#111827', skin: '#c88e63', bg1: '#10b981', bg2: '#064e3b', glasses: true, tie: true, shirt: '#ecfdf5' },
  { id: 6, name: 'Tanvi Shinde', gender: 'f', hair: '#1c1917', skin: '#eab897', bg1: '#f59e0b', bg2: '#78350f', glasses: false, tie: false, shirt: '#fffbeb' },
  // SE - Div C
  { id: 7, name: 'Aditya Bhosale', gender: 'm', hair: '#292524', skin: '#d49a6a', bg1: '#6366f1', bg2: '#312e81', glasses: false, tie: true, shirt: '#eef2ff' },
  { id: 8, name: 'Isha More', gender: 'f', hair: '#0f172a', skin: '#e2ac85', bg1: '#14b8a6', bg2: '#134e4a', glasses: true, tie: false, shirt: '#f0fdfa' },
  { id: 9, name: 'Varun Gaikwad', gender: 'm', hair: '#18181b', skin: '#c4895c', bg1: '#3b82f6', bg2: '#1d4ed8', glasses: false, tie: true, shirt: '#ffffff' },
  // TE - Div A
  { id: 10, name: 'Rhea Mehta', gender: 'f', hair: '#2a1b12', skin: '#f1be9b', bg1: '#f43f5e', bg2: '#881337', glasses: false, tie: false, shirt: '#fff1f2' },
  { id: 11, name: 'Kunal Sawant', gender: 'm', hair: '#172554', skin: '#cf9466', bg1: '#0284c7', bg2: '#075985', glasses: true, tie: true, shirt: '#f0f9ff' },
  { id: 12, name: 'Pooja Nair', gender: 'f', hair: '#1c1917', skin: '#e5b38e', bg1: '#a855f7', bg2: '#581c87', glasses: false, tie: false, shirt: '#fbfbfe' },
  // TE - Div B
  { id: 13, name: 'Omkar Gokhale', gender: 'm', hair: '#1e293b', skin: '#d99e71', bg1: '#059669', bg2: '#064e3b', glasses: false, tie: true, shirt: '#ffffff' },
  { id: 14, name: 'Gauri Chitale', gender: 'f', hair: '#171717', skin: '#f6cbab', bg1: '#ea580c', bg2: '#7c2d12', glasses: true, tie: false, shirt: '#fff7ed' },
  { id: 15, name: 'Siddharth Rao', gender: 'm', hair: '#09090b', skin: '#c88c5f', bg1: '#2563eb', bg2: '#1e3a8a', glasses: false, tie: true, shirt: '#eff6ff' },
  // TE - Div C
  { id: 16, name: 'Meera Iyer', gender: 'f', hair: '#1c1917', skin: '#e9b590', bg1: '#d946ef', bg2: '#701a75', glasses: false, tie: false, shirt: '#fdf4ff' },
  { id: 17, name: 'Tejas Salunkhe', gender: 'm', hair: '#27272a', skin: '#d3986b', bg1: '#0d9488', bg2: '#115e59', glasses: true, tie: true, shirt: '#f0fdf4' },
  { id: 18, name: 'Shreya Phadke', gender: 'f', hair: '#18181b', skin: '#f3c4a2', bg1: '#f97316', bg2: '#9a3412', glasses: false, tie: false, shirt: '#fff7ed' },
  // BE - Div A
  { id: 19, name: 'Vikramaditya Mane', gender: 'm', hair: '#0f172a', skin: '#cb9164', bg1: '#4338ca', bg2: '#1e1b4b', glasses: true, tie: true, shirt: '#ffffff' },
  { id: 20, name: 'Kavya Venkataraman', gender: 'f', hair: '#1c1917', skin: '#eab897', bg1: '#db2777', bg2: '#500724', glasses: false, tie: false, shirt: '#fdf2f8' },
  { id: 21, name: 'Yashwardhan Pawar', gender: 'm', hair: '#18181b', skin: '#d89e73', bg1: '#0891b2', bg2: '#155e75', glasses: false, tie: true, shirt: '#f0fdfa' },
  // BE - Div B
  { id: 22, name: 'Divya Tambe', gender: 'f', hair: '#261c14', skin: '#f1be9c', bg1: '#7c3aed', bg2: '#3b0764', glasses: true, tie: false, shirt: '#f5f3ff' },
  { id: 23, name: 'Atharva Pandit', gender: 'm', hair: '#09090b', skin: '#ca8e61', bg1: '#16a34a', bg2: '#14532d', glasses: false, tie: true, shirt: '#ffffff' },
  { id: 24, name: 'Neha Inamdar', gender: 'f', hair: '#1c1917', skin: '#e5b28d', bg1: '#0284c7', bg2: '#0c4a6e', glasses: false, tie: false, shirt: '#f0f9ff' },
  // BE - Div C
  { id: 25, name: 'Shubham Jagtap', gender: 'm', hair: '#1e293b', skin: '#d19669', bg1: '#e11d48', bg2: '#4c0519', glasses: true, tie: true, shirt: '#ffffff' },
  { id: 26, name: 'Rupali Jadhav', gender: 'f', hair: '#18181b', skin: '#f5cca9', bg1: '#9333ea', bg2: '#581c87', glasses: false, tie: false, shirt: '#faf5ff' },
  { id: 27, name: 'Harshwardhan Patil', gender: 'm', hair: '#0f172a', skin: '#c78a5e', bg1: '#059669', bg2: '#022c22', glasses: false, tie: true, shirt: '#ecfdf5' },
];

function generateStudentSvg(p) {
  const isFemale = p.gender === 'f';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <linearGradient id="bgGrad${p.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}" />
      <stop offset="100%" stop-color="${p.bg2}" />
    </linearGradient>
    <filter id="shadow${p.id}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="320" height="320" fill="url(#bgGrad${p.id})"/>
  <circle cx="280" cy="40" r="90" fill="white" opacity="0.08"/>
  <circle cx="40" cy="280" r="110" fill="white" opacity="0.05"/>

  <!-- Body / Shoulder -->
  <path d="M 60 320 Q 60 230 110 220 L 140 240 L 180 240 L 210 220 Q 260 230 260 320 Z" fill="${p.shirt}" filter="url(#shadow${p.id})"/>
  ${p.tie ? `
  <path d="M 152 235 L 168 235 L 164 300 L 160 315 L 156 300 Z" fill="#b91c1c"/>
  <polygon points="152,235 168,235 165,248 155,248" fill="#991b1b"/>
  ` : `
  <path d="M 130 220 Q 160 250 190 220" stroke="#cbd5e1" stroke-width="3" fill="none"/>
  `}

  <!-- Neck -->
  <rect x="142" y="170" width="36" height="50" fill="${p.skin}" rx="6"/>

  <!-- Face -->
  <ellipse cx="160" cy="140" rx="46" ry="54" fill="${p.skin}" filter="url(#shadow${p.id})"/>

  ${isFemale ? `
  <!-- Female Hair Behind -->
  <path d="M 104 130 Q 95 210 115 250 Q 125 210 120 160 Z" fill="${p.hair}"/>
  <path d="M 216 130 Q 225 210 205 250 Q 195 210 200 160 Z" fill="${p.hair}"/>
  <!-- Female Hair Top -->
  <path d="M 108 140 C 105 85 215 85 212 140 C 205 105 180 98 160 98 C 140 98 115 105 108 140 Z" fill="${p.hair}"/>
  ` : `
  <!-- Male Hair -->
  <path d="M 112 135 C 108 90 212 90 208 135 C 206 100 185 92 160 92 C 135 92 114 100 112 135 Z" fill="${p.hair}"/>
  `}

  <!-- Eyes -->
  <ellipse cx="143" cy="140" rx="5" ry="3.5" fill="#1e293b"/>
  <ellipse cx="177" cy="140" rx="5" ry="3.5" fill="#1e293b"/>
  <circle cx="144.5" cy="139" r="1.5" fill="white"/>
  <circle cx="178.5" cy="139" r="1.5" fill="white"/>

  <!-- Eyebrows -->
  <path d="M 134 131 Q 143 128 152 131" stroke="${p.hair}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M 168 131 Q 177 128 186 131" stroke="${p.hair}" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- Nose -->
  <path d="M 160 141 L 157 155 L 163 155" stroke="#9a3412" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.6"/>

  <!-- Smile -->
  <path d="M 148 167 Q 160 176 172 167" stroke="#991b1b" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  ${p.glasses ? `
  <!-- Glasses -->
  <rect x="131" y="132" width="24" height="17" rx="4" stroke="#0f172a" stroke-width="2.5" fill="rgba(255,255,255,0.15)"/>
  <rect x="165" y="132" width="24" height="17" rx="4" stroke="#0f172a" stroke-width="2.5" fill="rgba(255,255,255,0.15)"/>
  <line x1="155" y1="139" x2="165" y2="139" stroke="#0f172a" stroke-width="2.5"/>
  <line x1="131" y1="139" x2="120" y2="137" stroke="#0f172a" stroke-width="2"/>
  <line x1="189" y1="139" x2="200" y2="137" stroke="#0f172a" stroke-width="2"/>
  ` : ''}

  <!-- Rank / Student ID -->
  <g transform="translate(18, 18)">
    <rect width="64" height="22" rx="11" fill="rgba(0,0,0,0.35)"/>
    <text x="32" y="15" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">#${p.id}</text>
  </g>
</svg>`;
}

studentProfiles.forEach(p => {
  const filePath = path.join(toppersDir, `topper_${p.id}.svg`);
  fs.writeFileSync(filePath, generateStudentSvg(p), 'utf-8');
});
console.log('Generated 27 student topper SVGs');

// Generate themed SVG images for Events, Workshops, Lectures, Achievements, Staff, and CoE
const demoImages = [
  // Events
  { file: 'event-coding-week.svg', title: 'Coding Challenge Week', sub: 'Algorithmic Hackathon & Debug-a-thon', icon: '💻', color1: '#1e3a8a', color2: '#3b82f6' },
  { file: 'event-industry-day.svg', title: 'Industry Interaction Day', sub: 'Connecting Students with Tech Leaders', icon: '🤝', color1: '#065f46', color2: '#10b981' },
  { file: 'event-project-showcase.svg', title: 'Innovation & Project Showcase', sub: 'Final Year Capstone Demonstrations', icon: '🚀', color1: '#581c87', color2: '#8b5cf6' },
  { file: 'event-annual-day.svg', title: 'Annual Department Day', sub: 'Celebration of Excellence & Culture', icon: '🏆', color1: '#831843', color2: '#ec4899' },
  
  // Workshops
  { file: 'workshop-blockchain.svg', title: 'Blockchain Development', sub: 'Smart Contracts & Web3 on Ethereum', icon: '⛓️', color1: '#312e81', color2: '#6366f1' },
  { file: 'workshop-fullstack.svg', title: 'Full Stack Web Engineering', sub: 'React 19, Next.js & Microservices', icon: '🌐', color1: '#0e7490', color2: '#06b6d4' },
  { file: 'workshop-cybersecurity.svg', title: 'Cybersecurity & Ethical Hacking', sub: 'Vulnerability Assessment & Defense', icon: '🛡️', color1: '#881337', color2: '#e11d48' },

  // Guest Lectures
  { file: 'guest-lecture-blockchain.svg', title: 'Blockchain Beyond Crypto', sub: 'Enterprise Ledgers & Supply Chain', icon: '🔗', color1: '#1e1b4b', color2: '#4338ca' },
  { file: 'guest-lecture-careers.svg', title: 'Careers in Emerging Tech', sub: 'Roadmap for AI & Cloud Architecture', icon: '🧭', color1: '#0f766e', color2: '#14b8a6' },
  { file: 'guest-lecture-products.svg', title: 'Building Tech Products', sub: 'From Campus Ideas to Scale', icon: '💡', color1: '#78350f', color2: '#f59e0b' },

  // CoE (Centre of Excellence)
  { file: 'coe-vr-simulation.svg', title: 'Immersive VR Simulation', sub: 'HMD Spatial Interaction Lab', icon: '🥽', color1: '#1e293b', color2: '#3b82f6' },
  { file: 'coe-hardware-rig.svg', title: 'High-Compute AI Rig', sub: 'NVIDIA RTX Enterprise Clusters', icon: '⚡', color1: '#14532d', color2: '#22c55e' },
  { file: 'coe-industry-meta.svg', title: 'Meta & Unity Partner Hub', sub: 'Curriculum & Research Certification', icon: '🌐', color1: '#3b0764', color2: '#a855f7' },
  { file: 'coe-student-project.svg', title: 'Medical XR Holo-Surgical Tool', sub: 'Student Capstone Research Project', icon: '🩺', color1: '#0c4a6e', color2: '#0284c7' },

  // Student Achievements
  { file: 'achievement-icpc.svg', title: 'ACM ICPC Regional Finalists', sub: 'Rank 12 Nationwide - Team Turing', icon: '🥇', color1: '#7c2d12', color2: '#ea580c' },
  { file: 'achievement-imaginecup.svg', title: 'Microsoft Imagine Cup National', sub: 'National Top 5 Finalist Team', icon: '🌟', color1: '#1e3a8a', color2: '#2563eb' },
  { file: 'achievement-patent.svg', title: 'Student Patent Publication', sub: 'Autonomous Smart Irrigation System', icon: '📜', color1: '#134e4a', color2: '#0d9488' },
  { file: 'achievement-research.svg', title: 'Best Research Paper Award', sub: 'IEEE International Student Track', icon: '📑', color1: '#581c87', color2: '#9333ea' },
  { file: 'achievement-cyber.svg', title: 'National Cyber Shield CTF', sub: '1st Runner Up among 450 Teams', icon: '🛡️', color1: '#701a75', color2: '#c026d3' },
  { file: 'achievement-robotics.svg', title: 'IIT Bombay Techfest Robotics', sub: '2nd Place in Autonomous Navigation', icon: '🤖', color1: '#374151', color2: '#6b7280' },
  { file: 'achievement-sih.svg', title: 'Smart India Hackathon 2026', sub: 'Senior Winner - Ministry Problem', icon: '🏆', color1: '#064e3b', color2: '#059669' },
  { file: 'achievement-cloud.svg', title: 'AWS Certified Solutions Architect', sub: '100% Score - Professional Level', icon: '☁️', color1: '#78350f', color2: '#d97706' },
  { file: 'achievement-app.svg', title: 'Google Play Innovation Award', sub: '100k+ Downloads for Campus App', icon: '📱', color1: '#1e1b4b', color2: '#4f46e5' },

  // Staff Achievements
  { file: 'faculty-patent.svg', title: 'Granted Indian Patent', sub: 'Edge AI Architecture for Smart Grids', icon: '📜', color1: '#0f172a', color2: '#334155' },
  { file: 'faculty-ieee.svg', title: 'IEEE Senior Member Elevation', sub: 'Recognized for Technical Contributions', icon: '🏅', color1: '#1e3a8a', color2: '#1d4ed8' },
  { file: 'faculty-phd.svg', title: 'Ph.D. Degree Conferred', sub: 'Deep Learning for Medical Diagnosis', icon: '🎓', color1: '#701a75', color2: '#a21caf' },
  { file: 'faculty-grant.svg', title: 'AICTE RPS Research Grant', sub: '₹18.5 Lakhs for Edge Computing Lab', icon: '💰', color1: '#064e3b', color2: '#047857' },
  { file: 'faculty-nptel.svg', title: 'NPTEL Topper & Gold Medalist', sub: 'Cloud Computing & Distributed Systems', icon: '🥇', color1: '#78350f', color2: '#b45309' },
  { file: 'faculty-author.svg', title: 'Authored Springer Textbook', sub: 'Applied Natural Language Processing', icon: '📚', color1: '#312e81', color2: '#4338ca' },
  { file: 'faculty-keynote.svg', title: 'International Keynote Speaker', sub: 'ACM Cyber-Physical Systems Conf', icon: '🎤', color1: '#881337', color2: '#be123c' }
];

function generateBannerSvg(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="grad_${item.file.replace(/[^a-zA-Z0-9]/g, '_')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${item.color1}" />
      <stop offset="100%" stop-color="${item.color2}" />
    </linearGradient>
    <pattern id="grid_${item.file.replace(/[^a-zA-Z0-9]/g, '_')}" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="600" height="400" fill="url(#grad_${item.file.replace(/[^a-zA-Z0-9]/g, '_')})"/>
  <rect width="600" height="400" fill="url(#grid_${item.file.replace(/[^a-zA-Z0-9]/g, '_')})"/>
  
  <circle cx="500" cy="100" r="140" fill="white" opacity="0.05"/>
  <circle cx="80" cy="320" r="100" fill="white" opacity="0.04"/>

  <!-- Center Card -->
  <g transform="translate(40, 50)">
    <rect width="520" height="300" rx="16" fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
    <text x="260" y="90" font-size="54" text-anchor="middle">${item.icon}</text>
    <text x="260" y="160" fill="#ffffff" font-family="system-ui, sans-serif" font-size="22" font-weight="700" text-anchor="middle">${item.title}</text>
    <text x="260" y="195" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="14" font-weight="500" text-anchor="middle">${item.sub}</text>
    
    <rect x="200" y="225" width="120" height="30" rx="15" fill="rgba(255,255,255,0.15)"/>
    <text x="260" y="245" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="11" font-weight="600" text-anchor="middle">DEPARTMENT OF COMP</text>
  </g>
</svg>`;
}

demoImages.forEach(img => {
  const filePath = path.join(assetsDir, img.file);
  fs.writeFileSync(filePath, generateBannerSvg(img), 'utf-8');
});
console.log(`Generated ${demoImages.length} demo SVG banner assets`);
