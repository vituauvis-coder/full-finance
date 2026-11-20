import { metricValue } from '@motor/viagens/trip-scenario-engine.js';
import { regionForCountry } from './tripScenarioDisplay';

export type ScenarioCriterion = {
    id?: string;
    metric: string;
    title?: string;
    weight: number;
    prefers_higher?: boolean;
    prefersHigher?: boolean;
};

export type ScenarioSnapshot = {
    scenarioId?: string;
    name?: string;
    calendarDays?: number;
    durationHours?: number;
    tripStart?: Date | string | null;
    tripEnd?: Date | string | null;
    vacation?: { consumedDays?: number; remainingBalance?: number | null; startKey?: string; endKey?: string };
    tourism?: { fullDays?: number; partialDays?: number; hours?: number };
    remote?: { possibleWeekdays?: number; scheduledDays?: number };
    layovers?: { worthVisiting?: boolean }[];
    countrySchedule?: {
        id?: string;
        country?: string;
        continent?: string;
        days?: number;
        hours?: number;
        isLayoverOnly?: boolean;
        cities?: string[];
    }[];
    continents?: { name?: string; hours?: number }[];
    months?: string[];
    days?: { dayKey?: string; bands?: string[] }[];
    conflicts?: { text?: string }[];
};

const METRIC_LABELS: Record<string, string> = {
    tourismDays: 'Turismo completo',
    vacationDays: 'Férias usadas',
    vacationBalance: 'Saldo de férias',
    remoteDays: 'Dias remotos',
    countries: 'Países',
    continents: 'Continentes',
    layoverVisit: 'Escalas aproveitáveis',
    calendarDays: 'Dias de viagem',
    months: 'Meses'
};

const COMPACT_METRICS = new Set([
    'tourismDays',
    'vacationDays',
    'vacationBalance',
    'remoteDays',
    'calendarDays',
    'layoverVisit'
]);

const STABLE_DEFAULT_CRITERIA: ScenarioCriterion[] = [
    { id: 'criterion-tourismDays', metric: 'tourismDays', weight: 5, title: METRIC_LABELS.tourismDays },
    { id: 'criterion-vacationDays', metric: 'vacationDays', weight: 4, title: METRIC_LABELS.vacationDays },
    { id: 'criterion-remoteDays', metric: 'remoteDays', weight: 4, title: METRIC_LABELS.remoteDays },
    { id: 'criterion-countries', metric: 'countries', weight: 3, title: METRIC_LABELS.countries },
    { id: 'criterion-continents', metric: 'continents', weight: 2, title: METRIC_LABELS.continents },
    { id: 'criterion-layoverVisit', metric: 'layoverVisit', weight: 2, title: METRIC_LABELS.layoverVisit },
    { id: 'criterion-months', metric: 'months', weight: 0, title: METRIC_LABELS.months }
];

export function defaultCriteria(): ScenarioCriterion[] {
    return STABLE_DEFAULT_CRITERIA.map((c) => ({ ...c }));
}

export function resolveCriteria(raw?: unknown[]): ScenarioCriterion[] {
    if (raw?.length) {
        return raw.map((item) => {
            const c = item as ScenarioCriterion;
            return {
                ...c,
                weight: Math.min(5, Math.max(0, Number(c.weight) || 0)),
                title: c.title ?? METRIC_LABELS[c.metric] ?? c.metric
            };
        });
    }
    return defaultCriteria();
}

export function activeCriteria(criteria: ScenarioCriterion[]): ScenarioCriterion[] {
    return criteria.filter((c) => c.weight > 0);
}

export function isCompactMetric(metric: string): boolean {
    return COMPACT_METRICS.has(metric);
}

export function metricTint(metric: string): string {
    switch (metric) {
        case 'tourismDays':
        case 'layoverVisit':
            return 'turquesa';
        case 'vacationDays':
        case 'vacationBalance':
            return 'coral';
        case 'remoteDays':
            return 'ouro';
        case 'countries':
        case 'continents':
        case 'months':
            return 'oceano';
        default:
            return 'oceano';
    }
}

function countryNames(snap: ScenarioSnapshot): string[] {
    const rows = (snap.countrySchedule ?? []).filter((r) => !r.isLayoverOnly);
    if (rows.length) return rows.map((r) => r.country ?? '').filter(Boolean);
    return [];
}

function continentNames(snap: ScenarioSnapshot): string[] {
    const fromSnap = (snap.continents ?? []).map((c) => c.name ?? '').filter(Boolean);
    if (fromSnap.length) return fromSnap;
    const rows = snap.countrySchedule ?? [];
    const seen = new Set<string>();
    for (const row of rows) {
        const continent =
            row.continent?.trim() || (row.country ? regionForCountry(row.country) : '');
        if (continent && !seen.has(continent)) seen.add(continent);
    }
    return [...seen];
}

function monthsLabel(snap: ScenarioSnapshot): string {
    if (snap.months?.length) return snap.months.join(' · ');
    const start = snap.tripStart instanceof Date ? snap.tripStart : snap.tripStart ? new Date(snap.tripStart) : null;
    const end = snap.tripEnd instanceof Date ? snap.tripEnd : snap.tripEnd ? new Date(snap.tripEnd) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
    const fmt = (d: Date) =>
        d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^./, (c) => c.toUpperCase());
    const a = fmt(start);
    const b = fmt(end);
    return a === b ? a : `${a} · ${b}`;
}

export function metricDisplay(metric: string, snap: ScenarioSnapshot): string {
    switch (metric) {
        case 'tourismDays':
            return `${snap.tourism?.fullDays ?? metricValue(metric, snap)}d`;
        case 'vacationDays':
            return `${snap.vacation?.consumedDays ?? 0}`;
        case 'vacationBalance':
            return snap.vacation?.remainingBalance != null ? `${snap.vacation.remainingBalance}` : '—';
        case 'remoteDays': {
            const suggested = snap.remote?.suggestedDays;
            if (Array.isArray(suggested) && suggested.length > 0) return `${suggested.length}`;
            return `${snap.remote?.possibleWeekdays ?? snap.remote?.scheduledDays ?? 0}`;
        }
        case 'countries': {
            const names = countryNames(snap);
            return names.length ? names.join(' · ') : '—';
        }
        case 'continents': {
            const names = continentNames(snap);
            return names.length ? names.join(' · ') : '—';
        }
        case 'months':
            return monthsLabel(snap);
        case 'layoverVisit':
            return `${(snap.layovers ?? []).filter((l) => l.worthVisiting).length}`;
        case 'calendarDays':
            return `${snap.calendarDays ?? 0}d`;
        default:
            return String(metricValue(metric, snap));
    }
}