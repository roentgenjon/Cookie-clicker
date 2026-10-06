// Fenster für tägliche Aufgaben, Keks-Skins und Geschenke.
import { SKINS, TASK_INFO, ITEMS, itemCost, itemMaxAffordable, SOUND_PACKS, MUSIC_TRACKS } from './extras.js';
import { cloud } from './cloud.js';
import { SERIES, SERIES_LEVELS, TOTAL_ALL_TEXT, seriesDesc, seriesNeedText, seriesCost, seriesMaxAffordable, seriesFactor } from './mega.js';
import { parseNum } from './admin.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderDaily(body, { game, fmt, toast, title, changed }) {
  title('📅 Tägliche Aufgaben');
  const st = game.dailyState(); const streak = game.streak;
  body.innerHTML = `<div class="stack daily">
    <div class="kv"><span>🔥 Serie</span><span>${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge</span><span>🎁 Belohnung je Aufgabe</span><span>ca. ${fmt(game.dailyRewardCookies())} Kekse</span></div>
    ${st.map((t) => `<div class="task ${t.claimed ? 'claimed' : ''}"><div class="ti">${TASK_INFO[t.type].icon}</div><div class="tt"><div>${esc(TASK_INFO[t.type].text(t.target))}</div><div class="bar"><i style="width:${Math.min(100, (t.prog / t.target) * 100)}%"></i></div><small>${fmt(t.prog)} / ${fmt(t.target)}</small></div><button data-claim="${t.i}" ${t.done && !t.claimed ? '' : 'disabled'}>${t.claimed ? '✔ Abgeholt' : '🎁 Abholen'}</button></div>`).join('') || '<div class="note">Lade…</div>'}
    <p class="note">Schaffst du alle drei, gibt es einen Bonus (3-fache Belohnung) und 3 goldene Kekse. Jeden Tag ohne Pause erhöht die Serie die Belohnung um 10 % (bis +100 %). Neue Aufgaben kommen täglich um Mitternacht.</p></div>`;
  body.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', () => {
    const r = game.claimDaily(+b.dataset.claim); if (!r) return;
    toast(`🎁 +${fmt(r.reward)} Kekse${r.bonus ? ` · 🎉 Tagesbonus +${fmt(r.bonus)} und 3 goldene Kekse!` : ''}`);
    changed(); renderDaily(body, { game, fmt, toast, title, changed });
  }));
}

export function renderSkins(body, { game, toast, title, changed }) {
  title('🎨 Keks-Skins');
  const un = new Set(game.unlockedSkins());
  body.innerHTML = `<p class="note">Schalte neue Kekse über Erfolge und Fortschritt frei und tippe auf einen, um ihn zu benutzen (${un.size} / ${SKINS.length} freigeschaltet).</p>
    <div class="skins">${SKINS.map((k) => `<button class="skin ${k.id === game.skin ? 'sel' : ''} ${un.has(k.id) ? '' : 'locked'}" data-skin="${k.id}" ${un.has(k.id) ? '' : 'disabled'}><span class="se ${k.cls || ''}" ${k.filter ? `style="filter:${k.filter}"` : ''}>${k.emoji}</span><b>${esc(k.name)}</b><small>${un.has(k.id) ? (k.id === game.skin ? 'Aktiv' : 'Benutzen') : '🔒 ' + esc(k.req)}</small></button>`).join('')}</div>`;
  body.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => { if (game.setSkin(b.dataset.skin)) { changed(); toast('🎨 Skin gewechselt'); renderSkins(body, { game, toast, title, changed }); } }));
}

