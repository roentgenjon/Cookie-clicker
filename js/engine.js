import { SERIES, SERIES_COUNT, SERIES_LEVELS, seriesCost, seriesMaxAffordable, seriesLog } from './mega.js';
import { Big, ZERO, geoCost, geoMax } from './big.js';
import { SKINS, skinById, dayKey, yesterdayKey, genTasks, soundDef, soundKind } from './extras.js';
import { BUILDINGS, BASE_COUNT, GROWTH, HEAVEN_START, ORDER_COOKIE, ORDER_HEAVEN, TOTAL_UPGRADES, KIND, COST, P1, P2, NEED, EFFECT, K, LEVEL, buildAchievements } from './data.js';

export const ACH = buildAchievements();
// Kekse, Produktion und Preise sind Big-Zahlen (ohne Obergrenze). Multiplikatoren werden als log10 gespeichert (Summe statt Produkt).
const LG = { tierBig: Math.log10(EFFECT.tierBig), tierSmall: Math.log10(EFFECT.tierSmall), click: Math.log10(EFFECT.click), global: Math.log10(EFFECT.global), hGlobal: Math.log10(EFFECT.hGlobal), hClick: Math.log10(EFFECT.hClick) };
// Singularität: endlose Stufen. Jede Stufe hebt die gesamte Produktion in die Potenz 1,02 (Exponent ×1,02) und kostet
// 60 Sekunden Produktion × 1,03^Stufe – der Preis wächst mit der Produktion mit, dadurch gibt es immer eine nächste Stufe.
// Boni, die man mit der Singularität freischaltet: [Stufe, Text]
export const SING_MILESTONES = [
  [10, 'Goldene Kekse erscheinen 25 % schneller'],
  [25, 'Singularität-Preis −10 %'],
  [50, 'Goldene Kekse bleiben 50 % länger'],
  [100, 'Offline-Ertrag: 24 Std länger'],
  [250, 'Goldene Belohnungen ×2'],
  [500, 'Singularität-Preis −25 % (zusätzlich)'],
  [1000, 'Raserei-Stärke ×2'],
];
export const SING_POW = 1.02; export const SING_COST = 1.03; export const SING_SECS = 60; export const SING_MIN_LOG = 100; // ab Produktion 1e100 verfügbar
const OFFLINE_CAP = 24 * 3600; // Basis-Limit; himmlische Upgrades erhöhen es

const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); };
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const rawPack = (arr) => { const out = new Uint8Array(Math.ceil(arr.length / 8)); for (let i = 0; i < arr.length; i++) if (arr[i]) out[i >> 3] |= 1 << (i & 7); return toB64(out); };
const rawUnpack = (str, len) => { const bytes = fromB64(str); const out = new Uint8Array(len); for (let i = 0; i < len; i++) out[i] = ((bytes[i >> 3] || 0) >> (i & 7)) & 1; return out; };
// Lauflängen-Kodierung: abwechselnd Anzahl 0er / 1er, als Varints. Format "r:<base64>"; roh = "b:<base64>"
function packBits(arr) {
  const bytes = []; let cur = 0, run = 0;
  for (let i = 0; i < arr.length; i++) {
    if ((arr[i] ? 1 : 0) === cur) { run++; continue; }
    let v = run; while (v >= 128) { bytes.push((v & 127) | 128); v >>>= 7; } bytes.push(v); cur ^= 1; run = 1;
  }
  let v = run; while (v >= 128) { bytes.push((v & 127) | 128); v >>>= 7; } bytes.push(v);
  const rle = 'r:' + toB64(Uint8Array.from(bytes));
  const raw = 'b:' + rawPack(arr);
  return rle.length <= raw.length ? rle : raw;
}
function unpackBits(str, len) {
  if (str.startsWith('r:')) {
    const bytes = fromB64(str.slice(2)); const out = new Uint8Array(len); let pos = 0, cur = 0, i = 0;
    while (i < bytes.length) {
      let v = 0, sh = 0; while (bytes[i] & 128) { v |= (bytes[i++] & 127) << sh; sh += 7; } v |= bytes[i++] << sh;
      if (cur) out.fill(1, pos, Math.min(len, pos + v)); pos += v; cur ^= 1;
    }
    return out;
  }
  return rawUnpack(str.startsWith('b:') ? str.slice(2) : str, len);
}

