import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';

type Props = {
    to: string;
    icon: string;
    label: string;
    sub?: boolean;
};

export function SidebarNavLink({ to, icon, label, sub }: Props) {
    return (
        <NavLink
            to={to}
            title={label}
            className={({ isActive }) =>
                `nav-link app-sidebar__link${sub ? ' nav-link--sub' : ''}${isActive ? ' active' : ''}`
            }
        >
            <span className="sidebar-nav-icon" aria-hidden="true">
                <MaterialIcon name={icon} variant="app" />
            </span>
            <span className="sidebar-nav-label">{label}</span>
        </NavLink>
    );
}