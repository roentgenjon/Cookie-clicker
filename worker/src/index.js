// Cloudflare Worker: Cloud-Saves, Rangliste, Ereignis-Warteschlange und Admin-API (KV "SAVES").
const MAX_DATA = 120000; // Spielstand mit 400.000 Upgrades (komprimiert, im Extremfall ~70.000 Zeichen)
const ID_RE = /^[a-f0-9]{16}$/;
const SECRET_RE = /^[a-f0-9]{32}$/;

const cors = (env) => ({
  'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
});
const json = (env, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(env) } });
const fail = (env, error, status = 400, extra = {}) => json(env, { error, ...extra }, status);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const cleanName = (n) => String(n || 'Anonym').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Anonym';
const rid = () => crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

// ---- Admins: Namen aus env.ADMINS, ID = sha256('id:'+name).slice(0,16) (wie im Client) ----
async function superMap(env) { // feste Admins aus env.ADMINS (dürfen weitere Admins ernennen)
  const map = {};
  for (const n of (env.ADMINS || '').split(',').map((x) => x.trim()).filter(Boolean)) map[(await sha256('id:' + n.toLowerCase())).slice(0, 16)] = n;
  return map;
}
async function adminMap(env) { // feste + ernannte Admins
  return { ...((await env.SAVES.get('admins', 'json')) || {}), ...(await superMap(env)) };
}
const nameToId = async (name) => (await sha256('id:' + String(name).trim().toLowerCase())).slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);

// Brute-Force-Schutz
async function tooManyFails(env, id) { return Number(await env.SAVES.get('f:' + id)) >= 10; }
async function addFail(env, id) { await env.SAVES.put('f:' + id, String(Number(await env.SAVES.get('f:' + id)) + 1), { expirationTtl: 600 }); }

// Prüft id+secret. Gibt { rec } (rec kann null sein, wenn noch nicht registriert) oder { err } zurück.
async function authenticate(env, b, { allowNew = false } = {}) {
  if (!b || !ID_RE.test(b.id) || !SECRET_RE.test(b.secret)) return { err: fail(env, 'Ungültige Zugangsdaten') };
  if (await tooManyFails(env, b.id)) return { err: fail(env, 'Zu viele Versuche – bitte 10 Minuten warten', 429) };
  const rec = await env.SAVES.get('p:' + b.id, 'json');
  if (!rec) return allowNew ? { rec: null, hash: await sha256(b.secret) } : { err: fail(env, 'Kein Spielstand gefunden', 404) };
  const hash = await sha256(b.secret);
  if (rec.h !== hash) { await addFail(env, b.id); return { err: fail(env, 'Falsches Passwort (oder Name schon vergeben)', 403) }; }
  const ban = await env.SAVES.get('ban:' + b.id);
  if (ban) return { err: fail(env, 'Dein Konto wurde gesperrt.', 403, { banned: true, reason: ban === '1' ? '' : String(ban).slice(0, 300) }) };
  return { rec, hash };
}