export class Game {
  constructor() {
    this.name = 'Dein';
    this.hardReset();
  }

  hardReset() {
    this.cookies = ZERO; this.total = ZERO; this.totalReset = ZERO; this.clicks = 0; this.golden = 0;
    this.owned = new Array(BUILDINGS.length).fill(0);
    this.bought = new Uint8Array(TOTAL_UPGRADES);
    this.upgradeCount = 0;
    this.ach = new Uint8Array(ACH.length);
    this.sing = 0; // Singularitäts-Stufe (bleibt beim Aufstieg)
    this.ascensions = 0; this.chipsEarned = ZERO; this.chipsSpent = 0; // Chips gesamt als Big (keine Obergrenze), ausgegebene Chips als Zahl
    this.start = Date.now(); this.last = Date.now();
    this.skin = 'classic';
    this.series = new Array(SERIES_COUNT).fill(0); // Mega-Upgrades: gekaufte Stufen je Reihe (werden beim Aufstieg zurückgesetzt)
    this.sounds = { owned: ['classic', 'calm'], pack: 'classic', track: 'calm' }; // Sound-Shop (bleibt beim Aufstieg)
    this.daily = { date: '', tasks: [], prog: { clicks: 0, golden: 0, buildings: 0, upgrades: 0, baked: ZERO }, claimed: [], streak: 0, lastDone: '' };
    this.buffs = []; this.gcs = []; this.gid = 0; this.nextGolden = 60;
    this.recalc();
  }

