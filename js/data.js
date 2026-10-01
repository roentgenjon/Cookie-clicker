// Spieldaten: Gebäude, 10.000 Upgrades und Erfolge werden deterministisch erzeugt.

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

export const COUNTS = { tier: 2850, click: 1500, global: 2500, syn: 1050, golden: 850, heaven: 1250 };
export const TOTAL_UPGRADES = 10000;
export const HEAVEN_START = TOTAL_UPGRADES - COUNTS.heaven; // ab hier: himmlische Upgrades (Chips)

const PREFIX = ['Verbessertes', 'Poliertes', 'Geheimes', 'Uraltes', 'Verzaubertes', 'Vergoldetes', 'Mystisches', 'Turbo', 'Mega', 'Ultra', 'Königliches', 'Kosmisches', 'Legendäres', 'Perfektioniertes', 'Handgemachtes', 'Biologisches', 'Quanten', 'Diamant', 'Zuckriges', 'Knuspriges'];
const KITCHEN = ['Butter', 'Zucker', 'Schokolade', 'Vanille', 'Zimt', 'Mandel', 'Haselnuss', 'Karamell', 'Honig', 'Marzipan', 'Ahornsirup', 'Kakao', 'Kokos', 'Ingwer', 'Pistazie', 'Lavendel', 'Muskat', 'Safran', 'Lebkuchen', 'Mokka'];
const GOLD = ['Frequenz', 'Dauer', 'Belohnung', 'Glück', 'Rausch'];
const ROMAN = (n) => {
  const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of m) while (n >= v) { s += r; n -= v; }
  return s;
};

export const SYN_NEED = [10, 25, 50, 100, 150];

// Upgrade-Felder:
//  kind: tier|click|global|syn|golden|heaven   cost: Cookies (heaven: Chips)
//  Wirkung je nach kind (siehe applyUpgrade in game.js)
function build() {
  const list = [];
  const push = (u) => { u.id = list.length; list.push(u); };

  // 1) Gebäude-Stufen (190 je Gebäude)
  const perB = COUNTS.tier / BUILDINGS.length;
  for (let b = 0; b < BUILDINGS.length; b++) {
    for (let k = 1; k <= perB; k++) {
      const need = k === 1 ? 1 : k === 2 ? 5 : k === 3 ? 10 : 10 + (k - 3) * 2;
      const mult = k <= 10 ? 2 : 1.05;
      push({
        kind: 'tier', b, need, mult,
        cost: Math.round(BUILDINGS[b].base * 5 * Math.pow(GROWTH, need)),
        name: `${PREFIX[(k + b) % PREFIX.length]} ${BUILDINGS[b].name} ${ROMAN(k)}`,
        icon: BUILDINGS[b].icon,
        desc: `${BUILDINGS[b].name}: ×${mult} Produktion (ab ${need} Stück)`,
      });
    }
  }

  // 2) Klick-Upgrades (1.500)
  const rC = Math.pow(10, 23 / COUNTS.click);
  for (let k = 0; k < COUNTS.click; k++) {
    const pct = k % 3 === 2;
    push({
      kind: 'click', pct, mult: pct ? 0 : 1.08, add: pct ? 0.001 : 0,
      cost: Math.round(100 * Math.pow(rC, k)),
      name: `${KITCHEN[k % KITCHEN.length]}-Daumen ${ROMAN((k % 20) + 1)}·${Math.floor(k / 20) + 1}`,
      icon: pct ? '🖱️' : '👉',
      desc: pct ? 'Jeder Klick gibt zusätzlich +0,1 % deiner CpS' : 'Klickstärke ×1,08',
    });
  }

  // 3) Globale Produktions-Upgrades (2.500)
  const rG = Math.pow(10, 30 / COUNTS.global);
  for (let k = 0; k < COUNTS.global; k++) {
    push({
      kind: 'global', mult: 1.02,
      cost: Math.round(500 * Math.pow(rG, k)),
      name: `${KITCHEN[(k * 7) % KITCHEN.length]}-Rezept Nr. ${k + 1}`,
      icon: '📜',
      desc: 'Gesamte Produktion ×1,02',
    });
  }

  // 4) Synergien (15×14 Paare × 5 Stufen = 1.050)
  for (let l = 1; l <= SYN_NEED.length; l++) {
    for (let a = 0; a < BUILDINGS.length; a++) {
      for (let b = 0; b < BUILDINGS.length; b++) {
        if (a === b) continue;
        push({
          kind: 'syn', a, b, level: l, need: SYN_NEED[l - 1],
          cost: Math.round(Math.max(BUILDINGS[a].base, BUILDINGS[b].base) * 50 * Math.pow(l, 2.5)),
          name: `${BUILDINGS[a].name} ⇄ ${BUILDINGS[b].name} ${ROMAN(l)}`,
          icon: '🔗',
          desc: `${BUILDINGS[a].name} +${(0.05 * l).toFixed(2).replace('.', ',')} % pro ${BUILDINGS[b].name} (ab je ${SYN_NEED[l - 1]} Stück)`,
        });
      }
    }
  }

  // 5) Goldene Kekse (850)
  const rK = Math.pow(10, 28 / COUNTS.golden);
  for (let k = 0; k < COUNTS.golden; k++) {
    const type = k % 5;
    const desc = [
      'Goldene Kekse erscheinen 1 % schneller',
      'Goldene Kekse bleiben 2 % länger',
      'Goldene Kekse: Belohnungen +2 %',
      'Glückstreffer-Bonus +2 % der Bank',
      'Rausch-Stärke +1 %',
    ][type];
    push({
      kind: 'golden', type,
      cost: Math.round(7777 * Math.pow(rK, k)),
      goldReq: Math.floor(k / 10),
      name: `Goldener ${GOLD[type]} ${ROMAN((Math.floor(k / 5) % 40) + 1)}·${Math.floor(k / 200) + 1}`,
      icon: '🌟', desc,
    });
  }

  // 6) Himmlische Upgrades (1.250) – kosten Himmelschips
  for (let k = 0; k < COUNTS.heaven; k++) {
    const type = k % 4;
    push({
      kind: 'heaven', type,
      cost: Math.max(1, Math.round(Math.pow(1.0075, k))),
      name: `${['Himmlische Macht', 'Göttlicher Klick', 'Engelsglück', 'Ewige Ruhe'][type]} ${ROMAN((Math.floor(k / 4) % 50) + 1)}·${Math.floor(k / 200) + 1}`,
      icon: ['😇', '✨', '🪽', '🌙'][type],
      desc: ['Gesamte Produktion ×1,02', 'Klickstärke ×1,05', 'Goldene Kekse 1 % häufiger', 'Offline-Ertrag +1 %'][type],
    });
  }
  return list;
}

export const UPGRADES = build();

// Reihenfolge nach Preis (Cookie-Upgrades und Chip-Upgrades getrennt) für schnelle Listen
export const ORDER_COOKIE = UPGRADES.filter((u) => u.kind !== 'heaven').map((u) => u.id).sort((x, y) => UPGRADES[x].cost - UPGRADES[y].cost || x - y);
export const ORDER_HEAVEN = UPGRADES.filter((u) => u.kind === 'heaven').map((u) => u.id);

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
  const ups = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10000];
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
