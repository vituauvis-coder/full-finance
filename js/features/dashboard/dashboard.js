// js/dashboard.js
import {
    creditCardInvoiceTotalForCycle
} from '../../core/credit-installments.js';
import { confirmExpenseCashOut } from '../../services/firestore.js';
import { buildPendingCashOutItems } from '../finance/pending-cash-outs.js';
import {
    formatCurrency,
    getBillingCycle,
    isCardAccountType,
    isCreditCardType,
    movementDateToJsDate,
    movementDateToUnixSeconds
} from '../../core/utils.js';
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
    const recentTransactionsList = document.getElementById('recent-activity-list');

    const now = new Date();
    if (!recentTransactionsList) return;
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

    // Atividade recente (despesas + ganhos): ordena por criação do lançamento (`createdAt`).
    recentTransactionsList.innerHTML = '';
    const createdUnixSeconds = (t) => {
        const createTs = t?.createdAt != null ? movementDateToUnixSeconds(t.createdAt) : 0;
        if (createTs > 0) return createTs;
        return movementDateToUnixSeconds(t?.date);
    };
    const endOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
    );
    const merged = [
        ...(userGains || []).map((t) => ({ ...t, _kind: 'gain' })),
        ...(userExpenses || []).map((t) => ({ ...t, _kind: 'expense' }))
    ].filter((t) => movementDateToJsDate(t.createdAt ?? t.date) <= endOfToday).sort((a, b) => {
        const cb = createdUnixSeconds(b);
        const ca = createdUnixSeconds(a);
        if (cb !== ca) return cb - ca;
        return String(b.id || '').localeCompare(String(a.id || ''));
    }).slice(0, 10);

    merged.forEach((t) => {
        const li = document.createElement('li');
        li.className = 'recent-activity-item';
        const isGain = t._kind === 'gain';
        const isInv = !isGain && t.isInvestment;
        const iconClass = isGain ? 'fa-arrow-up' : isInv ? 'fa-chart-line' : 'fa-arrow-down';
        const iconColor = isGain
            ? 'var(--secondary-color)'
            : isInv
              ? 'var(--primary-color)'
              : 'var(--danger-color)';
        const dateStr = movementDateToJsDate(t.createdAt ?? t.date).toLocaleDateString('pt-BR');
        const kindLabel = isGain ? 'Entrada' : isInv ? 'Investimento' : 'Saída';
        li.innerHTML = `<span class="recent-activity-icon" aria-hidden="true" title="${kindLabel}"><i class="fas ${iconClass}" style="color: ${iconColor};"></i></span><div class="recent-activity-main"><span class="recent-activity-amount"></span><span class="recent-activity-date"></span><span class="recent-activity-desc"></span></div>`;
        li.querySelector('.recent-activity-amount').textContent = formatCurrency(t.amount, userCurrency);
        li.querySelector('.recent-activity-date').textContent = dateStr;
        li.querySelector('.recent-activity-desc').textContent = t.description || '—';
        recentTransactionsList.appendChild(li);
    });

    renderUpcomingInvoices(userAccounts, userExpenses, userCurrency);
}

/**
 * Renderiza a lista de faturas de cartão de crédito próximas do vencimento.
 */
function renderUpcomingInvoices(userAccounts, userExpenses, userCurrency) {
    const listEl = document.getElementById('upcoming-invoices-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const creditCards = userAccounts.filter((acc) => isCreditCardType(acc.type));
    const upcomingInvoices = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar para o início do dia

    creditCards.forEach(card => {
        const billCycle = getBillingCycle(card);

        // Considerar apenas faturas com vencimento no futuro
        if (billCycle.due >= today) {
            const billTotal = creditCardInvoiceTotalForCycle(card, userExpenses);

            if (billTotal > 0) {
                upcomingInvoices.push({
                    cardName: card.name,
                    dueDate: billCycle.due,
                    total: billTotal
                });
            }
        }
    });

    // Ordenar faturas pela data de vencimento mais próxima
    upcomingInvoices.sort((a, b) => a.dueDate - b.dueDate);

    if (upcomingInvoices.length === 0) {
        listEl.innerHTML = '<li class="empty-state-small">Nenhuma fatura próxima.</li>';
        return;
    }

    upcomingInvoices.slice(0, 4).forEach(invoice => {
        const li = document.createElement('li');
        const daysUntilDue = Math.ceil((invoice.dueDate - today) / (1000 * 60 * 60 * 24));
        let dueDateText;
        if (daysUntilDue === 0) {
            dueDateText = 'Vence hoje';
        } else if (daysUntilDue === 1) {
            dueDateText = 'Vence amanhã';
        } else {
            dueDateText = `Vence em ${daysUntilDue} dias`;
        }

        li.innerHTML = `
            <span><i class="fas fa-file-invoice-dollar" style="color: var(--info-color);"></i> ${invoice.cardName}</span>
            <div class="invoice-details">
                <small>${dueDateText} (${invoice.dueDate.toLocaleDateString('pt-BR')})</small>
                <strong>${formatCurrency(invoice.total, userCurrency)}</strong>
            </div>
        `;
        listEl.appendChild(li);
    });
}
