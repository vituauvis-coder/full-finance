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
    dueDate?: number;
    closeDay?: number;
    closingDay?: number;
    linkedAccountId?: string;
    plasticColor?: string;
    plasticTone?: string;
};

export type SplitUserRef = {
    id?: string;
    name?: string | null;
    email?: string | null;
};

export type SplitSourceExpense = {
    id?: string;
    description?: string;
    amount?: number;
    date?: string | { seconds?: number };
    category?: string;
    subcategory?: string;
    isCofrinho?: boolean;
    isFixed?: boolean;
    installmentCount?: number;
    recurrenceGroupId?: string | null;
};

export type ExpenseSplitRequest = {
    id: string;
    sourceExpenseId?: string;
    amount?: number;
    status?: string;
    splitScope?: string;
    targetInstallmentIndex?: number | null;
    targetPeriodKey?: string | null;
    sourceInstallmentCount?: number | null;
    requesterCreditAccountId?: string | null;
    requester?: SplitUserRef;
    recipient?: SplitUserRef;
    sourceExpense?: SplitSourceExpense | null;
    createdAt?: string;
};

export type SplitBundle = {
    incoming: ExpenseSplitRequest[];
    outgoing: ExpenseSplitRequest[];
};

/** Pré-preenchimento do modal de saída ao aceitar um rateio. */
export type ExpenseSplitSeed = {
    splitRequestId: string;
    splitAmount: number;
    splitScope?: string;
    sourceExpense?: SplitSourceExpense | null;
    sourceInstallmentCount?: number;
};

export type TravelDocument = {
    cpf?: string;
    passportNumber?: string;
    passportExpiresOn?: string;
    birthDate?: string;
};

export type HouseholdMemberRow = {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    travelDocument?: TravelDocument;
};

export type UserProfile = {
    id?: string;
    email?: string;
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
    householdMembers: HouseholdMemberRow[];
};

export type DashboardFlow = 'gains' | 'expenses';

export type DashboardFacets = {
    gains: Set<'paid' | 'unpaid'>;
    expenses: Set<'paid' | 'unpaid' | 'fixed' | 'recurring' | 'credit' | 'pix'>;
};