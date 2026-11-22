const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const SCREEN_ACCENT_KEYS = [
    'gains',
    'expenses',
    'wallet',
    'cofrinhos',
    'debts',
    'viagens',
    'zeroBudget',
    'dashboard'
];

/** Cores padrão do tema claro (`main.css` / `color-tokens.css`). */
export const DEFAULT_SCREEN_ACCENTS = {
    gains: '#2ec4b6',
    expenses: '#ff5a36',
    wallet: '#2563eb',
    cofrinhos: '#7c3aed',
    debts: '#9f1239',
    viagens: '#0d9488',
    zeroBudget: '#c9a227',
    dashboard: '#3b82f6'
};

/** Cópia congelada de `legacy-web/css/main.css` (acentos por área do portal). */
export const LEGACY_PORTAL_SCREEN_ACCENTS = { ...DEFAULT_SCREEN_ACCENTS };

/**
 * Variantes strong/soft/muted do legado (`color-tokens.css` + `main.css`).
 * Evita mistura genérica que deixa saídas/entradas diferentes do portal antigo.
 */
const LEGACY_VARIANT_OVERRIDES = {
    '#2ec4b6': { strong: '#1a8f85', soft: '#7ee8dc' },
    '#10b981': { strong: '#059669', soft: '#a7f3d0' },
    '#22c55e': { strong: '#16a34a', soft: '#bbf7d0' },
    '#ff5a36': { strong: '#e04a28', soft: '#ffb8a6' },
    '#ef4444': { strong: '#dc2626', soft: '#fecaca' },
    '#f97316': { strong: '#ea580c', soft: '#fed7aa' },
    '#e11d48': { strong: '#be123c', soft: '#fecdd3' },
    '#dc2626': { strong: '#b91c1c', soft: '#fecaca' },
    '#16a34a': { strong: '#15803d', soft: '#bbf7d0' },
    '#2563eb': { muted: '#60a5fa' },
    '#7c3aed': { strong: '#6d28d9', soft: '#c4b5fd', muted: '#a78bfa' },
    '#9f1239': { strong: '#881337', soft: '#ffe4e6', muted: '#be185d' },
    '#0d9488': { strong: '#0f766e', soft: '#ccfbf1', muted: '#2dd4bf' },
    '#c9a227': { muted: '#f2c94c' }
};

export const SCREEN_ACCENT_LABELS = {
    gains: 'Entradas',
    expenses: 'Saídas',
    wallet: 'Carteira',
    cofrinhos: 'Cofrinhos',
    debts: 'Dívidas',
    viagens: 'Viagens',
    zeroBudget: 'Planejamento',
    dashboard: 'Painel'
};

/** Paleta atual (`main.css` / color-tokens). */
export const SCREEN_ACCENT_PRESET_CURRENT = {
    id: 'current',
    label: 'Turquesa e coral',
    accents: { ...DEFAULT_SCREEN_ACCENTS }
};

/** Portal legado — mesmas cores do `legacy-web` em produção. */
export const SCREEN_ACCENT_PRESET_PORTAL = {
    id: 'portal',
    label: 'Portal legado',
    accents: { ...LEGACY_PORTAL_SCREEN_ACCENTS }
};

/**
 * Entradas verdes e saídas vermelhas — `--danger-color` / fallbacks antigos
 * (`#10b981`, `#ef4444` em `expense-categories`, treemap, etc.).
 */
export const SCREEN_ACCENT_PRESET_CLASSIC = {
    id: 'classic',
    label: 'Verde e vermelho',
    accents: {
        ...LEGACY_PORTAL_SCREEN_ACCENTS,
        gains: '#10b981',
        expenses: '#ef4444'
    }
};

/** `FINANCIAL_CHART_COLOR_KEYS_DEFAULT` — só ganhos/gastos/saldo do painel de gráficos. */
export const SCREEN_ACCENT_PRESET_CHARTS = {
    id: 'charts',
    label: 'Gráficos (legado)',
    accents: {
        ...LEGACY_PORTAL_SCREEN_ACCENTS,
        gains: '#22c55e',
        expenses: '#ef4444',
        zeroBudget: '#fbbf24',
        dashboard: '#6366f1'
    }
};

