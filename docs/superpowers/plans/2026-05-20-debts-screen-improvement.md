# Dívidas — melhoria da tela Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar a página Dívidas no padrão Cofrinhos com 3 cards de resumo, gráfico de linhas por banco, gráfico de barras de variação mensal do total, e JS modular — sem mudar modelo de dados nem fluxo do modal.

**Architecture:** Extrair agregações e gráficos de `debts.js` para módulos dedicados; `debts-page.js` orquestra UI (cards + refresh); `debts.js` mantém apenas modal/formulário e persistência. Cards usam `MOVEMENT_SUMMARY_CARD_GROUPS.debts` + `setMovementSummaryMomVariation` (dívida que sobe = negativo).

**Tech stack:** Vanilla JS (ES modules), Chart.js (global), CSS existente (`movements-summary`, `dashboard-reports-charts-grid`), Firestore API via `js/services/firestore.js`.

**Spec:** `docs/superpowers/specs/2026-05-20-debts-screen-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `js/core/movement-summary-copy.js` | Grupo `debts` + `DEBTS_SUMMARY_COPY` |
| `js/features/debts/debts-aggregations.js` | `monthKey`, totais, série mensal consolidada |
| `js/features/debts/debts-charts.js` | Line chart por banco + bar chart variação |
| `js/features/debts/debts-page.js` | Mount cards, `loadDebtsData`, tabela, init UI |
| `js/features/debts/debts.js` | Modal, formulário multi-mês, save/delete |
| `index.html` | Markup `#debts-page` estilo Cofrinhos |
| `css/pages/debts.css` | Layout `debts-page__*` |
| `js/app/main.js` | Imports `initDebtsPage` + `loadDebtsData` |

**Note:** O projeto não tem testes automatizados (`npm test` é stub). Verificação manual após cada task.

---

### Task 1: Card definitions (`movement-summary-copy.js`)

**Files:**
- Modify: `js/core/movement-summary-copy.js`

- [ ] **Step 1: Adicionar copy e grupo `debts`**

Após `COFRINHOS_SUMMARY_COPY` (ou bloco equivalente de cofrinhos), adicionar:

```javascript
export const DEBTS_SUMMARY_COPY = {
    totalToday:
        'Soma do saldo mais recente de cada banco com dívida ativa (última atualização registrada).',
    monthTotal:
        'Soma dos saldos de fim de mês de cada banco no mês calendário atual.',
    bankCount: 'Bancos ou instituições com pelo menos uma atualização e dívida não encerrada.'
};
```

Dentro de `MOVEMENT_SUMMARY_CARD_GROUPS`, antes do fechamento do objeto, adicionar:

```javascript
    debts: {
        ariaLabel: 'Resumo das dívidas',
        containerClass: 'debts-page__summary',
        cards: [
            {
                id: 'debts-summary-total',
                tone: 'balance',
                icon: 'fa-landmark',
                title: 'Total hoje',
                description: DEBTS_SUMMARY_COPY.totalToday
            },
            {
                id: 'debts-summary-month',
                tone: 'expense',
                icon: 'fa-chart-line',
                title: 'Total neste mês',
                description: DEBTS_SUMMARY_COPY.monthTotal,
                variationId: 'debts-summary-month-variation'
            },
            {
                id: 'debts-summary-banks',
                tone: 'projection',
                icon: 'fa-building-columns',
                title: 'Bancos com dívida',
                description: DEBTS_SUMMARY_COPY.bankCount,
                hint: 'com saldo registrado'
            }
        ]
    }
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`  
Expected: exit 0 (sem erro de sintaxe).

---

### Task 2: Aggregations module

**Files:**
- Create: `js/features/debts/debts-aggregations.js`

- [ ] **Step 1: Criar `debts-aggregations.js`**

