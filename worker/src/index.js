// Cloudflare Worker: Cloud-Saves + Rangliste (KV-Datenbank "SAVES").
const MAX_DATA = 12000; // Zeichen
const ID_RE = /^[a-f0-9]{16}$/;
const SECRET_RE = /^[a-f0-9]{32}$/;

const cors = (env) => ({
  'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
});
const json = (env, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(env) } });

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const cleanName = (n) => String(n || 'Anonym').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Anonym';

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/health') return json(env, { ok: true });

      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const list = await env.SAVES.list({ prefix: 'p:', limit: 1000 });
        const players = list.keys
          .map((k) => k.metadata)
          .filter((m) => m && Number.isFinite(m.s))
          .sort((a, b) => b.s - a.s)
          .slice(0, 25)
          .map((m) => ({ name: m.n, score: m.s }));
        return json(env, { players });
      }

      if (url.pathname === '/api/save' && req.method === 'PUT') {
        const b = await req.json();
        if (!ID_RE.test(b.id) || !SECRET_RE.test(b.secret)) return json(env, { error: 'Ungültige Zugangsdaten' }, 400);
        const data = JSON.stringify(b.data ?? null);
        if (data.length > MAX_DATA || data === 'null') return json(env, { error: 'Spielstand ungültig oder zu groß' }, 413);
        const hash = await sha256(b.secret);
        const key = 'p:' + b.id;
        const old = await env.SAVES.get(key, 'json');
        if (old && old.h !== hash) return json(env, { error: 'Falscher Account-Code' }, 403);
        const score = Number(b.score);
        const s = Number.isFinite(score) && score > 0 ? score : 0;
        await env.SAVES.put(key, JSON.stringify({ h: hash, data: b.data, t: Date.now() }), { metadata: { n: cleanName(b.name), s } });
        return json(env, { ok: true });
      }

      if (url.pathname === '/api/load' && req.method === 'POST') {
        const b = await req.json();
        if (!ID_RE.test(b.id) || !SECRET_RE.test(b.secret)) return json(env, { error: 'Ungültige Zugangsdaten' }, 400);
        const rec = await env.SAVES.get('p:' + b.id, 'json');
        if (!rec) return json(env, { error: 'Kein Spielstand gefunden' }, 404);
        if (rec.h !== (await sha256(b.secret))) return json(env, { error: 'Falscher Account-Code' }, 403);
        return json(env, { data: rec.data, t: rec.t });
      }

      return json(env, { error: 'Nicht gefunden' }, 404);
    } catch (e) {
      return json(env, { error: 'Serverfehler' }, 500);
    }
  },
};
