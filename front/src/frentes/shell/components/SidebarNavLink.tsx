import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { collapseSidebarOnModuleNav } from '../sidebarCollapse';

type Props = {
    to: string;
    icon: string;
    label: string;
    sub?: boolean;
    /** Só marca ativo na rota exata (ex.: /viagens sem abrir com /viagens/:id). */
    end?: boolean;
};

export function SidebarNavLink({ to, icon, label, sub, end }: Props) {
    return (
        <NavLink
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
                `nav-link app-sidebar__link${sub ? ' nav-link--sub' : ''}${isActive ? ' active' : ''}`
            }
            onClick={() => collapseSidebarOnModuleNav()}
        >
            <span className="sidebar-nav-icon" aria-hidden="true">
                <MaterialIcon name={icon} variant="app" />
            </span>
            <span className="sidebar-nav-label">{label}</span>
        </NavLink>
    );
}