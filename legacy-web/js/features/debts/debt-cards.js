import { formatCurrency } from '../../core/utils.js';
import { saveDebt } from '../../services/firestore.js';
import { runWithButtonLoading } from '../../core/button-loading.js';
import {
    DEBT_COLOR_KEYS,
    DEBT_COLOR_LABELS,
    debtColorHex,
    sortDebtsByCompany
} from './constants.js';
import {
    getCurrentDebtAmount,
    resolveInitialDebtAmount,
    computeDebtChangeFromInitial
} from './debts-aggregations.js';

function patchDebtInCache(debts, debtId, patch) {
    if (!debts || !debtId) return;
    const idx = debts.findIndex((d) => d.id === debtId);
    if (idx >= 0) debts[idx] = { ...debts[idx], ...patch };
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

function buildDebtColorSwatchesHtml(selectedKey, debtId) {
    return DEBT_COLOR_KEYS.map((key) => {
        const hex = debtColorHex(key);
        const selected = key === selectedKey;
        const label = DEBT_COLOR_LABELS[key] || key;
        return `<button type="button"
            class="zero-budget__color-swatch${selected ? ' is-selected' : ''}"
            style="background-color:${hex}"
            data-debt-set-color="${escapeAttr(debtId)}"
            data-color-key="${escapeAttr(key)}"
            title="${escapeAttr(label)}"
            aria-label="Cor ${escapeAttr(label)}"
            aria-pressed="${selected ? 'true' : 'false'}"></button>`;
    }).join('');
}

function buildChangeBlock(change, currency) {
    if (!change) {
        return `
            <div class="debts-page__goal-change">
                <span class="debts-page__goal-change-label">Variação</span>
                <span class="debts-page__goal-change-value">—</span>
            </div>
            <p class="debts-page__goal-card-delta">Defina o valor inicial para comparar.</p>`;
    }

    if (change.kind === 'discounted') {
        const below = Math.abs(change.delta);
        return `
            <div class="debts-page__goal-change debts-page__goal-change--discounted">
                <span class="debts-page__goal-change-label">Desconto</span>
                <span class="debts-page__goal-change-value">−${change.percent.toFixed(1)}%</span>
            </div>
            <p class="debts-page__goal-card-delta debts-page__goal-card-delta--discounted">${formatCurrency(below, currency)} abaixo do inicial</p>`;
    }

    if (change.kind === 'elevated') {
        return `
            <div class="debts-page__goal-change debts-page__goal-change--elevated">
                <span class="debts-page__goal-change-label">Elevação</span>
                <span class="debts-page__goal-change-value">+${change.percent.toFixed(1)}%</span>
            </div>
            <p class="debts-page__goal-card-delta debts-page__goal-card-delta--elevated">${formatCurrency(change.delta, currency)} acima do inicial</p>`;
    }

    return `
        <div class="debts-page__goal-change">
            <span class="debts-page__goal-change-label">Variação</span>
            <span class="debts-page__goal-change-value">0%</span>
        </div>
        <p class="debts-page__goal-card-delta">Igual ao valor inicial</p>`;
}

function buildDebtCardHtml(debt, updates, currency) {
    const current = getCurrentDebtAmount(updates, debt.id);
    const initial = resolveInitialDebtAmount(debt, updates);
    const change = computeDebtChangeFromInitial(initial, current);

    const colorKey = debt.colorKey || 'wine';
    const hex = debtColorHex(colorKey);

    return `
        <article class="debts-page__goal-card" data-debt-id="${escapeAttr(debt.id)}" style="--goal-accent:${hex}">
            <header class="debts-page__goal-card-head">
                <span class="debts-page__goal-card-dot" style="background-color:${hex}" aria-hidden="true"></span>
                <h4 class="debts-page__goal-card-title" title="${escapeAttr(debt.company)}">${escapeHtml(debt.company)}</h4>
            </header>

            <div class="debts-page__goal-card-hero">
                <span class="debts-page__goal-card-hero-label">Saldo atual</span>
                <span class="debts-page__goal-card-hero-value">${
                    current != null ? formatCurrency(current, currency) : '—'
                }</span>
            </div>

            <div class="debts-page__goal-card-metrics">
                <div class="debts-page__goal-metric">
                    <span class="debts-page__goal-metric-label">Inicial</span>
                    <span class="debts-page__goal-metric-value">${
                        initial != null
                            ? formatCurrency(initial, currency)
                            : '—'
                    }</span>
                </div>
                ${buildChangeBlock(change, currency)}
            </div>

            <div class="zero-budget__block-colors debts-page__goal-card-colors">
                <span class="zero-budget__colors-label">Cor do card</span>
                <div class="zero-budget__colors-list" role="group" aria-label="Cor ${escapeAttr(debt.company)}">
                    ${buildDebtColorSwatchesHtml(colorKey, debt.id)}
                </div>
            </div>

            <div class="debts-page__debt-actions">
                <button type="button" class="btn-secondary btn-sm" data-debt-register="${escapeAttr(debt.id)}">
                    <i class="fas fa-plus" aria-hidden="true"></i> Registrar mês
                </button>
                <button type="button" class="btn-secondary btn-sm" data-debt-settings="${escapeAttr(debt.id)}">
                    <i class="fas fa-gear" aria-hidden="true"></i> Definições
                </button>
            </div>
        </article>`;
}

export function renderDebtCards(debts, updates, currency) {
    const grid = document.getElementById('debts-goal-cards');
    if (!grid) return;

    const active = sortDebtsByCompany((debts || []).filter((d) => d.isClosed !== true));
    if (!active.length) {
        grid.innerHTML = `
            <div class="goals-empty-state debts-page__empty">
                <div class="goals-empty-state__icon" aria-hidden="true"><i class="fas fa-landmark"></i></div>
                <p class="goals-empty-state__title">Nenhuma dívida cadastrada</p>
                <p class="goals-empty-state__text">Use «Nova dívida» no topo para registrar seu primeiro banco ou instituição.</p>
            </div>`;
        return;
    }

    grid.innerHTML = active.map((d) => buildDebtCardHtml(d, updates, currency)).join('');
}

async function updateDebtColor(debtId, colorKey, triggerEl, { getCaches, onLocalRefresh, onDataRefresh }) {
    const { debtsCache, debtUpdatesCache, currencyCache } = getCaches();
    const debt = (debtsCache || []).find((d) => d.id === debtId);
    if (!debt || !colorKey) return;
    const prevKey = debt.colorKey || 'wine';
    if (prevKey === colorKey) return;

    const applyColor = (key) => {
        patchDebtInCache(debtsCache, debtId, { colorKey: key });
        onLocalRefresh?.(debtsCache, debtUpdatesCache, currencyCache);
    };

    applyColor(colorKey);

    const save = async () => {
        const saved = await saveDebt({ colorKey }, debtId);
        patchDebtInCache(debtsCache, debtId, saved);
        onLocalRefresh?.(debtsCache, debtUpdatesCache, currencyCache);
        await onDataRefresh?.();
    };

    try {
        if (triggerEl) await runWithButtonLoading(triggerEl, save);
        else await save();
    } catch (err) {
        console.error(err);
        applyColor(prevKey);
        alert(err?.message || 'Não foi possível atualizar a cor.');
    }
}

export function bindDebtCardsEvents({ getCaches, onLocalRefresh, onDataRefresh, openRegisterForDebt, openSettingsForDebt }) {
    const grid = document.getElementById('debts-goal-cards');
    if (!grid || grid.dataset.bound === '1') return;
    grid.dataset.bound = '1';

    grid.addEventListener('click', async (e) => {
        const colorBtn = e.target.closest('[data-debt-set-color]');
        if (colorBtn?.dataset.debtSetColor) {
            e.preventDefault();
            await updateDebtColor(
                colorBtn.dataset.debtSetColor,
                colorBtn.dataset.colorKey,
                colorBtn,
                { getCaches, onLocalRefresh, onDataRefresh }
            );
            return;
        }

        const reg = e.target.closest('[data-debt-register]');
        if (reg?.dataset.debtRegister) {
            openRegisterForDebt?.(reg.dataset.debtRegister);
            return;
        }

        const settings = e.target.closest('[data-debt-settings]');
        if (settings?.dataset.debtSettings) {
            openSettingsForDebt?.(settings.dataset.debtSettings);
        }
    });
}

export function mountDebtSettingsColorSwatches(selectedKey = 'wine') {
    const hidden = document.getElementById('debt-settings-color');
    const container = document.getElementById('debt-settings-color-swatches');
    const key = selectedKey || hidden?.value || 'wine';
    if (hidden) hidden.value = key;
    if (!container) return;
    container.innerHTML = DEBT_COLOR_KEYS.map((k) => {
        const hex = debtColorHex(k);
        const selected = k === key;
        const label = DEBT_COLOR_LABELS[k] || k;
        return `<button type="button"
            class="zero-budget__color-swatch${selected ? ' is-selected' : ''}"
            style="background-color:${hex}"
            data-debt-form-color="${escapeAttr(k)}"
            title="${escapeAttr(label)}"
            aria-label="Cor ${escapeAttr(label)}"
            aria-pressed="${selected ? 'true' : 'false'}"></button>`;
    }).join('');
}
