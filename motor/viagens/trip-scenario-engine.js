/**
 * Motor de cenários de tempo — paridade funcional com TripScenarioEngine.swift (API pública).
 * Cenários complexos com hops datados usam cálculo simplificado de duração; UI completa evolui com testes portados.
 */

import { parseDayKey, dayKey, inclusiveDayCount, startOfDayInLifeOS } from './calendar-format.js';

const DEFAULT_CRITERIA = [
    { metric: 'vacationDays', weight: 3, prefersHigher: true },
    { metric: 'tourismDays', weight: 2, prefersHigher: true },
    { metric: 'remoteDays', weight: 1, prefersHigher: false }
];

function parseInstant(local, timeZone = 'America/Sao_Paulo') {
    if (!local) return null;
    const s = String(local).trim();
    if (s.includes('T')) {
        const d = new Date(s.length === 16 ? `${s}:00` : s);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const day = parseDayKey(s);
    return day;
}

function vacationEndsOn(period) {
    const start = parseDayKey(period.startsOn ?? period.starts_on);
    const days = Math.max(1, Number(period.days ?? 0));
    if (!start || !days) return null;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days - 1);
    return dayKey(end);
}

export function emptySnapshot(id, name) {
    return {
        scenarioId: id,
        name,
        calendarDays: 0,
        durationHours: 0,
        vacation: { consumedDays: 0, daysInsideTrip: 0, remainingBalance: null },
        tourism: { fullDays: 0, partialDays: 0, hours: 0, layoverHours: 0 },
        remote: { possibleWeekdays: 0, scheduledDays: 0, byCountry: {}, afterVacationByCountry: {}, suggestedDays: [] },
        score: 0,
        stays: [],
        layovers: [],
        days: [],
        bands: [],
        conflicts: [],
        months: [],
        countrySchedule: [],
        continents: [],
        countries: []
    };
}

export function snapshot(scenario) {
    const hops = scenario.hops ?? [];
    let depart = null;
    let arrive = null;
    for (const hop of hops) {
        const d = parseInstant(hop.departsAt ?? hop.departs_at, hop.originTimeZone ?? hop.origin_time_zone);
        const a = parseInstant(hop.arrivesAt ?? hop.arrives_at, hop.destinationTimeZone ?? hop.destination_time_zone);
        if (d && (!depart || d < depart)) depart = d;
        if (a && (!arrive || a > arrive)) arrive = a;
    }
    if (!depart || !arrive || arrive <= depart) {
        const snap = emptySnapshot(scenario.id, scenario.name);
        const vacDays = (scenario.vacations ?? []).reduce((p, v) => p + Math.max(1, Number(v.days ?? 0)), 0);
        snap.vacation.consumedDays = vacDays;
        snap.vacation.daysInsideTrip = vacDays;
        return snap;
    }
    const durationHours = (arrive.getTime() - depart.getTime()) / 3600000;
    const calendarDays = inclusiveDayCount(depart, arrive);
    const vacationKeys = new Set();
    for (const period of scenario.vacations ?? []) {
        const start = parseDayKey(period.startsOn ?? period.starts_on);
        if (!start) continue;
        const days = Math.max(1, Number(period.days ?? 0));
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setUTCDate(d.getUTCDate() + i);
            vacationKeys.add(dayKey(d));
        }
    }
    const tourismFullDays = Math.max(0, Math.floor(durationHours / 24) - 2);
    const score = durationHours > 0 ? (tourismFullDays + durationHours / 24) / Math.max(vacationKeys.size, 0.5) : 0;
    return {
        scenarioId: scenario.id,
        name: scenario.name ?? 'Cenário',
        tripStart: depart,
        tripEnd: arrive,
        calendarDays,
        durationHours,
        vacation: {
            consumedDays: vacationKeys.size,
            startKey: (scenario.vacations ?? []).map((v) => v.startsOn ?? v.starts_on).filter(Boolean).sort()[0],
            endKey: (scenario.vacations ?? []).map((v) => vacationEndsOn(v)).filter(Boolean).sort().at(-1),
            daysInsideTrip: vacationKeys.size,
            remainingBalance: scenario.vacationBalance != null ? Math.max(0, scenario.vacationBalance - vacationKeys.size) : null
        },
        tourism: { fullDays: tourismFullDays, partialDays: 0, hours: tourismFullDays * 10, layoverHours: 0 },
        remote: { possibleWeekdays: 0, scheduledDays: 0, byCountry: {}, afterVacationByCountry: {}, suggestedDays: [] },
        score,
        stays: [],
        layovers: [],
        days: [],
        bands: [],
        conflicts: [],
        months: [],
        countrySchedule: [],
        continents: [],
        countries: []
    };
}

