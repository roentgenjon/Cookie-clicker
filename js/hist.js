// Verlauf der gebackenen Kekse (Exponent) als Liniendiagramm in der Statistik. Alle 60 s ein Messpunkt, die letzten 360 (6 Std) bleiben auf diesem Gerät gespeichert.
import { Big, fmtBig } from './big.js';
const KEY = 'cc_hist'; const MAX = 360;
const rd = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(-MAX) : []; } catch { return []; } };
let data = rd();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? 'jetzt' : m < 60 ? `vor ${m} Min` : `vor ${Math.floor(m / 60)} Std ${m % 60} Min`; };
const val = (y) => fmtBig(Big.fromLog(y));

export const hist = {
  sample(game) {
    const l = game.totalReset.add(game.total).log10(); if (!Number.isFinite(l)) return;
    data.push([Date.now(), Math.max(0, l)]); data = data.slice(-MAX);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* egal */ }
  },
  draw(el) {
    if (data.length < 2) { el.innerHTML = '<h4 class="hist-t">📈 Verlauf</h4><p class="note">Noch zu wenig Daten – es wird jede Minute ein Messpunkt gespeichert. Schau in ein paar Minuten wieder vorbei.</p>'; return; }
    const W = 600, H = 210, L = 58, R = 12, T = 12, B = 28;
    const t0 = data[0][0], t1 = data[data.length - 1][0];
    let lo = Math.min(...data.map((p) => p[1])), hi = Math.max(...data.map((p) => p[1]));
    if (hi - lo < 1e-9) { lo = Math.max(0, lo - 1); hi += 1; }
    const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad;
    const x = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const path = data.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const grid = [0, 1, 2, 3].map((i) => { const v = lo + ((hi - lo) * i) / 3; return `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="hg"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ht">${esc(val(v))}</text>`; }).join('');
    const rows = data.slice(-12).reverse().map((p) => `<tr><td>${ago(Date.now() - p[0])}</td><td>${esc(val(p[1]))}</td></tr>`).join('');
    el.innerHTML = `<h4 class="hist-t">📈 Gebackene Kekse insgesamt (Verlauf)</h4>
      <div class="hist-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Liniendiagramm: gebackene Kekse insgesamt, von ${esc(val(data[0][1]))} auf ${esc(val(data[data.length - 1][1]))}" class="hist-svg">
        ${grid}<path d="${path}" class="hl"/>
        <text x="${L}" y="${H - 8}" class="ht">${ago(Date.now() - t0)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" class="ht">jetzt</text>
        <g id="hCur" style="display:none"><line id="hLine" y1="${T}" y2="${H - B}" class="hx"/><circle id="hDot" r="4.5" class="hd"/></g>
        <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" id="hHit"/></svg>
        <div id="hTip" class="hist-tip" hidden></div></div>
      <details class="hist-tab"><summary>Tabelle anzeigen</summary><table><tr><th>Zeit</th><th>Kekse insgesamt</th></tr>${rows}</table></details>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('#hTip'), cur = el.querySelector('#hCur');
    const move = (e) => {
      const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
      let best = 0; let bd = Infinity; data.forEach((p, i) => { const d = Math.abs(x(p[0]) - px); if (d < bd) { bd = d; best = i; } });
      const p = data[best]; const cx = x(p[0]), cy = y(p[1]);
      cur.style.display = ''; el.querySelector('#hLine').setAttribute('x1', cx); el.querySelector('#hLine').setAttribute('x2', cx);
      const dot = el.querySelector('#hDot'); dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      tip.hidden = false; tip.textContent = `${ago(Date.now() - p[0])}: ${val(p[1])}`;
      tip.style.left = `${Math.min(Math.max((cx / W) * r.width, 70), r.width - 70)}px`; tip.style.top = `${(cy / H) * r.height - 34}px`;
    };
    const hit = el.querySelector('#hHit'); hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { cur.style.display = 'none'; tip.hidden = true; });
  },
};
