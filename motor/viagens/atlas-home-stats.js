import { inclusiveDayCount, parseDayKey } from './calendar-format.js';
import { effectiveStatus } from './trips-engine.js';

const STATUS_ORDER = ['planejada', 'em_curso', 'realizada'];

/**
 * KPIs da home Viagens (atlas): totais, duração média e distribuição por status.
 * @param {Array<{ startsOn?: string|null; endsOn?: string|null; statusOverride?: string|null; payload?: { destinations?: unknown[] } }>} trips
 */
export function atlasHomeTripStats(trips, now = new Date()) {
    const list = Array.isArray(trips) ? trips : [];
    /** @type {Record<'planejada'|'em_curso'|'realizada', number>} */
    const statusCounts = { planejada: 0, em_curso: 0, realizada: 0 };
    let durationSum = 0;
    let durationCount = 0;
    let destinationCount = 0;

    for (const trip of list) {
        const startsOn = trip.startsOn ?? trip.starts_on ?? null;
        const endsOn = trip.endsOn ?? trip.ends_on ?? null;
        const statusOverride = trip.statusOverride ?? trip.status_override ?? null;
        const st = effectiveStatus({ startsOn, endsOn, statusOverride, now });
        if (STATUS_ORDER.includes(st)) statusCounts[st] += 1;

        const start = parseDayKey(String(startsOn ?? '').trim());
        const end = parseDayKey(String(endsOn ?? '').trim());
        if (start && end) {
            const days = inclusiveDayCount(start, end);
            if (days > 0) {
                durationSum += days;
                durationCount += 1;
            }
        }

        const dests = trip.payload?.destinations ?? [];
        for (const d of dests) {
            const kind = d?.kind;
            if (kind === 'home') continue;
            destinationCount += 1;
        }
    }

    const averageDurationDays =
        durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : null;

    return {
        totalTrips: list.length,
        averageDurationDays,
        tripsWithDates: durationCount,
        destinationCount,
        statusCounts
    };
}

/** Frações para barra empilhada (0 total → frações zeradas). */
export function atlasHomeStatusSegments(statusCounts, totalTrips) {
    const total = Math.max(0, Number(totalTrips) || 0);
    return STATUS_ORDER.map((key) => {
        const count = statusCounts?.[key] ?? 0;
        return {
            key,
            count,
            fraction: total > 0 ? count / total : 0
        };
    });
}