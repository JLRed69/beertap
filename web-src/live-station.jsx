/* global React, useBus, jsQR, Beer3D, Beer3DMini, BEERS_LIVE, SIZES_LIVE,
   Wordmark, Icon, ConnChip, fmtMoney, findBeer */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

/* ============================================================
   StationApp — runs on the tap-mounted phone (Soyes A17 Mini)
   Phases: ad → scan → size → confirm → pour → done
   ============================================================ */
function StationApp({ room }) {
  const bus = useBus(room, 'station');
  const [phase, setPhase] = useState('ad');
  const [beerIdx, setBeerIdx] = useState(0);
  const [scannedUserId, setScannedUserId] = useState(null);
  const [chosenSize, setChosenSize] = useState(null);

  // ad carousel
  useEffect(() => {
    if (phase !== 'ad') return;
    const t = setInterval(() => setBeerIdx(i => (i + 1) % BEERS_LIVE.length), 4200);
    return () => clearInterval(t);
  }, [phase]);

  const beer = BEERS_LIVE[beerIdx];
  const me = scannedUserId ? bus.state.users[scannedUserId] : null;

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', maxWidth: 380, margin: '0 auto' }}
         className="bg-ambient-warm no-tap-highlight">
      {phase === 'ad' && (
        <AdView beer={beer} idx={beerIdx} onTap={() => setPhase('scan')} bus={bus}/>
      )}
      {phase === 'scan' && (
        <ScanView
          bus={bus}
          beer={beer}
          onCancel={() => setPhase('ad')}
          onUser={(uid) => { setScannedUserId(uid); setPhase('size'); }}
        />
      )}
      {phase === 'size' && me && (
        <SizeView
          beer={beer} user={me}
          onCancel={() => { setScannedUserId(null); setPhase('ad'); }}
          onSelect={(s) => { setChosenSize(s); setPhase('pour'); }}
        />
      )}
      {phase === 'pour' && me && chosenSize && (
        <PourView
          beer={beer} size={chosenSize} user={me}
          onDone={(servedMl) => {
            const ml = Math.min(chosenSize.ml, servedMl == null ? chosenSize.ml : Math.round(servedMl));
            const charge = Math.round(ml * beer.priceML);
            bus.dispatch({
              type: 'POUR', userId: me.id, amount: charge,
              beer: beer.id, sizeMl: ml, tap: 3,
            }, { by: 'station' });
            bus.sendPourCommand({ ml: chosenSize.ml, sessionId: Date.now() });
            setPhase('done');
          }}
        />
      )}
      {phase === 'done' && me && chosenSize && (
        <DoneView
          beer={beer} size={chosenSize} user={me} bus={bus}
          onTimeout={() => {
            setScannedUserId(null); setChosenSize(null); setPhase('ad');
          }}
        />
      )}
    </div>
  );
}

/* ---------- Status bar overlay ---------- */
function useBtState() {
  const [s, setS] = useState(window.__btState || null);
  useEffect(() => {
    const h = () => setS(window.__btState);
    window.addEventListener('beertap-bt', h);
    return () => window.removeEventListener('beertap-bt', h);
  }, []);
  return s;
}

function StationStatus({ bus, beerId, tapNo = 3 }) {
  const bt = useBtState();
  const btOk = bt && bt.indexOf('connected:') === 0;
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', whiteSpace: 'nowrap',
      fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'rgba(248,241,227,0.7)',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent)',
      zIndex: 5,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {window.BeerTapNative && <Icon.Bluetooth size={11} color={btOk ? '#4ADE80' : '#F87171'}/>}
        <span>TAP·0{tapNo} · {(beerId || '').toUpperCase()}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span className={'conn-dot ' + (bus.connStatus === 'online' ? 'ok' : bus.connStatus === 'offline' ? 'err' : '')}/>
        <span style={{ color: bus.connStatus === 'online' ? '#4ADE80' : '#F5A623' }}>{bus.room}</span>
        <span style={{ color: 'rgba(248,241,227,0.4)' }}>·</span>
        <span>{time}</span>
      </span>
    </div>
  );
}

