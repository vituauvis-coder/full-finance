import { placesSummary } from './trip-places.js';

function folded(name) {
    return String(name ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
}

/** Países comuns — rótulo PT, ISO2 e nomes no GeoJSON world.geo.json. */
export const TRIP_COUNTRY_CATALOG = [
    { label: 'Brasil', iso2: 'BR', geoNames: ['Brazil'] },
    { label: 'Argentina', iso2: 'AR', geoNames: ['Argentina'] },
    { label: 'Chile', iso2: 'CL', geoNames: ['Chile'] },
    { label: 'Colômbia', iso2: 'CO', geoNames: ['Colombia'] },
    { label: 'Peru', iso2: 'PE', geoNames: ['Peru'] },
    { label: 'México', iso2: 'MX', geoNames: ['Mexico'] },
    { label: 'EUA', iso2: 'US', geoNames: ['United States of America', 'United States'] },
    { label: 'Canadá', iso2: 'CA', geoNames: ['Canada'] },
    { label: 'Portugal', iso2: 'PT', geoNames: ['Portugal'] },
    { label: 'Espanha', iso2: 'ES', geoNames: ['Spain'] },
    { label: 'França', iso2: 'FR', geoNames: ['France'] },
    { label: 'Itália', iso2: 'IT', geoNames: ['Italy'] },
    { label: 'Alemanha', iso2: 'DE', geoNames: ['Germany'] },
    { label: 'Países Baixos', iso2: 'NL', geoNames: ['Netherlands'] },
    { label: 'Reino Unido', iso2: 'GB', geoNames: ['United Kingdom'] },
    { label: 'Suíça', iso2: 'CH', geoNames: ['Switzerland'] },
    { label: 'Turquia', iso2: 'TR', geoNames: ['Turkey'] },
    { label: 'Emirados Árabes', iso2: 'AE', geoNames: ['United Arab Emirates'] },
    { label: 'Catar', iso2: 'QA', geoNames: ['Qatar'] },
    { label: 'Japão', iso2: 'JP', geoNames: ['Japan'] },
    { label: 'China', iso2: 'CN', geoNames: ['China'] },
    { label: 'Coreia do Sul', iso2: 'KR', geoNames: ['South Korea', 'Korea'] },
    { label: 'Tailândia', iso2: 'TH', geoNames: ['Thailand'] },
    { label: 'Singapura', iso2: 'SG', geoNames: ['Singapore'] },
    { label: 'Hong Kong', iso2: 'HK', geoNames: ['Hong Kong'] },
    { label: 'Índia', iso2: 'IN', geoNames: ['India'] },
    { label: 'Marrocos', iso2: 'MA', geoNames: ['Morocco'] },
    { label: 'África do Sul', iso2: 'ZA', geoNames: ['South Africa'] },
    { label: 'Austrália', iso2: 'AU', geoNames: ['Australia'] },
    { label: 'Nova Zelândia', iso2: 'NZ', geoNames: ['New Zealand'] }
];

export function normalizeCountryLabel(raw) {
    return String(raw ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

function catalogEntryForLabel(label) {
    const f = folded(label);
    if (!f) return null;
    return (
        TRIP_COUNTRY_CATALOG.find((c) => folded(c.label) === f) ??
        TRIP_COUNTRY_CATALOG.find((c) => c.geoNames.some((g) => folded(g) === f)) ??
        null
    );
}

export function canonicalCountryLabel(label) {
    const n = normalizeCountryLabel(label);
    return catalogEntryForLabel(n)?.label ?? n;
}

export function countryIso2ForLabel(label) {
    return catalogEntryForLabel(label)?.iso2 ?? null;
}

/** Emoji de bandeira a partir de ISO 3166-1 alpha-2. */
export function countryFlagEmoji(iso2) {
    const code = String(iso2 ?? '')
        .trim()
        .toUpperCase();
    if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

export function countryFlagForLabel(label) {
    const iso = countryIso2ForLabel(label);
    return iso ? countryFlagEmoji(iso) : '';
}

export function uniqueCountryLabels(list) {
    const out = [];
    const seen = new Set();
    for (const item of list ?? []) {
        const n = canonicalCountryLabel(item);
        if (!n) continue;
        const k = folded(n);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(n);
    }
    return out;
}

/** Lista editável da viagem; cai no roteiro quando vazia. */
export function resolveTripCountries(payload, destinations) {
    const raw = payload?.tripCountries ?? payload?.trip_countries;
    if (Array.isArray(raw) && raw.length) {
        return uniqueCountryLabels(raw);
    }
    return placesSummary(destinations ?? []).countries;
}

/** Nomes de polígonos no world.geo.json para filtro. */
export function geoNamesForCountryLabels(labels) {
    const names = new Set();
    for (const label of labels ?? []) {
        const entry = catalogEntryForLabel(label);
        if (entry) {
            for (const g of entry.geoNames) names.add(g);
            continue;
        }
        const n = normalizeCountryLabel(label);
        if (n) names.add(n);
    }
    return [...names];
}

export function countriesCatalogSuggestions(query, limit = 8) {
    const q = folded(query);
    if (!q) return TRIP_COUNTRY_CATALOG.map((c) => c.label).slice(0, limit);
    return TRIP_COUNTRY_CATALOG.filter(
        (c) => folded(c.label).includes(q) || c.geoNames.some((g) => folded(g).includes(q))
    )
        .map((c) => c.label)
        .slice(0, limit);
}