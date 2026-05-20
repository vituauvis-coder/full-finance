/**
 * Identidade do produto — altere `AppBrand` para renomear o app em todo o código.
 */

export const AppBrand = Object.freeze({
    /** Nome exibido ao usuário */
    NAME: 'Meu Malote',
    TAGLINE: 'Controle financeiro completo',
    VERSION: '1.0',
    BETA_LABEL: 'BETA 2',
    /** Prefixo para localStorage e eventos (sem hífens) */
    STORAGE_PREFIX: 'meumalote',
    /** Slug com hífens (backups, npm, etc.) */
    SLUG: 'meu-malote'
});

/** Chaves técnicas derivadas da marca atual. */
export const AppBrandKey = Object.freeze({
    theme: `${AppBrand.STORAGE_PREFIX}-theme`,
    sidebarCollapsed: `${AppBrand.STORAGE_PREFIX}-sidebar-collapsed`,
    uiSounds: `${AppBrand.STORAGE_PREFIX}-ui-sounds`,
    tablePageSize(storageKey) {
        return `${AppBrand.STORAGE_PREFIX}-table-pageSize-${storageKey}`;
    },
    themeChangeEvent: `${AppBrand.STORAGE_PREFIX}-themechange`,
    sessionCookie: `${AppBrand.STORAGE_PREFIX}.sid`
});

const LEGACY_PREFIX = 'fullfinan';

const LEGACY_STORAGE_KEYS = Object.freeze({
    [AppBrandKey.theme]: `${LEGACY_PREFIX}-theme`,
    [AppBrandKey.sidebarCollapsed]: `${LEGACY_PREFIX}-sidebar-collapsed`,
    [AppBrandKey.uiSounds]: `${LEGACY_PREFIX}-ui-sounds`
});

function legacyTablePageSizeKey(storageKey) {
    return `${LEGACY_PREFIX}-table-pageSize-${storageKey}`;
}

/**
 * Lê localStorage migrando da marca anterior (Full Finanças), se existir.
 * @param {string} key
 * @returns {string | null}
 */
export function readBrandStorage(key) {
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

/**
 * @param {string} key
 * @param {string} value
 */
export function writeBrandStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        const legacy = LEGACY_STORAGE_KEYS[key];
        if (legacy) localStorage.removeItem(legacy);
    } catch {
        /* ignore */
    }
}

/**
 * @param {string} key
 */
export function removeBrandStorage(key) {
    try {
        localStorage.removeItem(key);
        const legacy = LEGACY_STORAGE_KEYS[key];
        if (legacy) localStorage.removeItem(legacy);
    } catch {
        /* ignore */
    }
}

/**
 * @param {string} storageKey
 * @returns {string | null}
 */
export function readBrandTablePageSize(storageKey) {
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

/**
 * @param {string} storageKey
 * @param {string} value
 */
export function writeBrandTablePageSize(storageKey, value) {
    const key = AppBrandKey.tablePageSize(storageKey);
    try {
        localStorage.setItem(key, value);
        localStorage.removeItem(legacyTablePageSizeKey(storageKey));
    } catch {
        /* ignore */
    }
}

/**
 * @param {string} [suffix]
 * @returns {string}
 */
export function brandDocumentTitle(suffix) {
    if (suffix) return `${AppBrand.NAME} — ${suffix}`;
    return `${AppBrand.NAME} — ${AppBrand.TAGLINE}`;
}

/**
 * @param {'custom' | 'sql'} [format]
 * @param {Date} [now]
 * @returns {string}
 */
export function brandBackupFilename(format = 'custom', now = new Date()) {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-').slice(0, 13);
    const ext = format === 'sql' ? 'sql' : 'dump';
    return `${AppBrand.SLUG}-backup-${stamp}.${ext}`;
}

/** True se o tema escuro estiver salvo (marca atual ou legada). */
export function isBrandThemeDarkInStorage() {
    return readBrandStorage(AppBrandKey.theme) === 'dark';
}

const BRAND_DOM_SLOTS = Object.freeze({
    name: () => AppBrand.NAME,
    'page-title': () => brandDocumentTitle(),
    'admin-title': () => `Painel administrativo — ${AppBrand.NAME}`,
    'why-heading': () => `Por que usar ${AppBrand.NAME}?`,
    'footer-version': () => `${AppBrand.NAME} v${AppBrand.VERSION}`,
    'beta-footer': () => `${AppBrand.NAME} - Projeto em Desenvolvimento (${AppBrand.BETA_LABEL})`,
    thanks: () => `❤️ Obrigado por usar o ${AppBrand.NAME}!`
});

/**
 * Preenche elementos com `data-app-brand="<slot>"` e atualiza `<title>` quando aplicável.
 */
export function applyBrandToDocument() {
    document.title = brandDocumentTitle();
    document.querySelectorAll('[data-app-brand]').forEach((el) => {
        const slot = el.getAttribute('data-app-brand');
        const render = BRAND_DOM_SLOTS[slot];
        if (!render) return;
        const value = render();
        if (el.tagName === 'TITLE') {
            document.title = value;
        } else {
            el.textContent = value;
        }
    });
}