/* ---------- AdView ---------- */
function AdView({ beer, idx, onTap, bus }) {
  return (
    <div onClick={onTap} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 16px 32px', cursor: 'pointer',
    }}>
      <StationStatus bus={bus} beerId={beer.id}/>

      <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(248,241,227,0.4)', letterSpacing: '0.2em', whiteSpace: 'nowrap' }}>
        TAP 03 · EN BARRA
      </div>
      <div style={{ marginTop: 6, fontFamily: 'Geist', fontSize: 10, color: '#F5A623', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {beer.style}
      </div>
      <div key={beer.id} className="display anim-fadeup" style={{
        fontSize: 28, lineHeight: 0.95, color: '#F8F1E3', textAlign: 'center',
        margin: '4px 4px 0', padding: '0 8px', fontStyle: 'normal',
        whiteSpace: 'nowrap',
      }}>{beer.name}</div>

      <div style={{ marginTop: 18 }}>
        <Beer3D
          width={180} height={290} fillPct={92}
          beer={beer.color} beerDeep={beer.colorDeep} foam={beer.foam}
        />
      </div>

      <div style={{
        marginTop: 14, display: 'flex', gap: 10,
        fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'rgba(248,241,227,0.6)',
      }}>
        <span><b style={{ color: '#F8F1E3' }}>{beer.abv.toFixed(1)}</b>% ABV</span>
        <span style={{ color: 'rgba(248,241,227,0.2)' }}>·</span>
        <span><b style={{ color: '#F8F1E3' }}>{beer.ibu}</b> IBU</span>
        <span style={{ color: 'rgba(248,241,227,0.2)' }}>·</span>
        <span>${beer.priceML.toFixed(2)}/ml</span>
      </div>
      <div style={{ marginTop: 6, fontFamily: 'Geist', fontSize: 12, color: 'rgba(248,241,227,0.7)', fontStyle: 'italic', textAlign: 'center' }}>
        {beer.notes}
      </div>

      {/* CTA */}
      <div className="anim-pulse" style={{
        marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '14px 22px', borderRadius: 999,
        background: 'linear-gradient(180deg, #FFC247, #C8821A)',
        color: '#1A130C', fontWeight: 800, fontSize: 14,
        boxShadow: '0 12px 30px rgba(245,166,35,0.4), inset 0 -2px 0 rgba(0,0,0,0.15)',
      }}>
        <Icon.QR size={16} color="#1A130C"/> TOCA PARA SERVIR
      </div>

      {/* carousel dots */}
      <div style={{ marginTop: 18, display: 'flex', gap: 6 }}>
        {BEERS_LIVE.map((_, i) => (
          <div key={i} style={{
            width: i === idx ? 18 : 6, height: 6, borderRadius: 999,
            background: i === idx ? '#F5A623' : 'rgba(248,241,227,0.18)',
            transition: 'all 260ms ease',
          }}/>
        ))}
      </div>
    </div>
  );
}

