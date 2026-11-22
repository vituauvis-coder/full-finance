import { buildAtlasMapModel } from '@motor/viagens/atlas-map-model.js';
import {
    destinationHopFeatures,
    flightRouteLegFeatures,
    tripHasFlightRoute
} from '@motor/viagens/flight-route-geo.js';
import type { MapVisit, Trip } from '../types';

export type RouteLegCollection = GeoJSON.FeatureCollection;

export type AtlasMapLayerBundle = ReturnType<typeof atlasMapLayers>;

/** Camadas do atlas (voos + roteiro terrestre/caminhada). */
export function atlasMapLayers(trips: Trip[]) {
    const model = buildAtlasMapModel(trips);
    return {
        ida: model.layers.flightOut as RouteLegCollection,
        volta: model.layers.flightBack as RouteLegCollection,
        ground: model.layers.ground as RouteLegCollection,
        walk: model.layers.walk as RouteLegCollection,
        itineraryFlight: model.layers.itineraryFlight as RouteLegCollection,
        meta: model.meta
    };
}

export function flightRoutesForMap(trips: Trip[], visits: MapVisit[] = []) {
    const { ida, volta } = flightRouteLegFeatures(trips);
    const fallbackIda: GeoJSON.Feature[] = [];
    for (const trip of trips) {
        if (tripHasFlightRoute(trip)) continue;
        fallbackIda.push(...destinationHopFeatures(trip, visits));
    }
    return {
        ida: {
            type: 'FeatureCollection' as const,
            features: [...ida.features, ...fallbackIda]
        },
        volta
    };
}

/** @deprecated use flightRoutesForMap — mantém compat com mini-mapas. */
export function hopLineFeatures(trips: Trip[], visits: MapVisit[]) {
    const { ida, volta } = flightRouteLegFeatures(trips);
    const features: GeoJSON.Feature[] = [...ida.features, ...volta.features];
    for (const trip of trips) {
        if (tripHasFlightRoute(trip)) continue;
        features.push(...destinationHopFeatures(trip, visits));
    }
    return { type: 'FeatureCollection' as const, features };
}