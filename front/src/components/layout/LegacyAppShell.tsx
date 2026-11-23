import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { bootstrapReactShell } from '../../legacy/bootstrapShell';
import { legacyPageIdFromPath } from '../../legacy/routeMap';
import { DashboardFacetsProvider } from '../../frentes/dashboard/context/DashboardFacetsContext';
import { MovementListFiltersProvider } from '../../frentes/dinheiro/context/MovementListFiltersContext';
import { ZeroBudgetHeaderSlotProvider } from '../../frentes/dinheiro/context/ZeroBudgetHeaderSlotContext';
import { CofrinhosHeaderSlotProvider } from '../../frentes/dinheiro/context/CofrinhosHeaderSlotContext';
import { DebtsHeaderSlotProvider } from '../../frentes/dinheiro/context/DebtsHeaderSlotContext';
import { WalletHeaderSlotProvider } from '../../frentes/dinheiro/context/WalletHeaderSlotContext';
import { ViagensHeaderSlotProvider } from '../../frentes/viagens/context/ViagensHeaderSlotContext';
import { ViagensShellVeilProvider } from '../../frentes/viagens/context/ViagensShellVeilContext';
import { DashboardCategoryDrawer } from '../finance/DashboardCategoryDrawer';
import { AppAmbientBackground } from './AppAmbientBackground';
import { LegacyAppHeader } from './LegacyAppHeader';
import { LegacySidebar } from './LegacySidebar';
import { RouteErrorBoundary } from '../RouteErrorBoundary';
import { RouteTransitionProvider } from './RouteTransitionContext';
import { ScreenSwap } from './ScreenSwap';
import { UiChipsHydrator } from '../../app/UiChipsHydrator';

export function LegacyAppShell() {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const isProfile = pathname.startsWith('/perfil');

    useEffect(() => {
        if (!user) return;
        bootstrapReactShell({
            uid: user.uid,
            email: user.email,
            name: user.name,
            role: user.role
        });
    }, [user]);

    useEffect(() => {
        const menuBtn = document.getElementById('menu-toggle-btn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!menuBtn || !sidebar || !overlay) return;
        const open = () => {
            sidebar.classList.add('open');
            overlay.classList.remove('hidden');
            overlay.classList.add('open');
        };
        const close = () => {
            sidebar.classList.remove('open');
            overlay.classList.add('hidden');
            overlay.classList.remove('open');
        };
        const onToggle = (e: Event) => {
            e.stopPropagation();
            sidebar.classList.contains('open') ? close() : open();
        };
        menuBtn.addEventListener('click', onToggle);
        overlay.addEventListener('click', close);
        return () => {
            menuBtn.removeEventListener('click', onToggle);
            overlay.removeEventListener('click', close);
        };
    }, []);

    useEffect(() => {
        const pageId = legacyPageIdFromPath(pathname) ?? 'dashboard';
        try {
            localStorage.setItem('lastVisitedPage', pageId);
        } catch {
            /* ignore */
        }
    }, [pathname]);

    return (
        <DashboardFacetsProvider>
            <MovementListFiltersProvider>
                <ZeroBudgetHeaderSlotProvider>
                <CofrinhosHeaderSlotProvider>
                <DebtsHeaderSlotProvider>
                <WalletHeaderSlotProvider>
                <ViagensShellVeilProvider>
                <ViagensHeaderSlotProvider>
                    <UiChipsHydrator />
                    <div id="app" className="app-container">
                        <motionMain id="main-content" className="main-content">
                            <LegacySidebar />
                            <main
                                className={`page-content page-content--with-ambient page-content--dashboard-modern${
                                    isProfile ? ' page-content--profile-modern' : ''
                                }`}
                            >
                                <AppAmbientBackground />
                                <RouteTransitionProvider>
                                    <LegacyAppHeader />
                                    <RouteErrorBoundary>
                                        <ScreenSwap>
                                            <Outlet />
                                        </ScreenSwap>
                                    </RouteErrorBoundary>
                                </RouteTransitionProvider>
                            </main>
                            <DashboardCategoryDrawer />
                        </motionMain>
                    </div>
                </ViagensHeaderSlotProvider>
                </ViagensShellVeilProvider>
                </WalletHeaderSlotProvider>
                </DebtsHeaderSlotProvider>
                </CofrinhosHeaderSlotProvider>
                </ZeroBudgetHeaderSlotProvider>
            </MovementListFiltersProvider>
        </DashboardFacetsProvider>
    );
}

function motionMain({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
    return (
        <div id={id} className={className}>
            {children}
        </div>
    );
}