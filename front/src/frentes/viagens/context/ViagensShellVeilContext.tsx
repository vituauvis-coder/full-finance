import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const ViagensShellLoadingContext = createContext(false);
const ViagensShellSetLoadingContext = createContext<((loading: boolean) => void) | null>(null);

export function ViagensShellVeilProvider({ children }: { children: ReactNode }) {
    const [contentLoading, setContentLoading] = useState(false);

    return (
        <ViagensShellSetLoadingContext.Provider value={setContentLoading}>
            <ViagensShellLoadingContext.Provider value={contentLoading}>{children}</ViagensShellLoadingContext.Provider>
        </ViagensShellSetLoadingContext.Provider>
    );
}

/** Sincroniza carregamento da página atual com o skeleton do app-header. */
export function useViagensContentLoading(loading: boolean) {
    const setContentLoading = useContext(ViagensShellSetLoadingContext);

    useEffect(() => {
        if (!setContentLoading) return;
        setContentLoading(loading);
        return () => setContentLoading(false);
    }, [loading, setContentLoading]);
}

export function useViagensShellVeilState(): boolean {
    return useContext(ViagensShellLoadingContext);
}