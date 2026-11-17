/** @typedef {{ color?: string, credit?: string, debit?: string, creditFrom?: string, creditTo?: string, debitFrom?: string, debitTo?: string, text?: string, strip?: string }} WalletPlasticColors */

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Cor principal de marca por classe de tema (crédito; débito derivado automaticamente). */
export const BANK_PLASTIC_DEFAULTS = {
    'account-card--bank-itau': { color: '#ec7000' },
    'account-card--bank-bradesco': { color: '#cc092f' },
    'account-card--bank-santander': { color: '#ec0000' },
    'account-card--bank-bb': { color: '#fff400' },
    'account-card--bank-caixa': { color: '#005ca9' },
    'account-card--bank-nubank': { color: '#820ad1' },
    'account-card--bank-inter': { color: '#ff7a00' },
    'account-card--bank-c6': { color: '#2a2a2a' },
    'account-card--bank-neon': { color: '#00d4e8' },
    'account-card--bank-picpay': { color: '#0d8f4c' },
    'account-card--bank-mercado-pago': { color: '#009ee3' },
    'account-card--bank-pagbank': { color: '#ffc107' },
    'account-card--bank-pan': { color: '#005bff' }
};

export const GENERIC_PLASTIC_DEFAULTS = {
    color: '#475569'
};

export function normalizeHexColor(raw) {
    if (raw == null) return '';
    const s = String(raw).trim();
    if (!s) return '';
    if (!s.startsWith('#')) return '';
    if (!HEX_COLOR.test(s)) return '';
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

function mixHex(a, b, towardB) {
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

/** Cor do débito: mesma matiz do crédito, só um pouco mais escura. */
export function debitTintFromCredit(creditHex) {
    return mixHex(creditHex, '#0f172a', 0.2);
}

/** Paleta do modal — identidade dos bancos (ordem habitual no Brasil). */
export const PLASTIC_SWATCHES = [
    { hex: '#ec7000', label: 'Itaú (laranja)' },
    { hex: '#003f7d', label: 'Itaú (azul)' },
    { hex: '#cc092f', label: 'Bradesco' },
    { hex: '#ec0000', label: 'Santander' },
    { hex: '#fff400', label: 'Banco do Brasil' },
    { hex: '#005ca9', label: 'Caixa' },
    { hex: '#820ad1', label: 'Nubank' },
    { hex: '#ff7a00', label: 'Inter' },
    { hex: '#2a2a2a', label: 'C6 Bank' },
    { hex: '#00d4e8', label: 'Neon' },
    { hex: '#0d8f4c', label: 'PicPay' }
];

function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const chan = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/**
 * Texto nos plásticos: branco nas cores de marca; preto só em fundos bem claros (ex.: amarelo BB).
 */
export function textOnPlastic(hex) {
    return relativeLuminance(hex) > 0.72 ? '#0f172a' : '#f8fafc';
}

/** @param {WalletPlasticColors|null|undefined} raw */
export function canonicalPlasticPair(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            credit: GENERIC_PLASTIC_DEFAULTS.color,
            debit: debitTintFromCredit(GENERIC_PLASTIC_DEFAULTS.color)
        };
    }
    const color =
        normalizeHexColor(raw.color) ||
        normalizeHexColor(raw.credit) ||
        normalizeHexColor(raw.creditFrom) ||
        GENERIC_PLASTIC_DEFAULTS.color;
    return {
        credit: color,
        debit: debitTintFromCredit(color)
    };
}

/** @param {string|object|null|undefined} raw */
export function parseWalletPlasticColor(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'object') return raw;
    const str = String(raw).trim();
    if (!str) return null;
    try {
        const o = JSON.parse(str);
        if (o && typeof o === 'object') return o;
    } catch {
        const parts = str.split(',').map((p) => p.trim());
        if (parts.length >= 1 && normalizeHexColor(parts[0])) {
            return { color: normalizeHexColor(parts[0]) };
        }
    }
    return null;
}

/** @param {WalletPlasticColors|null|undefined} colors */
export function serializeWalletPlasticColor(colors) {
    if (!colors || typeof colors !== 'object') return null;
    const credit =
        normalizeHexColor(colors.color) ||
        normalizeHexColor(colors.credit) ||
        normalizeHexColor(colors.creditFrom);
    if (!credit) return null;
    return JSON.stringify({ color: credit });
}

