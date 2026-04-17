const THEME_KEY = 'fullfinan-theme';

function getStoredTheme() {
    try {
        return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

function updateMetaThemeColor(isDark) {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = isDark ? '#0f172a' : '#7c3aed';
}

function syncToggle(isDark) {
    const el = document.getElementById('theme-dark-toggle');
    if (el) el.checked = isDark;
}

/**
 * Aplica o tema e persiste em localStorage.
 * @param {'light'|'dark'} theme
 * @param {{ silent?: boolean }} [opts] — se silent, não dispara fullfinan-themechange (carga inicial).
 */
export function applyTheme(theme, opts = {}) {
    const isDark = theme === 'dark';
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    try {
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
        /* ignore */
    }
    updateMetaThemeColor(isDark);
    syncToggle(isDark);
    if (!opts.silent) {
        window.dispatchEvent(new CustomEvent('fullfinan-themechange'));
    }
}

export function initThemeFromStorage() {
    applyTheme(getStoredTheme(), { silent: true });
}

export function initThemeToggle() {
    const toggle = document.getElementById('theme-dark-toggle');
    if (!toggle) return;
    toggle.checked = getStoredTheme() === 'dark';
    toggle.addEventListener('change', () => {
        applyTheme(toggle.checked ? 'dark' : 'light');
    });
}
