const THEME_KEY = 'meumundo-theme';
const LEGACY_KEY = 'fullfinan-theme';

export const THEME_TRANSITION_EVENT = 'meumundo-theme-transition';

export type ThemeMode = 'light' | 'dark';

export type ThemeTransitionDetail = {
    toDark: boolean;
    x: number;
    y: number;
};

export type ThemeTransitionOrigin = { x: number; y: number };

export function themeTransitionCoverRadius(x: number, y: number): number {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const far = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
    return far * 2 + 64;
}

function prefersReducedThemeMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function readTheme(): ThemeMode {
    try {
        const v = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_KEY);
        return v === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

export function applyTheme(theme: ThemeMode) {
    const isDark = theme === 'dark';
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try {
        localStorage.setItem(THEME_KEY, theme);
        localStorage.setItem(LEGACY_KEY, theme);
    } catch {
        /* ignore */
    }
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', isDark ? '#171717' : '#fafafa');
    window.dispatchEvent(new CustomEvent('meumundo-themechange'));
}

export function toggleTheme(): ThemeMode {
    const next = readTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
}

/** Alterna tema com revelação sol/lua a partir do ponto de origem (ex.: botão do menu). */
export function toggleThemeWithTransition(origin: ThemeTransitionOrigin): ThemeMode {
    const next: ThemeMode = readTheme() === 'dark' ? 'light' : 'dark';
    if (prefersReducedThemeMotion()) {
        applyTheme(next);
        return next;
    }
    window.dispatchEvent(
        new CustomEvent<ThemeTransitionDetail>(THEME_TRANSITION_EVENT, {
            detail: { toDark: next === 'dark', x: origin.x, y: origin.y }
        })
    );
    return next;
}