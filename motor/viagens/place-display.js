import { haversineKm } from './geo-distance.js';

/** Caracteres CJK (chinês tradicional/simplificado, etc.). */
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function hasCjkScript(text) {
    return CJK_RE.test(String(text ?? ''));
}

const THAI_RE = /[\u0E00-\u0E7F]/;

/** Texto legível na UI (evita hanzi, tailandês etc. quando o usuário busca em português). */
export function isLatinUiText(text) {
    const s = String(text ?? '').trim();
    if (!s) return false;
    if (hasCjkScript(s) || THAI_RE.test(s)) return false;
    if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
    return /^[\sA-Za-zÀ-ÿ0-9'.,\-()&/+ºª°]+$/u.test(s);
}

function firstLatinSegment(text) {
    const parts = String(text ?? '')
        .split(/[,;·]/)
        .map((p) => p.trim())
        .filter(Boolean);
    for (const p of parts) {
        if (isLatinUiText(p)) return p;
    }
    return '';
}

export function isChinaRegion(countryCode, countryName) {
    const cc = String(countryCode ?? '')
        .trim()
        .toUpperCase();
    if (cc === 'CN') return true;
    const n = String(countryName ?? '').toLowerCase();
    return n.includes('china') || n.includes('中国') || n.includes('peoples republic');
}

function foldAscii(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

/** Consultas comuns em pt-BR → Nominatim entende melhor com contexto. */
const GEOCODE_QUERY_ALIASES = {
    xangai: 'Xangai, China',
    shangai: 'Xangai, China',
    shanghai: 'Shanghai, China',
    pequim: 'Beijing, China',
    beijing: 'Beijing, China',
    cantao: 'Guangzhou, China',
    guangzhou: 'Guangzhou, China',
    shenzhen: 'Shenzhen, China',
    hongkong: 'Hong Kong',
    'hong kong': 'Hong Kong',
    toquio: 'Tokyo, Japan',
    tokyo: 'Tokyo, Japan',
    'muralha da china': 'Badaling Great Wall, Beijing, China',
    'muralha da china pequim': 'Badaling Great Wall, Beijing, China',
    'great wall of china': 'Badaling Great Wall, Beijing, China',
    'great wall': 'Badaling Great Wall, Beijing, China',
    furong: 'Furong District, Changsha, China',
    'bairro furong': 'Furong District, Changsha, China'
};

export function expandGeocodeQuery(query) {
    const raw = String(query ?? '').trim();
    if (!raw) return raw;
    const key = foldAscii(raw);
    return GEOCODE_QUERY_ALIASES[key] ?? raw;
}

/** Coordenadas aproximadas quando o Nominatim só devolve o país. */
const GEOCODE_ALIAS_COORDS = {
    xangai: [31.2304, 121.4737],
    shangai: [31.2304, 121.4737],
    shanghai: [31.2304, 121.4737],
    pequim: [39.9042, 116.4074],
    beijing: [39.9042, 116.4074],
    cantao: [23.1291, 113.2644],
    guangzhou: [23.1291, 113.2644],
    shenzhen: [22.5431, 114.0579],
    hongkong: [22.3193, 114.1694],
    'hong kong': [22.3193, 114.1694],
    toquio: [35.6762, 139.6503],
    tokyo: [35.6762, 139.6503],
    'muralha da china': [40.4319, 116.5704],
    'muralha da china pequim': [40.4319, 116.5704],
    'great wall of china': [40.4319, 116.5704],
    'great wall': [40.4319, 116.5704]
};

/**
 * Cidade conhecida em pt-BR quando a API não retorna lugar útil.
 * @param {string} query
 */
const ATTRACTION_ALIAS_KEYS = new Set([
    'muralha da china',
    'muralha da china pequim',
    'great wall of china',
    'great wall'
]);

const ATTRACTION_ALIAS_LABELS = {
    'muralha da china': 'Muralha da China',
    'muralha da china pequim': 'Muralha da China',
    'great wall of china': 'Great Wall of China',
    'great wall': 'Great Wall of China'
};

/**
 * Cidades/atrações conhecidas mais próximas de um clique no mapa.
 * Sempre devolve ao menos a mais perto (mesmo longe).
 * @param {number} lat
 * @param {number} lng
 * @param {{ limit?: number }} [opts]
 */
export function nearestGeocodeAliasHits(lat, lng, opts = {}) {
    const limit = Math.max(1, Number(opts.limit) || 3);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const seen = new Set();
    const ranked = [];
    for (const key of Object.keys(GEOCODE_ALIAS_COORDS)) {
        const hit = geocodeAliasFallback(key);
        if (!hit || hit.kind === 'country') continue;
        const coordKey = `${Number(hit.latitude).toFixed(2)},${Number(hit.longitude).toFixed(2)}`;
        if (seen.has(coordKey)) continue;
        seen.add(coordKey);
        const km = haversineKm(lat, lng, hit.latitude, hit.longitude);
        if (km == null) continue;
        ranked.push({ hit, km });
    }
    ranked.sort((a, b) => a.km - b.km);
    return ranked.slice(0, limit).map((row) => row.hit);
}

/**
 * Sugestões para «Quer marcar X?» a partir de reverse Nominatim + aliases próximos.
 * @param {number} lat
 * @param {number} lng
 * @param {object[]} reverseHits
 * @param {{ limit?: number }} [opts]
 */
export function resolveMapPinSuggestions(lat, lng, reverseHits = [], opts = {}) {
    const limit = Math.max(1, Number(opts.limit) || 3);
    const aliases = nearestGeocodeAliasHits(lat, lng, { limit: Math.max(limit, 5) });
    const raw = [...(reverseHits ?? []), ...aliases].filter((h) => {
        if (!h || !Number.isFinite(Number(h.latitude)) || !Number.isFinite(Number(h.longitude))) return false;
        if (String(h.kind ?? '') === 'country') return false;
        if (isGenericCountryGeocodeHit(h, h.name || '')) return false;
        return true;
    });

    const scored = raw.map((hit) => {
        const km = haversineKm(lat, lng, hit.latitude, hit.longitude) ?? 9e6;
        const kind = geocodeKindScore(hit);
        // Distância manda; cidade/atracão empatam perto.
        const score = kind * 2 - Math.min(km, 2500) / 12;
        return { hit, km, score };
    });
    scored.sort((a, b) => {
        if (Math.abs(a.km - b.km) > 40) return a.km - b.km;
        return b.score - a.score;
    });

    const out = [];
    for (const row of scored) {
        if (out.some((x) => isNearDuplicateGeocodeHit(x, row.hit))) continue;
        out.push(row.hit);
        if (out.length >= limit) break;
    }
    if (!out.length && aliases[0]) out.push(aliases[0]);
    return out;
}

/**
 * Corrige geocodes ruins da Muralha (ex.: lng ~111° longe de Pequim).
 * Mantém o ponto se já estiver perto de Badaling.
 * @param {{ name?: string, country?: string, address?: string, city?: string, latitude?: number, longitude?: number, kind?: string }} place
 */
export function snapGreatWallPlace(place) {
    if (!place) return place;
    const name = String(place.name ?? '');
    const country = String(place.country ?? '');
    const address = String(place.address ?? '');
    const city = String(place.city ?? '');
    const looksWall =
        isGreatWallChinaQuery(name) ||
        isGreatWallPlaceName(name) ||
        isGreatWallPlaceName(address) ||
        ((foldAscii(name).includes('muralha') || foldAscii(name).includes('great wall')) &&
            (foldAscii(country).includes('china') ||
                foldAscii(address).includes('china') ||
                foldAscii(city).includes('beijing') ||
                foldAscii(city).includes('pequim')));
    if (!looksWall) return place;
    const alias = geocodeAliasFallback('muralha da china');
    if (!alias) return place;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    const dist =
        Number.isFinite(lat) && Number.isFinite(lng)
            ? haversineKm(lat, lng, alias.latitude, alias.longitude)
            : null;
    // Longe de Badaling / sem coords → usa alias (caso típico: geocode em ~111°E).
    if (dist != null && Number.isFinite(dist) && dist <= 80) {
        return {
            ...place,
            kind: place.kind === 'city' || !place.kind ? 'attraction' : place.kind,
            city: place.city || alias.city || 'Beijing'
        };
    }
    return {
        ...place,
        name: alias.name || place.name,
        latitude: alias.latitude,
        longitude: alias.longitude,
        kind: 'attraction',
        city: place.city || alias.city || 'Beijing',
        country: place.country || alias.country || 'China',
        address: place.address || alias.address
    };
}

export function geocodeAliasFallback(query) {
    const raw = String(query ?? '').trim();
    if (!raw) return null;
    const key = foldAscii(raw);
    const expanded = GEOCODE_QUERY_ALIASES[key];
    const coords = GEOCODE_ALIAS_COORDS[key];
    if (!expanded || !coords) return null;
    const parts = expanded.split(',').map((s) => s.trim()).filter(Boolean);
    const place = parts[0];
    if (!place) return null;
    const country = (parts.length > 1 ? parts[parts.length - 1] : '') || 'China';
    const cityRaw = parts.length > 2 ? parts[1] : place;
    const isAttraction = ATTRACTION_ALIAS_KEYS.has(key) || isGreatWallChinaQuery(raw);
    const city = isAttraction
        ? foldAscii(cityRaw).includes('beijing') || foldAscii(cityRaw).includes('pequim')
            ? 'Pequim'
            : cityRaw
        : cityRaw;
    const cc =
        foldAscii(country).includes('china') || foldAscii(country).includes('hong kong')
            ? foldAscii(country).includes('hong kong')
                ? 'hk'
                : 'cn'
            : foldAscii(country).includes('japan') || foldAscii(country).includes('japao')
              ? 'jp'
              : '';
    return {
        name: isAttraction ? ATTRACTION_ALIAS_LABELS[key] || place : place,
        country: countryDisplayName(country, cc),
        address: expanded,
        city,
        countryCode: cc,
        latitude: coords[0],
        longitude: coords[1],
        kind: isAttraction ? 'attraction' : 'city',
        importance: isAttraction ? 0.95 : 0.88
    };
}

function foldedCountryKey(label) {
    return foldAscii(label).replace(/\s+/g, ' ');
}

const COUNTRY_PT_BY_CC = {
    cn: 'China',
    jp: 'Japão',
    kr: 'Coreia do Sul',
    tw: 'Taiwan',
    hk: 'Hong Kong',
    mo: 'Macau',
    us: 'Estados Unidos',
    gb: 'Reino Unido',
    fr: 'França',
    de: 'Alemanha',
    es: 'Espanha',
    it: 'Itália',
    pt: 'Portugal',
    br: 'Brasil',
    ar: 'Argentina',
    mx: 'México'
};

/** País legível em pt-BR quando Nominatim devolve hanzi ou inglês cru. */
export function countryDisplayName(countryName, countryCode) {
    const cc = String(countryCode ?? '')
        .trim()
        .toLowerCase();
    if (cc && COUNTRY_PT_BY_CC[cc]) return COUNTRY_PT_BY_CC[cc];
    const raw = String(countryName ?? '').trim();
    if (!raw) return '';
    if (hasCjkScript(raw) && cc === 'cn') return 'China';
    if (raw === '中国') return 'China';
    if (raw.toLowerCase() === 'china') return 'China';
    return raw;
}

const CN_PROVINCE_FOLD = new Set(
    [
        'hunan',
        'hubei',
        'guangdong',
        'zhejiang',
        'jiangsu',
        'fujian',
        'anhui',
        'jiangxi',
        'shandong',
        'henan',
        'hebei',
        'shanxi',
        'shaanxi',
        'sichuan',
        'yunnan',
        'guizhou',
        'gansu',
        'qinghai',
        'hainan',
        'liaoning',
        'jilin',
        'heilongjiang',
        'inner mongolia',
        'guangxi',
        'ningxia',
        'xinjiang',
        'tibet',
        'hong kong',
        'macau',
        'tianjin',
        'chongqing'
    ].map((s) => s.replace(/\s+/g, ' '))
);

function isChinaProvinceLabel(label) {
    const f = foldAscii(label).replace(/\s+/g, ' ');
    if (!f) return false;
    if (CN_PROVINCE_FOLD.has(f)) return true;
    return /\b(province|autonomous region)\b/i.test(label);
}

/**
 * Cidade “pai” quando o hit é bairro/distrito com o mesmo nome (ex. Furong → Changsha).
 * @param {string} addressLine
 * @param {string} placeName
 */
export function parentCityFromLatinAddress(addressLine, placeName = '') {
    const nameFold = foldAscii(placeName);
    const head = nameFold.split(/\s+/)[0] ?? nameFold;
    const parts = String(addressLine ?? '')
        .split(/[,;·]/)
        .map((p) => p.trim())
        .filter(Boolean);

    const skipPart = (part) => {
        const f = foldAscii(part);
        if (!part || !isLatinUiText(part) || hasCjkScript(part)) return true;
        if (isCountryLabel(part, 'cn', 'China') || f === 'china') return true;
        if (isChinaProvinceLabel(part)) return true;
        if (nameFold && (f === nameFold || f === head)) return true;
        if (nameFold && head.length >= 4 && f.includes(head) && /district|borough|zone|quarter|suburb|neighbourhood/i.test(part)) {
            return true;
        }
        if (nameFold && head.length >= 3 && f.includes(head) && !/\bcity\b/i.test(part)) return true;
        return false;
    };

    for (const part of parts) {
        if (skipPart(part)) continue;
        if (/\b(city|district|county|township|town|village)\b/i.test(part) && !/\bcity\b/i.test(part)) {
            const inner = part.replace(/\s+(district|county|town|village)$/i, '').trim();
            if (inner && !skipPart(inner) && foldAscii(inner) !== nameFold) return inner;
        }
        return part;
    }
    return '';
}

export function refineGeocodeCityLabel(placeName, cityLabel, addressLine, country) {
    const city = sanitizeGeocodeCity(cityLabel, country);
    const nameFold = foldAscii(placeName);
    const cityFold = foldAscii(city);
    if (!city || !nameFold) {
        const parent = parentCityFromLatinAddress(addressLine, placeName);
        return parent ? sanitizeGeocodeCity(parent, country) : city;
    }
    if (cityFold === nameFold || (nameFold.length >= 4 && cityFold.includes(nameFold))) {
        const parent = parentCityFromLatinAddress(addressLine, placeName);
        if (parent) return sanitizeGeocodeCity(parent, country);
    }
    return city;
}

/** Cidade vazia quando for só o nome do país (evita «Lugar - China»). */
export function sanitizeGeocodeCity(city, country) {
    const c = String(city ?? '').trim();
    if (!c) return '';
    if (isCountryLabel(c, null, country)) return '';
    const co = countryDisplayName(country, null);
    if (co && foldedCountryKey(c) === foldedCountryKey(co)) return '';
    return c;
}

export function isGreatWallChinaQuery(query) {
    const q = foldAscii(query);
    if (!q) return false;
    if (q.includes('great wall')) return true;
    return q.includes('muralha') && (q.includes('china') || q.includes('chinesa'));
}

const CJK_ADMIN_ROMAN = {
    长沙市: 'Changsha',
    长沙: 'Changsha',
    北京市: 'Beijing',
    北京: 'Beijing',
    上海市: 'Shanghai',
    上海: 'Shanghai',
    广州市: 'Guangzhou',
    广州: 'Guangzhou',
    深圳市: 'Shenzhen',
    深圳: 'Shenzhen',
    杭州市: 'Hangzhou',
    杭州: 'Hangzhou',
    成都市: 'Chengdu',
    成都: 'Chengdu',
    武汉市: 'Wuhan',
    武汉: 'Wuhan',
    西安市: "Xi'an",
    西安: "Xi'an",
    南京市: 'Nanjing',
    南京: 'Nanjing',
    重庆市: 'Chongqing',
    重庆: 'Chongqing',
    天津市: 'Tianjin',
    天津: 'Tianjin',
    苏州市: 'Suzhou',
    苏州: 'Suzhou',
    厦门市: 'Xiamen',
    厦门: 'Xiamen',
    青岛市: 'Qingdao',
    青岛: 'Qingdao',
    大连市: 'Dalian',
    大连: 'Dalian'
};

function cjkAdminRoman(label, details = {}) {
    const raw = String(label ?? '').trim();
    if (!raw) return '';
    if (!hasCjkScript(raw)) return isLatinUiText(raw) ? raw : '';
    if (CJK_ADMIN_ROMAN[raw]) return CJK_ADMIN_ROMAN[raw];
    const trimmed = raw.replace(/[省市区县]$/u, '');
    if (CJK_ADMIN_ROMAN[trimmed]) return CJK_ADMIN_ROMAN[trimmed];
    const fromDetails = latinNameFromNamedetails(details, '');
    if (fromDetails && !isCountryLabel(fromDetails, 'cn', 'China')) return fromDetails;
    return '';
}

function isGreatWallPlaceName(name) {
    const n = foldAscii(name);
    if (!n) return false;
    return (
        n.includes('great wall') ||
        (n.includes('muralha') && n.includes('china')) ||
        n.includes('wall of china')
    );
}

function isCountryLabel(name, countryCode, countryName) {
    const n = foldAscii(name);
    if (!n) return false;
    const c = foldAscii(countryDisplayName(countryName, countryCode));
    if (c && n === c) return true;
    return n === 'china' || n === 'chinese' || n === 'republica popular da china';
}

/** Primeiro trecho latino de um endereço que combina com a busca. */
export function segmentMatchingQuery(text, query) {
    const q = foldAscii(query);
    if (!q || q.length < 2) return '';
    const parts = String(text ?? '')
        .split(/[,;·]/)
        .map((p) => p.trim())
        .filter(Boolean);
    for (const p of parts) {
        const fp = foldAscii(p);
        if (fp.includes(q) || q.includes(fp)) return isLatinUiText(p) ? p : '';
    }
    return '';
}

function latinNameFromNamedetails(details, query = '') {
    const q = foldAscii(query);
    // pt-BR primeiro (UI do app); en/pinyin como fallback.
    const keys = [
        'name:pt-BR',
        'name:pt',
        'name:en',
        'official_name:en',
        'name:latin',
        'int_name',
        'name:es',
        'name:de',
        'name:fr',
        'name:ceb',
        '_place_name:en',
        'name:zh-Latn-pinyin',
        'name:pinyin'
    ];
    let fallback = '';
    for (const key of keys) {
        const s = String(details[key] ?? '').trim();
        if (!s || !isLatinUiText(s)) continue;
        if (q.length >= 2) {
            const f = foldAscii(s);
            const head = foldAscii(s.split(/[\s,/(-]+/)[0] ?? '');
            if (f.includes(q) || q.includes(f) || head.includes(q) || q.includes(head)) return s;
        }
        if (!fallback) fallback = s;
    }
    return fallback;
}

/**
 * Nome específico (cidade, bairro, POI) alinhado à busca — nunca só o país.
 * @param {object} item
 * @param {string} [query]
 */
function titleCaseLatinQuery(query) {
    const raw = String(query ?? '').trim();
    if (raw.length < 2 || !isLatinUiText(raw)) return '';
    return raw.replace(/(^|[\s\-/]+)(\S+)/g, (m, sep, w) => `${sep}${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`);
}

/** Título legível quando o Nominatim só envia hanzi no nome. */
export function queryDisplayTitle(hit, query = '') {
    const country = countryDisplayName(hit?.country, hit?.countryCode);
    const q = foldAscii(query);
    const fromAddr = segmentMatchingQuery(hit?.address, query) || firstLatinSegment(hit?.address);
    if (fromAddr && !isCountryLabel(fromAddr, hit?.countryCode, hit?.country)) return fromAddr;
    const city = String(hit?.city ?? '').trim();
    if (city && isLatinUiText(city) && q && foldAscii(city).includes(q) && !isCountryLabel(city, hit?.countryCode, country)) {
        return city;
    }
    const titled = titleCaseLatinQuery(query);
    if (titled && !isCountryLabel(titled, hit?.countryCode, country)) return titled;
    return '';
}

export function nominatimLatinAddressLine(item) {
    const addr = item?.address ?? {};
    const details = item?.namedetails ?? {};
    const countryCode = addr.country_code;
    const countryName = addr.country;
    const parentCity =
        cjkAdminRoman(addr.region, item?.namedetails) ||
        cjkAdminRoman(addr.city, item?.namedetails) ||
        cjkAdminRoman(addr.state, item?.namedetails);
    const parts = [
        queryAlignedPlaceName(item, '') || pickNominatimPrimaryName(item),
        parentCity,
        addr.suburb,
        addr.city_district,
        !hasCjkScript(addr.city) ? addr.city : '',
        addr.town,
        addr.village,
        addr.municipality,
        addr.county,
        addr.state,
        addr.region,
        countryDisplayName(addr.country, countryCode)
    ];
    const seen = new Set();
    const out = [];
    for (const raw of parts) {
        const s = String(raw ?? '').trim();
        if (!s || hasCjkScript(s)) continue;
        const latin =
            isLatinUiText(s) ? s : pickPlaceDisplayName({
                  name: details['name:pt'],
                  nameEn: details['name:en'],
                  countryCode,
                  countryName: s
              });
        const line = String(latin ?? '').trim();
        if (!line || !isLatinUiText(line) || hasCjkScript(line)) continue;
        const key = foldedCountryKey(line);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(line);
    }
    return out.join(', ');
}

/** Título + subtítulo para lista de busca (sem hanzi). */
export function geocodeHitDisplayLabel(hit, query = '') {
    const country = countryDisplayName(hit?.country, hit?.countryCode);
    let title = coerceLatinGeocodeLabel(hit, query);
    if (!title || hasCjkScript(title) || isCountryLabel(title, hit?.countryCode, hit?.country)) {
        title = queryDisplayTitle(hit, query);
    }
    if (!title || hasCjkScript(title)) {
        title = titleCaseLatinQuery(query) || 'Local';
    }

    let subtitle = pickAddressDisplayLine({
        displayName: hit?.address,
        countryCode: hit?.countryCode,
        countryName: hit?.country
    });
    if (!subtitle || !isLatinUiText(subtitle) || hasCjkScript(subtitle)) {
        const city = hit?.city?.trim();
        const meta = [city, country]
            .map((s) => String(s ?? '').trim())
            .filter((s) => s && isLatinUiText(s) && !hasCjkScript(s) && foldedCountryKey(s) !== foldedCountryKey(title));
        subtitle = meta.length ? meta.join(' · ') : country;
    } else {
        const tFold = foldedCountryKey(title);
        const segs = subtitle
            .split(',')
            .map((s) => s.trim())
            .filter(
                (s) =>
                    s &&
                    isLatinUiText(s) &&
                    foldedCountryKey(s) !== tFold &&
                    !(s.toLowerCase() === 'china' && tFold && tFold !== 'china')
            );
        subtitle = segs.length ? segs.join(' · ') : country;
    }
    return { title, subtitle };
}

export function queryAlignedPlaceName(item, query = '') {
    const addr = item?.address ?? {};
    const details = item?.namedetails ?? {};
    const countryCode = addr.country_code;
    const countryName = addr.country;
    const q = foldAscii(query);

    const fromDetails = latinNameFromNamedetails(details, query);
    if (fromDetails && !isCountryLabel(fromDetails, countryCode, countryName)) return fromDetails;

    const addressFields = [
        addr.suburb,
        addr.neighbourhood,
        addr.neighborhood,
        addr.quarter,
        addr.city_district,
        addr.city,
        addr.town,
        addr.village,
        addr.municipality,
        addr.county,
        addr.state,
        addr['addr:suburb'],
        addr.road
    ];
    if (q.length >= 2) {
        for (const field of addressFields) {
            const s = String(field ?? '').trim();
            if (!s || isCountryLabel(s, countryCode, countryName)) continue;
            const f = foldAscii(s);
            if ((f.includes(q) || q.includes(f)) && isLatinUiText(s)) return s;
        }
        const fromDisplay = segmentMatchingQuery(item?.display_name, query);
        if (fromDisplay && !isCountryLabel(fromDisplay, countryCode, countryName)) return fromDisplay;
        if (item?.name && isLatinUiText(item.name) && !isCountryLabel(item.name, countryCode, countryName)) {
            const f = foldAscii(item.name);
            if (f.includes(q) || q.includes(f)) return item.name;
        }
    }

    const primary = pickNominatimPrimaryName(item);
    if (primary && isLatinUiText(primary) && !isCountryLabel(primary, countryCode, countryName)) return primary;

    const latinSeg = firstLatinSegment(item?.display_name);
    if (latinSeg && !isCountryLabel(latinSeg, countryCode, countryName)) return latinSeg;

    return fromDetails && !isCountryLabel(fromDetails, countryCode, countryName) ? fromDetails : '';
}

function namedetailLatinCandidates(details, item) {
    const list = [
        details['name:pt-BR'],
        details['name:pt'],
        details.int_name,
        details['name:en'],
        details.name_en,
        details['name:latin'],
        details.name_latin,
        details['name:es'],
        details['name:de'],
        details['name:fr'],
        item?.name,
        item?.display_name?.split(',')[0]
    ];
    return list.map((v) => String(v ?? '').trim()).filter(Boolean);
}

/** Melhor nome para UI a partir do JSON do Nominatim (prioriza pt-BR/latim). */
export function pickNominatimPrimaryName(item) {
    const addr = item?.address ?? {};
    const details = item?.namedetails ?? {};
    const countryCode = addr.country_code;
    const countryName = addr.country;
    const preferLatin = isChinaRegion(countryCode, countryName) || hasCjkScript(item?.name);

    for (const candidate of namedetailLatinCandidates(details, item)) {
        if (preferLatin && hasCjkScript(candidate)) continue;
        return candidate;
    }
    for (const candidate of namedetailLatinCandidates(details, item)) {
        if (!hasCjkScript(candidate)) return candidate;
    }
    return pickPlaceDisplayName({
        name: item?.name,
        nameEn: details['name:en'] ?? details.name_en,
        nameLatin: details['name:latin'] ?? details.name_latin,
        countryCode,
        countryName
    });
}

export function inferGeocodeKind(item) {
    const cls = String(item?.class ?? '').toLowerCase();
    const typ = String(item?.type ?? '').toLowerCase();
    if (cls === 'amenity') {
        if (/restaurant|cafe|fast_food|bar|pub|food_court|biergarten|ice_cream/.test(typ)) return 'restaurant';
        if (/place_of_worship|theatre|cinema|arts_centre|community_centre/.test(typ)) return 'poi';
        return 'poi';
    }
    if (cls === 'shop') return /mall|department_store|shopping_centre|shopping_center/.test(typ) ? 'shopping' : 'shop';
    if (cls === 'tourism') return 'attraction';
    if (cls === 'leisure' || cls === 'office' || cls === 'building') return 'poi';
    if (/suburb|neighbourhood|neighborhood|quarter|borough|hamlet/.test(typ)) return 'neighborhood';
    if (/city|town|village|municipality/.test(typ)) return 'city';
    if (cls === 'boundary' && typ === 'administrative') {
        const rank = Number(item?.place_rank ?? 0);
        if (rank > 0 && rank <= 4) return 'country';
        if (rank >= 16) return 'neighborhood';
        if (rank >= 8 || rank === 0) return 'city';
        return 'region';
    }
    if (cls === 'place') return typ || 'city';
    if (cls === 'aeroway') return 'airport';
    return 'poi';
}

/**
 * Nome para UI: idioma local do lugar; na China, preferir latim (en/romanização).
 * @param {{ name?: string, nameEn?: string, nameLatin?: string, countryCode?: string, countryName?: string }} p
 */
export function pickPlaceDisplayName(p) {
    const china = isChinaRegion(p.countryCode, p.countryName);
    if (china) {
        for (const c of [p.nameEn, p.nameLatin, p.name, p.nameEn]) {
            const s = String(c ?? '').trim();
            if (s && isLatinUiText(s)) return s;
        }
        return String(p.nameEn || p.nameLatin || '').trim();
    }
    return String(p.name || p.nameEn || p.nameLatin || '').trim();
}

/** Garante nome latino/pt no hit já normalizado (última camada). */
export function coerceLatinGeocodeLabel(hit, query = '') {
    const country = countryDisplayName(hit?.country, hit?.countryCode);
    const q = foldAscii(query);
    let name = pickPlaceDisplayName({
        name: hit?.name,
        countryCode: hit?.countryCode,
        countryName: hit?.country
    });
    const city = String(hit?.city ?? '').trim();

    if (q.length >= 2) {
        const fromAddr = segmentMatchingQuery(hit?.address, query) || firstLatinSegment(hit?.address);
        if (fromAddr && !isCountryLabel(fromAddr, hit?.countryCode, hit?.country)) name = fromAddr;
    }
    if (
        country &&
        name &&
        foldedCountryKey(name) === foldedCountryKey(country) &&
        city &&
        isLatinUiText(city) &&
        foldedCountryKey(city) !== foldedCountryKey(country)
    ) {
        name = city;
    }
    if (q && city && isLatinUiText(city) && (foldAscii(city).includes(q) || q.includes(foldAscii(city)))) {
        name = city;
    }
    if (isLatinUiText(name) && !isCountryLabel(name, hit?.countryCode, hit?.country)) return name;
    const fromAddr = firstLatinSegment(hit?.address);
    if (fromAddr && !isCountryLabel(fromAddr, hit?.countryCode, hit?.country)) return fromAddr;
    if (isLatinUiText(city) && !isCountryLabel(city, hit?.countryCode, hit?.country)) return city;
    const fromName = firstLatinSegment(hit?.name);
    if (fromName && !isCountryLabel(fromName, hit?.countryCode, hit?.country)) return fromName;
    if (isCountryLabel(name, hit?.countryCode, hit?.country)) return '';
    return name && !isCountryLabel(name, hit?.countryCode, hit?.country)
        ? name
        : isLatinUiText(hit?.name) && !isCountryLabel(hit?.name, hit?.countryCode, hit?.country)
          ? String(hit.name).trim()
          : '';
}

/**
 * Linha de endereço: local; na China sem só hanzi quando houver alternativa latina.
 * @param {{ displayName?: string, displayNameEn?: string, countryCode?: string, countryName?: string }} p
 */
export function pickAddressDisplayLine(p) {
    const china = isChinaRegion(p.countryCode, p.countryName);
    const local = String(p.displayName ?? '').trim();
    const en = String(p.displayNameEn ?? '').trim();
    if (!china) return local || en;
    if (en && (!local || hasCjkScript(local))) return en;
    if (local && hasCjkScript(local)) return en || local;
    return local || en;
}

/** Extrai campos úteis de um item Nominatim (search JSON). */
export function formatNominatimPlace(item, query = '') {
    const addr = item?.address ?? {};
    const details = item?.namedetails ?? {};
    const countryCode = addr.country_code;
    const countryName = addr.country;
    let name = queryAlignedPlaceName(item, query) || pickNominatimPrimaryName(item);
    if (hasCjkScript(name)) {
        const latin =
            details['name:pt-BR'] ??
            details['name:pt'] ??
            details['name:en'] ??
            details.name_en ??
            details.int_name ??
            details['name:latin'] ??
            details.name_latin;
        if (latin && !hasCjkScript(latin)) name = String(latin).trim();
    }
    let address = pickAddressDisplayLine({
        displayName: item?.display_name,
        displayNameEn:
            details['name:en'] || details['name:pt'] || details.int_name
                ? buildDisplayFromAddress(addr, details, countryCode, countryName)
                : '',
        countryCode,
        countryName
    });
    const latinAddr = nominatimLatinAddressLine(item);
    if (latinAddr && (!address || hasCjkScript(address))) address = latinAddr;
    const city =
        cjkAdminRoman(addr.region, details) ||
        (!hasCjkScript(addr.city) ? addr.city : '') ||
        cjkAdminRoman(addr.city, details) ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        (!hasCjkScript(addr.suburb) ? addr.suburb : '') ||
        (!hasCjkScript(addr.county) ? addr.county : '') ||
        '';
    let cityLabel =
        city && hasCjkScript(city)
            ? pickPlaceDisplayName({
                  name: details['name:pt'],
                  nameEn: details['name:en'],
                  countryCode,
                  countryName: city
              }) || city
            : city;
    const countryLine = countryDisplayName(countryName, countryCode);
    cityLabel = refineGeocodeCityLabel(name, cityLabel, latinAddr || address, countryLine);
    const primaryName =
        isLatinUiText(name) ? name : firstLatinSegment(item?.display_name) || name || item?.name || '';
    return {
        name: coerceLatinGeocodeLabel(
            {
                name: primaryName,
                address,
                city: cityLabel,
                country: countryDisplayName(countryName, countryCode),
                countryCode
            },
            query
        ),
        address,
        city: cityLabel,
        country: countryDisplayName(countryName, countryCode),
        countryCode: countryCode ?? '',
        kind: inferGeocodeKind(item)
    };
}

/**
 * Ordena hits para consultas em português/latim e país do roteiro.
 * @param {string} query
 * @param {Array<{ name?: string, countryCode?: string, kind?: string, importance?: number }>} hits
 * @param {{ countryCodes?: string }} [opts]
 */
export function isGenericCountryGeocodeHit(hit, query) {
    const q = foldAscii(query);
    const name = foldAscii(hit?.name);
    const country = foldAscii(countryDisplayName(hit?.country, hit?.countryCode));
    if (!name) return true;
    if (!country) return false;
    if (hit?.kind === 'country') return q !== 'china' && q !== 'chinese';
    const chinaQuery = q === 'china' || q === 'chinese' || q === 'chinese republic';
    if (name === country && q && !chinaQuery) return true;
    if ((name === 'china' || name === country) && q.length >= 2 && !chinaQuery && !q.includes(name) && !name.includes(q)) {
        return true;
    }
    return false;
}

const GEOCODE_KIND_SCORE = {
    city: 48,
    airport: 36,
    neighborhood: 30,
    region: 18,
    attraction: 14,
    restaurant: 12,
    shopping: 12,
    shop: 10,
    poi: 8,
    country: -80
};

function geocodeKindScore(hit) {
    const k = String(hit?.kind ?? 'poi').trim();
    return GEOCODE_KIND_SCORE[k] ?? GEOCODE_KIND_SCORE.poi;
}

function isNearDuplicateGeocodeHit(a, b) {
    const latA = Number(a?.latitude);
    const lngA = Number(a?.longitude);
    const latB = Number(b?.latitude);
    const lngB = Number(b?.longitude);
    const sameCoord =
        Number.isFinite(latA) &&
        Number.isFinite(lngA) &&
        Number.isFinite(latB) &&
        Number.isFinite(lngB) &&
        Math.abs(latA - latB) < 0.045 &&
        Math.abs(lngA - lngB) < 0.045;
    const an = foldAscii(a?.name);
    const bn = foldAscii(b?.name);
    const sameName =
        Boolean(an && bn) && (an === bn || (an.length >= 4 && bn.length >= 4 && (an.includes(bn) || bn.includes(an))));
    const sameCountry = foldAscii(a?.country) === foldAscii(b?.country);
    return sameCoord || (sameName && sameCountry);
}

export function rankGeocodeHits(query, hits, opts = {}) {
    const q = String(query ?? '').trim();
    const ql = foldAscii(q);
    const latinQuery = /^[\sA-Za-zÀ-ÿ0-9'.,\-]+$/u.test(q);
    const prefer = String(opts.countryCodes ?? '')
        .split(/[,;]/)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
    return [...(hits ?? [])].sort((a, b) => {
        let sa = geocodeKindScore(a);
        let sb = geocodeKindScore(b);
        if (latinQuery) {
            if (isLatinUiText(a.name)) sa += 12;
            if (!isLatinUiText(a.name)) sa -= 25;
            if (isLatinUiText(b.name)) sb += 12;
            if (!isLatinUiText(b.name)) sb -= 25;
        }
        if (prefer.length) {
            const acc = String(a.countryCode ?? '').toLowerCase();
            const bcc = String(b.countryCode ?? '').toLowerCase();
            if (prefer.includes(acc)) sa += 18;
            if (prefer.includes(bcc)) sb += 18;
        }
        if (isGreatWallChinaQuery(q)) {
            const nearBeijing = (h) => {
                const ac = foldAscii(h.city);
                const ad = foldAscii(h.address);
                const la = Number(h.latitude);
                const lo = Number(h.longitude);
                if (ac.includes('beijing') || ac.includes('pequim') || ad.includes('beijing')) return 40;
                if (Number.isFinite(la) && Number.isFinite(lo) && la > 39.5 && la < 41.2 && lo > 115.8 && lo < 117.2) {
                    return 32;
                }
                if (isGreatWallPlaceName(h.name)) return 8;
                return 0;
            };
            sa += nearBeijing(a);
            sb += nearBeijing(b);
        }
        if (ql.length >= 2) {
            const an = foldAscii(a.name);
            const bn = foldAscii(b.name);
            const ac = foldAscii(a.city);
            const bc = foldAscii(b.city);
            if (an.includes(ql) || ql.includes(an)) sa += 35;
            if (bn.includes(ql) || ql.includes(bn)) sb += 35;
            if (ac.includes(ql) || ql.includes(ac)) sa += 28;
            if (bc.includes(ql) || ql.includes(bc)) sb += 28;
            if (an && an === foldAscii(a.country)) sa -= 45;
            if (bn && bn === foldAscii(b.country)) sb -= 45;
            if (isGreatWallChinaQuery(q)) {
                if (a.kind === 'attraction' || isGreatWallPlaceName(a.name)) sa += 55;
                if (b.kind === 'attraction' || isGreatWallPlaceName(b.name)) sb += 55;
                if (a.kind === 'city' && !isGreatWallPlaceName(a.name)) sa -= 30;
                if (b.kind === 'city' && !isGreatWallPlaceName(b.name)) sb -= 30;
            } else if (GEOCODE_ALIAS_COORDS[ql]) {
                // Query de cidade conhecida → prioriza hit city/airport.
                if (a.kind === 'city' || a.kind === 'airport') sa += 40;
                if (b.kind === 'city' || b.kind === 'airport') sb += 40;
                if (a.kind === 'attraction' || a.kind === 'poi') sa -= 12;
                if (b.kind === 'attraction' || b.kind === 'poi') sb -= 12;
            }
        }
        const ia = Number(a.importance ?? 0);
        const ib = Number(b.importance ?? 0);
        sa += ia;
        sb += ib;
        return sb - sa;
    });
}

/**
 * Lista curta e assertiva: alias de cidade no topo, dedupe, cidade/bairro antes de POI.
 * @param {string} query
 * @param {object[]} hits
 * @param {{ limit?: number, countryCodes?: string }} [opts]
 */
function normalizeGeocodeHitKind(hit, query) {
    if (!hit) return hit;
    if (isGreatWallChinaQuery(query) || isGreatWallPlaceName(hit.name) || isGreatWallPlaceName(hit.address)) {
        return { ...hit, kind: 'attraction' };
    }
    return hit;
}

export function curateGeocodeHits(query, hits, opts = {}) {
    const q = String(query ?? '').trim();
    const limit = Math.max(1, Number(opts.limit) || 5);
    const alias = geocodeAliasFallback(q);

    // Muralha / atrações com alias conhecido: uma opção assertiva.
    if (alias && (alias.kind === 'attraction' || isGreatWallChinaQuery(q))) {
        return [normalizeGeocodeHitKind(alias, q)];
    }

    // Cidade com alias exato: prioriza o alias; ainda pode trazer 1–2 vizinhos úteis.
    let list = [...(hits ?? [])].map((h) => normalizeGeocodeHitKind(h, q));
    if (alias) {
        list = [alias, ...list.filter((h) => !isNearDuplicateGeocodeHit(h, alias))];
    }
    list = rankGeocodeHits(q, list, { countryCodes: opts.countryCodes });

    const effectiveLimit = alias?.kind === 'city' ? Math.min(limit, 3) : limit;
    const out = [];
    for (const hit of list) {
        if (!hit || isGenericCountryGeocodeHit(hit, q)) continue;
        if (!Number.isFinite(Number(hit.latitude)) || !Number.isFinite(Number(hit.longitude))) continue;
        const dupIdx = out.findIndex((x) => isNearDuplicateGeocodeHit(x, hit));
        if (dupIdx >= 0) {
            if (geocodeKindScore(hit) > geocodeKindScore(out[dupIdx])) out[dupIdx] = hit;
            continue;
        }
        out.push(hit);
        if (out.length >= effectiveLimit) break;
    }
    return out;
}

function buildDisplayFromAddress(addr, details, countryCode, countryName) {
    const placeLabel = pickPlaceDisplayName({
        name: details['name:pt'] ?? details['name:pt-BR'],
        nameEn: details['name:en'] ?? details.name_en,
        nameLatin: details.int_name,
        countryCode,
        countryName
    });
    const cityRaw = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.suburb ?? addr.state;
    const city =
        cityRaw && hasCjkScript(cityRaw)
            ? pickPlaceDisplayName({
                  name: details['name:pt'],
                  nameEn: details['name:en'],
                  countryCode,
                  countryName: cityRaw
              }) || ''
            : cityRaw;
    const parts = [
        placeLabel,
        addr['addr:street'] ?? addr.road,
        city,
        countryDisplayName(addr.country, countryCode)
    ].filter(Boolean);
    return parts.join(', ');
}