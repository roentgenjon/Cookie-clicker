import assert from 'node:assert/strict';
import { TOTAL_UPGRADES, COUNTS, COST, upgrade, buildAchievements, BUILDINGS, ORDER_COOKIE, ORDER_HEAVEN, HEAVEN_START } from '../js/data.js';
assert.equal(TOTAL_UPGRADES, 400000, 'genau 400.000 Upgrades');
assert.equal(Object.values(COUNTS).reduce((a, b) => a + b, 0), TOTAL_UPGRADES);
for (let i = 0; i < TOTAL_UPGRADES; i++) {
  assert.ok(Number.isFinite(COST[i]) && COST[i] >= 1, `Kosten ${i}`);
  if (i % 7 === 0 || i < 100) { const u = upgrade(i); assert.equal(u.id, i); assert.ok(u.name && u.desc && u.icon, `Text ${i}`); }
}
assert.ok(ORDER_COOKIE.length === HEAVEN_START && ORDER_HEAVEN.length === COUNTS.heaven);
for (let i = 1; i < ORDER_COOKIE.length; i++) assert.ok(COST[ORDER_COOKIE[i]] >= COST[ORDER_COOKIE[i - 1]], 'sortiert');
const a = buildAchievements();
console.log(`OK: ${TOTAL_UPGRADES} Upgrades, ${a.length} Erfolge, ${BUILDINGS.length} Gebäude, max Kosten ${COST.reduce((m, c) => (c > m ? c : m), 0).toExponential(2)}`);
