# Journey · 3-Act Milestones · Design

**Date:** 2026-05-28
**Status:** Draft for user review
**Target:** `public/journey.html` (live at `pranavjagadish.com/journey`)
**Branch (proposed):** `feat/journey-3-act-milestones`

---

## Summary

Today the journey page is a side-scroller where the player walks past clickable lore beats. Each chapter is a passive scene with no shape — visit beats in any order, read text, leave. The feature is "the walk."

This redesign reshapes every milestone into an interactive **3-act vignette**:

1. **Act I · Open** (~8s) — a brief cutscene punctuates chapter entry with one tap-to-advance.
2. **Act II · Explore** (~25s) — the player meets a named archetype NPC, plays a brief dialog with one flavor-choice, and collects 3–5 beats as a quest checklist.
3. **Act III · Close** (~12s) — a no-fail mini-game flavored to the era, a culminating paragraph that retells the chapter as one story, and the existing stage video plays.

Total per-chapter time budget: **~45 seconds** main path · 2–3 minutes if the player reads everything. 8 chapters × ~1 minute ≈ **~10 minutes of "main path" content** across the journey.

The redesign ships behind a `?v=2` query-string flag so the live journey stays untouched until cutover. Estimated total effort: **~3 weeks of focused part-time work** for Phases 1–4 (foundation, vertical slice, rollout, cutover), with an optional Phase 5 for after-launch polish.

---

## Goals & non-goals

### Goals

- Make every milestone feel like a **story moment** with a beginning, middle, and end.
- Preserve everything the current journey already does well: parallax world, walking locomotion, existing beats, landmark lore, achievement toasts, stage videos, per-chapter ambient audio.
- Keep the **RDR / Cinzel / IM Fell English / sepia** aesthetic — every new layer extends the existing visual language.
- Mobile-first: every input is a single tap, hold, or swipe. No chords, no precise pixels.
- **No-fail** gameplay. Mini-games are taste, never gates. Recruiters never get stuck.
- Ship incrementally, behind a feature flag, with a vertical slice that proves the model before scaling.

### Non-goals

