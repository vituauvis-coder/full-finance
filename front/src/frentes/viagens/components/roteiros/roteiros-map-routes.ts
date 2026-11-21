import { greatCircleArc } from '@motor/viagens/great-circle.js';
import { AIRPORTS_CATALOG } from '@motor/viagens/airports-catalog.js';
import { extractIata, resolveFlightPlace } from '@motor/viagens/flight-route-geo.js';
import {
    AUTO_FLIGHT_KM,
    estimateGroundDurationMin,
    honorManualGroundMode,
    shouldDrawManualGroundLeg,
    walkDistanceCapKm
} from '@motor/viagens/ground-route-policy.js';
import { flightStampParts } from '../../domain/flightDisplay';
import { isHomeDestination, routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import { chosenScenarioFromPayload } from '../../domain/chosenScenarioResumo';
import {
    countryNameFromPlace,
    hopDestination,
    hopOrigin,
    hopsFromChosenFlights,
    normalizeScenario,
    sortHopsChronologically,
    type TripTimeHop
} from '../../domain/tripTimeScenario';
import type {
    TripDestination,
    TripFlightSegment,
    TripGroundTransport,
    TripItineraryDay,
    TripItineraryItem,
    TripPayload
} from '../../types';
import {
    normalizeMapDestinationPlace,
    normalizeTravelMode,
    orderedTimelineDestinations,
    sortedItineraryDays
} from './roteiros-display';

/** Modo visual no mapa (voo ida/volta separados). */
export type RoteirosRouteMode = 'flight_out' | 'flight_back' | 'ground' | 'walk';

/** Classificação de trecho antes de separar ida/volta. */
type RoteirosHopKind = 'flight' | 'ground' | 'walk';

export type RoteirosRouteSegment = {
    id: string;
    mode: RoteirosRouteMode;
    fromLabel: string;
    toLabel: string;
    coordinates: [number, number][];
    mid: { longitude: number; latitude: number };
    /** Minutos estimados (haversine × velocidade do modo). */
    durationMin: number;
    /** Rótulo curto p/ pill no mapa, ex.: `~12 min` / `~2 h`. */
    durationLabel: string;
    /** Horário do voo (partida→chegada) quando houver no hop. */
    scheduleLabel?: string;
    /** Kind do bilhete terrestre vinculado (train/bus/…) — evita OSRM carro em HSR. */
    groundKind?: string | null;
    tip?: string;
};

/** Aeroporto / hub onde um voo pousa ou decola (marco no mapa). */
export type RoteirosFlightAirport = {
    id: string;
    label: string;
    /** Cidade curta (Madri, Pequim). */
    city: string;
    code: string;
    country: string;
    latitude: number;
    longitude: number;
    /** Destino existente no payload que esta cidade do aero cobre (evita pin duplicado). */
    linkedDestinationId?: string;
};

const FLIGHT_KM = 180;
const WALK_KM = walkDistanceCapKm();

/** Velocidades médias p/ estimativa visual no trecho (km/h). */
const HOP_SPEED_KMH: Record<RoteirosHopKind, number> = {
    walk: 4.5,
    ground: 70,
    flight: 750
};

function groundTransportsOf(payload: TripPayload | undefined): TripGroundTransport[] {
    return payload?.ground_transports ?? payload?.groundTransports ?? [];
}

function groundKindForItem(
    item: Pick<TripItineraryItem, 'groundTransportId' | 'ground_transport_id'> | null | undefined,
    payload: TripPayload | undefined
): string | null {
    const id = item?.groundTransportId ?? item?.ground_transport_id ?? null;
    if (!id) return null;
    const hit = groundTransportsOf(payload).find((t) => t.id === id);
    return hit?.kind ?? null;
}

/** Estimativa em minutos a partir da distância e do modo do trecho. */
export function estimateHopDurationMin(
    kind: RoteirosHopKind,
    km: number,
    groundKind: string | null = null
): number {
    if (!Number.isFinite(km) || km <= 0) return 1;
    if (kind === 'ground') return estimateGroundDurationMin(km, groundKind);
    const speed = kind === 'walk' ? HOP_SPEED_KMH.walk : HOP_SPEED_KMH.flight;
    if (!Number.isFinite(speed) || speed <= 0) return 1;
    let min = Math.max(1, Math.round((km / speed) * 60));
    // Voo: soma tempo de solo (embarque/taxi) p/ ficar perto do “1 h e pouco” do Maps.
    if (kind === 'flight') min += km < 1500 ? 40 : 25;
    return min;
}

export function formatHopDurationLabel(durationMin: number): string {
    const m = Math.max(1, Math.round(durationMin));
    if (m < 60) return `~${m} min`;
    const hours = m / 60;
    if (hours < 10) {
        const rounded = Math.round(hours * 2) / 2;
        const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
        return `~${text} h`;
    }
    return `~${Math.round(hours)} h`;
}

function haversineKm(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
): number {
    const r = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function foldedCountry(d: TripDestination): string {
    return (d.country ?? d.name ?? '').trim().toLowerCase();
}

function flightPairFromPayload(
    from: TripDestination,
    to: TripDestination,
    segments: TripFlightSegment[]
): boolean {
    const chosen = (segments ?? [])
        .flatMap((s) => s.simulations ?? [])
        .filter((sim) => sim?.status === 'escolhida');
    const fromName = `${from.name} ${from.country ?? ''}`.toLowerCase();
    const toName = `${to.name} ${to.country ?? ''}`.toLowerCase();
    for (const sim of chosen) {
        const o = `${sim.origin ?? ''}`.toLowerCase();
        const d = `${sim.destination ?? ''}`.toLowerCase();
        if (!o || !d) continue;
        const hitForward =
            (fromName.includes(o) || o.includes(from.name.toLowerCase())) &&
            (toName.includes(d) || d.includes(to.name.toLowerCase()));
        const hitBack =
            (fromName.includes(d) || d.includes(from.name.toLowerCase())) &&
            (toName.includes(o) || o.includes(to.name.toLowerCase()));
        if (hitForward || hitBack) return true;
    }
    return false;
}

export function classifyRoteirosHop(
    from: TripDestination,
    to: TripDestination,
    payload?: TripPayload
): RoteirosHopKind {
    const segments = payload?.flight_segments ?? payload?.flightSegments ?? [];
    if (flightPairFromPayload(from, to, segments)) return 'flight';

    const dist = haversineKm(from, to);
    const fromC = foldedCountry(from);
    const toC = foldedCountry(to);
    const crossCountry = Boolean(fromC && toC && fromC !== toC);
    const homeHop = isHomeDestination(from) || isHomeDestination(to);

    const fromAirport = from.kind === 'airport';
    const toAirport = to.kind === 'airport';
    if (fromAirport && toAirport) return 'flight';
    if ((fromAirport || toAirport) && crossCountry) return 'flight';
    if ((fromAirport || toAirport) && dist >= FLIGHT_KM) return 'flight';
    if (fromAirport || toAirport) return 'ground';
    if (homeHop && dist >= FLIGHT_KM) return 'flight';
    if (crossCountry && dist >= 80) return 'flight';
    if (dist >= AUTO_FLIGHT_KM) return 'flight';

    const walkish =
        from.kind === 'neighborhood' ||
        to.kind === 'neighborhood' ||
        (from.kind === 'poi' && to.kind === 'poi' && dist <= WALK_KM);
    if (walkish && dist <= WALK_KM) return 'walk';
    if (dist <= 6 && fromC && fromC === toC) return 'walk';

    return 'ground';
}

/**
 * Modo do trecho no mapa: atividade no destino pode refinar trechos curtos.
 * Voo/long-haul (Recife→Madri etc.) não vira “a pé” por passeio local no destino.
 */
export function travelModeForLeg(
    to: TripDestination,
    itinerary: TripItineraryDay[] | undefined,
    from: TripDestination,
    payload: TripPayload | undefined
): RoteirosHopKind {
    const auto = classifyRoteirosHop(from, to, payload);
    const dist = haversineKm(from, to);
    const sameCountry = Boolean(
        foldedCountry(from) && foldedCountry(to) && foldedCountry(from) === foldedCountry(to)
    );

    let manual: RoteirosHopKind | null = null;
    let manualGroundKind: string | null = null;
    let manualDayIdx = -1;
    const sortedDays = sortedItineraryDays(itinerary ?? []);
    for (const [dayIdx, day] of sortedDays.entries()) {
        for (const item of day.items ?? []) {
            if (item.id.startsWith('rote-flight-')) continue;
            if (item.destinationId !== to.id) continue;
            const m = normalizeTravelMode(item.travelMode);
            if (!m) continue;
            if (dayIdx >= manualDayIdx) {
                manualDayIdx = dayIdx;
                manual = m;
                manualGroundKind = m === 'ground' ? groundKindForItem(item, payload) : null;
            }
        }
    }

    if (manual) {
        // Passeio a pé em Madri não rebaixa o arco Recife→Madri.
        if (manual === 'walk' && (auto === 'flight' || dist > WALK_KM)) return auto;
        if (manual === 'ground') {
            return honorManualGroundMode(auto, 'ground', dist, {
                sameCountry,
                groundKind: manualGroundKind
            }) as RoteirosHopKind;
        }
        return manual;
    }

    if (auto === 'flight' && (from.kind === 'airport' || to.kind === 'airport')) {
        if (sameCountry) return 'ground';
    }
    return auto;
}

/** Índice do ponto mais longe de casa na cadeia (ápice da ida). */
function farthestStopIndex(
    chain: TripDestination[],
    home: { latitude: number; longitude: number }
): number {
    let best = 1;
    let bestDist = -1;
    for (let i = 1; i < chain.length - 1; i++) {
        const d = haversineKm(home, chain[i]!);
        if (d >= bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

/** Afastamento leve do arco de volta para não empilhar com a ida. */
function offsetArcCoordinates(
    coords: [number, number][],
    offsetDeg: number
): [number, number][] {
    if (coords.length < 3 || offsetDeg === 0) return coords;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    return coords.map((c, i) => {
        const t = i / (coords.length - 1);
        const bulge = Math.sin(Math.PI * t);
        return [c[0] + px * offsetDeg * bulge, c[1] + py * offsetDeg * bulge];
    });
}

/** Ondulação suave (quase S) para trecho terrestre parecer caminho, não corda. */
function undulatePathCoordinates(
    coords: [number, number][],
    ampDeg: number
): [number, number][] {
    if (coords.length < 5 || ampDeg === 0) return coords;
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    return coords.map((c, i) => {
        const t = i / (coords.length - 1);
        // 2 lombadas leves no meio do trajeto
        const wave = Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t);
        return [c[0] + px * ampDeg * wave, c[1] + py * ampDeg * wave];
    });
}

/** Curva trabalhada p/ terrestre / a pé (mais pontos + bulge + ondulação). */
function groundPathCoordinates(
    from: { lng: number; lat: number },
    to: { lng: number; lat: number },
    kind: 'ground' | 'walk',
    distKm: number
): [number, number][] {
    const steps =
        kind === 'walk'
            ? Math.max(20, Math.min(40, Math.round(distKm * 2.2) + 16))
            : Math.max(28, Math.min(56, Math.round(distKm * 1.4) + 22));
    let coords = greatCircleArc(from, to, steps) as [number, number][];
    const sign =
        Math.abs((from.lng * 12.3 + to.lat * 7.1 + from.lat * 3.7) * 100) % 2 >= 1 ? 1 : -1;
    // Bulge principal: curto ≈ 0.1°, médio ≈ 0.35°, teto 0.7°
    const primary = Math.min(0.7, Math.max(0.1, distKm / 140)) * sign;
    coords = offsetArcCoordinates(coords, primary);
    if (kind === 'ground') {
        coords = undulatePathCoordinates(coords, primary * 0.28);
    } else {
        coords = undulatePathCoordinates(coords, primary * 0.14);
    }
    return coords;
}

function toMapMode(kind: RoteirosHopKind, legIndex: number, farthestIdx: number): RoteirosRouteMode {
    if (kind !== 'flight') return kind;
    // Até chegar no ponto mais longe = ida; depois = volta.
    return legIndex < farthestIdx ? 'flight_out' : 'flight_back';
}

function foldMapPlace(s: string): string {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

function isBrasilOrHomePlace(place: string, dest?: TripDestination | null): boolean {
    if (dest && isHomeDestination(dest)) return true;
    const c = countryNameFromPlace(place);
    if (c === 'Brasil') return true;
    const f = foldMapPlace(place);
    return /^(recife|rec|brasil|brazil)$/.test(f) || f.includes('recife');
}

/** Pontos geográficos a partir do rótulo do hop (IATA/cidade). */
function destinationFromFlightPlace(
    place: string,
    destinations: TripDestination[],
    idPrefix: string
): TripDestination | null {
    const raw = place.trim();
    if (!raw) return null;
    const pt = resolveFlightPlace(raw, destinations);
    if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return null;
    const home = isBrasilOrHomePlace(raw);
    return {
        id: home ? 'rote-home' : `${idPrefix}-${foldMapPlace(pt.label || raw).replace(/\s+/g, '-')}`,
        name: home ? VIAGENS_HOME.name : pt.label || raw,
        latitude: home ? VIAGENS_HOME.latitude : pt.lat,
        longitude: home ? VIAGENS_HOME.longitude : pt.lng,
        kind: 'airport',
        country: countryNameFromPlace(raw) || undefined,
        guideHighlights: [],
        guideAlerts: []
    };
}

/** Hops do cenário escolhido (ou voos escolhidos na ficha) — fonte da verdade do mapa. */
function flightHopsForMap(payload: TripPayload | undefined, destinations: TripDestination[]): TripTimeHop[] {
    if (!payload) return [];
    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const scenario = chosenScenarioFromPayload(payload);
    if (scenario) {
        const normalized = normalizeScenario(scenario, segments, destinations);
        const hops = sortHopsChronologically(
            ((normalized.hops as TripTimeHop[] | undefined) ?? []).map((h) => ({ ...h }))
        );
        if (hops.length) return hops;
    }
    return hopsFromChosenFlights(segments);
}

function flightMapMode(from: TripDestination, to: TripDestination): RoteirosRouteMode {
    const home = { latitude: VIAGENS_HOME.latitude, longitude: VIAGENS_HOME.longitude };
    if (isHomeDestination(to) || isBrasilOrHomePlace(to.name, to)) return 'flight_back';
    if (isHomeDestination(from) || isBrasilOrHomePlace(from.name, from)) return 'flight_out';
    const closerToHome = haversineKm(to, home) + 250 < haversineKm(from, home);
    return closerToHome ? 'flight_back' : 'flight_out';
}

function hopClockLabel(raw?: string | null): string {
    return flightStampParts(raw)?.time ?? '';
}

function hopScheduleLabel(hop: TripTimeHop): string {
    const dep = hopClockLabel(hop.departsAt ?? hop.departs_at);
    const arr = hopClockLabel(hop.arrivesAt ?? hop.arrives_at);
    if (dep && arr) return `${dep}→${arr}`;
    return dep || arr || '';
}

function airportCodeFromPlace(place: string, dest: TripDestination): string {
    const raw = place.trim();
    const fromRaw = extractIata(raw);
    if (fromRaw) return fromRaw;
    const fromName = extractIata(dest.name ?? '');
    if (fromName) return fromName;
    // Só IATA real do catálogo — não inventa código a partir do nome da cidade.
    const fold = foldMapPlace(raw || dest.name || '');
    const byCity = AIRPORTS_CATALOG.find(
        (a) => foldMapPlace(a.city) === fold || foldMapPlace(a.city).includes(fold) || fold.includes(foldMapPlace(a.city))
    );
    if (byCity) return byCity.iata;
    return '';
}

function cityNameFromIata(code: string): string {
    const hit = AIRPORTS_CATALOG.find((a) => a.iata === code.toUpperCase());
    return String(hit?.city ?? '').trim();
}

function shortAirportCity(place: string, dest: TripDestination, code: string): string {
    if (code) {
        const fromIata = cityNameFromIata(code);
        if (fromIata) return fromIata;
    }
    const foldPlace = foldMapPlace(place || dest.name || '');
    const byCity = AIRPORTS_CATALOG.find(
        (a) =>
            foldMapPlace(a.city) === foldPlace ||
            foldPlace.includes(foldMapPlace(a.city)) ||
            foldMapPlace(a.city).includes(foldPlace)
    );
    if (byCity?.city) return byCity.city;

    const fromDest = String(dest.city ?? '').trim();
    if (fromDest && (!code || foldMapPlace(fromDest) !== foldMapPlace(code))) {
        return fromDest.split('/')[0]!.trim();
    }
    const raw = String(dest.name || place)
        .replace(code ? new RegExp(`\\s*\\(${code}\\)\\s*$`, 'i') : /$/, '')
        .split(/[,/·]/)[0]
        ?.trim();
    // Evita "MAD"/"Mad"/"PEK" como se fosse cidade.
    if (!raw || (code && foldMapPlace(raw) === foldMapPlace(code)) || /^[A-Za-z]{3}$/.test(raw)) {
        return cityNameFromIata(code) || raw || code || 'Cidade';
    }
    return raw;
}

function linkCatalogDestinationForAirport(
    destinations: TripDestination[],
    place: string,
    aero: { latitude: number; longitude: number; city: string; code: string; country: string }
): string | undefined {
    const cityFold = foldMapPlace(aero.city);
    const codeFold = foldMapPlace(aero.code);
    let best: TripDestination | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const d of destinations) {
        if (!Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) continue;
        if (isHomeDestination(d)) continue;
        const kind = String(d.kind ?? '').trim();
        // Só cidade/base/aero do catálogo — hotel/atração continuam pins próprios.
        if (kind && !['city', 'airport', 'neighborhood'].includes(kind)) continue;
        const nameFold = foldMapPlace(String(d.name ?? ''));
        const dCityFold = foldMapPlace(String(d.city ?? ''));
        const iata = extractIata(d.name ?? '') || extractIata(place);
        const nameHit =
            nameFold === cityFold ||
            dCityFold === cityFold ||
            nameFold.includes(cityFold) ||
            cityFold.includes(nameFold) ||
            (codeFold && (nameFold === codeFold || nameFold.includes(codeFold)));
        const dist = haversineKm(
            { latitude: aero.latitude, longitude: aero.longitude },
            { latitude: d.latitude, longitude: d.longitude }
        );
        if (nameHit && dist < 80 && dist < bestDist) {
            best = d;
            bestDist = dist;
        } else if (!nameHit && dist < 28 && dist < bestDist && (kind === 'city' || !kind)) {
            best = d;
            bestDist = dist;
        }
    }
    return best?.id;
}

function rememberFlightAirport(
    map: Map<string, RoteirosFlightAirport>,
    place: string,
    dest: TripDestination,
    catalog: TripDestination[]
): void {
    if (isHomeDestination(dest) || isBrasilOrHomePlace(place, dest)) return;
    const key = `${dest.latitude.toFixed(2)},${dest.longitude.toFixed(2)}`;
    if (map.has(key)) return;
    const code = airportCodeFromPlace(place, dest);
    const city = shortAirportCity(place, dest, code);
    const country = String(dest.country ?? countryNameFromPlace(place) ?? '').trim();
    const linkedDestinationId = linkCatalogDestinationForAirport(catalog, place, {
        latitude: dest.latitude,
        longitude: dest.longitude,
        city,
        code,
        country
    });
    map.set(key, {
        id: linkedDestinationId || `rote-aero-${foldMapPlace(code || city)}`,
        label: city,
        city,
        code,
        country,
        latitude: dest.latitude,
        longitude: dest.longitude,
        linkedDestinationId
    });
}

/** Destinos fixos de aeroporto p/ lista de locais + mapa (1 pin = aero, não cidade duplicada). */
/** Destino de lista/tag: nome da cidade. Pin no mapa continua com o código IATA. */
export function flightAirportsAsDestinations(airports: RoteirosFlightAirport[]): TripDestination[] {
    return airports.map((a) => ({
        id: a.id,
        name: a.city || a.label,
        kind: 'airport',
        city: a.city || a.label,
        country: a.country || undefined,
        latitude: a.latitude,
        longitude: a.longitude,
        guideHighlights: [],
        guideAlerts: []
    }));
}

/** Cidade/base coberta pelo marco do aeroporto (não desenhar 2×). */
export function isCityPinCoveredByAirport(
    dest: TripDestination,
    airports: RoteirosFlightAirport[]
): boolean {
    if (!airports.length) return false;
    const kind = String(dest.kind ?? '').trim();
    if (kind === 'airport') return true; // aero do catálogo some — o marco do voo manda
    if (
        kind === 'lodging' ||
        kind === 'hotel' ||
        kind === 'attraction' ||
        kind === 'poi' ||
        kind === 'restaurant' ||
        kind === 'food' ||
        kind === 'shopping' ||
        kind === 'shop'
    ) {
        return false;
    }
    if (String(dest.id ?? '').startsWith('rote-stay-')) return false;

    const nameFold = foldMapPlace(String(dest.name ?? ''));
    const cityFold = foldMapPlace(String(dest.city ?? ''));
    for (const a of airports) {
        if (a.linkedDestinationId && a.linkedDestinationId === dest.id) return true;
        if (a.id === dest.id) return true;
        const aCity = foldMapPlace(a.city || a.label);
        const nameHit =
            nameFold === aCity ||
            cityFold === aCity ||
            (aCity && nameFold.includes(aCity)) ||
            (aCity && cityFold.includes(aCity)) ||
            nameFold === foldMapPlace(a.code);
        const dist = haversineKm(
            { latitude: a.latitude, longitude: a.longitude },
            { latitude: dest.latitude, longitude: dest.longitude }
        );
        if (nameHit && dist < 80) return true;
        if (!nameHit && dist < 22 && (kind === 'city' || kind === 'neighborhood' || !kind)) return true;
    }
    return false;
}

/** Junta aeros dos voos na lista e remove cidade duplicada. */
export function mergeFlightAirportsIntoPlaces(
    places: TripDestination[],
    airports: RoteirosFlightAirport[]
): TripDestination[] {
    if (!airports.length) return places;
    const aeroDests = flightAirportsAsDestinations(airports);
    const aeroIds = new Set(aeroDests.map((d) => d.id));
    const rest = places.filter(
        (p) => !aeroIds.has(p.id) && !isCityPinCoveredByAirport(p, airports)
    );
    return [...aeroDests, ...rest];
}

function pushRouteSegment(
    segments: RoteirosRouteSegment[],
    from: TripDestination,
    to: TripDestination,
    kind: RoteirosHopKind,
    mode: RoteirosRouteMode,
    id: string,
    extras?: { scheduleLabel?: string; tip?: string; groundKind?: string | null }
): void {
    const dist = haversineKm(from, to);
    if (!Number.isFinite(dist) || dist < 0.05) return;
    let coordinates: [number, number][];
    if (kind === 'ground' || kind === 'walk') {
        coordinates = groundPathCoordinates(
            { lng: from.longitude, lat: from.latitude },
            { lng: to.longitude, lat: to.latitude },
            kind,
            dist
        );
    } else {
        const steps = dist >= 2500 ? 72 : dist >= 800 ? 56 : 36;
        coordinates = greatCircleArc(
            { lng: from.longitude, lat: from.latitude },
            { lng: to.longitude, lat: to.latitude },
            steps
        ) as [number, number][];
        if (mode === 'flight_back') {
            const offset = Math.min(4.5, Math.max(1.2, dist / 1800));
            coordinates = offsetArcCoordinates(coordinates, offset);
        }
    }
    const midPt = coordinates[Math.floor(coordinates.length / 2)] ?? [
        (from.longitude + to.longitude) / 2,
        (from.latitude + to.latitude) / 2
    ];
    const durationMin = estimateHopDurationMin(kind, dist, extras?.groundKind ?? null);
    const durationLabel = formatHopDurationLabel(durationMin);
    const scheduleLabel = (extras?.scheduleLabel ?? '').trim();
    const tip =
        extras?.tip ||
        `${from.name} → ${to.name}${scheduleLabel ? ` · ${scheduleLabel}` : ''} · ${durationLabel}`;
    segments.push({
        id,
        mode,
        fromLabel: from.name,
        toLabel: to.name,
        coordinates,
        mid: { longitude: midPt[0]!, latitude: midPt[1]! },
        durationMin,
        durationLabel: scheduleLabel || durationLabel,
        scheduleLabel: scheduleLabel || undefined,
        groundKind: extras?.groundKind ?? null,
        tip
    });
}

/** Trechos terrestres / a pé das atividades (ex.: PEK → Muralha). */
function appendLocalTransportLegs(
    segments: RoteirosRouteSegment[],
    destinations: TripDestination[],
    payload: TripPayload | undefined,
    hopArrivals: TripDestination[]
): void {
    const itinerary = payload?.itinerary ?? [];
    if (!itinerary.length) return;
    const byId = new Map(destinations.map((d) => [d.id, d]));

    const sameSpot = (a: TripDestination, b: TripDestination) =>
        a.id === b.id ||
        (Math.abs(a.latitude - b.latitude) < 0.002 && Math.abs(a.longitude - b.longitude) < 0.002);

    const arrivalForCountry = (country: string): TripDestination | null => {
        const key = foldedCountry({ country, name: country } as TripDestination);
        if (!key) return null;
        for (let i = hopArrivals.length - 1; i >= 0; i--) {
            const hit = hopArrivals[i]!;
            if (foldedCountry(hit) === key) return hit;
        }
        return null;
    };

    let prevLocal: TripDestination | null = null;
    let prevDayId = '';

    for (const day of sortedItineraryDays(itinerary)) {
        if (day.id !== prevDayId) {
            prevLocal = null;
            prevDayId = day.id;
        }
        const items = [...(day.items ?? [])].sort((a, b) =>
            (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
        );
        for (const item of items) {
            if (String(item.id ?? '').startsWith('rote-flight-')) {
                const linked = item.destinationId ? byId.get(item.destinationId) : null;
                if (linked && Number.isFinite(linked.latitude) && Number.isFinite(linked.longitude)) {
                    prevLocal = linked;
                }
                continue;
            }
            const to = item.destinationId ? byId.get(item.destinationId) : null;
            if (!to || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) continue;

            const mode = normalizeTravelMode(item.travelMode);
            if (mode !== 'ground' && mode !== 'walk') {
                prevLocal = to;
                continue;
            }

            let from = prevLocal;
            if (!from) from = arrivalForCountry(String(to.country ?? ''));
            if (!from) {
                const dayDest = day.destinationId ? byId.get(day.destinationId) : null;
                if (
                    dayDest &&
                    Number.isFinite(dayDest.latitude) &&
                    Number.isFinite(dayDest.longitude) &&
                    !sameSpot(dayDest, to)
                ) {
                    from = dayDest;
                }
            }
            if (!from || sameSpot(from, to)) {
                prevLocal = to;
                continue;
            }

            const dist = haversineKm(from, to);
            const sameCountry = Boolean(
                foldedCountry(from) && foldedCountry(to) && foldedCountry(from) === foldedCountry(to)
            );
            const groundKind = groundKindForItem(item, payload);
            // Long-haul cross-country sem trem/ônibus continua fora (voo cobre).
            // Trem-bala no mesmo país (PEK→Xangai) desenha tracejado + tempo.
            if (!shouldDrawManualGroundLeg(dist, { sameCountry, groundKind })) {
                prevLocal = to;
                continue;
            }

            pushRouteSegment(segments, from, to, mode, mode, `rote-local-${item.id}`, {
                tip: `${from.name} → ${to.name}`,
                groundKind
            });
            prevLocal = to;
        }
    }
}

export function buildRoteirosMapRoutes(
    destinations: TripDestination[],
    payload?: TripPayload
): {
    segments: RoteirosRouteSegment[];
    airports: RoteirosFlightAirport[];
    featureCollection: GeoJSON.FeatureCollection;
} {
    const normalized = (destinations ?? []).map(normalizeMapDestinationPlace);
    const hops = flightHopsForMap(payload, normalized);
    const segments: RoteirosRouteSegment[] = [];
    const airportMap = new Map<string, RoteirosFlightAirport>();
    const hopArrivals: TripDestination[] = [];

    if (hops.length) {
        // Voos = hops do cenário (sem inventar volta China→Recife).
        hops.forEach((hop, i) => {
            const originRaw = hopOrigin(hop);
            const destRaw = hopDestination(hop);
            const from = destinationFromFlightPlace(originRaw, normalized, `rote-hop-from-${i}`);
            const to = destinationFromFlightPlace(destRaw, normalized, `rote-hop-to-${i}`);
            if (!from || !to) return;
            rememberFlightAirport(airportMap, originRaw, from, normalized);
            rememberFlightAirport(airportMap, destRaw, to, normalized);
            hopArrivals.push(to);
            const mode = flightMapMode(from, to);
            const schedule = hopScheduleLabel(hop);
            pushRouteSegment(segments, from, to, 'flight', mode, `rote-flight-${hop.id || i}`, {
                scheduleLabel: schedule,
                tip: `${from.name} → ${to.name}${schedule ? ` · ${schedule}` : ''}`
            });
        });
        // Atividades com Terrestre / A pé (ex.: aeroporto → Muralha).
        appendLocalTransportLegs(segments, normalized, payload, hopArrivals);
    } else {
        // Fallback sem hops: ordem do roteiro, sem fechar em Recife.
        const catalogStops = routeStops(normalized);
        const itinerary = payload?.itinerary ?? [];
        const core =
            itinerary.length > 0
                ? orderedTimelineDestinations(itinerary, normalized, catalogStops)
                : catalogStops.filter((d) => d.kind !== 'country');
        const homePin: TripDestination = {
            id: 'rote-home',
            name: VIAGENS_HOME.name,
            latitude: VIAGENS_HOME.latitude,
            longitude: VIAGENS_HOME.longitude,
            kind: 'airport'
        };
        const chain: TripDestination[] = [homePin, ...core];
        const farthestIdx = farthestStopIndex(chain, homePin);
        for (let i = 0; i < chain.length - 1; i++) {
            const from = chain[i]!;
            const to = chain[i + 1]!;
            const kind = travelModeForLeg(to, itinerary, from, payload);
            const mode = toMapMode(kind, i, farthestIdx);
            if (kind === 'flight') {
                rememberFlightAirport(airportMap, from.name, from, normalized);
                rememberFlightAirport(airportMap, to.name, to, normalized);
                hopArrivals.push(to);
            }
            pushRouteSegment(segments, from, to, kind, mode, `rote-hop-${i}`);
        }
        appendLocalTransportLegs(segments, normalized, payload, hopArrivals);
    }

    return {
        segments,
        airports: [...airportMap.values()],
        featureCollection: featureCollectionFromSegments(segments)
    };
}

/** GeoJSON das rotas a partir dos segmentos (ex.: após enriquecer com OSRM). */
export function featureCollectionFromSegments(
    segments: RoteirosRouteSegment[]
): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = segments.map((s) => ({
        type: 'Feature',
        properties: {
            mode: s.mode,
            id: s.id,
            durationMin: s.durationMin,
            durationLabel: s.durationLabel
        },
        geometry: { type: 'LineString', coordinates: s.coordinates }
    }));
    return { type: 'FeatureCollection', features };
}

export const ROTEIROS_ROUTE_PAINT: Record<
    RoteirosRouteMode,
    { color: string; width: number; dash?: number[]; opacity?: number }
> = {
    /** Voo: linha contínua. */
    flight_out: { color: '#2ec4b6', width: 2.5, opacity: 0.94 },
    flight_back: { color: '#c45c8a', width: 2.5, opacity: 0.9 },
    /** Terrestre: pontilhado que era dos voos. */
    ground: { color: '#e07830', width: 3, dash: [0.75, 1.55], opacity: 0.96 },
    walk: { color: '#9a7b0a', width: 2.4, dash: [1.1, 0.85, 0.35, 0.85], opacity: 0.92 }
};

export const ROTEIROS_ROUTE_ICONS: Record<RoteirosRouteMode, string> = {
    flight_out: 'flight_takeoff',
    flight_back: 'flight_land',
    ground: 'directions_car',
    walk: 'directions_walk'
};
