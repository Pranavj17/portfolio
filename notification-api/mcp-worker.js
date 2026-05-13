/**
 * mcp-server-graylog · sandbox demo for pranavjagadish.com · Phase 2
 *
 * Phase 2 swaps the old "embed dataset in system prompt" approach for a real
 * OpenAI-style tool-calling loop. The LLM gets 6 tool definitions, decides
 * which to call, the Worker executes them against the dataset, and results
 * feed back into the loop until the LLM returns a final text answer (or we
 * hit MAX_ROUNDS and force-finalize).
 *
 * POST /api/mcp/query  { question: "..." }  → 200 { ok, tool_calls, final_answer, ... }
 * GET  /api/mcp/query                       → 200 { name, version, phase, tools, ... }
 *
 * Backed by:
 *   - synthetic graylog dataset (mcp-dataset.json · 150 entries, 6 services, 7d)
 *   - NVIDIA NIM mistralai/mistral-nemotron (free tier · 40 RPM, tool-calling capable)
 *   - KV namespace MCP_RATELIMIT for per-IP rate limiting
 *
 * Secrets:
 *   NVIDIA_API_KEY  · set via `wrangler secret put NVIDIA_API_KEY`
 */
import DATASET from './mcp-dataset.json';
import {
    assertSafePublicUrl,
    isBlockedHostname,
    dohResolve,
} from './url-safety.js';

const NIM_URL              = 'https://integrate.api.nvidia.com/v1/chat/completions';
// Model fallback chain (same priority order as OpenClaw on Mac Mini).
// First model is tried; on DEGRADED / transient failures, we fall through.
// All three support OpenAI-style function-calling per NIM benchmarks.
const NIM_MODELS = [
    'mistralai/mistral-nemotron',
    'meta/llama-3.3-70b-instruct',
    'qwen/qwen3-coder-480b-a35b-instruct',
];
const NIM_MODEL            = NIM_MODELS[0];   // primary, reported in /api/mcp/query status
const MAX_QUESTION_LEN     = 200;
const MAX_ANSWER_TOKENS    = 600;
const RATE_LIMIT_PER_HOUR  = 10;
const MAX_ROUNDS           = 5;
const SEARCH_LIMIT_DEFAULT = 20;
const SEARCH_LIMIT_MAX     = 50;
const SURROUNDING_DEFAULT  = 5;

// ─── internet tool limits ────────────────────────────────────────────
// All five new tools (fetch_url, dns_lookup, http_headers, check_url_alive,
// summarize_url) share these caps. The per-request `ctx` object enforces
// the cumulative ones (outboundFetches, summarizeCalls); per-tool timeouts
// are per-call.
const MAX_RESPONSE_BYTES        = 50_000;   // fetch_url body cap
const SUMMARY_MAX_INPUT_BYTES   = 20_000;   // tighter cap for summarize_url's fetch
const FETCH_TIMEOUT_MS          = 5_000;
const SUMMARY_TIMEOUT_MS        = 5_000;
const MAX_SUMMARIZE_PER_REQUEST = 2;        // summarize_url cap per MCP query (costs an LLM call each)
const MAX_OUTBOUND_FETCHES      = 10;       // hard cap on ALL outbound subrequests per request

// "Now" anchor matches the dataset's upper time bound, so time_range filters
// are deterministic & reproducible.
const NOW_ANCHOR_MS = Date.parse('2026-05-13T12:00:00Z');

const BLOCKED_PATTERNS = [
    /ignore (the |all |any )?(previous|above|earlier|prior)/i,
    /system prompt/i,
    /you are now/i,
    /disregard/i,
    /pretend you (are|were)/i,
    /act as if/i,
    /new instructions/i,
];

// ─── tool schemas (OpenAI function-calling format) ───────────────────

