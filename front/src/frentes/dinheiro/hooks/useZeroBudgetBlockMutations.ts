import { useCallback } from 'react';
import { apiFetch } from '../../../lib/http';

type BlockPatch = {
    allocatedAmount?: number;
    color?: string;
};

export function useZeroBudgetBlockMutations(blockId: string, onChange: () => void | Promise<void>) {
    const patch = useCallback(
        async (body: BlockPatch) => {
            await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}`, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            await onChange();
        },
        [blockId, onChange]
    );

    const remove = useCallback(async () => {
        await apiFetch(`/api/zero-budget/blocks/${encodeURIComponent(blockId)}`, { method: 'DELETE' });
        await onChange();
    }, [blockId, onChange]);

    return { patch, remove };
}