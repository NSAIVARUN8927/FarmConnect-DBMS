import { useState, useMemo } from 'react';
import {
  Film, Folder, FileText, FileAudio, FileVideo, FileImage, File,
  Search, LayoutGrid, List, ChevronRight, Clock, HardDrive, Star,
  MoreHorizontal, Download, Share2, Lock, Users, Clapperboard,
  Music, Scissors, Palette, Sparkles, Package, X, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ───────────────────────────── DATA ─────────────────────────────

const PROJECTS = [
  { id: 'tqh', code: 'TQH', name: 'The Quiet Hours', status: 'In Post', color: '#d9a45b', files: 4812, size: '18.4 TB' },
  { id: 'srl', code: 'SRL', name: 'Saltwater Lullaby', status: 'Shooting', color: '#8aa399', files: 2103, size: '9.7 TB' },
  { id: 'nwd', code: 'NWD', name: 'Northward', status: 'Development', color: '#a3868f', files: 312, size: '64 GB' },
  { id: 'bfd', code: 'BFD', name: 'Birdfeeder (Short)', status: 'Delivered', color: '#7d8a9c', files: 1568, size: '4.2 TB' },
];

const DEPARTMENTS = [
  { id: 'all', label: 'All files', icon: Folder },
  { id: 'camera', label: 'Camera', icon: Clapperboard },
  { id: 'editorial', label: 'Editorial', icon: Scissors },
  { id: 'sound', label: 'Sound', icon: Music },
  { id: 'color', label: 'Color & VFX', icon: Palette },
  { id: 'delivery', label: 'Deliverables', icon: Package },
];

const FILES = [
  {
    id: 1, type: 'folder', name: '01_DAILIES', dept: 'camera', items: 1240, size: '11.2 TB',
    modified: 'Feb 12, 2025', owner: 'M. Okafor', starred: true,
  },
  {
    id: 2, type: 'folder', name: '02_EDITORIAL', dept: 'editorial', items: 384, size: '2.1 TB',
    modified: 'Yesterday', owner: 'J. Lindqvist', starred: true,
  },
  {
    id: 3, type: 'folder', name: '03_SOUND', dept: 'sound', items: 962, size: '840 GB',
    modified: '3 days ago', owner: 'R. Castellanos', starred: false,
  },
  {
    id: 4, type: 'folder', name: '04_COLOR_VFX', dept: 'color', items: 218, size: '3.6 TB',
    modified: 'Feb 18, 2025', owner: 'A. Whitfield', starred: false,
  },
  {
    id: 5, type: 'video', name: 'TQH_Cut_v08_DIRECTORS.mov', dept: 'editorial', size: '184.2 GB',
    modified: 'Today, 09:41', owner: 'J. Lindqvist', starred: true, locked: false,
    meta: { codec: 'ProRes 4444', res: '4096 × 2160', duration: '01:47:23:12', fps: '24 fps', reel: 'Assembly' },
  },
  {
    id: 6, type: 'video', name: 'A047_C012_0214_R3MX.braw', dept: 'camera', size: '42.7 GB',
    modified: 'Feb 14, 2025', owner: 'M. Okafor', starred: false, locked: true,
    meta: { codec: 'BRAW 5:1', res: '6048 × 3186', duration: '00:08:14:03', fps: '24 fps', reel: 'Roll A047 · Day 23' },
  },
  {
    id: 7, type: 'doc', name: 'TQH_Script_v12_SHOOTING_FINAL.pdf', dept: 'editorial', size: '2.4 MB',
    modified: 'Jan 30, 2025', owner: 'S. Marchetti', starred: true, locked: true,
    meta: { pages: '118 pages', rev: 'Salmon revision', draft: 'Shooting draft', dept: 'Production' },
  },
  {
    id: 8, type: 'audio', name: 'TQH_R3_DX_PREMIX_v3.wav', dept: 'sound', size: '6.8 GB',
    modified: '2 days ago', owner: 'R. Castellanos', starred: false, locked: false,
    meta: { codec: 'BWF 24-bit / 96 kHz', duration: '00:22:40:00', channels: '7.1 stems', reel: 'Reel 3' },
  },
  {
    id: 9, type: 'video', name: 'TQH_R5_VFX_0080_comp_v014.exr', dept: 'color', size: '31.1 GB',
    modified: 'Feb 19, 2025', owner: 'A. Whitfield', starred: false, locked: false,
    meta: { codec: 'EXR sequence', res: '4448 × 3096', duration: '00:00:08:16', fps: '24 fps', reel: 'Shot 0080 · Lighthouse int.' },
  },
  {
    id: 10, type: 'doc', name: 'Festival_Strategy_Cannes_Venice.docx', dept: 'delivery', size: '844 KB',
    modified: 'Feb 17, 2025', owner: 'P. Anand', starred: false, locked: true,
    meta: { pages: '14 pages', rev: 'Internal', draft: 'Confidential', dept: 'Distribution' },
  },
  {
    id: 11, type: 'image', name: 'TQH_KeyArt_Teaser_07_RGB.psd', dept: 'delivery', size: '1.9 GB',
    modified: 'Feb 11, 2025', owner: 'L. Dubois', starred: false, locked: false,
    meta: { codec: 'PSD · 16-bit', res: '8000 × 12000', dept: 'Marketing', reel: 'One-sheet teaser' },
  },
  {
    id: 12, type: 'video', name: 'TQH_DCP_4K_FTR_5.1_TEST.mxf', dept: 'delivery', size: '212.0 GB',
    modified: 'Feb 20, 2025', owner: 'J. Lindqvist', starred: false, locked: true,
    meta: { codec: 'JPEG2000 DCP', res: '3996 × 2160', duration: '01:47:23:12', fps: '24 fps', reel: 'Feature · Test wrap' },
  },
  {
    id: 13, type: 'audio', name: 'SCORE_Sketch_Lighthouse_Theme_v2.aif', dept: 'sound', size: '412 MB',
    modified: 'Feb 8, 2025', owner: 'E. Ashworth', starred: true, locked: false,
    meta: { codec: 'AIFF 24-bit / 48 kHz', duration: '00:04:51:00', channels: 'Stereo', reel: 'Cue 3M2' },
  },
  {
    id: 14, type: 'doc', name: 'TQH_PostSchedule_Q1_rev6.xlsx', dept: 'editorial', size: '128 KB',
    modified: '5 days ago', owner: 'P. Anand', starred: false, locked: false,
    meta: { pages: '4 sheets', rev: 'Rev 6', draft: 'Working', dept: 'Post supervision' },
  },
];

const TYPE_STYLES = {
  folder: { icon: Folder, tint: '#d9a45b', label: 'Folder' },
  video: { icon: FileVideo, tint: '#8aa399', label: 'Video' },
  audio: { icon: FileAudio, tint: '#a3868f', label: 'Audio' },
  doc: { icon: FileText, tint: '#7d8a9c', label: 'Document' },
  image: { icon: FileImage, tint: '#c2956e', label: 'Image' },
};

// ───────────────────────────── COMPONENT ─────────────────────────────

export default function App() {
  const [activeProject, setActiveProject] = useState('tqh');
  const [activeDept, setActiveDept] = useState('all');
  const [view, setView] = useState('list');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(5);

  const project = PROJECTS.find(p => p.id === activeProject);

  const visibleFiles = useMemo(() => {
    return FILES.filter(f =>
      (activeDept === 'all' || f.dept === activeDept) &&
      f.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [activeDept, query]);

  const selected = FILES.find(f => f.id === selectedId);

  return (
    <div className="fb-root min-h-screen w-full bg-[#0f0e0c] text-[#e8e2d6] flex flex-col" style={{ fontFamily: "'Söhne', 'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .fb-root { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Fraunces', serif; }
        .font-mono2 { font-family: 'IBM Plex Mono', monospace; }
        .fb-root ::-webkit-scrollbar { width: 10px; height: 10px; }
        .fb-root ::-webkit-scrollbar-track { background: transparent; }
        .fb-root ::-webkit-scrollbar-thumb { background: #2a2722; border-radius: 99px; border: 3px solid #0f0e0c; }
        .fb-root ::-webkit-scrollbar-thumb:hover { background: #3a362f; }
        .grain::after {
          content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 60; opacity: .035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .row-hover { transition: background .15s ease; }
        .row-hover:hover { background: #1a1813; }
        .preview-strip {
          background: repeating-linear-gradient(90deg, #181612 0 6px, #100f0c 6px 12px);
        }
      `}} />
      <div className="grain" />

      {/* ── TOP BAR ─────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-[#26231e] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[4px] bg-[#e8e2d6] flex items-center justify-center">
            <Film className="w-4 h-4 text-[#0f0e0c]" strokeWidth={2.2} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[17px] font-medium tracking-tight">Lanternhouse Films</span>
            <span className="font-mono2 text-[10px] uppercase tracking-[0.18em] text-[#6f6a5e]">Vault · v3.2</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 font-mono2 text-[11px] text-[#6f6a5e]">
            <HardDrive className="w-3.5 h-3.5" />
            <span>32.4 / 60 TB</span>
            <div className="w-24 h-[3px] bg-[#26231e] rounded-full overflow-hidden">
              <div className="h-full w-[54%] bg-[#d9a45b] rounded-full" />
            </div>
          </div>
          <div className="flex -space-x-2">
            {['photo-1531123897727-8f129e1688ce','photo-1506794778202-cad84cf45f1d','photo-1544005313-94ddf0286df2'].map((p,i) => (
              <img key={i} src={`https://images.unsplash.com/${p}?w=64&h=64&fit=crop&crop=faces`} alt="" className="w-7 h-7 rounded-full border-2 border-[#0f0e0c] object-cover" />
            ))}
            <div className="w-7 h-7 rounded-full border-2 border-[#0f0e0c] bg-[#26231e] flex items-center justify-center text-[10px] font-medium text-[#a39c8d]">+9</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* ── SIDEBAR ─────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-[#26231e] flex flex-col py-5 px-4 gap-7 overflow-y-auto">
          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#6f6a5e] mb-3 px-2">Productions</p>
            <div className="space-y-1">
              {PROJECTS.map(p => {
                const active = p.id === activeProject;
                return (
                  <button key={p.id} onClick={() => setActiveProject(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${active ? 'bg-[#1d1a15]' : 'hover:bg-[#161410]'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] truncate ${active ? 'text-[#e8e2d6] font-medium' : 'text-[#a39c8d]'}`}>{p.name}</p>
                        <p className="font-mono2 text-[10px] text-[#6f6a5e] mt-0.5">{p.code} · {p.status}</p>
                      </div>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-[#6f6a5e]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#6f6a5e] mb-3 px-2">Departments</p>
            <div className="space-y-0.5">
              {DEPARTMENTS.map(d => {
                const Icon = d.icon;
                const active = d.id === activeDept;
                return (
                  <button key={d.id} onClick={() => setActiveDept(d.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${active ? 'bg-[#d9a45b]/10 text-[#d9a45b]' : 'text-[#a39c8d] hover:bg-[#161410] hover:text-[#cfc8b8]'}`}>
                    <Icon className="w-4 h-4" strokeWidth={1.8} />
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto rounded-lg border border-[#26231e] bg-[#14120f] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#d9a45b]" />
              <p className="text-[12px] font-medium">Picture lock approaching</p>
            </div>
            <p className="text-[11px] leading-relaxed text-[#8a8375]">
              <span className="text-[#cfc8b8]">The Quiet Hours</span> locks Reel 3 on <span className="font-mono2 text-[#d9a45b]">Mar 04</span>. 11 shots awaiting VFX final.
            </p>
          </div>
        </aside>

        {/* ── MAIN ─────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col">

          {/* project header */}
          <div className="px-7 pt-7 pb-5">
            <div className="flex items-center gap-2 font-mono2 text-[11px] text-[#6f6a5e] mb-2">
              <span>Vault</span>
              <ChevronRight className="w-3 h-3" />
              <span>{project.code}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#a39c8d]">{DEPARTMENTS.find(d => d.id === activeDept).label}</span>
            </div>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 className="font-display text-[34px] leading-none font-medium tracking-tight">{project.name}</h1>
                <p className="font-mono2 text-[11px] text-[#6f6a5e] mt-2.5">
                  {project.files.toLocaleString()} files · {project.size} · status&nbsp;
                  <span className="text-[#d9a45b] uppercase tracking-wider">{project.status}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6a5e]" />
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this production…"
                    className="w-64 bg-[#16140f] border border-[#26231e] rounded-md pl-9 pr-3 py-2 text-[13px] placeholder:text-[#6f6a5e] outline-none focus:border-[#d9a45b]/50 transition-colors" />
                </div>
                <div className="flex border border-[#26231e] rounded-md overflow-hidden">
                  <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-[#26231e] text-[#e8e2d6]' : 'text-[#6f6a5e] hover:text-[#a39c8d]'}`}>
                    <List className="w-4 h-4" />
                  </button>
                  <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'bg-[#26231e] text-[#e8e2d6]' : 'text-[#6f6a5e] hover:text-[#a39c8d]'}`}>
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* file list / grid */}
          <div className="flex-1 overflow-y-auto px-7 pb-8">
            {view === 'list' ? (
              <div className="border border-[#26231e] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_110px_130px_140px_70px] gap-4 px-4 py-2.5 bg-[#14120f] border-b border-[#26231e] font-mono2 text-[10px] uppercase tracking-[0.15em] text-[#6f6a5e]">
                  <span>Name</span><span>Size</span><span>Modified</span><span>Owner</span><span></span>
                </div>
                {visibleFiles.map(f => {
                  const T = TYPE_STYLES[f.type];
                  const Icon = T.icon;
                  const isSel = f.id === selectedId;
                  return (
                    <button key={f.id} onClick={() => setSelectedId(f.id)}
                      className={`row-hover w-full grid grid-cols-[1fr_110px_130px_140px_70px] gap-4 items-center px-4 py-3 text-left border-b border-[#1c1a15] last:border-b-0 ${isSel ? 'bg-[#1f1b13]' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-[5px] flex items-center justify-center shrink-0" style={{ background: `${T.tint}1a` }}>
                          <Icon className="w-4 h-4" style={{ color: T.tint }} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-[13px] truncate ${isSel ? 'text-[#f2ecdf]' : 'text-[#d8d1c2]'} font-mono2`}>{f.name}</p>
                          <p className="text-[11px] text-[#6f6a5e] mt-0.5">{f.type === 'folder' ? `${f.items} items` : T.label}{f.locked && ' · locked'}</p>
                        </div>
                        {f.starred && <Star className="w-3.5 h-3.5 text-[#d9a45b] fill-[#d9a45b] shrink-0" />}
                      </div>
                      <span className="font-mono2 text-[12px] text-[#a39c8d]">{f.size}</span>
                      <span className="text-[12px] text-[#a39c8d]">{f.modified}</span>
                      <span className="text-[12px] text-[#a39c8d]">{f.owner}</span>
                      <div className="flex items-center justify-end gap-1 text-[#6f6a5e]">
                        {f.locked && <Lock className="w-3.5 h-3.5" />}
                        <MoreHorizontal className="w-4 h-4 hover:text-[#e8e2d6]" />
                      </div>
                    </button>
                  );
                })}
                {visibleFiles.length === 0 && (
                  <div className="py-16 text-center text-[#6f6a5e] text-[13px]">No files match “{query}” in this department.</div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleFiles.map(f => {
                  const T = TYPE_STYLES[f.type];
                  const Icon = T.icon;
                  const isSel = f.id === selectedId;
                  return (
                    <motion.button layout key={f.id} onClick={() => setSelectedId(f.id)}
                      className={`text-left rounded-lg border p-4 transition-colors ${isSel ? 'border-[#d9a45b]/60 bg-[#1f1b13]' : 'border-[#26231e] bg-[#14120f] hover:bg-[#1a1813]'}`}>
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${T.tint}1a` }}>
                          <Icon className="w-4.5 h-4.5" style={{ color: T.tint }} strokeWidth={1.8} />
                        </div>
                        {f.starred ? <Star className="w-3.5 h-3.5 text-[#d9a45b] fill-[#d9a45b]" /> : f.locked ? <Lock className="w-3.5 h-3.5 text-[#6f6a5e]" /> : null}
                      </div>
                      <p className="font-mono2 text-[12px] text-[#d8d1c2] truncate">{f.name}</p>
                      <p className="text-[11px] text-[#6f6a5e] mt-1.5">{f.size} · {f.modified}</p>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ── INSPECTOR ─────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="shrink-0 border-l border-[#26231e] overflow-hidden hidden lg:block">
              <div className="w-[320px] h-full flex flex-col overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#26231e]">
                  <span className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#6f6a5e]">Inspector</span>
                  <button onClick={() => setSelectedId(null)} className="text-[#6f6a5e] hover:text-[#e8e2d6]"><X className="w-4 h-4" /></button>
                </div>

                {/* preview */}
                <div className="px-5 pt-5">
                  <div className="preview-strip rounded-lg border border-[#26231e] aspect-video relative overflow-hidden flex items-center justify-center">
                    {selected.type === 'video' || selected.type === 'image' ? (
                      <>
                        <img src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=640&h=360&fit=crop" alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-60" style={{ filter: 'sepia(.3) contrast(1.05)' }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0c] via-transparent to-transparent" />
                        <div className="relative w-11 h-11 rounded-full bg-[#0f0e0c]/70 border border-[#e8e2d6]/30 flex items-center justify-center backdrop-blur-sm hover:scale-105 transition-transform cursor-pointer">
                          <Play className="w-4 h-4 ml-0.5 text-[#e8e2d6] fill-[#e8e2d6]" />
                        </div>
                        {selected.meta?.duration && (
                          <span className="absolute bottom-2 right-2 font-mono2 text-[10px] px-1.5 py-0.5 rounded bg-[#0f0e0c]/80 text-[#d9a45b]">{selected.meta.duration}</span>
                        )}
                      </>
                    ) : (
                      (() => { const Icon = TYPE_STYLES[selected.type].icon; return <Icon className="w-10 h-10 text-[#3a362f]" strokeWidth={1.4} />; })()
                    )}
                  </div>
                </div>

                <div className="px-5 py-5">
                  <p className="font-mono2 text-[13px] text-[#f2ecdf] break-all leading-relaxed">{selected.name}</p>
                  <p className="text-[11px] text-[#6f6a5e] mt-1">{TYPE_STYLES[selected.type].label} · {selected.size}</p>

                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md bg-[#e8e2d6] text-[#0f0e0c] text-[12px] font-medium hover:bg-[#d9a45b] transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[#33302a] text-[12px] text-[#cfc8b8] hover:border-[#d9a45b]/50 transition-colors">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* metadata */}
                <div className="px-5 pb-6 space-y-5">
                  {selected.meta && (
                    <div>
                      <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#6f6a5e] mb-3">Technical</p>
                      <dl className="space-y-2.5">
                        {Object.entries(selected.meta).map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4 text-[12px]">
                            <dt className="text-[#6f6a5e] capitalize">{k}</dt>
                            <dd className="font-mono2 text-[#cfc8b8] text-right">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  <div className="border-t border-[#26231e] pt-5">
                    <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#6f6a5e] mb-3">Activity</p>
                    <div className="space-y-3">
                      {[
                        { who: selected.owner, what: 'modified this file', when: selected.modified },
                        { who: 'P. Anand', what: 'added review note', when: 'Feb 16, 2025' },
                        { who: 'S. Marchetti', what: 'shared with post team', when: 'Feb 10, 2025' },
                      ].map((a, i) => (
                        <div key={i} className="flex gap-3 text-[12px]">
                          <Clock className="w-3.5 h-3.5 text-[#6f6a5e] mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[#cfc8b8]"><span className="font-medium">{a.who}</span> {a.what}</p>
                            <p className="text-[#6f6a5e] text-[11px] mt-0.5">{a.when}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#26231e] pt-5 flex items-center gap-2 text-[11px] text-[#6f6a5e]">
                    <Users className="w-3.5 h-3.5" />
                    Visible to Post & Editorial · {selected.locked ? 'download restricted' : 'open access'}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}