import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardSkeletonLayout } from '../skeleton/DashboardPageSkeleton';
import { MovementsSkeletonLayout, type MovementsSkeletonConfig } from '../skeleton/MovementsPageSkeleton';
import { ZeroBudgetSkeletonLayout } from '../skeleton/ZeroBudgetPageSkeleton';
import { WalletSkeletonLayout } from '../skeleton/WalletPageSkeleton';
import { CofrinhosSkeletonLayout } from '../skeleton/CofrinhosPageSkeleton';
import { DebtsSkeletonLayout } from '../skeleton/DebtsPageSkeleton';

type VeilRoute = {
    sectionClass: string;
    sectionId?: string;
    layout: ReactNode;
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

function veilForPath(pathname: string): VeilRoute | null {
    const path = pathname.replace(/\/+$/, '') || '/';

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
            sectionClass: 'page active movements-page--modern',
            layout: <MovementsSkeletonLayout {...GAINS_VEIL} />
        };
    }

    if (path === '/dinheiro/saidas') {
        return {
            sectionId: 'expenses-page',
            sectionClass: 'page active movements-page--modern',
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
            sectionClass: 'page active cofrinhos-page cofrinhos-page--modern',
            layout: <CofrinhosSkeletonLayout />
        };
    }

    if (path === '/dinheiro/dividas') {
        return {
            sectionId: 'debts-page',
            sectionClass: 'page active debts-page debts-page--modern',
            layout: <DebtsSkeletonLayout />
        };
    }

    return null;
}

/** Véu decorativo na troca de rota — mesmo skeleton do carregamento inicial. */
export function RouteTransitionVeil() {
    const { pathname } = useLocation();
    const route = veilForPath(pathname);
    if (!route) return null;

    return (
        <div className="screen-swap__veil" aria-hidden="true">
            <section id={route.sectionId} className={route.sectionClass}>
                <div className="skeleton-page">{route.layout}</div>
            </section>
        </div>
    );
}