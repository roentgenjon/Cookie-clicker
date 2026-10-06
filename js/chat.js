// Gemeinsamer Chat: Nachrichten kommen vom Worker (letzte 50), Abruf per Polling.
import { cloud } from './cloud.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
const time = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export function createChat({ toast, isAdmin, onUnread }) {
  let msgs = []; let open = false; let body = null; let timer = null; let seen = Number(ls.get('cc_chat_seen')) || 0; let busy = false;
  const mine = (m) => cloud.loggedIn && m.n === cloud.name;
  const unread = () => msgs.filter((m) => m.i > seen && !mine(m)).length;

  function markSeen() { if (msgs.length) { seen = Math.max(seen, msgs[msgs.length - 1].i); ls.set('cc_chat_seen', String(seen)); } onUnread(0); }

  // Eine Nachricht als Element (nur neue werden angehängt, vorhandene bleiben unverändert -> Scrollposition bleibt)
  function msgEl(m) {
    const el = document.createElement('div'); el.className = 'cm' + (mine(m) ? ' me' : ''); el.dataset.mid = m.i;
    el.innerHTML = `<div class="cm-h"><b class="${m.a ? 'adm' : ''}">${m.a ? '🛡️ ' : ''}${esc(m.n)}</b><span>${time(m.t)}</span>${isAdmin() ? `<button class="cm-del" data-mid="${m.i}" title="Nachricht löschen">🗑️</button>` : ''}</div><div class="cm-t">${esc(m.x)}</div>`;
    return el;
  }
  const nearBottom = (list) => list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  const toBottom = (list) => { list.scrollTop = list.scrollHeight; setTimeout(() => { list.scrollTop = list.scrollHeight; }, 60); }; // 2. Mal: nach dem Layout (iPad)
  function updatePill(list) { const pill = body && body.querySelector('#chatNew'); if (pill && nearBottom(list)) pill.classList.add('hidden'); }

  // force = true: immer nach unten (eigene Nachricht, erstes Öffnen)
  function paintList(force = false) {
    if (!body) return;
    const list = body.querySelector('#chatList'); if (!list) return;
    const wasNear = nearBottom(list) || list.dataset.init !== '1';
    const have = new Map([...list.querySelectorAll('.cm')].map((e) => [e.dataset.mid, e]));
    const ids = new Set(msgs.map((m) => String(m.i)));
    for (const [id, e] of have) if (!ids.has(id)) { e.remove(); have.delete(id); } // gelöschte Nachrichten
    list.querySelector('.adm-empty')?.remove();
    let prev = null; let added = 0; let addedOthers = 0;
    for (const m of msgs) {
      let e = have.get(String(m.i));
      if (!e) { e = msgEl(m); if (prev) prev.after(e); else list.prepend(e); added++; if (!mine(m)) addedOthers++; }
      prev = e;
    }
    if (!msgs.length) list.innerHTML = '<div class="adm-empty">Noch keine Nachrichten. Schreib die erste! 👋</div>';
    const pill = body.querySelector('#chatNew');
    if (force || wasNear) { toBottom(list); pill?.classList.add('hidden'); }
    else if (addedOthers && pill) { pill.textContent = `⬇ ${addedOthers} neue Nachricht${addedOthers > 1 ? 'en' : ''}`; pill.classList.remove('hidden'); }
    list.dataset.init = '1';
  }

  async function poll() {
    if (!cloud.enabled) return;
    try {
      const r = await cloud.chat();
      const changed = JSON.stringify(r.messages.map((m) => m.i)) !== JSON.stringify(msgs.map((m) => m.i));
      msgs = r.messages;
      if (open) { if (changed) paintList(); markSeen(); } else onUnread(unread());
    } catch { /* offline: später wieder */ }
  }

  async function send(text) {
    if (busy) return; busy = true;
    try { await cloud.chatSend(text); await poll(); paintList(true); return true; }
    catch (e) { toast(`💬 ${esc(e.message)}`); return false; }
    finally { busy = false; }
  }

  return {
    start() { poll(); setInterval(() => { if (!open) poll(); }, 30000); },
    render(el, setTitle) {
      setTitle('💬 Chat'); body = el; open = true;
      const can = cloud.loggedIn;
      el.innerHTML = `<div class="chat"><div class="chat-wrap"><div class="chat-list" id="chatList"></div><button type="button" id="chatNew" class="chat-new hidden"></button></div>
        ${can ? '<form class="chat-form" id="chatForm"><input type="text" id="chatIn" maxlength="200" placeholder="Nachricht schreiben…" autocomplete="off"><button type="submit">Senden</button></form>' : '<div class="note chat-login">Melde dich unter „☁️ Anmelden“ an, um mitzuschreiben. Lesen kann jeder.</div>'}</div>`;
      paintList(true); markSeen();
      const listEl = el.querySelector('#chatList');
      listEl.addEventListener('scroll', () => updatePill(listEl), { passive: true });
      el.querySelector('#chatNew').addEventListener('click', () => { toBottom(listEl); el.querySelector('#chatNew').classList.add('hidden'); });
      clearInterval(timer); timer = setInterval(poll, 6000); poll();
      el.querySelector('#chatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const inp = el.querySelector('#chatIn'); const t = inp.value.trim(); if (!t) return;
        if (await send(t)) { inp.value = ''; }
        inp.focus();
      });
      el.querySelector('#chatList').addEventListener('click', async (e) => {
        const b = e.target.closest('.cm-del'); if (!b) return;
        try { await cloud.admin('chatDel', { mid: Number(b.dataset.mid) }); msgs = msgs.filter((m) => String(m.i) !== b.dataset.mid); paintList(); } catch (err) { toast(`❌ ${esc(err.message)}`); }
      });
    },
    close() { open = false; body = null; clearInterval(timer); timer = null; },
  };
}
