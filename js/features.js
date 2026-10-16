// Fenster für tägliche Aufgaben, Keks-Skins und Geschenke.
import { SKINS, TASK_INFO, SOUND_PACKS, MUSIC_TRACKS } from './extras.js';
import { cloud } from './cloud.js';
import { SING_MILESTONES, CRYSTAL_SHOP } from './engine.js';
import { SERIES, SERIES_LEVELS, TOTAL_ALL_TEXT, fmtUp, seriesDesc, seriesNeedText, seriesCost, seriesMaxAffordable, seriesFactor } from './mega.js';
import { parseBig } from './admin.js';
import { Big } from './big.js';
import { friends } from './friends.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderDaily(body, { game, fmt, toast, title, changed }) {
  title('📅 Tägliche Aufgaben');
  const st = game.dailyState(); const streak = game.streak;
  body.innerHTML = `<div class="stack daily">
    <div class="kv"><span>🔥 Serie</span><span>${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge</span><span>🎁 Belohnung je Aufgabe</span><span>ca. ${fmt(game.dailyRewardCookies())} Kekse</span></div>
    ${st.map((t) => `<div class="task ${t.claimed ? 'claimed' : ''}"><div class="ti">${TASK_INFO[t.type].icon}</div><div class="tt"><div>${esc(TASK_INFO[t.type].text(t.target))}</div><div class="bar"><i style="width:${Math.min(100, t.ratio * 100)}%"></i></div><small>${fmt(t.prog)} / ${fmt(t.target)}</small></div><button data-claim="${t.i}" ${t.done && !t.claimed ? '' : 'disabled'}>${t.claimed ? '✔ Abgeholt' : '🎁 Abholen'}</button></div>`).join('') || '<div class="note">Lade…</div>'}
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
    <label>Empfänger<input type="text" id="gTo" list="gList" maxlength="16" placeholder="Name des Spielers" autocomplete="off"></label><datalist id="gList"></datalist>${friends.chipsHtml()}
    <label>Menge<input type="text" id="gAmt" placeholder="z. B. 1 mio, 5e9, 10k"></label>
    <div class="rowf"><button type="button" data-p="0.1">10 %</button><button type="button" data-p="0.25">25 %</button><button type="button" data-p="0.5">50 %</button></div>
    <div class="note">Du hast ${fmt(game.cookies)} Kekse.</div>
    <button type="submit" class="adm-go" id="gGo">🎁 Schenken</button><div class="note" id="gMsg"></div></form>`;
  friends.bind(body, body.querySelector('#gTo'));
  const msg = (t) => { body.querySelector('#gMsg').textContent = t; };
  cloud.players().then((r) => { body.querySelector('#gList').innerHTML = r.players.filter((n) => n !== cloud.name).map((n) => `<option value="${esc(n)}">`).join(''); }).catch(() => {});
  body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { body.querySelector('#gAmt').value = game.cookies.mulN(+b.dataset.p).floor().toString().replace(/e(\d+)$/, 'e+$1'); }));
  body.querySelector('#giftForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const to = body.querySelector('#gTo').value.trim(); const amount = parseBig(body.querySelector('#gAmt').value);
    if (!to) return msg('❌ Bitte einen Empfänger eingeben');
    if (amount.lt(1)) return msg('❌ Ungültige Menge');
    if (amount.gt(game.cookies)) return msg('❌ So viele Kekse hast du nicht');
    body.querySelector('#gGo').disabled = true; msg('Sende…');
    try {
      await save(); // aktuellen Vorrat speichern, der Server prüft das Limit anhand davon
      const r = await cloud.gift(to, amount.toString());
      game.cookies = game.cookies.sub(amount);
      toast(`🎁 ${fmt(amount)} Kekse an ${esc(r.to || to)} geschickt (heute noch ${r.left} Geschenke)`);
      msg(`✔ Geschickt! Heute noch ${r.left} Geschenke.`); body.querySelector('#gAmt').value = '';
    } catch (err) { msg('❌ ' + err.message); }
    body.querySelector('#gGo').disabled = false;
  });
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
      const own = game.soundOwned(d.id); const can = !own && game.cookies.gte(d.cost); const isActive = own && d.id === active;
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

// ---- Mega-Upgrades: 100 Reihen mit je ~5·10^44 Stufen ----
let megaAmt = 1; // 1 / 10 / 100 / 1000 / 'max'
const megaN = (i, game) => (megaAmt === 'max' ? Math.max(1, seriesMaxAffordable(SERIES[i], game.series[i], game.cookies)) : Math.min(megaAmt, SERIES_LEVELS - game.series[i]));
const big = (n) => BigInt(Math.floor(n)).toLocaleString('de-DE');
export function megaStateKey(game) { return game.series.join() + megaAmt + game.sing + (game.singAvailable && game.cookies.gte(game.singCost) ? 's' : '-') + SERIES.map((_, i) => (game.seriesVisible(i) ? (game.cookies.gte(seriesCost(SERIES[i], game.series[i], megaN(i, game))) ? 2 : 1) : 0)).join(''); }

