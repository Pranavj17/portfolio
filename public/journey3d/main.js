// === public/journey3d/main.js ===
// journey v3 — boot + render loop. three-dependent (browser-verified).
//
// Wires together: renderer (ACES filmic tone-mapping + warm fog), key/fill/
// ambient lighting + soft shadows, the chronological hall (world.js), the
// first-person controller (controls.js), proximity interaction (interact.js),
// the DOM overlay UI (ui.js), quality tiers (quality.js), and progress
// persistence (state.js). Vignette + film grain are a CSS overlay (P1); the
// GL post-FX stack (bloom/SSAO/DoF) is P2.

import * as THREE from 'three';
import { CHAPTERS, chapterIds, chapterById } from './data.js';
import { pickTier, tierSettings } from './quality.js';
import { FirstPersonControls } from './controls.js';
import { buildWorld, buildRoom, makeCollider, HALL_WIDTH } from './world.js';
import { InteractionManager } from './interact.js';
import * as State from './state.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { gradeMood } from './mood.js';

function detectMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
}

function boot() {
  const isMobile = detectMobile();
  const reducedMotion = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = new UI({ isMobile, reducedMotion });
  const audio = new AudioEngine({ isMobile, reducedMotion });

  // Per-era colour wash (soft-light blend over the whole frame) — eases between
  // moods via CSS transitions. Below the vignette (999995), above the canvas.
  const gradeEl = document.createElement('div');
  gradeEl.id = 'j3d-grade';
  gradeEl.style.cssText = 'position:fixed;inset:0;z-index:999994;pointer-events:none;' +
    'mix-blend-mode:soft-light;opacity:0;transition:background-color .9s ease,opacity .9s ease;';
  document.body.appendChild(gradeEl);

  // Mute toggle (top-right). Reflects + persists via the audio engine.
  const muteBtn = document.createElement('button');
  muteBtn.id = 'j3d-mute';
  muteBtn.style.cssText = `position:fixed;top:${isMobile ? 12 : 16}px;right:${isMobile ? 12 : 16}px;z-index:1000001;pointer-events:auto;` +
    'cursor:pointer;background:rgba(12,8,4,0.72);border:1px solid rgba(240,192,96,0.45);' +
    `color:#f0c060;border-radius:8px;padding:${isMobile ? '7px 9px' : '8px 12px'};font:${isMobile ? 12 : 14}px Georgia,serif;letter-spacing:.5px;`;
  const reflectMute = () => { muteBtn.textContent = audio.isMuted() ? '♪ muted' : '♪ sound'; };
  reflectMute();
  muteBtn.addEventListener('click', () => { audio.toggleMute(); reflectMute(); });
  document.body.appendChild(muteBtn);

  // Colour-grade targets (eased in the render loop). fogTarget = the era fog
  // tint; gradeLight scales the room point-light for mood.
  const fogTarget = new THREE.Color('#33271a');
  let gradeLight = 1.0;
  function applyGrade(id) {
    const gm = gradeMood(id);
    fogTarget.set(gm.fog);
    gradeLight = gm.light;
    gradeEl.style.backgroundColor = gm.overlay.color;
    gradeEl.style.opacity = String(gm.overlay.opacity);
  }

  // --- renderer / WebGL probe ----------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.id = 'j3d-canvas';
  document.body.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
  } catch (e) {
    ui.fail('this browser/device could not create a WebGL context.');
    return;
  }

  // Quality tier from a quick capability probe.
  const gl = renderer.getContext();
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const tier = pickTier({
    maxTextureSize: maxTex,
    deviceMemory: navigator.deviceMemory,
    isMobile,
    dpr: window.devicePixelRatio,
  });
  const qs = tierSettings(tier, window.devicePixelRatio || 1, isMobile);

  renderer.setPixelRatio(qs.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // cinematic base
  renderer.toneMappingExposure = 1.42;
  renderer.shadowMap.enabled = qs.shadows;
  if (qs.shadows) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // --- scene / fog / camera ------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#231a10');
  scene.fog = new THREE.FogExp2(new THREE.Color('#33271a'), 0.0085); // warm depth fog (thinned — was swallowing the hall)

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);

  // --- lighting: warm key + fill + ambient ---------------------------------
  const ambient = new THREE.AmbientLight(new THREE.Color('#74592f'), 1.05);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 2.7);
  key.position.set(6, 14, 8);
  if (qs.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(qs.shadowMapSize, qs.shadowMapSize);
    key.shadow.camera.near = 1; key.shadow.camera.far = 80;
    key.shadow.camera.left = -40; key.shadow.camera.right = 40;
    key.shadow.camera.top = 40; key.shadow.camera.bottom = -40;
    key.shadow.bias = -0.0005;
  }
  scene.add(key);

  if (qs.fillLight) {
    const fill = new THREE.DirectionalLight(new THREE.Color('#7a5a36'), 0.6);
    fill.position.set(-8, 8, -6);
    scene.add(fill);
  }

  // Hemisphere for soft warm ambient gradient.
  const hemi = new THREE.HemisphereLight(new THREE.Color('#6a522e'), new THREE.Color('#1a120a'), 0.95);
  scene.add(hemi);

  // --- world ---------------------------------------------------------------
  const world = buildWorld(scene, qs);
  const hallWalls = world.walls.slice();

  // collision: hall walls always; active room walls swapped in/out.
  let roomWalls = [];
  const collide = (x, z) => {
    const c1 = makeCollider(hallWalls)(x, z);
    if (c1) return true;
    if (roomWalls.length) return makeCollider(roomWalls)(x, z);
    return false;
  };

  // --- controls ------------------------------------------------------------
  let pendingInteract = false;
  const controls = new FirstPersonControls(camera, renderer.domElement, {
    collide, isMobile, reducedMotion,
    onInteract: () => { pendingInteract = true; },
  });
  // spawn at the hall entrance, looking down the hall (toward -z).
  controls.setPosition(0, world.plan.hallStartZ - 1.5, 0);

  const interaction = new InteractionManager(controls, ui);

  // --- progress state ------------------------------------------------------
  let progress = State.loadState(window.localStorage);

  // --- room management -----------------------------------------------------
  const builtRooms = Object.create(null); // chapterId -> { group, interactables, exitPos, walls }
  let currentRoom = null; // chapterId or null (in hall)
  const order = chapterIds();

  function refreshObjective() {
    if (currentRoom) {
      const ch = chapterById(currentRoom);
      const total = ch.beats.length;
      const seen = ch.beats.filter(b => State.hasSeenMemory(progress, ch.id, b.id)).length;
      ui.setObjective(`${ch.label} — inspect memories (${seen}/${total}). walk to the exit to return.`);
      return;
    }
    const next = State.nextUnvisited(progress, order);
    if (next) {
      const ch = chapterById(next);
      ui.setObjective(`walk to the ${ch.label} doorway (${ch.years}).`);
    } else {
      ui.setObjective('every room visited. revisit any door, or reach the end of the hall.');
    }
  }

  function ensureRoom(chapterId) {
    if (builtRooms[chapterId]) return builtRooms[chapterId];
    const door = world.plan.doors.find(d => d.id === chapterId);
    const room = buildRoom(chapterById(chapterId), door.roomCenter, qs);
    room.group.visible = false;
    scene.add(room.group);
    builtRooms[chapterId] = room;
    return room;
  }

  function enterRoom(chapterId) {
    const room = ensureRoom(chapterId);
    room.group.visible = true;
    currentRoom = chapterId;
    roomWalls = room.walls.slice();
    // place the player in a centered gallery view, facing the memory wall.
    controls.setPosition(room.anchor.x, room.anchor.z + 3.1, 0);
    resetStepOrigin();
    // interactables = memory objects + an exit target.
    const list = room.interactables.concat([{
      kind: 'exit', id: 'exit', worldPos: room.exitPos,
    }]);
    interaction.setInteractables(list);
    progress = State.markVisited(progress, chapterId);
    State.saveState(window.localStorage, progress);
    refreshObjective();
    audio.setMood(chapterId); audio.whoosh(); applyGrade(chapterId);
  }

  function exitRoom() {
    if (!currentRoom) return;
    const room = builtRooms[currentRoom];
    if (room) room.group.visible = false;
    const door = world.plan.doors.find(d => d.id === currentRoom);
    currentRoom = null;
    roomWalls = [];
    interaction.clear();
    // place the player back in the hall, just in front of that doorway.
    controls.setPosition(0, door.hallZ, Math.PI); // face back up the hall by default
    controls.setPosition(0, door.hallZ);
    resetStepOrigin();
    refreshObjective();
    audio.setMood(null); audio.whoosh(); applyGrade(null);
  }

  // door-entry detection: when in the hall and close to a doorway gap on +X.
  function checkDoorEntry() {
    if (currentRoom) return;
    const px = controls.position.x, pz = controls.position.z;
    // near the +X wall and aligned with a doorway z
    if (px < HALL_WIDTH / 2 - 1.0) return;
    for (const d of world.plan.doors) {
      if (Math.abs(pz - d.hallZ) < 1.1) { enterRoom(d.id); return; }
    }
  }

  // --- interaction resolution ----------------------------------------------
  function resolveInteract() {
    if (ui.isCardOpen()) { ui.hideCard(); return; }
    const target = interaction.trigger();
    if (!target) return;
    if (target.kind === 'exit') { exitRoom(); return; }
    if (target.kind === 'memory') {
      const beat = target.beat;
      ui.showCard({ icon: beat.icon, title: beat.title, body: beat.lore });
      audio.chime(); audio.swell(true);
      setTimeout(() => audio.swell(false), 900);
      progress = State.markMemorySeen(progress, target.chapterId, target.id);
      State.saveState(window.localStorage, progress);
      refreshObjective();
    }
  }

  // --- resize --------------------------------------------------------------
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- loop ----------------------------------------------------------------
  let last = performance.now();
  let running = false;
  let prevActive = null;
  let prevX = controls.position.x, prevZ = controls.position.z;
  function resetStepOrigin() {
    prevX = controls.position.x;
    prevZ = controls.position.z;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!running) return;

    controls.update(dt);
    if (pendingInteract) { pendingInteract = false; resolveInteract(); }
    checkDoorEntry();
    interaction.update(dt, now);

    // footsteps: feed distance moved this frame into the audio stride counter.
    const dx = controls.position.x - prevX, dz = controls.position.z - prevZ;
    prevX = controls.position.x; prevZ = controls.position.z;
    audio.stepWalk(Math.hypot(dx, dz));

    // a hover change pings a soft tick.
    if (interaction.active !== prevActive) {
      prevActive = interaction.active;
      if (interaction.active) audio.tick();
    }

    // world life: drifting motes, flickering lamps, breathing door glows.
    const t = now * 0.001;
    if (world.motes) world.motes.update(dt);
    for (const hl of world.hallLights || []) {
      hl.light.intensity = hl.base * (0.82 + 0.13 * Math.sin(t * 3.5 + hl.phase)) + (Math.random() - 0.5) * 0.5;
      if (hl.sprite && hl.sprite.material) hl.sprite.material.opacity = 0.36 + 0.14 * Math.sin(t * 3.5 + hl.phase);
    }
    for (const id in (world.doorGlows || {})) {
      const dg = world.doorGlows[id];
      const s = 0.7 + 0.3 * Math.sin(t * 1.6 + dg.phase);
      if (dg.sprite && dg.sprite.material) dg.sprite.material.opacity = dg.baseOpacity * s;
      if (dg.strip && dg.strip.material) dg.strip.material.opacity = 0.22 + 0.16 * s;
    }
    if (currentRoom && builtRooms[currentRoom]) {
      const rm = builtRooms[currentRoom];
      if (rm.motes) rm.motes.update(dt);
      if (rm.lamp) rm.lamp.intensity = rm.lampBase * gradeLight * (0.88 + 0.1 * Math.sin(t * 5.0)) + (Math.random() - 0.5) * 0.6;
    }

    // per-era colour grade: ease the fog toward the mood tint.
    scene.fog.color.lerp(fogTarget, Math.min(1, dt * 2.0));

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // --- start (after a beat so the loading screen reads) --------------------
  refreshObjective();
  // render one frame behind the loading screen so first paint is warm, then arm "enter".
  renderer.render(scene, camera);
  ui.showEnter(() => {
    running = true;
    controls.requestPointerLock();
    resetStepOrigin();
    audio.start();        // AudioContext must start from this user gesture
    audio.setMood(null);  // begin the neutral hall drone immediately
    applyGrade(null);     // hall mood
  });

  // expose a tiny handle for browser smoke tests / debugging.
  window.__journey3d = { renderer, scene, camera, controls, world, audio, enterRoom, exitRoom, get progress() { return progress; }, tier };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
