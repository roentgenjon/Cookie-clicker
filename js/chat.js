// Chat: allgemeiner Chat für alle + private 1:1-Chats (Seitenleiste). Abruf per Polling.
import { cloud } from './cloud.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const time = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export function createChat({ toast, isAdmin, onUnread, onNotify = () => {} }) {
  let primedG = false; let primedC = false;
  let msgs = []; // allgemeiner Chat
  const dmMsgs = {}; // id des anderen Spielers -> Nachrichten
  let convs = []; // private Chats: { id, name, last, lastFrom, lastText }
  let active = 'global';
  let open = false; let body = null; let timers = [];
  let seen = Number(ls.get('cc_chat_seen')) || 0;
  let dmSeen = {}; try { dmSeen = JSON.parse(ls.get('cc_dm_seen') || '{}'); } catch { dmSeen = {}; }
  let busy = false; let picking = false;

  const myId = () => cloud.id;
  const mineGlobal = (m) => cloud.loggedIn && m.n === cloud.name;
  const globalUnread = () => msgs.filter((m) => m.i > seen && !mineGlobal(m)).length;
  const convUnread = (c) => !!c.last && c.lastFrom && c.lastFrom !== myId() && c.last > (dmSeen[c.id] || 0);
  const totalUnread = () => globalUnread() + convs.filter(convUnread).length;
  const refreshBadge = () => onUnread(totalUnread());

  function markSeen() {
    if (active === 'global') { if (msgs.length) { seen = Math.max(seen, msgs[msgs.length - 1].i); ls.set('cc_chat_seen', String(seen)); } }
    else { const c = convs.find((x) => x.id === active); const l = dmMsgs[active] || []; const t = Math.max(c ? c.last || 0 : 0, l.length ? l[l.length - 1].t : 0); dmSeen[active] = t; ls.set('cc_dm_seen', JSON.stringify(dmSeen)); }
    refreshBadge(); paintSide();
  }

  // ---------- Nachrichtenliste (nur neue Nachrichten anhängen, Scrollposition bleibt) ----------
  const nearBottom = (list) => list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  const toBottom = (list) => { list.scrollTop = list.scrollHeight; setTimeout(() => { list.scrollTop = list.scrollHeight; }, 60); };
  function msgEl(m) {
    const el = document.createElement('div'); const g = active === 'global';
    const mine = g ? mineGlobal(m) : m.f === myId();
    el.className = 'cm' + (mine ? ' me' : ''); el.dataset.mid = m.i;
    const who = g ? `<b class="${m.a ? 'adm' : ''}">${m.a ? '🛡️ ' : ''}${esc(m.n)}</b>` : `<b>${mine ? 'Du' : esc((convs.find((c) => c.id === active) || {}).name || '?')}</b>`;
    el.innerHTML = `<div class="cm-h">${who}<span>${time(m.t)}</span>${g && isAdmin() ? `<button class="cm-del" data-mid="${m.i}" title="Nachricht löschen">🗑️</button>` : ''}</div><div class="cm-t">${esc(m.x)}</div>`;
    return el;
  }
  const current = () => (active === 'global' ? msgs : dmMsgs[active] || []);
  function paintList(force = false) {
    if (!body) return;
    const list = body.querySelector('#chatList'); if (!list) return;
    const list0 = current();
    const wasNear = nearBottom(list) || list.dataset.init !== '1';
    const have = new Map([...list.querySelectorAll('.cm')].map((e) => [e.dataset.mid, e]));
    const ids = new Set(list0.map((m) => String(m.i)));
    for (const [id, e] of have) if (!ids.has(id)) { e.remove(); have.delete(id); }
    list.querySelector('.adm-empty')?.remove();
    let prev = null; let addedOthers = 0;
    for (const m of list0) {
      let e = have.get(String(m.i));
      if (!e) { e = msgEl(m); if (prev) prev.after(e); else list.prepend(e); if (!(active === 'global' ? mineGlobal(m) : m.f === myId())) addedOthers++; }
      prev = e;
    }
    if (!list0.length) list.innerHTML = `<div class="adm-empty">${active === 'global' ? 'Noch keine Nachrichten. Schreib die erste! 👋' : 'Noch keine Nachrichten. Sag Hallo! 👋'}</div>`;
    const pill = body.querySelector('#chatNew');
    if (force || wasNear) { toBottom(list); pill?.classList.add('hidden'); }
    else if (addedOthers && pill) { pill.textContent = `⬇ ${addedOthers} neue Nachricht${addedOthers > 1 ? 'en' : ''}`; pill.classList.remove('hidden'); }
    list.dataset.init = '1';
  }

  // ---------- Seitenleiste ----------
  function paintSide() {
    if (!body) return;
    const side = body.querySelector('#csList'); if (!side) return;
    const gUn = globalUnread();
    side.innerHTML = `<button class="cs-item ${active === 'global' ? 'active' : ''}" data-c="global"><span class="cs-ic">🌍</span><span class="cs-n">Allgemein</span>${gUn && active !== 'global' ? `<span class="badge">${gUn > 9 ? '9+' : gUn}</span>` : ''}</button>`
      + (cloud.loggedIn ? convs.map((c) => `<button class="cs-item ${active === c.id ? 'active' : ''}" data-c="${c.id}"><span class="cs-ic">👤</span><span class="cs-n">${esc(c.name)}${c.lastText ? `<small>${c.lastFrom === myId() ? 'Du: ' : ''}${esc(c.lastText)}</small>` : ''}</span>${convUnread(c) && active !== c.id ? '<span class="dotu"></span>' : ''}</button>`).join('') : '');
  }
  function paintHeader() {
    if (!body) return;
    const t = body.querySelector('#chatTitle'); if (!t) return;
    const c = convs.find((x) => x.id === active);
    t.textContent = active === 'global' ? '🌍 Allgemeiner Chat (für alle)' : `🔒 Privater Chat mit ${c ? c.name : '…'}`;
    const inp = body.querySelector('#chatIn'); if (inp) inp.placeholder = active === 'global' ? 'Nachricht an alle…' : `Nachricht an ${c ? c.name : '…'}…`;
  }

  // ---------- Abruf ----------
  async function pollGlobal() {
    if (!cloud.enabled) return;
    try {
      const r = await cloud.chat();
      const changed = JSON.stringify(r.messages.map((m) => m.i)) !== JSON.stringify(msgs.map((m) => m.i));
      if (primedG) {
        const top = msgs.length ? msgs[msgs.length - 1].i : 0;
        const fresh = r.messages.filter((m) => m.i > top && !mineGlobal(m));
        if (fresh.length && !(open && active === 'global')) { const m = fresh[fresh.length - 1]; onNotify({ title: '🌍 ' + m.n, text: m.x, more: fresh.length - 1 }); }
      }
      primedG = true;
      msgs = r.messages;
      if (open && active === 'global') { if (changed) paintList(); markSeen(); } else { refreshBadge(); paintSide(); }
    } catch { /* offline: später wieder */ }
  }
  async function pollConvs() {
    if (!cloud.loggedIn) { convs = []; return; }
    try {
      const nc = (await cloud.dmList()).convs;
      if (primedC) {
        for (const c of nc) {
          const old = convs.find((x) => x.id === c.id);
          if (c.last && c.lastFrom && c.lastFrom !== myId() && c.last > (old ? old.last || 0 : 0) && c.last > (dmSeen[c.id] || 0) && !(open && active === c.id)) onNotify({ title: '💬 ' + c.name, text: c.lastText || 'Neue Nachricht', id: c.id });
        }
      }
      primedC = true; convs = nc; refreshBadge(); if (open) { paintSide(); paintHeader(); } } catch { /* ignore */ }
  }
  async function pollActive() {
    if (!open || active === 'global' || !cloud.loggedIn) return;
    const id = active;
    try {
      const r = await cloud.dmGet(id);
      const changed = JSON.stringify(r.messages.map((m) => m.i)) !== JSON.stringify((dmMsgs[id] || []).map((m) => m.i));
      dmMsgs[id] = r.messages;
      if (active === id) { if (changed) paintList(); markSeen(); }
    } catch { /* ignore */ }
  }

  async function send(text) {
    if (busy) return false; busy = true;
    try {
      if (active === 'global') { await cloud.chatSend(text); await pollGlobal(); }
      else { await cloud.dmSend(active, text); await pollActive(); await pollConvs(); }
      paintList(true); return true;
    } catch (e) { toast(`💬 ${esc(e.message)}`); return false; } finally { busy = false; }
  }

  async function openConv(id) {
    active = id; paintSide(); paintHeader();
    const list = body && body.querySelector('#chatList'); if (list) { list.innerHTML = ''; list.dataset.init = ''; }
    body?.querySelector('#chatNew')?.classList.add('hidden');
    paintList(true);
    if (id === 'global') await pollGlobal(); else await pollActive();
    paintList(true); markSeen();
    body?.querySelector('#chatIn')?.focus();
  }

  // Neuer privater Chat: Spieler auswählen
  async function startPicker() {
    const box = body.querySelector('#csNew'); picking = !picking;
    if (!picking) { box.innerHTML = ''; return; }
    box.innerHTML = '<form id="csForm" class="cs-form"><input type="text" id="csName" list="csPlayers" maxlength="16" placeholder="Spielername" autocomplete="off"><datalist id="csPlayers"></datalist><button type="submit">Chat starten</button><div class="note" id="csMsg"></div></form>';
    cloud.players().then((r) => { const dl = box.querySelector('#csPlayers'); if (dl) dl.innerHTML = r.players.filter((n) => n !== cloud.name).map((n) => `<option value="${esc(n)}">`).join(''); }).catch(() => {});
    box.querySelector('#csName').focus();
    box.querySelector('#csForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const name = box.querySelector('#csName').value.trim(); const msg = box.querySelector('#csMsg'); if (!name) return;
      try { const r = await cloud.dmOpen(name); await pollConvs(); picking = false; box.innerHTML = ''; await openConv(r.with); }
      catch (err) { msg.textContent = '❌ ' + err.message; }
    });
  }

  return {
    start() { pollGlobal(); pollConvs(); timers.push(setInterval(() => { if (!open) { pollGlobal(); pollConvs(); } }, 15000)); },
    render(el, setTitle) {
      setTitle('💬 Chat'); body = el; open = true;
      el.closest('dialog')?.classList.add('wide');
      const can = cloud.loggedIn;
      el.innerHTML = `<div class="chat2">
        <aside class="chat-side">${can ? '<button type="button" id="dmNew" class="cs-new">➕ Privater Chat</button><div id="csNew"></div>' : ''}<div id="csList" class="cs-list"></div></aside>
        <section class="chat-main"><div class="cm-title" id="chatTitle"></div>
          <div class="chat-wrap"><div class="chat-list" id="chatList"></div><button type="button" id="chatNew" class="chat-new hidden"></button></div>
          ${can ? '<form class="chat-form" id="chatForm"><input type="text" id="chatIn" maxlength="200" autocomplete="off"><button type="submit">Senden</button></form>' : '<div class="note chat-login">Melde dich unter „☁️ Anmelden“ an, um mitzuschreiben und private Chats zu führen. Lesen kann jeder.</div>'}</section></div>`;
      active = 'global'; picking = false; paintSide(); paintHeader(); paintList(true); markSeen();
      const listEl = el.querySelector('#chatList');
      listEl.addEventListener('scroll', () => { const pill = el.querySelector('#chatNew'); if (pill && nearBottom(listEl)) pill.classList.add('hidden'); }, { passive: true });
      el.querySelector('#chatNew').addEventListener('click', () => { toBottom(listEl); el.querySelector('#chatNew').classList.add('hidden'); });
      el.querySelector('#csList').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b && b.dataset.c !== active) openConv(b.dataset.c); });
      el.querySelector('#dmNew')?.addEventListener('click', startPicker);
      timers.forEach(clearInterval); timers = [];
      timers.push(setInterval(() => { if (active === 'global') pollGlobal(); else pollActive(); }, 5000));
      timers.push(setInterval(pollConvs, 10000));
      pollGlobal(); pollConvs();
      el.querySelector('#chatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const inp = el.querySelector('#chatIn'); const t = inp.value.trim(); if (!t) return;
        if (await send(t)) inp.value = '';
        inp.focus();
      });
      listEl.addEventListener('click', async (e) => {
        const b = e.target.closest('.cm-del'); if (!b) return;
        try { await cloud.admin('chatDel', { mid: Number(b.dataset.mid) }); msgs = msgs.filter((m) => String(m.i) !== b.dataset.mid); paintList(); } catch (err) { toast(`❌ ${esc(err.message)}`); }
      });
    },
    close() { open = false; body = null; timers.forEach(clearInterval); timers = [setInterval(() => { pollGlobal(); pollConvs(); }, 15000)]; },
  };
}
