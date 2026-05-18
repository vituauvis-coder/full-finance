import { formatCurrency, isCardAccountType } from '../../core/utils.js';
import {
    saveCofrinhoAllocation,
    deleteCofrinhoAllocation,
    saveCofrinhoBucket,
    deleteCofrinhoBucket,
    saveCofrinhoBucketGoal,
    deleteCofrinhoBucketGoal
} from '../../services/firestore.js';
import { loadCategoriesFromDatabase } from '../finance/expense-categories.js';
import { openModal, closeModal, showMessage } from '../../shell/app-shell.js';
import { setFormSubmittingState, runWithButtonLoading } from '../../core/button-loading.js';
import {
    EXPENSE_COFRINHO_CATEGORY,
    BUCKET_COLOR_KEYS,
    BUCKET_COLOR_LABELS,
    GOAL_STATUS_OPTIONS,
    bucketColorHex
} from './constants.js';
import {
    computePendingBalance,
    listPoolExpensesForMonth,
    toYearMonthKey,
    yearMonthToReferenceMonth,
    referenceMonthToYearMonth
} from './pending-balance.js';
import {
    sumAllocatedByBucket,
    getBucketGoalForYear,
    filterApplications,
    buildPerformanceByBucket,
    countConsecutiveCofrinhoMonths,
    getTotalApplicationsSum,
    formatYearMonthLabel
} from './aggregations.js';
import { destroyCofrinhoCharts, renderCofrinhoCharts } from './cofrinhos-charts.js';

export { getTotalApplicationsSum };

let onUpdateCallback = null;
let cache = {
    expenses: [],
    buckets: [],
    applications: [],
    bucketGoals: [],
    accounts: [],
    currency: 'BRL',
    referenceYearMonth: '',
    milestoneYear: new Date().getFullYear(),
    historyBucketId: null,
    editingBucketId: null,
    allocationMode: 'pool',
};

const BUCKET_ICONS = {
    'fa-bullseye': 'fa-bullseye',
    'fa-chart-line': 'fa-chart-line',
    'fa-shield-halved': 'fa-shield-halved'
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

let initCofrinhosPageUiOnceRan = false;

export function initCofrinhos(_user, onUpdate) {
    onUpdateCallback = onUpdate;

    initCofrinhosPageUiOnce();

    document.getElementById('cofrinhos-add-bucket-btn')?.addEventListener('click', () => {
        openCreateBucketModal();
    });

    document.getElementById('cofrinho-bucket-delete')?.addEventListener('click', () => {
        void deleteEditingBucket();
    });

    document.getElementById('cofrinho-application-form')?.addEventListener('submit', handleApplicationSubmit);
    document.querySelectorAll('[data-close-modal="cofrinho-application-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('cofrinho-application-modal'));
    });
    document.getElementById('cofrinho-bucket-form')?.addEventListener('submit', handleBucketFormSubmit);
    document.getElementById('cofrinho-bucket-form')?.addEventListener('click', handleBucketFormClick);
    document.querySelectorAll('[data-close-modal="cofrinho-buckets-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('cofrinho-buckets-modal'));
    });
    document.getElementById('cofrinho-bucket-history-close')?.addEventListener('click', () => {
        closeModal('cofrinho-bucket-history-modal');
        cache.historyBucketId = null;
    });
    document.getElementById('cofrinho-bucket-history-add-year')?.addEventListener('click', addBucketGoalYear);
    document.querySelectorAll('[data-close-modal="cofrinho-bucket-history-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => {
            closeModal('cofrinho-bucket-history-modal');
            cache.historyBucketId = null;
        });
    });
    document.getElementById('cofrinho-bucket-history-apps-tbody')?.addEventListener('click', (e) => {
        const edit = e.target.closest('.cof-app-edit');
        const del = e.target.closest('.cof-app-delete');
        if (edit?.dataset.id) openApplicationModal(edit.dataset.id);
        if (del?.dataset.id) void deleteApplication(del.dataset.id);
    });

    document.getElementById('cofrinhos-applications-tbody')?.addEventListener('click', (e) => {
        const edit = e.target.closest('.cof-app-edit');
        const del = e.target.closest('.cof-app-delete');
        if (edit?.dataset.id) openApplicationModal(edit.dataset.id);
        if (del?.dataset.id) void deleteApplication(del.dataset.id);
    });

    document.getElementById('cofrinhos-goal-cards')?.addEventListener('click', (e) => {
        const colorBtn = e.target.closest('[data-bucket-set-color]');
        if (colorBtn?.dataset.bucketSetColor) {
            e.preventDefault();
            void updateBucketColor(
                colorBtn.dataset.bucketSetColor,
                colorBtn.dataset.colorKey,
                colorBtn
            );
            return;
        }
        const allocateBtn = e.target.closest('[data-bucket-allocate]');
        const historyBtn = e.target.closest('[data-bucket-history]');
        const settingsBtn = e.target.closest('[data-bucket-settings]');
        if (allocateBtn?.dataset.bucketAllocate) {
            openApplicationModal(null, { mode: 'direct', bucketId: allocateBtn.dataset.bucketAllocate });
        }
        if (historyBtn?.dataset.bucketHistory) openBucketHistoryModal(historyBtn.dataset.bucketHistory);
        if (settingsBtn?.dataset.bucketSettings) openBucketSettingsModal(settingsBtn.dataset.bucketSettings);
    });

    window.addEventListener('fullfinan-themechange', () => {
        if (document.getElementById('cofrinhos-page')?.classList.contains('active')) {
            renderCofrinhoCharts(cache.buckets, cache.applications, cache.currency, cache.expenses, {
                onMonthSelect: applyCofrinhosMonthFromChart
            });
        }
    });
}

