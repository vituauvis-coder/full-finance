import { useEffect, useRef } from 'react';
import { useFinanceData } from './FinanceDataProvider';
import { hydrateUiChipsFromUserProfile } from '../lib/uiChipPreferences';
import { setUiChipsPersistProfile } from './persistUiChips';

/** Aplica chips da conta ao carregar dados; prepara PATCH em mudanças locais. */
export function UiChipsHydrator() {
    const { data } = useFinanceData();
    const hydratedFor = useRef<string | null>(null);

    useEffect(() => {
        setUiChipsPersistProfile(data?.userProfile ?? null);
    }, [data?.userProfile]);

    useEffect(() => {
        const id = data?.userProfile?.id;
        if (!id) return;
        if (hydratedFor.current === id) return;
        hydratedFor.current = id;
        hydrateUiChipsFromUserProfile(data.userProfile);
    }, [data?.userProfile]);

    return null;
}