// js/dashboard.js
import { confirmExpenseCashOut } from '../../services/firestore.js';
import { buildPendingCashOutItems } from '../finance/pending-cash-outs.js';
import { refreshCashHeatmap } from './cash-heatmap.js';
import { formatCurrency } from '../../core/utils.js';

/**
 * Carrega e exibe os dados do dashboard.
 * @param {Array} userAccounts As contas do usuário.
 * @param {Array} userExpenses Despesas.
 * @param {Array} userGains Ganhos.
 * @param {string} userCurrency A moeda do usuário.
 */
export function loadDashboardData(
    userAccounts,
    userExpenses,
    userGains,
    userCurrency,
    userProfile = null,
    onDataRefresh = null
) {
    const now = new Date();
    // Os cards Entradas/Saídas/Investimentos (aportes) são controlados pelo filtro de período e atualizados em `reports.js`.

    const pendingWrap = document.getElementById('dashboard-pending-cash-outs');
    const pendingList = document.getElementById('dashboard-pending-cash-outs-list');
    if (pendingWrap && pendingList) {
        pendingList.innerHTML = '';
        const pending = buildPendingCashOutItems(userAccounts, userExpenses, userProfile, now);
        if (pending.length === 0) {
            pendingWrap.classList.add('hidden');
        } else {
            pendingWrap.classList.remove('hidden');
            pending.forEach((p) => {
                const li = document.createElement('li');
                li.className = 'dashboard-pending-item';
                li.innerHTML = `<div class="dashboard-pending-item__text">
                    <strong class="dashboard-pending-item__title"></strong>
                    <span class="dashboard-pending-item__detail"></span>
                </div>
                <span class="dashboard-pending-item__amount"></span>
                <button type="button" class="btn-secondary btn-sm dashboard-pending-confirm"></button>`;
                li.querySelector('.dashboard-pending-item__title').textContent = p.title;
                li.querySelector('.dashboard-pending-item__detail').textContent = p.detail;
                li.querySelector('.dashboard-pending-item__amount').textContent = formatCurrency(
                    p.amount,
                    userCurrency
                );
                const btn = li.querySelector('.dashboard-pending-confirm');
                btn.textContent = 'Marcar como pago';
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    try {
                        await confirmExpenseCashOut(p.expenseId, p.periodKey);
                        onDataRefresh?.();
                    } catch (err) {
                        console.error(err);
                        btn.disabled = false;
                    }
                });
                pendingList.appendChild(li);
            });
        }
    }

    refreshCashHeatmap(userExpenses, userGains, userAccounts, userCurrency);
}
