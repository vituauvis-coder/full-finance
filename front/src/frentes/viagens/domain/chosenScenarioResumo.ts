import { snapshot } from '@motor/viagens/trip-scenario-engine.js';
import { snapshotDayBounds } from './tripScenarioChosen';
import type { ScenarioSnapshot } from './tripScenarioCriteria';
import { enrichCountrySchedule, type CountryRow } from './tripScenarioDisplay';
import {
    engineScenarioInput,
    normalizeScenario,
    sortHopsChronologically,
    type TripTimeHop
} from './tripTimeScenario';
import type { TripDestination, TripFlightSegment, TripPayload, TripTimeScenario } from '../types';

export function chosenScenarioFromPayload(payload: TripPayload): TripTimeScenario | null {
    const chosenId = payload.chosen_time_scenario_id ?? payload.chosenTimeScenarioId;
    if (!chosenId) return null;
    const scenarios = (payload.time_scenarios ?? payload.timeScenarios ?? []) as TripTimeScenario[];
    return scenarios.find((s) => s.id === chosenId) ?? null;
}

export function chosenScenarioSnapshot(
    scenario: TripTimeScenario,
    segments: TripFlightSegment[],
    destinations: TripDestination[],
    tripStartsOn?: string
): ScenarioSnapshot {
    const normalized = normalizeScenario(scenario, segments, destinations, tripStartsOn);
    return snapshot(engineScenarioInput(normalized)) as ScenarioSnapshot;
}

export type ChosenScenarioRota = {
    snapshot: ScenarioSnapshot;
    hops: TripTimeHop[];
    countries: CountryRow[];
};

/** Início/fim civis do período total da viagem no cenário escolhido (motor). */
export function chosenScenarioTripBounds(
    payload: TripPayload,
    destinations: TripDestination[],
    tripStartsOn?: string
): { startsOn: string | null; endsOn: string | null } {
    const scenario = chosenScenarioFromPayload(payload);
    if (!scenario) return { startsOn: null, endsOn: null };
    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const snap = chosenScenarioSnapshot(scenario, segments, destinations, tripStartsOn?.trim() || undefined);
    const { start, end } = snapshotDayBounds(snap);
    return { startsOn: start, endsOn: end };
}

export function chosenScenarioRota(
    payload: TripPayload,
    destinations: TripDestination[],
    tripStartsOn: string
): ChosenScenarioRota | null {
    const scenario = chosenScenarioFromPayload(payload);
    if (!scenario) return null;
    const segments = payload.flight_segments ?? payload.flightSegments ?? [];
    const snap = chosenScenarioSnapshot(scenario, segments, destinations, tripStartsOn);
    const hops = sortHopsChronologically((scenario.hops as TripTimeHop[] | undefined) ?? []);
    const countries = enrichCountrySchedule(snap, hops, destinations);
    if (!countries.length && !hops.length) return null;
    return { snapshot: snap, hops, countries };
}

export type TripSummaryPayload = {
    calendarDays?: number;
    calendar_days?: number;
    tourismDays?: number;
    tourism_days?: number;
    vacationDays?: number;
    vacation_days?: number;
    remoteDays?: number;
    remote_days?: number;
    layoverCount?: number;
    layover_count?: number;
    durationHours?: number;
    duration_hours?: number;
};

export function remoteDaysFromSnapshot(snap: ScenarioSnapshot): number {
    const remote = snap.remote;
    if (!remote) return 0;
    const suggested = remote.suggestedDays;
    if (Array.isArray(suggested) && suggested.length > 0) return suggested.length;
    if (typeof remote.possibleWeekdays === 'number' && remote.possibleWeekdays > 0) return remote.possibleWeekdays;
    if (typeof remote.scheduledDays === 'number' && remote.scheduledDays > 0) return remote.scheduledDays;
    return remote.possibleWeekdays ?? remote.scheduledDays ?? 0;
}

export function tripSummaryFromSnapshot(snap: ScenarioSnapshot): TripSummaryPayload {
    const layovers = (snap.layovers ?? []).filter((l) => l.worthVisiting).length;
    const remoteDays = remoteDaysFromSnapshot(snap);
    return {
        calendarDays: snap.calendarDays ?? 0,
        calendar_days: snap.calendarDays ?? 0,
        tourismDays: snap.tourism?.fullDays ?? 0,
        tourism_days: snap.tourism?.fullDays ?? 0,
        vacationDays: snap.vacation?.consumedDays ?? 0,
        vacation_days: snap.vacation?.consumedDays ?? 0,
        remoteDays,
        remote_days: remoteDays,
        layoverCount: layovers,
        layover_count: layovers,
        durationHours: snap.durationHours ?? 0,
        duration_hours: snap.durationHours ?? 0
    };
}