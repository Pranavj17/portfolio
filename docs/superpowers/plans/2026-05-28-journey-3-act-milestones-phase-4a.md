# Journey · 3-Act Milestones · Phase 4a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 Phase 4 must-fix items surfaced in Phase 3's final review — orchestrator orphan-timer leak (C-1), mid-flow re-entry blocking (C-2), z-index conflict masking v1's stage video over v2's culmination (I-6), and missing reduced-motion handling in `cutscene.js`.

**Architecture:** All four fixes are additive, low-risk patches to existing code: ~20 lines of orchestrator state-machine refinement in `src/journey/core.js`, one CSS override in `public/journey.html`, and a `matchMedia` branch in `src/journey/acts/cutscene.js`. The dual-load v1↔v2 model from Phase 3 is preserved; the cutover (Phase 4b) consolidates the bundles in a separate plan.

**Tech Stack:** Vanilla JS, `node:test` for unit tests, Puppeteer for integration tests (the existing `tests/integration/helpers.js` is reused).

**Branch (proposed):** `feat/journey-3-act-milestones-phase-4a` (off main at `90e9dab`)

**Spec:** `docs/superpowers/specs/2026-05-28-journey-3-act-milestones-design.md`

**Phase 3 baseline:** main commit `90e9dab` (merged). 87 unit + 13 integration tests passing.

---

## Conventions

- **Unit tests:** `tests/unit/*.test.js`, run via `npm run test:unit`.
- **Integration tests:** `test-v2-*.js` at repo root, run via `npm run test:integration`.
- **Source files:** `src/journey/{core,world,state,acts,ui,data}/*.js`. Concat at build time via `build.js` into `public/journey-v2.js`.
- **Commits:** every task ends with one commit. Prefix: `journey-v2:`.
- **Dev server:** `node server.js` from project root (`http://localhost:3000`).
- **Built artifact:** `public/journey-v2.js` IS committed (drift-check unit test enforces).

---

## File structure

Tasks only touch existing files plus one new unit test:

```
src/journey/
├── core.js                          # MODIFIED in Tasks 1 + 2 (orchestrator bug fixes)
├── acts/
│   └── cutscene.js                  # MODIFIED in Task 4 (reduced-motion branch)
└── (all other modules unchanged)

public/
└── journey.html                     # MODIFIED in Tasks 3 + 4 (CSS overrides)

tests/
├── unit/
│   └── cutscene.test.js             # NEW in Task 4 (reduced-motion guard)
└── integration/
    └── helpers.js                   # MODIFIED in Tasks 1 + 2 (new test helpers)

test-v2-chapter-cmr.js               # MODIFIED in Tasks 1, 2, 3 (new regression checks)
test-v2-chapter-itics.js             # MODIFIED in Task 3 (drop in-page click workaround)
test-v2-chapter-scripbox.js          # MODIFIED in Task 3 (same)
test-v2-chapter-now.js               # MODIFIED in Task 3 (same)
test-v2-chapter-sakha.js             # MODIFIED in Task 3 (same)
test-v2-chapter-college.js           # MODIFIED in Task 3 (same)
test-v2-chapter-fever104.js          # MODIFIED in Task 3 (same)
test-v2-chapter-vwgt.js              # MODIFIED in Task 3 (same)
test-v2-reduced-motion.js            # NEW in Task 4 (Puppeteer integration test)

docs/journey-v2-status.md            # MODIFIED in Task 5 (mark Phase 4a done)
```

---

## Task 1 — C-1: Clear orphan `_questPollTimers` when player leaves a chapter mid-quest

**Files:**
- Modify: `src/journey/core.js` (`tickChapterFlow` function only)
- Modify: `tests/integration/helpers.js` (add a `teleportPlayer` helper)
- Modify: `test-v2-chapter-cmr.js` (add a "walk away mid-quest" regression block)

The Phase 3 final review flagged: `pollQuest('A')` is cleared only when (a) it's re-called for A, or (b) `checkQuestComplete` fires. If the player enters A, taps NPC, then leaves A before completing the quest, `_questPollTimers.A` keeps firing forever. Fix in `tickChapterFlow`: when `detectActiveV2Chapter()` returns a different id (or null) than `_activeFlow`, clear the leftover timer and reset `_activeFlow`.

- [ ] **Step 1 — Read the current `tickChapterFlow`**

```bash
grep -n "function tickChapterFlow" /Users/pranav.j/Documents/portfolio/src/journey/core.js
```

It should be the last function in the file (~line 116):

