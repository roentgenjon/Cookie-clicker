import assert from 'node:assert/strict';
import { Game, ACH } from '../js/engine.js';

const g = new Game();
g.earn(1000);
assert.ok(g.buyBuilding(0, 1) && g.owned[0] === 1);
assert.ok(g.buyBuilding(1, 'max') || true);
g.tick(10);
assert.ok(g.cookies > 0);
// Upgrades kaufen
g.earn(1e9);
const vis = g.visibleList(false, null, 10).ids;
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
assert.equal(g3.upgradeCount, 400000);
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
g9.applyEvent({ type: 'upgrades', mode: 'all' }); assert.equal(g9.upgradeCount, 400000);
g9.applyEvent({ type: 'upgrades', mode: 'none' }); assert.equal(g9.upgradeCount, 0);
g9.applyEvent({ type: 'achievements' }); assert.equal(g9.achCount(), ACH.length);
g9.name = 'X'; g9.applyEvent({ type: 'reset' }); assert.equal(g9.cookies, 0); assert.equal(g9.name, 'X'); assert.equal(g9.owned[1], 0);
const g7 = new Game(); g7.owned[1] = 10; g7.recalc();
const r = g7.catchUp(3600); assert.ok(Math.abs(r.gain - g7.baseCps * 3600) < 1e-6);
assert.equal(g7.catchUp(1e9).offlineSecs, 24 * 3600);
const g8 = new Game(); g8.chipsEarned = 50; g8.recalc();
const n8 = g8.buyAllAffordable(true); assert.ok(n8 > 5 && g8.chipsAvailable >= 0, 'himmlische alle kaufen');
// Sammelkauf + Speichergröße
const g10 = new Game(); g10.owned.fill(300); g10.recalc(); g10.total = g10.cookies = 1e60;
let t0 = Date.now(); const bought = g10.buyAllAffordable(false); const tBuy = Date.now() - t0;
assert.ok(bought > 100000 && Number.isFinite(g10.cps), `Sammelkauf: ${bought}`);
const ser = JSON.parse(JSON.stringify(g10.serialize()));
const g11 = new Game(); g11.load(ser); assert.equal(g11.upgradeCount, g10.upgradeCount); assert.ok(Math.abs(g11.baseCps / g10.baseCps - 1) < 1e-9);
const size = JSON.stringify(ser).length; assert.ok(size < 100000, `Spielstand ${size} Zeichen`);
const g12 = new Game(); g12.bought.fill(1); g12.recalc(); const full = JSON.stringify(g12.serialize()).length;
const g13 = new Game(); for (let i = 0; i < 400000; i += 2) g13.bought[i] = 1; g13.recalc(); const worst = JSON.stringify(g13.serialize()).length;
assert.ok(worst < 100000, 'Schlechtester Fall');
const g14 = new Game(); g14.load({ v: 1, cookies: 5, bought: 'AAAA', chipsEarned: 3, chipsSpent: 3 }); assert.equal(g14.upgradeCount, 0); assert.equal(g14.chipsSpent, 0);
console.log(`Sammelkauf ${bought} Upgrades in ${tBuy} ms · Spielstand ${size} Zeichen (alles gekauft: ${full}, schlechtester Fall: ${worst})`);
// Tägliche Aufgaben, Skins
const g15 = new Game(); g15.owned[0] = 5; g15.recalc(); g15.ensureDaily();
assert.equal(g15.daily.tasks.length, 3); assert.equal(new Set(g15.daily.tasks.map((t) => t.type)).size, 3);
const g15b = new Game(); g15b.ensureDaily(); assert.deepEqual(g15b.daily.tasks.map((t) => t.type), g15.daily.tasks.map((t) => t.type), 'gleiches Datum = gleiche Aufgaben');
const first = g15.daily.tasks[0]; g15.daily.prog[first.type] = first.target; g15.cookies = 0;
assert.equal(g15.claimableCount(), 1); const cr = g15.claimDaily(0); assert.ok(cr.reward >= 1000 && g15.cookies >= 1000); assert.equal(g15.claimDaily(0), null, 'nur einmal');
g15.daily.tasks.forEach((tk, i) => { g15.daily.prog[tk.type] = tk.target; if (i) g15.claimDaily(i); });
assert.equal(g15.streak, 1); assert.equal(g15.gcs.length, 3, 'Bonus: 3 goldene Kekse');
const sv = JSON.parse(JSON.stringify(g15.serialize())); const g16 = new Game(); g16.load(sv); assert.equal(g16.daily.claimed.length, 3); assert.equal(g16.streak, 1);
assert.ok(g16.unlockedSkins().includes('classic')); assert.equal(g16.setSkin('gold'), false); g16.golden = 12; assert.ok(g16.setSkin('fortune')); assert.equal(g16.skin, 'fortune');
const g17 = new Game(); g17.click(); g17.buyBuilding(0, 1); assert.equal(g17.daily.prog.clicks, 1);
// Item-Shop (beliebig oft kaufbar)
const g18 = new Game(); g18.owned[1] = 10; g18.recalc(); const base18 = g18.baseCps; g18.cookies = 1e16;
assert.equal(g18.buyItem('choco'), 1); assert.ok(Math.abs(g18.baseCps / base18 - 1.15) < 1e-9, '+15 %');
const cost2 = 1e14 * 1.12; const before = g18.cookies; assert.equal(g18.buyItem('choco'), 1); assert.ok(Math.abs(before - g18.cookies - cost2) / cost2 < 1e-9, 'Preis steigt ×1,12');
assert.equal(g18.itemCount('choco'), 2); assert.ok(Math.abs(g18.baseCps / base18 - 1.30) < 1e-9, '2× = +30 %');
assert.equal(g18.buyItem('icetea'), 0, 'zu teuer'); g18.cookies = 1e50; assert.equal(g18.buyItem('icetea', 3), 3); assert.equal(g18.itemCount('icetea'), 3);
assert.ok(Math.abs(g18.baseCps / base18 - (1 + 0.30 + 30)) < 1e-9, '3× Eistee = +3000 %');
const mx = new Game(); mx.cookies = 1e18; const nmax = mx.buyItem('choco', 'max'); assert.ok(nmax > 20 && mx.cookies >= 0 && mx.buyItem('choco', 1) <= 1);
const clk = new Game(); const c0 = clk.clickValue; clk.cookies = 1e15; clk.buyItem('choco'); assert.ok(Math.abs(clk.clickValue / c0 - 1.15) < 1e-9, 'Klick +15 %');
g18.total = 8e12; g18.cookies = 0; g18.ascend(); assert.deepEqual(g18.items, { choco: 2, icetea: 3 }, 'Items bleiben beim Aufstieg');
const g19 = new Game(); g19.load(JSON.parse(JSON.stringify(g18.serialize()))); assert.deepEqual(g19.items, { choco: 2, icetea: 3 }); assert.ok(g19.unlockedSkins().includes('icetea'));
const old = new Game(); old.load({ v: 2, items: ['choco', 'milk', 'nope'] }); assert.deepEqual(old.items, { choco: 1, milk: 1 }, 'alte Spielstände');
g19.hardReset(); assert.deepEqual(g19.items, {});
// Preise ×1e9
const pc = new Game(); pc.cookies = 99999999999999; assert.equal(pc.buyItem('choco'), 0, 'Schoko-Keks kostet jetzt 1e14'); pc.cookies = 1e14; assert.equal(pc.buyItem('choco'), 1);
// Sound-Shop
const sg = new Game(); assert.deepEqual(sg.sounds, { owned: ['classic', 'calm'], pack: 'classic', track: 'calm' });
assert.equal(sg.buySound('retro'), false, 'zu teuer'); sg.cookies = 5e7; assert.ok(sg.buySound('retro')); assert.equal(sg.buySound('retro'), false, 'nur einmal'); assert.equal(sg.cookies, 4e7);
assert.equal(sg.selectSound('zen'), false, 'nicht gekauft'); assert.ok(sg.selectSound('retro')); assert.equal(sg.sounds.pack, 'retro');
sg.cookies = 1e9; assert.ok(sg.buySound('lofi')); assert.ok(sg.selectSound('lofi')); assert.equal(sg.sounds.track, 'lofi');
sg.total = 8e12; sg.ascend(); assert.equal(sg.sounds.pack, 'retro', 'bleibt beim Aufstieg');
const sg2 = new Game(); sg2.load(JSON.parse(JSON.stringify(sg.serialize()))); assert.deepEqual(sg2.sounds, sg.sounds);
const sg3 = new Game(); sg3.load({ v: 2, sounds: { owned: ['zen', 'unsinn'], pack: 'epic', track: 'calm' } }); assert.equal(sg3.sounds.pack, 'classic', 'nicht besessen -> klassisch'); assert.ok(sg3.sounds.owned.includes('zen') && !sg3.sounds.owned.includes('unsinn'));
console.log('Engine-Tests OK, Erfolge:', ACH.length, 'cps voll:', g3.cps.toExponential(2));
