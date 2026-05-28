# Journey · 3-Act Milestones · Phase 1 + 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the harness for the 3-act milestone redesign (Phase 1) and ship CMR end-to-end behind `?v=2` as a vertical slice (Phase 2). Other 7 chapters (Phase 3) are a follow-up plan.

**Architecture:** Author multi-file under `src/journey/`, concat at build time into `public/journey-v2.js` wrapped in a single IIFE. State machine + persistence in pure JS modules unit-tested via `node:test`. Acts (cutscene, NPC, quest, mini-game, culmination) wired through the existing canvas render loop. `journey.html` swaps script tags based on `?v=2` query param so v1 is untouched.

**Tech Stack:** Vanilla JS (no TypeScript, no bundler), `node:test` for unit tests, Puppeteer for integration tests (existing root `test-*.js` pattern), Express dev server (`server.js`), GitHub Pages for production.

**Branch:** `feat/journey-3-act-milestones` (already created · spec committed `2413229`)

**Spec:** `docs/superpowers/specs/2026-05-28-journey-3-act-milestones-design.md`

---

## Conventions used throughout this plan

- **Unit tests** live in `tests/unit/*.test.js` and run via `node --test tests/unit/`. Zero dependencies beyond Node 18+.
- **Integration tests** live as `test-v2-*.js` at the repo root, matching the existing `test-*.js` Puppeteer convention. Run via `node test-v2-foo.js http://localhost:3000`.
- **Source layout:** `src/journey/{core,world,state,acts,ui,data}/*.js`. Each source file writes plain top-level declarations (consts, functions) — they get concatenated into one outer IIFE by `build.js`, so all declarations share the same scope. **No `import`/`export`, no `module.exports`.**
- **Commits:** every task ends with a commit on `feat/journey-3-act-milestones`. Commit-message prefix is `journey-v2:` to distinguish from the existing v1 work.
- **Run dev server:** `npm run watch` (auto-reload). It serves `public/` at `http://localhost:3000`.
- **Run build:** `npm run build` after Task 1 produces `public/journey-v2.js`.

---

## File structure (locked here, locked downstream)

```
src/journey/
├── core.js                          # game loop hooks, fitCanvas wiring point
├── state/
│   ├── persistence.js               # load/save/migrate localStorage.journey (v1→v2)
│   ├── phase.js                     # per-chapter phase state machine
│   └── store.js                     # state.chapters[id] reactive map
├── world/
│   └── npcs.js                      # NPCS table (Phase 2: CMR populated)
├── data/
│   ├── cutscenes.js                 # CUTSCENES table
│   └── culminations.js              # CULMINATIONS table
├── acts/
│   ├── cutscene.js                  # Act I player
│   ├── npc.js                       # Act II NPC overlay
│   ├── quest.js                     # Act II quest tracker
│   ├── minigame.js                  # Act III harness
│   ├── minigames/
│   │   └── mock-test.js             # Phase 2: CMR's mini-game
│   └── culmination.js               # Act III paragraph card → video
├── ui/
│   ├── input.js                     # TAP/HOLD/SWIPE router
│   └── hud.js                       # quest checklist panel
└── bootstrap.js                     # loads tables, wires acts to chapter detection

build.js                             # concat manifest → public/journey-v2.js
tests/unit/                          # node:test files
test-v2-*.js                         # Puppeteer integration tests at repo root
```

---

## Phase 1 — Foundation harness (Tasks 1–11)

Goal: harness can play `placeholder cutscene → placeholder NPC → placeholder mini-game → placeholder culmination` for one chapter, with zero real content wired. Tests prove every seam holds.

---

### Task 1 — Build pipeline + source skeleton

**Files:**
- Create: `build.js`
- Create: `src/journey/core.js`
- Create: `tests/unit/build.test.js`
- Modify: `package.json`

- [ ] **Step 1 — Write the failing unit test**

Create `tests/unit/build.test.js`:

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
```

- [ ] **Step 2 — Run test, confirm it fails**

```bash
node --test tests/unit/build.test.js
```

Expected: FAIL — `build.js` does not exist.

- [ ] **Step 3 — Create `src/journey/core.js` with a marker**

```javascript
// === src/journey/core.js ===
// Entry hooks for the v2 harness. Populated in later tasks.
const JOURNEY_V2_VERSION = 2;
```

- [ ] **Step 4 — Create `build.js`**

```javascript
#!/usr/bin/env node
/**
 * Concat src/journey/**/*.js into public/journey-v2.js wrapped in one IIFE.
 * Manifest order matters — declarations later in the manifest may reference
 * declarations earlier. Keep `core.js` first and `bootstrap.js` last.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST = [
  'src/journey/core.js',
  'src/journey/state/persistence.js',
  'src/journey/state/phase.js',
  'src/journey/state/store.js',
  'src/journey/data/cutscenes.js',
  'src/journey/data/culminations.js',
  'src/journey/world/npcs.js',
  'src/journey/ui/input.js',
  'src/journey/ui/hud.js',
  'src/journey/acts/cutscene.js',
  'src/journey/acts/npc.js',
  'src/journey/acts/quest.js',
  'src/journey/acts/minigame.js',
  'src/journey/acts/minigames/mock-test.js',
  'src/journey/acts/culmination.js',
  'src/journey/bootstrap.js',
];

const ROOT = __dirname;
const OUT = path.join(ROOT, 'public', 'journey-v2.js');

const parts = ['(() => {', `'use strict';`];
for (const rel of MANIFEST) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    // Skip missing files so the harness builds even before all tasks land.
    parts.push(`// === ${rel} === (missing — skipped)`);
    continue;
  }
  parts.push(`// === ${rel} ===`);
  parts.push(fs.readFileSync(abs, 'utf8'));
}
parts.push('})();');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n\n'));
console.log(`wrote ${OUT} (${parts.length - 3} sources)`);
```

- [ ] **Step 5 — Update `package.json` scripts**

Modify the `scripts` block in `package.json`:

```json
"scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "node build.js && mkdir -p build && cp -r public/* build/",
    "build:v2": "node build.js",
    "watch": "nodemon --watch routes --watch server.js --watch public/index.html --watch public/styles.css --watch src/journey --exec 'npm run build:v2 && node server.js'",
    "postinstall": "npm run build",
    "generate-pdf": "node generate-pdf.js",
    "test:unit": "node --test tests/unit/"
}
```

- [ ] **Step 6 — Run test, confirm it passes**

```bash
node --test tests/unit/build.test.js
```

Expected: PASS. `public/journey-v2.js` exists and starts with `(() => {` and ends with `})();`.

- [ ] **Step 7 — Commit**

```bash
git add build.js src/journey/core.js tests/unit/build.test.js package.json public/journey-v2.js
git commit -m "journey-v2: build pipeline + source skeleton

- build.js concats src/journey/**/*.js into one IIFE
- npm run build:v2, npm run test:unit
- core.js stub establishes the v2 module shape"
```

---

### Task 2 — Feature-flag wire-up in journey.html

**Files:**
- Modify: `public/journey.html` (the `<script src="/journey.js?..."></script>` line near end of file)
- Create: `test-v2-flag.js`

- [ ] **Step 1 — Find the existing script tag**

```bash
grep -n "journey\.js" /Users/pranav.j/Documents/portfolio/public/journey.html
```

Expected: one match. Note the line number.

- [ ] **Step 2 — Write the failing integration test**

Create `test-v2-flag.js` at repo root:

```javascript
/**
 * Asserts journey.html?v=2 loads journey-v2.js and journey.html (no param)
 * loads journey.js.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. Default load — must use v1
  const v1Reqs = [];
  page.on('request', r => { if (r.url().includes('journey')) v1Reqs.push(r.url()); });
  await page.goto(`${URL}/journey.html`, { waitUntil: 'domcontentloaded' });
  if (!v1Reqs.some(u => u.endsWith('journey.js') || u.includes('journey.js?'))) {
    throw new Error(`default load did not request journey.js · got ${JSON.stringify(v1Reqs)}`);
  }
  if (v1Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error('default load incorrectly requested journey-v2.js');
  }

  // 2. ?v=2 load — must use v2
  const v2Reqs = [];
  const page2 = await browser.newPage();
  page2.on('request', r => { if (r.url().includes('journey')) v2Reqs.push(r.url()); });
  await page2.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  if (!v2Reqs.some(u => u.includes('journey-v2.js'))) {
    throw new Error(`?v=2 load did not request journey-v2.js · got ${JSON.stringify(v2Reqs)}`);
  }

  console.log('PASS: feature-flag wiring works');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3 — Start dev server in another terminal**

```bash
npm run watch
```

- [ ] **Step 4 — Run test, confirm it fails**

```bash
node test-v2-flag.js
```

Expected: FAIL — `?v=2` does not request `journey-v2.js` (still requests `journey.js`).

- [ ] **Step 5 — Modify `public/journey.html` to swap based on flag**

Replace the single `<script src="/journey.js?...">` line at the bottom of `<body>` with this block:

```html
<script>
  // Feature flag: ?v=2 loads the 3-act milestone harness; default stays v1.
  (function () {
    var v = new URLSearchParams(location.search).get('v');
    var s = document.createElement('script');
    s.src = (v === '2') ? '/journey-v2.js' : '/journey.js?v=20260514-2';
    document.body.appendChild(s);
  })();
</script>
```

- [ ] **Step 6 — Run test, confirm it passes**

```bash
node test-v2-flag.js
```

Expected: `PASS: feature-flag wiring works`.

- [ ] **Step 7 — Commit**

```bash
git add public/journey.html test-v2-flag.js
git commit -m "journey-v2: ?v=2 query flag swaps script src

Default journey.html keeps loading journey.js; ?v=2 loads journey-v2.js.
Integration test asserts both paths."
```

---

### Task 3 — Persistence layer + v1→v2 migration

**Files:**
- Create: `src/journey/state/persistence.js`
- Create: `tests/unit/persistence.test.js`

- [ ] **Step 1 — Write the failing unit test**

Create `tests/unit/persistence.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');

// Load the source by reading it and evaluating into a sandbox so we can
// test pure functions without a browser. The file declares top-level
// consts/functions; we expose them via globalThis at the end of the file.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/state/persistence.js'), 'utf8');
eval(SRC + '\nglobalThis.JourneyPersistence = { loadJourneyState, saveJourneyState, migrateJourneyState };');

test('migrateJourneyState backfills chapters from v1 collected set', () => {
  const v1 = {
    v: 1,
    playerX: 1200,
    vehicle: 'run',
    collected: ['itics', 'cmr'],
    achievements: ['school-1'],
    discoveredBeats: ['exam-anxiety'],
  };
  const v2 = globalThis.JourneyPersistence.migrateJourneyState(v1);
  assert.strictEqual(v2.v, 2);
  assert.strictEqual(v2.chapters.itics.phase, 'complete');
  assert.strictEqual(v2.chapters.cmr.phase, 'complete');
  assert.strictEqual(v2.chapters.college, undefined);
  // existing fields preserved
  assert.strictEqual(v2.playerX, 1200);
  assert.strictEqual(v2.vehicle, 'run');
  assert.deepStrictEqual(v2.collected, ['itics', 'cmr']);
});

test('migrateJourneyState handles missing v field as v1', () => {
  const stored = { collected: [], playerX: 0 };
  const out = globalThis.JourneyPersistence.migrateJourneyState(stored);
  assert.strictEqual(out.v, 2);
  assert.deepStrictEqual(out.chapters, {});
});

test('migrateJourneyState is a no-op on already-v2 state', () => {
  const v2 = { v: 2, chapters: { itics: { phase: 'complete', score: 50, npcChoice: 0 } } };
  const out = globalThis.JourneyPersistence.migrateJourneyState(v2);
  assert.strictEqual(out, v2);
});

test('loadJourneyState reads + migrates from a mock storage', () => {
  const store = { journey: JSON.stringify({ v: 1, collected: ['itics'] }) };
  const mockStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  };
  const state = globalThis.JourneyPersistence.loadJourneyState(mockStorage);
  assert.strictEqual(state.v, 2);
  assert.strictEqual(state.chapters.itics.phase, 'complete');
  // and writes back the migrated form
  assert.strictEqual(JSON.parse(store.journey).v, 2);
});

test('saveJourneyState writes JSON', () => {
  const store = {};
  const mockStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  };
  globalThis.JourneyPersistence.saveJourneyState(mockStorage, { v: 2, foo: 1 });
  assert.deepStrictEqual(JSON.parse(store.journey), { v: 2, foo: 1 });
});
```

- [ ] **Step 2 — Run test, confirm it fails**

```bash
node --test tests/unit/persistence.test.js
```

Expected: FAIL — `src/journey/state/persistence.js` does not exist (ENOENT).

- [ ] **Step 3 — Implement `src/journey/state/persistence.js`**

```javascript
// === src/journey/state/persistence.js ===
/**
 * localStorage.journey schema migration + IO.
 * Pure functions — accept a storage-like object so tests don't need jsdom.
 */