```javascript
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  if (id) startChapterFlow(id);
}
```

- [ ] **Step 2 — Replace with the leak-safe version**

Find the existing 4-line function above and replace with:

```javascript
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  // C-1 fix · if the bridge no longer reports our active chapter (player
  // walked into a different chapter, or out of any v2-enabled band), tear
  // down the leftover poll timer + HUD so they don't run forever.
  if (_activeFlow && _activeFlow !== id) {
    if (_questPollTimers[_activeFlow]) {
      clearInterval(_questPollTimers[_activeFlow]);
      delete _questPollTimers[_activeFlow];
    }
    hideQuestHud();
    _activeFlow = null;
  }
  if (id) startChapterFlow(id);
}
```

Key changes:
- Detect "active flow chapter changed" via `_activeFlow !== id` (covers both "different chapter" and "no chapter").
- Clean up the per-chapter timer (uses `_questPollTimers` map from Phase 3 Task 5).
- Hide the quest HUD so it doesn't linger as the player walks away.
- Reset `_activeFlow` to `null` so a re-entry into the same chapter (Task 2) goes through the full setup.

- [ ] **Step 3 — Add `teleportPlayer` helper to `tests/integration/helpers.js`**

Append this function above the `module.exports = { ... };` line, and add `teleportPlayer` to the export:

```javascript
/**
 * Teleport the v1 player to a specific world-x via the __journey debug handle.
 * Bypasses v1's walking simulation — useful for testing orchestrator state
 * transitions in scenarios that would otherwise require minutes of real-time
 * walking.
 */
async function teleportPlayer(page, worldX) {
  await page.evaluate(x => {
    if (window.__journey && window.__journey.state) {
      window.__journey.state.playerX = x;
    }
  }, worldX);
}
```

Update the export line to include it:

```javascript
module.exports = { waitVisible, withV2Page, holdRightFor, collectBeatsViaV1, seedCompletedChapters, teleportPlayer };
```

- [ ] **Step 4 — Add the regression block to `test-v2-chapter-cmr.js`**

At the END of the test (immediately BEFORE `console.log('PASS: ...');`), add this block:

```javascript
  // C-1 regression · walking away from a chapter mid-quest must clear the
  // poll timer so it doesn't run forever. We've already finished CMR by this
  // point, so we exercise the same code path by teleporting away from where
  // any chapter is detected, waiting two ticks, and confirming the orchestrator
  // didn't get wedged. (A more targeted mid-quest test would require running
  // before completion — covered by the more involved Task 2 test.)
  const { teleportPlayer } = require('./tests/integration/helpers');
  await teleportPlayer(page, 100);   // before any v2 chapter band
  await new Promise(r => setTimeout(r, 600));
  const detectedAfterTeleport = await page.evaluate(() =>
    window.__journeyV1Bridge.getCurrentChapterId()
  );
  if (detectedAfterTeleport !== null) throw new Error(
    `teleport to x=100 should detect null chapter, got ${detectedAfterTeleport}`
  );
```

Note: this test specifically asserts the bridge reports `null` post-teleport (which validates the band gate from Phase 3 Task 7's deviation, AND any subsequent ticks won't try to start a new flow). The deeper "mid-quest abandon" test lives in Task 2 below.

- [ ] **Step 5 — Rebuild + run the e2e test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && node test-v2-chapter-cmr.js
```

Expected: `PASS: CMR full vignette via v1 walk · score=50 npcChoice=0`.

- [ ] **Step 6 — Run the full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 87 unit + 13 integration PASS.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/core.js tests/integration/helpers.js test-v2-chapter-cmr.js public/journey-v2.js
git commit -m "journey-v2: clear orphan pollQuest timers when player leaves a chapter

C-1 fix. tickChapterFlow detects active-chapter change (different id OR
null) and tears down the leftover _questPollTimers entry + hides the
quest HUD. Adds teleportPlayer helper to tests/integration/helpers.js
and an existence assertion at the tail of test-v2-chapter-cmr.js."
```

---

## Task 2 — C-2: Allow mid-flow re-entry without re-presenting the NPC

**Files:**
- Modify: `src/journey/core.js` (`enterExploring` function only)
- Create: `test-v2-reentry.js` at repo root (dedicated regression test)
- Modify: `package.json` (append the new test to `test:integration` for-loop)

