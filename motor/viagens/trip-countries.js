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

/** Centroides aproximados para pins no mini-mapa (não substituem geocode de cidade). */
export const COUNTRY_MAP_CENTER = {
    BR: { latitude: -14.235, longitude: -51.9253 },
    AR: { latitude: -38.4161, longitude: -63.6167 },
    CL: { latitude: -35.6751, longitude: -71.543 },
    CO: { latitude: 4.5709, longitude: -74.2973 },
    PE: { latitude: -9.19, longitude: -75.0152 },
    MX: { latitude: 23.6345, longitude: -102.5528 },
    US: { latitude: 37.0902, longitude: -95.7129 },
    CA: { latitude: 56.1304, longitude: -106.3468 },
    PT: { latitude: 39.3999, longitude: -8.2245 },
    ES: { latitude: 40.4637, longitude: -3.7492 },
    FR: { latitude: 46.2276, longitude: 2.2137 },
    IT: { latitude: 41.8719, longitude: 12.5674 },
    DE: { latitude: 51.1657, longitude: 10.4515 },
    NL: { latitude: 52.1326, longitude: 5.2913 },
    GB: { latitude: 55.3781, longitude: -3.436 },
    CH: { latitude: 46.8182, longitude: 8.2275 },
    TR: { latitude: 38.9637, longitude: 35.2433 },
    AE: { latitude: 23.4241, longitude: 53.8478 },
    QA: { latitude: 25.3548, longitude: 51.1839 },
    JP: { latitude: 36.2048, longitude: 138.2529 },
    CN: { latitude: 35.8617, longitude: 104.1954 },
    KR: { latitude: 35.9078, longitude: 127.7669 },
    TH: { latitude: 15.87, longitude: 100.9925 },
    SG: { latitude: 1.3521, longitude: 103.8198 },
    HK: { latitude: 22.3193, longitude: 114.1694 },
    IN: { latitude: 20.5937, longitude: 78.9629 },
    MA: { latitude: 31.7917, longitude: -7.0926 },
    ZA: { latitude: -30.5595, longitude: 22.9375 },
    AU: { latitude: -25.2744, longitude: 133.7751 },
    NZ: { latitude: -40.9006, longitude: 174.886 }
};

export function countryMapCenterForLabel(label) {
    const iso = countryIso2ForLabel(label);
    if (!iso) return null;
    return COUNTRY_MAP_CENTER[iso] ?? null;
}

export function normalizeCountryLabel(raw) {
    return String(raw ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

/** Grafias de país (não cidade) → ISO. Usado em canonicalCountryLabel. */
const COUNTRY_ALIASES_TO_ISO = {
    espana: 'ES',
    espanha: 'ES',
    spain: 'ES',
    france: 'FR',
    franca: 'FR',
    italy: 'IT',
    italia: 'IT',
    germany: 'DE',
    alemanha: 'DE',
    japan: 'JP',
    japao: 'JP',
    china: 'CN',
    brazil: 'BR',
    brasil: 'BR',
    portugal: 'PT',
    usa: 'US',
    'united states': 'US',
    'estados unidos': 'US'
};

/**
 * Cidades / aeroportos → ISO (moeda, bandeira, fuso).
 * NÃO entra em canonicalCountryLabel — senão «Xangai» vira «China» e o pin some.
 */
const PLACE_ALIASES_TO_ISO = {
    madri: 'ES',
    madrid: 'ES',
    barcelona: 'ES',
    bilbao: 'ES',
    sevilha: 'ES',
    sevilla: 'ES',
    valencia: 'ES',
    lisboa: 'PT',
    lisbon: 'PT',
    porto: 'PT',
    paris: 'FR',
    roma: 'IT',
    rome: 'IT',
    milao: 'IT',
    milan: 'IT',
    berlim: 'DE',
    berlin: 'DE',
    xangai: 'CN',
    shanghai: 'CN',
    pequim: 'CN',
    beijing: 'CN',
    pek: 'CN',
    pvg: 'CN',
    sha: 'CN',
    toquio: 'JP',
    tokyo: 'JP',
    recife: 'BR',
    'sao paulo': 'BR',
    'rio de janeiro': 'BR'
};

function entryByIso(iso) {
    return TRIP_COUNTRY_CATALOG.find((c) => c.iso2 === iso) ?? null;
}

function matchAliasMap(foldedLabel, aliasMap) {
    const exact = aliasMap[foldedLabel];
    if (exact) return entryByIso(exact);
    for (const [alias, iso] of Object.entries(aliasMap)) {
        if (alias.length >= 4 && foldedLabel.includes(alias)) return entryByIso(iso);
    }
    return null;
}

/**
 * @param {string} label
 * @param {{ includePlaces?: boolean }} [opts]
 */
function catalogEntryForLabel(label, opts = {}) {
    const includePlaces = opts.includePlaces !== false;
    const f = folded(label);
    if (!f) return null;
    const direct =
        TRIP_COUNTRY_CATALOG.find((c) => folded(c.label) === f) ??
        TRIP_COUNTRY_CATALOG.find((c) => c.geoNames.some((g) => folded(g) === f)) ??
        null;
    if (direct) return direct;
    const countryAlias = matchAliasMap(f, COUNTRY_ALIASES_TO_ISO);
    if (countryAlias) return countryAlias;
    if (includePlaces) {
        const placeAlias = matchAliasMap(f, PLACE_ALIASES_TO_ISO);
        if (placeAlias) return placeAlias;
    }
    return null;
}

/** Rótulo canônico de país. Cidades (Xangai, Madri…) permanecem com o nome próprio. */
export function canonicalCountryLabel(label) {
    const n = normalizeCountryLabel(label);
    return catalogEntryForLabel(n, { includePlaces: false })?.label ?? n;
}

/** true se o texto é um nome de país do catálogo (não cidade). */
export function isCountryCatalogLabel(label) {
    const n = normalizeCountryLabel(label);
    return Boolean(catalogEntryForLabel(n, { includePlaces: false }));
}

/** ISO do país — aceita país ou cidade conhecida (Xangai → CN). */
export function countryIso2ForLabel(label) {
    return catalogEntryForLabel(label, { includePlaces: true })?.iso2 ?? null;
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