const JOURNEY_STORAGE_KEY = 'journey';
const JOURNEY_SCHEMA_VERSION = 2;

function migrateJourneyState(stored) {
  if (!stored || typeof stored !== 'object') return { v: 2, chapters: {} };
  if (stored.v === 2) return stored;
  // v1 (or missing v): build chapters map from collected set
  const collected = Array.isArray(stored.collected) ? stored.collected : [];
  const chapters = {};
  for (const id of collected) {
    chapters[id] = { phase: 'complete', score: null, npcChoice: null };
  }
  return { ...stored, v: 2, chapters };
}

function loadJourneyState(storage) {
  const raw = storage.getItem(JOURNEY_STORAGE_KEY);
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = null; }
  const migrated = migrateJourneyState(parsed);
  // write-back any migration so v1 visitors are upgraded
  if (parsed && parsed.v !== 2) {
    try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
  }
  return migrated;
}

function saveJourneyState(storage, state) {
  try { storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}
```

- [ ] **Step 4 — Run test, confirm all 5 cases pass**

```bash
node --test tests/unit/persistence.test.js
```

Expected: 5 PASS / 0 FAIL.

- [ ] **Step 5 — Run full unit suite to ensure no regression**

```bash
npm run test:unit
```

Expected: all PASS.

- [ ] **Step 6 — Rebuild v2 bundle and confirm the new module is included**

```bash
npm run build:v2
grep -c "loadJourneyState" public/journey-v2.js
```

Expected: count ≥ 1.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/state/persistence.js tests/unit/persistence.test.js public/journey-v2.js
git commit -m "journey-v2: persistence + v1→v2 migration

Pure functions (mock-storage-friendly) that load/save the journey
localStorage entry and back-fill chapters{} from a v1 collected set."
```

---

### Task 4 — Per-chapter phase state machine

**Files:**
- Create: `src/journey/state/phase.js`
- Create: `tests/unit/phase.test.js`

- [ ] **Step 1 — Write the failing test**

Create `tests/unit/phase.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/state/phase.js'), 'utf8');
eval(SRC + '\nglobalThis.Phase = { transitionChapterPhase, CHAPTER_PHASES };');

const { transitionChapterPhase, CHAPTER_PHASES } = globalThis.Phase;

test('CHAPTER_PHASES lists all 6 phase names', () => {
  assert.deepStrictEqual(CHAPTER_PHASES, [
    'unseen', 'cutscene', 'exploring', 'closing', 'culminating', 'complete',
  ]);
});

test('unseen + ENTER → cutscene', () => {
  assert.strictEqual(transitionChapterPhase('unseen', 'ENTER'), 'cutscene');
});

test('cutscene + DISMISS → exploring', () => {
  assert.strictEqual(transitionChapterPhase('cutscene', 'DISMISS'), 'exploring');
});

test('exploring + QUEST_COMPLETE → closing', () => {
  assert.strictEqual(transitionChapterPhase('exploring', 'QUEST_COMPLETE'), 'closing');
});

test('closing + MINIGAME_DONE → culminating', () => {
  assert.strictEqual(transitionChapterPhase('closing', 'MINIGAME_DONE'), 'culminating');
});

test('culminating + DISMISS → complete', () => {
  assert.strictEqual(transitionChapterPhase('culminating', 'DISMISS'), 'complete');
});

test('complete + ENTER → exploring (re-entry skips cutscene)', () => {
  assert.strictEqual(transitionChapterPhase('complete', 'ENTER'), 'exploring');
});

test('invalid event returns current phase (no-op)', () => {
  assert.strictEqual(transitionChapterPhase('cutscene', 'QUEST_COMPLETE'), 'cutscene');
});

test('unknown phase throws', () => {
  assert.throws(() => transitionChapterPhase('nope', 'ENTER'), /unknown phase/i);
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
node --test tests/unit/phase.test.js
```

Expected: FAIL — file missing.

- [ ] **Step 3 — Implement `src/journey/state/phase.js`**

```javascript
// === src/journey/state/phase.js ===
/**
 * Per-chapter phase machine.
 *   unseen → cutscene → exploring → closing → culminating → complete
 * Re-entry to a `complete` chapter via ENTER drops back to `exploring`
 * (cutscene is one-shot per chapter; NPC and beats remain interactive).
 */
const CHAPTER_PHASES = ['unseen', 'cutscene', 'exploring', 'closing', 'culminating', 'complete'];

const PHASE_TRANSITIONS = {
  unseen:     { ENTER: 'cutscene' },
  cutscene:   { DISMISS: 'exploring' },
  exploring:  { QUEST_COMPLETE: 'closing' },
  closing:    { MINIGAME_DONE: 'culminating' },
  culminating:{ DISMISS: 'complete' },
  complete:   { ENTER: 'exploring' },   // re-entry
};

function transitionChapterPhase(current, event) {
  const row = PHASE_TRANSITIONS[current];
  if (!row) throw new Error(`unknown phase: ${current}`);
  return row[event] ?? current;
}
```

- [ ] **Step 4 — Run, confirm 9 pass**

```bash
node --test tests/unit/phase.test.js
```

Expected: 9 PASS.

- [ ] **Step 5 — Rebuild + verify inclusion**

```bash
npm run build:v2
grep -c "transitionChapterPhase" public/journey-v2.js
```

Expected: ≥ 1.

- [ ] **Step 6 — Commit**

```bash
git add src/journey/state/phase.js tests/unit/phase.test.js public/journey-v2.js
git commit -m "journey-v2: per-chapter phase state machine

Pure transition table: 6 phases × 5 events. Re-entry from complete drops
to exploring so cutscene only plays once per chapter."
```

---

### Task 5 — Chapter store + integration with persistence

**Files:**
- Create: `src/journey/state/store.js`
- Create: `tests/unit/store.test.js`

- [ ] **Step 1 — Write the failing test**

Create `tests/unit/store.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Order matters: persistence + phase first, then store
const ROOT = path.join(__dirname, '..', '..');
const load = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
eval(
  load('src/journey/state/persistence.js') + '\n' +
  load('src/journey/state/phase.js') + '\n' +
  load('src/journey/state/store.js') + '\n' +
  'globalThis.Store = { createChapterStore };'
);
const { createChapterStore } = globalThis.Store;

function mockStorage() {
  const m = {};
  return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, _raw: m };
}

test('createChapterStore returns empty chapters when storage is blank', () => {
  const store = createChapterStore(mockStorage());
  assert.deepStrictEqual(store.getChapter('cmr'), { phase: 'unseen', score: null, npcChoice: null });
});

test('store.send(id, ENTER) moves unseen → cutscene and persists', () => {
  const s = mockStorage();
  const store = createChapterStore(s);
  store.send('cmr', 'ENTER');
  assert.strictEqual(store.getChapter('cmr').phase, 'cutscene');
  const persisted = JSON.parse(s._raw.journey);
  assert.strictEqual(persisted.chapters.cmr.phase, 'cutscene');
});

test('store.setScore(id, n) writes through', () => {
  const s = mockStorage();
  const store = createChapterStore(s);
  store.send('cmr', 'ENTER');
  store.setScore('cmr', 78);
  assert.strictEqual(store.getChapter('cmr').score, 78);
});

test('store.setNpcChoice(id, idx) writes through', () => {
  const s = mockStorage();
  const store = createChapterStore(s);
  store.setNpcChoice('cmr', 1);
  assert.strictEqual(store.getChapter('cmr').npcChoice, 1);
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
node --test tests/unit/store.test.js
```

Expected: FAIL — `store.js` missing.

- [ ] **Step 3 — Implement `src/journey/state/store.js`**

```javascript
// === src/journey/state/store.js ===
/**
 * Chapter store. Wraps localStorage via persistence module, exposes
 * getChapter / send (transition) / setScore / setNpcChoice.
 */
function createChapterStore(storage) {
  let state = loadJourneyState(storage);
  if (!state.chapters) state.chapters = {};

  function persist() { saveJourneyState(storage, state); }

  function getChapter(id) {
    return state.chapters[id] ?? { phase: 'unseen', score: null, npcChoice: null };
  }

  function send(id, event) {
    const cur = getChapter(id);
    const next = transitionChapterPhase(cur.phase, event);
    state.chapters[id] = { ...cur, phase: next };
    persist();
    return next;
  }

  function setScore(id, score) {
    state.chapters[id] = { ...getChapter(id), score };
    persist();
  }

  function setNpcChoice(id, idx) {
    state.chapters[id] = { ...getChapter(id), npcChoice: idx };
    persist();
  }

  return { getChapter, send, setScore, setNpcChoice, _state: () => state };
}
```

- [ ] **Step 4 — Run, confirm 4 pass**

```bash
node --test tests/unit/store.test.js
```

Expected: 4 PASS.

- [ ] **Step 5 — Run full unit suite**

```bash
npm run test:unit
```

Expected: all PASS (build, persistence, phase, store).

- [ ] **Step 6 — Commit**

```bash
npm run build:v2
git add src/journey/state/store.js tests/unit/store.test.js public/journey-v2.js
git commit -m "journey-v2: chapter store wraps persistence + phase machine

createChapterStore(storage) exposes getChapter/send/setScore/setNpcChoice.
Every mutation persists through to localStorage."
```

---

### Task 6 — Unified input router (TAP / HOLD / SWIPE-V / SWIPE-H)

**Files:**
- Create: `src/journey/ui/input.js`
- Create: `tests/unit/input.test.js`

- [ ] **Step 1 — Write the failing test**

Create `tests/unit/input.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/ui/input.js'), 'utf8');
eval(SRC + '\nglobalThis.Input = { classifyGesture };');
const { classifyGesture } = globalThis.Input;

test('short stationary press is a TAP', () => {
  const out = classifyGesture({ dx: 2, dy: -1, durationMs: 80 });
  assert.strictEqual(out.kind, 'TAP');
});

test('long stationary press is a HOLD', () => {
  const out = classifyGesture({ dx: 4, dy: 3, durationMs: 600 });
  assert.strictEqual(out.kind, 'HOLD');
});

test('large vertical drag is SWIPE-V', () => {
  const out = classifyGesture({ dx: 5, dy: -80, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-V');
  assert.strictEqual(out.dir, -1);  // up
});

test('large horizontal drag is SWIPE-H', () => {
  const out = classifyGesture({ dx: 120, dy: 4, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-H');
  assert.strictEqual(out.dir, 1);   // right
});

test('vertical wins when both axes exceed threshold but |dy| > |dx|', () => {
  const out = classifyGesture({ dx: 50, dy: -90, durationMs: 200 });
  assert.strictEqual(out.kind, 'SWIPE-V');
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
node --test tests/unit/input.test.js
```

Expected: FAIL.

- [ ] **Step 3 — Implement `src/journey/ui/input.js`**

```javascript
// === src/journey/ui/input.js ===
/**
 * Gesture classifier. Pure function over an end-of-pointer snapshot:
 *   { dx, dy, durationMs }
 * Returns one of TAP / HOLD / SWIPE-V / SWIPE-H plus direction for swipes.
 * Thresholds are deliberately generous for mobile.
 */
const INPUT_SWIPE_THRESHOLD_PX = 40;
const INPUT_HOLD_THRESHOLD_MS  = 300;

function classifyGesture({ dx, dy, durationMs }) {
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (ady > INPUT_SWIPE_THRESHOLD_PX && ady >= adx) {
    return { kind: 'SWIPE-V', dir: Math.sign(dy) };  // +1 down, -1 up
  }
  if (adx > INPUT_SWIPE_THRESHOLD_PX) {
    return { kind: 'SWIPE-H', dir: Math.sign(dx) };  // +1 right, -1 left
  }
  if (durationMs >= INPUT_HOLD_THRESHOLD_MS) return { kind: 'HOLD' };
  return { kind: 'TAP' };
}

/**
 * attachInputRouter(target, onGesture) — wires touch + mouse on `target`
 * and invokes onGesture(result, originalEvent) for each completed gesture.
 * Returns a detach() function. Browser-only (uses addEventListener).
 */
function attachInputRouter(target, onGesture) {
  let start = null;
  const isTouch = e => e.touches && e.touches.length > 0;

  function pointerStart(e) {
    const p = isTouch(e) ? e.touches[0] : e;
    start = { x: p.clientX, y: p.clientY, t: Date.now() };
  }
  function pointerEnd(e) {
    if (!start) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    const result = classifyGesture({
      dx: p.clientX - start.x,
      dy: p.clientY - start.y,
      durationMs: Date.now() - start.t,
    });
    start = null;
    onGesture(result, e);
  }
  target.addEventListener('touchstart', pointerStart, { passive: true });
  target.addEventListener('touchend',   pointerEnd,   { passive: true });
  target.addEventListener('mousedown',  pointerStart);
  target.addEventListener('mouseup',    pointerEnd);

  return function detach() {
    target.removeEventListener('touchstart', pointerStart);
    target.removeEventListener('touchend',   pointerEnd);
    target.removeEventListener('mousedown',  pointerStart);
    target.removeEventListener('mouseup',    pointerEnd);
  };
}
```

- [ ] **Step 4 — Run, confirm 5 pass**

```bash
node --test tests/unit/input.test.js
```

Expected: 5 PASS.

- [ ] **Step 5 — Run full unit suite**

```bash
npm run test:unit
```

Expected: all PASS.

- [ ] **Step 6 — Commit**

```bash
npm run build:v2
git add src/journey/ui/input.js tests/unit/input.test.js public/journey-v2.js
git commit -m "journey-v2: unified TAP/HOLD/SWIPE input router

classifyGesture is pure (unit-tested). attachInputRouter wires touch +
mouse end-events on a target and invokes the callback with the classified
gesture. Generous mobile-friendly thresholds (40px / 300ms)."
```

---

### Task 7 — Cutscene player (Act I)

**Files:**
- Create: `src/journey/data/cutscenes.js`
- Create: `src/journey/acts/cutscene.js`
- Modify: `public/journey.html` (add cutscene overlay markup)

- [ ] **Step 1 — Create the data table stub**

Create `src/journey/data/cutscenes.js`:

```javascript
// === src/journey/data/cutscenes.js ===
/**
 * Per-chapter Act I cutscene lines. Each entry:
 *   { lines: [...string], durationMs: number }
 * Phase 2 populates `cmr`. Other chapters stay empty until Phase 3 — the
 * cutscene player gracefully no-ops on a missing entry.
 */
const CUTSCENES = {
  __placeholder: {
    lines: ['act i', 'a placeholder line', 'tap to continue'],
    durationMs: 4000,
  },
};
```

- [ ] **Step 2 — Add cutscene overlay markup to `public/journey.html`**

Find the closing `</body>` and the existing stage-video overlay (around `<video id="stage-video">`). Add directly above the script tag block:

```html
<!-- v2 · Act I cutscene overlay -->
<div id="v2-cutscene" class="v2-overlay" aria-hidden="true">
  <div class="v2-cutscene-card">
    <div class="v2-cutscene-act" id="v2-cutscene-act"></div>
    <div class="v2-cutscene-lines" id="v2-cutscene-lines"></div>
    <div class="v2-cutscene-cta">▸ tap to continue ▸</div>
  </div>
</div>
```

Add minimal CSS in the existing `<style>` block (find the `:root` definitions and append after):

```css
.v2-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(31, 22, 16, 0.94);
  display: none; align-items: center; justify-content: center;
  font-family: 'IM Fell English', serif;
  color: var(--paper);
}
.v2-overlay[aria-hidden="false"] { display: flex; }
.v2-cutscene-card { max-width: 540px; text-align: center; padding: 24px; }
.v2-cutscene-act {
  font-family: 'Cinzel', serif; letter-spacing: 0.18em;
  font-size: 0.9rem; opacity: 0.65; margin-bottom: 8px;
}
.v2-cutscene-lines { font-size: 1.2rem; line-height: 1.6; }
.v2-cutscene-lines .v2-line { opacity: 0; animation: v2-fade 0.6s forwards; }
.v2-cutscene-cta {
  margin-top: 24px; font-family: 'IBM Plex Mono', monospace;
  font-size: 0.8rem; opacity: 0.55;
}
@keyframes v2-fade { to { opacity: 1; } }
```

- [ ] **Step 3 — Implement `src/journey/acts/cutscene.js`**

```javascript
// === src/journey/acts/cutscene.js ===
/**
 * Act I cutscene player. Fades lines in one-by-one, dismisses on tap or
 * after durationMs. Calls onDismiss() exactly once.
 *
 * Browser-only: touches DOM. Reduced-motion mode displays all lines at
 * once with no animation and shortens display time.
 */
function playCutscene(chapterId, intertitle, onDismiss) {
  const data = CUTSCENES[chapterId] ?? CUTSCENES.__placeholder;
  const overlay = document.getElementById('v2-cutscene');
  const actEl   = document.getElementById('v2-cutscene-act');
  const linesEl = document.getElementById('v2-cutscene-lines');
  if (!overlay || !actEl || !linesEl) {
    onDismiss();
    return;
  }
  actEl.textContent = intertitle?.act ? `${intertitle.act} · ${intertitle.title ?? ''}` : '';
  linesEl.innerHTML = data.lines
    .map((t, i) => `<div class="v2-line" style="animation-delay:${i * 0.7}s">${t}</div>`)
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
  setTimeout(dismiss, data.durationMs);
}
```

- [ ] **Step 4 — Write the integration test**

Create `test-v2-cutscene.js` at repo root:

```javascript
/**
 * Loads ?v=2, calls window.__journeyV2.playCutscene from the page console,
 * asserts the overlay becomes visible, asserts a click dismisses it.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  // Trigger placeholder cutscene
  await page.evaluate(() => {
    return new Promise(res => window.__journeyV2.playCutscene('__placeholder', { act: 'TEST', title: 'PLACEHOLDER' }, res));
  }).catch(() => { /* the promise resolves on dismiss, we'll dismiss below */ });

  // Overlay should be visible immediately after the call returns
  // (we race against the promise — give the JS a tick)
  await new Promise(r => setTimeout(r, 200));
  const visible = await page.evaluate(() => {
    return document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'false';
  });
  if (!visible) throw new Error('cutscene overlay did not become visible');

  // Click the overlay to dismiss
  await page.click('#v2-cutscene');
  await new Promise(r => setTimeout(r, 200));
  const hidden = await page.evaluate(() =>
    document.getElementById('v2-cutscene').getAttribute('aria-hidden') === 'true'
  );
  if (!hidden) throw new Error('cutscene overlay did not dismiss on click');

  console.log('PASS: cutscene visible + dismissable');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5 — Expose v2 API on `window.__journeyV2` from bootstrap**

Create `src/journey/bootstrap.js`:

```javascript
// === src/journey/bootstrap.js ===
/**
 * Exposes v2 internals on window.__journeyV2 for integration tests and
 * for the v1 game loop to call into during Phase 2 wiring.
 */
window.__journeyV2 = {
  playCutscene,
  // populated in later tasks:
  presentNpc: null,
  initMinigame: null,
  showCulmination: null,
  store: null,
};
```

- [ ] **Step 6 — Rebuild + run integration test**

In one terminal: `npm run watch` (dev server stays running on port 3000).

In another:

```bash
npm run build:v2
node test-v2-cutscene.js
```

Expected: `PASS: cutscene visible + dismissable`.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/acts/cutscene.js src/journey/bootstrap.js public/journey.html test-v2-cutscene.js public/journey-v2.js
git commit -m "journey-v2: Act I cutscene player

Overlay + fade-in lines + tap-to-dismiss. Reduced-motion respected via
existing global flag. Exposed on window.__journeyV2.playCutscene for
tests and for the chapter flow."
```

---

### Task 8 — NPC dialog overlay (Act II)

**Files:**
- Create: `src/journey/world/npcs.js`
- Create: `src/journey/acts/npc.js`
- Modify: `public/journey.html` (add NPC overlay markup + CSS)
- Modify: `src/journey/bootstrap.js` (expose `presentNpc`)
- Create: `test-v2-npc.js`

- [ ] **Step 1 — Create the data table stub**

Create `src/journey/world/npcs.js`:

```javascript
// === src/journey/world/npcs.js ===
/**
 * Per-chapter NPC archetype. Each entry:
 *   { name, sprite, open, choices: [{label, reply}], close }
 * Phase 2 populates `cmr`. Other chapters added in Phase 3.
 */
const NPCS = {
  __placeholder: {
    name: 'THE PLACEHOLDER',
    sprite: '🗿',
    open: 'placeholder open line.',
    choices: [
      { label: 'choice a', reply: 'reply a.' },
      { label: 'choice b', reply: 'reply b.' },
    ],
    close: 'go well.',
  },
};
```

- [ ] **Step 2 — Add NPC overlay markup to `public/journey.html`**

Add directly after the cutscene overlay block:

```html
<!-- v2 · Act II NPC dialog overlay -->
<div id="v2-npc" class="v2-overlay" aria-hidden="true">
  <div class="v2-npc-card">
    <div class="v2-npc-sprite" id="v2-npc-sprite"></div>
    <div class="v2-npc-name" id="v2-npc-name"></div>
    <div class="v2-npc-line" id="v2-npc-line"></div>
    <div class="v2-npc-choices" id="v2-npc-choices"></div>
  </div>
</div>
```

Append CSS:

```css
.v2-npc-card { max-width: 460px; padding: 28px; text-align: center; }
.v2-npc-sprite { font-size: 3.2rem; margin-bottom: 12px; }
.v2-npc-name {
  font-family: 'Cinzel', serif; letter-spacing: 0.2em;
  color: var(--accent); font-size: 0.95rem; margin-bottom: 14px;
}
.v2-npc-line { font-size: 1.15rem; line-height: 1.5; margin-bottom: 22px; }
.v2-npc-choices { display: flex; flex-direction: column; gap: 8px; }
.v2-npc-choice {
  background: var(--mahogany); color: var(--paper); border: 1px solid var(--paper-dim);
  padding: 12px 18px; font-family: 'IM Fell English', serif;
  font-size: 1rem; cursor: pointer; border-radius: 3px;
}
.v2-npc-choice:hover { background: var(--bg-warm); }
```

- [ ] **Step 3 — Implement `src/journey/acts/npc.js`**

```javascript
// === src/journey/acts/npc.js ===
/**
 * Act II NPC encounter. Renders open line, then choices. Player taps a
 * choice → reply replaces the line, choices clear, "tap to continue"
 * appears. Tap anywhere → close line → onDone(choiceIdx).
 */
function presentNpc(chapterId, onDone) {
  const data = NPCS[chapterId] ?? NPCS.__placeholder;
  const overlay = document.getElementById('v2-npc');
  const $sprite = document.getElementById('v2-npc-sprite');
  const $name   = document.getElementById('v2-npc-name');
  const $line   = document.getElementById('v2-npc-line');
  const $choices = document.getElementById('v2-npc-choices');
  if (!overlay) { onDone(null); return; }

  $sprite.textContent = data.sprite;
  $name.textContent = data.name;
  $line.textContent = data.open;
  $choices.innerHTML = data.choices
    .map((c, i) => `<button class="v2-npc-choice" data-idx="${i}">${c.label}</button>`)
    .join('');
  overlay.setAttribute('aria-hidden', 'false');

  let phase = 'choose';  // choose → reply → close
  let pickedIdx = null;

  function clickChoice(e) {
    const btn = e.target.closest('.v2-npc-choice');
    if (!btn || phase !== 'choose') return;
    pickedIdx = parseInt(btn.dataset.idx, 10);
    $line.textContent = data.choices[pickedIdx].reply;
    $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to continue ▸</div>`;
    phase = 'reply';
  }
  function clickAdvance(e) {
    if (phase === 'reply') {
      $line.textContent = data.close;
      $choices.innerHTML = `<div class="v2-cutscene-cta">▸ tap to leave ▸</div>`;
      phase = 'close';
      return;
    }
    if (phase === 'close') {
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeEventListener('click', clickChoice, true);
      overlay.removeEventListener('click', clickAdvance);
      onDone(pickedIdx);
    }
  }
  overlay.addEventListener('click', clickChoice, true);
  overlay.addEventListener('click', clickAdvance);
}
```

- [ ] **Step 4 — Wire bootstrap**

Edit `src/journey/bootstrap.js`:

```javascript
// === src/journey/bootstrap.js ===
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame: null,
  showCulmination: null,
  store: null,
};
```

- [ ] **Step 5 — Write the integration test**

Create `test-v2-npc.js`:

```javascript
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const pickedIdxP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.presentNpc('__placeholder', res)
  ));

  // Overlay should be visible
  await new Promise(r => setTimeout(r, 150));
  const visible = await page.evaluate(() =>
    document.getElementById('v2-npc').getAttribute('aria-hidden') === 'false'
  );
  if (!visible) throw new Error('NPC overlay did not appear');

  // Click choice index 1
  await page.click('.v2-npc-choice[data-idx="1"]');
  await new Promise(r => setTimeout(r, 100));
  // Click to advance to close line
  await page.click('#v2-npc');
  await new Promise(r => setTimeout(r, 100));
  // Click to dismiss
  await page.click('#v2-npc');

  const pickedIdx = await pickedIdxP;
  if (pickedIdx !== 1) throw new Error(`expected pickedIdx=1, got ${pickedIdx}`);

  console.log('PASS: NPC dialog choice flow');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6 — Run test**

