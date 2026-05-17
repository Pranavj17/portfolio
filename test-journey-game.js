/**
 * Smoke-test for /journey · the playable side-scroller.
 *
 * Boots the page via an ephemeral local server, takes screenshots at
 * three game states so we can visually verify rendering before
 * declaring the build done:
 *   1. start overlay (insert-coin)
 *   2. mid-walk through chapter 1 (college zone)
 *   3. inside chapter 2 (fever 104 fm) with billboard revealed
 *   4. after collecting all 5 + reaching the end zone
 *
 * Output: /tmp/journey-game/{start,ch1,ch2,end}.png
 */
const puppeteer = require('puppeteer');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const OUT_DIR    = '/tmp/journey-game';
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
};

function serve(root) {
    return new Promise((resolve) => {
        const s = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const full = path.normalize(path.join(root, p));
            if (!full.startsWith(root)) { res.writeHead(403); res.end(); return; }
            fs.readFile(full, (err, data) => {
                if (err) { res.writeHead(404); res.end(); return; }
                res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
                res.end(data);
            });
        });
        s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const { s: server, port } = await serve(PUBLIC_DIR);
    const url = `http://127.0.0.1:${port}/journey.html`;
    console.log('▸ serving', url);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

    page.on('console',   (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));

    await page.goto(url, { waitUntil: 'networkidle0' });
    await sleep(400);

    // 1. start overlay
    await page.screenshot({ path: path.join(OUT_DIR, 'start.png') });
    console.log('  ✓ start.png');

    // press start
    await page.click('#btn-start');
    await sleep(200);

    // 2. mid-walk in ch1 · advance right a bit (zone 1 center is x=350)
    await page.keyboard.down('ArrowRight');
    await sleep(1000);
    await page.keyboard.up('ArrowRight');
    await sleep(600);  // pause to let billboard reveal
    await page.screenshot({ path: path.join(OUT_DIR, 'ch1.png') });
    console.log('  ✓ ch1.png');

    // 3. walk further to chapter 2 (fever 104) · zone center x=1250
    //    physics is now frame-rate independent; walk speed = 228 px/s.
    //    from ~350 we need ~900px → ~4s of walking.
    await page.keyboard.down('ArrowRight');
    await sleep(4000);
    await page.keyboard.up('ArrowRight');
    await sleep(1800);  // let billboard type out
    await page.screenshot({ path: path.join(OUT_DIR, 'ch2.png') });
    console.log('  ✓ ch2.png');

    // 4. jump + glitch trigger for chaos shot
    await page.keyboard.press('z');
    await sleep(60);
    await page.keyboard.press(' ');   // jump
    await sleep(150);
    await page.screenshot({ path: path.join(OUT_DIR, 'glitch.png') });
    console.log('  ✓ glitch.png');

    // 5. teleport to zone 5 via debug hook · collect all on the way
    await page.evaluate(() => {
        // force-collect everything for the end screen
        const j = window.__journey;
        for (const z of j.ZONES) {
            if (!j.state.collected.has(z.id)) {
                j.state.collected.add(z.id);
                j.state.loot++;
            }
        }
        j.state.player.x = 4150 - 30;
        j.state.zone = 4;
    });
    await sleep(900);  // let end-overlay trigger
    await page.screenshot({ path: path.join(OUT_DIR, 'end.png') });
    console.log('  ✓ end.png');

    await browser.close();
    server.close();
    console.log('\n✓ all screenshots in', OUT_DIR);
})();
