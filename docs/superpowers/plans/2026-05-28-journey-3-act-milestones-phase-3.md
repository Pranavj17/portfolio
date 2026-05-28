# Journey · 3-Act Milestones · Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Roll out the remaining 7 journey chapters (ITICS, DSCE, FEVER 104, SAKHA, SCRIPBOX, THE GT, NOW) as 3-act vignettes behind `?v=2`, after addressing the 6 architectural prerequisites surfaced by Phase 1+2's final review.

**Architecture:** Reuse the Phase 1+2 harness as-is (cutscene/NPC/quest/minigame/culmination + chapter store + phase machine). Each chapter adds one row to each content table plus one mini-game module. The hash-based v1 bridge is replaced by a real bridge that v1's `journey.js` populates from its internal `state`/`CHAPTERS`/`chapterIdxAt` — so v1 now LOADS ALONGSIDE v2 (not instead of) when `?v=2`. The orchestrator's module-level singletons (`_act3Started`, `_questPollTimer`, `_activeFlow`) become per-chapter maps so flows don't collide across chapters.

**Tech Stack:** Vanilla JS, `node:test` for unit tests, Puppeteer for integration tests, Express dev server (`server.js`), GitHub Pages.

**Branch (proposed):** `feat/journey-3-act-milestones-phase-3` (off main at `7429198`)

**Spec:** `docs/superpowers/specs/2026-05-28-journey-3-act-milestones-design.md`

**Phase 1+2 baseline:** main commit `7429198` (merged). 34 unit tests + 6 integration tests passing.

---

## Conventions

- **Unit tests:** `tests/unit/*.test.js`, run via `npm run test:unit` (`node --test tests/unit/`).
- **Integration tests:** `test-v2-*.js` at repo root, run via `npm run test:integration` (added in Task 2). Each is plain Puppeteer.
- **Source files:** `src/journey/{core,world,state,acts,ui,data}/*.js`. Concat at build time via `build.js` into `public/journey-v2.js` (single IIFE).
- **Test helpers:** `tests/integration/helpers.js` (added in Task 1). Common Puppeteer setup + `waitVisible` + chapter walk-through scaffolding.
- **Commits:** every task ends with one commit. Prefix: `journey-v2:` (continuing the Phase 1+2 convention).
- **Dev server:** `node server.js` from project root (`http://localhost:3000`). Restart if it dies between tasks.
- **Built artifact:** `public/journey-v2.js` IS committed (so GitHub Pages serves a static file). The build-test in Task 3 verifies the committed bundle matches a fresh build.

---

## File structure

```
src/journey/
├── core.js                          # orchestrator (rewritten in Task 5; gets V2_ENABLED_CHAPTERS expanded each chapter task)
├── state/                           # unchanged from Phase 1
├── world/
│   └── npcs.js                      # each chapter task adds an entry
├── data/
│   ├── cutscenes.js                 # each chapter task adds an entry
│   └── culminations.js              # each chapter task adds an entry
├── acts/
│   ├── cutscene.js / npc.js / culmination.js / quest.js / minigame.js  # unchanged
│   └── minigames/
│       ├── mock-test.js             # existing (CMR, Phase 2)
│       ├── kick-football.js         # NEW · ITICS
│       ├── debug-the-pr.js          # NEW · SCRIPBOX
│       ├── type-the-future.js       # NEW · NOW
│       ├── standup-bingo.js         # NEW · SAKHA
│       ├── cad-snap.js              # NEW · DSCE
│       ├── live-mix.js              # NEW · FEVER 104
│       └── parallel-park.js         # NEW · THE GT
└── ui/                              # unchanged

public/
├── journey.js                       # MODIFIED in Task 6 (v1 bridge patch at end of IIFE)
└── journey.html                     # MODIFIED in Task 6 (load both bundles when ?v=2)

tests/
├── unit/                            # add one *.test.js per new mini-game (7 new files)
└── integration/
    └── helpers.js                   # NEW in Task 1

test-v2-*.js                         # root-level Puppeteer tests, refactored in Task 1 + 7 new chapter tests
build.js                             # MODIFIED in Task 1 (manifest expanded for 7 new mini-games) and Task 3 (build-test improvements)
package.json                         # MODIFIED in Task 2 (scripts) and Task 6 (bundle-policy docs)
```

---

## Phase 3a — Prerequisites (Tasks 1–6)

These must land before any chapter rollout. They unblock the chapter tests and prevent the re-entry loop / cross-chapter state collisions that the final review flagged.

---

### Task 1 — Lift Puppeteer helper to `tests/integration/helpers.js`

**Files:**
- Create: `tests/integration/helpers.js`
- Modify: `test-v2-cutscene.js`
- Modify: `test-v2-npc.js`
- Modify: `test-v2-minigame.js`
- Modify: `test-v2-culmination.js`
- Modify: `test-v2-chapter-cmr.js`

(`test-v2-flag.js` keeps its custom request-recording — different shape, doesn't fit the helper.)

- [ ] **Step 1 — Create `tests/integration/helpers.js`**

```javascript
/**
 * Shared Puppeteer scaffolding for v2 integration tests.
 * Every test should call `await withV2Page(url, async (page, browser) => { ... })`
 * which handles launch + viewport + cleanup. `waitVisible` polls an overlay's
 * aria-hidden flag.
 */
const puppeteer = require('puppeteer');

async function waitVisible(page, sel, timeout = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(s => {
      const el = document.querySelector(s);
      return el && el.getAttribute('aria-hidden') === 'false';
    }, sel);
    if (ok) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`timeout waiting for ${sel} to become visible`);
}

async function withV2Page(url, fn, { viewport = { width: 800, height: 600 } } = {}) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(`${url}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.clear(); });
    await fn(page, browser);
  } finally {
    await browser.close();
  }
}

module.exports = { waitVisible, withV2Page };
```

- [ ] **Step 2 — Refactor `test-v2-cutscene.js` to use the helper**

```javascript
/**
 * Loads ?v=2, calls window.__journeyV2.playCutscene from the page console,
 * asserts the overlay becomes visible, asserts a click dismisses it.
 */
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const dismissP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'PLACEHOLDER' }, res)
    ));
    await waitVisible(page, '#v2-cutscene');
    await page.click('#v2-cutscene');
    await dismissP;
    const hidden = await page.evaluate(() =>
      document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'true'
    );
    if (!hidden) throw new Error('cutscene overlay did not dismiss on click');
    console.log('PASS: cutscene visible + dismissable');
  });
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3 — Refactor `test-v2-npc.js` to use the helper**

```javascript
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const pickedIdxP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.presentNpc('__placeholder', res)
    ));
    await waitVisible(page, '#v2-npc');
    await page.click('.v2-npc-choice[data-idx="1"]');
    await new Promise(r => setTimeout(r, 100));
    await page.click('#v2-npc');
    await new Promise(r => setTimeout(r, 100));
    await page.click('#v2-npc');
    const pickedIdx = await pickedIdxP;
    if (pickedIdx !== 1) throw new Error(`expected pickedIdx=1, got ${pickedIdx}`);
    console.log('PASS: NPC dialog choice flow');
  });
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4 — Refactor `test-v2-minigame.js` to use the helper**

```javascript
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const resultP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.initMinigame('__stub', res)
    ));
    await waitVisible(page, '#v2-minigame');
    const result = await resultP;
    if (typeof result.score !== 'number') throw new Error('score is not a number');
    if (!result.label || typeof result.label !== 'string') throw new Error('label is missing');
    const hiddenAfter = await page.evaluate(() =>
      document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'true'
    );
    if (!hiddenAfter) throw new Error('overlay did not dismiss after completion');
    console.log(`PASS: mini-game harness · score=${result.score} label=${result.label}`);
  });
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5 — Refactor `test-v2-culmination.js` to use the helper**

```javascript
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  await withV2Page(URL, async (page) => {
    const doneP = page.evaluate(() => new Promise(res =>
      window.__journeyV2.showCulmination('__placeholder', 'PLACEHOLDER', res)
    ));
    await waitVisible(page, '#v2-culmination');
    const txt = await page.$eval('#v2-culmination-text', el => el.textContent);
    if (!txt || txt.length < 10) throw new Error(`culmination text empty: "${txt}"`);
    await page.click('#v2-culmination');
    await doneP;
    console.log('PASS: culmination card visible + dismissable');
  });
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6 — Refactor `test-v2-chapter-cmr.js` to use the helper**

NOTE: this test still uses the hash-based bridge today; Task 6 will rewrite it to use the real v1 bridge. For Task 1 we only refactor the boilerplate (launch + waitVisible) — leave the `?v=2#cmr` URL and `__cmrAddBeat` calls intact.

