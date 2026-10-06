// Fenster für tägliche Aufgaben, Keks-Skins und Geschenke.
import { SKINS, TASK_INFO, ITEMS, itemCost, itemMaxAffordable } from './extras.js';
import { cloud } from './cloud.js';
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