export function loadCofrinhosPage(
    expenses,
    buckets,
    applications,
    bucketGoals,
    accounts,
    currency
) {
    cache.expenses = expenses || [];
    cache.buckets = buckets || [];
    cache.applications = applications || [];
    cache.bucketGoals = bucketGoals || [];
    cache.accounts = accounts || [];
    cache.currency = currency || 'BRL';

    if (!cache.referenceYearMonth) {
        cache.referenceYearMonth = currentYearMonth();
    }
    cache.referenceYearMonth = clampReferenceToCurrentYear(cache.referenceYearMonth);

    refreshCofrinhosUI();

    if (
        cache.historyBucketId &&
        !document.getElementById('cofrinho-bucket-history-modal')?.classList.contains('hidden')
    ) {
        renderBucketHistoryModal();
    }
}

function currentYearMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function currentCalendarYear() {
    return new Date().getFullYear();
}

function clampReferenceToCurrentYear(ym) {
    const { month } = parseReferenceYearMonth(ym);
    return `${currentCalendarYear()}-${String(month).padStart(2, '0')}`;
}

function referenceMonthInputBounds() {
    const year = currentCalendarYear();
    const now = new Date();
    const maxMonth = now.getMonth() + 1;
    return {
        min: `${year}-01`,
        max: `${year}-${String(maxMonth).padStart(2, '0')}`
    };
}

function applyReferenceMonthInputBounds(input) {
    if (!input) return;
    const { min, max } = referenceMonthInputBounds();
    input.min = min;
    input.max = max;
}

function syncApplicationModalReferenceMonth(ym) {
    const form = document.getElementById('cofrinho-application-form');
    if (!form) return;

    ym = clampReferenceToCurrentYear(ym);
    form.dataset.referenceMonth = ym;

    const monthInput = document.getElementById('cofrinho-application-month');
    if (monthInput) monthInput.value = ym;

    const id = document.getElementById('cofrinho-application-id')?.value;
    const app = id ? cache.applications.find((a) => a.id === id) : null;
    const mode = form.dataset.allocationMode || 'pool';
    const isDirect = mode === 'direct' && !id;

    const hint = document.getElementById('cofrinho-application-pending-hint');
    if (hint) {
        if (isDirect) {
            hint.hidden = false;
            hint.innerHTML = `<span class="cofrinho-modal__balance-label">Modo direto</span><span class="cofrinho-modal__balance-value">Cria saída já na subcategoria da caixinha (não usa saldo pool).</span>`;
        } else {
            const pending = computePendingBalance(cache.expenses, cache.applications, ym);
            const avail = app ? pending + (parseFloat(app.amount) || 0) : pending;
            hint.hidden = false;
            hint.innerHTML = `<span class="cofrinho-modal__balance-label">Saldo pool (${formatYearMonthLabel(ym)})</span><span class="cofrinho-modal__balance-value">${formatCurrency(avail, cache.currency)}</span>`;
        }
    }

    const poolSourceWrap = document.getElementById('cofrinho-application-pool-source-wrap');
    const poolSourceSelect = document.getElementById('cofrinho-application-pool-source');
    if (poolSourceWrap && poolSourceSelect) {
        const poolList = listPoolExpensesForMonth(cache.expenses, ym);
        const selectedId = poolSourceSelect.value || app?.sourceExpenseId || '';
        poolSourceWrap.hidden = isDirect || Boolean(id);
        poolSourceSelect.innerHTML =
            '<option value="">Automático (mais antiga primeiro)</option>' +
            poolList
                .map((ex) => {
                    const label = `${escapeHtml(ex.description || 'Saída')} — ${formatCurrency(ex.amount, cache.currency)}`;
                    return `<option value="${escapeAttr(ex.id)}"${selectedId === ex.id ? ' selected' : ''}>${label}</option>`;
                })
                .join('');
    }
}

function applyCofrinhosMonthFromChart(yearMonth) {
    const ym = clampReferenceToCurrentYear(yearMonth);
    if (!ym || ym === cache.referenceYearMonth) return;
    cache.referenceYearMonth = ym;
    refreshCofrinhosUI();
}

function refreshCofrinhosUI() {
    renderReferenceTimeline();
    renderSummaryCards();
    renderPendingBanner();
    renderGoalCards();
    renderMilestonePanel();
    renderApplicationsTable();
    renderCofrinhoCharts(cache.buckets, cache.applications, cache.currency, cache.expenses, {
        onMonthSelect: applyCofrinhosMonthFromChart
    });
}

function initCofrinhosPageUiOnce() {
    if (initCofrinhosPageUiOnceRan) return;
    const page = document.getElementById('cofrinhos-page');
    if (!page) return;
    initCofrinhosPageUiOnceRan = true;

    page.addEventListener('click', (e) => {
        const monthBtn = e.target.closest('[data-cofrinhos-month]');
        if (monthBtn && page.contains(monthBtn)) {
            const month = parseInt(monthBtn.getAttribute('data-cofrinhos-month'), 10);
            if (!Number.isFinite(month) || month < 1 || month > 12) return;
            cache.referenceYearMonth = `${currentCalendarYear()}-${String(month).padStart(2, '0')}`;
            refreshCofrinhosUI();
        }
    });

    document.querySelectorAll('input[name="cofrinho-allocation-mode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const form = document.getElementById('cofrinho-application-form');
            if (form) form.dataset.allocationMode = radio.value === 'direct' ? 'direct' : 'pool';
            openApplicationModal(document.getElementById('cofrinho-application-id')?.value || null, {
                mode: radio.value,
                referenceMonth: document.getElementById('cofrinho-application-month')?.value
            });
        });
    });

    document.getElementById('cofrinho-application-month')?.addEventListener('change', (e) => {
        const ym = clampReferenceToCurrentYear(e.target.value);
        e.target.value = ym;
        syncApplicationModalReferenceMonth(ym);
    });
}

