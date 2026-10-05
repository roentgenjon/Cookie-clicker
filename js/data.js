// Spieldaten: Gebäude, 400.000 Upgrades (kompakte Datenfelder, Namen werden bei Bedarf erzeugt) und Erfolge.

export const BUILDINGS = [
  { name: 'Cursor', icon: '👆', base: 15, cps: 0.1 },
  { name: 'Oma', icon: '👵', base: 100, cps: 1 },
  { name: 'Farm', icon: '🌾', base: 1100, cps: 8 },
  { name: 'Mine', icon: '⛏️', base: 12000, cps: 47 },
  { name: 'Fabrik', icon: '🏭', base: 130000, cps: 260 },
  { name: 'Bank', icon: '🏦', base: 1.4e6, cps: 1400 },
  { name: 'Tempel', icon: '⛪', base: 2e7, cps: 7800 },
  { name: 'Zauberturm', icon: '🧙', base: 3.3e8, cps: 44000 },
  { name: 'Raumschiff', icon: '🚀', base: 5.1e9, cps: 260000 },
  { name: 'Alchemielabor', icon: '⚗️', base: 7.5e10, cps: 1.6e6 },
  { name: 'Portal', icon: '🌀', base: 1e12, cps: 1e7 },
  { name: 'Zeitmaschine', icon: '⏳', base: 1.4e13, cps: 6.5e7 },
  { name: 'Antimaterie-Kondensator', icon: '⚛️', base: 1.7e14, cps: 4.3e8 },
  { name: 'Prisma', icon: '🌈', base: 2.1e15, cps: 2.9e9 },
  { name: 'Glücksbringer', icon: '🍀', base: 2.6e16, cps: 2.1e10 },
];
export const GROWTH = 1.15;

// ---- Upgrades: 400.000 Stück, als kompakte Typed Arrays gespeichert ----
export const COUNTS = { tier: 114000, click: 60000, global: 100000, syn: 42000, golden: 34000, heaven: 50000 };
export const TOTAL_UPGRADES = 400000;
export const PER_BUILDING = COUNTS.tier / BUILDINGS.length; // 7.600 je Gebäude
export const SYN_LEVELS = COUNTS.syn / (BUILDINGS.length * (BUILDINGS.length - 1)); // 200
export const K = { TIER: 0, CLICK: 1, GLOBAL: 2, SYN: 3, GOLDEN: 4, HEAVEN: 5 };
export const KIND_NAMES = ['tier', 'click', 'global', 'syn', 'golden', 'heaven'];
const START = {}; { let o = 0; for (const [n, c] of Object.entries(COUNTS)) { START[n] = o; o += c; } }
export const HEAVEN_START = START.heaven; // ab hier: himmlische Upgrades (kosten Chips)
export const SCALE = 40; // jeder Effekt ist die 40. Wurzel des früheren Werts (40× mehr Upgrades)

// Effekte je Upgrade
export const EFFECT = {
  tierBig: 2, // erste 10 Stufen je Gebäude
  tierSmall: Math.pow(1.05, 1 / SCALE),
  click: Math.pow(1.08, 1 / SCALE),
  clickPct: 0.001 / SCALE,
  global: Math.pow(1.02, 1 / SCALE),
  syn: 0.00004, // pro Upgrade und pro besessenem Gebäude der Gegenseite
  gFreq: Math.pow(0.99, 1 / SCALE),
  gDur: Math.pow(1.02, 1 / SCALE),
  gReward: Math.pow(1.02, 1 / SCALE),
  gLucky: 0.02 / SCALE,
  gFrenzy: Math.pow(1.01, 1 / SCALE),
  hGlobal: Math.pow(1.02, 1 / SCALE),
  hClick: Math.pow(1.05, 1 / SCALE),
  hFreq: Math.pow(0.99, 1 / SCALE),
  hOffline: 600 / SCALE, // Sekunden Offline-Limit
};

export const KIND = new Uint8Array(TOTAL_UPGRADES);
export const COST = new Float64Array(TOTAL_UPGRADES);
export const P1 = new Uint16Array(TOTAL_UPGRADES); // tier: Gebäude · click: 1 = Prozent · syn: A · golden/heaven: Typ
export const P2 = new Uint16Array(TOTAL_UPGRADES); // syn: B
export const NEED = new Uint32Array(TOTAL_UPGRADES); // tier/syn: benötigte Anzahl · golden: benötigte goldene Kekse
export const LEVEL = new Uint32Array(TOTAL_UPGRADES); // laufende Nummer innerhalb der Gruppe (ab 1)

