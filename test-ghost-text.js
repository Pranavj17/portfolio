/**
 * Browser test for the fish-style ghost-text autocomplete shipped in 51aa03b.
 *
 *   node test-ghost-text.js                         # tests pranavjagadish.com
 *   node test-ghost-text.js http://localhost:3000   # local
 *
 * Drives the live shell with Puppeteer:
 *   1. Loads the page with bootSeen=1 so the boot animation is skipped.
 *   2. Forces the console drawer open.
 *   3. For each test case, focuses the input, types one or two letters,
 *      then reads the ghost-pad + ghost-ghost spans.
 *   4. Verifies Tab and ArrowRight both accept the suggestion.
 *   5. Verifies Escape clears the ghost.
 *   6. Verifies a typed space suppresses the ghost (no first-word match
 *      because we don't do arg completion yet).
 * Saves a screenshot at the key moment for visual confirmation.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'https://pranavjagadish.com';
const OUT = path.join(__dirname, 'mobile-test-screens');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const fails = [];
function ok(name)            { pass++; console.log(`  ✓ ${name}`); }
function bad(name, detail)   { fail++; fails.push({ name, detail }); console.log(`  ✗ ${name}\n      ${detail}`); }
function assertEq(name, got, want) {
    if (got === want) ok(name);
    else bad(name, `expected ${JSON.stringify(want)} · got ${JSON.stringify(got)}`);
}

async function readGhost(page) {
    return page.evaluate(() => {
        const pad   = document.querySelector('#console-ghost .g-pad');
        const ghost = document.querySelector('#console-ghost .g-ghost');
        const inp   = document.querySelector('#console-input');
        return {
            pad:    pad?.textContent ?? null,
            ghost:  ghost?.textContent ?? null,
            input:  inp?.value ?? null,
        };
    });
}

async function clearInput(page) {
    await page.evaluate(() => {
        const inp = document.querySelector('#console-input');
        if (inp) {
            inp.value = '';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
}

// Re-open the console drawer if a previous step closed it (e.g. an Escape
// keypress that the site's global handler interprets as "close drawer").
// Mirrors what consoleOpen() in script.js does: add .open + drop inert.
async function reopenConsole(page) {
    await page.evaluate(() => {
        const c = document.querySelector('#console');
        if (c) {
            c.classList.add('open');
            c.removeAttribute('inert');
        }
    });
    await new Promise(r => setTimeout(r, 60));
    await page.focus('#console-input');
}

(async () => {
    console.log(`\nLoading ${URL} …`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

    // Set bootSeen before any script runs so the BIOS-POST animation skips.
    await page.evaluateOnNewDocument(() => {
        sessionStorage.setItem('bootSeen', '1');
    });

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the shell DOM to be in place.
    await page.waitForSelector('#console-input', { timeout: 10_000 });
    await page.waitForSelector('#console-ghost .g-pad',  { timeout: 5_000 });
    await page.waitForSelector('#console-ghost .g-ghost', { timeout: 5_000 });

    // Force the console drawer open. Mirror what consoleOpen() does in
    // script.js: add `.open` class AND remove the `inert` attribute. Without
    // removing `inert`, the input is non-focusable (subtree blocked from focus
    // order entirely) and page.keyboard.type would silently type into BODY.
    await page.evaluate(() => {
        const c = document.querySelector('#console');
        if (c) {
            c.classList.add('open');
            c.removeAttribute('inert');
        }
    });
    await new Promise(r => setTimeout(r, 100));
    await page.focus('#console-input');

    // Sanity: confirm focus actually stuck before we start typing.
    const focused = await page.evaluate(() => document.activeElement?.id);
    if (focused !== 'console-input') {
        throw new Error(`focus did not stick · activeElement.id="${focused}"`);
    }

    // Settle.
    await new Promise(r => setTimeout(r, 300));

    console.log('\n[A] Page loaded and shell DOM present');
    {
        const state = await readGhost(page);
        if (state.pad !== null && state.ghost !== null) ok('ghost overlay spans exist');
        else bad('ghost overlay spans exist', `pad=${state.pad} ghost=${state.ghost}`);
        if (state.input !== null) ok('console-input exists');
        else bad('console-input exists', 'no #console-input');
    }

    console.log("\n[B] Type 'm' → expect ghost matches first command starting with 'm'");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('m', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is 'm'",            s.input, 'm');
        assertEq("ghost pad mirrors typed 'm'",   s.pad,   'm');
        // Sorted command list starting with 'm': man, matrix, mcp → first is 'man'
        // So ghost should be 'an' (remainder of 'man' after 'm')
        if (s.ghost && s.ghost.length > 0) ok(`ghost shows a suggestion · "${s.ghost}"`);
        else bad('ghost shows a suggestion', `got "${s.ghost}"`);
    }

    await page.screenshot({ path: path.join(OUT, 'ghost-text-m.png'), fullPage: false });

    console.log('\n[C] Press Tab → ghost accepted, input becomes full command + space');
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, 60));
    {
        const s = await readGhost(page);
        if (s.input && /^\w+ $/.test(s.input)) ok(`input is command + space · "${s.input}"`);
        else bad('input is command + space', `input="${s.input}"`);
        // After Tab the trailing space means /\s/ matches → ghost cleared
        assertEq("ghost pad cleared after accept",   s.pad,   '');
        assertEq("ghost text cleared after accept",  s.ghost, '');
    }

    console.log("\n[D] Type 'mc' → expect ghost = 'p' (mcp is the only mc-prefix match)");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('mc', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is 'mc'", s.input, 'mc');
        assertEq("ghost pad mirrors 'mc'", s.pad, 'mc');
        assertEq("ghost suggestion is 'p' (→ mcp)", s.ghost, 'p');
    }

    console.log('\n[E] Press ArrowRight at end of input → accept ghost (fish-style)');
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 60));
    {
        const s = await readGhost(page);
        assertEq("input becomes 'mcp ' after →", s.input, 'mcp ');
    }

    console.log("\n[F] Type 't' → expect ghost = 'heme' (theme is the only t-prefix match)");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('t', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is 't'",       s.input, 't');
        assertEq("ghost suggestion = 'heme'", s.ghost, 'heme');
    }

    console.log('\n[G] Press Escape → ghost clears without intercepting input');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 60));
    {
        const s = await readGhost(page);
        // Input value is preserved; ghost spans cleared
        assertEq("input preserved through Escape", s.input, 't');
        assertEq("ghost pad cleared by Escape",    s.pad,   '');
        assertEq("ghost text cleared by Escape",   s.ghost, '');
    }

    // Escape closes the drawer (drops .open, re-applies inert). Re-open it
    // before continuing, otherwise subsequent typing goes to BODY.
    await reopenConsole(page);

    console.log("\n[H] Type 'xyz' (no command starts with xyz) → no ghost");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('xyz', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is 'xyz'",      s.input, 'xyz');
        assertEq("no ghost for unknown prefix · pad",   s.pad,   '');
        assertEq("no ghost for unknown prefix · ghost", s.ghost, '');
    }

    console.log("\n[I] Type 'theme dark' (space inside) → no ghost suggestion past the space");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('theme dark', { delay: 20 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is 'theme dark'", s.input, 'theme dark');
        assertEq("ghost suppressed past space · pad",   s.pad,   '');
        assertEq("ghost suppressed past space · ghost", s.ghost, '');
    }

    console.log("\n[J] Type '/' alone → ghost suggests the first command alphabetically");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('/', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is '/'", s.input, '/');
        // First command alphabetically across the full COMMANDS map.
        // Don't hardcode the name — just assert the ghost is non-empty
        // (the exact first cmd may change as new commands land).
        if (s.ghost && s.ghost.length > 0) ok(`ghost on bare slash · "${s.ghost}"`);
        else bad('ghost on bare slash', `got "${s.ghost}"`);
    }

    console.log("\n[K] Type '/h' → ghost = remainder of first h-prefixed command");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('/h', { delay: 30 });
    await new Promise(r => setTimeout(r, 80));
    {
        const s = await readGhost(page);
        assertEq("input value is '/h'", s.input, '/h');
        // Sorted commands starting with 'h': help, hire, history → first is 'help'
        // → ghost should be 'elp'
        assertEq("ghost = 'elp' for '/h' → '/help'", s.ghost, 'elp');
    }

    console.log("\n[L] Press Tab → '/h' + 'elp' becomes '/help '");
    await page.keyboard.press('Tab');
    await new Promise(r => setTimeout(r, 60));
    {
        const s = await readGhost(page);
        assertEq("input becomes '/help ' after Tab", s.input, '/help ');
    }

    console.log("\n[M] Type '/hire' verbatim → dispatch strips the slash and runs hire");
    await clearInput(page);
    await page.focus('#console-input');
    await page.keyboard.type('/hire', { delay: 20 });
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 200));
    {
        // After dispatch the input is cleared. We check that the printed
        // output doesn't contain "command not found" — if the slash dispatch
        // is broken, we'd see "zsh: command not found: /hire".
        const lastLines = await page.evaluate(() => {
            const out = document.querySelector('#console-out');
            return out ? out.textContent.slice(-400) : '';
        });
        if (!/command not found/i.test(lastLines)) ok('`/hire` dispatched without "command not found"');
        else bad('`/hire` dispatched without "command not found"', `tail of output: "${lastLines.slice(-150)}"`);
    }

    await page.screenshot({ path: path.join(OUT, 'ghost-text-final.png'), fullPage: false });

    await browser.close();

    console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed`);
    if (fails.length > 0) {
        console.log('\nFailures:');
        for (const f of fails) console.log(`  - ${f.name}: ${f.detail}`);
        process.exit(1);
    }
    console.log(`\nScreenshots written to ${OUT}/ghost-text-{m,final}.png`);
    process.exit(0);
})().catch(e => {
    console.error('\nFatal error:', e?.message || e);
    process.exit(2);
});
