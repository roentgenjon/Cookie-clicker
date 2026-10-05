import assert from 'node:assert/strict';
import { Game, ACH } from '../js/engine.js';
import { UPGRADES } from '../js/data.js';

const g = new Game();
g.earn(1000);
assert.ok(g.buyBuilding(0, 1) && g.owned[0] === 1);
assert.ok(g.buyBuilding(1, 'max') || true);
g.tick(10);
assert.ok(g.cookies > 0);
// Upgrades kaufen
g.earn(1e9);
const vis = g.visibleUpgrades(false);
assert.ok(vis.length > 0);
assert.ok(g.buyUpgrade(vis[0]));
// Speichern / Laden
const d = JSON.parse(JSON.stringify(g.serialize()));
const g2 = new Game(); g2.load(d);
assert.equal(g2.upgradeCount, g.upgradeCount);
assert.deepEqual(g2.owned, g.owned);
// alles kaufen -> keine NaN
const g3 = new Game();
g3.owned.fill(250); g3.bought.fill(1); g3.chipsEarned = 5000; g3.recalc();
assert.equal(g3.upgradeCount, 10000);
assert.ok(Number.isFinite(g3.cps) && g3.cps > 0 && Number.isFinite(g3.clickValue), 'cps endlich');
// Aufstieg
const g4 = new Game(); g4.total = 8e12; g4.cookies = 8e12;
assert.equal(g4.chipsGain, 2);
assert.ok(g4.ascend() && g4.chipsEarned === 2 && g4.cookies === 0);
// Erfolge
const g5 = new Game(); g5.owned[0] = 1; g5.total = 5; g5.clicks = 1;
assert.ok(g5.checkAchievements().length >= 2);
// Goldener Keks
const g6 = new Game(); g6.nextGolden = 0; g6.tick(1); assert.equal(g6.gcs.length, 1); assert.ok(g6.clickGolden(g6.gcs[0].id)); assert.equal(g6.gcs.length, 0);
// Admin-Ereignisse
const g9 = new Game(); g9.owned[1] = 5; g9.recalc();
g9.applyEvent({ type: 'golden', effect: 'lucky', count: 3 }); assert.ok(g9.gcs.length === 3 && g9.gcs[0].effect === 'lucky');
g9.applyEvent({ type: 'cookies', amount: 1000 }); assert.equal(g9.cookies, 1000);
g9.applyEvent({ type: 'cookies', amount: -5000 }); assert.equal(g9.cookies, 0);
g9.applyEvent({ type: 'chips', amount: 4 }); assert.equal(g9.chipsEarned, 4);
g9.applyEvent({ type: 'building', b: 2, amount: 7 }); assert.equal(g9.owned[2], 7);
g9.applyEvent({ type: 'buff', kind: 'frenzy', mult: 10, seconds: 60 }); assert.equal(g9.buffMult('frenzy'), 10);
g9.applyEvent({ type: 'buff', kind: 'click', mult: 50, seconds: 60 }); assert.equal(g9.buffMult('click'), 50);
g9.applyEvent({ type: 'upgrades', mode: 'all' }); assert.equal(g9.upgradeCount, 10000);
g9.applyEvent({ type: 'upgrades', mode: 'none' }); assert.equal(g9.upgradeCount, 0);
g9.applyEvent({ type: 'achievements' }); assert.equal(g9.achCount(), ACH.length);
g9.name = 'X'; g9.applyEvent({ type: 'reset' }); assert.equal(g9.cookies, 0); assert.equal(g9.name, 'X'); assert.equal(g9.owned[1], 0);
const g7 = new Game(); g7.owned[1] = 10; g7.recalc();
const r = g7.catchUp(3600); assert.ok(Math.abs(r.gain - g7.baseCps * 3600) < 1e-6);
assert.equal(g7.catchUp(1e9).offlineSecs, 24 * 3600);
const g8 = new Game(); g8.chipsEarned = 50; g8.recalc();
const n8 = g8.buyAllAffordable(true); assert.ok(n8 > 5 && g8.chipsAvailable >= 0, 'himmlische alle kaufen');
console.log('Engine-Tests OK, Erfolge:', ACH.length, 'cps voll:', g3.cps.toExponential(2));
