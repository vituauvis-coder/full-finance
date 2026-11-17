import { useState, type FormEvent } from 'react';
import { isUiSoundEnabled, playPingSound, setUiSoundEnabled } from '../../../app/uiSounds';
import { getFinancePreferences } from '../../../lib/financePreferences';
import { parseBalanceSubmit } from '@motor/conta/profile-rules.js';
import { patchProfile, postProfileBalance } from '../api/profileApi';
import type { ManualCashOutPrefs, ProfileUser } from '../types/profile';
import { notifyProfileUpdated } from '../../../lib/profileEvents';

export function useProfilePreferences(
    financePrefs: ManualCashOutPrefs,
    setFinancePrefs: (next: ManualCashOutPrefs) => void,
    balanceInput: string,
    setProfile: (next: ProfileUser) => void
) {
    const [appearanceMessage, setAppearanceMessage] = useState<string | null>(null);
    const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
    const [financeMessage, setFinanceMessage] = useState<string | null>(null);
    const [savingCurrency, setSavingCurrency] = useState(false);
    const [savingBalance, setSavingBalance] = useState(false);
    const [savingFinance, setSavingFinance] = useState(false);
    const [uiSoundsEnabled, setUiSoundsEnabledState] = useState(() => isUiSoundEnabled());

    const saveCurrency = async (next: string) => {
        setSavingCurrency(true);
        setAppearanceMessage(null);
        try {
            const updated = await patchProfile({ currency: next });
            setProfile(updated);
            notifyProfileUpdated();
            setAppearanceMessage('Moeda atualizada.');
            playPingSound();
            return updated.currency ?? next;
        } catch {
            setAppearanceMessage('Não foi possível atualizar a moeda.');
            return null;
        } finally {
            setSavingCurrency(false);
        }
    };

    const saveBalance = async (e: FormEvent) => {
        e.preventDefault();
        const parsed = parseBalanceSubmit(balanceInput);
        if (!parsed.ok) return;
        setSavingBalance(true);
        setBalanceMessage(null);
        try {
            await postProfileBalance(parsed.balance);
            setBalanceMessage('Saldo atualizado.');
            playPingSound();
            notifyProfileUpdated();
        } catch {
            setBalanceMessage('Erro ao atualizar saldo. Tente novamente.');
        } finally {
            setSavingBalance(false);
        }
    };

    const saveFinancePrefs = async (e: FormEvent) => {
        e.preventDefault();
        setSavingFinance(true);
        setFinanceMessage(null);
        try {
            const updated = await patchProfile({
                financePreferences: { manualCashOut: { ...financePrefs } }
            });
            setProfile(updated);
            setFinancePrefs({ ...getFinancePreferences(updated).manualCashOut });
            setFinanceMessage('Preferências de caixa salvas.');
            playPingSound();
            notifyProfileUpdated();
        } catch {
            setFinanceMessage('Não foi possível salvar. Tente novamente.');
        } finally {
            setSavingFinance(false);
        }
    };

    const setUiSounds = (on: boolean) => {
        setUiSoundEnabled(on);
        setUiSoundsEnabledState(on);
        if (on) playPingSound();
    };

    return {
        appearanceMessage,
        balanceMessage,
        financeMessage,
        savingCurrency,
        savingBalance,
        savingFinance,
        uiSoundsEnabled,
        saveCurrency,
        saveBalance,
        saveFinancePrefs,
        setUiSounds
    };
}