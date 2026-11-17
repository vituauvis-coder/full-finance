import type { Movement } from '../../../lib/types/finance';

/** Totais recebido/pendente ou pago/pendente no conjunto já filtrado. */
export function movementListPaidTotals(rows: Movement[]) {
    let paid = 0;
    let unpaid = 0;
    for (const row of rows) {
        const amt = Number(row.amount) || 0;
        if (row.isPaid === false) unpaid += amt;
        else paid += amt;
    }
    return { paid, unpaid };
}