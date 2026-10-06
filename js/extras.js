// Keks-Skins und tägliche Aufgaben (reine Daten/Logik, ohne DOM).

// need(s): s = { ach, golden, totalAll, ascensions, upgrades, buildings, clicks, chips }
export const SKINS = [
  { id: 'classic', name: 'Klassisch', emoji: '🍪', req: 'Immer verfügbar', need: () => true },
  { id: 'donut', name: 'Donut', emoji: '🍩', req: '5 Erfolge', need: (s) => s.ach >= 5 },
  { id: 'fortune', name: 'Glückskeks', emoji: '🥠', req: '10 goldene Kekse gefangen', need: (s) => s.golden >= 10 },
  { id: 'pie', name: 'Kuchen', emoji: '🥧', req: '500 Gebäude besitzen', need: (s) => s.buildings >= 500 },
  { id: 'rice', name: 'Reiskeks', emoji: '🍘', req: '1.000 Upgrades', need: (s) => s.upgrades >= 1000 },
  { id: 'cake', name: 'Torte', emoji: '🎂', req: '50 Erfolge', need: (s) => s.ach >= 50 },
  { id: 'moon', name: 'Mondkeks', emoji: '🌕', req: '1 Billion Kekse gebacken', need: (s) => s.totalAll >= 1e12 },
  { id: 'mooncake', name: 'Mondkuchen', emoji: '🥮', req: '1× aufgestiegen', need: (s) => s.ascensions >= 1 },
  { id: 'blue', name: 'Blaukeks', emoji: '🍪', filter: 'hue-rotate(180deg) saturate(1.3)', req: '10 Himmelschips', need: (s) => s.chips >= 10 },
  { id: 'ghost', name: 'Geisterkeks', emoji: '👻', req: '100.000 Klicks', need: (s) => s.clicks >= 100000 },
  { id: 'alien', name: 'Außerirdischer', emoji: '👽', req: '100.000 Upgrades', need: (s) => s.upgrades >= 100000 },
  { id: 'rainbow', name: 'Regenbogenkeks', emoji: '🍪', cls: 'rainbow', req: '150 Erfolge', need: (s) => s.ach >= 150 },
  { id: 'gold', name: 'Goldkeks', emoji: '🌟', req: '1e30 Kekse gebacken', need: (s) => s.totalAll >= 1e30 },
  { id: 'icetea', name: 'Eistee', emoji: '🥤', req: 'Eistee-Flasche im Shop kaufen', need: (s) => ((s.items || {}).icetea || 0) > 0 },
];
export const skinById = (id) => SKINS.find((k) => k.id === id) || SKINS[0];

// ---- tägliche Aufgaben ----
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const TASK_INFO = {
  clicks: { icon: '👆', text: (t) => `Klicke ${t.toLocaleString('de-DE')}× auf den Keks` },
  golden: { icon: '🌟', text: (t) => `Fange ${t} goldene Kekse` },
  buildings: { icon: '🏭', text: (t) => `Kaufe ${t} Gebäude` },
  upgrades: { icon: '🧪', text: (t) => `Kaufe ${t} Upgrades` },
  baked: { icon: '🍪', text: (t) => `Backe ${t.toLocaleString('de-DE')} Kekse` },
};

export function dayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }

// 3 verschiedene Aufgaben, bei gleichem Datum immer dieselben Typen
export function genTasks(date, baseCps) {
  const rnd = mulberry(hash(date));
  const types = ['clicks', 'golden', 'buildings', 'upgrades', 'baked'];
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const pick = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  return types.slice(0, 3).map((type) => ({
    type,
    target: type === 'clicks' ? pick(2, 8) * 100 : type === 'golden' ? pick(2, 5) : type === 'buildings' ? pick(15, 40) : type === 'upgrades' ? pick(10, 50) : Math.max(10000, Math.round(baseCps * pick(900, 3600))),
  }));
}

// ---- Item-Shop: beliebig oft kaufbar, jedes Exemplar gibt dauerhaft +x % Produktion und Klickertrag ----
// Der Preis steigt mit jedem Exemplar (×1,12). Items bleiben beim Aufstieg erhalten.
export const ITEM_GROWTH = 1.12;
export const ITEMS = [
  { id: 'choco', name: 'Schoko-Keks', emoji: '🍪', pct: 15, cost: 1e5 },
  { id: 'milk', name: 'Glas Milch', emoji: '🥛', pct: 25, cost: 5e6 },
  { id: 'coffee', name: 'Kaffeetasse', emoji: '☕', pct: 40, cost: 2.5e8 },
  { id: 'donut', name: 'Donut', emoji: '🍩', pct: 60, cost: 1e10 },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', pct: 100, cost: 5e11 },
  { id: 'icecream', name: 'Eisbecher', emoji: '🍨', pct: 150, cost: 2e13 },
  { id: 'burger', name: 'Burger', emoji: '🍔', pct: 250, cost: 1e15 },
  { id: 'bubble', name: 'Bubble Tea', emoji: '🧋', pct: 400, cost: 5e17 },
  { id: 'energy', name: 'Energy-Drink', emoji: '⚡', pct: 600, cost: 1e20 },
  { id: 'cake', name: 'Goldene Torte', emoji: '🎂', pct: 800, cost: 1e23 },
  { id: 'icetea', name: 'Eistee-Flasche', emoji: '🥤', pct: 1000, cost: 1e27, best: true },
];
export const itemById = (id) => ITEMS.find((i) => i.id === id);
// owned = { id: Anzahl }
export const itemMultiplier = (owned) => 1 + ITEMS.reduce((a, it) => a + it.pct * (owned[it.id] || 0), 0) / 100;
export const itemCost = (it, have, n = 1) => it.cost * Math.pow(ITEM_GROWTH, have) * (Math.pow(ITEM_GROWTH, n) - 1) / (ITEM_GROWTH - 1);
export function itemMaxAffordable(it, have, cookies) {
  const n = Math.floor(Math.log(1 + (cookies * (ITEM_GROWTH - 1)) / (it.cost * Math.pow(ITEM_GROWTH, have))) / Math.log(ITEM_GROWTH));
  return Math.max(0, n);
}
