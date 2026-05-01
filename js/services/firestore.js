// Camada de dados local (substitui Firestore)
import { api, apiUpload } from '../api-client.js';

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
            userGoals: data.userGoals || [],
            userInvestments: data.userInvestments || [],
            userDebts: data.userDebts || [],
            userDebtUpdates: data.userDebtUpdates || [],
            expenseSplitRequests: data.expenseSplitRequests || { incoming: [], outgoing: [] }
        };
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        return {};
    }
}

async function saveDocument(collectionName, data, docId) {
    const payload = { ...data };
    if (Object.prototype.hasOwnProperty.call(payload, 'date') && payload.date != null) {
        payload.date = serializeDate(payload.date);
    }

    const paths = {
        expenses: '/api/expenses',
        gains: '/api/gains',
        accounts: '/api/accounts',
        goals: '/api/goals',
        investments: '/api/investments',
        debts: '/api/debts',
        debtUpdates: '/api/debt-updates'
    };
    const basePath = paths[collectionName];
    if (!basePath) throw new Error('Coleção inválida');

    if (docId) {
        return api(`${basePath}/${docId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }
    let postPath = basePath;
    if (collectionName === 'gains' && payload.isRecurring === true) {
        postPath = `${basePath}?recurring=1`;
    }
    if (collectionName === 'expenses' && payload.recurringMonthly === true && !docId) {
        postPath = `${basePath}?recurring=1`;
    }
    return api(postPath, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

async function deleteDocument(collectionName, docId) {
    const paths = {
        expenses: '/api/expenses',
        gains: '/api/gains',
        accounts: '/api/accounts',
        goals: '/api/goals',
        investments: '/api/investments',
        debts: '/api/debts',
        debtUpdates: '/api/debt-updates'
    };
    const basePath = paths[collectionName];
    if (!basePath) throw new Error('Coleção inválida');
    await api(`${basePath}/${docId}`, { method: 'DELETE' });
}

export const saveExpense = (data, docId) => saveDocument('expenses', data, docId);

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
export const saveGain = (data, docId) => saveDocument('gains', data, docId);
export const saveAccount = (data, docId) => saveDocument('accounts', data, docId);
export const saveGoal = (data, docId) => saveDocument('goals', data, docId);
export const saveInvestment = (data, docId) => saveDocument('investments', data, docId);
export const saveDebt = (data, docId) => saveDocument('debts', data, docId);
export const saveDebtUpdate = (data, docId) => saveDocument('debtUpdates', data, docId);

export const deleteAccount = (docId) => deleteDocument('accounts', docId);
export const deleteExpense = (docId) => deleteDocument('expenses', docId);
export const deleteGain = (docId) => deleteDocument('gains', docId);
export const deleteGoal = (docId) => deleteDocument('goals', docId);
export const deleteInvestment = (docId) => deleteDocument('investments', docId);
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
    return api(`/api/expense-splits/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
