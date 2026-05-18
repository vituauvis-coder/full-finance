// Camada de dados local (substitui Firestore)
import { api, apiUpload } from '../api-client.js';
import { playPingSound, playTrashSound } from '../core/ui-sounds.js';

export {
    calculateAllBalances,
    computeCashBalanceTotalAsOf,
    computeCashBalanceChangeCurrentMonth
} from '../core/cash-balance.js';

function serializeDate(d) {
    if (d == null) return new Date().toISOString();
    if (typeof d.toDate === 'function') return d.toDate().toISOString();
    if (typeof d === 'object' && d.seconds != null) return new Date(d.seconds * 1000).toISOString();
    if (typeof d === 'string') return d;
    return new Date(d).toISOString();
}

/**
 * Busca todos os dados do usuário.
 */
export async function fetchAllData(userId) {
    if (!userId) return {};
    try {
        const data = await api('/api/data');
        return {
            userProfile: data.userProfile,
            userAccounts: data.userAccounts || [],
            userExpenses: data.userExpenses || [],
            userGains: data.userGains || [],
            cofrinhoBuckets: data.cofrinhoBuckets || [],
            cofrinhoApplications: data.cofrinhoApplications || [],
            cofrinhoBucketGoals: data.cofrinhoBucketGoals || [],
            userDebts: data.userDebts || [],
            userDebtUpdates: data.userDebtUpdates || [],
            expenseSplitRequests: data.expenseSplitRequests || { incoming: [], outgoing: [] },
            userNotifications: data.userNotifications || []
        };
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        return {};
    }
}

/**
 * @param {string} collectionName
 * @param {object} data
 * @param {string|null|undefined} docId
 * @param {{ skipUiSound?: boolean }} [options]
 */
