import { getPeriodDateBounds } from '../../core/period-filters.js';
import { enumerateCalendarMonths } from '../../core/projected-period-net.js';
import { EXPENSE_COFRINHO_CATEGORY } from './constants.js';
import { referenceMonthToYearMonth, toYearMonthKey } from './pending-balance.js';

/** Eixo do gráfico de aportes: sempre os 12 meses do ano civil atual (como no dashboard). */
const INVESTMENTS_CHART_AXIS_PERIOD = 'current-year';

export function getTotalApplicationsSum(applications, expenses, buckets) {
    if (Array.isArray(expenses) && Array.isArray(buckets) && buckets.length) {
        return buckets.reduce((s, b) => s + sumAllocatedByBucket(expenses, b, applications), 0);
    }
    if (!Array.isArray(applications)) return 0;
    return applications.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
}

/**
 * Total alocado na caixinha (despesas com subcategoria = nome da caixinha).
 * @param {object[]} expenses
 * @param {object} bucket
 * @param {object[]} [applications]
 */
export function sumAllocatedByBucket(expenses, bucket, applications = []) {
    const name = bucket?.name || '';
    const fromExpenses = (expenses || [])
        .filter(
            (e) =>
                String(e.category || '').trim() === EXPENSE_COFRINHO_CATEGORY &&
                String(e.subcategory || '').trim() === name &&
                e.isPaid !== false
        )
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    if (fromExpenses > 0) return fromExpenses;
    return sumApplicationsByBucket(applications, bucket?.id);
}

/**
 * @param {object[]} applications
 * @param {string} bucketId
 */
export function sumApplicationsByBucket(applications, bucketId) {
    return (applications || [])
        .filter((a) => a.bucketId === bucketId)
        .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
}

/**
 * @param {object[]} bucketGoals
 * @param {string} bucketId
 * @param {number} year
 */
export function getBucketGoalForYear(bucketGoals, bucketId, year) {
    return (bucketGoals || []).find(
        (g) => g.bucketId === bucketId && Number(g.year) === Number(year)
    );
}

function collectMonthsFromData(applications, expenses, buckets) {
    const set = new Set();
    (applications || []).forEach((a) => {
        const ym = referenceMonthToYearMonth(a.referenceMonth);
        if (ym) set.add(ym);
    });
    if (expenses && buckets?.length) {
        (expenses || []).forEach((e) => {
            if (String(e.category || '').trim() !== EXPENSE_COFRINHO_CATEGORY) return;
            const sub = String(e.subcategory || '').trim();
            if (!sub || !buckets.some((b) => b.name === sub)) return;
            const ym = toYearMonthKey(e.date);
            if (ym) set.add(ym);
        });
    }
    return [...set].sort();
}

/**
 * @param {object[]} applications
 * @param {object[]} buckets
 * @param {object[]} [expenses]
 */
export function buildMonthlyStackedSeries(applications, buckets, expenses = []) {
    const now = new Date();
    const { startDate, endDate } = getPeriodDateBounds(INVESTMENTS_CHART_AXIS_PERIOD, now);
    const calendarMonths = enumerateCalendarMonths(startDate, endDate);

    return calendarMonths.map((mo) => {
        const ym = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
        const row = { yearMonth: ym, label: mo.label, total: 0 };
        buckets.forEach((b) => {
            let v = 0;
            if (expenses?.length) {
                v = (expenses || [])
                    .filter(
                        (e) =>
                            String(e.category || '').trim() === EXPENSE_COFRINHO_CATEGORY &&
                            String(e.subcategory || '').trim() === b.name &&
                            toYearMonthKey(e.date) === ym &&
                            e.isPaid !== false
                    )
                    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            }
            if (v <= 0) {
                v = (applications || [])
                    .filter(
                        (a) =>
                            a.bucketId === b.id && referenceMonthToYearMonth(a.referenceMonth) === ym
                    )
                    .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
            }
            row[b.id] = v;
            row.total += v;
        });
        return row;
    });
}

/**
 * @param {object[]} buckets
 * @param {object[]} applications
 * @param {object[]} [expenses]
 */
export function buildPerformanceByBucket(buckets, applications, expenses = []) {
    return (buckets || []).map((b) => {
        const investido = sumAllocatedByBucket(expenses, b, applications);
        const mult = parseFloat(b.yieldMultiplier) || 1;
        const atual = investido * mult;
        return {
            bucketId: b.id,
            name: b.name,
            investido,
            atual,
            lucro: atual - investido,
            yieldMultiplier: mult
        };
    });
}

/**
 * @param {object[]} applications
 * @param {{ bucketId?: string, yearMonth?: string, accountId?: string, year?: string, month?: string }} filters
 */
export function filterApplications(applications, filters = {}) {
    let list = [...(applications || [])];
    if (filters.bucketId) {
        list = list.filter((a) => a.bucketId === filters.bucketId);
    }
    if (filters.yearMonth) {
        list = list.filter((a) => referenceMonthToYearMonth(a.referenceMonth) === filters.yearMonth);
    }
    if (filters.year) {
        list = list.filter((a) => referenceMonthToYearMonth(a.referenceMonth).startsWith(`${filters.year}-`));
    }
    if (filters.month) {
        const m = String(filters.month).padStart(2, '0');
        list = list.filter((a) => {
            const ym = referenceMonthToYearMonth(a.referenceMonth);
            return ym.endsWith(`-${m}`);
        });
    }
    if (filters.accountId) {
        list = list.filter((a) => a.accountId === filters.accountId);
    }
    return list.sort((a, b) => {
        const da = referenceMonthToYearMonth(a.referenceMonth);
        const db = referenceMonthToYearMonth(b.referenceMonth);
        if (db !== da) return db.localeCompare(da);
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

/** Meses consecutivos (do mais recente) com aplicação > 0. */
export function countConsecutiveCofrinhoMonths(applications, expenses, buckets) {
    const months = collectMonthsFromData(applications, expenses, buckets);
    if (months.length === 0) return 0;

    const now = new Date();
    let count = 0;
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);

    for (let i = 0; i < 120; i++) {
        const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const hasApp = (applications || []).some((a) => {
            if (referenceMonthToYearMonth(a.referenceMonth) !== ym) return false;
            return (parseFloat(a.amount) || 0) > 0;
        });
        const hasExp =
            expenses &&
            buckets &&
            (expenses || []).some((e) => {
                if (toYearMonthKey(e.date) !== ym || e.isPaid === false) return false;
                if (String(e.category || '').trim() !== EXPENSE_COFRINHO_CATEGORY) return false;
                const sub = String(e.subcategory || '').trim();
                return sub && buckets.some((b) => b.name === sub);
            });
        if (!hasApp && !hasExp) break;
        count++;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    }
    return count;
}

function formatMonthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const short = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const cap = short.charAt(0).toUpperCase() + short.slice(1);
    return `${cap}/${String(y % 100).padStart(2, '0')}`;
}

export function formatYearMonthLabel(ym) {
    return formatMonthLabel(ym);
}
