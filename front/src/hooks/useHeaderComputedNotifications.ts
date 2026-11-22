import { useMemo } from 'react';
import { buildSyntheticExpectedSplitGainsRows } from '@motor/dinheiro/expected-split-gain-rows.js';
import { isCreditCardType } from '../lib/accounts';
import { monthIndexFromPeriod } from '../lib/period';
import { listPendingCashOutForProfile } from '../frentes/dashboard/domain/ledgerExtratoEnrichment';
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

        const pendingPay = listPendingCashOutForProfile(
            data.userAccounts,
            data.userExpenses,
            data.userProfile
        );
        if (pendingPay.length > 0) {
            const n = pendingPay.length;
            out.push({
                id: 'cash-out-pending',
                title: n === 1 ? 'Pagamento a confirmar' : `${n} pagamentos a confirmar`,
                body: 'Confirme no extrato do painel — ícone de check na linha do lançamento.',
                kind: 'computed'
            });
        }

        const mi = monthIndexFromPeriod('month-current');
        const year = now.getFullYear();
        const estornoPending = buildSyntheticExpectedSplitGainsRows(
            `month-${mi}`,
            now,
            data.userExpenses,
            data.userAccounts,
            data.expenseSplitRequests?.outgoing ?? [],
            data.userGains,
            year
        );
        const incomingRateio = (data.expenseSplitRequests?.incoming ?? []).filter(
            (s) => String(s.status ?? '').toUpperCase() === 'PENDING'
        );
        const outgoingRateio = (data.expenseSplitRequests?.outgoing ?? []).filter(
            (s) => String(s.status ?? '').toUpperCase() === 'PENDING'
        );
        if (incomingRateio.length > 0) {
            const n = incomingRateio.length;
            out.push({
                id: 'rateio-incoming',
                title: n === 1 ? 'Compartilhamento recebido' : `${n} compartilhamentos recebidos`,
                body: 'Pedido de rateio — não é estorno. Veja no extrato (ícone de aperto de mão) ou em Saídas.',
                kind: 'computed'
            });
        }
        if (outgoingRateio.length > 0) {
            const n = outgoingRateio.length;
            out.push({
                id: 'rateio-outgoing',
                title: n === 1 ? 'Compartilhamento enviado' : `${n} compartilhamentos enviados`,
                body: 'Aguardando resposta do outro usuário.',
                kind: 'computed'
            });
        }

        if (estornoPending.length > 0) {
            out.push({
                id: 'estorno-expectativa',
                title:
                    estornoPending.length === 1
                        ? 'Estorno previsto'
                        : `${estornoPending.length} estornos previstos`,
                body: 'Depois do rateio aceito — filtro «Estorno» no extrato (ícone de estorno).',
                kind: 'computed'
            });
        }

        return out;
    }, [data]);
}