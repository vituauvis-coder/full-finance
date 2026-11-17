import { useEffect, useState } from 'react';
import { fetchProfile } from '../../../lib/profileHttp';
import { PROFILE_UPDATED_EVENT } from '../../../lib/profileEvents';
import {
    sidebarProfileFromEmail,
    type SidebarProfileView
} from '../../../lib/sidebarProfileDisplay';

export function useSidebarProfileLabel(email: string, photoUrl?: string | null) {
    const [view, setView] = useState<SidebarProfileView>(() => sidebarProfileFromEmail(email));

    useEffect(() => {
        let cancelled = false;
        const sync = async () => {
            try {
                const data = await fetchProfile();
                if (cancelled) return;
                const savedName = (data.name || '').trim();
                const next = savedName
                    ? {
                          title: savedName,
                          subtitle: email,
                          initial: savedName.charAt(0).toUpperCase()
                      }
                    : sidebarProfileFromEmail(email);
                setView(next);
                const img = document.getElementById('sidebar-user-photo') as HTMLImageElement | null;
                if (img) {
                    if (data.profilePhotoURL) img.src = data.profilePhotoURL;
                    else img.removeAttribute('src');
                }
            } catch {
                if (!cancelled) setView(sidebarProfileFromEmail(email));
            }
        };
        void sync();
        window.addEventListener(PROFILE_UPDATED_EVENT, sync);
        return () => {
            cancelled = true;
            window.removeEventListener(PROFILE_UPDATED_EVENT, sync);
        };
    }, [email, photoUrl]);

    return view;
}