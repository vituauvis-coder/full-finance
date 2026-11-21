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

export function isPeriodConfirmedForDebit(confirmedSet, date) {
    if (!confirmedSet?.size) return false;
    if (Number.isNaN(date.getTime())) return false;
    return confirmedSet.has(calendarDayKeyFromDate(date)) || confirmedSet.has(monthKeyFromDate(date));
}

/**
 * Mantém/normaliza chaves de `cashOutConfirmedPeriods` para o cronograma atual.
 * Aceita YYYY-MM-DD ou YYYY-MM (legado / confirmação antecipada) e mapeia para o
 * dia de vencimento canónico de cada parcela — evita sumir tags pagas ao editar.
 *
 * @param {Iterable<string>|null|undefined} keys
 * @param {Date[]} dues
 * @returns {string[]}
 */
export function normalizePaidPeriodKeysToDues(keys, dues) {
    if (!dues?.length) return [];
    const dayKeys = dues.map((d) => calendarDayKeyFromDate(d));
    const daySet = new Set(dayKeys);
    const monthToDay = new Map();
    for (const d of dues) {
        const mk = monthKeyFromDate(d);
        if (!monthToDay.has(mk)) monthToDay.set(mk, calendarDayKeyFromDate(d));
    }
    const out = new Set();
    for (const raw of keys || []) {
        const k = String(raw ?? '').trim();
        if (!k) continue;
        if (daySet.has(k)) {
            out.add(k);
            continue;
        }
        if (/^\d{4}-\d{2}$/.test(k) && monthToDay.has(k)) {
            out.add(monthToDay.get(k));
            continue;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
            const mk = k.slice(0, 7);
            if (monthToDay.has(mk)) out.add(monthToDay.get(mk));
        }
    }
    return [...out];
}