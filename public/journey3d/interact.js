// === public/journey3d/interact.js ===
// journey v3 — proximity interaction layer. three-light: uses the pure
// `nearestInView` math (nearest.js) over plain {x,y,z}, plus a tiny amount of
// three for gently animating the active object. Browser-verified.

import { nearestInView } from './nearest.js';

const RANGE = 3.0;     // world units you must be within to inspect
const MIN_DOT = 0.45;  // how much you must be looking at the thing

export class InteractionManager {
  /**
   * @param {object} controls  FirstPersonControls (provides position + lookDir)
   * @param {object} ui         UI object exposing showPrompt(active, label) + hidePrompt()
   */
  constructor(controls, ui, opts = {}) {
    this.controls = controls;
    this.ui = ui;
    this.interactables = [];
    this.active = null; // currently-highlighted interactable
    // optional callback fired when the hovered interactable changes (for audio)
    this.onHoverChange = opts.onHoverChange || (() => {});
    // ids of memory objects that are currently "out" (floating to camera): we
    // suppress the idle float/spin animation for those so the choreography owns
    // their transform. Caller toggles via setFrozen().
    this._frozen = new Set();
  }

  setFrozen(id, frozen) {
    if (frozen) this._frozen.add(id);
    else this._frozen.delete(id);
  }

  setInteractables(list) {
    this.active = null;
    this.interactables = list || [];
    this.ui.showPrompt(false);
  }

  clear() {
    this.setInteractables([]);
  }

  /** Per-frame: find nearest-in-view interactable; drive reticle/prompt + bob. */
  update(dt, tNow) {
    const cam = this.controls.position;
    const fwd = this.controls.lookDir();
    const targets = this.interactables.map(o => o.worldPos);
    const hit = nearestInView(
      { x: cam.x, y: cam.y, z: cam.z }, fwd, targets, { range: RANGE, minDot: MIN_DOT });

    const next = hit ? this.interactables[hit.index] : null;
    if (next !== this.active) {
      this.active = next;
      if (next) this.ui.showPrompt(true, this._promptLabel(next));
      else this.ui.showPrompt(false);
      this.onHoverChange(this.active);
    }

    // Gentle float + spin for memory objects so they read as alive.
    for (const o of this.interactables) {
      if (o.kind === 'memory' && o.group && !this._frozen.has(o.id)) {
        o.group.rotation.y += dt * 0.6;
        if (o.baseY != null) o.group.position.y = o.baseY + Math.sin(tNow * 0.0018 + o.worldPos.x) * 0.08;
        const emph = (o === this.active);
        if (o.mesh && o.mesh.material) {
          o.mesh.material.emissiveIntensity = emph ? 1.1 : 0.55;
        }
      }
    }
  }

  _promptLabel(o) {
    if (o.kind === 'exit') return '⌖ exit to hall';
    return '⌖ inspect';
  }

  /** Fire the active interaction; returns the interactable that was triggered, or null. */
  trigger() {
    return this.active || null;
  }
}
