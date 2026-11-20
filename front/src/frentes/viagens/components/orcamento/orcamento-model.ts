import { forecast } from '@motor/viagens/trip-reserve-pace-engine.js';
import { paymentBreakdown, sumCofrinhoSpent } from '@motor/viagens/trip-expense-payment.js';
import { budgets, spent, tripTotal } from '@motor/viagens/trips-engine.js';
import { monthAndYear } from '@motor/viagens/calendar-format.js';
import type { TripDraft } from '../ViagemFicha';
import type { TripPayload } from '../../types';

export type PiggyDeposit = {
    id: string;
    amount: number;
    recordedOn?: string;
    monthKey?: string;
    note?: string;
};

export type OrcamentoCategoryId =
    | 'hospedagem'
    | 'comida'
    | 'transporte'
    | 'passeios'
    | 'extras'
    | 'documentos';

export const ORCAMENTO_CATEGORIES: {
    id: OrcamentoCategoryId;
    label: string;
    icon: string;
}[] = [
    { id: 'hospedagem', label: 'Hospedagem', icon: 'apartment' },
    { id: 'comida', label: 'Comida', icon: 'restaurant' },
    { id: 'transporte', label: 'Voos', icon: 'flight' },
    { id: 'passeios', label: 'Passeios', icon: 'local_activity' },
    { id: 'extras', label: 'Extras', icon: 'shopping_bag' },
    { id: 'documentos', label: 'Documentos', icon: 'description' }
];

export function tripGoal(payload: TripPayload): number {
    return Number(payload.tripGoal ?? payload.trip_goal ?? 0) || 0;
}

export function readDeposits(payload: TripPayload): PiggyDeposit[] {
    const raw = payload.piggyDeposits ?? payload.piggy_deposits;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((d) => ({
            id: String(d.id ?? ''),
            amount: Number(d.amount ?? 0) || 0,
            recordedOn: d.recordedOn ?? d.recorded_on,
            monthKey: d.monthKey ?? d.month_key,
            note: d.note
        }))
        .filter((d) => d.id);
}

function legacyPiggy(payload: TripPayload): number {
    return Number(payload.piggyBank ?? payload.piggy_bank ?? 0) || 0;
}

export function cofrinhoSalvo(payload: TripPayload): number {
    const deposits = readDeposits(payload);
    if (deposits.length) return deposits.reduce((p, d) => p + Math.max(d.amount, 0), 0);
    return legacyPiggy(payload);
}

export function depositsForForecast(payload: TripPayload): PiggyDeposit[] {
    const deposits = readDeposits(payload);
    const saved = cofrinhoSalvo(payload);
    if (deposits.length) return deposits;
    if (saved <= 0) return [];
    return [
        {
            id: 'legacy-piggy',
            amount: saved,
            recordedOn: new Date().toISOString().slice(0, 10)
        }
    ];
}

export function monthShortPt(monthKey: string): string {
    const parts = monthKey.split('-');
    if (parts.length < 2) return monthKey;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return d
        .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' })
        .replace(/\./g, '')
        .replace(/^\w/, (c) => c.toUpperCase());
}

export function depositsByMonthKey(deposits: PiggyDeposit[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const d of deposits) {
        const key = d.monthKey ?? (d.recordedOn?.trim().slice(0, 7) || '');
        if (!key) continue;
        out[key] = (out[key] ?? 0) + Math.max(0, Number(d.amount) || 0);
    }
    return out;
}

export function currentMonthDepositTotal(deposits: PiggyDeposit[], currentMonthKey: string): number {
    return deposits
        .filter((d) => {
            const key =
                d.monthKey ??
                (d.recordedOn?.trim().slice(0, 7) || null);
            return key === currentMonthKey;
        })
        .reduce((p, d) => p + Math.max(d.amount, 0), 0);
}

