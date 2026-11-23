import type { Account, Movement } from '../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from './cofrinhoAggregations';
import {
    buildCofrinhoLedgerRows,
    type CofrinhoLedgerRow,
    type CofrinhoTripPayloadOutflow
} from './cofrinhoLedgerRows';
import type { CofrinhoPeriodScope } from './cofrinhoPeriodScope';
import { perAccountYieldFromMonthlyBalances } from './cofrinhoYieldLedger';
import type { CofrinhoMonthlyBalance } from './cofrinhoMonthlyBalances';

const ALL_SCOPE: CofrinhoPeriodScope = { kind: 'all-years' };

/** Conta efetiva da linha (aportes sem `accountId` herdam da entrada ou despesa alocada). */
export function resolveLedgerRowAccountId(
    row: Pick<CofrinhoLedgerRow, 'accountId' | 'applicationId' | 'expenseId'>,
    expenses: Movement[],
    applications: CofrinhoApplication[]
): string | undefined {
    const direct = String(row.accountId ?? '').trim();
    if (direct) return direct;

    if (row.expenseId) {
        const exp = expenses.find((e) => String(e.id) === String(row.expenseId));
        const aid = exp?.accountId ? String(exp.accountId).trim() : '';
        if (aid) return aid;
    }

    if (row.applicationId) {
        const app = applications.find((a) => String(a.id) === String(row.applicationId));
        if (!app) return undefined;
        const appAcct = app.accountId ? String(app.accountId).trim() : '';
        if (appAcct) return appAcct;

        const raw = app as CofrinhoApplication & { allocated_expense_id?: string };
        const allocId = String(app.allocatedExpenseId ?? raw.allocated_expense_id ?? '').trim();
        if (allocId) {
            const exp = expenses.find((e) => String(e.id) === allocId);
            const aid = exp?.accountId ? String(exp.accountId).trim() : '';
            if (aid) return aid;
        }
    }

    return undefined;
}

function rowMatchesThroughMonth(row: CofrinhoLedgerRow, throughYearMonth: string): boolean {
    const ym = String(row.yearMonth ?? '').trim();
    return Boolean(ym && ym <= throughYearMonth);
}

function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

