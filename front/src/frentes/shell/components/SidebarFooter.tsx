import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    dark: boolean;
    onToggleTheme: () => void;
    onLogout: () => void;
};

export function SidebarFooter({ dark, onToggleTheme, onLogout }: Props) {
    return (
        <div className="sidebar-footer app-sidebar__footer">
            <button
                type="button"
                id="sidebar-theme-toggle"
                className="sidebar-theme-toggle app-sidebar__footer-btn"
                title={dark ? 'Desativar modo escuro' : 'Ativar modo escuro'}
                aria-pressed={dark}
                onClick={onToggleTheme}
            >
                <span className="sidebar-nav-icon" aria-hidden="true">
                    <MaterialIcon name={dark ? 'dark_mode' : 'light_mode'} variant="app" />
                </span>
                <span className="sidebar-footer-label">{dark ? 'Modo escuro' : 'Modo claro'}</span>
            </button>
            <button
                type="button"
                id="logout-btn"
                className="app-sidebar__footer-btn app-sidebar__footer-btn--logout"
                title="Sair"
                onClick={onLogout}
            >
                <span className="sidebar-nav-icon" aria-hidden="true">
                    <MaterialIcon name="logout" variant="app" />
                </span>
                <span className="sidebar-footer-label">Sair</span>
            </button>
        </div>
    );
}