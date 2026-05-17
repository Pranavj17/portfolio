/**
 * journey/meshes.js — procedural mesh builders for the player + vehicles.
 * No GLB models · everything is composed from primitives (capsule, box,
 * cylinder, torus, sphere). The result reads as stylized low-poly indie
 * 3D, similar to Mini Metro × Monument Valley × Inside.
 *
 * Optimizations:
 *   - geometries shared across instances where they're identical (e.g.
 *     all four Alto wheels reuse the same CylinderGeometry)
 *   - materials defined inline · Three.js dedups equivalent materials
 *     internally when they don't share state
 *   - meshes only cast shadows when meaningful (head + body cast; small
 *     accessories don't — saves ~6 shadow-map draw calls per frame)
 *
 * Lifetime contract: all geometries + materials defined in this module
 * persist for the page lifetime. setVehicle() in journey.js detaches
 * meshes from the player group via player.clear() but does NOT dispose
 * them — the same mesh instance is re-added later if the player ever
 * goes back to that vehicle. Do not call .dispose() on anything here.
 */
import * as THREE from 'three';

// shared geometries reused across meshes
const HEAD_GEOM   = new THREE.SphereGeometry(0.32, 12, 10);
const BODY_GEOM   = new THREE.CapsuleGeometry(0.32, 0.85, 4, 8);
const PACK_GEOM   = new THREE.BoxGeometry(0.5, 0.7, 0.25);
const LEG_GEOM    = new THREE.CapsuleGeometry(0.13, 0.55, 4, 6);
const BIKE_WHEEL  = new THREE.TorusGeometry(0.55, 0.10, 8, 18);
const ALTO_WHEEL  = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14);
const VW_WHEEL    = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);

/** humanoid walker · stick-ish character built from primitives.
 *  Exposes _legL / _legR for the animation loop to swing during walk. */
export function buildWalkerMesh() {
    const g = new THREE.Group();
    // RDR-palette materials: tan skin · earthy-brown cloth · leather backpack
    const skin  = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.75 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.7 });
    const bag   = new THREE.MeshStandardMaterial({ color: 0x8b4a1f, roughness: 0.6, emissive: 0x2a0e04, emissiveIntensity: 0.15 });

    const head = new THREE.Mesh(HEAD_GEOM, skin);
    head.position.y = 1.85; head.castShadow = true;

    const body = new THREE.Mesh(BODY_GEOM, cloth);
    body.position.y = 1.1; body.castShadow = true;

    const pack = new THREE.Mesh(PACK_GEOM, bag);
    pack.position.set(0, 1.18, -0.32); pack.castShadow = true;

    const legL = new THREE.Mesh(LEG_GEOM, cloth);
    legL.position.set(-0.15, 0.4, 0); legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.15;

    g.add(head, body, pack, legL, legR);
    g._legL = legL;
    g._legR = legR;
    return g;
}

/** bicycle · 2 torus wheels + cylinder frame · rider mounted from buildWalkerMesh */
export function buildBicycleMesh() {
    const g = new THREE.Group();
    // RDR palette · brass/copper bicycle frame instead of neon cyan
    const frame = new THREE.MeshStandardMaterial({ color: 0xc47540, roughness: 0.35, metalness: 0.75, emissive: 0x3a1a08, emissiveIntensity: 0.25 });
    const tire  = new THREE.MeshStandardMaterial({ color: 0x141008, roughness: 0.9 });

    const wL = new THREE.Mesh(BIKE_WHEEL, tire);
    wL.position.set(0, 0.55, -0.7); wL.rotation.y = Math.PI / 2; wL.castShadow = true;
    const wR = new THREE.Mesh(BIKE_WHEEL, tire);
    wR.position.set(0, 0.55, 0.7);  wR.rotation.y = Math.PI / 2; wR.castShadow = true;

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), frame);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.85;

    const rider = buildWalkerMesh();
    rider.position.y = 0.2;
    rider.scale.set(0.95, 0.85, 0.95);

    g.add(wL, wR, bar, rider);
    g._wheels = [wL, wR];
    return g;
}

/** Maruti Alto · small hatchback. Box body + 4 cylinder wheels. */
export function buildAltoMesh() {
    const g = new THREE.Group();
    const body  = new THREE.MeshStandardMaterial({ color: 0xffd47a, roughness: 0.4, metalness: 0.6, emissive: 0x332100, emissiveIntensity: 0.25 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a1820, roughness: 0.2, metalness: 0.8 });
    const tire  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 3.6), body);
    base.position.y = 0.55; base.castShadow = true;

    const cab  = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.9), body);
    cab.position.set(0, 1.15, -0.1); cab.castShadow = true;

    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.6), glass);
    wind.position.set(0, 1.18, -0.05);

    const wPositions = [[-1.0, 0.4, -1.2], [1.0, 0.4, -1.2], [-1.0, 0.4, 1.2], [1.0, 0.4, 1.2]];
    const wheels = wPositions.map((p) => {
        const w = new THREE.Mesh(ALTO_WHEEL, tire);
        w.position.set(...p);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        return w;
    });

    g.add(base, cab, wind);
    g._wheels = wheels;
    return g;
}

/** VW Virtus GT · longer + lower than Alto, GT-pink tail accent for glow */
export function buildVWMesh() {
    const g = new THREE.Group();
    const body  = new THREE.MeshStandardMaterial({ color: 0xff5e5e, roughness: 0.3, metalness: 0.85, emissive: 0x330808, emissiveIntensity: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x040810, roughness: 0.1, metalness: 0.95 });
    const tire  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 4.4), body);
    base.position.y = 0.5; base.castShadow = true;

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 2.2), body);
    cab.position.set(0, 1.05, -0.1); cab.castShadow = true;

    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), glass);
    wind.position.set(0, 1.08, -0.05);

    // GT-red emissive tail bar (drives bloom · this is the visible "GT" hint)
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3b8a, emissive: 0xff3b8a, emissiveIntensity: 1.2 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.06), tailMat);
    tail.position.set(0, 0.78, 2.18);

    const wPositions = [[-1.1, 0.42, -1.5], [1.1, 0.42, -1.5], [-1.1, 0.42, 1.5], [1.1, 0.42, 1.5]];
    const wheels = wPositions.map((p) => {
        const w = new THREE.Mesh(VW_WHEEL, tire);
        w.position.set(...p);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        return w;
    });

    g.add(base, cab, wind, tail);
    g._wheels = wheels;
    return g;
}