/* ---------- ScanView (camera + jsQR) ---------- */
function ScanView({ bus, beer, onCancel, onUser }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState(null);
  const [usingFakeScan, setUsingFakeScan] = useState(false);
  const [usersList, setUsersList] = useState([]);

  // Try to get a list of registered users (for fallback when camera not available)
  useEffect(() => {
    setUsersList(Object.values(bus.state.users));
  }, [bus.state.users]);

  // Try camera
  useEffect(() => {
    stoppedRef.current = false;
    let stream;
    (async () => {
      if (typeof jsQR === 'undefined') {
        setUsingFakeScan(true); return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
        if (stoppedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play().catch(()=>{});
        tick();
      } catch (e) {
        setError(e && e.message);
        setUsingFakeScan(true);
      }
    })();

    function tick() {
      if (stoppedRef.current) return;
      const v = videoRef.current, c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const w = v.videoWidth, h = v.videoHeight;
        if (w && h) {
          c.width = w; c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(v, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          const code = jsQR(data.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) {
            const m = /^beertap:([^:]+)(?::([^:]+))?$/.exec(code.data.trim());
            if (m) {
              const uid = m[1];
              if (bus.state.users[uid]) {
                stoppedRef.current = true;
                navigator.vibrate && navigator.vibrate(80);
                onUser(uid);
                return;
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [bus.state.users, onUser]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '36px 16px 20px' }}>
      <StationStatus bus={bus} beerId={beer.id}/>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(248,241,227,0.4)', letterSpacing: '0.2em', textAlign: 'center' }}>
        ESCANEAR QR
      </div>
      <div className="display" style={{ fontSize: 26, color: '#F8F1E3', textAlign: 'center', marginTop: 2, lineHeight: 1 }}>
        Acerca tu código
      </div>

      <div style={{
        position: 'relative', width: 220, height: 220, alignSelf: 'center', marginTop: 18,
        borderRadius: 18, overflow: 'hidden',
        background: '#000',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.7)',
      }}>
        {!usingFakeScan && (
          <video ref={videoRef} style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: 'scaleX(-1)', // mirror front cam
          }} muted/>
        )}
        {usingFakeScan && (
          <div style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(circle at 50% 40%, #1a2530, #0a0d10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(248,241,227,0.5)', fontFamily: 'Geist', fontSize: 12, textAlign: 'center',
            padding: 14,
          }}>
            {error ? 'Cámara no disponible' : 'Vista previa de cámara'}
            <br/><span style={{ fontSize: 10, color: 'rgba(248,241,227,0.3)' }}>{error || 'Usa el botón abajo para simular.'}</span>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }}/>
        {/* scan line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 32,
          background: 'linear-gradient(180deg, transparent, rgba(245,166,35,0.55), transparent)',
          animation: 'scanLine 1.8s ease-in-out infinite alternate', pointerEvents: 'none',
        }}/>
        {/* corner brackets */}
        {[
          { top: 8,  left: 8,   bw: '3px 0 0 3px', br: '8px 0 0 0' },
          { top: 8,  right: 8,  bw: '3px 3px 0 0', br: '0 8px 0 0' },
          { bottom: 8, left: 8, bw: '0 0 3px 3px', br: '0 0 0 8px' },
          { bottom: 8, right: 8,bw: '0 3px 3px 0', br: '0 0 8px 0' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', width: 30, height: 30,
            borderStyle: 'solid', borderColor: '#F5A623',
            borderWidth: s.bw, borderRadius: s.br, ...s,
          }}/>
        ))}
      </div>

      <div style={{
        marginTop: 14, textAlign: 'center',
        fontSize: 12, color: 'rgba(248,241,227,0.55)', lineHeight: 1.4,
      }}>
        Muestra el QR de tu app a la cámara
      </div>

      {/* Fallback: pick a user (when camera fails or for testing) */}
      {usersList.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(248,241,227,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
            {usingFakeScan ? 'Selecciona un usuario (demo)' : 'O selecciona manualmente'}
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 4px' }} className="scroll">
            {usersList.map(u => (
              <button key={u.id} onClick={() => onUser(u.id)} style={{
                flexShrink: 0,
                padding: '8px 12px',
                background: 'rgba(255,248,231,0.04)',
                border: '1px solid rgba(255,248,231,0.1)',
                color: '#F8F1E3',
                borderRadius: 999, cursor: 'pointer',
                fontFamily: 'Geist', fontSize: 12, fontWeight: 600,
              }}>{u.name.split(' ')[0]} · {fmtMoney(u.balance)}</button>
            ))}
          </div>
        </div>
      )}

      <button onClick={onCancel} className="btn-ghost" style={{ marginTop: 'auto' }}>
        Cancelar
      </button>
    </div>
  );
}