```javascript
/**
 * End-to-end test: visit journey.html?v=2#cmr, walk the full 3-act flow,
 * assert localStorage.journey.chapters.cmr.phase === 'complete'.
 *
 * Note: still uses the hash-based bridge — Task 6 will rewrite to use real
 * v1 walking. After refactor in Task 6 this file becomes the template for
 * the 7 chapter-test files in Phase 3b.
 */
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2#cmr`, { waitUntil: 'networkidle0' });

  await waitVisible(page, '#v2-cutscene');
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  await page.evaluate(() => {
    window.__cmrAddBeat('tuition-rush');
    window.__cmrAddBeat('mock-test');
    window.__cmrAddBeat('first-crush');
  });

  await waitVisible(page, '#v2-minigame', 3000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (!persisted || persisted.v !== 2) throw new Error('storage v != 2');
  const ch = persisted.chapters?.cmr;
  if (!ch) throw new Error('chapters.cmr missing');
  if (ch.phase !== 'complete') throw new Error(`expected phase=complete, got ${ch.phase}`);
  if (typeof ch.score !== 'number') throw new Error(`expected score:number, got ${ch.score}`);
  if (ch.npcChoice !== 0) throw new Error(`expected npcChoice=0, got ${ch.npcChoice}`);

  console.log(`PASS: CMR full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 7 — Run every refactored test to confirm green**

(Dev server must be running on `http://localhost:3000`. If not: `cd /Users/pranav.j/Documents/portfolio && node server.js &`.)

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && \
  node test-v2-flag.js && \
  node test-v2-cutscene.js && \
  node test-v2-npc.js && \
  node test-v2-minigame.js && \
  node test-v2-culmination.js && \
  node test-v2-chapter-cmr.js
```

Expected: all 6 PASS.

- [ ] **Step 8 — Commit**

```bash
git add tests/integration/helpers.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js
git commit -m "journey-v2: lift puppeteer scaffolding to tests/integration/helpers.js

Shared waitVisible + withV2Page wrappers reduce per-test boilerplate
from ~25 to ~10 lines. Refactored 5 of 6 integration tests
(test-v2-flag stays custom — its request-recording shape doesn't fit
the helper)."
```

---

### Task 2 — `test:integration` and unified `test` npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1 — Read current `package.json` scripts block**

```bash
grep -A 10 '"scripts"' /Users/pranav.j/Documents/portfolio/package.json
```

Note: the existing block contains `start`, `dev`, `build`, `build:v2`, `watch`, `postinstall`, `generate-pdf`, `test:unit`.

- [ ] **Step 2 — Replace the scripts block**

```json
"scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "node build.js && mkdir -p build && cp -r public/* build/",
    "build:v2": "node build.js",
    "watch": "nodemon --watch routes --watch server.js --watch public/index.html --watch public/styles.css --watch src/journey --exec 'npm run build:v2 && node server.js'",
    "postinstall": "npm run build",
    "generate-pdf": "node generate-pdf.js",
    "test:unit": "node --test tests/unit/",
    "test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js; do echo \"▸ $f\"; node $f || exit 1; done",
    "test": "npm run test:unit && npm run test:integration"
}
```

Notes:
- `test:integration` runs each integration test sequentially, fails fast on first error.
- Phase 3b's chapter tests will be appended to that list (one per chapter task).
- `npm test` (no colon prefix) runs the full suite.

- [ ] **Step 3 — Validate JSON syntax**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/pranav.j/Documents/portfolio/package.json', 'utf8'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4 — Run `npm run test:integration` to confirm**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run test:integration
```

Expected: all 6 tests run and PASS in sequence (output banner per file).

- [ ] **Step 5 — Run `npm test` (full suite)**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 34 unit + 6 integration = 40 tests PASS.

- [ ] **Step 6 — Commit**

```bash
git add package.json
git commit -m "journey-v2: npm test runs full suite (unit + integration)

- test:integration runs all 6 v2 Puppeteer scripts sequentially
- test = test:unit && test:integration
- Phase 3 chapter tests will append to the for-loop manifest"
```

---

### Task 3 — Built-artifact policy: verify bundle is current

**Files:**
- Modify: `tests/unit/build.test.js` (add a "bundle is current" assertion)
- Create: `docs/journey-v2-build-policy.md`

**Decision:** `public/journey-v2.js` STAYS committed (GitHub Pages serves static files; no build step on the server). We add a unit test that verifies the committed bundle byte-matches a fresh build. If a developer edits `src/journey/` without rebuilding, the test fails with a clear message.

- [ ] **Step 1 — Replace `tests/unit/build.test.js`**

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

test('build.js produces a wrapped IIFE bundle containing all sources', () => {
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  execSync('node build.js', { cwd: ROOT });
  const out = fs.readFileSync(OUT, 'utf8');
  assert.match(out, /^\(\(\) => \{/, 'must start with IIFE open');
  assert.match(out, /\}\)\(\);\s*$/, 'must end with IIFE close');
  assert.match(out, /'use strict';/);
  assert.match(out, /\/\/ === src\/journey\/core\.js ===/, 'must include core.js marker');
});

test('committed bundle byte-matches a fresh build (run `npm run build:v2` if this fails)', () => {
  const committed = fs.readFileSync(OUT, 'utf8');           // current on disk after previous test rebuilt
  execSync('node build.js', { cwd: ROOT });
  const fresh = fs.readFileSync(OUT, 'utf8');
  assert.strictEqual(fresh, committed,
    'bundle drift detected — run `npm run build:v2` and commit the result');
});
```

Note: the first test rebuilds the bundle as a side effect; the second test confirms a SECOND rebuild produces the same output (idempotent). The "committed bundle byte-matches" semantics work IF the developer ran `npm run build:v2` before committing — which is now the policy.

To verify a bundle commit was missed (the real scenario we want to catch), we need a pre-rebuild snapshot. Update the test:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

test('committed bundle matches a fresh build (run `npm run build:v2` if this fails)', () => {
  const committedExists = fs.existsSync(OUT);
  const committed = committedExists ? fs.readFileSync(OUT, 'utf8') : null;
  execSync('node build.js', { cwd: ROOT });
  const fresh = fs.readFileSync(OUT, 'utf8');
  // Always restore so the test is idempotent (doesn't dirty the working tree)
  if (committedExists) fs.writeFileSync(OUT, committed);
  assert.ok(committedExists, 'public/journey-v2.js must be committed');
  assert.strictEqual(fresh, committed,
    'bundle drift detected — run `npm run build:v2` and commit the result');
});

test('bundle has the IIFE wrapper structure', () => {
  // OUT was restored by the previous test, but if it was missing then,
  // build first.
  if (!fs.existsSync(OUT)) execSync('node build.js', { cwd: ROOT });
  const out = fs.readFileSync(OUT, 'utf8');
  assert.match(out, /^\(\(\) => \{/, 'must start with IIFE open');
  assert.match(out, /\}\)\(\);\s*$/, 'must end with IIFE close');
  assert.match(out, /'use strict';/);
  assert.match(out, /\/\/ === src\/journey\/core\.js ===/, 'must include core.js marker');
});
```

This version:
1. Snapshots the committed bundle.
2. Rebuilds.
3. Diffs.
4. Restores the committed bundle (so the working tree stays clean).
5. Asserts both committed-exists AND identical-content.
6. Second test verifies IIFE structure on the (rebuilt or current) bundle.

- [ ] **Step 2 — Run the new build tests**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/build.test.js
```

Expected: 2 PASS.

- [ ] **Step 3 — Sanity check: simulate drift, confirm test FAILs**

```bash
cd /Users/pranav.j/Documents/portfolio && \
  echo "// drift" >> public/journey-v2.js && \
  node --test tests/unit/build.test.js ; echo "exit=$?" && \
  npm run build:v2  # restore
```

Expected: build.test.js exits non-zero with "bundle drift detected — run npm run build:v2"; then `npm run build:v2` restores green state.

- [ ] **Step 4 — Run full unit suite to confirm no regression**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run test:unit
```

Expected: 35 PASS (was 34; the new build test is in addition to the old test, which got merged into the second one — so the count is actually 35 if both new tests count. If 34, the IIFE-wrapper test replaced the original.)

Note: Confirm the actual count. If the file went from 1 test (original) to 2 tests (drift-check + structure-check), total is 35. If it went from 1 to 2 but one is identical to the original (same name?), check that both test() blocks register.

- [ ] **Step 5 — Create `docs/journey-v2-build-policy.md`**

```markdown
# Journey v2 · Build-Artifact Policy

**Last updated:** 2026-05-28

## Policy

`public/journey-v2.js` IS committed to git. GitHub Pages serves it as a
static file with no build step on the server side.

## Rules

1. **If you change `src/journey/**/*.js`, run `npm run build:v2` and commit
   the regenerated `public/journey-v2.js` in the same commit.**
2. The unit test `tests/unit/build.test.js` enforces the rule:
   "bundle drift detected — run `npm run build:v2` and commit the result".
3. The integration tests rebuild before running (`build:v2` is the first
   step of `test:integration`).

## Future (Phase 4 cutover)

When v2 graduates to default, `public/journey.js` (v1) is deleted and
`public/journey-v2.js` is renamed to `public/journey.js`. The build policy
stays the same. There's no plan to introduce a bundler or move to a build
step on the server side — vanilla JS + static files keeps deployment
trivial.
```

- [ ] **Step 6 — Commit**

```bash
git add tests/unit/build.test.js docs/journey-v2-build-policy.md
git commit -m "journey-v2: enforce committed-bundle-matches-build invariant

Adds a unit test that snapshots the on-disk bundle, rebuilds, diffs, and
restores. If src/journey/ changed without a corresponding build, the test
fails with a clear remediation message. Policy documented in
docs/journey-v2-build-policy.md."
```

---

### Task 4 — Fix orchestrator re-entry loop

**Files:**
- Modify: `src/journey/core.js` (`startChapterFlow` function only)
- Modify: `test-v2-chapter-cmr.js` (add a re-entry assertion)

- [ ] **Step 1 — Read the current `startChapterFlow` function in `src/journey/core.js`**

```bash
sed -n '33,49p' /Users/pranav.j/Documents/portfolio/src/journey/core.js
```

Confirm it matches Phase 2's version (lines 33–49 in the current file).

- [ ] **Step 2 — Replace `startChapterFlow` with the re-entry-safe version**

Find this block:

```javascript
function startChapterFlow(chapterId) {
  if (_activeFlow === chapterId) return;
  _activeFlow = chapterId;
  const store = window.__journeyV2.store;
  const phase = store.getChapter(chapterId).phase;
  const intertitle = (window.__journeyV1Bridge?.getIntertitle?.(chapterId)) || {};

  if (phase === 'unseen') {
    store.send(chapterId, 'ENTER');                 // → cutscene
    playCutscene(chapterId, intertitle, () => {
      store.send(chapterId, 'DISMISS');             // → exploring
      enterExploring(chapterId);
    });
  } else {
    enterExploring(chapterId);
  }
}
```

Replace with:

```javascript
function startChapterFlow(chapterId) {
  if (_activeFlow === chapterId) return;
  const store = window.__journeyV2.store;
  const phase = store.getChapter(chapterId).phase;
  // Re-entry: completed chapters don't auto-replay. Medal-mode replay is a
  // Phase 4 polish item (see docs/journey-v2-status.md).
  if (phase === 'complete') return;
  _activeFlow = chapterId;
  const intertitle = (window.__journeyV1Bridge?.getIntertitle?.(chapterId)) || {};

  if (phase === 'unseen') {
    store.send(chapterId, 'ENTER');                 // → cutscene
    playCutscene(chapterId, intertitle, () => {
      store.send(chapterId, 'DISMISS');             // → exploring
      enterExploring(chapterId);
    });
  } else {
    enterExploring(chapterId);
  }
}
```

Key changes:
- Phase check moved BEFORE `_activeFlow` assignment.
- New `if (phase === 'complete') return;` guard.

- [ ] **Step 3 — Add re-entry assertion to `test-v2-chapter-cmr.js`**

At the END of the test (right before `console.log('PASS: ...');`), add:

```javascript
  // Re-entry: orchestrator poll is still running. Wait two ticks (~600ms),
  // then assert that the NPC overlay did NOT reappear.
  await new Promise(r => setTimeout(r, 600));
  const npcReappeared = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (npcReappeared) throw new Error('completed chapter re-fired NPC (re-entry loop bug)');
```

- [ ] **Step 4 — Rebuild + run the e2e test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && node test-v2-chapter-cmr.js
```

Expected: `PASS: CMR full vignette · score=50 npcChoice=0` AND no "re-entry loop bug" failure.

- [ ] **Step 5 — Run the full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 35 unit + 6 integration PASS.

- [ ] **Step 6 — Commit**

```bash
git add src/journey/core.js test-v2-chapter-cmr.js public/journey-v2.js
git commit -m "journey-v2: stop orchestrator from re-firing completed chapters

startChapterFlow now early-returns when phase === 'complete' so the 250ms
poll doesn't re-trigger Act II/III after culmination dismiss. The e2e
test asserts NPC does not reappear 600ms after the chapter closes."
```

---

### Task 5 — De-singleton-ize `_act3Started` and `_questPollTimer`

**Files:**
- Modify: `src/journey/core.js`

Currently `_act3Started` is a boolean and `_questPollTimer` is a single interval — both shared across all chapters. The first chapter to start Act III locks out the others. Convert to per-chapter maps.

- [ ] **Step 1 — Replace module-level decls and update usages**

In `/Users/pranav.j/Documents/portfolio/src/journey/core.js`:

Change line 75:

```javascript
let _questPollTimer = null;
```

To:

```javascript
const _questPollTimers = {};   // { [chapterId]: intervalId }
```

Change line 88:

```javascript
let _act3Started = false;
```

To:

```javascript
const _act3Started = {};       // { [chapterId]: true }
```

- [ ] **Step 2 — Update `pollQuest`**

Replace the existing `pollQuest`:

```javascript
function pollQuest(chapterId) {
  if (_questPollTimer) clearInterval(_questPollTimer);
  _questPollTimer = setInterval(() => {
    const cm = collectedBeatsMap();
    showQuestHud(chapterId, cm);
    const q = QUESTS[chapterId];
    if (q && isQuestComplete(q.beats, q.needed, cm)) {
      checkQuestComplete(chapterId);
    }
  }, 500);
}
```

With:

```javascript
function pollQuest(chapterId) {
  if (_questPollTimers[chapterId]) clearInterval(_questPollTimers[chapterId]);
  _questPollTimers[chapterId] = setInterval(() => {
    const cm = collectedBeatsMap();
    showQuestHud(chapterId, cm);
    const q = QUESTS[chapterId];
    if (q && isQuestComplete(q.beats, q.needed, cm)) {
      checkQuestComplete(chapterId);
    }
  }, 500);
}
```

- [ ] **Step 3 — Update `checkQuestComplete`**

Replace the existing `checkQuestComplete`:

```javascript
function checkQuestComplete(chapterId) {
  if (_act3Started) return;
  const q = QUESTS[chapterId];
  const cm = collectedBeatsMap();
  if (!q || !isQuestComplete(q.beats, q.needed, cm)) return;
  // Need NPC choice recorded AND quest complete
  if (window.__journeyV2.store.getChapter(chapterId).npcChoice == null) return;
  _act3Started = true;
  if (_questPollTimer) clearInterval(_questPollTimer);
  hideQuestHud();
  window.__journeyV2.store.send(chapterId, 'QUEST_COMPLETE');
  initMinigame(chapterId, ({ score, label }) => {
    window.__journeyV2.store.setScore(chapterId, score);
    window.__journeyV2.store.send(chapterId, 'MINIGAME_DONE');
    const lbl = window.__journeyV1Bridge?.getChapterLabel?.(chapterId) ?? chapterId.toUpperCase();
    showCulmination(chapterId, lbl, () => {
      window.__journeyV2.store.send(chapterId, 'DISMISS');
      _act3Started = false;
      _activeFlow = null;
    });
  });
}
```

With:

```javascript
function checkQuestComplete(chapterId) {
  if (_act3Started[chapterId]) return;
  const q = QUESTS[chapterId];
  const cm = collectedBeatsMap();
  if (!q || !isQuestComplete(q.beats, q.needed, cm)) return;
  // Need NPC choice recorded AND quest complete
  if (window.__journeyV2.store.getChapter(chapterId).npcChoice == null) return;
  _act3Started[chapterId] = true;
  if (_questPollTimers[chapterId]) {
    clearInterval(_questPollTimers[chapterId]);
    delete _questPollTimers[chapterId];
  }
  hideQuestHud();
  window.__journeyV2.store.send(chapterId, 'QUEST_COMPLETE');
  initMinigame(chapterId, ({ score, label }) => {
    window.__journeyV2.store.setScore(chapterId, score);
    window.__journeyV2.store.send(chapterId, 'MINIGAME_DONE');
    const lbl = window.__journeyV1Bridge?.getChapterLabel?.(chapterId) ?? chapterId.toUpperCase();
    showCulmination(chapterId, lbl, () => {
      window.__journeyV2.store.send(chapterId, 'DISMISS');
      delete _act3Started[chapterId];
      _activeFlow = null;
    });
  });
}
```

- [ ] **Step 4 — Rebuild + run full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

Expected: 35 unit + 6 integration PASS. CMR e2e still green.

- [ ] **Step 5 — Commit**

```bash
git add src/journey/core.js public/journey-v2.js
git commit -m "journey-v2: per-chapter _act3Started + _questPollTimers maps

Replaces module-level singletons so multi-chapter orchestration doesn't
collide. CMR e2e still green; no behavior change for single-chapter
flows."
```

---

### Task 6 — Real v1 bridge + load both bundles when `?v=2`

**Files:**
- Modify: `public/journey.js` (add bridge block at end of v1 IIFE, just before line 9311 closing)
- Modify: `public/journey.html` (script-swap → "always load v1, also load v2 when ?v=2", AND remove the hash-based bridge installer)
- Modify: `test-v2-chapter-cmr.js` (rewrite to walk via v1 controls — this is now the e2e template for Phase 3b)
- Modify: `test-v2-flag.js` (assert both bundles load when `?v=2`, only v1 on default)

The hash bridge (`#cmr` + `__cmrAddBeat`) is removed entirely. The real bridge exposes `getCurrentChapterId` (from `chapterIdxAt(state.playerX)`), `getDiscoveredBeats` (from `state.discoveredBeats`), `getIntertitle` (from `CHAPTER_INTERTITLES`), `getChapterLabel` (from `CHAPTERS[i].label`), and `playStageVideo`.

- [ ] **Step 1 — Add the bridge block to v1's `public/journey.js`**

Find the closing `})()` at line 9311. INSERT this block IMMEDIATELY BEFORE that closing line (so it lives inside the IIFE and has lexical access to `state`, `CHAPTERS`, `chapterIdxAt`, `CHAPTER_INTERTITLES`, `playStageVideo`):

```javascript
    // === v2 bridge · exposes v1 internals to journey-v2.js when both load ===
    // Defensive: each accessor is null-safe so v1 still works if v2 isn't loaded.
    window.__journeyV1Bridge = {
        getCurrentChapterId() {
            if (typeof state !== 'object' || typeof state.playerX !== 'number') return null;
            if (typeof chapterIdxAt !== 'function' || !Array.isArray(CHAPTERS)) return null;
            const idx = chapterIdxAt(state.playerX);
            return (idx >= 0 && idx < CHAPTERS.length) ? CHAPTERS[idx].id : null;
        },
        getDiscoveredBeats() {
            return (state && state.discoveredBeats instanceof Set) ? state.discoveredBeats : new Set();
        },
        getIntertitle(id) {
            return (typeof CHAPTER_INTERTITLES === 'object') ? (CHAPTER_INTERTITLES[id] || {}) : {};
        },
        getChapterLabel(id) {
            if (!Array.isArray(CHAPTERS)) return id.toUpperCase();
            const ch = CHAPTERS.find(c => c.id === id);
            return ch ? ch.label : id.toUpperCase();
        },
        playStageVideo: typeof playStageVideo === 'function' ? playStageVideo : (() => {}),
    };
```

The indentation uses 4 spaces matching the rest of v1's IIFE.

- [ ] **Step 2 — Rewrite `public/journey.html` script block**

Find the existing block:

```html
<script>
  // v1 → v2 bridge. For the Phase 2 vertical slice we honor #cmr as a
  // forced chapter override; otherwise the bridge reports no chapter, and
  // v2 idles. Phase 3 replaces this with real v1 chapter-detection wiring.
  if (new URLSearchParams(location.search).get('v') === '2') {
    window.__journeyV1Bridge = { ... };
    window.__cmrAddBeat = function (id) { ... };
  }
</script>

<script>
  // Feature flag: ?v=2 loads the 3-act milestone harness; default stays v1.
  (function () {
    var v = new URLSearchParams(location.search).get('v');
    var s = document.createElement('script');
    s.src = (v === '2') ? '/journey-v2.js' : '/journey.js?v=20260519-72';
    document.body.appendChild(s);
  })();
</script>
```

Replace with:

```html
<script>
  // Phase 3 load model: v1 ALWAYS loads (it owns the world + walking).
  // When ?v=2 is in the URL, v2 also loads after v1, layering the 3-act
  // vignettes on top. The v1 bundle populates window.__journeyV1Bridge
  // from inside its IIFE; the v2 bundle reads from it.
  (function () {
    var v = new URLSearchParams(location.search).get('v');
    var v1 = document.createElement('script');
    v1.src = '/journey.js?v=20260519-72';
    document.body.appendChild(v1);
    if (v === '2') {
      v1.onload = function () {
        var v2 = document.createElement('script');
        v2.src = '/journey-v2.js';
        document.body.appendChild(v2);
      };
    }
  })();
</script>
```

The `v1.onload` ensures v2 only injects AFTER v1 has parsed (and the bridge is populated). This matters because v2's bootstrap immediately starts the 250ms polling interval that reads the bridge.

- [ ] **Step 3 — Rewrite `test-v2-chapter-cmr.js` to walk via v1 controls**

```javascript
/**
 * End-to-end test (Phase 3 template): visit journey.html?v=2, hold → to
 * walk to CMR's world-x (~1200), let v2 detect the chapter via the v1
 * bridge, walk the full 3-act flow, assert localStorage.journey.chapters.cmr
 * .phase === 'complete'.
 *
 * Beats are unlocked by walking past their world-x positions (v1 game logic
 * adds them to state.discoveredBeats). For CMR we walk far enough past
 * chapter.x to pick up at least 3 beats from the quest list.
 */
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });

  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  // Wait for v1 + v2 to both initialize. v1 sets the bridge synchronously
  // inside its IIFE; v2 starts its polling interval from bootstrap.js.
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // Walk into CMR's chapter band (chapter.x = 1200; band detection is x ± 200)
  await holdRightFor(page, 5000);
  await waitVisible(page, '#v2-cutscene', 8000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // Keep walking until 3 of the 4 CMR beats are discovered. Each iteration
  // walks ~1.5s and polls v1's state.discoveredBeats via the bridge.
  for (let i = 0; i < 20; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['tuition-rush', 'mock-test', 'study-lamp', 'first-crush'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (!persisted || persisted.v !== 2) throw new Error('storage v != 2');
  const ch = persisted.chapters?.cmr;
  if (!ch) throw new Error('chapters.cmr missing');
  if (ch.phase !== 'complete') throw new Error(`expected phase=complete, got ${ch.phase}`);
  if (typeof ch.score !== 'number') throw new Error(`expected score:number, got ${ch.score}`);
  if (ch.npcChoice !== 0) throw new Error(`expected npcChoice=0, got ${ch.npcChoice}`);

  // Re-entry guard from Task 4
  await new Promise(r => setTimeout(r, 600));
  const npcReappeared = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (npcReappeared) throw new Error('completed chapter re-fired NPC (re-entry loop bug)');

  console.log(`PASS: CMR full vignette via v1 walk · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

Note: this test now walks the real v1 world. It's slower (~30s) and depends on v1's walking-to-collected-beats logic. The `holdRightFor` helper press-and-holds ArrowRight, which v1 reads as "walk right." We poll `getDiscoveredBeats` until 3 of the quest beats are collected.

- [ ] **Step 4 — Update `test-v2-flag.js`**

Replace it to assert BOTH bundles load when `?v=2`, only v1 on default.

```javascript
/**
 * Asserts journey.html (default) loads only journey.js,
 * and journey.html?v=2 loads BOTH journey.js (always) and journey-v2.js.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // Default load — only v1
  const v1Reqs = [];
  const page = await browser.newPage();
  page.on('request', r => { if (r.url().includes('journey')) v1Reqs.push(r.url()); });
  await page.goto(`${URL}/journey.html`, { waitUntil: 'networkidle0' });
  if (!v1Reqs.some(u => /journey\.js(\?|$)/.test(u))) {
    throw new Error(`default load did not request journey.js · got ${JSON.stringify(v1Reqs)}`);
  }
  if (v1Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error('default load incorrectly requested journey-v2.js');
  }

  // ?v=2 — BOTH
  const v2Reqs = [];
  const page2 = await browser.newPage();
  page2.on('request', r => { if (r.url().includes('journey')) v2Reqs.push(r.url()); });
  await page2.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  if (!v2Reqs.some(u => /journey\.js(\?|$)/.test(u))) {
    throw new Error(`?v=2 load did not request journey.js · got ${JSON.stringify(v2Reqs)}`);
  }
  if (!v2Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error(`?v=2 load did not request journey-v2.js · got ${JSON.stringify(v2Reqs)}`);
  }

  console.log('PASS: feature-flag wiring works');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5 — Rebuild + run the affected tests**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && \
  node test-v2-flag.js && \
  node test-v2-cutscene.js && \
  node test-v2-npc.js && \
  node test-v2-minigame.js && \
  node test-v2-culmination.js && \
  node test-v2-chapter-cmr.js
```

Expected: all 6 PASS. The CMR e2e is now slower (~30s) because of the real walking.

If `test-v2-chapter-cmr.js` fails on the cutscene wait, the player likely hasn't walked far enough — bump `holdRightFor(page, 5000)` to `7000`. If it fails on the beat-collection wait, the iteration cap or per-iteration time may need tuning. Iterate until stable.

- [ ] **Step 6 — Run the full unit suite (bundle drift check should pass)**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run test:unit
```

Expected: 35 PASS.

- [ ] **Step 7 — Commit**

```bash
git add public/journey.js public/journey.html test-v2-chapter-cmr.js test-v2-flag.js public/journey-v2.js
git commit -m "journey-v2: real v1 bridge replaces hash-based dev shortcut

- v1 patch: window.__journeyV1Bridge exposed at end of IIFE (reads from
  state.playerX, state.discoveredBeats, CHAPTERS, CHAPTER_INTERTITLES,
  playStageVideo via lexical scope)
- public/journey.html now loads v1 ALWAYS and v2 ADDITIONALLY when ?v=2;
  hash bridge installer removed
- test-v2-chapter-cmr.js rewritten to walk via real v1 controls — the
  Phase 3 template for chapter tests
- test-v2-flag.js asserts the dual-load model"
```

---

## Phase 3b — Chapter rollouts (Tasks 7–13)

Each chapter task lands content + mini-game + chapter test in one commit. Clusters are ordered by mini-game implementation complexity (TAP-only → TAP-on-flashing → DRAG/SWIPE).

**Shared chapter-rollout template** (every chapter task follows this structure):

1. Add cutscene/NPC/quest/culmination entries to the data tables.
2. Implement the mini-game module + unit tests.
3. Update `build.js` MANIFEST with the new mini-game path.
4. Add the chapter id to `V2_ENABLED_CHAPTERS` in `src/journey/core.js`.
5. Create a chapter Puppeteer test from the `test-v2-chapter-cmr.js` template.
6. Append the new test to `package.json` `test:integration` for-loop.
7. Rebuild, run `npm test`, commit.

The chapter's NPC + quest + culmination text comes from the spec (`docs/superpowers/specs/2026-05-28-journey-3-act-milestones-design.md` lines 100–167). Cutscene lines (~3 short lines) are not in the spec — invent them in the spirit of the chapter (era-appropriate, fairy-tale register).

---

### Task 7 — ITICS chapter (Cluster A · kick-football)

**Spec content:** until 2013, primary school. NPC `THE FIRST FRIEND`. Quest: 3 of football-match · cricket-match · sports-day · assembly-stage. Mini-game: `kick-football` (timing bar, tap when arrow hits center).

**Files:**
- Modify: `src/journey/data/cutscenes.js` (add `itics` entry)
- Modify: `src/journey/world/npcs.js` (add `itics`)
- Modify: `src/journey/acts/quest.js` (add `itics` to QUESTS)
- Modify: `src/journey/data/culminations.js` (add `itics`)
- Modify: `src/journey/core.js` (add 'itics' to V2_ENABLED_CHAPTERS)
- Modify: `build.js` (add `src/journey/acts/minigames/kick-football.js` to MANIFEST)
- Create: `src/journey/acts/minigames/kick-football.js`
- Create: `tests/unit/kick-football.test.js`
- Create: `test-v2-chapter-itics.js`
- Modify: `package.json` (append `test-v2-chapter-itics.js` to test:integration loop)

- [ ] **Step 1 — Add ITICS to content tables**

Add to `CUTSCENES` in `src/journey/data/cutscenes.js` (keep `__placeholder` and `cmr`, add `itics`):

```javascript
  itics: {
    lines: ['8:30 a.m.', 'the bell.', 'a decade of mornings just like this.'],
    durationMs: 7000,
  },
```

Add to `NPCS` in `src/journey/world/npcs.js`:

```javascript
  itics: {
    name: 'THE FIRST FRIEND', sprite: '🧒',
    open: 'you missed the bus again.',
    choices: [
      { label: 'ran the whole way', reply: 'three kilometres. shoes still untied.' },
      { label: 'took an auto',      reply: 'splurged. mom is going to know.' },
    ],
    close: 'come on. assembly already started.',
  },
```

Add to `QUESTS` in `src/journey/acts/quest.js`:

```javascript
  itics: {
    beats: ['football-match', 'cricket-match', 'sports-day', 'assembly-stage'],
    needed: 3,
  },
```

Add to `CULMINATIONS` in `src/journey/data/culminations.js`:

```javascript
  itics: 'the years that taught you how to lose without breaking. cricket whites, scuffed knees, the morning bell that never asked twice.',
```

- [ ] **Step 2 — Add `itics` to `V2_ENABLED_CHAPTERS` in `src/journey/core.js`**

Change line 17 from:

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr']);   // expand each Phase 3 task
```

To:

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics']);   // expand each Phase 3 task
```

- [ ] **Step 3 — Update `build.js` MANIFEST**

Find the MANIFEST array in `build.js` and add `'src/journey/acts/minigames/kick-football.js'` immediately after `'src/journey/acts/minigames/mock-test.js'`:

```javascript
const MANIFEST = [
  'src/journey/core.js',
  // ... existing entries ...
  'src/journey/acts/minigames/mock-test.js',
  'src/journey/acts/minigames/kick-football.js',   // NEW
  'src/journey/acts/culmination.js',
  'src/journey/bootstrap.js',
];
```

- [ ] **Step 4 — Write failing unit test for `kick-football`**

Create `tests/unit/kick-football.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/kick-football.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.KF = MINIGAMES.itics;');
const game = globalThis.KF;

test('kick-football is registered under itics with id kick-football', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'kick-football');
  assert.strictEqual(game.label, 'ITICS · KICK');
});

