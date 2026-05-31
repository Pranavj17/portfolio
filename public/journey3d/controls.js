// === public/journey3d/controls.js ===
// journey v3 — first-person controller. three-dependent (browser-verified).
//
// Desktop: pointer-lock + WASD/arrows + mouse-look.
// Mobile:  on-screen joystick (move) + drag-look (right half of the screen).
// Collision: caller supplies a `collide(x, z)` predicate; we slide along walls.
// Head-bob is applied unless `reducedMotion` is set (prefers-reduced-motion).
//
// We import ONLY `three` (vendored). No jsm addons — pointer-lock is hand-rolled.

import * as THREE from 'three';

const EYE_HEIGHT = 1.6;          // metres
const MOVE_SPEED = 3.4;          // m/s
const LOOK_SENS = 0.0022;        // mouse-look radians per pixel
const TOUCH_LOOK_SENS = 0.0045;  // drag-look radians per pixel
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const PLAYER_RADIUS = 0.35;      // for wall collision slide
const BOB_FREQ = 9.5;
const BOB_AMP = 0.045;

export class FirstPersonControls {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement   the canvas / its container (gets listeners)
   * @param {object} opts
   * @param {(x:number,z:number)=>boolean} opts.collide  true if (x,z) is blocked
   * @param {boolean} opts.isMobile
   * @param {boolean} opts.reducedMotion
   * @param {(active:boolean)=>void} [opts.onInteract]  fired on E / click / tap
   */
  constructor(camera, domElement, opts = {}) {
    this.camera = camera;
    this.dom = domElement;
    this.collide = opts.collide || (() => false);
    this.isMobile = !!opts.isMobile;
    this.reducedMotion = !!opts.reducedMotion;
    this.onInteract = opts.onInteract || (() => {});

    this.enabled = true;
    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.bobPhase = 0;
    this._locked = false;

    this.keys = Object.create(null);
    this.joystick = { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 };
    this.lookTouch = { id: null, lx: 0, ly: 0 };

    this._tmpForward = new THREE.Vector3();
    this._tmpRight = new THREE.Vector3();

    this._bind();
  }

  // --- public API ---------------------------------------------------------

  setPosition(x, z, yaw) {
    this.position.set(x, EYE_HEIGHT, z);
    if (typeof yaw === 'number') this.yaw = yaw;
  }

  /** Unit forward vector on the XZ plane (ignores pitch) as plain {x,y,z}. */
  forwardFlat() {
    return { x: -Math.sin(this.yaw), y: 0, z: -Math.cos(this.yaw) };
  }

  /** Full look direction including pitch, as plain {x,y,z}. */
  lookDir() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  requestPointerLock() {
    if (!this.isMobile && this.dom.requestPointerLock) {
      try {
        const lock = this.dom.requestPointerLock();
        if (lock && typeof lock.catch === 'function') lock.catch(() => {});
      } catch (e) { /* drag-look fallback */ }
    }
  }

