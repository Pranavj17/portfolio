/**
 * the journey · WebGL 3D rebuild (Three.js)
 * ─────────────────────────────────────────────────────────────────
 * Entry point that wires the module tree:
 *   journey/data.js         chapter + vehicle constants
 *   journey/scene.js        renderer, scene, camera, lights, ground
 *   journey/post.js         post-processing (UnrealBloomPass)
 *   journey/meshes.js       procedural meshes (player + vehicles)
 *   journey/checkpoints.js  per-chapter pillar+arch+ring geometry
 *   journey/hud.js          DOM overlay updates (cached refs)
 *
 * The animation loop lives in this file because vehicle progression +
 * collection collisions + camera follow + glitch state are cross-cutting
 * concerns that touch multiple modules.
 *
 * Pre-allocation optimization:
 *   - tmpVec3 / tmpColor are module-level scratch objects reused per frame
 *     instead of `new THREE.Vector3()` inside the loop (avoid GC pressure)
 *   - bloom strength is just a number mutation per frame, no allocations
 *   - DOM lookups all happen at hud.js module load · loop never touches DOM
 *     except inside showAchievement (transitions only, not every frame)
 */
import * as THREE from 'three';
import { CHAPTERS, VEHICLES, VEHICLE_THRESHOLDS, CHAPTER_ACHIEVEMENTS, VEHICLE_ACHIEVEMENTS } from './journey/data.js';
import { buildRenderer, buildScene, buildCamera, addLights, addGround, attachResize } from './journey/scene.js';
import { buildComposer } from './journey/post.js';
import { buildWalkerMesh, buildBicycleMesh, buildAltoMesh, buildVWMesh } from './journey/meshes.js';
import { buildAllCheckpoints } from './journey/checkpoints.js';
import { updateProgress, updateVehicleCard, showAchievement, showEndCard } from './journey/hud.js';

// ── scene + post-processing assembly ─────────────────────────────
const canvas    = document.getElementById('stage');
const renderer  = buildRenderer(canvas);
const scene     = buildScene();
const camera    = buildCamera();
const { sun }   = addLights(scene);
addGround(scene);

const { composer, bloomPass } = buildComposer(renderer, scene, camera);
attachResize(renderer, camera, composer, bloomPass);

// ── chapter checkpoints ──────────────────────────────────────────
const checkpoints = buildAllCheckpoints(CHAPTERS, scene);

// ── player + vehicle meshes (built once, swapped in/out of player group) ─
const player = new THREE.Group();
scene.add(player);
const walkerMesh  = buildWalkerMesh();
const bicycleMesh = buildBicycleMesh();
const altoMesh    = buildAltoMesh();
const vwMesh      = buildVWMesh();
player.add(walkerMesh);
let currentVehicle = 'walk';
let currentVehicleMesh = walkerMesh;       // cached · avoids brittle player.children[0] lookup

function setVehicle(name) {
    if (name === currentVehicle) return;
    player.clear();
    let mesh;
    if      (name === 'cycle') mesh = bicycleMesh;
    else if (name === 'alto')  mesh = altoMesh;
    else if (name === 'vw')    mesh = vwMesh;
    else                        mesh = walkerMesh;
    player.add(mesh);
    currentVehicle     = name;
    currentVehicleMesh = mesh;
    updateVehicleCard(name);
    const aId = VEHICLE_ACHIEVEMENTS[name];
    if (aId) showAchievement(aId, state.achievements);
}

// ── game state ───────────────────────────────────────────────────
const state = {
    running:       false,
    ended:         false,
    chapter:       0,
    collected:     new Set(),
    achievements:  new Set(),
    t:             0,
    glitchT:       0,
};

// auto-start after splash · 3400ms = CSS 2700ms delay + 700ms fade duration.
// Previous 3000ms started the player while the splash was still 57% visible.
setTimeout(() => { state.running = true; }, 3400);

// glitch trigger · pumps bloom strength briefly. No user input wires it
// anymore (Z key/button removed) · still fired internally on loot collect
// so the bloom pulse remains as an organic milestone-celebration effect.
function triggerGlitch(ms) { state.glitchT = Math.max(state.glitchT, ms); }

