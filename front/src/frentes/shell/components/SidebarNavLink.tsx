import { Link, NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { collapseSidebarOnModuleNav } from '../sidebarCollapse';

type Props = {
    to: string;
    icon: string;
    label: string;
    sub?: boolean;
    /** Só marca ativo na rota exata (ex.: /viagens sem abrir com /viagens/:id). */
    end?: boolean;
    /** Quando definido, ignora o match automático do NavLink. */
    active?: boolean;
    className?: string;
    onNavigate?: () => void;
};

export function SidebarNavLink({ to, icon, label, sub, end, active, className, onNavigate }: Props) {
    const classes = (isActive: boolean) =>
        ['nav-link', 'app-sidebar__link', sub ? 'nav-link--sub' : '', className ?? '', isActive ? 'active' : '']
            .filter(Boolean)
            .join(' ');

    const body = (
        <>
            <span className="sidebar-nav-icon" aria-hidden="true">
                <MaterialIcon name={icon} variant="app" />
            </span>
            <span className="sidebar-nav-label">{label}</span>
        </>
    );

    const onClick = () => {
        onNavigate?.();
        collapseSidebarOnModuleNav();
    };

    if (active !== undefined) {
        return (
            <Link
                to={to}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={classes(active)}
                onClick={onClick}
            >
                {body}
            </Link>
        );
    }

    return (
        <NavLink to={to} end={end} title={label} className={({ isActive }) => classes(isActive)} onClick={onClick}>
            {body}
        </NavLink>
    );
}
