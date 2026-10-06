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
let pack = 'classic'; let track = 'calm';

// ---- Klang-Pakete: jedes Paket definiert alle Effekte im eigenen Stil ----
const rnd = () => Math.random();
const PACKS = {
  // Keks-Knacken, Münzen, Glocken
  classic: {
    click() { const r = rnd(); noise(0.06, { gain: 0.28, freq: 2200 + r * 1800, q: 0.8 }); noise(0.03, { gain: 0.18, freq: 6500, kind: 'highpass', delay: 0.012 }); tone(150 + r * 40, 0.09, { gain: 0.32, slide: -90 }); },
    buy() { tone(1319, 0.14, { type: 'square', gain: 0.07, filter: 5000, wet: 0.25 }); tone(1760, 0.3, { type: 'square', gain: 0.07, delay: 0.07, filter: 5000, wet: 0.3 }); noise(0.05, { gain: 0.08, freq: 8000, kind: 'highpass' }); },
    shop() { noise(0.07, { gain: 0.2, freq: 1800 }); tone(988, 0.12, { type: 'triangle', gain: 0.18, delay: 0.05 }); tone(1319, 0.9, { gain: 0.2, delay: 0.12, wet: 0.5, detune: 6 }); tone(1976, 1.1, { gain: 0.12, delay: 0.12, wet: 0.5 }); [1568, 2093, 2637].forEach((f, i) => tone(f, 0.5, { gain: 0.07, delay: 0.3 + i * 0.07, wet: 0.5 })); },
    goldenSpawn() { [2093, 2637, 3136].forEach((f, i) => tone(f, 0.9, { gain: 0.1, delay: i * 0.09, wet: 0.7, detune: 4 })); },
    goldenClick() { noise(0.4, { gain: 0.12, freq: 1500, slide: 5000, q: 2, wet: 0.4 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.7, { type: 'triangle', gain: 0.18, delay: i * 0.065, wet: 0.5, detune: 5 })); tone(2093, 1.3, { gain: 0.1, delay: 0.3, wet: 0.8 }); },
    achievement() { [[392, 0], [494, 0.1], [587, 0.2], [784, 0.34]].forEach(([f, d]) => tone(f, 0.55, { type: 'sawtooth', gain: 0.1, delay: d, filter: 2400, wet: 0.35, detune: 7 })); [784, 988, 1175].forEach((f) => tone(f, 1.2, { gain: 0.1, delay: 0.5, wet: 0.7 })); },
    message() { [[880, 1], [1760, 0.4], [2349, 0.25]].forEach(([f, g]) => tone(f, 1.4, { gain: 0.16 * g, wet: 0.6 })); tone(1175, 1.2, { gain: 0.12, delay: 0.16, wet: 0.6 }); },
    gift() { [659, 784, 988, 1319].forEach((f, i) => { tone(f, 0.35, { type: 'triangle', gain: 0.22, delay: i * 0.08, wet: 0.3 }); tone(f * 4, 0.08, { gain: 0.06, delay: i * 0.08 }); }); },
    error() { tone(110, 0.28, { type: 'sawtooth', gain: 0.18, slide: -40, filter: 600 }); noise(0.08, { gain: 0.12, freq: 400, kind: 'lowpass' }); },
  },
  // 8-Bit: Rechteckwellen, kurze Blips
  retro: {
    click() { tone(660 + rnd() * 220, 0.05, { type: 'square', gain: 0.1, slide: -300 }); },
    buy() { tone(659, 0.07, { type: 'square', gain: 0.08 }); tone(988, 0.12, { type: 'square', gain: 0.08, delay: 0.07 }); },
    shop() { tone(988, 0.07, { type: 'square', gain: 0.09 }); tone(1319, 0.5, { type: 'square', gain: 0.09, delay: 0.07 }); },
    goldenSpawn() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.06, { type: 'square', gain: 0.06, delay: i * 0.05 })); },
    goldenClick() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.09, { type: 'square', gain: 0.08, delay: i * 0.055 })); },
    achievement() { [392, 392, 392, 523, 659, 784].forEach((f, i) => tone(f, i > 2 ? 0.25 : 0.1, { type: 'square', gain: 0.08, delay: i * 0.12 })); },
    message() { tone(1047, 0.1, { type: 'square', gain: 0.08 }); tone(1047, 0.1, { type: 'square', gain: 0.08, delay: 0.14 }); tone(1568, 0.25, { type: 'square', gain: 0.08, delay: 0.28 }); },
    gift() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.08, { type: 'square', gain: 0.07, delay: i * 0.07 })); },
    error() { tone(196, 0.12, { type: 'square', gain: 0.1 }); tone(131, 0.2, { type: 'square', gain: 0.1, delay: 0.12 }); },
  },
  // Zen: Holz, Klangschalen, Kalimba
  zen: {
    click() { tone(300 + rnd() * 60, 0.12, { gain: 0.3, slide: -120, wet: 0.15 }); noise(0.025, { gain: 0.08, freq: 1200 }); },
    buy() { tone(784, 0.3, { type: 'triangle', gain: 0.18, wet: 0.4 }); tone(1175, 0.5, { type: 'sine', gain: 0.1, delay: 0.06, wet: 0.5 }); },
    shop() { tone(440, 2, { gain: 0.2, wet: 0.7, detune: 3 }); tone(880, 1.6, { gain: 0.1, wet: 0.7 }); tone(1320, 1.2, { gain: 0.07, delay: 0.05, wet: 0.7 }); },
    goldenSpawn() { [1319, 1568, 1976].forEach((f, i) => tone(f, 1.2, { gain: 0.08, delay: i * 0.14, wet: 0.8 })); },
    goldenClick() { [523, 587, 659, 784, 880, 1047].forEach((f, i) => tone(f, 0.6, { type: 'triangle', gain: 0.14, delay: i * 0.08, wet: 0.6 })); tone(262, 2.4, { gain: 0.12, wet: 0.8 }); },
    achievement() { tone(196, 3, { gain: 0.24, wet: 0.8, detune: 4 }); tone(392, 2.4, { gain: 0.12, wet: 0.8 }); tone(588, 2, { gain: 0.08, delay: 0.1, wet: 0.8 }); tone(784, 1.8, { gain: 0.06, delay: 0.2, wet: 0.8 }); },
    message() { tone(659, 2.2, { gain: 0.2, wet: 0.8, detune: 3 }); tone(1318, 1.6, { gain: 0.08, wet: 0.8 }); },
    gift() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.5, { type: 'triangle', gain: 0.2, delay: i * 0.09, wet: 0.4, attack: 0.002 }); }); },
    error() { tone(147, 0.4, { gain: 0.2, wet: 0.2, slide: -20 }); },
  },
  // Weltraum: Laser, Sonar, Synthesizer-Flächen
  space: {
    click() { tone(1200 + rnd() * 400, 0.12, { type: 'sawtooth', gain: 0.1, slide: -900, filter: 3000 }); },
    buy() { tone(400, 0.18, { type: 'sine', gain: 0.18, slide: 900, wet: 0.3 }); tone(1600, 0.12, { type: 'triangle', gain: 0.08, delay: 0.12 }); },
    shop() { tone(300, 0.3, { type: 'sawtooth', gain: 0.1, slide: 1500, filter: 4000 }); tone(1760, 1.2, { gain: 0.14, delay: 0.25, wet: 0.8, detune: 8 }); },
    goldenSpawn() { tone(2000, 0.9, { gain: 0.1, slide: 600, wet: 0.7, detune: 12 }); tone(3000, 0.7, { gain: 0.05, delay: 0.1, wet: 0.7 }); },
    goldenClick() { noise(0.7, { gain: 0.1, freq: 400, slide: 6000, q: 3, wet: 0.5 }); [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 1.2, { type: 'sawtooth', gain: 0.06, delay: i * 0.05, filter: 2500, wet: 0.7, detune: 10 })); },
    achievement() { noise(0.9, { gain: 0.12, freq: 300, slide: 7000, q: 2, wet: 0.6 }); [196, 247, 294, 392].forEach((f) => tone(f, 2, { type: 'sawtooth', gain: 0.07, delay: 0.5, filter: 1800, wet: 0.8, detune: 12, attack: 0.15 })); },
    message() { tone(880, 1.8, { gain: 0.18, wet: 0.9, slide: -20 }); tone(880, 1.8, { gain: 0.1, delay: 0.5, wet: 0.9 }); },
    gift() { [392, 523, 659, 880].forEach((f, i) => tone(f, 0.9, { type: 'triangle', gain: 0.12, delay: i * 0.1, wet: 0.8, detune: 9 })); },
    error() { tone(220, 0.35, { type: 'sawtooth', gain: 0.14, slide: -150, filter: 900 }); },
  },
  // Episch: Pauken, Fanfaren, Harfe
  epic: {
    click() { tone(95 + rnd() * 20, 0.16, { gain: 0.45, slide: -45 }); noise(0.04, { gain: 0.16, freq: 1800 }); },
    buy() { tone(330, 0.3, { type: 'sawtooth', gain: 0.1, filter: 1400, wet: 0.4, attack: 0.03 }); tone(494, 0.4, { type: 'sawtooth', gain: 0.1, delay: 0.1, filter: 1600, wet: 0.4, attack: 0.03 }); },
    shop() { noise(0.9, { gain: 0.1, freq: 6000, kind: 'highpass', wet: 0.5 }); [392, 494, 659].forEach((f) => tone(f, 0.9, { type: 'sawtooth', gain: 0.08, filter: 2000, wet: 0.6, detune: 6, attack: 0.04 })); },
    goldenSpawn() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.8, { gain: 0.09, delay: i * 0.06, wet: 0.7 })); },
    goldenClick() { for (let i = 0; i < 8; i++) tone(262 * Math.pow(1.26, i), 0.5, { gain: 0.1, delay: i * 0.05, wet: 0.6 }); tone(70, 0.6, { gain: 0.5, slide: -30 }); },
    achievement() { tone(65, 0.9, { gain: 0.5, slide: -25 }); tone(65, 0.9, { gain: 0.4, delay: 0.35, slide: -25 }); [[392, 0.5], [494, 0.5], [587, 0.5], [784, 0.5], [988, 0.5]].forEach(([f, d]) => tone(f, 1.4, { type: 'sawtooth', gain: 0.08, delay: d, filter: 2400, wet: 0.7, detune: 8, attack: 0.05 })); },
    message() { tone(294, 0.5, { type: 'sawtooth', gain: 0.12, filter: 1300, wet: 0.7, attack: 0.04 }); tone(440, 1.1, { type: 'sawtooth', gain: 0.12, delay: 0.3, filter: 1500, wet: 0.7, attack: 0.04 }); },
    gift() { for (let i = 0; i < 7; i++) tone(262 * Math.pow(1.26, i), 0.7, { gain: 0.12, delay: i * 0.06, wet: 0.7, attack: 0.002 }); },
    error() { tone(73, 0.5, { gain: 0.5, slide: -25 }); },
  },
};

