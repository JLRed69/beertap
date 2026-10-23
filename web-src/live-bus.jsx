/* global React, mqtt */
/* ============================================================
   BeerTap Live Bus — shared state across devices via MQTT.
   ============================================================
   Architecture: each client maintains a full state snapshot
   versioned with (version, lastEditedAt). On any local mutation
   we bump (v+1, now), publish a retained message, and persist
   to localStorage. On incoming snapshot, we adopt if its
   (version, lastEditedAt) > local. Subscribes are wildcarded
   per-room so all three modes (customer/station/admin) see
   the same world.
   ============================================================ */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

const DEFAULT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const DEFAULT_BROKER_FALLBACK = 'wss://broker.hivemq.com:8884/mqtt';

/* ---------- Initial / migration helpers ---------- */
const INITIAL_STATE = () => ({
  v: 1,            // schema version (for forward migrations)
  version: 0,      // monotonic mutation counter
  lastEditedBy: null,
  lastEditedAt: 0,
  users: {},        // id → user record
  transactions: [], // newest-first
  rechargeRequests: [], // pending top-up requests
  taps: [
    { id: 1, beer: 'lupulo',  status: 'idle' },
    { id: 2, beer: 'trigo',   status: 'idle' },
    { id: 3, beer: 'sombra',  status: 'idle' },
    { id: 4, beer: 'pilsner', status: 'idle' },
  ],
});

/* ---------- Beer catalog ---------- */
const BEERS_LIVE = [
  { id: 'lupulo',  name: 'Lúpulo Dorado',     style: 'India Pale Ale',  abv: 6.2, ibu: 55,
    color: '#F5A623', colorDeep: '#7E3A05', foam: '#FFF1CF', priceML: 0.18,
    notes: 'Cítrico · resinoso · audaz' },
  { id: 'sombra',  name: 'Sombra de Roble',   style: 'Imperial Stout',  abv: 8.4, ibu: 42,
    color: '#3D2210', colorDeep: '#120903', foam: '#D9C39A', priceML: 0.24,
    notes: 'Cacao · café · vainilla' },
  { id: 'trigo',   name: 'Trigo de Verano',   style: 'Hefeweizen',      abv: 5.1, ibu: 14,
    color: '#F4C95B', colorDeep: '#A26D0B', foam: '#FFF8E3', priceML: 0.16,
    notes: 'Plátano · clavo · suave' },
  { id: 'pilsner', name: 'Pilsner del Norte', style: 'Bohemian Pilsner',abv: 4.8, ibu: 38,
    color: '#F4D472', colorDeep: '#A07C12', foam: '#FFF8E3', priceML: 0.14,
    notes: 'Limpia · floral · crujiente' },
];

const SIZES_LIVE = [
  { id: 'S', name: 'Chico',   ml: 250, oz: '8 oz',  scale: 0.62 },
  { id: 'M', name: 'Mediano', ml: 400, oz: '13 oz', scale: 0.82 },
  { id: 'L', name: 'Grande',  ml: 568, oz: '20 oz', scale: 1.00 },
];

/* ---------- Tiny hash for password storage ---------- */
function hashpw(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return ('00000000' + h.toString(16)).slice(-8);
}

