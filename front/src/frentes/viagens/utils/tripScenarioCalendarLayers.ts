import { parseDayKey } from '@motor/viagens/calendar-format.js';
import type { CSSProperties } from 'react';
import { flightDayKeys, vacationDayKeys, type TripTimeHop, type TripVacationPeriod } from '../domain/tripTimeScenario';
import type { ScenarioSnapshot } from '../domain/tripScenarioCriteria';

export type ScenarioDayLayers = {
    vacation: boolean;
    tourism: boolean;
    brHoliday: boolean;
    remote: boolean;
    travel: boolean;
};

export type ScenarioLegendKind = 'vacation' | 'tourism' | 'brHoliday' | 'remote' | 'travel';

export type ScenarioPaletteToken = 'coral' | 'turquesa' | 'ouro' | 'oceano';

export const SCENARIO_CALENDAR_LEGEND: {
    kind: ScenarioLegendKind;
    label: string;
    icon: string;
    token: ScenarioPaletteToken;
}[] = [
    { kind: 'vacation', label: 'Férias', icon: 'beach_access', token: 'coral' },
    { kind: 'tourism', label: 'Turismo', icon: 'explore', token: 'turquesa' },
    { kind: 'brHoliday', label: 'Feriado BR', icon: 'flag', token: 'turquesa' },
    { kind: 'remote', label: 'Remoto', icon: 'laptop_mac', token: 'ouro' },
    { kind: 'travel', label: 'Deslocamento', icon: 'flight_takeoff', token: 'oceano' }
];

export function scenarioLayerKindOn(layers: ScenarioDayLayers, kind: ScenarioLegendKind): boolean {
    switch (kind) {
        case 'vacation':
            return layers.vacation;
        case 'tourism':
            return layers.tourism;
        case 'brHoliday':
            return layers.brHoliday;
        case 'remote':
            return layers.remote;
        case 'travel':
            return layers.travel;
    }
}

const PALETTE_VAR: Record<ScenarioPaletteToken, string> = {
    coral: 'var(--v-coral)',
    turquesa: 'var(--v-turquesa)',
    ouro: 'var(--v-ouro)',
    oceano: 'var(--v-oceano)'
};

export function scenarioFlightDayKeys(snap: ScenarioSnapshot, hops: TripTimeHop[]): Set<string> {
    const fromHops = flightDayKeys(hops);
    if (fromHops.size) return fromHops;
    const keys = new Set<string>();
    for (const day of snap.days ?? []) {
        const bands = day.bands ?? [];
        if (bands.includes('flight') || bands.includes('voo')) keys.add(day.dayKey ?? '');
    }
    return keys;
}

export function scenarioLayersForKey(
    key: string,
    vacations: Set<string>,
    flights: Set<string>,
    remoteDays: Set<string>,
    tourismDays: Set<string>,
    brHolidayTourism: Set<string>
): ScenarioDayLayers {
    return {
        vacation: vacations.has(key),
        tourism: tourismDays.has(key),
        brHoliday: brHolidayTourism.has(key),
        remote: remoteDays.has(key),
        travel: flights.has(key)
    };
}

export function scenarioLayerTokens(layers: ScenarioDayLayers): ScenarioPaletteToken[] {
    const out: ScenarioPaletteToken[] = [];
    if (layers.vacation) out.push('coral');
    if (layers.tourism || layers.brHoliday) out.push('turquesa');
    if (layers.remote) out.push('ouro');
    if (layers.travel) out.push('oceano');
    return out;
}

export function scenarioCellBlendStyle(layers: ScenarioDayLayers): CSSProperties | undefined {
    const tokens = scenarioLayerTokens(layers);
    if (!tokens.length) return undefined;
    const mix = (token: ScenarioPaletteToken, pct: number) =>
        `color-mix(in srgb, ${PALETTE_VAR[token]} ${pct}%, transparent)`;
    if (tokens.length === 1) {
        const pct: Record<ScenarioPaletteToken, number> = { coral: 36, turquesa: 34, ouro: 40, oceano: 32 };
        return { background: mix(tokens[0], pct[tokens[0]]) };
    }
    const slice = 100 / tokens.length;
    const pct: Record<ScenarioPaletteToken, number> = { coral: 40, turquesa: 38, ouro: 44, oceano: 34 };
    const stops = tokens
        .map((t, i) => {
            const a = (i * slice).toFixed(2);
            const b = ((i + 1) * slice).toFixed(2);
            return `${mix(t, pct[t])} ${a}% ${b}%`;
        })
        .join(', ');
    return {
        background: `linear-gradient(135deg, ${stops})`,
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--v-tinta, var(--text-color)) 10%, transparent)'
    };
}

export function scenarioLayerSetsFromSnapshot(
    snap: ScenarioSnapshot | null | undefined,
    hops: TripTimeHop[],
    vacations: TripVacationPeriod[]
) {
    const vacKeys = vacationDayKeys(vacations as TripVacationPeriod[]);
    const flKeys = snap ? scenarioFlightDayKeys(snap, hops) : new Set<string>();
    const remoteKeys = new Set((snap?.remote?.suggestedDays ?? []).filter(Boolean));
    const tourismKeys = new Set(((snap?.tourism as { dayKeys?: string[] } | undefined)?.dayKeys ?? []).filter(Boolean));
    const raw = snap?.tourism as { dayKeys?: string[]; brHolidayKeys?: string[] } | undefined;
    const br = new Set((raw?.brHolidayKeys ?? []).filter(Boolean));
    const tour = new Set((raw?.dayKeys ?? []).filter(Boolean));
    const brHolidayTourism = new Set([...br].filter((k) => tour.has(k)));
    return { vacKeys, flKeys, remoteKeys, tourismKeys, brHolidayTourism };
}