function tierNeed(k) { return k === 1 ? 1 : k === 2 ? 5 : k === 3 ? 10 : k <= 190 ? 10 + (k - 3) * 2 : 384 + Math.floor((k - 190) / 40); }
(function build() {
  const NB = BUILDINGS.length;
  for (let b = 0; b < NB; b++) for (let k = 1; k <= PER_BUILDING; k++) {
    const id = START.tier + b * PER_BUILDING + (k - 1); const need = tierNeed(k);
    KIND[id] = K.TIER; P1[id] = b; NEED[id] = need; LEVEL[id] = k;
    COST[id] = Math.round(BUILDINGS[b].base * 5 * Math.pow(GROWTH, need) * (k > 190 ? 1 + ((k - 190) % 40) * 0.01 : 1));
  }
  const rC = Math.pow(10, 23 / COUNTS.click);
  for (let k = 0; k < COUNTS.click; k++) { const id = START.click + k; KIND[id] = K.CLICK; P1[id] = k % 3 === 2 ? 1 : 0; LEVEL[id] = k + 1; COST[id] = Math.round(100 * Math.pow(rC, k)); }
  const rG = Math.pow(10, 30 / COUNTS.global);
  for (let k = 0; k < COUNTS.global; k++) { const id = START.global + k; KIND[id] = K.GLOBAL; LEVEL[id] = k + 1; COST[id] = Math.round(500 * Math.pow(rG, k)); }
  let idx = 0;
  for (let l = 1; l <= SYN_LEVELS; l++) for (let a = 0; a < NB; a++) for (let b = 0; b < NB; b++) {
    if (a === b) continue;
    const id = START.syn + idx++; KIND[id] = K.SYN; P1[id] = a; P2[id] = b; LEVEL[id] = l; NEED[id] = 10 + l;
    COST[id] = Math.round(Math.max(BUILDINGS[a].base, BUILDINGS[b].base) * 50 * Math.pow(l, 2.5));
  }
  const rK = Math.pow(10, 28 / COUNTS.golden);
  for (let k = 0; k < COUNTS.golden; k++) { const id = START.golden + k; KIND[id] = K.GOLDEN; P1[id] = k % 5; LEVEL[id] = k + 1; NEED[id] = Math.floor(k / 400); COST[id] = Math.round(7777 * Math.pow(rK, k)); }
  for (let k = 0; k < COUNTS.heaven; k++) { const id = START.heaven + k; KIND[id] = K.HEAVEN; P1[id] = k % 4; LEVEL[id] = k + 1; COST[id] = Math.max(1, Math.round(Math.pow(1.0075, k / SCALE))); }
})();

// Reihenfolge nach Preis (Cookie-Upgrades) bzw. ID (himmlisch, bereits nach Preis aufsteigend)
export const ORDER_COOKIE = Uint32Array.from({ length: HEAVEN_START }, (_, i) => i).sort((x, y) => COST[x] - COST[y] || x - y);
export const ORDER_HEAVEN = Uint32Array.from({ length: COUNTS.heaven }, (_, i) => HEAVEN_START + i);

const PREFIX = ['Verbessertes', 'Poliertes', 'Geheimes', 'Uraltes', 'Verzaubertes', 'Vergoldetes', 'Mystisches', 'Turbo', 'Mega', 'Ultra', 'Königliches', 'Kosmisches', 'Legendäres', 'Perfektioniertes', 'Handgemachtes', 'Biologisches', 'Quanten', 'Diamant', 'Zuckriges', 'Knuspriges'];
const KITCHEN = ['Butter', 'Zucker', 'Schokolade', 'Vanille', 'Zimt', 'Mandel', 'Haselnuss', 'Karamell', 'Honig', 'Marzipan', 'Ahornsirup', 'Kakao', 'Kokos', 'Ingwer', 'Pistazie', 'Lavendel', 'Muskat', 'Safran', 'Lebkuchen', 'Mokka'];
const GOLD = ['Frequenz', 'Dauer', 'Belohnung', 'Glück', 'Rausch'];
const HEAVEN = ['Himmlische Macht', 'Göttlicher Klick', 'Engelsglück', 'Ewige Ruhe'];
const pct = (x, d = 3) => ((x - 1) * 100).toFixed(d).replace('.', ',');

