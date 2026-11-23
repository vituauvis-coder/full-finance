import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../icons/MaterialIcon';
import { applyTheme, THEME_TRANSITION_EVENT, themeTransitionCoverRadius, type ThemeTransitionDetail } from '../../app/theme';
import './theme-transition.css';

/** Versão 1 — 1.12s total, troca no ~46% */
const APPLY_AT_MS = 520;
const END_AT_MS = 1200;

export function ThemeTransitionOverlay() {
    const [run, setRun] = useState<ThemeTransitionDetail | null>(null);
    const [animate, setAnimate] = useState(false);
    const busy = useRef(false);

    const finish = useCallback(() => {
        busy.current = false;
        setAnimate(false);
        setRun(null);
    }, []);

    useEffect(() => {
        const onRequest = (event: Event) => {
            if (busy.current) return;
            const detail = (event as CustomEvent<ThemeTransitionDetail>).detail;
            if (!detail) return;
            busy.current = true;
            setRun(detail);
        };
        window.addEventListener(THEME_TRANSITION_EVENT, onRequest);
        return () => window.removeEventListener(THEME_TRANSITION_EVENT, onRequest);
    }, []);

    useEffect(() => {
        if (!run) return;

        const raf = requestAnimationFrame(() => {
            requestAnimationFrame(() => setAnimate(true));
        });

        const applyTimer = window.setTimeout(() => {
            applyTheme(run.toDark ? 'dark' : 'light');
        }, APPLY_AT_MS);

        const endTimer = window.setTimeout(finish, END_AT_MS);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(applyTimer);
            window.clearTimeout(endTimer);
        };
    }, [run, finish]);

    if (!run || typeof document === 'undefined') return null;

    const size = themeTransitionCoverRadius(run.x, run.y);
    const burstClass = run.toDark ? 'theme-transition__burst--to-dark' : 'theme-transition__burst--to-light';
    const icon = run.toDark ? 'dark_mode' : 'light_mode';
    const target = run.toDark ? 'dark' : 'light';

    return createPortal(
        <div
            className={`theme-transition${animate ? ' is-running' : ''}`}
            data-target={target}
            role="presentation"
            aria-hidden="true"
            style={
                {
                    '--theme-tx-x': run.x,
                    '--theme-tx-y': run.y,
                    '--theme-tx-size': size
                } as CSSProperties
            }
        >
            <div className={`theme-transition__burst ${burstClass}`} />
            <span className="theme-transition__ripple" />
            <span className="theme-transition__glyph">
                <MaterialIcon name={icon} variant="app" opticalSize={48} filled={false} weight={500} />
            </span>
        </div>,
        document.body
    );
}