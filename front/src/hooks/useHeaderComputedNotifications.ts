import { useMemo } from 'react';
import { isCreditCardType } from '../lib/accounts';
import type { Account, FinanceData } from '../lib/types/finance';

export type ComputedNotice = {
    id: string;
    title: string;
    body: string;
    kind: 'computed';
};

/** Avisos derivados dos dados (faturas próximas, cofrinhos vazios) — espelha trechos de `header-notifications.js`. */
export function useHeaderComputedNotifications(data: FinanceData | null | undefined): ComputedNotice[] {
    return useMemo(() => {
        if (!data) return [];
        const out: ComputedNotice[] = [];
        const now = new Date();
        const horizon = new Date(now);
        horizon.setDate(horizon.getDate() + 14);

        for (const acc of data.userAccounts as Account[]) {
            if (!isCreditCardType(acc.type)) continue;
            const dueDay = Number(acc.dueDay) || 0;
            if (dueDay < 1) continue;
            const due = new Date(now.getFullYear(), now.getMonth(), dueDay, 12, 0, 0, 0);
            if (due < now) due.setMonth(due.getMonth() + 1);
            if (due <= horizon) {
                out.push({
                    id: `inv-${acc.id}`,
                    title: 'Fatura em breve',
                    body: `${acc.name} — vencimento ${due.toLocaleDateString('pt-BR')}`,
                    kind: 'computed'
                });
            }
        }

        const buckets = data.cofrinhoBuckets as { id?: string; name?: string; balance?: number }[];
        if (buckets.length === 0) {
            out.push({
                id: 'cofrinho-empty',
                title: 'Cofrinhos',
                body: 'Você ainda não criou caixinhas de alocação.',
                kind: 'computed'
            });
        }

        return out;
    }, [data]);
}