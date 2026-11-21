import { routeMarkerPoints } from '@motor/viagens/flight-route-geo.js';
import type { MapVisit, Trip, TripStatus } from '../types';
import { displayCoordinate } from './map-utils';

export type AtlasRenderPin = {
    id: string;
    lat: number;
    lng: number;
    label: string;
    tripId: string;
    status: TripStatus | string;
    isPrincipal?: boolean;
    visit: MapVisit | null;
};

function coordKey(lng: number, lat: number) {
    return `${Math.round(lng * 100)}:${Math.round(lat * 100)}`;
}

/** Pins únicos para o atlas: visitas + paradas de rota/voo. */
export function atlasRenderPins(
    trips: Trip[],
    visits: MapVisit[],
    clusters: Array<{ visits: MapVisit[]; latitude: number; longitude: number } | null>
): AtlasRenderPin[] {
    const items: AtlasRenderPin[] = [];
    const seen = new Set<string>();

    clusters.forEach((c) => {
        if (!c || c.visits.length !== 1) return;
        const visit = c.visits[0];
        const coord = displayCoordinate(visit, visits);
        const key = coordKey(coord.lng, coord.lat);
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
            id: visit.id,
            lat: coord.lat,
            lng: coord.lng,
            label: visit.destination.name,
            tripId: visit.tripId,
            status: visit.status,
            isPrincipal: visit.destination.isPrincipal,
            visit
        });
    });

    for (const pin of routeMarkerPoints(trips, visits)) {
        const key = coordKey(pin.lng, pin.lat);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
            id: pin.id,
            lat: pin.lat,
            lng: pin.lng,
            label: pin.label,
            tripId: pin.tripId,
            status: pin.status,
            isPrincipal: pin.isPrincipal,
            visit: pin.visit ?? null
        });
    }

    return items;
}