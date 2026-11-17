import { routeStops } from '../../../../motor/viagens/trip-places.js';
import { VIAGENS_HOME } from '../../../../motor/viagens/viagens-atlas.js';
import { displayCoordinate } from './map-utils.js';

export function hopLineFeatures(trips, visits) {
    const features = [];
    for (const trip of trips) {
        const stops = routeStops(trip.payload?.destinations ?? []);
        if (!stops.length) continue;
        const coords = [[VIAGENS_HOME.longitude, VIAGENS_HOME.latitude]];
        for (const dest of stops) {
            const visit = visits.find((v) => v.tripId === trip.id && v.destination.id === dest.id);
            if (visit) {
                const c = displayCoordinate(visit, visits);
                coords.push([c.lng, c.lat]);
            } else {
                coords.push([dest.longitude, dest.latitude]);
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
    return { type: 'FeatureCollection', features };
}