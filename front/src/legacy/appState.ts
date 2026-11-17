/** Espelha `AppState` do legado para módulos JS existentes. */
export type LegacyAppState = {
    currentUser: { uid: string; email?: string; name?: string; role?: string } | null;
    userProfile: Record<string, unknown> | null;
    accounts: unknown[];
    expenses: unknown[];
    gains: unknown[];
    cofrinhoBuckets: unknown[];
    cofrinhoApplications: unknown[];
    cofrinhoBucketGoals: unknown[];
    debts: unknown[];
    debtUpdates: unknown[];
    expenseSplitRequests: { incoming: unknown[]; outgoing: unknown[] };
    userNotifications: unknown[];
    household: unknown;
    householdMembers: unknown[];
    currency: string;
};

export const legacyAppState: LegacyAppState = {
    currentUser: null,
    userProfile: null,
    accounts: [],
    expenses: [],
    gains: [],
    cofrinhoBuckets: [],
    cofrinhoApplications: [],
    cofrinhoBucketGoals: [],
    debts: [],
    debtUpdates: [],
    expenseSplitRequests: { incoming: [], outgoing: [] },
    userNotifications: [],
    household: null,
    householdMembers: [],
    currency: 'BRL'
};

declare global {
    interface Window {
        AppState?: LegacyAppState;
    }
}

export function publishAppState() {
    window.AppState = legacyAppState;
}