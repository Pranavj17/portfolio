# Journey v3 — "the journey, in 3D" — Design

**Date:** 2026-05-31
**Status:** Approved in brainstorming (all forks chosen by user)
**Target:** new standalone app at `public/journey.html?v=3`. v1 (default) and v2 (`?v=2`) untouched.
**Builds on the story/content of:** the existing 8-milestone journey (beats, culminations, stage
clips, sepia/RDR aesthetic, per-era palettes).

---

## Vision

A genuine first-person 3D game: you **walk through your career** as one continuous, cinematic
space. Same story (ITICS → CMR → DSCE → Fever 104 → SAKHA → Scripbox → the GT → NOW), same soul
(warm sepia/RDR mood), but a real WebGL engine with real movement and real object interactions.

### Decisions (locked in brainstorming)
1. **Perspective:** first-person walk-through (look + move; you're *in* the world).
2. **Art:** realistic / textured.
3. **Fidelity:** cinematic / max-real — PBR + HDRI + post-FX, with a loading screen, per-room
   lazy-loading, and mobile quality-scaling.
4. **Mini-games:** become **in-world micro-actions** (no-fail) — kick the ball at the goal, flip
   the ON-AIR switch, park the car, etc.
5. **World shape:** **one straight chronological hall** — 8 doors in time order, entrance → end.

---

## Technology

- **Three.js** (pin a version, e.g. r0.160) loaded via **CDN ES-module importmap** in the page —
  **no bundler**, preserving the repo's zero-build static-deploy model.
  - `three/examples/jsm`: `GLTFLoader` + `DRACOLoader`, `KTX2Loader`, `RGBELoader` (HDRI),
    `EffectComposer` + `RenderPass`/`SSAOPass` (or GTAO)/`UnrealBloomPass`/`BokehPass`/
    `OutputPass`, `PointerLockControls` (desktop) + a custom touch controller (mobile).
- **No React / no Vite.** Plain ES modules under `src/journey3d/`, authored multi-file; the page
  imports the entry module directly (modern browsers; the journey already targets evergreen).
- *Alternatives considered & rejected:* react-three-fiber/drei (forces React + a build step,
  breaks static deploy), Babylon/PlayCanvas (heavier, more lock-in). Raw Three.js gives full
  control of the cinematic look with zero build tooling.

## World & flow

A chronological **memory museum**:
- Spawn at the **entrance** of one warm-lit hall. 8 **doorways** open off it in time order, each
  with the era name + years glowing above (e.g. "ITICS · until 2013").
- Walk through a doorway → inside that milestone's **furnished realistic room**. Explore,
  interact, then walk back out and continue down the hall → final door → an **end space**
  (journey recap + contact links).
- **Guided but free:** a soft objective marker points to the next unvisited door; you can revisit
  any room. Clear linear progression (the flow lesson from v2) without hand-holding.
- **Lazy per-room loading:** each room's heavy assets (textures/HDRI/props) load as you approach
  its door (a subtle shimmer/locked feel until ready). Only the hall + the first room are needed
  for first paint.

## First-person interactions

- **Move:** WASD / arrows + mouse-look via PointerLock (desktop); on-screen joystick + drag-look
  (mobile). Head-bob + footstep audio for presence; collision so you don't clip walls.
- **Proximity prompts:** a center reticle; nearing an interactable shows "⌖ inspect" / "press E" /
  "tap". One active interactable at a time (nearest in view).
- **Memory objects** = the chapter's beats as **real props** (football, study lamp, mixing desk,
  car keys, laptop…). Interact → the prop floats up and you **rotate/inspect it in 3D** while its
  memory surfaces: the real beat **title + lore**, and the real **photo** as a texture/card where
  one exists. Marks the memory "played".
- **Projector / screen** per room → plays that era's **stage clip** (reuse existing videos as a
  `VideoTexture` on an in-world screen).
- **Plaque** → the culmination/closing line. **Exit doorway** → back to the hall.
- **In-world micro-action** per era (the old mini-game, no-fail, flavour only): e.g. ITICS kick a
  ball into a goal; Fever 104 flip the ON-AIR switch + push a fader; the GT nudge the car between
  cones; CMR tap the right answer on a paper; etc. A score is shown as flavour, never a gate.
- **No fail states, nothing blocks progress.** You can always walk out a door.

## Cinematic rendering

- **HDRI image-based lighting** (warm interior HDRIs) for realistic ambient + reflections.
- **CC0 PBR materials** (albedo/normal/roughness/AO) on procedural room shells (walls/floor/
  ceiling) — Poly Haven / ambientCG (all CC0).
- A handful of **CC0 glTF props** per room (Poly Pizza / Quaternius / Kenney — CC0), Draco-
  compressed.
- Warm **light shafts** (god-rays via a cheap volumetric or a light-cone mesh), **fog** for depth,
  **soft contact shadows**.
- **Post-FX stack:** SSAO/GTAO → Bloom → subtle Depth-of-Field → **ACES** tone-mapping → film
  grain + vignette (keeps the sepia/RDR identity). Per-era palette + texture set so each room
  reads distinctly.

## Performance & mobile

