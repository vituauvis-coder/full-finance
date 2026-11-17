export type Movement = {
    id: string;
    amount: number;
    description?: string;
    category?: string;
    subcategory?: string;
    installmentCount?: number;
    date?: string | { seconds?: number };
    isPaid?: boolean;
    accountId?: string;
    isFixed?: boolean | string | number;
    recurrenceGroupId?: string | null;
    referenceOnly?: boolean;
    cashOutConfirmedPeriods?: string | string[] | null;
    isCofrinho?: boolean;
    splitRequestId?: string | null;
};

export type Account = {
    id: string;
    name: string;
    type?: string;
    balance?: number;
    limit?: number;
    dueDay?: number;
    closeDay?: number;
    linkedAccountId?: string;
    plasticColor?: string;
    plasticTone?: string;
};

export type SplitBundle = {
    incoming: unknown[];
    outgoing: unknown[];
};

export type UserProfile = {
    currency?: string;
    name?: string;
    profilePhotoURL?: string;
    financePreferences?: Record<string, unknown>;
};

export type FinanceData = {
    userProfile: UserProfile | null;
    userAccounts: Account[];
    userExpenses: Movement[];
    userGains: Movement[];
    cofrinhoBuckets: unknown[];
    cofrinhoApplications: unknown[];
    cofrinhoBucketGoals: unknown[];
    userDebts: unknown[];
    userDebtUpdates: unknown[];
    expenseSplitRequests: SplitBundle;
    userNotifications: unknown[];
    household: unknown;
    householdMembers: unknown[];
};

export type DashboardFlow = 'gains' | 'expenses';

export type DashboardFacets = {
    gains: Set<'paid' | 'unpaid'>;
    expenses: Set<'paid' | 'unpaid' | 'fixed' | 'recurring' | 'credit' | 'pix'>;
};