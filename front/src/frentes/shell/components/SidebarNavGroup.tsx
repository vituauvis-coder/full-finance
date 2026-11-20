import { useLocation } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import {
    sidebarGroupLandingActive,
    sidebarLeafActive,
    type SidebarGroupConfig
} from '../config/sidebarNav';
import { SidebarNavLink } from './SidebarNavLink';

type Props = {
    group: SidebarGroupConfig;
    expanded: boolean;
    onToggle: () => void;
    onReveal: () => void;
};

export function SidebarNavGroup({ group, expanded, onToggle, onReveal }: Props) {
    const { pathname, search } = useLocation();
    const landingActive = sidebarGroupLandingActive(group, pathname, search);
    const panelId = `sidebar-group-${group.id}`;

    return (
        <li
            className={`sidebar-group app-sidebar__group${expanded ? ' is-open' : ''}`}
            data-nav-group={group.id}
        >
            <div className="sidebar-group__row">
                <SidebarNavLink
                    to={group.to}
                    icon={group.icon}
                    label={group.label}
                    active={landingActive}
                    className="sidebar-group__link"
                    onNavigate={onReveal}
                />
                <button
                    type="button"
                    className="sidebar-group__chev"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    aria-label={expanded ? `Recolher ${group.label}` : `Expandir ${group.label}`}
                    onClick={onToggle}
                >
                    <MaterialIcon name="expand_more" variant="app" opticalSize={20} />
                </button>
            </div>
            <ul id={panelId} className="sidebar-submenu app-sidebar__submenu" hidden={!expanded}>
                {group.items.map((item) => (
                    <li key={`${item.label}-${item.to}`}>
                        <SidebarNavLink
                            to={item.to}
                            icon={item.icon}
                            label={item.label}
                            sub
                            active={sidebarLeafActive(pathname, search, item)}
                        />
                    </li>
                ))}
            </ul>
        </li>
    );
}
