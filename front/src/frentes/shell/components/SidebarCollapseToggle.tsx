import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';

export function SidebarCollapseToggle() {
    const { collapsed, toggle } = useSidebarCollapsed();

    return (
        <button
            type="button"
            id="sidebar-collapse-toggle"
            className={[
                'sidebar-collapse-toggle',
                'sidebar-edge-tab',
                'app-sidebar__collapse-handle',
                collapsed ? 'is-collapsed' : ''
            ]
                .filter(Boolean)
                .join(' ')}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={toggle}
        >
            <span className="app-sidebar__collapse-handle-ring" aria-hidden="true" />
            <span className="app-sidebar__collapse-handle-icon">
                <MaterialIcon
                    name={collapsed ? 'chevron_right' : 'chevron_left'}
                    variant="app"
                    weight={500}
                    opticalSize={22}
                />
            </span>
        </button>
    );
}