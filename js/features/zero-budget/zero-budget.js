/**
 * Planejamento Base Zero - Lógica completa com persistência
 * Blocos dinâmicos vinculados a categorias, cálculo automático de saldo,
 * sliders limitados por saldo livre
 */

import {
    fetchZeroBudgetBlocks,
    createZeroBudgetBlock,
    updateZeroBudgetBlock,
    deleteZeroBudgetBlock
} from '../../services/zero-budget-service.js';

import {
    fetchCategories
} from '../../services/category-service.js';

import {
    calcAvailableBalance,
    explainPlanningBalance,
    calcTotalAllocated,
    calcMaxAllocation,
    formatMoney,
    getColorHex,
    getAvailableColors
} from '../../core/zero-budget-calculator.js';
import { openModal, closeModal } from '../../shell/app-shell.js';
import { buildSyntheticExpectedSplitGainsRows } from '../../core/expected-split-gain-rows.js';

const ZB_BAR_BG_ALLOWED = new Set(getAvailableColors().map((c) => c.class));

/** Classes de tom do card «Restante» (alinhado ao CSS). */
const ZB_REMAINING_TONE_CLASSES = [
    'zero-budget__stat--remaining-safe',
    'zero-budget__stat--remaining-warn',
    'zero-budget__stat--remaining-neutral'
];

/** Acima desta fração do saldo livre ainda não alocada → verde; abaixo → amarelo. */
const ZB_REMAINING_SAFE_RATIO = 0.22;

/**
 * @param {HTMLElement | null | undefined} restWrap
 * @param {number} availableBalance
 * @param {number} remaining
 * @param {boolean} isOverallocated
 */
function applyZbRemainingVisual(restWrap, availableBalance, remaining, isOverallocated) {
    if (!restWrap) return;
    for (const c of ZB_REMAINING_TONE_CLASSES) {
        restWrap.classList.remove(c);
    }
    if (isOverallocated || remaining < 0) return;
    const avail = Number(availableBalance) || 0;
    if (avail <= 0) {
        restWrap.classList.add(
            remaining > 0 ? 'zero-budget__stat--remaining-safe' : 'zero-budget__stat--remaining-neutral'
        );
        return;
    }
    const ratio = remaining / avail;
    if (ratio > ZB_REMAINING_SAFE_RATIO) {
        restWrap.classList.add('zero-budget__stat--remaining-safe');
    } else {
        restWrap.classList.add('zero-budget__stat--remaining-warn');
    }
}

function zbBarBgClass(cls) {
    const s = String(cls || '').trim();
    return ZB_BAR_BG_ALLOWED.has(s) ? s : 'bg-amber-500';
}

// Estado global da feature
let zbState = {
    currentMonth: new Date().getMonth() + 1, // 1-12
    currentYear: new Date().getFullYear(),
    blocks: [],
    categories: [], // Categorias de despesas disponíveis
    gains: [],
    expenses: [],
    isLoading: false,
    editingBlock: null // ID do bloco sendo editado (para cálculo de limite)
};

let zbRootElement = null;

// Meses para exibição
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Lista nomes de categorias de saída: mesma regra que Saídas (EXPENSE ou sem tipo)
 * e inclui nomes usados em despesas para não perder categorias legadas.
 * @param {unknown} rawCategories
 * @param {Array<{ category?: string }>} expenses
 * @returns {string[]}
 */
function collectExpenseCategoryNames(rawCategories, expenses) {
    const list = Array.isArray(rawCategories)
        ? rawCategories
        : rawCategories && Array.isArray(rawCategories.categories)
            ? rawCategories.categories
            : [];
    const names = new Set();
    for (const c of list) {
        const t = String(c?.type ?? '').toUpperCase();
        if (t === 'EXPENSE' || !c?.type) {
            const n = String(c?.name ?? '').trim();
            if (n) names.add(n);
        }
    }
    for (const e of expenses || []) {
        const n = String(e?.category ?? '').trim();
        if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'pt'));
}

/** Nome da categoria associada ao bloco (API: categoryName; legado: categories[0] / name). */
function getBlockCategoryName(block) {
    const n = block?.categoryName ?? block?.categories?.[0] ?? block?.name;
    return String(n || '').trim();
}

