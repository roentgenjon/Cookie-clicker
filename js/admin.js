// Admin-Panel: Spielerliste, Spieler auswählen, Ereignisse schicken (Sterne spawnen, Raserei, Kekse, ...).
// Die Rechte werden vom Server geprüft (nur die Admin-Konten); diese Oberfläche ist nur die Bedienung.
import { BUILDINGS } from './data.js';
import { cloud } from './cloud.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUFFIX = { k: 1e3, m: 1e6, mio: 1e6, b: 1e9, mrd: 1e9, t: 1e12, bio: 1e12, qa: 1e15, qi: 1e18 };
// "1,5 mio" / "2e9" / "10k" -> Zahl
export function parseNum(txt) {
  const m = /^\s*(-?[\d.,]+(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(String(txt));
  if (!m) return NaN;
  const base = Number(m[1].replace(',', '.'));
  const mult = m[2] ? SUFFIX[m[2].toLowerCase()] : 1;
  return mult ? base * mult : NaN;
}

const EFFECTS = [['random', 'Zufällig'], ['frenzy', '🔥 Raserei'], ['lucky', '🍀 Glückstreffer'], ['click', '👆 Klick-Raserei'], ['jackpot', '💰 Jackpot']];
const opt = (list, sel) => list.map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');

const TABS = [['stars', '⭐ Sterne'], ['boost', '🔥 Boost'], ['give', '🎁 Geben'], ['up', '🧪 Upgrades'], ['msg', '💬 Nachricht'], ['manage', '⚙️ Verwaltung']];
const fld = (label, html, hint = '') => `<label class="fld"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;

export async function renderAdmin(body, { fmt, toast, title }) {
  title('🛡️ Admin-Panel');
  body.closest('dialog')?.classList.add('wide');
  body.innerHTML = '<div class="adm" id="adm">Lade…</div>';
  const root = body.querySelector('#adm');
  let players = []; let sel = null; let tab = 'stars'; let q = ''; let stats = null; let note = null; let info = ''; let now = Date.now();
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
      const [p, s] = await Promise.all([cloud.admin('players'), cloud.admin('stats')]);
      players = p.players; stats = s; now = p.now;
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

  const online = (p) => now - p.updated < 120000;
  function paneHtml() {
    const all = sel === ALL;
    switch (tab) {
      case 'stars': return `
        <div class="adm-hint">Lässt goldene Kekse (Sterne) auf dem Bildschirm erscheinen. Sie sind ca. 13 Sekunden anklickbar.</div>
        <div class="adm-grid">${fld('Effekt', `<select id="gEff">${opt(EFFECTS, 'random')}</select>`)}${fld('Anzahl', '<input type="number" id="gCnt" min="1" max="30" value="1">', '1–30')}</div>
        <button class="adm-go" data-act="golden">⭐ Sterne spawnen</button>
        <div class="adm-quick"><span>Schnell:</span><button data-act="gq" data-n="5">5×</button><button data-act="gq" data-n="15">15×</button><button data-act="gq" data-n="30">30×</button></div>`;
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
        <div class="adm-hint">Zeigt dem Spieler eine Mitteilung ${all ? '(Rundsendung an alle)' : ''} oben im Spiel.</div>
        ${fld('Nachricht', '<input type="text" id="msg" maxlength="140" placeholder="Text eingeben (max. 140 Zeichen)">')}
        <button class="adm-go" data-act="msg">💬 Senden</button>`;
      default: {
        if (all) return '<div class="adm-hint">Die Verwaltung (ansehen, sperren, zurücksetzen, löschen) gibt es nur für einzelne Spieler. Wähle in der Liste einen Spieler.</div>';
        const cur = players.find((p) => p.id === sel);
        return `
        <div class="adm-sec"><h4>🔎 Spielstand</h4><button data-act="inspect">📋 Spielstand ansehen</button>${info ? `<pre>${esc(info)}</pre>` : ''}</div>
        <div class="adm-sec"><h4>🚫 Zugang</h4><button data-act="ban">${cur && cur.banned ? '✅ Konto entsperren' : '🚫 Konto sperren'}</button><small class="adm-small">Gesperrte Spieler können nichts mehr speichern und verschwinden aus der Rangliste.</small></div>
        <div class="adm-sec danger-zone"><h4>⚠️ Gefahrenzone</h4><div class="adm-btns wrap"><button class="danger" data-act="reset">♻️ Spielstand zurücksetzen</button><button class="danger" data-act="del">🗑️ Konto löschen</button></div></div>`;
      }
    }
  }

  function paint() {
    const keep = {}; root.querySelectorAll('input[id],select[id]').forEach((el) => { keep[el.id] = el.value; });
    const f = q.trim().toLowerCase();
    const list = players.filter((p) => !f || p.name.toLowerCase().includes(f));
    const cur = players.find((p) => p.id === sel);
    root.innerHTML = `
      <div class="adm-top"><span class="chip">👥 ${stats.players} Spieler</span><span class="chip good">🟢 ${stats.online} online</span><span class="chip ${stats.banned ? 'bad' : ''}">🚫 ${stats.banned} gesperrt</span><span class="chip">🍪 ${fmt(stats.totalCookies)} gebacken</span></div>
      <div class="adm-cols">
        <aside class="adm-side">
          <div class="adm-search"><input type="text" id="q" placeholder="🔍 Spieler suchen…" value="${esc(q)}"><button id="reload" title="Liste aktualisieren">🔄</button></div>
          <div class="adm-list">
            <div class="adm-row all ${sel === ALL ? 'sel' : ''}" data-id="${ALL}"><span class="dot on"></span><span>📣 Alle Spieler</span><span></span></div>
            ${list.map((p) => `<div class="adm-row ${p.id === sel ? 'sel' : ''}" data-id="${p.id}"><span class="dot ${online(p) ? 'on' : ''}"></span><span>${esc(p.name)}${p.banned ? ' 🚫' : ''}</span><span class="sc">${fmt(p.score)}</span></div>`).join('') || '<div class="adm-empty">Keine Treffer</div>'}
          </div>
        </aside>
        <section class="adm-main">
          ${sel ? `<div class="adm-target ${sel === ALL ? 'all' : ''}"><span>🎯 Ziel</span><b>${esc(nameOf(sel))}</b>${cur ? `<small>${online(cur) ? '🟢 online' : '⚪ offline'} · ${fmt(cur.score)} gebacken</small>` : '<small>Rundsendung an alle Spieler</small>'}</div>
          <div class="adm-tabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>
          <div class="adm-pane">${paneHtml()}</div>` : '<div class="adm-empty big">👈 Wähle in der Liste einen Spieler oder „Alle Spieler“, um Aktionen zu senden.</div>'}
          ${note ? `<div class="adm-status ${note.ok ? 'ok' : 'err'}">${note.ok ? '✔' : '❌'} ${esc(note.text)}</div>` : ''}
        </section>
      </div>`;
    for (const [id, v] of Object.entries(keep)) { const el = root.querySelector('#' + id); if (el && id !== 'q') el.value = v; }
    $('#q').addEventListener('input', (e) => { q = e.target.value; const pos = e.target.selectionStart; paint(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  const intIn = (s, min, max, def) => { const n = Math.floor(Number(val(s))); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  root.addEventListener('click', async (e) => {
    const row = e.target.closest('.adm-row[data-id]');
    if (row) { sel = row.dataset.id; info = ''; note = null; if (sel === ALL && tab === 'manage') tab = 'stars'; return paint(); }
    const tb = e.target.closest('button[data-tab]');
    if (tb) { tab = tb.dataset.tab; note = null; return paint(); }
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.id === 'reload') { await refresh(); return paint(); }
    const act = btn.dataset.act; if (!act) return;
    switch (act) {
      case 'golden': return send({ type: 'golden', effect: val('#gEff'), count: intIn('#gCnt', 1, 30, 1) }, `${intIn('#gCnt', 1, 30, 1)}× Sterne`);
      case 'gq': return send({ type: 'golden', effect: val('#gEff'), count: +btn.dataset.n }, `${btn.dataset.n}× Sterne`);
      case 'buff': {
        const mult = Number(val('#fMult')), seconds = intIn('#fSec', 1, 3600, 60);
        if (!(mult >= 1 && mult <= 1e6)) { say('Multiplikator muss zwischen 1 und 1.000.000 liegen', false); return paint(); }
        return send({ type: 'buff', kind: val('#fKind'), mult, seconds }, `${val('#fKind') === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${mult} · ${seconds} s`);
      }
      case 'preset': return send({ type: 'buff', kind: btn.dataset.k, mult: +btn.dataset.m, seconds: +btn.dataset.s }, `${btn.dataset.k === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${btn.dataset.m}`);
      case 'cGive': case 'cTake': {
        const n = parseNum(val('#cAmt')); if (!Number.isFinite(n) || n <= 0) { say('Ungültige Zahl (z. B. 1 mio, 5e9, 10k)', false); return paint(); }
        return send({ type: 'cookies', amount: act === 'cGive' ? n : -n }, `${act === 'cGive' ? '+' : '−'}${fmt(n)} Kekse`);
      }
      case 'chips': return send({ type: 'chips', amount: intIn('#chAmt', 1, 1e9, 1) }, `${intIn('#chAmt', 1, 1e9, 1)} Chips`);
      case 'building': return send({ type: 'building', b: intIn('#bSel', 0, 14, 0), amount: intIn('#bAmt', 1, 100000, 1) }, `${intIn('#bAmt', 1, 100000, 1)}× ${BUILDINGS[intIn('#bSel', 0, 14, 0)].name}`);
      case 'up': return send({ type: 'upgrades', mode: btn.dataset.m }, { all: 'Alle Upgrades', cookie: 'Cookie-Upgrades', heaven: 'Himmlische Upgrades', none: 'Upgrades entfernen' }[btn.dataset.m]);
      case 'ach': return send({ type: 'achievements' }, 'Alle Erfolge');
      case 'msg': {
        const text = val('#msg').trim(); if (!text) { say('Bitte eine Nachricht eingeben', false); return paint(); }
        if (!sel) { say('Wähle zuerst in der Liste einen Spieler oder „Alle Spieler“.', false); return paint(); }
        if (sel === ALL) { try { await call('broadcast', { text }); say('Nachricht an alle Spieler gesendet'); } catch { return; } return paint(); }
        return send({ type: 'message', text }, 'Nachricht');
      }
      case 'inspect': {
        try {
          const d = await call('inspect', { target: sel });
          info = `Name: ${d.name}\nKekse: ${fmt(d.cookies || 0)} · gebacken (Runde): ${fmt(d.total || 0)} · früher: ${fmt(d.totalReset || 0)}\nKlicks: ${fmt(d.clicks || 0)} · goldene Kekse: ${d.golden || 0}\nGebäude: ${(d.owned || []).map((n, i) => n ? `${BUILDINGS[i].name} ${n}` : '').filter(Boolean).join(', ') || '–'}\nUpgrades: ${d.upgrades}/400000 · Erfolge: ${d.achievements}\nAufstiege: ${d.ascensions || 0} · Chips: ${d.chipsEarned || 0} (ausgegeben ${d.chipsSpent || 0})\nLetzte Speicherung: ${new Date(d.lastSave).toLocaleString('de-DE')}${d.banned ? '\n🚫 GESPERRT' : ''}`;
        } catch { return; }
        return paint();
      }
      case 'ban': {
        const p = players.find((x) => x.id === sel);
        try { await call('ban', { target: sel, banned: !p.banned }); say(p.banned ? `${p.name} entsperrt` : `${p.name} gesperrt`); await refresh(); } catch { return; }
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