export function isCustomPlasticAppearance(acc) {
    if (!acc) return false;
    if (acc.plasticTone === 'custom') return true;
    return !!parseWalletPlasticColor(acc.plasticColor);
}

/**
 * @param {object|null|undefined} bankAcc
 * @param {object|null|undefined} cardAcc
 */
function plasticColorPayloadFromAccount(acc) {
    if (!acc) return null;
    const parsed = parseWalletPlasticColor(acc.plasticColor);
    if (acc.plasticTone !== 'custom' && !parsed) return null;
    return parsed;
}

/** Cores da instituição; a conta bancária manda nos dois plásticos. */
export function resolvePlasticColors(bankAcc, cardAcc) {
    const bankParsed = plasticColorPayloadFromAccount(bankAcc);
    if (bankParsed) return canonicalPlasticPair(bankParsed);
    const cardParsed = plasticColorPayloadFromAccount(cardAcc);
    if (cardParsed) return canonicalPlasticPair(cardParsed);
    return null;
}

/** @param {'credit'|'debit'} kind */
export function buildPlasticInlineStyle(kind, colors) {
    if (!colors) return '';
    const pair = colors.credit ? colors : canonicalPlasticPair(colors);
    const bg = kind === 'debit' ? pair.debit : pair.credit;
    if (!bg) return '';
    const text = textOnPlastic(bg);
    return `background:${bg};color:${text}`;
}

