import { haversineKm } from './geo-distance.js';
import {
    destinationHopFeatures,
    flightRouteLegFeatures,
    routeMarkerPoints,
    tripHasFlightRoute
} from './flight-route-geo.js';
import { honorManualGroundMode } from './ground-route-policy.js';
import { groundPathCoordinates } from './atlas-route-geometry.js';
import { greatCircleArc } from './great-circle.js';
import { isHomeDestination } from './trip-places.js';
import { visits } from './trips-engine.js';

function str(v) {
    return v == null ? '' : String(v).trim();
}

const FLIGHT_ITEM_PREFIX = 'rote-flight-';

function sortItineraryDays(days) {
    return [...(days ?? [])].sort((a, b) => {
        const ak = str(a.dayKey ?? a.day_key);
        const bk = str(b.dayKey ?? b.day_key);
        if (ak && bk && ak !== bk) return ak < bk ? -1 : 1;
        return String(a.id).localeCompare(String(b.id));
    });
}

function sortItineraryItems(items) {
    return [...(items ?? [])].sort((a, b) => {
        const at = str(a.time) || '99:99';
        const bt = str(b.time) || '99:99';
        if (at !== bt) return at < bt ? -1 : 1;
        return String(a.id).localeCompare(String(b.id));
    });
}

function validLngLat(lng, lat) {
    return (
        Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180 &&
        !(Math.abs(lat) < 0.02 && Math.abs(lng) < 0.02)
    );
}

/**
 * @param {Record<string, unknown>} trip
 * @returns {Map<string, { id: string, name?: string, latitude: number, longitude: number }>}
 */
function destinationsById(trip) {
    const map = new Map();
    for (const d of trip.payload?.destinations ?? []) {
        if (!d?.id) continue;
        map.set(String(d.id), d);
    }
    return map;
}

/**
 * Resolve coordenada de um item/dia de roteiro.
 * @param {Map<string, object>} byId
 */
function pointFromItineraryRef(byId, destinationId, fallbackLabel) {
    const id = str(destinationId);
    if (!id) return null;
    const d = byId.get(id);
    if (!d) return null;
    const lat = Number(d.latitude);
    const lng = Number(d.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (isHomeDestination(d)) return null;
    return {
        lng,
        lat,
        label: str(d.name) || str(fallbackLabel) || 'Parada'
    };
}

/**
 * Paradas ordenadas do roteiro (itinerary → coordenadas).
 * @param {Record<string, unknown>} trip
 */
export function itineraryMapStops(trip) {
    const byId = destinationsById(trip);
    /** @type {Array<{ lng: number, lat: number, label: string, destinationId: string, itemId: string, travelMode: string|null, dayKey: string }>} */
    const stops = [];
    const seenDest = new Set();

    const pushStop = (destId, item, dayKey) => {
        const id = str(destId);
        if (!id || seenDest.has(id)) return;
        const pt = pointFromItineraryRef(
            byId,
            id,
            item?.placeName ?? item?.place_name ?? item?.title
        );
        if (!pt || !validLngLat(pt.lng, pt.lat)) return;
        seenDest.add(id);
        stops.push({
            ...pt,
            destinationId: id,
            itemId: item ? String(item.id) : `day-${dayKey}-${id}`,
            travelMode: item ? str(item.travelMode ?? item.travel_mode) || null : null,
            dayKey
        });
    };

    for (const day of sortItineraryDays(trip.payload?.itinerary)) {
        const dayKey = str(day.dayKey ?? day.day_key);
        const dayDestId = day.destinationId ?? day.destination_id ?? null;
        let placed = false;
        for (const item of sortItineraryItems(day.items)) {
            const itemId = str(item.id);
            if (itemId.startsWith(FLIGHT_ITEM_PREFIX)) continue;
            const destId = item.destinationId ?? item.destination_id ?? dayDestId;
            const before = stops.length;
            pushStop(destId, item, dayKey);
            if (stops.length > before) placed = true;
        }
        if (!placed && dayDestId) pushStop(dayDestId, null, dayKey);
    }

    return stops;
}

function normalizeTravelLayer(mode) {
    const m = str(mode).toLowerCase();
    if (m === 'walk') return 'walk';
    if (m === 'flight') return 'flight';
    return 'ground';
}

/**
 * Trechos entre paradas do itinerary (linha reta ou great-circle conforme modo).
 * @param {Record<string, unknown>} trip
 */
export function itineraryLegFeatures(trip) {
    const stops = itineraryMapStops(trip);
    const hasFlight = tripHasFlightRoute(trip);
    const features = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const from = stops[i];
        const to = stops[i + 1];
        if (!validLngLat(from.lng, from.lat) || !validLngLat(to.lng, to.lat)) continue;
        const distKm =
            haversineKm(from.lat, from.lng, to.lat, to.lng) ??
            haversineKm(to.lat, to.lng, from.lat, from.lng) ??
            0;
        /** No atlas: não inventar voo de longa distância; voos vêm do cenário. */
        const auto = 'ground';
        const manual = str(to.travelMode);
        const resolved = manual
            ? honorManualGroundMode(auto, manual, distKm, {
                  sameCountry: false,
                  groundKind: null
              })
            : auto;
        let layer = normalizeTravelLayer(resolved);
        if (!manual && distKm >= 280) continue;
        if (layer === 'flight' && hasFlight) continue;
        if (layer === 'flight' && !manual) continue;
        if (hasFlight && distKm >= 420 && layer !== 'walk') continue;
        const fromPt = { lng: from.lng, lat: from.lat, label: from.label };
        const toPt = { lng: to.lng, lat: to.lat, label: to.label };
        let coordinates;
        if (layer === 'flight') {
            coordinates = greatCircleArc(fromPt, toPt, 48);
            if (coordinates.length >= 2) {
                coordinates[0] = [from.lng, from.lat];
                coordinates[coordinates.length - 1] = [to.lng, to.lat];
            }
        } else if (layer === 'walk') {
            coordinates = groundPathCoordinates(fromPt, toPt, 'walk', distKm);
        } else {
            coordinates = groundPathCoordinates(fromPt, toPt, 'ground', distKm);
        }
        if (coordinates.length < 2) continue;
        if (
            !coordinates.every(
                (c) => Array.isArray(c) && c.length >= 2 && validLngLat(Number(c[0]), Number(c[1]))
            )
        ) {
            continue;
        }
        features.push({
            type: 'Feature',
            properties: {
                tripId: trip.id,
                layer,
                source: 'itinerary',
                from: from.label,
                to: to.label,
                dayKey: to.dayKey,
                itemId: to.itemId,
                distKm: Math.round(distKm * 10) / 10
            },
            geometry: {
                type: 'LineString',
                coordinates
            }
        });
    }
    return features;
}

