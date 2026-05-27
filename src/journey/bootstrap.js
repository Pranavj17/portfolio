// === src/journey/bootstrap.js ===
/**
 * Exposes v2 internals on window.__journeyV2 for integration tests and
 * for the v1 game loop to call into during Phase 2 wiring.
 */
window.__journeyV2 = {
  playCutscene,
  presentNpc,
  initMinigame,
  // populated in later tasks:
  showCulmination: null,
  store: null,
};
