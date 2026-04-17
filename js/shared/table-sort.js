/**
 * Ordenação de linhas de tabelas (usa o mesmo estado { key, dir } que os cabeçalhos clicáveis).
 */
import { getExpensePerInstallmentDisplayAmount } from '../core/credit-installments.js';
import { movementDateToJsDate, movementDateToUnixSeconds } from '../core/utils.js';

/**
 * Alterna coluna/direção ao clicar no cabeçalho.
 * @param {{ key: string, dir: 'asc'|'desc' }} current
 * @param {string} newKey
 * @param {string[]} [numericDescDefault] — chaves que começam em `desc` ao trocar de coluna
 */
export function nextSortState(current, newKey, numericDescDefault = ['date', 'amount']) {
    const descDefault = new Set(numericDescDefault);
    if (current.key === newKey) {
        return { key: newKey, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    }
    return { key: newKey, dir: descDefault.has(newKey) ? 'desc' : 'asc' };
}

/** Atualiza classes e ícones Font Awesome nos `<th data-sort-key>`. */
export function syncSortableTableHeaders(tableEl, sortState, defaultDescKeys = ['date', 'amount']) {
    if (!tableEl) return;
    const ths = tableEl.querySelectorAll('thead [data-sort-key]');
    const descSet = new Set(defaultDescKeys);
    ths.forEach((th) => {
        const key = th.dataset.sortKey;
        const icon = th.querySelector('.sortable-th__icon');
        const active = key === sortState.key;
        th.classList.toggle('sortable-th--active', active);
        th.classList.toggle('sortable-th--asc', active && sortState.dir === 'asc');
        th.classList.toggle('sortable-th--desc', active && sortState.dir === 'desc');
        if (active) {
            th.setAttribute('aria-sort', sortState.dir === 'asc' ? 'ascending' : 'descending');
        } else {
            th.setAttribute('aria-sort', 'none');
        }
        if (icon) {
            icon.classList.remove('fa-sort', 'fa-sort-up', 'fa-sort-down');
            if (active) {
                icon.classList.add(sortState.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            } else {
                icon.classList.add('fa-sort');
            }
        }
    });
}

export function sortExpenseRows(list, sort, accounts) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        let cmp = 0;
        switch (sort.key) {
            case 'date': {
                const ua = a.__instSortDateUnix != null ? a.__instSortDateUnix : movementDateToUnixSeconds(a.date);
                const ub = b.__instSortDateUnix != null ? b.__instSortDateUnix : movementDateToUnixSeconds(b.date);
                cmp = ua - ub;
                break;
            }
            case 'description':
                cmp = String(a.description || '').localeCompare(String(b.description || ''), 'pt-BR');
                if (cmp === 0 && a.__instParcelIndex != null && b.__instParcelIndex != null) {
                    cmp = a.__instParcelIndex - b.__instParcelIndex;
                }
                break;
            case 'category':
                cmp = String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR');
                if (cmp === 0 && a.__instParcelIndex != null && b.__instParcelIndex != null) {
                    cmp = a.__instParcelIndex - b.__instParcelIndex;
                }
                break;
            case 'account': {
                const na = accounts.find((x) => x.id === a.accountId)?.name || '';
                const nb = accounts.find((x) => x.id === b.accountId)?.name || '';
                cmp = na.localeCompare(nb, 'pt-BR');
                if (cmp === 0 && a.__instParcelIndex != null && b.__instParcelIndex != null) {
                    cmp = a.__instParcelIndex - b.__instParcelIndex;
                }
                break;
            }
            case 'amount': {
                const accA = accounts.find((x) => x.id === a.accountId);
                const accB = accounts.find((x) => x.id === b.accountId);
                const amtA =
                    a.__instParcelAmount != null
                        ? a.__instParcelAmount
                        : getExpensePerInstallmentDisplayAmount(a, accA);
                const amtB =
                    b.__instParcelAmount != null
                        ? b.__instParcelAmount
                        : getExpensePerInstallmentDisplayAmount(b, accB);
                cmp = amtA - amtB;
                break;
            }
            case 'status': {
                const pa = a.__instRow ? (a.__instParcelPaid ? 1 : 0) : a.isPaid ? 1 : 0;
                const pb = b.__instRow ? (b.__instParcelPaid ? 1 : 0) : b.isPaid ? 1 : 0;
                cmp = pa - pb;
                if (cmp === 0) {
                    cmp =
                        (Number(a.installmentCount) || 0) - (Number(b.installmentCount) || 0);
                }
                if (cmp === 0 && a.__instParcelIndex != null && b.__instParcelIndex != null) {
                    cmp = a.__instParcelIndex - b.__instParcelIndex;
                }
                break;
            }
            default:
                cmp = 0;
        }
        return dir * cmp;
    });
}

