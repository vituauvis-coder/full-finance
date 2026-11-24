import { useEffect, useState } from 'react';
import { SIDEBAR_GROUPS } from '../config/sidebarNav';

export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number]['id'];

export function useSidebarNavState(pageId: string | null | undefined) {
    const [open, setOpen] = useState<Record<SidebarGroupId, boolean>>({
        financas: true,
        viagens: true,
        estudos: true
    });

    useEffect(() => {
        if (!pageId) return;
        setOpen((prev) => {
            const next = { ...prev };
            for (const group of SIDEBAR_GROUPS) {
                if (group.pages.includes(pageId)) next[group.id] = true;
            }
            return next;
        });
    }, [pageId]);

    const toggle = (id: SidebarGroupId) => {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const reveal = (id: SidebarGroupId) => {
        setOpen((prev) => ({ ...prev, [id]: true }));
    };

    return { open, toggle, reveal };
}