function newId(prefix = 'u') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------- Reducer ---------- */
function applyAction(state, action, opts = {}) {
  const now = Date.now();
  const by = opts.by ?? action.by ?? 'system';
  const next = { ...state, lastEditedAt: now, lastEditedBy: by, version: state.version + 1 };

  switch (action.type) {
    case 'CREATE_USER': {
      const { user } = action;
      next.users = { ...state.users, [user.id]: { initialBalance: user.balance, ...user, createdAt: user.createdAt || now } };
      next.transactions = [
        { id: newId('tx'), ts: now, type: 'signup', userId: user.id, by, note: 'Cuenta creada' },
        ...state.transactions,
      ];
      return next;
    }
    case 'ADJUST_BALANCE': {
      const u = state.users[action.userId];
      if (!u) return state;
      const newBal = Math.max(0, u.balance + action.delta);
      const applied = newBal - u.balance;
      if (!applied) return state;
      next.users = { ...state.users, [action.userId]: { ...u, balance: newBal } };
      next.transactions = [
        { id: newId('tx'), ts: now, type: applied > 0 ? 'topup' : 'admin_adjust', userId: action.userId, amount: applied, by, note: action.note || '' },
        ...state.transactions,
      ];
      return next;
    }
    case 'POUR': {
      const u = state.users[action.userId];
      if (!u) return state;
      const cost = action.amount;
      if (u.balance < cost) return state;
      const newBal = u.balance - cost;
      next.users = { ...state.users, [action.userId]: { ...u, balance: newBal } };
      next.transactions = [
        { id: newId('tx'), ts: now, type: 'pour', userId: action.userId,
          amount: -cost, beer: action.beer, sizeMl: action.sizeMl,
          tap: action.tap, by, note: '' },
        ...state.transactions,
      ];
      return next;
    }
    case 'REQUEST_TOPUP': {
      next.rechargeRequests = [
        { id: newId('rq'), ts: now, userId: action.userId, amount: action.amount, status: 'pending' },
        ...state.rechargeRequests,
      ];
      return next;
    }
    case 'RESOLVE_TOPUP': {
      const r = state.rechargeRequests.find(x => x.id === action.requestId);
      if (!r || r.status !== 'pending') return state;
      next.rechargeRequests = state.rechargeRequests.map(x =>
        x.id === action.requestId ? { ...x, status: action.approve ? 'approved' : 'rejected', resolvedBy: by, resolvedAt: now } : x
      );
      if (action.approve) {
        const u = state.users[r.userId];
        if (u) {
          next.users = { ...state.users, [r.userId]: { ...u, balance: u.balance + r.amount } };
          next.transactions = [
            { id: newId('tx'), ts: now, type: 'topup', userId: r.userId, amount: r.amount, by, note: 'Recarga aprobada' },
            ...state.transactions,
          ];
        }
      }
      return next;
    }
    case 'UPDATE_PROFILE': {
      const u = state.users[action.userId];
      if (!u) return state;
      next.users = { ...state.users, [action.userId]: { ...u, ...action.patch } };
      return next;
    }
    case 'RESET': {
      return { ...INITIAL_STATE(), epoch: now, version: state.version + 1, lastEditedAt: now, lastEditedBy: by };
    }
    default:
      return state;
  }
}

/* ---------- Merge (no se pierden altas/servidas simultáneas) ---------- */
function isNewerState(a, b) {
  return a.version > b.version || (a.version === b.version && a.lastEditedAt > b.lastEditedAt);
}
function mergeStates(local, inc) {
  const le = local.epoch || 0, ie = inc.epoch || 0;
  if (le !== ie) return ie > le ? inc : local;
  const tx = new Map();
  [...(inc.transactions || []), ...(local.transactions || [])].forEach(t => { if (!tx.has(t.id)) tx.set(t.id, t); });
  const transactions = [...tx.values()].sort((a, b) => b.ts - a.ts);
  const users = { ...(local.users || {}), ...(inc.users || {}) };
  const sums = {};
  transactions.forEach(t => { if (t.amount) sums[t.userId] = (sums[t.userId] || 0) + t.amount; });
  Object.keys(users).forEach(id => {
    const u = users[id];
    if (typeof u.initialBalance === 'number') users[id] = { ...u, balance: Math.max(0, u.initialBalance + (sums[id] || 0)) };
  });
  const rq = new Map();
  [...(local.rechargeRequests || []), ...(inc.rechargeRequests || [])].forEach(r => {
    const p = rq.get(r.id);
    if (!p || (p.status === 'pending' && r.status !== 'pending')) rq.set(r.id, r);
  });
  const base = isNewerState(inc, local) ? inc : local;
  return {
    ...base, users, transactions,
    rechargeRequests: [...rq.values()].sort((a, b) => b.ts - a.ts),
    version: Math.max(local.version, inc.version),
    lastEditedAt: Math.max(local.lastEditedAt || 0, inc.lastEditedAt || 0),
  };
}
function stateSig(s) {
  return [s.epoch || 0, Object.keys(s.users || {}).length, (s.transactions || []).length,
    (s.rechargeRequests || []).filter(r => r.status !== 'pending').length, (s.rechargeRequests || []).length].join('|');
}

