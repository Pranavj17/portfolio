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

  // Floor + ceiling (no collision boxes — handled by Y).
  const floorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2c2116'), roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, hallLen + 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, hallMidZ);
  floor.receiveShadow = true;
  group.add(floor);

  const ceilMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d150d'), roughness: 1 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, hallLen + 6), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, HALL_HEIGHT, hallMidZ);
  group.add(ceil);

  // Left wall (solid) at x = -HALL_WIDTH/2.
  addWallBox(-HALL_WIDTH / 2 - WALL_T / 2, hallMidZ, WALL_T, hallLen + 6, wallMat('#2a1d10'));
  // End cap walls.
  addWallBox(0, plan.hallStartZ + 3, HALL_WIDTH + WALL_T * 2, WALL_T, wallMat('#2a1d10'));
  addWallBox(0, plan.hallEndZ - 3, HALL_WIDTH + WALL_T * 2, WALL_T, wallMat('#2a1d10'));

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
    addWallBox(rightX, (zA + zB) / 2, WALL_T, len, wallMat('#2a1d10'));
  }
  // Lintel above each doorway so the gap is a doorway, not a full slot.
  for (const d of plan.doors) {
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_T, HALL_HEIGHT - DOOR_H, DOOR_W),
      wallMat('#2a1d10'));
    lintel.position.set(rightX, DOOR_H + (HALL_HEIGHT - DOOR_H) / 2, d.hallZ);
    group.add(lintel);
  }

  // Per-door era label (glowing CanvasTexture) above each doorway, facing the hall.
  const doorLabels = {};
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
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ch.palette.accent), transparent: true, opacity: 0.35 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 0.2, DOOR_H + 0.2), glowMat);
    glow.position.set(HALL_WIDTH / 2 - 0.03, DOOR_H / 2, d.hallZ);
    glow.rotation.y = -Math.PI / 2;
    labelGroup.add(glow);
  }

  return { group, plan, walls, doorLabels, labelGroup };
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

  const walls = [];
  const addRoomWall = (ox, oz, sx, sz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, HALL_HEIGHT, sz), wallMat(p.wall1));
    m.position.set(cx + ox, HALL_HEIGHT / 2, cz + oz);
    m.receiveShadow = true;
    g.add(m);
    walls.push({ minX: cx + ox - sx / 2, maxX: cx + ox + sx / 2, minZ: cz + oz - sz / 2, maxZ: cz + oz + sz / 2 });
  };

  // Floor + ceiling tinted by palette.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(p.floor), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz); floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(p.wall2), roughness: 1 }));
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

  // Per-room warm point light.
  const lamp = new THREE.PointLight(new THREE.Color(p.accent), 26, 28, 2);
  lamp.position.set(cx, HALL_HEIGHT - 0.6, cz);
  if (quality && quality.shadows) { lamp.castShadow = true; lamp.shadow.mapSize.set(quality.shadowMapSize || 512, quality.shadowMapSize || 512); }
  g.add(lamp);
  const ambient = new THREE.AmbientLight(new THREE.Color(p.wall1), 0.95);
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
      worldPos: { x: mx, y: my, z: mz },
      baseY: my,
    });
  });

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

  return { group: g, interactables, exitPos, walls, anchor: { x: cx, y: 0, z: cz } };
}