  // ---- Berechnung aller Boni ----
  resetAgg() {
    const n = BUILDINGS.length;
    this.tierLog = new Array(n).fill(0);
    this.synW = Array.from({ length: n }, () => new Array(n).fill(0)); // Synergie-Gewichte [A][B]
    this.globalLog = 0; this.clickLog = 0; this.clickPct = 0;
    this.gFreq = 1; this.gDur = 1; this.gReward = 1; this.gLucky = 0.15; this.gFrenzy = 7; this.offline = 1; this.offlineCap = OFFLINE_CAP;
    this.upgradeCount = 0;
  }
  // Wirkung eines einzelnen gekauften Upgrades auf die Summen
  applyOne(id) {
    this.upgradeCount++;
    const p1 = P1[id];
    switch (KIND[id]) {
      case K.TIER: this.tierLog[p1] += LEVEL[id] <= 10 ? LG.tierBig : LG.tierSmall; break;
      case K.CLICK: if (p1) this.clickPct += EFFECT.clickPct; else this.clickLog += LG.click; break;
      case K.GLOBAL: this.globalLog += LG.global; break;
      case K.SYN: this.synW[p1][P2[id]] += EFFECT.syn; break;
      case K.GOLDEN:
        if (p1 === 0) this.gFreq = Math.max(0.2, this.gFreq * EFFECT.gFreq);
        else if (p1 === 1) this.gDur *= EFFECT.gDur;
        else if (p1 === 2) this.gReward *= EFFECT.gReward;
        else if (p1 === 3) this.gLucky += EFFECT.gLucky;
        else this.gFrenzy *= EFFECT.gFrenzy;
        break;
      default:
        if (p1 === 0) this.globalLog += LG.hGlobal;
        else if (p1 === 1) this.clickLog += LG.hClick;
        else if (p1 === 2) this.gFreq = Math.max(0.2, this.gFreq * EFFECT.hFreq);
        else this.offlineCap += EFFECT.hOffline;
    }
  }
  // ---- Mega-Upgrades (Reihen) ----
  applySeriesFactor(i, n) {
    const s = SERIES[i]; const l = seriesLog(s, n);
    if (s.kind === 'bld') this.tierLog[s.b] += l;
    else if (s.kind === 'click') this.clickLog += l;
    else this.globalLog += l;
  }
  get seriesTotal() { let t = 0; for (const n of this.series) t += n; return t; }
  seriesVisible(i) { const s = SERIES[i]; return s.kind === 'bld' ? this.owned[s.b] >= s.need : this.totalReset.add(this.total).gte(s.baked); }
  seriesPrice(i, n = 1) { return seriesCost(SERIES[i], this.series[i], n); }
  // n = Anzahl oder 'max'; gibt die gekauften Stufen zurück
  buySeries(i, n = 1) {
    const s = SERIES[i]; if (!s || !this.seriesVisible(i)) return 0;
    const have = this.series[i];
    if (n === 'max') n = seriesMaxAffordable(s, have, this.cookies);
    n = Math.min(n, SERIES_LEVELS - have);
    if (!(n >= 1)) return 0;
    const cost = seriesCost(s, have, n);
    if (cost.gt(this.cookies)) return 0;
    this.cookies = this.cookies.sub(cost); this.series[i] = have + n; this.applySeriesFactor(i, n); this.daily.prog.upgrades += Math.min(n, 1e6); this.updateCps();
    return n;
  }
  // „Alle kaufen“ für Mega-Reihen: das Guthaben wird gleichmäßig auf alle freigeschalteten Reihen verteilt (4 Runden, Reste fließen weiter)
  buyAllSeries() {
    let total = 0;
    for (let round = 0; round < 6; round++) {
      const vis = []; for (let i = 0; i < SERIES_COUNT; i++) if (this.seriesVisible(i) && this.seriesPrice(i, 1).lte(this.cookies)) vis.push(i); // nur Reihen, von denen man mindestens 1 Stufe bezahlen kann
      if (!vis.length || this.cookies.isZero()) break;
      vis.sort((a, b) => this.seriesPrice(a, 1).cmp(this.seriesPrice(b, 1)));
      const share = this.cookies.divN(vis.length); let any = false;
      for (const i of vis) {
        const n = seriesMaxAffordable(SERIES[i], this.series[i], share.min(this.cookies));
        if (n >= 1) { const got = this.buySeries(i, n); if (got) { total += got; any = true; } }
      }
      if (!any) break;
    }
    return total;
  }
  recalc() {
    this.resetAgg();
    for (let id = 0; id < TOTAL_UPGRADES; id++) if (this.bought[id]) this.applyOne(id);
    for (let i = 0; i < SERIES_COUNT; i++) if (this.series[i] > 0) this.applySeriesFactor(i, this.series[i]);
    this.applySingBonuses();
    this.updateCps();
  }
  // Meilenstein-Boni der Singularität (gelten zusätzlich zu den Upgrades)
  applySingBonuses() {
    const l = this.sing;
    if (l >= 10) this.gFreq = Math.max(0.2, this.gFreq * 0.8);
    if (l >= 50) this.gDur *= 1.5;
    if (l >= 100) this.offlineCap += 24 * 3600;
    if (l >= 250) this.gReward *= 2;
    if (l >= 1000) this.gFrenzy *= 2;
  }

  achCount() { let c = 0; for (const v of this.ach) c += v; return c; }

