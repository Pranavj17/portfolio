const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // Emulate reduced motion preference
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto('https://pranavjagadish.com/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('bootSeen', '1'));
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    console.log('▸ WITH prefers-reduced-motion: reduce');
    for (const at of [50, 150, 400, 800]) {
        const wait = at - (Date.now() - t0);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        const d = await page.evaluate(() => ({
            cls: document.body.className,
            hero: parseFloat(getComputedStyle(document.querySelector('#home')).opacity).toFixed(2),
            work: parseFloat(getComputedStyle(document.querySelector('#work')).opacity).toFixed(2),
            transition: getComputedStyle(document.querySelector('#home')).transition,
        }));
        console.log(`  t=${String(at).padStart(4)}ms  class="${d.cls}"  hero=${d.hero}  work=${d.work}`);
        if (at === 50) console.log(`  computed transition on .panel:  ${d.transition.slice(0,80)}`);
    }
    await browser.close();
})();
