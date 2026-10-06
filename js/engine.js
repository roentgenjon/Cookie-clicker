import { SKINS, skinById, dayKey, yesterdayKey, genTasks, ITEMS, itemById, itemMultiplier, itemCost, itemMaxAffordable } from './extras.js';
import { BUILDINGS, GROWTH, HEAVEN_START, ORDER_COOKIE, ORDER_HEAVEN, TOTAL_UPGRADES, KIND, COST, P1, P2, NEED, EFFECT, K, LEVEL, buildAchievements } from './data.js';

export const ACH = buildAchievements();
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
    this.cookies = 0; this.total = 0; this.totalReset = 0; this.clicks = 0; this.golden = 0;
    this.owned = new Array(BUILDINGS.length).fill(0);
    this.bought = new Uint8Array(TOTAL_UPGRADES);
    this.upgradeCount = 0;
    this.ach = new Uint8Array(ACH.length);
    this.ascensions = 0; this.chipsEarned = 0; this.chipsSpent = 0;
    this.start = Date.now(); this.last = Date.now();
    this.skin = 'classic';
    this.items = {}; // gekaufte Shop-Items { id: Anzahl } (bleiben beim Aufstieg)
    this.daily = { date: '', tasks: [], prog: { clicks: 0, golden: 0, buildings: 0, upgrades: 0, baked: 0 }, claimed: [], streak: 0, lastDone: '' };
    this.buffs = []; this.gcs = []; this.gid = 0; this.nextGolden = 60;
    this.recalc();
  }

  // ---- Berechnung aller Boni ----
  resetAgg() {
    const n = BUILDINGS.length;
    this.tierMult = new Array(n).fill(1);
    this.synW = Array.from({ length: n }, () => new Array(n).fill(0)); // Synergie-Gewichte [A][B]
    this.globalMult = 1; this.clickMult = 1; this.clickPct = 0;
    this.gFreq = 1; this.gDur = 1; this.gReward = 1; this.gLucky = 0.15; this.gFrenzy = 7; this.offline = 1; this.offlineCap = OFFLINE_CAP;
    this.upgradeCount = 0;
  }
  // Wirkung eines einzelnen gekauften Upgrades auf die Summen
  applyOne(id) {
    this.upgradeCount++;
    const p1 = P1[id];
    switch (KIND[id]) {
      case K.TIER: this.tierMult[p1] *= LEVEL[id] <= 10 ? EFFECT.tierBig : EFFECT.tierSmall; break;
      case K.CLICK: if (p1) this.clickPct += EFFECT.clickPct; else this.clickMult *= EFFECT.click; break;
      case K.GLOBAL: this.globalMult *= EFFECT.global; break;
      case K.SYN: this.synW[p1][P2[id]] += EFFECT.syn; break;
      case K.GOLDEN:
        if (p1 === 0) this.gFreq = Math.max(0.2, this.gFreq * EFFECT.gFreq);
        else if (p1 === 1) this.gDur *= EFFECT.gDur;
        else if (p1 === 2) this.gReward *= EFFECT.gReward;
        else if (p1 === 3) this.gLucky += EFFECT.gLucky;
        else this.gFrenzy *= EFFECT.gFrenzy;
        break;
      default:
        if (p1 === 0) this.globalMult *= EFFECT.hGlobal;
        else if (p1 === 1) this.clickMult *= EFFECT.hClick;
        else if (p1 === 2) this.gFreq = Math.max(0.2, this.gFreq * EFFECT.hFreq);
        else this.offlineCap += EFFECT.hOffline;
    }
  }
  recalc() {
    this.resetAgg();
    for (let id = 0; id < TOTAL_UPGRADES; id++) if (this.bought[id]) this.applyOne(id);
    this.updateCps();
  }

  achCount() { let c = 0; for (const v of this.ach) c += v; return c; }

  updateCps() {
    let sum = 0;
    for (let b = 0; b < BUILDINGS.length; b++) {
      if (!this.owned[b]) continue;
      let syn = 1; const w = this.synW[b];
      for (let o = 0; o < w.length; o++) if (w[o]) syn += w[o] * this.owned[o];
      sum += BUILDINGS[b].cps * this.owned[b] * this.tierMult[b] * syn;
    }
    this.baseCps = sum * this.globalMult * (1 + 0.01 * this.chipsEarned) * (1 + 0.002 * this.achCount()) * this.itemMult;
  }
  get itemMult() { return itemMultiplier(this.items); }
  itemCount(id) { return this.items[id] || 0; }
  // n = Anzahl oder 'max'
  buyItem(id, n = 1) {
    const it = itemById(id); if (!it) return 0;
    const have = this.itemCount(id);
    if (n === 'max') n = itemMaxAffordable(it, have, this.cookies);
    if (!(n >= 1)) return 0;
    const cost = itemCost(it, have, n);
    if (cost > this.cookies) return 0;
    this.cookies -= cost; this.items[id] = have + n; this.updateCps();
    return n;
  }
  buffMult(type) { let m = 1; const t = Date.now(); for (const b of this.buffs) if (b.type === type && b.until > t) m *= b.mult; return m; }
  get cps() { return this.baseCps * this.buffMult('frenzy'); }
  get clickValue() { return (this.clickMult + this.baseCps * this.clickPct) * this.buffMult('click') * this.itemMult; }

  // ---- Gebäude ----
  buildingCost(i, amount = 1, owned = this.owned[i]) {
    return BUILDINGS[i].base * Math.pow(GROWTH, owned) * (Math.pow(GROWTH, amount) - 1) / (GROWTH - 1);
  }
  maxAffordable(i) {
    const o = this.owned[i];
    const n = Math.floor(Math.log(1 + (this.cookies * (GROWTH - 1)) / (BUILDINGS[i].base * Math.pow(GROWTH, o))) / Math.log(GROWTH));
    return Math.max(0, n);
  }
  buyBuilding(i, amount) {
    if (amount === 'max') amount = this.maxAffordable(i);
    if (!(amount > 0)) return false;
    const cost = this.buildingCost(i, amount);
    if (cost > this.cookies + 1e-9) return false;
    this.cookies -= cost; this.owned[i] += amount; this.daily.prog.buildings += amount;
    this.updateCps();
    return true;
  }
  sellBuilding(i) {
    if (this.owned[i] <= 0) return false;
    this.owned[i]--; this.cookies += this.buildingCost(i, 1) * 0.5;
    this.updateCps();
    return true;
  }

  // ---- Upgrades ----
  isVisible(id) {
    if (this.bought[id]) return false;
    switch (KIND[id]) {
      case K.TIER: return this.owned[P1[id]] >= NEED[id];
      case K.SYN: return this.owned[P1[id]] >= NEED[id] && this.owned[P2[id]] >= NEED[id];
      case K.GOLDEN: return this.golden >= NEED[id] && this.total >= COST[id] / 10;
      case K.HEAVEN: return this.chipsEarned >= Math.ceil(COST[id] / 2);
      default: return this.total >= COST[id] / 10;
    }
  }
  canAfford(id) { return KIND[id] === K.HEAVEN ? this.chipsAvailable >= COST[id] : this.cookies >= COST[id]; }
  get chipsAvailable() { return this.chipsEarned - this.chipsSpent; }
  // Sichtbare Upgrades (nach Preis sortiert): liefert die ersten `limit` IDs und die Gesamtzahl. kind = null oder Typ-Nummer.
  visibleList(heaven, kind = null, limit = 100) {
    const order = heaven ? ORDER_HEAVEN : ORDER_COOKIE; const ids = []; let total = 0;
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (kind !== null && KIND[id] !== kind) continue;
      if (!this.isVisible(id)) continue;
      if (ids.length < limit) ids.push(id);
      total++;
    }
    return { ids, total };
  }
  // defer=true: Gesamtproduktion erst später neu berechnen (für Sammelkäufe)
  buyUpgrade(id, defer = false) {
    if (!this.isVisible(id) || !this.canAfford(id)) return false;
    if (KIND[id] === K.HEAVEN) this.chipsSpent += COST[id]; else this.cookies -= COST[id];
    this.bought[id] = 1; this.applyOne(id); this.daily.prog.upgrades++;
    if (!defer) this.updateCps();
    return true;
  }
  // heaven=true: himmlische Upgrades (Chips), sonst Cookie-Upgrades; kind = null oder Typ-Nummer
  buyAllAffordable(heaven = false, kind = null) {
    const order = heaven ? ORDER_HEAVEN : ORDER_COOKIE; let n = 0;
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (!heaven && COST[id] > this.cookies) break; // nach Preis sortiert
      if (kind !== null && KIND[id] !== kind) continue;
      if (this.canAfford(id) && this.buyUpgrade(id, true)) n++;
    }
    if (n) this.updateCps();
    return n;
  }

  // ---- Aktionen ----
  earn(x) { this.cookies += x; this.total += x; this.daily.prog.baked += x; }
  click() { const v = this.clickValue; this.earn(v); this.clicks++; this.daily.prog.clicks++; return v; }

  // ---- Tägliche Aufgaben & Skins ----
  ensureDaily() {
    const today = dayKey(); const d = this.daily;
    if (d.date === today) return false;
    d.date = today; d.tasks = genTasks(today, this.baseCps || 0); d.claimed = []; d.prog = { clicks: 0, golden: 0, buildings: 0, upgrades: 0, baked: 0 };
    return true;
  }
  get streak() { const d = this.daily; return d.lastDone === dayKey() || d.lastDone === yesterdayKey() ? d.streak : 0; }
  dailyRewardCookies() { return Math.max(1000, this.baseCps * 600) * (1 + 0.1 * Math.min(this.streak, 10)); }
  dailyState() { const d = this.daily; return d.tasks.map((t, i) => ({ ...t, i, prog: Math.min(t.target, d.prog[t.type] || 0), done: (d.prog[t.type] || 0) >= t.target, claimed: d.claimed.includes(i) })); }
  claimableCount() { return this.dailyState().filter((t) => t.done && !t.claimed).length; }
  claimDaily(i) {
    const t = this.dailyState()[i]; if (!t || !t.done || t.claimed) return null;
    const reward = this.dailyRewardCookies(); this.cookies += reward; this.daily.claimed.push(i);
    let bonus = null;
    if (this.daily.claimed.length >= this.daily.tasks.length && this.daily.lastDone !== dayKey()) {
      this.daily.streak = this.daily.lastDone === yesterdayKey() ? this.daily.streak + 1 : 1; this.daily.lastDone = dayKey();
      for (let k = 0; k < 3; k++) this.spawnGolden(null);
      bonus = this.dailyRewardCookies() * 3; this.cookies += bonus;
    }
    return { reward, bonus };
  }
  unlockStats() { return { ach: this.achCount(), golden: this.golden, totalAll: this.totalReset + this.total, ascensions: this.ascensions, upgrades: this.upgradeCount, buildings: this.owned.reduce((a, b) => a + b, 0), clicks: this.clicks, chips: this.chipsEarned, items: this.items, itemCount: Object.keys(this.items).length, itemTotal: Object.values(this.items).reduce((a, b) => a + b, 0) }; }
  unlockedSkins() { const st = this.unlockStats(); return SKINS.filter((k) => k.need(st)).map((k) => k.id); }
  setSkin(id) { if (this.unlockedSkins().includes(id)) { this.skin = id; return true; } return false; }

  tick(dt) {
    const now = Date.now();
    this.buffs = this.buffs.filter((b) => b.until > now);
    this.earn(this.cps * dt);
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
      const g = Math.min(this.cookies * this.gLucky, this.baseCps * 900) * rw + 13;
      this.earn(g); msg = { kind: 'lucky', text: 'Glückstreffer!', gain: g };
    } else if (effect === 'click') {
      const s = 13 * this.gDur;
      this.buffs.push({ type: 'click', mult: 777, until: now + s * 1000 });
      msg = { kind: 'click', text: `Klick-Raserei! Klicks ×777 für ${Math.round(s)} s` };
    } else {
      const g = this.baseCps * 600 * rw + 13; this.earn(g); msg = { kind: 'jackpot', text: 'Jackpot!', gain: g };
    }
    return msg;
  }

  // Ereignis vom Admin anwenden; gibt einen Anzeigetext zurück
  applyEvent(ev) {
    switch (ev.type) {
      case 'golden': for (let i = 0; i < ev.count; i++) this.spawnGolden(ev.effect === 'random' ? null : ev.effect); return `${ev.count}× goldener Keks erscheint!`;
      case 'cookies': this.cookies = Math.max(0, this.cookies + ev.amount); return ev.amount >= 0 ? 'Du bekommst Kekse geschenkt!' : 'Dir wurden Kekse abgezogen.';
      case 'chips': this.chipsEarned += ev.amount; this.updateCps(); return `+${ev.amount} Himmelschips!`;
      case 'building': this.owned[ev.b] += ev.amount; this.updateCps(); return `+${ev.amount}× ${BUILDINGS[ev.b].name}!`;
      case 'buff': this.buffs.push({ type: ev.kind, mult: ev.mult, until: Date.now() + ev.seconds * 1000 }); return `${ev.kind === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${ev.mult} für ${ev.seconds} s!`;
      case 'achievements': this.ach.fill(1); this.updateCps(); return 'Alle Erfolge freigeschaltet!';
      case 'upgrades':
        for (let i = 0; i < TOTAL_UPGRADES; i++) {
          if (ev.mode === 'none') this.bought[i] = 0;
          else if (ev.mode === 'all' || (ev.mode === 'cookie' && i < HEAVEN_START) || (ev.mode === 'heaven' && i >= HEAVEN_START)) this.bought[i] = 1;
        }
        this.recalc(); return ev.mode === 'none' ? 'Alle Upgrades wurden entfernt.' : 'Upgrades freigeschaltet!';
      case 'message': return ev.text;
      case 'reset': { const n = this.name; this.hardReset(); this.name = n; return 'Dein Spielstand wurde zurückgesetzt.'; }
      default: return null;
    }
  }

  // ---- Aufstieg ----
  get chipsPotential() { return Math.floor(Math.cbrt((this.totalReset + this.total) / 1e12)); }
  get chipsGain() { return Math.max(0, this.chipsPotential - this.chipsEarned); }
  ascend() {
    const gain = this.chipsGain;
    if (gain < 1) return false;
    this.totalReset += this.total; this.chipsEarned += gain; this.ascensions++;
    this.cookies = 0; this.total = 0;
    this.owned.fill(0);
    this.bought.fill(0, 0, HEAVEN_START);
    this.buffs = []; this.gcs = []; this.nextGolden = 60;
    this.recalc();
    return true;
  }

  // ---- Erfolge ----
  checkAchievements() {
    this.ensureDaily();
    const s = { itemCount: Object.keys(this.items).length, itemTotal: Object.values(this.items).reduce((a, b) => a + b, 0), owned: this.owned, totalAll: this.totalReset + this.total, cps: this.baseCps, clicks: this.clicks, golden: this.golden, upgradeCount: this.upgradeCount, ascensions: this.ascensions, chipsEarned: this.chipsEarned };
    const fresh = [];
    for (const a of ACH) if (!this.ach[a.id] && a.test(s)) { this.ach[a.id] = 1; fresh.push(a); }
    if (fresh.length) this.updateCps();
    return fresh;
  }

  // ---- Speichern ----
  serialize() {
    return {
      v: 2, name: this.name, cookies: this.cookies, total: this.total, totalReset: this.totalReset, clicks: this.clicks, golden: this.golden,
      owned: this.owned, bought: packBits(this.bought), ach: packBits(this.ach), ascensions: this.ascensions,
      chipsEarned: this.chipsEarned, chipsSpent: this.chipsSpent, start: this.start, last: Date.now(), skin: this.skin, daily: this.daily, items: this.items,
    };
  }
  load(d) {
    const num = (x, def = 0) => (Number.isFinite(x) && x >= 0 ? x : def);
    this.hardReset();
    this.name = typeof d.name === 'string' ? d.name.slice(0, 20) : 'Dein';
    this.cookies = num(d.cookies); this.total = num(d.total); this.totalReset = num(d.totalReset);
    this.clicks = num(d.clicks); this.golden = num(d.golden);
    if (Array.isArray(d.owned)) this.owned = BUILDINGS.map((_, i) => Math.floor(num(d.owned[i])));
    // Alte Spielstände (v1) hatten 10.000 Upgrades mit anderer Nummerierung: Käufe verfallen, Chips werden erstattet.
    if (d.v >= 2 && typeof d.bought === 'string') this.bought = unpackBits(d.bought, TOTAL_UPGRADES);
    if (typeof d.ach === 'string') { const a = unpackBits(d.ach, Math.max(ACH.length, 8)); this.ach = a.slice(0, ACH.length); }
    this.ascensions = num(d.ascensions); this.chipsEarned = num(d.chipsEarned); this.chipsSpent = d.v >= 2 ? num(d.chipsSpent) : 0;
    this.start = num(d.start, Date.now()); this.last = num(d.last, Date.now());
    if (typeof d.skin === 'string') this.skin = skinById(d.skin).id;
    if (Array.isArray(d.items)) { this.items = {}; for (const id of d.items) if (itemById(id)) this.items[id] = 1; } // alte Spielstände: je 1
    else if (d.items && typeof d.items === 'object') { this.items = {}; for (const [id, n] of Object.entries(d.items)) if (itemById(id) && Number.isInteger(n) && n > 0) this.items[id] = Math.min(n, 1e9); }
    const dl = d.daily;
    if (dl && typeof dl.date === 'string' && Array.isArray(dl.tasks)) {
      this.daily = { date: dl.date, tasks: dl.tasks.filter((t) => t && typeof t.type === 'string' && Number.isFinite(t.target)).slice(0, 3), claimed: Array.isArray(dl.claimed) ? dl.claimed.filter(Number.isInteger) : [], streak: num(dl.streak), lastDone: typeof dl.lastDone === 'string' ? dl.lastDone : '',
        prog: { clicks: num(dl.prog && dl.prog.clicks), golden: num(dl.prog && dl.prog.golden), buildings: num(dl.prog && dl.prog.buildings), upgrades: num(dl.prog && dl.prog.upgrades), baked: num(dl.prog && dl.prog.baked) } };
    }
    this.recalc();
    return this.catchUp((Date.now() - this.last) / 1000, 30);
  }

  // Offline-/Hintergrund-Ertrag: Zeit seit der letzten Aktivität nachholen
  catchUp(rawSecs, minSecs = 5) {
    const secs = Math.min(this.offlineCap, Math.max(0, rawSecs));
    let gain = 0;
    if (secs > minSecs && this.baseCps > 0) { gain = this.baseCps * secs * this.offline; this.earn(gain); }
    return { offlineSecs: secs, gain };
  }
}
