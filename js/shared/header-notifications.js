/**
 * Lógica exclusiva do sininho do cabeçalho: faturas, investimentos no mês e gastos elevados.
 * Não acopla a outras features além dos dados passados (contas, despesas, investimentos).
 */
import { creditCardInvoiceTotalForCycle } from '../core/credit-installments.js';
import { formatCurrency, movementDateToJsDate, isCreditCardType, getBillingCycle } from '../core/utils.js';
import { api } from '../api-client.js';

const MS_DAY = 86400000;

/** Avisar faturas com vencimento dentro deste número de dias (inclui hoje). */
const INVOICE_DUE_WITHIN_DAYS = 14;

/** Só analisa concentração de categoria se o gasto total do mês for >= isso. */
const MIN_MONTH_SPEND_FOR_SHARE = 350;

/** Categoria considerada “dominante” se ultrapassar esta fração do total do mês. */
const CATEGORY_SHARE_THRESHOLD = 0.33;

/** Comparação com média dos 3 meses anteriores. */
const VS_AVG_MULTIPLIER = 1.45;
const MIN_AVG_BASE_FOR_COMPARE = 60;

const MAX_SPENDING_NOTIFICATIONS = 5;

let getAppState = () => ({
    accounts: [],
    expenses: [],
    gains: [],
    investments: [],
    expenseSplitRequests: { incoming: [], outgoing: [] },
    userNotifications: [],
    currency: 'BRL'
});

function dateInCalendarMonth(dateField, year, monthIndex) {
    const d = movementDateToJsDate(dateField);
    return d.getFullYear() === year && d.getMonth() === monthIndex;
}

function categorySumInMonth(expenses, categoryLabel, year, monthIndex) {
    return expenses
        .filter(
            (e) =>
                !e.isInvestment &&
                (e.category || 'Outros') === categoryLabel &&
                dateInCalendarMonth(e.date, year, monthIndex)
        )
        .reduce((sum, e) => sum + (e.amount || 0), 0);
}

/**
 * Monta a lista de avisos a partir do estado da aplicação.
 * @returns {{ items: Array<{ id: string, kind: string, title: string, detail: string, priority: number }> }}
 */
export function buildHeaderNotifications(state) {
    const accounts = state.accounts || [];
    const expenses = state.expenses || [];
    const investments = state.investments || [];
    const currency = state.currency || 'BRL';

    const items = [];
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const today = new Date(y, mo, now.getDate());
    today.setHours(0, 0, 0, 0);

    // --- 1) Faturas de cartão próximas do vencimento ---
    const creditCards = accounts.filter((a) => isCreditCardType(a.type));
    creditCards.forEach((card) => {
        const billCycle = getBillingCycle(card);
        if (billCycle.due < today) return;

        const billTotal = creditCardInvoiceTotalForCycle(card, expenses);
        if (billTotal <= 0) return;

        const daysUntil = Math.ceil((billCycle.due - today) / MS_DAY);
        if (daysUntil < 0 || daysUntil > INVOICE_DUE_WITHIN_DAYS) return;

        let dueText;
        if (daysUntil === 0) dueText = 'Vence hoje';
        else if (daysUntil === 1) dueText = 'Vence amanhã';
        else dueText = `Vence em ${daysUntil} dias`;

        const priority = daysUntil <= 2 ? 0 : 1;
        items.push({
            id: `invoice-${card.id}-${billCycle.due.getTime()}`,
            kind: 'invoice',
            title: `Fatura · ${card.name}`,
            detail: `${dueText} (${billCycle.due.toLocaleDateString('pt-BR')}) · ${formatCurrency(billTotal, currency)}`,
            priority
        });
    });

    // --- 2) Registro de investimento no mês (aportes / compras isInvestment) ---
    if (investments.length > 0) {
        const invThisMonth = expenses.filter(
            (e) => e.isInvestment && dateInCalendarMonth(e.date, y, mo)
        );
        const invSum = invThisMonth.reduce((sum, e) => sum + (e.amount || 0), 0);
        if (invSum <= 0) {
            items.push({
                id: 'investment-monthly-habit',
                kind: 'investment',
                title: 'Investimentos no mês',
                detail: 'Você tem posições cadastradas, mas ainda não registrou aportes ou compras marcadas como investimento neste mês.',
                priority: 2
            });
        }
    }

    // --- 3) Gastos elevados por categoria ---
    const monthExpenses = expenses.filter((e) => !e.isInvestment && dateInCalendarMonth(e.date, y, mo));
    const totalMonth = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const byCategory = {};
    monthExpenses.forEach((e) => {
        const c = e.category || 'Outros';
        byCategory[c] = (byCategory[c] || 0) + (e.amount || 0);
    });

    const spendingByCat = new Map();

    if (totalMonth >= MIN_MONTH_SPEND_FOR_SHARE) {
        Object.entries(byCategory).forEach(([cat, amt]) => {
            const share = amt / totalMonth;
            if (share >= CATEGORY_SHARE_THRESHOLD) {
                spendingByCat.set(cat, {
                    title: `Gasto elevado · ${cat}`,
                    detail: `Esta categoria representa cerca de ${Math.round(share * 100)}% dos seus gastos no mês (${formatCurrency(amt, currency)} de ${formatCurrency(totalMonth, currency)}).`,
                    priority: 3
                });
            }
        });
    }

    Object.keys(byCategory).forEach((cat) => {
        const current = byCategory[cat];
        let sumPrev = 0;
        for (let back = 1; back <= 3; back++) {
            const d = new Date(y, mo - back, 1);
            sumPrev += categorySumInMonth(expenses, cat, d.getFullYear(), d.getMonth());
        }
        const avg = sumPrev / 3;
        if (avg < MIN_AVG_BASE_FOR_COMPARE) return;
        if (current <= VS_AVG_MULTIPLIER * avg) return;

        const existing = spendingByCat.get(cat);
        const extra = `Comparado à média dos três meses anteriores (~${formatCurrency(avg, currency)}), o valor está bem acima.`;
        if (existing) {
            existing.detail = `${existing.detail} ${extra}`;
        } else {
            spendingByCat.set(cat, {
                title: `Acima da média · ${cat}`,
                detail: `Total no mês: ${formatCurrency(current, currency)}. ${extra}`,
                priority: 3
            });
        }
    });

    const spendingItems = [...spendingByCat.values()]
        .slice(0, MAX_SPENDING_NOTIFICATIONS)
        .map((entry, i) => ({
            id: `spending-${i}-${entry.title}`,
            kind: 'spending',
            title: entry.title,
            detail: entry.detail,
            priority: entry.priority
        }));

    items.push(...spendingItems);

    const persisted = state.userNotifications || [];
    persisted
        .filter((n) => n && !n.readAt && String(n.kind) === 'split_payer_confirmed')
        .forEach((n) => {
            items.push({
                id: `notif-${n.id}`,
                kind: 'split-pay',
                title: String(n.title || 'Divisão'),
                detail: String(n.detail || ''),
                priority: 0
            });
        });

    const incomingSplits = state.expenseSplitRequests?.incoming || [];
    incomingSplits
        .filter((s) => s && String(s.status).toUpperCase() === 'PENDING')
        .forEach((s) => {
            const name = s.requester?.name || 'Um usuário';
            const desc = s.sourceExpense?.description || 'Compra';
            items.push({
                id: `split-${s.id}`,
                kind: 'split',
                title: 'Divisão de saída pendente',
                detail: `${name} pediu para dividir ${formatCurrency(s.amount, currency)} · ${desc}`,
                priority: 0
            });
        });

    items.sort((a, b) => a.priority - b.priority);

    return { items };
}

