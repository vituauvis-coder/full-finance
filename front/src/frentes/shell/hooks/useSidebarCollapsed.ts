import { useCallback, useEffect, useState } from 'react';
import { AppBrandKey, readBrandStorage } from '../../../app/appBrand';
import { applySidebarCollapsed, sidebarCollapseSyncEvent } from '../sidebarCollapse';

export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const stored = readBrandStorage(AppBrandKey.sidebarCollapsed) === '1';
        applySidebarCollapsed(stored);
        setCollapsed(stored);

        const onSync = (e: Event) => {
            const detail = (e as CustomEvent<{ collapsed?: boolean }>).detail;
            if (typeof detail?.collapsed === 'boolean') {
                setCollapsed(detail.collapsed);
                return;
            }
            const main = document.getElementById('main-content');
            setCollapsed(main?.classList.contains('sidebar-collapsed') ?? false);
        };
        window.addEventListener(sidebarCollapseSyncEvent, onSync);
        return () => window.removeEventListener(sidebarCollapseSyncEvent, onSync);
    }, []);

    const toggle = useCallback(() => {
        const main = document.getElementById('main-content');
        if (!main) return;
        const next = !main.classList.contains('sidebar-collapsed');
        applySidebarCollapsed(next);
        setCollapsed(next);
    }, []);

    return { collapsed, toggle };
}