export const SCREEN_ACCENT_THEME_PRESETS = [
    SCREEN_ACCENT_PRESET_CURRENT,
    SCREEN_ACCENT_PRESET_PORTAL,
    SCREEN_ACCENT_PRESET_CLASSIC,
    SCREEN_ACCENT_PRESET_CHARTS
];

/** Cinco sugestões por tela — paleta coerente com a área (verde em entradas, quente em saídas, etc.). */
export const SCREEN_ACCENT_QUICK_PICKS = {
    gains: [
        { hex: '#2ec4b6', label: 'Turquesa (padrão)' },
        { hex: '#10b981', label: 'Esmeralda' },
        { hex: '#22c55e', label: 'Verde vivo' },
        { hex: '#059669', label: 'Verde profundo' },
        { hex: '#16a34a', label: 'Verde folha' }
    ],
    expenses: [
        { hex: '#ff5a36', label: 'Coral (padrão)' },
        { hex: '#ef4444', label: 'Vermelho' },
        { hex: '#f97316', label: 'Laranja' },
        { hex: '#e11d48', label: 'Rubi' },
        { hex: '#dc2626', label: 'Vermelho intenso' }
    ],
    wallet: [
        { hex: '#2563eb', label: 'Azul carteira (padrão)' },
        { hex: '#3b82f6', label: 'Azul vivo' },
        { hex: '#1d4ed8', label: 'Azul royal' },
        { hex: '#0ea5e9', label: 'Céu' },
        { hex: '#0284c7', label: 'Oceano' }
    ],
    cofrinhos: [
        { hex: '#7c3aed', label: 'Roxo (padrão)' },
        { hex: '#8b5cf6', label: 'Violeta' },
        { hex: '#6d28d9', label: 'Roxo escuro' },
        { hex: '#a855f7', label: 'Orquídea' },
        { hex: '#9333ea', label: 'Púrpura' }
    ],
    debts: [
        { hex: '#9f1239', label: 'Vinho (padrão)' },
        { hex: '#be123c', label: 'Rubro' },
        { hex: '#881337', label: 'Bordô' },
        { hex: '#b91c1c', label: 'Carmim' },
        { hex: '#7f1d1d', label: 'Vinho escuro' }
    ],
    viagens: [
        { hex: '#0d9488', label: 'Turquesa (padrão)' },
        { hex: '#14b8a6', label: 'Água' },
        { hex: '#0f766e', label: 'Teal' },
        { hex: '#06b6d4', label: 'Ciano' },
        { hex: '#2dd4bf', label: 'Menta' }
    ],
    zeroBudget: [
        { hex: '#c9a227', label: 'Ouro (padrão)' },
        { hex: '#eab308', label: 'Amarelo' },
        { hex: '#fbbf24', label: 'Âmbar' },
        { hex: '#d97706', label: 'Cobre' },
        { hex: '#ca8a04', label: 'Mostarda' }
    ],
    dashboard: [
        { hex: '#3b82f6', label: 'Azul painel (padrão)' },
        { hex: '#2563eb', label: 'Royal' },
        { hex: '#6366f1', label: 'Índigo' },
        { hex: '#0ea5e9', label: 'Céu' },
        { hex: '#1e40af', label: 'Azul noite' }
    ]
};

export function normalizeHexColor(raw) {
    if (raw == null) return '';
    const s = String(raw).trim();
    if (!s || !s.startsWith('#') || !HEX_COLOR.test(s)) return '';
    if (s.length === 4) {
        return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
    }
    return s.toLowerCase();
}

function hexToRgb(hex) {
    const h = normalizeHexColor(hex).slice(1);
    if (h.length !== 6) return null;
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
}

function rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return `#${[clamp(r), clamp(g), clamp(b)]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')}`;
}

export function mixHex(a, b, towardB) {
    const ra = hexToRgb(a);
    const rb = hexToRgb(b);
    if (!ra || !rb) return '#1e293b';
    const t = Math.max(0, Math.min(1, towardB));
    return rgbToHex(
        ra.r * (1 - t) + rb.r * t,
        ra.g * (1 - t) + rb.g * t,
        ra.b * (1 - t) + rb.b * t
    );
}

function parseFinancePrefsRaw(userProfile) {
    let raw = userProfile?.financePreferences;
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return {};
        }
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return raw;
}

