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

export type TravelDocumentPayload = {
    cpf?: string;
    passportNumber?: string;
    passportExpiresOn?: string;
    birthDate?: string;
};

export type FinancePreferencesPayload = {
    manualCashOut: ManualCashOutPrefs;
    viagensMiles?: ViagensMilesPayload;
    travelDocument?: TravelDocumentPayload;
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