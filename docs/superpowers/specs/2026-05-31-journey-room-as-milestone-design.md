# Journey · Room-as-Milestone Redesign

**Date:** 2026-05-31
**Status:** Approved (user picked both pivotal options in brainstorming)
**Target:** `public/journey.html?v=2` → becomes the one true flow.
**Supersedes the dual-system mess from:** `2026-05-30-journey-memory-rooms-design.md`

---

## Why

The journey currently runs **two overlapping milestone systems**: the walk-by 3-act
vignette (cutscene → NPC → quest checklist → mini-game → culmination, all as overlays) **and**
the Memory Rooms. The result has no clear flow and even the owner couldn't tell how it
works ("there is no flow", "not sure how memories works", "sometimes it shows up sometimes
not"). This redesign collapses everything into **one** clear, guided flow and deletes the
redundant layer (the cleanup the user asked for).

## Two approved decisions

1. **The Memory Room IS the milestone.** There is no separate walk-by vignette. Everything
   that used to happen on the walk now happens *inside* the room.
2. **Inside each room is GUIDED, step-by-step** — exactly one thing is lit/interactive at a
   time, so the visitor can never feel lost.

## The single flow

```
First visit → INTRO card: "a walk through 13 years · hold → to walk ·
                           step into each room to relive it"  [tap to begin]
   │
THE WALK  (v1 world: parallax, walking, ambient audio — unchanged)
   │  walk right; reach a milestone band
   ▼
"STEP INSIDE ▸ <CHAPTER>" prompt  — appears EVERY time you stand at a milestone
   │  (deterministic; no completion gating → fixes "sometimes shows up")
   ▼
THE ROOM (guided sequence, one lit step at a time):
   ① INTRO   — room dim; the chapter's opening line fades in centered → tap/auto-advance
   ② MEMORIES— the N memory frames pulse; HUD "tap the memories · k/N"; tap each → card;
               all seen → advance
   ③ PLAY    — the arcade lights up "▸ play"; launches the era mini-game (no-fail; a
               subtle "skip ▸" so it is never a gate); on done → advance
   ④ CLOSE   — the projector lights up + plays the stage clip; the closing line settles;
               tap/clip-end → advance
   ⑤ EXIT    — the door lights up "▸ step back out"; tap → leave room, mark chapter complete
   │
   ▼ back on THE WALK → next milestone → … → all 8 done → END card (recap + links)
```

A persistent **"✦ memory rooms"** button (already built) stays in the corner to revisit any
room you've entered. **Revisiting is free-explore** (all props active, no forced sequence);
only the *first* visit runs the guided sequence.

## Architecture

### Removed (the dual-system cleanup)
- **Overlay players:** `src/journey/acts/cutscene.js`, `acts/npc.js`, `acts/quest.js`,
  `acts/culmination.js` (the overlay version), `ui/hud.js` (quest checklist).
- **Orchestration in `core.js`:** the entire vignette chain — `startChapterFlow`,
  `enterExploring`, `pollQuest`, `checkQuestComplete`, `_activeFlow`, `_questPollTimers`,
  `_act3Started`. `core.js` shrinks to: detect milestone band → show/hide the STEP-INSIDE
  prompt → open the room. Keep `detectActiveV2Chapter`, `tickChapterFlow` (now just prompt
  logic), `updateRoomDoor` (renamed/retargeted to the prompt).
- **DOM + CSS:** `#v2-cutscene`, `#v2-npc`, `#v2-quest-hud`, `#v2-culmination` overlays and
  their styles in `public/journey.html`.
- **State machine:** `state/phase.js` and the 5-phase chapter machine. The store simplifies
  (below).

### Kept / reused
- **Room engine:** `room/{geometry,motes,data,render,controller}.js`.
- **Mini-games:** `acts/minigame.js` + `acts/minigames/*` — launched from the arcade in
  stage ③ (this is now their only entry point).
- **Stage video** via `window.__journeyV1Bridge.playStageVideo` — stage ④.
- **Data tables as content sources (kept, but only read by the room now):**
  `data/cutscenes.js` → the stage-① intro line(s); `data/culminations.js` → the stage-④
  closing line; `world/npcs.js` → optional extra intro flavour line (the archetype's open
  line). The room reads these; the overlay players that used to consume them are gone.
- **Bridge, input router (`canvasPoint`), store (simplified).**

### New
- **Guided sequencer** inside `room/controller.js`: a small stage machine
  `intro → memories → play → close → exit` with `advanceStage()`. Render dims all props
  except the active step's; the bottom hint shows the current instruction; `hitTestProps`
  is filtered to the active interactable(s) during the guided run. On a *revisit*
  (`chapter.complete`), skip the sequence → free-explore (all props active).
- **Onboarding intro card** `#v2-intro`: shown once (localStorage `journey_intro_seen`),
  two-line explanation + "tap to begin".
- **Deterministic STEP-INSIDE prompt:** reuse `#v2-room-door`, retitled to
  "STEP INSIDE · <CHAPTER>"; shown whenever `detectActiveV2Chapter()` returns a chapter and
  the room is closed. No phase gating.
- **End card** `#v2-end` (or reuse v1's): when all 8 chapters are `complete`, show a short
  "journey complete" card with the existing contact links.

### Store (simplified)
```js
chapters[id] = {
  visited: false,         // room has been entered at least once
  complete: false,        // guided sequence finished at least once
  memoriesPlayed: [],     // beat ids viewed in-room
  score: null,            // best mini-game score (flavour)
}
```
`createChapterStore` keeps `getChapter` (with these defaults) + `markVisited`,
`markComplete`, `markMemoryPlayed`, `setScore`. Drop `send`/phase transitions. Migration:
read old records, map `phase==='complete'` → `{complete:true, visited:true}`; keep
`memoriesPlayed`/`score`. localStorage key stays `journey`, schema `v:2`.

### Door / prompt logic (core.js, ~30 lines total)
```
tick (250ms): id = detectActiveV2Chapter()
  if room open → hide prompt
  else if id → show prompt "STEP INSIDE · <label>", wire tap → openMemoryRoom(id)
  else → hide prompt
```

### Controller open signature
`openMemoryRoom(chapterId)` decides guided vs free from `store.getChapter(id).complete`:
- not complete → run guided sequence (stages ①–⑤), mark `complete` on exit.
- complete → free-explore (all props live; exit anytime).

## Testing
- **Unit (keep + update):** `room-geometry`, `room-motes` (keep as-is); `store` (rewrite to
  new shape + migration); **new** `room-sequence` (pure stage-machine: advances
  intro→memories→play→close→exit; memories stage completes when all beats seen). **Delete**
  unit tests for removed modules: `cutscene`, `quest`, and the `phase` test. **Keep** all
  mini-game tests (reused). `build.test` (bundle freshness) stays.
- **Browser (Playwright MCP, run by the main session after build):** load `?v=2`; intro
  card shows first run; walk/teleport to a milestone → prompt appears; enter → guided
  stages progress (assert active stage + that only-active props are hittable); all 4
  memories → arcade unlocks → play → close → exit → back on walk → prompt reappears;
  revisit via picker → free-explore; zero console errors.
- Note: the repo's `node_modules` puppeteer is broken (`Cannot find module
  './build/index.cjs'`); `npm install` fixes it, otherwise rely on Playwright MCP + unit.

## Deploy
Build `journey-v2.js`, bump the `?v=` cache-bust in `journey.html`. **Gate:** commit + push
to `main` ONLY if unit tests are green and the bundle parses (`node --check`). Behind `?v=2`
so the default journey is unaffected.

## Success criteria
- One flow, no dual system. `core.js` has no vignette orchestration. The deleted files are
  gone and not referenced by the build manifest.
- From a cold load: intro card → walk → STEP-INSIDE prompt is reliably visible at a
  milestone → guided room runs end-to-end → exit → next. No console errors, desktop+mobile.
- Unit suite green; browser flow verified; deployed behind `?v=2`.