// Vollständiges Upgrade-Objekt (Name, Beschreibung, Icon) – wird nur bei Bedarf erzeugt.
export function upgrade(id) {
  const kind = KIND_NAMES[KIND[id]]; const lv = LEVEL[id]; const p1 = P1[id]; const p2 = P2[id];
  const u = { id, kind, cost: COST[id], level: lv };
  switch (kind) {
    case 'tier': {
      const b = BUILDINGS[p1]; const big = lv <= 10;
      Object.assign(u, { b: p1, need: NEED[id], name: `${PREFIX[(lv + p1) % 20]} ${b.name} · Stufe ${lv}`, icon: b.icon, desc: `${b.name}: ${big ? '×2' : '+' + pct(EFFECT.tierSmall) + ' %'} Produktion (ab ${NEED[id]} Stück)` });
      break;
    }
    case 'click': Object.assign(u, { pct: !!p1, name: `${KITCHEN[(lv - 1) % 20]}-Daumen · Nr. ${lv}`, icon: p1 ? '🖱️' : '👉', desc: p1 ? `Jeder Klick gibt zusätzlich +${(EFFECT.clickPct * 100).toFixed(4).replace('.', ',')} % deiner CpS` : `Klickstärke +${pct(EFFECT.click)} %` }); break;
    case 'global': Object.assign(u, { name: `${KITCHEN[((lv - 1) * 7) % 20]}-Rezept Nr. ${lv}`, icon: '📜', desc: `Gesamte Produktion +${pct(EFFECT.global, 4)} %` }); break;
    case 'syn': Object.assign(u, { a: p1, b: p2, need: NEED[id], name: `${BUILDINGS[p1].name} ⇄ ${BUILDINGS[p2].name} · ${lv}`, icon: '🔗', desc: `${BUILDINGS[p1].name} +${(EFFECT.syn * 100).toFixed(3).replace('.', ',')} % pro ${BUILDINGS[p2].name} (ab je ${NEED[id]} Stück)` }); break;
    case 'golden': Object.assign(u, { type: p1, goldReq: NEED[id], name: `Goldener ${GOLD[p1]} · Nr. ${lv}`, icon: '🌟', desc: ['Goldene Kekse erscheinen etwas schneller', 'Goldene Kekse bleiben etwas länger', 'Goldene Kekse: Belohnungen etwas größer', 'Glückstreffer-Bonus etwas größer', 'Rausch-Stärke etwas größer'][p1] }); break;
    default: Object.assign(u, { type: p1, name: `${HEAVEN[p1]} · Nr. ${lv}`, icon: ['😇', '✨', '🪽', '🌙'][p1], desc: ['Gesamte Produktion +' + pct(EFFECT.hGlobal, 4) + ' %', 'Klickstärke +' + pct(EFFECT.hClick) + ' %', 'Goldene Kekse etwas häufiger', 'Offline-Limit +15 Sekunden'][p1] });
  }
  return u;
}

// ---- Erfolge ----
export function buildAchievements() {
  const a = [];
  const add = (name, desc, icon, test) => a.push({ id: a.length, name, desc, icon, test });
  const counts = [1, 10, 25, 50, 100, 150, 200, 300];
  BUILDINGS.forEach((b, i) => counts.forEach((n) => add(`${b.name}-Fan ${n}`, `${n}× ${b.name} besitzen`, b.icon, (s) => s.owned[i] >= n)));
  const totals = [1, 1e3, 1e5, 1e6, 1e8, 1e9, 1e11, 1e12, 1e14, 1e15, 1e17, 1e18, 1e20, 1e21, 1e23, 1e24, 1e27, 1e30];
  totals.forEach((n) => add(`Bäcker-Meilenstein ${fmtShort(n)}`, `${fmtShort(n)} Kekse insgesamt gebacken`, '🍪', (s) => s.totalAll >= n));
  const cps = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e12, 1e15, 1e18, 1e21];
  cps.forEach((n) => add(`Fließband ${fmtShort(n)}`, `${fmtShort(n)} Kekse pro Sekunde erreichen`, '⚙️', (s) => s.cps >= n));
  const clicks = [1, 100, 1e3, 1e4, 5e4, 1e5, 5e5, 1e6];
  clicks.forEach((n) => add(`Klickwütig ${fmtShort(n)}`, `${fmtShort(n)}× den großen Keks klicken`, '👆', (s) => s.clicks >= n));
  const golds = [1, 7, 27, 77, 777, 2777];
  golds.forEach((n) => add(`Goldfinger ${n}`, `${n} goldene Kekse anklicken`, '🌟', (s) => s.golden >= n));
  const ups = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 100000, 200000, 300000, 400000];
  ups.forEach((n) => add(`Tüftler ${n}`, `${n} Upgrades besitzen`, '🧪', (s) => s.upgradeCount >= n));
  const asc = [1, 3, 10, 25];
  asc.forEach((n) => add(`Wiedergeburt ${n}`, `${n}× aufsteigen`, '🪽', (s) => s.ascensions >= n));
  const chips = [1, 10, 100, 1000];
  chips.forEach((n) => add(`Himmelsstaub ${n}`, `${n} Himmelschips verdient`, '😇', (s) => s.chipsEarned >= n));
  return a;
}

export function fmtShort(n) {
  const sfx = ['', 'K', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trl', 'Trd', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  if (n < 1e3) return String(Math.floor(n));
  const e = Math.floor(Math.log10(n) / 3);
  if (e >= sfx.length) return n.toExponential(2).replace('+', '');
  const v = n / Math.pow(10, e * 3);
  const txt = (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)).replace(/\.?0+$/, '').replace('.', ',');
  return `${txt} ${sfx[e]}`;
}