The Phase 3 final review flagged: `if (_activeFlow === chapterId) return;` in `startChapterFlow` blocks any re-entry into a chapter the orchestrator already started. After Task 1 clears `_activeFlow` when the player walks away, re-entry will now hit `startChapterFlow` correctly — but `enterExploring` will re-present the NPC overlay even if the player already answered it. Fix: skip the auto-present when `store.getChapter(id).npcChoice` is already set, and instead check quest completion immediately (in case the player already had all beats and just needed re-entry).

- [ ] **Step 1 — Read the current `enterExploring`**

```bash
grep -n -A 14 "^function enterExploring" /Users/pranav.j/Documents/portfolio/src/journey/core.js
```

It should look like:

```javascript
function enterExploring(chapterId) {
  const collectedMap = collectedBeatsMap();
  showQuestHud(chapterId, collectedMap);
  setTimeout(() => {
    presentNpc(chapterId, idx => {
      window.__journeyV2.store.setNpcChoice(chapterId, idx);
      checkQuestComplete(chapterId);
    });
  }, 800);
  pollQuest(chapterId);
}
```

- [ ] **Step 2 — Replace with the re-entry-aware version**

Replace the function body with:

```javascript
function enterExploring(chapterId) {
  const collectedMap = collectedBeatsMap();
  showQuestHud(chapterId, collectedMap);
  const npcAlreadyAnswered = window.__journeyV2.store.getChapter(chapterId).npcChoice != null;
  if (!npcAlreadyAnswered) {
    // First entry · auto-present the NPC after 800ms so the cutscene fade
    // doesn't step on it. The choice callback feeds into checkQuestComplete.
    setTimeout(() => {
      presentNpc(chapterId, idx => {
        window.__journeyV2.store.setNpcChoice(chapterId, idx);
        checkQuestComplete(chapterId);
      });
    }, 800);
  } else {
    // C-2 fix · re-entry · NPC already answered, don't re-present. If the
    // quest is now complete (player may have collected the remaining beats
    // while away), advance to Act III immediately.
    setTimeout(() => checkQuestComplete(chapterId), 100);
  }
  pollQuest(chapterId);
}
```

- [ ] **Step 3 — Create `test-v2-reentry.js`**

```javascript
/**
 * C-2 regression · walks into CMR, completes the cutscene and NPC, then
 * teleports BACK to before the chapter band, waits, teleports forward into
 * the band again, and asserts:
 *   - The NPC overlay does NOT re-present.
 *   - The quest HUD reappears.
 *   - Adding the remaining beats completes Act III and dismisses cleanly.
 */
const puppeteer = require('puppeteer');
const {
  waitVisible,
  collectBeatsViaV1,
  seedCompletedChapters,
  teleportPlayer,
} = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

async function walkUntilChapter(page, chapterId, maxMs = 60000) {
  await page.keyboard.down('ArrowRight');
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < maxMs) {
      const cur = await page.evaluate(() => window.__journeyV1Bridge.getCurrentChapterId());
      if (cur === chapterId) return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`timeout walking to chapter ${chapterId}`);
  } finally {
    await page.keyboard.up('ArrowRight');
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });

  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await seedCompletedChapters(page, ['itics']);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV1Bridge && !!window.__journeyV2, { timeout: 8000 });

  // 1. Walk into CMR (chapter.x = 1200; band starts at 1000)
  await walkUntilChapter(page, 'cmr');
  await waitVisible(page, '#v2-cutscene', 8000);
  await page.click('#v2-cutscene');

  await waitVisible(page, '#v2-quest-hud');
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');

  // 2. Confirm store snapshot · NPC choice recorded, no quest complete yet
  const midState = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (midState.chapters?.cmr?.npcChoice !== 0) throw new Error(
    `expected cmr.npcChoice=0 after dialog, got ${midState.chapters?.cmr?.npcChoice}`
  );
  if (midState.chapters?.cmr?.phase !== 'exploring') throw new Error(
    `expected cmr.phase=exploring mid-flow, got ${midState.chapters?.cmr?.phase}`
  );

  // 3. Teleport BACK before CMR's band (x=100, well before band start 1000)
  await teleportPlayer(page, 100);
  await new Promise(r => setTimeout(r, 600));   // two 250ms ticks

  // 4. Assert the bridge no longer reports cmr (C-1 already covers this)
  const detected = await page.evaluate(() => window.__journeyV1Bridge.getCurrentChapterId());
  if (detected !== null) throw new Error(
    `after teleport-back, expected null chapter, got ${detected}`
  );

  // 5. Quest HUD should hide (Task 1 cleanup)
  await new Promise(r => setTimeout(r, 200));
  const hudHiddenAfterLeave = await page.evaluate(() =>
    document.getElementById('v2-quest-hud').getAttribute('aria-hidden') === 'true'
  );
  if (!hudHiddenAfterLeave) throw new Error(
    `quest HUD should hide when player leaves chapter band`
  );

  // 6. Teleport FORWARD into CMR band again (x=1100, well inside band)
  await teleportPlayer(page, 1100);
  await new Promise(r => setTimeout(r, 600));   // wait for tick to detect + start

  // 7. Quest HUD should reappear
  await waitVisible(page, '#v2-quest-hud', 2000);

  // 8. NPC overlay should NOT re-present (C-2 fix)
  await new Promise(r => setTimeout(r, 1000));   // > 800ms NPC auto-present delay
  const npcReentered = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (npcReentered) throw new Error(
    `C-2: NPC re-presented on re-entry (should be skipped since npcChoice was set)`
  );

  // 9. Add the remaining beats — Act III should fire and dismiss cleanly
  await collectBeatsViaV1(page, 'cmr', ['tuition-rush', 'mock-test', 'first-crush']);
  await waitVisible(page, '#v2-minigame', 5000);
  await page.click('#v2-minigame-canvas');
  await new Promise(r => setTimeout(r, 8500));
  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  // 10. Final state must be complete
  const finalState = await page.evaluate(() => JSON.parse(localStorage.getItem('journey')));
  if (finalState.chapters?.cmr?.phase !== 'complete') throw new Error(
    `expected cmr.phase=complete after re-entry flow, got ${finalState.chapters?.cmr?.phase}`
  );

  console.log(`PASS: CMR re-entry flow · npcChoice=${finalState.chapters.cmr.npcChoice} score=${finalState.chapters.cmr.score}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4 — Append `test-v2-reentry.js` to `package.json` `test:integration` loop**

