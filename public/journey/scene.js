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
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.012);
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

/** synthwave grid texture · constructed once via offscreen 2D canvas */
function makeGridTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#080c14';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(109,255,166,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
        const p = (i / 8) * 256;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 200);
    return tex;
}

export function addGround(scene) {
    const groundMat = new THREE.MeshStandardMaterial({
        map: makeGridTexture(),
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.2,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 1000), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 200;
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
