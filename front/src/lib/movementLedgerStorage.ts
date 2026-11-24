import type { ExpenseSortKey, GainSortKey, SortDir } from '../hooks/useMovementSort';

export const GAINS_LEDGER_SORT_STORAGE_KEY = 'gains-ledger-sort';
export const EXPENSES_LEDGER_SORT_STORAGE_KEY = 'expenses-ledger-sort';

export const GAIN_SORT_KEYS: readonly GainSortKey[] = [
    'date',
    'description',
    'category',
    'account',
    'amount',
    'received'
];

export const EXPENSE_SORT_KEYS: readonly ExpenseSortKey[] = [
    'date',
    'description',
    'category',
    'account',
    'amount',
    'status'
];

export type MovementSortState<T extends string> = {
    key: T;
    dir: SortDir;
};

function defaultDirForKey<T extends string>(key: T): SortDir {
    return key === 'date' || key === 'amount' ? 'desc' : 'asc';
}

function isAllowedKey<T extends string>(key: string, allowed: readonly T[]): key is T {
    return (allowed as readonly string[]).includes(key);
}

export function readMovementLedgerSort<T extends string>(
    storageKey: string,
    allowed: readonly T[],
    defaultKey: T
): MovementSortState<T> {
  const fallback: MovementSortState<T> = {
        key: defaultKey,
        dir: defaultDirForKey(defaultKey)
    };
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as { key?: unknown; dir?: unknown };
        if (
            typeof parsed.key === 'string' &&
            isAllowedKey(parsed.key, allowed) &&
            (parsed.dir === 'asc' || parsed.dir === 'desc')
        ) {
            return { key: parsed.key, dir: parsed.dir };
        }
    } catch {
        /* ignore */
    }
    return fallback;
}

export function writeMovementLedgerSort<T extends string>(storageKey: string, state: MovementSortState<T>): void {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
        /* ignore */
    }
}