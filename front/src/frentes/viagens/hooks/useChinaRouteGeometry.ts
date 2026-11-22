import { useEffect, useState } from 'react';
import { fetchRoadRoute } from '../api/trips';
import type { ChinaRouteLegDraw, ChinaRouteLegMeta } from '../domain/chinaCityRoute';
import type { TripDestination } from '../types';

function fallbackLine(
    from: TripDestination,
    to: TripDestination
): [number, number][] {
    return [
        [from.longitude, from.latitude],
        [to.longitude, to.latitude]
    ];
}

export function useChinaRouteGeometry(
    legMeta: ChinaRouteLegMeta[],
    destinations: TripDestination[]
): ChinaRouteLegDraw[] {
    const [legs, setLegs] = useState<ChinaRouteLegDraw[]>([]);

    useEffect(() => {
        if (!legMeta.length) {
            setLegs([]);
            return;
        }
        const byId = new Map(destinations.map((d) => [d.id, d]));
        let cancelled = false;

        (async () => {
            const out: ChinaRouteLegDraw[] = [];
            for (const meta of legMeta) {
                const from = byId.get(meta.fromId);
                const to = byId.get(meta.toId);
                if (!from || !to) continue;
                let coordinates = fallbackLine(from, to);
                try {
                    const road = await fetchRoadRoute({
                        fromLng: from.longitude,
                        fromLat: from.latitude,
                        toLng: to.longitude,
                        toLat: to.latitude,
                        profile: 'driving'
                    });
                    if (Array.isArray(road.coordinates) && road.coordinates.length >= 2) {
                        coordinates = road.coordinates as [number, number][];
                    }
                } catch {
                    /* mantém fallback */
                }
                const midPt = coordinates[Math.floor(coordinates.length / 2)] ?? [
                    (from.longitude + to.longitude) / 2,
                    (from.latitude + to.latitude) / 2
                ];
                out.push({
                    ...meta,
                    coordinates,
                    mid: { longitude: midPt[0]!, latitude: midPt[1]! }
                });
            }
            if (!cancelled) setLegs(out);
        })();

        return () => {
            cancelled = true;
        };
    }, [legMeta, destinations]);

    return legs;
}