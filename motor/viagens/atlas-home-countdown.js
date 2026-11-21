import { parseDayKey, startOfDayInLifeOS, inclusiveDayCount } from './calendar-format.js';
import { effectiveStatus } from './trips-engine.js';

const MS_DAY = 86400000;

/**
 * Dias de calendário entre hoje (LifeOS) e uma data YYYY-MM-DD (positivo = futuro).
 * @param {string|null|undefined} dayKey
 */
export function daysUntilDayKey(dayKey, now = new Date()) {
    const target = parseDayKey(dayKey);
    if (!target) return null;
    const today = startOfDayInLifeOS(now);
    return Math.round((target.getTime() - today.getTime()) / MS_DAY);
}

function tripDestLabel(trip) {
    const dests = trip.payload?.destinations ?? [];
    const principal =
        dests.find((d) => d?.isPrincipal && d?.kind !== 'home') ??
        dests.find((d) => d?.kind && d.kind !== 'home') ??
        dests.find((d) => d?.kind !== 'home');
    const name = principal?.name ?? trip.title ?? trip.name ?? trip.label;
    return String(name ?? 'Viagem').trim() || 'Viagem';
}

/**
 * Viagens futuras ou em curso para o contador da home (ordenadas por proximidade).
 * @param {Array<{ id?: string; title?: string; name?: string; startsOn?: string|null; starts_on?: string|null; endsOn?: string|null; ends_on?: string|null; statusOverride?: string|null; status_override?: string|null; payload?: { destinations?: unknown[] } }>} trips
 */
export function atlasHomeCountdownItems(trips, now = new Date()) {
    const list = Array.isArray(trips) ? trips : [];
    /** @type {Array<{ tripId: string; title: string; destination: string; mode: 'until_start'|'until_end'|'no_dates'; daysRemaining: number|null; startsOn: string|null; endsOn: string|null; status: string; durationDays: number|null; progress: number }>} */
    const items = [];

    for (const trip of list) {
        const tripId = String(trip.id ?? '').trim();
        if (!tripId) continue;

        const startsOn = trip.startsOn ?? trip.starts_on ?? null;
        const endsOn = trip.endsOn ?? trip.ends_on ?? null;
        const statusOverride = trip.statusOverride ?? trip.status_override ?? null;
        const status = effectiveStatus({ startsOn, endsOn, statusOverride, now });

        if (status === 'realizada') continue;

        const title = String(trip.title ?? trip.name ?? 'Viagem').trim() || 'Viagem';
        const destination = tripDestLabel(trip);

        let mode = 'no_dates';
        let daysRemaining = null;
        let progress = 0;

        const start = parseDayKey(String(startsOn ?? '').trim());
        const end = parseDayKey(String(endsOn ?? '').trim());
        const durationDays = start && end ? inclusiveDayCount(start, end) : null;

        if (status === 'em_curso') {
            if (end) {
                mode = 'until_end';
                daysRemaining = daysUntilDayKey(endsOn, now);
                if (daysRemaining != null && daysRemaining < 0) daysRemaining = 0;
                if (start && end && daysRemaining != null && durationDays) {
                    const elapsed = durationDays - daysRemaining - 1;
                    progress = Math.min(1, Math.max(0, elapsed / durationDays));
                } else if (daysRemaining != null) {
                    progress = Math.min(1, Math.max(0, 1 - daysRemaining / 30));
                }
            } else {
                mode = 'until_end';
                daysRemaining = null;
                progress = 0.35;
            }
        } else if (start) {
            mode = 'until_start';
            daysRemaining = daysUntilDayKey(startsOn, now);
            if (daysRemaining != null && daysRemaining < 0) continue;
            const horizon = Math.max(14, Math.min(120, (daysRemaining ?? 0) + 7));
            progress =
                daysRemaining != null ? Math.min(1, Math.max(0, 1 - daysRemaining / horizon)) : 0;
        } else {
            mode = 'no_dates';
            daysRemaining = null;
            progress = 0;
        }

        items.push({
            tripId,
            title,
            destination,
            mode,
            daysRemaining,
            startsOn: startsOn ? String(startsOn).slice(0, 10) : null,
            endsOn: endsOn ? String(endsOn).slice(0, 10) : null,
            status,
            durationDays,
            progress
        });
    }

    const weight = (item) => {
        if (item.status === 'em_curso') return item.daysRemaining ?? 0;
        if (item.mode === 'until_start' && item.daysRemaining != null) return item.daysRemaining;
        return 99999;
    };

    items.sort((a, b) => weight(a) - weight(b));
    return items;
}