Edit the `test:integration` value to add `test-v2-reentry.js` at the end of the for-loop list:

```json
"test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js test-v2-chapter-itics.js test-v2-chapter-scripbox.js test-v2-chapter-now.js test-v2-chapter-sakha.js test-v2-chapter-college.js test-v2-chapter-fever104.js test-v2-chapter-vwgt.js test-v2-reentry.js; do echo \"▸ $f\"; node $f || exit 1; done",
```

- [ ] **Step 5 — Rebuild + run the new test**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && node test-v2-reentry.js
```

Expected: `PASS: CMR re-entry flow · npcChoice=0 score=50`.

If it fails on Step 8 ("NPC re-presented on re-entry"), the C-2 fix isn't taking effect — re-check `enterExploring` change. If it fails on Step 5 ("quest HUD should hide"), the Task 1 fix isn't taking effect.

- [ ] **Step 6 — Run the full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 87 unit + 14 integration PASS.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/core.js test-v2-reentry.js package.json public/journey-v2.js
git commit -m "journey-v2: skip NPC auto-present on chapter re-entry

C-2 fix. enterExploring now checks store.getChapter(id).npcChoice; if
set, the auto-present setTimeout is skipped and Act III is checked
immediately (in case the player collected the remaining beats while
away). Combined with Task 1's pollQuest cleanup, a full walk-away +
walk-back-in cycle is now safe.

New test test-v2-reentry.js exercises the full flow: walk in, NPC,
teleport out, teleport back in, complete quest, assert no NPC re-fire
and final phase=complete."
```

---

## Task 3 — I-6: Bump v2 culmination z-index above v1's stage video

**Files:**
- Modify: `public/journey.html` (CSS — one rule)
- Modify: `test-v2-chapter-itics.js` (drop in-page click workaround)
- Modify: `test-v2-chapter-scripbox.js` (drop workaround)
- Modify: `test-v2-chapter-now.js` (drop workaround)
- Modify: `test-v2-chapter-sakha.js` (drop workaround)
- Modify: `test-v2-chapter-college.js` (drop workaround)
- Modify: `test-v2-chapter-fever104.js` (drop workaround)
- Modify: `test-v2-chapter-vwgt.js` (drop workaround)
- Modify: `test-v2-chapter-cmr.js` (no workaround there but keep consistent — verify)

The Phase 3 final review flagged: v1 fires `playStageVideo(chapterId)` 1.6s after a chapter is collected; the stage-video overlay sits at z-index 70 with `pointer-events: auto` while `body.stage-video-active` is set, blocking real-user clicks on v2's culmination overlay (z-index 60). Phase 3's chapter tests worked around this with in-page `document.getElementById('v2-culmination').click()` dispatch.

