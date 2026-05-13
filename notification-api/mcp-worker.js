/**
 * mcp-server-graylog · sandbox demo for pranavjagadish.com
 *
 * POST /api/mcp/query  { question: "..." }  → 200 { answer, model, remaining }
 *
 * Backed by:
 *   - synthetic graylog dataset (mcp-dataset.json) embedded as a JSON import
 *   - NVIDIA NIM mistralai/mistral-nemotron (free tier · 40 RPM)
 *   - KV namespace MCP_RATELIMIT for per-IP rate limiting
 *
 * Secrets:
 *   NVIDIA_API_KEY  · set via `wrangler secret put NVIDIA_API_KEY`
 */
import DATASET from './mcp-dataset.json';

const NIM_URL              = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NIM_MODEL            = 'mistralai/mistral-nemotron';
const MAX_QUESTION_LEN     = 200;
const MAX_ANSWER_TOKENS    = 600;
const RATE_LIMIT_PER_HOUR  = 10;

const BLOCKED_PATTERNS = [
    /ignore (the |all |any )?(previous|above|earlier|prior)/i,
    /system prompt/i,
    /you are now/i,
    /disregard/i,
    /pretend you (are|were)/i,
    /act as if/i,
    /new instructions/i,
];

// ─── system prompt · embeds the simulated graylog snapshot ────────────
function buildSystemPrompt() {
    const recent = DATASET.recent_entries.map(e =>
        `[${e.ts}] ${e.level.padEnd(5)} ${e.service.padEnd(18)} ${e.message}${e.trace_id ? ' · ' + e.trace_id : ''}`
    ).join('\n');

    const errors = DATASET.recent_errors.map(e =>
        `[${e.ts}] ${e.service.padEnd(18)} ${e.message}${e.trace_id ? ' · ' + e.trace_id : ''}`
    ).join('\n');

    return `You are mcp-server-graylog — the official Anthropic Model Context Protocol server for Graylog log aggregation. Author Pranav Jagadish · accepted into Anthropic's MCP catalog on 2025-10-18 (PR #2913 · v2.0.1).

You are answering a portfolio visitor's question about a SANDBOX graylog instance with simulated logs from a 6-microservice fintech (Scripbox-style). The full snapshot is below.

═══ SNAPSHOT · last 7 days ═══

aggregates:
${JSON.stringify(DATASET.aggregates, null, 2)}

20 most recent entries:
${recent}

20 most recent errors (full detail):
${errors}

═══ ANSWER STYLE ═══
- Be concise · terminal aesthetic · monospace-friendly
- Use \`▸\` for bullets (not *, -, or •)
- Cite specific values from the snapshot when relevant (counts, service names, trace_ids, timestamps)
- If the question is outside what's in the snapshot, say "no data on that in current snapshot" honestly
- Never fabricate data not in the snapshot
- Keep responses under ${MAX_ANSWER_TOKENS} tokens (~500 words)
- If helpful, end with one short "suggested: ..." action line
- Answer in-character as the MCP server · don't say "I'm simulated"
- For ambiguous questions, pick the most useful interpretation and answer it`;
}

// ─── handlers ────────────────────────────────────────────────────────

async function handleQuery(request, env) {
    let body;
    try { body = await request.json(); }
    catch { return errResp(400, 'invalid JSON'); }

    const q = String(body?.question || '').trim();
    if (!q)                              return errResp(400, 'question required');
    if (q.length > MAX_QUESTION_LEN)     return errResp(400, `question too long · max ${MAX_QUESTION_LEN} chars`);
    for (const re of BLOCKED_PATTERNS) {
        if (re.test(q))                  return errResp(400, 'request blocked · pattern matches prompt-injection filter');
    }

    // per-IP rate limit · KV with auto-expiring 1h window
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey = `mcp:rate:${ip}`;
    let cur = 0;
    try { cur = parseInt(await env.MCP_RATELIMIT.get(rateKey) || '0', 10); }
    catch (_) {}
    if (cur >= RATE_LIMIT_PER_HOUR) {
        return errResp(429, `rate limit · max ${RATE_LIMIT_PER_HOUR} queries/hour per IP · try again later`);
    }

    // call NIM
    let nimRes;
    try {
        nimRes = await fetch(NIM_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.NVIDIA_API_KEY}`,
                'Content-Type':  'application/json',
                'Accept':        'application/json',
            },
            body: JSON.stringify({
                model: NIM_MODEL,
                messages: [
                    { role: 'system', content: buildSystemPrompt() },
                    { role: 'user',   content: q },
                ],
                max_tokens:  MAX_ANSWER_TOKENS,
                temperature: 0.4,
                top_p: 0.9,
                stream: false,
            }),
        });
    } catch (e) {
        return errResp(502, `upstream LLM unreachable · ${e.message || 'fetch failed'}`);
    }

    if (!nimRes.ok) {
        const txt = await nimRes.text().catch(() => '');
        return errResp(502, `upstream LLM error · HTTP ${nimRes.status}${txt ? ' · ' + txt.slice(0, 120) : ''}`);
    }

    let data;
    try { data = await nimRes.json(); }
    catch { return errResp(502, 'upstream LLM returned non-JSON'); }

    const answer = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!answer) return errResp(502, 'upstream LLM returned empty response');

    // increment rate counter only on success
    try {
        await env.MCP_RATELIMIT.put(rateKey, String(cur + 1), { expirationTtl: 3600 });
    } catch (_) {}

    return jsonResp(200, {
        ok: true,
        question: q,
        answer,
        model: NIM_MODEL,
        remaining: Math.max(0, RATE_LIMIT_PER_HOUR - cur - 1),
        dataset: {
            entries:  DATASET.aggregates.total_entries,
            services: Object.keys(DATASET.aggregates.by_service).length,
            errors:   DATASET.aggregates.by_level.ERROR || 0,
        },
    });
}

function handleStatus() {
    return jsonResp(200, {
        name: 'mcp-server-graylog · sandbox demo',
        version: 'v2.0.1',
        model: NIM_MODEL,
        rate_limit_per_hour: RATE_LIMIT_PER_HOUR,
        max_question_chars: MAX_QUESTION_LEN,
        dataset: {
            entries:           DATASET.aggregates.total_entries,
            services:          Object.keys(DATASET.aggregates.by_service).length,
            time_range:        DATASET.aggregates.time_range,
            top_error_count:   (DATASET.aggregates.top_error_patterns[0]||{}).count || 0,
        },
        real_server: 'https://github.com/Pranavj17/mcp-server-graylog',
    });
}

// ─── helpers ─────────────────────────────────────────────────────────

function cors() {
    return {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age':       '86400',
    };
}
function jsonResp(status, payload) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors() },
    });
}
function errResp(status, message) {
    return jsonResp(status, { error: message });
}

// ─── entrypoint ──────────────────────────────────────────────────────

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname !== '/api/mcp/query') return new Response('not found', { status: 404 });
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
        if (request.method === 'GET')     return handleStatus();
        if (request.method === 'POST')    return handleQuery(request, env);
        return errResp(405, 'method not allowed');
    }
};