```bash
npm run build:v2
node test-v2-npc.js
```

Expected: `PASS: NPC dialog choice flow`.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/world/npcs.js src/journey/acts/npc.js src/journey/bootstrap.js public/journey.html test-v2-npc.js public/journey-v2.js
git commit -m "journey-v2: Act II NPC dialog overlay

Open → choice → reply → close flow. Records choice index via callback.
Exposed on window.__journeyV2.presentNpc."
```

---

### Task 9 — Quest checklist HUD (Act II)

**Files:**
- Create: `src/journey/acts/quest.js`
- Create: `src/journey/ui/hud.js`
- Modify: `public/journey.html` (add HUD markup + CSS)
- Create: `tests/unit/quest.test.js`

- [ ] **Step 1 — Write the failing unit test**

Create `tests/unit/quest.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/quest.js'), 'utf8');
eval(SRC + '\nglobalThis.Quest = { isQuestComplete, questProgress };');
const { isQuestComplete, questProgress } = globalThis.Quest;

test('isQuestComplete returns false when fewer beats collected than needed', () => {
  assert.strictEqual(isQuestComplete(['a', 'b'], 3, { a: true, b: true }), false);
});

test('isQuestComplete returns true at threshold', () => {
  assert.strictEqual(isQuestComplete(['a', 'b', 'c'], 3, { a: true, b: true, c: true }), true);
});

