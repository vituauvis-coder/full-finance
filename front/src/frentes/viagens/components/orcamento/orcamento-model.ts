import { forecast } from '@motor/viagens/trip-reserve-pace-engine.js';
import { paymentBreakdown, sumCofrinhoSpent } from '@motor/viagens/trip-expense-payment.js';
import {
    financeAportesAsDeposits,
    hasFinanceCofrinhoLines,
    tripCofrinhoTotalsFromFinance
} from '@motor/viagens/trip-cofrinho-finance.js';
import { budgets, expensesSpent, tripExpensesTotal } from '@motor/viagens/trips-engine.js';
import { monthAndYear } from '@motor/viagens/calendar-format.js';
import type { TripDraft } from '../ViagemFicha';
import type { TripFinanceMovementLine, TripPayload } from '../../types';

export type PiggyDeposit = {
    id: string;
    amount: number;
    recordedOn?: string;
    monthKey?: string;
    note?: string;
    authorName?: string;
};

export type OrcamentoCategoryId =
    | 'hospedagem'
    | 'comida'
    | 'transporte'
    | 'voos'
    | 'passeios'
    | 'extras'
    | 'documentos';

/** Ícones Material Symbols — clique na categoria customizada para alternar. */
export const ORCAMENTO_CUSTOM_ICON_CYCLE = [
    'flight_takeoff',
    'flight',
    'connecting_airports',
    'directions_car',
    'directions_bus',
    'train',
    'directions_boat',
    'local_taxi',
    'hiking',
    'restaurant',
    'shopping_bag',
    'folder'
] as const;

export function readBudgetCategoryLabels(payload?: TripPayload | null): Record<string, string> {
    const raw = payload?.budgetCategoryLabels ?? payload?.budget_category_labels;
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(raw)) {
        const label = String(val ?? '').trim();
        if (key && label) out[key] = label;
    }
    return out;
}

