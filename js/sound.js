// Sounds werden mit Web Audio direkt erzeugt (keine Audiodateien nötig): Rauschen + Oszillatoren + Filter + Hall.
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
let ctx = null; let master = null; let reverb = null; let noiseBuf = null;
let on = ls.get('cc_sound') !== '0';
let vol = Number(ls.get('cc_vol')); if (!Number.isFinite(vol) || ls.get('cc_vol') === null) vol = 0.6;
let musicOn = ls.get('cc_music') === '1';

function ac() {
  if (!ctx) {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ctx = new A();
    // Master: Kompressor gegen Übersteuern + einfacher Hall (zufällig abklingendes Rauschen als Impulsantwort)
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    master = ctx.createGain(); master.gain.value = 1; master.connect(comp).connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.6); const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = ir; reverb = ctx.createGain(); reverb.gain.value = 0.35; reverb.connect(conv).connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

// ---- iOS/Safari: entsperren (siehe Kommentar unten) ----
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
  if (musicOn) startMusic();
}
const GESTURES = ['touchend', 'pointerup', 'click', 'keydown', 'mousedown'];
function onGesture() { if (on) unlockNow().then(() => { if (ctx && ctx.state === 'running' && keepEl) GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true)); }); }
GESTURES.forEach((g) => document.addEventListener(g, onGesture, true));
const ready = () => { if (!on || vol <= 0) return null; const c = ac(); if (!c) return null; if (c.state !== 'running') { c.resume().catch(() => {}); return null; } return c; };

// ---- Bausteine ----
// Ton mit Hüllkurve; wet = Anteil Hall, detune für Chorus-Effekt, filter = Tiefpass-Frequenz
function tone(freq, dur, { type = 'sine', gain = 0.25, delay = 0, slide = 0, attack = 0.008, wet = 0, detune = 0, filter = 0, bus = 1 } = {}) {
  const c = ready(); if (!c) return;
  const t = c.currentTime + delay; const g = c.createGain(); let out = g;
  if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; g.connect(f); out = f; }
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain * vol * bus, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(master); if (wet) { const s = c.createGain(); s.gain.value = wet; out.connect(s).connect(reverb); }
  for (const d of detune ? [-detune, detune] : [0]) {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = d;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
}
// Rauschstoß (Knacken, Zischen) durch Bandpass/Hochpass
function noise(dur, { gain = 0.2, delay = 0, freq = 3000, q = 1, kind = 'bandpass', slide = 0, wet = 0 } = {}) {
  const c = ready(); if (!c) return;
  const t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = kind; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); if (wet) { const w = c.createGain(); w.gain.value = wet; g.connect(w).connect(reverb); }
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const note = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz
let lastClick = 0;

// ---- Hintergrundmusik: ruhige, zufällig variierte Pentatonik über einer Akkordfolge ----
let musicTimer = null; let beat = 0;
const PROG = [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]]; // C – Am – G – F (relativ zu C)
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
function musicStep() {
  const c = ready(); if (!c || !musicOn) return;
  const chord = PROG[Math.floor(beat / 8) % PROG.length]; const root = 60;
  if (beat % 8 === 0) chord.forEach((n, i) => tone(note(root + n - 12), 3.6, { type: 'triangle', gain: 0.07, attack: 0.4, wet: 0.5, filter: 900, bus: 0.9 + i * 0.05 }));
  if (Math.random() < 0.55) { const n = root + PENTA[Math.floor(Math.random() * PENTA.length)] + chord[0]; tone(note(n), 1.6, { type: 'sine', gain: 0.07, attack: 0.02, wet: 0.7 }); }
  beat++;
}
function startMusic() { if (musicTimer || !musicOn) return; musicTimer = setInterval(musicStep, 480); }
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