async function saveDocument(collectionName, data, docId, options = {}) {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, 'date') && payload.date != null) {
        payload.date = serializeDate(payload.date);
    }

    const paths = {
        expenses: '/api/expenses',
        gains: '/api/gains',
        accounts: '/api/accounts',
        cofrinhoBuckets: '/api/cofrinho-buckets',
        cofrinhoApplications: '/api/cofrinho-applications',
        cofrinhoAllocations: '/api/cofrinho-applications',
        cofrinhoBucketGoals: '/api/cofrinho-bucket-goals',
        debts: '/api/debts',
        debtUpdates: '/api/debt-updates'
    };
    const basePath = paths[collectionName];
    if (!basePath) throw new Error('Coleção inválida');

    let result;
    if (docId) {
        result = await api(`${basePath}/${docId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    } else {
        let postPath = basePath;
        if (collectionName === 'gains' && payload.isRecurring === true) {
            postPath = `${basePath}?recurring=1`;
        }
        if (collectionName === 'expenses' && payload.recurringMonthly === true && !docId) {
            postPath = `${basePath}?recurring=1`;
        }
        result = await api(postPath, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
    if (!options.skipUiSound) {
        playPingSound();
    }
    return result;
}

async function deleteDocument(collectionName, docId) {
    const paths = {
        expenses: '/api/expenses',
        gains: '/api/gains',
        accounts: '/api/accounts',
        cofrinhoBuckets: '/api/cofrinho-buckets',
        cofrinhoApplications: '/api/cofrinho-applications',
        cofrinhoAllocations: '/api/cofrinho-applications',
        cofrinhoBucketGoals: '/api/cofrinho-bucket-goals',
        debts: '/api/debts',
        debtUpdates: '/api/debt-updates'
    };
    const basePath = paths[collectionName];
    if (!basePath) throw new Error('Coleção inválida');
    await api(`${basePath}/${docId}`, { method: 'DELETE' });
    playTrashSound();
}

export const saveExpense = (data, docId, options) => saveDocument('expenses', data, docId, options);

/** Atualiza campos permitidos em várias saídas (`PATCH /api/expenses/batch`). */
export async function patchExpensesBatch(ids, patch) {
    return api('/api/expenses/batch', {
        method: 'PATCH',
        body: JSON.stringify({ ids, patch })
    });
}
export async function patchGainsBatch(ids, patch) {
    return api('/api/gains/batch', {
        method: 'PATCH',
        body: JSON.stringify({ ids, patch })
    });
}
export const saveGain = (data, docId, options) => saveDocument('gains', data, docId, options);
export const saveAccount = (data, docId, options) => saveDocument('accounts', data, docId, options);
export const saveCofrinhoBucket = (data, docId, options) =>
    saveDocument('cofrinhoBuckets', data, docId, options);
export const saveCofrinhoApplication = (data, docId, options) =>
    saveDocument('cofrinhoApplications', data, docId, options);

/** Cria ou atualiza alocação (split pool + despesa ou aporte direto). */
export async function saveCofrinhoAllocation(data, docId, options) {
    const path = '/api/cofrinho-applications';
    if (docId) {
        return api(`${path}/${docId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    return api(path, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export const deleteCofrinhoAllocation = (docId) => deleteDocument('cofrinhoAllocations', docId);
export const saveCofrinhoBucketGoal = (data, docId, options) =>
    saveDocument('cofrinhoBucketGoals', data, docId, options);
export const saveDebt = (data, docId, options) => saveDocument('debts', data, docId, options);
export const saveDebtUpdate = (data, docId, options) => saveDocument('debtUpdates', data, docId, options);

export const deleteAccount = (docId) => deleteDocument('accounts', docId);
export const deleteExpense = (docId) => deleteDocument('expenses', docId);
export const deleteGain = (docId) => deleteDocument('gains', docId);
export const deleteCofrinhoBucket = (docId) => deleteDocument('cofrinhoBuckets', docId);
export const deleteCofrinhoApplication = (docId) =>
    deleteDocument('cofrinhoApplications', docId);
export const deleteCofrinhoBucketGoal = (docId) => deleteDocument('cofrinhoBucketGoals', docId);
export const deleteDebt = (docId) => deleteDocument('debts', docId);
export const deleteDebtUpdate = (docId) => deleteDocument('debtUpdates', docId);

/**
 * Atualiza o perfil do usuário.
 */
export async function updateUserProfile(_userId, profileData) {
    const body = { ...profileData };
    await api('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}

/** Marca um período como pago para débito no saldo (modo confirmação manual). */
export async function confirmExpenseCashOut(expenseId, periodKey) {
    return api(`/api/expenses/${encodeURIComponent(expenseId)}/confirm-cash-out`, {
        method: 'POST',
        body: JSON.stringify({ periodKey })
    });
}

/** Upload da foto de perfil (único uso de arquivo no app). */
export async function uploadFile(file, _userId) {
    const fd = new FormData();
    fd.append('file', file);
    const { url } = await apiUpload(fd);
    if (url.startsWith('http')) return url;
    return `${window.location.origin}${url}`;
}

/**
 * Exclusão de conta é feita em uma única rota no servidor.
 */
export async function deleteUserAccount() {
    await api('/api/user', { method: 'DELETE' });
}

/** Histórico de saldo total (snapshots diários no servidor). */
export async function fetchBalanceSnapshots(days = 365) {
    const d = Math.min(3650, Math.max(1, Number(days) || 365));
    return api(`/api/balance-snapshots?days=${encodeURIComponent(d)}`);
}

/**
 * Saldo total (contas de caixa) no fim do período — último estado oficial no intervalo (servidor / ledger).
 */
export async function fetchDashboardPeriodBalance(startDate, endDate) {
    const from = startDate instanceof Date ? startDate.toISOString() : String(startDate);
    const to = endDate instanceof Date ? endDate.toISOString() : String(endDate);
    const r = await api(
        `/api/dashboard/balance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    if (r == null || r.balance == null) return null;
    const n = Number(r.balance);
    return Number.isFinite(n) ? n : null;
}

/** Rateio de despesas entre usuários */
export async function lookupUserByEmail(email) {
    return api(`/api/users/lookup?email=${encodeURIComponent(String(email || '').trim())}`);
}

/** Lista de usuários cadastrados para escolher destinatário (exceto o atual). */
export async function fetchUsersForSplit() {
    return api('/api/users/for-split');
}

export async function createExpenseSplitRequest(body) {
    return api('/api/expense-splits', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

export async function acceptExpenseSplitRequest(id) {
    return api(`/api/expense-splits/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        body: JSON.stringify({})
    });
}

export async function rejectExpenseSplitRequest(id) {
    return api(`/api/expense-splits/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        body: JSON.stringify({})
    });
}

export async function cancelExpenseSplitRequest(id) {
    const r = await api(`/api/expense-splits/${encodeURIComponent(id)}`, { method: 'DELETE' });
    playTrashSound();
    return r;
}

export async function patchExpenseSplitProof(id, senderProofUrl) {
    return api(`/api/expense-splits/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ senderProofUrl })
    });
}

/** Mantidos para compatibilidade com profile antigo — não usados na API local. */
export async function deleteUserCollections() {}
export async function deleteUserDocument() {}
export async function deleteUserFiles() {}