```javascript
import { movementDateToJsDate } from '../../core/utils.js';

export function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function enumerateMonths(minDate, maxDate) {
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const out = [];
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
        out.push(new Date(y, m, 1));
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return out;
}

function activeDebts(debts) {
    return (debts || []).filter((d) => d.isClosed !== true);
}

/** Último update por debtId (qualquer mês). */
export function latestUpdateByDebtId(updates) {
    const byDebt = new Map();
    (updates || []).forEach((u) => {
        const prev = byDebt.get(u.debtId);
        const t = movementDateToJsDate(u.date).getTime();
        if (!prev || t > movementDateToJsDate(prev.date).getTime()) {
            byDebt.set(u.debtId, u);
        }
    });
    return byDebt;
}

/** Último valor registrado no mês M por debtId. */
export function lastAmountInMonthByDebt(updates, monthKeys) {
    const byDebtMonth = new Map();
    (updates || []).forEach((u) => {
        const d = movementDateToJsDate(u.date);
        const mk = monthKey(d);
        if (!monthKeys.includes(mk)) return;
        const key = `${u.debtId}:${mk}`;
        const prev = byDebtMonth.get(key);
        const t = d.getTime();
        if (!prev || t >= movementDateToJsDate(prev.date).getTime()) {
            byDebtMonth.set(key, u);
        }
    });
    return byDebtMonth;
}

export function computeDebtsSummary(debts, updates) {
    const active = activeDebts(debts);
    const activeIds = new Set(active.map((d) => d.id));
    const latest = latestUpdateByDebtId(
        (updates || []).filter((u) => activeIds.has(u.debtId))
    );

    let totalToday = 0;
    latest.forEach((u) => {
        totalToday += Number(u.amount) || 0;
    });

    const now = new Date();
    const currentMk = monthKey(now);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMk = monthKey(prevDate);

    const monthKeys = [prevMk, currentMk];
    const inMonth = lastAmountInMonthByDebt(updates, monthKeys);

    let totalCurrentMonth = 0;
    let totalPrevMonth = 0;
    active.forEach((d) => {
        const cur = inMonth.get(`${d.id}:${currentMk}`);
        const prev = inMonth.get(`${d.id}:${prevMk}`);
        if (cur) totalCurrentMonth += Number(cur.amount) || 0;
        if (prev) totalPrevMonth += Number(prev.amount) || 0;
    });

    const bankCount = active.filter((d) =>
        (updates || []).some((u) => u.debtId === d.id)
    ).length;

    return {
        totalToday,
        totalCurrentMonth,
        totalPrevMonth,
        bankCount
    };
}

/** Totais por mês (soma último valor/banco no mês) para gráfico de variação. */
export function buildMonthlyTotalSeries(debts, updates) {
    const uList = (updates || []).slice();
    if (uList.length === 0) return { labels: [], totals: [], deltas: [] };

    const dates = uList
        .map((u) => movementDateToJsDate(u.date))
        .filter((d) => !Number.isNaN(d.getTime()));
    const minD = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxD = new Date(Math.max(...dates.map((d) => d.getTime())));
    const months = enumerateMonths(minD, maxD);
    const labels = months.map((m) =>
        m.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    );
    const monthKeys = months.map((m) => monthKey(m));

    const active = activeDebts(debts);
    const debtIds = new Set(active.map((d) => d.id));

    const byDebt = new Map();
    uList.filter((u) => debtIds.has(u.debtId)).forEach((u) => {
        if (!byDebt.has(u.debtId)) byDebt.set(u.debtId, []);
        byDebt.get(u.debtId).push(u);
    });

    const totals = monthKeys.map((mk) => {
        let sum = 0;
        byDebt.forEach((arr) => {
            const inMonth = arr
                .filter((u) => monthKey(movementDateToJsDate(u.date)) === mk)
                .sort((a, b) => movementDateToJsDate(a.date) - movementDateToJsDate(b.date));
            if (inMonth.length) sum += Number(inMonth[inMonth.length - 1].amount) || 0;
        });
        return sum;
    });

    const deltas = totals.map((t, i) => (i === 0 ? 0 : t - totals[i - 1]));
    return { labels, totals, deltas, monthKeys };
}
```

- [ ] **Step 2: Build**

Run: `npm run build`  
Expected: exit 0.

---

### Task 3: Charts module

