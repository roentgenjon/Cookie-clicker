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

  function paintList() {
    if (!body) return;
    const list = body.querySelector('#chatList'); if (!list) return;
    const near = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = msgs.length ? msgs.map((m) => `<div class="cm ${mine(m) ? 'me' : ''}"><div class="cm-h"><b class="${m.a ? 'adm' : ''}">${m.a ? '🛡️ ' : ''}${esc(m.n)}</b><span>${time(m.t)}</span>${isAdmin() ? `<button class="cm-del" data-mid="${m.i}" title="Nachricht löschen">🗑️</button>` : ''}</div><div class="cm-t">${esc(m.x)}</div></div>`).join('') : '<div class="adm-empty">Noch keine Nachrichten. Schreib die erste! 👋</div>';
    if (near || list.dataset.init !== '1') { list.scrollTop = list.scrollHeight; list.dataset.init = '1'; }
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
    try { await cloud.chatSend(text); await poll(); paintList(); return true; }
    catch (e) { toast(`💬 ${esc(e.message)}`); return false; }
    finally { busy = false; }
  }

  return {
    start() { poll(); setInterval(() => { if (!open) poll(); }, 30000); },
    render(el, setTitle) {
      setTitle('💬 Chat'); body = el; open = true;
      const can = cloud.loggedIn;
      el.innerHTML = `<div class="chat"><div class="chat-list" id="chatList"></div>
        ${can ? '<form class="chat-form" id="chatForm"><input type="text" id="chatIn" maxlength="200" placeholder="Nachricht schreiben…" autocomplete="off"><button type="submit">Senden</button></form>' : '<div class="note chat-login">Melde dich unter „☁️ Anmelden“ an, um mitzuschreiben. Lesen kann jeder.</div>'}</div>`;
      paintList(); markSeen();
      clearInterval(timer); timer = setInterval(poll, 4000); poll();
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
