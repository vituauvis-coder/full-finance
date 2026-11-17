export {
    calendarDayKeyFromDate,
    isPeriodConfirmedForDebit,
    monthKeyFromDate,
    parseCashOutConfirmedPeriods
} from './cash-out-periods.js';

export const DEFAULT_FINANCE_PREFERENCES = {
    manualCashOut: {
        enabled: false,
        creditCard: true,
        loan: true,
        monthlyFixed: true
    }
};

function deepMergeManual(base, patch) {
    const out = { ...base, ...patch };
    if (patch.manualCashOut && typeof patch.manualCashOut === 'object') {
        out.manualCashOut = { ...base.manualCashOut, ...patch.manualCashOut };
    }
    return out;
}

export function getFinancePreferences(userProfile) {
    let raw = userProfile?.financePreferences;
    if (raw == null || raw === '') {
        return {
            ...DEFAULT_FINANCE_PREFERENCES,
            manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut }
        };
    }
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return {
                ...DEFAULT_FINANCE_PREFERENCES,
                manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut }
            };
        }
    }
    if (typeof raw !== 'object' || raw === null) {
        return {
            ...DEFAULT_FINANCE_PREFERENCES,
            manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut }
        };
    }
    return deepMergeManual(DEFAULT_FINANCE_PREFERENCES, raw);
}

export function shouldDeferCreditCardCashOut(prefs) {
    const m = prefs?.manualCashOut;
    return !!(m?.enabled && m.creditCard);
}

export function shouldDeferLoanCashOut(prefs) {
    const m = prefs?.manualCashOut;
    return !!(m?.enabled && m.loan);
}

export function shouldDeferMonthlyFixedCashOut(prefs) {
    const m = prefs?.manualCashOut;
    return !!(m?.enabled && m.monthlyFixed);
}