- No multiplayer, no real-time anything, no backend writes during the main flow (Phase 5's leaderboard is optional and isolated).
- No game-over states, retry screens, lives, or stamina mechanics.
- No procedural content. All 8 cutscenes, 8 NPC dialogs, 8 mini-games, 8 culminations are hand-authored.
- No changes to the main `index.html` landing page, the resume PDF flow, the MCP page, or the notification API Worker.
- No changes to existing beat/landmark click interactions — they remain as-is.

---

## Creative pillars

These choices were made during brainstorming and shape every downstream decision.

1. **Full 3-act vignette per chapter** — every milestone gets all four layers (cutscene + NPC + quest + mini-game + culmination). No chapter is "lighter" than another.
2. **Stylized archetypes** — NPCs are not real people with real names. They are capital-letter archetypes (`THE MOTHER`, `THE MENTOR`, `THE CONDUCTOR`) in the fairy-tale register that matches the existing RDR/sepia aesthetic. Reader projects themselves into the relationships.
3. **No-fail score-as-flavor** — mini-games always pass. Score becomes an end-card stat (`"FEVER 104 · MIX · 78/100"`), never a gate. Dialog choices change *what* the archetype says, never *whether* the player moves forward.

---

## The 8 chapters

For each chapter: the NPC archetype, the mini-game mechanic, and the culminating paragraph.

### I · ITICS — until 2013, primary school

- **NPC** · `THE FIRST FRIEND` — "you missed the bus again." Choices: `"ran the whole way"` / `"took an auto"`.
- **Quest** · collect 3 of: football-match · cricket-match · sports-day · assembly-stage.
- **Mini-game** · `kick-football` — timing bar, tap when the arrow hits center, ball arcs into the goal. Score = closeness to dead center.
- **Culmination** · *"the years that taught you how to lose without breaking. cricket whites, scuffed knees, the morning bell that never asked twice."*

### II · CMR NATIONAL — 2013–2015, PU pressure-cooker

- **NPC** · `THE MOTHER` — "you slept four hours." Choices: `"i'll sleep after JEE"` / `"tea?"`.
- **Quest** · collect 3 of: tuition-rush · mock-test · study-lamp · first-crush.
- **Mini-game** · `mock-test` — one MCQ, 8s timer, 3 options, all answers "valid". Score = how fast you decided.
- **Culmination** · *"the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill."*

### III · D.S.C.E. — 2015–2019, mechanical engineering

- **NPC** · `THE TRIPLE-RIDER` — "you walking again?" Choices: `"saving bus fare"` / `"lost my pass"`.
- **Quest** · collect 3 of: bosch-intern · abb-intern · fest-stage · convocation.
- **Mini-game** · `CAD-snap` — drag 3 mechanical parts into their slots, 10s timer, auto-snap if close. Score = how few overshoots.
- **Culmination** · *"four years of triples and three-bus commutes. you didn't graduate top of class. you graduated knowing what real work felt like before anyone paid you for it."*

### Interlude · FEVER 104 FM — Mar–May 2019, radio internship

- **NPC** · `THE CONDUCTOR` — "feel the room first. then the levels." Choices: `"still hearing the bus outside"` / `"ready"`.
- **Quest** · collect 3 of: headphones · script-binder · sound-engineer · trainee-cert.
- **Mini-game** · `live-mix` — 3 vertical faders, swipe up/down to match a target curve, 10s. Score = how close the curve matches.
- **Culmination** · *"three months in a soundproof room. you learned that a producer's whole craft is silence — choosing what NOT to play, what to fade, what to ride. everything later is a version of this."*

### IV · SAKHA GLOBAL — Jul 2019 – Sep 2022, first job

- **NPC** · `THE TECH LEAD` — "five interviews. tell me about the last one." Choices: `"ran out of time"` / `"over-prepared the wrong part"`.
- **Quest** · collect 3 of: interview-day · first-paycheck · wfh-covid · late-night-coding.
- **Mini-game** · `standup-bingo` — a 3×3 grid of standup phrases flash; tap them as they appear, 10s. Score = how many you caught.
- **Culmination** · *"three years and one pandemic. you bought a watch for dad and a saree for mum from your first paycheck. by the time covid ended you had shipped enough PRs that the team's git log read like your handwriting."*

### V · SCRIPBOX — Sep 2022 – present, AI / MCP

- **NPC** · `THE PEER` — "show me the MCP protocol again." Choices: `"stdio json-rpc"` / `"it's simpler than it sounds"`.
- **Quest** · collect 3 of: pr-review · anthropic-catalog · claude-code · whiteboard · anthropic-talk.
- **Mini-game** · `debug-the-PR` — 4 lines of code, tap the one with the bug, all answers "valid". Score = which line and how fast.
- **Culmination** · *"the catalog page that wouldn't stop reloading. you sent the link to four people who never asked. for the first time the work didn't just pay — it was seen by a name you'd only ever read in papers."*

### VI · THE GT — Nov 16, 2025, VW Virtus delivery

- **NPC** · `THE SALESMAN` — "thirty-five minutes on the ORR sold this car." Choices: `"i knew at the second roundabout"` / `"the turbo did"`.
- **Quest** · collect all 4: test-drive · documents-signing · keys-handover · first-drive-out.
- **Mini-game** · `parallel-park` — swipe left/right to steer, 10s, nudge between two cones. Score = how few wall-touches.
- **Culmination** · *"1.5 TSI · turbo · november 16. ten years of saving became one signature. the salesperson clapped. you drove out with the garland still on the bonnet and three lefts of empty road ahead."*

### Epilogue · NOW — 2026 – present

- **NPC** · `THE SELF · FUTURE` — "still here?" Choices: `"always"` / `"for now"`.
- **Quest** · collect all 4: morning-routine · code-flow · anthropic-goal · forward-horizon.
- **Mini-game** · `type-the-future` — a 4-letter word shown on screen, tap the keys in order. Pure rhythm, no skill. Score = streak.
- **Culmination** · *"morning coffee · terminal warmth · two hours that feel like ten minutes. the day belongs to whoever claims the first hour. you're claiming yours."*

---

## Per-chapter flow contract

When a player walks into a chapter for the first time:

| Stage | Trigger | Duration | Input | Skippable |
|---|---|---|---|---|
| **Act I cutscene** | `playerX` enters chapter band (`chapter.x ± 200`) | ~8s | tap to advance | hold-walk gesture |
| **Act II explore** | cutscene dismissed | ~25s | walk, tap NPC, tap beats | always |
| **Act II NPC encounter** | player tap on NPC sprite | ~6s | tap choice | dismiss button |
| **Act III mini-game** | quest complete (NPC + 3+ beats) | ≤10s | TAP / DRAG / SWIPE-V / SWIPE-H | hold-walk gesture |
| **Act III culmination** | mini-game `onComplete` | until tap | tap to advance | tap to advance |
| **Stage video** | culmination dismissed | existing | tap / ESC | existing |

**Re-entry behavior** — when the player re-enters a chapter where `phase === "complete"`:

- Act I cutscene is **skipped** (intertitle still flashes briefly).
- NPC remains tappable, but their open line is replaced with a "we already spoke" variant.
- Beats and landmarks are clickable as today.
- Mini-game becomes **medal mode** — optional replay surfaces from a small ◆ icon in the HUD; existing score is preserved unless beaten.
- Culmination card is reachable via a "READ AGAIN" link in the chapter's end-card.

---

## Technical architecture

### File structure — author multi-file, ship single-file

`public/journey.js` is already ~9.3k lines. Inline additions would push it past 14k. The build splits sources at author time and concatenates them at build time so GitHub Pages still serves one file.

```
src/journey/
├── core.js              · canvas, game loop, fitCanvas, state (existing logic)
├── world/
│   ├── chapters.js      · CHAPTERS, CHAPTER_LORE, CHAPTER_INTERTITLES, CHAPTER_BLOOMS
│   ├── beats.js         · BEATS array (existing)
│   ├── landmarks.js     · SKYLINE, BRIDGES, LANDMARK_LORE (existing)
│   └── npcs.js          · NEW · NPC archetypes per chapter
├── acts/
│   ├── cutscene.js      · NEW · Act I player (tap-to-advance, line cards)
│   ├── npc.js           · NEW · Act II NPC encounter (dialog tree, choice → reply)
│   ├── quest.js         · NEW · Act II quest tracker (checklist HUD, gate to Act III)
│   ├── minigame.js      · NEW · Act III harness + 8 implementations
│   └── culmination.js   · NEW · Act III paragraph card → stage video chain
├── ui/
│   ├── hud.js           · existing achievement toasts + new quest checklist
│   └── input.js         · NEW · unified tap/hold/swipe router (mobile-first)
└── audio.js             · existing WebAudio + per-chapter ambient

build.js                 · NEW · concat src/journey/**/*.js → public/journey-v2.js
package.json             · update `build` script
```

The build script is plain Node, no bundler dependency. Order matters (core → data → acts → UI); it follows a manifest array in `build.js`.

### Per-chapter state machine

Each chapter walks through 5 phases. Phase is persisted in `localStorage` so re-entry skips ahead.

```
unseen
  │ player walks into chapter.x ± 200
  ▼
cutscene  ──tap─►  exploring
                    │ NPC.spoken && quest.completed
                    ▼
                  closing  ──minigame.onComplete─►  culminating
                                                      │ tap
                                                      ▼
                                                    video  ──onended─►  complete
```

Re-entry: `unseen` → fresh run · all other phases → `exploring` (skip cutscene, NPC re-clickable, mini-game in medal mode).

### Data shapes

Four new content tables, all keyed by chapter id.

```js
const CUTSCENES = {
  cmr: {
    lines: ["5:30 a.m.", "the alarm again.", "two years to crack JEE."],
    durationMs: 8000,
  }, // ... 7 more
};

const NPCS = {
  cmr: {
    name: "THE MOTHER",
    sprite: "👩",
    open: "you slept four hours.",
    choices: [
      { label: "i'll sleep after JEE", reply: "you said that yesterday too." },
      { label: "tea?",                  reply: "already on the stove." },
    ],
    close: "go. the bus leaves in twelve.",
  }, // ... 7 more
};

const MINIGAMES = {
  cmr: {
    id: "mock-test",
    durationMs: 8000,
    init(ctx, onComplete) { /* ... */ },
    update(dt) { /* ... */ },
    render(ctx) { /* ... */ },
    onInput(event) { /* ... */ },
    scoreLabel: (score) => `${score}/100`,
  }, // ... 7 more
};

const CULMINATIONS = {
  cmr: "the year you stopped sleeping. you didn't crack JEE. you also didn't break. that turned out to be the more useful skill.",
  // ... 7 more
};
```

### Mini-game harness — one interface, 8 implementations

Every mini-game is a `{ id, durationMs, init, update, render, onInput, scoreLabel }` bundle. The main game loop hands it the canvas context + dt; the mini-game owns the screen for its 8–10s. When the timer ends, `onComplete({ score, label })` always fires — no game-over branches.

Mobile input map (one gesture per mini-game):

| Mini-game | Gesture |
|---|---|
| kick-football | TAP (timing) |
| mock-test | TAP one of 3 (choice) |
| CAD-snap | DRAG (3 parts to slots) |
| live-mix | SWIPE VERTICAL (3 faders) |
| standup-bingo | TAP flashing cards (3×3 grid) |
| debug-the-PR | TAP one of 4 lines (choice) |
| parallel-park | SWIPE HORIZONTAL (steer) |
| type-the-future | TAP letters in order (rhythm) |

### Reuse of existing systems

These already work and are not re-implemented:

- **Achievement toasts** — existing `state.achievements` Set + `achQueue` system. Each NPC encounter, mini-game completion, and culmination emits one toast.
- **Stage videos** — existing `playStageVideo()` at `public/journey.js:1899`. Culmination card chains into it on dismiss instead of firing 1600ms after chapter collect (current behavior).
- **Per-chapter ambient audio** — existing `chapterAudioBoot()` / `chapterAudioTick()`. Master gain ducks during cutscene and mini-game, restores after culmination.
- **Particles + screen-shake** — existing `burstParticles()` / `shake()`. Punctuate mini-game success and culmination card-in.
- **Reduced-motion mode** — existing flag respected. Cutscene becomes a single static card; mini-game timers doubled.
- **Landmark + beat clicks** — unchanged. The Act II quest checklist references existing beat IDs; landmarks remain free-to-click ambient lore.

### Persistence schema

```js
localStorage.journey = JSON.stringify({
  v: 2,                                              // bump when schema breaks
  playerX, vehicle, collected, achievements, discoveredBeats,   // existing v:1 fields
  chapters: {                                        // NEW in v:2
    itics: { phase: "complete", score: 78, npcChoice: 0 },
    cmr:   { phase: "exploring", score: null, npcChoice: null },
    // ...
  },
});
```

**Migration from `v:1`** — on load, if stored `v` is missing or `1`, build a `chapters` map where every chapter in `collected` is back-filled with `{ phase: "complete", score: null, npcChoice: null }`, then write back with `v: 2`. Existing visitors keep their progress.

### Testing

The 10 existing root `test-*.js` Puppeteer files cover walking, mobile, intro, ghost-text, reduced-motion. Add:

- `test-cutscene.js` — enters a chapter, asserts cutscene plays, tap dismisses
- `test-npc-dialog.js` — approaches NPC, dialog opens, choice records to localStorage
- `test-quest-checklist.js` — HUD shows X/Y, completion gates Act III
- `test-minigames.js` — loops all 8, asserts timer + completion + score in valid range
- `test-replay.js` — re-enters completed chapter, asserts cutscene skipped, medal mode active
- `test-chapter-cmr.js` — full end-to-end vignette for CMR (the vertical slice)

---

## Rollout plan

### Feature-flag strategy

`journey.html` loads either `journey.js` (v1, current) or `journey-v2.js` (new) based on `?v=2` in the URL. v2 is built into a parallel file so v1 stays untouched. Share `pranavjagadish.com/journey?v=2` to test. Cutover replaces v1 in Phase 4.

### Phase 1 — Foundation harness · 4–6 days

All framework, no chapter content. The harness can play a placeholder cutscene → placeholder NPC → placeholder mini-game → placeholder culmination for one chapter, with zero real content wired.

- Build pipeline (`build.js` + `package.json` `build` script).
- Phase state machine + localStorage `v:2` schema + v:1 migration.
- Cutscene player (Act I) — empty content table, renderer + tap-to-advance + reduced-motion wired.
- NPC dialog overlay (Act II) — 4-line dialog engine + choice → reply branch, no NPCs yet.
- Quest checklist HUD (Act II) — top-right docked panel reading `state.collected`.
- Mini-game harness (Act III) — interface + timer + score panel, no games yet.
- Culmination card → stage video chain (Act III).
- Unified input router (TAP / DRAG / SWIPE-V / SWIPE-H · mobile + keyboard).
- Framework-only Puppeteer test (`test-harness.js`).

### Phase 2 — Vertical slice · CMR end-to-end · 2–3 days

Prove the model on one chapter before scaling. CMR is the slice because its cutscene material is the strongest (5:30am, mom, JEE), its mini-game is the simplest (one MCQ), and its 4 beats are already written.

- Fill `CUTSCENES.cmr`, `NPCS.cmr`, `MINIGAMES.cmr`, `CULMINATIONS.cmr`.
- Implement `mock-test` mini-game.
- Re-record CMR stage video if framing changed (likely not needed).
- One end-to-end Puppeteer test (`test-chapter-cmr.js`).
- Ship behind `?v=2` · live with v1 chapters everywhere else, only CMR upgraded.

### Phase 3 — Roll out remaining 7 chapters · 7–10 days

Clustered by mini-game implementation complexity.

- **Cluster A · TAP-only** (~1 day each): ITICS kick-football · SCRIPBOX debug-the-PR · NOW type-the-future.
- **Cluster B · TAP-on-flashing** (~1 day): SAKHA standup-bingo.
- **Cluster C · DRAG / SWIPE** (~1.5 days each): DSCE CAD-snap · FEVER 104 live-mix · THE GT parallel-park.

One Puppeteer test per chapter (re-uses `test-chapter-cmr.js` template). Each ships behind the same `?v=2` flag for incremental visitor testing.

### Phase 4 — Cutover + polish · 2–3 days

- Replace `public/journey.js` with the v2 bundle · delete v1 sources.
- Remove `?v=2` flag from `journey.html`.
- Update `public/social-share.jpg` to show the new HUD.
- Update meta description in `journey.html`.
- Update `JOURNEY_LORE.md` with the new content tables as source-of-truth.
- Update `README.md` with new gameplay summary.
- Lighthouse run — confirm mobile Performance score ≥85.

### Phase 5 — Optional after-launch · 2–3 days

Only if Phase 4 lands well.

- Speed-run leaderboard — existing Cloudflare Worker (`notification-api/`) gains a `/api/scores` endpoint backed by KV.
- Medal mode — replay collected chapter to chase gold/silver/bronze per mini-game.
- Story-arc achievement — "8 of 8 culminations read" emits a final paragraph card on the end screen.
- Shareable end-card — canvas-rendered PNG of per-chapter scores, share button copies image to clipboard.

### Total estimate

**~3 weeks of focused part-time work** for Phases 1–4. Phase 5 is optional polish for later.

---

## Open questions

These were not nailed down in brainstorming and should be answered before implementation begins. None of them block writing the implementation plan; they should be resolved during Phase 2.

1. **NPC sprite style** — emoji glyphs (`👩`, `🧑‍🔧`, `🧑‍💻`) for speed, or hand-drawn canvas-2D figures matching the existing character art? Emoji is faster to ship; canvas figures match the aesthetic better. **Recommended:** emoji for Phase 2 slice, revisit if it reads as cheap.

2. **NPC sprite placement in the world** — does the archetype sprite stand at a fixed world-x per chapter (e.g., right of the chapter center), or do they walk in/spawn when the player gets near? **Recommended:** fixed world-x with a subtle bobbing animation, like landmarks.

3. **Quest checklist visibility** — always visible top-right when in a chapter, or fades in only after the cutscene + first beat? **Recommended:** fades in 1s after the cutscene dismisses, fades out after Act III.

4. **What "score" is computed for each mini-game** — exact formula per game. Out of scope for this spec; defined per-game during Phase 3 implementation.

5. **End-card design** — whether to add an aggregate "your journey score" screen across all 8 chapters after `now` is collected. Sits well in Phase 5 (shareable end-card).

---

## Success criteria

- All 8 chapters playable through the full 3-act flow on desktop (Chrome, Firefox, Safari) and mobile (iOS Safari, Android Chrome).
- Lighthouse mobile Performance score remains ≥85 (no regression vs. current journey).
- All Puppeteer tests in the suite pass on CI.
- A first-time visitor can complete all 8 chapters without ever seeing a "game over" / "retry" / "you failed" message.
- A returning visitor sees their progress preserved across sessions via `localStorage`.
- The existing `journey.html` page is replaced by the v2 build with no visible URL change.
