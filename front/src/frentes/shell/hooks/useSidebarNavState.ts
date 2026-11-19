import { useEffect, useState } from 'react';
import { SIDEBAR_GROUPS, leafPageIds } from '../config/sidebarNav';

export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number]['id'];

export function useSidebarNavState(pageId: string | undefined) {
    const [open, setOpen] = useState<Record<SidebarGroupId, boolean>>({
        dinheiro: true,
        viagens: true
    });

    useEffect(() => {
        if (!pageId) return;
        setOpen((prev) => {
            const next = { ...prev };
            for (const group of SIDEBAR_GROUPS) {
                if (leafPageIds(group).includes(pageId)) {
                    next[group.id] = true;
                }
            }
            return next;
        });
    }, [pageId]);

    const toggle = (id: SidebarGroupId) => {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return { open, toggle };
}