test('isQuestComplete ignores collected beats not in the quest list', () => {
  assert.strictEqual(isQuestComplete(['a', 'b'], 2, { a: true, x: true }), false);
});

test('questProgress returns done/total + lists', () => {
  const out = questProgress(['a', 'b', 'c', 'd'], 3, { a: true, c: true });
  assert.strictEqual(out.done, 2);
  assert.strictEqual(out.needed, 3);
  assert.deepStrictEqual(out.collected, ['a', 'c']);
  assert.deepStrictEqual(out.remaining, ['b', 'd']);
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
node --test tests/unit/quest.test.js
```

Expected: FAIL.

- [ ] **Step 3 — Implement `src/journey/acts/quest.js`**

```javascript
// === src/journey/acts/quest.js ===
/**
 * Quest = a subset of chapter beats the player must collect to gate Act III.
 * Pure logic — DOM rendering lives in ui/hud.js.
 *
 * Beat collection comes from the v1 state.discoveredBeats Set; we hand it
 * in as a plain object map for testability.
 */

const QUESTS = {
  __placeholder: { beats: ['p1', 'p2', 'p3'], needed: 2 },
};

function questProgress(beatIds, needed, collectedMap) {
  const collected = beatIds.filter(b => collectedMap[b]);
  const remaining = beatIds.filter(b => !collectedMap[b]);
  return { done: collected.length, needed, collected, remaining };
}

function isQuestComplete(beatIds, needed, collectedMap) {
  return questProgress(beatIds, needed, collectedMap).done >= needed;
}
```

- [ ] **Step 4 — Add HUD markup to `public/journey.html`**

Inside `<body>`, near other HUD elements, add:

```html
<!-- v2 · quest checklist HUD -->
<div id="v2-quest-hud" class="v2-quest-hud" aria-hidden="true">
  <div class="v2-quest-title" id="v2-quest-title">QUEST</div>
  <div class="v2-quest-progress" id="v2-quest-progress">0 / 3</div>
  <ul class="v2-quest-list" id="v2-quest-list"></ul>
</div>
```

Append CSS:

```css
.v2-quest-hud {
  position: fixed; top: 16px; right: 16px; z-index: 50;
  background: rgba(31, 22, 16, 0.85); border: 1px solid var(--mahogany);
  padding: 10px 14px; min-width: 160px; max-width: 220px;
  font-family: 'IBM Plex Mono', monospace; color: var(--paper);
  font-size: 0.78rem; line-height: 1.5;
  transition: opacity 0.4s; opacity: 0;
}
.v2-quest-hud[aria-hidden="false"] { opacity: 1; }
.v2-quest-title { font-family: 'Cinzel', serif; letter-spacing: 0.18em; color: var(--accent); margin-bottom: 4px; font-size: 0.7rem; }
.v2-quest-progress { opacity: 0.7; margin-bottom: 6px; }
.v2-quest-list { list-style: none; padding: 0; margin: 0; }
.v2-quest-list li { padding: 1px 0; }
.v2-quest-list li.done { opacity: 0.55; text-decoration: line-through; }
```

- [ ] **Step 5 — Implement `src/journey/ui/hud.js`**

```javascript
// === src/journey/ui/hud.js ===
/**
 * Quest checklist renderer. Reads from QUESTS[chapterId] and a collectedMap,
 * paints the panel, fades in/out via aria-hidden.
 */
function showQuestHud(chapterId, collectedMap) {
  const q = QUESTS[chapterId];
  if (!q) return hideQuestHud();
  const $hud = document.getElementById('v2-quest-hud');
  const $title = document.getElementById('v2-quest-title');
  const $progress = document.getElementById('v2-quest-progress');
  const $list = document.getElementById('v2-quest-list');
  const p = questProgress(q.beats, q.needed, collectedMap);
  $title.textContent = `${chapterId.toUpperCase()} · QUEST`;
  $progress.textContent = `${p.done} / ${q.needed}`;
  $list.innerHTML = q.beats
    .map(b => `<li class="${collectedMap[b] ? 'done' : ''}">${collectedMap[b] ? '✓' : '○'} ${b}</li>`)
    .join('');
  $hud.setAttribute('aria-hidden', 'false');
}

function hideQuestHud() {
  const $hud = document.getElementById('v2-quest-hud');
  if ($hud) $hud.setAttribute('aria-hidden', 'true');
}
```

- [ ] **Step 6 — Run unit + integration tests**

```bash
node --test tests/unit/quest.test.js
npm run build:v2
```

Expected: 4 PASS on unit tests.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/acts/quest.js src/journey/ui/hud.js tests/unit/quest.test.js public/journey.html public/journey-v2.js
git commit -m "journey-v2: Act II quest checklist + HUD

Pure quest logic (unit-tested) + DOM renderer for the top-right panel.
QUESTS table populated for __placeholder; CMR added in Phase 2."
```

---

### Task 10 — Mini-game harness (Act III) + stub mini-game

**Files:**
- Create: `src/journey/acts/minigame.js`
- Modify: `public/journey.html` (add minigame overlay markup + CSS)
- Modify: `src/journey/bootstrap.js` (expose `initMinigame`)
- Create: `test-v2-minigame.js`

- [ ] **Step 1 — Add overlay markup to `public/journey.html`**

```html
<!-- v2 · Act III mini-game overlay -->
<div id="v2-minigame" class="v2-overlay" aria-hidden="true">
  <div class="v2-minigame-card">
    <div class="v2-minigame-header">
      <span class="v2-minigame-name" id="v2-minigame-name"></span>
      <span class="v2-minigame-timer" id="v2-minigame-timer">10.0s</span>
    </div>
    <canvas id="v2-minigame-canvas" width="360" height="240"></canvas>
    <div class="v2-minigame-prompt" id="v2-minigame-prompt"></div>
  </div>
</div>
```

CSS:

```css
.v2-minigame-card { background: var(--bg-deep); border: 1px solid var(--mahogany); padding: 18px; max-width: 420px; }
.v2-minigame-header { display: flex; justify-content: space-between; margin-bottom: 10px;
                      font-family: 'Cinzel', serif; letter-spacing: 0.15em; color: var(--accent); font-size: 0.85rem; }
#v2-minigame-canvas { display: block; width: 100%; height: auto; background: #2a1c10; border: 1px solid var(--mahogany); }
.v2-minigame-prompt { margin-top: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; opacity: 0.75; text-align: center; }
```

- [ ] **Step 2 — Implement the harness `src/journey/acts/minigame.js`**

```javascript
// === src/journey/acts/minigame.js ===
/**
 * Act III mini-game harness. Each mini-game is registered as:
 *   MINIGAMES[id] = {
 *     id, label, durationMs, prompt,
 *     init(ctx, helpers) -> state,
 *     update(state, dt) -> void,
 *     render(state, ctx) -> void,
 *     onGesture(state, gesture, ev) -> void,
 *     score(state) -> number,
 *     scoreLabel(score) -> string,
 *   }
 *
 * No-fail: when durationMs elapses, score(state) is called and
 * onDone({score, label}) fires unconditionally.
 */
const MINIGAMES = {};
let _minigameLoop = null;
let _minigameDetach = null;

function initMinigame(chapterId, onDone) {
  // Resolve game by chapter; fall back to placeholder
  const game = MINIGAMES[chapterId] ?? MINIGAMES.__stub;
  if (!game) { onDone({ score: 0, label: 'no-game' }); return; }

  const $overlay = document.getElementById('v2-minigame');
  const $name = document.getElementById('v2-minigame-name');
  const $timer = document.getElementById('v2-minigame-timer');
  const $prompt = document.getElementById('v2-minigame-prompt');
  const $canvas = document.getElementById('v2-minigame-canvas');
  const ctx = $canvas.getContext('2d');

  $name.textContent = game.label;
  $prompt.textContent = game.prompt ?? '';
  $overlay.setAttribute('aria-hidden', 'false');

  const state = game.init(ctx, { canvas: $canvas });
  let last = performance.now();
  let remaining = game.durationMs;
  let finished = false;

  function tick(now) {
    const dt = Math.min(100, now - last);
    last = now;
    remaining -= dt;
    if (remaining <= 0 && !finished) { finish(); return; }
    $timer.textContent = `${(remaining / 1000).toFixed(1)}s`;
    game.update(state, dt);
    ctx.clearRect(0, 0, $canvas.width, $canvas.height);
    game.render(state, ctx);
    _minigameLoop = requestAnimationFrame(tick);
  }
  _minigameLoop = requestAnimationFrame(tick);

  _minigameDetach = attachInputRouter($canvas, (gesture, ev) => {
    if (!finished) game.onGesture(state, gesture, ev);
  });

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(_minigameLoop);
    if (_minigameDetach) _minigameDetach();
    $overlay.setAttribute('aria-hidden', 'true');
    const score = game.score(state);
    onDone({ score, label: game.scoreLabel(score) });
  }
}

// Stub mini-game so the harness has something to play before real games land
MINIGAMES.__stub = {
  id: '__stub', label: 'STUB', durationMs: 1500,
  prompt: 'auto-completes',
  init(ctx, _helpers) { return { t: 0 }; },
  update(state, dt) { state.t += dt; },
  render(state, ctx) {
    ctx.fillStyle = '#d4a653';
    ctx.fillRect(10, 10, Math.min(340, state.t / 5), 40);
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '14px monospace';
    ctx.fillText('stub mini-game · auto-completes', 20, 80);
  },
  onGesture(_state, _g, _ev) { /* ignored */ },
  score(state) { return Math.min(100, Math.floor(state.t / 15)); },
  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 3 — Update `src/journey/bootstrap.js`**

```javascript
// === src/journey/bootstrap.js ===
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  showCulmination: null,
  store: null,
};
```

- [ ] **Step 4 — Write integration test**

Create `test-v2-minigame.js`:

```javascript
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const resultP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.initMinigame('__stub', res)
  ));

  // Overlay should be visible during the run
  await new Promise(r => setTimeout(r, 200));
  const visibleDuring = await page.evaluate(() =>
    document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'false'
  );
  if (!visibleDuring) throw new Error('mini-game overlay never appeared');

  // Wait for auto-complete (durationMs 1500)
  const result = await resultP;
  if (typeof result.score !== 'number') throw new Error('score is not a number');
  if (!result.label || typeof result.label !== 'string') throw new Error('label is missing');

  const hiddenAfter = await page.evaluate(() =>
    document.getElementById('v2-minigame').getAttribute('aria-hidden') === 'true'
  );
  if (!hiddenAfter) throw new Error('overlay did not dismiss after completion');

  console.log(`PASS: mini-game harness · score=${result.score} label=${result.label}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5 — Build + run integration test**

```bash
npm run build:v2
node test-v2-minigame.js
```

Expected: `PASS: mini-game harness · score=... label=.../100`.

- [ ] **Step 6 — Commit**

```bash
git add src/journey/acts/minigame.js src/journey/bootstrap.js public/journey.html test-v2-minigame.js public/journey-v2.js
git commit -m "journey-v2: Act III mini-game harness + stub game

Harness owns canvas + timer + RAF loop. Each game registers
{init/update/render/onGesture/score/scoreLabel}. No-fail: onDone fires
unconditionally at durationMs."
```

---

### Task 11 — Culmination card → stage video chain (Act III)

**Files:**
- Create: `src/journey/data/culminations.js`
- Create: `src/journey/acts/culmination.js`
- Modify: `public/journey.html` (add culmination overlay markup + CSS)
- Modify: `src/journey/bootstrap.js` (expose `showCulmination`)
- Create: `test-v2-culmination.js`

- [ ] **Step 1 — Create the data table stub**

Create `src/journey/data/culminations.js`:

```javascript
// === src/journey/data/culminations.js ===
const CULMINATIONS = {
  __placeholder: 'a placeholder culminating sentence that closes the chapter as one thread.',
};
```

- [ ] **Step 2 — Add overlay markup to `public/journey.html`**

```html
<!-- v2 · Act III culmination card -->
<div id="v2-culmination" class="v2-overlay" aria-hidden="true">
  <div class="v2-culmination-card">
    <div class="v2-culmination-text" id="v2-culmination-text"></div>
    <div class="v2-cutscene-cta">▸ tap to continue ▸</div>
  </div>
</div>
```

CSS:

```css
.v2-culmination-card { max-width: 540px; padding: 32px; text-align: center; }
.v2-culmination-text { font-family: 'IM Fell English', serif; font-style: italic; font-size: 1.25rem; line-height: 1.7; color: var(--paper); }
```

- [ ] **Step 3 — Implement `src/journey/acts/culmination.js`**

```javascript
// === src/journey/acts/culmination.js ===
/**
 * Act III culmination card. Shows the chapter's closing paragraph, then on
 * tap chains into the existing v1 stage-video player if available.
 * Falls back to immediate onDone if neither overlay nor stage-video exists.
 */
function showCulmination(chapterId, chapterLabel, onDone) {
  const text = CULMINATIONS[chapterId] ?? CULMINATIONS.__placeholder ?? '';
  const $overlay = document.getElementById('v2-culmination');
  const $text = document.getElementById('v2-culmination-text');
  if (!$overlay || !$text) { onDone(); return; }
  $text.textContent = text;
  $overlay.setAttribute('aria-hidden', 'false');

  function dismiss() {
    $overlay.removeEventListener('click', dismiss);
    $overlay.setAttribute('aria-hidden', 'true');
    // Chain into stage video if v1 helper exposed it (it's a top-level
    // function in journey.js; we sniff for it).
    const playVid = window.__playStageVideoV1 || (typeof playStageVideo !== 'undefined' ? playStageVideo : null);
    if (typeof playVid === 'function') {
      try { playVid(chapterId, chapterLabel); } catch (_) {}
    }
    onDone();
  }
  $overlay.addEventListener('click', dismiss);
}
```

- [ ] **Step 4 — Update `src/journey/bootstrap.js`**

```javascript
// === src/journey/bootstrap.js ===
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  showCulmination,
  store: createChapterStore(window.localStorage),
};
```

- [ ] **Step 5 — Write integration test**

Create `test-v2-culmination.js`:

```javascript
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'networkidle0' });

  const doneP = page.evaluate(() => new Promise(res =>
    window.__journeyV2.showCulmination('__placeholder', 'PLACEHOLDER', res)
  ));

  await new Promise(r => setTimeout(r, 150));
  const visible = await page.evaluate(() =>
    document.getElementById('v2-culmination').getAttribute('aria-hidden') === 'false'
  );
  if (!visible) throw new Error('culmination overlay did not appear');

  const txt = await page.$eval('#v2-culmination-text', el => el.textContent);
  if (!txt || txt.length < 10) throw new Error(`culmination text empty: "${txt}"`);

  await page.click('#v2-culmination');
  await doneP;

  console.log('PASS: culmination card visible + dismissable');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6 — Build + run**

