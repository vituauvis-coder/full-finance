import type { DashboardFacets } from './types/finance';

const STATUS_KEYS = ['paid', 'unpaid'] as const;

/** Espelha `dashOutflowCardSummationMode` do legado para futuras agregações de parcelas. */
export function dashOutflowCardSummationMode(facets: DashboardFacets['expenses']) {
    if (!facets?.size) return 'paid_through' as const;
    const touchesStatus = STATUS_KEYS.some((k) => facets.has(k));
    if (!touchesStatus) return 'paid_through' as const;
    const paid = facets.has('paid');
    const unpaid = facets.has('unpaid');
    if (paid && unpaid) return 'all_slices' as const;
    if (unpaid && !paid) return 'pending_due' as const;
    return 'paid_through' as const;
}