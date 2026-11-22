import { buildSyntheticExpectedSplitGainsRows } from '@motor/dinheiro/expected-split-gain-rows.js';
import { buildPendingCashOutItems } from '@legacy/js/features/finance/pending-cash-outs.js';
import { isCreditCardType } from '../../../lib/accounts';
import {
    expenseCashOutPeriodKey,
    expenseRowAppearsPaid,
    expenseRowCanConfirmCashOut,
    type ExpenseListPeriod
} from '../../../lib/expenseRowCashOut';
import { movementDate } from '../../../lib/period';
import type { Account, ExpenseSplitRequest, Movement, SplitBundle, UserProfile } from '../../../lib/types/finance';
import type { PendingCashOutItem } from '../types/pendingCashOut';
import type { DayDetailItem } from '../types/cashHeatmap';
import { isExpenseFaturaLine } from '../../dinheiro/domain/expenseLedgerBuckets';
import { gainEstornoAppearsInLists } from '../../dinheiro/domain/gainEstorno';
import { resolveLedgerVisualBucket } from './ledgerItemVisual';
import type { LedgerItem } from './monthLedger';

export type LedgerCashOutConfirm = {
    expenseId: string;
    periodKey: string;
};

export type LedgerCashOutPaySlot = 'todo' | 'done' | 'none';

export type EnrichedLedgerItem = LedgerItem & {
    cashOutConfirm?: LedgerCashOutConfirm;
    estornoExpectativa?: boolean;
    cashOutPaySlot?: LedgerCashOutPaySlot;
};

type GainWithSynthetic = Movement & { __syntheticExpectedSplit?: boolean; __splitRequestId?: string };

function bareId(itemId: string): string {
    return itemId.includes(':') ? itemId.split(':').slice(1).join(':') : itemId;
}

function expenseFromLedgerId(itemId: string, expenses: Movement[]): Movement | undefined {
    const bare = bareId(itemId);
    if (!bare.startsWith('exp-')) return undefined;
    const id = bare.slice(4);
    return expenses.find((e) => String(e.id) === id);
}

function gainFromLedgerId(itemId: string, gains: Movement[]): Movement | undefined {
    const bare = bareId(itemId);
    if (!bare.startsWith('gain-')) return undefined;
    const id = bare.slice(5);
    return gains.find((g) => String(g.id) === id);
}

/** Dia civil (1–31) para uma chave YYYY-MM-DD ou YYYY-MM no mês filtrado. */
export function ledgerListPeriod(year: number, monthIndex: number, filterDay?: number | null): ExpenseListPeriod {
    if (filterDay != null) {
        return {
            startDate: new Date(year, monthIndex, filterDay, 0, 0, 0, 0),
            endDate: new Date(year, monthIndex, filterDay, 23, 59, 59, 999)
        };
    }
    return {
        startDate: new Date(year, monthIndex, 1, 0, 0, 0, 0),
        endDate: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
    };
}

function periodKeyInMonth(periodKey: string, year: number, monthIndex: number): boolean {
    const s = String(periodKey ?? '').trim();
    const m = s.match(/^(\d{4})-(\d{1,2})/);
    if (!m) return false;
    return Number(m[1]) === year && Number(m[2]) - 1 === monthIndex;
}

function ledgerDayFromPeriodKey(
    periodKey: string,
    year: number,
    monthIndex: number,
    expense?: Movement
): number | null {
    const dayMatch = String(periodKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
        const y = Number(dayMatch[1]);
        const m = Number(dayMatch[2]) - 1;
        const d = Number(dayMatch[3]);
        if (y === year && m === monthIndex) return d;
        return null;
    }
    const monthMatch = String(periodKey).match(/^(\d{4})-(\d{1,2})$/);
    if (monthMatch) {
        const y = Number(monthMatch[1]);
        const m = Number(monthMatch[2]) - 1;
        if (y !== year || m !== monthIndex) return null;
        if (expense) {
            const dt = movementDate(expense);
            if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === year && dt.getMonth() === monthIndex) {
                return dt.getDate();
            }
        }
        return 1;
    }
    return null;
}

function shouldShowGainInLedger(g: Movement): boolean {
    return gainEstornoAppearsInLists(g);
}

function isPendingSplitRequest(s: ExpenseSplitRequest): boolean {
    return String(s.status ?? '').toUpperCase() === 'PENDING';
}

