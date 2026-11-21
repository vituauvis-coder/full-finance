import { useCallback, useState } from 'react';

export function useDebtsModals() {
    const [createOpen, setCreateOpen] = useState(false);
    const [registerDebtId, setRegisterDebtId] = useState<string | null>(null);
    const [settingsDebtId, setSettingsDebtId] = useState<string | null>(null);

    const openCreate = useCallback(() => setCreateOpen(true), []);
    const closeCreate = useCallback(() => setCreateOpen(false), []);

    const openRegister = useCallback((debtId: string) => setRegisterDebtId(debtId), []);
    const closeRegister = useCallback(() => setRegisterDebtId(null), []);

    const openSettings = useCallback((debtId: string) => setSettingsDebtId(debtId), []);
    const closeSettings = useCallback(() => setSettingsDebtId(null), []);

    return {
        createOpen,
        registerDebtId,
        settingsDebtId,
        openCreate,
        closeCreate,
        openRegister,
        closeRegister,
        openSettings,
        closeSettings
    };
}