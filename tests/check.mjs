import assert from 'node:assert/strict';
import { UPGRADES, TOTAL_UPGRADES, buildAchievements, BUILDINGS } from '../js/data.js';
assert.equal(UPGRADES.length, TOTAL_UPGRADES, 'genau 10.000 Upgrades');
UPGRADES.forEach((u, i) => {
  assert.equal(u.id, i);
  assert.ok(Number.isFinite(u.cost) && u.cost >= 1, `Kosten ${i}`);
  assert.ok(u.name && u.desc && u.icon);
});
assert.equal(new Set(UPGRADES.map((u) => u.name + u.kind + u.id)).size, 10000);
const a = buildAchievements();
console.log(`OK: ${UPGRADES.length} Upgrades, ${a.length} Erfolge, ${BUILDINGS.length} Gebäude`);
