import { patchProfile } from '../frentes/perfil/api/profileApi';
import {
    buildFinancePreferencesWithUiChips,
    snapshotUiChipsFromLocalStorage
} from '../lib/uiChipPreferences';
import type { UserProfile } from '../lib/types/finance';

let profileForSave: UserProfile | null | undefined = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function setUiChipsPersistProfile(profile: UserProfile | null | undefined) {
    profileForSave = profile;
}

/** Salva chips no servidor (debounce) — mesmo contrato que preferências de caixa. */
export function scheduleUiChipsPersistToServer() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void flushUiChipsPersistToServer();
    }, 800);
}

export async function flushUiChipsPersistToServer() {
    const profile = profileForSave;
    if (!profile?.id) return;
    try {
        const uiChips = snapshotUiChipsFromLocalStorage();
        await patchProfile({
            financePreferences: buildFinancePreferencesWithUiChips(profile, uiChips)
        });
    } catch (err) {
        console.warn('[uiChips] falha ao sincronizar preferências', err);
    }
}