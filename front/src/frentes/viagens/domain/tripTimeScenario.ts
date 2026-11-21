import { dayKey, inclusiveDayCount, parseDayKey } from '@motor/viagens/calendar-format.js';
import { addDayKey } from '../utils/tripCalendar';
import { sortHopsChronologically as sortHopsChronologicallyMotor } from '@motor/viagens/hops-chronology.js';
import type { TripDestination, TripFlightSegment, TripFlightSimulation, TripTimeScenario } from '../types';

export type TripTimeHop = {
    id: string;
    kind?: string;
    originCity?: string;
    destinationCity?: string;
    origin_country?: string;
    originCountry?: string;
    destination_country?: string;
    destinationCountry?: string;
    departs_at?: string | null;
    departsAt?: string | null;
    arrives_at?: string | null;
    arrivesAt?: string | null;
    linked_flight_simulation_id?: string | null;
    linkedFlightSimulationId?: string | null;
    connections?: { place?: string }[];
};

export type TripVacationPeriod = {
    id: string;
    starts_on?: string;
    startsOn?: string;
    days: number;
};

export const DEFAULT_VACATION_PERIOD_DAYS = 18;

export function vacationPeriodDays(period: TripVacationPeriod | undefined | null): number {
    const raw = period?.days;
    if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
        return DEFAULT_VACATION_PERIOD_DAYS;
    }
    const n = Number(raw);
    return Math.max(1, Number.isFinite(n) ? n : DEFAULT_VACATION_PERIOD_DAYS);
}

export type TripRemotePolicy = {
    authorization?: 'authorized' | 'pending' | 'not_allowed';
    work_time_zone?: string;
    workTimeZone?: string;
    weekdays?: number[];
    holidays?: string[];
    windows?: unknown[];
    suggest_eligible_weekdays?: boolean;
};

function hopId() {
    return crypto.randomUUID();
}

export function scenarioDisplayName(sc: TripTimeScenario, index: number): string {
    const name = String(sc.name ?? sc.title ?? '').trim();
    return name || `Cenário ${String.fromCharCode(65 + index)}`;
}

export function listScenarios(payload: { time_scenarios?: TripTimeScenario[]; timeScenarios?: TripTimeScenario[] }) {
    const raw = payload.time_scenarios ?? payload.timeScenarios ?? [];
    return raw.map((sc, index) => {
        const id = String(sc.id ?? sc.uuid ?? '').trim();
        if (id) return { ...sc, id };
        return { ...sc, id: `scenario-${index}-${String(sc.name ?? sc.title ?? 'c').slice(0, 8)}` };
    });
}

/** Grava início do período de férias no cenário do rascunho (por índice do período). */
export function patchScenarioVacationStart(
    scenarios: TripTimeScenario[],
    scenarioId: string,
    startKey: string,
    periodIndex = 0
): TripTimeScenario[] {
    const key = startKey.trim().slice(0, 10);
    const sid = String(scenarioId);
    return scenarios.map((sc) => {
        if (String(sc.id) !== sid) return sc;
        const vacations = [...((sc.vacations as TripVacationPeriod[]) ?? [])];
        if (vacations.length === 0) {
            vacations.push({ id: crypto.randomUUID(), days: 18, starts_on: '', startsOn: '' });
        }
        const idx = Math.min(Math.max(0, periodIndex), vacations.length - 1);
        vacations[idx] = {
            ...vacations[idx],
            id: vacations[idx].id ?? crypto.randomUUID(),
            startsOn: key,
            starts_on: key,
            days: Math.max(1, Number(vacations[idx].days ?? 18))
        };
        return { ...sc, vacations };
    });
}

