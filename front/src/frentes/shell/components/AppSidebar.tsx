import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/AuthProvider';
import { readTheme, toggleTheme } from '../../../app/theme';
import { legacyPageIdFromPath } from '../../../legacy/routeMap';
import {
    SIDEBAR_DASHBOARD,
    SIDEBAR_FERRAMENTAS,
    SIDEBAR_GROUPS
} from '../config/sidebarNav';
import { useSidebarNavState } from '../hooks/useSidebarNavState';
import { SidebarCollapseToggle } from './SidebarCollapseToggle';
import { SidebarFooter } from './SidebarFooter';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SidebarNavLink } from './SidebarNavLink';
import { SidebarProfile } from './SidebarProfile';

export function AppSidebar() {
    const { logout, user } = useAuth();
    const { pathname } = useLocation();
    const pageId = legacyPageIdFromPath(pathname);
    const { open, toggle } = useSidebarNavState(pageId);
    const [dark, setDark] = useState(() => readTheme() === 'dark');

    return (
        <>
            <div id="sidebar-overlay" className="sidebar-overlay hidden" />
            <div className="sidebar-shell app-sidebar-shell">
                <nav className="sidebar sidebar--modern" id="app-sidebar" aria-label="Menu principal">
                    <SidebarProfile email={user?.email ?? ''} />
                    <ul className="sidebar-menu app-sidebar__menu">
                        <li className="sidebar-root-item">
                            <SidebarNavLink
                                to={SIDEBAR_DASHBOARD.to}
                                icon={SIDEBAR_DASHBOARD.icon}
                                label={SIDEBAR_DASHBOARD.label}
                            />
                        </li>
                        {SIDEBAR_GROUPS.map((group) => (
                            <SidebarNavGroup
                                key={group.id}
                                group={group}
                                expanded={open[group.id]}
                                onToggle={() => toggle(group.id)}
                            />
                        ))}
                        <li className="sidebar-root-item">
                            <SidebarNavLink
                                to={SIDEBAR_FERRAMENTAS.to}
                                icon={SIDEBAR_FERRAMENTAS.icon}
                                label={SIDEBAR_FERRAMENTAS.label}
                            />
                        </li>
                    </ul>
                    <SidebarFooter
                        dark={dark}
                        onToggleTheme={() => setDark(toggleTheme() === 'dark')}
                        onLogout={() => void logout()}
                    />
                </nav>
                <SidebarCollapseToggle />
            </div>
        </>
    );
}