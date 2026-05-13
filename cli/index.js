#!/usr/bin/env node
/**
 * pranav-j · Pranav Jagadish's portfolio in your terminal.
 *
 *   npx pranav-j                # full portfolio
 *   npx pranav-j --resume       # experience + skills
 *   npx pranav-j --projects     # projects section only
 *   npx pranav-j --contact      # contact info
 *   npx pranav-j --no-color     # strip ANSI · pipe-safe
 *   npx pranav-j --help         # usage
 *
 * Static print + exit by design — no interactive prompts. Honors the
 * existing terminal-portfolio convention so visitors can `npx pranav-j
 * > pranav.txt` or pipe to less without ANSI noise.
 *
 * Only runtime dependency: picocolors (3KB, no transitive deps).
 */
const c = require('picocolors');

const args = process.argv.slice(2);
const useColor = !args.includes('--no-color')
              && process.env.NO_COLOR === undefined
              && process.stdout.isTTY;

// When color is disabled, fall through to identity functions so the
// rest of the code reads the same.
const fg = useColor ? c : Object.keys(c).reduce((acc, k) => {
    acc[k] = (s) => s;
    return acc;
}, {});

// ─── ascii palette ──────────────────────────────────────────────────

const ACCENT = fg.green;
const MUTED  = fg.gray;
const BOLD   = fg.bold;
const DIM    = fg.dim;
const HL     = (s) => fg.bold(fg.cyan(s));

// Width hint — clamp lines that go wider than this on narrow terminals.
// 78 is the conservative "looks fine on most setups" default.
const W = Math.min(process.stdout.columns || 78, 78);

// ─── sections ───────────────────────────────────────────────────────

function rule() {
    return MUTED('─'.repeat(W));
}

function header() {
    console.log();
    console.log('  ' + rule());
    console.log('   ' + BOLD(ACCENT('pranav j')) + MUTED(' · senior software engineer · ') + ACCENT('ai infrastructure'));
    console.log('   ' + MUTED('bangalore, india · 6+ years · open to remote'));
    console.log('  ' + rule());
    console.log();
}

function section(title) {
    console.log('  ' + BOLD(ACCENT(title.toUpperCase())));
    console.log('  ' + MUTED('─'.repeat(Math.min(W - 2, title.length + 6))));
}

function about() {
    section('about');
    console.log('  builds autonomous ai agents for production rca.');
    console.log('  specializes in elixir, distributed systems, and the model');
    console.log('  context protocol ecosystem. anthropic mcp catalog contributor');
    console.log('  (' + HL('mcp-server-graylog') + ' · ' + MUTED('pr #2913') + ').');
    console.log();
}

function experience() {
    section('experience');
    console.log('  ' + BOLD('scripbox') + MUTED('  ·  sep 2022 – present'));
    console.log('    ' + ACCENT('▸') + ' ai agent automation platform · 10+ eng hours/week saved');
    console.log('    ' + ACCENT('▸') + ' mcp-server-graylog · official anthropic catalog');
    console.log('    ' + ACCENT('▸') + ' openclaw gateway · sentry triage + auto-fix MR pipeline');
    console.log('    ' + ACCENT('▸') + ' memory mcp server · postgres-backed claude desktop memory');
    console.log('    ' + ACCENT('▸') + ' kubernetes migration · 11 services on EKS · zero-downtime');
    console.log();
    console.log('  ' + BOLD('sakha global') + MUTED('  ·  jul 2019 – sep 2022'));
    console.log('    ' + ACCENT('▸') + ' senior dev · elixir · payment processing · 99.99% sla');
    console.log('    ' + ACCENT('▸') + ' built form builder dsl · in-house low-code engine');
    console.log();
    console.log('  ' + BOLD('education') + MUTED('  ·  dayananda sagar college of engineering'));
    console.log('    ' + DIM('  mechanical engineering · 2015–2019 · cgpa 7.75'));
    console.log();
}