const TOOL_SCHEMAS = [
    {
        type: 'function',
        function: {
            name: 'search_logs',
            description: 'Search log entries with a Lucene-style query. Supports field:value (e.g. service:billing-service, level:ERROR, tags:db), AND, OR, NOT, quoted values, and free-text fallback. Use this to look up specific entries by content, service, level, or tags.',
            parameters: {
                type: 'object',
                properties: {
                    query:      { type: 'string', description: 'Lucene-style query. Examples: "level:ERROR AND service:billing-service", "tags:db", "timeout", "service:auth-service".' },
                    time_range: { type: 'string', enum: ['1h', '6h', '24h', '7d', '30d'], description: 'Lookback window from now. Default "7d".' },
                    limit:      { type: 'integer', minimum: 1, maximum: SEARCH_LIMIT_MAX, description: `Max entries to return. Default ${SEARCH_LIMIT_DEFAULT}, max ${SEARCH_LIMIT_MAX}.` },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'count_messages',
            description: 'Count log entries matching a query. Optionally group counts by service, level, or message. Same query syntax as search_logs.',
            parameters: {
                type: 'object',
                properties: {
                    query:      { type: 'string', description: 'Lucene-style query, e.g. "level:ERROR" or "tags:stripe".' },
                    time_range: { type: 'string', enum: ['1h', '6h', '24h', '7d', '30d'], description: 'Default "7d".' },
                    groupby:    { type: 'string', enum: ['service', 'level', 'message'], description: 'If set, return a per-key breakdown.' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_streams',
            description: 'List all log streams (one per service) with their message counts. No arguments.',
            parameters: { type: 'object', properties: {}, required: [] },
        },
    },
    {
        type: 'function',
        function: {
            name: 'trace_request',
            description: 'Fetch all entries sharing a trace_id, sorted ascending by timestamp. Useful for following a single request across services.',
            parameters: {
                type: 'object',
                properties: { trace_id: { type: 'string', description: 'A trace identifier, e.g. "tr_4d6da0".' } },
                required: ['trace_id'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_surrounding_logs',
            description: 'Return log entries surrounding a given timestamp (window*2+1 total, centred on the matching entry).',
            parameters: {
                type: 'object',
                properties: {
                    ts:     { type: 'string', description: 'ISO 8601 timestamp of the entry to centre on, e.g. "2026-05-13T06:21:00Z".' },
                    window: { type: 'integer', minimum: 1, maximum: 20, description: `Entries on each side. Default ${SURROUNDING_DEFAULT}.` },
                },
                required: ['ts'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_message',
            description: 'Fetch a single log entry by exact timestamp. Returns { error: "not found" } if no match.',
            parameters: {
                type: 'object',
                properties: { ts: { type: 'string', description: 'Exact ISO 8601 timestamp.' } },
                required: ['ts'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'analyze_incident',
            description: 'Composite incident analysis · mirrors the same-named tool in the real mcp-server-graylog npm package (v2.1.0). ONE call fans out to: (1) the full trace hop chain via trace_id, (2) service-scoped surrounding logs around the first ERROR/CRITICAL/FATAL hop within ±window seconds, and (3) a trailing-baseline error count for the anchor service. Returns one aggregated report — hops, services involved, anchor service, first-error context, baseline error rate. Saves 2-3 LLM orchestration rounds when investigating a specific trace.',
            parameters: {
                type: 'object',
                properties: {
                    traceId:         { type: 'string', description: 'The trace identifier to investigate (e.g. "tr_13d3b6").' },
                    from:            { type: 'string', description: 'Start timestamp in ISO 8601 (search window for the trace). Dataset spans 2026-05-06 to 2026-05-13.' },
                    to:              { type: 'string', description: 'End timestamp in ISO 8601.' },
                    window:          { type: 'number', minimum: 1, maximum: 300, description: 'Surrounding-logs window in seconds on each side of the anchor. Default 10.' },
                    baselineSeconds: { type: 'number', minimum: 60, maximum: 86400, description: 'Trailing window in seconds for the error baseline lookup ending at the trace start. Default 3600 (1h).' },
                },
                required: ['traceId', 'from', 'to'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'aggregate_logs',
            description: 'Count log entries grouped by a field · mirrors the same-named tool in the real mcp-server-graylog npm package (v2.2.0). Filters entries by query + time window, projects only the group-by field, returns top N values with counts + summed `other` + `missing` count for entries where the field was unset. Common usage: errors in last hour grouped by service — `{ query: "level:ERROR", field: "service", rangeSeconds: 3600 }`. Provide EITHER from+to OR rangeSeconds, not both.',
            parameters: {
                type: 'object',
                properties: {
                    query:        { type: 'string', description: 'Lucene-style query (same syntax as search_logs). Use "*" for all entries.' },
                    field:        { type: 'string', description: 'Field to group counts by. Synthetic dataset has: service, level, trace_id, tags. (Real package also supports pod, lead_id, etc.)' },
                    from:         { type: 'string', description: 'Start ISO 8601 timestamp (use either from+to OR rangeSeconds). Dataset spans 2026-05-06 to 2026-05-13.' },
                    to:           { type: 'string', description: 'End ISO 8601 timestamp.' },
                    rangeSeconds: { type: 'number', description: 'Relative window in seconds (alt to from+to). Anchored at the dataset\'s "now" = 2026-05-13T12:00Z.' },
                    size:         { type: 'number', minimum: 1, maximum: 100, description: 'Top N groups to return (default 25). Remainder summed into `other`.' },
                    fetchLimit:   { type: 'number', minimum: 1, maximum: 10000, description: 'Max entries to aggregate (default 5000). When matched total exceeds this, `truncated: true` is flagged.' },
                },
                required: ['query', 'field'],
            },
        },
    },

    // ─── internet tools · real-world web I/O (separate domain from graylog) ───
    {
        type: 'function',
        function: {
            name: 'fetch_url',
            description: 'Fetch the body of a public HTTPS URL the user has referenced. Returns up to 50KB of decoded text plus status and Content-Type. Use ONLY when the user has explicitly named a URL; never invent URLs.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'Full https:// URL the user referenced.' },
                },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'dns_lookup',
            description: "Resolve a hostname via DNS-over-HTTPS (Cloudflare 1.1.1.1). Returns up to 20 answers. Use when the user asks about a domain's IP, MX, TXT, or other DNS records. Pass a fully-qualified hostname, not a literal IP.",
            parameters: {
                type: 'object',
                properties: {
                    hostname:    { type: 'string', description: 'Fully-qualified hostname.' },
                    record_type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT'], description: 'DNS record type. Default A.' },
                },
                required: ['hostname'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'http_headers',
            description: 'Fetch only the HTTP response headers for a URL via HEAD. Use when the user asks about headers, content-type, response size, status, or redirects. Redirects are NOT auto-followed — they are reported via redirected_to so the caller can decide whether to chain another call.',
            parameters: {
                type: 'object',
                properties: { url: { type: 'string' } },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_url_alive',
            description: 'Test whether a URL is reachable and measure response latency. Returns alive (true iff 2xx-3xx), status, and latency_ms. Use when the user asks "is X up" or wants a quick health check.',
            parameters: {
                type: 'object',
                properties: { url: { type: 'string' } },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'summarize_url',
            description: 'Fetch a URL and produce a short LLM-generated summary in N words or fewer (default 80, max 150). Use when the user asks "what does X say" or wants a TL;DR. Capped at 2 calls per MCP query because each invocation costs an extra LLM round-trip.',
            parameters: {
                type: 'object',
                properties: {
                    url:       { type: 'string' },
                    max_words: { type: 'integer', minimum: 20, maximum: 150, description: 'Word budget for the summary. Default 80.' },
                },
                required: ['url'],
            },
        },
    },
];

// ─── Mistral [TOOL_CALLS] leak recovery ──────────────────────────────
//
// Mistral Nemotron's underlying chat template uses literal `[TOOL_CALLS]`
// markers to delimit tool-use sections. Most of the time NIM normalizes
// these into structured `message.tool_calls`. When the normalization
// fails (~10% of responses), the markers leak into `message.content`
// in a format like:
//
//   [TOOL_CALLS]count_messages{"query":"level:ERROR","groupby":"service"}[TOOL_CALLS]p5A8IozoY[TOOL_CALLS]{"counts":[...]}
//
// We parse out the FIRST segment after the opening `[TOOL_CALLS]` (tool
// name + JSON args) and discard the rest, including the LLM's fabricated
// inline "result" which we should never trust. Then we execute the tool
// for real and continue the loop.

const _KNOWN_TOOL_NAMES = new Set(TOOL_SCHEMAS.map(s => s.function.name));

function extractLeakedToolCalls(text) {
    if (!text || !text.includes('[TOOL_CALLS]')) return [];
    const parts = text.split('[TOOL_CALLS]');
    // parts[0] = text before the first marker (usually empty); subsequent
    // parts are segments BETWEEN markers. We only trust the first non-empty
    // segment that looks like `<name>{<json>}` AND names a known tool.
    const calls = [];
    for (let i = 1; i < parts.length; i++) {
        const p = parts[i].trim();
        if (!p) continue;
        const m = p.match(/^(\w+)\s*(\{[\s\S]*\})\s*$/);
        if (!m) continue;
        const [, name, argsJson] = m;
        if (!_KNOWN_TOOL_NAMES.has(name)) continue;
        try {
            const args = JSON.parse(argsJson);
            if (args && typeof args === 'object') {
                calls.push({ name, args });
                break;   // stop after first valid · rest are LLM-fabricated noise
            }
        } catch (_) { /* malformed JSON · keep scanning */ }
    }
    return calls;
}

function stripLeakMarkup(text) {
    if (!text || !text.includes('[TOOL_CALLS]')) return text;
    // Remove every `[TOOL_CALLS]...` chunk up to the next `[TOOL_CALLS]` OR
    // end of string. Leaves any non-tool-call surrounding prose intact.
    return text
        .replace(/\[TOOL_CALLS\][^[]*(?=\[TOOL_CALLS\]|$)/g, '')
        .trim();
}

// ─── query parser & predicate builder ────────────────────────────────
//
// Grammar (no parens, no nesting):
//   expr     := term (BOOLOP term)*
//   BOOLOP   := AND | OR
//   term     := [NOT] atom
//   atom     := field:value | "free text"
//   value    := word | "quoted string"
//
// Implementation: tokenize into a flat list of (kind, value, negate) atoms +
// a parallel list of boolean operators between them. Default operator is AND
// when adjacent atoms have no explicit operator.

function tokenizeQuery(q) {
    const tokens = [];
    let i = 0;
    while (i < q.length) {
        const ch = q[i];
        if (ch === ' ' || ch === '\t') { i++; continue; }
        // quoted string
        if (ch === '"') {
            let j = i + 1;
            while (j < q.length && q[j] !== '"') j++;
            tokens.push({ kind: 'word', value: q.slice(i + 1, j) });
            i = j + 1;
            continue;
        }
        // unquoted word (may contain : for field:value)
        let j = i;
        while (j < q.length && q[j] !== ' ' && q[j] !== '\t' && q[j] !== '"') j++;
        const w = q.slice(i, j);
        const up = w.toUpperCase();
        if (up === 'AND' || up === 'OR' || up === 'NOT') {
            tokens.push({ kind: 'op', value: up });
        } else {
            tokens.push({ kind: 'word', value: w });
        }
        i = j;
    }
    return tokens;
}

/**
 * Build an array of { atom, op, negate } where each atom is either
 * { field, value } or { freeText }. op is the boolean operator that
 * connects this atom to the PREVIOUS one ("AND" / "OR"; first atom is null).
 */
function parseQuery(q) {
    const toks = tokenizeQuery(q);
    const out = [];
    let pendingOp = null;   // op connecting next atom to previous
    let pendingNeg = false; // NOT on next atom

    for (const t of toks) {
        if (t.kind === 'op') {
            if (t.value === 'NOT')      pendingNeg = !pendingNeg;
            else                         pendingOp  = t.value;
            continue;
        }
        // word — split on first colon for field:value
        const w = t.value;
        let atom;
        const colonIdx = w.indexOf(':');
        if (colonIdx > 0) {
            atom = { field: w.slice(0, colonIdx).toLowerCase(), value: w.slice(colonIdx + 1) };
        } else {
            atom = { freeText: w };
        }
        out.push({ atom, op: out.length === 0 ? null : (pendingOp || 'AND'), negate: pendingNeg });
        pendingOp  = null;
        pendingNeg = false;
    }
    return out;
}

function atomMatches(atom, entry) {
    if (atom.freeText !== undefined) {
        const needle = atom.freeText.toLowerCase();
        const hay = [
            entry.ts, entry.level, entry.service, entry.message,
            entry.trace_id || '',
            (entry.tags || []).join(' '),
        ].join(' ').toLowerCase();
        return hay.includes(needle);
    }
    const field = atom.field;
    const value = String(atom.value || '').toLowerCase();
    if (field === 'tags') {
        return (entry.tags || []).some(t => String(t).toLowerCase().includes(value));
    }
    if (field === 'level' || field === 'service' || field === 'message' || field === 'ts' || field === 'trace_id') {
        const v = String(entry[field] || '').toLowerCase();
        return v.includes(value);
    }
    // Unknown field — fall back to free-text match against the whole entry
    const hay = [entry.ts, entry.level, entry.service, entry.message, entry.trace_id || '', (entry.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(value);
}

function predicateFromQuery(parsed) {
    // Empty query → match everything
    if (parsed.length === 0) return () => true;

    return (entry) => {
        // Evaluate left-to-right; OR has same precedence as AND here (no parens).
        // To keep AND > OR style precedence intuitive, group by OR: split into
        // OR-groups, each group AND'd internally, then OR across groups.
        const orGroups = [[]];
        for (const item of parsed) {
            if (item.op === 'OR') orGroups.push([item]);
            else                  orGroups[orGroups.length - 1].push(item);
        }
        for (const group of orGroups) {
            let allOk = true;
            for (const item of group) {
                let m = atomMatches(item.atom, entry);
                if (item.negate) m = !m;
                if (!m) { allOk = false; break; }
            }
            if (allOk) return true;
        }
        return false;
    };
}

// ─── time-range filter ───────────────────────────────────────────────

function timeRangeCutoff(range) {
    const r = (range || '7d').toLowerCase();
    const m = r.match(/^(\d+)([hd])$/);
    if (!m) return NOW_ANCHOR_MS - 7 * 24 * 3600 * 1000;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const mult = unit === 'h' ? 3600 * 1000 : 24 * 3600 * 1000;
    return NOW_ANCHOR_MS - n * mult;
}

function applyTimeRange(entries, range) {
    const cutoff = timeRangeCutoff(range);
    return entries.filter(e => {
        const t = Date.parse(e.ts);
        return Number.isFinite(t) && t >= cutoff && t <= NOW_ANCHOR_MS;
    });
}

// ─── tool implementations ────────────────────────────────────────────

function tool_search_logs(args) {
    const query     = String(args?.query ?? '');
    const time_range = args?.time_range || '7d';
    const limit     = Math.min(SEARCH_LIMIT_MAX, Math.max(1, parseInt(args?.limit ?? SEARCH_LIMIT_DEFAULT, 10) || SEARCH_LIMIT_DEFAULT));

    const parsed = parseQuery(query);
    const pred = predicateFromQuery(parsed);
    let pool = applyTimeRange(DATASET.entries, time_range);
    pool = pool.filter(pred);
    // Newest-first
    pool.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const total = pool.length;
    const entries = pool.slice(0, limit);
    return { matches_total: total, entries };
}

function tool_count_messages(args) {
    const query      = String(args?.query ?? '');
    const time_range = args?.time_range || '7d';
    const groupby    = args?.groupby || null;

    const parsed = parseQuery(query);
    const pred = predicateFromQuery(parsed);
    let pool = applyTimeRange(DATASET.entries, time_range);
    pool = pool.filter(pred);

    if (groupby && ['service', 'level', 'message'].includes(groupby)) {
        const groups = {};
        for (const e of pool) {
            const k = String(e[groupby] ?? '');
            groups[k] = (groups[k] || 0) + 1;
        }
        return { count: pool.length, groups };
    }
    return { count: pool.length };
}

function tool_get_streams() {
    const counts = {};
    for (const e of DATASET.entries) {
        counts[e.service] = (counts[e.service] || 0) + 1;
    }
    const streams = Object.entries(counts).map(([name, c]) => ({
        id: `stream-${name}`,
        name,
        message_count: c,
    }));
    streams.sort((a, b) => b.message_count - a.message_count);
    return { streams };
}

function tool_trace_request(args) {
    const trace_id = String(args?.trace_id ?? '').trim();
    if (!trace_id) return { error: 'trace_id required' };
    const entries = DATASET.entries
        .filter(e => e.trace_id === trace_id)
        .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    return { trace_id, entries, count: entries.length };
}

function tool_get_surrounding_logs(args) {
    const ts = String(args?.ts ?? '').trim();
    const window = Math.min(20, Math.max(1, parseInt(args?.window ?? SURROUNDING_DEFAULT, 10) || SURROUNDING_DEFAULT));
    if (!ts) return { error: 'ts required' };
    // Sort all entries ascending by ts
    const sorted = [...DATASET.entries].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    const idx = sorted.findIndex(e => e.ts === ts);
    if (idx < 0) {
        // Fall back to nearest-by-time
        const target = Date.parse(ts);
        if (!Number.isFinite(target)) return { error: 'invalid ts' };
        let best = -1, bestDelta = Infinity;
        for (let i = 0; i < sorted.length; i++) {
            const d = Math.abs(Date.parse(sorted[i].ts) - target);
            if (d < bestDelta) { bestDelta = d; best = i; }
        }
        if (best < 0) return { error: 'not found' };
        const start = Math.max(0, best - window);
        const end   = Math.min(sorted.length, best + window + 1);
        return { entries: sorted.slice(start, end), centred_on: sorted[best].ts, matched_exact: false };
    }
    const start = Math.max(0, idx - window);
    const end   = Math.min(sorted.length, idx + window + 1);
    return { entries: sorted.slice(start, end), centred_on: ts, matched_exact: true };
}

function tool_get_message(args) {
    const ts = String(args?.ts ?? '').trim();
    if (!ts) return { error: 'ts required' };
    const hit = DATASET.entries.find(e => e.ts === ts);
    return hit || { error: 'not found' };
}

// Composite tool · mirrors the same-named tool in the real
// `mcp-server-graylog` npm package (v2.1.0). Synthetic-data backing here
// since this is a CF Worker demo, but the schema + response shape match
// the package exactly so visitors see the real tool's surface area.
//
// One LLM call fans out to three internal searches and returns a single
// aggregated incident report — saves 2-3 LLM rounds versus orchestrating
// trace_request + get_surrounding_logs + count_messages manually.
//
// Differences from the package's real-Graylog implementation:
//  · Surrounding logs are SERVICE-scoped here (the synthetic dataset has
//    no `pod` field). The package uses POD-scoped filtering to avoid
//    multi-tenant noise on shared EC2 hosts.
//  · `summary.anchor_pod`, `summary.first_error.pod`, `first_error.lead_id`,
//    and `summary.request` are always null here — the synthetic data
//    doesn't carry those Scripbox-specific fields. They're in the schema
//    so the response shape is interchangeable with the real package's.
const ERROR_LEVELS = new Set(['ERROR', 'CRITICAL', 'FATAL']);

function tool_analyze_incident(args) {
    const traceId = String(args?.traceId ?? '').trim();
    if (!traceId) return { error: 'traceId required' };

    const fromStr = String(args?.from ?? '').trim();
    const toStr   = String(args?.to   ?? '').trim();
    const fromMs  = Date.parse(fromStr);
    const toMs    = Date.parse(toStr);
    if (!Number.isFinite(fromMs)) return { error: "'from' must be a valid ISO 8601 timestamp" };
    if (!Number.isFinite(toMs))   return { error: "'to' must be a valid ISO 8601 timestamp" };
    if (fromMs >= toMs)            return { error: "'from' must be before 'to'" };

    const window = Math.min(300, Math.max(1, parseInt(args?.window ?? 10, 10) || 10));
    const baselineSeconds = Math.min(86400, Math.max(60, parseInt(args?.baselineSeconds ?? 3600, 10) || 3600));

    // Step 1 · find all hops sharing this trace_id within [from, to]
    const traceHops = DATASET.entries
        .filter(e => e.trace_id === traceId)
        .filter(e => {
            const t = Date.parse(e.ts);
            return Number.isFinite(t) && t >= fromMs && t <= toMs;
        })
        .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

    if (traceHops.length === 0) {
        return {
            trace_id: traceId,
            found: false,
            note: `no entries match trace_id "${traceId}" between ${fromStr} and ${toStr}`,
            steps_executed: 1,
            api_calls: 1,   // mirrors package: only step 1 (trace lookup) executes when empty
        };
    }

    // Step 2 · pick anchor — first ERROR/CRITICAL/FATAL hop, else first hop
    const firstError = traceHops.find(e =>
        ERROR_LEVELS.has(String(e.level || '').toUpperCase())
    );
    const anchor = firstError || traceHops[0];
    const anchorTs = anchor.ts;
    const anchorMs = Date.parse(anchorTs);
    const anchorService = anchor.service || 'unknown';

    // Step 3 · surrounding logs · service-scoped within ±window seconds
    const surroundingLogs = DATASET.entries
        .filter(e => e.service === anchorService)
        .filter(e => {
            const t = Date.parse(e.ts);
            return Number.isFinite(t) && t >= anchorMs - window * 1000 && t <= anchorMs + window * 1000;
        })
        .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
        .slice(0, 100);

    // Step 4 · trailing-window error baseline for the anchor service
    const baselineFromMs = fromMs - baselineSeconds * 1000;
    const baselineErrors = DATASET.entries
        .filter(e => e.service === anchorService)
        .filter(e => String(e.level || '').toUpperCase() === 'ERROR')
        .filter(e => {
            const t = Date.parse(e.ts);
            return Number.isFinite(t) && t >= baselineFromMs && t < fromMs;
        }).length;

    // Aggregate
    const services_involved = [...new Set(traceHops.map(e => e.service).filter(Boolean))];
    const errors_in_trace = traceHops.filter(e =>
        ERROR_LEVELS.has(String(e.level || '').toUpperCase())
    ).length;

    return {
        trace_id: traceId,
        found: true,
        steps_executed: 4,   // algorithm steps · 4 logical, 3 are fan-out operations
        api_calls: 3,        // mirrors the real package · synthetic data here, but the
                             // 3 fan-out queries are the semantic equivalent of the
                             // 3 Graylog API calls the npm package would fire
        summary: {
            hops: traceHops.length,
            services_involved,
            errors_in_trace,
            anchor_timestamp: anchorTs,
            anchor_service: anchorService,
            anchor_pod: null,            // synthetic data has no `pod` field
            first_error: firstError ? {
                timestamp:    firstError.ts,
                service:      firstError.service || null,
                pod:          null,      // synthetic
                logger_level: firstError.level || null,
                message:      firstError.message || null,
                lead_id:      null,      // synthetic
            } : null,
            request: null,               // synthetic data has no http_* fields
            baseline_errors_in_service: baselineErrors,
            baseline_window_seconds: baselineSeconds,
        },
        time_range: { from: fromStr, to: toStr },
        trace_hops: traceHops,
        surrounding_logs: surroundingLogs,
    };
}

// Aggregation tool · mirrors mcp-server-graylog@2.2.0's aggregate_logs.
// Same response shape as the real package; the only synthetic-mode differences
// are: (a) some fields (pod, lead_id) will always be `missing` because the
// dataset doesn't carry them; (b) the dataset is small enough that truncation
// is unlikely but the flag still emits for schema parity.
function tool_aggregate_logs(args) {
    const query = String(args?.query ?? '');
    if (!query) return { error: 'query required' };
    const field = String(args?.field ?? '').trim();
    if (!field) return { error: 'field required' };
    if (!/^[a-zA-Z_][a-zA-Z0-9_.\-]*$/.test(field)) {
        return { error: `field contains invalid characters: ${JSON.stringify(field)}` };
    }

    const size       = Math.min(100,   Math.max(1, parseInt(args?.size       ?? 25,   10) || 25));
    const fetchLimit = Math.min(10000, Math.max(1, parseInt(args?.fetchLimit ?? 5000, 10) || 5000));

    // Time-window selection · either from+to OR rangeSeconds (mirror package contract).
    const fromStr = String(args?.from ?? '').trim();
    const toStr   = String(args?.to   ?? '').trim();
    const rangeSeconds = args?.rangeSeconds;
    let timeRangeDesc, timeFilter;
    if (rangeSeconds !== undefined && rangeSeconds !== null) {
        if (fromStr || toStr) return { error: "Provide EITHER rangeSeconds OR from+to, not both" };
        const rs = Math.min(86400, Math.max(1, parseInt(rangeSeconds, 10) || 0));
        if (rs < 1) return { error: "'rangeSeconds' must be between 1 and 86400" };
        const cutoffMs = NOW_ANCHOR_MS - rs * 1000;
        timeFilter = e => {
            const t = Date.parse(e.ts);
            return Number.isFinite(t) && t >= cutoffMs && t <= NOW_ANCHOR_MS;
        };
        timeRangeDesc = `Last ${rs} seconds`;
    } else if (fromStr && toStr) {
        const fromMs = Date.parse(fromStr);
        const toMs   = Date.parse(toStr);
        if (!Number.isFinite(fromMs)) return { error: "'from' must be a valid ISO 8601 timestamp" };
        if (!Number.isFinite(toMs))   return { error: "'to' must be a valid ISO 8601 timestamp" };
        if (fromMs >= toMs)            return { error: "'from' must be before 'to'" };
        timeFilter = e => {
            const t = Date.parse(e.ts);
            return Number.isFinite(t) && t >= fromMs && t <= toMs;
        };
        timeRangeDesc = { from: fromStr, to: toStr };
    } else {
        return { error: "Provide EITHER rangeSeconds OR both from+to" };
    }

    // Filter by query + time window
    const parsed = parseQuery(query);
    const pred = predicateFromQuery(parsed);
    let pool = DATASET.entries.filter(timeFilter).filter(pred);
    const totalMatched = pool.length;
    // Truncate to fetchLimit (oldest-first sort to stay deterministic)
    if (pool.length > fetchLimit) {
        pool = pool.slice(0, fetchLimit);
    }

    // Aggregate
    const counts = {};
    let missing = 0;
    for (const e of pool) {
        const v = e[field];
        if (v === undefined || v === null || v === '') { missing++; continue; }
        const key = String(v);
        counts[key] = (counts[key] || 0) + 1;
    }
    const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topN = sortedEntries.slice(0, size);
    const other = sortedEntries.slice(size).reduce((sum, [, c]) => sum + c, 0);

    return {
        field,
        query,
        time_range: timeRangeDesc,
        total_matched: totalMatched,
        messages_aggregated: pool.length,
        truncated: totalMatched > fetchLimit,
        unique_groups: sortedEntries.length,
        top: Object.fromEntries(topN),
        other,
        missing,
        api_calls: 1,
    };
}

// ─── internet tool handlers ──────────────────────────────────────────
//
// Five tools that hit the real public internet from the Worker. All five
// share the same SSRF guard (assertSafePublicUrl from url-safety.js) and
// the per-request `ctx` object enforces cumulative caps:
//
//   ctx.apiKey          — NVIDIA_API_KEY, needed by summarize_url
//   ctx.outboundFetches — running count (capped at MAX_OUTBOUND_FETCHES)
//   ctx.summarizeCalls  — running count (capped at MAX_SUMMARIZE_PER_REQUEST)

// Read response body with a hard byte cap. Used by fetch_url and summarize_url.
async function readBodyWithCap(res, maxBytes) {
    const reader = res.body?.getReader();
    if (!reader) return { body: '', truncated: false };
    const chunks = [];
    let total = 0;
    let truncated = false;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = maxBytes - total;
        if (value.length > remaining) {
            chunks.push(value.subarray(0, Math.max(0, remaining)));
            total = maxBytes;
            truncated = true;
            try { await reader.cancel(); } catch (_) {}
            break;
        }
        chunks.push(value);
        total += value.length;
        if (total >= maxBytes) {
            truncated = true;
            try { await reader.cancel(); } catch (_) {}
            break;
        }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }
    return { body: new TextDecoder('utf-8', { fatal: false }).decode(merged), truncated };
}

// Light HTML scrub for summarize_url. Drops <script>/<style>/comments,
// strips remaining tags, decodes a handful of common entities, collapses
// whitespace. Not a full HTML parser — adequate for "feed text to an LLM".
function stripHtmlForSummary(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi,  ' ')
        .replace(/<!--[\s\S]*?-->/g,           ' ')
        .replace(/<[^>]+>/g,                   ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .replace(/\s+/g,    ' ')
        .trim();
}

async function tool_fetch_url(args, ctx) {
    const url = String(args?.url ?? '');
    if (!url) return { error: 'url required' };
    if (++ctx.outboundFetches > MAX_OUTBOUND_FETCHES) {
        return { error: `outbound fetch cap reached (max ${MAX_OUTBOUND_FETCHES}/request)` };
    }
    let safeUrl;
    try        { safeUrl = await assertSafePublicUrl(url); }
    catch (e)  { return { error: e?.message || 'SSRF_BLOCKED' }; }
    try {
        const res = await fetch(safeUrl.toString(), {
            redirect: 'follow',
            signal:   AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        const { body, truncated } = await readBodyWithCap(res, MAX_RESPONSE_BYTES);
        return {
            status:       res.status,
            content_type: res.headers.get('content-type') || null,
            body,
            truncated,
        };
    } catch (e) {
        if (e?.name === 'TimeoutError') return { error: `timed out after ${FETCH_TIMEOUT_MS}ms` };
        return { error: `fetch failed: ${e?.message || String(e)}` };
    }
}

async function tool_dns_lookup(args, ctx) {
    const hostname = String(args?.hostname ?? '').trim();
    if (!hostname) return { error: 'hostname required' };
    // Reject literal IPs — the tool is for hostname → IP, not IP → IP.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
        return { error: 'literal IPs not accepted · pass a hostname' };
    }
    const block = isBlockedHostname(hostname);
    if (block) return { error: `hostname blocked: ${block}` };

    const type = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(args?.record_type)
        ? args.record_type
        : 'A';

    if (++ctx.outboundFetches > MAX_OUTBOUND_FETCHES) {
        return { error: `outbound fetch cap reached (max ${MAX_OUTBOUND_FETCHES}/request)` };
    }
    try {
        const answers = await dohResolve(hostname, type);
        return {
            hostname,
            type,
            answers: answers.slice(0, 20).map(a => ({ data: a.data ?? null, ttl: a.TTL ?? null })),
        };
    } catch (e) {
        return { error: `DNS lookup failed: ${e?.message || String(e)}` };
    }
}

async function tool_http_headers(args, ctx) {
    const url = String(args?.url ?? '');
    if (!url) return { error: 'url required' };
    if (++ctx.outboundFetches > MAX_OUTBOUND_FETCHES) {
        return { error: `outbound fetch cap reached (max ${MAX_OUTBOUND_FETCHES}/request)` };
    }
    let safeUrl;
    try        { safeUrl = await assertSafePublicUrl(url); }
    catch (e)  { return { error: e?.message || 'SSRF_BLOCKED' }; }
    try {
        const res = await fetch(safeUrl.toString(), {
            method:   'HEAD',
            redirect: 'manual',
            signal:   AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        const headers = {};
        for (const [k, v] of res.headers.entries()) headers[k.toLowerCase()] = v;
        const out = { status: res.status, headers };
        if (res.status >= 300 && res.status < 400 && headers.location) {
            out.redirected_to = headers.location;
        }
        return out;
    } catch (e) {
        if (e?.name === 'TimeoutError') return { error: `timed out after ${FETCH_TIMEOUT_MS}ms` };
        return { error: `fetch failed: ${e?.message || String(e)}` };
    }
}

async function tool_check_url_alive(args, ctx) {
    const url = String(args?.url ?? '');
    if (!url) return { error: 'url required' };
    if (++ctx.outboundFetches > MAX_OUTBOUND_FETCHES) {
        return { error: `outbound fetch cap reached (max ${MAX_OUTBOUND_FETCHES}/request)` };
    }
    let safeUrl;
    try        { safeUrl = await assertSafePublicUrl(url); }
    catch (e)  { return { alive: false, status: null, latency_ms: 0, error: e?.message || 'SSRF_BLOCKED' }; }
    const t0 = Date.now();
    try {
        const res = await fetch(safeUrl.toString(), {
            method:   'HEAD',
            redirect: 'follow',
            signal:   AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        return {
            alive:      res.status >= 200 && res.status < 400,
            status:     res.status,
            latency_ms: Date.now() - t0,
        };
    } catch (e) {
        return {
            alive:      false,
            status:     null,
            latency_ms: Date.now() - t0,
            error:      e?.name === 'TimeoutError' ? `timed out after ${FETCH_TIMEOUT_MS}ms` : (e?.message || String(e)),
        };
    }
}

async function tool_summarize_url(args, ctx) {
    const url = String(args?.url ?? '');
    if (!url) return { error: 'url required' };
    const maxWords = Math.min(150, Math.max(20, parseInt(args?.max_words ?? 80, 10) || 80));

    if (++ctx.summarizeCalls > MAX_SUMMARIZE_PER_REQUEST) {
        return { error: `summarize_url cap reached (max ${MAX_SUMMARIZE_PER_REQUEST}/request)` };
    }
    if (++ctx.outboundFetches > MAX_OUTBOUND_FETCHES) {
        return { error: `outbound fetch cap reached (max ${MAX_OUTBOUND_FETCHES}/request)` };
    }
    if (!ctx.apiKey) return { error: 'summarize_url requires NVIDIA_API_KEY · server misconfigured' };

    let safeUrl;
    try        { safeUrl = await assertSafePublicUrl(url); }
    catch (e)  { return { error: e?.message || 'SSRF_BLOCKED' }; }

    let body, truncated, contentType;
    try {
        const res = await fetch(safeUrl.toString(), {
            redirect: 'follow',
            signal:   AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
        });
        if (!res.ok) return { error: `fetch returned HTTP ${res.status}` };
        contentType = res.headers.get('content-type') || '';
        const r = await readBodyWithCap(res, SUMMARY_MAX_INPUT_BYTES);
        body = r.body;
        truncated = r.truncated;
    } catch (e) {
        if (e?.name === 'TimeoutError') return { error: `timed out after ${SUMMARY_TIMEOUT_MS}ms` };
        return { error: `fetch failed: ${e?.message || String(e)}` };
    }

    const cleaned = /html|xml/i.test(contentType) ? stripHtmlForSummary(body) : body;
    const input   = String(cleaned || '').slice(0, SUMMARY_MAX_INPUT_BYTES);
    if (!input) return { error: 'no readable content extracted' };

    // Call NIM with tool_choice:"none" so the summary call can't recurse
    // back into the tool loop.
    const summaryMessages = [
        { role: 'system', content: `Summarize the following web page content in ${maxWords} words or fewer. Be factual. Do not invent. If the content is not natural-language prose (e.g. JSON, code, error page), say so plainly.` },
        { role: 'user',   content: `URL: ${safeUrl.toString()}\n\n---\n${input}` },
    ];
    const llm = await callLLM(summaryMessages, ctx.apiKey, { toolChoice: 'none' });
    if (!llm.ok) return { error: `summarizer LLM failed (${llm.error || 'upstream error'})` };

    const summary = String(llm.data?.choices?.[0]?.message?.content || '').trim();
    return {
        summary,
        source_chars:     input.length,
        source_truncated: truncated,
        model_used:       llm.model_used || null,
    };
}

const TOOL_HANDLERS = {
    // graylog · synthetic dataset
    search_logs:           tool_search_logs,
    count_messages:        tool_count_messages,
    get_streams:           tool_get_streams,
    trace_request:         tool_trace_request,
    get_surrounding_logs:  tool_get_surrounding_logs,
    get_message:           tool_get_message,
    analyze_incident:      tool_analyze_incident,
    aggregate_logs:        tool_aggregate_logs,
    // internet · real-world web I/O
    fetch_url:             tool_fetch_url,
    dns_lookup:            tool_dns_lookup,
    http_headers:          tool_http_headers,
    check_url_alive:       tool_check_url_alive,
    summarize_url:         tool_summarize_url,
};

async function runTool(name, args, ctx) {
    const fn = TOOL_HANDLERS[name];
    if (!fn) return { error: `unknown tool: ${name}` };
    // Defensive default: if a caller (e.g. an offline test) didn't pass ctx,
    // the graylog tools still work; only internet tools need it populated.
    const safeCtx = ctx || { apiKey: null, outboundFetches: 0, summarizeCalls: 0 };
    try        { return await fn(args || {}, safeCtx); }
    catch (e)  { return { error: `tool ${name} threw: ${e?.message || String(e)}` }; }
}

function summarizeResult(name, result) {
    if (!result || typeof result !== 'object') return 'no result';
    if (result.error) return `error: ${String(result.error).slice(0, 60)}`;
    switch (name) {
        case 'search_logs': {
            const t = result.matches_total ?? 0;
            const r = (result.entries || []).length;
            return `${t} matches (${r} returned)`;
        }
        case 'count_messages': {
            if (result.groups) {
                const top = Object.entries(result.groups).sort((a, b) => b[1] - a[1]).slice(0, 3)
                    .map(([k, v]) => `${k}=${v}`).join(', ');
                return `count=${result.count} · ${top}`.slice(0, 80);
            }
            return `count=${result.count}`;
        }
        case 'get_streams':
            return `${(result.streams || []).length} streams`;
        case 'trace_request':
            return `${result.count ?? 0} entries for ${result.trace_id}`;
        case 'get_surrounding_logs':
            return `${(result.entries || []).length} entries around ${result.centred_on || ''}`;
        case 'get_message':
            return result.ts ? `entry @ ${result.ts}` : 'not found';
        case 'aggregate_logs': {
            const top = Object.entries(result.top || {}).slice(0, 3)
                .map(([k, v]) => `${k}=${v}`).join(', ');
            const trunc = result.truncated ? ' · truncated' : '';
            return `${result.total_matched} matched · ${top || 'no groups'}${trunc}`.slice(0, 80);
        }
        case 'analyze_incident': {
            if (!result.found) return `no trace ${result.trace_id || ''}`;
            const s = result.summary;
            return `${s.hops} hops · ${s.services_involved.length} svcs · ${s.errors_in_trace} errors · baseline ${s.baseline_errors_in_service} in ${s.anchor_service}`.slice(0, 80);
        }
        case 'fetch_url': {
            const ct = String(result.content_type || '').split(';')[0] || '?';
            const sz = (result.body || '').length;
            return `HTTP ${result.status} · ${ct} · ${sz}B${result.truncated ? ' (truncated)' : ''}`.slice(0, 80);
        }
        case 'dns_lookup': {
            const n = (result.answers || []).length;
            const sample = result.answers?.[0]?.data ? ` → ${result.answers[0].data}` : '';
            return `${n} ${result.type} record${n === 1 ? '' : 's'}${sample}`.slice(0, 80);
        }
        case 'http_headers': {
            const ct = result.headers?.['content-type'] || '?';
            const redir = result.redirected_to ? ` → ${result.redirected_to.slice(0, 30)}` : '';
            return `HTTP ${result.status} · ${ct}${redir}`.slice(0, 80);
        }
        case 'check_url_alive':
            return `${result.alive ? 'alive' : 'down'} · HTTP ${result.status ?? '?'} · ${result.latency_ms}ms`;
        case 'summarize_url': {
            const w = String(result.summary || '').split(/\s+/).filter(Boolean).length;
            return `${w} words · ${result.source_chars}B source${result.source_truncated ? ' (truncated)' : ''}`.slice(0, 80);
        }
        default:
            return 'ok';
    }
}

// ─── system prompt (Phase 2 · tools, not data) ───────────────────────

function buildSystemPrompt() {
    const services = Object.keys(DATASET.aggregates.by_service).join(', ');
    return `You are mcp-server-graylog — Pranav Jagadish's MCP server for Graylog log aggregation, running on a SANDBOX instance for a portfolio demo. You have 7 tools to introspect a 7-day window of logs across a 6-microservice fintech (services: ${services}). The dataset has ${DATASET.aggregates.total_entries} entries; "now" is 2026-05-13T12:00:00Z.

WORKFLOW:
1. Read the user question carefully.
2. Decide which tool(s) to call. Prefer count_messages for "how many" questions, search_logs for "find / show / what happened" questions, get_streams for "what services exist", trace_request when given just a trace_id to list, analyze_incident when asked to investigate / root-cause / analyze a SPECIFIC trace or incident (one call composes trace+surrounding+baseline — saves 2-3 rounds), get_surrounding_logs / get_message for context around a known timestamp.
3. After the tools return, write a CONCISE answer grounded only in the tool outputs.

INTERNET TOOLS (separate from graylog · these hit the REAL public web):
You also have 5 tools that perform real-world web I/O:
  · fetch_url        — GET a public HTTPS URL (50KB body cap)
  · dns_lookup       — DoH lookup for A/AAAA/CNAME/MX/TXT
  · http_headers     — HEAD only, reports redirects via redirected_to
  · check_url_alive  — quick reachability + latency check
  · summarize_url    — fetch + LLM-summary (capped at 2/request · costs tokens)
Use these ONLY when the user explicitly references a URL or hostname. Never invent URLs. Prefer dns_lookup for IP/MX questions over fetch_url. These tools answer real-world questions; the graylog tools above answer questions about the synthetic 7-day log dataset only — never mix them.

ANSWER STYLE:
- Concise · terminal aesthetic · monospace-friendly
- Use \`▸\` for bullets (not *, -, or •)
- Cite specific values (counts, service names, trace_ids, timestamps) from tool results
- Never fabricate data. If tools return nothing useful, say "no data on that in current snapshot"
- Keep responses under ${MAX_ANSWER_TOKENS} tokens
- End with one short "suggested: ..." action line when helpful
- Answer in-character as the MCP server · don't say "I'm simulated"`;
}

// ─── LLM call ────────────────────────────────────────────────────────

async function callLLM(messages, apiKey, opts = {}) {
    // Walk the model fallback chain. Retry on transient/DEGRADED upstream
    // failures (HTTP 400/429/5xx · network errors) but bail immediately on
    // a clean answer or on errors that look like client mistakes that
    // wouldn't change between models.
    let lastError = null;
    for (let i = 0; i < NIM_MODELS.length; i++) {
        const model = NIM_MODELS[i];
        const body = {
            model,
            messages,
            tools: TOOL_SCHEMAS,
            tool_choice: opts.toolChoice ?? 'auto',
            max_tokens: MAX_ANSWER_TOKENS,
            temperature: 0.4,
            stream: false,
        };
        let res;
        try {
            res = await fetch(NIM_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type':  'application/json',
                    'Accept':        'application/json',
                },
                body: JSON.stringify(body),
            });
        } catch (e) {
            lastError = { status: 502, error: `upstream LLM unreachable (${model}) · ${e?.message || 'fetch failed'}` };
            continue;  // try next model
        }

        if (res.ok) {
            let data;
            try { data = await res.json(); }
            catch { lastError = { status: 502, error: `upstream LLM returned non-JSON (${model})` }; continue; }
            // Annotate which model actually answered (used in response payload)
            return { ok: true, data, model_used: model };
        }

        // res not OK · decide whether to retry next model or surface immediately.
        // Strict transient gate: only 5xx + 429 (server-side faults) warrant
        // retrying a different model. Plain 4xx means WE sent something wrong —
        // Llama / Qwen would reject it the same way, so we'd just 3x our cost
        // for nothing. The lone 400-shaped exception is NIM's "DEGRADED function"
        // response which IS provider-side and DOES warrant fallback.
        const txt = await res.text().catch(() => '');
        const isTransient   = res.status === 429 || res.status >= 500;
        const isDegraded400 = res.status === 400 && /degraded function|capacity|unavailable/i.test(txt);
        // Pass through 429 to the client so they see "upstream rate-limited"
        // distinctly from a generic 502 bad-gateway.
        const surfaceStatus = res.status === 429 ? 429 : 502;
        lastError = { status: surfaceStatus, error: `upstream LLM error (${model}) · HTTP ${res.status}${txt ? ' · ' + txt.slice(0, 160) : ''}` };
        if (isTransient || isDegraded400) continue;  // try next model
        return lastError;  // non-retryable error · stop walking the chain
    }
    // Exhausted all models
    return lastError ?? { status: 502, error: 'all upstream LLM models failed' };
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

    if (!env.NVIDIA_API_KEY) {
        return errResp(500, 'server misconfigured · missing NVIDIA_API_KEY');
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

    // Pre-increment the rate counter: every attempt (success OR failure) spends
    // upstream NIM tokens, so we charge the visitor's 10/hr quota on attempt,
    // not on success. A degraded model + 3-way fallback chain otherwise lets
    // one bad request 3x our NIM cost without ever touching the quota.
    // KV has no atomic increment; the small race window (two concurrent reads
    // both seeing the same `cur`) is acceptable for a 10/hr-per-IP demo limit.
    try {
        await env.MCP_RATELIMIT.put(rateKey, String(cur + 1), { expirationTtl: 3600 });
    } catch (_) {}

    // ─── tool-calling loop ────────────────────────────────────────────
    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: q },
    ];
    const toolCallsLog = [];   // for the response payload
    const leakedCallIds = new Set();   // tc.id of calls recovered from [TOOL_CALLS] leak
    let finalAnswer = '';
    let rounds = 0;
    let modelUsed = NIM_MODEL;  // track which model actually answered (may differ on fallback)

    // Per-request context for tool handlers · enforces cumulative caps
    // (outbound fetches, summarize calls) and carries the NIM key needed
    // by summarize_url. Graylog tools ignore it.
    const ctx = {
        apiKey:          env.NVIDIA_API_KEY,
        outboundFetches: 0,
        summarizeCalls:  0,
    };

    for (let round = 1; round <= MAX_ROUNDS + 1; round++) {
        rounds = round;
        // On the (MAX_ROUNDS+1)th iteration, force a text-only answer
        const forceFinal = round > MAX_ROUNDS;
        const llm = await callLLM(messages, env.NVIDIA_API_KEY, { toolChoice: forceFinal ? 'none' : 'auto' });
        if (!llm.ok) return errResp(llm.status || 502, llm.error);
        if (llm.model_used) modelUsed = llm.model_used;

        const choice = llm.data?.choices?.[0];
        const msg    = choice?.message;
        if (!msg) return errResp(502, 'upstream LLM returned no message');

        let toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        let content   = (msg.content || '').trim();

        // ─── Mistral leak recovery ─────────────────────────────────────
        // Mistral Nemotron sometimes emits tool calls as text with
        // [TOOL_CALLS] markers instead of structured tool_calls. When we
        // see no structured calls AND we're not in the forced-final pass,
        // check the text content for leaked tool-call markup.  If found,
        // we PARSE the requested call, execute it for real (discarding
        // the LLM's hallucinated inline result), synthesize a structured
        // tool_calls entry, and continue the loop — exactly as if the
        // call had been emitted properly.
        if (toolCalls.length === 0 && !forceFinal && content.includes('[TOOL_CALLS]')) {
            const leaked = extractLeakedToolCalls(content);
            if (leaked.length > 0) {
                toolCalls = leaked.map((lc, i) => ({
                    id: `leak-r${round}-${i}`,
                    type: 'function',
                    function: { name: lc.name, arguments: JSON.stringify(lc.args) },
                }));
                // Mark these tc.ids as leak-recovered so the response payload
                // can flag them and the visitor sees the recovery happened.
                for (const tc of toolCalls) leakedCallIds.add(tc.id);
                content = '';   // discard the leaked text · we don't trust its fabricated "result"
            }
        }

        // If LLM produced no tool calls (or we're in the forced-final pass),
        // treat its content as the final answer and exit.
        if (toolCalls.length === 0 || forceFinal) {
            // Defensive: strip any residual [TOOL_CALLS] markup before returning
            // (covers the edge case where extractLeakedToolCalls couldn't parse
            // anything valid but markup is still in the text).
            finalAnswer = stripLeakMarkup(content) || (toolCalls.length === 0 ? '' : '(LLM exhausted tool budget without a final answer)');
            // Persist the assistant message (even if empty) for completeness
            messages.push({ role: 'assistant', content: finalAnswer });
            break;
        }

        // Append the assistant message that requested tool calls.
        // NIM/OpenAI expects assistant content to be a string (often empty) plus tool_calls.
        messages.push({
            role: 'assistant',
            content: content || '',
            tool_calls: toolCalls,
        });

        // Execute each requested tool & feed results back.
        for (const tc of toolCalls) {
            const name = tc?.function?.name || '';
            let parsedArgs = {};
            try { parsedArgs = JSON.parse(tc?.function?.arguments || '{}'); }
            catch (_) { parsedArgs = {}; }

            const result = await runTool(name, parsedArgs, ctx);
            const summary = summarizeResult(name, result);
            toolCallsLog.push({
                name,
                args: parsedArgs,
                result_summary: summary,
                result,
                source: leakedCallIds.has(tc.id) ? 'leaked-recovered' : 'structured',
            });

            messages.push({
                role: 'tool',
                tool_call_id: tc.id || `${name}-${toolCallsLog.length}`,
                content: JSON.stringify(result),
            });
        }
        // Loop continues — LLM gets the tool results and decides next step.
    }

    if (!finalAnswer) {
        return errResp(502, 'LLM produced no final answer after tool loop');
    }

    // Surface a one-line note when ANY tool call was recovered from a leak,
    // so the frontend can flag this as a "watch this — upstream model emitted
    // unstructured markup but we parsed it cleanly" moment.
    const note = leakedCallIds.size > 0
        ? `mistral nemotron emitted unstructured tool-call markup · parsed & recovered ${leakedCallIds.size} call${leakedCallIds.size > 1 ? 's' : ''}`
        : undefined;

    return jsonResp(200, {
        ok: true,
        question: q,
        tool_calls: toolCallsLog,
        final_answer: finalAnswer,
        rounds,
        model: modelUsed,
        models_available: NIM_MODELS,
        remaining: Math.max(0, RATE_LIMIT_PER_HOUR - cur - 1),
        dataset: {
            entries:  DATASET.aggregates.total_entries,
            services: Object.keys(DATASET.aggregates.by_service).length,
            errors:   DATASET.aggregates.by_level.ERROR || 0,
        },
        ...(note ? { note } : {}),
    });
}

function handleStatus() {
    return jsonResp(200, {
        name: 'mcp-server-graylog · sandbox demo',
        version: 'v2.3.0',
        phase: 2,
        model: NIM_MODEL,
        tools: TOOL_SCHEMAS.map(t => t.function.name),
        rate_limit_per_hour: RATE_LIMIT_PER_HOUR,
        max_question_chars: MAX_QUESTION_LEN,
        max_rounds: MAX_ROUNDS,
        dataset: {
            entries:         DATASET.aggregates.total_entries,
            services:        Object.keys(DATASET.aggregates.by_service).length,
            time_range:      DATASET.aggregates.time_range,
            top_error_count: (DATASET.aggregates.top_error_patterns[0] || {}).count || 0,
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
    return jsonResp(status, { ok: false, error: message });
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
    },
};

// ─── test export (for offline unit testing only · not used by Worker) ─
export const __test = {
    parseQuery,
    predicateFromQuery,
    tokenizeQuery,
    timeRangeCutoff,
    applyTimeRange,
    tool_search_logs,
    tool_count_messages,
    tool_get_streams,
    tool_trace_request,
    tool_get_surrounding_logs,
    tool_get_message,
    summarizeResult,
    DATASET,
    // Internet tools (require ctx and a working `fetch` global for real use):
    tool_fetch_url,
    tool_dns_lookup,
    tool_http_headers,
    tool_check_url_alive,
    tool_summarize_url,
    readBodyWithCap,
    stripHtmlForSummary,
    runTool,
    TOOL_SCHEMAS,
};
