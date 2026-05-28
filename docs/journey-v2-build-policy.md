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
