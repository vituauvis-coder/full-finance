import { useEffect, useRef, useState } from 'react';
import { prefersReducedSkeletonMotion, SKELETON_MIN_MS } from '../lib/skeletonTiming';

/**
 * Mantém o skeleton visível pelo menos `minMs` após o início do carregamento.
 */
export function useSkeletonMinDuration(loading: boolean, minMs = SKELETON_MIN_MS): boolean {
    const [show, setShow] = useState(loading);
    const startedAt = useRef<number | null>(loading ? Date.now() : null);

    useEffect(() => {
        if (loading) {
            if (startedAt.current == null) startedAt.current = Date.now();
            setShow(true);
            return;
        }

        if (startedAt.current == null) {
            setShow(false);
            return;
        }

        if (prefersReducedSkeletonMotion()) {
            startedAt.current = null;
            setShow(false);
            return;
        }

        const remaining = Math.max(0, minMs - (Date.now() - startedAt.current));

        if (remaining === 0) {
            startedAt.current = null;
            setShow(false);
            return;
        }

        const timer = window.setTimeout(() => {
            startedAt.current = null;
            setShow(false);
        }, remaining);

        return () => window.clearTimeout(timer);
    }, [loading, minMs]);

    return show;
}