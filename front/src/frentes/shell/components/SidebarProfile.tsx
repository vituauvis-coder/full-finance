import { NavLink } from 'react-router-dom';
import { useSidebarProfileLabel } from '../hooks/useSidebarProfileLabel';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { collapseSidebarOnModuleNav } from '../sidebarCollapse';

type Props = {
    email: string;
};

export function SidebarProfile({ email }: Props) {
    const profile = useSidebarProfileLabel(email);

    return (
        <header className="sidebar-profile-row app-sidebar__profile">
            <h2 className="sr-only">Perfil</h2>
            <NavLink
                to="/perfil"
                id="user-info"
                className={({ isActive }) =>
                    ['app-sidebar__profile-link', isActive ? 'sidebar-user-on-profile' : '']
                        .filter(Boolean)
                        .join(' ')
                }
                aria-label="Abrir meu perfil"
                onClick={() => collapseSidebarOnModuleNav()}
            >
                <div className="app-sidebar__profile-card">
                    <div className="app-sidebar__avatar" aria-hidden="true">
                        <span className="app-sidebar__avatar-fallback">{profile.initial}</span>
                        <img id="sidebar-user-photo" className="app-sidebar__avatar-img" src="" alt="" decoding="async" />
                    </div>
                    <div className="app-sidebar__profile-text sidebar-user-meta">
                        <span id="user-name-display" className="app-sidebar__profile-title sidebar-user-name">
                            {profile.title}
                        </span>
                        {profile.subtitle ? (
                            <span className="app-sidebar__profile-subtitle" title={profile.subtitle}>
                                {profile.subtitle}
                            </span>
                        ) : null}
                    </div>
                    <span className="app-sidebar__profile-chevron" aria-hidden="true">
                        <MaterialIcon name="chevron_right" variant="app" opticalSize={20} />
                    </span>
                </div>
            </NavLink>
        </header>
    );
}