// ---- erlaubte Ereignisse (für Admin → Spieler) ----
// log10 einer Zahl oder eines Textes wie "1.5e+500" (NaN bei Ungültigem); das Spiel hat keine Obergrenze
const logOf = (v) => { if (typeof v === 'number') return v > 0 ? Math.log10(v) : NaN; const t = /^\s*(\d+(?:\.\d+)?)(?:e([+-]?\d+))?\s*$/i.exec(String(v)); return t && Number(t[1]) > 0 ? Math.log10(Number(t[1])) + (t[2] ? Number(t[2]) : 0) : NaN; };
const num = (v, min, max) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null; };
function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  switch (e.type) {
    case 'golden': { const count = num(e.count, 1, 30); return ['random', 'frenzy', 'lucky', 'click', 'jackpot'].includes(e.effect) && count ? { type: 'golden', effect: e.effect, count: Math.floor(count) } : null; }
    case 'cookies': { // Menge als Zahl oder als Text wie "-1.5e+500" (Spiel ohne Obergrenze)
      if (typeof e.amount === 'string') { const t = /^\s*(-?)(\d+(?:\.\d+)?)(?:e([+-]?\d+))?\s*$/i.exec(e.amount); if (!t) return null; const ex = t[3] ? Number(t[3]) : 0; if (!(Number(t[2]) > 0) || ex > 1e300 || ex < -5) return null; return { type: 'cookies', amount: `${t[1]}${t[2]}e${t[3] ? t[3].replace(/^\+/, '') : '0'}` }; }
      const amount = num(e.amount, -1e300, 1e300); return amount === null ? null : { type: 'cookies', amount };
    }
    case 'chips': { const amount = num(e.amount, 1, 1e9); return amount ? { type: 'chips', amount: Math.floor(amount) } : null; }
    case 'building': { const b = num(e.b, 0, 14), amount = num(e.amount, 1, 100000); return b !== null && amount ? { type: 'building', b: Math.floor(b), amount: Math.floor(amount) } : null; }
    case 'buff': { const mult = num(e.mult, 1, 1e6), seconds = num(e.seconds, 1, 3600); return ['frenzy', 'click'].includes(e.kind) && mult && seconds ? { type: 'buff', kind: e.kind, mult, seconds } : null; }
    case 'achievements': return { type: 'achievements' };
    case 'upgrades': return ['all', 'cookie', 'heaven', 'none'].includes(e.mode) ? { type: 'upgrades', mode: e.mode } : null;
    case 'message': return typeof e.text === 'string' && e.text.trim() ? { type: 'message', text: e.text.replace(/[<>]/g, '').slice(0, 140) } : null;
    case 'reset': return { type: 'reset' };
    default: return null;
  }
}
async function pushEvent(env, targetId, ev, from) {
  const key = 'q:' + targetId;
  const q = (await env.SAVES.get(key, 'json')) || [];
  q.push({ ...ev, eid: rid(), from, t: Date.now() });
  await env.SAVES.put(key, JSON.stringify(q.slice(-50)), { expirationTtl: 60 * 60 * 24 * 14 });
}
const popcount = (str) => { // "r:" = Lauflängen (abwechselnd 0er/1er, Varints), "b:" = rohe Bits
  try {
    if (str.startsWith('r:')) { const bytes = Uint8Array.from(atob(str.slice(2)), (c) => c.charCodeAt(0)); let cur = 0, c = 0, i = 0; while (i < bytes.length) { let v = 0, sh = 0; while (bytes[i] & 128) { v |= (bytes[i++] & 127) << sh; sh += 7; } v |= bytes[i++] << sh; if (cur) c += v; cur ^= 1; } return c; }
    let c = 0; for (const ch of atob(str.replace(/^b:/, ''))) { let v = ch.charCodeAt(0); while (v) { c += v & 1; v >>= 1; } } return c;
  } catch { return 0; }
};

