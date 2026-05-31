// === src/journey/core.js ===
/**
 * v2 milestone orchestrator (room-as-milestone).
 *
 * The v1 game owns the world, parallax, walking, beats, and achievements. v2
 * sits on top and watches the v1 bridge to know which chapter band the player
 * is standing in. There is no longer a walk-by vignette — the Memory Room IS
 * the milestone. core.js shrank to a single job: when the player is in a
 * v2-enabled band and no room is open, show the deterministic "STEP INSIDE"
 * prompt wired to open that chapter's room.
 */
const JOURNEY_V2_VERSION = 2;

const V2_ENABLED_CHAPTERS = new Set(['cmr', 'itics', 'scripbox', 'now', 'sakha', 'college', 'fever104', 'vwgt']);

/**
 * Returns the v2 chapter id for the player's current world-x, or null if no v2
 * chapter is active. Reads window.__journeyV1Bridge populated by v1's loop.
 */
function detectActiveV2Chapter() {
  const b = window.__journeyV1Bridge;
  if (!b || !b.getCurrentChapterId) return null;
  const id = b.getCurrentChapterId();
  return V2_ENABLED_CHAPTERS.has(id) ? id : null;
}

/**
 * Polled (250ms from bootstrap). The ONLY job: manage the STEP-INSIDE prompt.
 *   - room open      → hide the prompt
 *   - in a v2 band   → show "STEP INSIDE · <label>", wire tap → openMemoryRoom
 *   - otherwise      → hide the prompt
 * Deterministic — no phase/completion gating, so the prompt appears EVERY time
 * the player stands at a milestone (fixes "sometimes shows up, sometimes not").
 */
function tickChapterFlow() {
  const id = detectActiveV2Chapter();
  const door = document.getElementById('v2-room-door');
  if (!door) return;

  if (typeof isRoomOpen === 'function' && isRoomOpen()) {
    door.setAttribute('aria-hidden', 'true');
    return;
  }

  if (id) {
    const label = (window.__journeyV1Bridge && window.__journeyV1Bridge.getChapterLabel
      && window.__journeyV1Bridge.getChapterLabel(id)) || id.toUpperCase();
    if (door.__chapter !== id) {
      door.__chapter = id;
      const labelEl = door.querySelector('.v2-room-door-label');
      if (labelEl) labelEl.textContent = 'STEP INSIDE · ' + label;
      door.onclick = () => {
        door.setAttribute('aria-hidden', 'true');
        if (typeof openMemoryRoom === 'function') openMemoryRoom(id);
      };
    }
    door.setAttribute('aria-hidden', 'false');
  } else {
    door.setAttribute('aria-hidden', 'true');
    door.__chapter = null;
  }
}