- **Quality tiers**, auto-selected (UA + `maxTextureSize` + devicePixelRatio + a quick GPU probe):
  - **High (desktop):** full post-FX, dynamic shadows, up to 2-4k textures.
  - **Medium/Low (mobile):** trimmed post-FX (bloom + tone-map only), baked/contact shadows,
    1-2k **KTX2/basis-compressed** textures, capped `pixelRatio` (≤1.5), fewer lights.
- **Draco**-compressed glTF; **KTX2** textures; lazy per-room load; dispose room assets when far
  away to cap memory.
- **Branded loading screen** for the first paint; target interactive in a few seconds, ~30fps
  mobile / 60 desktop. A "reduce motion / low quality" toggle is always available.

## Accessibility

- `prefers-reduced-motion` → no head-bob, gentler camera, instant transitions.
- No-pointer-lock fallback (drag-look) for browsers/users that block it; full keyboard path
  (move + interact + exit); large mobile touch targets; captions on clips where available.

## Deploy / integration

- New `src/journey3d/**` modules + `public/assets/3d/**` (hdri/, textures/, models/, per-era/).
- `public/journey.html` branches on the query: `?v=3` loads **only** the v3 entry module (a small
  loader that injects the importmap + `src/journey3d/main.js`); it does **not** load v1 or v2.
- Same git → GitHub Pages flow. Assets committed to the repo (CC0). A `CREDITS.md` lists asset
  sources/licenses.
- v1 (no `?v`) and v2 (`?v=2`) are not modified.

## Reused from existing work
The 8-milestone storyline; beat titles/lore/icons + `QUESTS` beat lists; culmination lines; the
stage videos; the sepia palette + per-era `ROOM_META` colours; the v1 bridge data where useful.

## File structure (proposed)
```
src/journey3d/
  main.js            · boot: renderer, scene, composer, loop, quality tier, loading screen
  controls.js        · first-person controller (pointer-lock + WASD + touch joystick/look) + collision
  world/
    hall.js          · the chronological hall + doorways + objective marker
    room.js          · generic room builder (shell + PBR materials + lights from era config)
    rooms.js         · per-era room config (palette, textures, props, beats, micro-action, clip)
  interact/
    interactables.js · proximity detection, reticle/prompt, pick-up + 3D inspect
    microaction.js   · the per-era no-fail in-world actions
  fx/
    pipeline.js      · EffectComposer passes + tone-mapping + grain/vignette
    lighting.js      · HDRI env + light shafts + fog + shadows
  assets/
    loaders.js       · GLTF/Draco/KTX2/RGBELoader singletons + cache + dispose
  state.js           · progress (rooms visited, memories played) in localStorage 'journey3d'
  ui.js              · loading screen, prompts, quality toggle, end space
  data.js            · pure mappers from existing beats/culminations → 3D content (UNIT-TESTED)
public/assets/3d/    · hdri/ textures/ models/ (CC0, committed)
```
Pure logic (data mappers, quality-tier selection, nearest-interactable math, micro-action
scoring, progress state) lives in small files and is **unit-tested**; the renderer/controls are
verified in-browser.

## Testing & verification
- **Unit (Node, no DOM):** `data.js` mappers, quality-tier picker, nearest-interactable selection,
  micro-action scoring, `state.js` progress + migration.
- **Browser smoke (Playwright MCP, headless WebGL via SwiftShader):** `?v=3` boots a WebGL
  context, scene + composer initialise, no console errors, an FPS sample is sane, programmatic
  "walk to door 1 → enter → interact with a prop → exit" succeeds.
- **Real-device QA:** load on the user's phone (the true perf + controls check).

## Phasing (a real game — built in slices, each deployed behind `?v=3`)
- **P1 — Engine foundation:** renderer + composer + tone-map/post-FX skeleton, first-person
  controller (desktop + mobile), the hall with 8 placeholder doors + objective marker, HDRI +
  PBR pipeline, loading screen, quality tiers. One greybox room enterable. *Deploy + phone check.*
- **P2 — Vertical slice:** ONE fully-realised realistic room (CMR or ITICS) — textured shell, a
  few props, memory-object pickup/inspect, projector clip, the era micro-action, exit. Proves the
  look + interactions + **mobile perf** before scaling.
- **P3 — Author the other 7 rooms** (data-driven: shell + per-era textures/props/beats/action).
- **P4 — Polish:** ambient + footstep + interaction audio, transitions, the end space, reduced-
  motion + a11y, a perf pass, device QA, `CREDITS.md`.

## Risks (and mitigations)
- **Mobile WebGL perf** → quality tiers, KTX2/Draco, lazy load + dispose, capped pixel-ratio;
  P2 proves it on a real phone before P3.
- **Asset payload / load time** → compression, per-room lazy load, branded loading screen, a
  budget per room.
- **Headless verification limits** (WebGL in CI/Playwright) → SwiftShader smoke + lean on unit
  tests for logic + real-device QA for feel.
- **Scope** (AAA look is large) → strict phasing; P1+P2 deliver a real, deployed slice early.

## Success criteria
- `pranavjagadish.com/journey?v=3` loads to an interactive first-person hall in a few seconds
  (loading screen), on desktop and a mid-range phone.
- You can walk the full hall, enter all 8 realistic rooms, pick up + inspect memory objects, play
  each era's clip, and do each no-fail micro-action.
- ≥30fps mobile / 60 desktop at the selected tier; no console errors.
- v1 and v2 remain byte-for-byte unaffected.
