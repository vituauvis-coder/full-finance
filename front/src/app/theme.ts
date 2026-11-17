const THEME_KEY = 'meumundo-theme';
const LEGACY_KEY = 'fullfinan-theme';

export type ThemeMode = 'light' | 'dark';

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