export function engineScenarioInput(sc: TripTimeScenario) {
    const vacations = (sc.vacations as { starts_on?: string; startsOn?: string; days?: number }[] | undefined) ?? [];
    const remote = (sc.remote as TripRemotePolicy | undefined) ?? {};
    return {
        ...sc,
        name: String(sc.name ?? sc.title ?? 'Cenário'),
        hops: sc.hops ?? [],
        vacations: vacations.map((v) => ({
            ...v,
            startsOn: v.starts_on ?? v.startsOn,
            days: v.days ?? 18
        })),
        remote: {
            ...remote,
            authorization: remote.authorization ?? 'pending',
            weekdays: remote.weekdays ?? [2, 3, 4, 5, 6],
            suggestEligibleWeekdays: remote.suggest_eligible_weekdays ?? remote.suggestEligibleWeekdays ?? true,
            suggest_eligible_weekdays:
                remote.suggest_eligible_weekdays ?? remote.suggestEligibleWeekdays ?? true,
            workTimeZone: remote.work_time_zone ?? remote.workTimeZone ?? 'America/Sao_Paulo',
            work_time_zone: remote.work_time_zone ?? remote.workTimeZone ?? 'America/Sao_Paulo'
        },
        vacationBalance: sc.vacation_balance ?? sc.vacationBalance
    };
}

export function blankScenario(name: string): TripTimeScenario {
    return {
        id: crypto.randomUUID(),
        name,
        title: name,
        hops: [],
        vacations: [{ id: crypto.randomUUID(), days: 18, starts_on: '', startsOn: '' }],
        remote: {
            authorization: 'pending',
            weekdays: [2, 3, 4, 5, 6],
            suggest_eligible_weekdays: true,
            suggestEligibleWeekdays: true
        },
        notes: '',
        pulls_flights_from_ficha: false,
        pullsFlightsFromFicha: false,
        own_hops: [],
        ownHops: []
    };
}

export function duplicateScenario(sc: TripTimeScenario, name: string): TripTimeScenario {
    const hops = (sc.hops as TripTimeHop[] | undefined) ?? [];
    const ownHops = (sc.own_hops as TripTimeHop[] | undefined) ?? (sc.ownHops as TripTimeHop[] | undefined) ?? [];
    const vacations = (sc.vacations as TripVacationPeriod[] | undefined) ?? [];
    return {
        ...sc,
        id: crypto.randomUUID(),
        name,
        title: name,
        hops: hops.map((h) => ({
            ...h,
            id: hopId(),
            connections: (h.connections ?? []).map((c) => ({ ...c }))
        })),
        own_hops: ownHops.map((h) => ({
            ...h,
            id: hopId(),
            connections: (h.connections ?? []).map((c) => ({ ...c }))
        })),
        ownHops: ownHops.map((h) => ({
            ...h,
            id: hopId(),
            connections: (h.connections ?? []).map((c) => ({ ...c }))
        })),
        vacations: vacations.map((v) => ({
            id: crypto.randomUUID(),
            days: Math.max(1, v.days ?? 18),
            starts_on: v.starts_on ?? v.startsOn ?? '',
            startsOn: v.starts_on ?? v.startsOn ?? ''
        }))
    };
}

export function scenarioWithVacationDays(sc: TripTimeScenario, days: number): TripTimeScenario {
    const copy = duplicateScenario(sc, `${days} dias`);
    const vacations = [...((copy.vacations as TripVacationPeriod[]) ?? [])];
    if (vacations.length === 0) {
        vacations.push({ id: crypto.randomUUID(), days, starts_on: '', startsOn: '' });
    } else {
        vacations[0] = { ...vacations[0], days: Math.max(1, days) };
    }
    return { ...copy, vacations };
}

export function mergeEditableScenarioFields(
    prepared: TripTimeScenario,
    raw: TripTimeScenario | undefined
): TripTimeScenario {
    if (!raw) return prepared;
    return {
        ...prepared,
        vacations: raw.vacations ?? prepared.vacations,
        remote: raw.remote ?? prepared.remote,
        vacation_balance: raw.vacation_balance ?? prepared.vacation_balance,
        vacationBalance: raw.vacationBalance ?? prepared.vacationBalance,
        notes: raw.notes ?? prepared.notes
    };
}

export function vacationDayKeys(periods: TripVacationPeriod[]): Set<string> {
    const keys = new Set<string>();
    for (const p of periods) {
        const startKey = (p.starts_on ?? p.startsOn ?? '').slice(0, 10);
        const days = vacationPeriodDays(p);
        if (!parseDayKey(startKey)) continue;
        for (let i = 0; i < days; i++) {
            const k = i === 0 ? startKey : addDayKey(startKey, i);
            if (k) keys.add(k);
        }
    }
    return keys;
}

