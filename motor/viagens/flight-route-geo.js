import { AIRPORTS_CATALOG } from './airports-catalog.js';
import { AIRPORT_COORDS } from './airport-coords.js';
import { sortFlightSimulations, tripFlightSegments } from './flight-simulation.js';
import { isHomeDestination, isHomeName, routeStops } from './trip-places.js';
import { effectiveStatus } from './trips-engine.js';
import { greatCircleArc, smoothRouteCoordinates } from './great-circle.js';
import { VIAGENS_HOME } from './viagens-atlas.js';

function folded(name) {
    return String(name ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();
}

function str(v) {
    return v == null ? '' : String(v).trim();
}

const PLACE_ALIASES = {
    madri: 'MAD',
    madrid: 'MAD',
    china: 'PEK',
    pequim: 'PEK',
    beijing: 'PEK',
    xangai: 'PVG',
    shanghai: 'PVG',
    'hong kong': 'HKG',
    paris: 'CDG',
    londres: 'LHR',
    'sao paulo': 'GRU',
    'são paulo': 'GRU',
    lisboa: 'LIS',
    barcelona: 'BCN',
    tokyo: 'NRT',
    toquio: 'NRT',
    'tóquio': 'NRT',
    recife: 'REC'
};

function homeAirportPoint() {
    return {
        lng: VIAGENS_HOME.longitude,
        lat: VIAGENS_HOME.latitude,
        label: VIAGENS_HOME.name
    };
}

function coordsForIata(iata) {
    const key = String(iata ?? '').toUpperCase();
    const pair = AIRPORT_COORDS[key];
    if (!pair) return null;
    return { lng: pair[0], lat: pair[1], label: key };
}

export function extractIata(text) {
    const t = str(text);
    const paren = t.match(/\(([A-Z]{3})\)/);
    if (paren) return paren[1];
    if (/^[A-Za-z]{3}$/.test(t)) return t.toUpperCase();
    const word = t.match(/\b([A-Z]{3})\b/);
    return word ? word[1] : null;
}

export function resolveFlightPlace(place, destinations = []) {
    const raw = str(place);
    if (!raw) return null;

    if (isHomeName(raw) || folded(raw).includes('recife') || folded(raw) === 'rec') {
        return homeAirportPoint();
    }

    const aliasKey = folded(raw);
    if (PLACE_ALIASES[aliasKey]) {
        const fromAlias = coordsForIata(PLACE_ALIASES[aliasKey]);
        if (fromAlias) return fromAlias;
    }

    const iata = extractIata(raw);
    if (iata) {
        const hit = coordsForIata(iata);
        if (hit) return hit;
        const catalog = AIRPORTS_CATALOG.find((a) => a.iata === iata);
        if (catalog) return coordsForIata(catalog.iata) ?? null;
    }

    const f = folded(raw);
    for (const a of AIRPORTS_CATALOG) {
        const city = folded(a.city);
        const country = folded(a.country);
        const name = folded(a.name);
        if (f === city || f === name || f.includes(city) || city.includes(f)) {
            const c = coordsForIata(a.iata);
            if (c) return c;
        }
        if (country && f === country) {
            const c = coordsForIata(a.iata);
            if (c) return { ...c, label: a.country };
        }
    }

    for (const d of destinations ?? []) {
        const dn = folded(d.name);
        const dc = folded(d.country ?? '');
        if (!dn && !dc) continue;
        if (f === dn || f.includes(dn) || dn.includes(f) || (dc && (f === dc || f.includes(dc)))) {
            if (Number.isFinite(d.longitude) && Number.isFinite(d.latitude)) {
                return { lng: d.longitude, lat: d.latitude, label: d.name || d.country || raw };
            }
        }
    }

    return null;
}

function samePoint(a, b) {
    if (!a || !b) return false;
    return Math.abs(a.lng - b.lng) < 0.02 && Math.abs(a.lat - b.lat) < 0.02;
}

function mergePointLists(base, extra) {
    if (!extra?.length) return base ?? [];
    const out = [...(base ?? [])];
    for (const p of extra) {
        const last = out[out.length - 1];
        if (last && samePoint(last, p)) continue;
        out.push(p);
    }
    return out;
}

function simOutboundPoints(sim, destinations) {
    const pts = [];
    const add = (place) => {
        const p = resolveFlightPlace(place, destinations);
        if (!p) return;
        const last = pts[pts.length - 1];
        if (last && samePoint(last, p)) return;
        pts.push(p);
    };
    add(sim.origin);
    for (const c of sim.connections ?? []) add(c.place);
    add(sim.destination);
    return pts;
}

function simReturnPoints(sim, destinations) {
    const pts = [];
    const add = (place) => {
        const p = resolveFlightPlace(place, destinations);
        if (!p) return;
        const last = pts[pts.length - 1];
        if (last && samePoint(last, p)) return;
        pts.push(p);
    };
    add(sim.destination);
    for (const c of sim.returnConnections ?? []) add(c.place);
    add(sim.origin);
    return pts;
}

function startsNearHome(point) {
    if (!point) return false;
    return samePoint(point, { lng: VIAGENS_HOME.longitude, lat: VIAGENS_HOME.latitude });
}

function placeMarkerKey(point) {
    if (!point) return '';
    const label = folded(point.label ?? '');
    return `${Math.round(point.lng * 100)}:${Math.round(point.lat * 100)}:${label}`;
}

/** Destino final de cada voo escolhido (ida), para pins no atlas. */
/** Pins de rota e destinos (exceto casa) para o atlas. */
export function routeMarkerPoints(trips = [], visits = [], now = new Date()) {
    const out = [];
    const seen = new Set();
    const push = (trip, pt, meta = {}) => {
        if (!pt || !Number.isFinite(pt.lng) || !Number.isFinite(pt.lat)) return;
        if (startsNearHome(pt)) return;
        const key = placeMarkerKey(pt);
        if (seen.has(key)) return;
        seen.add(key);

        const status = effectiveStatus({
            startsOn: trip.starts_on ?? trip.startsOn,
            endsOn: trip.ends_on ?? trip.endsOn,
            statusOverride: trip.status_override ?? trip.statusOverride,
            now
        });

        let visit = null;
        for (const v of visits ?? []) {
            if (v.tripId !== trip.id) continue;
            const lat = v.destination?.latitude;
            const lng = v.destination?.longitude;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            if (Math.abs(lng - pt.lng) < 0.08 && Math.abs(lat - pt.lat) < 0.08) {
                visit = v;
                break;
            }
        }

        const label = str(pt.label) || str(visit?.destination?.name) || 'Destino';
        out.push({
            id: visit?.id ?? `${trip.id}-${key}`,
            lng: pt.lng,
            lat: pt.lat,
            label,
            tripId: trip.id,
            status: visit?.status ?? status,
            isPrincipal: Boolean(meta.isPrincipal ?? visit?.destination?.isPrincipal),
            visit
        });
    };

    for (const trip of trips) {
        const destinations = trip.payload?.destinations ?? [];
        for (const dest of destinations) {
            if (isHomeDestination(dest)) continue;
            const lat = dest.latitude;
            const lng = dest.longitude;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            push(trip, { lng, lat, label: dest.name }, { isPrincipal: dest.isPrincipal });
        }
        const paths = tripFlightPaths(trip);
        if (paths) {
            for (const pt of paths.ida) push(trip, pt);
            for (const pt of paths.volta ?? []) push(trip, pt);
        }
    }
    return out;
}

export function flightArrivalPoints(trips = []) {
    const out = [];
    const seen = new Set();
    for (const trip of trips) {
        const payload = trip?.payload ?? {};
        const destinations = payload.destinations ?? [];
        for (const sim of chosenSimulations(payload)) {
            const pts = simOutboundPoints(sim, destinations);
            if (!pts.length) continue;
            const last = pts[pts.length - 1];
            if (!last || startsNearHome(last)) continue;
            const key = placeMarkerKey(last);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                lng: last.lng,
                lat: last.lat,
                label: last.label || 'Destino',
                tripId: trip.id
            });
        }
    }
    return out;
}

