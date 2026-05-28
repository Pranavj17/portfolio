# Journey v2 · Status

**Last updated:** 2026-05-29

## Phase 1 · Foundation harness · ✅ Complete

## Phase 2 · CMR vertical slice · ✅ Complete

## Phase 3 · All 7 remaining chapters · ✅ Complete

- All 8 chapters (cmr, itics, scripbox, now, sakha, college, fever104, vwgt)
  playable via `/journey.html?v=2`
- v1 world + walking always loaded; v2 vignettes layer on top under `?v=2`
- Mini-games: mock-test, kick-football, debug-the-PR, type-the-future,
  standup-bingo, CAD-snap, live-mix, parallel-park
- Orchestrator re-entry loop fixed (Phase 3 Task 4)
- Per-chapter `_act3Started` / `_questPollTimers` maps (Phase 3 Task 5)
- Real `window.__journeyV1Bridge` exposed from v1's IIFE (Phase 3 Task 6);
  hash bridge removed; v1 bridge `getCurrentChapterId()` enforces strict
  band detection so playerX=0 doesn't auto-fire the first chapter
- v1 bridge `getDiscoveredBeats()` strips v1's `${ch}:${id}` prefix so
  v2's unprefixed quest IDs match
- Shared `tests/integration/helpers.js` exposes `waitVisible`,
  `withV2Page`, `holdRightFor`, `collectBeatsViaV1`,
  `seedCompletedChapters`; chapter e2e tests walk via v1 controls
- Built-artifact policy documented in `docs/journey-v2-build-policy.md`;
  unit test asserts committed bundle matches a fresh build

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

## TODO (deferred to Phase 4b cutover, requires headed browser or design work)

- [ ] Manual mobile smoke on Chrome DevTools iPhone 14 Pro (390×844)
- [ ] Lighthouse mobile Performance (target ≥85)
- [ ] Speed-run leaderboard via Cloudflare Worker (Phase 5 polish)

## Phase 4b · Cutover · 🚧 Next

Separate plan: `docs/superpowers/plans/<TBD>-journey-3-act-phase-4b.md`.

- Port v1's world/walking/parallax/beats/audio/achievements into v2's
  source tree under `src/journey/world/` and `src/journey/v1port/`
- Delete `public/journey.js` (v1)
- Rename `public/journey-v2.js` → `public/journey.js`
- Remove the dual-load script-swap from `public/journey.html`; load
  `journey.js` directly
- Update `JOURNEY_LORE.md` source-of-truth note
- Re-record stage videos if framing changed (probably unnecessary)
- Update social-share image
- Lighthouse pass on the consolidated bundle

## Test summary (as of Phase 4a finalize)

- Unit tests: 90 (one per pure function + bundle drift check + 3 cutscene
  reduced-motion guard)
- Integration tests: 15 (5 module-level + 8 chapter e2e + re-entry
  regression + reduced-motion)

## Commit history

Run `git log --oneline feat/journey-3-act-milestones-phase-4a ^main` for
the full Phase 4a commit list (5 commits).
