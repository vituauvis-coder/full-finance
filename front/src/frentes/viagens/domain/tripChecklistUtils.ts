import type { TripCheckItem } from '../types';

export function checkDueOn(c: TripCheckItem): string | undefined {
    return c.dueOn?.trim() || c.due_on?.trim() || undefined;
}

export function isCheckDone(c: TripCheckItem): boolean {
    return !!(c.done || c.completed);
}

export function toggleCheckPatch(nextDone: boolean): Partial<TripCheckItem> {
    return { done: nextDone, completed: nextDone };
}

export function patchCheckInList(
    checks: TripCheckItem[],
    id: string,
    patch: Partial<TripCheckItem>
): TripCheckItem[] {
    return checks.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

export function removeCheckFromList(checks: TripCheckItem[], id: string): TripCheckItem[] {
    return checks.filter((x) => x.id !== id);
}