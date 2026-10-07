// Riesige Zahlen ohne Spielobergrenze: Mantisse (1 ≤ m < 10) und Exponent (selbst eine Zahl bis 1e300). Unveränderlich (jede Operation liefert ein neues Big).
// Normale JS-Zahlen enden bei ~1,8e308, Big rechnet bis 10^(10^300) – das ist nie Infinity und im Spiel nicht erreichbar (die Exponenten wachsen höchstens bis ~1e15).
const LN10 = Math.LN10;
export const EMAX = 1e300; // technische Schutzgrenze für den Exponenten, damit nie Infinity/NaN entsteht

export class Big {
  constructor(m, e) { this.m = m; this.e = e; }
  static norm(m, e) {
    if (!(m > 0)) return ZERO;
    if (!Number.isFinite(m)) return new Big(1, EMAX);
    if (m >= 10 || m < 1) { const k = Math.floor(Math.log10(m)); m /= Math.pow(10, k); e += k; if (m >= 10) { m /= 10; e++; } else if (m < 1) { m *= 10; e--; } }
    return new Big(m, e < EMAX ? e : EMAX); // (NaN fällt ebenfalls auf EMAX)
  }
  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'string') return Big.parse(x);
    if (!(x > 0)) return ZERO;
    if (!Number.isFinite(x)) return new Big(1, EMAX);
    const e = Math.floor(Math.log10(x)); return Big.norm(x / Math.pow(10, e), e);
  }
  // "1.5e+300", "12345", Zahl -> Big (ungültig = 0)
  static parse(s) {
    if (s instanceof Big) return s;
    if (typeof s === 'number') return Big.from(s);
    if (typeof s !== 'string') return ZERO;
    const t = /^\s*(\d+(?:\.\d+)?)(?:e([+-]?\d+))?\s*$/i.exec(s);
    if (!t) return ZERO;
    const m = Number(t[1]); const e = t[2] ? Number(t[2]) : 0;
    return m > 0 && Number.isFinite(e) ? Big.norm(m, e) : ZERO; // Exponent darf sehr lang sein (bis 1e300)
  }
  // 10^l
  static fromLog(l) { if (!Number.isFinite(l)) return l > 0 ? new Big(1, EMAX) : ZERO; const e = Math.floor(l); return Big.norm(Math.pow(10, l - e), e); }
  get zero() { return this.m === 0; }
  isZero() { return this.m === 0; }
  log10() { return this.m === 0 ? -Infinity : this.e + Math.log10(this.m); }
  toNumber() { return this.m === 0 ? 0 : this.e > 308 ? Infinity : this.e < 22 && this.e > -7 ? Number(this.m + 'e' + this.e) : this.m * Math.pow(10, this.e); }
  cmp(o) { o = Big.from(o); if (this.m === 0 || o.m === 0) return this.m === o.m ? 0 : this.m === 0 ? -1 : 1; if (this.e !== o.e) return this.e < o.e ? -1 : 1; return this.m < o.m ? -1 : this.m > o.m ? 1 : 0; }
  gte(o) { return this.cmp(o) >= 0; }
  gt(o) { return this.cmp(o) > 0; }
  lt(o) { return this.cmp(o) < 0; }
  lte(o) { return this.cmp(o) <= 0; }
  add(o) {
    o = Big.from(o); if (o.m === 0) return this; if (this.m === 0) return o;
    const [a, b] = this.e >= o.e ? [this, o] : [o, this]; const d = a.e - b.e;
    if (d > 16) return a;
    return Big.norm(a.m + b.m * Math.pow(10, -d), a.e);
  }
  // Differenz, nie unter 0
  sub(o) {
    o = Big.from(o); if (o.m === 0) return this; const c = this.cmp(o); if (c <= 0) return ZERO;
    const d = this.e - o.e; if (d > 16) return this;
    return Big.norm(this.m - o.m * Math.pow(10, -d), this.e);
  }
  mul(o) { o = Big.from(o); return this.m === 0 || o.m === 0 ? ZERO : Big.norm(this.m * o.m, this.e + o.e); }
  mulN(x) { return x === 1 ? this : Big.norm(this.m * x, this.e); }
  mulLog(l) { if (this.m === 0 || l === 0) return this; const k = Math.floor(l); return Big.norm(this.m * Math.pow(10, l - k), this.e + k); }
  div(o) { o = Big.from(o); return this.m === 0 || o.m === 0 ? ZERO : Big.norm(this.m / o.m, this.e - o.e); }
  divN(x) { return Big.norm(this.m / x, this.e); }
  min(o) { o = Big.from(o); return this.cmp(o) <= 0 ? this : o; }
  max(o) { o = Big.from(o); return this.cmp(o) >= 0 ? this : o; }
  floor() { return this.e >= 15 ? this : Big.from(Math.floor(this.toNumber())); }
  clamp() { return this; } // keine Obergrenze mehr (bleibt für ältere Aufrufe)
  // Exponent immer ausgeschrieben (nie "1e+21"-Schreibweise), damit parse() ihn wieder lesen kann
  toString() { return this.m === 0 ? '0' : `${this.m.toPrecision(15)}e${this.e.toLocaleString('fullwide', { useGrouping: false })}`; }
  toJSON() { return this.toString(); }
}
export const ZERO = new Big(0, 0);
export const ONE = new Big(1, 0);
export const B = (x) => Big.from(x);
export const isBig = (x) => x instanceof Big;

