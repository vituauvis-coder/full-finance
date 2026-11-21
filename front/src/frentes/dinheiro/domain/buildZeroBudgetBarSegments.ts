import type { ZeroBudgetBlock } from './zeroBudgetTypes';
import { zeroBudgetBarBgClass } from './zeroBudgetColors';
import { blockCategoryName } from './zeroBudgetPlanning';

export type ZeroBudgetBarSegment = {
    key: string;
    nome: string;
    valor: number;
    rest: boolean;
    colorClass: string;
};

export function buildZeroBudgetBarSegments(
    blocks: ZeroBudgetBlock[],
    availableBalance: number,
    totalAllocated: number,
    remaining: number
): { segs: ZeroBudgetBarSegment[]; denom: number } {
    const denom = Math.max(availableBalance, totalAllocated, 1e-9);
    const segs: ZeroBudgetBarSegment[] = [];

    for (const b of blocks) {
        const v = Number(b.allocatedAmount) || 0;
        if (v > 0) {
            segs.push({
                key: b.id,
                nome: blockCategoryName(b) || 'Bloco',
                valor: v,
                rest: false,
                colorClass: zeroBudgetBarBgClass(b.color)
            });
        }
    }

    if (remaining > 0) {
        segs.push({ key: 'restante', nome: 'Não alocado', valor: remaining, rest: true, colorClass: '' });
    }

    return { segs, denom };
}