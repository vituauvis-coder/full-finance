import { dayKey, parseDayKey } from '@motor/viagens/calendar-format.js';
import { tripSummaryFromSnapshot } from './chosenScenarioResumo';
import type { ScenarioSnapshot } from './tripScenarioCriteria';

export function snapshotDayBounds(snap: ScenarioSnapshot): { start: string | null; end: string | null } {
    const toKey = (v: Date | string | null | undefined): string | null => {
        if (!v) return null;
        if (v instanceof Date) return dayKey(v);
        const d = parseDayKey(String(v).slice(0, 10));
        return d ? dayKey(d) : null;
    };
    return { start: toKey(snap.tripStart), end: toKey(snap.tripEnd) };
}

export function applyChosenScenario(
    scenarioId: string,
    snap: ScenarioSnapshot,
    currentChosen: string | null
): { chosenId: string | null; startsOn?: string; endsOn?: string; tripSummary?: ReturnType<typeof tripSummaryFromSnapshot> | null } {
    if (currentChosen === scenarioId) {
        return { chosenId: null, tripSummary: null };
    }
    const bounds = snapshotDayBounds(snap);
    return {
        chosenId: scenarioId,
        tripSummary: tripSummaryFromSnapshot(snap),
        ...(bounds.start ? { startsOn: bounds.start } : {}),
        ...(bounds.end ? { endsOn: bounds.end } : {})
    };
}