export async function renderGift(body, { game, fmt, toast, title, save }) {
  title('🎁 Geschenk senden');
  if (!cloud.loggedIn) { body.innerHTML = '<p>Melde dich unter „☁️ Anmelden“ an, um anderen Spielern Kekse zu schenken.</p>'; return; }
  body.innerHTML = `<form class="stack" id="giftForm">
    <p>Verschenke Kekse an einen anderen Spieler. Du kannst höchstens <b>die Hälfte</b> deiner Kekse verschenken, <b>5 Geschenke pro Tag</b>.</p>
    <label>Empfänger<input type="text" id="gTo" list="gList" maxlength="16" placeholder="Name des Spielers" autocomplete="off"></label><datalist id="gList"></datalist>
    <label>Menge<input type="text" id="gAmt" placeholder="z. B. 1 mio, 5e9, 10k"></label>
    <div class="rowf"><button type="button" data-p="0.1">10 %</button><button type="button" data-p="0.25">25 %</button><button type="button" data-p="0.5">50 %</button></div>
    <div class="note">Du hast ${fmt(game.cookies)} Kekse.</div>
    <button type="submit" class="adm-go" id="gGo">🎁 Schenken</button><div class="note" id="gMsg"></div></form>`;
  const msg = (t) => { body.querySelector('#gMsg').textContent = t; };
  cloud.players().then((r) => { body.querySelector('#gList').innerHTML = r.players.filter((n) => n !== cloud.name).map((n) => `<option value="${esc(n)}">`).join(''); }).catch(() => {});
  body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { body.querySelector('#gAmt').value = String(Math.floor(game.cookies * +b.dataset.p)); }));
  body.querySelector('#giftForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const to = body.querySelector('#gTo').value.trim(); const amount = parseNum(body.querySelector('#gAmt').value);
    if (!to) return msg('❌ Bitte einen Empfänger eingeben');
    if (!Number.isFinite(amount) || amount < 1) return msg('❌ Ungültige Menge');
    if (amount > game.cookies) return msg('❌ So viele Kekse hast du nicht');
    body.querySelector('#gGo').disabled = true; msg('Sende…');
    try {
      await save(); // aktuellen Vorrat speichern, der Server prüft das Limit anhand davon
      const r = await cloud.gift(to, amount);
      game.cookies = Math.max(0, game.cookies - amount);
      toast(`🎁 ${fmt(amount)} Kekse an ${esc(r.to || to)} geschickt (heute noch ${r.left} Geschenke)`);
      msg(`✔ Geschickt! Heute noch ${r.left} Geschenke.`); body.querySelector('#gAmt').value = '';
    } catch (err) { msg('❌ ' + err.message); }
    body.querySelector('#gGo').disabled = false;
  });
}

let itemAmt = 1; // 1 / 10 / 100 / 'max'
const itemN = (it, game) => (itemAmt === 'max' ? Math.max(1, itemMaxAffordable(it, game.itemCount(it.id), game.cookies)) : itemAmt);
// Schlüssel für das Neuzeichnen: ändert sich, wenn sich Besitz oder Leistbarkeit ändert
export function itemsStateKey(game) { return JSON.stringify(game.items) + itemAmt + ITEMS.map((it) => (game.cookies >= itemCost(it, game.itemCount(it.id), itemN(it, game)) ? 1 : 0)).join(''); }

export function renderItems(body, { game, fmt, toast, title, changed, buySound }) {
  title('🛒 Item-Shop');
  const pctTotal = Math.round((game.itemMult - 1) * 100);
  const total = Object.values(game.items).reduce((a, b) => a + b, 0);
  body.innerHTML = `<div class="stack">
    <div class="shop-top"><div><b>Dein Bonus: +${pctTotal.toLocaleString('de-DE')} %</b><div class="note">auf Kekse pro Sekunde und Klickertrag · ${total.toLocaleString('de-DE')} Items</div></div>
      <div class="seg" id="itemAmt">${[1, 10, 100, 'max'].map((n) => `<button data-n="${n}" class="${n === itemAmt ? 'on' : ''}">${n === 'max' ? 'Max' : '×' + n}</button>`).join('')}</div></div>
    <p class="note">Items kannst du <b>beliebig oft</b> kaufen, jedes Exemplar gibt den Bonus dazu. Der Preis steigt mit jedem Exemplar um 12 %. Alles <b>bleibt beim Aufstieg erhalten</b>. Du hast ${fmt(game.cookies)} 🍪</p>
    <div class="items">${ITEMS.map((it) => {
      const have = game.itemCount(it.id); const n = itemN(it, game); const cost = itemCost(it, have, n); const can = game.cookies >= cost;
      return `<div class="item ${have ? 'has' : ''} ${it.best ? 'best' : ''}"><div class="ie">${it.emoji}</div><div class="in"><b>${it.name}</b>${it.best ? ' <span class="tag">BESTES ITEM</span>' : ''}<div class="ip">+${it.pct.toLocaleString('de-DE')} % Kekse je Stück</div><div class="have">Du hast: <b>${have.toLocaleString('de-DE')}</b>${have ? ` (+${(have * it.pct).toLocaleString('de-DE')} %)` : ''}</div></div><button data-item="${it.id}" ${can ? '' : 'disabled'}>${n > 1 ? `${n.toLocaleString('de-DE')}× ` : ''}🍪 ${fmt(cost)}</button></div>`;
    }).join('')}</div></div>`;
  const redraw = () => renderItems(body, { game, fmt, toast, title, changed, buySound });
  body.querySelector('#itemAmt').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; itemAmt = b.dataset.n === 'max' ? 'max' : +b.dataset.n; redraw(); });
  body.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => {
    const it = ITEMS.find((x) => x.id === b.dataset.item); const got = game.buyItem(it.id, itemN(it, game));
    if (got) { buySound(); toast(`🛒 ${got.toLocaleString('de-DE')}× <b>${it.emoji} ${it.name}</b> gekauft: +${(got * it.pct).toLocaleString('de-DE')} % Kekse!`); changed(); redraw(); }
  }));
}

