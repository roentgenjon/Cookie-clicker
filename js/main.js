import { BUILDINGS, upgrade, TOTAL_UPGRADES, KIND, K } from './data.js';
import { Big, fmtBig } from './big.js';
import { Game, ACH } from './engine.js';
import { cloud } from './cloud.js';
import { renderAdmin } from './admin.js';
import { createChat } from './chat.js';
import { sound } from './sound.js';
import { renderDaily, renderSkins, renderGift, renderItems, itemsStateKey, renderSoundShop, renderMega, megaStateKey } from './features.js';
import { TOTAL_ALL_TEXT } from './mega.js';
import { skinById, itemById } from './extras.js';
let itemsKey = ''; let megaKey = '';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = fmtBig; // Zahlen und Big-Werte (ohne Obergrenze, siehe big.js)
const fmtTime = (s) => { s = Math.floor(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m}m ${s % 60}s`; };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } } };

const game = new Game();
window.__game = game; // Zugriff für Tests/Debugging
let amount = 1;
let filter = 'all';
let shown = 80;
const MAX_SHOWN = 2560;
let localLast = 0;
let particles = ls.get('cc_particles') !== '0';
let showBoosts = ls.get('cc_boosts') !== '0'; // aktive Boosts (Raserei, Klick-Raserei) neben „pro Sekunde“ anzeigen

// ---------- Toasts ----------
function toast(html) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
  $('#toasts').append(el); setTimeout(() => el.remove(), 5000);
  while ($('#toasts').children.length > 5) $('#toasts').firstChild.remove();
}

// ---------- Speichern ----------
const KEY = 'cookie_clicker_save_v1';
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(game.serialize())); } catch { /* ignore */ } }
function loadLocal() {
  const raw = ls.get(KEY); if (!raw) return;
  try { const d = JSON.parse(raw); localLast = d.last || 0; const r = game.load(d); if (!r.gain.isZero()) toast(`Willkommen zurück! Offline (${fmtTime(r.offlineSecs)}) gebacken: <b>${fmt(r.gain)}</b> Kekse`); } catch (e) { console.error(e); }
}
loadLocal();
$('#bakeryName').textContent = game.name;
document.documentElement.dataset.theme = ls.get('cc_theme') || 'dark';

// ---------- Großer Keks ----------
function floater(text, x, y, host = '#floaters') {
  if (!particles) return;
  const el = document.createElement('div'); el.className = 'floater'; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px'; $(host).append(el); setTimeout(() => el.remove(), 1000);
}
$('#bigCookie').addEventListener('pointerdown', (e) => {
  sound.unlock(); sound.click();
  const v = game.click();
  const r = $('#floaters').getBoundingClientRect();
  floater('+' + fmt(v), e.clientX - r.left - 14 + (Math.random() * 30 - 15), e.clientY - r.top - 20);
});
// Leertaste: klickt wie der Keks; gedrückt halten = schnelles Dauerklicken (20/s)
let holdTimer = null;
function spaceClick() {
  sound.click();
  const v = game.click();
  const r = $('#floaters').getBoundingClientRect();
  floater('+' + fmt(v), r.width / 2 - 14 + (Math.random() * 120 - 60), r.height / 2 - 40 + (Math.random() * 60 - 30));
  const c = $('#bigCookie'); c.style.transform = 'scale(.93)'; setTimeout(() => { c.style.transform = ''; }, 40);
}
function stopHold() { clearInterval(holdTimer); holdTimer = null; }
const isSpace = (e) => e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
document.addEventListener('keydown', (e) => {
  if (!isSpace(e) || typing(e.target) || modal.open) return;
  e.preventDefault();
  if (e.repeat || holdTimer) return;
  spaceClick();
  holdTimer = setInterval(spaceClick, 50);
});
document.addEventListener('keyup', (e) => { if (isSpace(e)) { stopHold(); if (!typing(e.target)) e.preventDefault(); } });
addEventListener('blur', stopHold);

// ---------- Besessene Items unter dem Keks ----------
let itemBarKey = '';
function renderItemBar() {
  const key = JSON.stringify(game.items); if (key === itemBarKey) return; itemBarKey = key;
  $('#itemBar').innerHTML = Object.entries(game.items).map(([id, n]) => { const it = itemById(id); return `<span title="${it.name} ×${n} (+${n * it.pct} %)">${it.emoji}<small>${n > 999 ? '999+' : n}</small></span>`; }).join('');
}

// ---------- Gewählte Klänge/Musik aus dem Spielstand anwenden ----------
function applySounds() { sound.setPack(game.sounds.pack); sound.setTrack(game.sounds.track); }
applySounds();

// ---------- Skin & Keks-Regen ----------
let appliedSkin = '';
function applySkin() {
  if (appliedSkin === game.skin) return; appliedSkin = game.skin;
  const k = skinById(game.skin); const f = $('#cookieFace');
  f.textContent = k.emoji; f.style.filter = k.filter || ''; f.classList.toggle('rainbow', !!k.cls);
}
applySkin(); renderItemBar();
let rain = ls.get('cc_rain') === null ? !matchMedia('(prefers-reduced-motion: reduce)').matches : ls.get('cc_rain') === '1';
setInterval(() => {
  const host = $('#rain'); if (!rain || document.hidden || host.children.length > 14) return;
  if (Math.random() > Math.min(1, 0.3 + Math.max(0, game.cps.log10()) / 20)) return;
  const s = document.createElement('span'); s.textContent = skinById(game.skin).emoji;
  s.style.left = Math.random() * 96 + '%'; s.style.fontSize = 14 + Math.random() * 18 + 'px'; s.style.animationDuration = 7 + Math.random() * 7 + 's';
  s.addEventListener('animationend', () => s.remove()); host.append(s);
}, 700);

// ---------- Goldener Keks ----------
const goldenLayer = $('#goldens');
const goldenEls = new Map();
goldenLayer.addEventListener('click', (e) => {
  const el = e.target.closest('.golden'); if (!el) return;
  const m = game.clickGolden(+el.dataset.id); if (!m) return;
  sound.goldenClick();
  toast(`🌟 <b>${esc(m.text)}</b>${m.gain ? ` +${fmt(m.gain)} Kekse` : ''}`);
});
function renderGoldens() {
  const alive = new Set(game.gcs.map((g) => g.id));
  for (const [id, el] of goldenEls) if (!alive.has(id)) { el.remove(); goldenEls.delete(id); }
  for (const g of game.gcs) {
    let el = goldenEls.get(g.id);
    if (!el) { el = document.createElement('button'); el.className = 'golden'; el.dataset.id = g.id; el.textContent = '🌟'; el.setAttribute('aria-label', 'Goldener Keks'); el.style.left = g.x + '%'; el.style.top = g.y + '%'; goldenLayer.append(el); goldenEls.set(g.id, el); sound.goldenSpawn(); }
  }
}

// ---------- Shop ----------
const shop = $('#shop');
shop.innerHTML = BUILDINGS.map((b, i) => `<div class="row cant" data-i="${i}"><div class="ic">${b.icon}</div><div><div class="nm">${b.name}</div><div class="co"></div></div><div class="ow">0</div></div>`).join('');
const shopRows = [...shop.children];
shop.addEventListener('click', (e) => { const r = e.target.closest('.row'); if (r && game.buyBuilding(+r.dataset.i, amount)) sound.buy(); });
shop.addEventListener('contextmenu', (e) => { const r = e.target.closest('.row'); if (r) { e.preventDefault(); game.sellBuilding(+r.dataset.i); } });
$('#amount').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  amount = b.dataset.n === 'max' ? 'max' : +b.dataset.n;
  [...$('#amount').children].forEach((c) => c.classList.toggle('on', c === b));
});
function renderShop() {
  shopRows.forEach((row, i) => {
    const n = amount === 'max' ? Math.max(1, game.maxAffordable(i)) : amount;
    const cost = game.buildingCost(i, n);
    const can = cost.lte(game.cookies);
    row.className = 'row ' + (can ? 'can' : 'cant');
    const co = row.querySelector('.co'); co.className = 'co' + (can ? ' can' : '');
    co.textContent = `🍪 ${fmt(cost)}${n > 1 ? ` (×${n})` : ''}`;
    row.querySelector('.ow').textContent = game.owned[i];
  });
}

// ---------- Upgrades ----------
const FILTERS = [['all', 'Alle'], ['tier', 'Gebäude'], ['click', 'Klick'], ['global', 'Global'], ['syn', 'Synergie'], ['golden', 'Gold'], ['heaven', 'Himmlisch']];
$('#filters').innerHTML = FILTERS.map(([k, t]) => `<button data-f="${k}" class="${k === filter ? 'on' : ''}">${t}</button>`).join('');
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; shown = 80; [...$('#filters').children].forEach((c) => c.classList.toggle('on', c === b)); lastKey = ''; });
$('#moreUp').addEventListener('click', () => { shown = Math.min(shown * 2, MAX_SHOWN); lastKey = ''; });
$('#buyAll').addEventListener('click', () => {
  const kind = K[filter.toUpperCase()];
  const n = filter === 'heaven' ? game.buyAllAffordable(true) : filter === 'all' ? game.buyAllAffordable(false) + game.buyAllAffordable(true) : game.buyAllAffordable(false, kind);
  const mega = filter === 'all' ? game.buyAllSeries() : 0; // „Alle“ kauft auch Mega-Stufen
  toast(n || mega ? `${n ? `${n.toLocaleString('de-DE')} Upgrades` : ''}${n && mega ? ' + ' : ''}${mega ? `${mega.toLocaleString('de-DE')} Mega-Stufen` : ''} gekauft` : 'Nichts bezahlbar'); if (n || mega) sound.buy(); lastKey = '';
});
$('#upgrades').addEventListener('click', (e) => { const b = e.target.closest('.up'); if (b && game.buyUpgrade(+b.dataset.id)) { lastKey = ''; hideTip(); sound.buy(); } });
let lastKey = '';
function renderUpgrades() {
  let ids, total;
  if (filter === 'heaven') ({ ids, total } = game.visibleList(true, null, shown));
  else if (filter === 'all') {
    const a = game.visibleList(false, null, shown); const h = game.visibleList(true, null, Math.max(0, shown - a.ids.length));
    ids = a.ids.concat(h.ids); total = a.total + h.total;
  } else ({ ids, total } = game.visibleList(false, K[filter.toUpperCase()], shown));
  const key = ids.map((id) => id + (game.canAfford(id) ? '+' : '-')).join() + '|' + total;
  $('#upCount').textContent = `${(BigInt(game.upgradeCount) + BigInt(Math.floor(game.seriesTotal))).toLocaleString('de-DE')} / ${TOTAL_ALL_TEXT} gekauft · ${total.toLocaleString('de-DE')} verfügbar`;
  if (key === lastKey) return; lastKey = key;
  $('#upgrades').innerHTML = ids.map((id) => { const u = upgrade(id); return `<button class="up ${u.kind === 'heaven' ? 'heaven ' : ''}${game.canAfford(id) ? 'ok' : 'no'}" data-id="${id}">${u.icon}</button>`; }).join('');
  const more = total - ids.length;
  $('#moreUp').classList.toggle('hidden', more <= 0 || shown >= MAX_SHOWN);
  $('#moreUp').textContent = `Mehr anzeigen (${more.toLocaleString('de-DE')} weitere)`;
  $('#upEmpty').classList.toggle('hidden', total > 0);
}

// ---------- Tooltips ----------
const tip = $('#tip');
function showTip(html, e) { tip.innerHTML = html; tip.classList.remove('hidden'); moveTip(e); }
function moveTip(e) { const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 6) x = e.clientX - w - 14; if (y + h > innerHeight - 6) y = innerHeight - h - 6; tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px'; }
function hideTip() { tip.classList.add('hidden'); }
document.addEventListener('mouseover', (e) => {
  const up = e.target.closest('.up'); const row = e.target.closest('#shop .row');
  if (up) { const u = upgrade(+up.dataset.id); showTip(`<b>${esc(u.name)}</b><br>${esc(u.desc)}<br><span class="mu">${u.kind === 'heaven' ? '😇 ' + fmt(u.cost) + ' Chips' : '🍪 ' + fmt(u.cost)}</span>`, e); }
  else if (row) {
    const i = +row.dataset.i, b = BUILDINGS[i], per = Big.from(b.cps).mulLog(game.tierLog[i] + game.globalLog).mul(Big.from(1).add(game.chipsEarned.mulN(0.01)));
    showTip(`<b>${b.name}</b> (${game.owned[i]})<br>Jedes erzeugt ca. ${fmt(per)} Kekse/s<br>Gesamt: ${fmt(per.mulN(game.owned[i]))}/s<br><span class="mu">Rechtsklick: verkaufen (50 %)</span>`, e);
  }
});
document.addEventListener('mousemove', (e) => { if (!tip.classList.contains('hidden')) { if (e.target.closest('.up') || e.target.closest('#shop .row')) moveTip(e); else hideTip(); } });

// ---------- Ticker ----------
const NEWS = [
  () => 'Nachrichten: Lokale Oma backt schneller als der Schall – Experten ratlos.',
  () => 'Studie: 9 von 10 Zahnärzten empfehlen mehr Kekse.',
  () => `Kekse im Wert von ${fmt(game.total)} wurden diese Runde gebacken. Wow.`,
  () => (game.owned[1] > 10 ? 'Omas gründen Gewerkschaft und fordern bessere Backöfen.' : 'Ein Keks pro Tag hält den Doktor fern.'),
  () => (game.owned[2] > 5 ? 'Farmen melden Rekordernte an Keksbäumen.' : 'Keksteig ist die neue Währung.'),
  () => (game.owned[6] > 1 ? 'Tempel-Priester: „Der Keks ist unser Licht“.' : 'Gerücht: Ein goldener Keks soll gesichtet worden sein.'),
  () => (game.owned[10] > 0 ? 'Portal zur Keks-Dimension gesichtet – es riecht nach Vanille.' : 'Wissenschaftler zählen Krümel. Ergebnis: viele.'),
  () => (!game.chipsEarned.isZero() ? 'Engel loben dein Backwerk: „Himmlisch!“' : 'Tipp: Ab 1 Billion Keksen lohnt sich der Aufstieg.'),
];
function newsTick() { $('#ticker').textContent = NEWS[Math.floor(Math.random() * NEWS.length)](); }
newsTick(); setInterval(newsTick, 9000);

// ---------- Modale ----------
const modal = $('#modal');
let modalKind = null;
$('#modalClose').addEventListener('click', () => modal.close());
modal.addEventListener('close', () => { if (modalKind === 'chat') chat.close(); modalKind = null; modal.classList.remove('wide'); });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
document.querySelectorAll('[data-modal]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.modal)));
let isAdmin = false; let lastUnread = 0;
function raiseBanners() { const h = $('#banners'); try { if (h.children.length) { h.hidePopover(); h.showPopover(); } } catch { /* ältere Browser */ } }
function banner({ title, text, more }) {
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = document.createElement('div'); el.className = 'banner';
  el.innerHTML = `<div class="bn-i">💬</div><div class="bn-b"><b>${esc(title)}</b><span>${esc(String(text).slice(0, 120))}${more > 0 ? ` (+${more})` : ''}</span></div><small>jetzt</small>`;
  el.addEventListener('click', () => { el.remove(); openModal('chat'); });
  const host = $('#banners'); host.prepend(el);
  try { host.hidePopover(); host.showPopover(); } catch { /* ältere Browser */ }
  while (host.children.length > 3) host.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 5200); setTimeout(() => el.remove(), 5700);
  try { if (navigator.vibrate) navigator.vibrate(60); } catch { /* ignore */ }
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body: text, tag: 'cc-msg' }); } catch { /* ignore */ }
}
document.addEventListener('pointerdown', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ } }, { once: true });
const chat = createChat({ toast, isAdmin: () => isAdmin, onUnread: (n) => { if (n > lastUnread) sound.message(); lastUnread = n; $('#chatBadge').textContent = n ? (n > 9 ? '9+' : n) : ''; }, onNotify: banner });
chat.start();
function openModal(kind) { modalKind = kind; renderModal(); if (!modal.open) modal.showModal(); raiseBanners(); }
function renderModal() {
  const body = $('#modalBody'); const t = $('#modalTitle');
  if (modalKind === 'stats') {
    t.textContent = '📊 Statistik';
    const all = game.totalReset.add(game.total);
    body.innerHTML = `<div class="kv">
      <span>Kekse auf der Bank</span><span>${fmt(game.cookies)}</span>
      <span>Gebacken (diese Runde)</span><span>${fmt(game.total)}</span>
      <span>Gebacken (insgesamt)</span><span>${fmt(all)}</span>
      <span>Kekse pro Sekunde</span><span>${fmt(game.cps)}</span>
      <span>Klickwert</span><span>${fmt(game.clickValue)}</span>
      <span>Klicks</span><span>${fmt(game.clicks)}</span>
      <span>Goldene Kekse geklickt</span><span>${fmt(game.golden)}</span>
      <span>Gebäude</span><span>${fmt(game.owned.reduce((a, b) => a + b, 0))}</span>
      <span>Upgrades</span><span>${(BigInt(game.upgradeCount) + BigInt(Math.floor(game.seriesTotal))).toLocaleString('de-DE')} / ${TOTAL_ALL_TEXT}</span>
      <span>Erfolge</span><span>${game.achCount()} / ${ACH.length}</span>
      <span>Aufstiege</span><span>${game.ascensions}</span>
      <span>Singularität</span><span>${game.sing ? `Stufe ${game.sing.toLocaleString('de-DE')} (Produktion hoch ${game.singPower.toFixed(3).replace('.', ',')})` : 'noch nicht gekauft'}</span>
      <span>Himmelschips</span><span>${fmt(game.chipsAvailable)} frei / ${fmt(game.chipsEarned)} gesamt</span>
      <span>Spielzeit</span><span>${fmtTime((Date.now() - game.start) / 1000)}</span>
      <span>Offline-Ertrag</span><span>${Math.round(game.offline * 100)} % (max. ${fmtTime(game.offlineCap)})</span></div>`;
  } else if (modalKind === 'ach') {
    t.textContent = `🏆 Erfolge (${game.achCount()} / ${ACH.length})`;
    body.innerHTML = `<p class="note">Jeder Erfolg gibt +0,2 % auf deine Produktion.</p><div class="ach-grid">${ACH.map((a) => `<div class="ach ${game.ach[a.id] ? '' : 'off'}" title="${esc(a.name)} – ${esc(a.desc)}">${a.icon}</div>`).join('')}</div>`;
  } else if (modalKind === 'ascend') {
    t.textContent = '🪽 Aufstieg';
    const g = game.chipsGain;
    body.innerHTML = `<div class="stack"><p>Beim Aufstieg setzt du Kekse, Gebäude und normale Upgrades zurück und erhältst <b>Himmelschips</b>. Jeder Chip gibt dauerhaft <b>+1 % Produktion</b> und schaltet himmlische Upgrades frei (die bleiben für immer).</p>
      <div class="kv"><span>Chips gesamt</span><span>${fmt(game.chipsEarned)}</span><span>Chips verfügbar</span><span>${fmt(game.chipsAvailable)}</span><span>Chips beim Aufstieg</span><span><b>+${fmt(g)}</b></span></div>
      <p class="note">Chips = ³√(Gesamt-Kekse / 1 Billion). Himmlische Upgrades findest du im Upgrade-Filter „Himmlisch“.</p>
      <button id="doAscend" ${g.lt(1) ? 'disabled' : ''}>🪽 Jetzt aufsteigen</button></div>`;
    $('#doAscend')?.addEventListener('click', () => { if (confirm('Wirklich aufsteigen? Kekse, Gebäude und normale Upgrades werden zurückgesetzt.')) { game.ascend(); lastKey = ''; saveLocal(); modal.close(); toast('🪽 Aufgestiegen!'); } });
  } else if (modalKind === 'cloud') renderCloud();
  else if (modalKind === 'settings') renderSettings();
  else if (modalKind === 'daily') renderDaily($('#modalBody'), { game, fmt, toast, title: (t) => { $('#modalTitle').textContent = t; }, changed: () => { saveLocal(); $('#dailyBadge').textContent = game.claimableCount() || ''; lastKey = ''; } });
  else if (modalKind === 'mega') renderMega($('#modalBody'), { game, fmt, toast, title: (t) => { $('#modalTitle').textContent = t; }, changed: () => { lastKey = ''; saveLocal(); }, buySound: () => sound.buy() });
  else if (modalKind === 'items') renderItems($('#modalBody'), { game, fmt, toast, title: (t) => { $('#modalTitle').textContent = t; }, changed: () => { renderItemBar(); applySkin(); saveLocal(); }, buySound: () => sound.shop() });
  else if (modalKind === 'sounds') renderSoundShop($('#modalBody'), { game, fmt, toast, title: (t) => { $('#modalTitle').textContent = t; }, changed: () => saveLocal(), buySound: () => sound.shop(), apply: applySounds, preview: (kind, id) => (kind === 'pack' ? sound.previewPack(id) : sound.previewTrack(id)) });
  else if (modalKind === 'skins') renderSkins($('#modalBody'), { game, toast, title: (t) => { $('#modalTitle').textContent = t; }, changed: () => { applySkin(); saveLocal(); } });
  else if (modalKind === 'gift') renderGift($('#modalBody'), { game, fmt, toast, title: (t) => { $('#modalTitle').textContent = t; }, save: () => cloudSave() });
  else if (modalKind === 'chat') chat.render($('#modalBody'), (t) => { $('#modalTitle').textContent = t; });
  else if (modalKind === 'admin') renderAdmin($('#modalBody'), { fmt, toast, title: (t) => { $('#modalTitle').textContent = t; } });
}

function renderSettings() {
  $('#modalTitle').textContent = '⚙️ Optionen';
  $('#modalBody').innerHTML = `<div class="stack">
    <label>Name deiner Bäckerei<input type="text" id="setName" maxlength="16" value="${esc(game.name)}"></label>
    <div class="rowf"><button id="setTheme">🌓 Design wechseln</button><button id="setPart">✨ Partikel: ${particles ? 'an' : 'aus'}</button><button id="saveNow">💾 Jetzt speichern</button></div>
    <div class="rowf"><button id="setSound">${sound.enabled ? '🔊 Sound: an' : '🔇 Sound: aus'}</button><button id="testSound">🔔 Sound testen</button><button id="setMusic">${sound.music ? '🎵 Musik: an' : '🎵 Musik: aus'}</button><button id="setRain">🌧️ Keks-Regen: ${rain ? 'an' : 'aus'}</button><button id="setBoosts">🔥 Boost-Anzeige: ${showBoosts ? 'an' : 'aus'}</button></div>
    <label>Lautstärke<input type="range" id="setVol" min="0" max="100" value="${Math.round(sound.volume * 100)}"></label>
    <label>Spielstand exportieren / importieren<textarea id="exp" rows="3" placeholder="Export-Code"></textarea></label>
    <div class="rowf"><button id="doExp">⬆️ Exportieren</button><button id="doImp">⬇️ Importieren</button><button id="doReset" style="color:var(--bad)">🗑️ Alles löschen</button></div></div>`;
  $('#setName').addEventListener('input', (e) => { game.name = e.target.value.trim() || 'Dein'; $('#bakeryName').textContent = game.name; });
  $('#setTheme').addEventListener('click', () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; ls.set('cc_theme', n); });
  $('#setPart').addEventListener('click', () => { particles = !particles; ls.set('cc_particles', particles ? '1' : '0'); renderSettings(); });
  $('#setSound').addEventListener('click', () => { sound.setEnabled(!sound.enabled); sound.click(); renderSettings(); });
  $('#testSound').addEventListener('click', async () => { const st = await sound.test(); toast(st === 'running' ? '🔔 Spielt der Ton? Wenn nicht: Lautstärke hochdrehen und den Stummschalter (Klingeln aus) des Geräts prüfen.' : `🔇 Audio blockiert (Status: ${st}). Tippe noch einmal auf den Knopf.`); });
  $('#setMusic').addEventListener('click', () => { sound.setMusic(!sound.music); renderSettings(); });
  $('#setRain').addEventListener('click', () => { rain = !rain; ls.set('cc_rain', rain ? '1' : '0'); renderSettings(); });
  $('#setBoosts').addEventListener('click', () => { showBoosts = !showBoosts; ls.set('cc_boosts', showBoosts ? '1' : '0'); $('#buffs').innerHTML = ''; renderSettings(); });
  $('#setVol').addEventListener('input', (e) => { sound.setVolume(e.target.value / 100); }); $('#setVol').addEventListener('change', () => sound.buy());
  $('#saveNow').addEventListener('click', () => { saveLocal(); toast('Gespeichert ✔'); });
  $('#doExp').addEventListener('click', () => { $('#exp').value = btoa(unescape(encodeURIComponent(JSON.stringify(game.serialize())))); $('#exp').select(); });
  $('#doImp').addEventListener('click', () => { try { game.load(JSON.parse(decodeURIComponent(escape(atob($('#exp').value.trim()))))); $('#bakeryName').textContent = game.name; lastKey = ''; saveLocal(); toast('Importiert ✔'); } catch { toast('❌ Ungültiger Code'); } });
  $('#doReset').addEventListener('click', () => { if (confirm('Wirklich ALLES löschen?')) { game.hardReset(); lastKey = ''; saveLocal(); toast('Zurückgesetzt'); } });
}

async function renderCloud() {
  $('#modalTitle').textContent = '☁️ Anmeldung & Rangliste';
  const body = $('#modalBody');
  if (!cloud.enabled) { body.innerHTML = '<p>Die Cloud-Datenbank ist noch nicht verbunden. Du spielst vorerst nur mit lokalem Speichern.</p>'; return; }
  const msg = (t) => { const e = $('#cMsg'); if (e) e.textContent = t; };
  if (!cloud.loggedIn) {
    body.innerHTML = `<form class="stack" id="loginForm">
      <p>Gib deinen <b>Namen</b> (2–16 Zeichen) und ein <b>Passwort</b> (mindestens 4 Zeichen) ein.<br>🆕 <b>Neu hier?</b> Tippe auf „Konto erstellen“.<br>🔑 <b>Schon ein Konto?</b> Tippe auf „Anmelden“, dein Fortschritt wird geladen.</p>
      <label>Name<input type="text" id="lName" maxlength="16" autocomplete="username" value="${esc(game.name === 'Dein' ? '' : game.name)}"></label>
      <label>Passwort<input type="password" id="lPass" autocomplete="current-password"></label>
      <details id="lSetupBox"><summary class="note">Admin-Erstanmeldung (nur beim allerersten Mal für reservierte Admin-Namen)</summary><label>Setup-Code<input type="password" id="lSetup" autocomplete="off"></label></details>
      <div class="rowf"><button type="submit" id="lGo" data-mode="register" class="adm-go">🆕 Konto erstellen</button><button type="submit" id="lIn" data-mode="login">🔑 Anmelden</button><button type="button" id="lGuest">Ohne Anmeldung spielen</button></div>
      <div id="cMsg" class="note"></div><h3>🏆 Rangliste</h3><div id="lb">Lade…</div></form>`;
    $('#lGuest').addEventListener('click', () => { ls.set('cc_guest', '1'); modal.close(); });
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const mode = (e.submitter && e.submitter.dataset.mode) || 'login'; $('#lGo').disabled = true; $('#lIn').disabled = true; msg(mode === 'register' ? 'Konto wird erstellt…' : 'Anmelden…');
      try {
        const r = await cloud.login($('#lName').value, $('#lPass').value, mode);
        if (r.isNew) { game.name = cloud.name; try { await cloudSave(false, $('#lSetup').value); } catch (er) { cloud.logout(); if (er.data && er.data.needSetup) $('#lSetupBox').open = true; throw er; } toast(`✅ Konto „${esc(cloud.name)}“ erstellt – Fortschritt wird gespeichert`); }
        else { game.load(r.data); game.name = cloud.name; saveLocal(); lastKey = ''; toast(`✅ Willkommen zurück, ${esc(cloud.name)}!`); }
        $('#bakeryName').textContent = game.name; updateCloudBtn(); checkAdmin(); startEvents(); modal.close();
      } catch (err) { if (err.data && err.data.banned) { showBanScreen(err.data.reason || ''); return; } msg('❌ ' + err.message + (err.data && err.data.detail ? ` (${err.data.detail})` : '')); $('#lGo').disabled = false; $('#lIn').disabled = false; }
    });
  } else {
    body.innerHTML = `<div class="stack"><p>Angemeldet als <b>${esc(cloud.name)}</b>. Dein Fortschritt wird automatisch alle 30 Sekunden in der Datenbank gespeichert.</p>
      <div class="rowf"><button id="cSave">☁️⬆️ Jetzt speichern</button><button id="cLoad">☁️⬇️ Aus Cloud laden</button><button id="cOut">🚪 Abmelden</button></div>
      <div id="cMsg" class="note"></div><h3>🏆 Rangliste</h3><div id="lb">Lade…</div></div>`;
    $('#cSave').addEventListener('click', async () => { try { await cloudSave(); msg('Gespeichert ✔'); loadLb(); } catch (e) { msg('❌ ' + e.message); } });
    $('#cLoad').addEventListener('click', async () => { try { const r = await cloud.load(); game.load(r.data); game.name = cloud.name; $('#bakeryName').textContent = game.name; lastKey = ''; saveLocal(); msg('Geladen ✔'); } catch (e) { msg('❌ ' + e.message); } });
    $('#cOut').addEventListener('click', async () => { if (banned) return; try { await cloudSave(); } catch { /* egal */ } cloud.logout(); updateCloudBtn(); checkAdmin(); renderCloud(); });
  }
  loadLb();
}
let lbBy = 'score';
const LB = { score: 'Gebacken gesamt', cps: 'Kekse pro Sekunde', asc: 'Aufstiege' };
async function loadLb(by = lbBy) {
  lbBy = by; const box = $('#lb'); if (!box) return;
  try {
    const r = await cloud.leaderboard(by);
    const val = (v, vl) => (by === 'asc' ? Math.floor(v).toLocaleString('de-DE') : fmt(Number.isFinite(vl) && vl > 300 ? Big.fromLog(vl) : v));
    const tabs = `<div class="lb-tabs">${Object.entries(LB).map(([k, t]) => `<button data-by="${k}" class="${k === by ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const rows = r.players.map((p, i) => `<tr class="${cloud.loggedIn && p.name === cloud.name ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(p.name)}</td><td>${val(p.value, p.vl)}</td></tr>`).join('');
    const mine = r.me ? `<div class="note">🎯 Dein Platz: <b>#${r.me.rank}</b> von ${r.total} (${val(r.me.value, r.me.vl)})</div>` : '';
    box.innerHTML = tabs + (r.players.length ? `<table class="lb"><tr><th>#</th><th>Bäckerei</th><th>${LB[by]}</th></tr>${rows}</table>` : '<div class="note">Noch keine Einträge.</div>') + mine;
    box.querySelectorAll('[data-by]').forEach((b) => b.addEventListener('click', () => loadLb(b.dataset.by)));
  } catch (e) { box.textContent = '❌ ' + e.message; }
}
function cloudSave(keepalive = false, setup) {
  if (banned || Date.now() < limitUntil) return Promise.resolve();
  return cloud.save(game.serialize(), Math.min(1e300, game.totalReset.add(game.total).toNumber()), keepalive, setup, { cps: Math.min(1e300, game.baseCps.toNumber()), sl: game.totalReset.add(game.total).log10(), cl: game.baseCps.log10(), asc: game.ascensions }).catch((e) => { if (e.data && e.data.banned) onBanned(e.data.reason); if (e.data && e.data.limit) { limitUntil = Date.now() + 30 * 60000; toast('⚠️ Cloud-Speicher voll für heute. Dein Fortschritt bleibt auf diesem Gerät gespeichert.'); } throw e; });
}
let banned = false; let lastHideSave = 0; let limitUntil = 0;
// Bann: schwarzer Bildschirm über allem (auch über offenen Fenstern), keine Bedienung, kein Abmelden. Das Merkmal bleibt nach Neuladen erhalten und wird beim Start geprüft.
function showBanScreen(reason) {
  banned = true; if (typeof reason === 'string') { if (reason) ls.set('cc_ban_reason', reason); else ls.del('cc_ban_reason'); }
  $('#banReason').textContent = ls.get('cc_ban_reason') || ''; try { if (modal.open) modal.close(); } catch { /* egal */ }
  const el = $('#banScreen'); try { el.hidePopover(); } catch { /* egal */ } try { el.showPopover(); } catch { el.style.display = 'flex'; }
  document.title = 'Gebannt';
}
function onBanned(reason) { if (banned) { if (reason) showBanScreen(reason); return; } if (cloud.loggedIn) ls.set('cc_banned', '1'); showBanScreen(reason || ''); }
['keydown', 'keyup', 'pointerdown', 'click', 'contextmenu'].forEach((t) => document.addEventListener(t, (e) => { if (banned) { e.preventDefault(); e.stopImmediatePropagation(); } }, true));
if (ls.get('cc_banned') === '1') {
  if (cloud.loggedIn) { showBanScreen(); cloud.events(0).then(() => { ls.del('cc_banned'); ls.del('cc_ban_reason'); location.reload(); }).catch((e) => { if (e.data && e.data.banned) showBanScreen(e.data.reason || ''); else if (e.status === 404 || (e.status === 403 && !(e.data && e.data.banned))) { ls.del('cc_banned'); ls.del('cc_ban_reason'); location.reload(); } }); }
  else { ls.del('cc_banned'); ls.del('cc_ban_reason'); }
}

// ---------- Eingeblendete Admin-Nachrichten (bleiben, bis man sie schließt) ----------
function showMessage(from, text) {
  sound.message();
  const box = document.createElement('div'); box.className = 'msgbox';
  box.innerHTML = `<div class="msg-head">📣 Nachricht von <b>${esc(from || 'Admin')}</b></div><div class="msg-text">${esc(text)}</div><button class="msg-ok">OK</button>`;
  box.querySelector('.msg-ok').addEventListener('click', () => box.remove());
  const host = $('#msgs'); host.append(box);
  while (host.children.length > 4) host.firstChild.remove();
}

// ---------- Admin-Ereignisse & Rundmeldungen ----------
function handleEvent(ev, from) {
  const text = game.applyEvent(ev);
  if (ev.gift) { sound.gift(); toast(`🎁 <b>${esc(from || 'Jemand')}</b> schenkt dir ${fmt(ev.amount)} Kekse!`); lastKey = ''; saveLocal(); return; }
  if (text) { if (ev.type === 'message') showMessage(from, text); else toast(`🛡️ <b>${esc(from || 'Admin')}</b>: ${esc(text)}`); }
  lastKey = ''; saveLocal();
}
async function pollEvents() {
  if (!cloud.loggedIn || banned) return;
  try {
    const since = Number(ls.get('cc_bc')) || 0;
    const r = await cloud.events(since);
    ls.set('cc_bc', String(r.now));
    for (const ev of r.events || []) handleEvent(ev, ev.from);
    for (const bc of r.broadcasts || []) { if (bc.text) showMessage(bc.from, bc.text); if (bc.event) handleEvent(bc.event, bc.from); }
    if ((r.events || []).length || (r.broadcasts || []).some((b) => b.event)) cloudSave().catch(() => {});
  } catch (e) { if (e.data && e.data.banned) onBanned(e.data.reason); }
}
let evTimer = null;
function startEvents() {
  if (!ls.get('cc_bc')) ls.set('cc_bc', String(Date.now()));
  if (!evTimer) evTimer = setInterval(pollEvents, 20000);
  pollEvents();
}
async function checkAdmin() {
  const btn = $('#adminBtn');
  btn.classList.add('hidden'); isAdmin = false;
  if (!cloud.loggedIn) return;
  try { const r = await cloud.admin('whoami'); if (r.admin) { btn.classList.remove('hidden'); isAdmin = true; } } catch { /* kein Admin */ }
}
$('#adminBtn').addEventListener('click', () => openModal('admin'));
function updateCloudBtn() { $('#cloudBtn').textContent = cloud.loggedIn ? `☁️ ${cloud.name}` : '☁️ Anmelden'; }
updateCloudBtn();

// Beim Start: angemeldet -> neueren Cloud-Stand übernehmen, sonst Anmeldung anbieten
(async () => {
  if (!cloud.enabled) return;
  if (!cloud.loggedIn) { if (ls.get('cc_guest') !== '1') openModal('cloud'); return; }
  startEvents(); checkAdmin();
  try {
    const r = await cloud.load();
    if (r.data && r.data.last > localLast + 1000) { const o = game.load(r.data); game.name = cloud.name; $('#bakeryName').textContent = game.name; lastKey = ''; saveLocal(); if (!o.gain.isZero()) toast(`☁️ Cloud-Stand geladen. Offline (${fmtTime(o.offlineSecs)}): <b>+${fmt(o.gain)}</b> Kekse`); }
  } catch (e) { if (e.data && e.data.banned) onBanned(e.data.reason); else if (e.status === 403) { cloud.logout(); updateCloudBtn(); toast('❌ Anmeldung abgelaufen – bitte neu anmelden'); } }
})();

// ---------- Hauptschleife ----------
let prev = performance.now(); let lastWall = Date.now(); let saveT = 0; let cloudT = 0; let slowT = 0;
function frame(now) {
  const dt = Math.min(1, (now - prev) / 1000); prev = now;
  // Tab war im Hintergrund/Gerät im Standby: verpasste Zeit gutschreiben
  const wall = Date.now(); const gap = (wall - lastWall) / 1000; lastWall = wall;
  if (gap > 3) { const r = game.catchUp(gap - dt); if (!r.gain.isZero()) toast(`😴 Während du weg warst (${fmtTime(r.offlineSecs)}): <b>+${fmt(r.gain)}</b> Kekse`); }
  game.tick(dt);
  $('#cookies').textContent = fmt(game.cookies);
  $('#cps').textContent = fmt(game.cps);
  $('#clickVal').textContent = fmt(game.clickValue);
  document.title = `${fmt(game.cookies)} Kekse – Keks-Imperium`;
  renderGoldens();
  slowT += dt;
  if (slowT >= 0.25) {
    slowT = 0; renderShop(); renderUpgrades();
    const buffs = game.buffs.map((b) => `<span>${b.type === 'frenzy' ? '🔥' : '👆'} ×${Math.round(b.mult * 10) / 10} ${Math.max(0, Math.ceil((b.until - Date.now()) / 1000))}s</span>`).join('');
    $('#buffs').innerHTML = showBoosts ? buffs : '';
  }
  saveT += dt; cloudT += dt;
  if (saveT >= 1) { saveT = 0; const newAch = game.checkAchievements(); if (newAch.length) sound.achievement(); for (const a of newAch) toast(`🏆 <b>${esc(a.name)}</b><br>${esc(a.desc)}`);
    $('#dailyBadge').textContent = game.claimableCount() || ''; applySkin(); applySounds(); if (modalKind === 'daily') renderModal(); if (modalKind === 'mega') { const k = megaStateKey(game); if (k !== megaKey) { megaKey = k; renderModal(); } } if (modalKind === 'items') { const k = itemsStateKey(game); if (k !== itemsKey) { itemsKey = k; renderModal(); } } renderItemBar(); $('#achBadge').textContent = game.achCount() || ''; if (modalKind === 'stats') renderModal(); }
  if (cloud.loggedIn && cloudT >= 180) { cloudT = 0; cloudSave().catch(() => {}); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(saveLocal, 15000);
addEventListener('beforeunload', saveLocal);
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveLocal(); if (cloud.loggedIn && Date.now() - lastHideSave > 60000) { lastHideSave = Date.now(); cloudSave(true).catch(() => {}); } } });