/** Último dia civil do bloco de férias — igual à última célula coral no calendário. */
export function vacationEndsOn(period: TripVacationPeriod): string | null {
    const keys = [...vacationDayKeys([period])].sort();
    if (!keys.length) return null;
    return keys[keys.length - 1];
}

export function usableSimulations(segments: TripFlightSegment[]): TripFlightSimulation[] {
    const live = segments
        .flatMap((s) => s.simulations ?? [])
        .filter((sim) => sim && sim.status !== 'descartada');
    const chosen = live.filter((sim) => sim.status === 'escolhida');
    return chosen.length ? chosen : live;
}

function hopFromSimulation(sim: TripFlightSimulation, linked: boolean): TripTimeHop[] {
    const outbound: TripTimeHop = {
        id: hopId(),
        kind: 'voo',
        originCity: sim.origin?.trim() || 'Origem',
        destinationCity: sim.destination?.trim() || 'Destino',
        departsAt: sim.departsAt ?? null,
        arrivesAt: sim.arrivesAt ?? null,
        linkedFlightSimulationId: linked ? sim.id : null
    };
    const hops = [outbound];
    if (sim.returnDepartsAt || sim.returnArrivesAt) {
        hops.push({
            id: hopId(),
            kind: 'voo',
            originCity: sim.destination?.trim() || 'Destino',
            destinationCity: sim.origin?.trim() || 'Origem',
            departsAt: sim.returnDepartsAt ?? null,
            arrivesAt: sim.returnArrivesAt ?? null,
            linkedFlightSimulationId: linked ? sim.id : null
        });
    }
    return hops;
}

/** Ordem cronológica dos trechos (partida, senão chegada). */
export function sortHopsChronologically(hops: TripTimeHop[]): TripTimeHop[] {
    return sortHopsChronologicallyMotor(hops) as TripTimeHop[];
}

export function hopsFromSimulations(simulations: TripFlightSimulation[], linked = true): TripTimeHop[] {
    return sortHopsChronologically(simulations.flatMap((sim) => hopFromSimulation(sim, linked)));
}

export function hopsFromChosenFlights(segments: TripFlightSegment[]): TripTimeHop[] {
    const chosen = segments
        .flatMap((s) => s.simulations ?? [])
        .filter((sim) => sim?.status === 'escolhida');
    return hopsFromSimulations(chosen);
}

export type FlightSimPicks = Record<string, string>;

export function liveSimulationsForSegment(segment: TripFlightSegment): TripFlightSimulation[] {
    return (segment.simulations ?? []).filter((sim) => sim && sim.status !== 'descartada');
}

export function defaultSimulationIdForSegment(segment: TripFlightSegment): string | null {
    const live = liveSimulationsForSegment(segment);
    const chosen = live.find((s) => s.status === 'escolhida');
    return chosen?.id ?? live[0]?.id ?? null;
}

export function readFlightSimPicks(scenario: TripTimeScenario): FlightSimPicks {
    const raw = scenario.flight_sim_picks ?? scenario.flightSimPicks;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return { ...(raw as FlightSimPicks) };
    }
    return {};
}

export function resolveFlightSimPicks(segments: TripFlightSegment[], picks: FlightSimPicks): FlightSimPicks {
    const next: FlightSimPicks = { ...picks };
    for (const seg of segments) {
        const live = liveSimulationsForSegment(seg);
        if (!live.length) continue;
        const current = next[seg.id];
        if (current && live.some((s) => s.id === current)) continue;
        const fallback = defaultSimulationIdForSegment(seg);
        if (fallback) next[seg.id] = fallback;
    }
    return next;
}

