import { isCreditCardType, isPixBankAccountType } from './account-type.js';
import { isPeriodConfirmedForDebit, parseCashOutConfirmedPeriods } from './cash-out-periods.js';
import { movementDateToJsDate } from './movement-date.js';

const TYPE_KEYS = ['fixed', 'recurring', 'credit', 'pix'];
const STATUS_KEYS = ['paid', 'unpaid'];

function movementDate(movement) {
    return movementDateToJsDate(movement?.date);
}

function expenseIsMarkedFixed(expense) {
    return Boolean(
        expense.isFixed === true ||
            expense.isFixed === 'true' ||
            expense.isFixed === 1 ||
            expense.isFixed === '1'
    );
}

function expenseIsRecurringSeries(expense) {
    const gid = expense.recurrenceGroupId;
    return Boolean(gid != null && String(gid).trim());
}

function facetsHasSome(facets, keys) {
    return keys.some((k) => facets.has(k));
}

function expenseIsEffectivelyPaid(expense, account) {
    if (expense.isPaid !== false) return true;
    if (!account) return false;
    const d = movementDate(expense);
    if (Number.isNaN(d.getTime())) return false;
    const confirmed = parseCashOutConfirmedPeriods(expense);
    if (!confirmed.size) return false;
    return isPeriodConfirmedForDebit(confirmed, d);
}

export function expenseMatchesDashboardFacet(expense, account, facets) {
    if (!facets?.size) return false;

    const hasCreditAccount = Boolean(account && isCreditCardType(account.type));
    const pixAccount = Boolean(account && isPixBankAccountType(account.type));
    const fixed = expenseIsMarkedFixed(expense);
    const recurring = expenseIsRecurringSeries(expense);

    let typeMatches = true;
    if (facetsHasSome(facets, TYPE_KEYS)) {
        typeMatches =
            (facets.has('fixed') && fixed) ||
            (facets.has('recurring') && recurring) ||
            (facets.has('credit') && hasCreditAccount) ||
            (facets.has('pix') && pixAccount);
    }

    let statusMatches = true;
    if (facetsHasSome(facets, STATUS_KEYS)) {
        const paid = expenseIsEffectivelyPaid(expense, account);
        statusMatches = (facets.has('paid') && paid) || (facets.has('unpaid') && !paid);
    }

    return typeMatches && statusMatches;
}

export function gainMatchesDashboardFacet(gain, facets) {
    if (!facets?.size) return false;
    const received = gain.isPaid !== false;
    if (facets.has('paid') && facets.has('unpaid')) return true;
    if (facets.has('paid') && received) return true;
    if (facets.has('unpaid') && !received) return true;
    return false;
}