  /** Advance the controller; called every frame with delta seconds. */
  update(dt) {
    if (!this.enabled) return;
    const speed = MOVE_SPEED * Math.min(dt, 0.1);

    // Desktop keyboard intent.
    let fwd = 0, str = 0;
    if (this.keys['w'] || this.keys['arrowup']) fwd += 1;
    if (this.keys['s'] || this.keys['arrowdown']) fwd -= 1;
    if (this.keys['d'] || this.keys['arrowright']) str += 1;
    if (this.keys['a'] || this.keys['arrowleft']) str -= 1;

    // Mobile joystick intent (dy up = forward).
    if (this.joystick.active) {
      fwd += -this.joystick.dy;
      str += this.joystick.dx;
    }

    // Normalise diagonal so you don't move faster on the diagonal.
    const mag = Math.hypot(fwd, str);
    if (mag > 1) { fwd /= mag; str /= mag; }

    let moved = false;
    if (fwd !== 0 || str !== 0) {
      this._tmpForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this._tmpRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const nx = this.position.x + (this._tmpForward.x * fwd + this._tmpRight.x * str) * speed;
      const nz = this.position.z + (this._tmpForward.z * fwd + this._tmpRight.z * str) * speed;

      // Slide along walls: try full move, else axis-by-axis.
      if (!this.collide(nx, nz)) {
        this.position.x = nx; this.position.z = nz; moved = true;
      } else {
        if (!this.collide(nx, this.position.z)) { this.position.x = nx; moved = true; }
        if (!this.collide(this.position.x, nz)) { this.position.z = nz; moved = true; }
      }
    }

    // Head-bob (suppressed under reduced motion).
    let bobY = 0;
    if (moved && !this.reducedMotion) {
      this.bobPhase += dt * BOB_FREQ;
      bobY = Math.sin(this.bobPhase) * BOB_AMP;
    } else {
      this.bobPhase = 0;
    }

    this.camera.position.set(this.position.x, EYE_HEIGHT + bobY, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  dispose() {
    for (const [t, fn, el] of this._listeners) (el || this.dom).removeEventListener(t, fn);
    this._listeners = [];
  }

  // --- internals ----------------------------------------------------------

  _applyLook(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  _bind() {
    this._listeners = [];
    const add = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._listeners.push([type, fn, target]);
    };

    // Keyboard.
    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'e') this.onInteract(true);
    };
    const onKeyUp = (e) => { this.keys[e.key.toLowerCase()] = false; };
    add(window, 'keydown', onKeyDown);
    add(window, 'keyup', onKeyUp);

    if (!this.isMobile) {
      // Pointer lock + mouse-look, with drag-look fallback when not locked.
      const onLockChange = () => { this._locked = document.pointerLockElement === this.dom; };
      add(document, 'pointerlockchange', onLockChange);

      const onMouseMove = (e) => {
        if (!this.enabled) return;
        if (this._locked) {
          this._applyLook(e.movementX || 0, e.movementY || 0, LOOK_SENS);
        } else if (this._dragging) {
          this._applyLook(e.movementX || (e.clientX - this._lastX), e.movementY || (e.clientY - this._lastY), LOOK_SENS);
          this._lastX = e.clientX; this._lastY = e.clientY;
        }
      };
      add(document, 'mousemove', onMouseMove);

      const onMouseDown = (e) => {
        if (!this._locked) { this._dragging = true; this._lastX = e.clientX; this._lastY = e.clientY; }
      };
      const onMouseUp = () => { this._dragging = false; };
      add(this.dom, 'mousedown', onMouseDown);
      add(window, 'mouseup', onMouseUp);

      // Click = interact when locked, else (re)acquire lock.
      const onClick = () => {
        if (this._locked) this.onInteract(true);
        else this.requestPointerLock();
      };
      add(this.dom, 'click', onClick);
    } else {
      // Touch: left half = joystick, right half = drag-look. tap right = interact.
      const onTouchStart = (e) => {
        for (const t of e.changedTouches) {
          const left = t.clientX < window.innerWidth * 0.5;
          if (left && !this.joystick.active) {
            this.joystick.active = true; this.joystick.id = t.identifier;
            this.joystick.ox = t.clientX; this.joystick.oy = t.clientY;
            this.joystick.dx = 0; this.joystick.dy = 0;
          } else if (this.lookTouch.id === null) {
            this.lookTouch.id = t.identifier; this.lookTouch.lx = t.clientX; this.lookTouch.ly = t.clientY;
            this._lookMoved = false;
          }
        }
      };
      const onTouchMove = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this.joystick.id) {
            const R = 48;
            this.joystick.dx = Math.max(-1, Math.min(1, (t.clientX - this.joystick.ox) / R));
            this.joystick.dy = Math.max(-1, Math.min(1, (t.clientY - this.joystick.oy) / R));
          } else if (t.identifier === this.lookTouch.id) {
            this._applyLook(t.clientX - this.lookTouch.lx, t.clientY - this.lookTouch.ly, TOUCH_LOOK_SENS);
            this.lookTouch.lx = t.clientX; this.lookTouch.ly = t.clientY; this._lookMoved = true;
          }
        }
        if (e.cancelable) e.preventDefault();
      };
      const onTouchEnd = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === this.joystick.id) {
            this.joystick.active = false; this.joystick.id = null;
            this.joystick.dx = 0; this.joystick.dy = 0;
          } else if (t.identifier === this.lookTouch.id) {
            if (!this._lookMoved) this.onInteract(true); // a tap (not a drag) = interact
            this.lookTouch.id = null;
          }
        }
      };
      add(this.dom, 'touchstart', onTouchStart, { passive: false });
      add(this.dom, 'touchmove', onTouchMove, { passive: false });
      add(this.dom, 'touchend', onTouchEnd);
      add(this.dom, 'touchcancel', onTouchEnd);
    }
  }
}