test('init returns state with arrow at 0 and no kick yet', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.arrow, 0);
  assert.strictEqual(state.kicked, false);
  assert.strictEqual(state.kickAt, null);
});

test('update moves arrow back and forth across [0,1]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 500);
  assert.ok(state.arrow > 0 && state.arrow <= 1);
});

test('onGesture(TAP) records kickAt and sets kicked', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 250);                   // arrow somewhere mid-sweep
  game.onGesture(state, { kind: 'TAP' }, {});
  assert.strictEqual(state.kicked, true);
  assert.ok(typeof state.kickAt === 'number');
});

test('subsequent taps ignored (one kick only)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 250);
  game.onGesture(state, { kind: 'TAP' }, {});
  const firstKickAt = state.kickAt;
  game.update(state, 250);
  game.onGesture(state, { kind: 'TAP' }, {});
  assert.strictEqual(state.kickAt, firstKickAt);
});

test('score is 100 for a dead-center kick (arrow at 0.5)', () => {
  const state = game.init({}, {});
  state.kicked = true;
  state.kickAt = 0.5;
  assert.strictEqual(game.score(state), 100);
});

test('score is 50 (no-fail floor) if never kicked', () => {
  const state = game.init({}, {});
  state.kicked = false;
  state.kickAt = null;
  assert.strictEqual(game.score(state), 50);
});