/** trigger cinematic letterbox bars · briefly close + retract during
 *  chapter entry. Adds the RDR-style "title card" cinematic feel. */
let letterboxTimer = null;
function triggerLetterbox(holdMs) {
    if (letterboxTimer) clearTimeout(letterboxTimer);
    document.body.classList.add('cinematic');
    letterboxTimer = setTimeout(() => {
        document.body.classList.remove('cinematic');
        letterboxTimer = null;
    }, holdMs || 1200);
}

// ── pre-allocated scratch objects · reused inside animate() ──────
const tmpFogTarget = new THREE.Color();
const tmpFogBase   = new THREE.Color(0x3d2818);   // sepia base (RDR fog)
const tmpCamTarget = new THREE.Vector3();
const tmpLookAt    = new THREE.Vector3();

// caches that gate per-frame work to actual change events
const RING_FLOOR_Y = 60;     // ring stops flying once past this y · prevents
                              // unbounded scale → denormalized-float GPU slow path

// scratch color objects for proximity-blended fog (one per chapter)
const chapterColors = CHAPTERS.map((ch) => new THREE.Color(ch.color));
const fogBlend     = new THREE.Color();
const fogContrib   = new THREE.Color();

// ── initial HUD paint ───────────────────────────────────────────
updateProgress(0, state.collected);
updateVehicleCard('walk');

