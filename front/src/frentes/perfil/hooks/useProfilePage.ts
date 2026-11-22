import { profileCurrencyLabel, profileCurrencySymbol } from '@motor/conta/profile-rules.js';
import type { ManualCashOutPrefs } from '../types/profile';
import { useProfileCredentials } from './useProfileCredentials';
import { useProfileData } from './useProfileData';
import { useProfileDeleteAccount } from './useProfileDeleteAccount';
import { useProfilePhoto } from './useProfilePhoto';
import { useProfilePreferences } from './useProfilePreferences';
import { useProfileScreenColors } from './useProfileScreenColors';
import { useProfileThemeLabel } from './useProfileThemeLabel';

export { PROFILE_UPDATED_EVENT, notifyProfileUpdated } from '../../../lib/profileEvents';

export function useProfilePage() {
    const data = useProfileData();
    const themeLabel = useProfileThemeLabel();
    const photo = useProfilePhoto(data.profile, data.setProfile);
    const credentials = useProfileCredentials(data.name, data.setProfile);
    const deleteAccount = useProfileDeleteAccount();

    const patchFinancePrefs = (patch: Partial<ManualCashOutPrefs>) => {
        data.setFinancePrefs((prev) => ({ ...prev, ...patch }));
    };

    const preferences = useProfilePreferences(
        data.financePrefs,
        data.setFinancePrefs,
        data.balanceInput,
        data.setProfile
    );
    const screenColors = useProfileScreenColors(data.profile, data.setProfile);

    const saveCurrency = async (next: string) => {
        const saved = await preferences.saveCurrency(next);
        if (saved != null) data.setCurrency(saved);
    };

    const currencyLabel = profileCurrencyLabel(data.currency);

    return {
        loading: data.loading,
        profile: data.profile,
        loadError: data.loadError,
        message: credentials.message,
        name: data.name,
        setName: data.setName,
        currency: data.currency,
        saveName: credentials.saveName,
        saveCurrency,
        savePassword: credentials.savePassword,
        uploadPhoto: photo.uploadPhoto,
        removePhoto: photo.removePhoto,
        appearanceMessage: preferences.appearanceMessage,
        photoMessage: photo.photoMessage,
        passwordMessage: credentials.passwordMessage,
        savingName: credentials.savingName,
        savingCurrency: preferences.savingCurrency,
        savingPassword: credentials.savingPassword,
        photoBusy: photo.photoBusy,
        uiSoundsEnabled: preferences.uiSoundsEnabled,
        setUiSounds: preferences.setUiSounds,
        themeLabel,
        currencyLabel,
        currencySymbol: profileCurrencySymbol(data.currency),
        balanceInput: data.balanceInput,
        setBalanceInput: data.setBalanceInput,
        balanceMessage: preferences.balanceMessage,
        savingBalance: preferences.savingBalance,
        saveBalance: preferences.saveBalance,
        financePrefs: data.financePrefs,
        patchFinancePrefs,
        financeMessage: preferences.financeMessage,
        savingFinance: preferences.savingFinance,
        saveFinancePrefs: preferences.saveFinancePrefs,
        screenColorDraft: screenColors.draft,
        screenColorsDirty: screenColors.dirty,
        savingScreenColors: screenColors.saving,
        screenColorsMessage: screenColors.message,
        setScreenColor: screenColors.setScreenColor,
        resetScreenColor: screenColors.resetScreenColor,
        resetAllScreenColors: screenColors.resetAll,
        applyScreenColorPreset: screenColors.applyThemePreset,
        saveScreenColors: screenColors.save,
        ...deleteAccount
    };
}