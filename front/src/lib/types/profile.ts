export type ManualCashOutPrefs = {
    enabled: boolean;
    creditCard: boolean;
    loan: boolean;
    monthlyFixed: boolean;
};

export type FinancePreferencesPayload = {
    manualCashOut: ManualCashOutPrefs;
};

export type ProfileUser = {
    id?: string;
    email?: string;
    name?: string;
    currency?: string;
    profilePhotoURL?: string | null;
    role?: string;
    financePreferences?: FinancePreferencesPayload | string | null;
    balanceOffset?: number;
};