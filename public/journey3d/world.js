// === public/journey3d/world.js ===
// journey v3 — world geometry: the chronological hall + 8 doorways + per-era
// rooms. three-dependent (browser-verified). Imports ONLY `three` (vendored).
//
// Look: lighting + warm fog + ACES tone-mapping + vignette/grain do the heavy
// lifting (NOT textures — that's P2). Era labels are CanvasTextures.

import * as THREE from 'three';
import { CHAPTERS } from './data.js';

// --- layout constants (metres) --------------------------------------------
export const HALL_WIDTH = 6;
export const HALL_HEIGHT = 4.2;
export const DOOR_SPACING = 9;     // distance between successive doorways
export const HALL_START_Z = 4;     // spawn is near z = +HALL_START_Z, hall runs toward -z
const WALL_T = 0.4;                 // wall thickness (for collision)
const DOOR_W = 2.2;
const DOOR_H = 3.0;
const ROOM_SIZE = 10;              // each era room is a square box, side ROOM_SIZE
const ROOM_OFFSET_X = 14;          // rooms sit off to the +X side of the hall

/**
 * World-space geometry plan, computed once. Pure-ish: produces door/room
 * anchor positions used by both the meshes and the collision/teleport logic.
 */
export function buildPlan() {
  const doors = CHAPTERS.map((ch, i) => {
    const z = HALL_START_Z - (i + 1) * DOOR_SPACING;
    return {
      id: ch.id,
      label: ch.label,
      years: ch.years,
      index: i,
      // doorway is in the +X hall wall (x = +HALL_WIDTH/2)
      doorPos: { x: HALL_WIDTH / 2, y: DOOR_H / 2, z },
      // room centre, off to +X
      roomCenter: { x: HALL_WIDTH / 2 + ROOM_OFFSET_X, y: 0, z },
      hallZ: z,
    };
  });
  const hallEndZ = HALL_START_Z - (CHAPTERS.length + 1) * DOOR_SPACING;
  return { doors, hallStartZ: HALL_START_Z, hallEndZ, hallWidth: HALL_WIDTH, roomSize: ROOM_SIZE };
}

// --- CanvasTexture text label ----------------------------------------------
function makeLabelTexture(title, sub, accent) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // warm panel
  ctx.fillStyle = 'rgba(10,7,4,0.0)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.fillStyle = accent;
  ctx.font = '700 120px Georgia, "Times New Roman", serif';
  ctx.fillText(title, c.width / 2, 96);
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#e8d9b8';
  ctx.font = '400 44px Georgia, serif';
  ctx.fillText(sub, c.width / 2, 188);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// --- additive radial-glow sprite (cheap "bloom" — see main.js header note) --
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

/**
 * An additive glow sprite (fakes bloom around a light/label). Returns the Sprite;
 * caller positions it. `size` in world units, `color` hex, `opacity` 0..1.
 */
export function makeGlowSprite(color, size = 2, opacity = 0.6) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  return sp;
}

/**
 * A drifting field of warm glowing motes (THREE.Points, additive). Motes rise +
 * sway and wrap within a box of half-extents `ext` centred on `center`. Returns
 * { points, update(dt) }. Counts are caller-controlled (fewer on mobile).
 */
export function makeMoteField(center, ext, count, color, opts = {}) {
  const n = Math.max(0, count | 0);
  const positions = new Float32Array(n * 3);
  const vel = new Float32Array(n);       // upward speed
  const sway = new Float32Array(n);      // sway frequency
  const phase = new Float32Array(n);     // sway phase
  const baseX = new Float32Array(n);     // sway anchor x
  for (let i = 0; i < n; i++) {
    const x = center.x + (Math.random() * 2 - 1) * ext.x;
    const y = center.y + Math.random() * ext.y * 2;
    const z = center.z + (Math.random() * 2 - 1) * ext.z;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    baseX[i] = x;
    vel[i] = 0.08 + Math.random() * 0.16;
    sway[i] = 0.3 + Math.random() * 0.7;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    size: opts.size || 0.22,
    transparent: true,
    opacity: opts.opacity != null ? opts.opacity : 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const topY = center.y + ext.y * 2;
  const botY = center.y - ext.y * 0.2;
  function update(dt) {
    const p = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      let y = p[i * 3 + 1] + vel[i] * dt;
      phase[i] += dt * sway[i];
      const x = baseX[i] + Math.sin(phase[i]) * (ext.x * 0.12);
      if (y > topY) { y = botY; baseX[i] = center.x + (Math.random() * 2 - 1) * ext.x; }
      p[i * 3] = x;
      p[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points, update };
}

function makeTextSprite(text, color, scale = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.font = '600 72px Georgia, serif';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(2 * scale, 0.5 * scale, 1);
  return sp;
}

// --- material helpers -------------------------------------------------------
function wallMat(hex) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.92, metalness: 0.02 });
}

