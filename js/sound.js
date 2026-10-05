// Sounds werden mit Web Audio direkt erzeugt (keine Audiodateien nötig).
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
let ctx = null;
let on = ls.get('cc_sound') !== '0';
let vol = Number(ls.get('cc_vol')); if (!Number.isFinite(vol) || ls.get('cc_vol') === null) vol = 0.5;

function ac() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, { type = 'sine', gain = 0.25, delay = 0, slide = 0 } = {}) {
  if (!on || vol <= 0) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
let lastClick = 0;
export const sound = {
  get enabled() { return on; }, get volume() { return vol; },
  setEnabled(v) { on = !!v; ls.set('cc_sound', on ? '1' : '0'); if (on) ac(); },
  setVolume(v) { vol = Math.min(1, Math.max(0, v)); ls.set('cc_vol', String(vol)); },
  unlock() { if (on) ac(); },
  click() { const n = performance.now(); if (n - lastClick < 40) return; lastClick = n; tone(380 + Math.random() * 120, 0.07, { type: 'triangle', gain: 0.22, slide: -120 }); },
  buy() { tone(520, 0.08, { type: 'square', gain: 0.1 }); tone(780, 0.1, { type: 'square', gain: 0.1, delay: 0.07 }); },
  goldenSpawn() { tone(1200, 0.18, { gain: 0.14 }); tone(1600, 0.22, { gain: 0.12, delay: 0.1 }); },
  goldenClick() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.2, delay: i * 0.07 })); },
  achievement() { [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.2, delay: i * 0.09 })); },
  message() { tone(880, 0.18, { gain: 0.2 }); tone(1175, 0.3, { gain: 0.18, delay: 0.12 }); },
  gift() { [659, 784, 988].forEach((f, i) => tone(f, 0.18, { gain: 0.18, delay: i * 0.08 })); },
  error() { tone(160, 0.2, { type: 'sawtooth', gain: 0.15, slide: -40 }); },
};