function rateioLedgerDay(
    s: ExpenseSplitRequest,
    expenses: Movement[],
    year: number,
    monthIndex: number
): number | null {
    const src =
        s.sourceExpense ??
        (s.sourceExpenseId ? expenses.find((e) => String(e.id) === String(s.sourceExpenseId)) : undefined);
    if (!src) return null;
    const d = movementDate(src);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) return null;
    return d.getDate();
}

function appendRateioPendenteItems(
    out: EnrichedLedgerItem[],
    splitBundle: SplitBundle | undefined,
    expenses: Movement[],
    accounts: Account[],
    year: number,
    monthIndex: number,
    filterDay?: number | null
) {
  const accountById = new Map(accounts.map((a) => [String(a.id), a]));
  const seen = new Set<string>();

  const push = (s: ExpenseSplitRequest, direction: 'incoming' | 'outgoing') => {
        if (!isPendingSplitRequest(s)) return;
        const day = rateioLedgerDay(s, expenses, year, monthIndex);
        if (day == null) return;
        if (filterDay != null && day !== filterDay) return;
        if (seen.has(s.id)) return;
        seen.add(s.id);

        const src =
            s.sourceExpense ??
            (s.sourceExpenseId
                ? expenses.find((e) => String(e.id) === String(s.sourceExpenseId))
                : undefined);
        const desc = String(src?.description ?? 'Despesa').trim() || 'Despesa';
        const who =
            direction === 'incoming'
                ? s.requester?.name || s.requester?.email || 'Quem divide'
                : s.recipient?.name || s.recipient?.email || 'Destinatário';
        const acc = src?.accountId ? accountById.get(String(src.accountId)) : undefined;

        out.push({
            id: `${day}:rateio-${s.id}`,
            day,
            kind: 'rateio',
            title:
                direction === 'incoming'
                    ? `Recebido · ${who} · ${desc}`
                    : `Enviado · ${who} · ${desc}`,
            amount: Number(s.amount) || 0,
            bank: acc?.name ?? '—',
            tag: direction === 'incoming' ? 'Compartilhamento · aceitar em Saídas' : 'Compartilhamento · aguardando',
            status: 'Pendente',
            pending: true,
            rateioPendente: true,
            rateioDirection: direction,
            bucket: 'rateio'
        });
    };

    for (const s of splitBundle?.incoming ?? []) push(s, 'incoming');
    for (const s of splitBundle?.outgoing ?? []) push(s, 'outgoing');
}

function resolveLedgerCashOutPaySlot(
    item: EnrichedLedgerItem,
    expenses: Movement[],
    accounts: Account[],
    userProfile: UserProfile | null | undefined,
    year: number,
    monthIndex: number,
    filterDay?: number | null
): LedgerCashOutPaySlot {
    try {
        if (item.cashOutConfirm) return 'todo';
        const listPeriod = ledgerListPeriod(year, monthIndex, filterDay);
        const now = new Date();
        const accountById = new Map(accounts.map((a) => [String(a.id), a]));

        if (item.kind === 'expense') {
            const exp = expenseFromLedgerId(item.id, expenses);
            if (!exp) return 'none';
            const acc = accountById.get(String(exp.accountId));
            if (!acc) return 'none';
            if (expenseRowAppearsPaid(exp, acc, userProfile, listPeriod, now)) return 'done';
            return 'none';
        }

        if (item.kind === 'invoice') {
            return 'done';
        }
    } catch (err) {
        console.error('resolveLedgerCashOutPaySlot', err);
    }
    return 'none';
}

export function listPendingCashOutForProfile(
    accounts: Account[],
    expenses: Movement[],
    userProfile: UserProfile | null | undefined
): PendingCashOutItem[] {
    return buildPendingCashOutItems(accounts, expenses, userProfile, new Date()) as PendingCashOutItem[];
}