Fix: raise `#v2-culmination` to z-index 80 — an ID selector wins specificity over the `.v2-overlay { z-index: 60 }` class rule. Then drop the in-page-click workaround in the chapter tests.

- [ ] **Step 1 — Find the existing `.v2-culmination-card` CSS rule in `public/journey.html`**

```bash
grep -n "v2-culmination" /Users/pranav.j/Documents/portfolio/public/journey.html | head
```

You'll see the markup `<div id="v2-culmination" class="v2-overlay" ...>` plus a CSS block like `.v2-culmination-card { ... }`. Note the line number.

- [ ] **Step 2 — Add a z-index override in the existing `<style>` block**

Insert the following CSS rule immediately AFTER the existing `.v2-culmination-card` rule (find its line via grep):

```css
/* I-6 · culmination must sit ABOVE v1's stage-video overlay (z-index 70)
   so real-user clicks reach the dismiss handler. ID selector outranks the
   .v2-overlay { z-index: 60 } class. */
#v2-culmination { z-index: 80; }
```

- [ ] **Step 3 — Replace the in-page click workaround in all 7 affected chapter tests**

Each chapter test currently has a line like:

```javascript
await page.evaluate(() => document.getElementById('v2-culmination').click());
```

Replace ALL such occurrences (one per file, in `test-v2-chapter-itics.js`, `test-v2-chapter-scripbox.js`, `test-v2-chapter-now.js`, `test-v2-chapter-sakha.js`, `test-v2-chapter-college.js`, `test-v2-chapter-fever104.js`, `test-v2-chapter-vwgt.js`) with the standard:

```javascript
await page.click('#v2-culmination');
```

For each file, use `grep -n "v2-culmination.*click" <file>` to find the exact line.

- [ ] **Step 4 — Confirm `test-v2-chapter-cmr.js` already uses `page.click`**

The CMR test was written before the I-6 workaround was introduced. Confirm:

```bash
grep -n "v2-culmination.*click" /Users/pranav.j/Documents/portfolio/test-v2-chapter-cmr.js
```

If it shows `page.click('#v2-culmination')`, leave as-is. If it shows the `page.evaluate(...)` workaround, replace it too.

- [ ] **Step 5 — Rebuild + run all chapter tests**

The bundle doesn't need rebuilding (only HTML+test changes), but `build:v2` is fast and idempotent — run it for the drift-check safety:

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && \
  node test-v2-chapter-cmr.js && \
  node test-v2-chapter-itics.js && \
  node test-v2-chapter-scripbox.js && \
  node test-v2-chapter-now.js && \
  node test-v2-chapter-sakha.js && \
  node test-v2-chapter-college.js && \
  node test-v2-chapter-fever104.js && \
  node test-v2-chapter-vwgt.js
```

Expected: all 8 PASS with the standard `page.click` dispatch. If any fails on the culmination wait, the z-index rule isn't applying (e.g., misplaced CSS, wrong selector specificity) — verify the rule lands in the `<style>` block and uses the `#` prefix.

- [ ] **Step 6 — Run the full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 87 unit + 14 integration PASS.

- [ ] **Step 7 — Commit**

```bash
git add public/journey.html test-v2-chapter-itics.js test-v2-chapter-scripbox.js test-v2-chapter-now.js test-v2-chapter-sakha.js test-v2-chapter-college.js test-v2-chapter-fever104.js test-v2-chapter-vwgt.js test-v2-chapter-cmr.js
git commit -m "journey-v2: raise v2 culmination above v1 stage video (z-index 80)

I-6 fix. v1's stage-video overlay at z-index 70 covered v2's culmination
card at z-index 60, blocking real-user clicks. ID selector
#v2-culmination = z-index 80 outranks the .v2-overlay class rule.

Drops the in-page-click workaround (page.evaluate(... click())) from
all 7 chapter tests that used it — they now use page.click('#...')
directly, which matches real-user behavior."
```

---

## Task 4 — Reduced-motion: honor `prefers-reduced-motion` in `cutscene.js`

**Files:**
- Modify: `src/journey/acts/cutscene.js` (matchMedia branch)
- Modify: `public/journey.html` (add `@media (prefers-reduced-motion: reduce)` rule)
- Create: `tests/unit/cutscene.test.js` (pure helper test)
- Create: `test-v2-reduced-motion.js` at repo root (Puppeteer test)
- Modify: `package.json` (append the new integration test)

