import { BUILDINGS, GROWTH, UPGRADES, HEAVEN_START, ORDER_COOKIE, ORDER_HEAVEN, TOTAL_UPGRADES, buildAchievements } from './data.js';

export const ACH = buildAchievements();
const OFFLINE_CAP = 24 * 3600; // Basis-Limit; himmlische Upgrades erhöhen es

const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const packBits = (arr) => { const out = new Uint8Array(Math.ceil(arr.length / 8)); arr.forEach((v, i) => { if (v) out[i >> 3] |= 1 << (i & 7); }); return toB64(out); };
const unpackBits = (str, len) => { const bytes = fromB64(str); const out = new Uint8Array(len); for (let i = 0; i < len; i++) out[i] = (bytes[i >> 3] >> (i & 7)) & 1; return out; };

export class Game {
  constructor() {
    this.name = 'Dein';
    this.hardReset();
  }

  hardReset() {
    this.cookies = 0; this.total = 0; this.totalReset = 0; this.clicks = 0; this.golden = 0;
    this.owned = new Array(BUILDINGS.length).fill(0);
    this.bought = new Uint8Array(TOTAL_UPGRADES);
    this.ach = new Uint8Array(ACH.length);
    this.ascensions = 0; this.chipsEarned = 0; this.chipsSpent = 0;
    this.start = Date.now(); this.last = Date.now();
    this.buffs = []; this.gcs = []; this.gid = 0; this.nextGolden = 60;
    this.recalc();
  }

  // ---- Berechnung aller Boni ----
  recalc() {
    const n = BUILDINGS.length;
    this.tierMult = new Array(n).fill(1);
    this.syn = Array.from({ length: n }, () => []);
    this.globalMult = 1; this.clickMult = 1; this.clickPct = 0;
    this.gFreq = 1; this.gDur = 1; this.gReward = 1; this.gLucky = 0.15; this.gFrenzy = 7; this.offline = 1; this.offlineCap = OFFLINE_CAP;
    this.upgradeCount = 0;
    for (let id = 0; id < TOTAL_UPGRADES; id++) {
      if (!this.bought[id]) continue;
      this.upgradeCount++;
      const u = UPGRADES[id];
      switch (u.kind) {
        case 'tier': this.tierMult[u.b] *= u.mult; break;
        case 'click': this.clickMult *= u.mult || 1; this.clickPct += u.add || 0; break;
        case 'global': this.globalMult *= u.mult; break;
        case 'syn': this.syn[u.a].push([u.b, u.level]); break;
        case 'golden':
          if (u.type === 0) this.gFreq = Math.max(0.2, this.gFreq * 0.99);
          else if (u.type === 1) this.gDur *= 1.02;
          else if (u.type === 2) this.gReward *= 1.02;
          else if (u.type === 3) this.gLucky += 0.02;
          else this.gFrenzy *= 1.01;
          break;
        case 'heaven':
          if (u.type === 0) this.globalMult *= 1.02;
          else if (u.type === 1) this.clickMult *= 1.05;
          else if (u.type === 2) this.gFreq = Math.max(0.2, this.gFreq * 0.99);
          else this.offlineCap += 600;
          break;
        default: break;
      }
    }
    this.updateCps();
  }

  achCount() { let c = 0; for (const v of this.ach) c += v; return c; }

  updateCps() {
    let sum = 0;
    for (let b = 0; b < BUILDINGS.length; b++) {
      if (!this.owned[b]) continue;
      let syn = 1;
      for (const [o, lvl] of this.syn[b]) syn += 0.0005 * lvl * this.owned[o];
      sum += BUILDINGS[b].cps * this.owned[b] * this.tierMult[b] * syn;
    }
    this.baseCps = sum * this.globalMult * (1 + 0.01 * this.chipsEarned) * (1 + 0.002 * this.achCount());
  }

