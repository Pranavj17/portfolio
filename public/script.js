/* ============================================================
   PRODUCTION TERMINAL — interactive controller
   Handles: clock · uptime · scroll-spy · keybindings ·
            boot sequence · theme cycle · live console · easter eggs
   ============================================================ */
(() => {
    'use strict';

    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
    }
    applyTheme(getTheme(), false);

    /* ─────── 6. CONSOLE — typeable shell ─────── */
    const consoleEl   = $('#console');
    const consoleOut  = $('#console-out');
    const consoleForm = $('#console-form');
    const consoleInp  = $('#console-input');
    const consoleClose = $('#console-close');

    const history = [];
    let histIdx = -1;
    let draft = '';

    function consoleOpen() {
        if (!consoleEl) return;
        consoleEl.classList.add('open');
        consoleEl.setAttribute('aria-hidden', 'false');
        if (!consoleOut.dataset.greeted) {
            print('shell ready · session @ ' + new Date().toISOString().slice(0,16).replace('T', ' ') + ' UTC', 'muted');
            print("type 'help' to see what i answer to · type 'exit' to close", 'muted');
            consoleOut.dataset.greeted = '1';
        }
        setTimeout(() => consoleInp?.focus(), 220);
    }
    function consoleClose_() {
        consoleEl?.classList.remove('open');
        consoleEl?.setAttribute('aria-hidden', 'true');
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

    /* ── COMMAND TABLE ── */
    const SECTIONS = ['home', 'work', 'skills', 'artifacts', 'projects', 'contact'];
    const SECTION_BLURB = {
        home:      "senior software engineer · 6+ years · bengaluru. building autonomous agents that debug production at 3am.",
        work:      "11 entries from sakha global (2019) → scripbox (2022→present). highlights: postgres 2.5s→80ms, MTTR -45%, ETS caching API latency -60%, mcp-server-graylog merged into anthropic catalog, memory MCP shipped (96.5% token cut).",
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
                ['cat &lt;section&gt;', 'print section summary'],
                ['whoami',              'who you are'],
                ['pwd',                 'current section'],
                ['date',                'current IST'],
                ['uptime',              'career uptime'],
                ['theme [name]',        'phosphor · amber · ibm · paper'],
                ['boot',                'replay boot sequence'],
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
        cat(arg) {
            if (!arg) { print('cat: missing operand · try `cat work`', 'error'); return; }
            const id = arg.toLowerCase().replace(/\.txt$/, '').replace(/\.md$/, '');
            const blurb = SECTION_BLURB[id];
            if (!blurb) { print(`cat: ${arg}: no such file or directory`, 'error'); return; }
            print(blurb);
        },
        whoami() { print('guest — visiting pranavjagadish via tty1', 'ok'); },
        pwd()    { print('/' + (currentSection() || 'home'), 'ok'); },
        date()   { print(new Date().toString(), 'muted'); },
        uptime() {
            const u = uptimeEl?.textContent || '';
            print(`career ${u} · scripbox 09/2022→present · sakha 07/2019→09/2022`);
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
        matrix() {
            print('booting easter egg... ctrl+c to abort. (just kidding, it auto-stops.)', 'warn');
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
        const cmd = tokens[0].toLowerCase();
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
        dispatch(raw);
    });
    consoleClose?.addEventListener('click', consoleClose_);
    consoleInp?.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') {
            if (histIdx === history.length) draft = consoleInp.value;
            histIdx = Math.max(0, histIdx - 1);
            if (history[histIdx] !== undefined) consoleInp.value = history[histIdx];
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            histIdx = Math.min(history.length, histIdx + 1);
            consoleInp.value = histIdx === history.length ? draft : history[histIdx] || '';
            e.preventDefault();
        } else if (e.key === 'Tab') {
            // tab completion — best-prefix match against command names
            const cur = consoleInp.value;
            const m = cur.match(/^(\S*)$/);
            if (m) {
                const prefix = m[1].toLowerCase();
                const cands = Object.keys(COMMANDS).filter(c => c.startsWith(prefix));
                if (cands.length === 1) {
                    consoleInp.value = cands[0] + ' ';
                } else if (cands.length > 1) {
                    print(cands.join('  '), 'muted');
                    consoleOut.scrollTop = consoleOut.scrollHeight;
                }
            }
            e.preventDefault();
        }
    });

    /* ─────── 7. MATRIX easter egg ─────── */
    let matrixHandle = null;
    function startMatrix(durationMs = 5000) {
        const canvas = $('#matrix');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.width = innerWidth * dpr;
        const H = canvas.height = innerHeight * dpr;
        canvas.style.width = innerWidth + 'px';
        canvas.style.height = innerHeight + 'px';
        const fontSize = 16 * dpr;
        const cols = Math.floor(W / fontSize);
        const drops = Array(cols).fill(1);
        const chars = '01アイウエオカキクケコ$#%@&PJ_><:;-+'.split('');
        const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#6dffa6';
        canvas.classList.add('show');
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
        BOOT_LINES.forEach((row, i) => {
            const li = document.createElement('li');
            li.className = 'boot-line';
            li.style.animationDelay = (i * 0.085) + 's';
            li.innerHTML = `<span class="ok">[${row[0]}]</span><span class="label">${row[1]}</span><span class="val">${row[2]}</span>`;
            bootLines.appendChild(li);
        });
        const total = BOOT_LINES.length * 85 + 700;
        const done = () => {
            bootEl.classList.add('fade-out');
            document.documentElement.style.overflow = '';
            setTimeout(() => { bootEl.hidden = true; }, 420);
            sessionStorage.setItem('bootSeen', '1');
            window.removeEventListener('keydown', skipBoot, true);
            window.removeEventListener('pointerdown', skipBoot, true);
        };
        const skipBoot = (e) => {
            if (bootEl.hidden) return;
            done();
            e.preventDefault?.();
        };
        window.addEventListener('keydown', skipBoot, true);
        window.addEventListener('pointerdown', skipBoot, true);
        setTimeout(done, total);
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
