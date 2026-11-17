import { routeStops } from '@motor/viagens/trip-places.js';
import { VIAGENS_HOME } from '@motor/viagens/viagens-atlas.js';
import type { MapVisit, Trip } from '../types';
import { displayCoordinate } from '../utils/map-utils';

export function hopLineFeatures(trips: Trip[], visits: MapVisit[]) {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (const trip of trips) {
        const stops = routeStops(trip.payload?.destinations ?? []);
        if (!stops.length) continue;
        const coords: [number, number][] = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const dest of stops) {
            const visit = visits.find((v) => v.tripId === trip.id && v.destination.id === dest.id);
            if (visit) {
                const c = displayCoordinate(visit, visits);
                coords.push([c.lng, c.lat]);
            } else {
                coords.push([dest.longitude, dest.longitude]);
            }
        }
        coords.push([VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]);
        for (let i = 0; i < coords.length - 1; i++) {
            features.push({
                type: 'Feature',
                properties: { tripId: trip.id },
                geometry: { type: 'LineString', coordinates: [coords[i], coords[i + 1]] }
            });
        }
    }
    return { type: 'FeatureCollection' as const, features };
}