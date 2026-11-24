import { isCreditCardType } from '../../../lib/accounts';
import { expenseListDisplayAmount } from '../../../lib/filterExpensesInPeriod';
import type { Account, Movement } from '../../../lib/types/finance';
import { EXPENSE_COFRINHO_CATEGORY } from './cofrinhoConstants';

export const EXPENSE_INVOICE_ROW_PREFIX = 'invoice::';

export function isExpenseInvoiceRowId(id: string): boolean {
    return id.startsWith(EXPENSE_INVOICE_ROW_PREFIX);
}

export function expenseInvoiceRowId(accountId: string): string {
    return `${EXPENSE_INVOICE_ROW_PREFIX}${accountId}`;
}

/** Linha de cartão na lista do período (compõe a fatura). */
export function isExpenseFaturaLine(
    m: Movement,
    accountById: Map<string, Account>
): boolean {
    const acc = m.accountId ? accountById.get(String(m.accountId)) : undefined;
    return !!(acc && isCreditCardType(acc.type));
}

export function expenseIsMarkedEssential(m: Movement): boolean {
    return (
        m.isFixed === true ||
        m.isFixed === 'true' ||
        m.isFixed === 1 ||
        m.isFixed === '1'
    );
}

export function expenseIsMarkedCofrinho(m: Movement): boolean {
    if (
        m.isCofrinho === true ||
        m.isCofrinho === 'true' ||
        m.isCofrinho === 1 ||
        m.isCofrinho === '1'
    ) {
        return true;
    }
    return String(m.category ?? '').trim() === EXPENSE_COFRINHO_CATEGORY;
}

/**
 * Visões do extrato personalizado.
 * Essenciais: só fora do cartão (no cartão ficam só na fatura).
 * Faturas: todas as linhas de cartão no período.
 * Cofrinhos: lançamentos marcados como reserva/cofrinho.
 * Outras: demais despesas (não essencial, não cartão, não cofrinho).
 */
export function splitExpenseLedgerRows(
    rows: Movement[],
    accountById: Map<string, Account>
): { essential: Movement[]; faturaLines: Movement[]; other: Movement[]; cofrinhos: Movement[] } {
    const essential: Movement[] = [];
    const faturaLines: Movement[] = [];
    const other: Movement[] = [];
    const cofrinhos: Movement[] = [];
    for (const m of rows) {
        if (expenseIsMarkedCofrinho(m)) {
            cofrinhos.push(m);
            continue;
        }
        const onCard = isExpenseFaturaLine(m, accountById);
        const isEssential = expenseIsMarkedEssential(m);
        if (isEssential && !onCard) essential.push(m);
        if (onCard) faturaLines.push(m);
        if (!isEssential && !onCard) other.push(m);
    }
    return { essential, faturaLines, other, cofrinhos };
}

export type ExpenseInvoiceBundle = {
    id: string;
    accountId: string;
    lines: Movement[];
    summary: Movement;
};

export function buildExpenseInvoiceBundles(
    faturaLines: Movement[],
    accountById: Map<string, Account>,
    accountLabel: (id?: string) => string,
    displayDateIso: (m: Movement) => string,
    lineAmount: (m: Movement, account: Account | undefined) => number = (m, account) =>
        expenseListDisplayAmount(m, account)
): ExpenseInvoiceBundle[] {
    const groups = new Map<string, Movement[]>();
    for (const m of faturaLines) {
        const aid = String(m.accountId ?? '');
        if (!aid) continue;
        const bucket = groups.get(aid);
        if (bucket) bucket.push(m);
        else groups.set(aid, [m]);
    }

    const bundles: ExpenseInvoiceBundle[] = [];
    for (const [accountId, lines] of groups) {
        let total = 0;
        let latest = 0;
        let allPaid = true;
        for (const m of lines) {
            const acc = accountById.get(accountId);
            total += lineAmount(m, acc);
            const iso = displayDateIso(m);
            if (!iso) continue;
            const ts = new Date(iso).getTime();
            if (!Number.isNaN(ts) && ts > latest) latest = ts;
            if (m.isPaid === false) allPaid = false;
        }
        const id = expenseInvoiceRowId(accountId);
        const name = accountLabel(accountId);
        bundles.push({
            id,
            accountId,
            lines: [...lines],
            summary: {
                id,
                accountId,
                amount: total,
                description: `Fatura — ${name}`,
                category: 'Cartão de crédito',
                subcategory: `${lines.length} lançamento${lines.length === 1 ? '' : 's'}`,
                isPaid: allPaid,
                date: latest > 0 ? new Date(latest).toISOString() : undefined
            }
        });
    }

    bundles.sort((a, b) => (Number(b.summary.amount) || 0) - (Number(a.summary.amount) || 0));
    return bundles;
}