/* ---------- The Bus hook ---------- */
function useBus(room = 'demo', clientName = 'unknown') {
  const [state, setState] = useState(() => {
    try {
      const cached = localStorage.getItem('beertap.state.' + room);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return INITIAL_STATE();
  });
  const [connStatus, setConnStatus] = useState('connecting'); // connecting | online | offline
  const clientRef = useRef(null);
  const stateRef = useRef(state);
  const avKey = 'beertap.avatars.' + room;
  const [avatars, setAvatars] = useState(() => {
    try { return JSON.parse(localStorage.getItem(avKey)) || {}; } catch (_) { return {}; }
  });
  const avatarsRef = useRef(avatars);
  const saveAvatars = (next) => {
    avatarsRef.current = next; setAvatars(next);
    try { localStorage.setItem(avKey, JSON.stringify(next)); } catch (_) {}
  };

  // keep ref hot
  useEffect(() => { stateRef.current = state; }, [state]);

  const topic = `beertap/${room}/state`;
  const avPrefix = `beertap/${room}/avatar/`;

  /* MQTT connection */
  useEffect(() => {
    if (typeof mqtt === 'undefined') {
      console.warn('mqtt.js not loaded — running offline');
      setConnStatus('offline');
      return;
    }
    let client;
    let usingFallback = false;
    const connect = (brokerUrl) => {
      try {
        client = mqtt.connect(brokerUrl, {
          clientId: 'beertap-' + clientName + '-' + Math.random().toString(36).slice(2, 8),
          clean: true,
          reconnectPeriod: 4000,
          connectTimeout: 8000,
        });
      } catch (e) {
        setConnStatus('offline');
        return;
      }
      clientRef.current = client;

      let gotState = false;
      const seenAv = new Set();
      client.on('connect', () => {
        setConnStatus('online');
        client.subscribe([topic, avPrefix + '+'], { qos: 0 });
        // Si el broker perdió los datos, este dispositivo los vuelve a publicar.
        setTimeout(() => {
          if (!gotState && stateRef.current.version > 0) {
            client.publish(topic, JSON.stringify(stateRef.current), { qos: 0, retain: true });
          }
          if (clientName === 'admin') {
            Object.keys(avatarsRef.current).forEach(uid => {
              if (!seenAv.has(uid)) client.publish(avPrefix + uid, avatarsRef.current[uid], { qos: 0, retain: true });
            });
          }
        }, 3000);
      });
      client.on('reconnect', () => setConnStatus('connecting'));
      client.on('offline',   () => setConnStatus('connecting'));
      client.on('error', (err) => {
        console.warn('mqtt error', err && err.message);
        if (!usingFallback) {
          usingFallback = true;
          try { client.end(true); } catch(_){}
          setTimeout(() => connect(DEFAULT_BROKER_FALLBACK), 200);
        } else {
          setConnStatus('offline');
        }
      });
      client.on('message', (t, payload) => {
        if (t.indexOf(avPrefix) === 0) {
          const uid = t.slice(avPrefix.length), img = payload.toString();
          seenAv.add(uid);
          if (avatarsRef.current[uid] === img) return;
          const next = { ...avatarsRef.current };
          if (img) next[uid] = img; else delete next[uid];
          saveAvatars(next);
          return;
        }
        if (t !== topic) return;
        gotState = true;
        try {
          const incoming = JSON.parse(payload.toString());
          if (!incoming || typeof incoming.version !== 'number') return;
          const local = stateRef.current;
          let merged = mergeStates(local, incoming);
          const sigM = stateSig(merged);
          if (sigM !== stateSig(incoming) && merged !== incoming) {
            merged = { ...merged, version: merged.version + 1, lastEditedAt: Date.now(), lastEditedBy: clientName };
            client.publish(topic, JSON.stringify(merged), { qos: 0, retain: true });
          }
          if (merged !== local && (sigM !== stateSig(local) || isNewerState(merged, local))) {
            stateRef.current = merged;
            setState(merged);
            try { localStorage.setItem('beertap.state.' + room, JSON.stringify(merged)); } catch(_){}
          }
        } catch (e) {
          console.warn('bad payload', e);
        }
      });
    };
    connect(DEFAULT_BROKER);

    return () => {
      try { client && client.end(true); } catch (_) {}
      clientRef.current = null;
    };
  }, [room, topic, clientName]);

  /* Dispatch — apply locally, publish, persist */
  const dispatch = useCallback((action, opts = {}) => {
    const prev = stateRef.current;
    const next = applyAction(prev, action, { by: opts.by || clientName });
    stateRef.current = next;
    setState(next);
    try { localStorage.setItem('beertap.state.' + room, JSON.stringify(next)); } catch (_) {}
    if (clientRef.current) {
      try {
        clientRef.current.publish(topic, JSON.stringify(next), { qos: 0, retain: true });
      } catch (_) {}
    }
    return next;
  }, [room, topic, clientName]);

  /* Selfie (≈5 KB) en su propio topic retenido, fuera del estado */
  const publishAvatar = useCallback((uid, dataUrl) => {
    const next = { ...avatarsRef.current };
    if (dataUrl) next[uid] = dataUrl; else delete next[uid];
    saveAvatars(next);
    if (clientRef.current) {
      try { clientRef.current.publish(avPrefix + uid, dataUrl || '', { qos: 0, retain: true }); } catch (_) {}
    }
  }, [avPrefix]);

  /* Ephemeral pour notifications (not part of state) */
  const sendPourCommand = useCallback((cmd) => {
    if (clientRef.current && clientRef.current.connected) {
      try {
        clientRef.current.publish(`beertap/${room}/pour`, JSON.stringify(cmd), { qos: 0 });
      } catch (_) {}
    }
  }, [room]);

  return { state, dispatch, connStatus, room, clientName, sendPourCommand, avatars, publishAvatar };
}

/* ---------- Local-only login session ---------- */
function useSession(room) {
  const key = 'beertap.session.' + room;
  const [userId, setUserId] = useState(() => {
    try { return localStorage.getItem(key) || null; } catch (_) { return null; }
  });
  const login = useCallback((id) => {
    setUserId(id);
    try { localStorage.setItem(key, id); } catch (_) {}
  }, [key]);
  const logout = useCallback(() => {
    setUserId(null);
    try { localStorage.removeItem(key); } catch (_) {}
  }, [key]);
  return { userId, login, logout };
}

/* ---------- helpers ---------- */
function findBeer(id)  { return BEERS_LIVE.find(b => b.id === id) || BEERS_LIVE[0]; }
function fmtMoney(n)   { return '$' + Math.round(n).toLocaleString('es-MX'); }
function fmtTime(ts)   {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest = new Date(today.getTime() - 86400000);
  const day = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() ? 'Hoy'
            : d.getDate() === yest.getDate()  && d.getMonth() === yest.getMonth()  ? 'Ayer'
            : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${day} · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
}

Object.assign(window, {
  useBus, useSession, BEERS_LIVE, SIZES_LIVE,
  hashpw, newId, findBeer, fmtMoney, fmtTime,
  applyAction, INITIAL_STATE, mergeStates,
});