// ---- Chat: letzte 50 Nachrichten in einem KV-Schlüssel "chat" ----
const CHAT_MAX = 50;
const cleanChat = (t) => String(t || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const chatLoad = async (env) => (await env.SAVES.get('chat', 'json')) || [];
const chatSave = (env, list) => env.SAVES.put('chat', JSON.stringify(list.slice(-CHAT_MAX)));
const chatPublic = (list) => list.map(({ i, t, n, a, x }) => ({ i, t, n, a, x }));

// ---- Zeitplan: fällige Einträge werden beim nächsten Abruf eines Spielers ausgeführt ----
async function runSched(env) {
  const list = (await env.SAVES.get('sched', 'json')) || [];
  const now = Date.now(); const due = list.filter((x) => x.at <= now);
  if (!due.length) return;
  await env.SAVES.put('sched', JSON.stringify(list.filter((x) => x.at > now))); // zuerst entfernen (verhindert Doppelausführung)
  const bc = (await env.SAVES.get('bc', 'json')) || [];
  for (const x of due) if (!bc.some((y) => y.eid === x.eid)) bc.push({ t: now, text: x.text || '', event: x.event || null, from: x.from, eid: x.eid });
  await env.SAVES.put('bc', JSON.stringify(bc.slice(-10)));
}

async function listPlayers(env) {
  const list = await env.SAVES.list({ prefix: 'p:', limit: 1000 });
  const bans = new Set((await env.SAVES.list({ prefix: 'ban:', limit: 1000 })).keys.map((k) => k.name.slice(4)));
  const mutes = new Set((await env.SAVES.list({ prefix: 'mute:', limit: 1000 })).keys.map((k) => k.name.slice(5)));
  const lg = (l, v) => (Number.isFinite(l) ? l : v > 0 ? Math.log10(v) : -1); // log10-Werte für Zahlen über 1e300
  return list.keys.filter((k) => k.metadata && Number.isFinite(k.metadata.s)).map((k) => ({ id: k.name.slice(2), name: k.metadata.n, score: k.metadata.s, sl: lg(k.metadata.sl, k.metadata.s), cps: k.metadata.c || 0, cl: lg(k.metadata.cl, k.metadata.c), asc: k.metadata.a || 0, updated: k.metadata.u || 0, banned: bans.has(k.name.slice(2)), muted: mutes.has(k.name.slice(2)) }));
}

async function admin(env, b) {
  const admins = await adminMap(env);
  const au = await authenticate(env, b);
  if (au.err) return au.err;
  if (!admins[b.id]) return fail(env, 'Kein Admin', 403);
  const me = admins[b.id];
  const target = typeof b.target === 'string' && ID_RE.test(b.target) ? b.target : null;
  const needTarget = async () => (target && (await env.SAVES.get('p:' + target, 'json'))) || null;

  switch (b.action) {
    case 'whoami': return json(env, { admin: true, name: me });
    case 'players': {
      const players = (await listPlayers(env)).sort((x, y) => y.score - x.score);
      return json(env, { players, now: Date.now() });
    }
    case 'stats': {
      const players = await listPlayers(env);
      return json(env, { players: players.length, banned: players.filter((p) => p.banned).length, online: players.filter((p) => Date.now() - p.updated < 120000).length, totalCookies: players.reduce((a, p) => a + p.score, 0) });
    }
    case 'inspect': {
      const rec = await needTarget(); if (!rec) return fail(env, 'Spieler nicht gefunden', 404);
      const d = rec.data || {};
      return json(env, { name: d.name, cookies: d.cookies, total: d.total, totalReset: d.totalReset, clicks: d.clicks, golden: d.golden, owned: d.owned, upgrades: popcount(d.bought || ''), achievements: popcount(d.ach || ''), ascensions: d.ascensions, chipsEarned: d.chipsEarned, chipsSpent: d.chipsSpent, start: d.start, lastSave: rec.t, banned: !!(await env.SAVES.get('ban:' + target)) });
    }
    case 'event': {
      if (!(await needTarget())) return fail(env, 'Spieler nicht gefunden', 404);
      const ev = cleanEvent(b.event); if (!ev) return fail(env, 'Ungültiges Ereignis');
      await pushEvent(env, target, ev, me); return json(env, { ok: true });
    }
    case 'broadcast': {
      let ev = null;
      if (b.event) { ev = cleanEvent(b.event); if (!ev || ev.type === 'reset') return fail(env, 'Ungültiges Ereignis'); }
      const text = typeof b.text === 'string' ? b.text.replace(/[<>]/g, '').slice(0, 140) : '';
      if (!text && !ev) return fail(env, 'Leere Nachricht');
      const bc = (await env.SAVES.get('bc', 'json')) || [];
      bc.push({ t: Date.now(), text, event: ev, from: me, eid: rid() });
      await env.SAVES.put('bc', JSON.stringify(bc.slice(-10)));
      return json(env, { ok: true });
    }
    case 'adminList': {
      const sup = await superMap(env); if (!sup[b.id]) return fail(env, 'Nur feste Admins dürfen das', 403);
      const extra = (await env.SAVES.get('admins', 'json')) || {};
      return json(env, { fixed: Object.values(sup), extra: Object.entries(extra).filter(([id]) => !sup[id]).map(([id, name]) => ({ id, name })) });
    }
    case 'adminAdd': {
      const sup = await superMap(env); if (!sup[b.id]) return fail(env, 'Nur feste Admins dürfen das', 403);
      const id = await nameToId(b.name || '');
      const rec = await env.SAVES.getWithMetadata('p:' + id, 'text');
      if (!rec.value) return fail(env, 'Spieler nicht gefunden (er muss ein Konto haben)', 404);
      const extra = (await env.SAVES.get('admins', 'json')) || {}; extra[id] = (rec.metadata || {}).n || String(b.name);
      await env.SAVES.put('admins', JSON.stringify(extra)); return json(env, { ok: true });
    }
    case 'adminDel': {
      const sup = await superMap(env); if (!sup[b.id]) return fail(env, 'Nur feste Admins dürfen das', 403);
      const extra = (await env.SAVES.get('admins', 'json')) || {}; delete extra[target];
      await env.SAVES.put('admins', JSON.stringify(extra)); return json(env, { ok: true });
    }
    case 'schedList': return json(env, { items: ((await env.SAVES.get('sched', 'json')) || []).sort((x, y) => x.at - y.at), now: Date.now() });
    case 'schedAdd': {
      const at = Number(b.at); if (!Number.isFinite(at) || at < Date.now() - 60000 || at > Date.now() + 1000 * 60 * 60 * 24 * 60) return fail(env, 'Ungültige Zeit (max. 60 Tage in der Zukunft)');
      let ev = null; if (b.event) { ev = cleanEvent(b.event); if (!ev || ev.type === 'reset') return fail(env, 'Ungültiges Ereignis'); }
      const text = typeof b.text === 'string' ? b.text.replace(/[<>]/g, '').slice(0, 140) : '';
      if (!text && !ev) return fail(env, 'Leere Nachricht');
      const list = (await env.SAVES.get('sched', 'json')) || []; if (list.length >= 30) return fail(env, 'Maximal 30 geplante Einträge');
      list.push({ at, text, event: ev, from: me, eid: rid() }); await env.SAVES.put('sched', JSON.stringify(list)); return json(env, { ok: true });
    }
    case 'schedDel': {
      const list = (await env.SAVES.get('sched', 'json')) || [];
      await env.SAVES.put('sched', JSON.stringify(list.filter((x) => x.eid !== b.eid))); return json(env, { ok: true });
    }
    case 'chatDel': {
      const list = await chatLoad(env);
      await chatSave(env, list.filter((m) => m.i !== Number(b.mid)));
      return json(env, { ok: true });
    }
    case 'chatClear': { await env.SAVES.put('chat', '[]'); return json(env, { ok: true }); }
    case 'mute': {
      if (!(await needTarget())) return fail(env, 'Spieler nicht gefunden', 404);
      if (admins[target]) return fail(env, 'Admins können nicht stumm geschaltet werden', 403);
      const min = Math.floor(Number(b.minutes));
      if (min > 0) await env.SAVES.put('mute:' + target, '1', { expirationTtl: Math.max(60, Math.min(min, 60 * 24 * 30) * 60) }); else await env.SAVES.delete('mute:' + target);
      return json(env, { ok: true });
    }
    case 'ban': {
      if (!(await needTarget())) return fail(env, 'Spieler nicht gefunden', 404);
      if (admins[target]) return fail(env, 'Admins können nicht gesperrt werden', 403);
      const reason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 300) : '';
      if (b.banned) await env.SAVES.put('ban:' + target, reason || '1'); else await env.SAVES.delete('ban:' + target);
      return json(env, { ok: true });
    }
    case 'delete': {
      if (!(await needTarget())) return fail(env, 'Spieler nicht gefunden', 404);
      if (admins[target]) return fail(env, 'Admins können nicht gelöscht werden', 403);
      await Promise.all(['p:', 'q:', 'ban:', 'mute:', 'f:'].map((p) => env.SAVES.delete(p + target)));
      return json(env, { ok: true });
    }
    default: return fail(env, 'Unbekannte Aktion');
  }
}

