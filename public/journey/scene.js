/**
 * journey/scene.js — renderer, scene, camera, lighting, ground plane,
 * resize handler. Returns the constructed objects so other modules can
 * attach children and the entry point can run the render loop.
 *
 * Optimizations applied here:
 *   - shadow-map resolution adapts to viewport area · mobile gets 512,
 *     desktop gets 1024 (shadow quality vs frame rate)
 *   - pixel-ratio capped at 2 on high-DPR mobile to keep fragment count
 *     manageable (a 3x DPR iPhone otherwise renders 9 fragments per CSS px)
 *   - antialias disabled on very small viewports (mobile · bloom blurs
 *     edges enough that AA is invisible)
 *   - single shared ground texture · built once, reused for the whole plane
 */
import * as THREE from 'three';
import { isMobile, renderPixelRatio } from './env.js';

export function buildRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile,                       // skip AA on mobile · bloom hides aliasing
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(renderPixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace  = THREE.SRGBColorSpace;
    return renderer;
}

export function buildScene() {
    const scene = new THREE.Scene();
    // RDR sepia · dark mahogany base · proximity fog adds the warm dust feel
    scene.background = new THREE.Color(0x1f1610);
    scene.fog = new THREE.FogExp2(0x3d2818, 0.011);
    return scene;
}

export function buildCamera() {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        600,
    );
    camera.position.set(0, 5, -10);
    return camera;
}

export function addLights(scene) {
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    const shadowSize = isMobile ? 512 : 1024;
    sun.shadow.mapSize.width  = shadowSize;
    sun.shadow.mapSize.height = shadowSize;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 200;
    sun.shadow.camera.left   = -50;
    sun.shadow.camera.right  =  50;
    sun.shadow.camera.top    =  50;
    sun.shadow.camera.bottom = -50;
    scene.add(sun);
    // sun.target must be parented to the scene for the main loop's
    // sun.target.position.z = player.position.z updates to actually
    // drive the shadow direction. Detached targets don't get matrixWorld'd.
    scene.add(sun.target);

    const ambient = new THREE.AmbientLight(0x607080, 0.6);
    scene.add(ambient);
    return { sun, ambient };
}

/** dirt-trail texture · RDR western road feel. Warm sand base with
 *  occasional darker ruts running lengthwise, no grid lines. */
function makeTrailTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 1024;            // long + thin · matches a road
    const g = c.getContext('2d');
    // base dirt color
    g.fillStyle = '#3a2a1a';
    g.fillRect(0, 0, c.width, c.height);
    // subtle warmer noise via random dots
    for (let i = 0; i < 1800; i++) {
        const x = Math.random() * c.width;
        const y = Math.random() * c.height;
        const a = 0.04 + Math.random() * 0.08;
        g.fillStyle = `rgba(200,160,100,${a})`;
        g.fillRect(x, y, 1.5, 1.5);
    }
    // two darker wheel ruts running lengthwise
    g.strokeStyle = 'rgba(20,12,6,0.35)';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(96,  0); g.lineTo(96,  c.height); g.stroke();
    g.beginPath(); g.moveTo(160, 0); g.lineTo(160, c.height); g.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 80);
    return tex;
}

export function addGround(scene) {
    const groundMat = new THREE.MeshStandardMaterial({
        map: makeTrailTexture(),
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 1200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 250;
    ground.receiveShadow = true;
    scene.add(ground);
    return ground;
}

/** wire window-resize to renderer + camera + (optional) composer.
 *  Re-applies DPR to the composer on resize · bloom's internal render
 *  targets must be reallocated against the new pixel-density-aware size,
 *  not just the CSS size (orientation change on iPad would otherwise
 *  leave bloom mipmaps allocated against the old viewport). */
export function attachResize(renderer, camera, composer, bloomPass) {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            composer.setPixelRatio(renderPixelRatio);
            composer.setSize(window.innerWidth, window.innerHeight);
        }
        if (bloomPass) bloomPass.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });
}