/** Scale an #rrggbb colour's channels toward white by `factor` (>1 brightens). */
function lighten(hex, factor) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * factor);
  c.g = Math.min(1, c.g * factor);
  c.b = Math.min(1, c.b * factor);
  return '#' + c.getHexString();
}

/**
 * Build the entire static world (hall shell + doorways + labels + objective
 * marker holder) into `scene`. Rooms are built lazily by buildRoom().
 * Returns handles used by main.js (collision walls, door anchors, label group).
 */
export function buildWorld(scene, quality) {
  const plan = buildPlan();
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  const walls = []; // AABBs for collision: {minX,maxX,minZ,maxZ}
  const addWallBox = (cx, cz, sx, sz, mat, h = HALL_HEIGHT) => {
    const geo = new THREE.BoxGeometry(sx, h, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = false; mesh.receiveShadow = true;
    group.add(mesh);
    walls.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
    return mesh;
  };

  const hallLen = plan.hallStartZ - plan.hallEndZ;
  const hallMidZ = (plan.hallStartZ + plan.hallEndZ) / 2;

  // Floor + ceiling (no collision boxes — handled by Y). Brightened so mid
  // surfaces no longer read near-black (was #2c2116 / #1d150d).
  const floorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a3a26'), roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, hallLen + 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, hallMidZ);
  floor.receiveShadow = true;
  group.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#322516'), roughness: 1 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, hallLen + 6), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, HALL_HEIGHT, hallMidZ);
  group.add(ceil);

  // Left wall (solid) at x = -HALL_WIDTH/2. Walls brightened from #2a1d10.
  const HALL_WALL = '#4a3320';
  addWallBox(-HALL_WIDTH / 2 - WALL_T / 2, hallMidZ, WALL_T, hallLen + 6, wallMat(HALL_WALL));
  // End cap walls.
  addWallBox(0, plan.hallStartZ + 3, HALL_WIDTH + WALL_T * 2, WALL_T, wallMat(HALL_WALL));
  addWallBox(0, plan.hallEndZ - 3, HALL_WIDTH + WALL_T * 2, WALL_T, wallMat(HALL_WALL));

  // Right wall is segmented to leave doorway gaps. Build segments between doors.
  const rightX = HALL_WIDTH / 2 + WALL_T / 2;
  const doorZs = plan.doors.map(d => d.hallZ).sort((a, b) => b - a); // +z → -z
  let cursor = plan.hallStartZ + 3;
  const halfDoor = DOOR_W / 2;
  const labelGroup = new THREE.Group();
  group.add(labelGroup);

  const segments = [];
  for (const z of doorZs) { segments.push([cursor, z + halfDoor]); cursor = z - halfDoor; }
  segments.push([cursor, plan.hallEndZ - 3]);
  for (const [zA, zB] of segments) {
    const len = Math.abs(zA - zB);
    if (len < 0.05) continue;
    addWallBox(rightX, (zA + zB) / 2, WALL_T, len, wallMat(HALL_WALL));
  }
  // Lintel above each doorway so the gap is a doorway, not a full slot.
  for (const d of plan.doors) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, HALL_HEIGHT - DOOR_H, DOOR_W),
      wallMat(HALL_WALL));
    lintel.position.set(rightX, DOOR_H + (HALL_HEIGHT - DOOR_H) / 2, d.hallZ);
    group.add(lintel);
  }

  // Per-door era label (glowing CanvasTexture) above each doorway, facing the
  // hall. Each label/doorway also gets an additive glow sprite (cheap bloom)
  // whose breathing is animated in main.js via the returned `doorGlows` map.
  const doorLabels = {};
  const doorGlows = {};
  for (const d of plan.doors) {
    const ch = CHAPTERS[d.index];
    const tex = makeLabelTexture(d.label, d.years, ch.palette.accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), mat);
    // sit on the hall side of the +X wall, facing -X (into the hall)
    plane.position.set(HALL_WIDTH / 2 - 0.02, DOOR_H + 0.45, d.hallZ);
    plane.rotation.y = -Math.PI / 2;
    labelGroup.add(plane);
    doorLabels[d.id] = plane;

    // A warm glow strip framing the doorway.
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ch.palette.accent), transparent: true, opacity: 0.4 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 0.2, DOOR_H + 0.2), glowMat);
    glow.position.set(HALL_WIDTH / 2 - 0.03, DOOR_H / 2, d.hallZ);
    glow.rotation.y = -Math.PI / 2;
    labelGroup.add(glow);

    // Additive bloom-glow sprite over the label so the doorway "pops".
    const bloom = makeGlowSprite(ch.palette.accent, 4.2, 0.5);
    bloom.position.set(HALL_WIDTH / 2 - 0.05, DOOR_H + 0.45, d.hallZ);
    labelGroup.add(bloom);
    doorGlows[d.id] = { sprite: bloom, strip: glow, baseOpacity: 0.5, phase: d.index * 1.3 };
  }

  // Warm hall point-lights along the ceiling so the corridor reads lit (these
  // are flickered/breathed in main.js). One light near every other doorway.
  const hallLights = [];
  for (let i = 0; i < plan.doors.length; i += 2) {
    const z = plan.doors[i].hallZ;
    const lamp = new THREE.PointLight(new THREE.Color('#ffce8a'), 14, 22, 2);
    lamp.position.set(-HALL_WIDTH / 2 + 1.0, HALL_HEIGHT - 0.4, z);
    group.add(lamp);
    const bulb = makeGlowSprite('#ffce8a', 1.6, 0.45);
    bulb.position.copy(lamp.position);
    group.add(bulb);
    hallLights.push({ light: lamp, sprite: bulb, base: 14, phase: i * 0.9 });
  }

  // Dust motes drifting down the length of the hall (denser near the lit end).
  const moteCount = (quality && quality.fillLight) ? 220 : 90;
  const motes = makeMoteField(
    { x: 0, y: 0.4, z: hallMidZ },
    { x: HALL_WIDTH / 2 - 0.6, y: HALL_HEIGHT / 2, z: hallLen / 2 },
    moteCount, '#f2d9a0', { size: 0.18, opacity: 0.5 });
  group.add(motes.points);

  return { group, plan, walls, doorLabels, doorGlows, hallLights, motes, labelGroup };
}

