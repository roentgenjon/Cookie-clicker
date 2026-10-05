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
async function adminMap(env) {
  const map = {};
  for (const n of (env.ADMINS || '').split(',').map((s) => s.trim()).filter(Boolean)) map[(await sha256('id:' + n.toLowerCase())).slice(0, 16)] = n;
  return map;
}

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
  if (await env.SAVES.get('ban:' + b.id)) return { err: fail(env, 'Dein Konto wurde gesperrt.', 403, { banned: true }) };
  return { rec, hash };
}

// ---- erlaubte Ereignisse (für Admin → Spieler) ----
const num = (v, min, max) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null; };
function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  switch (e.type) {
    case 'golden': { const count = num(e.count, 1, 30); return ['random', 'frenzy', 'lucky', 'click', 'jackpot'].includes(e.effect) && count ? { type: 'golden', effect: e.effect, count: Math.floor(count) } : null; }
    case 'cookies': { const amount = num(e.amount, -1e300, 1e300); return amount === null ? null : { type: 'cookies', amount }; }
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

async function listPlayers(env) {
  const list = await env.SAVES.list({ prefix: 'p:', limit: 1000 });
  const bans = new Set((await env.SAVES.list({ prefix: 'ban:', limit: 1000 })).keys.map((k) => k.name.slice(4)));
  const mutes = new Set((await env.SAVES.list({ prefix: 'mute:', limit: 1000 })).keys.map((k) => k.name.slice(5)));
  return list.keys.filter((k) => k.metadata && Number.isFinite(k.metadata.s)).map((k) => ({ id: k.name.slice(2), name: k.metadata.n, score: k.metadata.s, updated: k.metadata.u || 0, banned: bans.has(k.name.slice(2)), muted: mutes.has(k.name.slice(2)) }));
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
      if (b.banned) await env.SAVES.put('ban:' + target, '1'); else await env.SAVES.delete('ban:' + target);
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

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/health') return json(env, { ok: true });

      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const players = (await listPlayers(env)).filter((p) => !p.banned).sort((a, b) => b.score - a.score).slice(0, 25).map((p) => ({ name: p.name, score: p.score }));
        return json(env, { players });
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
        await env.SAVES.put('p:' + b.id, JSON.stringify({ h: au.hash, data: b.data, t: Date.now() }), { metadata: { n: name, s, u: Date.now() } });
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

      if (url.pathname === '/api/admin' && req.method === 'POST') return admin(env, await req.json());

      return fail(env, 'Nicht gefunden', 404);
    } catch (e) {
      return fail(env, 'Serverfehler', 500);
    }
  },
};
