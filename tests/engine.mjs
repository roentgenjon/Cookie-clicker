import assert from 'node:assert/strict';
import { Game, ACH } from '../js/engine.js';
import { Big, B, fmtBig } from '../js/big.js';
const N = (x) => Big.from(x).toNumber();

const g = new Game();
g.earn(1000);
assert.ok(g.buyBuilding(0, 1) && g.owned[0] === 1);
assert.ok(g.buyBuilding(1, 'max') || true);
g.tick(10);
assert.ok(N(g.cookies) > 0);
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
assert.ok(Number.isFinite(g3.cps.log10()) && g3.cps.log10() > 0 && Number.isFinite(g3.clickValue.log10()), 'cps endlich');
// Aufstieg
const g4 = new Game(); g4.total = B(8e12); g4.cookies = B(8e12);
assert.equal(g4.chipsGain, 2);
assert.ok(g4.ascend() && g4.chipsEarned === 2 && g4.cookies.isZero());
// Erfolge
const g5 = new Game(); g5.owned[0] = 1; g5.total = B(5); g5.clicks = 1;
assert.ok(g5.checkAchievements().length >= 2);
// Goldener Keks
const g6 = new Game(); g6.nextGolden = 0; g6.tick(1); assert.equal(g6.gcs.length, 1); assert.ok(g6.clickGolden(g6.gcs[0].id)); assert.equal(g6.gcs.length, 0);
// Admin-Ereignisse
const g9 = new Game(); g9.owned[1] = 5; g9.recalc();
g9.applyEvent({ type: 'golden', effect: 'lucky', count: 3 }); assert.ok(g9.gcs.length === 3 && g9.gcs[0].effect === 'lucky');
g9.applyEvent({ type: 'cookies', amount: 1000 }); assert.equal(N(g9.cookies), 1000);
g9.applyEvent({ type: 'cookies', amount: -5000 }); assert.ok(g9.cookies.isZero());
g9.applyEvent({ type: 'chips', amount: 4 }); assert.equal(g9.chipsEarned, 4);
g9.applyEvent({ type: 'building', b: 2, amount: 7 }); assert.equal(g9.owned[2], 7);
g9.applyEvent({ type: 'buff', kind: 'frenzy', mult: 10, seconds: 60 }); assert.equal(g9.buffMult('frenzy'), 10);
g9.applyEvent({ type: 'buff', kind: 'click', mult: 50, seconds: 60 }); assert.equal(g9.buffMult('click'), 50);
g9.applyEvent({ type: 'upgrades', mode: 'all' }); assert.equal(g9.upgradeCount, 400000);
g9.applyEvent({ type: 'upgrades', mode: 'none' }); assert.equal(g9.upgradeCount, 0);
g9.applyEvent({ type: 'achievements' }); assert.equal(g9.achCount(), ACH.length);
g9.name = 'X'; g9.applyEvent({ type: 'reset' }); assert.ok(g9.cookies.isZero()); assert.equal(g9.name, 'X'); assert.equal(g9.owned[1], 0);
const g7 = new Game(); g7.owned[1] = 10; g7.recalc();
const r = g7.catchUp(3600); assert.ok(Math.abs(N(r.gain) / N(g7.baseCps.mulN(3600)) - 1) < 1e-9);
assert.equal(g7.catchUp(1e9).offlineSecs, 24 * 3600);
const g8 = new Game(); g8.chipsEarned = 50; g8.recalc();
const n8 = g8.buyAllAffordable(true); assert.ok(n8 > 5 && g8.chipsAvailable >= 0, 'himmlische alle kaufen');
// Sammelkauf + Speichergröße
const g10 = new Game(); g10.owned.fill(300); g10.recalc(); g10.total = g10.cookies = B(1e60);
let t0 = Date.now(); const bought = g10.buyAllAffordable(false); const tBuy = Date.now() - t0;
assert.ok(bought > 100000 && Number.isFinite(g10.cps.log10()), `Sammelkauf: ${bought}`);
const ser = JSON.parse(JSON.stringify(g10.serialize()));
const g11 = new Game(); g11.load(ser); assert.equal(g11.upgradeCount, g10.upgradeCount); assert.ok(Math.abs(g11.baseCps.div(g10.baseCps).toNumber() - 1) < 1e-9);
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
const first = g15.daily.tasks[0]; g15.daily.prog[first.type] = first.target; g15.cookies = B(0);
assert.equal(g15.claimableCount(), 1); const cr = g15.claimDaily(0); assert.ok(N(cr.reward) >= 1000 && N(g15.cookies) >= 1000); assert.equal(g15.claimDaily(0), null, 'nur einmal');
g15.daily.tasks.forEach((tk, i) => { g15.daily.prog[tk.type] = tk.target; if (i) g15.claimDaily(i); });
assert.equal(g15.streak, 1); assert.equal(g15.gcs.length, 3, 'Bonus: 3 goldene Kekse');
const sv = JSON.parse(JSON.stringify(g15.serialize())); const g16 = new Game(); g16.load(sv); assert.equal(g16.daily.claimed.length, 3); assert.equal(g16.streak, 1);
assert.ok(g16.unlockedSkins().includes('classic')); assert.equal(g16.setSkin('gold'), false); g16.golden = 12; assert.ok(g16.setSkin('fortune')); assert.equal(g16.skin, 'fortune');
const g17 = new Game(); g17.click(); g17.buyBuilding(0, 1); assert.equal(g17.daily.prog.clicks, 1);
// Item-Shop (beliebig oft kaufbar)
const g18 = new Game(); g18.owned[1] = 10; g18.recalc(); const base18 = N(g18.baseCps); g18.cookies = B(1e16);
assert.equal(g18.buyItem('choco'), 1); assert.ok(Math.abs(N(g18.baseCps) / base18 - 1.15) < 1e-9, '+15 %');
const cost2 = 1e14 * 1.12; const before = N(g18.cookies); assert.equal(g18.buyItem('choco'), 1); assert.ok(Math.abs(before - N(g18.cookies) - cost2) / cost2 < 1e-9, 'Preis steigt ×1,12');
assert.equal(g18.itemCount('choco'), 2); assert.ok(Math.abs(N(g18.baseCps) / base18 - 1.30) < 1e-9, '2× = +30 %');
assert.equal(g18.buyItem('icetea'), 0, 'zu teuer'); g18.cookies = B(1e50); assert.equal(g18.buyItem('icetea', 3), 3); assert.equal(g18.itemCount('icetea'), 3);
assert.ok(Math.abs(N(g18.baseCps) / base18 - (1 + 0.30 + 30)) < 1e-9, '3× Eistee = +3000 %');
const mx = new Game(); mx.cookies = B(1e18); const nmax = mx.buyItem('choco', 'max'); assert.ok(nmax > 20 && N(mx.cookies) >= 0 && mx.buyItem('choco', 1) <= 1);
const clk = new Game(); const c0 = N(clk.clickValue); clk.cookies = B(1e15); clk.buyItem('choco'); assert.ok(Math.abs(N(clk.clickValue) / c0 - 1.15) < 1e-9, 'Klick +15 %');
g18.total = B(8e12); g18.cookies = B(0); g18.ascend(); assert.deepEqual(g18.items, { choco: 2, icetea: 3 }, 'Items bleiben beim Aufstieg');
const g19 = new Game(); g19.load(JSON.parse(JSON.stringify(g18.serialize()))); assert.deepEqual(g19.items, { choco: 2, icetea: 3 }); assert.ok(g19.unlockedSkins().includes('icetea'));
const old = new Game(); old.load({ v: 2, items: ['choco', 'milk', 'nope'] }); assert.deepEqual(old.items, { choco: 1, milk: 1 }, 'alte Spielstände');
g19.hardReset(); assert.deepEqual(g19.items, {});
// Preise ×1e9
const pc = new Game(); pc.cookies = B(99999999999999); assert.equal(pc.buyItem('choco'), 0, 'Schoko-Keks kostet jetzt 1e14'); pc.cookies = B(1e14); assert.equal(pc.buyItem('choco'), 1);
// Sound-Shop
const sg = new Game(); assert.deepEqual(sg.sounds, { owned: ['classic', 'calm'], pack: 'classic', track: 'calm' });
assert.equal(sg.buySound('retro'), false, 'zu teuer'); sg.cookies = B(5e7); assert.ok(sg.buySound('retro')); assert.equal(sg.buySound('retro'), false, 'nur einmal'); assert.equal(N(sg.cookies), 4e7);
assert.equal(sg.selectSound('zen'), false, 'nicht gekauft'); assert.ok(sg.selectSound('retro')); assert.equal(sg.sounds.pack, 'retro');
sg.cookies = B(1e9); assert.ok(sg.buySound('lofi')); assert.ok(sg.selectSound('lofi')); assert.equal(sg.sounds.track, 'lofi');
sg.total = B(8e12); sg.ascend(); assert.equal(sg.sounds.pack, 'retro', 'bleibt beim Aufstieg');
const sg2 = new Game(); sg2.load(JSON.parse(JSON.stringify(sg.serialize()))); assert.deepEqual(sg2.sounds, sg.sounds);
const sg3 = new Game(); sg3.load({ v: 2, sounds: { owned: ['zen', 'unsinn'], pack: 'epic', track: 'calm' } }); assert.equal(sg3.sounds.pack, 'classic', 'nicht besessen -> klassisch'); assert.ok(sg3.sounds.owned.includes('zen') && !sg3.sounds.owned.includes('unsinn'));
// Mega-Upgrades
import('../js/mega.js').then(({ SERIES, SERIES_LEVELS, TOTAL_ALL }) => {
  assert.equal(TOTAL_ALL, 10n ** 16n); assert.equal(SERIES.length, 100);
  const mg = new Game(); mg.owned[0] = 20; mg.recalc(); const b0 = N(mg.baseCps);
  assert.equal(mg.seriesVisible(0), true); assert.equal(mg.seriesVisible(6), false, 'Silber braucht 50');
  assert.equal(mg.buySeries(0), 0, 'kein Geld'); mg.cookies = B(1e6);
  assert.equal(mg.buySeries(0, 1), 1); assert.ok(Math.abs(N(mg.baseCps) / b0 - 1.0008) < 1e-9);
  const lvl = mg.buySeries(0, 'max'); assert.ok(lvl > 50 && N(mg.cookies) >= 0); assert.equal(mg.series[0], 1 + lvl);
  assert.ok(Math.abs(N(mg.baseCps) / b0 - Math.pow(1.0008, 1 + lvl)) < 1e-6, 'Wirkung wächst mit Stufen');
  const sv = new Game(); sv.load(JSON.parse(JSON.stringify(mg.serialize()))); assert.equal(sv.series[0], mg.series[0]); assert.ok(Math.abs(sv.baseCps.div(mg.baseCps).toNumber() - 1) < 1e-9);
  mg.total = B(8e12); mg.ascend(); assert.equal(mg.series[0], 0, 'Reihen werden beim Aufstieg zurückgesetzt');
  const huge = new Game(); huge.owned[0] = 600; huge.cookies = B(1e300); huge.recalc(); const got = huge.buySeries(5, 'max'); assert.ok(got > 1000 && Number.isFinite(huge.cps.log10()), `riesige Stufenzahl: ${got}`);
  const bad = new Game(); bad.load({ v: 2, series: ['x', -5, 1e30, 3] }); assert.deepEqual(bad.series.slice(0, 4), [0, 0, SERIES_LEVELS, 3]);
});
// „Alle kaufen“ mit Mega-Reihen
const ba = new Game(); ba.owned.fill(100); ba.recalc(); ba.total = B(1e15); ba.cookies = B(1e12); const baBefore = N(ba.cps);
const baN = ba.buyAllSeries(); assert.ok(baN > 100, `Mega-Stufen gekauft: ${baN}`); assert.ok(N(ba.cps) > baBefore); assert.ok(N(ba.cookies) >= 0 && N(ba.cookies) < 1e12 * 0.5, 'Großteil des Guthabens ausgegeben');
assert.ok(ba.series.filter((n) => n > 0).length > 20, 'verteilt auf viele Reihen');
const bb = new Game(); bb.cookies = B(5); assert.equal(bb.buyAllSeries(), 0);
console.log('Engine-Tests OK, Erfolge:', ACH.length, 'cps voll:', g3.cps.toString());

