import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../app/AuthProvider';
import { readTheme, toggleThemeWithTransition } from '../../../app/theme';
import { legacyPageIdFromPath } from '../../../legacy/routeMap';
import {
    readLastTripId,
    rememberLastTripId,
    SIDEBAR_GROUPS,
    tripIdFromPathname,
    viagensModuleItems
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
    const { open, toggle, reveal } = useSidebarNavState(pageId);
    const tripFromPath = tripIdFromPathname(pathname);
    const tripForModules = tripFromPath ?? readLastTripId();

    useEffect(() => {
        if (tripFromPath) rememberLastTripId(tripFromPath);
    }, [tripFromPath]);

    const groups = SIDEBAR_GROUPS.map((group) =>
        group.id === 'viagens' ? { ...group, items: viagensModuleItems(tripForModules) } : group
    );
    const [dark, setDark] = useState(() => readTheme() === 'dark');

    useEffect(() => {
        const sync = () => setDark(readTheme() === 'dark');
        window.addEventListener('meumundo-themechange', sync);
        return () => window.removeEventListener('meumundo-themechange', sync);
    }, []);

    return (
        <>
            <div id="sidebar-overlay" className="sidebar-overlay hidden" />
            <div className="sidebar-shell app-sidebar-shell">
                <nav className="sidebar sidebar--modern" id="app-sidebar" aria-label="Menu principal">
                    <SidebarProfile email={user?.email ?? ''} />
                    <ul className="sidebar-menu app-sidebar__menu">
                        {groups.map((group) => (
                            <SidebarNavGroup
                                key={group.id}
                                group={group}
                                expanded={open[group.id]}
                                onToggle={() => toggle(group.id)}
                                onReveal={() => reveal(group.id)}
                            />
                        ))}
                    </ul>
                    <SidebarFooter
                        dark={dark}
                        onToggleTheme={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            toggleThemeWithTransition({
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2
                            });
                        }}
                        onLogout={() => void logout()}
                    />
                </nav>
                <SidebarCollapseToggle />
            </div>
        </>
    );
}