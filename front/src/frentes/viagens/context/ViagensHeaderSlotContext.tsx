import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

export function ViagensHeaderSlotProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const onViagens = pathname.startsWith('/viagens');
    const [slot, setSlot] = useState<ViagensHeaderSlot | null>(null);
    const openNewTrip = useOpenNewTrip();
    const openNewTripRef = useRef(openNewTrip);
    openNewTripRef.current = openNewTrip;

    useEffect(() => {
        if (!onViagens) {
            setSlot(null);
            return;
        }
        setSlot({
            busy: false,
            onNew: () => openNewTripRef.current()
        });
    }, [onViagens]);

    const value = useMemo<Ctx>(() => ({ slot }), [slot]);

    return <ViagensHeaderSlotContext.Provider value={value}>{children}</ViagensHeaderSlotContext.Provider>;
}

export function useViagensHeaderSlot() {
    return useContext(ViagensHeaderSlotContext)?.slot ?? null;
}