/* ---------- SizeView ---------- */
function SizeView({ beer, user, onCancel, onSelect }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '36px 14px 18px' }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(74,222,128,0.16), rgba(74,222,128,0.04))',
        border: '1px solid rgba(74,222,128,0.4)',
        borderRadius: 12, padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon.Check size={14} color="#4ADE80"/>
          <span style={{ fontFamily: 'Geist', fontSize: 13, fontWeight: 700, color: '#F8F1E3' }}>
            Hola, {user.name.split(' ')[0]}
          </span>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#F5A623', fontWeight: 700 }}>
          {fmtMoney(user.balance)}
        </span>
      </div>

      <div className="display anim-fadeup" style={{ fontSize: 28, color: '#F8F1E3', textAlign: 'center', marginTop: 14, lineHeight: 0.95 }}>
        Elige tu tamaño
      </div>
      <div style={{ fontFamily: 'Geist', fontSize: 12, color: 'rgba(248,241,227,0.6)', textAlign: 'center', marginTop: 2 }}>
        {beer.name}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16, alignItems: 'end', flex: 1 }}>
        {SIZES_LIVE.map(s => {
          const price = Math.round(s.ml * beer.priceML);
          const insufficient = price > user.balance;
          return (
            <button key={s.id}
              onClick={() => !insufficient && onSelect(s)}
              disabled={insufficient}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: 'rgba(255,248,231,0.025)',
                border: '1.5px solid rgba(255,248,231,0.08)',
                borderRadius: 14, padding: '10px 4px 8px',
                cursor: insufficient ? 'not-allowed' : 'pointer',
                opacity: insufficient ? 0.4 : 1,
                color: 'inherit', font: 'inherit',
                transition: 'all 200ms ease',
              }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', height: 130,
                transform: `scale(${s.scale})`, transformOrigin: 'center bottom',
              }}>
                <Beer3D width={68} height={108} fillPct={92}
                  beer={beer.color} beerDeep={beer.colorDeep} foam={beer.foam} bubbles={false} shadow={false}/>
              </div>
              <div className="display" style={{ fontSize: 14, color: '#F8F1E3', marginTop: 6 }}>{s.name}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(248,241,227,0.5)' }}>{s.ml} ml</div>
              <div style={{ fontFamily: 'Geist', fontWeight: 800, fontSize: 16, color: '#F5A623', marginTop: 3 }}>
                {fmtMoney(price)}
              </div>
              {insufficient && (
                <div style={{
                  position: 'absolute', top: 6, left: 4, right: 4,
                  background: 'rgba(248,113,113,0.18)', border: '1px solid rgba(248,113,113,0.5)',
                  borderRadius: 6, padding: '2px', fontSize: 9, fontWeight: 700, color: '#F87171',
                  textAlign: 'center', letterSpacing: '0.03em',
                }}>Saldo bajo</div>
              )}
            </button>
          );
        })}
      </div>

      <button onClick={onCancel} style={{
        background: 'transparent', border: 'none', color: 'rgba(248,241,227,0.5)',
        fontFamily: 'Geist', fontSize: 13, cursor: 'pointer', padding: 4, marginTop: 8,
      }}>← Cancelar</button>
    </div>
  );
}

