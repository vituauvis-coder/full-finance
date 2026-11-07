// js/dashboard.js
import { runWithButtonLoading } from '../../core/button-loading.js';
import { confirmExpenseCashOut } from '../../services/firestore.js';
import { buildPendingCashOutItems } from '../finance/pending-cash-outs.js';
import { refreshCashHeatmap } from './cash-heatmap.js';
import { formatCurrency } from '../../core/utils.js';

/** Evita vários `refreshAllData` em paralelo ao confirmar vários pagamentos seguidos. */
let pendingCashOutRefreshTimer = null;
const PENDING_CASH_OUT_REFRESH_MS = 450;

function schedulePendingCashOutDataRefresh(onDataRefresh) {
    if (typeof onDataRefresh !== 'function') return;
    if (pendingCashOutRefreshTimer != null) clearTimeout(pendingCashOutRefreshTimer);
    pendingCashOutRefreshTimer = setTimeout(() => {
        pendingCashOutRefreshTimer = null;
        void onDataRefresh();
    }, PENDING_CASH_OUT_REFRESH_MS);
}

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
                btn.type = 'button';
                btn.textContent = 'Marcar como pago';
                btn.dataset.loadingLabel = 'Confirmando...';
                btn.addEventListener('click', () => {
                    void runWithButtonLoading(
                        btn,
                        async () => {
                            await confirmExpenseCashOut(p.expenseId, p.periodKey);
                            li.remove();
                            if (pendingList.children.length === 0) {
                                pendingWrap.classList.add('hidden');
                            }
                            schedulePendingCashOutDataRefresh(onDataRefresh);
                        },
                        { busyLabel: 'Confirmando...' }
                    ).catch((err) => {
                        console.error(err);
                    });
                });
                pendingList.appendChild(li);
            });
        }
    }

    refreshCashHeatmap(userExpenses, userGains, userAccounts, userCurrency);
}