export function snapshots(scenarios) {
    return (scenarios ?? []).map(snapshot);
}

export function resolvedCriteria(criteria) {
    return criteria?.length ? criteria : DEFAULT_CRITERIA;
}

export function metricValue(metric, snap) {
    switch (metric) {
        case 'vacationDays':
            return snap.vacation?.consumedDays ?? 0;
        case 'vacationBalance':
            return snap.vacation?.remainingBalance ?? 0;
        case 'remoteDays':
            return snap.remote?.possibleWeekdays ?? 0;
        case 'tourismDays':
            return snap.tourism?.fullDays ?? 0;
        case 'countries':
            return (snap.countrySchedule ?? []).filter((r) => !r.isLayoverOnly).length;
        case 'continents':
            return new Set((snap.countrySchedule ?? []).map((r) => r.continent).filter(Boolean)).size;
        case 'layoverVisit':
            return (snap.layovers ?? []).filter((l) => l.worthVisiting).length;
        case 'calendarDays':
            return snap.calendarDays ?? 0;
        case 'months':
            return (snap.months ?? []).length;
        default:
            return 0;
    }
}

export function rankedScore(snap, all, criteria) {
    const used = resolvedCriteria(criteria).filter((c) => c.weight > 0);
    if (!used.length) return snap.score ?? 0;
    let total = 0;
    for (const criterion of used) {
        const values = all.map((s) => metricValue(criterion.metric, s));
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const raw = metricValue(criterion.metric, snap);
        const normalized = maxV === minV ? 0.5 : (raw - minV) / (maxV - minV);
        const directed = criterion.prefersHigher ? normalized : 1 - normalized;
        total += directed * criterion.weight;
    }
    return total;
}

export function winner(snapshotsList, criteria = []) {
    const usable = snapshotsList.filter((s) => (s.durationHours ?? 0) > 0);
    if (!usable.length) return null;
    let best = usable[0];
    let bestScore = rankedScore(best, usable, criteria);
    for (const s of usable.slice(1)) {
        const score = rankedScore(s, usable, criteria);
        if (score > bestScore) {
            best = s;
            bestScore = score;
        } else if (score === bestScore && (s.vacation?.consumedDays ?? 0) < (best.vacation?.consumedDays ?? 0)) {
            best = s;
        }
    }
    return best.scenarioId;
}

export function clippedToFichaCalendar(snap, startsOn, endsOn) {
    const start = parseDayKey(startsOn);
    const end = parseDayKey(endsOn);
    if (!start || !end || start > end) return snap;
    const trimmed = { ...snap };
    trimmed.tripStart = start;
    trimmed.tripEnd = end;
    trimmed.calendarDays = inclusiveDayCount(start, end);
    trimmed.durationHours = (end.getTime() - start.getTime() + 86400000) / 3600000;
    return trimmed;
}

export function formatDuration(hours) {
    const totalMinutes = Math.round(hours * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hourPart = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutePart = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(days === 1 ? '1 d' : `${days} d`);
    if (hourPart > 0) parts.push(hourPart === 1 ? '1 h' : `${hourPart} h`);
    if (minutePart > 0 && days === 0) parts.push(`${minutePart} min`);
    return parts.length ? parts.join(' ') : '0 h';
}