import { API_URL } from '../config.js';

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Name -> Konto-ID, Passwort -> geheimer Schlüssel (PBKDF2). Das Passwort verlässt nie den Browser.
export async function derive(name, password) {
  const enc = new TextEncoder();
  const lower = name.trim().toLowerCase();
  const id = hex(await crypto.subtle.digest('SHA-256', enc.encode('id:' + lower))).slice(0, 16);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('cookie-clicker:' + lower), iterations: 100000 }, key, 128);
  return { id, secret: hex(bits) };
}

async function req(path, opts) {
  if (!API_URL) throw new Error('Cloud-API nicht konfiguriert');
  let r;
  try { r = await fetch(API_URL + path, opts); } catch { throw new Error('Server nicht erreichbar'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `Fehler ${r.status}`); e.status = r.status; e.data = j; throw e; }
  return j;
}
const post = (path, method, body, extra = {}) => req(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...extra });

export const cloud = {
  enabled: !!API_URL,
  get id() { return ls.get('cc_id'); },
  get secret() { return ls.get('cc_secret'); },
  get name() { return ls.get('cc_name') || ''; },
  get loggedIn() { return !!(this.enabled && this.id && this.secret); },

  // Anmelden oder (falls der Name neu ist) registrieren.
  async login(name, password) {
    name = name.trim();
    if (name.length < 2 || name.length > 16) throw new Error('Name: 2–16 Zeichen');
    if (password.length < 4) throw new Error('Passwort: mindestens 4 Zeichen');
    const { id, secret } = await derive(name, password);
    let result;
    try { result = { isNew: false, data: (await post('/api/load', 'POST', { id, secret })).data }; }
    catch (e) { if (e.status === 404) result = { isNew: true }; else throw e; }
    ls.set('cc_id', id); ls.set('cc_secret', secret); ls.set('cc_name', name);
    return result;
  },
  logout() { ls.del('cc_id'); ls.del('cc_secret'); ls.del('cc_name'); },

  save(data, score, keepalive = false, setup) {
    return post('/api/save', 'PUT', { id: this.id, secret: this.secret, name: this.name, data, score, setup }, { keepalive });
  },
  events(since) { return post('/api/events', 'POST', { id: this.id, secret: this.secret, since }); },
  admin(action, extra = {}) { return post('/api/admin', 'POST', { id: this.id, secret: this.secret, action, ...extra }); },
  load() { return post('/api/load', 'POST', { id: this.id, secret: this.secret }); },
  chat() { return req('/api/chat'); },
  chatSend(text) { return post('/api/chat/send', 'POST', { id: this.id, secret: this.secret, text }); },
  leaderboard() { return req('/api/leaderboard'); },
};
