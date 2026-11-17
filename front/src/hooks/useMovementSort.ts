import { useCallback, useMemo, useState } from 'react';
import { movementDate } from '../lib/period';
import type { Movement } from '../lib/types/finance';

export type SortDir = 'asc' | 'desc';

export type GainSortKey = 'date' | 'description' | 'category' | 'account' | 'amount' | 'received';
export type ExpenseSortKey = 'date' | 'description' | 'category' | 'account' | 'amount' | 'status';

export function useMovementSort<T extends string>(
    rows: Movement[],
    defaultKey: T,
    compare: (a: Movement, b: Movement, key: T, dir: SortDir, accountLabel: (id?: string) => string) => number
) {
    const [sortKey, setSortKey] = useState<T>(defaultKey);
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const toggleSort = useCallback(
        (key: T) => {
            if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            else {
                setSortKey(key);
                setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
            }
        },
        [sortKey]
    );

    const sortRows = useCallback(
        (accountLabel: (id?: string) => string) =>
            [...rows].sort((a, b) => compare(a, b, sortKey, sortDir, accountLabel)),
        [rows, sortKey, sortDir, compare]
    );

    return useMemo(() => ({ sortKey, sortDir, toggleSort, sortRows }), [sortKey, sortDir, toggleSort, sortRows]);
}

export function compareGainRows(
    a: Movement,
    b: Movement,
    key: GainSortKey,
    dir: SortDir,
    accountLabel: (id?: string) => string
) {
    let cmp = 0;
    switch (key) {
        case 'date':
            cmp = movementDate(a).getTime() - movementDate(b).getTime();
            break;
        case 'description':
            cmp = String(a.description ?? '').localeCompare(String(b.description ?? ''), 'pt-BR');
            break;
        case 'category':
            cmp = String(a.category ?? '').localeCompare(String(b.category ?? ''), 'pt-BR');
            break;
        case 'account':
            cmp = accountLabel(a.accountId).localeCompare(accountLabel(b.accountId), 'pt-BR');
            break;
        case 'amount':
            cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
            break;
        case 'received': {
            const pa = a.isPaid === false ? 0 : 1;
            const pb = b.isPaid === false ? 0 : 1;
            cmp = pa - pb;
            break;
        }
        default:
            cmp = 0;
    }
    return dir === 'asc' ? cmp : -cmp;
}

export function compareExpenseRows(
    a: Movement,
    b: Movement,
    key: ExpenseSortKey,
    dir: SortDir,
    accountLabel: (id?: string) => string
) {
    let cmp = 0;
    switch (key) {
        case 'date':
            cmp = movementDate(a).getTime() - movementDate(b).getTime();
            break;
        case 'description':
            cmp = String(a.description ?? '').localeCompare(String(b.description ?? ''), 'pt-BR');
            break;
        case 'category':
            cmp = String(a.category ?? '').localeCompare(String(b.category ?? ''), 'pt-BR');
            break;
        case 'account':
            cmp = accountLabel(a.accountId).localeCompare(accountLabel(b.accountId), 'pt-BR');
            break;
        case 'amount':
            cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
            break;
        case 'status': {
            const pa = a.isPaid === false ? 0 : 1;
            const pb = b.isPaid === false ? 0 : 1;
            cmp = pa - pb;
            break;
        }
        default:
            cmp = 0;
    }
    return dir === 'asc' ? cmp : -cmp;
}