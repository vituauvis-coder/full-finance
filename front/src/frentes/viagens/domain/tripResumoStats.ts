import { inclusiveDayCount, parseDayKey } from '@motor/viagens/calendar-format.js';
import {
    chosenScenarioFromPayload,
    chosenScenarioSnapshot,
    chosenScenarioTripBounds,
    tripSummaryFromSnapshot
} from './chosenScenarioResumo';
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

function summaryFromPayload(payload: TripPayload, startsOn: string) {
    const payloadRecord = payload as Record<string, unknown>;
    const stored = (payloadRecord.trip_summary ?? payloadRecord.tripSummary) as Record<string, number> | undefined;
    const chosen = chosenScenarioFromPayload(payload);
    if (!chosen) return stored;

    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const destinations = payload.destinations ?? [];
    const live = tripSummaryFromSnapshot(
        chosenScenarioSnapshot(chosen, segments, destinations, startsOn?.trim() || undefined)
    );
    // Cenário escolhido: KPIs ao vivo do motor prevalecem sobre trip_summary antigo.
    return { ...(stored ?? {}), ...live };
}

export function effectiveTripPeriod(
    startsOn: string,
    endsOn: string,
    payload: TripPayload,
    destinations: TripDestination[]
): { startsOn: string; endsOn: string } {
    const bounds = chosenScenarioTripBounds(payload, destinations, startsOn);
    if (bounds.startsOn) {
        return {
            startsOn: bounds.startsOn,
            endsOn: bounds.endsOn ?? bounds.startsOn
        };
    }
    return { startsOn: startsOn.trim(), endsOn: endsOn.trim() };
}

/** Se há cenário escolhido e as datas da ficha divergem, devolve o draft realinhado; senão null. */
export function alignDraftDatesToChosenScenario<T extends { startsOn: string; endsOn: string; payload: TripPayload }>(
    draft: T
): T | null {
    const destinations = draft.payload.destinations ?? [];
    const period = effectiveTripPeriod(draft.startsOn, draft.endsOn, draft.payload, destinations);
    if (!period.startsOn) return null;
    if (!chosenScenarioFromPayload(draft.payload)) return null;
    const start = draft.startsOn.trim();
    const end = draft.endsOn.trim();
    if (start === period.startsOn && end === period.endsOn) return null;
    return { ...draft, startsOn: period.startsOn, endsOn: period.endsOn };
}

export function tripResumoDayStats(
    startsOn: string,
    endsOn: string,
    payload: TripPayload,
    destinations: TripDestination[]
): TripResumoDayStats {
    const period = effectiveTripPeriod(startsOn, endsOn, payload, destinations);
    const start = parseDayKey(period.startsOn);
    const end = parseDayKey(period.endsOn);
    const dateDays = start && end ? inclusiveDayCount(start, end) : 0;

    const summary = summaryFromPayload(payload, startsOn);
    const calendarDays = Number(summary?.calendarDays ?? summary?.calendar_days ?? 0) || dateDays;
    const days = calendarDays > 0 ? calendarDays : dateDays;

    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const layoversFallback = segments.reduce((n, seg) => n + (seg.simulations?.length ?? 0), 0);

    return {
        days,
        durationDays: days,
        tourismDays: Number(summary?.tourismDays ?? summary?.tourism_days ?? 0) || 0,
        vacationDays: Number(summary?.vacationDays ?? summary?.vacation_days ?? 0) || 0,
        remoteDays: Number(summary?.remoteDays ?? summary?.remote_days ?? 0) || 0,
        layoverCount: Number(summary?.layoverCount ?? summary?.layover_count ?? layoversFallback) || 0
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

export function tripResumoDatesLine(
    startsOn: string,
    endsOn: string,
    payload: TripPayload,
    destinations: TripDestination[]
): string {
    const period = effectiveTripPeriod(startsOn, endsOn, payload, destinations);
    return formatTripResumoDates(period.startsOn, period.endsOn);
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