// ── animation loop ──────────────────────────────────────────────
let lastT = performance.now();
function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(48, now - lastT);
    lastT = now;
    state.t += dt;
    const f = dt / 16.67;     // frame-rate-independence multiplier (1.0 @ 60Hz)

    if (state.running && !state.ended) {
        // forward motion · speed scales with vehicle
        const v = VEHICLES[currentVehicle];
        player.position.z += v.speed * f;

        // vehicle-progression state machine · driven by z + collected
        let want;
        if      (state.collected.has('vwgt'))                       want = 'vw';
        else if (player.position.z >= VEHICLE_THRESHOLDS.alto)       want = 'alto';
        else if (player.position.z >= VEHICLE_THRESHOLDS.cycle)      want = 'cycle';
        else                                                          want = 'walk';
        if (want !== currentVehicle) setVehicle(want);

        // walking leg-swing animation (only while on foot)
        if (currentVehicle === 'walk') {
            const phase = Math.sin(state.t * 0.012) * 0.4;
            if (walkerMesh._legL) walkerMesh._legL.rotation.x = phase;
            if (walkerMesh._legR) walkerMesh._legR.rotation.x = -phase;
            walkerMesh.position.y = Math.abs(Math.sin(state.t * 0.012)) * 0.06;
        }
        // wheel spin · cached vehicle mesh ref · not brittle children[0] lookup
        if (currentVehicleMesh && currentVehicleMesh._wheels) {
            const spin = 0.4 * f;
            const wheels = currentVehicleMesh._wheels;
            for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
        }

        // checkpoint loop · collision detect + ring animation
        for (let i = 0; i < checkpoints.length; i++) {
            const cp = checkpoints[i];
            const dz = cp.group.position.z - player.position.z;
            // collect when close enough
            if (!state.collected.has(cp.ch.id) && Math.abs(dz) < 3 && Math.abs(player.position.x) < 5) {
                state.collected.add(cp.ch.id);
                state.chapter = i;
                updateProgress(i, state.collected);
                const aId = CHAPTER_ACHIEVEMENTS[cp.ch.id];
                if (aId) showAchievement(aId, state.achievements);
                cp.ring.userData.collected = true;
                triggerGlitch(160);
                triggerLetterbox(1100);     // RDR cinematic chapter-card moment
            }
            // ring animation · the only on-canvas chapter signal now (pillars
            // are gone). Stronger emission means the ring carries more
            // visual weight, so the bob/rotate has more importance.
            cp.ring.rotation.z += 0.025 * f;
            if (cp.ring.userData.collected) {
                // capped fly-away · avoids denormalized-float GPU slow path
                if (cp.ring.position.y < RING_FLOOR_Y) {
                    cp.ring.position.y += 0.12 * f;
                    cp.ring.scale.multiplyScalar(Math.pow(0.98, f));
                    if (cp.ring.scale.x < 0.02) cp.ring.visible = false;
                }
                // ground pool fades out alongside the ring
                if (cp.poolMat && cp.poolMat.opacity > 0.01) {
                    cp.poolMat.opacity *= Math.pow(0.97, f);
                    if (cp.poolMat.opacity < 0.02) cp.pool.visible = false;
                }
            } else {
                // gentle bob at the new ring height (y=2.4 in checkpoints.js)
                cp.ring.position.y = 2.4 + Math.sin(state.t * 0.003 + i) * 0.18;
                // pool subtly pulses (breathe effect on the ground glow)
                if (cp.poolMat) {
                    cp.poolMat.opacity = 0.4 + Math.sin(state.t * 0.003 + i) * 0.08;
                }
            }
        }

        // fog + sky · PROXIMITY-WEIGHTED blend of all chapters' colors.
        // Each chapter contributes weight proportional to 1/distance², so
        // as the player approaches Fever 104 its pink contribution rises
        // smoothly (no waiting for "collected" state to update). Old code
        // only changed fog when state.chapter flipped, producing the
        // visible discontinuity the user reported between college and FM.
        let wSum = 0;
        fogBlend.set(0, 0, 0);
        for (let i = 0; i < CHAPTERS.length; i++) {
            const dz = CHAPTERS[i].z - player.position.z;
            // weight peaks at the chapter z · drops off with distance²
            const w = 1 / (1 + (dz * dz) * 0.003);
            wSum += w;
            fogContrib.copy(chapterColors[i]).multiplyScalar(w);
            fogBlend.add(fogContrib);
        }
        if (wSum > 0) fogBlend.multiplyScalar(1 / wSum);
        // mix in 18% of the weighted-chapter color with the deep-bg base
        tmpFogTarget.copy(tmpFogBase).lerp(fogBlend, 0.18);
        scene.fog.color.lerp(tmpFogTarget, 0.08 * f);
        scene.background.copy(scene.fog.color).multiplyScalar(0.7);

        // camera follow · tighter rig framing the player. Previous shot was
        // looking 4 units FORWARD of player which pushed the player to the
        // bottom of the frame (where the vehicle card was covering them).
        // New shot: closer (z-7), lower (y=3), looks at the player's chest
        // (player.y + 1.2) so the player + their vehicle become the focal
        // subject. Lerp factor scaled by f for 120Hz device parity.
        tmpCamTarget.set(0, 3, player.position.z - 7);
        camera.position.lerp(tmpCamTarget, 0.08 * f);
        tmpLookAt.set(player.position.x, player.position.y + 1.2, player.position.z + 0.5);
        camera.lookAt(tmpLookAt);

        // sun follows player so the shadow frustum doesn't strand them.
        // Without this, once player.z > ~50 they exit the shadow camera's
        // bounds (-50..+50) and lose shadows entirely.
        sun.position.z = player.position.z + 30;
        sun.target.position.z = player.position.z;
        sun.target.updateMatrixWorld();

        // end-state · past the final checkpoint with all loot
        if (state.collected.size >= CHAPTERS.length &&
            player.position.z > CHAPTERS[CHAPTERS.length - 1].z + 10) {
            state.ended = true;
            showEndCard();
        }
    }

    // glitch effect · pump bloom briefly when triggered
    if (state.glitchT > 0) {
        state.glitchT = Math.max(0, state.glitchT - dt);
        bloomPass.strength = 0.95 + (state.glitchT / 280) * 1.4;
    } else if (bloomPass.strength !== 0.95) {
        bloomPass.strength = 0.95;
    }

    composer.render();
}
requestAnimationFrame(animate);

// expose for debugging from devtools
window.__journey = { scene, camera, renderer, player, state, CHAPTERS, setVehicle };