/** Contexto para saldo livre: mesmas contas / perfil / splits que o resto do app (card Saídas do mês). */
function zbPlanningCtx() {
    const app = window.AppState || {};
    return {
        accounts: Array.isArray(app.accounts) ? app.accounts : [],
        userProfile: app.userProfile ?? null,
        splitOutgoing: app.expenseSplitRequests?.outgoing || []
    };
}

/**
 * Ganhos persistidos + «Expectativa de estorno» sintética para o mês visível — igual à lista Entradas
 * (`AppState.gains` não inclui as sintéticas; o painel junta-as com `buildSyntheticExpectedSplitGainsRows`).
 */
function zbMergedGainsForSaldoLivre() {
    const app = window.AppState || {};
    const raw = Array.isArray(zbState.gains) ? zbState.gains : [];
    const expenses = Array.isArray(zbState.expenses) ? zbState.expenses : app.expenses || [];
    const accounts = Array.isArray(app.accounts) ? app.accounts : [];
    const outgoing = app.expenseSplitRequests?.outgoing || [];
    const planningNow = new Date(zbState.currentYear, zbState.currentMonth - 1, 15);
    const period = `month-${zbState.currentMonth - 1}`;
    let synthetic = [];
    try {
        synthetic = buildSyntheticExpectedSplitGainsRows(
            period,
            planningNow,
            expenses,
            accounts,
            outgoing,
            raw
        );
    } catch (err) {
        console.warn('[Planejamento Base Zero] expectativa de estorno:', err);
    }
    return synthetic.length ? [...raw, ...synthetic] : raw;
}

/** Categorias de saída ainda sem bloco neste mês. */
function getAvailableCategoriesForNewBlock() {
    const used = new Set(
        (zbState.blocks || []).map((b) => getBlockCategoryName(b)).filter(Boolean)
    );
    return zbState.categories.filter((c) => !used.has(c));
}

/**
 * Inicializa a página de Planejamento Base Zero
 * Chamado uma vez no carregamento do app
 */
export function initZeroBudgetPage() {
    const root = document.getElementById('zero-budget-page');
    if (!root || root.dataset.zbInitDone) return;
    
    root.dataset.zbInitDone = '1';
    zbRootElement = root;
    
    // Setup event listeners globais
    setupEventListeners(root);
    
    // Renderizar estrutura base
    renderBaseStructure(root);

    /**
     * Detalhe do saldo livre (mesmo critério da UI). No console: `explainZeroBudgetBalance()`.
     * Com `true`, imprime `console.table` e totais. `sessionStorage.setItem('ff-zb-explain','1')` loga a cada render do resumo.
     * @param {boolean} [logTables=true]
     */
    window.explainZeroBudgetBalance = (logTables = true) => {
        const ex = explainPlanningBalance(
            zbMergedGainsForSaldoLivre(),
            zbState.expenses,
            zbState.currentMonth,
            zbState.currentYear,
            zbPlanningCtx()
        );
        if (logTables && typeof console !== 'undefined') {
            console.group(`[Planejamento Base Zero] Mês ${ex.monthKey}`);
            console.log('Base saídas (igual lista):', ex.baseSaídas);
            console.log('Entradas somadas (recebido + pendente), competência no mês:');
            console.table(ex.gainRows);
            console.log('Total entradas:', formatMoney(ex.totalGains));
            console.log('Saídas marcadas como essenciais — contribuição neste mês (parcelas/splits como na tela Saídas):');
            console.table(ex.essentialRows);
            console.log('Total saídas essenciais (mês):', formatMoney(ex.totalEssentials));
            console.log('Saldo livre (entradas − essenciais):', formatMoney(ex.saldoLivre));
            console.groupEnd();
        }
        return ex;
    };
}

/**
 * Carrega os dados da página quando o usuário navega para ela
 */
export async function loadZeroBudgetPage() {
    const root = document.getElementById('zero-budget-page');
    if (!root) return;
    
    zbRootElement = root;
    
    // Resetar para mês atual
    const now = new Date();
    zbState.currentMonth = now.getMonth() + 1;
    zbState.currentYear = now.getFullYear();
    
    // Carregar dados
    await loadData();
    
    // Renderizar UI
    renderFullUI();
}

/**
 * Carrega dados do backend e do AppState
 */