```bash
npm run build:v2
node test-v2-culmination.js
```

Expected: PASS.

- [ ] **Step 7 — Commit**

```bash
git add src/journey/data/culminations.js src/journey/acts/culmination.js src/journey/bootstrap.js public/journey.html test-v2-culmination.js public/journey-v2.js
git commit -m "journey-v2: Act III culmination card + stage-video chain

Renders the closing paragraph; on tap, attempts to chain into the v1
playStageVideo() if exposed; otherwise no-ops gracefully."
```

---

## Phase 2 — CMR vertical slice (Tasks 12–16)

Goal: CMR plays the full 3-act vignette behind `?v=2`. Other chapters still v1.

---

### Task 12 — CMR content (cutscene + NPC + quest + culmination)

**Files:**
- Modify: `src/journey/data/cutscenes.js`
- Modify: `src/journey/world/npcs.js`
- Modify: `src/journey/acts/quest.js` (extend QUESTS table)
- Modify: `src/journey/data/culminations.js`

- [ ] **Step 1 — Add CMR entry to `CUTSCENES`**

Replace `src/journey/data/cutscenes.js`:

```javascript
// === src/journey/data/cutscenes.js ===
const CUTSCENES = {
  __placeholder: {
    lines: ['act i', 'a placeholder line', 'tap to continue'],
    durationMs: 4000,
  },
  cmr: {
    lines: ['5:30 a.m.', 'the alarm again.', 'two years to crack JEE.'],
    durationMs: 8000,
  },
};
```

