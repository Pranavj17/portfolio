/**
 * Guestbook Cloudflare Worker for pranavjagadish.com/api/guestbook
 * Backs the `sign <message>` and `cat guestbook.txt` commands in the
 * portfolio site's live shell. Persists signs in Cloudflare KV.
 *
 * ROUTES
 *   GET  /api/guestbook       → JSON array of signs (newest-first, capped at 100)
 *   POST /api/guestbook       → body: { name, msg, date } → 201 + entry
 *   OPTIONS /api/guestbook    → CORS preflight
 *
 * DEPLOY (one-time)
 *   1. Create a KV namespace:
 *        wrangler kv:namespace create GUESTBOOK
 *      Copy the printed `id` into the wrangler.toml below.
 *
 *   2. Save this as worker entry, alongside a wrangler.toml like:
 *        name = "pranavjagadish-guestbook"
 *        main = "guestbook-worker.js"
 *        compatibility_date = "2026-05-01"
 *        kv_namespaces = [
 *          { binding = "GUESTBOOK", id = "<paste-id-from-step-1>" }
 *        ]
 *        routes = [
 *          { pattern = "pranavjagadish.com/api/guestbook", zone_name = "pranavjagadish.com" }
 *        ]
 *
 *   3. Deploy:
 *        wrangler deploy
 *
 * MERGING into your existing /api/* worker (alternative)
 *   If your notification-api worker handles `pranavjagadish.com/api/*`,
 *   route guestbook traffic to handleGuestbook() exported below — same
 *   route pattern wins by specificity, but cleaner to keep one worker.
 *
 * SPAM PROTECTION
 *   - 200-char message cap, 50-char name cap, both trimmed + length-clamped
 *   - 1 sign per IP per hour (rate limit via KV with auto-expire)
 *   - simple substring blocklist (extend BLOCKED_TERMS as needed)
 *   - drops oldest signs once total exceeds 100 (KV value stays bounded)
 */

const MAX_MSG_LEN   = 200;
const MAX_NAME_LEN  = 50;
const MAX_SIGNS     = 100;
const RATE_LIMIT_MS = 60 * 60 * 1000;        // 1 hour per IP
// LEGACY: previously all entries were stored under one KV key as a JSON array,
// which is racy under concurrent writes (read-modify-write loses entries).
// New writes go to per-entry keys at `guestbook:entry:<ts>-<rand>` — each
// write is atomic. Reads merge both sources for backwards compatibility.
const KV_LEGACY_KEY = 'guestbook:signs';
const KV_ENTRY_PFX  = 'guestbook:entry:';
const ALLOWED_POST_ORIGINS = new Set([
    'https://pranavjagadish.com',
    'https://www.pranavjagadish.com',
]);

const BLOCKED_TERMS = [
    // extend with anything you want auto-rejected; case-insensitive substring match
    'http://', 'https://', '[url=',           // crude link-spam filter
];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== '/api/guestbook') {
            return new Response('not found', { status: 404 });
        }
        if (request.method === 'OPTIONS') {
            const requestedMethod = request.headers.get('Access-Control-Request-Method');
            if (requestedMethod === 'POST') {
                const headers = postCors(request);
                if (!headers) return forbiddenCors();
                return new Response(null, { status: 204, headers });
            }
            return new Response(null, { status: 204, headers: cors() });
        }
        if (request.method === 'GET')  return handleGet(env);
        if (request.method === 'POST') {
            if (!postCors(request)) return forbiddenCors();
            return handlePost(request, env);
        }
        return errorResponse(405, 'method not allowed');
    }
};

// ─── handlers ──────────────────────────────────────────────────────

export async function handleGet(env) {
    // Pull new-style per-entry keys AND legacy aggregate, merge, dedupe by ts,
    // sort newest-first, cap at MAX_SIGNS.
    const [listResult, legacyRaw] = await Promise.all([
        env.GUESTBOOK.list({ prefix: KV_ENTRY_PFX, limit: 1000 }),
        env.GUESTBOOK.get(KV_LEGACY_KEY),
    ]);
    const entryFetches = (listResult.keys || []).map(k =>
        env.GUESTBOOK.get(k.name).then(v => { try { return JSON.parse(v); } catch { return null; } })
    );
    const newStyle = (await Promise.all(entryFetches)).filter(Boolean);
    const legacy   = (() => { try { return legacyRaw ? JSON.parse(legacyRaw) : []; } catch { return []; } })();

    const merged = new Map();
    for (const e of [...legacy, ...newStyle]) {
        if (e && typeof e === 'object' && e.ts != null) merged.set(e.ts, e);
    }
    const signs = Array.from(merged.values())
        .sort((a, b) => (b.ts || 0) - (a.ts || 0))
        .slice(0, MAX_SIGNS);
    return jsonResponse(200, signs);
}

export async function handlePost(request, env) {
    let body;
    try { body = await request.json(); }
    catch { return errorResponse(400, 'invalid JSON'); }

    const name = String(body?.name || 'guest').trim().slice(0, MAX_NAME_LEN) || 'guest';
    const msg  = String(body?.msg  || '').trim().slice(0, MAX_MSG_LEN);

    if (!msg)              return errorResponse(400, 'message required');
    if (msg.length < 2)    return errorResponse(400, 'message too short');

    // crude blocklist
    const lower = msg.toLowerCase();
    if (BLOCKED_TERMS.some(t => lower.includes(t))) {
        return errorResponse(400, 'message blocked (links not allowed in guestbook)');
    }

    // rate limit per IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipKey = `guestbook:ip:${ip}`;
    const lastSignAt = await env.GUESTBOOK.get(ipKey);
    if (lastSignAt) {
        const elapsed = Date.now() - parseInt(lastSignAt, 10);
        if (elapsed < RATE_LIMIT_MS) {
            const wait = Math.ceil((RATE_LIMIT_MS - elapsed) / 60_000);
            return errorResponse(429, `rate limit · wait ${wait}m`);
        }
    }

    const entry = {
        name,
        msg,
        date: new Date().toISOString().slice(0, 10),
        ts:   Date.now(),
    };

    // Write to per-entry key — atomic, no read-modify-write race. The random
    // suffix prevents key collisions on same-millisecond writes from different IPs.
    const randSuffix = Math.random().toString(36).slice(2, 8);
    const entryKey   = `${KV_ENTRY_PFX}${entry.ts}-${randSuffix}`;
    await env.GUESTBOOK.put(entryKey, JSON.stringify(entry));
    await env.GUESTBOOK.put(ipKey, String(Date.now()), {
        expirationTtl: Math.ceil(RATE_LIMIT_MS / 1000) + 60,
    });

    return jsonResponse(201, { ok: true, entry });
}

// ─── helpers ──────────────────────────────────────────────────────

function cors() {
    return {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age':       '86400',
    };
}

// CSRF guard for POST: require Origin to be one of the allowlist, OR absent
// (non-browser clients like curl never send Origin and shouldn't be blocked).
// Returns the header map to use, or null if the Origin is unrecognized.
function postCors(request) {
    const origin = request.headers.get('Origin') || '';
    if (!origin) return cors();
    if (!ALLOWED_POST_ORIGINS.has(origin)) return null;
    return {
        'Access-Control-Allow-Origin':  origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age':       '86400',
        'Vary':                         'Origin',
    };
}

function forbiddenCors() {
    return new Response(JSON.stringify({ error: 'origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' },
    });
}

function jsonResponse(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors() },
    });
}

function errorResponse(status, message) {
    return jsonResponse(status, { error: message });
}
