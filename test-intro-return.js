/**
 * Simulate a RETURN VISIT — sessionStorage.bootSeen is set, so boot+matrix
 * don't fire. The intro-done class should still trigger panel/chrome
 * crossfade. If transitions skip this case, this test will catch it.
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

    // First load to set sessionStorage
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bootSeen', '1'));

    // RELOAD as return visit
    console.log(`▸ RETURN VISIT — sessionStorage.bootSeen pre-set`);
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });

    const samples = [
        { label: 'rv-50ms',   at:   50 },
        { label: 'rv-100ms',  at:  100 },
        { label: 'rv-200ms',  at:  200 },
        { label: 'rv-400ms',  at:  400 },
        { label: 'rv-700ms',  at:  700 },
        { label: 'rv-1100ms', at: 1100 },
    ];

    for (const s of samples) {
        const wait = s.at - (Date.now() - t0);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const data = await page.evaluate(() => {
            const pick = sel => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const cs = getComputedStyle(el);
                return { opacity: parseFloat(cs.opacity).toFixed(2), transform: cs.transform };
            };
            return {
                bodyClass: document.body.className,
                heroOpacity:  pick('#home')?.opacity,
                heroTransform: pick('#home')?.transform?.slice(0, 50),
                workOpacity:  pick('#work')?.opacity,
                statusOpacity: pick('.statusbar')?.opacity,
                keybarOpacity: pick('.keybar')?.opacity,
            };
        });
        const file = path.join(OUT, `intro-${s.label}.png`);
        await page.screenshot({ path: file });
        console.log(`\n── ${s.label} ──────────────────`);
        console.log(`  body.class       : "${data.bodyClass}"`);
        console.log(`  hero panel       : opacity=${data.heroOpacity}  transform=${data.heroTransform}`);
        console.log(`  work panel       : opacity=${data.workOpacity}`);
        console.log(`  statusbar        : opacity=${data.statusOpacity}`);
        console.log(`  keybar           : opacity=${data.keybarOpacity}`);
    }

    await browser.close();
})();