  updateCps() {
    let sum = ZERO;
    for (let b = 0; b < BUILDINGS.length; b++) {
      if (!this.owned[b]) continue;
      let syn = 1; const w = this.synW[b];
      for (let o = 0; o < w.length; o++) if (w[o]) syn += w[o] * this.owned[o];
      sum = sum.add(Big.from(BUILDINGS[b].cps * this.owned[b] * syn).mulLog(this.tierLog[b]));
    }
    let base = sum.mulLog(this.globalLog).mul(Big.from(1).add(this.chipsEarned.mulN(0.01))).mulN(1 + 0.002 * this.achCount());
    if (this.sing > 0 && !base.isZero()) base = Big.fromLog(base.log10() * Math.pow(SING_POW, this.sing)); // Singularität: Produktion hoch 1,02^Stufe
    this.baseCps = base;
  }
  // ---- Singularität ----
  get singAvailable() { return !this.baseCps.isZero() && this.baseCps.log10() >= SING_MIN_LOG; }
  get singDiscount() { return (this.sing >= 25 ? 0.9 : 1) * (this.sing >= 500 ? 0.75 : 1); }
  get singCost() { return this.baseCps.mulN(SING_SECS * Math.pow(SING_COST, this.sing) * this.singDiscount); }
  get singPower() { return Math.pow(SING_POW, this.sing); }
  buySing() {
    if (!this.singAvailable) return false;
    const cost = this.singCost; if (cost.gt(this.cookies)) return false;
    this.cookies = this.cookies.sub(cost); this.sing++; this.recalc();
    return true;
  }
  // ---- Sound-Shop ----
  soundOwned(id) { return this.sounds.owned.includes(id); }
  buySound(id) {
    const d = soundDef(id); if (!d || this.soundOwned(id) || this.cookies.lt(d.cost)) return false;
    this.cookies = this.cookies.sub(d.cost); this.sounds.owned.push(id); return true;
  }
  selectSound(id) {
    const k = soundKind(id); if (!k || !this.soundOwned(id)) return false;
    this.sounds[k] = id; return true;
  }
  buffMult(type) { let m = 1; const t = Date.now(); for (const b of this.buffs) if (b.type === type && b.until > t) m *= b.mult; return m; }
  get cps() { return this.baseCps.mulN(this.buffMult('frenzy')).clamp(); }
  get clickValue() { return Big.fromLog(this.clickLog).add(this.baseCps.mulN(this.clickPct)).mulN(this.buffMult('click')).clamp(); }

  // ---- Gebäude ----
  buildingCost(i, amount = 1, owned = this.owned[i]) { return geoCost(BUILDINGS[i].base, GROWTH, owned, amount); }
  maxAffordable(i) { return geoMax(BUILDINGS[i].base, GROWTH, this.owned[i], this.cookies); }
  buyBuilding(i, amount) {
    if (amount === 'max') amount = this.maxAffordable(i);
    if (!(amount > 0)) return false;
    const cost = this.buildingCost(i, amount);
    if (cost.gt(this.cookies)) return false;
    this.cookies = this.cookies.sub(cost); this.owned[i] += amount; this.daily.prog.buildings += amount;
    this.updateCps();
    return true;
  }
  sellBuilding(i) {
    if (this.owned[i] <= 0) return false;
    this.owned[i]--; this.cookies = this.cookies.add(this.buildingCost(i, 1, this.owned[i]).mulN(0.5)).clamp();
    this.updateCps();
    return true;
  }

