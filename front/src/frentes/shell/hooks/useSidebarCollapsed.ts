import { useCallback, useEffect, useState } from 'react';
import { AppBrandKey, readBrandStorage, writeBrandStorage } from '../../../app/appBrand';

function mainEl() {
    return document.getElementById('main-content');
}

export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const stored = readBrandStorage(AppBrandKey.sidebarCollapsed) === '1';
        const main = mainEl();
        main?.classList.toggle('sidebar-collapsed', stored);
        setCollapsed(stored);
    }, []);

    const toggle = useCallback(() => {
        const main = mainEl();
        if (!main) return;
        const next = !main.classList.contains('sidebar-collapsed');
        main.classList.toggle('sidebar-collapsed', next);
        writeBrandStorage(AppBrandKey.sidebarCollapsed, next ? '1' : '0');
        setCollapsed(next);
    }, []);

    return { collapsed, toggle };
}