export function sortGainRows(list, sort, accounts) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        let cmp = 0;
        switch (sort.key) {
            case 'date':
                cmp = movementDateToUnixSeconds(a.date) - movementDateToUnixSeconds(b.date);
                break;
            case 'description':
                cmp = String(a.description || '').localeCompare(String(b.description || ''), 'pt-BR');
                break;
            case 'category':
                cmp = String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR');
                break;
            case 'account': {
                const na = accounts.find((x) => x.id === a.accountId)?.name || '';
                const nb = accounts.find((x) => x.id === b.accountId)?.name || '';
                cmp = na.localeCompare(nb, 'pt-BR');
                break;
            }
            case 'amount':
                cmp = (a.amount || 0) - (b.amount || 0);
                break;
            default:
                cmp = 0;
        }
        return dir * cmp;
    });
}

/** Ordena linhas do modal de compras do cartão. */
export function sortCardPurchaseRows(list, sort, accounts = []) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        let cmp = 0;
        switch (sort.key) {
            case 'date':
                cmp = movementDateToUnixSeconds(a.date) - movementDateToUnixSeconds(b.date);
                break;
            case 'description':
                cmp = String(a.description || '').localeCompare(String(b.description || ''), 'pt-BR');
                break;
            case 'category':
                cmp = String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR');
                break;
            case 'amount': {
                const accA = accounts.find((x) => x.id === a.accountId);
                const accB = accounts.find((x) => x.id === b.accountId);
                cmp =
                    getExpensePerInstallmentDisplayAmount(a, accA) -
                    getExpensePerInstallmentDisplayAmount(b, accB);
                break;
            }
            case 'installments': {
                const na = Number(a.installmentCount) || 0;
                const nb = Number(b.installmentCount) || 0;
                cmp = na - nb;
                break;
            }
            case 'lastInstallment': {
                const la = getLastParcelSortKey(a);
                const lb = getLastParcelSortKey(b);
                cmp = la - lb;
                break;
            }
            case 'status': {
                const sa = a.isPaid === false ? 0 : 1;
                const sb = b.isPaid === false ? 0 : 1;
                cmp = sa - sb;
                break;
            }
            default:
                cmp = 0;
        }
        return dir * cmp;
    });
}

function getLastParcelSortKey(t) {
    const n = parseInt(String(t.installmentCount ?? ''), 10);
    if (!Number.isFinite(n) || n < 2) return 0;
    const d = movementDateToJsDate(t.date);
    return new Date(d.getFullYear(), d.getMonth() + (n - 1), 1).getTime();
}

export function sortSummaryRows(rows, sort) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        let cmp = 0;
        switch (sort.key) {
            case 'category':
                cmp = String(a.category || '').localeCompare(String(b.category || ''), 'pt-BR');
                break;
            case 'amount':
                cmp = (a.amount || 0) - (b.amount || 0);
                break;
            case 'percentage':
                cmp = parseFloat(String(a.percentage || '0')) - parseFloat(String(b.percentage || '0'));
                break;
            default:
                cmp = 0;
        }
        return dir * cmp;
    });
}
