/** Tempo mínimo visível do skeleton (F5 e troca de rota). */
export const SKELETON_MIN_MS = 1000;

export function prefersReducedSkeletonMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}