test('score degrades linearly with distance from 0.5', () => {
  const state = game.init({}, {});
  state.kicked = true;
  state.kickAt = 0;                           // worst kick
  const worst = game.score(state);
  state.kickAt = 0.5;                         // best
  const best = game.score(state);
  assert.ok(best > worst);
  assert.strictEqual(best, 100);
  assert.ok(worst >= 50, 'must still respect no-fail floor');
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Run test, confirm FAIL**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/kick-football.test.js
```

Expected: FAIL (file does not exist).

- [ ] **Step 6 — Implement `src/journey/acts/minigames/kick-football.js`**

```javascript
// === src/journey/acts/minigames/kick-football.js ===
/**
 * `kick-football` · ITICS mini-game.
 * Timing bar: an arrow sweeps left-right between 0 and 1 at ~1 cycle/sec.
 * Player taps to "kick"; score = 100 if arrow is at 0.5, decays linearly
 * to floor 50 at the edges. One tap only. No-fail.
 */
MINIGAMES.itics = {
  id: 'kick-football',
  label: 'ITICS · KICK',
  durationMs: 6000,
  prompt: 'tap when the arrow lands dead-center · one kick only',

  init(ctx, helpers) {
    return {
      arrow: 0,
      dir: 1,
      kicked: false,
      kickAt: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.elapsedMs += dt;
    if (state.kicked) return;
    // Move arrow at ~1 cycle/second across [0, 1]; bounce at edges
    const speed = dt / 500;   // 500ms for one half-sweep
    state.arrow += state.dir * speed;
    if (state.arrow >= 1) { state.arrow = 1; state.dir = -1; }
    if (state.arrow <= 0) { state.arrow = 0; state.dir = 1; }
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    // Bar
    const barY = H / 2;
    ctx.strokeStyle = '#5a2e1a'; ctx.lineWidth = 2;
    ctx.strokeRect(20, barY - 18, W - 40, 36);
    // Center target zone
    ctx.fillStyle = '#3d2818';
    ctx.fillRect(20 + (W - 40) * 0.45, barY - 16, (W - 40) * 0.1, 32);
    // Arrow
    const ax = 20 + (W - 40) * state.arrow;
    ctx.fillStyle = state.kicked ? '#d4a653' : '#e9d8b0';
    ctx.beginPath();
    ctx.moveTo(ax, barY - 28); ctx.lineTo(ax - 7, barY - 14); ctx.lineTo(ax + 7, barY - 14);
    ctx.closePath(); ctx.fill();
    // Label
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.kicked ? 'KICKED' : 'tap to kick', W / 2, H - 30);
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, _ev) {
    if (gesture.kind !== 'TAP') return;
    if (state.kicked) return;
    state.kicked = true;
    state.kickAt = state.arrow;
  },

  score(state) {
    if (!state.kicked || state.kickAt === null) return 50;
    const dist = Math.abs(state.kickAt - 0.5);
    // 0 dist → 100; 0.5 dist → 50
    const raw = 100 - Math.round(dist * 100);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Run unit test, confirm 9 PASS**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/kick-football.test.js
```

Expected: 9 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-itics.js`**

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // ITICS chapter.x = 500 — walk briefly to enter
  await holdRightFor(page, 2000);
  await waitVisible(page, '#v2-cutscene', 8000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // Walk until 3 of the 4 ITICS beats are discovered
  for (let i = 0; i < 20; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['football-match', 'cricket-match', 'sports-day', 'assembly-stage'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 6500));    // kick-football durationMs 6000 + buffer

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.itics;
  if (!ch || ch.phase !== 'complete') throw new Error(`ITICS phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('ITICS score missing');

  console.log(`PASS: ITICS full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append the new test to `package.json` `test:integration` for-loop**

Edit the `test:integration` value to add `test-v2-chapter-itics.js` to the loop:

```json
"test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js test-v2-chapter-itics.js; do echo \"▸ $f\"; node $f || exit 1; done",
```

- [ ] **Step 10 — Rebuild + run full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

Expected: 36 unit (35 + 9 - 8 wait actually 35 + 9 = 44... no, 35 was after Task 3 which added a build test; ITICS mini-game adds 9 more unit tests. New unit total: 35 + 9 = 44. Integration: 7 PASS.)

Actually let me re-count: Phase 1+2 had 34 unit tests. Task 3 (drift test) is a NET +1 because the original build test is restructured into the new file (now 2 tests where there was 1). So after Task 3: 35. After Task 7 (ITICS, +9): 44. Each chapter task adds ~9 unit tests; 7 chapters total: ~63 unit + 1 finalize task. End of Phase 3: ~35 + 9*7 = 98 unit tests, 13 integration tests.

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/kick-football.js tests/unit/kick-football.test.js test-v2-chapter-itics.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: ITICS chapter · kick-football mini-game

THE FIRST FRIEND · 'you missed the bus again.' · 4-beat quest (3 needed).
Timing-bar kick mini-game (~6s, no-fail floor 50). End-to-end test walks
via v1 controls."
```

---

### Task 8 — SCRIPBOX chapter (Cluster A · debug-the-PR)

**Spec content:** Sep 2022 – present, AI/MCP. NPC `THE PEER`. Quest: 3 of pr-review · anthropic-catalog · claude-code · whiteboard · anthropic-talk. Mini-game: `debug-the-PR` (4 lines of code, tap the one with the bug; all answers valid; score = which line, how fast).

**Files:**
- Modify: `src/journey/data/cutscenes.js`, `src/journey/world/npcs.js`, `src/journey/acts/quest.js`, `src/journey/data/culminations.js`, `src/journey/core.js`, `build.js`, `package.json`
- Create: `src/journey/acts/minigames/debug-the-pr.js`, `tests/unit/debug-the-pr.test.js`, `test-v2-chapter-scripbox.js`

- [ ] **Step 1 — Add SCRIPBOX content entries**

To `CUTSCENES`:

```javascript
  scripbox: {
    lines: ['the catalog refresh.', 'seventeen times.', 'PR #2913 · merged.'],
    durationMs: 7500,
  },
```

To `NPCS`:

```javascript
  scripbox: {
    name: 'THE PEER', sprite: '🧑‍💻',
    open: 'show me the MCP protocol again.',
    choices: [
      { label: 'stdio json-rpc', reply: 'okay. and tools/list versus prompts/list?' },
      { label: "it's simpler than it sounds", reply: 'every server reviewer in the catalog said the same thing.' },
    ],
    close: 'send the PR. ship the page. refresh seventeen times.',
  },
```

To `QUESTS`:

```javascript
  scripbox: {
    beats: ['pr-review', 'anthropic-catalog', 'claude-code', 'whiteboard', 'anthropic-talk'],
    needed: 3,
  },
```

To `CULMINATIONS`:

```javascript
  scripbox: "the catalog page that wouldn't stop reloading. you sent the link to four people who never asked. for the first time the work didn't just pay — it was seen by a name you'd only ever read in papers.",
```

- [ ] **Step 2 — Add `scripbox` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox']);
```

- [ ] **Step 3 — Update `build.js` MANIFEST**

Add `'src/journey/acts/minigames/debug-the-pr.js'` after `'src/journey/acts/minigames/kick-football.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/debug-the-pr.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/debug-the-pr.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.DBG = MINIGAMES.scripbox;');
const game = globalThis.DBG;

test('debug-the-pr is registered under scripbox', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'debug-the-pr');
  assert.strictEqual(game.label, 'SCRIPBOX · DEBUG');
});

test('init returns state with 4 lines, no pick, bugLine in [0,3]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.lines.length, 4);
  assert.strictEqual(state.pickedIdx, null);
  assert.ok(state.bugLine >= 0 && state.bugLine <= 3);
});

test('onGesture(TAP) within line area sets pickedIdx', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // y ranges across 4 lines, each ~40px tall starting at y=40
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 100 });   // line ~1
  assert.ok(state.pickedIdx === 1);
});

test('subsequent taps overwrite pickedIdx (caller decides one-shot)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 50 });   // line ~0
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 100, offsetY: 180 });  // line ~3
  assert.strictEqual(state.pickedIdx, 3);
});

test('score is 100 when bug line picked', () => {
  const state = game.init({}, {});
  state.bugLine = 2;
  state.pickedIdx = 2;
  state.elapsedMs = 1000;
  assert.strictEqual(game.score(state), 100);
});

test('score floor 50 when nothing picked', () => {
  const state = game.init({}, {});
  state.pickedIdx = null;
  assert.strictEqual(game.score(state), 50);
});

test('score is reduced when wrong line picked', () => {
  const state = game.init({}, {});
  state.bugLine = 2;
  state.pickedIdx = 0;
  state.elapsedMs = 1000;
  const wrong = game.score(state);
  state.pickedIdx = 2;
  const right = game.score(state);
  assert.ok(right > wrong);
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Run, confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/debug-the-pr.test.js
```

Expected: FAIL.

- [ ] **Step 6 — Implement `src/journey/acts/minigames/debug-the-pr.js`**

```javascript
// === src/journey/acts/minigames/debug-the-pr.js ===
/**
 * `debug-the-pr` · SCRIPBOX mini-game.
 * 4 lines of JS. One has a bug. Tap the line you think is wrong. All
 * answers are "valid" (no-fail), but the score is higher if you pick the
 * actual bug AND pick it fast.
 */
MINIGAMES.scripbox = {
  id: 'debug-the-pr',
  label: 'SCRIPBOX · DEBUG',
  durationMs: 8000,
  prompt: 'tap the line with the bug · all answers are valid',

  init(ctx, helpers) {
    return {
      lines: [
        '  const beats = state.discoveredBeats;',
        '  if (beats.size = 0) return;',           // ← bug: = vs ===
        '  for (const id of beats) {',
        '    render(id);',
      ],
      bugLine: 1,
      pickedIdx: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.font = '13px "IBM Plex Mono", monospace';
    const lh = 40;
    for (let i = 0; i < state.lines.length; i++) {
      const y = 30 + i * lh;
      // Highlight picked
      if (state.pickedIdx === i) {
        ctx.fillStyle = '#3d2818'; ctx.fillRect(10, y - 18, W - 20, lh - 4);
        ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 2;
        ctx.strokeRect(10, y - 18, W - 20, lh - 4);
      }
      ctx.fillStyle = '#e9d8b0';
      ctx.fillText(`${i + 1}  ${state.lines[i]}`, 20, y);
    }
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const y = ev.offsetY ?? (ev.changedTouches ? ev.changedTouches[0].clientY : 0);
    const lh = 40;
    const idx = Math.max(0, Math.min(3, Math.floor((y - 12) / lh)));
    state.pickedIdx = idx;
  },

  score(state) {
    if (state.pickedIdx === null) return 50;
    const right = state.pickedIdx === state.bugLine;
    const speed = right ? Math.max(0, 50 - Math.floor(state.elapsedMs / 160)) : 0;
    return Math.max(50, Math.min(100, (right ? 50 : 0) + speed + 50));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Confirm test passes**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/debug-the-pr.test.js
```

Expected: 8 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-scripbox.js`**

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // SCRIPBOX chapter.x = 4400 — long walk; faster v1 vehicle may already be active
  await holdRightFor(page, 15000);
  await waitVisible(page, '#v2-cutscene', 12000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  for (let i = 0; i < 30; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['pr-review', 'anthropic-catalog', 'claude-code', 'whiteboard', 'anthropic-talk'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.scripbox;
  if (!ch || ch.phase !== 'complete') throw new Error(`SCRIPBOX phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('SCRIPBOX score missing');

  console.log(`PASS: SCRIPBOX full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append the new test to `package.json` `test:integration`**

```json
"test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js test-v2-chapter-itics.js test-v2-chapter-scripbox.js; do echo \"▸ $f\"; node $f || exit 1; done",
```

- [ ] **Step 10 — Rebuild + run full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

Expected: 8 unit tests added, all integration green. The SCRIPBOX test is slow (~45s) because chapter.x=4400 requires a long walk.

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/debug-the-pr.js tests/unit/debug-the-pr.test.js test-v2-chapter-scripbox.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: SCRIPBOX chapter · debug-the-PR mini-game

THE PEER · 'show me the MCP protocol again.' · 5-beat quest (3 needed).
4-line code editor; tap the line with the bug. No-fail."
```

---

### Task 9 — NOW chapter (Cluster A · type-the-future)

**Spec content:** 2026–present. NPC `THE SELF · FUTURE`. Quest: all 4 of morning-routine · code-flow · anthropic-goal · forward-horizon. Mini-game: `type-the-future` (4-letter word shown, tap keys in order).

**Files:** mirror Task 7/8 structure.

- [ ] **Step 1 — Add NOW content**

To `CUTSCENES`:

```javascript
  now: {
    lines: ['the first hour.', 'belongs to whoever claims it.', 'claim it.'],
    durationMs: 6000,
  },
```

To `NPCS`:

```javascript
  now: {
    name: 'THE SELF · FUTURE', sprite: '🪞',
    open: 'still here?',
    choices: [
      { label: 'always',  reply: 'good. keep claiming the hour.' },
      { label: 'for now', reply: 'for now is enough. it always was.' },
    ],
    close: "the day belongs to whoever claims the first hour. you're claiming yours.",
  },
```

To `QUESTS`:

```javascript
  now: {
    beats: ['morning-routine', 'code-flow', 'anthropic-goal', 'forward-horizon'],
    needed: 4,
  },
```

To `CULMINATIONS`:

```javascript
  now: 'morning coffee · terminal warmth · two hours that feel like ten minutes. the day belongs to whoever claims the first hour. you\'re claiming yours.',
```

- [ ] **Step 2 — Add `now` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now']);
```

- [ ] **Step 3 — Update `build.js` MANIFEST**

Add `'src/journey/acts/minigames/type-the-future.js'` after `'src/journey/acts/minigames/debug-the-pr.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/type-the-future.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/type-the-future.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.TTF = MINIGAMES.now;');
const game = globalThis.TTF;

test('type-the-future is registered under now', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'type-the-future');
  assert.strictEqual(game.label, 'NOW · TYPE');
});

test('init returns state with 4-letter word and progress=0', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.word.length, 4);
  assert.strictEqual(state.progress, 0);
});

test('onGesture(TAP) on correct letter zone advances progress', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // Each letter occupies a quarter of W: 0..90, 90..180, 180..270, 270..360
  // For idx 0, tap any x in 0..90 (e.g., 40), y in lower half (e.g., 200)
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 40, offsetY: 200 });
  assert.strictEqual(state.progress, 1);
});

