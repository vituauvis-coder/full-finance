import { formatCurrency } from '../../core/utils.js';
import {
    saveCofrinhoAllocation,
    fetchCofrinhoPoolAvailable,
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
    COFRINHO_POOL_SUBCATEGORY,
    BUCKET_COLOR_KEYS,
    BUCKET_COLOR_LABELS,
    GOAL_STATUS_OPTIONS,
    bucketColorHex
} from './constants.js';
import {
    computePendingBalance,
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
    formatYearMonthLabel,
    formatApplicationCreatedAt
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
    editingGoalId: null,
};

const BUCKET_ICONS = {
    'fa-bullseye': 'fa-bullseye',
    'fa-chart-line': 'fa-chart-line',
    'fa-shield-halved': 'fa-shield-halved'
};

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
    document.getElementById('cofrinho-application-form')?.addEventListener('input', handleApplicationFormInput);
    document.querySelectorAll('[data-close-modal="cofrinho-application-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal('cofrinho-application-modal'));
    });
    document.getElementById('cofrinho-bucket-form')?.addEventListener('submit', handleBucketFormSubmit);
    document.getElementById('cofrinho-bucket-form')?.addEventListener('click', handleBucketFormClick);
    document.getElementById('cofrinho-bucket-goal-year')?.addEventListener('change', () => {
        if (cache.editingBucketId) {
            fillBucketGoalFields(cache.editingBucketId, parseInt(document.getElementById('cofrinho-bucket-goal-year')?.value, 10));
        }
    });
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
            openApplicationModal(null, { bucketId: allocateBtn.dataset.bucketAllocate });
        }
        if (historyBtn?.dataset.bucketHistory) openBucketHistoryModal(historyBtn.dataset.bucketHistory);
        if (settingsBtn?.dataset.bucketSettings) openBucketSettingsModal(settingsBtn.dataset.bucketSettings);
    });

    window.addEventListener('fullfinan-themechange', () => {
        if (document.getElementById('cofrinhos-page')?.classList.contains('active')) {
            renderCofrinhoCharts(cache.buckets, cache.applications, cache.currency, cache.expenses);
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

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function allocationSliderFillPercent(value, max) {
    const m = Number(max);
    if (!Number.isFinite(m) || m <= 0) return 0;
    const v = Math.min(Math.max(0, Number(value) || 0), m);
    return Math.min(100, Math.max(0, (v / m) * 100));
}

function updateAllocationSliderStyle(sliderEl) {
    if (!sliderEl) return;
    const max = parseFloat(sliderEl.max);
    const val = parseFloat(sliderEl.value);
    const pct = allocationSliderFillPercent(val, max);
    sliderEl.style.setProperty('--zb-accent', 'var(--cofrinhos-accent)');
    sliderEl.style.setProperty('--zb-fill-pct', `${pct}%`);
}

function getApplicationModalMaxAvailLocal(ym, editingId) {
    const pending = computePendingBalance(cache.expenses, cache.applications, ym);
    const app = editingId ? cache.applications.find((a) => a.id === editingId) : null;
    return app ? pending + (parseFloat(app.amount) || 0) : pending;
}

async function resolveApplicationModalMaxAvail(ym, editingId) {
    let available = getApplicationModalMaxAvailLocal(ym, editingId);
    try {
        const res = await fetchCofrinhoPoolAvailable(ym);
        const serverPool = Math.max(0, parseFloat(res?.available) || 0);
        if (editingId) {
            const app = cache.applications.find((a) => a.id === editingId);
            available = serverPool + (parseFloat(app?.amount) || 0);
        } else {
            available = serverPool;
        }
    } catch (e) {
        console.warn('fetchCofrinhoPoolAvailable', e);
    }
    return available;
}

function setApplicationModalAmount(amount, maxAvail) {
    const max = Math.max(0, roundMoney2(maxAvail));
    const rounded = roundMoney2(Math.min(Math.max(0, amount), max));
    const amountInput = document.getElementById('cofrinho-application-amount');
    const slider = document.getElementById('cofrinho-application-slider');
    const display = document.getElementById('cofrinho-application-amount-display');

    if (amountInput) {
        amountInput.value = rounded > 0 ? String(rounded) : '';
        amountInput.max = max > 0 ? String(max) : '';
        amountInput.disabled = max <= 0;
    }
    if (slider) {
        slider.max = String(max);
        slider.min = '0';
        slider.value = String(rounded);
        slider.disabled = max <= 0;
        slider.setAttribute('aria-valuemax', String(max));
        slider.setAttribute('aria-valuenow', String(rounded));
    }
    if (display) display.textContent = formatCurrency(rounded, cache.currency);
    updateAllocationSliderStyle(slider);
}

async function syncApplicationModalMonth(ym) {
    const form = document.getElementById('cofrinho-application-form');
    if (!form) return;

    ym = clampReferenceToCurrentYear(ym);
    form.dataset.referenceMonth = ym;

    const id = document.getElementById('cofrinho-application-id')?.value;

    const scopeEl = document.getElementById('cofrinho-application-pool-scope');
    const maxEl = document.getElementById('cofrinho-application-pool-max');
    if (scopeEl) scopeEl.textContent = `Pool disponível em ${formatYearMonthLabel(ym)}`;
    if (maxEl) maxEl.textContent = '…';

    const maxAvail = await resolveApplicationModalMaxAvail(ym, id);
    if (maxEl) maxEl.textContent = formatCurrency(maxAvail, cache.currency);

    const amountInput = document.getElementById('cofrinho-application-amount');
    const current = parseFloat(amountInput?.value);
    const initial = Number.isFinite(current) && current > 0 ? current : 0;
    setApplicationModalAmount(initial, maxAvail);
}

function handleApplicationFormInput(e) {
    const slider = e.target.closest('#cofrinho-application-slider');
    if (slider) {
        const form = document.getElementById('cofrinho-application-form');
        const ym = clampReferenceToCurrentYear(form?.dataset.referenceMonth || cache.referenceYearMonth);
        const id = document.getElementById('cofrinho-application-id')?.value;
        void resolveApplicationModalMaxAvail(ym, id).then((maxAvail) => {
            setApplicationModalAmount(parseFloat(slider.value) || 0, maxAvail);
        });
        return;
    }
    if (e.target.id === 'cofrinho-application-amount') {
        const form = document.getElementById('cofrinho-application-form');
        const ym = clampReferenceToCurrentYear(form?.dataset.referenceMonth || cache.referenceYearMonth);
        const id = document.getElementById('cofrinho-application-id')?.value;
        const raw = parseFloat(e.target.value);
        void resolveApplicationModalMaxAvail(ym, id).then((maxAvail) => {
            setApplicationModalAmount(Number.isFinite(raw) ? raw : 0, maxAvail);
        });
    }
}

function refreshCofrinhosUI() {
    renderSummaryCards();
    renderPendingBanner();
    renderGoalCards();
    renderMilestonePanel();
    renderApplicationsTable();
    renderCofrinhoCharts(cache.buckets, cache.applications, cache.currency, cache.expenses);
}

function initCofrinhosPageUiOnce() {
    if (initCofrinhosPageUiOnceRan) return;
    if (!document.getElementById('cofrinhos-page')) return;
    initCofrinhosPageUiOnceRan = true;
}

function parseReferenceYearMonth(ym) {
    const [y, m] = String(ym || currentYearMonth()).split('-');
    return {
        year: parseInt(y, 10) || new Date().getFullYear(),
        month: parseInt(m, 10) || new Date().getMonth() + 1
    };
}

function renderSummaryCards() {
    const el = document.getElementById('cofrinhos-summary');
    if (!el) return;

    const pending = computePendingBalance(cache.expenses, cache.applications);
    const totalInBuckets = getTotalApplicationsSum(
        cache.applications,
        cache.expenses,
        cache.buckets
    );

    el.hidden = false;

    const pendingEl = document.getElementById('cofrinhos-summary-pending');
    if (pendingEl) pendingEl.textContent = formatCurrency(pending, cache.currency);

    const totalEl = document.getElementById('cofrinhos-summary-total');
    if (totalEl) totalEl.textContent = formatCurrency(totalInBuckets, cache.currency);
}

function renderPendingBanner() {
    const el = document.getElementById('cofrinhos-pending-banner');
    if (!el) return;

    const pending = computePendingBalance(cache.expenses, cache.applications);

    if (pending > 0) {
        el.hidden = false;
        el.className = 'cofrinhos-page__pending dashboard-pending-cash-outs';
        el.innerHTML = `
            <h3 class="dashboard-pending-title"><i class="fas fa-piggy-bank" aria-hidden="true"></i> Aguardando alocação</h3>
            <p class="dashboard-pending-hint">Saídas em «${escapeHtml(EXPENSE_COFRINHO_CATEGORY)}» na subcategoria <strong>${escapeHtml(COFRINHO_POOL_SUBCATEGORY)}</strong> — distribua nas caixinhas.</p>
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
                        <span class="cofrinhos-page__goal-card-meta">${
                            meta > 0
                                ? `de ${formatCurrency(meta, cache.currency)}`
                                : '<span class="cofrinhos-page__goal-card-meta--unset">meta não definida</span>'
                        }</span>
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
                    <button type="button" class="btn-secondary btn-sm" data-bucket-allocate="${escapeAttr(b.id)}" title="Distribuir aporte do pool">
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
                <td>${escapeHtml(formatApplicationCreatedAt(a.createdAt))}</td>
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
    if (!tbody) return;

    const list = filterApplications(cache.applications);

    const accMap = new Map(cache.accounts.map((a) => [a.id, a]));

    if (!list.length) {
        tbody.innerHTML =
            '<tr><td colspan="7" style="text-align:center; opacity:0.8;">Nenhuma aplicação encontrada.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((a) => renderApplicationRowHtml(a, accMap, { showBucket: true })).join('');
}

function openApplicationModal(id = null, options = {}) {
    const form = document.getElementById('cofrinho-application-form');
    if (!form) return;

    const app = id ? cache.applications.find((a) => a.id === id) : null;

    const ym = clampReferenceToCurrentYear(
        options.referenceMonth ||
            (app ? referenceMonthToYearMonth(app.referenceMonth) : null) ||
            cache.referenceYearMonth ||
            currentYearMonth()
    );

    document.getElementById('cofrinho-application-id').value = app?.id || '';
    const titleEl = document.getElementById('cofrinho-application-modal-title');
    const titleText = app ? 'Editar aporte' : 'Distribuir aporte';
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-coins" aria-hidden="true"></i> ${titleText}`;
    }

    const amountInput = document.getElementById('cofrinho-application-amount');
    if (amountInput) amountInput.value = app?.amount != null ? String(app.amount) : '';
    populateBucketSelect(
        document.getElementById('cofrinho-application-bucket'),
        options.bucketId || app?.bucketId
    );
    const msgEl = document.getElementById('cofrinho-application-message');
    if (msgEl) {
        msgEl.classList.add('hidden');
        msgEl.textContent = '';
    }
    openModal('cofrinho-application-modal');
    void syncApplicationModalMonth(ym);
}

async function handleApplicationSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('cofrinho-application-id')?.value;
    const ym = clampReferenceToCurrentYear(form.dataset.referenceMonth || cache.referenceYearMonth);
    const amount = parseFloat(document.getElementById('cofrinho-application-amount')?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        showMessage('cofrinho-application-message', 'Informe um valor válido.', 'error');
        return;
    }

    const maxAvail = await resolveApplicationModalMaxAvail(ym, id);
    if (amount > maxAvail + 0.001) {
        showMessage(
            'cofrinho-application-message',
            `Valor maior que o saldo disponível (${formatCurrency(maxAvail, cache.currency)}).`,
            'error'
        );
        return;
    }

    const data = {
        bucketId: document.getElementById('cofrinho-application-bucket')?.value,
        referenceMonth: yearMonthToReferenceMonth(ym),
        amount,
        status: 'Concluído'
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

function bucketGoalYearOptions(selectedYear = new Date().getFullYear()) {
    const y = new Date().getFullYear();
    const years = new Set([y - 1, y, y + 1, y + 2, ...cache.bucketGoals.map((g) => g.year)]);
    return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

function populateBucketGoalYearSelect(selectedYear) {
    const sel = document.getElementById('cofrinho-bucket-goal-year');
    if (!sel) return;
    const year = Number(selectedYear) || new Date().getFullYear();
    sel.innerHTML = bucketGoalYearOptions(year)
        .map((y) => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`)
        .join('');
}

function fillBucketGoalFields(bucketId, preferredYear = new Date().getFullYear()) {
    const year = Number(preferredYear) || new Date().getFullYear();
    populateBucketGoalYearSelect(year);
    const goal = bucketId ? getBucketGoalForYear(cache.bucketGoals, bucketId, year) : null;
    cache.editingGoalId = goal?.id || null;
    const goalIdEl = document.getElementById('cofrinho-bucket-goal-id');
    const targetEl = document.getElementById('cofrinho-bucket-goal-target');
    if (goalIdEl) goalIdEl.value = goal?.id || '';
    if (targetEl) {
        const target = goal ? parseFloat(goal.targetAmount) : NaN;
        targetEl.value = Number.isFinite(target) && target > 0 ? String(target) : '';
    }
}

async function persistBucketGoalFromForm(bucketId) {
    if (!bucketId) return;
    const year = parseInt(document.getElementById('cofrinho-bucket-goal-year')?.value, 10);
    const rawTarget = document.getElementById('cofrinho-bucket-goal-target')?.value;
    const targetAmount = rawTarget === '' || rawTarget == null ? NaN : parseFloat(rawTarget);
    if (!Number.isFinite(year)) return;

    const goalId =
        document.getElementById('cofrinho-bucket-goal-id')?.value?.trim() ||
        cache.editingGoalId ||
        null;
    const existing =
        goalId ? cache.bucketGoals.find((g) => g.id === goalId) : getBucketGoalForYear(cache.bucketGoals, bucketId, year);
    const target = Number.isFinite(targetAmount) ? Math.max(0, Math.round(targetAmount * 100) / 100) : 0;

    if (target <= 0 && !existing) return;

    await saveCofrinhoBucketGoal(
        {
            bucketId,
            year,
            targetAmount: target,
            achievedAmount: existing ? parseFloat(existing.achievedAmount) || 0 : 0,
            status: existing?.status || 'Em andamento'
        },
        existing?.id || goalId || null
    );
}

function openCreateBucketModal() {
    cache.editingBucketId = null;
    cache.editingGoalId = null;
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
    fillBucketGoalFields(null);
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
    if (title) title.innerHTML = `<i class="fas fa-gear" aria-hidden="true"></i> Definições: ${escapeHtml(b.name)}`;
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
    fillBucketGoalFields(bucketId);
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
        const saved = await saveCofrinhoBucket(data, cache.editingBucketId || null);
        const bucketId = cache.editingBucketId || saved?.id;
        if (bucketId) {
            try {
                await persistBucketGoalFromForm(bucketId);
            } catch (goalErr) {
                console.error(goalErr);
                showMessage(
                    'cofrinho-buckets-message',
                    goalErr?.message || 'Caixinha guardada, mas não foi possível salvar a meta.',
                    'error'
                );
                await loadCategoriesFromDatabase(true);
                onUpdateCallback?.();
                return;
            }
        }
        closeModal('cofrinho-buckets-modal');
        cache.editingBucketId = null;
        cache.editingGoalId = null;
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
