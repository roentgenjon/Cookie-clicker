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

export async function renderAdmin(body, { fmt, toast, title }) {
  title('🛡️ Admin-Panel');
  body.innerHTML = '<div class="adm" id="adm">Lade…</div>';
  const root = body.querySelector('#adm');
  let players = []; let sel = null; let mode = 'one'; let q = ''; let stats = null; let note = ''; let info = '';
  const $ = (s) => root.querySelector(s);
  const val = (s) => $(s).value;

  async function call(action, extra) {
    try { return await cloud.admin(action, extra); } catch (e) { note = '❌ ' + e.message; paint(); throw e; }
  }
  async function refresh() {
    try {
      const [p, s] = await Promise.all([cloud.admin('players'), cloud.admin('stats')]);
      players = p.players; stats = s; now = p.now;
    } catch (e) { root.textContent = '❌ ' + e.message + ' – (Worker aktuell? Nur Admins haben Zugriff)'; return false; }
    return true;
  }
  let now = Date.now();

  async function send(event, label) {
    try {
      if (mode === 'all') {
        if (event.type === 'upgrades' && event.mode === 'none' && !confirm('Wirklich bei ALLEN Spielern alle Upgrades entfernen?')) return;
        await call('broadcast', { event, text: '' });
        note = `✔ ${label} → ALLE Spieler (kommt beim nächsten Abruf an)`;
      } else {
        if (!sel) { note = '⚠️ Erst einen Spieler auswählen'; return paint(); }
        await call('event', { target: sel, event });
        note = `✔ ${label} → ${nameOf(sel)}`;
      }
      toast(note);
    } catch { return; }
    paint();
  }
  const nameOf = (id) => (players.find((p) => p.id === id) || {}).name || id;

  function paint() {
    const keep = {}; root.querySelectorAll('input[id],select[id]').forEach((el) => { keep[el.id] = el.value; });
    const f = q.trim().toLowerCase();
    const list = players.filter((p) => !f || p.name.toLowerCase().includes(f));
    const cur = players.find((p) => p.id === sel);
    root.innerHTML = `
      <div class="kv"><span>Spieler / online / gesperrt</span><span>${stats.players} / ${stats.online} / ${stats.banned}</span><span>Gebacken (Summe)</span><span>${fmt(stats.totalCookies)}</span></div>
      <div class="rowf"><input type="text" id="q" placeholder="Spieler suchen…" value="${esc(q)}"><button id="reload">🔄</button></div>
      <div class="adm-list">${list.map((p) => `<div class="adm-row ${p.id === sel ? 'sel' : ''}" data-id="${p.id}"><span class="dot ${now - p.updated < 120000 ? 'on' : ''}"></span><span>${esc(p.name)}${p.banned ? ' 🚫' : ''}</span><span>${fmt(p.score)}</span></div>`).join('') || '<div class="adm-row">Keine Spieler</div>'}</div>
      <label>Ziel der Aktionen<select id="tMode"><option value="one" ${mode === 'one' ? 'selected' : ''}>${cur ? 'Ausgewählter Spieler: ' + esc(cur.name) : 'Ausgewählter Spieler (keiner gewählt)'}</option><option value="all" ${mode === 'all' ? 'selected' : ''}>ALLE Spieler (Rundsendung)</option></select></label>
      <div class="adm-card">
        <div class="adm-grp"><h3>⭐ Goldene Kekse (Sterne) spawnen</h3>
          <div class="rowf"><select id="gEff">${opt(EFFECTS, 'random')}</select><input type="number" id="gCnt" min="1" max="30" value="1" placeholder="Anzahl (1–30)" title="Anzahl"><button data-act="golden">Spawnen</button></div>
          <div class="rowf"><button data-act="gq" data-n="5">5× zufällig</button><button data-act="gq" data-n="15">15× zufällig</button><button data-act="gq" data-n="30">30× zufällig</button></div></div>
        <div class="adm-grp"><h3>🔥 Raserei (Boost)</h3>
          <div class="rowf"><select id="fKind"><option value="frenzy">🍪 Kekse-Raserei</option><option value="click">👆 Klick-Raserei</option></select>
          <input type="number" id="fMult" min="1" max="1000000" step="any" value="7" placeholder="Multiplikator ×" title="Multiplikator"><input type="number" id="fSec" min="1" max="3600" value="77" placeholder="Dauer in Sekunden" title="Dauer in Sekunden"></div>
          <div class="note">Multiplikator (×1–1.000.000) und Dauer (1–3600 Sekunden)</div>
          <div class="rowf"><button data-act="buff">Boost geben</button><button data-act="preset" data-k="frenzy" data-m="7" data-s="77">×7 · 77 s</button><button data-act="preset" data-k="click" data-m="777" data-s="13">Klick ×777 · 13 s</button><button data-act="preset" data-k="frenzy" data-m="100" data-s="600">×100 · 10 min</button></div></div>
        <div class="adm-grp"><h3>🍪 Kekse & Chips</h3>
          <div class="rowf"><input type="text" id="cAmt" value="1 mio" placeholder="z. B. 1 mio, 5e9, 10k"><button data-act="cGive">Geben</button><button data-act="cTake">Abziehen</button></div>
          <div class="rowf"><input type="number" id="chAmt" min="1" value="10" placeholder="Anzahl Chips"><button data-act="chips">😇 Chips geben</button></div></div>
        <div class="adm-grp"><h3>🏭 Gebäude</h3>
          <div class="rowf"><select id="bSel">${BUILDINGS.map((b, i) => `<option value="${i}">${b.icon} ${esc(b.name)}</option>`).join('')}</select><input type="number" id="bAmt" min="1" max="100000" value="10" placeholder="Anzahl"><button data-act="building">Geben</button></div></div>
        <div class="adm-grp"><h3>🧪 Upgrades & Erfolge</h3>
          <div class="rowf"><button data-act="up" data-m="all">Alle Upgrades</button><button data-act="up" data-m="cookie">Nur Cookie-Upg.</button><button data-act="up" data-m="heaven">Nur himmlische</button><button data-act="up" data-m="none">Alle entfernen</button></div>
          <div class="rowf"><button data-act="ach">🏆 Alle Erfolge</button></div></div>
        <div class="adm-grp"><h3>💬 Nachricht</h3>
          <div class="rowf"><input type="text" id="msg" maxlength="140" placeholder="Text an den Spieler / an alle"><button data-act="msg">Senden</button></div></div>
        <div class="adm-grp"><h3>🔎 Spieler-Verwaltung (nur ausgewählter Spieler)</h3>
          <div class="rowf"><button data-act="inspect">📋 Spielstand ansehen</button><button data-act="ban">${cur && cur.banned ? '✅ Entsperren' : '🚫 Sperren'}</button><button data-act="reset" style="color:var(--bad)">♻️ Zurücksetzen</button><button data-act="del" style="color:var(--bad)">🗑️ Löschen</button></div>
          ${info ? `<pre>${esc(info)}</pre>` : ''}</div>
      </div>
      <div class="note">${esc(note)}</div>`;
    for (const [id, v] of Object.entries(keep)) { const el = root.querySelector('#' + id); if (el && id !== 'q' && id !== 'tMode') el.value = v; }
    $('#tMode').addEventListener('change', (e) => { mode = e.target.value; });
    $('#q').addEventListener('input', (e) => { q = e.target.value; const pos = e.target.selectionStart; paint(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
  }

  const intIn = (s, min, max, def) => { const n = Math.floor(Number(val(s))); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  root.addEventListener('click', async (e) => {
    const row = e.target.closest('.adm-row[data-id]');
    if (row) { sel = row.dataset.id; info = ''; return paint(); }
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.id === 'reload') { await refresh(); return paint(); }
    const act = btn.dataset.act; if (!act) return;
    switch (act) {
      case 'golden': return send({ type: 'golden', effect: val('#gEff'), count: intIn('#gCnt', 1, 30, 1) }, `${intIn('#gCnt', 1, 30, 1)}× Sterne`);
      case 'gq': return send({ type: 'golden', effect: 'random', count: +btn.dataset.n }, `${btn.dataset.n}× Sterne`);
      case 'buff': {
        const mult = Number(val('#fMult')), seconds = intIn('#fSec', 1, 3600, 60);
        if (!(mult >= 1 && mult <= 1e6)) { note = '⚠️ Multiplikator muss zwischen 1 und 1.000.000 liegen'; return paint(); }
        return send({ type: 'buff', kind: val('#fKind'), mult, seconds }, `${val('#fKind') === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${mult} · ${seconds} s`);
      }
      case 'preset': return send({ type: 'buff', kind: btn.dataset.k, mult: +btn.dataset.m, seconds: +btn.dataset.s }, `${btn.dataset.k === 'click' ? 'Klick' : 'Kekse'}-Raserei ×${btn.dataset.m}`);
      case 'cGive': case 'cTake': {
        const n = parseNum(val('#cAmt')); if (!Number.isFinite(n) || n <= 0) { note = '⚠️ Ungültige Zahl'; return paint(); }
        return send({ type: 'cookies', amount: act === 'cGive' ? n : -n }, `${act === 'cGive' ? '+' : '−'}${fmt(n)} Kekse`);
      }
      case 'chips': return send({ type: 'chips', amount: intIn('#chAmt', 1, 1e9, 1) }, `${intIn('#chAmt', 1, 1e9, 1)} Chips`);
      case 'building': return send({ type: 'building', b: intIn('#bSel', 0, 14, 0), amount: intIn('#bAmt', 1, 100000, 1) }, `${intIn('#bAmt', 1, 100000, 1)}× ${BUILDINGS[intIn('#bSel', 0, 14, 0)].name}`);
      case 'up': return send({ type: 'upgrades', mode: btn.dataset.m }, `Upgrades (${btn.dataset.m})`);
      case 'ach': return send({ type: 'achievements' }, 'Alle Erfolge');
      case 'msg': {
        const text = val('#msg').trim(); if (!text) return;
        if (mode === 'all') { try { await call('broadcast', { text }); note = '✔ Nachricht an ALLE gesendet'; } catch { return; } return paint(); }
        return send({ type: 'message', text }, 'Nachricht');
      }
      case 'inspect': {
        if (!sel) { note = '⚠️ Erst einen Spieler auswählen'; return paint(); }
        try {
          const d = await call('inspect', { target: sel });
          info = `Name: ${d.name}\nKekse: ${fmt(d.cookies || 0)} · gebacken (Runde): ${fmt(d.total || 0)} · früher: ${fmt(d.totalReset || 0)}\nKlicks: ${fmt(d.clicks || 0)} · goldene Kekse: ${d.golden || 0}\nGebäude: ${(d.owned || []).map((n, i) => n ? `${BUILDINGS[i].name} ${n}` : '').filter(Boolean).join(', ') || '–'}\nUpgrades: ${d.upgrades}/400000 · Erfolge: ${d.achievements}\nAufstiege: ${d.ascensions || 0} · Chips: ${d.chipsEarned || 0} (ausgegeben ${d.chipsSpent || 0})\nLetzte Speicherung: ${new Date(d.lastSave).toLocaleString('de-DE')}${d.banned ? '\n🚫 GESPERRT' : ''}`;
        } catch { return; }
        return paint();
      }
      case 'ban': {
        if (!sel) return;
        const p = players.find((x) => x.id === sel);
        try { await call('ban', { target: sel, banned: !p.banned }); note = p.banned ? '✔ Entsperrt' : '✔ Gesperrt'; await refresh(); } catch { return; }
        return paint();
      }
      case 'reset': {
        if (!sel) { note = '⚠️ Erst einen Spieler auswählen'; return paint(); }
        if (!confirm(`Spielstand von ${nameOf(sel)} wirklich zurücksetzen?`)) return;
        try { await call('event', { target: sel, event: { type: 'reset' } }); note = '✔ Zurücksetzen angeordnet'; } catch { return; }
        return paint();
      }
      case 'del': {
        if (!sel) { note = '⚠️ Erst einen Spieler auswählen'; return paint(); }
        if (!confirm(`Konto „${nameOf(sel)}“ endgültig löschen?`)) return;
        try { await call('delete', { target: sel }); note = '✔ Gelöscht'; sel = null; info = ''; await refresh(); } catch { return; }
        return paint();
      }
      default:
    }
  });

  if (await refresh()) paint();
}