function parseReferenceYearMonth(ym) {
    const [y, m] = String(ym || currentYearMonth()).split('-');
    return {
        year: parseInt(y, 10) || new Date().getFullYear(),
        month: parseInt(m, 10) || new Date().getMonth() + 1
    };
}

function renderReferenceTimeline() {
    const timeline = document.querySelector('[data-cofrinhos-timeline]');
    if (!timeline) return;

    const ym = clampReferenceToCurrentYear(cache.referenceYearMonth || currentYearMonth());
    cache.referenceYearMonth = ym;
    const { month } = parseReferenceYearMonth(ym);
    const yShort = String(currentCalendarYear()).slice(-2);

    timeline.innerHTML = MONTH_NAMES.map((name, index) => {
        const monthNum = index + 1;
        const isActive = monthNum === month;
        const label = `${name}/${yShort}`;
        return `<button type="button"
            class="zero-budget__month-btn${isActive ? ' is-active' : ''}"
            data-cofrinhos-month="${monthNum}"
            role="tab"
            aria-selected="${isActive ? 'true' : 'false'}">${label}</button>`;
    }).join('');
}

function sumAllocatedInMonth(expenses, applications, buckets, yearMonth) {
    if (!yearMonth || !Array.isArray(buckets) || !buckets.length) return 0;
    return buckets.reduce((sum, b) => {
        let value = 0;
        if (Array.isArray(expenses) && expenses.length) {
            value = expenses
                .filter(
                    (e) =>
                        String(e.category || '').trim() === EXPENSE_COFRINHO_CATEGORY &&
                        String(e.subcategory || '').trim() === (b?.name || '') &&
                        toYearMonthKey(e.date) === yearMonth &&
                        e.isPaid !== false
                )
                .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        }
        if (value <= 0) {
            value = (applications || [])
                .filter(
                    (a) =>
                        a.bucketId === b.id && referenceMonthToYearMonth(a.referenceMonth) === yearMonth
                )
                .reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
        }
        return sum + value;
    }, 0);
}

function renderSummaryCards() {
    const el = document.getElementById('cofrinhos-summary');
    if (!el) return;

    const ym = cache.referenceYearMonth || currentYearMonth();
    const monthLabel = formatYearMonthLabel(ym);
    const pending = computePendingBalance(cache.expenses, cache.applications, ym);
    const monthAllocated = sumAllocatedInMonth(
        cache.expenses,
        cache.applications,
        cache.buckets,
        ym
    );
    const totalInBuckets = getTotalApplicationsSum(
        cache.applications,
        cache.expenses,
        cache.buckets
    );

    el.hidden = false;

    const pendingEl = document.getElementById('cofrinhos-summary-pending');
    if (pendingEl) pendingEl.textContent = formatCurrency(pending, cache.currency);

    const pendingScope = document.getElementById('cofrinhos-summary-pending-scope');
    if (pendingScope) pendingScope.textContent = monthLabel;

    const monthEl = document.getElementById('cofrinhos-summary-month');
    if (monthEl) monthEl.textContent = formatCurrency(monthAllocated, cache.currency);

    const totalEl = document.getElementById('cofrinhos-summary-total');
    if (totalEl) totalEl.textContent = formatCurrency(totalInBuckets, cache.currency);
}

function renderPendingBanner() {
    const el = document.getElementById('cofrinhos-pending-banner');
    if (!el) return;

    const ym = cache.referenceYearMonth || currentYearMonth();
    const pending = computePendingBalance(cache.expenses, cache.applications, ym);

    if (pending > 0) {
        el.hidden = false;
        el.className = 'cofrinhos-page__pending dashboard-pending-cash-outs';
        el.innerHTML = `
            <h3 class="dashboard-pending-title"><i class="fas fa-piggy-bank" aria-hidden="true"></i> Aguardando alocação</h3>
            <p class="dashboard-pending-hint">Saídas em «${escapeHtml(EXPENSE_COFRINHO_CATEGORY)}» <strong>sem subcategoria</strong> em ${escapeHtml(formatYearMonthLabel(ym))} — distribua nas caixinhas.</p>
            <ul class="dashboard-pending-list">
                <li class="dashboard-pending-item">
                    <div class="dashboard-pending-item__text">
                        <span class="dashboard-pending-item__title">Saldo do pool</span>
                        <span class="dashboard-pending-item__detail">Valor ainda não distribuído</span>
                    </div>
                    <span class="dashboard-pending-item__amount">${formatCurrency(pending, cache.currency)}</span>
                    <button type="button" class="btn-primary btn-sm dashboard-pending-confirm" id="cofrinhos-distribute-btn">
                        Distribuir aporte
                    </button>
                </li>
            </ul>`;
        el.querySelector('#cofrinhos-distribute-btn')?.addEventListener('click', () => openApplicationModal());
    } else {
        el.hidden = true;
        el.className = 'cofrinhos-page__pending';
        el.innerHTML = '';
    }
}

