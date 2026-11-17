export const AppBrand = Object.freeze({
    NAME: 'Meu Mundo',
    TAGLINE: 'Dinheiro, viagens e o que mais importa',
    VERSION: '1.0',
    BETA_LABEL: 'BETA 2',
    STORAGE_PREFIX: 'meumundo',
    SLUG: 'meu-mundo'
});

export const AppBrandKey = Object.freeze({
    theme: `${AppBrand.STORAGE_PREFIX}-theme`,
    sidebarCollapsed: `${AppBrand.STORAGE_PREFIX}-sidebar-collapsed`,
    uiSounds: `${AppBrand.STORAGE_PREFIX}-ui-sounds`,
    tablePageSize(storageKey: string) {
        return `${AppBrand.STORAGE_PREFIX}-table-pageSize-${storageKey}`;
    },
    themeChangeEvent: `${AppBrand.STORAGE_PREFIX}-themechange`,
    sessionCookie: `${AppBrand.STORAGE_PREFIX}.sid`
});

const LEGACY_PREFIX = 'fullfinan';

const LEGACY_STORAGE_KEYS: Record<string, string> = {
    [AppBrandKey.theme]: `${LEGACY_PREFIX}-theme`,
    [AppBrandKey.sidebarCollapsed]: `${LEGACY_PREFIX}-sidebar-collapsed`,
    [AppBrandKey.uiSounds]: `${LEGACY_PREFIX}-ui-sounds`
};

function legacyTablePageSizeKey(storageKey: string) {
    return `${LEGACY_PREFIX}-table-pageSize-${storageKey}`;
}

export function readBrandStorage(key: string) {
    try {
        const current = localStorage.getItem(key);
        if (current != null) return current;
        const legacy = LEGACY_STORAGE_KEYS[key];
        if (!legacy) return null;
        const old = localStorage.getItem(legacy);
        if (old != null) {
            localStorage.setItem(key, old);
            localStorage.removeItem(legacy);
        }
        return old;
    } catch {
        return null;
    }
}

export function writeBrandStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
        const legacy = LEGACY_STORAGE_KEYS[key];
        if (legacy) localStorage.removeItem(legacy);
    } catch {
        /* ignore */
    }
}

export function removeBrandStorage(key: string) {
    try {
        localStorage.removeItem(key);
        const legacy = LEGACY_STORAGE_KEYS[key];
        if (legacy) localStorage.removeItem(legacy);
    } catch {
        /* ignore */
    }
}

export function readBrandTablePageSize(storageKey: string) {
    const key = AppBrandKey.tablePageSize(storageKey);
    try {
        const current = localStorage.getItem(key);
        if (current != null) return current;
        const legacyKey = legacyTablePageSizeKey(storageKey);
        const old = localStorage.getItem(legacyKey);
        if (old != null) {
            localStorage.setItem(key, old);
            localStorage.removeItem(legacyKey);
        }
        return old;
    } catch {
        return null;
    }
}

export function writeBrandTablePageSize(storageKey: string, value: string) {
    const key = AppBrandKey.tablePageSize(storageKey);
    try {
        localStorage.setItem(key, value);
        localStorage.removeItem(legacyTablePageSizeKey(storageKey));
    } catch {
        /* ignore */
    }
}

export function brandDocumentTitle(suffix?: string) {
    if (suffix) return `${AppBrand.NAME} — ${suffix}`;
    return `${AppBrand.NAME} — ${AppBrand.TAGLINE}`;
}

export function applyBrandToDocument() {
    document.title = brandDocumentTitle();
    document.querySelectorAll('[data-app-brand]').forEach((el) => {
        const slot = el.getAttribute('data-app-brand');
        if (!slot) return;
        const slots: Record<string, () => string> = {
            name: () => AppBrand.NAME,
            'page-title': () => brandDocumentTitle(),
            'admin-title': () => `Painel administrativo — ${AppBrand.NAME}`,
            'why-heading': () => `Por que usar ${AppBrand.NAME}?`,
            'footer-version': () => `${AppBrand.NAME} v${AppBrand.VERSION}`,
            'beta-footer': () => `${AppBrand.NAME} - Projeto em Desenvolvimento (${AppBrand.BETA_LABEL})`,
            thanks: () => `❤️ Obrigado por usar o ${AppBrand.NAME}!`
        };
        const render = slots[slot];
        if (!render) return;
        const value = render();
        if (el.tagName === 'TITLE') document.title = value;
        else el.textContent = value;
    });
}