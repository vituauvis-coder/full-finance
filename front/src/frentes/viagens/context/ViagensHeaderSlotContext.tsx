import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useOpenNewTrip } from '../hooks/useOpenNewTrip';

export type ViagensHeaderSlot = {
    busy: boolean;
    onNew: () => void;
};

type Ctx = {
    slot: ViagensHeaderSlot | null;
};

const ViagensHeaderSlotContext = createContext<Ctx | null>(null);

function isViagensAtlasPath(pathname: string): boolean {
    return pathname === '/viagens' || pathname === '/viagens/';
}

export function ViagensHeaderSlotProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const onAtlas = isViagensAtlasPath(pathname);
    const { openNewTrip, busy } = useOpenNewTrip();
    const openNewTripRef = useRef(openNewTrip);
    openNewTripRef.current = openNewTrip;

    const slot = useMemo<ViagensHeaderSlot | null>(() => {
        if (!onAtlas) return null;
        return {
            busy,
            onNew: () => void openNewTripRef.current()
        };
    }, [onAtlas, busy]);

    const value = useMemo<Ctx>(() => ({ slot }), [slot]);

    return <ViagensHeaderSlotContext.Provider value={value}>{children}</ViagensHeaderSlotContext.Provider>;
}

export function useViagensHeaderSlot() {
    return useContext(ViagensHeaderSlotContext)?.slot ?? null;
}