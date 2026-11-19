export type ManualCashOutPrefs = {
    enabled: boolean;
    creditCard: boolean;
    loan: boolean;
    monthlyFixed: boolean;
};

export type MilesProgramPayload = {
    id: string;
    brand: string;
    name: string;
    balance: number;
    milheiroBrl: number;
    updatedAt?: string | null;
};

export type ViagensMilesPayload = {
    programs: MilesProgramPayload[];
};

export type FinancePreferencesPayload = {
    manualCashOut: ManualCashOutPrefs;
    viagensMiles?: ViagensMilesPayload;
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