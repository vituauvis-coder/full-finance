import { inclusiveDayCount, parseDayKey } from '@motor/viagens/calendar-format.js';
import type { TripDestination, TripPayload } from '../types';
import { formatTripDayShort } from '../utils/tripCalendar';

export type TripResumoDayStats = {
    days: number;
    durationDays: number;
    tourismDays: number;
    vacationDays: number;
    remoteDays: number;
    layoverCount: number;
};

export type DestinationTag = {
    region: string;
    label: string;
};

const ASIA = /china|japão|japan|tailândia|thailand|índia|india|coreia|korea|vietnam|vietnã/i;
const EUROPE = /portugal|holanda|netherlands|países baixos|espanha|spain|frança|france|itália|italy|alemanha|germany|reino unido|uk|inglaterra/i;
const AMERICAS = /brasil|brazil|estados unidos|united states|usa|méxico|mexico|canadá|canada|argentina|chile/i;

function regionForCountry(country?: string | null): string {
    const c = (country ?? '').trim();
    if (!c) return 'Destino';
    if (ASIA.test(c)) return 'Ásia';
    if (EUROPE.test(c)) return 'Europa';
    if (AMERICAS.test(c)) return 'Américas';
    if (/áfrica|africa|egito|egypt|marrocos|morocco/i.test(c)) return 'África';
    if (/oceania|austrália|australia|nova zelândia|new zealand/i.test(c)) return 'Oceania';
    return c;
}

export function tripResumoDayStats(startsOn: string, endsOn: string, payload: TripPayload): TripResumoDayStats {
    const start = parseDayKey(startsOn?.trim());
    const end = parseDayKey(endsOn?.trim());
    const days = start && end ? inclusiveDayCount(start, end) : 0;

    const payloadRecord = payload as Record<string, unknown>;
    const summary = (payloadRecord.trip_summary ?? payloadRecord.tripSummary) as Record<string, number> | undefined;

    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const layovers = segments.reduce((n, seg) => n + (seg.simulations?.length ?? 0), 0);

    return {
        days,
        durationDays: days,
        tourismDays: Number(summary?.tourismDays ?? summary?.tourism_days ?? 0) || 0,
        vacationDays: Number(summary?.vacationDays ?? summary?.vacation_days ?? 0) || 0,
        remoteDays: Number(summary?.remoteDays ?? summary?.remote_days ?? 0) || 0,
        layoverCount: Number(summary?.layoverCount ?? summary?.layover_count ?? layovers) || 0
    };
}

export function formatTripResumoDates(startsOn: string, endsOn: string): string {
    const a = startsOn?.trim();
    const b = endsOn?.trim();
    if (a && b) return `${formatTripDayShort(a)} → ${formatTripDayShort(b)}`;
    if (a) return formatTripDayShort(a);
    if (b) return formatTripDayShort(b);
    return 'Sem datas';
}

export function destinationTags(destinations: TripDestination[]): DestinationTag[] {
    const seen = new Set<string>();
    const out: DestinationTag[] = [];
    for (const d of destinations) {
        const country = d.country?.trim() || '';
        const name = d.name?.trim() || 'Destino';
        const label = country || name;
        const region = country ? regionForCountry(country) : '';
        const key = `${region}::${label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ region, label });
    }
    return out;
}