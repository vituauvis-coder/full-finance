import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Ctx = {
    requestNewBucket: () => void;
    registerOpenCreate: (fn: () => void) => void;
};

const CofrinhosHeaderSlotContext = createContext<Ctx | null>(null);

export function CofrinhosHeaderSlotProvider({ children }: { children: ReactNode }) {
    const openCreateRef = useRef<() => void>(() => {});

    const registerOpenCreate = useCallback((fn: () => void) => {
        openCreateRef.current = fn;
    }, []);

    const requestNewBucket = useCallback(() => {
        openCreateRef.current();
    }, []);

    const value = useMemo(
        () => ({ requestNewBucket, registerOpenCreate }),
        [requestNewBucket, registerOpenCreate]
    );

    return <CofrinhosHeaderSlotContext.Provider value={value}>{children}</CofrinhosHeaderSlotContext.Provider>;
}

export function useCofrinhosRequestNewBucket() {
    const ctx = useContext(CofrinhosHeaderSlotContext);
    return ctx?.requestNewBucket ?? (() => {});
}

export function useCofrinhosHeaderRegistration(onAdd: () => void) {
    const ctx = useContext(CofrinhosHeaderSlotContext);
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    useEffect(() => {
        if (!ctx) return;
        ctx.registerOpenCreate(() => onAddRef.current());
        return () => ctx.registerOpenCreate(() => {});
    }, [ctx]);
}