function renderGoalCards() {
    const grid = document.getElementById('cofrinhos-goal-cards');
    if (!grid) return;

    const year = new Date().getFullYear();

    if (!cache.buckets.length) {
        grid.innerHTML = `
            <div class="goals-empty-state cofrinhos-page__empty">
                <div class="goals-empty-state__icon" aria-hidden="true"><i class="fas fa-boxes-stacked"></i></div>
                <p class="goals-empty-state__title">Nenhuma caixinha</p>
                <p class="goals-empty-state__text">Use «Nova caixinha» no topo para criar a primeira caixinha.</p>
            </div>`;
        return;
    }

    grid.innerHTML = cache.buckets
        .map((b) => {
            const resultado = sumAllocatedByBucket(cache.expenses, b, cache.applications);
            const goal = getBucketGoalForYear(cache.bucketGoals, b.id, year);
            const meta = goal ? parseFloat(goal.targetAmount) || 0 : 0;
            const perc = meta > 0 ? Math.min((resultado / meta) * 100, 100) : 0;
            const done = meta > 0 && resultado >= meta;
            const hex = bucketColorHex(b.colorKey);
            return `
            <article class="cofrinhos-page__goal-card" data-bucket-id="${escapeAttr(b.id)}" style="--goal-accent:${hex}">
                <div class="cofrinhos-page__goal-card-head">
                    <div class="cofrinhos-page__goal-card-name-row">
                        <span class="cofrinhos-page__goal-card-dot" style="background-color:${hex}" aria-hidden="true"></span>
                        <h4 class="cofrinhos-page__goal-card-title" title="${escapeAttr(b.name)}">${escapeHtml(b.name)}</h4>
                    </div>
                    ${done ? '<span class="cofrinhos-page__done-badge">Concluído</span>' : ''}
                </div>
                <div class="cofrinhos-page__goal-card-body">
                    <div class="cofrinhos-page__goal-card-values">
                        <span class="cofrinhos-page__goal-card-current">${formatCurrency(resultado, cache.currency)}</span>
                        <span class="cofrinhos-page__goal-card-meta">de ${formatCurrency(meta, cache.currency)}</span>
                    </div>
                    <div class="cofrinhos-page__goal-card-bar" role="progressbar" aria-valuenow="${perc.toFixed(0)}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da meta">
                        <span style="width:${perc.toFixed(1)}%"></span>
                    </div>
                </div>
                <div class="zero-budget__block-colors cofrinhos-page__goal-card-colors">
                    <span class="zero-budget__colors-label">Cor da caixinha</span>
                    <div class="zero-budget__colors-list" role="group" aria-label="Cor da caixinha ${escapeAttr(b.name)}">
                        ${buildBucketColorSwatchesHtml(b.colorKey, { bucketId: b.id })}
                    </div>
                </div>
                <div class="cofrinhos-page__bucket-actions">
                    <button type="button" class="btn-secondary btn-sm" data-bucket-allocate="${escapeAttr(b.id)}" title="Aporte direto na caixinha">
                        <i class="fas fa-plus" aria-hidden="true"></i> Aportar
                    </button>
                    <button type="button" class="btn-secondary btn-sm" data-bucket-history="${escapeAttr(b.id)}">
                        <i class="fas fa-history" aria-hidden="true"></i> Histórico
                    </button>
                    <button type="button" class="btn-secondary btn-sm" data-bucket-settings="${escapeAttr(b.id)}">
                        <i class="fas fa-gear" aria-hidden="true"></i> Definições
                    </button>
                </div>
            </article>`;
        })
        .join('');
}