test('onGesture on wrong zone does not advance', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // Tap zone 3 first (out of order)
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 320, offsetY: 200 });
  assert.strictEqual(state.progress, 0);
});

test('score scales with progress', () => {
  const state = game.init({}, {});
  state.progress = 0;
  const zero = game.score(state);
  state.progress = 4;
  const full = game.score(state);
  assert.ok(full > zero);
  assert.strictEqual(full, 100);
  assert.ok(zero >= 50);
});

test('scoreLabel formats as N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/type-the-future.test.js
```

Expected: FAIL.

- [ ] **Step 6 — Implement `src/journey/acts/minigames/type-the-future.js`**

```javascript
// === src/journey/acts/minigames/type-the-future.js ===
/**
 * `type-the-future` · NOW mini-game.
 * A 4-letter word is shown. Each letter has a tap zone (canvas split into
 * 4 vertical columns). Tap the letters in order. Out-of-order taps are
 * ignored. Score scales with progress; floor 50.
 */
MINIGAMES.now = {
  id: 'type-the-future',
  label: 'NOW · TYPE',
  durationMs: 7000,
  prompt: 'tap the letters · in order',

  init(ctx, helpers) {
    return {
      word: 'NEXT',                       // 4 chars; chosen for chapter vibe
      progress: 0,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const colW = W / 4;
    for (let i = 0; i < state.word.length; i++) {
      const done = i < state.progress;
      const next = i === state.progress;
      ctx.strokeStyle = done ? '#d4a653' : (next ? '#e6c285' : '#5a2e1a');
      ctx.lineWidth = next ? 3 : 1;
      ctx.strokeRect(i * colW + 4, 30, colW - 8, H - 60);
      ctx.fillStyle = done ? '#d4a653' : '#e9d8b0';
      ctx.font = 'bold 36px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.word[i], i * colW + colW / 2, H / 2 + 12);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    if (state.progress >= state.word.length) return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? (ev.changedTouches ? ev.changedTouches[0].clientX : 0);
    const colW = W / 4;
    const idx = Math.floor(x / colW);
    if (idx === state.progress) state.progress++;
  },

  score(state) {
    const raw = 50 + Math.floor((state.progress / state.word.length) * 50);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Run, expect 6 PASS**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/type-the-future.test.js
```

- [ ] **Step 8 — Create `test-v2-chapter-now.js`**

Same structure as ITICS, just adjusted for NOW's chapter.x=6200 (longest walk) and quest beats.

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // NOW chapter.x = 6200 — walk until detected
  await holdRightFor(page, 25000);
  await waitVisible(page, '#v2-cutscene', 15000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // NOW needs all 4 beats
  for (let i = 0; i < 40; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['morning-routine', 'code-flow', 'anthropic-goal', 'forward-horizon'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 4) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  // tap all 4 letters in order (zones 0–3, each ~270px wide on a 1100px canvas)
  // but the canvas is actually 360x240 internally; mapped via DOM CSS. Click 4
  // separate x-positions in the canvas DOM.
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let i = 0; i < 4; i++) {
    const x = box.left + (i + 0.5) * (box.w / 4);
    const y = box.top + box.h / 2;
    await page.mouse.click(x, y);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 7500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.now;
  if (!ch || ch.phase !== 'complete') throw new Error(`NOW phase != complete: ${ch?.phase}`);
  if (typeof ch.score !== 'number') throw new Error('NOW score missing');

  console.log(`PASS: NOW full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append to `package.json` test:integration loop**

Add `test-v2-chapter-now.js` to the for-loop.

- [ ] **Step 10 — Rebuild + run**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/type-the-future.js tests/unit/type-the-future.test.js test-v2-chapter-now.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: NOW chapter · type-the-future mini-game

THE SELF · FUTURE · 'still here?' · 4-beat quest (all 4 needed).
Type 'NEXT' in order across 4 tap zones. No-fail floor."
```

---

### Task 10 — SAKHA chapter (Cluster B · standup-bingo)

**Spec content:** Jul 2019 – Sep 2022, first job. NPC `THE TECH LEAD`. Quest: 3 of interview-day · first-paycheck · wfh-covid · late-night-coding. Mini-game: `standup-bingo` (3×3 grid of flashing phrases, tap as they appear, 10s).

**Files:** same shape as previous tasks.

- [ ] **Step 1 — Add SAKHA content**

To `CUTSCENES`:

```javascript
  sakha: {
    lines: ['interview · five.', 'the call.', 'you cracked it.'],
    durationMs: 7000,
  },
```

To `NPCS`:

```javascript
  sakha: {
    name: 'THE TECH LEAD', sprite: '🧑‍🔧',
    open: 'five interviews. tell me about the last one.',
    choices: [
      { label: 'ran out of time',                  reply: 'time runs out on everyone. you came back. that\'s the part.' },
      { label: 'over-prepared the wrong part',     reply: 'every junior does. mine was hash maps. yours?' },
    ],
    close: 'monday at nine. wear something with a collar.',
  },
```

To `QUESTS`:

```javascript
  sakha: {
    beats: ['interview-day', 'first-paycheck', 'wfh-covid', 'late-night-coding'],
    needed: 3,
  },
```

To `CULMINATIONS`:

```javascript
  sakha: "three years and one pandemic. you bought a watch for dad and a saree for mum from your first paycheck. by the time covid ended you had shipped enough PRs that the team's git log read like your handwriting.",
```

- [ ] **Step 2 — Add `sakha` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha']);
```

- [ ] **Step 3 — Update `build.js` MANIFEST**

Add `'src/journey/acts/minigames/standup-bingo.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/standup-bingo.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/standup-bingo.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.SB = MINIGAMES.sakha;');
const game = globalThis.SB;

test('standup-bingo registered under sakha', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'standup-bingo');
});

test('init returns 9-cell grid with 0 caught', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.cells.length, 9);
  assert.strictEqual(state.caught, 0);
  assert.strictEqual(state.activeIdx, null);
});

test('update activates a cell after the first interval', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.update(state, 900);
  // After 900ms an activeIdx should be selected
  assert.ok(state.activeIdx === null || (state.activeIdx >= 0 && state.activeIdx <= 8));
});

test('tap on the active cell catches it (count++) and clears active', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.activeIdx = 4;       // force middle cell active
  // Middle cell is col 1, row 1: x in [120, 240), y in [80, 160)
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });
  assert.strictEqual(state.caught, 1);
  assert.strictEqual(state.activeIdx, null);
});

test('tap on inactive cell does NOT catch', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.activeIdx = 0;
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });   // middle
  assert.strictEqual(state.caught, 0);
});

test('score scales with caught (no-fail floor 50)', () => {
  const state = game.init({}, {});
  state.caught = 0;
  assert.strictEqual(game.score(state), 50);
  state.caught = 5;
  const mid = game.score(state);
  state.caught = 10;
  const high = game.score(state);
  assert.ok(high > mid);
  assert.ok(high <= 100);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/standup-bingo.test.js
```

- [ ] **Step 6 — Implement `src/journey/acts/minigames/standup-bingo.js`**

```javascript
// === src/journey/acts/minigames/standup-bingo.js ===
/**
 * `standup-bingo` · SAKHA mini-game.
 * 3×3 grid of standup phrases. Every ~900ms a random cell flashes
 * ("active"). Tap it within ~900ms to catch it. Score scales with caught
 * count over 10s. No-fail floor 50.
 */
MINIGAMES.sakha = {
  id: 'standup-bingo',
  label: 'SAKHA · STANDUP',
  durationMs: 10000,
  prompt: 'tap the flashing cards · they only stay for a beat',

  init(ctx, helpers) {
    return {
      cells: [
        'blockers?', 'shipping today', 'merge ready',
        'EOD?', 'standup soon', 'PR review',
        'one bug', '+1', 'LGTM',
      ],
      activeIdx: null,
      tSinceLast: 0,
      caught: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.tSinceLast += dt;
    if (state.tSinceLast >= 900) {
      state.tSinceLast = 0;
      state.activeIdx = Math.floor(Math.random() * 9);
    }
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const cw = W / 3, ch = H / 3;
    ctx.font = '12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 9; i++) {
      const cx = (i % 3) * cw, cy = Math.floor(i / 3) * ch;
      const active = i === state.activeIdx;
      ctx.fillStyle = active ? '#d4a653' : '#2a1c10';
      ctx.fillRect(cx + 4, cy + 4, cw - 8, ch - 8);
      ctx.fillStyle = active ? '#1f1610' : '#e9d8b0';
      ctx.fillText(state.cells[i], cx + cw / 2, cy + ch / 2 + 4);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const W = state.canvas.width, H = state.canvas.height;
    const x = ev.offsetX ?? 0, y = ev.offsetY ?? 0;
    const cw = W / 3, ch = H / 3;
    const idx = Math.floor(y / ch) * 3 + Math.floor(x / cw);
    if (idx === state.activeIdx) {
      state.caught++;
      state.activeIdx = null;
      state.tSinceLast = 0;
    }
  },

  score(state) {
    const raw = 50 + state.caught * 6;
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Confirm tests pass**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/standup-bingo.test.js
```

Expected: 7 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-sakha.js`** (mirror previous chapter tests, chapter.x=3600, quest beats from SAKHA list, mini-game runs 10s).

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await holdRightFor(page, 12000);
  await waitVisible(page, '#v2-cutscene', 10000);
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  for (let i = 0; i < 25; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['interview-day', 'first-paycheck', 'wfh-covid', 'late-night-coding'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  // Tap repeatedly at random spots; standup-bingo flashes random cells
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let i = 0; i < 10; i++) {
    await page.mouse.click(box.left + box.w / 2, box.top + box.h / 2);
    await new Promise(r => setTimeout(r, 900));
  }
  await new Promise(r => setTimeout(r, 1500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.sakha;
  if (!ch || ch.phase !== 'complete') throw new Error(`SAKHA phase != complete: ${ch?.phase}`);

  console.log(`PASS: SAKHA full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append test to package.json**

```json
"test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js test-v2-chapter-itics.js test-v2-chapter-scripbox.js test-v2-chapter-now.js test-v2-chapter-sakha.js; do echo \"▸ $f\"; node $f || exit 1; done",
```

- [ ] **Step 10 — Build + test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/standup-bingo.js tests/unit/standup-bingo.test.js test-v2-chapter-sakha.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: SAKHA chapter · standup-bingo mini-game

THE TECH LEAD · 'five interviews. tell me about the last one.' · 4-beat
quest (3 needed). 3×3 grid of flashing standup phrases; tap them as they
appear. No-fail floor."
```

---

### Task 11 — DSCE chapter (Cluster C · CAD-snap)

**Spec content:** 2015–2019, mechanical engineering. NPC `THE TRIPLE-RIDER`. Quest: 3 of bosch-intern · abb-intern · fest-stage · convocation. Mini-game: `CAD-snap` (drag 3 mechanical parts into slots, 10s, auto-snap if close).

This is the FIRST drag mini-game — implementation is heavier. The harness's existing `attachInputRouter` only emits gestures on touch/mouse END. For DRAG we need partial-motion events. Add a small extension to the input router OR use raw event listeners inside the mini-game.

**Decision:** the mini-game uses its OWN `mousemove`/`touchmove` listeners while it's active, registered in `init` (via the harness `helpers.canvas`) and removed when `onDone` fires. The standard `onGesture` callback is still called for taps (TAP/DRAG terminal events).

**Files:** mirror previous chapter tasks + a slightly more complex mini-game.

- [ ] **Step 1 — Add DSCE content**

To `CUTSCENES`:

```javascript
  college: {
    lines: ['bus three of three.', 'campus by 8:55.', 'four years like this.'],
    durationMs: 7500,
  },
```

To `NPCS`:

```javascript
  college: {
    name: 'THE TRIPLE-RIDER', sprite: '🛵',
    open: 'you walking again?',
    choices: [
      { label: 'saving bus fare', reply: 'lend me ten then. tomorrow\'s my treat.' },
      { label: 'lost my pass',    reply: 'same. third time this month. hop on.' },
    ],
    close: 'next class is on the other side. hold on tight.',
  },
```

To `QUESTS`:

```javascript
  college: {
    beats: ['bosch-intern', 'abb-intern', 'fest-stage', 'convocation'],
    needed: 3,
  },
```

To `CULMINATIONS`:

```javascript
  college: "four years of triples and three-bus commutes. you didn't graduate top of class. you graduated knowing what real work felt like before anyone paid you for it.",
```

- [ ] **Step 2 — Add `college` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college']);
```

- [ ] **Step 3 — Update `build.js` MANIFEST**

Add `'src/journey/acts/minigames/cad-snap.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/cad-snap.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/cad-snap.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.CS = MINIGAMES.college;');
const game = globalThis.CS;

test('cad-snap is registered under college', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'cad-snap');
});

test('init returns 3 parts and 3 slots, all parts un-snapped', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.parts.length, 3);
  assert.strictEqual(state.slots.length, 3);
  assert.strictEqual(state.parts.filter(p => p.snapped).length, 0);
});

test('snapPart(idx) sets snapped=true and aligns to slot', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.snapPart(state, 0);
  assert.ok(state.parts[0].snapped);
  assert.strictEqual(state.parts[0].x, state.slots[0].x);
  assert.strictEqual(state.parts[0].y, state.slots[0].y);
});

test('tryPlace(idx) snaps the part if it is within the snap-distance of any slot', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.parts[0].x = state.slots[0].x + 10;
  state.parts[0].y = state.slots[0].y - 10;
  const ok = game.tryPlace(state, 0);
  assert.strictEqual(ok, true);
  assert.ok(state.parts[0].snapped);
});

test('tryPlace returns false if far from all slots', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  state.parts[0].x = 9999;
  state.parts[0].y = 9999;
  const ok = game.tryPlace(state, 0);
  assert.strictEqual(ok, false);
  assert.strictEqual(state.parts[0].snapped, false);
});

test('score 50 with 0 snapped, scales to 100 with all 3', () => {
  const state = game.init({}, {});
  assert.strictEqual(game.score(state), 50);
  game.snapPart(state, 0);
  game.snapPart(state, 1);
  game.snapPart(state, 2);
  assert.strictEqual(game.score(state), 100);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/cad-snap.test.js
```

- [ ] **Step 6 — Implement `src/journey/acts/minigames/cad-snap.js`**

```javascript
// === src/journey/acts/minigames/cad-snap.js ===
/**
 * `cad-snap` · DSCE mini-game.
 * Drag 3 mechanical parts into their slots within 10s. Parts auto-snap
 * when released within snap-distance. Score scales with snapped count.
 *
 * Internal helpers `snapPart` and `tryPlace` are exposed via the game
 * object so unit tests can drive the state machine without simulating
 * pointer events.
 */
const CAD_SNAP_DISTANCE = 30;

MINIGAMES.college = {
  id: 'cad-snap',
  label: 'DSCE · CAD',
  durationMs: 10000,
  prompt: 'drag the parts to their slots · auto-snaps when close',

  init(ctx, helpers) {
    const W = helpers.canvas ? helpers.canvas.width : 360;
    const H = helpers.canvas ? helpers.canvas.height : 240;
    return {
      slots: [
        { x: W * 0.25, y: H * 0.30, label: 'piston' },
        { x: W * 0.50, y: H * 0.30, label: 'gear'   },
        { x: W * 0.75, y: H * 0.30, label: 'cam'    },
      ],
      parts: [
        { x: W * 0.20, y: H * 0.80, label: 'piston', snapped: false },
        { x: W * 0.50, y: H * 0.80, label: 'gear',   snapped: false },
        { x: W * 0.80, y: H * 0.80, label: 'cam',    snapped: false },
      ],
      dragging: -1,
      elapsedMs: 0,
      canvas: helpers.canvas,
      _detachMove: null,
    };
  },

  // Test affordances — also used internally
  snapPart(state, idx) {
    const part = state.parts[idx];
    const slot = state.slots.find(s => s.label === part.label);
    part.x = slot.x;
    part.y = slot.y;
    part.snapped = true;
  },

  tryPlace(state, idx) {
    const part = state.parts[idx];
    for (const slot of state.slots) {
      if (slot.label !== part.label) continue;
      const dx = slot.x - part.x, dy = slot.y - part.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CAD_SNAP_DISTANCE) {
        this.snapPart(state, idx);
        return true;
      }
    }
    return false;
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    // Slots
    for (const slot of state.slots) {
      ctx.strokeStyle = '#5a2e1a'; ctx.lineWidth = 1;
      ctx.strokeRect(slot.x - 22, slot.y - 22, 44, 44);
      ctx.fillStyle = '#5a2e1a';
      ctx.fillText(slot.label, slot.x, slot.y + 40);
    }
    // Parts
    for (let i = 0; i < state.parts.length; i++) {
      const p = state.parts[i];
      ctx.fillStyle = p.snapped ? '#d4a653' : '#e9d8b0';
      ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
      ctx.fillStyle = p.snapped ? '#1f1610' : '#1f1610';
      ctx.fillText(p.label, p.x, p.y + 4);
    }
    ctx.textAlign = 'left';
  },

  // Drag handling: register move listeners on init's first invocation; the
  // harness's gesture router emits TAP on release, which we map to "drop".
  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP' && gesture.kind !== 'HOLD') return;
    // Treat TAP/HOLD release as a "place" — if the user was dragging, try to snap.
    if (state.dragging >= 0) {
      this.tryPlace(state, state.dragging);
      state.dragging = -1;
    } else {
      // Was it a pickup? Determine by canvas-relative xy
      const x = ev.offsetX ?? 0, y = ev.offsetY ?? 0;
      for (let i = 0; i < state.parts.length; i++) {
        const p = state.parts[i];
        if (p.snapped) continue;
        if (Math.abs(p.x - x) <= 22 && Math.abs(p.y - y) <= 22) {
          // pickup: move part to the tap position
          p.x = x; p.y = y;
          state.dragging = i;
          return;
        }
      }
    }
  },

  score(state) {
    const snapped = state.parts.filter(p => p.snapped).length;
    return Math.max(50, Math.min(100, 50 + snapped * 17));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

Note: the drag UX is intentionally simplified for Puppeteer-friendliness. The user "picks up" with a tap, the part follows the next tap, and on the second tap it tries to snap. The integration test taps each part's spot then taps the corresponding slot.

- [ ] **Step 7 — Run unit tests**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/cad-snap.test.js
```

Expected: 7 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-college.js`** (chapter.x=2000):

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await holdRightFor(page, 8000);
  await waitVisible(page, '#v2-cutscene', 10000);
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  for (let i = 0; i < 25; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['bosch-intern', 'abb-intern', 'fest-stage', 'convocation'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  // Tap each part then the corresponding slot. Canvas is 360x240 internal;
  // parts at y=80% (192), slots at y=30% (72). x positions 25/50/75%.
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  const partY = box.top + box.h * 0.80;
  const slotY = box.top + box.h * 0.30;
  for (const xFrac of [0.20, 0.50, 0.80]) {
    const px = box.left + box.w * xFrac;
    const sx = box.left + box.w * (xFrac === 0.20 ? 0.25 : xFrac === 0.80 ? 0.75 : 0.50);
    await page.mouse.click(px, partY);
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.click(sx, slotY);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1500));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.college;
  if (!ch || ch.phase !== 'complete') throw new Error(`DSCE phase != complete: ${ch?.phase}`);

  console.log(`PASS: DSCE full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append to package.json test:integration loop**

Add `test-v2-chapter-college.js`.

- [ ] **Step 10 — Build + test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/cad-snap.js tests/unit/cad-snap.test.js test-v2-chapter-college.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: DSCE chapter · CAD-snap mini-game

THE TRIPLE-RIDER · 'you walking again?' · 4-beat quest (3 needed).
Pickup-and-place 3 parts to slots, auto-snap when close. No-fail."
```

---

### Task 12 — FEVER 104 FM chapter (Cluster C · live-mix)

**Spec content:** Mar–May 2019, radio internship. NPC `THE CONDUCTOR`. Quest: 3 of headphones · script-binder · sound-engineer · trainee-cert. Mini-game: `live-mix` (3 vertical faders, swipe up/down to match a target curve, 10s).

**Files:** mirror Task 11.

- [ ] **Step 1 — Add FEVER 104 content**

To `CUTSCENES`:

```javascript
  fever104: {
    lines: ['ON-AIR · red.', 'the booth goes quiet.', 'three months.'],
    durationMs: 7000,
  },
```

To `NPCS`:

```javascript
  fever104: {
    name: 'THE CONDUCTOR', sprite: '🎚️',
    open: 'feel the room first. then the levels.',
    choices: [
      { label: 'still hearing the bus outside', reply: 'good. don\'t lose that. you\'ll need it on monday.' },
      { label: 'ready',                          reply: 'you\'re not. nobody is on day one. fader up.' },
    ],
    close: 'count me in. four bars.',
  },
```

To `QUESTS`:

```javascript
  fever104: {
    beats: ['headphones', 'script-binder', 'sound-engineer', 'trainee-cert'],
    needed: 3,
  },
```

To `CULMINATIONS`:

```javascript
  fever104: "three months in a soundproof room. you learned that a producer's whole craft is silence — choosing what NOT to play, what to fade, what to ride. everything later is a version of this.",
```

- [ ] **Step 2 — Add `fever104` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104']);
```

- [ ] **Step 3 — Update build.js MANIFEST**

Add `'src/journey/acts/minigames/live-mix.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/live-mix.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/live-mix.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.LM = MINIGAMES.fever104;');
const game = globalThis.LM;

test('live-mix is registered under fever104', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'live-mix');
});

test('init returns 3 faders + 3 targets, all faders at 0.5 (mid)', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.faders.length, 3);
  assert.strictEqual(state.targets.length, 3);
  for (const f of state.faders) assert.strictEqual(f, 0.5);
});

test('SWIPE-V (dir -1, up) on fader column raises that fader', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // Column 1 (middle): x in [120, 240)
  game.onGesture(state, { kind: 'SWIPE-V', dir: -1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] > 0.5);
});

test('SWIPE-V (dir +1, down) lowers fader', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-V', dir: 1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] < 0.5);
});

test('faders clamped to [0, 1]', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  for (let i = 0; i < 10; i++)
    game.onGesture(state, { kind: 'SWIPE-V', dir: -1 }, { offsetX: 180, offsetY: 100 });
  assert.ok(state.faders[1] <= 1.0);
  assert.ok(state.faders[1] >= 0);
});

test('score 100 when all faders match targets exactly', () => {
  const state = game.init({}, {});
  for (let i = 0; i < 3; i++) state.faders[i] = state.targets[i];
  assert.strictEqual(game.score(state), 100);
});

test('score floor 50 with worst-case mismatch', () => {
  const state = game.init({}, {});
  for (let i = 0; i < 3; i++) state.faders[i] = (state.targets[i] > 0.5 ? 0 : 1);
  assert.ok(game.score(state) >= 50);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/live-mix.test.js
```

- [ ] **Step 6 — Implement `src/journey/acts/minigames/live-mix.js`**

```javascript
// === src/journey/acts/minigames/live-mix.js ===
/**
 * `live-mix` · FEVER 104 mini-game.
 * Three vertical faders, three target levels (random per init).
 * SWIPE-V on a column raises (up) or lowers (down) that fader by 0.18 per
 * swipe. Score = 100 - mean(|fader - target|) * 100, floor 50.
 */
const LIVE_MIX_SWIPE_STEP = 0.18;

MINIGAMES.fever104 = {
  id: 'live-mix',
  label: 'FEVER 104 · MIX',
  durationMs: 10000,
  prompt: 'swipe up/down on each fader · match the target',

  init(ctx, helpers) {
    return {
      faders: [0.5, 0.5, 0.5],
      targets: [
        0.3 + Math.random() * 0.4,
        0.3 + Math.random() * 0.4,
        0.3 + Math.random() * 0.4,
      ],
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    const colW = W / 3;
    for (let i = 0; i < 3; i++) {
      const cx = i * colW + colW / 2;
      const trackTop = 30, trackBot = H - 30;
      const trackH = trackBot - trackTop;
      // Track
      ctx.strokeStyle = '#5a2e1a';
      ctx.strokeRect(cx - 5, trackTop, 10, trackH);
      // Target marker (yellow line)
      const ty = trackBot - state.targets[i] * trackH;
      ctx.strokeStyle = '#d4a653'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 20, ty); ctx.lineTo(cx + 20, ty); ctx.stroke();
      // Fader (filled bar)
      const fy = trackBot - state.faders[i] * trackH;
      ctx.fillStyle = '#e9d8b0';
      ctx.fillRect(cx - 15, fy - 5, 30, 10);
      ctx.lineWidth = 1;
    }
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'SWIPE-V') return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? 0;
    const idx = Math.max(0, Math.min(2, Math.floor(x / (W / 3))));
    // dir -1 = up = raise, dir +1 = down = lower
    state.faders[idx] = Math.max(0, Math.min(1, state.faders[idx] - gesture.dir * LIVE_MIX_SWIPE_STEP));
  },

  score(state) {
    let sumDist = 0;
    for (let i = 0; i < 3; i++) sumDist += Math.abs(state.faders[i] - state.targets[i]);
    const meanDist = sumDist / 3;
    const raw = 100 - Math.round(meanDist * 100);
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Run tests**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/live-mix.test.js
```

Expected: 8 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-fever104.js`** (chapter.x=2800):

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await holdRightFor(page, 10000);
  await waitVisible(page, '#v2-cutscene', 10000);
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  for (let i = 0; i < 25; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['headphones', 'script-binder', 'sound-engineer', 'trainee-cert'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 3) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  // Drag up on each fader column to raise it (3 swipes per column)
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let col = 0; col < 3; col++) {
    const cx = box.left + box.w * (col + 0.5) / 3;
    for (let s = 0; s < 2; s++) {
      await page.mouse.move(cx, box.top + box.h * 0.7);
      await page.mouse.down();
      await page.mouse.move(cx, box.top + box.h * 0.3, { steps: 6 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 150));
    }
  }
  await new Promise(r => setTimeout(r, 8000));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.fever104;
  if (!ch || ch.phase !== 'complete') throw new Error(`FEVER 104 phase != complete: ${ch?.phase}`);

  console.log(`PASS: FEVER 104 full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append test to package.json**

Add `test-v2-chapter-fever104.js`.

- [ ] **Step 10 — Build + test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/live-mix.js tests/unit/live-mix.test.js test-v2-chapter-fever104.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: FEVER 104 chapter · live-mix mini-game

THE CONDUCTOR · 'feel the room first. then the levels.' · 4-beat quest
(3 needed). 3 vertical faders, swipe up/down to match target levels."
```

---

### Task 13 — THE GT chapter (Cluster C · parallel-park)

**Spec content:** Nov 16, 2025, VW Virtus delivery. NPC `THE SALESMAN`. Quest: all 4 of test-drive · documents-signing · keys-handover · first-drive-out. Mini-game: `parallel-park` (swipe left/right to steer, 10s, nudge between two cones).

**Files:** mirror previous Cluster C tasks.

- [ ] **Step 1 — Add THE GT content**

To `CUTSCENES`:

```javascript
  vwgt: {
    lines: ['wooden tray.', 'metallic key.', 'november sixteenth.'],
    durationMs: 7000,
  },
```

To `NPCS`:

```javascript
  vwgt: {
    name: 'THE SALESMAN', sprite: '🎩',
    open: 'thirty-five minutes on the ORR sold this car.',
    choices: [
      { label: 'i knew at the second roundabout', reply: 'most do. the turbo speaks before the heart catches up.' },
      { label: 'the turbo did',                    reply: '1.5 TSI. 110 kilowatts of small-block thunder.' },
    ],
    close: 'sign here. keys are warm. drive carefully out the gate.',
  },
```

To `QUESTS`:

```javascript
  vwgt: {
    beats: ['test-drive', 'documents-signing', 'keys-handover', 'first-drive-out'],
    needed: 4,
  },
```

To `CULMINATIONS`:

```javascript
  vwgt: '1.5 TSI · turbo · november 16. ten years of saving became one signature. the salesperson clapped. you drove out with the garland still on the bonnet and three lefts of empty road ahead.',
```

- [ ] **Step 2 — Add `vwgt` to `V2_ENABLED_CHAPTERS`**

```javascript
const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104', 'vwgt']);
```

- [ ] **Step 3 — Update build.js MANIFEST**

Add `'src/journey/acts/minigames/parallel-park.js'`.

- [ ] **Step 4 — Write failing unit test**

Create `tests/unit/parallel-park.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/parallel-park.js'), 'utf8');
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.PP = MINIGAMES.vwgt;');
const game = globalThis.PP;

test('parallel-park is registered under vwgt', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'parallel-park');
});

test('init returns car at center, 0 wallTouches', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  assert.strictEqual(state.carX, 0.5);
  assert.strictEqual(state.wallTouches, 0);
});

test('SWIPE-H (dir +1, right) moves car right', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-H', dir: 1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.carX > 0.5);
});

test('SWIPE-H (dir -1, left) moves car left', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  game.onGesture(state, { kind: 'SWIPE-H', dir: -1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.carX < 0.5);
});

test('hitting wall (carX <= 0 or >= 1) increments wallTouches', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  for (let i = 0; i < 20; i++)
    game.onGesture(state, { kind: 'SWIPE-H', dir: 1 }, { offsetX: 180, offsetY: 120 });
  assert.ok(state.wallTouches > 0);
});