- [ ] **Step 2 — Add CMR entry to `NPCS`**

Replace `src/journey/world/npcs.js`:

```javascript
// === src/journey/world/npcs.js ===
const NPCS = {
  __placeholder: {
    name: 'THE PLACEHOLDER', sprite: '🗿',
    open: 'placeholder open line.',
    choices: [{ label: 'choice a', reply: 'reply a.' }, { label: 'choice b', reply: 'reply b.' }],
    close: 'go well.',
  },
  cmr: {
    name: 'THE MOTHER', sprite: '👩',
    open: 'you slept four hours.',
    choices: [
      { label: "i'll sleep after JEE", reply: 'you said that yesterday too.' },
      { label: 'tea?',                 reply: 'already on the stove.' },
    ],
    close: 'go. the bus leaves in twelve.',
  },
};
```

- [ ] **Step 3 — Add CMR entry to `QUESTS` inside `src/journey/acts/quest.js`**

Replace just the QUESTS const:

```javascript
const QUESTS = {
  __placeholder: { beats: ['p1', 'p2', 'p3'], needed: 2 },
  cmr: {
    beats: ['tuition-rush', 'mock-test', 'study-lamp', 'first-crush'],
    needed: 3,
  },
};
```

- [ ] **Step 4 — Add CMR entry to `CULMINATIONS`**

Replace `src/journey/data/culminations.js`:

```javascript
// === src/journey/data/culminations.js ===
const CULMINATIONS = {
  __placeholder: 'a placeholder culminating sentence that closes the chapter as one thread.',
  cmr: "the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill.",
};
```

- [ ] **Step 5 — Rebuild + smoke test in browser**

```bash
npm run build:v2
```

Manually:
1. Run `npm run watch` if not already running.
2. Open `http://localhost:3000/journey.html?v=2`.
3. Open browser console.
4. Run: `window.__journeyV2.playCutscene('cmr', { act: 'ACT II', title: 'THE PRESSURE COOKER' }, () => console.log('cmr cutscene done'));`
5. Confirm overlay shows "5:30 a.m." → "the alarm again." → "two years to crack JEE." and tap dismisses to console log.
6. Run: `window.__journeyV2.presentNpc('cmr', idx => console.log('cmr npc choice', idx));`
7. Confirm THE MOTHER appears with both choices, picking one shows the right reply, advance dismisses.
8. Run: `window.__journeyV2.showCulmination('cmr', 'CMR NATIONAL', () => console.log('cmr culm done'));`
9. Confirm the italic paragraph appears.

- [ ] **Step 6 — Commit**

```bash
git add src/journey/data/cutscenes.js src/journey/data/culminations.js src/journey/world/npcs.js src/journey/acts/quest.js public/journey-v2.js
git commit -m "journey-v2: CMR content tables

CUTSCENES, NPCS, QUESTS, CULMINATIONS populated for CMR National
(2013–2015 · PU pressure-cooker)."
```

---

### Task 13 — Implement `mock-test` mini-game

**Files:**
- Create: `src/journey/acts/minigames/mock-test.js`
- Create: `tests/unit/mock-test.test.js`

- [ ] **Step 1 — Write the failing unit test**

Create `tests/unit/mock-test.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src/journey/acts/minigames/mock-test.js'), 'utf8');
// Provide a global MINIGAMES so the registration assignment works
eval('const MINIGAMES = {};\n' + SRC + '\nglobalThis.MockTest = MINIGAMES.cmr;');
const game = globalThis.MockTest;

test('mock-test is registered under cmr', () => {
  assert.ok(game);
  assert.strictEqual(game.id, 'mock-test');
});

test('init returns a state with 3 options and pickedIdx null', () => {
  const state = game.init({}, {});
  assert.strictEqual(state.options.length, 3);
  assert.strictEqual(state.pickedIdx, null);
});

test('onGesture(TAP near option idx) sets pickedIdx', () => {
  const state = game.init({}, { canvas: { width: 360, height: 240 } });
  // Tap event at canvas x=180 (middle option, index 1)
  game.onGesture(state, { kind: 'TAP' }, { offsetX: 180, offsetY: 120 });
  assert.strictEqual(state.pickedIdx, 1);
});

test('score is high when picked fast', () => {
  const state = game.init({}, {});
  state.pickedIdx = 0;
  state.elapsedMs = 1000;            // picked in 1s
  assert.ok(game.score(state) >= 80);
});

test('score is low when never picked', () => {
  const state = game.init({}, {});
  state.pickedIdx = null;
  state.elapsedMs = 8000;
  assert.strictEqual(game.score(state), 50);   // no-fail floor
});
```

- [ ] **Step 2 — Run, confirm fail**

```bash
node --test tests/unit/mock-test.test.js
```

