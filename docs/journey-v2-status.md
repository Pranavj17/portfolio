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
- Stability: 3 consecutive PASS runs, ~11s each
- Score under default 8s-timeout completion: 50 (no-fail floor)

## TODO (deferred, requires headed browser)

- [ ] Manual mobile smoke on Chrome DevTools iPhone 14 Pro emulator (390×844)
- [ ] Lighthouse mobile Performance score (target: ≥85)

## Phase 3 · Roll out remaining 7 chapters · 🚧 Next

Separate plan: `docs/superpowers/plans/<TBD>-journey-3-act-phase-3.md`.

Cluster order:
1. **Cluster A · TAP-only** — ITICS, SCRIPBOX, NOW
2. **Cluster B · TAP-on-flashing** — SAKHA
3. **Cluster C · DRAG/SWIPE** — DSCE, FEVER 104, THE GT

Phase 3 also replaces the hash-based v1 bridge in journey.html with real
v1 chapter detection (wire to v1's `chapterIdxAt(playerX)` and
`state.discoveredBeats`).

## Test summary (as of 2026-05-28)

- 34 unit tests (`tests/unit/`) — all PASS
- 6 integration tests (`test-v2-*.js`) — all PASS
  - `test-v2-flag.js` — feature flag wiring
  - `test-v2-cutscene.js` — Act I overlay
  - `test-v2-npc.js` — Act II NPC dialog
  - `test-v2-minigame.js` — Act III harness (with __stub)
  - `test-v2-culmination.js` — Act III paragraph card
  - `test-v2-chapter-cmr.js` — full CMR vignette end-to-end

## Commit history (Phase 1 + Phase 2)

Run `git log --oneline feat/journey-3-act-milestones ^main` for the full
list. Roughly 17 commits, from the spec/plan through Task 16.