function skills() {
    section('skills');
    const stacks = [
        ['languages',  'elixir · ruby · javascript · python (learning)'],
        ['ai/ml',      'mcp · claude api · openai sdk · ollama · lora (learning)'],
        ['systems',    'distributed systems · postgresql · kafka · redis'],
        ['infra',      'cloudflare workers · kubernetes · docker · grafana · sentry'],
        ['tools',      'gitlab ci · github actions · asana · graylog'],
    ];
    const labelW = Math.max(...stacks.map(([k]) => k.length));
    for (const [k, v] of stacks) {
        console.log('  ' + ACCENT(k.padEnd(labelW)) + '  ' + v);
    }
    console.log();
}

function projects() {
    section('projects');
    const ps = [
        ['live mcp demo',       'real LLM + 12 tools · graylog + internet I/O', 'pranavjagadish.com'],
        ['mcp-server-graylog',  'official anthropic catalog · npm + github',     'github.com/Pranavj17/mcp-server-graylog'],
        ['memory mcp server',   'postgres-backed claude desktop memory',         '~/Documents/memory'],
        ['openclaw',            'slack agent gateway · 8 skills · 9 channels',   'private · production at scripbox'],
        ['url-safety',          'cloudflare workers SSRF guard · 48 tests',      'github.com/Pranavj17/portfolio/cli'],
    ];
    const nameW = Math.max(...ps.map(([n]) => n.length));
    for (const [name, desc, url] of ps) {
        console.log('  ' + BOLD(name.padEnd(nameW)) + '  ' + MUTED(desc));
        console.log('  ' + ' '.repeat(nameW + 2) + DIM(url));
    }
    console.log();
}

function writing() {
    section('writing');
    console.log('  ' + ACCENT('▸') + ' medium @jpranav97 · ai agents, mcp, ops automation');
    console.log('    ' + DIM('medium.com/@jpranav97'));
    console.log();
}

function contact() {
    section('connect');
    const links = [
        ['site',     'pranavjagadish.com'],
        ['github',   'github.com/Pranavj17'],
        ['linkedin', 'linkedin.com/in/pranav-jagadish-9392137a'],
        ['medium',   'medium.com/@jpranav97'],
        ['email',    'jpranav97@gmail.com'],
    ];
    const labelW = Math.max(...links.map(([k]) => k.length));
    for (const [k, v] of links) {
        console.log('  ' + ACCENT(k.padEnd(labelW)) + '  ' + v);
    }
    console.log();
}

function footer() {
    console.log('  ' + rule());
    console.log('  ' + MUTED('looking for senior eng / staff roles in ai infra or mcp tooling.'));
    console.log('  ' + MUTED('full portfolio + live mcp demo: ') + HL('pranavjagadish.com'));
    console.log('  ' + rule());
    console.log();
}

function printHelp() {
    console.log(`
  ${BOLD('npx pranav-j')} ${MUTED('· pranav jagadish\'s portfolio in your terminal')}

  ${BOLD('USAGE')}
    npx pranav-j ${MUTED('[--resume|--projects|--contact|--no-color|--help]')}

  ${BOLD('OPTIONS')}
    ${ACCENT('--resume')}     experience + skills
    ${ACCENT('--projects')}   projects section only
    ${ACCENT('--contact')}    contact info
    ${ACCENT('--no-color')}   strip ANSI colors (pipe-safe)
    ${ACCENT('--help')}       this message

  ${BOLD('EXAMPLES')}
    ${MUTED('# pipe to a file')}
    npx pranav-j --no-color > pranav.txt
    ${MUTED('# just the resume')}
    npx pranav-j --resume
    ${MUTED('# share with someone')}
    echo "run: ${ACCENT('npx pranav-j')}" | mail manager@company.com

  ${BOLD('LIVE DEMO')}
    ${HL('pranavjagadish.com')} ${MUTED('· interactive shell with real-LLM MCP demo')}
`);
}

// ─── dispatch ───────────────────────────────────────────────────────

if (args.includes('--help') || args.includes('-h')) {
    printHelp();
} else if (args.includes('--resume')) {
    header(); experience(); skills(); footer();
} else if (args.includes('--projects')) {
    header(); projects(); footer();
} else if (args.includes('--contact')) {
    header(); contact(); footer();
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
