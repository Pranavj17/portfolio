/**
 * Browser test of Phase A interactive features.
 * Records a WebM video showing each interaction:
 *   1. Splash → auto-start
 *   2. Walking with ArrowRight
 *   3. Pause via P key (PAUSED indicator visible)
 *   4. Click on a beat → lore card slides up
 *   5. Click again → lore card dismisses
 *   6. Click progress dot 5 (Sakha) → glide-teleport
 *   7. Walk into chapter range → collect (achievement card + particles + shake)
 *   8. Force end state → end-card CTA with stats + buttons
 *   9. Reload → "Welcome back" toast from localStorage
 *
 * Output: /tmp/journey-recording/test.webm + screenshots at each step.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/tmp/journey-recording';
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

    const errors = [];
    page.on('console',   m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));

    // Clear localStorage so we start fresh.
    await page.goto('http://127.0.0.1:4040/journey.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });

    // Start screencast (Puppeteer 22+ API · outputs WebM by default)
    const recorder = await page.screencast({ path: path.join(OUT_DIR, 'test.webm') });
    console.log('▸ recording started');

    // Reload to start fresh after clearing storage.
    await page.goto('http://127.0.0.1:4040/journey.html', { waitUntil: 'networkidle0' });
    await sleep(4000);  // splash auto-start

    // ====================================================================
    // TEST 1 · Walking with ArrowRight
    // ====================================================================
    console.log('▸ test 1: walking');
    await page.keyboard.down('ArrowRight');
    await sleep(2500);
    await page.keyboard.up('ArrowRight');
    await page.screenshot({ path: path.join(OUT_DIR, '01-walking.png') });

    // ====================================================================
    // TEST 2 · Pause via P
    // ====================================================================
    console.log('▸ test 2: pause');
    await page.keyboard.press('p');
    await sleep(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '02-paused.png') });
    await page.keyboard.press('p');     // resume
    await sleep(800);

    // ====================================================================
    // TEST 3 · Click a beat → lore card
    // ====================================================================
    console.log('▸ test 3: click beat → lore card');
    const beatInfo = await page.evaluate(() => {
        const j = window.__journey;
        if (!j || !j.BEATS) return null;
        // Find a beat near current position with screenX inside viewport
        const W = innerWidth, H = innerHeight;
        const cameraX = j.state.playerX - W * 0.32;
        const groundY = H * 0.88;
        for (const b of j.BEATS) {
            const ch = j.CHAPTERS.find(c => c.id === b.ch);
            if (!ch) continue;
            const sx = (ch.x + b.dx) - cameraX;
            const sy = groundY + b.dy;
            if (sx > 50 && sx < W - 50 && sy > 50 && sy < H - 50) {
                return { x: sx, y: sy, title: b.title, lore: b.lore };
            }
        }
        return null;
    });
    if (beatInfo) {
        console.log(`  found beat "${beatInfo.title}" at (${beatInfo.x|0}, ${beatInfo.y|0})`);
        await page.mouse.click(beatInfo.x, beatInfo.y);
        await sleep(2500);    // read lore
        await page.screenshot({ path: path.join(OUT_DIR, '03-lore-card.png') });
        // Dismiss
        await page.mouse.click(640, 400);
        await sleep(800);
    } else {
        console.log('  no beat in viewport (skipped)');
    }

    // ====================================================================
    // TEST 4 · Chapter teleport via progress dot
    // ====================================================================
    console.log('▸ test 4: click progress dot 5 (Sakha)');
    const dotBox = await page.evaluate(() => {
        const dots = document.querySelectorAll('#progress-strip .dot');
        if (dots.length < 5) return null;
        const r = dots[4].getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (dotBox) {
        await page.mouse.click(dotBox.x, dotBox.y);
        await sleep(500);
        await page.screenshot({ path: path.join(OUT_DIR, '04-teleport-start.png') });
        await sleep(4500);    // glide
        await page.screenshot({ path: path.join(OUT_DIR, '05-teleport-arrived.png') });
    }

    // ====================================================================
    // TEST 5 · Walk a bit + collect chapter (Sakha is at x=3600, we glided
    //          to 3520, so walking forward briefly enters the collect zone)
    // ====================================================================
    console.log('▸ test 5: walk into Sakha collect zone');
    await page.keyboard.down('ArrowRight');
    await sleep(1500);
    await page.keyboard.up('ArrowRight');
    await page.screenshot({ path: path.join(OUT_DIR, '06-collected.png') });

    // ====================================================================
    // TEST 6 · Force end-state to show the CTA card
    // ====================================================================
    console.log('▸ test 6: force end-state → CTA');
    await page.evaluate(() => {
        const j = window.__journey;
        for (const ch of j.CHAPTERS) j.state.collected.add(ch.id);
        j.state.playerX = 6500;
        // Mark some beats as discovered so stats show a non-zero number
        j.state.discoveredBeats.add('itics:football-match');
        j.state.discoveredBeats.add('itics:exam-anxiety');
        j.state.discoveredBeats.add('sakha:first-paycheck');
        j.state.discoveredBeats.add('scripbox:claude-code');
        j.state.discoveredBeats.add('scripbox:anthropic-talk');
    });
    await sleep(2500);
    await page.screenshot({ path: path.join(OUT_DIR, '07-end-card.png') });

    // ====================================================================
    // TEST 7 · Reload → restore session ("Welcome back")
    // ====================================================================
    console.log('▸ test 7: reload → welcome back');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(4500);    // splash + welcome-back card timing
    await page.screenshot({ path: path.join(OUT_DIR, '08-welcome-back.png') });

    // ====================================================================
    // Stop recording
    // ====================================================================
    await recorder.stop();
    console.log('▸ recording stopped');

    console.log('\nconsole errors during run:', errors.length);
    if (errors.length) console.log('  ' + errors.slice(0, 5).join('\n  '));

    await browser.close();

    // Convert WebM to MP4 for portability
    const { execSync } = require('child_process');
    try {
        execSync(`ffmpeg -y -i ${OUT_DIR}/test.webm -c:v libx264 -pix_fmt yuv420p -crf 22 ${OUT_DIR}/test.mp4 2>&1 | tail -2`,
                 { stdio: 'inherit' });
        console.log(`\n✓ recording: ${OUT_DIR}/test.mp4`);
        const stats = fs.statSync(`${OUT_DIR}/test.mp4`);
        console.log(`  size: ${(stats.size / 1024).toFixed(0)} KB`);
    } catch (e) {
        console.log(`\n✓ recording: ${OUT_DIR}/test.webm (ffmpeg conversion failed)`);
    }

    console.log(`✓ screenshots: ${OUT_DIR}/0[1-8]-*.png`);
})();