test('score 100 with 0 wallTouches, lower with more', () => {
  const state = game.init({}, {});
  state.wallTouches = 0;
  const clean = game.score(state);
  state.wallTouches = 5;
  const messy = game.score(state);
  assert.ok(clean > messy);
  assert.strictEqual(clean, 100);
  assert.ok(messy >= 50);
});

test('scoreLabel formats N/100', () => {
  assert.strictEqual(game.scoreLabel(78), '78/100');
});
```

- [ ] **Step 5 — Confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/parallel-park.test.js
```

- [ ] **Step 6 — Implement `src/journey/acts/minigames/parallel-park.js`**

```javascript
// === src/journey/acts/minigames/parallel-park.js ===
/**
 * `parallel-park` · THE GT mini-game.
 * Top-down lane view; car at the center; cones on left/right.
 * SWIPE-H nudges the car along a 0..1 scale. Touching a wall (carX <= 0
 * or carX >= 1) clamps and increments wallTouches. Score = 100 - 10
 * per touch, floor 50.
 */
const PARALLEL_PARK_NUDGE = 0.07;

MINIGAMES.vwgt = {
  id: 'parallel-park',
  label: 'THE GT · PARK',
  durationMs: 10000,
  prompt: 'swipe left/right to steer · don\'t touch the cones',

  init(ctx, helpers) {
    return {
      carX: 0.5,
      wallTouches: 0,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) { state.elapsedMs += dt; },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    // Cones (walls)
    ctx.fillStyle = '#a4332e';
    ctx.fillRect(0, H * 0.20, 30, H * 0.60);
    ctx.fillRect(W - 30, H * 0.20, 30, H * 0.60);
    // Car
    const cx = 30 + (W - 60) * state.carX;
    ctx.fillStyle = '#d4a653';
    ctx.fillRect(cx - 30, H * 0.40, 60, H * 0.20);
    ctx.fillStyle = '#1f1610';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GT', cx, H * 0.50 + 4);
    // HUD: wallTouches
    ctx.fillStyle = '#e9d8b0';
    ctx.fillText(`touches: ${state.wallTouches}`, W / 2, H - 10);
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, _ev) {
    if (gesture.kind !== 'SWIPE-H') return;
    const next = state.carX + gesture.dir * PARALLEL_PARK_NUDGE;
    if (next >= 1) { state.carX = 1; state.wallTouches++; }
    else if (next <= 0) { state.carX = 0; state.wallTouches++; }
    else state.carX = next;
  },

  score(state) {
    const raw = 100 - state.wallTouches * 10;
    return Math.max(50, Math.min(100, raw));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 7 — Run tests**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/parallel-park.test.js
```