**Files:**
- Create: `js/features/debts/debts-charts.js`
- Modify: `js/features/debts/debts.js` (remover `buildDebtsChart` e `debtsChart` na Task 6)

- [ ] **Step 1: Criar `debts-charts.js`**

Mover lógica de `buildDebtsChart` de `debts.js` (linhas 198–271) para `renderDebtsBalanceChart(debts, updates, currency)`.

Adicionar `renderDebtsDeltaChart(debts, updates, currency)` usando `buildMonthlyTotalSeries`:

```javascript
import { formatCurrency, movementDateToJsDate, getChartAxisColors, isDarkTheme } from '../../core/utils.js';
import { monthKey, enumerateMonths, buildMonthlyTotalSeries } from './debts-aggregations.js';

let balanceChart = null;
let deltaChart = null;

const BALANCE_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#eab308'];

export function destroyDebtsCharts() {
    if (balanceChart) {
        balanceChart.destroy();
        balanceChart = null;
    }
    if (deltaChart) {
        deltaChart.destroy();
        deltaChart = null;
    }
}

export function renderDebtsBalanceChart(debts, updates, currency) {
    const canvas = document.getElementById('debts-balance-chart');
    if (!canvas) return;
    // ... corpo igual ao buildDebtsChart atual, usando id debts-balance-chart
    // destroy balanceChart antes de recriar
}

export function renderDebtsDeltaChart(debts, updates, currency) {
    const canvas = document.getElementById('debts-delta-chart');
    if (!canvas) return;
    const { labels, deltas } = buildMonthlyTotalSeries(debts, updates);
    if (!labels.length) {
        if (deltaChart) {
            deltaChart.destroy();
            deltaChart = null;
        }
        return;
    }
    const colors = deltas.map((d) =>
        d > 0 ? 'rgba(239, 68, 68, 0.85)' : d < 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(148, 163, 184, 0.5)'
    );
    if (deltaChart) deltaChart.destroy();
    const axis = getChartAxisColors?.() || {};
    deltaChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Variação do total',
                    data: deltas,
                    backgroundColor: colors,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.parsed.y;
                            const word = v > 0 ? 'aumento' : v < 0 ? 'redução' : 'sem mudança';
                            return `${word}: ${formatCurrency(Math.abs(v), currency)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => formatCurrency(v, currency),
                        color: axis.tick
                    },
                    grid: { color: axis.grid }
                },
                x: {
                    ticks: { color: axis.tick },
                    grid: { display: false }
                }
            }
        }
    });
}

export function renderDebtsCharts(debts, updates, currency) {
    renderDebtsBalanceChart(debts, updates, currency);
    renderDebtsDeltaChart(debts, updates, currency);
}
```

Implementar `renderDebtsBalanceChart` copiando o corpo exato de `buildDebtsChart`, trocando `debts-chart` → `debts-balance-chart` e `debtsChart` → `balanceChart`.

- [ ] **Step 2: Build**

Run: `npm run build`  
Expected: exit 0.

---

### Task 4: HTML layout

**Files:**
- Modify: `index.html` (seção `#debts-page`, ~linhas 836–870)

- [ ] **Step 1: Substituir markup de `#debts-page`**

```html
<section id="debts-page" class="page hidden debts-page" aria-label="Dívidas">
    <div class="actions-bar debts-page__actions">
        <h2>Dívidas</h2>
        <button id="add-debt-update-btn" class="btn-primary" type="button">
            <i class="fas fa-plus"></i> Nova dívida
        </button>
    </div>

    <div id="debts-summary" class="summary-cards movements-summary debts-page__summary" data-summary-group="debts" hidden></div>

    <section class="dashboard-reports-section debts-page__charts-section" aria-label="Gráficos de dívidas">
        <div class="debts-page__charts dashboard-reports-charts-grid">
            <div class="reports-chart-container dashboard-flux-chart-card debts-page__chart-card">
                <div class="reports-chart-header">
                    <h3>Evolução por banco</h3>
                    <p class="reports-chart-hint">Último valor registrado em cada mês, por instituição.</p>
                </div>
                <div class="chart-wrapper chart-wrapper--tall">
                    <canvas id="debts-balance-chart"></canvas>
                </div>
            </div>
            <div class="reports-chart-container dashboard-flux-chart-card debts-page__chart-card">
                <div class="reports-chart-header">
                    <h3>Variação mensal do total</h3>
                    <p class="reports-chart-hint">Quanto o total consolidado subiu ou caiu em relação ao mês anterior.</p>
                </div>
                <div class="chart-wrapper chart-wrapper--tall">
                    <canvas id="debts-delta-chart"></canvas>
                </div>
            </div>
        </div>
    </section>

    <section class="debts-page__apps-section" aria-label="Histórico de atualizações">
        <div class="table-container">
            <table id="debt-updates-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Empresa</th>
                        <th>Valor</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="debt-updates-tbody"></tbody>
            </table>
        </div>
    </section>
</section>
```