async function loadData() {
    zbState.isLoading = true;
    renderLoadingState();
    
    try {
        // Buscar blocos do mês
        const blocks = await fetchZeroBudgetBlocks(zbState.currentMonth, zbState.currentYear);
        zbState.blocks = blocks || [];

        const appState = window.AppState || {};
        zbState.gains = appState.gains || [];
        zbState.expenses = appState.expenses || [];

        const allCategories = await fetchCategories();
        zbState.categories = collectExpenseCategoryNames(allCategories, zbState.expenses);
        
    } catch (err) {
        console.error('Erro ao carregar dados do Planejamento Base Zero:', err);
        showNotification('Erro ao carregar dados. Tente novamente.', 'error');
    } finally {
        zbState.isLoading = false;
    }
}

/**
 * Configura event listeners da UI
 */
function setupEventListeners(root) {
    // Timeline de meses
    root.addEventListener('click', handleTimelineClick);

    // Blocos (delegação de eventos)
    root.addEventListener('click', handleBlockActions);
    root.addEventListener('input', handleBlockInput);
    root.addEventListener('change', handleBlockChange);

    // Botão novo bloco (no header)
    const addBtn = document.getElementById('add-zero-budget-block-btn');
    if (addBtn) {
        addBtn.addEventListener('click', openCreateBlockModal);
    }

    const createForm = document.getElementById('zero-budget-block-form');
    if (createForm && !createForm.dataset.zbBound) {
        createForm.dataset.zbBound = '1';
        createForm.addEventListener('submit', handleCreateBlockSubmit);
    }

    const cancelBtn = document.querySelector('[data-zb-cancel-create]');
    if (cancelBtn && !cancelBtn.dataset.zbBound) {
        cancelBtn.dataset.zbBound = '1';
        cancelBtn.addEventListener('click', () => {
            closeModal('zero-budget-block-modal');
        });
    }
}

/**
 * Renderiza estrutura base (container, timeline, etc)
 */
function renderBaseStructure(root) {
    // A estrutura já está no HTML, apenas garantir que temos os containers corretos
    // Caso seja necessário recriar, o HTML base está em index.html
}

/**
 * Renderiza estado de carregamento
 */
function renderLoadingState() {
    const blocksContainer = zbRootElement?.querySelector('[data-zb-blocks]');
    if (blocksContainer) {
        blocksContainer.innerHTML = `
            <div class="zero-budget__loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Carregando...</span>
            </div>
        `;
    }
}

/**
 * Renderiza toda a UI com dados atualizados
 */
function renderFullUI() {
    if (!zbRootElement) return;
    
    renderTimeline();
    renderSummary();
    renderBlocks();
}

/**
 * Renderiza timeline de meses
 */
function renderTimeline() {
    const timeline = zbRootElement?.querySelector('[data-zb-timeline]');
    if (!timeline) return;
    
    const monthButtons = MONTH_NAMES.map((name, index) => {
        const monthNum = index + 1;
        const isActive = monthNum === zbState.currentMonth;
        const monthLabel = `${name}/${String(zbState.currentYear).slice(-2)}`;
        
        return `
            <button type="button" 
                    class="zero-budget__month-btn ${isActive ? 'is-active' : ''}"
                    data-zb-month="${monthNum}">
                ${monthLabel}
            </button>
        `;
    }).join('');
    
    timeline.innerHTML = monthButtons;
}

/**
 * Renderiza resumo (saldo livre, total alocado, estourado/restante, barra segmentada — padrão base.html)
 */