Expected: 7 PASS.

- [ ] **Step 8 — Create `test-v2-chapter-vwgt.js`** (chapter.x=5300):

```javascript
const puppeteer = require('puppeteer');
const { waitVisible } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function holdRightFor(page, ms) {
  await page.keyboard.down('ArrowRight');
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up('ArrowRight');
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  await holdRightFor(page, 20000);
  await waitVisible(page, '#v2-cutscene', 15000);
  await page.click('#v2-cutscene');
  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // VW GT requires all 4 beats
  for (let i = 0; i < 30; i++) {
    const have = await page.evaluate(() => {
      const wanted = ['test-drive', 'documents-signing', 'keys-handover', 'first-drive-out'];
      const got = window.__journeyV1Bridge.getDiscoveredBeats();
      return wanted.filter(b => got.has(b)).length;
    });
    if (have >= 4) break;
    await holdRightFor(page, 1500);
  }

  await waitVisible(page, '#v2-minigame', 8000);
  // Swipe right twice (small nudges)
  const box = await page.$eval('#v2-minigame-canvas', el => {
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, w: b.width, h: b.height };
  });
  for (let s = 0; s < 2; s++) {
    await page.mouse.move(box.left + box.w * 0.3, box.top + box.h * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.left + box.w * 0.7, box.top + box.h * 0.5, { steps: 6 });
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 150));
  }
  await new Promise(r => setTimeout(r, 9000));

  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  const ch = persisted.chapters?.vwgt;
  if (!ch || ch.phase !== 'complete') throw new Error(`VW GT phase != complete: ${ch?.phase}`);

  console.log(`PASS: THE GT full vignette · score=${ch.score} npcChoice=${ch.npcChoice}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 9 — Append to package.json test:integration**