- [ ] **Step 2: Smoke test manual**

Run: `npm run dev` → abrir Dívidas no browser.  
Expected: layout em 2 colunas (desktop), canvas vazios até Task 5.

---

### Task 5: CSS (`debts.css`)

**Files:**
- Modify: `css/pages/debts.css`

- [ ] **Step 1: Adicionar bloco de página (espelho de `cofrinhos-page`)**

No topo do arquivo (após comentário inicial), adicionar:

```css
.debts-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 2rem;
}

.debts-page__summary[hidden] {
    display: none !important;
}

.debts-page__summary.movements-summary .card-icon {
    background: color-mix(in srgb, var(--danger-color, #ef4444) 14%, var(--bg-color));
    color: var(--danger-color, #ef4444);
}

[data-theme='dark'] .debts-page__summary.movements-summary .card-icon {
    background: color-mix(in srgb, var(--danger-color, #ef4444) 18%, var(--bg-light));
}

.debts-page__charts-section {
    margin-bottom: 0;
}

.debts-page__charts-section .reports-chart-container,
.debts-page__chart-card {
    margin-bottom: 0;
    padding: 1.35rem 1.5rem 1.5rem;
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    box-shadow: var(--shadow);
    background: color-mix(in srgb, var(--bg-light) 96%, var(--bg-color) 4%);
}

[data-theme='dark'] .debts-page__charts-section .reports-chart-container,
[data-theme='dark'] .debts-page__chart-card {
    background: var(--bg-light);
    border-color: var(--border-color);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.debts-page__charts .chart-wrapper--tall {
    height: min(420px, 48vh);
    min-height: 320px;
}

.debts-page__apps-section .table-container {
    margin-top: 0;
}

.debts-table-empty {
    text-align: center;
    opacity: 0.8;
}
```

- [ ] **Step 2: Visual check**

Alternar tema claro/escuro na página Dívidas.  
Expected: cards e chart cards com borda/sombra legíveis.

---

### Task 6: Page orchestrator (`debts-page.js`)

**Files:**
- Create: `js/features/debts/debts-page.js`
- Modify: `js/features/debts/debts.js` (remover chart + table + refreshDebtsUI; exportar caches ou callbacks)

- [ ] **Step 1: Criar `debts-page.js`**

