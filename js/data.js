// Spieldaten: Gebäude, 400.000 Upgrades (kompakte Datenfelder, Namen werden bei Bedarf erzeugt) und Erfolge.

const BASE_BUILDINGS = [
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
// 100 weitere Gebäude (Preis ×12,5, Produktion ×7,3 je Stufe). Sie haben keine eigenen 400.000er-Upgrades, dafür je eine Mega-Reihe.
const EXTRA_BUILDINGS = [
  { name: 'Keksplanet', icon: '🪐', base: 3.25e17, cps: 1.53e11 },
  { name: 'Mondfabrik', icon: '🌙', base: 4.06e18, cps: 1.12e12 },
  { name: 'Sonnenofen', icon: '☀️', base: 5.08e19, cps: 8.17e12 },
  { name: 'Sternenbäckerei', icon: '⭐', base: 6.35e20, cps: 5.96e13 },
  { name: 'Kometenmine', icon: '☄️', base: 7.93e21, cps: 4.35e14 },
  { name: 'Asteroidenfarm', icon: '🪨', base: 9.92e22, cps: 3.18e15 },
  { name: 'Nebelwerk', icon: '🌫️', base: 1.24e24, cps: 2.32e16 },
  { name: 'Galaxiebank', icon: '🌌', base: 1.55e25, cps: 1.69e17 },
  { name: 'Quasarturm', icon: '🔭', base: 1.94e26, cps: 1.24e18 },
  { name: 'Pulsar-Ofen', icon: '📡', base: 2.42e27, cps: 9.03e18 },
  { name: 'Schwarzes Loch', icon: '🕳️', base: 3.03e28, cps: 6.59e19 },
  { name: 'Weißes Loch', icon: '⚪', base: 3.78e29, cps: 4.81e20 },
  { name: 'Wurmloch', icon: '🐛', base: 4.73e30, cps: 3.51e21 },
  { name: 'Dunkelmaterie-Mühle', icon: '🌑', base: 5.91e31, cps: 2.56e22 },
  { name: 'Antikeks-Reaktor', icon: '☢️', base: 7.39e32, cps: 1.87e23 },
  { name: 'Hyperraum-Backstube', icon: '🌀', base: 9.24e33, cps: 1.37e24 },
  { name: 'Zeitschleife', icon: '♾️', base: 1.15e35, cps: 9.97e24 },
  { name: 'Paralleluniversum', icon: '🔀', base: 1.44e36, cps: 7.28e25 },
  { name: 'Multiversum-Markt', icon: '🏪', base: 1.8e37, cps: 5.31e26 },
  { name: 'Dimensionsriss', icon: '🧩', base: 2.26e38, cps: 3.88e27 },
  { name: 'Quantenofen', icon: '⚛️', base: 2.82e39, cps: 2.83e28 },
  { name: 'Teilchenbeschleuniger', icon: '💥', base: 3.52e40, cps: 2.07e29 },
  { name: 'Higgs-Teig', icon: '🧬', base: 4.4e41, cps: 1.51e30 },
  { name: 'Gluonen-Glasur', icon: '🍯', base: 5.51e42, cps: 1.1e31 },
  { name: 'Neutrino-Netz', icon: '🕸️', base: 6.88e43, cps: 8.04e31 },
  { name: 'Fusionsreaktor', icon: '🔥', base: 8.6e44, cps: 5.87e32 },
  { name: 'Supernova-Schmiede', icon: '💫', base: 1.08e46, cps: 4.28e33 },
  { name: 'Neutronenstern', icon: '🌠', base: 1.34e47, cps: 3.13e34 },
  { name: 'Magnetar-Mühle', icon: '🧲', base: 1.68e48, cps: 2.28e35 },
  { name: 'Gravitationswelle', icon: '🌊', base: 2.1e49, cps: 1.67e36 },
  { name: 'Drachenhort', icon: '🐉', base: 2.63e50, cps: 1.22e37 },
  { name: 'Phönix-Esse', icon: '🪶', base: 3.28e51, cps: 8.88e37 },
  { name: 'Einhorn-Wiese', icon: '🦄', base: 4.1e52, cps: 6.48e38 },
  { name: 'Greifenturm', icon: '🦅', base: 5.13e53, cps: 4.73e39 },
  { name: 'Kraken-Küche', icon: '🐙', base: 6.41e54, cps: 3.46e40 },
  { name: 'Yeti-Backstube', icon: '❄️', base: 8.01e55, cps: 2.52e41 },
  { name: 'Basilisken-Bank', icon: '🐍', base: 1e57, cps: 1.84e42 },
  { name: 'Kobold-Fabrik', icon: '🧌', base: 1.25e58, cps: 1.34e43 },
  { name: 'Elfen-Hain', icon: '🧝', base: 1.56e59, cps: 9.81e43 },
  { name: 'Zwergen-Schmiede', icon: '🪓', base: 1.96e60, cps: 7.16e44 },
  { name: 'Riesen-Backofen', icon: '🏔️', base: 2.45e61, cps: 5.23e45 },
  { name: 'Hexenküche', icon: '🧙‍♀️', base: 3.06e62, cps: 3.82e46 },
  { name: 'Vampirkeller', icon: '🧛', base: 3.82e63, cps: 2.79e47 },
  { name: 'Geisterbahn', icon: '👻', base: 4.78e64, cps: 2.03e48 },
  { name: 'Werwolf-Wald', icon: '🐺', base: 5.97e65, cps: 1.49e49 },
  { name: 'Meerjungfrauen-Lagune', icon: '🧜', base: 7.46e66, cps: 1.08e50 },
  { name: 'Titanen-Thron', icon: '🗿', base: 9.33e67, cps: 7.91e50 },
  { name: 'Götterspeise-Altar', icon: '🏛️', base: 1.17e69, cps: 5.78e51 },
  { name: 'Walhalla-Halle', icon: '⚔️', base: 1.46e70, cps: 4.22e52 },
  { name: 'Olymp-Ofen', icon: '🏺', base: 1.82e71, cps: 3.08e53 },
  { name: 'Roboter-Bäcker', icon: '🤖', base: 2.28e72, cps: 2.25e54 },
  { name: 'KI-Rechenzentrum', icon: '🖥️', base: 2.85e73, cps: 1.64e55 },
  { name: 'Nanobot-Schwarm', icon: '🦠', base: 3.56e74, cps: 1.2e56 },
  { name: 'Klonlabor', icon: '🧫', base: 4.45e75, cps: 8.74e56 },
  { name: 'Hologramm-Bäckerei', icon: '🔮', base: 5.56e76, cps: 6.38e57 },
  { name: 'Cyber-Kekse', icon: '💾', base: 6.95e77, cps: 4.66e58 },
  { name: 'Laser-Ofen', icon: '🔦', base: 8.69e78, cps: 3.4e59 },
  { name: 'Plasma-Fritteuse', icon: '🔆', base: 1.09e80, cps: 2.48e60 },
  { name: 'Stromnetz', icon: '⚡', base: 1.36e81, cps: 1.81e61 },
  { name: 'Windpark', icon: '🌬️', base: 1.7e82, cps: 1.32e62 },
  { name: 'Solarfeld', icon: '🔋', base: 2.12e83, cps: 9.66e62 },
  { name: 'Atomkraftwerk', icon: '⚙️', base: 2.65e84, cps: 7.05e63 },
  { name: 'Weltraumlift', icon: '🛗', base: 3.31e85, cps: 5.15e64 },
  { name: 'Raumstation', icon: '🛰️', base: 4.14e86, cps: 3.76e65 },
  { name: 'Mars-Kolonie', icon: '🔴', base: 5.18e87, cps: 2.74e66 },
  { name: 'Venus-Dampfküche', icon: '♀️', base: 6.47e88, cps: 2e67 },
  { name: 'Jupiter-Sturm', icon: '🌪️', base: 8.09e89, cps: 1.46e68 },
  { name: 'Saturnring-Rummel', icon: '🎡', base: 1.01e91, cps: 1.07e69 },
  { name: 'Neptun-Tiefsee', icon: '🔱', base: 1.26e92, cps: 7.79e69 },
  { name: 'Pluto-Eisfabrik', icon: '🧊', base: 1.58e93, cps: 5.69e70 },
  { name: 'Urwald-Keksbaum', icon: '🌳', base: 1.98e94, cps: 4.15e71 },
  { name: 'Wüstenoase', icon: '🏜️', base: 2.47e95, cps: 3.03e72 },
  { name: 'Vulkanküche', icon: '🌋', base: 3.09e96, cps: 2.21e73 },
  { name: 'Ozean-Plattform', icon: '🚢', base: 3.86e97, cps: 1.61e74 },
  { name: 'Korallenriff', icon: '🪸', base: 4.82e98, cps: 1.18e75 },
  { name: 'Pilzwald', icon: '🍄', base: 6.03e99, cps: 8.61e75 },
  { name: 'Bienenstock-Metropolis', icon: '🐝', base: 7.53e100, cps: 6.28e76 },
  { name: 'Walfisch-Werft', icon: '🐋', base: 9.42e101, cps: 4.59e77 },
  { name: 'Adlerhorst', icon: '🪺', base: 1.18e103, cps: 3.35e78 },
  { name: 'Zirkuszelt', icon: '🎪', base: 1.47e104, cps: 2.44e79 },
  { name: 'Kino-Palast', icon: '🎬', base: 1.84e105, cps: 1.78e80 },
  { name: 'Museum der Kekse', icon: '🖼️', base: 2.3e106, cps: 1.3e81 },
  { name: 'Observatorium', icon: '🔬', base: 2.87e107, cps: 9.51e81 },
  { name: 'Universität', icon: '🎓', base: 3.59e108, cps: 6.94e82 },
  { name: 'Piratenschiff', icon: '🏴‍☠️', base: 4.49e109, cps: 5.07e83 },
  { name: 'Schatzinsel', icon: '🏝️', base: 5.61e110, cps: 3.7e84 },
  { name: 'Wildwest-Saloon', icon: '🤠', base: 7.02e111, cps: 2.7e85 },
  { name: 'Ritterburg', icon: '🏰', base: 8.77e112, cps: 1.97e86 },
  { name: 'Pharaonen-Pyramide', icon: '🔺', base: 1.1e114, cps: 1.44e87 },
  { name: 'Zeitreise-Bahnhof', icon: '🚂', base: 1.37e115, cps: 1.05e88 },
  { name: 'Wolkenschloss', icon: '☁️', base: 1.71e116, cps: 7.67e88 },
  { name: 'Regenbogen-Fabrik', icon: '🌈', base: 2.14e117, cps: 5.6e89 },
  { name: 'Zuckerberg', icon: '🍬', base: 2.68e118, cps: 4.09e90 },
  { name: 'Schokoladenfluss', icon: '🍫', base: 3.35e119, cps: 2.98e91 },
  { name: 'Milchstraße', icon: '🥛', base: 4.18e120, cps: 2.18e92 },
  { name: 'Karamell-Kathedrale', icon: '⛪', base: 5.23e121, cps: 1.59e93 },
  { name: 'Keks-Imperium-Hauptstadt', icon: '👑', base: 6.53e122, cps: 1.16e94 },
  { name: 'Ewiger Ofen', icon: '♨️', base: 8.17e123, cps: 8.47e94 },
  { name: 'Unendlichkeits-Backstube', icon: '♾', base: 1.02e125, cps: 6.18e95 },
  { name: 'Urknall-Küche', icon: '🎆', base: 1.28e126, cps: 4.51e96 },
];
export const BASE_COUNT = BASE_BUILDINGS.length; // die ersten 15 Gebäude (Upgrade-Nummern und Erfolge beziehen sich nur auf sie)
export const BUILDINGS = [...BASE_BUILDINGS, ...EXTRA_BUILDINGS];
export const GROWTH = 1.15;

// ---- Upgrades: 400.000 Stück, als kompakte Typed Arrays gespeichert ----
export const COUNTS = { tier: 114000, click: 60000, global: 100000, syn: 42000, golden: 34000, heaven: 50000 };
export const TOTAL_UPGRADES = 400000;
export const PER_BUILDING = COUNTS.tier / BASE_COUNT; // 7.600 je Gebäude
export const SYN_LEVELS = COUNTS.syn / (BASE_COUNT * (BASE_COUNT - 1)); // 200
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
  const NB = BASE_COUNT;
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
  BUILDINGS.slice(0, BASE_COUNT).forEach((b, i) => counts.forEach((n) => add(`${b.name}-Fan ${n}`, `${n}× ${b.name} besitzen`, b.icon, (s) => s.owned[i] >= n)));
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
  // (Plätze der früheren Item-Erfolge, damit gespeicherte Erfolge ihre Nummern behalten)
  [1, 5, 11].forEach((n) => add(`Singularität ${n}`, `Singularität Stufe ${n} erreichen`, '🕳️', (s) => s.sing >= n));
  [5000, 10000, 25000].forEach((n) => add(`Gold-Rausch ${n.toLocaleString('de-DE')}`, `${n.toLocaleString('de-DE')} goldene Kekse anklicken`, '✨', (s) => s.golden >= n));
  [1, 100, 10000, 100000].forEach((n) => add(`Mega-Sammler ${n.toLocaleString('de-DE')}`, `${n.toLocaleString('de-DE')} Mega-Upgrade-Stufen kaufen`, '♾️', (s) => s.seriesTotal >= n));
  const chips = [1, 10, 100, 1000];
  chips.forEach((n) => add(`Himmelsstaub ${n}`, `${n} Himmelschips verdient`, '😇', (s) => s.chipsEarned >= n));
  // neue Erfolge hinten anhängen, damit gespeicherte Erfolge ihre Nummern behalten
  [1, 5, 10, 25, 50, 100].forEach((n) => add(`Entdecker ${n}`, `${n} verschiedene neue Gebäude besitzen`, '🧭', (s) => s.newKinds >= n));
  [1, 100, 10000, 1000000].forEach((n) => add(`Baumeister ${n.toLocaleString('de-DE')}`, `${n.toLocaleString('de-DE')} neue Gebäude insgesamt besitzen`, '🏗️', (s) => s.newOwned >= n));
  [25, 50, 100, 250, 500, 1000].forEach((n) => add(`Singularitäts-Meister ${n}`, `Singularität Stufe ${n} erreichen`, '🌀', (s) => s.sing >= n));
  return a;
}

export function fmtShort(n) {
  const sfx = ['', 'K', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trl', 'Trd', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  if (n < 1e3) return String(Math.floor(n));
  const e = Math.floor(Math.log10(n) / 3);
  if (e >= sfx.length) return n.toExponential(2).replace('+', '');
  const v = n / Math.pow(10, e * 3);
  let txt = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0);
  if (txt.includes('.')) txt = txt.replace(/0+$/, '').replace(/\.$/, ''); // Nachkomma-Nullen entfernen, aber nie bei ganzen Zahlen
  txt = txt.replace('.', ',');
  return `${txt} ${sfx[e]}`;
}