The Phase 3 final review flagged: `cutscene.js` JSDoc says "Reduced-motion mode displays all lines at once with no animation and shortens display time" but the code doesn't read `prefers-reduced-motion`. The fix needs THREE parts:

1. Source change: refactor the "should this be reduced?" check into a pure helper (so a unit test can verify the branch), and use it inside `playCutscene` to skip the per-line `animation-delay` and shorten `durationMs`.
2. CSS change: a `@media` rule so the `.v2-line` opacity-fade never runs under reduced-motion.
3. Integration test: emulate the media feature in Puppeteer and assert no animation delay appears in rendered HTML.

- [ ] **Step 1 — Write failing unit test `tests/unit/cutscene.test.js`**

The cutscene module is browser-only (uses `document`/`window.matchMedia`). To unit-test the reduced-motion logic without jsdom, the module needs to expose a pure helper. The test asserts the helper's behavior given a stub `matchMedia` function.

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/cutscene.js'), 'utf8');
// Stub `window`/`CUTSCENES` so the source's top-level lookups don't blow up;
// the helper we test only reads matchMedia, so the rest is irrelevant.
eval(`
  const CUTSCENES = { __placeholder: { lines: ['x'], durationMs: 1000 } };
  const window = { matchMedia: () => ({ matches: false }) };
  ${SRC}
  globalThis.Cutscene = { isReducedMotion };
`);

test('isReducedMotion returns false when matchMedia says no', () => {
  const stubWin = { matchMedia: () => ({ matches: false }) };
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), false);
});

test('isReducedMotion returns true when matchMedia says yes', () => {
  const stubWin = { matchMedia: () => ({ matches: true }) };
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), true);
});

test('isReducedMotion returns false when matchMedia is missing', () => {
  const stubWin = {};
  assert.strictEqual(globalThis.Cutscene.isReducedMotion(stubWin), false);
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/cutscene.test.js
```

Expected: FAIL — `isReducedMotion` is undefined.

- [ ] **Step 3 — Refactor `src/journey/acts/cutscene.js`**

Read the current file:

```bash
cat /Users/pranav.j/Documents/portfolio/src/journey/acts/cutscene.js
```

Replace its contents entirely with this version (preserves the existing `playCutscene` signature + behavior; adds the `isReducedMotion` helper + the reduced-motion branch):

```javascript
// === src/journey/acts/cutscene.js ===
/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation-delay and shortens the auto-dismiss timer.
 */

// Pure helper · tested independently in tests/unit/cutscene.test.js.
function isReducedMotion(win) {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try { return !!win.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_) { return false; }
}

function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  const reduced = isReducedMotion(window);
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="${reduced ? '' : `animation-delay:${i * 0.7}s`}">${t}</div>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('click', dismiss);
    onDismiss();
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); } }
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  // Auto-dismiss: 3000ms cap under reduced-motion (so the user isn't
  // stuck reading the same card for the full content duration).
  const effectiveDuration = reduced ? Math.min(data.durationMs, 3000) : data.durationMs;
  setTimeout(dismiss, effectiveDuration);
}
```

- [ ] **Step 4 — Run the unit test, confirm 3 PASS**

```bash
cd /Users/pranav.j/Documents/portfolio && node --test tests/unit/cutscene.test.js
```

Expected: 3 PASS.

- [ ] **Step 5 — Add the reduced-motion CSS rule to `public/journey.html`**

Find the existing `.v2-cutscene-lines .v2-line { opacity: 0; animation: v2-fade 0.6s forwards; }` rule and append immediately after it:

```css
/* Reduced-motion override · skip the opacity fade entirely so the lines
   appear at their final state immediately. Works in concert with the JS
   branch in src/journey/acts/cutscene.js which also drops the
   animation-delay attribute when prefers-reduced-motion is set. */
@media (prefers-reduced-motion: reduce) {
  .v2-cutscene-lines .v2-line { animation: none; opacity: 1; }
}
```

- [ ] **Step 6 — Create `test-v2-reduced-motion.js` at repo root**

```javascript
/**
 * Asserts that under prefers-reduced-motion: reduce, the cutscene lines
 * render with no animation-delay style and the @media rule applies the
 * opacity:1 / animation:none override.
 */