/* ---------- PourView ---------- */
function PourView({ beer, size, user, onDone }) {
  const [poured, setPoured] = useState(0);
  const [hw, setHw] = useState(false);
  const [err, setErr] = useState(null);
  const speedMlPerSec = 110;
  useEffect(() => {
    const nat = window.BeerTapNative;
    if (nat && nat.isConnected()) {
      setHw(true);
      const sid = Math.floor(Date.now() / 1000) % 1000000;
      let finished = false;
      window.__btListener = (line) => {
        const p = String(line).split(':');
        if (p[0] === 'FLOW' && +p[1] === sid) setPoured(Math.min(size.ml, +p[2]));
        else if (p[0] === 'DONE' && +p[1] === sid && !finished) {
          finished = true;
          setPoured(Math.min(size.ml, +p[2]));
          setTimeout(() => onDone(+p[2]), 700);
        }
        else if (p[0] === 'NAK') setErr('El grifo rechazó la orden');
        else if (p[0] === 'STATE' && p[1] === 'disconnected' && !finished) setErr('Se perdió la conexión con el grifo');
      };
      if (!nat.send('POUR:' + size.ml + ':' + sid)) setErr('No se pudo enviar al grifo');
      return () => { window.__btListener = null; };
    }
    let t0 = performance.now(), raf;
    const tick = (t) => {
      const dt = (t - t0) / 1000;
      const ml = Math.min(size.ml, dt * speedMlPerSec);
      setPoured(ml);
      if (ml < size.ml) raf = requestAnimationFrame(tick);
      else setTimeout(() => onDone(size.ml), 700);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size.ml]);
  const pct = (poured / size.ml) * 100;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 12px 18px' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#F5A623', letterSpacing: '0.22em', fontWeight: 700, marginTop: 0 }}>
        SIRVIENDO
      </div>
      <div className="display" style={{ fontSize: 18, color: '#F8F1E3', textAlign: 'center', marginTop: 2 }}>
        {beer.name}
      </div>
      <div style={{ marginTop: 8 }}>
        <Beer3D width={170} height={270} fillPct={pct} beer={beer.color} beerDeep={beer.colorDeep} foam={beer.foam}/>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span className="display" style={{ fontSize: 44, color: '#F5A623', lineHeight: 1, fontFamily: 'Bricolage Grotesque' }}>
          {Math.round(poured)}
        </span>
        <span style={{ fontSize: 14, color: 'rgba(248,241,227,0.5)' }}>/ {size.ml} ml</span>
      </div>

      <div style={{ width: '88%', height: 5, background: 'rgba(255,248,231,0.06)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #F5A623, #FFC247)', transition: 'width 60ms linear' }}/>
      </div>

      <div style={{ marginTop: 6, display: 'flex', gap: 12, fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(248,241,227,0.5)' }}>
        <span><span style={{ color: hw ? '#4ADE80' : '#F5A623' }}>●</span> YF-S201</span>
        <span style={{ color: hw ? '#4ADE80' : '#F5A623' }}>{hw ? 'ESP32 · VALV·ON' : 'SIMULADO'}</span>
      </div>
      {err && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171', fontSize: 12, textAlign: 'center' }}>
          {err}
          <button onClick={() => onDone(Math.round(poured))} className="btn-ghost" style={{ display: 'block', margin: '8px auto 0', padding: '6px 14px', fontSize: 12 }}>Terminar · cobrar {Math.round(poured)} ml</button>
        </div>
      )}
    </div>
  );
}

/* ---------- DoneView ---------- */
function DoneView({ beer, size, user, bus, onTimeout }) {
  useEffect(() => { const t = setTimeout(onTimeout, 3600); return () => clearTimeout(t); }, []);
  const charged = Math.round(size.ml * beer.priceML);
  const newBal = (bus.state.users[user.id] || user).balance;
  return (
    <div className="anim-fadeup" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 18px 18px',
      background: 'radial-gradient(circle at 50% 30%, rgba(74,222,128,0.15) 0%, transparent 60%)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 999,
        background: 'rgba(74,222,128,0.18)', border: '1.5px solid #4ADE80',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12,
      }}>
        <Icon.Check size={32} color="#4ADE80"/>
      </div>
      <div className="display" style={{ fontSize: 38, color: '#F8F1E3', textAlign: 'center', marginTop: 14, lineHeight: 0.95 }}>
        ¡Salud!
      </div>
      <div style={{ fontSize: 12, color: 'rgba(248,241,227,0.6)', textAlign: 'center', marginTop: 4 }}>
        {size.ml} ml · {beer.name}
      </div>
      <div style={{
        marginTop: 18, width: '100%',
        background: 'rgba(255,248,231,0.04)',
        border: '1px solid rgba(255,248,231,0.08)',
        borderRadius: 12, padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(248,241,227,0.6)' }}>
          <span>Cargado</span>
          <span style={{ color: '#F8F1E3', fontWeight: 700 }}>− {fmtMoney(charged)}</span>
        </div>
        <div style={{ height: 1, background: 'rgba(255,248,231,0.08)', margin: '8px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(248,241,227,0.6)' }}>
          <span>Saldo {user.name.split(' ')[0]}</span>
          <span style={{ color: '#F5A623', fontWeight: 800, fontFamily: 'JetBrains Mono' }}>{fmtMoney(newBal)}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StationApp });