  // ---- Upgrades ----
  // tn/cn: Gesamt-Kekse bzw. Kekse als normale Zahl (bei Schleifen vorab berechnet; Infinity bei > 1e308)
  isVisible(id, tn = this.total.toNumber(), ce = this.chipsEarned.toNumber()) {
    if (this.bought[id]) return false;
    switch (KIND[id]) {
      case K.TIER: return this.owned[P1[id]] >= NEED[id];
      case K.SYN: return this.owned[P1[id]] >= NEED[id] && this.owned[P2[id]] >= NEED[id];
      case K.GOLDEN: return this.golden >= NEED[id] && tn >= COST[id] / 10;
      case K.HEAVEN: return ce >= Math.ceil(COST[id] / 2);
      default: return tn >= COST[id] / 10;
    }
  }
  canAfford(id, cn = this.cookies.toNumber(), av = this.chipsAvailable.toNumber()) { return KIND[id] === K.HEAVEN ? av >= COST[id] : cn >= COST[id]; }
  get chipsAvailable() { return this.chipsEarned.sub(this.chipsSpent); }
  // Sichtbare Upgrades (nach Preis sortiert): liefert die ersten `limit` IDs und die Gesamtzahl. kind = null oder Typ-Nummer.
  visibleList(heaven, kind = null, limit = 100) {
    const order = heaven ? ORDER_HEAVEN : ORDER_COOKIE; const ids = []; let total = 0; const tn = this.total.toNumber(); const ce = this.chipsEarned.toNumber();
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (kind !== null && KIND[id] !== kind) continue;
      if (!this.isVisible(id, tn, ce)) continue;
      if (ids.length < limit) ids.push(id);
      total++;
    }
    return { ids, total };
  }
  // defer=true: Gesamtproduktion erst später neu berechnen (für Sammelkäufe)
  buyUpgrade(id, defer = false) {
    if (!this.isVisible(id) || !this.canAfford(id)) return false;
    if (KIND[id] === K.HEAVEN) this.chipsSpent += COST[id]; else this.cookies = this.cookies.sub(COST[id]);
    this.bought[id] = 1; this.applyOne(id); this.daily.prog.upgrades++;
    if (!defer) this.updateCps();
    return true;
  }
  // heaven=true: himmlische Upgrades (Chips), sonst Cookie-Upgrades; kind = null oder Typ-Nummer
  buyAllAffordable(heaven = false, kind = null) {
    const order = heaven ? ORDER_HEAVEN : ORDER_COOKIE; let n = 0; let cn = this.cookies.toNumber(); let av = this.chipsAvailable.toNumber();
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (!heaven && COST[id] > cn) break; // nach Preis sortiert
      if (kind !== null && KIND[id] !== kind) continue;
      if (this.canAfford(id, cn, av) && this.buyUpgrade(id, true)) { n++; cn = this.cookies.toNumber(); av = this.chipsAvailable.toNumber(); }
    }
    if (n) this.updateCps();
    return n;
  }

  // ---- Aktionen ----
  earn(x) { x = Big.from(x); this.cookies = this.cookies.add(x).clamp(); this.total = this.total.add(x).clamp(); this.daily.prog.baked = this.daily.prog.baked.add(x); }
  click() { const v = this.clickValue; this.earn(v); this.clicks++; this.daily.prog.clicks++; return v; }

  // ---- Tägliche Aufgaben & Skins ----
  ensureDaily() {
    const today = dayKey(); const d = this.daily;
    if (d.date === today) return false;
    d.date = today; d.tasks = genTasks(today, this.baseCps); d.claimed = []; d.prog = { clicks: 0, golden: 0, buildings: 0, upgrades: 0, baked: ZERO };
    return true;
  }
  get streak() { const d = this.daily; return d.lastDone === dayKey() || d.lastDone === yesterdayKey() ? d.streak : 0; }
  dailyRewardCookies() { return this.baseCps.mulN(600).max(1000).mulN(1 + 0.1 * Math.min(this.streak, 10)); }
  dailyState() {
    const d = this.daily;
    return d.tasks.map((t, i) => {
      const claimed = d.claimed.includes(i);
      if (t.type === 'baked') { // Kekse können riesig sein: als Big vergleichen
        const tg = Big.parse(t.target), pr = Big.parse(d.prog.baked);
        return { ...t, i, target: tg, prog: pr.min(tg), ratio: Math.min(1, pr.div(tg).toNumber()), done: pr.gte(tg), claimed };
      }
      const pr = Math.min(t.target, d.prog[t.type] || 0);
      return { ...t, i, prog: pr, ratio: pr / t.target, done: (d.prog[t.type] || 0) >= t.target, claimed };
    });
  }
  claimableCount() { return this.dailyState().filter((t) => t.done && !t.claimed).length; }
  claimDaily(i) {
    const t = this.dailyState()[i]; if (!t || !t.done || t.claimed) return null;
    const reward = this.dailyRewardCookies(); this.cookies = this.cookies.add(reward).clamp(); this.daily.claimed.push(i);
    let bonus = null;
    if (this.daily.claimed.length >= this.daily.tasks.length && this.daily.lastDone !== dayKey()) {
      this.daily.streak = this.daily.lastDone === yesterdayKey() ? this.daily.streak + 1 : 1; this.daily.lastDone = dayKey();
      for (let k = 0; k < 3; k++) this.spawnGolden(null);
      bonus = this.dailyRewardCookies().mulN(3); this.cookies = this.cookies.add(bonus).clamp();
    }
    return { reward, bonus };
  }
  unlockStats() { return { ach: this.achCount(), golden: this.golden, totalAll: this.totalReset.add(this.total).toNumber(), ascensions: this.ascensions, upgrades: this.upgradeCount, buildings: this.owned.reduce((a, b) => a + b, 0), clicks: this.clicks, chips: this.chipsEarned.toNumber() }; }
  unlockedSkins() { const st = this.unlockStats(); return SKINS.filter((k) => k.need(st)).map((k) => k.id); }
  setSkin(id) { if (this.unlockedSkins().includes(id)) { this.skin = id; return true; } return false; }

  tick(dt) {
    const now = Date.now();
    this.buffs = this.buffs.filter((b) => b.until > now);
    this.earn(this.cps.mulN(dt));
    this.gcs = this.gcs.filter((g) => g.until > now);
    this.nextGolden -= dt;
    if (this.nextGolden <= 0) {
      this.nextGolden = (60 + Math.random() * 120) * this.gFreq;
      if (this.gcs.length < 40) this.spawnGolden();
    }
  }

  // effect: null = zufällig, sonst 'frenzy'|'lucky'|'click'|'jackpot'
  spawnGolden(effect = null) {
    const g = { id: ++this.gid, until: Date.now() + 13000 * this.gDur, x: 6 + Math.random() * 84, y: 8 + Math.random() * 74, effect };
    this.gcs.push(g);
    return g;
  }

  clickGolden(id) {
    const i = this.gcs.findIndex((g) => g.id === id);
    if (i < 0) return null;
    const [gc] = this.gcs.splice(i, 1); this.golden++; this.daily.prog.golden++;
    let effect = gc.effect;
    if (!effect) { const r = Math.random(); effect = r < 0.5 ? 'frenzy' : r < 0.8 ? 'lucky' : r < 0.95 ? 'click' : 'jackpot'; }
    const rw = this.gReward; const now = Date.now(); let msg;
    if (effect === 'frenzy') {
      const mult = this.gFrenzy; const s = 77 * this.gDur;
      this.buffs.push({ type: 'frenzy', mult, until: now + s * 1000 });
      msg = { kind: 'frenzy', text: `Raserei! Produktion ×${Math.round(mult * 10) / 10} für ${Math.round(s)} s` };
    } else if (effect === 'lucky') {
      const g = this.cookies.mulN(this.gLucky).min(this.baseCps.mulN(900)).mulN(rw).add(13);
      this.earn(g); msg = { kind: 'lucky', text: 'Glückstreffer!', gain: g };
    } else if (effect === 'click') {
      const s = 13 * this.gDur;
      this.buffs.push({ type: 'click', mult: 777, until: now + s * 1000 });
      msg = { kind: 'click', text: `Klick-Raserei! Klicks ×777 für ${Math.round(s)} s` };
    } else {
      const g = this.baseCps.mulN(600 * rw).add(13); this.earn(g); msg = { kind: 'jackpot', text: 'Jackpot!', gain: g };
    }
    return msg;
  }

  // Ereignis vom Admin anwenden; gibt einen Anzeigetext zurück
  applyEvent(ev) {
    switch (ev.type) {
      case 'golden': for (let i = 0; i < ev.count; i++) this.spawnGolden(ev.effect === 'random' ? null : ev.effect); return `${ev.count}× goldener Keks erscheint!`;
      case 'cookies': {
        const a = ev.amount; const neg = typeof a === 'string' ? /^\s*-/.test(a) : a < 0;
        const v = Big.parse(typeof a === 'string' ? a.replace(/^\s*-/, '') : Math.abs(a));
        this.cookies = neg ? this.cookies.sub(v) : this.cookies.add(v).clamp();
        return !neg ? 'Du bekommst Kekse geschenkt!' : 'Dir wurden Kekse abgezogen.';
      }
      case 'chips': this.chipsEarned = this.chipsEarned.add(ev.amount); this.updateCps(); return `+${ev.amount} Himmelschips!`;
      case 'building': this.owned[ev.b] += ev.amount; this.updateCps(); return `+${ev.amount}× ${BUILDINGS[ev.b].name}!`;
      case 'buff': this.buffs.push({ type: ev.kind, mult: ev.mult, until: Date.now() + ev.seconds * 1000 }); return `${ev.kind === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${ev.mult} für ${ev.seconds} s!`;
      case 'achievements': this.ach.fill(1); this.updateCps(); return 'Alle Erfolge freigeschaltet!';
      case 'upgrades':
        for (let i = 0; i < TOTAL_UPGRADES; i++) {
          if (ev.mode === 'none') { this.bought[i] = 0; this.series.fill(0); }
          else if (ev.mode === 'all' || (ev.mode === 'cookie' && i < HEAVEN_START) || (ev.mode === 'heaven' && i >= HEAVEN_START)) this.bought[i] = 1;
        }
        this.recalc(); return ev.mode === 'none' ? 'Alle Upgrades wurden entfernt.' : 'Upgrades freigeschaltet!';
      case 'message': {
        // Gebäude-Geschenk als Nachricht verpackt („🎁bld:<Nr.>:<Anzahl>“): funktioniert auch mit älteren Servern, die nur die ersten 15 Gebäude als eigenes Ereignis kennen
        const m = /^🎁bld:(\d{1,3}):(\d{1,6})$/.exec(String(ev.text || ''));
        if (m && +m[1] < BUILDINGS.length && +m[2] >= 1 && +m[2] <= 100000) { this.owned[+m[1]] += +m[2]; this.updateCps(); return `+${m[2]}× ${BUILDINGS[+m[1]].name}!`; }
        return ev.text;
      }
      case 'reset': { const n = this.name; this.hardReset(); this.name = n; return 'Dein Spielstand wurde zurückgesetzt.'; }
      default: return null;
    }
  }

  // ---- Aufstieg ----
  get chipsPotential() { // ³√(Gesamt-Kekse / 1e12), abgerundet – bei riesigen Werten über den Logarithmus
    const all = this.totalReset.add(this.total); const n = all.toNumber();
    if (n < 1e300) return Big.from(Math.floor(Math.cbrt(n / 1e12)));
    return Big.fromLog((all.log10() - 12) / 3).floor();
  }
  get chipsGain() { return this.chipsPotential.sub(this.chipsEarned); }
  ascend() {
    const gain = this.chipsGain;
    if (gain.lt(1)) return false;
    this.totalReset = this.totalReset.add(this.total).clamp(); this.chipsEarned = this.chipsEarned.add(gain); this.ascensions++;
    this.cookies = ZERO; this.total = ZERO;
    this.owned.fill(0);
    this.bought.fill(0, 0, HEAVEN_START); this.series.fill(0);
    this.buffs = []; this.gcs = []; this.nextGolden = 60;
    this.recalc();
    return true;
  }

  // ---- Erfolge ----
  checkAchievements() {
    this.ensureDaily();
    const s = { newKinds: this.owned.slice(BASE_COUNT).filter((n) => n > 0).length, newOwned: this.owned.slice(BASE_COUNT).reduce((a, b) => a + b, 0), sing: this.sing, seriesTotal: this.seriesTotal, owned: this.owned, totalAll: this.totalReset.add(this.total).toNumber(), cps: this.baseCps.toNumber(), clicks: this.clicks, golden: this.golden, upgradeCount: this.upgradeCount, ascensions: this.ascensions, chipsEarned: this.chipsEarned.toNumber() };
    const fresh = [];
    for (const a of ACH) if (!this.ach[a.id] && a.test(s)) { this.ach[a.id] = 1; fresh.push(a); }
    if (fresh.length) this.updateCps();
    return fresh;
  }

  // ---- Speichern ----
  serialize() {
    return {
      v: 2, name: this.name, cookies: this.cookies.toString(), total: this.total.toString(), totalReset: this.totalReset.toString(), clicks: this.clicks, golden: this.golden,
      owned: this.owned, bought: packBits(this.bought), ach: packBits(this.ach), ascensions: this.ascensions,
      sing: this.sing, chipsEarned: this.chipsEarned.toString(), chipsSpent: this.chipsSpent, start: this.start, last: Date.now(), skin: this.skin, daily: this.daily, sounds: this.sounds, series: this.series,
    };
  }
  load(d) {
    const num = (x, def = 0) => (Number.isFinite(x) && x >= 0 ? x : def);
    this.hardReset();
    this.name = typeof d.name === 'string' ? d.name.slice(0, 20) : 'Dein';
    this.cookies = Big.parse(d.cookies).clamp(); this.total = Big.parse(d.total).clamp(); this.totalReset = Big.parse(d.totalReset).clamp();
    this.clicks = num(d.clicks); this.golden = num(d.golden);
    if (Array.isArray(d.owned)) this.owned = BUILDINGS.map((_, i) => Math.floor(num(d.owned[i])));
    // Alte Spielstände (v1) hatten 10.000 Upgrades mit anderer Nummerierung: Käufe verfallen, Chips werden erstattet.
    if (d.v >= 2 && typeof d.bought === 'string') this.bought = unpackBits(d.bought, TOTAL_UPGRADES);
    if (typeof d.ach === 'string') { const a = unpackBits(d.ach, Math.max(ACH.length, 8)); this.ach = a.slice(0, ACH.length); }
    this.sing = Math.floor(num(d.sing));
    this.ascensions = num(d.ascensions); this.chipsEarned = Big.parse(d.chipsEarned); this.chipsSpent = d.v >= 2 ? num(d.chipsSpent) : 0;
    this.start = num(d.start, Date.now()); this.last = num(d.last, Date.now());
    if (typeof d.skin === 'string') this.skin = skinById(d.skin).id;
    if (Array.isArray(d.series)) this.series = Array.from({ length: SERIES_COUNT }, (_, i) => { const n = Number(d.series[i]); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), SERIES_LEVELS) : 0; });
    if (d.sounds && typeof d.sounds === 'object') {
      const own = Array.isArray(d.sounds.owned) ? d.sounds.owned.filter((id) => soundKind(id)) : [];
      this.sounds.owned = [...new Set(['classic', 'calm', ...own])];
      this.sounds.pack = soundKind(d.sounds.pack) === 'pack' && this.sounds.owned.includes(d.sounds.pack) ? d.sounds.pack : 'classic';
      this.sounds.track = soundKind(d.sounds.track) === 'track' && this.sounds.owned.includes(d.sounds.track) ? d.sounds.track : 'calm';
    }
    const dl = d.daily;
    if (dl && typeof dl.date === 'string' && Array.isArray(dl.tasks)) {
      this.daily = { date: dl.date, tasks: dl.tasks.filter((t) => t && typeof t.type === 'string' && (Number.isFinite(t.target) || (t.type === 'baked' && typeof t.target === 'string'))).slice(0, 3), claimed: Array.isArray(dl.claimed) ? dl.claimed.filter(Number.isInteger) : [], streak: num(dl.streak), lastDone: typeof dl.lastDone === 'string' ? dl.lastDone : '',
        prog: { clicks: num(dl.prog && dl.prog.clicks), golden: num(dl.prog && dl.prog.golden), buildings: num(dl.prog && dl.prog.buildings), upgrades: num(dl.prog && dl.prog.upgrades), baked: Big.parse(dl.prog && dl.prog.baked) } };
    }
    this.recalc();
    return this.catchUp((Date.now() - this.last) / 1000, 30);
  }

  // Offline-/Hintergrund-Ertrag: Zeit seit der letzten Aktivität nachholen
  catchUp(rawSecs, minSecs = 5) {
    const secs = Math.min(this.offlineCap, Math.max(0, rawSecs));
    let gain = ZERO;
    if (secs > minSecs && !this.baseCps.isZero()) { gain = this.baseCps.mulN(secs * this.offline); this.earn(gain); }
    return { offlineSecs: secs, gain };
  }
}
