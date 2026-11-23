import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardSkeletonLayout } from '../skeleton/DashboardPageSkeleton';
import { MovementsSkeletonLayout, type MovementsSkeletonConfig } from '../skeleton/MovementsPageSkeleton';
import { ZeroBudgetSkeletonLayout } from '../skeleton/ZeroBudgetPageSkeleton';
import { WalletSkeletonLayout } from '../skeleton/WalletPageSkeleton';
import { CofrinhosSkeletonLayout } from '../skeleton/CofrinhosPageSkeleton';
import { DebtsSkeletonLayout } from '../skeleton/DebtsPageSkeleton';
import { ViagensTripSkeletonByVariant } from '../skeleton/viagens/ViagensTripSkeletons';
import { viagensSkeletonVariantFromLocation } from '../skeleton/viagens/viagensSkeletonRoute';

type VeilRoute = {
    sectionClass: string;
    sectionId?: string;
    layout: ReactNode;
    /** Atlas / ficha — ocupa a viewport sem gap do `.skeleton-page`. */
    flushLayout?: boolean;
};

const GAINS_VEIL: MovementsSkeletonConfig = {
    summaryGroup: 'gains',
    summaryAriaLabel: 'Resumo de entradas',
    cardCount: 3
};

const EXPENSES_VEIL: MovementsSkeletonConfig = {
    summaryGroup: 'expenses',
    summaryAriaLabel: 'Resumo de saídas',
    cardCount: 4
};

function veilForPath(pathname: string, search: string): VeilRoute | null {
    const path = pathname.replace(/\/+$/, '') || '/';

    const viagensVariant = viagensSkeletonVariantFromLocation(path, search);
    if (viagensVariant === 'atlas') {
        return {
            sectionId: 'viagens-page',
            sectionClass: 'viagens-page viagens-page--atlas-modern',
            flushLayout: true,
            layout: (
                <div className="viagens-root">
                    <ViagensTripSkeletonByVariant variant="atlas" />
                </div>
            )
        };
    }

    if (path === '/dashboard') {
        return {
            sectionId: 'dashboard-page',
            sectionClass: 'page active dashboard-page--modern',
            layout: <DashboardSkeletonLayout />
        };
    }

    if (path === '/dinheiro/entradas') {
        return {
            sectionId: 'gains-page',
            sectionClass: 'page active movements-page--modern movements-page--compact',
            layout: <MovementsSkeletonLayout {...GAINS_VEIL} />
        };
    }

    if (path === '/dinheiro/saidas') {
        return {
            sectionId: 'expenses-page',
            sectionClass: 'page active movements-page--modern movements-page--compact',
            layout: <MovementsSkeletonLayout {...EXPENSES_VEIL} />
        };
    }

    if (path === '/dinheiro/planejamento') {
        return {
            sectionId: 'zero-budget-page',
            sectionClass: 'page active zero-budget-page',
            layout: <ZeroBudgetSkeletonLayout />
        };
    }

    if (path === '/dinheiro/carteira') {
        return {
            sectionId: 'wallet-page',
            sectionClass: 'page active wallet-page wallet-page--modern',
            layout: <WalletSkeletonLayout />
        };
    }

    if (path === '/dinheiro/cofrinhos') {
        return {
            sectionId: 'cofrinhos-page',
            sectionClass:
                'page active cofrinhos-page cofrinhos-page--modern movements-page--modern movements-page--compact',
            layout: <CofrinhosSkeletonLayout />
        };
    }

    if (path === '/dinheiro/dividas') {
        return {
            sectionId: 'debts-page',
            sectionClass:
                'page active debts-page debts-page--modern movements-page--modern movements-page--compact',
            layout: <DebtsSkeletonLayout />
        };
    }

    return null;
}

/** Véu decorativo na troca de rota — mesmo skeleton do carregamento inicial. */
export function RouteTransitionVeil() {
    const { pathname, search } = useLocation();
    const route = veilForPath(pathname, search);
    if (!route) return null;

    return (
        <div className="screen-swap__veil" aria-hidden="true">
            <section {...(route.sectionId ? { id: route.sectionId } : {})} className={route.sectionClass}>
                {route.flushLayout ? route.layout : <div className="skeleton-page">{route.layout}</div>}
            </section>
        </div>
    );
}