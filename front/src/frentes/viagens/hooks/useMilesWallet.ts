import { useCallback, useEffect, useRef, useState } from 'react';
import { parseFinancePreferencesRaw } from '@motor/dinheiro/ui-chip-preferences.js';
import { defaultMilesWallet, normalizeMilesWallet } from '@motor/viagens/miles-wallet.js';
import { getFinancePreferences } from '../../../lib/financePreferences';
import { fetchProfile, patchProfile } from '../../perfil/api/profileApi';

export type MilesProgram = {
    id: string;
    brand: string;
    name: string;
    balance: number;
    milheiroBrl: number;
    updatedAt?: string | null;
};

export type MilesWallet = { programs: MilesProgram[] };

export function useMilesWallet() {
    const [wallet, setWallet] = useState<MilesWallet>(defaultMilesWallet() as MilesWallet);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(wallet);
    latest.current = wallet;

    const load = useCallback(async () => {
        try {
            const profile = await fetchProfile();
            const prefs = getFinancePreferences(profile) as { viagensMiles?: unknown };
            setWallet(normalizeMilesWallet(prefs.viagensMiles) as MilesWallet);
        } catch {
            setWallet(defaultMilesWallet() as MilesWallet);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const write = useCallback(async (next: MilesWallet) => {
        setSaving(true);
        try {
            const profile = await fetchProfile();
            const raw = parseFinancePreferencesRaw(profile) as Record<string, unknown>;
            await patchProfile({
                financePreferences: {
                    ...raw,
                    viagensMiles: next
                } as never
            });
        } catch {
            /* carteira fica local até a próxima tentativa */
        } finally {
            setSaving(false);
        }
    }, []);

    const persist = useCallback(
        (next: MilesWallet) => {
            setWallet(next);
            latest.current = next;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                void write(next);
            }, 700);
        },
        [write]
    );

    useEffect(
        () => () => {
            if (!timer.current) return;
            clearTimeout(timer.current);
            timer.current = null;
            const next = latest.current;
            void (async () => {
                try {
                    const profile = await fetchProfile();
                    const raw = parseFinancePreferencesRaw(profile) as Record<string, unknown>;
                    await patchProfile({
                        financePreferences: {
                            ...raw,
                            viagensMiles: next
                        } as never
                    });
                } catch {
                    /* ignore */
                }
            })();
        },
        []
    );

    return { wallet, loading, saving, persist, reload: load };
}
