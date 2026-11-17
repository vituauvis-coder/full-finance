import { useCallback, useEffect, useState } from 'react';
import { loadProfileFormSnapshot } from '../domain/loadProfileSnapshot';
import type { ManualCashOutPrefs, ProfileUser } from '../types/profile';

export function useProfileData() {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileUser | null>(null);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('BRL');
    const [financePrefs, setFinancePrefs] = useState<ManualCashOutPrefs>({
        enabled: false,
        creditCard: true,
        loan: true,
        monthlyFixed: true
    });
    const [balanceInput, setBalanceInput] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const snap = await loadProfileFormSnapshot();
            setProfile(snap.profile);
            setName(snap.name);
            setCurrency(snap.currency);
            setFinancePrefs(snap.financePrefs);
            setBalanceInput(snap.balanceInput);
        } catch {
            setLoadError('Não foi possível carregar seu perfil.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    return {
        loading,
        loadError,
        profile,
        setProfile,
        name,
        setName,
        currency,
        setCurrency,
        financePrefs,
        setFinancePrefs,
        balanceInput,
        setBalanceInput,
        reload
    };
}