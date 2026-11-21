import { movementDate } from '../../../../lib/period';
import { debtColorHex, sortDebtsForDisplay } from '../../domain/debtColors';
import { enumerateCalendarYearMonths, monthKey, updatesForDebt } from '../../domain/debtAggregations';
import {
    lastMonthKeyWithPositiveBalance,
    resolveQuitacaoMonthKey
} from '../../domain/debtQuitation';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';

export type DebtsChartRow = {
    label: string;
    monthKey: string;
    total: number | null;
    [seriesKey: string]: string | number | null | undefined;
};

export type DebtsChartSeries = {
    key: string;
    label: string;
    color: string;
    closed?: boolean;
};

function lastBalanceOnOrBeforeMonth(updates: DebtUpdate[], debtId: string, monthKeysList: string[], index: number): number | null {
    const targetMk = monthKeysList[index];
    const list = updatesForDebt(updates, debtId);
    let last: number | null = null;
    for (const u of list) {
        const mk = monthKey(movementDate(u));
        if (mk <= targetMk) {
            last = Number(u.amount) || 0;
        }
    }
    return last;
}

function hadUpdateInMonth(updates: DebtUpdate[], debtId: string, mk: string): boolean {
    return updatesForDebt(updates, debtId).some((u) => monthKey(movementDate(u)) === mk);
}

function closedDebtLineValue(
    debt: Debt,
    updates: DebtUpdate[],
    monthKeysList: string[],
    index: number
): number | null {
    const mk = monthKeysList[index];
    const lastBalMk = lastMonthKeyWithPositiveBalance(updates, debt.id);
    const quitMk = resolveQuitacaoMonthKey(updates, debt.id);
    const lastBalIdx = lastBalMk ? monthKeysList.indexOf(lastBalMk) : -1;
    const quitIdx = quitMk ? monthKeysList.indexOf(quitMk) : -1;

    if (lastBalIdx < 0 && quitIdx < 0) return null;

    if (quitIdx >= 0 && index >= quitIdx) return 0;

    if (lastBalIdx >= 0 && index <= lastBalIdx) {
        if (hadUpdateInMonth(updates, debt.id, mk) || index === lastBalIdx) {
            return lastBalanceOnOrBeforeMonth(updates, debt.id, monthKeysList, index);
        }
    }

    if (lastBalIdx >= 0 && quitIdx < 0 && index > lastBalIdx) return 0;

    return null;
}

function debtLineValue(
    debt: Debt,
    updates: DebtUpdate[],
    monthKeysList: string[],
    index: number
): number | null {
    if (debt.isClosed === true) {
        return closedDebtLineValue(debt, updates, monthKeysList, index);
    }

    const mk = monthKeysList[index];
    return hadUpdateInMonth(updates, debt.id, mk)
        ? lastBalanceOnOrBeforeMonth(updates, debt.id, monthKeysList, index)
        : null;
}

function monthContributesToChart(
    debt: Debt,
    updates: DebtUpdate[],
    monthKeysList: string[],
    index: number,
    value: number | null
): boolean {
    if (value == null) return false;
    const mk = monthKeysList[index];
    if (hadUpdateInMonth(updates, debt.id, mk)) return true;
    if (debt.isClosed === true) {
        const quitMk = resolveQuitacaoMonthKey(updates, debt.id);
        const quitIdx = quitMk ? monthKeysList.indexOf(quitMk) : -1;
        if (quitIdx >= 0 && index >= quitIdx) return true;
        const lastBalMk = lastMonthKeyWithPositiveBalance(updates, debt.id);
        const lastBalIdx = lastBalMk ? monthKeysList.indexOf(lastBalMk) : -1;
        if (lastBalIdx >= 0 && quitIdx < 0 && index > lastBalIdx) return true;
    }
    return false;
}

export function buildDebtsChartSeries(
    debts: Debt[],
    updates: DebtUpdate[]
): { rows: DebtsChartRow[]; series: DebtsChartSeries[] } {
    const withHistory = debts.filter((d) => updatesForDebt(updates, d.id).length > 0);
    const ordered = sortDebtsForDisplay(withHistory);
    const chartYear = new Date().getFullYear();
    const months = enumerateCalendarYearMonths(chartYear);
    const monthKeysList = months.map((m) => monthKey(m));

    const series: DebtsChartSeries[] = ordered.map((d) => ({
        key: `debt_${d.id}`,
        label: d.isClosed === true ? `${d.company || 'Dívida'} (quitada)` : d.company || 'Dívida',
        color: debtColorHex(d.colorKey),
        closed: d.isClosed === true
    }));

    const rows: DebtsChartRow[] = months.map((m, i) => {
        const mk = monthKeysList[i];
        const raw = m.toLocaleDateString('pt-BR', { month: 'short' });
        const label = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/\.$/, '');
        const row: DebtsChartRow = { label, monthKey: mk, total: null };

        let sumTotal = 0;
        let anyUpdateInMonth = false;

        for (const d of ordered) {
            const key = `debt_${d.id}`;
            const bal = debtLineValue(d, updates, monthKeysList, i);
            row[key] = bal;

            if (hadUpdateInMonth(updates, d.id, mk)) anyUpdateInMonth = true;
            if (monthContributesToChart(d, updates, monthKeysList, i, bal)) anyUpdateInMonth = true;
            if (bal != null) sumTotal += bal;
        }

        row.total = anyUpdateInMonth ? Math.round(sumTotal * 100) / 100 : null;

        return row;
    });

    return { rows, series };
}