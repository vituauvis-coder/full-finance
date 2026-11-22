import { isRailGroundKind } from '@motor/viagens/ground-route-policy.js';
import { fetchRoadRoute } from '../api/trips';
import {
    formatHopDurationLabel,
    type RoteirosRouteSegment
} from '../components/roteiros/roteiros-map-routes';

/** Aplica geometria OSRM ao trecho; trem HSR mantém tempo estimado, só atualiza o traçado. */
export async function enrichGroundSegmentWithRoadRoute(
    seg: RoteirosRouteSegment
): Promise<RoteirosRouteSegment> {
    if (seg.mode !== 'ground' && seg.mode !== 'walk') return seg;
    const start = seg.coordinates[0];
    const end = seg.coordinates[seg.coordinates.length - 1];
    if (!start || !end) return seg;
    try {
        const road = await fetchRoadRoute({
            fromLng: start[0],
            fromLat: start[1],
            toLng: end[0],
            toLat: end[1],
            profile: seg.mode === 'walk' ? 'foot' : 'driving'
        });
        if (!Array.isArray(road.coordinates) || road.coordinates.length < 2) {
            return seg;
        }
        const coords = road.coordinates as [number, number][];
        const midPt = coords[Math.floor(coords.length / 2)] ?? end;
        const rail = isRailGroundKind(seg.groundKind);
        const durationMin =
            rail || road.durationSec == null || !Number.isFinite(road.durationSec)
                ? seg.durationMin
                : Math.max(1, Math.round(road.durationSec / 60));
        const durationLabel = formatHopDurationLabel(durationMin);
        return {
            ...seg,
            coordinates: coords,
            pathKind: 'road' as const,
            mid: { longitude: midPt[0]!, latitude: midPt[1]! },
            durationMin,
            durationLabel: seg.scheduleLabel || durationLabel,
            tip: `${seg.fromLabel} → ${seg.toLabel}${
                seg.scheduleLabel ? ` · ${seg.scheduleLabel}` : ''
            } · ${durationLabel}`
        };
    } catch {
        return seg;
    }
}