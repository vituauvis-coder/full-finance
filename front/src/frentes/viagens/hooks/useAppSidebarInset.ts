import { useEffect, useState } from 'react';
import { isDesktopSidebarViewport, sidebarCollapseSyncEvent } from '../../shell/sidebarCollapse';

const SIDEBAR_WIDE = 250;
const SIDEBAR_NARROW = 76;

function readInsetPx(): number {
    if (!isDesktopSidebarViewport()) return 0;
    const main = document.getElementById('main-content');
    return main?.classList.contains('sidebar-collapsed') ? SIDEBAR_NARROW : SIDEBAR_WIDE;
}

/** Largura reservada à sidebar fixa do portal (overlay do simulador não cobre o menu). */
export function useAppSidebarInset(): number {
    const [inset, setInset] = useState(() => readInsetPx());

    useEffect(() => {
        const sync = () => setInset(readInsetPx());
        sync();
        window.addEventListener('resize', sync);
        window.addEventListener(sidebarCollapseSyncEvent, sync);
        const main = document.getElementById('main-content');
        const observer =
            main &&
            new MutationObserver(sync);
        if (main && observer) {
            observer.observe(main, { attributes: true, attributeFilter: ['class'] });
        }
        return () => {
            window.removeEventListener('resize', sync);
            window.removeEventListener(sidebarCollapseSyncEvent, sync);
            observer?.disconnect();
        };
    }, []);

    return inset;
}