export function defaultOrcamentoCategoryLabel(id: string): string {
    return ORCAMENTO_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function orcamentoCategoryLabel(
    payload: TripPayload | undefined | null,
    id: string,
    fallback?: string
): string {
    const custom = payload?.budgetCustomCategories ?? payload?.budget_custom_categories ?? [];
    const customHit = custom.find((c) => c.id === id);
    if (customHit?.label?.trim()) return customHit.label.trim();
    const overrides = readBudgetCategoryLabels(payload);
    const hit = overrides[id]?.trim();
    if (hit) return hit;
    return fallback ?? defaultOrcamentoCategoryLabel(id);
}

export function isBuiltinOrcamentoCategory(id: string): boolean {
    return ORCAMENTO_CATEGORIES.some((c) => c.id === id);
}

export function builtinOrcamentoCategoryIcon(id: string): string | null {
    return ORCAMENTO_CATEGORIES.find((c) => c.id === id)?.icon ?? null;
}

function inferCustomCategoryIcon(cat: { id: string; label?: string | null }): string {
    const hay = `${cat.id} ${cat.label ?? ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    if (/\bvoo|aviao|aereo|flight|airline|passagem|milhas|emiss/.test(hay)) return 'flight_takeoff';
    return 'folder';
}

export function orcamentoCategoryIcon(
    payload: TripPayload | undefined | null,
    categoryId: string
): string {
    const builtin = builtinOrcamentoCategoryIcon(categoryId);
    if (builtin) return builtin;
    const custom = payload?.budgetCustomCategories ?? payload?.budget_custom_categories ?? [];
    const hit = custom.find((c) => c.id === categoryId);
    if (!hit) return inferCustomCategoryIcon({ id: categoryId, label: categoryId });
    const explicit = (hit as { icon?: string }).icon?.trim();
    if (explicit) return explicit;
    return inferCustomCategoryIcon(hit);
}

export function nextCustomCategoryIcon(current: string): string {
    const list = ORCAMENTO_CUSTOM_ICON_CYCLE;
    const idx = list.indexOf(current as (typeof list)[number]);
    const next = idx >= 0 ? (idx + 1) % list.length : 0;
    return list[next] ?? 'folder';
}

export const ORCAMENTO_CATEGORIES: {
    id: OrcamentoCategoryId;
    label: string;
    icon: string;
}[] = [
    { id: 'hospedagem', label: 'Hospedagem', icon: 'apartment' },
    { id: 'comida', label: 'Comida', icon: 'restaurant' },
    { id: 'transporte', label: 'Transportes', icon: 'directions_car' },
    { id: 'voos', label: 'Voos', icon: 'flight_takeoff' },
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

export type TripCofrinhoMeta = {
    aportes: number;
    gastosCofrinho: number;
    rendimento: number;
    remaining: number;
};

export type OrcamentoSnapshotOptions = {
    /** Linhas unificadas do Dinheiro (`listTripFinanceMovements`). */
    financeMovements?: TripFinanceMovementLine[];
    /** Saldo do cofrinho-viagem (aportes + rendimento − gastos). */
    cofrinhoMeta?: TripCofrinhoMeta | null;
};

function mergedDepositsForSnapshot(
    payload: TripPayload,
    financeMovements: TripFinanceMovementLine[] | undefined
): PiggyDeposit[] {
    const fromFinance = financeAportesAsDeposits(financeMovements ?? []);
    if (fromFinance.length > 0) return fromFinance;
    return depositsForForecast(payload);
}

export function buildOrcamentoSnapshot(
    draft: TripDraft,
    now = new Date(),
    opts: OrcamentoSnapshotOptions = {}
) {
    const goal = tripGoal(draft.payload);
    const totalCaps = sumBudgetCaps(draft);
    const effectiveGoal = goal > 0 ? goal : totalCaps;
    const goalFromCaps = goal <= 0 && totalCaps > 0;
    const financeLines = opts.financeMovements ?? [];
    const financeCofrinho = hasFinanceCofrinhoLines(financeLines)
        ? tripCofrinhoTotalsFromFinance(financeLines)
        : null;

    const deposits = mergedDepositsForSnapshot(draft.payload, financeLines);
    const saved = financeCofrinho ? financeCofrinho.aportes : cofrinhoSalvo(draft.payload);
    const tripRef = { payload: draft.payload, budgetCaps: draft.budgetCaps };
    const spentTotal = tripExpensesTotal(tripRef);
    const expensePay = paymentBreakdown(tripRef);
    const meta = opts.cofrinhoMeta;
    const cofrinhoUsed = financeCofrinho
        ? (meta?.gastosCofrinho ?? financeCofrinho.gastosCofrinho)
        : sumCofrinhoSpent(draft.payload.expenses ?? []);
    const cofrinhoRemaining = financeCofrinho
        ? (meta?.remaining ?? financeCofrinho.remaining)
        : Math.max(0, saved - cofrinhoUsed);
    const cofrinhoRendimento = meta?.rendimento ?? 0;
    const cofrinhoAportesTotal =
        financeCofrinho && (meta?.aportes != null || financeCofrinho.aportes > 0)
            ? Math.round(((meta?.aportes ?? financeCofrinho.aportes) + cofrinhoRendimento) * 100) / 100
            : saved;
    const cofrinhoTowardGoal = Math.max(0, cofrinhoRemaining + cofrinhoUsed);
    const stillToSave = Math.max(0, effectiveGoal - cofrinhoTowardGoal);
    const spentVsGoalPct =
        effectiveGoal > 0 ? Math.min(100, Math.round((spentTotal / effectiveGoal) * 100)) : 0;
    const savedPct =
        effectiveGoal > 0 ? Math.min(100, Math.round((cofrinhoTowardGoal / effectiveGoal) * 100)) : 0;

    const pace = forecast({
        goal: effectiveGoal,
        deposits: deposits.length ? deposits : depositsForForecast(draft.payload),
        startsOn: draft.startsOn,
        now
    });

    const categoryRows = ORCAMENTO_CATEGORIES.map((def) => {
        const cap = capAmount(draft, def.id);
        const used = expensesSpent(tripRef, { category: def.id });
        const pay = paymentBreakdown(tripRef, { category: def.id });
        const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        const label = orcamentoCategoryLabel(draft.payload, def.id, def.label);
        return { ...def, label, cap, used, pct, pay };
    });

    const custom = draft.payload.budgetCustomCategories ?? draft.payload.budget_custom_categories ?? [];
    for (const c of custom) {
        const cap = capAmount(draft, c.id);
        const used = expensesSpent(tripRef, { customCategoryId: c.id });
        const pay = paymentBreakdown(tripRef, { customCategoryId: c.id });
        const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
        categoryRows.push({
            id: c.id as OrcamentoCategoryId,
            label: c.label || c.id,
            icon: orcamentoCategoryIcon(draft.payload, c.id),
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
        currentMonthTotal: currentMonthDepositTotal(deposits, pace.currentMonthKey),
        cofrinhoRendimento,
        cofrinhoAportesTotal
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