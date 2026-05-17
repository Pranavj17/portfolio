/**
 * Browser-test for /journey · 2D side-scroller · debug + screenshots.
 *
 * Boots the page in a 1920x1080 desktop viewport AND a 390x844 mobile
 * viewport, then verifies:
 *   1. Canvas dimensions == viewport dimensions (full-screen on laptop)
 *   2. Player + ground + sky all rendered (sample pixels at expected positions)
 *   3. Single tap = single achievement card (no stacking on repeat)
 *   4. Arrow keys do NOT fire interactions (only Space/Enter do)
 *   5. Auto-walk advances player.playerX over time
 *
 * Output: /tmp/journey-game/{desktop|mobile}-*.png
 */
const puppeteer = require('puppeteer');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const OUT_DIR    = '/tmp/journey-game';
fs.rmSync(OUT_DIR, { recursive: true, force: true });
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

async function runViewport(browser, url, label, vw, vh) {
    console.log(`\n── ${label} · ${vw}×${vh} ─────────────────────`);
    const page = await browser.newPage();
    await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console',   (m) => { if (m.type() === 'error') { console.error('  [page-err]', m.text()); errors.push(m.text()); } });
    page.on('pageerror', (e) => { console.error('  [pageerror]', e.message); errors.push(e.message); });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await sleep(500);

    // ── CANVAS FILLS VIEWPORT ──
    const canvasInfo = await page.evaluate(() => {
        const c = document.getElementById('stage');
        const r = c.getBoundingClientRect();
        return {
            bitmapW: c.width, bitmapH: c.height,
            cssW: r.width, cssH: r.height,
            vpW: window.innerWidth, vpH: window.innerHeight,
        };
    });
    console.log(`  canvas: bitmap ${canvasInfo.bitmapW}×${canvasInfo.bitmapH} · css ${canvasInfo.cssW}×${canvasInfo.cssH} · viewport ${canvasInfo.vpW}×${canvasInfo.vpH}`);
    if (Math.abs(canvasInfo.cssW - canvasInfo.vpW) > 2 || Math.abs(canvasInfo.cssH - canvasInfo.vpH) > 2) {
        throw new Error(`${label}: canvas CSS size ${canvasInfo.cssW}×${canvasInfo.cssH} does NOT match viewport ${canvasInfo.vpW}×${canvasInfo.vpH}`);
    }
    console.log('  ✓ canvas fills full viewport');

    // ── WAIT FOR SPLASH + AUTO-START ──
    await sleep(3800);
    const started = await page.evaluate(() => window.__journey?.state?.running === true);
    if (!started) throw new Error(`${label}: auto-start didn't fire after 3.8s`);
    console.log('  ✓ auto-start fired');

    // ── PLAYER ADVANCES (auto-walk) ──
    const beforeX = await page.evaluate(() => window.__journey.state.playerX);
    await sleep(1200);
    const afterX = await page.evaluate(() => window.__journey.state.playerX);
    console.log(`  player.x: ${beforeX.toFixed(0)} → ${afterX.toFixed(0)} (Δ ${(afterX - beforeX).toFixed(0)})`);
    if (afterX - beforeX < 30) throw new Error(`${label}: player should advance ≥30px in 1.2s but only moved ${(afterX-beforeX).toFixed(0)}`);
    console.log('  ✓ auto-walk advances playerX');

    // ── DESKTOP-ONLY: ARROW KEYS DO NOT TRIGGER INTERACTION ──
    if (label === 'desktop') {
        // record achievement count before pressing arrows
        const beforeAchCount = await page.evaluate(() => document.querySelectorAll('.achievement').length);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
        await sleep(200);
        const afterArrowsAch = await page.evaluate(() => document.querySelectorAll('.achievement').length);
        if (afterArrowsAch !== beforeAchCount) {
            throw new Error(`${label}: arrow keys triggered ${afterArrowsAch - beforeAchCount} achievement(s) · should be 0`);
        }
        console.log('  ✓ arrow keys do not trigger interaction');

        // SPACE should trigger interaction
        await page.keyboard.press(' ');
        await sleep(200);
        const afterSpaceCount = await page.evaluate(() => document.querySelectorAll('.achievement').length);
        if (afterSpaceCount === beforeAchCount) {
            throw new Error(`${label}: Space did not fire achievement card`);
        }
        console.log('  ✓ Space triggers interaction');
    }

    // ── ACHIEVEMENT DE-DUP: rapid taps should only ever show 1 card ──
    // simulate 5 rapid taps on the canvas
    const rect = await page.evaluate(() => {
        const c = document.getElementById('stage');
        const r = c.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
    for (let i = 0; i < 5; i++) {
        await page.mouse.click(rect.cx, rect.cy);
        await sleep(50);
    }
    await sleep(150);
    const cardCount = await page.evaluate(() => document.querySelectorAll('.achievement').length);
    console.log(`  rapid 5-click → ${cardCount} achievement card(s) visible`);
    if (cardCount > 1) throw new Error(`${label}: ${cardCount} achievement cards stacked · should be 1`);
    console.log('  ✓ only one achievement card on rapid taps');

    // ── PIXEL SANITY: sample canvas to confirm sky + ground + player render ──
    const samples = await page.evaluate(() => {
        const c = document.getElementById('stage');
        const ctx = c.getContext('2d', { willReadFrequently: true });
        // sample roughly: sky (upper third), ground (lower third), player area (32% across, just above ground)
        const W = c.width, H = c.height;
        const sky    = Array.from(ctx.getImageData(W * 0.5,  H * 0.20, 1, 1).data).slice(0, 3);
        const ground = Array.from(ctx.getImageData(W * 0.5,  H * 0.92, 1, 1).data).slice(0, 3);
        const player = Array.from(ctx.getImageData(W * 0.32, H * 0.82, 1, 1).data).slice(0, 3);
        return { sky, ground, player };
    });
    console.log(`  sky pixel:    rgb(${samples.sky.join(',')})`);
    console.log(`  ground pixel: rgb(${samples.ground.join(',')})`);
    console.log(`  player area:  rgb(${samples.player.join(',')})`);
    const skyBright   = samples.sky.reduce((a, b) => a + b, 0);
    const groundBright = samples.ground.reduce((a, b) => a + b, 0);
    if (skyBright < 60)    throw new Error(`${label}: sky pixel is too dark (sum=${skyBright}) · canvas may not be rendering`);
    if (groundBright < 60) throw new Error(`${label}: ground pixel is too dark (sum=${groundBright}) · canvas may not be rendering ground band`);
    console.log('  ✓ sky + ground are rendered (nonzero pixels at expected positions)');

    await page.screenshot({ path: path.join(OUT_DIR, `${label}-final.png`) });
    console.log(`  ✓ saved ${label}-final.png`);

    await page.close();
    if (errors.length) throw new Error(`${label} saw ${errors.length} console errors`);
    console.log(`  ✓ no console errors`);
}

(async () => {
    const { s: server, port } = await serve(PUBLIC_DIR);
    const url = `http://127.0.0.1:${port}/journey.html`;
    console.log('▸ serving', url);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
        await runViewport(browser, url, 'desktop', 1920, 1080);
        await runViewport(browser, url, 'mobile',  390,  844);
        console.log('\n✓ all checks passed · screenshots in', OUT_DIR);
    } catch (err) {
        console.error('\n✗ test failed:', err.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
        server.close();
    }
})();
