/* global React, qrcode, Beer3DMini */
const { useMemo, useEffect, useRef } = React;

/* ---------- BeerTap wordmark ---------- */
function Wordmark({ size = 32, mono = false, tagline = false }) {
  const ink = mono ? '#F8F1E3' : '#F8F1E3';
  const accent = mono ? '#F8F1E3' : '#F5A623';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <Beer3DMini size={size * 1.1} beer={accent} beerDeep="#7E3A05" fillPct={92}/>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.95 }}>
        <span style={{
          fontFamily: 'Bricolage Grotesque, Geist, sans-serif',
          fontWeight: 800,
          fontSize: size,
          color: ink,
          letterSpacing: '-0.03em',
        }}>BeerTap</span>
        {tagline && (
          <span style={{
            fontFamily: 'Geist, sans-serif',
            fontSize: size * 0.30,
            color: 'rgba(248,241,227,0.55)',
            fontWeight: 500,
            marginTop: size * 0.08,
            letterSpacing: '0.01em',
          }}>The smart bar experience</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Real QR generator using qrcode-generator ---------- */
function QRImage({ value, size = 240, fg = '#0B0805', bg = '#FFFFFF', margin = 16, eyeColor }) {
  const svg = useMemo(() => {
    if (typeof qrcode === 'undefined') return null;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      const cell = (size - margin * 2) / count;
      const eye = eyeColor || fg;
      const eyeRegion = (r, c) =>
        (r < 7 && c < 7) ||
        (r < 7 && c >= count - 7) ||
        (r >= count - 7 && c < 7);
      const rects = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c) && !eyeRegion(r, c)) {
            rects.push(
              <rect
                key={`m-${r}-${c}`}
                x={margin + c * cell}
                y={margin + r * cell}
                width={cell + 0.4}
                height={cell + 0.4}
                fill={fg}
              />
            );
          }
        }
      }
      // Eye finders — rounded
      const eyes = [[0,0],[0,count-7],[count-7,0]].map(([r, c], i) => (
        <g key={`eye-${i}`}>
          <rect
            x={margin + c*cell} y={margin + r*cell}
            width={cell*7} height={cell*7} rx={cell*1.5}
            fill={eye}/>
          <rect
            x={margin + (c+1)*cell} y={margin + (r+1)*cell}
            width={cell*5} height={cell*5} rx={cell*1.2}
            fill={bg}/>
          <rect
            x={margin + (c+2)*cell} y={margin + (r+2)*cell}
            width={cell*3} height={cell*3} rx={cell*0.6}
            fill={eye}/>
        </g>
      ));
      return { rects, eyes };
    } catch (e) {
      console.warn('QR encode failed', e);
      return null;
    }
  }, [value, size, fg, bg, margin, eyeColor]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', borderRadius: 12 }}>
      <rect width={size} height={size} fill={bg}/>
      {svg && svg.rects}
      {svg && svg.eyes}
    </svg>
  );
}

/* ---------- Icons ---------- */
const Icon = {
  Bluetooth: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7l10 10-5 5V2l5 5L7 17"/>
    </svg>
  ),
  Check: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-12"/>
    </svg>
  ),
  X: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6l-12 12"/>
    </svg>
  ),
  Plus: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Chevron: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
         style={{ transform: p.dir==='left'?'rotate(180deg)':p.dir==='down'?'rotate(90deg)':p.dir==='up'?'rotate(-90deg)':'none' }}>
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  QR: (p) => (
    <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v1"/>
    </svg>
  ),
  Wallet: (p) => (
    <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2">
      <path d="M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7l2-3h13"/>
      <circle cx="17" cy="13" r="1.5" fill={p.color||'currentColor'} stroke="none"/>
    </svg>
  ),
  Clock: (p) => (
    <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
    </svg>
  ),
  Logout: (p) => (
    <svg width={p.size||18} height={p.size||18} viewBox="0 0 24 24" fill="none" stroke={p.color||'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>
    </svg>
  ),
  Spinner: (p) => (
    <svg width={p.size||18} height={p.size||18} viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={p.color||'currentColor'} strokeOpacity="0.2" strokeWidth="3"/>
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke={p.color||'currentColor'} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
};

/* ---------- Connection chip ---------- */
function ConnChip({ status, room, compact = false }) {
  const map = {
    online:     { lbl: 'En línea', cls: 'ok',   color: '#4ADE80' },
    connecting: { lbl: 'Conectando…', cls: '',  color: '#F5A623' },
    offline:    { lbl: 'Offline',     cls: 'err',color: '#F87171' },
  };
  const s = map[status] || map.offline;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: compact ? '4px 8px' : '6px 12px',
      background: 'rgba(255,248,231,0.04)',
      border: '1px solid rgba(255,248,231,0.08)',
      borderRadius: 999, fontSize: compact ? 10 : 12,
      color: 'rgba(248,241,227,0.85)', fontFamily: 'Geist, sans-serif', fontWeight: 500,
    }}>
      <span className={'conn-dot ' + s.cls} style={{ color: s.color }}/>
      <span>{s.lbl}</span>
      {!compact && <span style={{ color: 'rgba(248,241,227,0.4)' }}>·</span>}
      {!compact && <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'rgba(248,241,227,0.5)' }}>{room}</span>}
    </div>
  );
}

Object.assign(window, { Wordmark, QRImage, Icon, ConnChip });