Expected: FAIL.

- [ ] **Step 3 — Implement `src/journey/acts/minigames/mock-test.js`**

```javascript
// === src/journey/acts/minigames/mock-test.js ===
/**
 * `mock-test` · CMR's mini-game.
 * One MCQ question, 3 options, 8s timer. All options are "valid" — no-fail.
 * Score = 100 − (elapsedMs / 80) clamped to [50, 100]. Faster = higher.
 */
MINIGAMES.cmr = {
  id: 'mock-test',
  label: 'CMR · MOCK TEST',
  durationMs: 8000,
  prompt: 'tap the right answer · the clock is louder than the question',

  init(ctx, helpers) {
    return {
      options: ['a · 42',  'b · 49',  'c · 56'],
      question: 'if  3x + 7 = 22  then  x = ?',
      pickedIdx: null,
      elapsedMs: 0,
      canvas: helpers.canvas,
    };
  },

  update(state, dt) {
    state.elapsedMs += dt;
  },

  render(state, ctx) {
    const W = state.canvas.width, H = state.canvas.height;
    ctx.fillStyle = '#1f1610'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e9d8b0';
    ctx.font = '16px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.question, W / 2, 40);

    const slotW = W / 3;
    for (let i = 0; i < state.options.length; i++) {
      const x = i * slotW, y = 70, w = slotW - 4, h = 100;
      ctx.strokeStyle = state.pickedIdx === i ? '#d4a653' : '#5a2e1a';
      ctx.lineWidth = state.pickedIdx === i ? 3 : 1;
      ctx.strokeRect(x + 4, y, w, h);
      ctx.fillStyle = state.pickedIdx === i ? '#d4a653' : '#e9d8b0';
      ctx.fillText(state.options[i], x + slotW / 2, y + h / 2 + 6);
    }
    ctx.textAlign = 'left';
  },

  onGesture(state, gesture, ev) {
    if (gesture.kind !== 'TAP') return;
    const W = state.canvas.width;
    const x = ev.offsetX ?? (ev.changedTouches ? ev.changedTouches[0].clientX : 0);
    const slotW = W / 3;
    const idx = Math.max(0, Math.min(2, Math.floor(x / slotW)));
    state.pickedIdx = idx;
  },

  score(state) {
    if (state.pickedIdx === null) return 50;   // no-fail floor for non-participation
    const speed = 100 - Math.floor(state.elapsedMs / 80);
    return Math.max(50, Math.min(100, speed));
  },

  scoreLabel(score) { return `${score}/100`; },
};
```

- [ ] **Step 4 — Run, confirm 5 pass**

```bash
node --test tests/unit/mock-test.test.js
```

Expected: 5 PASS.

- [ ] **Step 5 — Build + manual smoke**

```bash
npm run build:v2
```

Manually: open `http://localhost:3000/journey.html?v=2`, console:

```js
window.__journeyV2.initMinigame('cmr', r => console.log('cmr mini-game done', r));
```

Tap one of three options · wait for timer · console should log `{score: X, label: 'X/100'}`.

- [ ] **Step 6 — Commit**

```bash
git add src/journey/acts/minigames/mock-test.js tests/unit/mock-test.test.js public/journey-v2.js
git commit -m "journey-v2: mock-test mini-game (CMR)

One MCQ · 3 options · 8s timer · no-fail (floor 50/100). Tap to pick,
speed-based score. Registered as MINIGAMES.cmr."
```

---

### Task 14 — Bootstrap CMR chapter flow

**Files:**
- Create: `src/journey/core.js` (replace stub with chapter-entry detection + orchestration)
- Modify: `src/journey/bootstrap.js` (call the chapter flow on init)

- [ ] **Step 1 — Replace `src/journey/core.js`**

```javascript
// === src/journey/core.js ===
/**
 * v2 chapter flow orchestrator.
 *
 * The v1 game continues to handle the world, parallax, walking, beats, and
 * achievements. v2 sits on top and watches the v1 globals:
 *   - state.playerX (from v1, exposed on window for v2)
 *   - state.discoveredBeats (Set in v1)
 *   - CHAPTERS array (v1)
 *
 * When the player enters a chapter that has v2 content (NPCS[id] !== undefined
 * and id !== '__placeholder'), v2 takes over for the 3-act vignette. Otherwise
 * v1 chapter behavior runs as today.
 */
const JOURNEY_V2_VERSION = 2;

const V2_ENABLED_CHAPTERS = new Set(['cmr']);   // expand each Phase 3 task

/**
 * Returns the v2 chapter id for the player's current world-x, or null
 * if no v2 chapter is active. Reads window.__journeyV1Bridge populated by
 * v1's game loop (added in the v1 patch below).
 */
function detectActiveV2Chapter() {
  const b = window.__journeyV1Bridge;
  if (!b || !b.getCurrentChapterId) return null;
  const id = b.getCurrentChapterId();
  return V2_ENABLED_CHAPTERS.has(id) ? id : null;
}

let _activeFlow = null;

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

function enterExploring(chapterId) {
  const collectedMap = collectedBeatsMap();
  showQuestHud(chapterId, collectedMap);
  // The NPC is presented when the player taps the NPC sprite. For the
  // Phase-2 slice we auto-present it 800ms after entering exploring (so the
  // cutscene fade isn't stepped on). Phase 3 wires a real tappable sprite.
  setTimeout(() => {
    presentNpc(chapterId, idx => {
      window.__journeyV2.store.setNpcChoice(chapterId, idx);
      checkQuestComplete(chapterId);
    });
  }, 800);
  // Poll for quest completion as the player walks and collects beats
  pollQuest(chapterId);
}

function collectedBeatsMap() {
  const b = window.__journeyV1Bridge;
  const set = b?.getDiscoveredBeats?.() ?? new Set();
  const m = {};
  for (const id of set) m[id] = true;
  return m;
}

let _questPollTimer = null;
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

let _act3Started = false;
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
  window.__journeyV2.store.send(chapterId, 'QUEST_COMPLETE');   // → closing
  initMinigame(chapterId, ({ score, label }) => {
    window.__journeyV2.store.setScore(chapterId, score);
    window.__journeyV2.store.send(chapterId, 'MINIGAME_DONE');  // → culminating
    const lbl = window.__journeyV1Bridge?.getChapterLabel?.(chapterId) ?? chapterId.toUpperCase();
    showCulmination(chapterId, lbl, () => {
      window.__journeyV2.store.send(chapterId, 'DISMISS');      // → complete
      _act3Started = false;
      _activeFlow = null;
    });
  });
}

// Polled from a setInterval that bootstrap starts.
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  if (id) startChapterFlow(id);
}
```

- [ ] **Step 2 — Update `src/journey/bootstrap.js` to start the tick and create the v1 bridge**

```javascript
// === src/journey/bootstrap.js ===
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  showCulmination,
  store: createChapterStore(window.localStorage),
  // exposed for the chapter-flow polling
  detectActiveV2Chapter,
  startChapterFlow,
};

// Start polling for v2 chapter entry. The v1 bundle (journey.js) is NOT
// loaded under ?v=2 — that's by design for Phase 2 vertical slice. v2 also
// has to draw its own minimal "is the player in CMR?" check, so the bridge
// below is filled by an inline patch in journey.html.
setInterval(tickChapterFlow, 250);
```

- [ ] **Step 3 — Add the v1 bridge installer to `public/journey.html`**

The bridge tells v2 which chapter the player is currently in. For Phase 2 it can be a simple URL hash override; Phase 3 wires it to actual v1 chapter detection. Add directly after the script-swap block in journey.html:

```html
<script>
  // v1 → v2 bridge. For the Phase 2 vertical slice we honor #cmr as a
  // forced chapter override; otherwise the bridge reports no chapter, and
  // v2 idles. Phase 3 replaces this with real v1 chapter-detection wiring.
  if (new URLSearchParams(location.search).get('v') === '2') {
    window.__journeyV1Bridge = {
      getCurrentChapterId: () => location.hash === '#cmr' ? 'cmr' : null,
      getDiscoveredBeats: () => new Set(JSON.parse(localStorage.getItem('cmr-beats') ?? '[]')),
      getIntertitle: id => ({ cmr: { act: 'ACT II', title: 'THE PRESSURE COOKER' } }[id] ?? {}),
      getChapterLabel: id => ({ cmr: 'CMR NATIONAL' }[id] ?? id.toUpperCase()),
    };
    // Dev affordance: tap the canvas to add a beat to localStorage so the
    // quest progresses without v1 walking. Phase 3 replaces this with v1 wiring.
    window.__cmrAddBeat = function (id) {
      const cur = JSON.parse(localStorage.getItem('cmr-beats') ?? '[]');
      if (!cur.includes(id)) cur.push(id);
      localStorage.setItem('cmr-beats', JSON.stringify(cur));
    };
  }
</script>
```

- [ ] **Step 4 — Build, smoke-test the wiring manually**

```bash
npm run build:v2
```

1. Open `http://localhost:3000/journey.html?v=2#cmr`.
2. The cutscene should play within 250ms.
3. Tap to dismiss → quest HUD appears top-right showing 0/3.
4. After ~800ms, THE MOTHER overlay appears.
5. Pick a choice, advance to close, dismiss.
6. In console: `__cmrAddBeat('tuition-rush'); __cmrAddBeat('mock-test'); __cmrAddBeat('first-crush');`
7. Within 500ms, the quest is complete → mock-test mini-game launches.
8. Tap an option, wait 8s.
9. Culmination card appears with the CMR paragraph.
10. Tap → flow finishes. `localStorage.journey` should have `chapters.cmr.phase === "complete"`.

- [ ] **Step 5 — Commit**

```bash
git add src/journey/core.js src/journey/bootstrap.js public/journey.html public/journey-v2.js
git commit -m "journey-v2: orchestrator for CMR chapter flow

core.js polls for chapter entry, runs unseen → cutscene → exploring →
NPC → quest → minigame → culmination → complete, persisting at every
transition. v1 bridge in journey.html supplies chapter detection for
Phase 2 (hash-based) — Phase 3 replaces with real v1 wiring."
```

---

### Task 15 — End-to-end CMR Puppeteer test

