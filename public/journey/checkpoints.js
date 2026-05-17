/**
 * journey/checkpoints.js — chapter waypoint geometry. Redesigned: no
 * pillars, no arches (those were walls dominating the player's frame).
 * Each chapter is now a single big glowing ring at lane center + a flat
 * disc of light on the ground beneath it. Reads as a "quest waypoint"
 * (Hollow Knight bench, Hades exit door) rather than architecture.
 *
 * Returns { ch, group, ring, pool, ringMat } so the main loop can
 * animate the ring rotation + bob, detect collection, and shrink the
 * pool when collected.
 */
import * as THREE from 'three';

// shared geometry across all 6 checkpoints
const RING_GEOM = new THREE.TorusGeometry(2.4, 0.28, 14, 32);
const POOL_GEOM = new THREE.CircleGeometry(5, 32);

export function buildCheckpoint(ch) {
    const group = new THREE.Group();

    // big rotating ring · the player walks THROUGH this · stronger emissive
    // intensity than the old version so it reads as the primary visual
    // landmark for the chapter (no pillars to compete with it)
    const ringMat = new THREE.MeshStandardMaterial({
        color: ch.lootColor,
        emissive: ch.lootColor,
        emissiveIntensity: 1.6,
        roughness: 0.2,
        metalness: 0.6,
    });
    const ring = new THREE.Mesh(RING_GEOM, ringMat);
    ring.position.set(0, 2.4, 0);
    ring.rotation.x = Math.PI / 2;

    // ground pool · flat disc of soft glow, color-matched. Builds anticipation
    // as the player approaches (it's visible from far away, low to the ground)
    const poolMat = new THREE.MeshBasicMaterial({
        color: ch.lootColor,
        transparent: true,
        opacity: 0.45,
    });
    const pool = new THREE.Mesh(POOL_GEOM, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;     // tiny lift to avoid z-fighting with the road
    pool.receiveShadow = false;

    // point light · drives bloom + casts a tinted glow on nearby geometry
    const pl = new THREE.PointLight(ch.color, 2.0, 18);
    pl.position.set(0, 3, 0);

    group.add(ring, pool, pl);
    group.position.z = ch.z;

    return { ch, group, ring, pool, ringMat, poolMat };
}

export function buildAllCheckpoints(chapters, scene) {
    const out = [];
    for (const ch of chapters) {
        const cp = buildCheckpoint(ch);
        scene.add(cp.group);
        out.push(cp);
    }
    return out;
}