// log10 der geometrischen Summe g^have * (g^n − 1)/(g − 1) · base (für Gebäude-, Item- und Mega-Preise)
const geoLogRaw = (g, n) => { const t = n * Math.log(g); return (t + Math.log1p(-Math.exp(-t)) - Math.log(g - 1)) / LN10; };
export function geoCost(base, g, have, n = 1) {
  const direct = base * Math.pow(g, have) * (Math.pow(g, n) - 1) / (g - 1);
  if (Number.isFinite(direct) && direct < 1e200) return Big.from(direct);
  return Big.fromLog(Math.log10(base) + have * Math.log10(g) + geoLogRaw(g, n));
}
// größtes n, dessen geoCost(base, g, have, n) ≤ cookies; mit Prüfung gegen Rundungsfehler
export function geoMax(base, g, have, cookies, limit = Infinity) {
  cookies = Big.from(cookies); if (cookies.m === 0) return 0;
  const r = cookies.log10() + Math.log10(g - 1) - Math.log10(base) - have * Math.log10(g);
  if (r < -15) return 0;
  const v = r > 15 ? r : Math.log10(1 + Math.pow(10, r));
  let n = Math.min(limit, Math.floor(v / Math.log10(g)));
  if (!(n >= 1)) return 0;
  while (n > 0 && geoCost(base, g, have, n).gt(cookies)) n--;
  return n;
}

// Anzeige: <1e6 ausgeschrieben, danach Namen (Mio … Dc), ab 1e45 als „1,23e500“.
// Wird der Exponent selbst riesig (≥ 1e9), wird er wieder als Zahl geschrieben: 10^(1,23e45) → „e1,23e45“ (e-Kette).
const SFX = ['', 'K', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trl', 'Trd', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
const ex = (e) => e.toLocaleString('fullwide', { useGrouping: false });
// Mantisse auf 2 Stellen gerundet, mit Übertrag (9,999 → 1,00 e+1)
const sci = (b) => {
  if (b.e >= 1e9) return 'e' + sci(Big.from(b.log10()));
  let m = b.m.toFixed(2), e = b.e; if (m === '10.00') { m = '1.00'; e += 1; }
  return `${m.replace('.', ',')}e${ex(e)}`;
};
export function fmtBig(x) {
  const b = Big.from(x);
  if (b.m === 0) return '0';
  if (b.e >= 1e9) return 'e' + sci(Big.from(b.log10()));
  if (b.e < 6) { const n = Number(b.toNumber().toPrecision(12)); return (n < 100 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('de-DE')).replace(/\.0$/, ''); }
  const k = Math.floor(b.e / 3);
  if (k >= SFX.length) return sci(b);
  const v = b.m * Math.pow(10, b.e - k * 3);
  let txt = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
  if (txt.includes('.')) txt = txt.replace(/0+$/, '').replace(/\.$/, '');
  return `${txt.replace('.', ',')} ${SFX[k]}`;
}
