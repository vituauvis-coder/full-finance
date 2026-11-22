import { isSplitReimbursementGain } from '@motor/dinheiro/split-net.js';
import type { Movement } from '../../../lib/types/finance';

type GainWithSynthetic = Movement & { __syntheticExpectedSplit?: boolean };

/** Entrada que pertence ao bloco de estorno/reembolso (não às categorias “normais”). */
export function isGainEstornoRow(m: Movement): boolean {
    if (!m) return false;
    if (isSplitReimbursementGain(m)) return true;
    if ((m as GainWithSynthetic).__syntheticExpectedSplit) return true;
    const desc = String(m.description ?? '').trim().toLowerCase();
    if (desc.startsWith('expectativa de estorno')) return true;
    return false;
}

/** Estorno persistido que só entra nas listas após confirmação (liquidado). */
export function gainEstornoAppearsInLists(m: Movement): boolean {
    if (!isGainEstornoRow(m)) return true;
    return m.isPaid !== false;
}