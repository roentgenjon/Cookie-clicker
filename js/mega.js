// Mega-Upgrades: 200 unendlich-artige Reihen. Jede Reihe hat ~5·10^22 Stufen (einzeln nacheinander kaufbar).
// Zusammen mit den 400.000 normalen Upgrades ergibt das genau 10^25 = 10.000.000.000.000.000.000.000.000 Upgrades.
// Die Stufen werden nicht gespeichert, sondern nur der Fortschritt je Reihe (200 Zahlen) – alles andere ist Mathematik.
import { BUILDINGS, BASE_COUNT, TOTAL_UPGRADES } from './data.js';
import { Big, geoCost, geoMax, fmtBig } from './big.js';

export const SERIES_COUNT = 200; // 90 Reihen für die ersten 15 Gebäude, 10 Klick/Global, 100 für die neuen Gebäude
export const TOTAL_TARGET = 10n ** 25n; // gewünschte Gesamtzahl (1.000.000.000 × so viele wie früher: 10^16)
const LEVELS_BIG = (TOTAL_TARGET - BigInt(TOTAL_UPGRADES)) / BigInt(SERIES_COUNT); // 5·10^22 − 2.000 Stufen je Reihe (exakt als BigInt)
export const SERIES_LEVELS = Number(LEVELS_BIG); // für die Rechnung als Zahl (über 2^53 nur noch auf ~16 Stellen genau)
export const TOTAL_ALL = BigInt(TOTAL_UPGRADES) + LEVELS_BIG * BigInt(SERIES_COUNT); // exakt 10^25
export const TOTAL_ALL_TEXT = fmtBig(Number(TOTAL_ALL)); // „10 Qa“
// Anzahl von Upgrades/Stufen anzeigen: bis 1e15 ausgeschrieben, darüber gekürzt (große Zahlen sind als Double nicht mehr ganzzahlig genau)
export const fmtUp = (n) => (n < 1e15 ? Math.floor(n).toLocaleString('de-DE') : fmtBig(n));

const TIERS = [
  { name: 'Bronze', icon: '🥉', need: 10, mult: 1, g: 1.02, e: 0.0008 },
  { name: 'Silber', icon: '🥈', need: 50, mult: 12, g: 1.0175, e: 0.0012 },
  { name: 'Gold', icon: '🥇', need: 100, mult: 144, g: 1.015, e: 0.0018 },
  { name: 'Platin', icon: '💠', need: 200, mult: 1728, g: 1.0125, e: 0.0026 },
  { name: 'Diamant', icon: '💎', need: 350, mult: 20736, g: 1.01, e: 0.0038 },
  { name: 'Kosmisch', icon: '🌌', need: 500, mult: 248832, g: 1.0075, e: 0.0055 },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const BAKED = [1e4, 1e8, 1e13, 1e19, 1e26]; // benötigte Gesamt-Kekse (Klick-/Globalreihen)

// kind: 'bld' (Gebäude-Reihe), 'click', 'global'
export const SERIES = [];
for (let b = 0; b < BASE_COUNT; b++) {
  TIERS.forEach((t, ti) => SERIES.push({ kind: 'bld', b, tier: ti, name: `${t.name}-${BUILDINGS[b].name}`, icon: BUILDINGS[b].icon, badge: t.icon, need: t.need, base: BUILDINGS[b].base * 200 * t.mult, g: t.g, e: t.e }));
}
for (let i = 0; i < 5; i++) SERIES.push({ kind: 'click', name: `Daumen-Training ${ROMAN[i]}`, icon: '👉', badge: '🖱️', baked: BAKED[i], base: [1e3, 1e7, 1e12, 1e18, 1e25][i], g: 1.015, e: 0.002 });
for (let i = 0; i < 5; i++) SERIES.push({ kind: 'global', name: `Backstuben-Reform ${ROMAN[i]}`, icon: '📜', badge: '🏛️', baked: BAKED[i], base: [5e3, 5e7, 5e12, 5e18, 5e25][i], g: 1.02, e: 0.0015 });
// Neue Gebäude: je eine Mega-Reihe (hinten angehängt, damit gespeicherte Stufen ihre Nummern behalten)
for (let b = BASE_COUNT; b < BUILDINGS.length; b++) SERIES.push({ kind: 'bld', b, tier: 0, name: `Mega-${BUILDINGS[b].name}`, icon: BUILDINGS[b].icon, badge: '🏗️', need: 10, base: BUILDINGS[b].base * 200, g: 1.02, e: 0.002 });

export const seriesDesc = (s) => (s.kind === 'bld' ? `${s.name}: Produktion +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe` : s.kind === 'click' ? `Klickstärke +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe` : `Gesamte Produktion +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe`);
export const seriesNeedText = (s) => (s.kind === 'bld' ? `${s.need} × ${BUILDINGS[s.b].name} besitzen` : `${s.baked.toExponential(0).replace('e+', 'e')} Kekse insgesamt gebacken`);

// Preis für n Stufen, wenn schon `have` gekauft sind (geometrische Reihe) – als Big, da die Preise weit über 1e308 steigen
export const seriesCost = (s, have, n = 1) => geoCost(s.base, s.g, have, n);
export const seriesMaxAffordable = (s, have, cookies) => geoMax(s.base, s.g, have, cookies, SERIES_LEVELS - have);
export const seriesLog = (s, n) => n * Math.log10(1 + s.e); // log10 der Gesamtwirkung von n Stufen
export const seriesFactor = (s, n) => Big.fromLog(seriesLog(s, n));