const puppeteer = require('puppeteer');
const { waitVisible, withV2Page } = require('./tests/integration/helpers');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__journeyV2, { timeout: 8000 });

  // Trigger a placeholder cutscene programmatically (no walking required)
  page.evaluate(() => new Promise(res =>
    window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'REDUCED' }, res)
  )).catch(() => { /* resolves on dismiss · ignored */ });

  await waitVisible(page, '#v2-cutscene');

  // 1. None of the .v2-line elements should carry an inline animation-delay
  const delays = await page.$$eval('.v2-cutscene-lines .v2-line', els => els.map(e => e.style.animationDelay));
  if (delays.some(d => d && d !== '')) throw new Error(
    `reduced-motion: lines should have no animation-delay · got ${JSON.stringify(delays)}`
  );

  // 2. The @media rule should produce opacity:1 on each line
  const opacities = await page.$$eval('.v2-cutscene-lines .v2-line', els =>
    els.map(e => window.getComputedStyle(e).opacity)
  );
  if (opacities.some(o => parseFloat(o) < 0.95)) throw new Error(
    `reduced-motion: lines should be opacity 1 · got ${JSON.stringify(opacities)}`
  );

  // 3. Dismiss + confirm clean exit
  await page.click('#v2-cutscene');
  await new Promise(r => setTimeout(r, 200));

  console.log(`PASS: reduced-motion cutscene · ${delays.length} lines, opacity=${opacities[0]}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 7 — Append `test-v2-reduced-motion.js` to `package.json`**

Edit the `test:integration` value to add `test-v2-reduced-motion.js` at the end:

```json
"test:integration": "for f in test-v2-flag.js test-v2-cutscene.js test-v2-npc.js test-v2-minigame.js test-v2-culmination.js test-v2-chapter-cmr.js test-v2-chapter-itics.js test-v2-chapter-scripbox.js test-v2-chapter-now.js test-v2-chapter-sakha.js test-v2-chapter-college.js test-v2-chapter-fever104.js test-v2-chapter-vwgt.js test-v2-reentry.js test-v2-reduced-motion.js; do echo \"▸ $f\"; node $f || exit 1; done",
```

- [ ] **Step 8 — Rebuild + run the new tests**

```bash
cd /Users/pranav.j/Documents/portfolio && npm run build:v2 && \
  node --test tests/unit/cutscene.test.js && \
  node test-v2-reduced-motion.js
```

Expected: 3 unit PASS + `PASS: reduced-motion cutscene · 3 lines, opacity=1`.

- [ ] **Step 9 — Run the full suite**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 90 unit (87 + 3) + 15 integration (14 + 1) PASS.

- [ ] **Step 10 — Commit**

```bash
git add src/journey/acts/cutscene.js public/journey.html tests/unit/cutscene.test.js test-v2-reduced-motion.js package.json public/journey-v2.js
git commit -m "journey-v2: honor prefers-reduced-motion in Act I cutscene

Adds a pure isReducedMotion(win) helper (unit-tested with stubbed
matchMedia) and uses it inside playCutscene to skip the per-line
animation-delay and cap the auto-dismiss timer at 3000ms. The CSS
@media rule provides a hard override for the .v2-line opacity fade.

New integration test test-v2-reduced-motion.js emulates the media
feature and asserts both behaviors land."
```

---

## Task 5 — Finalize: docs update + acceptance

**Files:**
- Modify: `docs/journey-v2-status.md` (mark 4 Phase 4a items complete)
- Modify: `JOURNEY_LORE.md` (touch the header note · noop if already current)

- [ ] **Step 1 — Full test pass**

```bash
cd /Users/pranav.j/Documents/portfolio && npm test
```

Expected: 90 unit + 15 integration = 105 tests PASS.

- [ ] **Step 2 — Update `docs/journey-v2-status.md`**

The file currently has a "TODO (deferred to Phase 4 cutover, requires headed browser or design work)" section. Replace just that section with this:

```markdown
## TODO (deferred to Phase 4b cutover, requires headed browser or design work)

- [ ] Manual mobile smoke on Chrome DevTools iPhone 14 Pro (390×844)
- [ ] Lighthouse mobile Performance (target ≥85)
- [ ] Speed-run leaderboard via Cloudflare Worker (Phase 5 polish)

## Phase 4a · Orchestrator + accessibility fixes · ✅ Complete

- **C-1 fixed** — `tickChapterFlow` now clears `_questPollTimers` for the
  previously-active chapter when the bridge reports a different (or no)
  chapter. Hides the quest HUD on leave.
- **C-2 fixed** — `enterExploring` skips the NPC auto-present when
  `store.getChapter(id).npcChoice` is set; player can walk away mid-quest
  and walk back in without re-triggering the NPC dialog. New regression
  test `test-v2-reentry.js`.
- **I-6 fixed** — `#v2-culmination` raised to z-index 80, above v1's
  stage-video overlay (z-index 70). All 7 chapter tests now use
  `page.click` instead of the in-page-dispatch workaround. Real-user
  clicks reach the dismiss handler.
- **Reduced-motion** — `cutscene.js` reads `prefers-reduced-motion: reduce`
  via a pure `isReducedMotion(win)` helper; skips per-line `animation-delay`
  and caps the auto-dismiss timer at 3000ms. CSS `@media` rule provides a
  hard `.v2-line` override.

105 tests passing (90 unit + 15 integration · added `tests/unit/cutscene.test.js`,
`test-v2-reentry.js`, `test-v2-reduced-motion.js`).
```

Leave the rest of the file unchanged.

- [ ] **Step 3 — Confirm `JOURNEY_LORE.md` doesn't need a header update**

```bash
head -20 /Users/pranav.j/Documents/portfolio/JOURNEY_LORE.md
```

The Phase 3 header note `> **Phase 3 status (2026-05-28):**` is still accurate — Phase 4a doesn't change which markdown file is source-of-truth. Skip Step 4 if the header already reflects Phase 3.

- [ ] **Step 4 — Commit**

```bash
git add docs/journey-v2-status.md
git commit -m "journey-v2: Phase 4a complete · C-1 + C-2 + I-6 + reduced-motion

All four Phase 3 final-review must-fix items landed. 105 tests passing.
Phase 4b cutover (delete v1, consolidate into single bundle) remains as
a separate follow-up plan."
```

- [ ] **Step 5 — Final branch summary**

```bash
cd /Users/pranav.j/Documents/portfolio && git log --oneline feat/journey-3-act-milestones-phase-4a ^main
```

Expected: 5 commits (one per task).

---

## Self-review

**Spec coverage:**

The Phase 3 final review identified 4 must-fix items for Phase 4. Each is covered by exactly one task:
- C-1 (orphan timers) → Task 1
- C-2 (re-entry blocking) → Task 2
- I-6 (z-index conflict) → Task 3
- Reduced-motion → Task 4
- Final docs update → Task 5

The Phase 4 cutover (delete v1, consolidate bundles) is deliberately deferred to a separate Phase 4b plan — see the scope-check section in the controller's introduction message above. The cutover changes the architecture significantly (v2 must absorb v1's world/walking/parallax/beats/audio) and warrants its own ~20-task plan.

**Placeholder scan:** No "TBD", "TODO", "implement later", or vague "add error handling" patterns appear inside task content. The two "TODO" mentions both live in `docs/journey-v2-status.md` content (describing items deferred to Phase 4b — they're list items, not plan placeholders).

**Type / signature consistency check:**

- `isReducedMotion(win)` — defined in Task 4 Step 3 (`src/journey/acts/cutscene.js`), used internally in `playCutscene`, exposed in Task 4 Step 1's unit test as `globalThis.Cutscene.isReducedMotion`. Consistent.
- `teleportPlayer(page, worldX)` — defined Task 1 Step 3 (`tests/integration/helpers.js`), used Task 1 Step 4 and Task 2 Step 3. Consistent.
- `_questPollTimers[chapterId]`, `_activeFlow`, `hideQuestHud` — all defined in Phase 3 (`src/journey/core.js` + `src/journey/ui/hud.js`), referenced unchanged in Tasks 1 + 2.
- `presentNpc(chapterId, onDone)`, `checkQuestComplete(chapterId)`, `store.getChapter(id).npcChoice`, `pollQuest(chapterId)` — all Phase 3 APIs, referenced unchanged in Task 2.
- The z-index integers 60 (existing `.v2-overlay`), 70 (existing v1 stage-video), 80 (new in Task 3) — consistent across HTML CSS and the test assertions.

No mismatches.

---

## Acceptance for Phase 4a

- All 5 tasks land cleanly on `feat/journey-3-act-milestones-phase-4a`.
- `npm test` reports 90 unit + 15 integration = 105 PASS.
- Branch is 5 commits ahead of main.
- `docs/journey-v2-status.md` reflects 4 fixes done and lists remaining Phase 4b items.

When Phase 4a is signed off, generate the Phase 4b plan with:

```
/superpowers:writing-plans Phase 4b cutover · port v1's world rendering,
walking, parallax, beats system, achievements, audio, and stage-video
into v2's source tree under src/journey/world/ + src/journey/v1port/.
Then delete public/journey.js, rename public/journey-v2.js → public/journey.js,
remove the dual-load script-swap, and run all 105 tests under the
consolidated bundle.
```
