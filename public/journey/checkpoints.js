/**
 * journey/checkpoints.js — chapter checkpoint geometry. Each chapter becomes
 * two glowing pillars flanking the road + an arch beam connecting them +
 * a rotating loot ring floating at center height + a point light driving
 * the bloom glow.
 *
 * Returns an array of { ch, group, ring, pillarMat } so the main loop
 * can animate the ring, detect collection collisions, and update materials.
 *
 * Geometry sharing optimization:
 *   - all 12 pillars (6 chapters × 2 each) share the same BoxGeometry
 *   - all 6 arch beams share a single BoxGeometry
 *   - all 6 rings share a single TorusGeometry
 *   - only materials are per-chapter (so each chapter has its own colour)
 */
import * as THREE from 'three';

const PILLAR_GEOM = new THREE.BoxGeometry(2, 14, 2);
const ARCH_GEOM   = new THREE.BoxGeometry(18, 0.6, 0.6);
const RING_GEOM   = new THREE.TorusGeometry(1.2, 0.18, 12, 24);

/** build a single chapter checkpoint group at z = ch.z */
export function buildCheckpoint(ch) {
    const group = new THREE.Group();

    const pillarMat = new THREE.MeshStandardMaterial({
        color: ch.color,
        emissive: ch.color,
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.7,
    });

    const pillarL = new THREE.Mesh(PILLAR_GEOM, pillarMat);
    pillarL.position.set(-7, 7, 0);
    pillarL.castShadow = true;

    const pillarR = new THREE.Mesh(PILLAR_GEOM, pillarMat);
    pillarR.position.set(7, 7, 0);
    pillarR.castShadow = true;

    const arch = new THREE.Mesh(ARCH_GEOM, pillarMat);
    arch.position.set(0, 13, 0);
    arch.castShadow = true;

    const ringMat = new THREE.MeshStandardMaterial({
        color: ch.lootColor,
        emissive: ch.lootColor,
        emissiveIntensity: 1.0,
        roughness: 0.2,
        metalness: 0.6,
    });
    const ring = new THREE.Mesh(RING_GEOM, ringMat);
    ring.position.set(0, 3, 0);
    ring.rotation.x = Math.PI / 2;

    // point light · drives bloom around the arch
    const pl = new THREE.PointLight(ch.color, 1.4, 30);
    pl.position.set(0, 10, 0);

    group.add(pillarL, pillarR, arch, ring, pl);
    group.position.z = ch.z;

    return { ch, group, ring, pillarMat, ringMat };
}

/** build all checkpoints from CHAPTERS data + attach to scene */
export function buildAllCheckpoints(chapters, scene) {
    const out = [];
    for (const ch of chapters) {
        const cp = buildCheckpoint(ch);
        scene.add(cp.group);
        out.push(cp);
    }
    return out;
}
