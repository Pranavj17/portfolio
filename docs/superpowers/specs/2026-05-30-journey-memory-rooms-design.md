# Journey · Memory Rooms + Stabilization · Design

**Date:** 2026-05-30
**Status:** Committed (autonomous build — user delegated decisions)
**Target:** `public/journey.html?v=2` (live at `pranavjagadish.com/journey?v=2`)
**Builds on:** `docs/superpowers/specs/2026-05-28-journey-3-act-milestones-design.md`

---

## The ask

> "make it like nvidia or unity games — a more interactive game. it was half done with
> bugs. better it, make it interactive, and **after reaching a milestone the user gets a
> chance to play the memories with each milestone — like enter into a room**."

Two threads:

1. **Stabilize** the half-done `?v=2` build so the 3-act vignettes actually work end-to-end
   on desktop *and* mobile.
2. **Memory Rooms** — the headline new feature. Each completed milestone becomes an
   enterable, immersive interior space where the player replays that chapter's memories.

The aesthetic bar is "engine demo": depth, light, particles, bloom, smooth camera — while
staying within the existing vanilla-canvas, RDR/Cinzel/IM-Fell/sepia language.

---

## Part 1 — Stabilization (must-fix bugs)

Confirmed by source reading + running the suite (90/90 unit pass, but they use synthetic
events that mask the real-DOM coordinate bug):

| # | Bug | Fix |
|---|-----|-----|
| B1 | **Canvas input broken in 6 mini-games.** They read `ev.offsetX` / `changedTouches[0].clientX` (viewport coords) against a `360×240` backing buffer stretched to `width:100%`. Mobile taps → `(0,0)`; desktop taps mis-scaled. | Centralize canvas-space mapping in `attachInputRouter`: use `getBoundingClientRect()` + backing-buffer scale, expose `gesture.x/gesture.y` (and `gesture.x0/y0` start). Update all 6 games to read gesture coords. |
| B2 | **Stage video never plays.** `culmination.js:20` sniffs a same-named `playStageVideo` inside the IIFE → self-reference / no-op. | Call `window.__journeyV1Bridge.playStageVideo(chapterId)`. |
| B3 | **No cache-bust** on `journey-v2.js`. | Add `?v=<date>` to the script src in `journey.html`. |
| B4 | Unit tests assert the old `ev.offsetX` contract. | Migrate the 6 games' tests to the `gesture.x/y` contract. |