export function enrichLedgerExtratoItemsForYear(params: {
    items: LedgerItem[];
    expenses: Movement[];
    gains: Movement[];
    accounts: Account[];
    userProfile: UserProfile | null | undefined;
    splitBundle?: SplitBundle;
    year: number;
}): EnrichedLedgerItem[] {
    const byMonth = new Map<number, LedgerItem[]>();
    for (const it of params.items) {
        const mi = it.monthIndex ?? 0;
        const list = byMonth.get(mi) ?? [];
        list.push(it);
        byMonth.set(mi, list);
    }
    const out: EnrichedLedgerItem[] = [];
    for (let mi = 0; mi < 12; mi++) {
        const chunk = byMonth.get(mi);
        if (!chunk?.length) continue;
        out.push(
            ...enrichLedgerExtratoItems({
                ...params,
                items: chunk,
                monthIndex: mi,
                filterDay: null
            })
        );
    }
    out.sort((a, b) => {
        const am = a.monthIndex ?? 0;
        const bm = b.monthIndex ?? 0;
        if (am !== bm) return bm - am;
        if (a.day !== b.day) return b.day - a.day;
        return b.amount - a.amount;
    });
    return out;
}

export function enrichLedgerExtratoItems(params: {
    items: LedgerItem[];
    expenses: Movement[];
    gains: Movement[];
    accounts: Account[];
    userProfile: UserProfile | null | undefined;
    splitBundle?: SplitBundle;
    year: number;
    monthIndex: number;
    filterDay?: number | null;
}): EnrichedLedgerItem[] {
    try {
        return enrichLedgerExtratoItemsCore(params);
    } catch (err) {
        console.error('enrichLedgerExtratoItems', err);
        return params.items.map((it) => ({ ...it, cashOutPaySlot: 'none' as const }));
    }
}

