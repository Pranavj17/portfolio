/* ============================================================
   PRODUCTION TERMINAL — interactive bits
   ============================================================ */
(() => {
    'use strict';

    const $  = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    // ─── LIVE CLOCK (IST, ticks every second) ───────────────
    const clockEl = $('#clock');
    function tickClock() {
        if (!clockEl) return;
        const now = new Date();
        // Build IST regardless of viewer's local TZ
        const istParts = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false, timeZone: 'Asia/Kolkata'
        }).formatToParts(now).reduce((a, p) => (a[p.type] = p.value, a), {});
        clockEl.textContent = `${istParts.hour}:${istParts.minute}:${istParts.second} IST`;
    }
    tickClock();
    setInterval(tickClock, 1000);

    // ─── CAREER UPTIME (since first job) ────────────────────
    const uptimeEl = $('#uptime');
    function tickUptime() {
        if (!uptimeEl) return;
        const start = new Date('2019-07-01T00:00:00');
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();
        if (days < 0) {
            months -= 1;
            // days in prev month
            const prev = new Date(now.getFullYear(), now.getMonth(), 0);
            days += prev.getDate();
        }
        if (months < 0) { years -= 1; months += 12; }
        uptimeEl.textContent = `↑ ${years}y ${months}m ${days}d`;
    }
    tickUptime();
    setInterval(tickUptime, 60_000);

    // ─── HTOP bar fills (set CSS var from data-fill) ────────
    $$('.bar[data-fill]').forEach(b => {
        b.style.setProperty('--fill', b.dataset.fill + '%');
    });

    // ─── TAB CLICKS (smooth scroll) ─────────────────────────
    const tabs = $$('.tab');
    const sections = $$('main > section.panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', e => {
            e.preventDefault();
            const id = tab.getAttribute('href').slice(1);
            const target = document.getElementById(id);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ─── SCROLL SPY (update active tab) ─────────────────────
    if ('IntersectionObserver' in window && sections.length) {
        const obs = new IntersectionObserver(entries => {
            // pick the most visible intersecting section
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            const id = visible.target.id;
            tabs.forEach(t => t.classList.toggle('active', t.getAttribute('href') === `#${id}`));
        }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
        sections.forEach(s => obs.observe(s));
    }

    // ─── KEYBOARD NAV (vim-flavored) ────────────────────────
    const help = $('#help');
    const numToId = { '0': 'home', '1': 'work', '2': 'skills', '3': 'artifacts', '4': 'projects', '5': 'contact' };
    const letterToId = {
        'h': 'home', 'r': 'work', 's': 'skills', 'a': 'artifacts',
        'p': 'projects', 'c': 'contact'
    };
    let lastG = 0;

    function jump(id) {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.addEventListener('keydown', e => {
        // ignore when user is typing in a form
        if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        // Escape closes overlay
        if (e.key === 'Escape') {
            if (help && !help.hidden) { help.hidden = true; e.preventDefault(); }
            return;
        }

        // ? toggles help
        if (e.key === '?') {
            if (help) { help.hidden = !help.hidden; e.preventDefault(); }
            return;
        }

        // G goes to bottom
        if (e.key === 'G') {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            e.preventDefault();
            return;
        }

        // gg goes to top
        if (e.key === 'g') {
            const now = Date.now();
            if (now - lastG < 600) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                lastG = 0;
                e.preventDefault();
                return;
            }
            lastG = now;
            return;
        }

        // numeric keys 0-5
        if (numToId[e.key]) {
            jump(numToId[e.key]);
            e.preventDefault();
            return;
        }

        // letter shortcuts
        const k = e.key.toLowerCase();
        if (letterToId[k]) {
            jump(letterToId[k]);
            e.preventDefault();
        }
    });

    // close overlay on backdrop click
    if (help) {
        help.addEventListener('click', e => {
            if (e.target === help) help.hidden = true;
        });
    }
})();
