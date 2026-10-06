// Mega-Upgrades: 100 unendlich-artige Reihen. Jede Reihe hat ~100 Billionen Stufen (einzeln nacheinander kaufbar).
// Zusammen mit den 400.000 normalen Upgrades ergibt das genau 10^16 = 10.000.000.000.000.000 Upgrades.
// Die Stufen werden nicht gespeichert, sondern nur der Fortschritt je Reihe (100 Zahlen) – alles andere ist Mathematik.
import { BUILDINGS, TOTAL_UPGRADES } from './data.js';

export const SERIES_COUNT = 100;
export const TOTAL_TARGET = 10n ** 16n; // gewünschte Gesamtzahl
export const SERIES_LEVELS = Number((TOTAL_TARGET - BigInt(TOTAL_UPGRADES)) / BigInt(SERIES_COUNT)); // 99.999.999.999.996 Stufen je Reihe
export const TOTAL_ALL = BigInt(TOTAL_UPGRADES) + BigInt(SERIES_LEVELS) * BigInt(SERIES_COUNT);
export const TOTAL_ALL_TEXT = TOTAL_ALL.toLocaleString('de-DE');

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
for (let b = 0; b < BUILDINGS.length; b++) {
  TIERS.forEach((t, ti) => SERIES.push({ kind: 'bld', b, tier: ti, name: `${t.name}-${BUILDINGS[b].name}`, icon: BUILDINGS[b].icon, badge: t.icon, need: t.need, base: BUILDINGS[b].base * 200 * t.mult, g: t.g, e: t.e }));
}
for (let i = 0; i < 5; i++) SERIES.push({ kind: 'click', name: `Daumen-Training ${ROMAN[i]}`, icon: '👉', badge: '🖱️', baked: BAKED[i], base: [1e3, 1e7, 1e12, 1e18, 1e25][i], g: 1.015, e: 0.002 });
for (let i = 0; i < 5; i++) SERIES.push({ kind: 'global', name: `Backstuben-Reform ${ROMAN[i]}`, icon: '📜', badge: '🏛️', baked: BAKED[i], base: [5e3, 5e7, 5e12, 5e18, 5e25][i], g: 1.02, e: 0.0015 });

export const seriesDesc = (s) => (s.kind === 'bld' ? `${s.name}: Produktion +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe` : s.kind === 'click' ? `Klickstärke +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe` : `Gesamte Produktion +${(s.e * 100).toFixed(2).replace('.', ',')} % je Stufe`);
export const seriesNeedText = (s) => (s.kind === 'bld' ? `${s.need} × ${BUILDINGS[s.b].name} besitzen` : `${s.baked.toExponential(0).replace('e+', 'e')} Kekse insgesamt gebacken`);

// Preis für n Stufen, wenn schon `have` gekauft sind (geometrische Reihe)
export const seriesCost = (s, have, n = 1) => s.base * Math.pow(s.g, have) * (Math.pow(s.g, n) - 1) / (s.g - 1);
export function seriesMaxAffordable(s, have, cookies) {
  const first = s.base * Math.pow(s.g, have);
  if (!Number.isFinite(first) || first <= 0) return 0;
  const n = Math.floor(Math.log(1 + (cookies * (s.g - 1)) / first) / Math.log(s.g));
  return Math.max(0, Math.min(n, SERIES_LEVELS - have));
}
export const seriesFactor = (s, n) => Math.min(1e300, Math.pow(1 + s.e, n)); // Gesamtwirkung von n Stufen
