import { useMemo } from 'react';
import { cluster as clusterVisits } from '@motor/viagens/trips-engine.js';
import { resolveTripCountries } from '@motor/viagens/trip-countries.js';
import type { MapVisit, Trip } from '../types';
import { atlasRenderPins } from '../utils/map-markers';
import { atlasMapLayers } from '../utils/map-routes';

export function useAtlasMapModel(trips: Trip[], visits: MapVisit[], spanLat: number) {
    const routeLegs = useMemo(() => atlasMapLayers(trips), [trips]);

    const hasRoteiroLayers = useMemo(
        () =>
            routeLegs.ground.features.length > 0 ||
            routeLegs.walk.features.length > 0 ||
            routeLegs.itineraryFlight.features.length > 0,
        [routeLegs]
    );

    const clusters = useMemo(() => clusterVisits(visits, spanLat), [visits, spanLat]);

    const renderPins = useMemo(() => atlasRenderPins(trips, visits, clusters), [trips, visits, clusters]);

    const tripsById = useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);

    const highlightCountryLabels = useMemo(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const trip of trips) {
            for (const c of resolveTripCountries(trip.payload, trip.payload?.destinations ?? [])) {
                const k = c.toLowerCase();
                if (seen.has(k)) continue;
                seen.add(k);
                out.push(c);
            }
        }
        return out;
    }, [trips]);

    return {
        routeLegs,
        hasRoteiroLayers,
        clusters,
        renderPins,
        tripsById,
        highlightCountryLabels
    };
}

/** Camadas do atlas para uma viagem (mini-mapa / ficha, modo resumo). */
export function useAtlasMapModelForTrip(trip: Trip | null | undefined) {
    return useMemo(() => {
        if (!trip?.id) return null;
        return atlasMapLayers([trip]);
    }, [trip]);
}