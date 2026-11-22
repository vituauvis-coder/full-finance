import {
    ALL_YEARS_PERIOD,
    CIVIL_YEAR_PERIOD,
    MONTH_NAMES,
    periodFromMonthIndex
} from '../../../lib/period';
import type { CofrinhoLedgerRow } from './cofrinhoLedgerRows';
import { type CofrinhoPeriodScope, resolveCofrinhoPeriodScope } from './cofrinhoPeriodScope';

export type CofrinhosLedgerPeriodKind = 'all-years' | 'civil-year' | 'month';

export type CofrinhosLedgerFilters = {
    periodKind: CofrinhosLedgerPeriodKind;
    year: number;
    monthIndex: number;
    accountId: string;
    bucketId: string;
};

export function defaultCofrinhosLedgerFilters(now = new Date()): CofrinhosLedgerFilters {
    return {
        periodKind: 'all-years',
        year: now.getFullYear(),
        monthIndex: now.getMonth(),
        accountId: '',
        bucketId: ''
    };
}

export function ledgerFiltersToPagePeriod(filters: CofrinhosLedgerFilters): string {
    if (filters.periodKind === 'all-years') return ALL_YEARS_PERIOD;
    if (filters.periodKind === 'civil-year') return CIVIL_YEAR_PERIOD;
    return periodFromMonthIndex(filters.monthIndex);
}

export function resolveLedgerScope(filters: CofrinhosLedgerFilters): CofrinhoPeriodScope {
    return resolveCofrinhoPeriodScope(ledgerFiltersToPagePeriod(filters), filters.year);
}

export function filterCofrinhoLedgerRows(rows: CofrinhoLedgerRow[], filters: CofrinhosLedgerFilters): CofrinhoLedgerRow[] {
    let out = rows;
    if (filters.bucketId) {
        out = out.filter((r) => r.bucketId === filters.bucketId);
    }
    if (filters.accountId) {
        out = out.filter((r) => !r.accountId || r.accountId === filters.accountId);
    }
    return out;
}

export function ledgerFiltersActive(filters: CofrinhosLedgerFilters): boolean {
    return (
        filters.periodKind !== 'all-years' ||
        Boolean(filters.accountId) ||
        Boolean(filters.bucketId) ||
        filters.year !== new Date().getFullYear()
    );
}

export function ledgerFiltersScopeLabel(filters: CofrinhosLedgerFilters): string {
    if (filters.periodKind === 'all-years') return 'Todos os anos';
    if (filters.periodKind === 'civil-year') return `Ano ${filters.year}`;
    return `${MONTH_NAMES[filters.monthIndex]} ${filters.year}`;
}