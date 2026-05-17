/**
 * journey/env.js — device + viewport detection in one place. Both scene.js
 * and post.js used to detect isMobile independently; having two copies of
 * the heuristic is a future drift bug waiting to happen, so it lives here.
 */

/** true when the device reports coarse pointer + no hover capability ·
 *  i.e. phones + tablets without a precise pointing device */
export const isMobile = (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
);

/** capped pixel ratio · mobile gets 1.5 to halve fragment work on
 *  retina screens. Bloom is bandwidth-bound on mobile GPUs. */
export const renderPixelRatio = Math.min(
    typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    isMobile ? 1.5 : 2,
);