function capAmount(draft: TripDraft, id: string): number {
    const raw = draft.budgetCaps?.[id];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumBudgetCaps(draft: TripDraft): number {
    let total = 0;
    for (const def of ORCAMENTO_CATEGORIES) {
        total += capAmount(draft, def.id);
    }
    const custom = draft.payload.budgetCustomCategories ?? draft.payload.budget_custom_categories ?? [];
    for (const c of custom) {
        total += capAmount(draft, c.id);
    }
    return total;
}

export function buildOrcamentoSnapshot(draft: TripDraft, now = new Date()) {
    const goal = tripGoal(draft.payload);
    const totalCaps = sumBudgetCaps(draft);
    const effectiveGoal = goal > 0 ? goal : totalCaps;
    const goalFromCaps = goal <= 0 && totalCaps > 0;
    const deposits = readDeposits(draft.payload);
    const saved = cofrinhoSalvo(draft.payload);
    const tripRef = { payload: draft.payload, budgetCaps: draft.budgetCaps };
    const spentTotal = tripTotal(tripRef);
    const expensePay = paymentBreakdown(tripRef);
    const cofrinhoUsed = sumCofrinhoSpent(draft.payload.expenses ?? []);
    const cofrinhoRemaining = Math.max(0, saved - cofrinhoUsed);
    const stillToSave = Math.max(0, effectiveGoal - saved);
    const spentVsGoalPct =
        effectiveGoal > 0 ? Math.min(100, Math.round((spentTotal / effectiveGoal) * 100)) : 0;
    const savedPct = effectiveGoal > 0 ? Math.min(100, Math.round((saved / effectiveGoal) * 100)) : 0;

    const pace = forecast({
        goal: effectiveGoal,
        deposits: depositsForForecast(draft.payload),
        startsOn: draft.startsOn,
        now
    });

    const categoryRows = ORCAMENTO_CATEGORIES.map((def) => {
        const cap = capAmount(draft, def.id);
        const used = spent(tripRef, { category: def.id });
        const pay = paymentBreakdown(tripRef, { category: def.id });
        const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        return { ...def, cap, used, pct, pay };
    });

    const custom = draft.payload.budgetCustomCategories ?? draft.payload.budget_custom_categories ?? [];
    for (const c of custom) {
        const cap = capAmount(draft, c.id);
        const used = spent(tripRef, { customCategoryId: c.id });
        const pay = paymentBreakdown(tripRef, { customCategoryId: c.id });
        const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        categoryRows.push({
            id: c.id as OrcamentoCategoryId,
            label: c.label || c.id,
            icon: 'folder',
            cap,
            used,
            pct,
            pay
        });
    }

    categoryRows.sort((a, b) => b.used - a.used || a.label.localeCompare(b.label, 'pt-BR'));

    const engineRows = budgets({ payload: draft.payload, budgetCaps: draft.budgetCaps });

    return {
        goal,
        totalCaps,
        effectiveGoal,
        goalFromCaps,
        saved,
        cofrinhoUsed,
        cofrinhoRemaining,
        stillToSave,
        spentTotal,
        expensePay,
        spentVsGoalPct,
        savedPct,
        deposits,
        depositCount: deposits.length,
        pace,
        categoryRows,
        engineRows,
        monthsLeftLabel:
            pace.monthsLeft > 0
                ? `${pace.monthsLeft}${pace.monthsLeft === 1 ? '' : ''}`
                : pace.tripMonthKey
                  ? '0'
                  : '—',
        tripMonthLabel: pace.tripMonthKey ? monthAndYear(pace.tripMonthKey) : '',
        monthlyNeed: pace.monthlyNeed,
        currentMonthTotal: currentMonthDepositTotal(deposits, pace.currentMonthKey)
    };
}

export function patchDeposits(
    draft: TripDraft,
    next: PiggyDeposit[]
): TripDraft {
    const sum = next.reduce((p, d) => p + Math.max(d.amount, 0), 0);
    return {
        ...draft,
        payload: {
            ...draft.payload,
            piggyDeposits: next,
            piggy_deposits: next,
            piggyBank: sum,
            piggy_bank: sum
        }
    };
}