Add `test-v2-chapter-vwgt.js`.

- [ ] **Step 10 — Build + test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && npm test
```

- [ ] **Step 11 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/world/npcs.js src/journey/acts/quest.js src/journey/data/culminations.js src/journey/core.js src/journey/acts/minigames/parallel-park.js tests/unit/parallel-park.test.js test-v2-chapter-vwgt.js build.js package.json public/journey-v2.js
git commit -m "journey-v2: THE GT chapter · parallel-park mini-game

THE SALESMAN · 'thirty-five minutes on the ORR sold this car.' · 4-beat
quest (all 4 needed). Swipe left/right to steer between cones. No-fail."
```

---

## Phase 3c — Finalize (Task 14)

### Task 14 — Acceptance, smoke checks, docs update

**Files:**
- Modify: `docs/journey-v2-status.md` (mark Phase 3 complete, update test counts)
- Modify: `JOURNEY_LORE.md` (clear the "Phase 2 status" note's reference to CMR-only)

- [ ] **Step 1 — Confirm all 8 chapters are in `V2_ENABLED_CHAPTERS`**

```bash
grep "V2_ENABLED_CHAPTERS" /Users/pranav.j/Documents/portfolio/src/journey/core.js
```

Expected: `new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104', 'vwgt'])` (order may differ; all 8 must be present).

- [ ] **Step 2 — Full test pass**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: all unit tests PASS (~98 if every chapter mini-game lands ~9 unit tests, varies); all 13 integration tests PASS (6 baseline + 7 chapter e2e). Each chapter test ~15-45s; total suite runtime ~5-8 minutes.

If a chapter test flakes on first run, re-run the single test. If consistently failing, debug the specific wait or input. The plan's per-chapter timeouts are generous but the v1 walking simulation is mildly stochastic — bump per-step wait if needed.

- [ ] **Step 3 — Update `docs/journey-v2-status.md`**

Replace the file contents:

```markdown
# Journey v2 · Status

**Last updated:** 2026-05-28

## Phase 1 · Foundation harness · ✅ Complete

## Phase 2 · CMR vertical slice · ✅ Complete

## Phase 3 · All 7 remaining chapters · ✅ Complete

- All 8 chapters (cmr, itics, scripbox, now, sakha, college, fever104, vwgt)
  playable via `/journey.html?v=2`
- v1 world + walking always loaded; v2 vignettes layer on top under `?v=2`
- Mini-games: mock-test, kick-football, debug-the-PR, type-the-future,
  standup-bingo, CAD-snap, live-mix, parallel-park
- Orchestrator re-entry loop fixed (Task 4)
- Per-chapter `_act3Started` / `_questPollTimers` maps (Task 5)
- Real `window.__journeyV1Bridge` exposed from v1's IIFE (Task 6); hash
  bridge removed
- 1 shared `tests/integration/helpers.js`; chapter e2e tests walk via
  v1 controls
- Built-artifact policy documented in `docs/journey-v2-build-policy.md`

## TODO (deferred to Phase 4 cutover, requires headed browser)

- [ ] Manual mobile smoke on Chrome DevTools iPhone 14 Pro (390×844)
- [ ] Lighthouse mobile Performance (target ≥85)
- [ ] Reduced-motion implementation in cutscene.js (currently stale JSDoc)
- [ ] Z-index tiering for v2 overlays
- [ ] Speed-run leaderboard via Cloudflare Worker (Phase 5 polish)

## Phase 4 · Cutover · 🚧 Next

Separate plan: `docs/superpowers/plans/<TBD>-journey-3-act-phase-4.md`.

- Delete `public/journey.js` (v1)
- Rename `public/journey-v2.js` → `public/journey.js`
- Remove the script-swap from `public/journey.html`; load `journey.js`
  directly
- Update `JOURNEY_LORE.md` source-of-truth note
- Re-record stage videos if framing changed (probably unnecessary)
- Update social-share image
- Lighthouse pass on the consolidated bundle

## Test summary (as of Phase 3 finalize)

- Unit tests: ~98 (varies — each chapter mini-game ~9; check `npm run test:unit` for count)
- Integration tests: 13 (5 module-level + 8 chapter e2e)

## Commit history (Phase 1 + Phase 2 + Phase 3)

Run `git log --oneline ^<phase3-base> HEAD` for the full list.
```

- [ ] **Step 4 — Update `JOURNEY_LORE.md` header note**

Find the top blockquote and replace:

```markdown
> **Phase 3 status (2026-05-28):** All 8 chapters shipped to v2
> (behind `?v=2` flag). Source-of-truth for all chapter cutscene/NPC/
> quest/culmination is now under `src/journey/data/`, `src/journey/world/`,
> and `src/journey/acts/quest.js`. This markdown file remains
> source-of-truth for CHAPTER LORE / BEAT LORE used by v1's walk-by
> experience until the Phase 4 cutover consolidates everything.

---

```

- [ ] **Step 5 — Commit**

```bash
git add docs/journey-v2-status.md JOURNEY_LORE.md
git commit -m "journey-v2: Phase 3 complete — all 8 chapters shipped

CMR + ITICS + SCRIPBOX + NOW + SAKHA + DSCE + FEVER 104 + THE GT all
playable via ?v=2. v1 still loads alongside as the world+walking layer.
Phase 4 cutover removes v1."
```

- [ ] **Step 6 — Final branch summary**

```bash
cd /Users/pranav.j/Documents/portfolio && git log --oneline feat/journey-3-act-milestones-phase-3 ^main | head -30
```

Expected: ~14 commits (6 prereqs + 7 chapters + 1 finalize) on the Phase 3 branch.

---

## Self-review (run before declaring Phase 3 done)

**Spec coverage:**

- Spec §"Phase 3 — Roll out remaining 7 chapters" → Tasks 7–13 cover all 7 chapters per the spec's cluster order.
- Spec §"All 8 chapters" content (NPCs, mini-games, culminations) → wired in each chapter task.
- Final review's Phase 3 prerequisites #1–6 → Tasks 1–6.
- Phase 4 items deferred to a follow-up plan (cutover, leaderboard, polish).

**Placeholder scan:** none of "TBD" / "TODO" / "implement later" / "fill in details" appear except inside `docs/journey-v2-status.md` where they describe deferred work that requires a headed browser.

**Type / function-name consistency:**

- All mini-game modules implement the same `{id, label, durationMs, prompt, init, update, render, onGesture, score, scoreLabel}` shape (matches Task 10 of the Phase 1+2 plan).
- `MINIGAMES[chapterId]` registration pattern is consistent across all 7 new files.
- `window.__journeyV1Bridge` API in Task 6 matches the calls in `src/journey/core.js` from Phase 1+2 (`getCurrentChapterId`, `getDiscoveredBeats`, `getIntertitle`, `getChapterLabel`).
- `tests/integration/helpers.js` exports `waitVisible` and `withV2Page` — referenced in all refactored tests (Task 1) and chapter tests (Tasks 7–13).

No mismatches.

---

## Acceptance for Phase 3

- All 6 prerequisites land cleanly (Tasks 1–6).
- All 7 chapter tasks (7–13) ship without regressing prior chapters.
- All 8 chapters in `V2_ENABLED_CHAPTERS`; full `npm test` is green.
- `docs/journey-v2-status.md` and `JOURNEY_LORE.md` reflect the new state.
- Branch `feat/journey-3-act-milestones-phase-3` ready to merge to main.

When Phase 3 is signed off, generate the Phase 4 plan (cutover + polish) with:

```
/superpowers:writing-plans Phase 4 cutover · delete v1 (public/journey.js),
rename journey-v2.js → journey.js, remove script-swap, address the deferred
polish items in docs/journey-v2-status.md (mobile smoke, Lighthouse,
reduced-motion, z-index tiering).
```
