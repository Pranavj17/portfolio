/**
 * Single source of truth for portfolio content used by every render mode:
 *   - static print (index.js)
 *   - --mcp stdio server (lib/mcp.js)
 *   - --live mode (lib/live.js)
 *
 * Plain data exports only — no formatting, no colors. Renderers handle
 * presentation. Adding a new section means: add to this file + render in
 * index.js + (optionally) expose as a tool in lib/mcp.js.
 */

const ABOUT = `builds autonomous ai agents for production rca. specializes in elixir, distributed systems, and the model context protocol ecosystem. anthropic mcp catalog contributor (mcp-server-graylog · pr #2913).`;

const EXPERIENCE = [
    {
        company: 'scripbox',
        period:  'sep 2022 – present',
        bullets: [
            'ai agent automation platform · 10+ eng hours/week saved',
            'mcp-server-graylog · official anthropic catalog',
            'openclaw gateway · sentry triage + auto-fix MR pipeline',
            'memory mcp server · postgres-backed claude desktop memory',
            'kubernetes migration · 11 services on EKS · zero-downtime',
        ],
    },
    {
        company: 'sakha global',
        period:  'jul 2019 – sep 2022',
        bullets: [
            'senior dev · elixir · payment processing · 99.99% sla',
            'built form builder dsl · in-house low-code engine',
        ],
    },
];

const EDUCATION = {
    school:  'dayananda sagar college of engineering',
    degree:  'mechanical engineering',
    period:  '2015–2019',
    detail:  'cgpa 7.75',
};

const SKILLS = [
    ['languages', 'elixir · ruby · javascript · python (learning)'],
    ['ai/ml',     'mcp · claude api · openai sdk · ollama · lora (learning)'],
    ['systems',   'distributed systems · postgresql · kafka · redis'],
    ['infra',     'cloudflare workers · kubernetes · docker · grafana · sentry'],
    ['tools',     'gitlab ci · github actions · asana · graylog'],
];

const PROJECTS = [
    { name: 'live mcp demo',      desc: 'real LLM + 12 tools · graylog + internet I/O', url: 'pranavjagadish.com' },
    { name: 'mcp-server-graylog', desc: 'official anthropic catalog · npm + github',    url: 'github.com/Pranavj17/mcp-server-graylog' },
    { name: 'memory mcp server',  desc: 'postgres-backed claude desktop memory',        url: '~/Documents/memory' },
    { name: 'openclaw',           desc: 'slack agent gateway · 8 skills · 9 channels',  url: 'private · production at scripbox' },
    { name: 'url-safety',         desc: 'cloudflare workers SSRF guard · 48 tests',     url: 'github.com/Pranavj17/portfolio/cli' },
    { name: 'pranav-j',           desc: 'this CLI + MCP server',                        url: 'npmjs.com/package/pranav-j' },
];

const WRITING = {
    handle: 'medium @jpranav97',
    url:    'medium.com/@jpranav97',
    topics: 'ai agents · mcp · ops automation',
};

const CONTACT = [
    ['site',     'pranavjagadish.com'],
    ['github',   'github.com/Pranavj17'],
    ['linkedin', 'linkedin.com/in/pranav-jagadish-9392137a'],
    ['medium',   'medium.com/@jpranav97'],
    ['email',    'jpranav97@gmail.com'],
];

const HEADER = {
    name:     'pranav j',
    title:    'senior software engineer · ai infrastructure',
    location: 'bangalore, india · 6+ years · open to remote',
};

const FOOTER = `looking for senior eng / staff roles in ai infra or mcp tooling. full portfolio + live mcp demo: pranavjagadish.com`;

module.exports = {
    ABOUT, EXPERIENCE, EDUCATION, SKILLS, PROJECTS, WRITING, CONTACT, HEADER, FOOTER,
};
