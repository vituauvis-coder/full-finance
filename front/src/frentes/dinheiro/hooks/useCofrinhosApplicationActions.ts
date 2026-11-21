import { useCallback } from 'react';
import { useConfirm } from '../../../components/ui/confirm';
import { deleteCofrinhoApplication } from '../api/cofrinhos';

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

    return { deleteApplication };
}