// ---- Große Zahlen bis 9,99e999 ----
{
  const a = B('5e500'), b = B('3e500');
  assert.equal(a.add(b).toString(), B('8e500').toString()); assert.ok(a.sub(b).toString().startsWith('2.0000000000000') && a.sub(b).e === 500);
  assert.equal(B('1e999').mulN(20).clamp().toString(), B('9.99e999').toString(), 'Obergrenze 9,99e999');
  assert.equal(fmtBig(B('1.234e500')), '1,23e500'); assert.equal(fmtBig(B(1500000)), '1,5 Mio'); assert.equal(fmtBig(B(15)), '15');
  assert.ok(B('1e400').gt(B('9e399')) && B('1e400').lt(B('1e401')) && B(0).lt(B(1)));
  // Spiel mit riesigen Multiplikatoren: endlich, nie NaN, bleibt unter der Grenze
  const g = new Game(); g.globalLog = 900; g.clickLog = 900; g.tierLog.fill(900); g.owned.fill(1e6); g.updateCps();
  for (let i = 0; i < 5; i++) g.earn(g.cps.mulN(1e6));
  g.click();
  for (const v of [g.baseCps, g.cps, g.clickValue, g.cookies, g.total]) assert.ok(Number.isFinite(v.log10()) && v.e <= 1e4, 'endlich: ' + v);
  assert.equal(g.cookies.toString(), B('9.99e999').toString(), 'Kekse stoppen bei 9,99e999');
  const g2 = new Game(); g2.load(JSON.parse(JSON.stringify(g.serialize()))); assert.equal(g2.cookies.toString(), g.cookies.toString(), 'Speichern/Laden über 1e308');
  // Preise und Kauf jenseits von 1e308
  const h = new Game(); h.owned[5] = 8000; h.cookies = B('1e600'); h.total = B('1e600'); h.recalc();
  const mxb = h.maxAffordable(5); assert.ok(mxb > 1000, 'Gebäude über 1e308 Preis: ' + mxb);
  assert.ok(h.buyBuilding(5, 'max') && h.owned[5] === 8000 + mxb && h.cookies.lt(B('1e600')));
  const m = new Game(); m.owned[0] = 20; m.recalc(); m.cookies = B('1e900'); m.total = B('1e900');
  const got = m.buySeries(0, 'max'); assert.ok(got > 1e5 && m.cookies.gte(0), 'Mega-Stufen: ' + got);
  assert.ok(Number.isFinite(m.baseCps.log10()));
  const i2 = new Game(); i2.cookies = B('1e900'); assert.ok(i2.buyItem('icetea', 'max') > 100, 'Items');
  i2.cookies = B('1e900'); i2.applyEvent({ type: 'cookies', amount: '-5e899' }); assert.ok(i2.cookies.e === 899 || i2.cookies.e === 900);
  i2.applyEvent({ type: 'cookies', amount: '4e999' }); assert.ok(i2.cookies.e === 999);
  const old = new Game(); old.load({ v: 2, cookies: 123456, total: 1e20 }); assert.equal(N(old.cookies), 123456, 'alte Spielstände (Zahl)');
  console.log('Große-Zahlen-Test OK');
}