function chosenSimulations(payload) {
    return tripFlightSegments(payload)
        .map((seg) => {
            const sims = sortFlightSimulations(seg.simulations ?? []).filter((s) => s.status !== 'descartada');
            return sims.find((s) => s.status === 'escolhida') ?? sims[0] ?? null;
        })
        .filter(Boolean);
}

/** Monta ida/volta a partir dos voos (escolhidos ou melhor candidato por trecho). */
export function tripFlightPaths(trip) {
    const payload = trip?.payload ?? {};
    const destinations = payload.destinations ?? [];
    const chosen = chosenSimulations(payload);
    if (!chosen.length) return null;

    let ida = [];
    for (const sim of chosen) {
        ida = mergePointLists(ida, simOutboundPoints(sim, destinations));
    }
    if (ida.length && !startsNearHome(ida[0])) {
        ida.unshift(homeAirportPoint());
    }

    let volta = [];
    for (const sim of chosen) {
        if (!sim.isRoundTrip) continue;
        volta = mergePointLists(volta, simReturnPoints(sim, destinations));
    }

    let inferredVolta = false;
    if (!volta.length && ida.length >= 2) {
        volta = [...ida].reverse();
        inferredVolta = true;
    }

    return { ida, volta, inferredVolta, simulationCount: chosen.length };
}

/** Um arco geodésico por parada (ex.: Recife→Madri e Madri→China em linhas separadas). */
function lineFeaturesForPath(tripId, leg, points, inferred = false) {
    if ((points?.length ?? 0) < 2) return [];
    const features = [];
    for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        const coordinates = greatCircleArc(from, to, 64);
        if (coordinates.length < 2) continue;
        features.push({
            type: 'Feature',
            properties: {
                tripId,
                leg,
                inferred: !!inferred,
                segment: i,
                from: from.label ?? '',
                to: to.label ?? ''
            },
            geometry: {
                type: 'LineString',
                coordinates
            }
        });
    }
    return features;
}

export function flightRouteLegFeatures(trips = []) {
    const ida = [];
    const volta = [];
    for (const trip of trips) {
        const paths = tripFlightPaths(trip);
        if (!paths) continue;
        ida.push(...lineFeaturesForPath(trip.id, 'ida', paths.ida, false));
        if (!paths.inferredVolta && paths.volta.length >= 2) {
            volta.push(...lineFeaturesForPath(trip.id, 'volta', paths.volta, false));
        }
    }
    return {
        ida: { type: 'FeatureCollection', features: ida },
        volta: { type: 'FeatureCollection', features: volta }
    };
}

export function tripHasFlightRoute(trip) {
    return tripFlightPaths(trip) != null;
}

/** Fallback: rota por destinos quando não há voos mapeáveis. */
export function destinationHopFeatures(trip, visits = []) {
    const stops = routeStops(trip.payload?.destinations ?? []);
    if (!stops.length) return [];
    const coords = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
    for (const dest of stops) {
        const visit = visits.find((v) => v.tripId === trip.id && v.destination.id === dest.id);
        if (visit) {
            const lat = visit.destination.latitude;
            const lng = visit.destination.longitude;
            coords.push([lng, lat]);
        } else {
            coords.push([dest.longitude, dest.latitude]);
        }
    }
    coords.push([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]);
    const points = coords.map(([lng, lat]) => ({ lng, lat }));
    return lineFeaturesForPath(trip.id, 'ida', points, true);
}