function renderMilestonePanel() {
    const el = document.getElementById('cofrinhos-milestone');
    if (!el) return;

    const year = cache.milestoneYear;
    const buckets = cache.buckets;
    let metaTotal = 0;
    let achievedTotal = 0;
    const segments = buckets.map((b) => {
        const goal = getBucketGoalForYear(cache.bucketGoals, b.id, year);
        const meta = goal ? parseFloat(goal.targetAmount) || 0 : 0;
        const val =
            year === new Date().getFullYear()
                ? sumAllocatedByBucket(cache.expenses, b, cache.applications)
                : goal
                  ? parseFloat(goal.achievedAmount) || 0
                  : 0;
        metaTotal += meta;
        achievedTotal += val;
        return { b, meta, val };
    });

    const perf = buildPerformanceByBucket(buckets, cache.applications, cache.expenses);
    const lucroTotal = perf.reduce((s, p) => s + p.lucro, 0);
    const totalAportado = getTotalApplicationsSum(cache.applications, cache.expenses, buckets);
    const constancy = countConsecutiveCofrinhoMonths(cache.applications, cache.expenses, buckets);
    const percGlobal = metaTotal > 0 ? Math.min((achievedTotal / metaTotal) * 100, 100) : 0;

    const years = [...new Set([new Date().getFullYear(), ...cache.bucketGoals.map((g) => g.year)])].sort(
        (a, b) => b - a
    );
    const remaining = Math.max(metaTotal - achievedTotal, 0);
    const metaReached = metaTotal > 0 && achievedTotal >= metaTotal;
    const footerRight = metaReached
        ? 'Meta superada!'
        : `Faltam ${formatCurrency(remaining, cache.currency)}`;
    const barSegments =
        segments
            .map((s) => {
                const width = metaTotal > 0 ? Math.max((s.val / metaTotal) * 100, 0) : 0;
                const hex = bucketColorHex(s.b.colorKey);
                if (width <= 0) return '';
                return `<span class="cofrinhos-milestone__bar-seg" style="width:${width.toFixed(2)}%;background-color:${hex}" title="${escapeHtml(s.b.name)}: ${formatCurrency(s.val, cache.currency)} de ${formatCurrency(s.meta, cache.currency)}"></span>`;
            })
            .join('') || '<span class="cofrinhos-milestone__bar-seg cofrinhos-milestone__bar-seg--empty"></span>';

    el.className = 'cofrinhos-milestone';
    el.innerHTML = `
        <div class="cofrinhos-milestone__grid">
            <div class="cofrinhos-milestone__main">
                <div class="cofrinhos-milestone__head">
                    <h3 class="cofrinhos-milestone__title">
                        <i class="fas fa-chart-pie" aria-hidden="true"></i> Progresso anual
                    </h3>
                    <select id="cofrinhos-milestone-year" class="cofrinhos-milestone__year-select" aria-label="Ano">
                        ${years.map((y) => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`).join('')}
                    </select>
                </div>
                <div class="cofrinhos-milestone__card">
                    <div class="cofrinhos-milestone__totals-row">
                        <div>
                            <span class="cofrinhos-milestone__kicker">Total alcançado (${year})</span>
                            <span class="cofrinhos-milestone__achieved">${formatCurrency(achievedTotal, cache.currency)}</span>
                        </div>
                        <div class="cofrinhos-milestone__meta-side">
                            <span class="cofrinhos-milestone__kicker">Meta global ${year}</span>
                            <span class="cofrinhos-milestone__meta-value">${formatCurrency(metaTotal, cache.currency)}</span>
                        </div>
                    </div>
                    <div class="cofrinhos-milestone__bar" role="img" aria-label="Distribuição do progresso por caixinha">
                        ${barSegments}
                    </div>
                    <div class="cofrinhos-milestone__bar-footer">
                        <span class="cofrinhos-milestone__perc-badge">${percGlobal.toFixed(1)}% da meta</span>
                        <span class="cofrinhos-milestone__remaining">${footerRight}</span>
                    </div>
                </div>
            </div>
            <div class="cofrinhos-milestone__kpis">
                <div class="cofrinhos-milestone__kpi cofrinhos-milestone__kpi--indigo">
                    <span class="cofrinhos-milestone__kpi-icon"><i class="fas fa-trophy" aria-hidden="true"></i></span>
                    <div>
                        <span class="cofrinhos-milestone__kpi-label">Patrimônio (est.)</span>
                        <span class="cofrinhos-milestone__kpi-value">${formatCurrency(totalAportado + lucroTotal, cache.currency)}</span>
                    </div>
                </div>
                <div class="cofrinhos-milestone__kpi cofrinhos-milestone__kpi--emerald">
                    <span class="cofrinhos-milestone__kpi-icon"><i class="fas fa-award" aria-hidden="true"></i></span>
                    <div>
                        <span class="cofrinhos-milestone__kpi-label">Bola de neve (est.)</span>
                        <span class="cofrinhos-milestone__kpi-value">${formatCurrency(lucroTotal, cache.currency)}</span>
                    </div>
                </div>
                <div class="cofrinhos-milestone__kpi cofrinhos-milestone__kpi--amber">
                    <span class="cofrinhos-milestone__kpi-icon"><i class="fas fa-fire" aria-hidden="true"></i></span>
                    <div>
                        <span class="cofrinhos-milestone__kpi-label">Constância</span>
                        <span class="cofrinhos-milestone__kpi-value">${constancy} ${constancy === 1 ? 'mês' : 'meses'}</span>
                    </div>
                </div>
            </div>
        </div>`;
    el.querySelector('#cofrinhos-milestone-year')?.addEventListener('change', (e) => {
        cache.milestoneYear = parseInt(e.target.value, 10) || new Date().getFullYear();
        renderMilestonePanel();
    });
}

function renderApplicationRowHtml(a, accMap, { showBucket = true } = {}) {
    const bucketMap = new Map(cache.buckets.map((b) => [b.id, b]));
    const b = bucketMap.get(a.bucketId);
    const acc = a.accountId ? accMap.get(a.accountId) : null;
    const ym = referenceMonthToYearMonth(a.referenceMonth);
    return `<tr>
                ${showBucket ? `<td>${escapeHtml(b?.name || '—')}</td>` : ''}
                <td>${escapeHtml(formatYearMonthLabel(ym))}</td>
                <td class="cofrinho">${formatCurrency(a.amount, cache.currency)}</td>
                <td>${escapeHtml(acc?.name || '—')}</td>
                <td class="cofrinhos-td-status"><span class="expense-status-badge expense-status-badge--paid">${escapeHtml(a.status || 'Concluído')}</span></td>
                <td class="transaction-actions">
                    <div class="transaction-actions__inner">
                        <button type="button" class="btn-action btn-edit cof-app-edit" data-id="${escapeAttr(a.id)}" title="Editar"><i class="fas fa-pencil-alt"></i></button>
                        <button type="button" class="btn-action btn-delete cof-app-delete" data-id="${escapeAttr(a.id)}" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
}