function singCard(game, fmt) {
  const l = game.sing;
  if (!game.singAvailable && !l) return `<div class="item"><div class="ie">🕳️</div><div class="in"><b>Singularität</b><div class="ip">Endlose Stufen: jede hebt deine ganze Produktion in die Potenz 1,02 – ohne Obergrenze. Freigeschaltet ab 1e100 Kekse pro Sekunde.</div></div><button disabled>🔒 gesperrt</button></div>`;
  const cost = game.singCost; const can = game.cookies.gte(cost);
  return `<div class="item has"><div class="ie">🕳️</div><div class="in"><b>Singularität · Stufe ${fmtUp(l)}</b><div class="ip">Jede Stufe: Produktion hoch 1,02. Preis: ${(60 * Math.pow(1.03, l) * game.singDiscount).toLocaleString('de-DE', { maximumFractionDigits: 0 })} s Produktion – wächst mit, es gibt immer eine nächste Stufe.</div><div class="have">${l ? `Aktuell: Exponent × ${game.singPower.toFixed(3).replace('.', ',')}` : 'Noch nicht gekauft'}</div><div class="have">🎁 Boni ${SING_MILESTONES.filter(([n]) => l >= n).length}/${SING_MILESTONES.length}${SING_MILESTONES.find(([n]) => l < n) ? ` · nächster bei Stufe ${SING_MILESTONES.find(([n]) => l < n)[0]}: ${SING_MILESTONES.find(([n]) => l < n)[1]}` : ' · alle freigeschaltet'}</div></div><button data-sing ${can ? '' : 'disabled'}>🍪 ${fmt(cost)}</button></div>`;
}
export function renderMega(body, { game, fmt, toast, title, changed, buySound }) {
  title('♾️ Mega-Upgrades');
  const vis = SERIES.map((_, i) => i).filter((i) => game.seriesVisible(i));
  vis.sort((a, b) => game.seriesPrice(a, 1).cmp(game.seriesPrice(b, 1)));
  const locked = SERIES.map((_, i) => i).filter((i) => !game.seriesVisible(i)).sort((a, b) => (SERIES[a].need || 0) - (SERIES[b].need || 0) || (SERIES[a].baked || 0) - (SERIES[b].baked || 0));
  body.innerHTML = `<div class="stack">
    <div class="shop-top"><div><b>${fmtUp(game.upgradeCount + game.seriesTotal)} / ${TOTAL_ALL_TEXT}</b><div class="note">Upgrades gekauft (normale + Mega-Stufen)</div></div>
      <div class="seg" id="mgAmt">${[1, 10, 100, 1000, 'max'].map((n) => `<button data-n="${n}" class="${n === megaAmt ? 'on' : ''}">${n === 'max' ? 'Max' : '×' + n}</button>`).join('')}</div></div>
    <p class="note">Jede Reihe hat knapp <b>5·10⁴⁴ Stufen</b>, die du nacheinander kaufst. Jede Stufe erhöht die Wirkung etwas, wird aber auch teurer. Die Reihen gehören zu den normalen Upgrades und werden beim Aufstieg zurückgesetzt. Du hast ${fmt(game.cookies)} 🍪</p>
    <div class="items">${singCard(game, fmt)}</div>
    <div class="items">${vis.map((i) => {
      const s = SERIES[i]; const have = game.series[i]; const n = megaN(i, game); const cost = seriesCost(s, have, n); const can = game.cookies.gte(cost);
      return `<div class="item ${have ? 'has' : ''}"><div class="ie">${s.icon}<small class="ib">${s.badge}</small></div><div class="in"><b>${s.name}</b><div class="ip">${seriesDesc(s).split(': ').pop()}</div><div class="have">Stufe <b>${fmtUp(have)}</b>${have ? ` · aktuell ×${fmt(seriesFactor(s, have))}` : ''}</div></div><button data-mg="${i}" ${can ? '' : 'disabled'}>${n > 1 ? `${n.toLocaleString('de-DE')}× ` : ''}🍪 ${fmt(cost)}</button></div>`;
    }).join('') || '<div class="adm-empty">Noch keine Reihe freigeschaltet. Kaufe Gebäude!</div>'}</div>
    ${locked.length ? `<div class="adm-sec"><h4>🔒 ${locked.length} weitere Reihen gesperrt</h4>${locked.slice(0, 5).map((i) => `<div class="adm-sched"><span>${SERIES[i].icon}</span><span>${SERIES[i].name}</span><span class="note">${seriesNeedText(SERIES[i])}</span></div>`).join('')}</div>` : ''}</div>`;
  const redraw = () => renderMega(body, { game, fmt, toast, title, changed, buySound });
  body.querySelector('#mgAmt').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; megaAmt = b.dataset.n === 'max' ? 'max' : +b.dataset.n; redraw(); });
  const sb = body.querySelector('[data-sing]'); if (sb) sb.addEventListener('click', () => { if (game.buySing()) { buySound(); toast(`🕳️ Singularität Stufe ${big(game.sing)}!`); changed(); redraw(); } });
  body.querySelectorAll('[data-mg]').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.mg; const got = game.buySeries(i, megaN(i, game));
    if (got) { buySound(); changed(); redraw(); }
  }));
}

