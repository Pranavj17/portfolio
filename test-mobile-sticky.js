/**
 * Mobile sticky-bar regression test.
 *
 * Loads the target URL at iPhone 13 viewport, captures the position
 * of .statusbar / .tabs / .keybar at three scroll offsets, takes
 * screenshots, and reports whether the bars stay glued.
 *
 * Usage:  node test-mobile-sticky.js [url]
 *   default url = http://localhost:3000
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(__dirname, 'mobile-test-screens');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({
            width: 390, height: 844,
            deviceScaleFactor: 2,
            isMobile: true, hasTouch: true,
        });
        await page.setUserAgent(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
            'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
            'Version/17.0 Mobile/15E148 Safari/604.1'
        );

        console.log(`▸ Loading ${URL} at iPhone-13 viewport (390×844)`);
        await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 });
        await new Promise(r => setTimeout(r, 600));

        async function snapshot(label, scrollY) {
            await page.evaluate(y => window.scrollTo({ top: y, left: 0, behavior: 'instant' }), scrollY);
            await new Promise(r => setTimeout(r, 400));
            const out = await page.evaluate(() => {
                const pick = sel => {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    const cs = getComputedStyle(el);
                    return {
                        top: Math.round(r.top),
                        bottom: Math.round(r.bottom),
                        height: Math.round(r.height),
                        position: cs.position,
                        zIndex: cs.zIndex,
                    };
                };
                return {
                    scrollY: Math.round(window.scrollY),
                    innerHeight: window.innerHeight,
                    docHeight: document.documentElement.scrollHeight,
                    statusbar: pick('.statusbar'),
                    tabs:      pick('.tabs'),
                    keybar:    pick('.keybar'),
                    bodyOverflow: getComputedStyle(document.body).overflow,
                    bodyOverflowX: getComputedStyle(document.body).overflowX,
                    htmlOverflow: getComputedStyle(document.documentElement).overflow,
                    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
                };
            });
            const file = path.join(OUT, `${label}.png`);
            await page.screenshot({ path: file, fullPage: false });
            console.log(`\n── ${label} (scroll=${out.scrollY}) ─────────────`);
            console.log(`  bodyOverflowX=${out.bodyOverflowX}  htmlOverflowX=${out.htmlOverflowX}`);
            console.log(`  statusbar  top=${out.statusbar?.top}  bottom=${out.statusbar?.bottom}  pos=${out.statusbar?.position}`);
            console.log(`  tabs       top=${out.tabs?.top}  bottom=${out.tabs?.bottom}  pos=${out.tabs?.position}`);
            console.log(`  keybar     top=${out.keybar?.top}  bottom=${out.keybar?.bottom}  pos=${out.keybar?.position}  vh=${out.innerHeight}`);
            console.log(`  screenshot → ${file}`);
            return out;
        }

        const top    = await snapshot('01-top',    0);
        const middle = await snapshot('02-middle', 1500);
        const deep   = await snapshot('03-deep',   3500);

        console.log('\n═══ verdict ═══');
        const expectStatusTop = 0;
        const tolerance = 2;
        for (const [label, snap] of [['top', top], ['mid', middle], ['deep', deep]]) {
            if (!snap.statusbar) { console.log(`  ✗ ${label}: .statusbar missing`); continue; }
            const stickStatus = Math.abs(snap.statusbar.top - expectStatusTop) <= tolerance;
            const expectKeybarBottom = snap.innerHeight;
            const stickKeybar = snap.keybar && Math.abs(snap.keybar.bottom - expectKeybarBottom) <= tolerance;
            console.log(`  ${stickStatus ? '✓' : '✗'} ${label}: statusbar.top=${snap.statusbar.top} (want ~0)`);
            console.log(`  ${stickKeybar ? '✓' : '✗'} ${label}: keybar.bottom=${snap.keybar?.bottom} (want ~${expectKeybarBottom})`);
        }
    } catch (e) {
        console.error('test failed:', e.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
