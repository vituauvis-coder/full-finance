/** Posição solar aproximada (Almanaque Astronômico, baixa precisão). */

const RAD = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;

function wrapLng(degrees) {
    return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

function clampLat(lat) {
    return Math.max(-89.999, Math.min(89.999, lat));
}

/**
 * Ponto subsolar: onde o Sol está a pino agora — [lng, lat] em graus.
 * @param {Date} date
 * @returns {[number, number]}
 */
export function subsolarPoint(date) {
    const d = (date.getTime() - J2000) / DAY_MS;
    const meanAnomaly = (357.529 + 0.98560028 * d) * RAD;
    const meanLongitude = 280.459 + 0.98564736 * d;
    const eclipticLongitude =
        (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
    const obliquity = (23.439 - 0.00000036 * d) * RAD;
    const rightAscension = Math.atan2(
        Math.cos(obliquity) * Math.sin(eclipticLongitude),
        Math.cos(eclipticLongitude)
    );
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
    const siderealTime = 280.46061837 + 360.98564736629 * d;
    return [wrapLng(rightAscension / RAD - siderealTime), declination / RAD];
}

/**
 * Destino em distância e rumo (graus) a partir de [lng, lat].
 * @param {number} lng
 * @param {number} lat
 * @param {number} distanceDeg
 * @param {number} bearingDeg
 * @returns {[number, number]}
 */
/** Distância angular em graus entre dois pontos na esfera. */
export function angularDistanceDeg(lng1, lat1, lng2, lat2) {
    const p1 = lat1 * RAD;
    const p2 = lat2 * RAD;
    const dq = (lng1 - lng2) * RAD;
    const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dq);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Altitude solar aparente em graus (−90…+90) para [lng, lat] no instante. */
export function sunAltitudeDeg(lng, lat, date) {
    const sub = subsolarPoint(date);
    return 90 - angularDistanceDeg(lng, lat, sub[0], sub[1]);
}

/** Faixa fina no terminador (~4°) — crepúsculo curto, noite bem marcada. */
const NIGHT_SHADE_MAX = 0.74;
const TERMINATOR_TWILIGHT_DEG = 4;

/** Opacidade da sombra noturna (0 = dia pleno). */
export function nightShadeAlpha(altitudeDeg) {
    if (altitudeDeg >= 0) return 0;
    if (altitudeDeg <= -TERMINATOR_TWILIGHT_DEG) return NIGHT_SHADE_MAX;
    return (-altitudeDeg / TERMINATOR_TWILIGHT_DEG) * NIGHT_SHADE_MAX;
}

export function destinationPoint(lng, lat, distanceDeg, bearingDeg) {
    const lat1 = lat * RAD;
    const lon1 = lng * RAD;
    const brng = bearingDeg * RAD;
    const dist = distanceDeg * RAD;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));
    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(brng) * Math.sin(dist) * Math.cos(lat1),
            Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2)
        );
    return [wrapLng(lon2 / RAD), clampLat(lat2 / RAD)];
}

/**
 * Luz do estilo MapLibre ancorada no subsolar (atmosfera / terminador).
 * @param {[number, number]} subsolar
 */
export function sunLightForSubsolar(subsolar) {
    const [lng, lat] = subsolar;
    const x = -Math.cos(lat * RAD) * Math.sin(lng * RAD);
    const y = -Math.sin(lat * RAD);
    const z = -Math.cos(lat * RAD) * Math.cos(lng * RAD);
    const polar = Math.acos(Math.max(-1, Math.min(1, z))) / RAD;
    const azimuthal = Math.atan2(y, x) / RAD - 90;
    return /** @type {const} */ ({ anchor: 'map', position: /** @type {[number, number, number]} */ ([1.5, azimuthal, polar]), intensity: 0.4 });
}

/**
 * Polígono GeoJSON cobrindo o hemisfério noturno (sombra no globo).
 * @param {Date} date
 */
export function nightHemisphereFeature(date) {
    const [sunLng, sunLat] = subsolarPoint(date);
    const term = [];
    for (let b = 0; b <= 360; b += 6) {
        term.push(destinationPoint(sunLng, sunLat, 90, b));
    }
    const nightPoleLng = wrapLng(sunLng + 180);
    const nightPoleLat = clampLat(-sunLat);
    const ring = [[nightPoleLng, nightPoleLat], ...term, [nightPoleLng, nightPoleLat]];
    return {
        type: 'Feature',
        properties: { kind: 'night' },
        geometry: { type: 'Polygon', coordinates: [ring] }
    };
}

/** Faixa crepuscular (~6°) à borda do lado noturno. */
export function twilightBandFeature(date) {
    const [sunLng, sunLat] = subsolarPoint(date);
    const inner = [];
    const outer = [];
    for (let b = 0; b <= 360; b += 6) {
        inner.push(destinationPoint(sunLng, sunLat, 90, b));
        outer.push(destinationPoint(sunLng, sunLat, 84, b));
    }
    const ring = [...outer, ...[...inner].reverse(), outer[0]];
    return {
        type: 'Feature',
        properties: { kind: 'twilight' },
        geometry: { type: 'Polygon', coordinates: [ring] }
    };
}

/** Ponto do Sol sobre o globo (subsolar). */
export function sunMarkerFeature(date) {
    const [lng, lat] = subsolarPoint(date);
    return {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] }
    };
}

/** FeatureCollection com noite + marcador do Sol. */
export function sunOverlayGeoJson(date) {
    return {
        type: 'FeatureCollection',
        features: [nightHemisphereFeature(date), sunMarkerFeature(date)]
    };
}