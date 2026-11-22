import {
    ALL_YEARS_PERIOD,
    CIVIL_YEAR_PERIOD,
    isAllYearsPeriod,
    isCivilYearPeriod,
    MONTH_NAMES,
    monthIndexFromPeriod
} from '../../../lib/period';
import type { CofrinhoApplication } from './cofrinhoAggregations';
import { formatYearMonthLabel, referenceMonthToYearMonth, yearMonthFromCivilPeriod } from './cofrinhoPeriod';

export type CofrinhoPeriodScope =
    | { kind: 'month'; yearMonth: string; year: number }
    | { kind: 'civil-year'; year: number }
    | { kind: 'all-years' };

export function resolveCofrinhoPeriodScope(period: string, year: number): CofrinhoPeriodScope {
    if (isAllYearsPeriod(period)) return { kind: 'all-years' };
    if (isCivilYearPeriod(period)) return { kind: 'civil-year', year };
    return { kind: 'month', yearMonth: yearMonthFromCivilPeriod(period, year), year };
}

export function applicationMatchesCofrinhoScope(app: CofrinhoApplication, scope: CofrinhoPeriodScope): boolean {
    const raw = app as CofrinhoApplication & { reference_month?: string };
    const ym = referenceMonthToYearMonth(app.referenceMonth ?? raw.reference_month);
    if (!ym) return false;
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return ym.startsWith(`${scope.year}-`);
    return ym === scope.yearMonth;
}

export function formatCofrinhoScopeLabel(period: string, year: number): string {
    if (isAllYearsPeriod(period)) return 'Todos os anos';
    if (isCivilYearPeriod(period)) return `${year} (ano inteiro)`;
    const mi = monthIndexFromPeriod(period);
    if (mi < 0) return `${year}`;
    return `${MONTH_NAMES[mi]} ${year}`;
}

/** Rótulo do treemap (título do período). */
export function formatCofrinhoTreemapPeriodLabel(period: string, year: number, yearMonth: string): string {
    if (isAllYearsPeriod(period)) return 'Todos os anos';
    if (isCivilYearPeriod(period)) return `${year} (ano inteiro)`;
    const mi = monthIndexFromPeriod(period);
    return `${MONTH_NAMES[mi]} ${year} — ${formatYearMonthLabel(yearMonth)}`;
}

export function sumApplicationsInScope(
    applications: CofrinhoApplication[],
    buckets: { id: string }[],
    scope: CofrinhoPeriodScope
): number {
    if (!buckets.length) return 0;
    return buckets.reduce((sum, bucket) => {
        const bucketSum = (applications ?? [])
            .filter((a) => String(a.bucketId ?? '') === bucket.id && applicationMatchesCofrinhoScope(a, scope))
            .reduce((s, a) => s + (Number(a.amount) || 0), 0);
        return sum + bucketSum;
    }, 0);
}

export { ALL_YEARS_PERIOD, CIVIL_YEAR_PERIOD };