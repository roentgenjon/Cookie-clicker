import { BUILDINGS, UPGRADES, TOTAL_UPGRADES, fmtShort } from './data.js';
import { Game, ACH } from './engine.js';
import { cloud } from './cloud.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n < 1e6 ? (n < 100 && n % 1 ? n.toFixed(1) : Math.floor(n).toLocaleString('de-DE')).replace(/\.0$/, '') : fmtShort(n));
const fmtTime = (s) => { s = Math.floor(s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return `${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m}m ${s % 60}s`; };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };

const game = new Game();
let amount = 1;
let filter = 'all';
let shown = 80;
let localLast = 0;
let particles = ls.get('cc_particles') !== '0';

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
  try { const d = JSON.parse(raw); localLast = d.last || 0; const r = game.load(d); if (r.gain > 0) toast(`Willkommen zurück! Offline (${fmtTime(r.offlineSecs)}) gebacken: <b>${fmt(r.gain)}</b> Kekse`); } catch (e) { console.error(e); }
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
  const v = game.click();
  const r = $('#floaters').getBoundingClientRect();
  floater('+' + fmt(v), e.clientX - r.left - 14 + (Math.random() * 30 - 15), e.clientY - r.top - 20);
});
// Leertaste: klickt wie der Keks; gedrückt halten = schnelles Dauerklicken (20/s)
let holdTimer = null;
function spaceClick() {
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

// ---------- Goldener Keks ----------
const gcEl = $('#golden');
gcEl.addEventListener('click', () => {
  const m = game.clickGolden(); if (!m) return;
  toast(`🌟 <b>${esc(m.text)}</b>${m.gain ? ` +${fmt(m.gain)} Kekse` : ''}`);
});

// ---------- Shop ----------
const shop = $('#shop');
shop.innerHTML = BUILDINGS.map((b, i) => `<div class="row cant" data-i="${i}"><div class="ic">${b.icon}</div><div><div class="nm">${b.name}</div><div class="co"></div></div><div class="ow">0</div></div>`).join('');
const shopRows = [...shop.children];
shop.addEventListener('click', (e) => { const r = e.target.closest('.row'); if (r) game.buyBuilding(+r.dataset.i, amount); });
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
    const can = cost <= game.cookies;
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
$('#moreUp').addEventListener('click', () => { shown += 120; lastKey = ''; });
$('#buyAll').addEventListener('click', () => { const n = (filter === 'heaven' ? 0 : game.buyAllAffordable(false)) + (filter === 'heaven' || filter === 'all' ? game.buyAllAffordable(true) : 0);
  toast(n ? `${n} Upgrades gekauft` : 'Nichts bezahlbar'); lastKey = ''; });
$('#upgrades').addEventListener('click', (e) => { const b = e.target.closest('.up'); if (b && game.buyUpgrade(+b.dataset.id)) { lastKey = ''; hideTip(); } });
let lastKey = '';
function renderUpgrades() {
  let ids;
  if (filter === 'heaven') ids = game.visibleUpgrades(true);
  else { ids = game.visibleUpgrades(false); if (filter !== 'all') ids = ids.filter((id) => UPGRADES[id].kind === filter); }
  if (filter === 'all') ids = ids.concat(game.visibleUpgrades(true));
  const total = ids.length; const part = ids.slice(0, shown);
  const key = part.map((id) => id + (game.canAfford(id) ? '+' : '-')).join() + '|' + total;
  $('#upCount').textContent = `${game.upgradeCount.toLocaleString('de-DE')} / ${TOTAL_UPGRADES.toLocaleString('de-DE')} gekauft · ${total.toLocaleString('de-DE')} verfügbar`;
  if (key === lastKey) return; lastKey = key;
  $('#upgrades').innerHTML = part.map((id) => { const u = UPGRADES[id]; return `<button class="up ${u.kind === 'heaven' ? 'heaven ' : ''}${game.canAfford(id) ? 'ok' : 'no'}" data-id="${id}">${u.icon}</button>`; }).join('');
  $('#moreUp').classList.toggle('hidden', total <= shown);
  $('#moreUp').textContent = `Mehr anzeigen (${total - shown} weitere)`;
  $('#upEmpty').classList.toggle('hidden', total > 0);
}

// ---------- Tooltips ----------
const tip = $('#tip');
function showTip(html, e) { tip.innerHTML = html; tip.classList.remove('hidden'); moveTip(e); }
function moveTip(e) { const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY + 14; if (x + w > innerWidth - 6) x = e.clientX - w - 14; if (y + h > innerHeight - 6) y = innerHeight - h - 6; tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px'; }
function hideTip() { tip.classList.add('hidden'); }
document.addEventListener('mouseover', (e) => {
  const up = e.target.closest('.up'); const row = e.target.closest('#shop .row');
  if (up) { const u = UPGRADES[+up.dataset.id]; showTip(`<b>${esc(u.name)}</b><br>${esc(u.desc)}<br><span class="mu">${u.kind === 'heaven' ? '😇 ' + fmt(u.cost) + ' Chips' : '🍪 ' + fmt(u.cost)}</span>`, e); }
  else if (row) {
    const i = +row.dataset.i, b = BUILDINGS[i], per = b.cps * game.tierMult[i] * game.globalMult * (1 + 0.01 * game.chipsEarned);
    showTip(`<b>${b.name}</b> (${game.owned[i]})<br>Jedes erzeugt ca. ${fmt(per)} Kekse/s<br>Gesamt: ${fmt(per * game.owned[i])}/s<br><span class="mu">Rechtsklick: verkaufen (50 %)</span>`, e);
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
  () => (game.chipsEarned > 0 ? 'Engel loben dein Backwerk: „Himmlisch!“' : 'Tipp: Ab 1 Billion Keksen lohnt sich der Aufstieg.'),
];
function newsTick() { $('#ticker').textContent = NEWS[Math.floor(Math.random() * NEWS.length)](); }
newsTick(); setInterval(newsTick, 9000);

// ---------- Modale ----------
const modal = $('#modal');
let modalKind = null;
$('#modalClose').addEventListener('click', () => modal.close());
modal.addEventListener('close', () => { modalKind = null; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
document.querySelectorAll('[data-modal]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.modal)));
function openModal(kind) { modalKind = kind; renderModal(); if (!modal.open) modal.showModal(); }
function renderModal() {
  const body = $('#modalBody'); const t = $('#modalTitle');
  if (modalKind === 'stats') {
    t.textContent = '📊 Statistik';
    const all = game.totalReset + game.total;
    body.innerHTML = `<div class="kv">
      <span>Kekse auf der Bank</span><span>${fmt(game.cookies)}</span>
      <span>Gebacken (diese Runde)</span><span>${fmt(game.total)}</span>
      <span>Gebacken (insgesamt)</span><span>${fmt(all)}</span>
      <span>Kekse pro Sekunde</span><span>${fmt(game.cps)}</span>
      <span>Klickwert</span><span>${fmt(game.clickValue)}</span>
      <span>Klicks</span><span>${fmt(game.clicks)}</span>
      <span>Goldene Kekse geklickt</span><span>${fmt(game.golden)}</span>
      <span>Gebäude</span><span>${fmt(game.owned.reduce((a, b) => a + b, 0))}</span>
      <span>Upgrades</span><span>${game.upgradeCount} / ${TOTAL_UPGRADES}</span>
      <span>Erfolge</span><span>${game.achCount()} / ${ACH.length}</span>
      <span>Aufstiege</span><span>${game.ascensions}</span>
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
      <button id="doAscend" ${g < 1 ? 'disabled' : ''}>🪽 Jetzt aufsteigen</button></div>`;
    $('#doAscend')?.addEventListener('click', () => { if (confirm('Wirklich aufsteigen? Kekse, Gebäude und normale Upgrades werden zurückgesetzt.')) { game.ascend(); lastKey = ''; saveLocal(); modal.close(); toast('🪽 Aufgestiegen!'); } });
  } else if (modalKind === 'cloud') renderCloud();
  else if (modalKind === 'settings') renderSettings();
}

function renderSettings() {
  $('#modalTitle').textContent = '⚙️ Optionen';
  $('#modalBody').innerHTML = `<div class="stack">
    <label>Name deiner Bäckerei<input type="text" id="setName" maxlength="16" value="${esc(game.name)}"></label>
    <div class="rowf"><button id="setTheme">🌓 Design wechseln</button><button id="setPart">✨ Partikel: ${particles ? 'an' : 'aus'}</button><button id="saveNow">💾 Jetzt speichern</button></div>
    <label>Spielstand exportieren / importieren<textarea id="exp" rows="3" placeholder="Export-Code"></textarea></label>
    <div class="rowf"><button id="doExp">⬆️ Exportieren</button><button id="doImp">⬇️ Importieren</button><button id="doReset" style="color:var(--bad)">🗑️ Alles löschen</button></div></div>`;
  $('#setName').addEventListener('input', (e) => { game.name = e.target.value.trim() || 'Dein'; $('#bakeryName').textContent = game.name; });
  $('#setTheme').addEventListener('click', () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; ls.set('cc_theme', n); });
  $('#setPart').addEventListener('click', () => { particles = !particles; ls.set('cc_particles', particles ? '1' : '0'); renderSettings(); });
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
      <p>Gib deinen <b>Namen</b> und ein <b>Passwort</b> ein. Neuer Name = neues Konto, bekannter Name = dein Fortschritt wird aus der Datenbank geladen.</p>
      <label>Name<input type="text" id="lName" maxlength="16" autocomplete="username" value="${esc(game.name === 'Dein' ? '' : game.name)}"></label>
      <label>Passwort<input type="password" id="lPass" autocomplete="current-password"></label>
      <div class="rowf"><button type="submit" id="lGo">🔑 Anmelden / Registrieren</button><button type="button" id="lGuest">Ohne Anmeldung spielen</button></div>
      <div id="cMsg" class="note"></div><h3>🏆 Rangliste</h3><div id="lb">Lade…</div></form>`;
    $('#lGuest').addEventListener('click', () => { ls.set('cc_guest', '1'); modal.close(); });
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault(); $('#lGo').disabled = true; msg('Anmelden…');
      try {
        const r = await cloud.login($('#lName').value, $('#lPass').value);
        if (r.isNew) { game.name = cloud.name; await cloudSave(); toast(`✅ Konto „${esc(cloud.name)}“ erstellt – Fortschritt wird gespeichert`); }
        else { game.load(r.data); game.name = cloud.name; saveLocal(); lastKey = ''; toast(`✅ Willkommen zurück, ${esc(cloud.name)}!`); }
        $('#bakeryName').textContent = game.name; updateCloudBtn(); modal.close();
      } catch (err) { msg('❌ ' + err.message); $('#lGo').disabled = false; }
    });
  } else {
    body.innerHTML = `<div class="stack"><p>Angemeldet als <b>${esc(cloud.name)}</b>. Dein Fortschritt wird automatisch alle 30 Sekunden in der Datenbank gespeichert.</p>
      <div class="rowf"><button id="cSave">☁️⬆️ Jetzt speichern</button><button id="cLoad">☁️⬇️ Aus Cloud laden</button><button id="cOut">🚪 Abmelden</button></div>
      <div id="cMsg" class="note"></div><h3>🏆 Rangliste</h3><div id="lb">Lade…</div></div>`;
    $('#cSave').addEventListener('click', async () => { try { await cloudSave(); msg('Gespeichert ✔'); loadLb(); } catch (e) { msg('❌ ' + e.message); } });
    $('#cLoad').addEventListener('click', async () => { try { const r = await cloud.load(); game.load(r.data); game.name = cloud.name; $('#bakeryName').textContent = game.name; lastKey = ''; saveLocal(); msg('Geladen ✔'); } catch (e) { msg('❌ ' + e.message); } });
    $('#cOut').addEventListener('click', async () => { try { await cloudSave(); } catch { /* egal */ } cloud.logout(); updateCloudBtn(); renderCloud(); });
  }
  loadLb();
}
async function loadLb() {
  const box = $('#lb'); if (!box) return;
  try {
    const r = await cloud.leaderboard();
    box.innerHTML = r.players.length ? `<table class="lb"><tr><th>#</th><th>Bäckerei</th><th>Gebacken gesamt</th></tr>${r.players.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${fmt(p.score)}</td></tr>`).join('')}</table>` : 'Noch keine Einträge.';
  } catch (e) { box.textContent = '❌ ' + e.message; }
}
function cloudSave(keepalive = false) { return cloud.save(game.serialize(), game.totalReset + game.total, keepalive); }
function updateCloudBtn() { $('#cloudBtn').textContent = cloud.loggedIn ? `☁️ ${cloud.name}` : '☁️ Anmelden'; }
updateCloudBtn();

// Beim Start: angemeldet -> neueren Cloud-Stand übernehmen, sonst Anmeldung anbieten
(async () => {
  if (!cloud.enabled) return;
  if (!cloud.loggedIn) { if (ls.get('cc_guest') !== '1') openModal('cloud'); return; }
  try {
    const r = await cloud.load();
    if (r.data && r.data.last > localLast + 1000) { const o = game.load(r.data); game.name = cloud.name; $('#bakeryName').textContent = game.name; lastKey = ''; saveLocal(); if (o.gain > 0) toast(`☁️ Cloud-Stand geladen. Offline (${fmtTime(o.offlineSecs)}): <b>+${fmt(o.gain)}</b> Kekse`); }
  } catch (e) { if (e.status === 403) { cloud.logout(); updateCloudBtn(); toast('❌ Anmeldung abgelaufen – bitte neu anmelden'); } }
})();

// ---------- Hauptschleife ----------
let prev = performance.now(); let lastWall = Date.now(); let saveT = 0; let cloudT = 0; let slowT = 0;
function frame(now) {
  const dt = Math.min(1, (now - prev) / 1000); prev = now;
  // Tab war im Hintergrund/Gerät im Standby: verpasste Zeit gutschreiben
  const wall = Date.now(); const gap = (wall - lastWall) / 1000; lastWall = wall;
  if (gap > 3) { const r = game.catchUp(gap - dt); if (r.gain > 0) toast(`😴 Während du weg warst (${fmtTime(r.offlineSecs)}): <b>+${fmt(r.gain)}</b> Kekse`); }
  game.tick(dt);
  $('#cookies').textContent = fmt(game.cookies);
  $('#cps').textContent = fmt(game.cps);
  $('#clickVal').textContent = fmt(game.clickValue);
  document.title = `${fmt(game.cookies)} Kekse – Keks-Imperium`;
  if (game.gc) { gcEl.classList.remove('hidden'); gcEl.style.left = game.gc.x + '%'; gcEl.style.top = game.gc.y + '%'; } else gcEl.classList.add('hidden');
  slowT += dt;
  if (slowT >= 0.25) {
    slowT = 0; renderShop(); renderUpgrades();
    const buffs = game.buffs.map((b) => `<span>${b.type === 'frenzy' ? '🔥 ×' + Math.round(b.mult * 10) / 10 : '👆 ×777'} ${Math.max(0, Math.ceil((b.until - Date.now()) / 1000))}s</span>`).join('');
    $('#buffs').innerHTML = buffs;
  }
  saveT += dt; cloudT += dt;
  if (saveT >= 1) { saveT = 0; for (const a of game.checkAchievements()) toast(`🏆 <b>${esc(a.name)}</b><br>${esc(a.desc)}`); $('#achBadge').textContent = game.achCount() || ''; if (modalKind === 'stats') renderModal(); }
  if (cloud.loggedIn && cloudT >= 30) { cloudT = 0; cloudSave().catch(() => {}); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(saveLocal, 15000);
addEventListener('beforeunload', saveLocal);
document.addEventListener('visibilitychange', () => { if (document.hidden) { saveLocal(); if (cloud.loggedIn) cloudSave(true).catch(() => {}); } });
