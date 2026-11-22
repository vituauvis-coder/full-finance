import type { Account, Movement } from '../../../lib/types/finance';
import { isGainEstornoRow } from '../../dinheiro/domain/gainEstorno';
import {
    expenseIsMarkedCofrinho,
    expenseIsMarkedEssential,
    isExpenseFaturaLine
} from '../../dinheiro/domain/expenseLedgerBuckets';
import type { DayDetailItem } from '../types/cashHeatmap';
import {
    ENTRADA_MATERIAL_ICON,
    ESTORNO_MATERIAL_ICON,
    RATEIO_MATERIAL_ICON
} from './movementVisualTokens';

export type LedgerVisualBucket =
    | 'entrada'
    | 'estorno'
    | 'rateio'
    | 'fatura'
    | 'fixa'
    | 'extra'
    | 'cofrinhos';

export const LEDGER_BUCKET_ICONS: Record<LedgerVisualBucket, string> = {
    entrada: ENTRADA_MATERIAL_ICON,
    estorno: ESTORNO_MATERIAL_ICON,
    rateio: RATEIO_MATERIAL_ICON,
    fatura: 'credit_card',
    fixa: 'event_repeat',
    extra: 'local_mall',
    cofrinhos: 'savings'
};

export const LEDGER_BUCKET_LABELS: Record<LedgerVisualBucket, string> = {
    entrada: 'Entradas',
    estorno: 'Estorno',
    rateio: 'Compartilhamento',
    fatura: 'Faturas',
    fixa: 'Despesas fixas',
    extra: 'Despesas extras',
    cofrinhos: 'Cofrinhos'
};

/** Ordem dos ícones na faixa de filtro do extrato. */
export const LEDGER_FILTER_ORDER: LedgerVisualBucket[] = [
    'entrada',
    'estorno',
    'rateio',
    'fixa',
    'fatura',
    'extra',
    'cofrinhos'
];

function bareLedgerId(itemId: string): string {
    const raw = itemId.includes(':') ? itemId.split(':').slice(1).join(':') : itemId;
    return raw;
}

function expenseByItemId(itemId: string, expenses: Movement[]): Movement | undefined {
    const bare = bareLedgerId(itemId);
    if (!bare.startsWith('exp-')) return undefined;
    const id = bare.slice(4);
    return expenses.find((e) => String(e.id) === id);
}

function gainByItemId(itemId: string, gains: Movement[]): Movement | undefined {
    const bare = bareLedgerId(itemId);
    if (!bare.startsWith('gain-')) return undefined;
    const id = bare.slice(5);
    return gains.find((g) => String(g.id) === id);
}

export function resolveLedgerVisualBucket(
    item: DayDetailItem,
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[]
): LedgerVisualBucket {
    if (item.kind === 'rateio' || item.rateioPendente) return 'rateio';
    if (item.kind === 'invoice') return 'fatura';

    const accountById = new Map(accounts.map((a) => [String(a.id), a]));

    if (item.kind === 'gain') {
        const g = gainByItemId(item.id, gains);
        if (g && isGainEstornoRow(g)) return 'estorno';
        return 'entrada';
    }

    const exp = expenseByItemId(item.id, expenses);
    if (!exp) return 'extra';

    if (expenseIsMarkedCofrinho(exp)) return 'cofrinhos';
    if (isExpenseFaturaLine(exp, accountById)) return 'fatura';
    if (expenseIsMarkedEssential(exp)) return 'fixa';
    return 'extra';
}

export function enrichLedgerItems(
    items: DayDetailItem[],
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[]
): Array<DayDetailItem & { bucket: LedgerVisualBucket }> {
    return items.map((item) => ({
        ...item,
        bucket: resolveLedgerVisualBucket(item, expenses, gains, accounts)
    }));
}

export function ledgerBucketIcon(
    bucket: LedgerVisualBucket,
    pending: boolean,
    kind: DayDetailItem['kind']
) {
    if (bucket === 'estorno') return ESTORNO_MATERIAL_ICON;
    if (bucket === 'rateio') return RATEIO_MATERIAL_ICON;
    if (pending && kind === 'expense') return 'schedule';
    return LEDGER_BUCKET_ICONS[bucket];
}