// ---- Speicher: Cloudflare D1 (SQLite) mit KV-ähnlicher Schnittstelle -------------------------------
// D1 erlaubt im kostenlosen Plan 100.000 Schreibvorgänge pro Tag (KV nur 1.000). Alle anderen Funktionen
// benutzen weiter get/put/delete/list/getWithMetadata, daher bleibt die Logik unverändert.
class Store {
  constructor(db) { this.db = db; }
  async row(key) {
    const r = await this.db.prepare('SELECT v, meta, exp FROM kv WHERE k = ?1').bind(key).first();
    return r && !(r.exp && r.exp < Date.now()) ? r : null;
  }
  async get(key, type = 'text') { const r = await this.row(key); if (!r) return null; return type === 'json' ? JSON.parse(r.v) : r.v; }
  async getWithMetadata(key) { const r = await this.row(key); return { value: r ? r.v : null, metadata: r && r.meta ? JSON.parse(r.meta) : null }; }
  put(key, value, opts = {}, ifAbsent = false) {
    const exp = opts.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null; const meta = opts.metadata ? JSON.stringify(opts.metadata) : null;
    const sql = ifAbsent ? 'INSERT OR IGNORE INTO kv (k, v, meta, exp) VALUES (?1, ?2, ?3, ?4)' : 'INSERT INTO kv (k, v, meta, exp) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(k) DO UPDATE SET v = ?2, meta = ?3, exp = ?4';
    return this.db.prepare(sql).bind(key, String(value), meta, exp).run();
  }
  delete(key) { return this.db.prepare('DELETE FROM kv WHERE k = ?1').bind(key).run(); }
  async list({ prefix = '', limit = 1000 } = {}) {
    const { results } = await this.db.prepare('SELECT k, meta FROM kv WHERE substr(k, 1, length(?1)) = ?1 AND (exp IS NULL OR exp > ?2) ORDER BY k LIMIT ?3').bind(prefix, Date.now(), limit).all();
    return { keys: results.map((r) => ({ name: r.k, metadata: r.meta ? JSON.parse(r.meta) : undefined })) };
  }
}