function rgbaFromHex(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '';
    return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** Prévia suave no slot vazio (cor da conta, sem parecer cartão ativo). */
export function buildPlaceholderPlasticStyle(kind, colors) {
    if (!colors) return '';
    const pair = colors.credit ? colors : canonicalPlasticPair(colors);
    const bg = kind === 'debit' ? pair.debit : pair.credit;
    if (!bg) return '';
    const text = textOnPlastic(bg);
    return [
        `background:${rgbaFromHex(bg, 0.22)}`,
        `color:${rgbaFromHex(text, 0.88)}`,
        `border:1px dashed ${rgbaFromHex(bg, 0.55)}`
    ].join(';');
}

export function buildStripInlineStyle(colors) {
    const pair = colors?.credit ? colors : canonicalPlasticPair(colors);
    if (!pair?.credit) return '';
    return `background:${pair.credit}`;
}

export function defaultColorsForThemeClass(themeClass) {
    const base =
        (themeClass && BANK_PLASTIC_DEFAULTS[themeClass]) || GENERIC_PLASTIC_DEFAULTS;
    const credit = normalizeHexColor(base.color) || GENERIC_PLASTIC_DEFAULTS.color;
    return { color: credit, credit, debit: debitTintFromCredit(credit) };
}

function themeClassFromAccountName(name) {
    const s = String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    if (s.includes('caixa economica') || s.includes('cef') || (s.includes('caixa') && s.includes('federal'))) {
        return 'account-card--bank-caixa';
    }
    if (s.includes('banco do brasil') || /\bbb\b/.test(s)) return 'account-card--bank-bb';
    if (s.includes('mercado pago') || s.includes('mercadopago')) return 'account-card--bank-mercado-pago';
    if (s.includes('banco inter') || s === 'inter' || /^inter\s/.test(s) || s.endsWith(' inter')) {
        return 'account-card--bank-inter';
    }
    if (s.includes('picpay')) return 'account-card--bank-picpay';
    if (s.includes('pagbank') || s.includes('pag bank')) return 'account-card--bank-pagbank';
    if (/\bc6\b/.test(s)) return 'account-card--bank-c6';
    if (s.includes('santander')) return 'account-card--bank-santander';
    if (s.includes('bradesco')) return 'account-card--bank-bradesco';
    if (s.includes('nubank')) return 'account-card--bank-nubank';
    if (s.includes('itau')) return 'account-card--bank-itau';
    if (s.includes('banco pan') || s.includes('bancopan')) return 'account-card--bank-pan';
    if (s.includes('neon')) return 'account-card--bank-neon';
    return '';
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {HTMLFormElement|null|undefined} form */
export function readColorsFromForm(form) {
    if (!form) return null;
    const credit = normalizeHexColor(form.querySelector('#account-plastic-color')?.value);
    if (!credit) return null;
    return canonicalPlasticPair({ color: credit });
}

/** @param {HTMLFormElement|null|undefined} form */
export function readAppearancePayloadFromForm(form) {
    const serialized = serializeWalletPlasticColor(readColorsFromForm(form));
    if (!serialized) return { plasticTone: null, plasticColor: null };
    return { plasticTone: 'custom', plasticColor: serialized };
}

/** @param {HTMLFormElement|null|undefined} form @param {{ color?: string, credit?: string }} colors */
export function writeColorsToForm(form, colors) {
    if (!form || !colors) return;
    const pair = canonicalPlasticPair(colors);
    const el = form.querySelector('#account-plastic-color');
    if (el && pair.credit) el.value = pair.credit;
    syncPlasticSwatchSelection(form);
}

function buildPlasticPalette(form) {
    const host = form?.querySelector('#account-plastic-palette');
    if (!host || host.dataset.built === '1') return;
    host.dataset.built = '1';
    host.innerHTML = PLASTIC_SWATCHES.map(
        ({ hex, label }) =>
            `<button type="button" class="account-plastic-swatch" data-plastic-swatch="${hex}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" style="--swatch:${hex}"></button>`
    ).join('');
}

export function syncPlasticSwatchSelection(form) {
    if (!form) return;
    const current = normalizeHexColor(form.querySelector('#account-plastic-color')?.value);
    form.querySelectorAll('[data-plastic-swatch]').forEach((btn) => {
        const pick = normalizeHexColor(btn.getAttribute('data-plastic-swatch'));
        const selected = !!current && pick === current;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    const onPreset = PLASTIC_SWATCHES.some((s) => normalizeHexColor(s.hex) === current);
    const more = form.querySelector('#account-plastic-color-more');
    const dot = form.querySelector('#account-plastic-color-more-dot');
    more?.classList.toggle('is-custom', !!current && !onPreset);
    if (dot) dot.style.background = current || 'transparent';
}

/**
 * Paleta de toque + seletor nativo em «Outra cor».
 * @param {HTMLFormElement|null|undefined} form
 * @param {() => void} onColorChange
 */
export function initAccountPlasticColorUi(form, onColorChange) {
    if (!form || form.dataset.plasticPaletteBound === '1') return;
    form.dataset.plasticPaletteBound = '1';
    buildPlasticPalette(form);
    form.querySelector('#account-plastic-palette')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-plastic-swatch]');
        if (!btn) return;
        const hex = normalizeHexColor(btn.getAttribute('data-plastic-swatch'));
        const input = form.querySelector('#account-plastic-color');
        if (!input || !hex) return;
        input.value = hex;
        syncPlasticSwatchSelection(form);
        onColorChange();
    });
    form.querySelector('#account-plastic-color-more')?.addEventListener('click', () => {
        form.querySelector('#account-plastic-color')?.click();
    });
    form.querySelector('#account-plastic-color')?.addEventListener('input', () => {
        syncPlasticSwatchSelection(form);
        onColorChange();
    });
    syncPlasticSwatchSelection(form);
}

/**
 * @param {HTMLFormElement|null|undefined} form
 * @param {object|null|undefined} acc
 * @param {string} themeClass
 */
export function fillAppearanceFormFromAccount(form, acc, themeClass) {
    if (!form) return;
    const colors = canonicalPlasticPair({
        ...defaultColorsForThemeClass(themeClass),
        ...(isCustomPlasticAppearance(acc) ? parseWalletPlasticColor(acc?.plasticColor) : null)
    });
    writeColorsToForm(form, colors);
    syncAppearancePanelVisibility(form);
    refreshPlasticPreview(form);
}

/** @param {HTMLFormElement|null|undefined} form */
export function syncAppearancePanelVisibility(form) {
    buildPlasticPalette(form);
    form?.querySelector('#account-appearance-block')?.classList.add('account-form__wallet-section--custom');
}

/** Mantido para os listeners do formulário; não há prévia de plásticos no modal. */
export function refreshPlasticPreview(_form) {}
