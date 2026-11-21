import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

type Ctx = {
    requestNewAccount: () => void;
    registerOpenCreate: (fn: () => void) => void;
};

const WalletHeaderSlotContext = createContext<Ctx | null>(null);

export function WalletHeaderSlotProvider({ children }: { children: ReactNode }) {
    const openCreateRef = useRef<(() => void)>(() => {});

    const registerOpenCreate = useCallback((fn: () => void) => {
        openCreateRef.current = fn;
    }, []);

    const requestNewAccount = useCallback(() => {
        openCreateRef.current();
    }, []);

    const value = useMemo(
        () => ({ requestNewAccount, registerOpenCreate }),
        [requestNewAccount, registerOpenCreate]
    );

    return <WalletHeaderSlotContext.Provider value={value}>{children}</WalletHeaderSlotContext.Provider>;
}

export function useWalletRequestNewAccount() {
    const ctx = useContext(WalletHeaderSlotContext);
    return ctx?.requestNewAccount ?? (() => {});
}

export function useWalletHeaderRegistration(onAdd: () => void) {
    const ctx = useContext(WalletHeaderSlotContext);
    const onAddRef = useRef(onAdd);
    onAddRef.current = onAdd;

    useEffect(() => {
        if (!ctx) return;
        ctx.registerOpenCreate(() => onAddRef.current());
        return () => ctx.registerOpenCreate(() => {});
    }, [ctx]);
}