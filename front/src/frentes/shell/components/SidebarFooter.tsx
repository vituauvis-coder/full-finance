import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    dark: boolean;
    onToggleTheme: () => void;
    onLogout: () => void;
};

export function SidebarFooter({ dark, onToggleTheme, onLogout }: Props) {
    return (
        <div className="sidebar-footer app-sidebar__footer">
            <div className="app-sidebar__footer-panel">
                <button
                    type="button"
                    id="sidebar-theme-toggle"
                    className="sidebar-theme-toggle app-sidebar__footer-row app-sidebar__footer-row--theme app-sidebar__footer-btn"
                    title={dark ? 'Desativar tema escuro' : 'Ativar tema escuro'}
                    aria-pressed={dark}
                    onClick={onToggleTheme}
                >
                    <span className="app-sidebar__footer-row-leading">
                        <span className="app-sidebar__footer-icon-well" aria-hidden="true">
                            <MaterialIcon
                                name={dark ? 'dark_mode' : 'light_mode'}
                                variant="app"
                                filled={false}
                                weight={500}
                                opticalSize={20}
                            />
                        </span>
                        <span className="sidebar-footer-label">Tema escuro</span>
                    </span>
                    <span className="app-sidebar__theme-switch" data-on={dark ? 'true' : 'false'} aria-hidden="true">
                        <span className="app-sidebar__theme-switch-thumb" />
                    </span>
                </button>
                <div className="app-sidebar__footer-divider" role="presentation" />
                <button
                    type="button"
                    id="logout-btn"
                    className="app-sidebar__footer-row app-sidebar__footer-row--logout app-sidebar__footer-btn app-sidebar__footer-btn--logout"
                    title="Sair"
                    onClick={onLogout}
                >
                    <span className="app-sidebar__footer-row-leading">
                        <span
                            className="app-sidebar__footer-icon-well app-sidebar__footer-icon-well--logout"
                            aria-hidden="true"
                        >
                            <MaterialIcon name="logout" variant="app" filled={false} weight={500} opticalSize={20} />
                        </span>
                        <span className="sidebar-footer-label">Sair</span>
                    </span>
                </button>
            </div>
        </div>
    );
}