let soundTab = 'pack';
export function renderSoundShop(body, { game, fmt, toast, title, changed, buySound, preview, apply }) {
  title('🔊 Sound-Shop');
  const list = soundTab === 'pack' ? SOUND_PACKS : MUSIC_TRACKS;
  const active = soundTab === 'pack' ? game.sounds.pack : game.sounds.track;
  body.innerHTML = `<div class="stack">
    <div class="shop-top"><div><b>${soundTab === 'pack' ? 'Klang-Pakete' : 'Musikstücke'}</b><div class="note">Kaufe sie einmal für Kekse, sie bleiben beim Aufstieg erhalten. Du hast ${fmt(game.cookies)} 🍪</div></div>
      <div class="seg" id="sTabs"><button data-t="pack" class="${soundTab === 'pack' ? 'on' : ''}">🔊 Klänge</button><button data-t="track" class="${soundTab === 'track' ? 'on' : ''}">🎵 Musik</button></div></div>
    ${soundTab === 'track' ? '<p class="note">Die Musik schaltest du in den ⚙️ Optionen an oder aus. Das gewählte Stück spielt dann im Hintergrund.</p>' : ''}
    <div class="items">${list.map((d) => {
      const own = game.soundOwned(d.id); const can = !own && game.cookies >= d.cost; const isActive = own && d.id === active;
      return `<div class="item ${own ? 'has' : ''} ${isActive ? 'best' : ''}"><div class="ie">${d.emoji}</div><div class="in"><b>${d.name}</b> ${isActive ? '<span class="tag">AKTIV</span>' : ''}<div class="have">${d.desc}</div></div><div class="sbtns"><button data-prev="${d.id}" title="Anhören">▶ Hören</button>${own ? `<button data-use="${d.id}" ${isActive ? 'disabled' : ''}>${isActive ? '✔ Aktiv' : 'Benutzen'}</button>` : `<button data-buy="${d.id}" ${can ? '' : 'disabled'}>🍪 ${fmt(d.cost)}</button>`}</div></div>`;
    }).join('')}</div></div>`;
  const redraw = () => renderSoundShop(body, { game, fmt, toast, title, changed, buySound, preview, apply });
  body.querySelectorAll('#sTabs [data-t]').forEach((b) => b.addEventListener('click', () => { soundTab = b.dataset.t; redraw(); }));
  body.querySelectorAll('[data-prev]').forEach((b) => b.addEventListener('click', () => preview(soundTab, b.dataset.prev)));
  body.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { if (game.selectSound(b.dataset.use)) { apply(); changed(); preview(soundTab, b.dataset.use); redraw(); } }));
  body.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.buy; if (game.buySound(id)) { game.selectSound(id); apply(); buySound(); toast(`🔊 <b>${(list.find((d) => d.id === id) || {}).name}</b> gekauft und aktiviert!`); changed(); redraw(); }
  }));
}

