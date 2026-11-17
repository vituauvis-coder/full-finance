import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import type { SidebarGroupConfig } from '../config/sidebarNav';
import { SidebarNavLink } from './SidebarNavLink';

type Props = {
    group: SidebarGroupConfig;
    expanded: boolean;
    onToggle: () => void;
};

export function SidebarNavGroup({ group, expanded, onToggle }: Props) {
    return (
        <li
            className={`sidebar-group app-sidebar__group${expanded ? ' is-open' : ''}`}
            data-nav-group={group.id}
        >
            <button
                type="button"
                className="sidebar-group__trigger app-sidebar__group-trigger"
                aria-expanded={expanded}
                onClick={onToggle}
            >
                <span className="sidebar-nav-icon" aria-hidden="true">
                    <MaterialIcon name={group.icon} variant="app" />
                </span>
                <span className="sidebar-nav-label sidebar-group__label">{group.label}</span>
                <span className="sidebar-group__chev" aria-hidden="true">
                    <MaterialIcon name="expand_more" variant="app" opticalSize={20} />
                </span>
            </button>
            <ul className="sidebar-submenu app-sidebar__submenu" hidden={!expanded}>
                {group.items.map((item) => (
                    <li key={item.to}>
                        <SidebarNavLink to={item.to} icon={item.icon} label={item.label} sub />
                    </li>
                ))}
            </ul>
        </li>
    );
}