import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog';

export type ConfirmOptions = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ConfirmTone;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

type ConfirmContextValue = {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setPending({ ...options, resolve });
        });
    }, []);

    const finish = useCallback((ok: boolean) => {
        setPending((current) => {
            current?.resolve(ok);
            return null;
        });
    }, []);

    const value = useMemo(() => ({ confirm }), [confirm]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            {pending ? (
                <ConfirmDialog
                    open
                    title={pending.title}
                    message={pending.message}
                    confirmLabel={pending.confirmLabel}
                    cancelLabel={pending.cancelLabel}
                    tone={pending.tone}
                    onConfirm={() => finish(true)}
                    onCancel={() => finish(false)}
                />
            ) : null}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx;
}