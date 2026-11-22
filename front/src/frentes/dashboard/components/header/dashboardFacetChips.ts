export const DASHBOARD_EXPENSE_FACETS = [
    ['fixed', 'Essencial'],
    ['recurring', 'Recorrente'],
    ['credit', 'Cartão'],
    ['pix', 'PIX'],
    ['paid', 'Pago'],
    ['unpaid', 'Pendente']
] as const;

export type DashboardFlow = 'gains' | 'expenses';

export function dashboardFacetPillClass(flow: DashboardFlow, active: boolean): string {
    return [
        'movement-status-pill',
        'dashboard-facet-pill',
        `dashboard-facet-pill--${flow}`,
        active ? 'is-on' : ''
    ]
        .filter(Boolean)
        .join(' ');
}