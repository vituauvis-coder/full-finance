/**
 * Preferências de caixa: débito no saldo só após marcar pagamento (fatura/parcelas, empréstimo, mensais).
 */

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

/**
 * @param {object|null|undefined} userProfile — user doc da API (financePreferences pode ser string JSON)
 * @returns {typeof DEFAULT_FINANCE_PREFERENCES}
 */
export function getFinancePreferences(userProfile) {
    let raw = userProfile?.financePreferences;
    if (raw == null || raw === '') return { ...DEFAULT_FINANCE_PREFERENCES, manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut } };
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return { ...DEFAULT_FINANCE_PREFERENCES, manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut } };
        }
    }
    if (typeof raw !== 'object' || raw === null) {
        return { ...DEFAULT_FINANCE_PREFERENCES, manualCashOut: { ...DEFAULT_FINANCE_PREFERENCES.manualCashOut } };
    }
    return deepMergeManual(DEFAULT_FINANCE_PREFERENCES, raw);
}

export function parseCashOutConfirmedPeriods(expense) {
    const raw = expense?.cashOutConfirmedPeriods;
    if (raw == null || raw === '') return new Set();
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.map((x) => String(x).trim()).filter(Boolean));
    } catch {
        return new Set();
    }
}

export function monthKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function calendarDayKeyFromDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Período confirmado para débito (dia ou mês). */
export function isPeriodConfirmedForDebit(confirmedSet, date) {
    if (!(confirmedSet instanceof Set) || confirmedSet.size === 0) return false;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return false;
    const day = calendarDayKeyFromDate(d);
    const month = monthKeyFromDate(d);
    return confirmedSet.has(day) || confirmedSet.has(month);
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