/** Collision predicate factory: blocks if (x,z) is inside any wall AABB (+ player radius). */
export function makeCollider(walls, radius = 0.35) {
  return (x, z) => {
    for (const w of walls) {
      if (x > w.minX - radius && x < w.maxX + radius &&
          z > w.minZ - radius && z < w.maxZ + radius) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Build one era room as a self-contained group (lit box tinted with the era
 * palette + a couple of procedural props + memory objects as glowing labeled
 * shapes + an exit marker). Returns { group, interactables, exit, walls }.
 * Memory objects carry { id, beat, mesh, worldPos, kind:'memory' }.
 */
export function buildRoom(chapter, anchor, quality) {
  const g = new THREE.Group();
  g.name = 'room-' + chapter.id;
  const cx = anchor.x, cz = anchor.z;
  const half = ROOM_SIZE / 2;
  const p = chapter.palette;

  // Brighten the very-dark palette wall/floor colours so mid surfaces are not
  // near-black, while keeping each era's hue. (Original palettes were tuned for
  // a much dimmer look.) lighten() scales each channel toward white.
  const wallCol = lighten(p.wall1, 1.7);
  const floorCol = lighten(p.floor, 2.3);
  const ceilCol = lighten(p.wall2, 1.9);

  const walls = [];
  const addRoomWall = (ox, oz, sx, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, HALL_HEIGHT, sz),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(wallCol), roughness: 0.9, metalness: 0.02 }));
    m.position.set(cx + ox, HALL_HEIGHT / 2, cz + oz);
    m.receiveShadow = true;
    g.add(m);
    walls.push({ minX: cx + ox - sx / 2, maxX: cx + ox + sx / 2, minZ: cz + oz - sz / 2, maxZ: cz + oz + sz / 2 });
  };

  // Floor + ceiling tinted by palette (brightened).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(floorCol), roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(ceilCol), roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, HALL_HEIGHT, cz);
  g.add(ceil);

  // Four walls; leave a gap on the -X side (facing the hall) for the entrance/exit.
  const t = 0.3;
  addRoomWall(0, -half, ROOM_SIZE, t);       // far -z
  addRoomWall(0, half, ROOM_SIZE, t);        // near +z
  addRoomWall(half, 0, t, ROOM_SIZE);        // +x
  // -x wall split around the doorway (the door faces back toward the hall).
  const doorGap = DOOR_W;
  const segLen = (ROOM_SIZE - doorGap) / 2;
  addRoomWall(-half, -(doorGap / 2 + segLen / 2), t, segLen);
  addRoomWall(-half, (doorGap / 2 + segLen / 2), t, segLen);

  // Procedural props: a warm rug + two pedestals (flavour, palette-tinted).
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(p.frame), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.01, cz); rug.receiveShadow = true;
  g.add(rug);
  for (const dx of [-2.6, 2.6]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 16),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(p.wall1), roughness: 0.8 }));
    ped.position.set(cx + dx, 0.5, cz - 3.4); ped.castShadow = true; ped.receiveShadow = true;
    g.add(ped);
  }

  // Per-room warm point light (intensity is breathed/flickered in main.js via
  // the returned `lamp`/`lampBase` handle). Brightened from 26.
  const lamp = new THREE.PointLight(new THREE.Color(p.accent), 34, 30, 2);
  lamp.position.set(cx, HALL_HEIGHT - 0.6, cz);
  if (quality && quality.shadows) { lamp.castShadow = true; lamp.shadow.mapSize.set(quality.shadowMapSize || 512, quality.shadowMapSize || 512); }
  g.add(lamp);
  const lampGlow = makeGlowSprite(p.accent, 2.6, 0.5);
  lampGlow.position.copy(lamp.position);
  g.add(lampGlow);
  const ambient = new THREE.AmbientLight(new THREE.Color(lighten(p.wall1, 1.6)), 1.2);
  g.add(ambient);

  // Memory objects: glowing labeled shapes arranged in an arc on the far wall.
  const interactables = [];
  const n = chapter.beats.length;
  chapter.beats.forEach((beat, i) => {
    const t2 = n <= 1 ? 0.5 : i / (n - 1);
    const mx = cx - (ROOM_SIZE / 2 - 1.6) + t2 * (ROOM_SIZE - 3.2);
    const mz = cz - half + 1.2 + (i % 2) * 0.6;
    const my = 1.5;

    const objGroup = new THREE.Group();
    const accent = new THREE.Color(p.accent);
    const geo = (i % 3 === 0)
      ? new THREE.IcosahedronGeometry(0.32, 0)
      : (i % 3 === 1) ? new THREE.BoxGeometry(0.5, 0.5, 0.5)
      : new THREE.OctahedronGeometry(0.36, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: accent, emissive: accent, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3,
    });
    const shape = new THREE.Mesh(geo, mat);
    shape.castShadow = true;
    objGroup.add(shape);

    // additive glow halo so the memory object reads as a glowing artefact
    const halo = makeGlowSprite(p.accent, 1.3, 0.45);
    objGroup.add(halo);

    // floating label sprite above the shape
    const label = makeTextSprite(beat.title, '#f0e2c2', 0.8);
    label.position.set(0, 0.7, 0);
    objGroup.add(label);

    objGroup.position.set(mx, my, mz);
    g.add(objGroup);

    interactables.push({
      kind: 'memory',
      id: beat.id,
      beat,
      chapterId: chapter.id,
      group: objGroup,
      mesh: shape,
      halo,
      worldPos: { x: mx, y: my, z: mz },
      baseY: my,
    });
  });

  // Room dust motes (warmly tinted by the era accent; fewer on mobile).
  const roomMoteCount = (quality && quality.fillLight) ? 120 : 50;
  const motes = makeMoteField(
    { x: cx, y: 0.4, z: cz },
    { x: half - 0.8, y: HALL_HEIGHT / 2, z: half - 0.8 },
    roomMoteCount, p.accent, { size: 0.16, opacity: 0.45 });
  g.add(motes.points);

  // Exit marker: a glowing portal plane at the -X doorway facing into the room.
  const exitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8d9b8'), transparent: true, opacity: 0.4 });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), exitMat);
  exit.position.set(cx - half + 0.05, DOOR_H / 2, cz);
  exit.rotation.y = Math.PI / 2;
  g.add(exit);
  const exitLabel = makeTextSprite('exit', '#f0e2c2', 0.7);
  exitLabel.position.set(cx - half + 0.4, DOOR_H + 0.4, cz);
  g.add(exitLabel);

  const exitPos = { x: cx - half + 0.6, y: DOOR_H / 2, z: cz };

  return {
    group: g, interactables, exitPos, walls,
    anchor: { x: cx, y: 0, z: cz },
    lamp, lampBase: 34, lampGlow, motes,
  };
}
