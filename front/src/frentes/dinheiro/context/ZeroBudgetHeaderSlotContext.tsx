import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Ctx = {
    requestNewBlock: () => void;
    registerOpenCreate: (fn: () => void) => void;
};

const ZeroBudgetHeaderSlotContext = createContext<Ctx | null>(null);

export function ZeroBudgetHeaderSlotProvider({ children }: { children: ReactNode }) {
    const openCreateRef = useRef<() => void>(() => {});

    const registerOpenCreate = useCallback((fn: () => void) => {
        openCreateRef.current = fn;
    }, []);

    const requestNewBlock = useCallback(() => {
        openCreateRef.current();
    }, []);

    const value = useMemo(
        () => ({ requestNewBlock, registerOpenCreate }),
        [requestNewBlock, registerOpenCreate]
    );

    return <ZeroBudgetHeaderSlotContext.Provider value={value}>{children}</ZeroBudgetHeaderSlotContext.Provider>;
}

export function useZeroBudgetRequestNewBlock() {
    const ctx = useContext(ZeroBudgetHeaderSlotContext);
    return ctx?.requestNewBlock ?? (() => {});
}

export function useZeroBudgetHeaderRegistration(onAdd: () => void) {
    const ctx = useContext(ZeroBudgetHeaderSlotContext);
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    useEffect(() => {
        if (!ctx) return;
        ctx.registerOpenCreate(() => onAddRef.current());
        return () => ctx.registerOpenCreate(() => {});
    }, [ctx]);
}