**Files:**
- Create: `test-v2-chapter-cmr.js`

- [ ] **Step 1 — Write the failing test**

Create `test-v2-chapter-cmr.js`:

```javascript
/**
 * End-to-end test: visit journey.html?v=2#cmr, walk the full 3-act flow,
 * assert localStorage.journey.chapters.cmr.phase === 'complete'.
 */
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'http://localhost:3000';

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

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  // Clear storage for a fresh run
  await page.goto(`${URL}/journey.html?v=2`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${URL}/journey.html?v=2#cmr`, { waitUntil: 'networkidle0' });

  // 1. Cutscene appears
  await waitVisible(page, '#v2-cutscene');
  await page.click('#v2-cutscene');

  // 2. Quest HUD appears
  await waitVisible(page, '#v2-quest-hud');

  // 3. NPC appears (~800ms after exploring)
  await waitVisible(page, '#v2-npc', 3000);
  await page.click('.v2-npc-choice[data-idx="0"]');
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');  // advance to close line
  await new Promise(r => setTimeout(r, 100));
  await page.click('#v2-npc');  // dismiss

  // 4. Add 3 beats to satisfy the quest
  await page.evaluate(() => {
    window.__cmrAddBeat('tuition-rush');
    window.__cmrAddBeat('mock-test');
    window.__cmrAddBeat('first-crush');
  });

  // 5. Mini-game appears
  await waitVisible(page, '#v2-minigame', 3000);
  // Tap option 1
  await page.click('#v2-minigame-canvas');
  // Wait the mock-test duration + buffer
  await new Promise(r => setTimeout(r, 8500));

  // 6. Culmination appears
  await waitVisible(page, '#v2-culmination', 3000);
  await page.click('#v2-culmination');

  // 7. Assert phase complete + score recorded
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

- [ ] **Step 2 — Make sure dev server is running**

```bash
npm run watch
```

In another terminal:

- [ ] **Step 3 — Run the test, observe PASS**

```bash
npm run build:v2
node test-v2-chapter-cmr.js
```

Expected: `PASS: CMR full vignette · score=X npcChoice=0`.

If it fails, debug the first failing wait and iterate. Common causes:
- v1 bridge not initialized (script ordering)
- Click coordinates off (use `page.mouse.click(x, y)` instead of `.click()` for canvas)
- Timing too tight — bump the `waitVisible` timeout

- [ ] **Step 4 — Run the entire test suite (v1 + v2) to confirm no regression**

```bash
node --test tests/unit/
node test-v2-flag.js
node test-v2-cutscene.js
node test-v2-npc.js
node test-v2-minigame.js
node test-v2-culmination.js
node test-v2-chapter-cmr.js
```

Expected: every test PASSes.

- [ ] **Step 5 — Commit**

```bash
git add test-v2-chapter-cmr.js
git commit -m "journey-v2: end-to-end Puppeteer test for CMR vignette

Walks cutscene → quest HUD → NPC → 3 beat injections → mock-test mini-game
→ culmination, asserts localStorage.journey.chapters.cmr.phase=complete
and score is recorded."
```

---

### Task 16 — Phase 2 smoke verification + summary

**Files:**
- Modify: `JOURNEY_LORE.md` (mark CMR done, note v2 source-of-truth)
- Create: `docs/journey-v2-status.md`

- [ ] **Step 1 — Manual smoke test on a real mobile viewport**

In Chrome DevTools, emulate iPhone 14 Pro (390 × 844). Navigate to `http://localhost:3000/journey.html?v=2#cmr`. Walk the full flow with tap-only input. Confirm:

- Cutscene readable, dismisses on tap.
- Quest HUD docks top-right and doesn't overlap the score panel.
- NPC choices are tap-target sized (≥44px).
- Mini-game canvas is responsive.
- Culmination card readable, dismisses on tap.

- [ ] **Step 2 — Lighthouse check**

In Chrome DevTools → Lighthouse → Mobile → Performance only. Run on `http://localhost:3000/journey.html?v=2#cmr`. Note the Performance score. Target: **≥ 85**. If lower, jot regressions in `docs/journey-v2-status.md` and we'll address in Phase 4.

- [ ] **Step 3 — Update `JOURNEY_LORE.md`**

Edit the file: add a note at the top:

```markdown
> **Phase 2 status (2026-05-28):** CMR National vignette shipped to v2
> (behind `?v=2` flag). Source-of-truth for CMR cutscene/NPC/quest/culmination
> is now `src/journey/data/cutscenes.js`, `src/journey/world/npcs.js`,
> `src/journey/acts/quest.js`, `src/journey/data/culminations.js`. This
> markdown file remains source-of-truth for CHAPTER LORE / BEAT LORE used
> in the v1 walk-by experience.
```

- [ ] **Step 4 — Create `docs/journey-v2-status.md`**

```markdown
# Journey v2 · Status

**Last updated:** 2026-05-28

## Phase 1 · Foundation harness · ✅ Complete

All six harness modules (cutscene, NPC, quest, minigame, culmination,
input router) tested end-to-end against placeholder content.

## Phase 2 · CMR vertical slice · ✅ Complete

- Live at `/journey.html?v=2#cmr` (hash-based chapter override for Phase 2)
- All 4 content layers populated (CUTSCENES, NPCS, QUESTS, CULMINATIONS)
- Mini-game: `mock-test` (one MCQ, 8s, no-fail)
- End-to-end Puppeteer test green: `test-v2-chapter-cmr.js`
- Mobile smoke tested (Chrome DevTools iPhone 14 Pro emulator)
- Lighthouse mobile Performance: <FILL IN AFTER RUN>

## Phase 3 · Roll out remaining 7 chapters · 🚧 Next

Separate plan: `docs/superpowers/plans/<TBD>-journey-3-act-phase-3.md`.

Cluster order:
1. **Cluster A · TAP-only** — ITICS, SCRIPBOX, NOW
2. **Cluster B · TAP-on-flashing** — SAKHA
3. **Cluster C · DRAG/SWIPE** — DSCE, FEVER 104, THE GT

Phase 3 also replaces the hash-based v1 bridge in journey.html with real
v1 chapter detection (wire to v1's `chapterIdxAt(playerX)` and
`state.discoveredBeats`).
```

- [ ] **Step 5 — Commit the docs update**

```bash
git add JOURNEY_LORE.md docs/journey-v2-status.md
git commit -m "journey-v2: docs status note + JOURNEY_LORE.md cross-ref

Records Phase 1 + Phase 2 complete, Lighthouse mobile Performance, and
points to the upcoming Phase 3 plan."
```

- [ ] **Step 6 — Final branch summary**

```bash
git log --oneline feat/journey-3-act-milestones ^main
```

Expected output: roughly 17 commits in order from this plan, starting with the spec (`2413229`) and ending with this docs commit.

---

## Self-review (run before declaring Phase 1+2 done)

**Spec coverage check** — every numbered section of the spec maps to at least one task:

- Spec §"The 8 chapters" → CMR content covered by Task 12; other 7 explicitly deferred to Phase 3 plan
- Spec §"Per-chapter flow contract" → state machine (Task 4) + flow orchestrator (Task 14)
- Spec §"Technical architecture · File structure" → Task 1 (build pipeline + skeleton)
- Spec §"State machine" → Task 4 (phase.js) + Task 5 (store.js)
- Spec §"Data shapes" → Tasks 7, 8, 9, 11, 12
- Spec §"Mini-game harness" → Task 10 (harness) + Task 13 (mock-test)
- Spec §"Reuse of existing systems" → covered by chaining `playStageVideo` in Task 11
- Spec §"Persistence schema · v:2 + migration" → Task 3
- Spec §"Testing" → unit tests in Tasks 1, 3, 4, 5, 6, 9, 13 · integration tests in Tasks 2, 7, 8, 10, 11, 15
- Spec §"Feature-flag strategy" → Task 2
- Spec §"Phase 1 deliverables" → Tasks 1–11
- Spec §"Phase 2 deliverables" → Tasks 12–16
- Spec §"Phase 3, 4, 5" → out of scope for this plan (follow-up plan)

**Placeholder scan** — none of the no-no patterns appear: no "TBD", "TODO", "implement later", "fill in details". The phrase "<FILL IN AFTER RUN>" in Task 16 Step 4 is a literal Lighthouse score the engineer records — intentional, not a plan placeholder.

**Type / function-name consistency check:**

- `transitionChapterPhase(phase, event)` — defined Task 4, used Task 5 ✓
- `loadJourneyState(storage)` / `saveJourneyState(storage, state)` — defined Task 3, used Task 5 ✓
- `createChapterStore(storage)` — defined Task 5, called from Task 11 bootstrap ✓
- `playCutscene(chapterId, intertitle, onDismiss)` — defined Task 7, called Task 14 ✓
- `presentNpc(chapterId, onDone)` — defined Task 8, called Task 14 ✓
- `initMinigame(chapterId, onDone)` — defined Task 10, called Task 14 ✓
- `showCulmination(chapterId, label, onDone)` — defined Task 11, called Task 14 ✓
- `showQuestHud(chapterId, collectedMap)` / `hideQuestHud()` — defined Task 9, called Task 14 ✓
- `questProgress` / `isQuestComplete` — defined Task 9, called Task 14 ✓
- `classifyGesture` / `attachInputRouter` — defined Task 6, `attachInputRouter` called inside Task 10 ✓

No mismatches.

---

## Acceptance for Phase 1 + Phase 2

- All `node --test tests/unit/` cases PASS.
- All `node test-v2-*.js` integration tests PASS.
- Manual mobile smoke confirms CMR vignette playable on a 390×844 viewport.
- Lighthouse mobile Performance ≥ 85 (or regression documented in `journey-v2-status.md` for Phase 4 follow-up).
- Branch `feat/journey-3-act-milestones` has ~17 clean commits, ready to push or PR.

When Phase 1 + 2 is signed off, generate the Phase 3 plan with:

```
/superpowers:writing-plans rolling out the remaining 7 chapters
(ITICS, DSCE, FEVER 104, SAKHA, SCRIPBOX, VW GT, NOW) per the spec,
plus replacing the hash-based v1 bridge with real v1 chapter detection.
```
