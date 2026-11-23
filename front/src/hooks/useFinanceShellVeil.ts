import { useLocation } from 'react-router-dom';
import { useFinanceData } from '../app/FinanceDataProvider';
import { useRouteTransitionPending } from '../components/layout/RouteTransitionContext';
import { legacyPageIdFromPath, type LegacyPageId } from '../legacy/routeMap';
import { useSkeletonMinDuration } from './useSkeletonMinDuration';

const FINANCE_VEIL_PAGES = new Set<LegacyPageId>([
    'dashboard',
    'gains',
    'expenses',
    'zero-budget',
    'wallet',
    'cofrinhos',
    'debts'
]);

function financePageBusy(pageId: LegacyPageId, loading: boolean, hasData: boolean): boolean {
    if (loading) return true;
    if (pageId === 'zero-budget' || pageId === 'cofrinhos') return !hasData;
    return false;
}

/** Skeleton no app-header (e páginas que leem o mesmo sinal) durante fetch ou troca de rota. */
export function useFinanceShellVeil(pageId: LegacyPageId): boolean {
    const { pathname } = useLocation();
    const active = legacyPageIdFromPath(pathname) ?? 'dashboard';
    const { loading, data } = useFinanceData();
    const routePending = useRouteTransitionPending();
    const showDataSkeleton = useSkeletonMinDuration(
        financePageBusy(pageId, loading, data != null)
    );

    if (!FINANCE_VEIL_PAGES.has(pageId)) return false;
    if (active !== pageId) return false;

    return showDataSkeleton || routePending;
}