let dbReady = false;
async function ensureDb(env) {
  if (dbReady) return;
  await env.DB.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, meta TEXT, exp INTEGER)');
  const store = new Store(env.DB);
  if (!(await store.get('_migrated'))) await migrateFromKv(env.SAVES, store); // einmalig: alte KV-Daten übernehmen
  await env.DB.prepare('DELETE FROM kv WHERE exp IS NOT NULL AND exp < ?1').bind(Date.now()).run(); // Abgelaufenes aufräumen
  dbReady = true;
}
// Kopiert alle Einträge der alten KV-Datenbank nach D1 (überschreibt nichts, was in D1 schon neuer ist)
async function migrateFromKv(kv, store) {
  if (!kv) return;
  let cursor;
  do {
    const r = await kv.list({ limit: 1000, cursor });
    for (const k of r.keys) {
      const { value, metadata } = await kv.getWithMetadata(k.name, 'text');
      if (value === null) continue;
      const ttl = k.expiration ? Math.max(60, k.expiration - Math.floor(Date.now() / 1000)) : undefined;
      await store.put(k.name, value, { metadata: metadata || undefined, expirationTtl: ttl }, true);
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  await store.put('_migrated', '1');
}

export default {
  async fetch(req, rawEnv) {
    let env = rawEnv;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/health') return json(env, { ok: true });
      await ensureDb(rawEnv);
      env = { ...rawEnv, SAVES: new Store(rawEnv.DB) };

      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const by = ['score', 'cps', 'asc'].includes(url.searchParams.get('by')) ? url.searchParams.get('by') : 'score';
        const key = by === 'score' ? 'sl' : by === 'cps' ? 'cl' : 'asc';
        const ranked = (await listPlayers(env)).filter((p) => !p.banned).sort((x, y) => y[key] - x[key]);
        const players = ranked.slice(0, 25).map((p) => ({ name: p.name, score: p.score, value: p[by], vl: key === 'asc' ? undefined : p[key] }));
        const myId = url.searchParams.get('id'); let me = null;
        if (myId && ID_RE.test(myId)) { const i = ranked.findIndex((p) => p.id === myId); if (i >= 0) me = { rank: i + 1, name: ranked[i].name, value: ranked[i][by], vl: key === 'asc' ? undefined : ranked[i][key] }; }
        return json(env, { players, me, by, total: ranked.length });
      }

      // Spielerliste (nur Namen) für Geschenke
      if (url.pathname === '/api/players' && req.method === 'GET') {
        const list = (await listPlayers(env)).filter((p) => !p.banned).sort((x, y) => y.updated - x.updated).slice(0, 300);
        return json(env, { players: list.map((p) => p.name) });
      }

      // Geschenk: Kekse an einen anderen Spieler (Betrag max. 50 % des zuletzt gespeicherten Vorrats, 5 pro Tag)
      if (url.pathname === '/api/gift' && req.method === 'POST') {
        const b = await req.json();
        const au = await authenticate(env, b);
        if (au.err) return au.err;
        const toId = await nameToId(b.to || '');
        if (toId === b.id) return fail(env, 'Du kannst dir nicht selbst etwas schenken.');
        const target = await env.SAVES.getWithMetadata('p:' + toId, 'text');
        if (!target.value) return fail(env, 'Spieler nicht gefunden', 404);
        if (await env.SAVES.get('ban:' + toId)) return fail(env, 'Dieser Spieler kann nichts empfangen.');
        const aLog = logOf(b.amount);
        if (!Number.isFinite(aLog) || aLog < 0 || aLog > 1e300) return fail(env, 'Ungültiger Betrag');
        const sLog = logOf((au.rec.data || {}).cookies);
        if (!Number.isFinite(sLog) || aLog > sLog + Math.log10(0.5) + 1e-9) return fail(env, 'Du kannst höchstens die Hälfte deiner Kekse verschenken.');
        const key = `gift:${b.id}:${today()}`; const used = Number(await env.SAVES.get(key)) || 0;
        if (used >= 5) return fail(env, 'Heute hast du schon 5 Geschenke gemacht.', 429);
        await env.SAVES.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
        const meta = (await env.SAVES.getWithMetadata('p:' + b.id, 'text')).metadata || {};
        await pushEvent(env, toId, { type: 'cookies', amount: typeof b.amount === 'string' ? b.amount.trim() : Number(b.amount), gift: true }, meta.n || 'Jemand');
        return json(env, { ok: true, left: 4 - used, to: (target.metadata || {}).n });
      }

      if (url.pathname === '/api/save' && req.method === 'PUT') {
        const b = await req.json();
        const data = JSON.stringify(b.data ?? null);
        if (data.length > MAX_DATA || data === 'null') return fail(env, 'Spielstand ungültig oder zu groß', 413);
        const au = await authenticate(env, b, { allowNew: true });
        if (au.err) return au.err;
        const admins = await adminMap(env);
        const name = cleanName(b.name);
        const reserved = Object.values(admins).map((n) => n.toLowerCase());
        if (reserved.includes(name.toLowerCase()) && !admins[b.id]) return fail(env, 'Dieser Name ist reserviert', 403);
        if (!au.rec && admins[b.id]) { // Erst-Registrierung eines Admin-Namens nur mit Setup-Code
          const ok = env.ADMIN_SETUP_HASH && typeof b.setup === 'string' && (await sha256(b.setup.trim())) === env.ADMIN_SETUP_HASH;
          if (!ok) return fail(env, 'Admin-Name: Setup-Code erforderlich', 403, { needSetup: true });
        }
        const score = Number(b.score);
        const s = Number.isFinite(score) && score > 0 ? score : 0;
        const st = b.stats || {}; const c = Number(st.cps), asc = Number(st.asc);
        await env.SAVES.put('p:' + b.id, JSON.stringify({ h: au.hash, data: b.data, t: Date.now() }), { metadata: { n: name, s, sl: Number.isFinite(Number(st.sl)) ? Math.min(1e300, Math.max(0, Number(st.sl))) : undefined, cl: Number.isFinite(Number(st.cl)) ? Math.min(1e300, Math.max(0, Number(st.cl))) : undefined, u: Date.now(), c: Number.isFinite(c) && c > 0 ? c : 0, a: Number.isFinite(asc) && asc > 0 ? Math.floor(asc) : 0 } });
        return json(env, { ok: true });
      }

      if (url.pathname === '/api/load' && req.method === 'POST') {
        const au = await authenticate(env, await req.json());
        if (au.err) return au.err;
        return json(env, { data: au.rec.data, t: au.rec.t });
      }

      // Ereignisse (vom Admin geschickt) + Rundmeldungen abholen
      if (url.pathname === '/api/events' && req.method === 'POST') {
        const b = await req.json();
        const au = await authenticate(env, b);
        if (au.err) return au.err;
        await runSched(env);
        const key = 'q:' + b.id;
        const q = (await env.SAVES.get(key, 'json')) || [];
        if (q.length) await env.SAVES.delete(key);
        const since = Number(b.since) || 0;
        const bc = ((await env.SAVES.get('bc', 'json')) || []).filter((x) => x.t > since);
        return json(env, { events: q, broadcasts: bc, now: Date.now() });
      }

      // Chat lesen (ohne Anmeldung möglich)
      if (url.pathname === '/api/chat' && req.method === 'GET') return json(env, { messages: chatPublic(await chatLoad(env)), now: Date.now() });

      // Chat schreiben (nur angemeldet, nicht gesperrt/stumm)
      if (url.pathname === '/api/chat/send' && req.method === 'POST') {
        const b = await req.json();
        const au = await authenticate(env, b);
        if (au.err) return au.err;
        const text = cleanChat(b.text);
        if (!text) return fail(env, 'Leere Nachricht');
        if (await env.SAVES.get('mute:' + b.id)) return fail(env, 'Du bist stumm geschaltet.', 403, { muted: true });
        const meta = (await env.SAVES.getWithMetadata('p:' + b.id, 'text')).metadata || {};
        const admins = await adminMap(env);
        const list = await chatLoad(env); const now = Date.now();
        const mine = [...list].reverse().find((m) => m.u === b.id);
        if (mine && now - mine.t < 2000) return fail(env, 'Nicht so schnell!', 429);
        if (mine && mine.x === text && now - mine.t < 60000) return fail(env, 'Diese Nachricht hast du gerade schon gesendet.', 429);
        list.push({ i: now * 1000 + Math.floor(Math.random() * 1000), t: now, n: meta.n || 'Anonym', u: b.id, a: !!admins[b.id], x: text });
        await chatSave(env, list);
        return json(env, { ok: true });
      }

      // ---- Private Chats (1:1): nur die beiden Teilnehmer können Nachrichten lesen und schreiben ----
      if (url.pathname.startsWith('/api/dm/') && req.method === 'POST') {
        const b = await req.json();
        const au = await authenticate(env, b);
        if (au.err) return au.err;
        const me = b.id; const a = url.pathname.slice(8);
        const index = async (id) => (await env.SAVES.get('dml:' + id, 'json')) || [];
        const nameOf = async (id) => ((await env.SAVES.getWithMetadata('p:' + id, 'text')).metadata || {}).n;
        const upsert = async (id, entry) => { const l = await index(id); const i = l.findIndex((x) => x.id === entry.id); if (i >= 0) l[i] = { ...l[i], ...entry }; else l.push(entry); await env.SAVES.put('dml:' + id, JSON.stringify(l.slice(-100))); };

        if (a === 'list') { const l = (await index(me)).sort((x, y) => (y.last || 0) - (x.last || 0)); return json(env, { convs: l, now: Date.now() }); }

        if (a === 'open') { // Chat mit einem Spieler (per Name) anlegen
          const toId = await nameToId(b.to || '');
          if (toId === me) return fail(env, 'Du kannst keinen Chat mit dir selbst anlegen.');
          const toName = await nameOf(toId); if (!toName) return fail(env, 'Spieler nicht gefunden', 404);
          if (await env.SAVES.get('ban:' + toId)) return fail(env, 'Mit diesem Spieler ist kein Chat möglich.');
          const myName = (await nameOf(me)) || 'Anonym';
          if (!(await index(me)).some((x) => x.id === toId)) await upsert(me, { id: toId, name: toName, last: Date.now() });
          if (!(await index(toId)).some((x) => x.id === me)) await upsert(toId, { id: me, name: myName, last: Date.now() });
          return json(env, { with: toId, name: toName });
        }

        const other = typeof b.with === 'string' && ID_RE.test(b.with) && b.with !== me ? b.with : null;
        if (!other) return fail(env, 'Ungültiger Chat');
        const key = 'dm:' + (me < other ? me + ':' + other : other + ':' + me);
        if (a === 'get') return json(env, { messages: (await env.SAVES.get(key, 'json')) || [], now: Date.now() });

        if (a === 'send') {
          const text = cleanChat(b.text).slice(0, 300); if (!text) return fail(env, 'Leere Nachricht');
          if (await env.SAVES.get('mute:' + me)) return fail(env, 'Du bist stumm geschaltet.', 403, { muted: true });
          const toName = await nameOf(other); if (!toName) return fail(env, 'Spieler nicht gefunden', 404);
          if (await env.SAVES.get('ban:' + other)) return fail(env, 'Mit diesem Spieler ist kein Chat möglich.');
          const list = (await env.SAVES.get(key, 'json')) || []; const now = Date.now();
          const mine = [...list].reverse().find((m) => m.f === me);
          if (mine && now - mine.t < 1500) return fail(env, 'Nicht so schnell!', 429);
          if (mine && mine.x === text && now - mine.t < 60000) return fail(env, 'Diese Nachricht hast du gerade schon gesendet.', 429);
          list.push({ i: now * 1000 + Math.floor(Math.random() * 1000), t: now, f: me, x: text });
          await env.SAVES.put(key, JSON.stringify(list.slice(-100)));
          const myName = (await nameOf(me)) || 'Anonym'; const preview = text.slice(0, 60);
          await upsert(me, { id: other, name: toName, last: now, lastFrom: me, lastText: preview });
          await upsert(other, { id: me, name: myName, last: now, lastFrom: me, lastText: preview });
          return json(env, { ok: true });
        }
        return fail(env, 'Nicht gefunden', 404);
      }

      if (url.pathname === '/api/admin' && req.method === 'POST') return admin(env, await req.json());

      return fail(env, 'Nicht gefunden', 404);
    } catch (e) {
      const msg = String((e && e.message) || e);
      // Kostenloser Cloudflare-Plan: Tageslimit für Schreibvorgänge erreicht
      if (/limit exceeded|too many requests|quota/i.test(msg)) return fail(env, 'Der Server hat sein Tageslimit erreicht. Dein Fortschritt bleibt lokal gespeichert. Bitte später noch einmal versuchen.', 503, { limit: true });
      return fail(env, 'Serverfehler', 500, { detail: msg.slice(0, 120) });
    }
  },
};