function iconForKind(kind) {
    if (kind === 'invoice') return 'fa-file-invoice-dollar';
    if (kind === 'investment') return 'fa-chart-line';
    if (kind === 'split') return 'fa-users';
    if (kind === 'split-pay') return 'fa-money-bill-wave';
    return 'fa-chart-pie';
}

function renderList(container, emptyEl, items) {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    items.forEach((it) => {
        const li = document.createElement('li');
        li.className = `notifications-item notifications-item--${it.kind}`;
        li.setAttribute('role', 'menuitem');
        const icon = iconForKind(it.kind);
        li.innerHTML = `
            <span class="notifications-item-icon" aria-hidden="true"><i class="fas ${icon}"></i></span>
            <div class="notifications-item-text">
                <strong class="notifications-item-title">${escapeHtml(it.title)}</strong>
                <span class="notifications-item-detail">${escapeHtml(it.detail)}</span>
            </div>
        `;
        container.appendChild(li);
    });
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function updateBadge(badgeEl, count) {
    if (!badgeEl) return;
    if (count <= 0) {
        badgeEl.classList.add('hidden');
        badgeEl.textContent = '0';
        return;
    }
    badgeEl.classList.remove('hidden');
    badgeEl.textContent = count > 9 ? '9+' : String(count);
}

let panelEl;
let btnEl;
let listEl;
let emptyEl;
let docClickBound = false;

function closePanel() {
    if (!panelEl || !btnEl) return;
    panelEl.classList.add('hidden');
    btnEl.setAttribute('aria-expanded', 'false');
}

function openPanel() {
    if (!panelEl || !btnEl) return;
    panelEl.classList.remove('hidden');
    btnEl.setAttribute('aria-expanded', 'true');
}

function onDocumentClick(e) {
    const wrap = document.querySelector('.header-notifications');
    if (wrap && !wrap.contains(e.target)) closePanel();
}

function onKeydown(e) {
    if (e.key === 'Escape') closePanel();
}

/**
 * @param {() => object} stateGetter
 * @param {(() => Promise<void>) | null} afterMarkReadRefresh — após marcar avisos de rateio como lidos (ex.: recarregar dados).
 */
export function initHeaderNotifications(stateGetter, afterMarkReadRefresh = null) {
    getAppState = typeof stateGetter === 'function' ? stateGetter : getAppState;
    const onAfterMarkRead =
        typeof afterMarkReadRefresh === 'function' ? afterMarkReadRefresh : null;

    btnEl = document.getElementById('notifications-btn');
    panelEl = document.getElementById('notifications-panel');
    listEl = document.getElementById('notifications-list');
    emptyEl = document.getElementById('notifications-empty');

    if (!btnEl || !panelEl) return;

    btnEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        const open = panelEl.classList.contains('hidden');
        if (open) {
            refreshHeaderNotifications();
            openPanel();
            try {
                await api(
                    '/api/notifications/read-all?kind=split_payer_confirmed',
                    { method: 'PATCH' }
                );
                if (onAfterMarkRead) await onAfterMarkRead();
                else refreshHeaderNotifications();
            } catch (err) {
                console.error(err);
            }
        } else {
            closePanel();
        }
    });

    if (!docClickBound) {
        docClickBound = true;
        document.addEventListener('click', onDocumentClick);
        document.addEventListener('keydown', onKeydown);
    }

    refreshHeaderNotifications();
}

export function refreshHeaderNotifications() {
    const state = getAppState();
    const { items } = buildHeaderNotifications(state);
    const badge = document.querySelector('#notifications-btn .notification-badge');
    updateBadge(badge, items.length);
    renderList(listEl, emptyEl, items);
}
