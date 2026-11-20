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

export function geocodeSearch(q: string): Promise<{ hits: GeocodeHit[] }> {
    return apiFetch(`/api/trips/geocode/search?q=${encodeURIComponent(q)}`);
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