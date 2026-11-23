import { useCallback } from 'react';
import { useConfirm } from '../../../components/ui/confirm';
import {
    deleteCofrinhoApplication,
    deleteCofrinhoMonthlyBalance,
    deleteCofrinhoMonthlyBalanceMonth
} from '../api/cofrinhos';
import { yearMonthToReferenceMonth } from '../domain/cofrinhoPeriod';

export function useCofrinhosApplicationActions(refresh: () => Promise<void>) {
    const { confirm } = useConfirm();

    const deleteApplication = useCallback(
        async (id: string) => {
            const ok = await confirm({
                title: 'Excluir aporte?',
                message: 'O aporte será removido e o pool pode ser recalculado.',
                confirmLabel: 'Excluir',
                tone: 'danger'
            });
            if (!ok) return;
            await deleteCofrinhoApplication(id);
            await refresh();
        },
        [confirm, refresh]
    );

    const deleteMonthlyBalance = useCallback(
        async (id: string) => {
            const ok = await confirm({
                title: 'Excluir reconciliação?',
                message: 'O rendimento calculado para aquele mês será removido do extrato e do gráfico.',
                confirmLabel: 'Excluir',
                tone: 'danger'
            });
            if (!ok) return;
            await deleteCofrinhoMonthlyBalance(id);
            await refresh();
        },
        [confirm, refresh]
    );

    const deleteMonthlyBalanceMonth = useCallback(
        async (bucketId: string, yearMonth: string) => {
            const ref = yearMonthToReferenceMonth(yearMonth);
            if (!ref) return;
            const ok = await confirm({
                title: 'Excluir rendimento do mês?',
                message: 'Remove os saldos registrados de todas as contas neste mês.',
                confirmLabel: 'Excluir',
                tone: 'danger'
            });
            if (!ok) return;
            await deleteCofrinhoMonthlyBalanceMonth(bucketId, ref);
            await refresh();
        },
        [confirm, refresh]
    );

    return { deleteApplication, deleteMonthlyBalance, deleteMonthlyBalanceMonth };
}