export const sound = {
  get enabled() { return on; }, get volume() { return vol; }, get music() { return musicOn; },
  setEnabled(v) { on = !!v; ls.set('cc_sound', on ? '1' : '0'); if (on) unlockNow(); else stopMusic(); },
  setVolume(v) { vol = Math.min(1, Math.max(0, v)); ls.set('cc_vol', String(vol)); },
  setMusic(v) { musicOn = !!v; ls.set('cc_music', musicOn ? '1' : '0'); if (musicOn) { unlockNow(); startMusic(); } else stopMusic(); },
  unlock() { if (on) unlockNow(); },
  get state() { return ctx ? ctx.state : 'none'; },
  async test() { await unlockNow(); this.achievement(); return this.state; },

  // Keks-Knacken: Rauschen (Knuspern) + dumpfer Schlag
  click() {
    const n = performance.now(); if (n - lastClick < 45) return; lastClick = n;
    const r = Math.random();
    noise(0.06, { gain: 0.28, freq: 2200 + r * 1800, q: 0.8 });
    noise(0.03, { gain: 0.18, freq: 6500, kind: 'highpass', delay: 0.012 });
    tone(150 + r * 40, 0.09, { type: 'sine', gain: 0.32, slide: -90 });
  },
  // Münze: zwei helle, schnell abklingende Töne mit leichtem Hall
  buy() { tone(1319, 0.14, { type: 'square', gain: 0.07, filter: 5000, wet: 0.25 }); tone(1760, 0.3, { type: 'square', gain: 0.07, delay: 0.07, filter: 5000, wet: 0.3 }); noise(0.05, { gain: 0.08, freq: 8000, kind: 'highpass' }); },
  // Kasse: „Ka-Ching“ für Shop-Items
  shop() { noise(0.07, { gain: 0.2, freq: 1800 }); tone(988, 0.12, { type: 'triangle', gain: 0.18, delay: 0.05 }); tone(1319, 0.9, { type: 'sine', gain: 0.2, delay: 0.12, wet: 0.5, detune: 6 }); tone(1976, 1.1, { type: 'sine', gain: 0.12, delay: 0.12, wet: 0.5 }); [1568, 2093, 2637].forEach((f, i) => tone(f, 0.5, { gain: 0.07, delay: 0.3 + i * 0.07, wet: 0.5 })); },
  // Glitzernd: hohe Glockentöne mit Hall
  goldenSpawn() { [2093, 2637, 3136].forEach((f, i) => tone(f, 0.9, { gain: 0.1, delay: i * 0.09, wet: 0.7, detune: 4 })); },
  goldenClick() { noise(0.4, { gain: 0.12, freq: 1500, slide: 5000, kind: 'bandpass', q: 2, wet: 0.4 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.7, { type: 'triangle', gain: 0.18, delay: i * 0.065, wet: 0.5, detune: 5 })); tone(2093, 1.3, { gain: 0.1, delay: 0.3, wet: 0.8 }); },
  // Fanfare: Dur-Akkord mit weichem Sägezahn, dann hoher Glockenton
  achievement() { [[392, 0], [494, 0.1], [587, 0.2], [784, 0.34]].forEach(([f, d]) => tone(f, 0.55, { type: 'sawtooth', gain: 0.1, delay: d, filter: 2400, wet: 0.35, detune: 7 })); [784, 988, 1175].forEach((f) => tone(f, 1.2, { type: 'sine', gain: 0.1, delay: 0.5, wet: 0.7 })); },
  // Glocke: Grundton + Obertöne (inharmonisch) für metallischen Klang
  message() { [[880, 1], [1760, 0.4], [2349, 0.25]].forEach(([f, g]) => tone(f, 1.4, { gain: 0.16 * g, wet: 0.6 })); tone(1175, 1.2, { gain: 0.12, delay: 0.16, wet: 0.6 }); },
  // Marimba: kurze, warme Töne
  gift() { [659, 784, 988, 1319].forEach((f, i) => { tone(f, 0.35, { type: 'triangle', gain: 0.22, delay: i * 0.08, wet: 0.3 }); tone(f * 4, 0.08, { gain: 0.06, delay: i * 0.08 }); }); },
  error() { tone(110, 0.28, { type: 'sawtooth', gain: 0.18, slide: -40, filter: 600 }); noise(0.08, { gain: 0.12, freq: 400, kind: 'lowpass' }); },
};