// ---- Musik: erzeugt Akkorde, Arpeggien, Bass, Schlag und zufällige Melodien je nach Stück ----
const TRACKS = {
  calm: { ms: 480, root: 60, bar: 8, prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], pad: { type: 'triangle', dur: 3.6, gain: 0.07, attack: 0.4, wet: 0.5, filter: 900 }, lead: { prob: 0.55, scale: [0, 2, 4, 7, 9, 12, 14, 16], type: 'sine', dur: 1.6, gain: 0.07, wet: 0.7 } },
  lofi: { ms: 640, root: 57, bar: 8, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 4], [-9, -5, -2, 2]], pad: { type: 'triangle', dur: 4.2, gain: 0.08, attack: 0.25, wet: 0.4, filter: 700 }, lead: { prob: 0.4, scale: [0, 3, 5, 7, 10, 12], type: 'triangle', dur: 1.1, gain: 0.07, wet: 0.5, filter: 1600 }, kick: 4, crackle: true },
  chip: { ms: 190, root: 60, bar: 16, prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [-3, 0, 4]], arp: { type: 'square', dur: 0.14, gain: 0.04, filter: 3200 }, bass: { type: 'square', dur: 0.32, gain: 0.05, every: 4 }, lead: { prob: 0.28, scale: [0, 2, 4, 7, 9, 12, 16], type: 'square', dur: 0.3, gain: 0.04, filter: 3200 } },
  ambient: { ms: 900, root: 55, bar: 8, prog: [[0, 7, 12], [-5, 2, 7], [-3, 4, 9], [-7, 0, 5]], pad: { type: 'sine', dur: 8, gain: 0.08, attack: 2, wet: 0.8, filter: 600 }, lead: { prob: 0.35, scale: [0, 2, 7, 9, 14, 16], type: 'sine', dur: 3, gain: 0.05, wet: 0.9 } },
  epic: { ms: 360, root: 50, bar: 8, prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], pad: { type: 'sawtooth', dur: 2.8, gain: 0.045, attack: 0.5, wet: 0.6, filter: 1100, detune: 8 }, timp: 4, lead: { prob: 0.22, scale: [0, 3, 7, 10, 12, 15], type: 'triangle', dur: 1.4, gain: 0.07, wet: 0.7 } },
};
let musicTimer = null; let beat = 0;
function musicStep(id = track) {
  const c = ready(); const T = TRACKS[id]; if (!c || !T) return;
  const chord = T.prog[Math.floor(beat / T.bar) % T.prog.length];
  if (T.pad && beat % T.bar === 0) chord.forEach((n) => tone(note(T.root + n - 12), T.pad.dur, T.pad));
  if (T.arp) tone(note(T.root + chord[beat % chord.length] + (beat % 8 < 4 ? 12 : 24)), T.arp.dur, T.arp);
  if (T.bass && beat % T.bass.every === 0) tone(note(T.root + chord[0] - 24), T.bass.dur, T.bass);
  if (T.kick && beat % T.kick === 0) { tone(110, 0.14, { gain: 0.3, slide: -70 }); noise(0.04, { gain: 0.05, freq: 3000 }); }
  if (T.kick && beat % T.kick === 2) noise(0.05, { gain: 0.06, freq: 5000, kind: 'highpass' });
  if (T.crackle && rnd() < 0.5) noise(0.015, { gain: 0.035, freq: 4500, kind: 'highpass' });
  if (T.timp && beat % T.timp === 0) { tone(80, 0.5, { gain: 0.3, slide: -40, wet: 0.3 }); noise(0.05, { gain: 0.06, freq: 700 }); }
  if (T.lead && rnd() < T.lead.prob) tone(note(T.root + T.lead.scale[Math.floor(rnd() * T.lead.scale.length)] + chord[0] + 12), T.lead.dur, T.lead);
  beat++;
}
const stopMusic = () => { clearInterval(musicTimer); musicTimer = null; };
function startMusic() { stopMusic(); if (!musicOn) return; beat = 0; musicTimer = setInterval(musicStep, (TRACKS[track] || TRACKS.calm).ms); }
let previewTimer = null;

