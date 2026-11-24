import type { CSSProperties } from 'react';

/** Linhas no corpo da tabela na página atual (1 quando a aba está vazia). */
export function ledgerTabBodyRowCount(total: number, start: number, end: number): number {
    if (total <= 0) return 1;
    return Math.max(0, end - start);
}

export function maxLedgerTabBodyRows(counts: number[]): number {
    if (counts.length === 0) return 1;
    return Math.max(1, ...counts);
}

export function ledgerStablePanelStyle(stableBodyRows: number): CSSProperties {
    return { '--ledger-stable-body-rows': stableBodyRows } as CSSProperties;
}