/**
 * Test the boot → matrix → page-reveal sequence.
 * Loads, clears sessionStorage to force the full intro, then samples
 * body class state + panel opacity + boot/matrix visibility at multiple
 * time points. Saves a screenshot at each sample.
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
        args: ['--no-sandbox','--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 1 });

    console.log(`▸ Loading ${URL} with cleared sessionStorage`);
    // First navigate so we have an origin context
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.evaluate(() => sessionStorage.clear());
    // Hard reload to get a fresh first-visit experience
    await page.reload({ waitUntil: 'domcontentloaded' });

    const startedAt = Date.now();
    const samples = [
        { label: 'a-100ms',  at:  100 },
        { label: 'b-1500ms', at: 1500 },
        { label: 'c-1900ms', at: 1900 },
        { label: 'd-3000ms', at: 3000 },
        { label: 'e-4700ms', at: 4700 },
        { label: 'f-4900ms', at: 4900 },
        { label: 'g-5300ms', at: 5300 },
        { label: 'h-6000ms', at: 6000 },
    ];

    for (const s of samples) {
        const wait = s.at - (Date.now() - startedAt);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const data = await page.evaluate(() => {
            const pick = sel => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const cs = getComputedStyle(el);
                return {
                    opacity: parseFloat(cs.opacity).toFixed(2),
                    transform: cs.transform,
                    hidden: el.hidden,
                    display: cs.display,
                };
            };
            return {
                bodyClass: document.body.className,
                introDone: document.body.classList.contains('intro-done'),
                bootHidden: document.querySelector('#boot')?.hidden,
                bootOpacity: parseFloat(getComputedStyle(document.querySelector('#boot') || document.body).opacity).toFixed(2),
                matrixOpacity: parseFloat(getComputedStyle(document.querySelector('#matrix') || document.body).opacity).toFixed(2),
                matrixHasShow: document.querySelector('#matrix')?.classList.contains('show'),
                panelHero:  pick('#home'),
                panelWork:  pick('#work'),
                panelArt:   pick('#artifacts'),
                statusbar:  pick('.statusbar'),
                keybar:     pick('.keybar'),
            };
        });
        const file = path.join(OUT, `intro-${s.label}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(`\n── ${s.label} ──────────────────────────────`);
        console.log(`  body.class       : "${data.bodyClass}"`);
        console.log(`  intro-done?      : ${data.introDone}`);
        console.log(`  boot hidden?     : ${data.bootHidden}  · opacity ${data.bootOpacity}`);
        console.log(`  matrix .show?    : ${data.matrixHasShow} · opacity ${data.matrixOpacity}`);
        console.log(`  hero panel       : opacity=${data.panelHero?.opacity}  transform=${data.panelHero?.transform?.slice(0,40)}`);
        console.log(`  work panel       : opacity=${data.panelWork?.opacity}`);
        console.log(`  artifacts panel  : opacity=${data.panelArt?.opacity}`);
        console.log(`  statusbar        : opacity=${data.statusbar?.opacity}`);
        console.log(`  keybar           : opacity=${data.keybar?.opacity}`);
    }

    await browser.close();
})();