  buffMult(type) { let m = 1; const t = Date.now(); for (const b of this.buffs) if (b.type === type && b.until > t) m *= b.mult; return m; }
  get cps() { return this.baseCps * this.buffMult('frenzy'); }
  get clickValue() { return (this.clickMult + this.baseCps * this.clickPct) * this.buffMult('click'); }

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
    this.cookies -= cost; this.owned[i] += amount;
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
    const u = UPGRADES[id];
    switch (u.kind) {
      case 'tier': return this.owned[u.b] >= u.need;
      case 'syn': return this.owned[u.a] >= u.need && this.owned[u.b] >= u.need;
      case 'golden': return this.golden >= u.goldReq && this.total >= u.cost / 10;
      case 'heaven': return this.chipsEarned >= Math.ceil(u.cost / 2);
      default: return this.total >= u.cost / 10;
    }
  }
  canAfford(id) { const u = UPGRADES[id]; return u.kind === 'heaven' ? this.chipsAvailable >= u.cost : this.cookies >= u.cost; }
  get chipsAvailable() { return this.chipsEarned - this.chipsSpent; }
  visibleUpgrades(heaven) {
    const order = heaven ? ORDER_HEAVEN : ORDER_COOKIE;
    const out = [];
    for (const id of order) if (this.isVisible(id)) out.push(id);
    return out;
  }
  buyUpgrade(id) {
    if (!this.isVisible(id) || !this.canAfford(id)) return false;
    const u = UPGRADES[id];
    if (u.kind === 'heaven') this.chipsSpent += u.cost; else this.cookies -= u.cost;
    this.bought[id] = 1;
    this.recalc();
    return true;
  }
  // heaven=true: himmlische Upgrades (Chips), sonst Cookie-Upgrades
  buyAllAffordable(heaven = false) {
    let n = 0;
    for (const id of this.visibleUpgrades(heaven)) if (this.canAfford(id) && this.buyUpgrade(id)) n++;
    return n;
  }

  // ---- Aktionen ----
  earn(x) { this.cookies += x; this.total += x; }
  click() { const v = this.clickValue; this.earn(v); this.clicks++; return v; }

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
    const [gc] = this.gcs.splice(i, 1); this.golden++;
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
    for (let i = 0; i < HEAVEN_START; i++) this.bought[i] = 0;
    this.buffs = []; this.gcs = []; this.nextGolden = 60;
    this.recalc();
    return true;
  }

  // ---- Erfolge ----
  checkAchievements() {
    const s = { owned: this.owned, totalAll: this.totalReset + this.total, cps: this.baseCps, clicks: this.clicks, golden: this.golden, upgradeCount: this.upgradeCount, ascensions: this.ascensions, chipsEarned: this.chipsEarned };
    const fresh = [];
    for (const a of ACH) if (!this.ach[a.id] && a.test(s)) { this.ach[a.id] = 1; fresh.push(a); }
    if (fresh.length) this.updateCps();
    return fresh;
  }

  // ---- Speichern ----
  serialize() {
    return {
      v: 1, name: this.name, cookies: this.cookies, total: this.total, totalReset: this.totalReset, clicks: this.clicks, golden: this.golden,
      owned: this.owned, bought: packBits(this.bought), ach: packBits(this.ach), ascensions: this.ascensions,
      chipsEarned: this.chipsEarned, chipsSpent: this.chipsSpent, start: this.start, last: Date.now(),
    };
  }
  load(d) {
    const num = (x, def = 0) => (Number.isFinite(x) && x >= 0 ? x : def);
    this.hardReset();
    this.name = typeof d.name === 'string' ? d.name.slice(0, 20) : 'Dein';
    this.cookies = num(d.cookies); this.total = num(d.total); this.totalReset = num(d.totalReset);
    this.clicks = num(d.clicks); this.golden = num(d.golden);
    if (Array.isArray(d.owned)) this.owned = BUILDINGS.map((_, i) => Math.floor(num(d.owned[i])));
    if (typeof d.bought === 'string') this.bought = unpackBits(d.bought, TOTAL_UPGRADES);
    if (typeof d.ach === 'string') { const a = unpackBits(d.ach, Math.max(ACH.length, 8)); this.ach = a.slice(0, ACH.length); }
    this.ascensions = num(d.ascensions); this.chipsEarned = num(d.chipsEarned); this.chipsSpent = num(d.chipsSpent);
    this.start = num(d.start, Date.now()); this.last = num(d.last, Date.now());
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