function enrichLedgerExtratoItemsCore(params: {
    items: LedgerItem[];
    expenses: Movement[];
    gains: Movement[];
    accounts: Account[];
    userProfile: UserProfile | null | undefined;
    splitBundle?: SplitBundle;
    year: number;
    monthIndex: number;
    filterDay?: number | null;
}): EnrichedLedgerItem[] {
    const { expenses, gains, accounts, userProfile, splitBundle, year, monthIndex, filterDay } = params;
    const accountById = new Map(accounts.map((a) => [String(a.id), a]));
    const expenseById = new Map(expenses.map((e) => [String(e.id), e]));
    let pending: PendingCashOutItem[] = [];
    try {
        pending = listPendingCashOutForProfile(accounts, expenses, userProfile);
    } catch (err) {
        console.error('listPendingCashOutForProfile', err);
    }

    const pendingInMonth = pending.filter((p) => periodKeyInMonth(p.periodKey, year, monthIndex));
    const pendingByExpenseId = new Map<string, PendingCashOutItem[]>();
    for (const p of pendingInMonth) {
        const id = String(p.expenseId);
        const list = pendingByExpenseId.get(id) ?? [];
        list.push(p);
        pendingByExpenseId.set(id, list);
    }

    const filteredBase = params.items.filter((item) => {
        if (item.kind !== 'gain') return true;
        const g = gainFromLedgerId(item.id, gains);
        if (!g) return true;
        return shouldShowGainInLedger(g);
    });

    const out: EnrichedLedgerItem[] = filteredBase.map((it) => ({ ...it }));

    const attached = new Set<string>();

    for (const item of out) {
        if (item.kind !== 'expense' && item.kind !== 'invoice') continue;
        const exp =
            item.kind === 'expense' ? expenseFromLedgerId(item.id, expenses) : undefined;
        if (item.kind === 'expense' && !exp) continue;
        if (filterDay != null && item.day !== filterDay) continue;

        const matchPending = (p: PendingCashOutItem, expPending: Movement) => {
            const dueDay = ledgerDayFromPeriodKey(p.periodKey, year, monthIndex, expPending);
            if (dueDay == null) return null;
            if (filterDay != null && dueDay !== filterDay) return null;
            return dueDay;
        };

        if (item.kind === 'expense') {
            const plist = pendingByExpenseId.get(String(exp!.id)) ?? [];
            for (const p of plist) {
                const expPending = expenseById.get(String(p.expenseId));
                if (!expPending) continue;
                if (matchPending(p, expPending) == null) continue;
                item.cashOutConfirm = { expenseId: p.expenseId, periodKey: p.periodKey };
                item.pending = true;
                item.status = 'Confirmar pagamento';
                attached.add(`${p.expenseId}:${p.periodKey}`);
                break;
            }
        } else if (item.kind === 'invoice') {
            const bare = bareId(item.id);
            const cardId = bare.startsWith('inv-') ? bare.slice(4) : '';
            if (!cardId) continue;
            for (const p of pendingInMonth) {
                const expPending = expenseById.get(String(p.expenseId));
                if (!expPending) continue;
                if (!isExpenseFaturaLine(expPending, accountById)) continue;
                const card = accountById.get(String(expPending.accountId));
                if (!card || String(card.id) !== cardId) continue;
                if (matchPending(p, expPending) == null) continue;
                item.cashOutConfirm = { expenseId: p.expenseId, periodKey: p.periodKey };
                item.pending = true;
                item.status = 'Confirmar pagamento';
                attached.add(`${p.expenseId}:${p.periodKey}`);
                break;
            }
        }
    }

    for (const p of pendingInMonth) {
        const key = `${p.expenseId}:${p.periodKey}`;
        if (attached.has(key)) continue;
        const exp = expenseById.get(String(p.expenseId));
        if (!exp) continue;

        const day = ledgerDayFromPeriodKey(p.periodKey, year, monthIndex, exp);
        if (day == null) continue;
        if (filterDay != null && day !== filterDay) continue;

        const draft: DayDetailItem = {
            id: `exp-${exp.id}`,
            kind: 'expense',
            title: p.title,
            amount: p.amount,
            bank: accountById.get(String(exp.accountId))?.name ?? '—',
            tag: p.detail,
            status: 'Confirmar pagamento',
            pending: true
        };
        const bucket = resolveLedgerVisualBucket(draft, expenses, gains, accounts);

        out.push({
            ...draft,
            id: `${day}:cashout-${key}`,
            day,
            bucket,
            cashOutConfirm: { expenseId: p.expenseId, periodKey: p.periodKey }
        });
        attached.add(key);
    }

    const listPeriod = ledgerListPeriod(year, monthIndex, filterDay);
    const now = new Date();
    for (const item of out) {
        if (item.cashOutConfirm) continue;
        if (item.kind !== 'expense') continue;
        if (filterDay != null && item.day !== filterDay) continue;
        const exp = expenseFromLedgerId(item.id, expenses);
        if (!exp) continue;
        const acc = accountById.get(String(exp.accountId));
        if (!acc || isCreditCardType(acc.type)) continue;
        try {
            if (!expenseRowCanConfirmCashOut(exp, acc, userProfile, listPeriod, now)) continue;
            item.cashOutConfirm = {
                expenseId: String(exp.id),
                periodKey: expenseCashOutPeriodKey(exp, acc, userProfile, listPeriod, now)
            };
            item.pending = true;
            item.status = 'Confirmar pagamento';
            attached.add(`${item.cashOutConfirm.expenseId}:${item.cashOutConfirm.periodKey}`);
        } catch (err) {
            console.error('cashOutConfirm attach', item.id, err);
        }
    }

    const period = `month-${monthIndex}`;
    const synthetic = buildSyntheticExpectedSplitGainsRows(
        period,
        new Date(),
        expenses,
        accounts,
        splitBundle?.outgoing ?? [],
        gains,
        year
    ) as GainWithSynthetic[];

    for (const g of synthetic) {
        const d = movementDate(g);
        if (Number.isNaN(d.getTime())) continue;
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const day = d.getDate();
        if (filterDay != null && day !== filterDay) continue;

        const splitId = g.__splitRequestId ?? g.id;
        const descRaw = String(g.description ?? '').replace(/^expectativa de estorno\s*[—-]\s*/i, '').trim();
        out.push({
            id: `${day}:estorno-pend-${splitId}`,
            day,
            kind: 'gain',
            title: descRaw ? `Estorno previsto · ${descRaw}` : 'Estorno previsto',
            amount: Number(g.amount) || 0,
            bank: accountById.get(String(g.accountId))?.name ?? '—',
            tag: 'Estorno · confirmar pagamento da saída',
            status: 'Pendente',
            pending: true,
            estornoExpectativa: true,
            bucket: 'estorno'
        });
    }

    appendRateioPendenteItems(out, splitBundle, expenses, accounts, year, monthIndex, filterDay);

    for (const item of out) {
        item.cashOutPaySlot = resolveLedgerCashOutPaySlot(
            item,
            expenses,
            accounts,
            userProfile,
            year,
            monthIndex,
            filterDay
        );
    }

    if (filterDay != null) {
        out.sort((a, b) => b.amount - a.amount);
    } else {
        out.sort((a, b) => b.day - a.day || b.amount - a.amount);
    }

    return out;
}