function splitByLayer(features) {
    const ground = [];
    const walk = [];
    const flight = [];
    for (const f of features) {
        const layer = f.properties?.layer;
        if (layer === 'walk') walk.push(f);
        else if (layer === 'flight') flight.push(f);
        else ground.push(f);
    }
    return { ground, walk, flight };
}

/**
 * Modelo do mapa do atlas (home Viagens).
 * @param {unknown[]} trips
 * @param {{ now?: Date }} [options]
 */
export function buildAtlasMapModel(trips, options = {}) {
    const list = Array.isArray(trips) ? trips : [];
    const now = options.now ?? new Date();
    const visitList = visits(list, now);

    const { ida, volta } = flightRouteLegFeatures(list);
    const idaFeatures = [...ida.features];
    const voltaFeatures = [...volta.features];

    const itineraryGround = [];
    const itineraryWalk = [];
    const itineraryFlight = [];

    for (const trip of list) {
        const legs = itineraryLegFeatures(trip);
        const split = splitByLayer(legs);
        itineraryGround.push(...split.ground);
        itineraryWalk.push(...split.walk);
        itineraryFlight.push(...split.flight);

        if (!tripHasFlightRoute(trip)) {
            idaFeatures.push(...destinationHopFeatures(trip, visitList));
        }
    }

    return {
        visits: visitList,
        pins: routeMarkerPoints(list, visitList, now),
        layers: {
            flightOut: { type: 'FeatureCollection', features: idaFeatures },
            flightBack: { type: 'FeatureCollection', features: voltaFeatures },
            ground: { type: 'FeatureCollection', features: itineraryGround },
            walk: { type: 'FeatureCollection', features: itineraryWalk },
            itineraryFlight: { type: 'FeatureCollection', features: itineraryFlight }
        },
        meta: {
            trips: list.map((t) => ({
                tripId: t.id,
                title: t.title,
                hasFlightRoute: tripHasFlightRoute(t),
                itineraryStops: itineraryMapStops(t).length,
                itineraryLegs: itineraryLegFeatures(t).length
            }))
        }
    };
}