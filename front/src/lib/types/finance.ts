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
    tripId?: string | null;
    tripExpenseId?: string | null;
    paidFromCofrinho?: boolean;
    paid_from_cofrinho?: boolean;
};

export type Account = {
    id: string;
    name: string;
    userId?: string;
    holderUserId?: string | null;
    holderUserName?: string | null;
    holderName?: string | null;
    type?: string;
    balance?: number;
    initialBalance?: number;
    limit?: number;
    dueDay?: number;
    dueDate?: number;
    closeDay?: number;
    closingDay?: number;
    linkedAccountId?: string;
    plasticColor?: string;
    plasticTone?: string;
    /** Papéis na carteira (corrente, crédito, VA…). Vazio = inferir do `type`. */
    walletFunctions?: string[];
    /** Saldo exibido no dashboard/carteira vem desta conta quando true. */
    isPrimaryCash?: boolean;
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

export type CofrinhoTripPayloadOutflow = {
    tripId: string;
    tripTitle?: string;
    tripExpenseId: string;
    financeExpenseId?: string;
    amount: number;
    description: string;
    spentOn?: string;
    accountId?: string;
};

export type FinanceData = {
    userProfile: UserProfile | null;
    userAccounts: Account[];
    userExpenses: Movement[];
    userGains: Movement[];
    cofrinhoBuckets: unknown[];
    cofrinhoApplications: unknown[];
    cofrinhoBucketGoals: unknown[];
    cofrinhoMonthlyBalances?: unknown[];
    /** Gastos “Debitar da meta” ainda só no payload da viagem. */
    cofrinhoTripPayloadOutflows?: CofrinhoTripPayloadOutflow[];
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