export function hopsFromFlightPicks(segments: TripFlightSegment[], picks: FlightSimPicks): TripTimeHop[] {
    const sims: TripFlightSimulation[] = [];
    for (const seg of segments) {
        const live = liveSimulationsForSegment(seg);
        if (!live.length) continue;
        const id = picks[seg.id];
        const sim = live.find((s) => s.id === id) ?? live.find((s) => s.status === 'escolhida') ?? live[0];
        if (sim) sims.push(sim);
    }
    return hopsFromSimulations(sims, true);
}

export function segmentsWithFlights(segments: TripFlightSegment[]): TripFlightSegment[] {
    return segments.filter((s) => liveSimulationsForSegment(s).length > 0);
}

export function simulationForHop(
    segments: TripFlightSegment[],
    hop: TripTimeHop
): { simulation: TripFlightSimulation; segment: TripFlightSegment } | null {
    const id = hop.linkedFlightSimulationId ?? hop.linked_flight_simulation_id;
    if (id) {
        for (const segment of segments) {
            const simulation = segment.simulations?.find((s) => s.id === id);
            if (simulation) return { simulation, segment };
        }
    }
    return null;
}

export function hopsFromRoute(destinations: TripDestination[]): TripTimeHop[] {
    const stops = destinations.filter((d) => d.name?.trim());
    if (!stops.length) return [];
    const home = 'Recife';
    const places: { city: string; country: string; departs?: string; arrives?: string }[] = [
        { city: home, country: 'Brasil', departs: stops[0]?.arrivedOn ?? undefined }
    ];
    for (const stop of stops) {
        places.push({
            city: stop.name,
            country: stop.country?.trim() || '',
            arrives: stop.arrivedOn ?? undefined,
            departs: stop.departedOn ?? undefined
        });
    }
    const last = stops[stops.length - 1];
    places.push({ city: home, country: 'Brasil', arrives: last?.departedOn ?? undefined });
    const stamp = (day?: string, hour = 10) => {
        if (!day?.trim()) return null;
        if (day.includes('T')) return day;
        return `${day.slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
    };
    const hops: TripTimeHop[] = [];
    for (let i = 0; i < places.length - 1; i++) {
        const origin = places[i];
        const dest = places[i + 1];
        hops.push({
            id: hopId(),
            kind: 'voo',
            originCity: origin.city,
            destinationCity: dest.city,
            originCountry: origin.country,
            destinationCountry: dest.country,
            departsAt: stamp(origin.departs, 10),
            arrivesAt: stamp(dest.arrives, 18)
        });
    }
    return sortHopsChronologically(hops);
}

export function seedHopsIfEmpty(
    scenario: TripTimeScenario,
    segments: TripFlightSegment[],
    destinations: TripDestination[]
): TripTimeScenario {
    const hops = (scenario.hops as TripTimeHop[] | undefined) ?? [];
    if (hops.length > 0) return scenario;
    const pulls = Boolean(scenario.pulls_flights_from_ficha ?? scenario.pullsFlightsFromFicha);
    const fromFlights = pulls ? hopsFromChosenFlights(segments) : hopsFromSimulations(usableSimulations(segments));
    const nextHops = fromFlights.length ? fromFlights : hopsFromRoute(destinations);
    if (!nextHops.length) return scenario;
    return { ...scenario, hops: nextHops };
}

export function hopOrigin(h: TripTimeHop): string {
    return (h.originCity ?? '').trim() || 'Origem';
}

export function hopDestination(h: TripTimeHop): string {
    return (h.destinationCity ?? '').trim() || 'Destino';
}

export function hopCountry(h: TripTimeHop): string {
    const explicit = (h.destinationCountry ?? h.destination_country ?? '').trim();
    if (explicit) return explicit;
    return countryNameFromPlace(h.destinationCity ?? '');
}

export function hopOriginCountry(h: TripTimeHop): string {
    const explicit = (h.originCountry ?? h.origin_country ?? '').trim();
    if (explicit) return explicit;
    return countryNameFromPlace(h.originCity ?? '');
}

export function countryNameFromPlace(place: string): string {
    const p = place.trim();
    if (!p) return '';
    const lower = p.toLowerCase();
    if (/recife|são paulo|sao paulo|rio|brasil|brazil|gru|gig|bsb/i.test(lower)) return 'Brasil';
    if (/madri|madrid|barcelona|barcelon|lisboa|porto|espanha|spain/i.test(lower)) return 'Espanha';
    if (/pequim|beijing|xangai|shanghai|china/i.test(lower)) return 'China';
    if (/paris|france|frança|lyon/i.test(lower)) return 'França';
    if (/londres|london|uk|inglaterra/i.test(lower)) return 'Reino Unido';
    if (/amsterdam|holanda|netherlands|países baixos/i.test(lower)) return 'Países Baixos';
    if (/new york|miami|orlando|usa|estados unidos/i.test(lower)) return 'Estados Unidos';
    if (/\([a-z]{3}\)/i.test(p)) {
        const code = p.match(/\(([a-z]{3})\)/i)?.[1]?.toUpperCase();
        if (code === 'REC' || code === 'GRU' || code === 'GIG') return 'Brasil';
        if (code === 'MAD' || code === 'BCN') return 'Espanha';
        if (code === 'PVG' || code === 'SHA' || code === 'PEK') return 'China';
    }
    return p;
}

export function hopDayKey(raw?: string | null): string | null {
    if (!raw?.trim()) return null;
    const slice = raw.trim().slice(0, 10);
    return parseDayKey(slice) ? slice : null;
}

export function enrichHopCountries(hops: TripTimeHop[]): TripTimeHop[] {
    return hops.map((hop) => ({
        ...hop,
        originCountry: countryNameFromPlace(hop.originCity ?? '') || hop.originCountry || hop.origin_country,
        destinationCountry: countryNameFromPlace(hop.destinationCity ?? '') || hop.destinationCountry || hop.destination_country
    }));
}

function suggestVacationStart(hops: TripTimeHop[]): string {
    for (const hop of hops) {
        const arrive = hopDayKey(hop.arrivesAt ?? hop.arrives_at);
        const country = countryNameFromPlace(hop.destinationCity ?? '') || hopCountry(hop);
        if (arrive && country && country !== 'Brasil') return arrive;
    }
    return hopDayKey(hops[0]?.departsAt ?? hops[0]?.departs_at) ?? '';
}

/** Dica visual — não grava no cenário até o usuário escolher. */
export function suggestedVacationStart(hops: TripTimeHop[]): string {
    return suggestVacationStart(hops).slice(0, 10);
}

export function normalizeScenario(
    scenario: TripTimeScenario,
    segments: TripFlightSegment[],
    destinations: TripDestination[],
    tripStartsOn?: string
): TripTimeScenario {
    let next = seedHopsIfEmpty(scenario, segments, destinations);
    const hops = sortHopsChronologically(
        enrichHopCountries(((next.hops as TripTimeHop[] | undefined) ?? []).map((h) => ({ ...h })))
    );
    const vacations = [...((next.vacations as TripVacationPeriod[] | undefined) ?? [])];
    if (vacations.length === 0) {
        vacations.push({ id: crypto.randomUUID(), days: 18, startsOn: '', starts_on: '' });
    }
    const first = vacations[0];
    const rawStart = (first.starts_on ?? first.startsOn ?? '').trim().slice(0, 10);
    const hadStart = /^\d{4}-\d{2}-\d{2}$/.test(rawStart) && Boolean(parseDayKey(rawStart));
    const start = hadStart ? rawStart : '';
    vacations[0] = {
        ...first,
        id: first.id ?? crypto.randomUUID(),
        days: Math.max(1, Number(first.days ?? 18)),
        startsOn: start,
        starts_on: start
    };
    const name = String(next.name ?? next.title ?? 'Cenário');
    return {
        ...next,
        name,
        title: next.title ?? name,
        hops,
        vacations
    };
}

export function flightDayKeys(hops: TripTimeHop[]): Set<string> {
    const keys = new Set<string>();
    for (const hop of hops) {
        const dep = hopDayKey(hop.departsAt ?? hop.departs_at);
        const arr = hopDayKey(hop.arrivesAt ?? hop.arrives_at);
        if (dep) keys.add(dep);
        if (arr) keys.add(arr);
    }
    return keys;
}