export function previousCofrinhoYearMonth(yearMonth: string): string | null {
    const ym = String(yearMonth ?? '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym)) return null;
    const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    if (m === 1) return `${y - 1}-12`;
    return `${y}-${String(m - 1).padStart(2, '0')}`;
}

type LedgerNetOpts = Parameters<typeof computeCofrinhoLedgerNetThroughMonth>[0];

export type CofrinhoLedgerMonthTotals = {
    inflows: number;
    outflows: number;
    /** Líquido no fim do mês (já com saídas), igual ao extrato. */
    netEnd: number;
    /** Líquido no fim do mês anterior. */
    netStart: number;
    /** Aportes do mês antes de descontar saídas (útil para rendimento quando houve gasto). */
    principalBeforeOutflows: number;
};

export function computeCofrinhoLedgerMonthTotals(
    opts: LedgerNetOpts & { yearMonth: string }
): CofrinhoLedgerMonthTotals {
    const { yearMonth, bucketId } = opts;
    const prev = previousCofrinhoYearMonth(yearMonth);
    const netEnd = computeCofrinhoLedgerNetThroughMonth({ ...opts, throughYearMonth: yearMonth });
    const netStart = prev
        ? computeCofrinhoLedgerNetThroughMonth({ ...opts, throughYearMonth: prev })
        : 0;

    const rows = buildCofrinhoLedgerRows(
        opts.expenses,
        opts.applications,
        opts.buckets,
        opts.accounts,
        ALL_SCOPE,
        opts.tripPayloadOutflows ?? []
    );

    const acctFilter = String(opts.accountId ?? '').trim();
    let inflows = 0;
    let outflows = 0;

    for (const row of rows) {
        if (row.bucketId !== bucketId) continue;
        if (row.yearMonth !== yearMonth) continue;
        if (acctFilter) {
            const rowAcct = resolveLedgerRowAccountId(row, opts.expenses, opts.applications) ?? '';
            if (rowAcct !== acctFilter) continue;
        }
        if (row.kind === 'in') inflows += row.amount;
        else outflows += row.amount;
    }

    inflows = roundMoney(inflows);
    outflows = roundMoney(outflows);

    return {
        inflows,
        outflows,
        netEnd,
        netStart: roundMoney(netStart),
        principalBeforeOutflows: roundMoney(netStart + inflows)
    };
}

/** Saldo líquido do extrato (entradas − saídas) até o fim do mês, alinhado ao extrato de cofrinhos. */
export function computeCofrinhoLedgerNetThroughMonth(opts: {
    bucketId: string;
    throughYearMonth: string;
    accountId?: string;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    accounts: Account[];
    tripPayloadOutflows?: CofrinhoTripPayloadOutflow[];
}): number {
    const {
        bucketId,
        throughYearMonth,
        accountId,
        buckets,
        applications,
        expenses,
        accounts,
        tripPayloadOutflows = []
    } = opts;

    if (!bucketId || !throughYearMonth) return 0;

    const rows = buildCofrinhoLedgerRows(
        expenses,
        applications,
        buckets,
        accounts,
        ALL_SCOPE,
        tripPayloadOutflows
    );

    const acctFilter = String(accountId ?? '').trim();
    let net = 0;

    for (const row of rows) {
        if (row.bucketId !== bucketId) continue;
        if (!rowMatchesThroughMonth(row, throughYearMonth)) continue;

        if (acctFilter) {
            const rowAcct = resolveLedgerRowAccountId(row, expenses, applications) ?? '';
            if (rowAcct !== acctFilter) continue;
        }

        if (row.kind === 'in') net += row.amount;
        else net -= row.amount;
    }

    return Math.round(net * 100) / 100;
}

export type WalletCofrinhoLedgerSummary = {
    accumulated: number;
    withdrawn: number;
    net: number;
    monthAccumulated: number;
    monthWithdrawn: number;
    lastEventAt: string | null;
};

/** Total por conta na Carteira — mesma base do extrato de Cofrinhos (todas as caixinhas). */
export function summarizeWalletCofrinhoFromLedger(opts: {
    ledgerAccountId: string;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    expenses: Movement[];
    accounts: Account[];
    monthlyBalances?: CofrinhoMonthlyBalance[];
    tripPayloadOutflows?: CofrinhoTripPayloadOutflow[];
    year: number;
    monthIndex: number;
}): WalletCofrinhoLedgerSummary {
    const {
        ledgerAccountId,
        buckets,
        applications,
        expenses,
        accounts,
        monthlyBalances = [],
        tripPayloadOutflows = [],
        year,
        monthIndex
    } = opts;

    const monthYm = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const rows = buildCofrinhoLedgerRows(
        expenses,
        applications,
        buckets,
        accounts,
        ALL_SCOPE,
        tripPayloadOutflows
    );
    const target = String(ledgerAccountId ?? '').trim();

    let accumulated = 0;
    let withdrawn = 0;
    let monthAccumulated = 0;
    let monthWithdrawn = 0;
    let lastEventAt: string | null = null;

    for (const row of rows) {
        const rowAcct = resolveLedgerRowAccountId(row, expenses, applications) ?? '';
        if (rowAcct !== target) continue;
        const amt = Number(row.amount) || 0;
        if (row.kind === 'in') {
            accumulated += amt;
            if (row.yearMonth === monthYm) monthAccumulated += amt;
        } else {
            withdrawn += amt;
            if (row.yearMonth === monthYm) monthWithdrawn += amt;
        }
        const iso = String(row.recordDate ?? '').trim().slice(0, 10);
        if (iso && (!lastEventAt || iso > lastEventAt)) lastEventAt = iso;
    }

    const { total: yieldTotal, byMonth: yieldByMonth } = perAccountYieldFromMonthlyBalances(
        monthlyBalances,
        ledgerAccountId
    );
    const monthYield = yieldByMonth.get(monthYm) ?? 0;

    accumulated = roundMoney(accumulated + yieldTotal);
    withdrawn = roundMoney(withdrawn);
    monthAccumulated = roundMoney(monthAccumulated + monthYield);
    monthWithdrawn = roundMoney(monthWithdrawn);

    return {
        accumulated,
        withdrawn,
        net: roundMoney(accumulated - withdrawn),
        monthAccumulated,
        monthWithdrawn,
        lastEventAt
    };
}