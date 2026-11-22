import type { Movement } from '../../../lib/types/finance';
import type { CofrinhoApplication } from './cofrinhoAggregations';
import type { CofrinhoLedgerRow } from './cofrinhoLedgerRows';
import { referenceMonthToYearMonth } from './cofrinhoPeriod';

function applicationAllocatedExpenseId(app: CofrinhoApplication): string {
    const raw = app as CofrinhoApplication & {
        allocatedExpenseId?: string;
        allocated_expense_id?: string;
    };
    const id = raw.allocatedExpenseId ?? raw.allocated_expense_id;
    return id ? String(id) : '';
}

export function ledgerEditReferenceYm(row: CofrinhoLedgerRow, applications: CofrinhoApplication[]): string {
    if (row.yearMonth?.match(/^\d{4}-\d{2}$/)) return row.yearMonth;
    if (row.applicationId) {
        const app = applications.find((a) => String(a.id) === String(row.applicationId));
        if (app) {
            const ym = referenceMonthToYearMonth(app.referenceMonth);
            if (ym?.match(/^\d{4}-\d{2}$/)) return ym;
        }
    }
    const fromRecord = row.recordDate?.slice(0, 7);
    return fromRecord?.match(/^\d{4}-\d{2}$/) ? fromRecord : '';
}

export function ledgerEditDescription(
    row: CofrinhoLedgerRow,
    applications: CofrinhoApplication[],
    expenses: Movement[]
): string {
    if (row.applicationId) {
        const app = applications.find((a) => String(a.id) === String(row.applicationId));
        if (app) {
            const allocId = applicationAllocatedExpenseId(app);
            if (allocId) {
                const exp = expenses.find((e) => String(e.id) === allocId);
                const text = String(exp?.description ?? '').trim();
                if (text) return text;
            }
        }
    }
    return row.title;
}