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

function coercePrefsObject(value) {
    let raw = value;
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return {};
        }
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return { ...raw };
}

/** Junta PATCH de preferências sem apagar milhas, chips ou caixa. */
export function mergeFinancePreferences(existing, patch) {
    const a = coercePrefsObject(existing);
    const b = coercePrefsObject(patch);
    const out = { ...a, ...b };
    if (b.manualCashOut && typeof b.manualCashOut === 'object') {
        out.manualCashOut = { ...(a.manualCashOut && typeof a.manualCashOut === 'object' ? a.manualCashOut : {}), ...b.manualCashOut };
    }
    if (b.screenAccents && typeof b.screenAccents === 'object' && !Array.isArray(b.screenAccents)) {
        const base =
            a.screenAccents && typeof a.screenAccents === 'object' && !Array.isArray(a.screenAccents)
                ? a.screenAccents
                : {};
        out.screenAccents = { ...base, ...b.screenAccents };
        for (const [k, v] of Object.entries(out.screenAccents)) {
            if (v == null || v === '') delete out.screenAccents[k];
        }
        if (Object.keys(out.screenAccents).length === 0) delete out.screenAccents;
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