import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Ctx = {
    requestNewDebt: () => void;
    registerOpenCreate: (fn: () => void) => void;
};

const DebtsHeaderSlotContext = createContext<Ctx | null>(null);

export function DebtsHeaderSlotProvider({ children }: { children: ReactNode }) {
    const openCreateRef = useRef<() => void>(() => {});

    const registerOpenCreate = useCallback((fn: () => void) => {
        openCreateRef.current = fn;
    }, []);

    const requestNewDebt = useCallback(() => {
        openCreateRef.current();
    }, []);

    const value = useMemo(() => ({ requestNewDebt, registerOpenCreate }), [requestNewDebt, registerOpenCreate]);

    return <DebtsHeaderSlotContext.Provider value={value}>{children}</DebtsHeaderSlotContext.Provider>;
}

export function useDebtsRequestNewDebt() {
    const ctx = useContext(DebtsHeaderSlotContext);
    return ctx?.requestNewDebt ?? (() => {});
}

export function useDebtsHeaderRegistration(onAdd: () => void) {
    const ctx = useContext(DebtsHeaderSlotContext);
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    useEffect(() => {
        if (!ctx) return;
        ctx.registerOpenCreate(() => onAddRef.current());
        return () => ctx.registerOpenCreate(() => {});
    }, [ctx]);
}