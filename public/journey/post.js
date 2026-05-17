/**
 * journey/post.js — post-processing composer with UnrealBloomPass.
 * Bloom is the "GPU game signature" effect · bright pixels bleed glow
 * into surrounding areas. Tuned threshold 0.82 so only the emissive
 * checkpoints + sun-lit faces glow, not the whole scene.
 *
 * Mobile optimization: composer.setPixelRatio capped at 1.5 to halve
 * the number of fragment-shader invocations vs the renderer's setSize.
 * Bloom is bandwidth-bound on mobile GPUs so this is the single biggest
 * perf win available.
 */
import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { renderPixelRatio } from './env.js';

export function buildComposer(renderer, scene, camera) {
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderPixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.95,      // strength
        0.55,      // radius
        0.82,      // threshold (lower = more pixels glow)
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    return { composer, bloomPass };
}
