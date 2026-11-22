import { useLocation } from 'react-router-dom';
import { DashboardHeaderActions } from '../../frentes/dashboard/components/header/DashboardHeaderActions';
import { LEGACY_PAGE_HEADERS, legacyPageIdFromPath } from '../../legacy/routeMap';
import { MaterialIcon } from '../icons/MaterialIcon';
import { HeaderNotifications } from './HeaderNotifications';
import { MovementFacetHeaderActions } from './header/MovementFacetHeaderActions';
import { ViagensHeaderActions } from '../../frentes/viagens/components/ViagensHeaderActions';
import { ZeroBudgetHeaderActions } from '../../frentes/dinheiro/components/ZeroBudgetHeaderActions';
import { CofrinhosHeaderActions } from '../../frentes/dinheiro/components/cofrinhos/CofrinhosHeaderActions';
import { DebtsHeaderActions } from '../../frentes/dinheiro/components/debts/DebtsHeaderActions';
import { WalletHeaderActions } from '../../frentes/dinheiro/components/WalletHeaderActions';

export function LegacyAppHeader() {
    const { pathname } = useLocation();
    const pageId = legacyPageIdFromPath(pathname) ?? 'dashboard';
    const meta = LEGACY_PAGE_HEADERS[pageId];
    const viagensAtlas = pathname === '/viagens' || pathname === '/viagens/';
    const hideTitleBar = pageId === 'dashboard';

    return (
        <>
            <button id="menu-toggle-btn" className="menu-toggle-btn" type="button">
                <i className="fas fa-bars"></i>
            </button>
            {hideTitleBar ? null : (
            <header className={`app-header ${meta.headerClass ?? ''}`}>
                <div className="header-left">
                    <div className="header-page-heading header-page-heading--emoji-swap" id="header-page-heading" aria-live="polite">
                        <span className="header-page-emoji" id="current-page-emoji" aria-hidden="true">
                            {meta.materialIcon ? (
                                <MaterialIcon name={meta.materialIcon} variant="app" />
                            ) : (
                                <i className={`fas ${meta.icon}`} aria-hidden="true"></i>
                            )}
                        </span>
                        <span className="header-page-title" id="current-page-title">
                            {meta.title}
                        </span>
                    </div>
                </div>
                <div className="header-right">
                    <DashboardHeaderActions hidden />
                    <MovementFacetHeaderActions
                        hidden={pageId !== 'gains'}
                        id="gains-header-actions"
                        ariaLabel="Ações de entradas"
                        paidLabel="Recebido"
                        unpaidLabel="Pendente"
                        tone="gains"
                        showQuickStatus={false}
                    />
                    <MovementFacetHeaderActions
                        hidden={pageId !== 'expenses'}
                        id="expenses-header-actions"
                        ariaLabel="Ações de saídas"
                        paidLabel="Pago"
                        unpaidLabel="Pendente"
                        tone="expenses"
                        showQuickStatus={false}
                    />
                    <ViagensHeaderActions hidden={pageId !== 'viagens' || !viagensAtlas} />
                    <ZeroBudgetHeaderActions hidden={pageId !== 'zero-budget'} />
                    <WalletHeaderActions hidden={pageId !== 'wallet'} />
                    <CofrinhosHeaderActions hidden={pageId !== 'cofrinhos'} />
                    <DebtsHeaderActions hidden={pageId !== 'debts'} />
                    <HeaderNotifications />
                </div>
            </header>
            )}
        </>
    );
}