```javascript
import { formatCurrency } from '../../core/utils.js';
import { setMovementSummaryMomVariation } from '../../core/movement-summary-variation.js';
import { MOVEMENT_SUMMARY_CARD_GROUPS } from '../../core/movement-summary-copy.js';
import { renderMovementSummaryCard } from '../../components/movement-summary-cards.js';
import { movementDateToJsDate } from '../../core/utils.js';
import { computeDebtsSummary } from './debts-aggregations.js';
import { renderDebtsCharts, destroyDebtsCharts } from './debts-charts.js';
import { initDebtsForm, setDebtsCaches } from './debts.js';

let currencyCache = 'BRL';

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

function renderDebtUpdatesTable(debts, updates, currency) {
    const tbody = document.getElementById('debt-updates-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const debtById = new Map((debts || []).map((d) => [d.id, d]));
    const rows = (updates || [])
        .slice()
        .sort((a, b) => movementDateToJsDate(b.date) - movementDateToJsDate(a.date));

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="debts-table-empty">Nenhuma atualização cadastrada.</td></tr>`;
        return;
    }

    rows.forEach((u) => {
        const d = movementDateToJsDate(u.date);
        const debt = debtById.get(u.debtId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.toLocaleDateString('pt-BR')}</td>
            <td>${debt?.company || '—'}</td>
            <td>${formatCurrency(Number(u.amount) || 0, currency)}</td>
            <td>
                <div class="debt-actions">
                    <button type="button" class="btn-icon debt-delete-update" title="Excluir" data-id="${u.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function refreshDebtsPage(debts, updates, currency) {
    currencyCache = currency || 'BRL';
    renderSummaryCards(debts, updates, currencyCache);
    renderDebtsCharts(debts, updates, currencyCache);
    renderDebtUpdatesTable(debts, updates, currencyCache);
}

export function initDebtsPage(currentUser, onDataRefresh) {
    if (!document.getElementById('debts-page')) return;
    ensureDebtsSummaryCardsMounted();
    initDebtsForm(currentUser, onDataRefresh, refreshDebtsPage);
}

export function loadDebtsData(userDebts, userDebtUpdates, currency = 'BRL') {
    setDebtsCaches(userDebts, userDebtUpdates, currency);
    refreshDebtsPage(userDebts, userDebtUpdates, currency);
}

export function teardownDebtsPage() {
    destroyDebtsCharts();
}
```

- [ ] **Step 2: Refatorar `debts.js`**

Renomear `initDebts` → export `initDebtsForm(currentUser, onDataRefresh, onLocalRefresh)`.

Remover: `buildDebtsChart`, `debtsChart`, `renderDebtUpdatesTable`, `refreshDebtsUI`, `loadDebtsData` (movidos).

Adicionar:

```javascript
export function setDebtsCaches(debts, updates, currency) {
    debtsCache = debts || [];
    debtUpdatesCache = updates || [];
    currencyCache = currency || 'BRL';
}
```

No final de `save`/`delete` handlers, chamar `onLocalRefresh(debtsCache, debtUpdatesCache, currencyCache)` além de `onDataRefresh?.()`.

Manter `export { initDebtsForm as initDebts }` temporariamente OU atualizar `main.js` na Task 7.

- [ ] **Step 3: Build + manual**

Cadastrar Santander R$ 1000 mês atual + mês anterior R$ 1200 → card variação deve mostrar queda; gráfico barras negativo no mês atual.

---

### Task 7: Wire `main.js`

**Files:**
- Modify: `js/app/main.js`

- [ ] **Step 1: Trocar imports**

```javascript
import { initDebtsPage, loadDebtsData } from '../features/debts/debts-page.js';
```

Substituir `initDebts(...)` por `initDebtsPage(...)` na inicialização (~linha 94).

`loadDebtsData` no `case 'debts':` permanece igual.

- [ ] **Step 2: Regressão rápida**

- Nova dívida (modal multi-mês) salva e atualiza cards/gráficos/tabela.
- Excluir linha na tabela atualiza UI.
- Navegar para outra página e voltar: sem erro no console.

---

### Task 8: Acceptance checklist (spec)

- [ ] **1.** Três cards: total hoje, total no mês + % MoM, contagem de bancos.
- [ ] **2.** Gráfico linhas: uma série por banco (comportamento preservado).
- [ ] **3.** Gráfico barras: variação do total mês a mês.
- [ ] **4.** Visual alinhado a Cofrinhos (resumo → 2 gráficos → tabela).
- [ ] **5.** Modal inalterado (data início + vários meses).
- [ ] **6.** Tema escuro legível (`theme-dark.css`).

Run: `npm run build` — exit 0.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| 3 summary cards | 1, 6 |
| Cofrinhos layout | 4, 5 |
| Line chart per bank | 3, 6 |
| Bar chart total delta | 3, 6 |
| Modal unchanged | 6 (debts.js) |
| Modular JS | 2, 3, 6 |
| No data model change | — (nenhuma migration) |
| Table + empty state class | 6 |

No placeholders remain in task steps above.