// ---- Mega-Upgrades: 100 Reihen mit je ~100 Billionen Stufen ----
let megaAmt = 1; // 1 / 10 / 100 / 1000 / 'max'
const megaN = (i, game) => (megaAmt === 'max' ? Math.max(1, seriesMaxAffordable(SERIES[i], game.series[i], game.cookies)) : Math.min(megaAmt, SERIES_LEVELS - game.series[i]));
const big = (n) => BigInt(Math.floor(n)).toLocaleString('de-DE');
export function megaStateKey(game) { return game.series.join() + megaAmt + SERIES.map((_, i) => (game.seriesVisible(i) ? (game.cookies >= seriesCost(SERIES[i], game.series[i], megaN(i, game)) ? 2 : 1) : 0)).join(''); }

export function renderMega(body, { game, fmt, toast, title, changed, buySound }) {
  title('♾️ Mega-Upgrades');
  const vis = SERIES.map((_, i) => i).filter((i) => game.seriesVisible(i));
  vis.sort((a, b) => game.seriesPrice(a, 1) - game.seriesPrice(b, 1));
  const locked = SERIES.map((_, i) => i).filter((i) => !game.seriesVisible(i)).sort((a, b) => (SERIES[a].need || 0) - (SERIES[b].need || 0) || (SERIES[a].baked || 0) - (SERIES[b].baked || 0));
  body.innerHTML = `<div class="stack">
    <div class="shop-top"><div><b>${big(game.upgradeCount + game.seriesTotal)} / ${TOTAL_ALL_TEXT}</b><div class="note">Upgrades gekauft (normale + Mega-Stufen)</div></div>
      <div class="seg" id="mgAmt">${[1, 10, 100, 1000, 'max'].map((n) => `<button data-n="${n}" class="${n === megaAmt ? 'on' : ''}">${n === 'max' ? 'Max' : '×' + n}</button>`).join('')}</div></div>
    <p class="note">Jede Reihe hat knapp <b>100 Billionen Stufen</b>, die du nacheinander kaufst. Jede Stufe erhöht die Wirkung etwas, wird aber auch teurer. Die Reihen gehören zu den normalen Upgrades und werden beim Aufstieg zurückgesetzt. Du hast ${fmt(game.cookies)} 🍪</p>
    <div class="items">${vis.map((i) => {
      const s = SERIES[i]; const have = game.series[i]; const n = megaN(i, game); const cost = seriesCost(s, have, n); const can = Number.isFinite(cost) && game.cookies >= cost;
      return `<div class="item ${have ? 'has' : ''}"><div class="ie">${s.icon}<small class="ib">${s.badge}</small></div><div class="in"><b>${s.name}</b><div class="ip">${seriesDesc(s).split(': ').pop()}</div><div class="have">Stufe <b>${big(have)}</b>${have ? ` · aktuell ×${fmt(seriesFactor(s, have))}` : ''}</div></div><button data-mg="${i}" ${can ? '' : 'disabled'}>${n > 1 ? `${n.toLocaleString('de-DE')}× ` : ''}🍪 ${Number.isFinite(cost) ? fmt(cost) : '∞'}</button></div>`;
    }).join('') || '<div class="adm-empty">Noch keine Reihe freigeschaltet. Kaufe Gebäude!</div>'}</div>
    ${locked.length ? `<div class="adm-sec"><h4>🔒 ${locked.length} weitere Reihen gesperrt</h4>${locked.slice(0, 5).map((i) => `<div class="adm-sched"><span>${SERIES[i].icon}</span><span>${SERIES[i].name}</span><span class="note">${seriesNeedText(SERIES[i])}</span></div>`).join('')}</div>` : ''}</div>`;
  const redraw = () => renderMega(body, { game, fmt, toast, title, changed, buySound });
  body.querySelector('#mgAmt').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; megaAmt = b.dataset.n === 'max' ? 'max' : +b.dataset.n; redraw(); });
  body.querySelectorAll('[data-mg]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.mg; const got = game.buySeries(i, megaN(i, game));
    if (got) { buySound(); changed(); redraw(); }
  }));
}