// ---- Umfragen: Admins erstellen sie, alle angemeldeten Spieler stimmen ab (die Stimme lässt sich bis zum Ende ändern) ----
const pesc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function renderPolls(body, { title, toast, onSeen }) {
  title('📊 Umfragen');
  if (!cloud.loggedIn) { body.innerHTML = '<p class="note">Melde dich unter „☁️ Anmelden“ an, um an Umfragen teilzunehmen.</p>'; return; }
  body.innerHTML = '<p class="note">Lade …</p>';
  const load = async () => {
    let polls; try { polls = (await cloud.polls()).polls; } catch (e) { body.innerHTML = `<p class="note">❌ ${pesc(e.status === 404 || /nicht gefunden|Unbekannt/i.test(e.message) ? 'Umfragen sind noch nicht freigeschaltet: Der Server muss erst aktualisiert werden.' : e.message)}</p>`; return; }
    const firstOpen = polls.find((p) => p.open); if (onSeen) onSeen(firstOpen ? firstOpen.id : '');
    body.innerHTML = polls.length ? `<div class="stack">${polls.map((p) => `<div class="poll ${p.open ? '' : 'done'}" data-poll="${p.id}">
        <h4>${pesc(p.q)}</h4>
        <small class="note">${p.open ? (p.end ? `offen bis ${new Date(p.end).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'offen') : 'beendet'} · von ${pesc(p.by)} · ${p.total} Stimme${p.total === 1 ? '' : 'n'}</small>
        ${p.opts.map((o, i) => { const pct = p.total ? Math.round((p.counts[i] / p.total) * 100) : 0; return `<button class="po ${p.mine === i ? 'mine' : ''}" data-opt="${i}" ${p.open ? '' : 'disabled'} style="--w:${pct}%"><span>${p.mine === i ? '✔ ' : ''}${pesc(o)}</span><b>${pct} % · ${p.counts[i]}</b></button>`; }).join('')}
      </div>`).join('')}</div>` : '<p class="note">Gerade gibt es keine Umfragen. Admins können neue erstellen.</p>';
    body.querySelectorAll('.poll [data-opt]').forEach((b) => b.addEventListener('click', async () => {
      const id = b.closest('.poll').dataset.poll;
      try { await cloud.pollVote(id, +b.dataset.opt); toast('📊 Stimme gespeichert'); load(); } catch (e) { toast('❌ ' + pesc(e.message)); }
    }));
  };
  load();
}


// ---------- Zeitkristalle ----------
export function renderTime(body, { game, fmt, toast, title }) {
  title('⏳ Zeitkristalle');
  const paint = () => {
    body.innerHTML = `<div class="shop-top"><div><b>⏳ ${game.crystals.toLocaleString('de-DE')} Zeitkristalle</b><div class="note">Du bekommst sie bei jedem Aufstieg (1 + eine Stelle je 10× so vielen Himmelschips).</div></div></div>
      <div class="stack">${CRYSTAL_SHOP.map((c) => `<div class="adm-sched"><span>${c.icon}</span><span>${c.name}</span><button data-id="${c.id}" ${game.crystals >= c.cost ? '' : 'disabled'}>⏳ ${c.cost}</button></div>`).join('')}</div>`;
  };
  paint();
  body.onclick = (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const m = game.buyCrystal(b.dataset.id); if (!m) return;
    toast(`⏳ <b>${m.text}</b>${m.gain ? ` +${fmt(m.gain)} Kekse` : ''}`); paint();
  };
}


// ---------- Gilden ----------
export async function renderGuild(body, { fmt, toast, title }) {
  title('🏰 Gilde');
  if (!cloud.loggedIn) { body.innerHTML = '<p class="note">Melde dich an (☁️), um einer Gilde beizutreten oder eine zu gründen.</p>'; return; }
  const pw = (sl) => fmt(Big.fromLog(Math.max(0, sl)));
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast('❌ ' + e.message); } paint(); };
  let timer = 0;
  async function paint() {
    let me; try { me = (await cloud.guild('me')).guild; } catch (e) { body.innerHTML = `<p class="note">❌ ${esc(e.message)}</p>`; return; }
    if (!body.isConnected) return;
    if (me) {
      title(`🏰 ${me.name} [${me.tag}]`);
      const keep = body.querySelector('#gcIn') ? body.querySelector('#gcIn').value : '';
      body.innerHTML = `<div class="shop-top"><div><b>${me.members.length} Mitglieder · zusammen ${pw(me.power)} Kekse</b><div class="note">Gründer: ${esc((me.members.find((m) => m.owner) || {}).name || '?')}</div></div></div>
        <div class="adm-sec"><h4>👥 Mitglieder</h4>${me.members.map((m) => `<div class="adm-sched"><span>${m.online ? '🟢' : '⚪'} ${m.owner ? '👑 ' : ''}${esc(m.name)}</span><span>${pw(m.sl)} gebacken${m.sg ? ` · 🕳️ ${m.sg}` : ''}</span>${me.owner && !m.owner ? `<button class="danger" data-kick="${esc(m.name)}">Entfernen</button>` : '<span></span>'}</div>`).join('')}</div>
        <div class="adm-sec"><h4>💬 Gilden-Chat</h4><div class="gchat">${me.chat.length ? me.chat.slice(-30).map((m) => `<div><b>${esc(m.n)}</b> <span class="note">${new Date(m.t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span><br>${esc(m.x)}</div>`).join('') : '<div class="note">Noch keine Nachrichten.</div>'}</div>
        <form id="gcForm" class="rowf"><input type="text" id="gcIn" maxlength="200" placeholder="Nachricht an die Gilde …" value="${esc(keep)}"><button>Senden</button></form></div>
        <button id="gLeave" class="danger">🚪 Gilde verlassen</button>`;
      const box = body.querySelector('.gchat'); if (box) box.scrollTop = box.scrollHeight;
      body.querySelector('#gcForm').onsubmit = (e) => { e.preventDefault(); const t = body.querySelector('#gcIn').value.trim(); if (t) run(async () => { await cloud.guild('chat', { text: t }); body.querySelector('#gcIn').value = ''; }); };
      body.querySelector('#gLeave').onclick = () => { if (confirm('Gilde wirklich verlassen?')) run(() => cloud.guild('leave'), 'Du hast die Gilde verlassen'); };
      body.querySelectorAll('[data-kick]').forEach((b) => { b.onclick = () => run(() => cloud.guild('kick', { name: b.dataset.kick }), 'Entfernt'); });
    } else {
      title('🏰 Gilden');
      let list = []; try { list = (await cloud.guildList()).guilds; } catch { /* leer */ }
      body.innerHTML = `<div class="adm-sec"><h4>➕ Eigene Gilde gründen</h4><form id="gNew" class="adm-grid"><label class="fld"><span>Name</span><input type="text" id="gnName" maxlength="16" placeholder="z. B. Keksbande"></label><label class="fld"><span>Kürzel (2–4)</span><input type="text" id="gnTag" maxlength="4" placeholder="KEKS"></label><div class="adm-btns"><button>🏰 Gründen</button></div></form></div>
        <div class="adm-sec"><h4>🏆 Gilden-Rangliste</h4>${list.length ? list.map((g, i) => `<div class="adm-sched"><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} <b>${esc(g.name)}</b> [${esc(g.tag)}]</span><span>${g.members}/20 · ${g.power >= 0 ? pw(g.power) : '–'}</span><button data-join="${g.id}" ${g.open ? '' : 'disabled'}>${g.open ? 'Beitreten' : 'Voll'}</button></div>`).join('') : '<div class="note">Noch keine Gilden – gründe die erste!</div>'}</div>`;
      body.querySelector('#gNew').onsubmit = (e) => { e.preventDefault(); run(() => cloud.guild('create', { name: body.querySelector('#gnName').value, tag: body.querySelector('#gnTag').value }), '🏰 Gilde gegründet'); };
      body.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => run(() => cloud.guild('join', { gid: b.dataset.join }), '🏰 Beigetreten'); });
    }
  }
  await paint();
  clearInterval(timer); timer = setInterval(() => { if (!body.isConnected || !document.querySelector('#modal[open]') || document.querySelector('#modalTitle').textContent.indexOf('🏰') !== 0) { clearInterval(timer); return; } if (!body.querySelector('#gcIn') || document.activeElement !== body.querySelector('#gcIn')) paint(); }, 8000);
}
