import { isCreditCardType, isPixBankAccountType } from './utils.js';

/** Lançamento marcado como despesa essencial (`isFixed` na API; mesma convenção da lista de saídas). */
export function expenseIsMarkedFixed(expense) {
    if (!expense) return false;
    return Boolean(
        expense.isFixed === true ||
            expense.isFixed === 'true' ||
            expense.isFixed === 1 ||
            expense.isFixed === '1'
    );
}

/** Série mensal / parcelada (`recurrenceGroupId`), mesma convenção de `credit-installments.js`. */
export function expenseIsRecurringSeries(expense) {
    const gid = expense?.recurrenceGroupId;
    return Boolean(gid != null && String(gid).trim());
}

const TYPE_KEYS = /** @type {const} */ ([
    'fixed',
    'variable',
    'credit',
    'pix',
    'other',
    'recurring'
]);
const STATUS_KEYS = /** @type {const} */ (['paid', 'unpaid']);

/** Valores `data-facet` para estado (rótulos distintos no DOM: Recebido/Pago × Pendente). */
export const DASHBOARD_STATUS_FACET_IDS = STATUS_KEYS;

/** Valores válidos para `data-facet` nos chips do painel (persistência e validação). */
export const DASHBOARD_EXPENSE_FACET_IDS = /** @type {const} */ ([
    ...TYPE_KEYS,
    ...STATUS_KEYS
]);

/**
 * Critério de agregação das **saídas** no painel conforme só as facetas do grupo Saída (`expenses`):
 * — parcelas/lançamentos conforme pago/pendente/tudo (ver `reports.js`).
 * — Sem nenhum chip em Saída: lista vazia no painel (não exibe totais até seleccionar estado).
 */
export function dashOutflowCardSummationMode(facets) {
    if (!facets?.size) return 'paid_through';
    const touchesStatus = STATUS_KEYS.some((k) => facets.has(k));
    if (!touchesStatus) return 'paid_through';
    const paid = facets.has('paid');
    const unpaid = facets.has('unpaid');
    if (paid && unpaid) return 'all_slices';
    if (unpaid && !paid) return 'pending_due';
    return 'paid_through';
}

function facetsHasSome(facets, keys) {
    return keys.some((k) => facets.has(k));
}

/**
 * Filtros do painel sobre saídas:
 * — **Tipo**: OR entre facetas seleccionadas; se nenhuma de tipo está activa, não restringe por tipo.
 * — **Saída** (estado): pago ⇒ `isPaid !== false`; pendente ⇒ `isPaid === false`. Com «Pago» e «Pendente» aos dois ligados (= OR), passam todas.
 * — Tipo × pagamento com **AND** (alinhado aos filtros rápidos da lista de saídas).
 */
export function expenseMatchesAnyDashboardFacet(expense, account, facets) {
    if (!facets || facets.size === 0) return true;

    const hasCreditAccount = Boolean(account && isCreditCardType(account.type));
    const pixAccount = Boolean(account && isPixBankAccountType(account.type));
    const fixed = expenseIsMarkedFixed(expense);
    const recurring = expenseIsRecurringSeries(expense);

    let typeMatches = true;
    if (facetsHasSome(facets, TYPE_KEYS)) {
        typeMatches =
            (facets.has('fixed') && fixed) ||
            (facets.has('variable') && !fixed) ||
            (facets.has('credit') && hasCreditAccount) ||
            (facets.has('pix') && pixAccount) ||
            (facets.has('other') && !fixed && !hasCreditAccount) ||
            (facets.has('recurring') && recurring);
    }

    let statusMatches = true;
    if (facetsHasSome(facets, STATUS_KEYS)) {
        const isPaidExpense = expense.isPaid !== false;
        statusMatches =
            (facets.has('paid') && isPaidExpense) || (facets.has('unpaid') && expense.isPaid === false);
    }

    return typeMatches && statusMatches;
}

export function filterExpensesForDashboardFacets(expenses, accounts, facets) {
    if (!facets || facets.size === 0) return [];
    const byId = new Map((accounts || []).map((a) => [a.id, a]));
    return (expenses || []).filter((e) =>
        expenseMatchesAnyDashboardFacet(e, byId.get(e.accountId), facets)
    );
}

/**
 * Estado aplicado às **entradas** só pelos chips do grupo Entrada (`gains`):
 * recebido ⇒ `isPaid !== false`; pendente ⇒ `isPaid === false`.
 * Sem chip em Entrada: lista vazia no painel.
 */
export function filterGainsForDashboardFacets(gains, facets) {
    if (!facets?.size) return [];

    let statusMatchesAll = () => true;
    if (facetsHasSome(facets, STATUS_KEYS)) {
        statusMatchesAll = (g) => {
            const received = g.isPaid !== false;
            return (
                (facets.has('paid') && received) || (facets.has('unpaid') && g.isPaid === false)
            );
        };
    }

    return (gains || []).filter((g) => statusMatchesAll(g));
}
