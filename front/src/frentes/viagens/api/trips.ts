import { apiFetch } from '../../../lib/http';
import type { GeocodeHit, Trip, TripDetailResponse, TripsListResponse } from '../types';

export function fetchTripsList(): Promise<TripsListResponse> {
    return apiFetch('/api/trips');
}

export function fetchTrip(id: string): Promise<TripDetailResponse> {
    return apiFetch(`/api/trips/${id}`);
}

export function createTrip(title?: string): Promise<{ trip: Trip }> {
    return apiFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({ title: title ?? 'Nova viagem' })
    });
}

export function saveTrip(
    id: string,
    body: {
        title: string;
        startsOn: string | null;
        endsOn: string | null;
        statusOverride: string | null;
        budgetCaps: Record<string, number>;
        payload: Trip['payload'];
    }
): Promise<{
    trip: Trip;
    financeSyncWarnings?: { tripExpenseId?: string; message: string }[];
}> {
    return apiFetch(`/api/trips/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

export function deleteTrip(id: string): Promise<{ ok: boolean }> {
    return apiFetch(`/api/trips/${id}`, { method: 'DELETE' });
}

export type TaxFxQuotes = {
    rates: Record<string, number>;
    asOf: string | null;
    source: string;
    stale?: boolean;
};

export function fetchTaxFxQuotes(): Promise<TaxFxQuotes> {
    return apiFetch('/api/trips/fx-quotes');
}

export type GeocodeSearchOptions = {
    countryCodes?: string;
    lat?: number;
    lon?: number;
};

export function geocodeSearch(q: string, opts?: GeocodeSearchOptions): Promise<{ hits: GeocodeHit[] }> {
    const params = new URLSearchParams();
    params.set('q', q);
    if (opts?.countryCodes) params.set('countrycodes', opts.countryCodes);
    if (opts?.lat != null && Number.isFinite(opts.lat)) params.set('lat', String(opts.lat));
    if (opts?.lon != null && Number.isFinite(opts.lon)) params.set('lon', String(opts.lon));
    return apiFetch(`/api/trips/geocode/search?${params.toString()}`);
}

export function geocodeReverse(lat: number, lon: number): Promise<{ hits: GeocodeHit[] }> {
    const params = new URLSearchParams();
    params.set('lat', String(lat));
    params.set('lon', String(lon));
    return apiFetch(`/api/trips/geocode/reverse?${params.toString()}`);
}

export type AirportHit = {
    iata?: string;
    name: string;
    city: string;
    country?: string;
    label: string;
    kind?: string;
};

export function searchAirports(q: string): Promise<{ hits: AirportHit[] }> {
    return apiFetch(`/api/trips/airports/search?q=${encodeURIComponent(q)}`);
}

export type LodgingSearchHit = {
    name: string;
    address?: string;
    city?: string;
    country?: string;
    latitude: number;
    longitude: number;
    osmId?: string;
    osmType?: string;
    stars?: number | null;
    source?: string;
    kind?: string;
};

export function lodgingSearch(params: {
    q?: string;
    lat?: number;
    lon?: number;
    radiusKm?: number;
}): Promise<{ hits: LodgingSearchHit[] }> {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.lat != null) sp.set('lat', String(params.lat));
    if (params.lon != null) sp.set('lon', String(params.lon));
    if (params.radiusKm != null) sp.set('radiusKm', String(params.radiusKm));
    return apiFetch(`/api/trips/places/lodging-search?${sp}`);
}

export type RoadRouteResponse = {
    coordinates: [number, number][];
    durationSec: number | null;
    distanceM: number | null;
};

/** Rota real OSRM (driving/foot) para trechos terrestres no mapa. */
export function fetchRoadRoute(params: {
    fromLng: number;
    fromLat: number;
    toLng: number;
    toLat: number;
    profile?: 'driving' | 'foot';
}): Promise<RoadRouteResponse> {
    const sp = new URLSearchParams();
    sp.set('fromLng', String(params.fromLng));
    sp.set('fromLat', String(params.fromLat));
    sp.set('toLng', String(params.toLng));
    sp.set('toLat', String(params.toLat));
    sp.set('profile', params.profile === 'foot' ? 'foot' : 'driving');
    return apiFetch(`/api/trips/road-route?${sp}`);
}

export function snapshotScenario(body: {
    scenario?: unknown;
    scenarios?: unknown[];
    criteria?: unknown[];
}): Promise<unknown> {
    return apiFetch('/api/trips/scenario/snapshot', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}