function renderSummary() {
    const ctx = zbPlanningCtx();
    const availableBalance = calcAvailableBalance(
        zbMergedGainsForSaldoLivre(),
        zbState.expenses,
        zbState.currentMonth,
        zbState.currentYear,
        ctx
    );

    try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ff-zb-explain') === '1') {
            window.explainZeroBudgetBalance?.(true);
        }
    } catch {
        /* ignore */
    }

    const totalAllocated = calcTotalAllocated(zbState.blocks);
    const remaining = availableBalance - totalAllocated;
    const isOverallocated = remaining < 0;

    const availableEl = zbRootElement?.querySelector('[data-zb-available]');
    const allocatedEl = zbRootElement?.querySelector('[data-zb-allocated]');
    const remainingEl = zbRootElement?.querySelector('[data-zb-remaining]');
    const monthLabelEl = zbRootElement?.querySelector('[data-zb-month-label]');
    const restWrap = zbRootElement?.querySelector('[data-zb-rest-wrap]');
    const burstWrap = zbRootElement?.querySelector('[data-zb-burst-wrap]');
    const burstVal = zbRootElement?.querySelector('[data-zb-burst]');
    const barEl = zbRootElement?.querySelector('[data-zb-summary-bar]');

    if (availableEl) availableEl.textContent = formatMoney(availableBalance);
    if (allocatedEl) allocatedEl.textContent = formatMoney(totalAllocated);
    if (monthLabelEl) {
        monthLabelEl.textContent = `${MONTH_NAMES[zbState.currentMonth - 1]}/${String(zbState.currentYear).slice(-2)}`;
    }

    if (restWrap) restWrap.classList.toggle('hidden', isOverallocated);
    if (burstWrap) burstWrap.classList.toggle('hidden', !isOverallocated);
    if (burstVal && isOverallocated) {
        burstVal.textContent = formatMoney(Math.abs(remaining));
    }

    if (remainingEl) {
        if (isOverallocated) {
            remainingEl.textContent = '';
            remainingEl.classList.remove('is-negative');
        } else {
            remainingEl.textContent = formatMoney(remaining);
            remainingEl.classList.remove('is-negative');
        }
    }

    applyZbRemainingVisual(restWrap, availableBalance, remaining, isOverallocated);

    if (!barEl) return;

    const denom = Math.max(availableBalance, totalAllocated, 1e-9);
    /** @type {{ key: string, nome: string, valor: number, rest: boolean, colorClass: string }[]} */
    const segs = [];
    for (const b of zbState.blocks || []) {
        const v = Number(b.allocatedAmount) || 0;
        if (v > 0) {
            segs.push({
                key: String(b.id),
                nome: getBlockCategoryName(b) || 'Bloco',
                valor: v,
                rest: false,
                colorClass: zbBarBgClass(b.color)
            });
        }
    }
    if (remaining > 0) {
        segs.push({
            key: 'restante',
            nome: 'Não alocado',
            valor: remaining,
            rest: true,
            colorClass: ''
        });
    }

    if (segs.length === 0) {
        barEl.innerHTML =
            '<div class="zero-budget__bar-seg zero-budget__bar-seg--empty"></div>';
        return;
    }

    barEl.innerHTML = segs
        .map((seg) => {
            const pctBar = denom > 0 ? ((seg.valor / denom) * 100).toFixed(1) : '0.0';
            /* Centavos inteiros → flex-grow estável (evita float estranho no layout) */
            const w = Math.max(0, Math.round((Number(seg.valor) || 0) * 100));
            const flexBase = `flex:${w} 1 0;min-width:0`;
            const style = seg.rest
                ? flexBase
                : `${flexBase};background-color:${getColorHex(seg.colorClass)}`;
            const klass = seg.rest ? 'zero-budget__bar-seg zero-budget__bar-seg--rest' : 'zero-budget__bar-seg';
            const accentHex = seg.rest ? '' : getColorHex(seg.colorClass);
            const pctClass = seg.rest
                ? 'zero-budget__bar-tip-pct zero-budget__bar-tip-pct--muted'
                : 'zero-budget__bar-tip-pct';
            const pctStyle = seg.rest ? '' : ` style="color:${accentHex}"`;
            const aria = `${String(seg.nome ?? 'Trecho')}: ${formatMoney(seg.valor)}, ${pctBar}% do orçamento`;
            return `<div class="${klass}" style="${style}" role="img" aria-label="${escapeHtml(aria)}" tabindex="0">
                <div class="zero-budget__bar-tip">
                    <span class="zero-budget__bar-tip-name">${escapeHtml(seg.nome)}</span>
                    <span class="zero-budget__bar-tip-value">${formatMoney(seg.valor)}</span>
                    <span class="${pctClass}"${pctStyle}>${pctBar}% do orçamento</span>
                </div>
            </div>`;
        })
        .join('');
}

/**
 * Renderiza grid de blocos
 */
