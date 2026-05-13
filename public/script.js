/* ============================================================
   PRODUCTION TERMINAL — interactive controller
   Handles: clock · uptime · scroll-spy · keybindings ·
            boot sequence · theme cycle · live console · easter eggs
   ============================================================ */
(() => {
    'use strict';

    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    /* intro state — body.intro-done triggers the page-reveal transitions.
       on return visits (bootSeen set) we add it immediately so panels
       stagger in normally. on first visit we leave it off until the
       matrix begins fading out, so panels crossfade in as matrix fades. */
    const FIRST_VISIT = !sessionStorage.getItem('bootSeen');
    if (!FIRST_VISIT) {
        // double-rAF so the initial hidden state paints once before transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.classList.add('intro-done');
            });
        });
    }
    const markIntroDone = () => document.body.classList.add('intro-done');

    /* ─────── 1. STATUS BAR · live clock + career uptime ─────── */
    const clockEl  = $('#clock');
    const uptimeEl = $('#uptime');

    function tickClock() {
        if (!clockEl) return;
        const ist = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false, timeZone: 'Asia/Kolkata'
        }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
        clockEl.textContent = `${ist.hour}:${ist.minute}:${ist.second} IST`;
    }

    function tickUptime() {
        if (!uptimeEl) return;
        const start = new Date('2019-07-01T00:00:00');
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();
        if (days < 0) {
            months -= 1;
            const prev = new Date(now.getFullYear(), now.getMonth(), 0);
            days += prev.getDate();
        }
        if (months < 0) { years -= 1; months += 12; }
        uptimeEl.textContent = `↑ ${years}y ${months}m ${days}d`;
    }
    tickClock();   setInterval(tickClock,  1000);
    tickUptime();  setInterval(tickUptime, 60_000);

    /* ─────── 2. HTOP bar fills ─────── */
    $$('.bar[data-fill]').forEach(b => b.style.setProperty('--fill', b.dataset.fill + '%'));

    /* ─────── 3. TAB clicks + scroll-spy ─────── */
    const tabs = $$('.tab');
    const sections = $$('main > section.panel');
    tabs.forEach(tab => tab.addEventListener('click', e => {
        e.preventDefault();
        const id = tab.getAttribute('href').slice(1);
        $('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    if ('IntersectionObserver' in window && sections.length) {
        const obs = new IntersectionObserver(entries => {
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            const id = visible.target.id;
            tabs.forEach(t => t.classList.toggle('active', t.getAttribute('href') === `#${id}`));
        }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
        sections.forEach(s => obs.observe(s));
    }

    /* ─────── 3.5 AUDIO subsystem (lazy WebAudio) ─────── */
    let audioCtx = null;
    let audioOn = localStorage.getItem('audio') === '1';

    function ensureAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch (_) { audioCtx = null; }
        }
        return audioCtx;
    }

    function playClick() {
        if (!audioOn) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.018);
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.045);
    }

    function playBlip() {
        if (!audioOn) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.06);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    function playBoot() {
        if (!audioOn) return;
        const ctx = ensureAudio();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
    }

    /* ─────── 4. TOAST ─────── */
    const toastEl = $('#toast');
    let toastTimer = null;
    function toast(html, ms = 1400) {
        if (!toastEl) return;
        toastEl.innerHTML = html;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
    }

    /* ─────── 5. THEME cycler ─────── */
    const THEMES = [
        { id: 'phosphor', label: 'phosphor green' },
        { id: 'amber',    label: 'amber CRT' },
        { id: 'ibm',      label: 'IBM 3270' },
        { id: 'paper',    label: 'paper · light' },
        { id: 'monokai',  label: 'monokai · classic dev' },
        { id: 'dracula',  label: 'dracula' },
        { id: 'nord',     label: 'nord · cool blue' },
    ];
    function getTheme() {
        return localStorage.getItem('theme') ||
               document.body.dataset.theme ||
               'phosphor';
    }
    function applyTheme(id, announce = false) {
        const theme = THEMES.find(t => t.id === id) || THEMES[0];
        document.body.dataset.theme = theme.id;
        try { localStorage.setItem('theme', theme.id); } catch (_) {}
        // update meta theme-color so iOS chrome matches
        const meta = $('meta[name="theme-color"]');
        if (meta) {
            const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
            if (bg) meta.setAttribute('content', bg);
        }
        if (announce) toast(`<span class="toast-key">theme</span>${theme.label}`);
    }
    function cycleTheme() {
        const cur = getTheme();
        const idx = Math.max(0, THEMES.findIndex(t => t.id === cur));
        applyTheme(THEMES[(idx + 1) % THEMES.length].id, true);
        playBlip();
    }
    applyTheme(getTheme(), false);

    /* ─────── 5.5 utility helpers ─────── */
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const escapeHtml = s => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    /* ─────── 6. CONSOLE — typeable shell ─────── */
    const consoleEl   = $('#console');
    const consoleOut  = $('#console-out');
    const consoleForm = $('#console-form');
    const consoleInp  = $('#console-input');
    const consoleClose = $('#console-close');

    // Ghost-text suggestion (fish-style). The DOM lives in index.html;
    // here we just hold refs and define the update/accept helpers. The
    // COMMANDS map is defined later in this scope; we close over its name
    // and look it up lazily on first call.
    const consoleGhostWrap = $('#console-ghost');
    const consoleGhostPad  = consoleGhostWrap?.querySelector('.g-pad');
    const consoleGhostText = consoleGhostWrap?.querySelector('.g-ghost');
    let _commandNamesCache = null;
    function updateGhost() {
        if (!consoleGhostPad || !consoleGhostText) return;
        const v = consoleInp?.value ?? '';
        // Only suggest on the first word — once the user has typed a space,
        // they're working on arguments and we don't have arg-aware completion
        // (yet). Also bail on empty input.
        if (!v || /\s/.test(v)) {
            consoleGhostPad.textContent  = '';
            consoleGhostText.textContent = '';
            return;
        }
        if (_commandNamesCache === null && typeof COMMANDS !== 'undefined') {
            _commandNamesCache = Object.keys(COMMANDS).sort();
        }
        if (!_commandNamesCache) return;
        // Claude Code-style `/foo` prefix: treat `/foo` as a search for `foo`.
        // A lone `/` suggests the alphabetically-first command, so the visitor
        // gets a discoverable starting hint just by hitting `/`.
        const hasSlash = v.startsWith('/');
        const pre = (hasSlash ? v.slice(1) : v).toLowerCase();
        const match = pre === ''
            ? (hasSlash ? _commandNamesCache[0] : null)
            : _commandNamesCache.find(c => c.startsWith(pre) && c !== pre);
        if (match) {
            consoleGhostPad.textContent  = v;
            consoleGhostText.textContent = match.slice(pre.length);
        } else {
            consoleGhostPad.textContent  = '';
            consoleGhostText.textContent = '';
        }
    }
    function acceptGhost() {
        if (!consoleGhostText?.textContent) return false;
        consoleInp.value = consoleInp.value + consoleGhostText.textContent + ' ';
        updateGhost();
        return true;
    }

    const history = [];
    let histIdx = -1;
    let draft = '';
    // Guards against overlapping `mcp <q>` invocations interleaving their
    // tool-call streams into the same terminal output. The fetch + the
    // staggered tool-call animation can take 5-15s end to end.
    let mcpInFlight = false;

    function consoleOpen() {
        if (!consoleEl) return;
        consoleEl.classList.add('open');
        // `inert` removes the entire subtree from the a11y tree + focus
        // order — preferred over aria-hidden which Lighthouse flags when
        // the hidden subtree contains focusable elements (input, button)
        consoleEl.removeAttribute('inert');
        if (!consoleOut.dataset.greeted) {
            print('shell ready · session @ ' + new Date().toISOString().slice(0,16).replace('T', ' ') + ' UTC', 'muted');
            print("type 'help' to see what i answer to · type 'exit' to close", 'muted');
            consoleOut.dataset.greeted = '1';
        }
        setTimeout(() => consoleInp?.focus(), 220);
    }
    function consoleClose_() {
        consoleEl?.classList.remove('open');
        consoleEl?.setAttribute('inert', '');
        consoleInp?.blur();
    }
    function consoleToggle() {
        if (consoleEl?.classList.contains('open')) consoleClose_();
        else consoleOpen();
    }

    function print(text, cls = '') {
        const div = document.createElement('div');
        div.className = 'console-line' + (cls ? ' ' + cls : '');
        if (typeof text === 'string') div.innerHTML = text;
        else div.appendChild(text);
        consoleOut.appendChild(div);
        consoleOut.scrollTop = consoleOut.scrollHeight;
    }
    function printEcho(input) {
        const safe = input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        print(`<span class="prompt">pranavjagadish</span>:<span class="path">~</span>$ <span class="cmd">${safe}</span>`, 'echo');
    }

    /* ── MCP simulated responses ──
       intent-matched canned responses styled like real
       mcp-server-graylog output. ordered specific → general so
       e.g. "what errors" hits the error matcher, not the meta. */
    function mcpResponse(q, original) {
        if (q === 'help' || q === '?' || q === '-h' || q === '--help') {
            return [
                '<span class="hl">mcp-server-graylog</span> · official anthropic catalog',
                '',
                'known queries —',
                '  <span class="cmd">mcp errors</span>          current error patterns',
                '  <span class="cmd">mcp latency</span>         P99 latencies by endpoint',
                '  <span class="cmd">mcp slow</span>            top slow queries',
                '  <span class="cmd">mcp count</span>           log volume over time',
                '  <span class="cmd">mcp traces &lt;name&gt;</span>   stack traces for a pattern',
                '',
                'meta —',
                '  <span class="cmd">mcp what is this</span>    about mcp-server-graylog',
                '  <span class="cmd">mcp how does it work</span> architecture',
                '  <span class="cmd">mcp who are you</span>     server identity',
                '',
                '<span class="muted">accepts natural-language queries · translates to lucene</span>'
            ];
        }

        // greetings
        if (/^(hi|hello|hey|yo|sup|hola|namaste|namaskara)\b/.test(q)) {
            return [
                'hello. mcp-server-graylog speaking.',
                '',
                "i'm a Model Context Protocol server that lets AI agents",
                'query production logs in natural language. ask me about',
                'errors, latency, slow queries, or log volume.',
                '',
                '<span class="muted">try: mcp errors · mcp latency · mcp slow · mcp count</span>'
            ];
        }

        // identity — "who are you", "your name", "tell me about you"
        if (/\b(who are you|your name|introduce yourself|tell me about (you|yourself|this)|about you)\b/.test(q)) {
            return [
                'i am <span class="hl">mcp-server-graylog</span> · written by pranav jagadish.',
                '',
                "accepted into anthropic's official MCP servers catalog on",
                '2025-10-18 (PR #2913). lets AI agents like Claude query',
                'and analyze graylog production logs through natural language.',
                '',
                '<span class="muted">source: github.com/Pranavj17/mcp-server-graylog</span>'
            ];
        }

        // ping/test
        if (/^(test|ping|echo|status|health)\b/.test(q)) {
            return [
                'pong · mcp-server-graylog reachable',
                'protocol version: 2024-11-05',
                'tools: search_logs, get_streams, count_messages, get_message',
                '<span class="muted">simulated · real server runs on stdio JSON-RPC</span>'
            ];
        }

        // thanks
        if (/^(thanks|thank you|thx|ty|cheers|nice|cool|awesome)\b/.test(q)) {
            return [
                "you're welcome. drop a star ↗",
                '<span class="muted">github.com/Pranavj17/mcp-server-graylog</span>'
            ];
        }

        // architecture / how does it work / tech / stack
        if (/\b(how (does|do|is|it|this)|architecture|tech stack|built|made|stack|how it works|how this works)\b/.test(q)) {
            return [
                '<span class="hl-amber">architecture —</span>',
                '',
                '  ai agent  ←→  MCP protocol (stdio · JSON-RPC 2.0)',
                '       ↕',
                '  <span class="hl">mcp-server-graylog</span>  ←→  graylog REST API',
                '       ↕',
                '  graylog cluster  ←→  elasticsearch / opensearch',
                '',
                'the server exposes tools (search_logs, get_streams,',
                'count_messages, get_message) with typed parameters. the AI',
                'picks the right tool based on the natural-language query',
                'and Claude reasons over structured results.',
                '',
                '<span class="muted">written in TypeScript · ~600 LOC · MIT license</span>'
            ];
        }

        // meta — "what is this", "what does this do", "what can you do"
        if (/\b(what (is|are|does|do|can|this)|what.{0,12}(do|this|server|mcp))\b/.test(q)) {
            return [
                '<span class="hl">mcp-server-graylog</span> · official anthropic catalog',
                '',
                "i'm an MCP (Model Context Protocol) server that connects",
                'AI agents to graylog log aggregation. instead of writing',
                'lucene queries by hand during incidents, you ask in english:',
                '',
                '  <span class="muted">"any errors in billing-service since 14:00?"</span>',
                '  <span class="muted">"what was p99 on /api/orders last hour?"</span>',
                '',
                'the server translates → queries graylog → returns structured',
                'results the AI reasons over. accepted into anthropic\'s',
                'official catalog on 2025-10-18 (PR #2913).',
                '',
                '<span class="muted">try: mcp errors · mcp latency · mcp slow · mcp count</span>'
            ];
        }

        if (q.includes('error')) {
            return [
                '<span class="hl-amber">found 3 error patterns · last 24h</span>',
                '',
                '  <span class="hl">▸ DB connection pool timeout</span>',
                '    47 occurrences · billing-service · spike at 14:23 UTC',
                '    correlates with marketing campaign launch',
                '',
                '  <span class="hl">▸ Stripe webhook signature mismatch</span>',
                '    12 occurrences · payments-service · steady',
                '    likely cause: webhook endpoint receiving retries',
                '',
                '  <span class="hl">▸ Asana API rate limit (HTTP 429)</span>',
                '    8 occurrences · ops-bot · burst at 09:00 UTC',
                '    suggested fix: exponential backoff',
                '',
                '<span class="muted">most affected: billing-service · 1.6% error rate (was 0.3%)</span>'
            ];
        }
        if (q.includes('latency')) {
            return [
                '<span class="hl-amber">P99 latency by endpoint · last 1h</span>',
                '',
                '  GET  /api/portfolios          <span class="hl">142ms</span>  (▲ +18ms)',
                '  POST /api/orders              <span class="hl">287ms</span>  (▼ -5ms)',
                '  GET  /api/users/me            <span class="hl">38ms</span>   (steady)',
                '  POST /api/webhooks/stripe     <span class="hl-amber">412ms</span>  (▲ +67ms · investigate)',
                '  GET  /health                  <span class="hl">3ms</span>    (steady)',
                '',
                '<span class="muted">stripe webhook regression detected · profile signature verification</span>'
            ];
        }
        if (q.includes('slow') || q.includes('query')) {
            return [
                '<span class="hl-amber">top 5 slow queries · last 24h</span>',
                '',
                '  1. SELECT ... FROM orders WHERE created_at &gt; ?',
                '     <span class="hl">avg 2.4s</span> · 81 calls · table size 4.2M rows',
                '     suggest: add index on (created_at, status)',
                '',
                '  2. UPDATE portfolios SET allocations = ?',
                '     <span class="hl">avg 890ms</span> · 220 calls · row-level locking',
                '',
                '  3. SELECT COUNT(*) FROM transactions GROUP BY ...',
                '     <span class="hl">avg 612ms</span> · 47 calls · sequential scan',
                '',
                '  4. JOIN users.users_emails ON ...',
                '     <span class="hl">avg 380ms</span> · 1.2k calls · n+1 detected',
                '',
                '  5. INSERT INTO audit_log ...',
                '     <span class="hl">avg 240ms</span> · 18k calls · index bloat'
            ];
        }
        if (q.includes('count')) {
            return [
                '<span class="hl-amber">log count · pattern matches · last 7 days</span>',
                '',
                '  mon  ████████████░░░░░░  847',
                '  tue  ███████████████░░░  1024',
                '  wed  ████████████░░░░░░  823',
                '  thu  █████████████░░░░░  912',
                '  fri  █████████████░░░░░  908',
                '  sat  ████░░░░░░░░░░░░░░  287',
                '  sun  ███░░░░░░░░░░░░░░░  198',
                '',
                '<span class="muted">total: 4,999  ·  trend: weekday spike, weekend lull</span>'
            ];
        }
        if (q.includes('trace')) {
            return [
                '<span class="hl-amber">stack traces · pattern: DB pool timeout</span>',
                '',
                '  Ecto.Adapters.SQL.Sandbox.checkout/1',
                '  Ecto.Adapters.SQL.checkout_or_transaction/4',
                '  BillingService.OrderRepo.with_transaction/1',
                '  BillingService.OrderProcessor.process/2',
                '  Phoenix.Controller.action/3',
                '',
                '<span class="muted">all 47 occurrences share the same trace · checkout starvation</span>'
            ];
        }
        // friendly catch-all — informative, not dismissive
        return [
            `<span class="muted">i don't have a canned response for: "${escapeHtml(original)}"</span>`,
            '',
            "this is a <em>simulated</em> demo. the real mcp-server-graylog",
            'accepts any natural-language query against any graylog instance.',
            '',
            'in this demo, i can answer about —',
            '  <span class="hl">mcp errors</span>     current error patterns',
            '  <span class="hl">mcp latency</span>    P99 latencies',
            '  <span class="hl">mcp slow</span>       top slow queries',
            '  <span class="hl">mcp count</span>      log volume over time',
            '  <span class="hl">mcp traces</span>     stack traces',
            '',
            'or ask me directly —',
            '  <span class="hl">mcp what is this</span>      about the server',
            '  <span class="hl">mcp how does it work</span>  architecture',
            '  <span class="hl">mcp who are you</span>       identity',
            '',
            '<span class="muted">real server: github.com/Pranavj17/mcp-server-graylog</span>'
        ];
    }

    /* ── GUESTBOOK · seed + worker fetch with localStorage fallback ── */
    const SEED_GUESTBOOK = [
        { date: '2026-05-10', name: 'pranav', msg: 'thanks for stopping by. type `sign your message` to leave a note.' },
    ];

    async function fetchGuestbookFromWorker() {
        try {
            const cached = sessionStorage.getItem('guestbook');
            const cachedAt = parseInt(sessionStorage.getItem('guestbook-at') || '0', 10);
            if (cached && (Date.now() - cachedAt) < 5 * 60_000) return JSON.parse(cached);
            const res = await fetch('/api/guestbook', { method: 'GET' });
            if (!res.ok) return null;
            const data = await res.json();
            try {
                sessionStorage.setItem('guestbook', JSON.stringify(data));
                sessionStorage.setItem('guestbook-at', String(Date.now()));
            } catch (_) {}
            return data;
        } catch (_) { return null; }
    }

    async function renderGuestbook() {
        const remote = await fetchGuestbookFromWorker();
        let entries;
        let workerOffline = false;
        if (Array.isArray(remote)) {
            // worker online · KV is the single source of truth · NO merging
            // (avoids duplicates when a sign was written to both KV and
            // localStorage during the worker POST)
            entries = remote;
        } else {
            // worker unreachable · graceful degradation · seed + local only
            workerOffline = true;
            const local = JSON.parse(localStorage.getItem('guestbook') || '[]');
            entries = [...SEED_GUESTBOOK, ...local];
        }
        entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const pre = document.createElement('pre');
        pre.innerHTML = entries.map(s => {
            const d = escapeHtml(String(s.date || '????-??-??').slice(0, 10));
            const n = escapeHtml(String(s.name || 'guest')).slice(0, 24).padEnd(12, ' ');
            const m = escapeHtml(String(s.msg || ''));
            return `  <span class="muted">${d}</span>  <span class="hl">${n}</span>  ${m}`;
        }).join('\n');
        print(pre);
        if (workerOffline) {
            print('<span class="muted">[worker offline · showing seed + your local signs only]</span>');
        }
    }

    /* ── MEDIUM RSS · auto-pull recent essays via rss2json public proxy ── */
    async function loadMediumPosts() {
        const list = $('#projects .post-list');
        if (!list) return;

        const KEY = 'medium';
        const KEY_AT = 'medium-at';
        const TTL = 30 * 60_000;

        let data;
        try {
            const cached = sessionStorage.getItem(KEY);
            const cachedAt = parseInt(sessionStorage.getItem(KEY_AT) || '0', 10);
            if (cached && (Date.now() - cachedAt) < TTL) {
                data = JSON.parse(cached);
            } else {
                const url = 'https://api.rss2json.com/v1/api.json?rss_url=' +
                    encodeURIComponent('https://medium.com/feed/@jpranav97');
                const res = await fetch(url);
                if (!res.ok) return;
                data = await res.json();
                try {
                    sessionStorage.setItem(KEY, JSON.stringify(data));
                    sessionStorage.setItem(KEY_AT, String(Date.now()));
                } catch (_) {}
            }
        } catch (_) { return; }

        if (!data || data.status !== 'ok' || !Array.isArray(data.items) || !data.items.length) return;

        list.innerHTML = '';
        data.items.slice(0, 5).forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.link || 'https://medium.com/@jpranav97';
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = (item.title || 'untitled').toLowerCase();
            const meta = document.createElement('span');
            meta.className = 'post-meta';
            const date = item.pubDate
                ? new Date(item.pubDate).toISOString().slice(0, 10)
                : '????-??-??';
            const desc = (item.description || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 90);
            meta.textContent = `${date}  ·  ${desc}…`;
            li.appendChild(a);
            li.appendChild(meta);
            list.appendChild(li);
        });
    }

    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadMediumPosts, { timeout: 2000 });
    } else {
        setTimeout(loadMediumPosts, 800);
    }

    /* ── COMMAND TABLE ── */
    const SECTIONS = ['home', 'work', 'skills', 'artifacts', 'projects', 'contact'];
    const SECTION_BLURB = {
        home:      "building scalable autonomous agents. senior engineer · 6+ years across the stack · elixir, ruby, javascript, postgres, MCP.",
        work:      "14 entries · sakha (2019-2022) → scripbox (2022→present). 8 prod databases · Echo agent platform triages 200+ errors/day across 9 sentry channels · 5,979 KB entries classified · mcp-server-graylog v2.0.1 in anthropic catalog · memory MCP (96.5% token cut · 94%+ dedup) · scripbox AI hackathon finalist (54 submissions · `demo` to view) · 12 NIM models benchmarked.",
        skills:    "elixir 88% · ruby 78% · javascript 72% · postgres 80% · mcp 74% (R+) · python 22% (learning) · ai-ml 18% (learning).",
        artifacts: "3 highlighted: mcp-server-graylog (anthropic catalog, PR #2913), AI agent automation platform (7 channels, 5+ services), memory MCP server (elixir, 94%+ duplicate detection).",
        projects:  "ai-automation/ · mcp/ · open-source/ (form_builder_dsl) · devops/ (automate_deployment) · writing/ (medium @jpranav97).",
        contact:   "email: jpranav97@gmail.com · phone: +91 8123310664 · linkedin/github/medium @ pranavjagadish.",
    };

    const COMMANDS = {
        help() {
            print('available commands —', 'muted');
            const rows = [
                ['help',                'this list'],
                ['ls',                  'list sections'],
                ['cd &lt;section&gt;',  'jump to section'],
                ['cat &lt;file&gt;',     'print section / try `cat guestbook`'],
                ['whoami',              'who you are'],
                ['pwd',                 'current section'],
                ['date',                'current IST'],
                ['uptime',              'career uptime'],
                ['now',                 'what i am working on'],
                ['uses',                'hardware + software stack'],
                ['man pranav',          'unix-style biography'],
                ['finger pranav',       'unix-style profile'],
                ['mcp &lt;query&gt;',     'demo: ask the graylog MCP'],
                ['sign &lt;msg&gt;',      'leave a note in the guestbook'],
                ['theme [name]',        'phosphor · amber · ibm · paper'],
                ['audio [on|off]',      'click sounds toggle'],
                ['boot',                'replay boot sequence'],
                ['demo',                'open Echo · AI agent platform demo'],
                ['resume',              'download resume.pdf'],
                ['hire',                'compose hiring email'],
                ['echo &lt;text&gt;',   'print text'],
                ['history',             'recent commands'],
                ['clear',               'clear console'],
                ['fortune',             'random quote'],
                ['matrix',              '~5s easter egg'],
                ['exit',                'close shell'],
            ];
            const pre = document.createElement('pre');
            pre.innerHTML = rows.map(([c, d]) => `  ${c.padEnd(22, ' ')}  ${d}`).join('\n');
            print(pre);
        },
        ls() {
            const pre = document.createElement('pre');
            pre.innerHTML = SECTIONS.map(s => {
                const at = currentSection() === s ? ' ←' : '';
                return `  drwxr-xr-x  pranav  ${s}/${at}`;
            }).join('\n');
            print(pre);
        },
        cd(arg) {
            if (!arg) { print(currentSection() || '~', 'muted'); return; }
            const id = arg.replace(/^\/?~?\/?/, '').replace(/\/$/, '').toLowerCase();
            if (!SECTIONS.includes(id)) { print(`cd: no such section: ${arg}`, 'error'); return; }
            $('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            print(`→ ${id}/`, 'ok');
        },
        async cat(arg) {
            if (!arg) { print('cat: missing operand · try `cat work`', 'error'); return; }
            const id = arg.toLowerCase().replace(/\.txt$/, '').replace(/\.md$/, '');
            if (id === 'guestbook') { await renderGuestbook(); return; }
            const blurb = SECTION_BLURB[id];
            if (!blurb) { print(`cat: ${arg}: no such file or directory`, 'error'); return; }
            print(blurb);
        },
        whoami() { print('guest — visiting pranavjagadish via tty1', 'ok'); },
        pwd()    { print(`/home/pranav/${currentSection() || 'home'}`, 'ok'); },
        date()   { print(new Date().toString(), 'muted'); },
        uptime() {
            const u = uptimeEl?.textContent || '';
            print(`career ${u} · scripbox 09/2022→present · sakha 07/2019→09/2022`);
        },
        now() {
            print('currently shipping —', 'muted');
            const pre = document.createElement('pre');
            pre.innerHTML = `  <span class="hl">helixa</span>      RIA call intelligence pipeline
              local-first transcription + diarization + CRM sync
              whisperx + ollama gemma4 + zoho CRM v3
              started 2026-05-07 · path ~/Documents/helixa/

other work in flight —
  <span class="hl">openclaw</span>     autonomous sentry triage · bash dispatch v2
              monitoring 9 channels · ~5min wallclock per analysis
  <span class="hl">memory MCP</span>   workflow optimization · 96.5% token cut shipped
              next: graph layer · ChromaDB integration
  <span class="hl">portfolio</span>    this site · brutalist terminal redesign · live

last updated 2026-05-10`;
            print(pre);
        },
        uses() {
            printEcho('cat ~/.config/uses.txt');
            const pre = document.createElement('pre');
            pre.innerHTML = `<span class="hl-amber">~ hardware ~</span>
  primary       MacBook · Apple M-series · macOS 26
  server        Mac Mini M4 Pro · 12 cores · 24GB · arm64
  fonts         IBM Plex Mono (body) · VT323 (display)

<span class="hl-amber">~ os + shell ~</span>
  os            macOS 26 (Sequoia)
  shell         zsh + zinit
  terminal      Alacritty (source build · native tabs)
  multiplex     tmux

<span class="hl-amber">~ editor ~</span>
  daily         <span class="hl">Claude Code</span> v2.1.119 (subscription · native ARM64)
  fallback      neovim · gruvbox

<span class="hl-amber">~ stack ~</span>
  primary       <span class="hl">Elixir</span> / OTP · Phoenix · Ecto
  fluent        Ruby · JS / TS · PostgreSQL · pg_trgm
  learning      Python · PyTorch · NumPy

<span class="hl-amber">~ ai + mcp ~</span>
  inference     <span class="hl">Ollama</span> · gemma4 · qwen2.5 14b · llama3.1 · nomic-embed
  agents        Claude API · OpenClaw gateway · MCP servers
  vectors       ChromaDB · Postgres pg_trgm

<span class="hl-amber">~ infra ~</span>
  ci            <span class="hl">GitLab</span> Runner (Mac Mini · shell executor)
  isolation     Podman 5.8.0 · rootless · cap=ALL drop
  ops           Sentry · Graylog · Metabase · Linear · Asana
  hosting       GitHub Pages + Cloudflare Workers (this site)`;
            print(pre);
        },
        finger(arg) {
            if (arg && arg.toLowerCase() !== 'pranav') {
                print(`finger: ${arg}: no such user`, 'error');
                return;
            }
            const u = uptimeEl?.textContent?.replace('↑ ', '') || '6y';
            const pre = document.createElement('pre');
            pre.innerHTML = `Login: <span class="hl">pranav</span>                          Name: Pranav Jagadish
Directory: /home/pranav                Shell: /bin/zsh
On since 2019-07-01 (career start)     ${u}
Mail last read: now (live shell session)
Office: Bangalore, India · Asia/Kolkata · UTC+5:30
Phone: +91 8123310664

<span class="hl-amber">Plan:</span>
   building scalable autonomous agents.
   currently shipping: helixa · RIA call intelligence (whisperx + ollama).
   shipped: mcp-server-graylog → anthropic catalog · PR #2913.
   shipped: memory MCP server · 96.5% workflow token reduction.

   reach me: jpranav97@gmail.com  ·  github.com/Pranavj17
   blog:     medium.com/@jpranav97`;
            print(pre);
        },
        audio(arg) {
            const v = (arg || '').toLowerCase();
            if (v === 'on') {
                audioOn = true;
                localStorage.setItem('audio', '1');
                ensureAudio();
                playBlip();
                print('audio: <span class="hl">on</span>  ·  mechanical click on every keystroke', 'ok');
            } else if (v === 'off') {
                audioOn = false;
                localStorage.setItem('audio', '0');
                print('audio: <span class="hl-amber">off</span>  ·  silent', 'muted');
            } else {
                print(`audio: ${audioOn ? '<span class="hl">on</span>' : '<span class="hl-amber">off</span>'}  ·  pass 'on' or 'off' to toggle`, 'muted');
            }
        },
        async mcp(...rest) {
            const q = rest.join(' ').trim();
            if (!q) {
                print('mcp: usage: mcp &lt;question&gt;  ·  try `mcp help`', 'muted');
                return;
            }
            // `mcp help` stays local (faster, doesn't burn rate limit)
            if (q.toLowerCase() === 'help' || q === '?') {
                const lines = mcpResponse('help', q);
                for (const line of lines) { print(line); await sleep(35); }
                return;
            }
            // Concurrency guard · a second `mcp <q>` while the first is still
            // streaming would interleave both answers' tool-call lines into
            // one output stream. Politely refuse and wait.
            if (mcpInFlight) {
                print('<span class="muted">mcp: busy · previous query still streaming · please wait</span>');
                return;
            }
            mcpInFlight = true;

            // Don't name a model in the pre-fetch banner. When NIM has Mistral
            // DEGRADED and Llama actually answers, hardcoding "mistral-nemotron"
            // would lie. The post-response footer reports `data.model` truthfully.
            print(`<span class="muted">&gt; querying mcp-server-graylog (live · NVIDIA NIM) ...</span>`);

            // Build a compact, human-readable summary of a tool call's args.
            // ≤60 chars total, string values truncated to ~22 chars + "..."
            const summarizeArgs = (args) => {
                if (!args || typeof args !== 'object') return '';
                const parts = [];
                for (const [k, v] of Object.entries(args)) {
                    let piece;
                    if (typeof v === 'string') {
                        const trimmed = v.length > 25 ? v.slice(0, 22) + '...' : v;
                        piece = `${k}="${trimmed}"`;
                    } else if (typeof v === 'number' || typeof v === 'boolean') {
                        piece = `${k}=${v}`;
                    } else if (v === null) {
                        piece = `${k}=null`;
                    } else {
                        // object / array — collapse to placeholder
                        piece = `${k}=<...>`;
                    }
                    parts.push(piece);
                }
                let joined = parts.join(', ');
                if (joined.length > 60) joined = joined.slice(0, 57) + '...';
                return joined;
            };

            const renderAnswerLines = (text) => {
                const lines = String(text || '').split('\n');
                return (async () => {
                    for (const raw of lines) {
                        let html = escapeHtml(raw);
                        // colorize `▸` bullet prefix in accent green
                        html = html.replace(/^(\s*)(▸)(\s*)/, '$1<span class="hl">$2</span>$3');
                        // colorize "suggested:" lines in amber
                        if (/^\s*(suggested|note|tip)\s*:/i.test(raw)) {
                            html = `<span class="hl-amber">${html}</span>`;
                        }
                        print(html);
                        await sleep(35);
                    }
                })();
            };

            const fallback = async (reason) => {
                if (reason) print(`<span class="muted">${reason} · falling back to canned response</span>`);
                await sleep(200);
                const lines = mcpResponse(q.toLowerCase(), q);
                for (const line of lines) { print(line); await sleep(35); }
                print(`<span class="muted">[canned · real server: github.com/Pranavj17/mcp-server-graylog]</span>`);
            };

            try {
                const res = await fetch('/api/mcp/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: q }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    const reason = res.status === 429
                        ? `rate limit · ${data.error || 'max 10/hr per IP'}`
                        : `error ${res.status} · ${data.error || 'upstream issue'}`;
                    return await fallback(reason);
                }

                let data;
                try { data = await res.json(); }
                catch { return await fallback('bad response · server returned non-JSON'); }

                // F2 · Fallback-model warning. If the primary model (slot 0 of
                // models_available) didn't answer, the visitor should know which
                // model actually served their query. Otherwise they think
                // Mistral answered when Llama did.
                const primary = Array.isArray(data.models_available) ? data.models_available[0] : null;
                if (primary && data.model && primary !== data.model) {
                    print(`<span class="hl-amber">note: primary model ${escapeHtml(primary)} unavailable · ${escapeHtml(data.model)} answered instead</span>`);
                    await sleep(40);
                }

                // F5 · Surface the worker's `note` field (currently emitted only
                // when [TOOL_CALLS] leak recovery happened). Amber line BEFORE
                // the tool-call stream so visitors see the warning in-context.
                if (typeof data.note === 'string' && data.note) {
                    print(`<span class="hl-amber">note: ${escapeHtml(data.note)}</span>`);
                    await sleep(40);
                }

                // Phase 2: stream tool calls "watch-the-agent-think" UX.
                const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : [];
                if (toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                        const name = escapeHtml(String(tc?.name ?? 'unknown'));
                        const argsSummary = escapeHtml(summarizeArgs(tc?.args));
                        const summary = escapeHtml(String(tc?.result_summary ?? ''));
                        // F4 · Flag leak-recovered calls with an amber asterisk
                        // instead of the green bullet, so the visitor sees that
                        // upstream emitted unstructured markup but the worker
                        // parsed it cleanly.
                        const flag = tc?.source === 'leaked-recovered'
                            ? '<span class="hl-amber">*</span>'
                            : '<span class="hl">▸</span>';
                        print(`${flag}<span class="muted"> calling </span><span class="hl">${name}</span><span class="muted">(${argsSummary})</span>`);
                        await sleep(80);
                        print(`<span class="muted">   ↓ ${summary}</span>`);
                        await sleep(80);
                    }
                    print('');
                }

                // F8 · Removed the `?? data.answer` Phase 1 fallback.
                await renderAnswerLines(data.final_answer ?? '');

                // F6 · Unified footer. Round count works regardless of whether
                // any tool was called (the old dataset-entries branch was a
                // Phase 1 leftover that always confused the message).
                const remaining = (data.remaining ?? '?');
                const model = escapeHtml(String(data.model || ''));
                const rounds = Number.isFinite(data.rounds) ? data.rounds : toolCalls.length;
                print(`<span class="muted">[live · ${model} · ${rounds} round${rounds === 1 ? '' : 's'} · ${remaining} queries left this hour]</span>`);
            } catch (e) {
                await fallback(`network: ${e.message || 'fetch failed'}`);
            } finally {
                // Release the concurrency guard regardless of how we exited
                // (success, fallback, thrown error).
                mcpInFlight = false;
            }
        },
        async sign(...rest) {
            let msg = rest.join(' ').trim();
            // strip surrounding quotes if user added them
            msg = msg.replace(/^["'`]+|["'`]+$/g, '').trim();
            if (!msg) {
                print('sign: usage: sign &lt;your message&gt;', 'error');
                return;
            }
            if (msg.length > 200) {
                print(`sign: too long (${msg.length}/200 chars)`, 'error');
                return;
            }
            // 10-min cooldown per device to discourage spam
            const last = parseInt(localStorage.getItem('lastSign') || '0', 10);
            if (Date.now() - last < 10 * 60_000) {
                const wait = Math.ceil((10 * 60_000 - (Date.now() - last)) / 60_000);
                print(`sign: please wait ${wait}m before signing again`, 'warn');
                return;
            }
            const entry = {
                date: new Date().toISOString().slice(0, 10),
                name: 'guest',
                msg: msg
            };
            // try POST to worker; fall back to localStorage on failure
            let posted = false;
            try {
                const res = await fetch('/api/guestbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entry)
                });
                if (res.ok) {
                    posted = true;
                    // bust cache so next read is fresh
                    sessionStorage.removeItem('guestbook');
                    sessionStorage.removeItem('guestbook-at');
                }
            } catch (_) {}
            // local fallback (also acts as optimistic local view)
            const local = JSON.parse(localStorage.getItem('guestbook') || '[]');
            local.push(entry);
            localStorage.setItem('guestbook', JSON.stringify(local));
            localStorage.setItem('lastSign', String(Date.now()));
            const note = posted
                ? 'signed.  ·  visible to everyone on `cat guestbook.txt`'
                : 'signed locally.  ·  see it on `cat guestbook.txt` (worker offline → local-only this session)';
            print(note, 'ok');
        },
        theme(arg) {
            if (!arg) { print(`theme: ${getTheme()} · pass one of: ${THEMES.map(t=>t.id).join(', ')}`, 'muted'); return; }
            const id = arg.toLowerCase();
            if (!THEMES.find(t => t.id === id)) { print(`theme: unknown · valid: ${THEMES.map(t=>t.id).join(', ')}`, 'error'); return; }
            applyTheme(id, true);
            print(`theme → ${id}`, 'ok');
        },
        boot() {
            sessionStorage.removeItem('bootSeen');
            print('rebooting...', 'warn');
            setTimeout(() => runBoot(true), 200);
        },
        hire() {
            const subj = encodeURIComponent('hello — interested in working together');
            const body = encodeURIComponent('hi pranav,\n\n');
            const link = `mailto:jpranav97@gmail.com?subject=${subj}&body=${body}`;
            print(`opening compose window → <a href="${link}">${link}</a>`, 'ok');
            window.location.href = link;
        },
        demo() {
            print('opening live demo of <span class="hl">Echo</span> · AI agent automation platform...', 'ok');
            print('  → <a href="https://pranavj17.github.io/echo-demo-v2/" target="_blank" rel="noopener">https://pranavj17.github.io/echo-demo-v2/</a>', 'muted');
            print('  → <a href="/assets/videos/echo-demo.mp4" target="_blank" rel="noopener">2-minute video walkthrough</a>', 'muted');
            try { window.open('https://pranavj17.github.io/echo-demo-v2/', '_blank', 'noopener'); } catch (_) {}
        },
        resume() {
            print('opening resume...', 'ok');
            print('  → <a href="/resume.pdf" target="_blank" rel="noopener">resume.pdf</a>  <span class="muted">2 pages · 95KB · IBM Plex Mono</span>', 'muted');
            print('  → <a href="/resume.html" target="_blank" rel="noopener">resume.html</a> <span class="muted">web-readable version</span>', 'muted');
            // trigger download in a new tab
            try {
                const a = document.createElement('a');
                a.href = '/resume.pdf';
                a.target = '_blank';
                a.rel = 'noopener';
                a.download = 'Pranav_Jagadish_Resume.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (_) {}
        },
        echo(...args) { print(args.join(' ') || ''); },
        history() {
            if (!history.length) { print('history: empty (this session)', 'muted'); return; }
            const pre = document.createElement('pre');
            pre.innerHTML = history.map((c, i) => `  ${String(i+1).padStart(3,' ')}  ${c}`).join('\n');
            print(pre);
        },
        clear() { consoleOut.innerHTML = ''; consoleOut.dataset.greeted = '1'; },
        fortune() {
            const lines = [
                '"premature optimization is the root of all evil." — knuth',
                '"there are only two hard things in cs: cache invalidation and naming things." — phil karlton',
                '"the most important property of a program is whether it accomplishes the intention of its user." — hoare',
                '"talk is cheap. show me the code." — torvalds',
                '"any sufficiently advanced bug is indistinguishable from a feature." — clarke (paraphrased)',
                '"if it works on staging, it doesn’t mean it works." — every SRE ever',
                '"the cheapest, fastest, and most reliable components are those that aren’t there." — gordon bell',
                '"writing is nature’s way of letting you know how sloppy your thinking is." — guindon',
            ];
            print(lines[Math.floor(Math.random() * lines.length)], 'muted');
        },
        async matrix() {
            print('booting easter egg... ctrl+c to abort. (just kidding, it auto-stops.)', 'warn');
            // dismiss the soft keyboard so the visual viewport reflows back
            // to full size BEFORE the matrix canvas is sized. without this,
            // matrix gets sized to the keyboard-shrunken viewport on mobile
            // and stays small after the keyboard dismisses → page bleeds
            // through around the edges and looks irregular.
            consoleInp?.blur();
            await sleep(380);
            startMatrix(5000);
        },
        exit()    { print('logging out...', 'muted'); setTimeout(consoleClose_, 250); },
        logout()  { COMMANDS.exit(); },
        quit()    { COMMANDS.exit(); },
        // gentle easter eggs
        sudo()      { print('permission denied: pranav is not in the sudoers file. this incident will be reported.', 'error'); },
        rm()        { print('rm: refusing to remove anything. nice try.', 'error'); },
        vim()       { print("this isn't vim. and the only way out is :q here too. (try `exit`.)", 'muted'); },
        ':q'()      { COMMANDS.exit(); },
        ':wq'()     { print('saved nothing. quit anyway.', 'muted'); COMMANDS.exit(); },
        ':x'()      { COMMANDS.exit(); },
        coffee()    { print("i'd love to. ☕ → jpranav97@gmail.com", 'ok'); },
        ping()      { print('pong · 6dffa6 ttl=∞', 'ok'); },
        cowsay(...args) {
            const msg = args.join(' ') || 'moo.';
            const top = ' ' + '_'.repeat(msg.length + 2);
            const bot = ' ' + '-'.repeat(msg.length + 2);
            const cow =
`${top}
< ${msg} >
${bot}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;
            const pre = document.createElement('pre');
            pre.textContent = cow;
            print(pre);
        },
        man(cmd) {
            if (!cmd) { print('what manual page do you want?', 'muted'); return; }
            if (cmd.toLowerCase() === 'pranav') {
                const pre = document.createElement('pre');
                pre.innerHTML = `PRANAV(1)                  general user commands                  PRANAV(1)

<span class="hl">NAME</span>
       pranav — senior software engineer · scalable autonomous agents

<span class="hl">SYNOPSIS</span>
       pranav [--available] [--remote] [--bangalore] [--mcp]

<span class="hl">DESCRIPTION</span>
       Pranav Jagadish is a senior software engineer with 6+ years
       across the stack. Currently building autonomous AI agents that
       perform multi-service root cause analysis on production
       incidents — orchestrating Sentry, Graylog, Asana, GitLab, and
       Metabase via the OpenClaw gateway, with Claude as the reasoning
       layer and Podman sandboxing for workload isolation.

       Specializes in Elixir, distributed systems, and the Model
       Context Protocol ecosystem. Official contributor to Anthropic's
       MCP catalog (mcp-server-graylog · PR #2913).

<span class="hl">OPTIONS</span>
       <span class="hl-amber">--available</span>
              For senior software engineering roles, AI agent system
              design, MCP server work, or distributed systems
              consulting.

       <span class="hl-amber">--remote</span>
              Open to remote engagements. Based in Bangalore, India
              (Asia/Kolkata · UTC+5:30 · IST).

       <span class="hl-amber">--mcp</span>
              Specifically interested in MCP server design, AI agent
              orchestration, autonomous fix pipelines, and on-prem LLM
              deployment for regulated industries.

<span class="hl">EXAMPLES</span>
       <span class="cmd">now</span>            current technical focus
       <span class="cmd">uses</span>           full hardware + software stack
       <span class="cmd">finger pranav</span>  unix-style profile
       <span class="cmd">cat work</span>       career.log summary
       <span class="cmd">hire</span>           compose hiring email

<span class="hl">AUTHOR</span>
       Written by Pranav Jagadish &lt;jpranav97@gmail.com&gt;.

<span class="hl">SEE ALSO</span>
       finger(1), now(1), uses(1), whoami(1), hire(1)

       https://pranavjagadish.com
       https://github.com/Pranavj17
       https://linkedin.com/in/pranav-jagadish-9392137a

PRANAV(1)                       2026-05-10                       PRANAV(1)`;
                print(pre);
                return;
            }
            const fn = COMMANDS[cmd.toLowerCase()];
            if (!fn) { print(`no manual entry for ${cmd}`, 'error'); return; }
            print(`man ${cmd} — try just running it. this isn't that kind of unix.`, 'muted');
        },
    };

    function currentSection() {
        const active = $('.tab.active');
        return active ? active.getAttribute('href').slice(1) : 'home';
    }

    function dispatch(raw) {
        const line = raw.trim();
        if (!line) return;
        history.push(line);
        histIdx = history.length;
        printEcho(line);
        const tokens = line.split(/\s+/);
        // Accept Claude Code-style `/hire` alongside bare `hire` — strip
        // a single leading slash from the first token. Anything else (//foo,
        // hi/re) is left alone and falls through to the not-found path.
        const cmd = tokens[0].toLowerCase().replace(/^\/(?!\/)/, '');
        const args = tokens.slice(1);
        const fn = COMMANDS[cmd];
        if (!fn) {
            print(`zsh: command not found: ${cmd}  ·  try 'help'`, 'error');
            return;
        }
        try { fn(...args); }
        catch (e) { print(`error: ${e.message}`, 'error'); }
    }

    /* console events */
    consoleForm?.addEventListener('submit', e => {
        e.preventDefault();
        const raw = consoleInp.value;
        consoleInp.value = '';
        updateGhost();
        dispatch(raw);
    });
    consoleClose?.addEventListener('click', consoleClose_);

    // Live ghost-text suggestion on every keystroke. The 'input' event fires
    // after the value has been updated, including paste/cut/IME compositions.
    consoleInp?.addEventListener('input', updateGhost);

    consoleInp?.addEventListener('keydown', e => {
        if (audioOn) playClick();
        if (e.key === 'ArrowUp') {
            if (histIdx === history.length) draft = consoleInp.value;
            histIdx = Math.max(0, histIdx - 1);
            if (history[histIdx] !== undefined) consoleInp.value = history[histIdx];
            updateGhost();
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            histIdx = Math.min(history.length, histIdx + 1);
            consoleInp.value = histIdx === history.length ? draft : history[histIdx] || '';
            updateGhost();
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            // Fish-style: → at end of input accepts the ghost suggestion.
            // Anywhere else, let the arrow do its normal cursor-movement.
            const atEnd = consoleInp.selectionStart === consoleInp.value.length
                       && consoleInp.selectionEnd === consoleInp.value.length;
            if (atEnd && acceptGhost()) {
                e.preventDefault();
            }
        } else if (e.key === 'Tab') {
            // Prefer accepting the ghost (covers the typical 1-match case
            // cleanly). Falls through to the old multi-candidate printing
            // only when there's no ghost — e.g. after a space, where ghost
            // is suppressed, or for prefixes that match nothing.
            if (acceptGhost()) {
                e.preventDefault();
                return;
            }
            const cur = consoleInp.value;
            const m = cur.match(/^(\S*)$/);
            if (m) {
                const prefix = m[1].toLowerCase();
                const cands = Object.keys(COMMANDS).filter(c => c.startsWith(prefix));
                if (cands.length === 1) {
                    consoleInp.value = cands[0] + ' ';
                    updateGhost();
                } else if (cands.length > 1) {
                    print(cands.join('  '), 'muted');
                    consoleOut.scrollTop = consoleOut.scrollHeight;
                }
            }
            e.preventDefault();
        } else if (e.key === 'Escape') {
            // Clear ghost without intercepting the key — Escape may still
            // close the console via other handlers in this file.
            if (consoleGhostPad)  consoleGhostPad.textContent  = '';
            if (consoleGhostText) consoleGhostText.textContent = '';
        }
    });

    /* ─────── 7. MATRIX easter egg ─────── */
    let matrixHandle = null;
    let matrixResizeHandler = null;
    function startMatrix(durationMs = 5000) {
        const canvas = $('#matrix');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const chars = '01アイウエオカキクケコ$#%@&PJ_><:;-+'.split('');
        const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#6dffa6';
        const bg     = getComputedStyle(document.body).getPropertyValue('--bg').trim()     || '#0a0e0a';

        // closured size state so the resize handler can update them
        let W, H, fontSize, cols, drops = [];

        // viewportSize() prefers visualViewport (which excludes the on-screen
        // keyboard on iOS) over innerWidth/innerHeight. Falls back gracefully.
        const viewportSize = () => {
            const vv = window.visualViewport;
            return {
                w: Math.max(vv?.width  || 0, window.innerWidth),
                h: Math.max(vv?.height || 0, window.innerHeight),
            };
        };

        const configure = () => {
            const dpr = window.devicePixelRatio || 1;
            const { w, h } = viewportSize();
            W = canvas.width  = Math.floor(w * dpr);
            H = canvas.height = Math.floor(h * dpr);
            canvas.style.width  = w + 'px';
            canvas.style.height = h + 'px';
            fontSize = 16 * dpr;
            const newCols = Math.floor(W / fontSize);
            // preserve existing drop positions when resizing (no animation reset)
            const oldDrops = drops.slice();
            drops = Array(newCols).fill(1);
            for (let i = 0; i < Math.min(oldDrops.length, newCols); i++) {
                drops[i] = oldDrops[i];
            }
            cols = newCols;
            // re-paint opaque bg so the canvas always covers the page,
            // even right after a resize
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
        };

        configure();
        canvas.classList.add('show');

        // mid-animation resize handling (keyboard dismiss, orientation, etc.)
        matrixResizeHandler = configure;
        window.addEventListener('resize', matrixResizeHandler);
        window.visualViewport?.addEventListener('resize', matrixResizeHandler);

        let last = performance.now();
        const start = last;
        function frame(now) {
            ctx.fillStyle = 'rgba(10,14,10,0.08)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = accent;
            ctx.font = fontSize + 'px monospace';
            for (let i = 0; i < drops.length; i++) {
                const ch = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > H && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
            if (now - start < durationMs) {
                matrixHandle = requestAnimationFrame(frame);
            } else {
                if (matrixResizeHandler) {
                    window.removeEventListener('resize', matrixResizeHandler);
                    window.visualViewport?.removeEventListener('resize', matrixResizeHandler);
                    matrixResizeHandler = null;
                }
                canvas.classList.remove('show');
                setTimeout(() => ctx.clearRect(0, 0, W, H), 280);
                matrixHandle = null;
            }
        }
        matrixHandle = requestAnimationFrame(frame);
    }

    /* ─────── 8. BOOT sequence ─────── */
    const bootEl = $('#boot');
    const bootLines = $('#boot-lines');
    const BOOT_LINES = [
        ['OK', 'memory check',           '24576 KB'],
        ['OK', 'phosphor display',       'mode 6dffa6'],
        ['OK', 'tty1 keyboard handler',  'vim-flavored'],
        ['OK', 'mcp ecosystem',          'connected · graylog · memory'],
        ['OK', 'career.log',             'tail -f ready · 11 entries'],
        ['OK', 'htop daemon',            '7 processes'],
        ['OK', 'artifacts module',       '3 highlighted'],
        ['OK', 'live shell · /',         'armed'],
        ['OK', 'theme switcher · t',     '4 modes'],
    ];
    function runBoot(force = false) {
        if (!bootEl || !bootLines) return;
        if (!force && sessionStorage.getItem('bootSeen')) return;
        // disable scroll while booting
        bootEl.hidden = false;
        bootEl.classList.remove('fade-out');
        bootLines.innerHTML = '';
        document.documentElement.style.overflow = 'hidden';
        // re-hide page contents so they can crossfade in again at the end
        document.body.classList.remove('intro-done');
        playBoot();
        BOOT_LINES.forEach((row, i) => {
            const li = document.createElement('li');
            li.className = 'boot-line';
            li.style.animationDelay = (i * 0.085) + 's';
            li.innerHTML = `<span class="ok">[${row[0]}]</span><span class="label">${row[1]}</span><span class="val">${row[2]}</span>`;
            bootLines.appendChild(li);
        });

        const linesDoneAt    = BOOT_LINES.length * 85 + 700;  // ~1.5s
        const matrixFadeIn   = 280;                            // wait for matrix CSS opacity 0→1 to land
        const matrixDuration = 3000;                            // 3s rain (visible duration)
        const matrixFadeOut  = 280;                            // matrix .show removed → fades out
        let skipped = false;

        const cleanup = () => {
            document.documentElement.style.overflow = '';
            sessionStorage.setItem('bootSeen', '1');
            window.removeEventListener('keydown', skipBoot, true);
            window.removeEventListener('pointerdown', skipBoot, true);
            // reveal page — panels + chrome transition from hidden to visible
            // (CSS-driven, runs in parallel with whatever fade is active)
            markIntroDone();
        };

        const snapHideBoot = () => {
            // direct hide — no fade. matrix already opaque underneath, so
            // there's no flicker through to the page.
            bootEl.hidden = true;
        };

        const stopMatrix = () => {
            if (matrixHandle) {
                cancelAnimationFrame(matrixHandle);
                matrixHandle = null;
            }
            // tear down the resize listener that startMatrix attached
            if (matrixResizeHandler) {
                window.removeEventListener('resize', matrixResizeHandler);
                window.visualViewport?.removeEventListener('resize', matrixResizeHandler);
                matrixResizeHandler = null;
            }
            const c = $('#matrix');
            if (c) {
                c.classList.remove('show');
                const ctx = c.getContext('2d');
                if (ctx) setTimeout(() => ctx.clearRect(0, 0, c.width, c.height), 280);
            }
        };

        // skip jumps straight past boot + matrix
        const skipBoot = (e) => {
            if (skipped) return;
            skipped = true;
            snapHideBoot();
            stopMatrix();
            cleanup();
            e?.preventDefault?.();
        };
        window.addEventListener('keydown', skipBoot, true);
        window.addEventListener('pointerdown', skipBoot, true);

        // chain: boot lines → start matrix BEHIND boot (z=8000 < z=9999)
        // → wait for matrix CSS fade-in to complete → snap-hide boot
        // → matrix visible for matrixDuration
        // → call cleanup() at matrix-fade-out START so panels + chrome
        //   crossfade in WHILE matrix fades out (instead of hard-cut after)
        setTimeout(() => {
            if (skipped) return;
            startMatrix(matrixDuration + matrixFadeIn);  // total visible time
            setTimeout(() => {
                if (skipped) return;
                // matrix has fully faded in behind boot; safe to remove boot
                snapHideBoot();
            }, matrixFadeIn);
            setTimeout(() => {
                if (skipped) return;
                cleanup();   // adds intro-done · panels stagger in during matrix fade-out
            }, matrixFadeIn + matrixDuration);
        }, linesDoneAt);
    }
    runBoot();

    /* ─────── 9. GLOBAL keyboard nav ─────── */
    const help = $('#help');
    const numToId = { '0': 'home', '1': 'work', '2': 'skills', '3': 'artifacts', '4': 'projects', '5': 'contact' };
    const letterToId = { 'h': 'home', 'r': 'work', 's': 'skills', 'a': 'artifacts', 'p': 'projects', 'c': 'contact' };
    let lastG = 0;

    function jump(id) { $('#' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

    document.addEventListener('keydown', e => {
        // ignore typing inside any input/textarea/contenteditable
        if (e.target.matches('input, textarea, [contenteditable="true"]')) {
            // but allow Esc to close console even from inside its input
            if (e.key === 'Escape' && consoleEl?.classList.contains('open')) {
                consoleClose_();
                e.preventDefault();
            }
            return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (e.key === 'Escape') {
            if (help && !help.hidden) { help.hidden = true; e.preventDefault(); return; }
            if (consoleEl?.classList.contains('open')) { consoleClose_(); e.preventDefault(); return; }
            return;
        }
        if (e.key === '?')   { help && (help.hidden = !help.hidden); e.preventDefault(); return; }
        if (e.key === '/')   { consoleToggle(); e.preventDefault(); return; }
        if (e.key === 't')   { cycleTheme(); e.preventDefault(); return; }
        if (e.key === 'G')   { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); e.preventDefault(); return; }
        if (e.key === 'g') {
            const now = Date.now();
            if (now - lastG < 600) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                lastG = 0; e.preventDefault();
                return;
            }
            lastG = now; return;
        }

        if (numToId[e.key]) { jump(numToId[e.key]); e.preventDefault(); return; }
        const k = e.key.toLowerCase();
        if (letterToId[k]) { jump(letterToId[k]); e.preventDefault(); }
    });

    if (help) {
        help.addEventListener('click', e => { if (e.target === help) help.hidden = true; });
    }

    /* ─────── 9.5 KEYBAR tap support (mobile + desktop click) ─────── */
    $$('.kb-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const action = btn.dataset.action;
            switch (action) {
                case 'shell':         consoleToggle(); break;
                case 'theme':         cycleTheme(); break;
                case 'help':          if (help) help.hidden = !help.hidden; break;
                case 'jump-home':     jump('home'); break;
                case 'jump-work':     jump('work'); break;
                case 'jump-skills':   jump('skills'); break;
                case 'jump-artifacts':jump('artifacts'); break;
                case 'jump-projects': jump('projects'); break;
                case 'jump-contact':  jump('contact'); break;
            }
        });
    });

    // konami code → matrix
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let konamiIdx = 0;
    document.addEventListener('keydown', e => {
        if (e.target.matches('input, textarea')) { konamiIdx = 0; return; }
        const want = KONAMI[konamiIdx];
        if (e.key === want) {
            konamiIdx++;
            if (konamiIdx === KONAMI.length) {
                konamiIdx = 0;
                toast('<span class="toast-key">↑↑↓↓←→←→ba</span>matrix unlocked');
                startMatrix(5000);
            }
        } else {
            konamiIdx = 0;
        }
    });

    // expose for debugging / console
    window.__terminal = { applyTheme, cycleTheme, consoleOpen, dispatch, runBoot };
})();