export const sound = {
  get enabled() { return on; }, get volume() { return vol; }, get music() { return musicOn; }, get pack() { return pack; }, get track() { return track; },
  setEnabled(v) { on = !!v; ls.set('cc_sound', on ? '1' : '0'); if (on) unlockNow(); else stopMusic(); },
  setVolume(v) { vol = Math.min(1, Math.max(0, v)); ls.set('cc_vol', String(vol)); },
  setMusic(v) { musicOn = !!v; ls.set('cc_music', musicOn ? '1' : '0'); if (musicOn) { unlockNow(); startMusic(); } else stopMusic(); },
  setPack(id) { if (PACKS[id]) pack = id; },
  setTrack(id) { if (TRACKS[id] && id !== track) { track = id; if (musicOn) startMusic(); } },
  unlock() { if (on) unlockNow(); },
  get state() { return ctx ? ctx.state : 'none'; },
  async test() { await unlockNow(); this.achievement(); return this.state; },
  // Vorschau im Shop (spielt auch Pakete, die noch nicht gekauft sind)
  async previewPack(id) { await unlockNow(); const P = PACKS[id]; if (!P) return; P.click(); setTimeout(() => P.buy(), 350); setTimeout(() => P.goldenClick(), 800); setTimeout(() => P.achievement(), 1700); },
  async previewTrack(id) {
    await unlockNow(); const T = TRACKS[id]; if (!T) return; stopMusic(); clearInterval(previewTimer); const keep = { id: track, on: musicOn };
    let n = 0; beat = 0; previewTimer = setInterval(() => { musicStep(id); if (++n > 24) { clearInterval(previewTimer); previewTimer = null; if (keep.on) startMusic(); } }, T.ms);
    musicTimer = null;
  },
  click() { const n = performance.now(); if (n - lastClick < 45) return; lastClick = n; PACKS[pack].click(); },
  buy() { PACKS[pack].buy(); }, shop() { PACKS[pack].shop(); }, goldenSpawn() { PACKS[pack].goldenSpawn(); }, goldenClick() { PACKS[pack].goldenClick(); },
  achievement() { PACKS[pack].achievement(); }, message() { PACKS[pack].message(); }, gift() { PACKS[pack].gift(); }, error() { PACKS[pack].error(); },
};
