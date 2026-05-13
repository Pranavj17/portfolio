#!/usr/bin/env node
/**
 * pranav-j · Pranav Jagadish's portfolio in your terminal.
 *
 *   npx pranav-j                # full portfolio
 *   npx pranav-j --resume       # experience + skills
 *   npx pranav-j --projects     # projects section only
 *   npx pranav-j --contact      # contact info
 *   npx pranav-j --live         # ↑ + latest medium posts + recent commits
 *   npx pranav-j --mcp          # run as MCP server (stdio JSON-RPC)
 *   npx pranav-j --no-color     # strip ANSI · pipe-safe
 *   npx pranav-j --help         # usage
 *
 * Static print + flag dispatch — no interactive prompts. Runtime deps:
 * picocolors only (3 kB, zero transitive deps). All content lives in
 * lib/content.js; renderers (this file) and MCP server (lib/mcp.js)
 * read from there.
 */
const c = require('picocolors');
const content = require('./lib/content');

const args = process.argv.slice(2);

// --mcp short-circuits everything else · stdio JSON-RPC server mode.
// stdout is reserved for JSON-RPC messages, so we MUST NOT print anything
// here outside of lib/mcp.js's own framing.
if (args.includes('--mcp')) {
    require('./lib/mcp').start();
    return;   // top-level await isn't available without "type": "module"; explicit return.
}

const useColor = !args.includes('--no-color')
              && process.env.NO_COLOR === undefined
              && process.stdout.isTTY;

const fg = useColor ? c : Object.keys(c).reduce((acc, k) => {
    acc[k] = (s) => s;
    return acc;
}, {});

const ACCENT = fg.green;
const MUTED  = fg.gray;
const BOLD   = fg.bold;
const DIM    = fg.dim;
const HL     = (s) => fg.bold(fg.cyan(s));

const W = Math.min(process.stdout.columns || 78, 78);

// ─── render helpers ─────────────────────────────────────────────────

function rule() {
    return MUTED('─'.repeat(W));
}
function section(title) {
    console.log('  ' + BOLD(ACCENT(title.toUpperCase())));
    console.log('  ' + MUTED('─'.repeat(Math.min(W - 2, title.length + 6))));
}
function header() {
    console.log();
    console.log('  ' + rule());
    console.log('   ' + BOLD(ACCENT(content.HEADER.name)) + MUTED(' · ') + content.HEADER.title.split(' · ').map((s, i) => i === 1 ? ACCENT(s) : MUTED(s)).join(MUTED(' · ')));
    console.log('   ' + MUTED(content.HEADER.location));
    console.log('  ' + rule());
    console.log();
}

function about() {
    section('about');
    // soft-wrap the paragraph for the current width (W chars)
    const words = content.ABOUT.split(/\s+/);
    let line = '  ';
    for (const word of words) {
        if ((line + word).length > W - 4) {
            console.log(line.trimEnd());
            line = '  ' + word + ' ';
        } else {
            line += word + ' ';
        }
    }
    if (line.trim()) console.log(line.trimEnd());
    console.log();
}

function experience() {
    section('experience');
    for (const role of content.EXPERIENCE) {
        console.log('  ' + BOLD(role.company) + MUTED('  ·  ' + role.period));
        for (const b of role.bullets) {
            console.log('    ' + ACCENT('▸') + ' ' + b);
        }
        console.log();
    }
    const ed = content.EDUCATION;
    console.log('  ' + BOLD('education') + MUTED('  ·  ' + ed.school));
    console.log('    ' + DIM('  ' + ed.degree + ' · ' + ed.period + ' · ' + ed.detail));
    console.log();
}

function skills() {
    section('skills');
    const labelW = Math.max(...content.SKILLS.map(([k]) => k.length));
    for (const [k, v] of content.SKILLS) {
        console.log('  ' + ACCENT(k.padEnd(labelW)) + '  ' + v);
    }
    console.log();
}

function projects() {
    section('projects');
    const nameW = Math.max(...content.PROJECTS.map(p => p.name.length));
    for (const p of content.PROJECTS) {
        console.log('  ' + BOLD(p.name.padEnd(nameW)) + '  ' + MUTED(p.desc));
        console.log('  ' + ' '.repeat(nameW + 2) + DIM(p.url));
    }
    console.log();
}

function writing() {
    section('writing');
    console.log('  ' + ACCENT('▸') + ' ' + content.WRITING.handle + ' · ' + content.WRITING.topics);
    console.log('    ' + DIM(content.WRITING.url));
    console.log();
}

