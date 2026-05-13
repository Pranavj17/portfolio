/**
 * Minimal MCP (Model Context Protocol) stdio server.
 *
 * Exposes portfolio content as MCP tools so Claude Desktop and any other
 * MCP host can query Pranav's CV in natural language:
 *
 *   claude mcp add pranav-j -- npx pranav-j --mcp
 *
 * Then in Claude: "use pranav-j to summarize his MCP experience" etc.
 *
 * Hand-rolled JSON-RPC 2.0 over stdio · no SDK dep. Matches the protocol
 * shape Anthropic's reference servers use (initialize / tools/list /
 * tools/call + notifications/initialized). Spec version 2024-11-05.
 */

const content = require('./content');

const SERVER_INFO = {
    name:    'pranav-j',
    version: '1.1.0',
};

const PROTOCOL_VERSION = '2024-11-05';

// ─── tool schemas ────────────────────────────────────────────────────

const TOOLS = [
    {
        name: 'get_about',
        description: "Short overview of Pranav: who he is, what he focuses on, his anthropic MCP catalog contribution.",
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_experience',
        description: 'Pranav\'s professional experience — companies, dates, and 3-5 bullet points per role.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_skills',
        description: 'Pranav\'s technical skills grouped by category (languages, ai/ml, systems, infra, tools).',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_projects',
        description: 'Pranav\'s notable projects — name, one-line description, and source URL.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_contact',
        description: 'Ways to reach Pranav — site, github, linkedin, medium, email.',
        inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_writing',
        description: 'Latest Medium posts from @jpranav97. Optional `limit` (default 5, max 10). Falls back to a static handle if the RSS feed is unreachable.',
        inputSchema: {
            type: 'object',
            properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
            required: [],
        },
    },
    {
        name: 'get_recent_activity',
        description: 'Recent public GitHub push events for Pranav. Optional `limit` (default 5, max 10).',
        inputSchema: {
            type: 'object',
            properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
            required: [],
        },
    },
];

// ─── content formatters · each returns a plain string ────────────────

function fmtAbout() { return content.ABOUT; }

function fmtExperience() {
    const lines = [];
    for (const role of content.EXPERIENCE) {
        lines.push(`${role.company}  ·  ${role.period}`);
        for (const b of role.bullets) lines.push(`  ▸ ${b}`);
        lines.push('');
    }
    const ed = content.EDUCATION;
    lines.push(`education  ·  ${ed.school}`);
    lines.push(`  ${ed.degree} · ${ed.period} · ${ed.detail}`);
    return lines.join('\n');
}

function fmtSkills() {
    const w = Math.max(...content.SKILLS.map(([k]) => k.length));
    return content.SKILLS.map(([k, v]) => `${k.padEnd(w)}  ${v}`).join('\n');
}

function fmtProjects() {
    return content.PROJECTS.map(p => `${p.name}\n  ${p.desc}\n  ${p.url}`).join('\n\n');
}

function fmtContact() {
    const w = Math.max(...content.CONTACT.map(([k]) => k.length));
    return content.CONTACT.map(([k, v]) => `${k.padEnd(w)}  ${v}`).join('\n');
}

async function fmtWriting(limit) {
    let live;
    try { live = require('./live'); } catch (_) {}
    const lim = Math.min(10, Math.max(1, parseInt(limit ?? 5, 10) || 5));
    if (live?.fetchMediumPosts) {
        const result = await live.fetchMediumPosts(lim);
        if (result.items && result.items.length > 0) {
            return result.items.map(p => `▸ ${p.title}\n  ${p.date} · ${p.url}`).join('\n\n');
        }
    }
    return `medium @jpranav97 · ${content.WRITING.topics}\n${content.WRITING.url}\n(live feed unavailable · showing static handle)`;
}

async function fmtRecentActivity(limit) {
    let live;
    try { live = require('./live'); } catch (_) {}
    const lim = Math.min(10, Math.max(1, parseInt(limit ?? 5, 10) || 5));
    if (live?.fetchGitHubActivity) {
        const result = await live.fetchGitHubActivity(lim);
        if (result.items && result.items.length > 0) {
            return result.items.map(e => `▸ ${e.repo}\n  ${e.date} · ${e.message}`).join('\n\n');
        }
    }
    return `github.com/Pranavj17\n(live activity feed unavailable)`;
}

// ─── JSON-RPC plumbing ───────────────────────────────────────────────

function jsonResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
}
function jsonError(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}
function toolText(text) {
    return { content: [{ type: 'text', text: String(text) }] };
}

async function handleToolCall(id, params) {
    const name = params?.name;
    const args = params?.arguments || {};
    try {
        switch (name) {
            case 'get_about':       return jsonResponse(id, toolText(fmtAbout()));
            case 'get_experience':  return jsonResponse(id, toolText(fmtExperience()));
            case 'get_skills':      return jsonResponse(id, toolText(fmtSkills()));
            case 'get_projects':    return jsonResponse(id, toolText(fmtProjects()));
            case 'get_contact':     return jsonResponse(id, toolText(fmtContact()));
            case 'get_writing':         return jsonResponse(id, toolText(await fmtWriting(args.limit)));
            case 'get_recent_activity': return jsonResponse(id, toolText(await fmtRecentActivity(args.limit)));
            default: return jsonError(id, -32602, `unknown tool: ${name}`);
        }
    } catch (e) {
        return jsonError(id, -32603, `tool ${name} failed: ${e?.message || String(e)}`);
    }
}

async function handleMessage(msg) {
    const { id, method, params } = msg || {};
    // Notifications (no id) get no response.
    if (typeof method !== 'string') return null;

    if (method === 'initialize') {
        return jsonResponse(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities:    { tools: {} },
            serverInfo:      SERVER_INFO,
        });
    }
    if (method === 'tools/list') {
        return jsonResponse(id, { tools: TOOLS });
    }
    if (method === 'tools/call') {
        return await handleToolCall(id, params);
    }
    if (method === 'ping') {
        return jsonResponse(id, {});
    }
    if (method.startsWith('notifications/')) return null;
    return jsonError(id, -32601, `method not found: ${method}`);
}

function start() {
    // Log boot to stderr so it doesn't pollute the stdio JSON-RPC channel.
    process.stderr.write(`pranav-j MCP server v${SERVER_INFO.version} · listening on stdio · ${TOOLS.length} tools\n`);

    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
        buffer += chunk;
        // Process complete newline-delimited messages.
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            let msg;
            try { msg = JSON.parse(line); }
            catch (e) {
                process.stderr.write(`pranav-j MCP · invalid JSON · ${e.message}\n`);
                continue;
            }
            const resp = await handleMessage(msg);
            if (resp) process.stdout.write(JSON.stringify(resp) + '\n');
        }
    });
    process.stdin.on('end', () => process.exit(0));
}

module.exports = { start, TOOLS };