Non-goals for Part 1: no rewrite of the orchestrator (it's tested and works), no v1 cutover
(keep the `?v=2` flag), no DB/back-end.

---

## Part 2 — Memory Rooms

### Player flow

```
overworld (side-scroller, v1)
   │  walk into a chapter → 3-act vignette (existing) → phase: complete
   ▼
a glowing DOORWAY appears at the milestone   ── HUD: "◆ step inside the memory"
   │  tap door  (or: "▸ step inside ▸" on the culmination card, first time)
   ▼   ── cinematic iris-zoom + fade + letterbox ──
MEMORY ROOM (full-screen overlay canvas; v1 frozen + hidden beneath)
   │  parallax interior · light shaft · dust motes · bloom · camera parallax
   │  tap memory-objects → "play the memory" card slides up (beat lore)
   │  arcade cabinet → replay the mini-game (medal mode)
   │  projector screen → play the stage video
   │  journal plaque → read the culmination
   │  tap EXIT door
   ▼   ── reverse transition ──
overworld, exact same spot
```

The door appears whenever the player stands in a chapter band whose `phase === 'complete'`,
so rooms are always re-enterable ("play the memories *again*").

### Why a data-driven engine (not 8 bespoke scenes)

One renderer + 8 layout tables. A room is described as data:

```js
ROOMS[chapterId] = {
  palette: { wall, floor, light, accent },     // per-era tint over the shared sepia base
  light:  { x, y, angle, width, warmth },      // the window/lamp shaft
  motes:  { count, drift },                     // dust density
  props: [                                      // each beat → an interactable object
    { id:'study-lamp', beat:'study-lamp', kind:'memory',
      x, y, depth, sprite:'lamp', glow:true,
      card:{ title:'the 5:30 lamp', body:'...the only light in the house...' } },
    ...
    { id:'arcade',  kind:'minigame', x, y, depth, sprite:'cabinet' },
    { id:'screen',  kind:'video',    x, y, depth, sprite:'projector' },
    { id:'journal', kind:'culmination', x, y, depth, sprite:'book' },
    { id:'exit',    kind:'exit',     x, y, depth, sprite:'door' },
  ],
};
```

`depth` (0=far … 1=near) drives parallax offset, scale, and light falloff. Props are drawn
with simple procedural canvas shapes (no image assets) so the room ships in the bundle with
zero new network requests — same constraint the overworld already honors.

### Rendering layers (back → front)

1. **Back wall** — palette gradient + soft window cutout, faint framed-photo rectangles.
2. **Light shaft** — additive warm cone from `light.{x,y,angle}`, animated shimmer.
3. **Mid props** (`depth < 0.5`) — shelves, furniture; parallax ×0.5.
4. **Dust motes** — particle field inside the shaft (additive, twinkle), parallax ×0.7.
5. **Near props** (`depth ≥ 0.5`) — the interactable objects; parallax ×1.0, hover ring + bloom.
6. **Foreground** — floor sheen, vignette, film grain (reuse overworld grain feel).
7. **HUD** — room title, memories-played counter, "tap an object" hint, exit chip.

### Game-feel ("NVIDIA/Unity") checklist

- Pointer/`deviceorientation` parallax on all layers + a slow idle camera bob.
- Bloom/glow on interactables; hover → scale 1.06 + ring; tap → particle burst + micro screen-shake.
- Eased everything (cubic-bezier), iris-zoom room transitions.
- Volumetric light shaft with drifting motes; per-era palette.
- Subtle room ambient drone (WebAudio), fades with the transition; respects mute.
- **No-fail / no-stuck**: every object optional; exit always one tap away.

### Freezing v1 (no risky surgery)

The room is a full-screen **opaque** overlay above everything (`z-index: 200`). v1's RAF loop
keeps running cheaply but is hidden; movement is suppressed by a **capture-phase** key blocker
(arrows/space/`h`) on `window` while the room is open, and pointer events are consumed by the
room canvas (v1 canvas isn't the event target). On exit we remove the overlay + blocker; the
player's world position is untouched, so they resume exactly where they were. This avoids
editing the 9.3k-line v1 file (lower regression risk).

### Persistence (extends the v:2 schema)

```js
chapters[id] = { phase, score, npcChoice,
                 roomVisited: false,            // NEW
                 memoriesPlayed: [] }           // NEW · beat ids viewed in-room
```

Backward compatible: missing fields default. No schema-version bump needed (additive).

### Accessibility / mobile

- Reduced-motion: static layers, no mote animation, no bob, instant transitions.
- Mobile: tap props, swipe to pan camera, device-tilt parallax; cards full-width; exit chip large.
- Keyboard: `Tab` cycles props, `Enter` activates, `Esc` exits.

---

## Build phases

- **B** — Stabilization (input router + 6 games + stage video + cache-bust + tests).
- **R1** — Room engine (overlay, layered renderer, light+motes, camera, input, transitions,
  freeze) + CMR vertical slice.
- **R2** — Author the other 7 rooms (data).
- **R3** — Polish (bloom/audio/mobile/reduced-motion) + tests + browser verification.
- Ship behind `?v=2`. Commit per phase; push = GitHub Pages deploy.

## Success criteria

- 90+ unit tests green; integration test enters a room, plays a memory, replays a game, exits.
- All 6 mini-games register taps correctly on a real stretched canvas (verified in-browser).
- Stage video plays from the culmination on desktop + mobile.
- All 8 rooms enterable, all beats playable, exit returns to the exact overworld spot.
- Lighthouse mobile perf no worse than current (rooms are on-demand, not always-on).
- Reduced-motion users get a static but complete room.
