import { buildSyntheticExpectedSplitGainsRows } from '@motor/dinheiro/expected-split-gain-rows.js';
import type { Account, Movement, SplitBundle } from '../../../lib/types/finance';

export function gainsWithSyntheticExpectedSplits(params: {
    period: string;
    civilYear: number;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    splitBundle?: SplitBundle;
    now?: Date;
}): Movement[] {
    const now = params.now ?? new Date();
    const base = (params.gains ?? []).filter((g) => g && !g.referenceOnly);
    const synthetic = buildSyntheticExpectedSplitGainsRows(
        params.period,
        now,
        params.expenses,
        params.accounts,
        params.splitBundle?.outgoing ?? [],
        params.gains,
        params.civilYear
    ) as Movement[];
    return [...base, ...synthetic];
}

/** Período usado para gerar estornos sintéticos no gráfico anual (12 meses do ano civil). */
export const FLUX_CHART_SYNTHETIC_PERIOD = 'current-year';