/** Somente overrides válidos salvos no perfil (sem chaves no padrão). */
export function getScreenAccentOverrides(userProfile) {
    const raw = parseFinancePrefsRaw(userProfile)?.screenAccents;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const key of SCREEN_ACCENT_KEYS) {
        const hex = normalizeHexColor(raw[key]);
        if (!hex) continue;
        if (hex === DEFAULT_SCREEN_ACCENTS[key]) continue;
        out[key] = hex;
    }
    return out;
}

/** Cores efetivas por tela (padrão + overrides do usuário). */
export function getScreenAccentPreferences(userProfile) {
    const overrides = getScreenAccentOverrides(userProfile);
    return { ...DEFAULT_SCREEN_ACCENTS, ...overrides };
}

function variantSet(accent) {
    const base = normalizeHexColor(accent) || accent;
    const legacy = LEGACY_VARIANT_OVERRIDES[base];
    return {
        accent: base,
        strong: legacy?.strong ?? mixHex(base, '#0f172a', 0.14),
        soft: legacy?.soft ?? mixHex(base, '#ffffff', 0.52),
        muted: legacy?.muted ?? mixHex(base, '#ffffff', 0.32)
    };
}

/**
 * Propriedades CSS para aplicar em `document.documentElement`.
 * Inclui variantes strong/soft usadas em headers e chips.
 */
export function buildScreenAccentCssProperties(resolvedPrefs) {
    const prefs = { ...DEFAULT_SCREEN_ACCENTS, ...resolvedPrefs };
    const out = {};

    const gains = variantSet(prefs.gains);
    out['--gains-accent'] = gains.accent;
    out['--gains-accent-strong'] = gains.strong;
    out['--gains-accent-soft'] = gains.soft;
    out['--dash-chart-gain'] = gains.accent;

    const expenses = variantSet(prefs.expenses);
    out['--expenses-accent'] = expenses.accent;
    out['--expenses-accent-strong'] = expenses.strong;
    out['--expenses-accent-soft'] = expenses.soft;
    out['--dash-chart-expense'] = expenses.accent;

    const wallet = variantSet(prefs.wallet);
    out['--wallet-accent'] = wallet.accent;
    out['--wallet-accent-muted'] = wallet.muted;

    const cofrinhos = variantSet(prefs.cofrinhos);
    out['--cofrinhos-accent'] = cofrinhos.accent;
    out['--cofrinhos-accent-strong'] = cofrinhos.strong;
    out['--cofrinhos-accent-muted'] = cofrinhos.muted;
    out['--cofrinhos-accent-soft'] = cofrinhos.soft;

    const debts = variantSet(prefs.debts);
    out['--debts-accent'] = debts.accent;
    out['--debts-accent-strong'] = debts.strong;
    out['--debts-accent-muted'] = debts.muted;
    out['--debts-accent-soft'] = debts.soft;

    const viagens = variantSet(prefs.viagens);
    out['--viagens-accent'] = viagens.accent;
    out['--viagens-accent-strong'] = viagens.strong;
    out['--viagens-accent-muted'] = viagens.muted;
    out['--viagens-accent-soft'] = viagens.soft;

    const zb = variantSet(prefs.zeroBudget);
    out['--zb-accent'] = zb.accent;
    out['--zb-accent-muted'] = zb.muted;

    out['--dashboard-accent'] = normalizeHexColor(prefs.dashboard) || DEFAULT_SCREEN_ACCENTS.dashboard;

    return out;
}

export const MANAGED_SCREEN_ACCENT_CSS_VARS = Object.keys(
    buildScreenAccentCssProperties(DEFAULT_SCREEN_ACCENTS)
);

/** Sanitiza PATCH de `screenAccents` antes de persistir. */
export function sanitizeScreenAccentPatch(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return {};
    const out = {};
    for (const key of SCREEN_ACCENT_KEYS) {
        if (!(key in patch)) continue;
        if (patch[key] == null || patch[key] === '') {
            out[key] = null;
            continue;
        }
        const hex = normalizeHexColor(patch[key]);
        if (!hex) continue;
        if (hex === DEFAULT_SCREEN_ACCENTS[key]) continue;
        out[key] = hex;
    }
    return out;
}