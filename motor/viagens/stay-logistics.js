import { extractIata, resolveFlightPlace } from './flight-route-geo.js';
import { haversineKm } from './geo-distance.js';
import { tripFlightSegments } from './flight-simulation.js';

function str(v) {
    return v == null ? '' : String(v).trim();
}

function chosenSimulations(payload) {
    return tripFlightSegments(payload)
        .map((seg) => {
            const sims = (seg.simulations ?? []).filter((s) => s.status !== 'descartada');
            return sims.find((s) => s.status === 'escolhida') ?? null;
        })
        .filter(Boolean);
}

/** Aeroportos de chegada (ida) dos voos escolhidos, com coords. */
export function chosenArrivalAirports(trip) {
    const payload = trip?.payload ?? trip;
    const destinations = payload?.destinations ?? [];
    const out = [];
    const seen = new Set();

    for (const sim of chosenSimulations(payload)) {
        const destLabel = str(sim.destination);
        const iata = extractIata(destLabel) || extractIata(sim.origin);
        const pt = resolveFlightPlace(destLabel, destinations);
        if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
        const key = `${Math.round(pt.lng * 100)}:${Math.round(pt.lat * 100)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            iata: iata || str(pt.label).slice(0, 3).toUpperCase(),
            label: pt.label || destLabel || 'Aeroporto',
            lat: pt.lat,
            lng: pt.lng,
            tripDestinationId: sim.tripDestinationId ?? sim.trip_destination_id ?? null
        });
    }
    return out;
}

/**
 * Aeroporto de referência para um destino da viagem (vinculado ao voo escolhido quando possível).
 */
export function arrivalAirportForDestination(trip, destinationId) {
    const airports = chosenArrivalAirports(trip);
    if (!destinationId) return airports[0] ?? null;
    const linked = airports.find((a) => a.tripDestinationId === destinationId);
    if (linked) return linked;

    const payload = trip?.payload ?? trip;
    const dest = (payload?.destinations ?? []).find((d) => d.id === destinationId);
    if (!dest) return airports[0] ?? null;

    let best = null;
    let bestKm = Infinity;
    for (const a of airports) {
        const km = haversineKm(dest.latitude, dest.longitude, a.lat, a.lng);
        if (km != null && km < bestKm) {
            bestKm = km;
            best = a;
        }
    }
    if (best && bestKm < 400) return best;
    return airports[0] ?? null;
}

export function stayCoords(stay) {
    const lat = stay?.latitude ?? stay?.lat;
    const lng = stay?.longitude ?? stay?.lng;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
}

/** Distância da hospedagem ao aeroporto vinculado ao destino / voos escolhidos. */
export function stayAirportInsight(trip, stay) {
    const coords = stayCoords(stay);
    if (!coords) {
        return { airport: null, distanceKm: null, hint: 'Sem coordenadas — busque o endereço no mapa.' };
    }
    const destId = stay.destinationId ?? stay.destination_id ?? null;
    const airport = arrivalAirportForDestination(trip, destId);
    if (!airport) {
        return { airport: null, distanceKm: null, hint: 'Nenhum voo escolhido para estimar o aeroporto.' };
    }
    const distanceKm = haversineKm(coords.lat, coords.lng, airport.lat, airport.lng);
    const kmRounded = distanceKm != null ? Math.round(distanceKm * 10) / 10 : null;
    const hint =
        kmRounded != null
            ? `~${kmRounded} km do aeroporto ${airport.label}${airport.iata ? ` (${airport.iata})` : ''}`
            : null;
    return {
        airport: { iata: airport.iata, label: airport.label, lat: airport.lat, lng: airport.lng },
        distanceKm: kmRounded,
        hint
    };
}