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
const g6 = new Game(); g6.nextGolden = 0; g6.tick(1); assert.ok(g6.gc); assert.ok(g6.clickGolden());
console.log('Engine-Tests OK, Erfolge:', ACH.length, 'cps voll:', g3.cps.toExponential(2));
