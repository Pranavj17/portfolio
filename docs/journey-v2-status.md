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

## TODO (deferred to Phase 4 cutover, requires headed browser or design work)

- [ ] Manual mobile smoke on Chrome DevTools iPhone 14 Pro (390×844)
- [ ] Lighthouse mobile Performance (target ≥85)
- [ ] Reduced-motion implementation in cutscene.js (currently stale JSDoc)
- [ ] Z-index tiering for v2 overlays (currently all 60)
- [ ] **v1 `playStageVideo` blocks v2 culmination clicks** — workaround
  in e2e tests is `page.evaluate(() => document.getElementById('v2-culmination').click())`,
  but real users hit the same z-index issue when the v1 stage video
  overlay covers the v2 culmination card. Phase 4 should either suppress
  v1's stage-video chain for v2-owned chapters, OR raise v2's culmination
  z-index above v1's stage-video overlay.
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

- Unit tests: 87 (one per pure function + bundle drift check)
- Integration tests: 13 (5 module-level + 8 chapter e2e: CMR, ITICS,
  SCRIPBOX, NOW, SAKHA, DSCE/college, FEVER 104, THE GT/vwgt)

## Commit history

Run `git log --oneline feat/journey-3-act-milestones-phase-3 ^main` for
the full Phase 3 commit list (~14 commits + small polish/fix commits).
