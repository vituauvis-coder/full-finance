import { useCallback, useState } from 'react';
import { playPingSound } from '../app/uiSounds';
import type { Movement } from '../lib/types/finance';

export function useMovementStatusToggle(
    patchOne: (id: string, isPaid: boolean) => Promise<void>,
    refresh: () => Promise<void>
) {
    const [busy, setBusy] = useState<Set<string>>(() => new Set());

    const onToggleStatus = useCallback(
        async (m: Movement) => {
            if (busy.has(m.id)) return;
            const showsPaid = m.isPaid !== false;
            const nextIsPaid = !showsPaid;
            setBusy((prev) => new Set(prev).add(m.id));
            try {
                await patchOne(m.id, nextIsPaid);
                if (nextIsPaid) playPingSound();
                await refresh();
            } catch (error) {
                console.error('Erro ao atualizar status do movimento:', error);
                window.alert('Não foi possível atualizar o status. Tente novamente.');
            } finally {
                setBusy((prev) => {
                    const next = new Set(prev);
                    next.delete(m.id);
                    return next;
                });
            }
        },
        [busy, patchOne, refresh]
    );

    const statusToggleBusy = useCallback((id: string) => busy.has(id), [busy]);

    return { onToggleStatus, statusToggleBusy };
}