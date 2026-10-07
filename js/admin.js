// Admin-Panel: Spielerliste, Spieler auswählen, Ereignisse schicken (Sterne spawnen, Raserei, Kekse, ...).
// Die Rechte werden vom Server geprüft (nur die Admin-Konten); diese Oberfläche ist nur die Bedienung.
import { BUILDINGS } from './data.js';
import { cloud } from './cloud.js';

import { Big, ZERO } from './big.js';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUFFIX = { k: 1e3, m: 1e6, mio: 1e6, b: 1e9, mrd: 1e9, t: 1e12, bio: 1e12, brd: 1e15, qa: 1e15, trl: 1e18, qi: 1e18, trd: 1e21, sx: 1e21, sp: 1e24, oc: 1e27, no: 1e30, dc: 1e33 };
// "1,5 mio" / "2e9" / "10k" -> Zahl
// wie parseNum, aber als Big (ohne Obergrenze, z. B. "5e500"); ungültig = 0
export function parseBig(txt) {
  const m = /^\s*([\d.,]+)(?:e([+-]?\d+))?\s*([a-z]*)\s*$/i.exec(String(txt));
  if (!m) return ZERO;
  const base = Number(m[1].replace(',', '.')); const mult = m[3] ? SUFFIX[m[3].toLowerCase()] : 1;
  if (!(base > 0) || !mult) return ZERO;
  const ex = m[2] ? Number(m[2]) : 0; if (ex > 1e300) return ZERO;
  return Big.norm(base * mult, ex).clamp();
}
export function parseNum(txt) {
  const m = /^\s*(-?[\d.,]+(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(String(txt));
  if (!m) return NaN;
  const base = Number(m[1].replace(',', '.'));
  const mult = m[2] ? SUFFIX[m[2].toLowerCase()] : 1;
  return mult ? base * mult : NaN;
}

const EFFECTS = [['random', 'Zufällig'], ['frenzy', '🔥 Raserei'], ['lucky', '🍀 Glückstreffer'], ['click', '👆 Klick-Raserei'], ['jackpot', '💰 Jackpot']];
const opt = (list, sel) => list.map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');

const TABS = [['stars', '⭐ Sterne'], ['boost', '🔥 Boost'], ['give', '🎁 Geben'], ['up', '🧪 Upgrades'], ['msg', '💬 Nachricht'], ['sched', '⏰ Zeitplan'], ['admins', '👑 Admins'], ['polls', '📊 Umfragen'], ['banlog', '📜 Bann-Verlauf'], ['appeals', '📨 Einsprüche'], ['manage', '⚙️ Verwaltung']];
const GLOBAL_TABS = ['sched', 'admins', 'banlog', 'appeals', 'polls'];
// Eigene Dauer: "90", "90 min", "1,5 Std", "3 Tage", "2 Wochen" -> Minuten (NaN bei Ungültigem)
export function parseDur(txt) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zäöü]*)\s*$/i.exec(String(txt));
  if (!m) return NaN;
  const n = Number(m[1].replace(',', '.')); const u = m[2].toLowerCase();
  const f = !u || /^(m|min|minute|minuten)$/.test(u) ? 1 : /^(h|std|stunde|stunden)$/.test(u) ? 60 : /^(d|t|tag|tage|tagen)$/.test(u) ? 1440 : /^(w|woche|wochen)$/.test(u) ? 10080 : NaN;
  return Math.round(n * f);
}
// Minuten -> "1 Std 30 Min" / "3 Tage"
export function fmtDur(m) {
  if (!m) return '–'; const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  return [d && `${d} Tag${d > 1 ? 'e' : ''}`, h && `${h} Std`, mi && `${mi} Min`].filter(Boolean).join(' ');
}
const POLL_DURATIONS = [[0, 'Ohne Ende'], [60, '1 Stunde'], [1440, '24 Stunden'], [10080, '7 Tage'], [43200, '30 Tage']];
const DURATIONS = [[0, 'Dauerhaft'], [60, '1 Stunde'], [360, '6 Stunden'], [1440, '24 Stunden'], [10080, '7 Tage'], [43200, '30 Tage']]; // gelten nicht für einen einzelnen Spieler
const localInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fld = (label, html, hint = '') => `<label class="fld"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;

export async function renderAdmin(body, { fmt, toast, title }) {
  title('🛡️ Admin-Panel');
  body.closest('dialog')?.classList.add('wide');
  body.innerHTML = '<div class="adm" id="adm">Lade…</div>';
  const root = body.querySelector('#adm');
  let players = []; let pollItems = null; let banItems = null; let appealItems = null; let schedItems = null; let adminData = null; const sent = []; let sel = null; let tab = 'stars'; let q = ''; let stats = null; let note = null; let info = ''; let now = Date.now();
  const $ = (s) => root.querySelector(s);
  const val = (s) => $(s).value;
  const ALL = 'ALL';
  const nameOf = (id) => (id === ALL ? 'Alle Spieler' : (players.find((p) => p.id === id) || {}).name || id);
  const say = (text, ok = true) => { note = { text, ok }; };

  async function call(action, extra) {
    try { return await cloud.admin(action, extra); } catch (e) { say(e.message, false); paint(); throw e; }
  }
  async function refresh() {
    try {
      const [p, s, ap] = await Promise.all([cloud.admin('players'), cloud.admin('stats'), cloud.admin('appealList').catch(() => ({ items: [] }))]);
      players = p.players; stats = s; now = p.now; stats.appeals = ap.items.filter((x) => x.o).length;
    } catch (e) { root.textContent = '❌ ' + e.message + ' (nur Admins haben Zugriff)'; return false; }
    return true;
  }

  // Ereignis an den gewählten Spieler oder (Rundsendung) an ALLE
  async function send(event, label) {
    if (!sel) { say('Wähle zuerst in der Liste einen Spieler oder „Alle Spieler“.', false); return paint(); }
    try {
      if (sel === ALL) {
        if (event.type === 'upgrades' && event.mode === 'none' && !confirm('Wirklich bei ALLEN Spielern alle Upgrades entfernen?')) return;
        await call('broadcast', { event, text: '' });
      } else await call('event', { target: sel, event });
      say(`${label} → ${nameOf(sel)} gesendet`); toast(`✔ ${label} → ${nameOf(sel)}`);
    } catch { return; }
    paint();
  }

  const keepType = () => (root.querySelector('#sType') ? root.querySelector('#sType').value : null);
  const describe = (x) => {
    if (x.text && !x.event) return `💬 „${x.text}“`;
    const e = x.event || {};
    if (e.type === 'golden') return `⭐ ${e.count}× Sterne (${e.effect})`;
    if (e.type === 'buff') return `🔥 ${e.kind === 'click' ? 'Klick' : 'Kekse'} ×${e.mult} · ${e.seconds} s`;
    if (e.type === 'cookies') return `🍪 ${String(e.amount).startsWith('-') ? '−' : ''}${fmt(String(e.amount).replace(/^-/, ''))} Kekse`;
    return e.type || '?';
  };
  async function loadSched() { try { schedItems = (await cloud.admin('schedList')).items; } catch { schedItems = []; } }
  async function loadPolls() { try { pollItems = (await cloud.admin('pollList')).items; } catch { pollItems = []; } }
  async function loadBanLog() { try { banItems = (await cloud.admin('banLog')).items; } catch { banItems = []; } }
  async function loadAppeals() { try { appealItems = (await cloud.admin('appealList')).items; } catch { appealItems = []; } }
  async function loadAdmins() { try { adminData = await cloud.admin('adminList'); } catch (e) { adminData = { error: e.message }; } }
  const online = (p) => !!p.online;
  const ago = (t) => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const durText = (m) => (m ? fmtDur(m) : 'dauerhaft');
  // Dauer aus Auswahl und freiem Feld (das freie Feld gewinnt); null = ungültige Eingabe
  const pickDur = (sel, custom) => { const c = ((root.querySelector(custom) || {}).value || '').trim(); if (c) { const m = parseDur(c); return m > 0 && m <= 525600 ? m : null; } return +((root.querySelector(sel) || {}).value || 0); };
  function paneHtml() {
    const all = sel === ALL;
    switch (tab) {
      case 'stars': return `
        <div class="adm-hint">Lässt goldene Kekse (Sterne) auf dem Bildschirm erscheinen. Sie sind ca. 13 Sekunden anklickbar.</div>
        <div class="adm-grid">${fld('Effekt', `<select id="gEff">${opt(EFFECTS, 'random')}</select>`)}${fld('Anzahl', '<input type="number" id="gCnt" min="1" max="30" value="1">', '1–30')}</div>
        <button class="adm-go" data-act="golden">⭐ Sterne spawnen</button>
        <div class="adm-quick"><span>Schnell (zufälliger Effekt):</span><button data-act="gq" data-n="5">5× zufällig</button><button data-act="gq" data-n="15">15× zufällig</button><button data-act="gq" data-n="30">30× zufällig</button></div>`;
      case 'boost': return `
        <div class="adm-hint">Zeitlich begrenzter Boost mit freiem Multiplikator.</div>
        <div class="adm-grid3">${fld('Art', '<select id="fKind"><option value="frenzy">🍪 Kekse-Raserei</option><option value="click">👆 Klick-Raserei</option></select>')}${fld('Multiplikator ×', '<input type="number" id="fMult" min="1" max="1000000" step="any" value="7">', '1 bis 1.000.000')}${fld('Dauer (Sekunden)', '<input type="number" id="fSec" min="1" max="3600" value="77">', '1 bis 3600')}</div>
        <button class="adm-go" data-act="buff">🔥 Boost geben</button>
        <div class="adm-quick"><span>Vorlagen:</span><button data-act="preset" data-k="frenzy" data-m="7" data-s="77">Kekse ×7 · 77 s</button><button data-act="preset" data-k="frenzy" data-m="100" data-s="600">Kekse ×100 · 10 min</button><button data-act="preset" data-k="click" data-m="777" data-s="13">Klick ×777 · 13 s</button><button data-act="preset" data-k="click" data-m="10000" data-s="60">Klick ×10.000 · 1 min</button></div>`;
      case 'give': return `
        <div class="adm-sec"><h4>🍪 Kekse</h4><div class="adm-grid">${fld('Menge', '<input type="text" id="cAmt" value="1 mio" placeholder="z. B. 1 mio, 5e9, 10k">', 'k, mio, mrd, bio, 5e9 …')}<div class="adm-btns"><button data-act="cGive">➕ Geben</button><button data-act="cTake">➖ Abziehen</button></div></div></div>
        <div class="adm-sec"><h4>😇 Himmelschips</h4><div class="adm-grid">${fld('Anzahl', '<input type="number" id="chAmt" min="1" value="10">')}<div class="adm-btns"><button data-act="chips">Chips geben</button></div></div></div>
        <div class="adm-sec"><h4>🏭 Gebäude</h4><div class="adm-grid3">${fld('Gebäude', `<select id="bSel">${BUILDINGS.map((b, i) => `<option value="${i}">${b.icon} ${esc(b.name)}</option>`).join('')}</select>`)}${fld('Anzahl', '<input type="number" id="bAmt" min="1" max="100000" value="10">', 'bis 100.000')}<div class="adm-btns"><button data-act="building">Geben</button></div></div></div>`;
      case 'up': return `
        <div class="adm-hint">Schaltet Upgrades und Erfolge frei oder entfernt sie.</div>
        <div class="adm-sec"><h4>🧪 Upgrades (400.000)</h4><div class="adm-btns wrap"><button data-act="up" data-m="all">Alle freischalten</button><button data-act="up" data-m="cookie">Nur Cookie-Upgrades</button><button data-act="up" data-m="heaven">Nur himmlische</button><button class="danger" data-act="up" data-m="none">Alle entfernen</button></div></div>
        <div class="adm-sec"><h4>🏆 Erfolge</h4><div class="adm-btns"><button data-act="ach">Alle Erfolge freischalten</button></div></div>`;
      case 'msg': return `
        <div class="adm-hint">${all ? '📣 Die Nachricht wird <b>allen Spielern</b> groß eingeblendet.' : 'Die Nachricht wird dem Spieler groß eingeblendet und bleibt, bis er sie schließt.'}</div>
        ${fld('Nachricht', '<textarea id="msg" maxlength="140" placeholder="Text eingeben (max. 140 Zeichen)"></textarea>')}
        <div class="adm-count" id="cnt">0 / 140</div>
        <div class="adm-quick"><span>Vorlagen:</span><button data-act="tpl" data-t="Willkommen im Keks-Imperium! 🍪">Willkommen</button><button data-act="tpl" data-t="Achtung: Wartungsarbeiten in Kürze, bitte Spielstand speichern!">Wartung</button><button data-act="tpl" data-t="Event! Goldene Kekse regnen gleich – seid bereit! 🌟">Event</button><button data-act="tpl" data-t="Danke fürs Spielen! ❤️">Danke</button></div>
        <button class="adm-go" data-act="msg">💬 ${all ? 'An ALLE senden' : 'Senden'}</button>
        <div class="adm-sec"><h4>💬 Chat</h4><button class="danger" data-act="chatClear">🧹 Gesamten Chat leeren</button></div>
        ${sent.length ? `<div class="adm-sent"><b>Zuletzt gesendet</b>${sent.map((s) => `<div>${esc(s)}</div>`).join('')}</div>` : ''}`;
      case 'sched': {
        const st = (keepType()) || 'msg';
        const items = schedItems ? (schedItems.length ? schedItems.map((x) => `<div class="adm-sched"><span>🕒 ${new Date(x.at).toLocaleString('de-DE')}</span><span>${esc(describe(x))}</span><button class="danger" data-act="schedDel" data-eid="${x.eid}">✖</button></div>`).join('') : '<div class="adm-empty">Nichts geplant.</div>') : '<div class="adm-empty">Lade…</div>';
        return `<div class="adm-hint">Plant eine Nachricht oder ein Ereignis für <b>ALLE Spieler</b> zu einer bestimmten Uhrzeit. Es wird ausgeführt, sobald danach ein Spieler online ist (meist innerhalb von Sekunden).</div>
        <div class="adm-grid">${fld('Art', `<select id="sType"><option value="msg" ${st === 'msg' ? 'selected' : ''}>💬 Nachricht</option><option value="golden" ${st === 'golden' ? 'selected' : ''}>⭐ Sterne</option><option value="buff" ${st === 'buff' ? 'selected' : ''}>🔥 Boost</option><option value="cookies" ${st === 'cookies' ? 'selected' : ''}>🍪 Kekse schenken</option></select>`)}${fld('Wann (deine Uhrzeit)', '<input type="datetime-local" id="sWhen">')}</div>
        ${st === 'msg' ? fld('Nachricht', '<input type="text" id="sText" maxlength="140" placeholder="Text für alle Spieler">') : ''}
        ${st === 'golden' ? `<div class="adm-grid">${fld('Effekt', `<select id="sEff">${opt(EFFECTS, 'random')}</select>`)}${fld('Anzahl', '<input type="number" id="sCnt" min="1" max="30" value="5">')}</div>` : ''}
        ${st === 'buff' ? `<div class="adm-grid3">${fld('Art', '<select id="sKind"><option value="frenzy">🍪 Kekse</option><option value="click">👆 Klick</option></select>')}${fld('Multiplikator ×', '<input type="number" id="sMult" min="1" max="1000000" step="any" value="7">')}${fld('Dauer (s)', '<input type="number" id="sSec" min="1" max="3600" value="77">')}</div>` : ''}
        ${st === 'cookies' ? fld('Menge', '<input type="text" id="sAmt" value="1 mio">', 'z. B. 1 mio, 5e9') : ''}
        <button class="adm-go" data-act="schedAdd">⏰ Planen</button>
        <div class="adm-sec"><h4>Geplant (${schedItems ? schedItems.length : '…'})</h4>${items}</div>`;
      }
      case 'polls': {
        const list = pollItems === null ? '<div class="adm-empty">Lade…</div>' : pollItems.length ? pollItems.map((p) => `<div class="adm-sec"><h4>${p.open ? '🟢' : '⚪'} ${esc(p.q)} <small>${p.total} Stimmen</small></h4>${p.opts.map((o, i) => `<div class="adm-sched"><span>${esc(o)}</span><span>${p.total ? Math.round((p.counts[i] / p.total) * 100) : 0} % (${p.counts[i]})</span><span></span></div>`).join('')}<div class="adm-btns wrap"><button data-act="pollClose" data-id="${p.id}">${p.open ? '🔒 Beenden' : '🔓 Wieder öffnen'}</button><button class="danger" data-act="pollDel" data-id="${p.id}">🗑️ Löschen</button></div></div>`).join('') : '<div class="adm-hint">Noch keine Umfragen.</div>';
        return `<div class="adm-hint">Erstellt eine Umfrage für <b>alle Spieler</b>. Sie bekommen einen Hinweis und stimmen im Fenster „📊 Umfragen“ ab. Es bleiben die letzten 20 Umfragen gespeichert.</div>
        ${fld('Frage', '<input type="text" id="pq" maxlength="140" placeholder="z. B. Welches Update wollt ihr als Nächstes?">')}
        ${fld('Antworten (eine pro Zeile, 2 bis 6)', '<textarea id="po" rows="4" maxlength="400" placeholder="Auto-Kauf&#10;Gilden&#10;Neue goldene Kekse"></textarea>')}
        <div class="adm-grid">${fld('Dauer', `<select id="pd">${POLL_DURATIONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`)}${fld('Eigene Dauer', '<input type="text" id="pdC" maxlength="20" placeholder="z. B. 90 min, 5 Std, 3 Tage">', 'überschreibt die Auswahl')}</div>
        <button class="adm-go" data-act="pollAdd">📊 Umfrage starten</button>
        <div class="adm-sec"><h4>Umfragen (${pollItems ? pollItems.length : '…'})</h4>${list}</div>`;
      }
      case 'banlog': {
        if (!banItems) return '<div class="adm-empty">Lade…</div>';
        if (!banItems.length) return '<div class="adm-hint">Noch keine Sperren protokolliert.</div>';
        return `<div class="adm-hint">Die letzten ${banItems.length} Sperren, Änderungen und Entsperrungen.</div>${banItems.map((x) => {
          const icon = x.action === 'unban' ? '✅' : x.action === 'edit' ? '✏️' : '🚫';
          const left = x.action !== 'unban' && x.until ? (x.until > Date.now() ? `bis ${ago(x.until)}` : 'abgelaufen') : x.action === 'unban' ? '' : 'dauerhaft';
          return `<div class="adm-sched"><span>${icon} ${ago(x.t)}</span><span><b>${esc(x.name)}</b> · ${x.action === 'unban' ? 'entsperrt' : durText(x.minutes) + (left ? ' (' + left + ')' : '')} · von ${esc(x.by)}${x.reason ? `<br><small>„${esc(x.reason)}“</small>` : ''}</span><span></span></div>`;
        }).join('')}`;
      }
      case 'appeals': {
        if (!appealItems) return '<div class="adm-empty">Lade…</div>';
        if (!appealItems.length) return '<div class="adm-hint">Keine Einsprüche.</div>';
        return `<div class="adm-hint">Einsprüche gesperrter Spieler. Antworten sehen sie auf ihrem schwarzen Bildschirm.</div>${appealItems.map((x) => `<div class="adm-sec"><h4>${x.o ? '📨' : '✅'} ${esc(x.n || x.id)} <small>${ago(x.t)}</small></h4><div class="note">„${esc(x.x || '')}“</div>${x.r ? `<div class="note"><b>Deine Antwort:</b> ${esc(x.r)}</div>` : ''}<div class="adm-grid">${fld('Antwort', `<input type="text" id="ar_${x.id}" maxlength="300" placeholder="Antwort an den Spieler" value="${esc(x.r || '')}">`)}<div class="adm-btns wrap"><button data-act="apReply" data-id="${x.id}">💬 Antworten</button><button data-act="apUnban" data-id="${x.id}">✅ Entbannen</button><button class="danger" data-act="apDel" data-id="${x.id}">🗑️</button></div></div></div>`).join('')}`;
      }
      case 'admins': {
        if (!adminData) return '<div class="adm-empty">Lade…</div>';
        if (adminData.error) return `<div class="adm-hint">${esc(adminData.error)}</div>`;
        return `<div class="adm-hint">Feste Admins können weitere Spieler zu Admins machen. Ernannte Admins haben dieselben Panel-Rechte, können aber keine Admins verwalten.</div>
        <div class="adm-sec"><h4>🛡️ Feste Admins</h4>${adminData.fixed.map((n) => `<div class="adm-sched"><span>${esc(n)}</span><span class="note">fest</span><span></span></div>`).join('')}</div>
        <div class="adm-sec"><h4>👑 Ernannte Admins</h4>${adminData.extra.map((x) => `<div class="adm-sched"><span>${esc(x.name)}</span><span></span><button class="danger" data-act="adminDel" data-id="${x.id}">Entfernen</button></div>`).join('') || '<div class="adm-empty">Noch keine.</div>'}</div>
        <div class="adm-grid">${fld('Spieler hinzufügen (Name)', '<input type="text" id="aName" maxlength="16" placeholder="Name des Spielers">', 'Der Spieler braucht ein Konto')}<div class="adm-btns"><button data-act="adminAdd">➕ Zum Admin machen</button></div></div>`;
      }
      default: {
        if (all) return '<div class="adm-hint">Die Verwaltung (ansehen, sperren, zurücksetzen, löschen) gibt es nur für einzelne Spieler. Wähle in der Liste einen Spieler.</div>';
        const cur = players.find((p) => p.id === sel);
        return `
        <div class="adm-sec"><h4>🔎 Spielstand</h4><button data-act="inspect">📋 Spielstand ansehen</button>${info ? `<pre>${esc(info)}</pre>` : ''}</div>
        <div class="adm-sec"><h4>🔇 Chat</h4><div class="adm-btns wrap"><button data-act="mute" data-min="10">10 Min stumm</button><button data-act="mute" data-min="60">1 Std stumm</button><button data-act="mute" data-min="1440">24 Std stumm</button><button data-act="mute" data-min="0">${cur && cur.muted ? '🔊 Stumm aufheben' : 'Stumm aufheben'}</button></div><div class="adm-grid">${fld('Eigene Dauer stumm', '<input type="text" id="muteC" maxlength="20" placeholder="z. B. 45 min, 3 Std, 2 Tage">')}<div class="adm-btns"><button data-act="muteC">🔇 Stumm schalten</button></div></div><small class="adm-small">Stumme Spieler können im Chat nicht schreiben. Einzelne Nachrichten löschst du direkt im Chat mit 🗑️.</small></div>
        <div class="adm-sec"><h4>🚫 Zugang</h4><div class="adm-grid">${fld('Dauer', `<select id="banDur">${DURATIONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`, 'Bann auf Zeit endet von selbst')}${fld('Eigene Dauer', '<input type="text" id="banDurC" maxlength="20" placeholder="z. B. 90 min, 5 Std, 3 Tage">', 'überschreibt die Auswahl (max. 1 Jahr)')}</div><label class="fld"><span>Bann-Nachricht (wird dem Spieler auf dem schwarzen Bildschirm angezeigt)</span><textarea id="banMsg" rows="2" maxlength="300" placeholder="z. B. Beleidigungen im Chat"></textarea></label><div class="adm-btns wrap"><button data-act="ban">${cur && cur.banned ? '✅ Konto entsperren' : '🚫 Konto sperren'}</button>${cur && cur.banned ? '<button data-act="banmsg">💾 Nachricht ändern</button>' : ''}</div><small class="adm-small">Gesperrte Spieler sehen einen schwarzen Bildschirm mit „Du wurdest gebannt“ und deiner Nachricht, können nichts mehr speichern und verschwinden aus der Rangliste.</small></div>
        <div class="adm-sec danger-zone"><h4>⚠️ Gefahrenzone</h4><div class="adm-btns wrap"><button class="danger" data-act="reset">♻️ Spielstand zurücksetzen</button><button class="danger" data-act="del">🗑️ Konto löschen</button></div></div>`;
      }
    }
  }

  function paint() {
    const keep = {}; root.querySelectorAll('input[id],select[id],textarea[id]').forEach((el) => { keep[el.id] = el.value; });
    const f = q.trim().toLowerCase();
    const list = players.filter((p) => !f || p.name.toLowerCase().includes(f));
    const cur = players.find((p) => p.id === sel);
    root.innerHTML = `
      <div class="adm-top"><span class="chip">👥 ${stats.players} Spieler</span><span class="chip good">🟢 ${stats.online} online</span><span class="chip ${stats.banned ? 'bad' : ''}">🚫 ${stats.banned} gesperrt</span>${stats.appeals ? `<span class="chip bad">📨 ${stats.appeals} Einspruch${stats.appeals > 1 ? 'e' : ''}</span>` : ''}<span class="chip">🍪 ${fmt(stats.totalCookies)} gebacken</span></div>
      <div class="adm-cols">
        <aside class="adm-side">
          <div class="adm-search"><input type="text" id="q" placeholder="🔍 Spieler suchen…" value="${esc(q)}"><button id="reload" title="Liste aktualisieren">🔄</button></div>
          <div class="adm-list">
            <div class="adm-row all ${sel === ALL ? 'sel' : ''}" data-id="${ALL}"><span class="dot on"></span><span>📣 Alle Spieler</span><span></span></div>
            ${list.map((p) => `<div class="adm-row ${p.id === sel ? 'sel' : ''}" data-id="${p.id}"><span class="dot ${online(p) ? 'on' : ''}"></span><span>${esc(p.name)}${p.banned ? ' 🚫' : ''}${p.muted ? ' 🔇' : ''}</span><span class="sc">${fmt(p.score)}</span></div>`).join('') || '<div class="adm-empty">Keine Treffer</div>'}
          </div>
        </aside>
        <section class="adm-main">
          ${sel && !GLOBAL_TABS.includes(tab) ? `<div class="adm-target ${sel === ALL ? 'all' : ''}"><span>🎯 Ziel</span><b>${esc(nameOf(sel))}</b>${cur ? `<small>${online(cur) ? '🟢 online' : '⚪ offline'} · ${fmt(cur.score)} gebacken</small>` : '<small>Rundsendung an alle Spieler</small>'}</div>` : ''}
          <div class="adm-tabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>
          ${GLOBAL_TABS.includes(tab) || sel ? `<div class="adm-pane">${paneHtml()}</div>` : '<div class="adm-empty big">👈 Wähle in der Liste einen Spieler oder „Alle Spieler“, um Aktionen zu senden. Die Reiter „Zeitplan“ und „Admins“ brauchen keine Auswahl.</div>'}
          ${note ? `<div class="adm-status ${note.ok ? 'ok' : 'err'}">${note.ok ? '✔' : '❌'} ${esc(note.text)}</div>` : ''}
        </section>
      </div>`;
    for (const [id, v] of Object.entries(keep)) { const el = root.querySelector('#' + id); if (el && id !== 'q') el.value = v; }
    const sw = $('#sWhen'); if (sw && !sw.value) sw.value = localInput(new Date(Date.now() + 10 * 60000));
    const stp = $('#sType'); if (stp) stp.addEventListener('change', paint);
    const mt = $('#msg'); if (mt) { $('#cnt').textContent = `${mt.value.length} / 140`; mt.addEventListener('input', () => { $('#cnt').textContent = `${mt.value.length} / 140`; }); }
    $('#q').addEventListener('input', (e) => { q = e.target.value; const pos = e.target.selectionStart; paint(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  const intIn = (s, min, max, def) => { const n = Math.floor(Number(val(s))); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  root.addEventListener('click', async (e) => {
    const row = e.target.closest('.adm-row[data-id]');
    if (row) { sel = row.dataset.id; info = ''; note = null; if (sel === ALL && tab === 'manage') tab = 'stars'; if (GLOBAL_TABS.includes(tab)) tab = 'stars'; return paint(); }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { tab = tb.dataset.tab; note = null; paint(); if (tab === 'sched') { await loadSched(); paint(); } if (tab === 'admins') { await loadAdmins(); paint(); } if (tab === 'polls') { await loadPolls(); paint(); } if (tab === 'banlog') { await loadBanLog(); paint(); } if (tab === 'appeals') { await loadAppeals(); paint(); } return; }
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.id === 'reload') { await refresh(); return paint(); }
    const act = btn.dataset.act; if (!act) return;
    switch (act) {
      case 'golden': return send({ type: 'golden', effect: val('#gEff'), count: intIn('#gCnt', 1, 30, 1) }, `${intIn('#gCnt', 1, 30, 1)}× Sterne`);
      case 'gq': return send({ type: 'golden', effect: 'random', count: +btn.dataset.n }, `${btn.dataset.n}× Sterne (zufällig)`);
      case 'buff': {
        const mult = Number(val('#fMult')), seconds = intIn('#fSec', 1, 3600, 60);
        if (!(mult >= 1 && mult <= 1e6)) { say('Multiplikator muss zwischen 1 und 1.000.000 liegen', false); return paint(); }
        return send({ type: 'buff', kind: val('#fKind'), mult, seconds }, `${val('#fKind') === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${mult} · ${seconds} s`);
      }
      case 'preset': return send({ type: 'buff', kind: btn.dataset.k, mult: +btn.dataset.m, seconds: +btn.dataset.s }, `${btn.dataset.k === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${btn.dataset.m}`);
      case 'cGive': case 'cTake': {
        const n = parseBig(val('#cAmt')); if (n.isZero()) { say('Ungültige Zahl (z. B. 1 mio, 5e9, 10k)', false); return paint(); }
        return send({ type: 'cookies', amount: (act === 'cGive' ? '' : '-') + n.toString() }, `${act === 'cGive' ? '+' : '−'}${fmt(n)} Kekse`);
      }
      case 'chips': return send({ type: 'chips', amount: intIn('#chAmt', 1, 1e9, 1) }, `${intIn('#chAmt', 1, 1e9, 1)} Chips`);
      case 'building': return send({ type: 'building', b: intIn('#bSel', 0, 14, 0), amount: intIn('#bAmt', 1, 100000, 1) }, `${intIn('#bAmt', 1, 100000, 1)}× ${BUILDINGS[intIn('#bSel', 0, 14, 0)].name}`);
      case 'up': return send({ type: 'upgrades', mode: btn.dataset.m }, { all: 'Alle Upgrades', cookie: 'Cookie-Upgrades', heaven: 'Himmlische Upgrades', none: 'Upgrades entfernen' }[btn.dataset.m]);
      case 'ach': return send({ type: 'achievements' }, 'Alle Erfolge');
      case 'tpl': { const t = $('#msg'); t.value = btn.dataset.t; $('#cnt').textContent = `${t.value.length} / 140`; t.focus(); return; }
      case 'msg': {
        const text = val('#msg').trim(); if (!text) { say('Bitte eine Nachricht eingeben', false); return paint(); }
        if (!sel) { say('Wähle zuerst in der Liste einen Spieler oder „Alle Spieler“.', false); return paint(); }
        const log = () => { sent.unshift(`${sel === ALL ? 'ALLE' : nameOf(sel)}: ${text}`); sent.length = Math.min(sent.length, 5); };
        if (sel === ALL) { try { await call('broadcast', { text }); say('Nachricht an alle Spieler gesendet'); log(); } catch { return; } return paint(); }
        try { await call('event', { target: sel, event: { type: 'message', text } }); say(`Nachricht an ${nameOf(sel)} gesendet`); toast(`✔ Nachricht → ${nameOf(sel)}`); log(); } catch { return; }
        return paint();
      }
      case 'inspect': {
        try {
          const d = await call('inspect', { target: sel });
          info = `Name: ${d.name}\nKekse: ${fmt(Big.parse(d.cookies))} · gebacken (Runde): ${fmt(Big.parse(d.total))} · früher: ${fmt(Big.parse(d.totalReset))}\nKlicks: ${fmt(d.clicks || 0)} · goldene Kekse: ${d.golden || 0}\nGebäude: ${(d.owned || []).map((n, i) => n ? `${BUILDINGS[i].name} ${n}` : '').filter(Boolean).join(', ') || '–'}\nUpgrades: ${d.upgrades}/400000 · Erfolge: ${d.achievements}\nAufstiege: ${d.ascensions || 0} · Chips: ${d.chipsEarned || 0} (ausgegeben ${d.chipsSpent || 0})\nLetzte Speicherung: ${new Date(d.lastSave).toLocaleString('de-DE')}${d.banned ? '\n🚫 GESPERRT' : ''}`;
        } catch { return; }
        return paint();
      }
      case 'schedAdd': {
        const at = new Date(val('#sWhen')).getTime(); if (!Number.isFinite(at)) { say('Bitte Datum und Uhrzeit wählen', false); return paint(); }
        const st = val('#sType'); let payload = {};
        if (st === 'msg') { const text = val('#sText').trim(); if (!text) { say('Bitte eine Nachricht eingeben', false); return paint(); } payload = { text }; }
        else if (st === 'golden') payload = { event: { type: 'golden', effect: val('#sEff'), count: intIn('#sCnt', 1, 30, 1) } };
        else if (st === 'buff') { const mult = Number(val('#sMult')); if (!(mult >= 1 && mult <= 1e6)) { say('Multiplikator 1 bis 1.000.000', false); return paint(); } payload = { event: { type: 'buff', kind: val('#sKind'), mult, seconds: intIn('#sSec', 1, 3600, 60) } }; }
        else { const n = parseBig(val('#sAmt')); if (n.isZero()) { say('Ungültige Menge', false); return paint(); } payload = { event: { type: 'cookies', amount: n.toString() } }; }
        try { await call('schedAdd', { at, ...payload }); say(`Geplant für ${new Date(at).toLocaleString('de-DE')}`); await loadSched(); } catch { return; }
        return paint();
      }
      case 'schedDel': { try { await call('schedDel', { eid: btn.dataset.eid }); say('Eintrag entfernt'); await loadSched(); } catch { return; } return paint(); }
      case 'adminAdd': {
        const name = val('#aName').trim(); if (!name) { say('Bitte einen Namen eingeben', false); return paint(); }
        try { await call('adminAdd', { name }); say(`${name} ist jetzt Admin`); await loadAdmins(); } catch { return; }
        return paint();
      }
      case 'adminDel': { if (!confirm('Diesem Admin die Rechte entziehen?')) return; try { await call('adminDel', { target: btn.dataset.id }); say('Admin entfernt'); await loadAdmins(); } catch { return; } return paint(); }
      case 'muteC': {
        const min = pickDur('#muteC', '#muteC'); if (!min) { say('Bitte eine gültige Dauer eingeben (z. B. 45 min, 3 Std, 2 Tage)', false); return paint(); }
        try { await call('mute', { target: sel, minutes: min }); say(`${nameOf(sel)} ist ${fmtDur(min)} stumm`); await refresh(); } catch { return; }
        return paint();
      }
      case 'mute': {
        const min = +btn.dataset.min;
        try { await call('mute', { target: sel, minutes: min }); say(min ? `${nameOf(sel)} ist ${min >= 60 ? min / 60 + ' Std' : min + ' Min'} stumm` : `${nameOf(sel)} darf wieder schreiben`); await refresh(); } catch { return; }
        return paint();
      }
      case 'chatClear': {
        if (!confirm('Den gesamten Chat wirklich leeren?')) return;
        try { await call('chatClear', {}); say('Chat geleert'); } catch { return; }
        return paint();
      }
      case 'ban': {
        const p = players.find((x) => x.id === sel);
        const reason = (root.querySelector('#banMsg') || {}).value || '';
        const minutes = pickDur('#banDur', '#banDurC'); if (minutes === null) { say('Eigene Dauer ungültig (z. B. 90 min, 5 Std, 3 Tage; höchstens 1 Jahr)', false); return paint(); }
        try { await call('ban', { target: sel, banned: !p.banned, reason, minutes }); say(p.banned ? `${p.name} entsperrt` : `${p.name} gesperrt`); await refresh(); } catch { return; }
        return paint();
      }
      case 'pollAdd': {
        const q = val('#pq').trim(); const opts = val('#po').split('\n').map((x) => x.trim()).filter(Boolean);
        if (q.length < 3 || opts.length < 2 || opts.length > 6) { say('Eine Frage und 2 bis 6 Antworten (je eine pro Zeile) eingeben', false); return paint(); }
        const minutes = pickDur('#pd', '#pdC'); if (minutes === null) { say('Eigene Dauer ungültig (z. B. 90 min, 5 Std, 3 Tage; höchstens 1 Jahr)', false); return paint(); }
        try { await call('pollCreate', { q, opts, minutes }); say('Umfrage gestartet'); toast('📊 Umfrage gestartet'); await loadPolls(); } catch { return; }
        return paint();
      }
      case 'pollClose': { try { await call('pollClose', { poll: btn.dataset.id }); say('Umfrage geändert'); await loadPolls(); } catch { return; } return paint(); }
      case 'pollDel': { if (!confirm('Diese Umfrage samt Stimmen löschen?')) return; try { await call('pollDel', { poll: btn.dataset.id }); say('Umfrage gelöscht'); await loadPolls(); } catch { return; } return paint(); }
      case 'apReply': { const id = btn.dataset.id; const text = (root.querySelector('#ar_' + id) || {}).value || ''; try { await call('appealReply', { target: id, text }); say('Antwort gesendet'); await loadAppeals(); } catch { return; } return paint(); }
      case 'apUnban': { const id = btn.dataset.id; try { await call('ban', { target: id, banned: false }); say('Entbannt'); await loadAppeals(); await refresh(); } catch { return; } return paint(); }
      case 'apDel': { try { await call('appealDel', { target: btn.dataset.id }); say('Einspruch gelöscht'); await loadAppeals(); } catch { return; } return paint(); }
      case 'banmsg': {
        const p = players.find((x) => x.id === sel); const reason = (root.querySelector('#banMsg') || {}).value || '';
        const minutes = pickDur('#banDur', '#banDurC'); if (minutes === null) { say('Eigene Dauer ungültig (z. B. 90 min, 5 Std, 3 Tage; höchstens 1 Jahr)', false); return paint(); }
        try { await call('ban', { target: sel, banned: true, reason, minutes, keep: true }); say(`Bann-Nachricht für ${p.name} geändert`); } catch { return; }
        return paint();
      }
      case 'reset': {
        if (!confirm(`Spielstand von ${nameOf(sel)} wirklich zurücksetzen?`)) return;
        try { await call('event', { target: sel, event: { type: 'reset' } }); say('Zurücksetzen angeordnet'); } catch { return; }
        return paint();
      }
      case 'del': {
        if (!confirm(`Konto „${nameOf(sel)}“ endgültig löschen?`)) return;
        try { await call('delete', { target: sel }); say('Konto gelöscht'); sel = null; info = ''; await refresh(); } catch { return; }
        return paint();
      }
      default:
    }
  });

  if (await refresh()) paint();
}
