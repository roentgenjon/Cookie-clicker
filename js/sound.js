// Sounds werden mit Web Audio direkt erzeugt (keine Audiodateien nötig).
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
let ctx = null;
let on = ls.get('cc_sound') !== '0';
let vol = Number(ls.get('cc_vol')); if (!Number.isFinite(vol) || ls.get('cc_vol') === null) vol = 0.5;

function ac() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  return ctx;
}

// iOS/Safari: Audio startet nur nach einer echten Berührung (touchend/click) und wird vom Stummschalter
// unterdrückt, solange nur Web Audio läuft. Deshalb: beim ersten Tippen entsperren + stilles Audio-Element abspielen.
let keepEl = null;
function silentWavUrl() {
  const n = 2205, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
async function unlockNow() {
  const c = ac(); if (!c) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ältere Browser */ }
  try { await c.resume(); } catch { /* wird beim nächsten Tippen erneut versucht */ }
  try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch { /* ignore */ }
  if (!keepEl) { try { keepEl = new Audio(silentWavUrl()); keepEl.loop = true; keepEl.volume = 0.02; keepEl.setAttribute('playsinline', ''); await keepEl.play(); } catch { keepEl = null; } }
}
const GESTURES = ['touchend', 'pointerup', 'click', 'keydown', 'mousedown'];
function onGesture() { if (on) unlockNow().then(() => { if (ctx && ctx.state === 'running' && keepEl) GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true)); }); }
GESTURES.forEach((g) => document.addEventListener(g, onGesture, true));

function tone(freq, dur, { type = 'sine', gain = 0.25, delay = 0, slide = 0 } = {}) {
  if (!on || vol <= 0) return;
  const c = ac(); if (!c) return;
  if (c.state !== 'running') { c.resume().catch(() => {}); return; } // noch nicht entsperrt: dieser Ton entfällt
  const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
let lastClick = 0;
export const sound = {
  get enabled() { return on; }, get volume() { return vol; },
  setEnabled(v) { on = !!v; ls.set('cc_sound', on ? '1' : '0'); if (on) unlockNow(); },
  setVolume(v) { vol = Math.min(1, Math.max(0, v)); ls.set('cc_vol', String(vol)); },
  unlock() { if (on) unlockNow(); },
  get state() { return ctx ? ctx.state : 'none'; },
  async test() { await unlockNow(); this.achievement(); return this.state; },
  click() { const n = performance.now(); if (n - lastClick < 40) return; lastClick = n; tone(380 + Math.random() * 120, 0.07, { type: 'triangle', gain: 0.22, slide: -120 }); },
  buy() { tone(520, 0.08, { type: 'square', gain: 0.1 }); tone(780, 0.1, { type: 'square', gain: 0.1, delay: 0.07 }); },
  goldenSpawn() { tone(1200, 0.18, { gain: 0.14 }); tone(1600, 0.22, { gain: 0.12, delay: 0.1 }); },
  goldenClick() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.2, delay: i * 0.07 })); },
  achievement() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.2, delay: i * 0.09 })); },
  message() { tone(880, 0.18, { gain: 0.2 }); tone(1175, 0.3, { gain: 0.18, delay: 0.12 }); },
  gift() { [659, 784, 988].forEach((f, i) => tone(f, 0.18, { gain: 0.18, delay: i * 0.08 })); },
  error() { tone(160, 0.2, { type: 'sawtooth', gain: 0.15, slide: -40 }); },
};
