// Freundesliste: nur auf diesem Gerät gespeichert (localStorage). Freunde erscheinen im Geschenk-Fenster und beim Starten eines privaten Chats.
const KEY = 'cc_friends';
const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((n) => typeof n === 'string').slice(0, 100) : []; } catch { return []; } };
const write = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* egal */ } };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const friends = {
  list: () => read(),
  has: (name) => read().some((n) => n.toLowerCase() === String(name).toLowerCase()),
  toggle(name) {
    const a = read(); const i = a.findIndex((n) => n.toLowerCase() === String(name).toLowerCase());
    if (i >= 0) a.splice(i, 1); else a.push(String(name)); write(a); return i < 0;
  },
  // Knöpfe mit allen Freunden; Klick trägt den Namen in das Eingabefeld ein
  chipsHtml: () => { const a = read(); return a.length ? `<div class="fr-chips"><span class="note">⭐ Freunde:</span>${a.map((n) => `<button type="button" class="fr-chip" data-fr="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : '<div class="note fr-hint">⭐ Tipp: Im privaten Chat kannst du Spieler mit dem Stern zu deinen Freunden machen.</div>'; },
  bind(root, input) { root.querySelectorAll('[data-fr]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.fr; input.dispatchEvent(new Event('input')); input.focus(); })); },
};
