import { API_URL } from '../config.js';

const rnd = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n / 2)), (b) => b.toString(16).padStart(2, '0')).join('');
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export const cloud = {
  enabled: !!API_URL,
  get id() { let v = ls.get('cc_id'); if (!v) { v = rnd(16); ls.set('cc_id', v); } return v; },
  get secret() { let v = ls.get('cc_secret'); if (!v) { v = rnd(32); ls.set('cc_secret', v); } return v; },
  get code() { return `${this.id}-${this.secret}`; },
  setCode(code) {
    const m = /^([a-f0-9]{16})-([a-f0-9]{32})$/.exec(code.trim());
    if (!m) throw new Error('Ungültiger Account-Code');
    ls.set('cc_id', m[1]); ls.set('cc_secret', m[2]);
  },
  async _req(path, opts) {
    if (!API_URL) throw new Error('Cloud-API nicht konfiguriert');
    const r = await fetch(API_URL + path, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Fehler ${r.status}`);
    return j;
  },
  save(name, data, score) {
    return this._req('/api/save', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: this.id, secret: this.secret, name, data, score }) });
  },
  load() {
    return this._req('/api/load', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: this.id, secret: this.secret }) });
  },
  leaderboard() { return this._req('/api/leaderboard'); },
};