function renderApplicationsTable() {
    const tbody = document.getElementById('cofrinhos-applications-tbody');
    const sumEl = document.getElementById('cofrinhos-applications-sum');
    if (!tbody) return;

    const list = filterApplications(cache.applications);

    const sum = list.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    if (sumEl) sumEl.textContent = `Total: ${formatCurrency(sum, cache.currency)}`;

    const accMap = new Map(cache.accounts.map((a) => [a.id, a]));

    if (!list.length) {
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center; opacity:0.8;">Nenhuma aplicação encontrada.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((a) => renderApplicationRowHtml(a, accMap, { showBucket: true })).join('');
}

function openApplicationModal(id = null, options = {}) {
    const form = document.getElementById('cofrinho-application-form');
    if (!form) return;

    const app = id ? cache.applications.find((a) => a.id === id) : null;
    const mode = options.mode || (app?.sourceExpenseId ? 'pool' : app ? 'pool' : cache.allocationMode) || 'pool';
    cache.allocationMode = mode;

    const ym = clampReferenceToCurrentYear(
        options.referenceMonth ||
            (app ? referenceMonthToYearMonth(app.referenceMonth) : null) ||
            cache.referenceYearMonth ||
            currentYearMonth()
    );
    const isDirect = mode === 'direct' && !id;

    document.getElementById('cofrinho-application-id').value = app?.id || '';
    const titleEl = document.getElementById('cofrinho-application-modal-title');
    let titleText = 'Distribuir aporte';
    if (app) titleText = 'Editar aporte';
    else if (isDirect) titleText = 'Aporte direto na caixinha';
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-coins" aria-hidden="true"></i> ${titleText}`;
    }

    const modeRow = document.getElementById('cofrinho-application-mode-row');
    if (modeRow) modeRow.hidden = Boolean(id);

    const monthInput = document.getElementById('cofrinho-application-month');
    applyReferenceMonthInputBounds(monthInput);
    if (monthInput) {
        monthInput.disabled = false;
        monthInput.value = ym;
    }

    document.getElementById('cofrinho-application-amount').value = app?.amount ?? '';
    populateBucketSelect(
        document.getElementById('cofrinho-application-bucket'),
        options.bucketId || app?.bucketId
    );
    populateAccountSelect(document.getElementById('cofrinho-application-account'), app?.accountId);

    form.dataset.allocationMode = isDirect ? 'direct' : 'pool';
    document.querySelectorAll('input[name="cofrinho-allocation-mode"]').forEach((radio) => {
        radio.checked = radio.value === (isDirect ? 'direct' : 'pool');
    });

    const msgEl = document.getElementById('cofrinho-application-message');
    if (msgEl) {
        msgEl.classList.add('hidden');
        msgEl.textContent = '';
    }
    syncApplicationModalReferenceMonth(ym);
    openModal('cofrinho-application-modal');
}

async function handleApplicationSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('cofrinho-application-id')?.value;
    const monthInput = document.getElementById('cofrinho-application-month');
    const ym = clampReferenceToCurrentYear(
        monthInput?.value || form.dataset.referenceMonth || cache.referenceYearMonth
    );
    if (monthInput) monthInput.value = ym;
    form.dataset.referenceMonth = ym;
    const mode = form.dataset.allocationMode || 'pool';
    const amount = parseFloat(document.getElementById('cofrinho-application-amount')?.value);
    const pending = computePendingBalance(cache.expenses, cache.applications, ym);
    const app = id ? cache.applications.find((a) => a.id === id) : null;

    if (!Number.isFinite(amount) || amount <= 0) {
        showMessage('cofrinho-application-message', 'Informe um valor válido.', 'error');
        return;
    }

    if (mode !== 'direct') {
        const maxAvail = app ? pending + (parseFloat(app.amount) || 0) : pending;
        if (amount > maxAvail + 0.001) {
            showMessage('cofrinho-application-message', 'Valor maior que o saldo pool disponível.', 'error');
            return;
        }
    } else if (!id) {
        const accountId = document.getElementById('cofrinho-application-account')?.value;
        if (!accountId) {
            showMessage('cofrinho-application-message', 'Selecione a conta para o aporte direto.', 'error');
            return;
        }
    }

    const sourceExpenseId = document.getElementById('cofrinho-application-pool-source')?.value || null;

    const data = {
        mode: id ? 'pool' : mode,
        bucketId: document.getElementById('cofrinho-application-bucket')?.value,
        referenceMonth: yearMonthToReferenceMonth(ym),
        amount,
        accountId: document.getElementById('cofrinho-application-account')?.value || null,
        status: 'Concluído',
        sourceExpenseId: sourceExpenseId || undefined
    };

    setFormSubmittingState(form, true, 'Salvando...');
    try {
        await saveCofrinhoAllocation(data, id || null);
        closeModal('cofrinho-application-modal');
        await loadCategoriesFromDatabase(true);
        onUpdateCallback?.();
    } catch (err) {
        console.error(err);
        showMessage('cofrinho-application-message', err?.message || 'Não foi possível salvar.', 'error');
    } finally {
        setFormSubmittingState(form, false);
    }
}

async function deleteApplication(id) {
    if (!confirm('Excluir esta aplicação? O valor voltará ao saldo pool quando aplicável.')) return;
    try {
        await deleteCofrinhoAllocation(id);
        await loadCategoriesFromDatabase(true);
        onUpdateCallback?.();
    } catch (e) {
        console.error(e);
        alert('Não foi possível excluir.');
    }
}

function openBucketHistoryModal(bucketId) {
    cache.historyBucketId = bucketId;
    const b = cache.buckets.find((x) => x.id === bucketId);
    const titleEl = document.getElementById('cofrinho-bucket-history-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-history" aria-hidden="true"></i> Histórico: ${escapeHtml(b?.name || '')}`;
    }
    renderBucketHistoryModal();
    openModal('cofrinho-bucket-history-modal');
}

function renderBucketHistoryModal() {
    renderBucketHistoryApplications();
    renderBucketHistoryGoals();
}

