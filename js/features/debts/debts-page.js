import { formatCurrency } from '../../core/utils.js';
import { setMovementSummaryMomVariation } from '../../core/movement-summary-variation.js';
import { MOVEMENT_SUMMARY_CARD_GROUPS } from '../../core/movement-summary-copy.js';
import { renderMovementSummaryCard } from '../../components/movement-summary-cards.js';
import { computeDebtsSummary } from './debts-aggregations.js';
import { renderDebtsCharts, destroyDebtsCharts } from './debts-charts.js';
import {
    initDebtsForm,
    setDebtsCaches,
    getDebtsCaches,
    openRegisterForDebt,
    openSettingsForDebt
} from './debts.js';
import { renderDebtCards, bindDebtCardsEvents } from './debt-cards.js';

function ensureDebtsSummaryCardsMounted() {
    const container = document.querySelector('[data-summary-group="debts"]');
    const group = MOVEMENT_SUMMARY_CARD_GROUPS.debts;
    if (!container || !group || document.getElementById('debts-summary-total')) return;
    container.innerHTML = group.cards.map((card) => renderMovementSummaryCard(card)).join('');
}

function renderSummaryCards(debts, updates, currency) {
    ensureDebtsSummaryCardsMounted();
    const el = document.getElementById('debts-summary');
    if (!el) return;

    const s = computeDebtsSummary(debts, updates);
    el.hidden = false;

    const totalEl = document.getElementById('debts-summary-total');
    if (totalEl) totalEl.textContent = formatCurrency(s.totalToday, currency);

    const monthEl = document.getElementById('debts-summary-month');
    if (monthEl) monthEl.textContent = formatCurrency(s.totalCurrentMonth, currency);
    setMovementSummaryMomVariation(
        document.getElementById('debts-summary-month-variation'),
        s.totalCurrentMonth,
        s.totalPrevMonth,
        true,
        true
    );

    const banksEl = document.getElementById('debts-summary-banks');
    if (banksEl) banksEl.textContent = String(s.bankCount);
}

function refreshDebtsPage(debts, updates, currency) {
    const cur = currency || 'BRL';
    renderSummaryCards(debts, updates, cur);
    renderDebtCards(debts, updates, cur);
    renderDebtsCharts(debts, updates, cur);
}

export function initDebtsPage(currentUser, onDataRefresh) {
    if (!document.getElementById('debts-page')) return;
    ensureDebtsSummaryCardsMounted();
    initDebtsForm(currentUser, onDataRefresh, refreshDebtsPage);
    bindDebtCardsEvents({
        getCaches: getDebtsCaches,
        onLocalRefresh: refreshDebtsPage,
        onDataRefresh,
        openRegisterForDebt,
        openSettingsForDebt
    });
}

export function loadDebtsData(userDebts, userDebtUpdates, currency = 'BRL') {
    setDebtsCaches(userDebts, userDebtUpdates, currency);
    refreshDebtsPage(userDebts, userDebtUpdates, currency);
}

export function teardownDebtsPage() {
    destroyDebtsCharts();
}