function renderBlocks() {
    const container = zbRootElement?.querySelector('[data-zb-blocks]');
    if (!container) return;
    
    if (zbState.blocks.length === 0) {
        container.innerHTML = `
            <div class="zero-budget__empty">
                <i class="fas fa-bullseye"></i>
                <p>Nenhum bloco de orçamento criado</p>
            </div>
        `;
        return;
    }
    
    const availableBalance = calcAvailableBalance(
        zbMergedGainsForSaldoLivre(),
        zbState.expenses,
        zbState.currentMonth,
        zbState.currentYear,
        zbPlanningCtx()
    );
    
    const blocksHtml = zbState.blocks.map(block => {
        return renderBlockCard(block, availableBalance);
    }).join('');
    
    container.innerHTML = blocksHtml;
}

/**
 * Renderiza um card de bloco individual
 */
function renderBlockCard(block, availableBalance) {
    const colorHex = getColorHex(block.color);
    const catName = getBlockCategoryName(block);
    const maxAllocation = calcMaxAllocation(
        availableBalance,
        zbState.blocks,
        block.id,
        block.allocatedAmount || 0
    );
    
    const colorsHtml = getAvailableColors().map(c => `
        <button type="button" 
                class="zero-budget__color-swatch ${block.color === c.class ? 'is-selected' : ''}"
                style="background-color: ${c.hex}"
                data-zb-set-color="${block.id}"
                data-color="${c.class}"
                title="${c.label}"
                aria-label="Cor ${c.label}">
        </button>
    `).join('');

    return `
        <article class="zero-budget__block-card" data-zb-block-id="${block.id}">
            <div class="zero-budget__block-top">
                <div class="zero-budget__block-name-row">
                    <span class="zero-budget__block-dot" style="background-color: ${colorHex}" aria-hidden="true"></span>
                    <span class="zero-budget__block-title">${escapeHtml(catName || '—')}</span>
                    <button type="button"
                            class="zero-budget__block-delete"
                            data-zb-delete="${block.id}"
                            title="Excluir bloco">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <span class="zero-budget__block-amount-value" data-zb-amount-display="${block.id}">
                    ${formatMoney(block.allocatedAmount || 0)}
                </span>
            </div>

            <div class="zero-budget__block-body">
                <div class="zero-budget__block-slider-wrap">
                    <input type="range"
                           class="zero-budget__block-slider"
                           min="0"
                           max="${maxAllocation}"
                           step="1"
                           value="${block.allocatedAmount || 0}"
                           data-zb-slider="${block.id}">
                </div>
            </div>

            <div class="zero-budget__block-colors">
                <span class="zero-budget__colors-label">Cor da meta</span>
                <div class="zero-budget__colors-list">
                    ${colorsHtml}
                </div>
            </div>
        </article>
    `;
}

/**
 * Manipula cliques na timeline
 */
async function handleTimelineClick(e) {
    const btn = e.target.closest('[data-zb-month]');
    if (!btn) return;
    
    const month = parseInt(btn.dataset.zbMonth, 10);
    if (isNaN(month)) return;
    
    zbState.currentMonth = month;
    
    // Recarregar dados para o novo mês
    await loadData();
    renderFullUI();
}

/**
 * Manipula ações nos blocos (delegação)
 */
async function handleBlockActions(e) {
    const addBtn = e.target.closest('[data-zb-add-block]');
    if (addBtn) {
        await openCreateBlockModal();
        return;
    }

    // Excluir bloco
    const deleteBtn = e.target.closest('[data-zb-delete]');
    if (deleteBtn) {
        const blockId = deleteBtn.dataset.zbDelete;
        if (confirm('Tem certeza que deseja excluir este bloco?')) {
            try {
                await deleteZeroBudgetBlock(blockId);
                await loadData();
                renderFullUI();
                showNotification('Bloco excluído com sucesso', 'success');
            } catch (err) {
                showNotification('Erro ao excluir bloco', 'error');
            }
        }
        return;
    }
    
    // Mudar cor
    const colorBtn = e.target.closest('[data-zb-set-color]');
    if (colorBtn) {
        const blockId = colorBtn.dataset.zbSetColor;
        const color = colorBtn.dataset.color;
        
        try {
            await updateZeroBudgetBlock(blockId, { color });
            // Atualizar localmente para feedback imediato
            const block = zbState.blocks.find(b => b.id === blockId);
            if (block) block.color = color;
            renderBlocks();
            renderSummary();
        } catch (err) {
            showNotification('Erro ao atualizar cor', 'error');
        }
        return;
    }
}