function renderBucketHistoryApplications() {
    const tbody = document.getElementById('cofrinho-bucket-history-apps-tbody');
    const sumEl = document.getElementById('cofrinho-bucket-history-apps-sum');
    if (!tbody || !cache.historyBucketId) return;

    const list = filterApplications(cache.applications, { bucketId: cache.historyBucketId });
    const accMap = new Map(cache.accounts.map((a) => [a.id, a]));
    const sum = list.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    if (sumEl) sumEl.textContent = `Total nesta caixinha: ${formatCurrency(sum, cache.currency)}`;

    if (!list.length) {
        tbody.innerHTML =
            '<tr><td colspan="5" style="text-align:center; opacity:0.8;">Nenhum aporte registado nesta caixinha.</td></tr>';
        return;
    }

    tbody.innerHTML = list
        .map((a) => renderApplicationRowHtml(a, accMap, { showBucket: false }))
        .join('');
}

function renderBucketHistoryGoals() {
    const list = document.getElementById('cofrinho-bucket-history-list');
    if (!list || !cache.historyBucketId) return;

    const goals = cache.bucketGoals
        .filter((g) => g.bucketId === cache.historyBucketId)
        .sort((a, b) => b.year - a.year);

    const yearOptions = [2024, 2025, 2026, 2027, 2028, 2029];
    if (!goals.length) {
        list.innerHTML =
            '<p class="cofrinho-history-modal__empty">Nenhuma meta anual registada. Use «Registar novo ano» para criar.</p>';
    } else {
    list.innerHTML = goals
        .map(
            (g) => `
        <div class="cofrinho-history-row" data-goal-id="${escapeAttr(g.id)}">
            <label>Ano
                <select class="inv-goal-year">${yearOptions.map((y) => `<option value="${y}"${g.year === y ? ' selected' : ''}>${y}</option>`).join('')}</select>
            </label>
            <label>Estado
                <select class="inv-goal-status">${GOAL_STATUS_OPTIONS.map((s) => `<option${g.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
            </label>
            <label>Meta (R$)
                <input type="number" class="inv-goal-target" step="0.01" min="0" value="${g.targetAmount}">
            </label>
            <label>Alcançado (R$)
                <input type="number" class="inv-goal-achieved" step="0.01" min="0" value="${g.achievedAmount}">
            </label>
            <div class="cofrinho-history-row__actions">
                <button type="button" class="btn-icon inv-goal-save" title="Salvar"><i class="fas fa-check"></i></button>
                <button type="button" class="btn-icon inv-goal-delete" title="Excluir"><i class="fas fa-trash"></i></button>
            </div>
        </div>`
        )
        .join('');

        list.querySelectorAll('.inv-goal-save').forEach((btn) => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.cofrinho-history-row');
                void saveHistoryRow(row);
            });
        });
        list.querySelectorAll('.inv-goal-delete').forEach((btn) => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.cofrinho-history-row');
                void deleteHistoryRow(row?.dataset.goalId);
            });
        });
    }
}

async function saveHistoryRow(row) {
    if (!row) return;
    const id = row.dataset.goalId;
    const data = {
        bucketId: cache.historyBucketId,
        year: parseInt(row.querySelector('.inv-goal-year')?.value, 10),
        targetAmount: parseFloat(row.querySelector('.inv-goal-target')?.value) || 0,
        achievedAmount: parseFloat(row.querySelector('.inv-goal-achieved')?.value) || 0,
        status: row.querySelector('.inv-goal-status')?.value || 'Em andamento'
    };
    try {
        await saveCofrinhoBucketGoal(data, id);
        onUpdateCallback?.();
    } catch (e) {
        console.error(e);
        showMessage('cofrinho-bucket-history-message', 'Erro ao salvar meta.', 'error');
    }
}

async function deleteHistoryRow(id) {
    if (!id || !confirm('Excluir esta meta?')) return;
    try {
        await deleteCofrinhoBucketGoal(id);
        onUpdateCallback?.();
    } catch (e) {
        console.error(e);
    }
}

async function addBucketGoalYear() {
    if (!cache.historyBucketId) return;
    const year = new Date().getFullYear();
    try {
        await saveCofrinhoBucketGoal({
            bucketId: cache.historyBucketId,
            year,
            targetAmount: 0,
            achievedAmount: 0,
            status: 'Em andamento'
        });
        onUpdateCallback?.();
    } catch (e) {
        if (String(e.message || '').includes('409') || e.status === 409) {
            showMessage('cofrinho-bucket-history-message', 'Meta deste ano já existe.', 'error');
        }
    }
}

function openCreateBucketModal() {
    cache.editingBucketId = null;
    const title = document.getElementById('cofrinho-buckets-modal-title');
    const submit = document.getElementById('cofrinho-bucket-submit');
    const delBtn = document.getElementById('cofrinho-bucket-delete');
    const form = document.getElementById('cofrinho-bucket-form');
    if (title) title.innerHTML = '<i class="fas fa-piggy-bank" aria-hidden="true"></i> Nova caixinha';
    if (submit) submit.textContent = 'Adicionar caixinha';
    delBtn?.classList.add('hidden');
    form?.reset();
    const msgEl = document.getElementById('cofrinho-buckets-message');
    if (msgEl) {
        msgEl.classList.add('hidden');
        msgEl.textContent = '';
    }
    mountBucketColorSwatchesInForm('violet');
    openModal('cofrinho-buckets-modal');
    requestAnimationFrame(() => document.getElementById('cofrinho-bucket-name')?.focus());
}

function openBucketSettingsModal(bucketId) {
    const b = cache.buckets.find((x) => x.id === bucketId);
    if (!b) return;
    cache.editingBucketId = bucketId;
    const title = document.getElementById('cofrinho-buckets-modal-title');
    const submit = document.getElementById('cofrinho-bucket-submit');
    const delBtn = document.getElementById('cofrinho-bucket-delete');
    if (title) title.innerHTML = `<i class="fas fa-piggy-bank" aria-hidden="true"></i> Definições: ${escapeHtml(b.name)}`;
    if (submit) submit.textContent = 'Guardar alterações';
    delBtn?.classList.remove('hidden');
    document.getElementById('cofrinho-bucket-name').value = b.name || '';
    document.getElementById('cofrinho-bucket-yield').value = b.yieldMultiplier ?? 1.02;
    const msgEl = document.getElementById('cofrinho-buckets-message');
    if (msgEl) {
        msgEl.classList.add('hidden');
        msgEl.textContent = '';
    }
    mountBucketColorSwatchesInForm(b.colorKey || 'violet');
    openModal('cofrinho-buckets-modal');
    requestAnimationFrame(() => document.getElementById('cofrinho-bucket-name')?.focus());
}

async function deleteEditingBucket() {
    if (!cache.editingBucketId || !confirm('Excluir esta caixinha?')) return;
    try {
        await deleteCofrinhoBucket(cache.editingBucketId);
        closeModal('cofrinho-buckets-modal');
        cache.editingBucketId = null;
        onUpdateCallback?.();
    } catch (e) {
        alert(e.message || 'Não foi possível excluir.');
    }
}

async function handleBucketFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = (document.getElementById('cofrinho-bucket-name')?.value || '').trim();
    if (!name) return;

    const data = {
        name,
        colorKey: document.getElementById('cofrinho-bucket-color')?.value || 'violet',
        icon: 'fa-chart-line',
        yieldMultiplier: parseFloat(document.getElementById('cofrinho-bucket-yield')?.value) || 1.02
    };

    setFormSubmittingState(form, true, cache.editingBucketId ? 'Guardando...' : 'Adicionando...');
    try {
        await saveCofrinhoBucket(data, cache.editingBucketId || null);
        closeModal('cofrinho-buckets-modal');
        cache.editingBucketId = null;
        form.reset();
        await loadCategoriesFromDatabase(true);
        onUpdateCallback?.();
    } catch (err) {
        showMessage(
            'cofrinho-buckets-message',
            cache.editingBucketId ? 'Erro ao guardar caixinha.' : 'Erro ao criar caixinha.',
            'error'
        );
    } finally {
        setFormSubmittingState(form, false);
    }
}

function populateBucketSelect(select, selectedId = '') {
    if (!select) return;
    select.innerHTML = cache.buckets
        .map((b) => `<option value="${escapeAttr(b.id)}"${b.id === selectedId ? ' selected' : ''}>${escapeHtml(b.name)}</option>`)
        .join('');
}

function populateAccountSelect(select, selectedId = '') {
    if (!select) return;
    const accounts = cache.accounts.filter((a) => !isCardAccountType(a.type));
    select.innerHTML =
        '<option value="">Nenhuma</option>' +
        accounts
            .map(
                (a) =>
                    `<option value="${escapeAttr(a.id)}"${a.id === selectedId ? ' selected' : ''}>${escapeHtml(a.name)}</option>`
            )
            .join('');
}

function buildBucketColorSwatchesHtml(selectedKey, { bucketId = null, formMode = false } = {}) {
    return BUCKET_COLOR_KEYS.map((key) => {
        const hex = bucketColorHex(key);
        const selected = key === selectedKey;
        const label = BUCKET_COLOR_LABELS[key] || key;
        const attrs = formMode
            ? `data-bucket-form-color="${escapeAttr(key)}"`
            : `data-bucket-set-color="${escapeAttr(bucketId)}" data-color-key="${escapeAttr(key)}"`;
        return `<button type="button"
            class="zero-budget__color-swatch${selected ? ' is-selected' : ''}"
            style="background-color:${hex}"
            ${attrs}
            title="${escapeAttr(label)}"
            aria-label="Cor ${escapeAttr(label)}"
            aria-pressed="${selected ? 'true' : 'false'}"></button>`;
    }).join('');
}

function mountBucketColorSwatchesInForm(selectedKey = 'violet') {
    const hidden = document.getElementById('cofrinho-bucket-color');
    const container = document.getElementById('cofrinho-bucket-color-swatches');
    const key = selectedKey || hidden?.value || 'violet';
    if (hidden) hidden.value = key;
    if (container) {
        container.innerHTML = buildBucketColorSwatchesHtml(key, { formMode: true });
    }
}

function setBucketFormColor(colorKey) {
    const hidden = document.getElementById('cofrinho-bucket-color');
    if (hidden) hidden.value = colorKey;
    document
        .querySelectorAll('#cofrinho-bucket-color-swatches .zero-budget__color-swatch')
        .forEach((btn) => {
            const key = btn.getAttribute('data-bucket-form-color');
            const selected = key === colorKey;
            btn.classList.toggle('is-selected', selected);
            btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
}

function handleBucketFormClick(e) {
    const colorBtn = e.target.closest('[data-bucket-form-color]');
    if (colorBtn) {
        setBucketFormColor(colorBtn.getAttribute('data-bucket-form-color'));
    }
}

async function updateBucketColor(bucketId, colorKey, triggerEl) {
    const b = cache.buckets.find((x) => x.id === bucketId);
    if (!b || !colorKey || b.colorKey === colorKey) return;

    const save = async () => {
        await saveCofrinhoBucket({ colorKey }, bucketId);
        await loadCategoriesFromDatabase(true);
        onUpdateCallback?.();
    };

    try {
        if (triggerEl) await runWithButtonLoading(triggerEl, save);
        else await save();
    } catch (err) {
        console.error(err);
        alert(err?.message || 'Não foi possível atualizar a cor.');
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}
