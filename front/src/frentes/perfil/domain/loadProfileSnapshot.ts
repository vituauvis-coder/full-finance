import { getFinancePreferences } from '../../../lib/financePreferences';
import { formatBalanceInputValue } from '@motor/conta/profile-rules.js';
import { fetchProfile } from '../api/profileApi';
import type { ManualCashOutPrefs, ProfileUser } from '../types/profile';
import { fetchProfilePeriodBalance } from './profileBalance';

export type ProfileFormSnapshot = {
    profile: ProfileUser;
    name: string;
    currency: string;
    financePrefs: ManualCashOutPrefs;
    balanceInput: string;
};

export async function loadProfileFormSnapshot(): Promise<ProfileFormSnapshot> {
    const profile = await fetchProfile();
    const balance = await fetchProfilePeriodBalance();
    return {
        profile,
        name: profile.name ?? '',
        currency: profile.currency ?? 'BRL',
        financePrefs: { ...getFinancePreferences(profile).manualCashOut },
        balanceInput: formatBalanceInputValue(balance ?? 0)
    };
}