function contact() {
    section('connect');
    const labelW = Math.max(...content.CONTACT.map(([k]) => k.length));
    for (const [k, v] of content.CONTACT) {
        console.log('  ' + ACCENT(k.padEnd(labelW)) + '  ' + v);
    }
    console.log();
}

function footer() {
    console.log('  ' + rule());
    console.log('  ' + MUTED(content.FOOTER));
    console.log('  ' + rule());
    console.log();
}

// ─── --live extras ──────────────────────────────────────────────────

async function liveExtras() {
    let live;
    try { live = require('./lib/live'); }
    catch (e) {
        console.log('  ' + MUTED('(live mode unavailable: ' + e.message + ')'));
        return;
    }

    console.log('  ' + DIM('fetching latest activity…'));
    const [medium, gh] = await Promise.all([
        live.fetchMediumPosts(5),
        live.fetchGitHubActivity(5),
    ]);
    // Move cursor up one line + clear the "fetching..." note for a clean
    // result. Falls back gracefully on non-ANSI terminals.
    if (useColor) process.stdout.write('\x1b[1A\x1b[2K');

    section('latest writing');
    if (medium.error) {
        console.log('  ' + MUTED('(' + medium.error + ' · showing static handle)'));
        console.log('  ' + ACCENT('▸') + ' ' + content.WRITING.handle + ' · ' + content.WRITING.topics);
    } else if (medium.items.length === 0) {
        console.log('  ' + MUTED('(no recent posts)'));
    } else {
        for (const p of medium.items) {
            console.log('  ' + ACCENT('▸') + ' ' + p.title);
            console.log('    ' + DIM(p.date + ' · ' + p.url));
        }
    }
    console.log();

    section('recent commits');
    if (gh.error) {
        console.log('  ' + MUTED('(' + gh.error + ')'));
    } else if (gh.items.length === 0) {
        console.log('  ' + MUTED('(no recent push events)'));
    } else {
        const repoW = Math.max(...gh.items.map(e => e.repo.length));
        for (const e of gh.items) {
            console.log('  ' + ACCENT('▸') + ' ' + BOLD(e.repo.padEnd(repoW)) + '  ' + MUTED(e.date));
            if (e.message) console.log('    ' + DIM(e.message));
        }
    }
    console.log();
}

// ─── help ───────────────────────────────────────────────────────────

function printHelp() {
    console.log(`
  ${BOLD('npx pranav-j')} ${MUTED('· pranav jagadish\'s portfolio in your terminal')}

  ${BOLD('USAGE')}
    npx pranav-j ${MUTED('[--resume|--projects|--contact|--live|--mcp|--no-color|--help]')}

  ${BOLD('OPTIONS')}
    ${ACCENT('--resume')}     experience + skills
    ${ACCENT('--projects')}   projects section only
    ${ACCENT('--contact')}    contact info
    ${ACCENT('--live')}       full portfolio + latest medium posts + recent commits
    ${ACCENT('--mcp')}        run as MCP server on stdio (for Claude Desktop)
    ${ACCENT('--no-color')}   strip ANSI colors (pipe-safe)
    ${ACCENT('--help')}       this message

  ${BOLD('EXAMPLES')}
    ${MUTED('# default · static snapshot')}
    npx pranav-j

    ${MUTED('# pipe to a file')}
    npx pranav-j --no-color > pranav.txt

    ${MUTED('# include latest medium + commits')}
    npx pranav-j --live

    ${MUTED('# expose as MCP server for Claude Desktop')}
    claude mcp add pranav-j -- npx pranav-j --mcp

  ${BOLD('LIVE DEMO')}
    ${HL('pranavjagadish.com')} ${MUTED('· interactive shell with real-LLM MCP demo')}
`);
}

// ─── dispatch ───────────────────────────────────────────────────────

(async () => {
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
    } else if (args.includes('--resume')) {
        header(); experience(); skills(); footer();
    } else if (args.includes('--projects')) {
        header(); projects(); footer();
    } else if (args.includes('--contact')) {
        header(); contact(); footer();
    } else if (args.includes('--live')) {
        header();
        about();
        experience();
        skills();
        projects();
        await liveExtras();
        contact();
        footer();
    } else {
        header();
        about();
        experience();
        skills();
        projects();
        writing();
        contact();
        footer();
    }
})().catch((e) => {
    process.stderr.write(`pranav-j: ${e?.message || e}\n`);
    process.exit(1);
});