/**
 * Manipula inputs nos blocos
 */
function handleBlockInput(e) {
    const slider = e.target.closest('[data-zb-slider]');
    if (slider) {
        const blockId = slider.dataset.zbSlider;
        const value = parseFloat(slider.value) || 0;

        const display = zbRootElement?.querySelector(`[data-zb-amount-display="${blockId}"]`);
        if (display) display.textContent = formatMoney(value);

        const block = zbState.blocks.find((b) => b.id === blockId);
        if (block) block.allocatedAmount = value;

        renderSummary();
        return;
    }
}

/**
 * Manipula changes (selects, inputs text)
 */
async function handleBlockChange(e) {
    const slider = e.target.closest('[data-zb-slider]');
    if (slider && e.target === slider) {
        const blockId = slider.dataset.zbSlider;
        const value = parseFloat(slider.value) || 0;
        try {
            await updateZeroBudgetBlock(blockId, { allocatedAmount: value });
            const block = zbState.blocks.find((b) => b.id === blockId);
            if (block) block.allocatedAmount = value;
            renderSummary();
        } catch (err) {
            showNotification('Erro ao salvar valor', 'error');
        }
        return;
    }

}

/**
 * Abre modal para criar novo bloco (uma categoria por bloco)
 */
async function openCreateBlockModal() {
    const form = document.getElementById('zero-budget-block-form');
    const row = document.getElementById('zero-budget-block-category-row');
    const catEmpty = document.getElementById('zero-budget-block-categories-empty');
    const sel = document.getElementById('zero-budget-block-category');
    const hint = document.getElementById('zero-budget-block-categories-hint');
    if (!form || !sel) return;

    sel.innerHTML = '';

    const available = getAvailableCategoriesForNewBlock();
    if (available.length) {
        if (catEmpty) catEmpty.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
        if (row) row.classList.remove('hidden');
        sel.disabled = false;
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'Selecione a categoria';
        sel.appendChild(opt0);
        for (const c of available) {
            const opt = document.createElement('option');
            opt.value = encodeURIComponent(c);
            opt.textContent = c;
            sel.appendChild(opt);
        }
        sel.value = '';
    } else {
        if (catEmpty) catEmpty.classList.remove('hidden');
        if (hint) hint.classList.add('hidden');
        if (row) row.classList.add('hidden');
        sel.disabled = true;
    }

    openModal('zero-budget-block-modal');
    if (!sel.disabled) sel.focus();
}

async function handleCreateBlockSubmit(e) {
    e.preventDefault();
    const sel = document.getElementById('zero-budget-block-category');
    if (!sel || sel.disabled) {
        showNotification('Nenhuma categoria disponível para este mês', 'error');
        return;
    }
    const raw = sel.value;
    if (!raw) {
        showNotification('Selecione uma categoria de saída', 'error');
        return;
    }
    const categoryName = decodeURIComponent(raw);

    try {
        await createZeroBudgetBlock({
            categoryName,
            color: 'bg-amber-500',
            allocatedAmount: 0,
            month: zbState.currentMonth,
            year: zbState.currentYear
        });

        closeModal('zero-budget-block-modal');
        await loadData();
        renderFullUI();
        showNotification('Bloco criado com sucesso', 'success');
    } catch (err) {
        showNotification(err?.message || 'Erro ao criar bloco', 'error');
    }
}

/**
 * Escapa HTML para segurança
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Mostra notificação toast
 */
function showNotification(message, type = 'info') {
    // Usar sistema de notificações existente do app se disponível
    if (window.showToast) {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

/**
 * Atualiza dados de gains/expenses do AppState
 * Chamado pelo main.js quando dados mudam
 */
export function updateZeroBudgetData(gains, expenses) {
    zbState.gains = gains || [];
    zbState.expenses = expenses || [];

    const fromTx = new Set(zbState.categories);
    for (const e of zbState.expenses) {
        const n = String(e?.category ?? '').trim();
        if (n) fromTx.add(n);
    }
    zbState.categories = [...fromTx].sort((a, b) => a.localeCompare(b, 'pt'));

    // Se estivermos na página, recalcular e renderizar
    const root = document.getElementById('zero-budget-page');
    if (root && !root.classList.contains('hidden')) {
        renderSummary();
        renderBlocks();
    }
}
