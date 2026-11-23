import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { SIDEBAR_FERRAMENTAS } from '../config/sidebarNav';
import { collapseSidebarOnModuleNav } from '../sidebarCollapse';
import { SidebarThemeToggleIcon } from './SidebarThemeToggleIcon';

type Props = {
    dark: boolean;
    onToggleTheme: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onLogout: () => void;
};

export function SidebarFooter({ dark, onToggleTheme, onLogout }: Props) {
    return (
        <div className="sidebar-footer app-sidebar__footer">
            <div className="app-sidebar__footer-actions" role="toolbar" aria-label="Ações do menu">
                <NavLink
                    to={SIDEBAR_FERRAMENTAS.to}
                    title={SIDEBAR_FERRAMENTAS.label}
                    className={({ isActive }) =>
                        [
                            'app-sidebar__footer-icon-btn',
                            'app-sidebar__footer-icon-btn--link',
                            isActive ? 'is-active' : ''
                        ]
                            .filter(Boolean)
                            .join(' ')
                    }
                    onClick={() => collapseSidebarOnModuleNav()}
                >
                    <span className="app-sidebar__footer-icon-btn-surface">
                        <MaterialIcon
                            name={SIDEBAR_FERRAMENTAS.icon}
                            variant="app"
                            opticalSize={22}
                            filled={false}
                            weight={500}
                        />
                    </span>
                    <span className="sidebar-footer-label">{SIDEBAR_FERRAMENTAS.label}</span>
                </NavLink>
                <button
                    type="button"
                    id="sidebar-theme-toggle"
                    className={['sidebar-theme-toggle', 'app-sidebar__footer-icon-btn', dark ? 'is-active' : '']
                        .filter(Boolean)
                        .join(' ')}
                    title={dark ? 'Desativar tema escuro' : 'Ativar tema escuro'}
                    aria-pressed={dark}
                    onClick={onToggleTheme}
                >
                    <span className="app-sidebar__footer-icon-btn-surface">
                        <SidebarThemeToggleIcon dark={dark} />
                    </span>
                    <span className="sidebar-footer-label">Tema escuro</span>
                </button>
                <button
                    type="button"
                    id="logout-btn"
                    className="app-sidebar__footer-icon-btn app-sidebar__footer-icon-btn--logout"
                    title="Sair"
                    onClick={onLogout}
                >
                    <span className="app-sidebar__footer-icon-btn-surface">
                        <MaterialIcon name="logout" variant="app" opticalSize={22} filled={false} weight={500} />
                    </span>
                    <span className="sidebar-footer-label">Sair</span>
                </button>
            </div>
        </div>
    );
}