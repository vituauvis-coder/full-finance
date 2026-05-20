# Dashboard — Heatmap de Caixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir «Faturas Próximas» na dashboard por um calendário heatmap (entradas/saídas por dia) com painel lateral de detalhes do dia selecionado, sincronizado ao `#period-filter`.

**Architecture:** Três módulos em `js/features/dashboard/` (agregações, calendário, painel do dia) + orquestrador `cash-heatmap.js`; `dashboard.js` remove `renderUpcomingInvoices` e chama refresh do heatmap; `transactions.js` exporta helper para abrir modal de saída com data pré-preenchida.

**Tech stack:** Vanilla JS (ES modules), Vite build, CSS existente (`dashboard.css`, `theme-dark.css`, `responsive.css`), helpers em `period-filters.js` e `utils.js`.

**Spec:** `docs/superpowers/specs/2026-05-20-cash-heatmap-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `index.html` | Markup `#dashboard-cash-heatmap` (calendário + painel); remove `#upcoming-invoices-list` |
| `css/dashboard.css` | Grid 2/3 + 1/3, células, legenda, tooltip, painel do dia |
| `css/theme-dark.css` | Tokens/cores do heatmap no tema escuro |
| `css/responsive.css` | Empilhar calendário + painel em mobile |
| `js/features/dashboard/cash-heatmap-aggregations.js` | `resolveHeatmapMonth`, `buildMonthDayMap`, itens do dia |
| `js/features/dashboard/cash-heatmap-calendar.js` | Render grid 7×N, legenda, seleção, tooltip |
| `js/features/dashboard/cash-heatmap-day-panel.js` | Lista do dia, vazio, botão nova saída |
| `js/features/dashboard/cash-heatmap.js` | Estado, listeners `#period-filter`, refresh |
| `js/features/dashboard/dashboard.js` | Integração em `loadDashboardData`; remove faturas |
| `js/features/finance/transactions.js` | Export `openNewExpenseWithPrefillDate` |

**Note:** O projeto não tem testes automatizados (`npm test` é stub). Verificação: `npm run build` + checklist manual da spec.

---

### Task 1: Markup da dashboard (`index.html`)

**Files:**
- Modify: `index.html` (seção `dashboard-grid`, ~563–576)

- [ ] **Step 1: Substituir bloco Faturas Próximas**

Trocar o segundo `list-container` por:

```html
                    <div id="dashboard-cash-heatmap" class="dashboard-cash-heatmap list-container" aria-label="Heatmap de caixa">
                        <div class="dashboard-cash-heatmap__layout">
                            <div id="cash-heatmap-calendar-root" class="cash-heatmap-calendar" aria-live="polite"></div>
                            <div id="cash-heatmap-day-panel-root" class="cash-heatmap-day-panel" aria-live="polite"></div>
                        </div>
                    </div>
```

Manter o primeiro `list-container` («Última atividade») inalterado.

- [ ] **Step 2: Ajustar grid pai (opcional)**

Se o heatmap deve ocupar largura total abaixo da grid de 2 colunas, mover `#dashboard-cash-heatmap` para **fora** de `.dashboard-grid` (irmão após o fechamento da grid). Spec aprovada: substitui coluna 2 — manter **dentro** da grid é válido; em desktop usar CSS para `grid-column: 1 / -1` no heatmap (Task 2).

- [ ] **Step 3: Verificar HTML**

Abrir dashboard no browser: containers existem; sem `#upcoming-invoices-list`.

---

### Task 2: Estilos CSS

**Files:**
- Modify: `css/dashboard.css`
- Modify: `css/theme-dark.css`
- Modify: `css/responsive.css`

- [ ] **Step 1: Layout e células em `dashboard.css`**

Adicionar ao final do arquivo:

```css
/* --- Heatmap de Caixa --- */
.dashboard-cash-heatmap.list-container {
    grid-column: 1 / -1;
}

.dashboard-cash-heatmap__layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
}

@media (min-width: 1024px) {
    .dashboard-cash-heatmap__layout {
        grid-template-columns: 2fr 1fr;
    }
}

.cash-heatmap-calendar__header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.cash-heatmap-calendar__title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
}

.cash-heatmap-calendar__title i {
    margin-right: 0.35rem;
    color: var(--primary-color);
}

.cash-heatmap-calendar__subtitle {
    font-size: 0.75rem;
    color: var(--text-light);
    margin: 0.25rem 0 0;
}

.cash-heatmap-calendar__month-badge {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
}

.cash-heatmap-calendar__weekdays,
.cash-heatmap-calendar__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
}

.cash-heatmap-calendar__weekday {
    text-align: center;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-light);
    padding-bottom: 0.25rem;
}

.cash-heatmap-day-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 4rem;
    padding: 0.5rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-color);
    color: var(--text-light);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.cash-heatmap-day-btn:hover {
    transform: scale(1.03);
    z-index: 2;
}

.cash-heatmap-day-btn[aria-pressed="true"] {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 35%, transparent);
    color: var(--text-color);
}

.cash-heatmap-day-btn--empty { background: var(--bg-color); }
.cash-heatmap-day-btn--out-light {
    background: color-mix(in srgb, var(--danger-color) 12%, var(--bg-color));
    border-color: color-mix(in srgb, var(--danger-color) 25%, transparent);
    color: color-mix(in srgb, var(--danger-color) 80%, var(--text-color));
}
.cash-heatmap-day-btn--out-mid {
    background: color-mix(in srgb, var(--danger-color) 28%, var(--bg-color));
    border-color: color-mix(in srgb, var(--danger-color) 40%, transparent);
}
.cash-heatmap-day-btn--out-heavy {
    background: color-mix(in srgb, var(--danger-color) 45%, var(--bg-color));
    border-color: color-mix(in srgb, var(--danger-color) 55%, transparent);
    color: var(--text-color);
}
.cash-heatmap-day-btn--in {
    background: color-mix(in srgb, var(--gains-accent, #10b981) 22%, var(--bg-color));
    border-color: color-mix(in srgb, var(--gains-accent, #10b981) 40%, transparent);
    color: color-mix(in srgb, var(--gains-accent, #10b981) 85%, var(--text-color));
}

.cash-heatmap-day-btn__dot {
    position: absolute;
    right: 0.35rem;
    bottom: 0.35rem;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--warning-color);
    border: 1px solid color-mix(in srgb, #000 25%, transparent);
}

.cash-heatmap-calendar__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-light);
}

.cash-heatmap-day-panel__label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-light);
    margin: 0 0 0.25rem;
}

.cash-heatmap-day-panel__date {
    font-size: 1.35rem;
    font-weight: 800;
    margin: 0 0 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.cash-heatmap-day-panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    min-height: 12rem;
    max-height: 20rem;
    overflow-y: auto;
}

.cash-heatmap-day-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: 10px;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
}

.cash-heatmap-day-panel__empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-light);
}

.cash-heatmap-day-panel__cta {
    width: 100%;
    margin-top: 1rem;
}
```

- [ ] **Step 2: Tema escuro**

Em `theme-dark.css`, reforçar contraste das classes `--out-heavy` / `--in` se necessário (copiar padrão de `base.html`: fundos mais escuros em `[data-theme="dark"] .cash-heatmap-day-btn--out-heavy` etc.).

- [ ] **Step 3: Mobile em `responsive.css`**

Garantir `.dashboard-cash-heatmap__layout { grid-template-columns: 1fr; }` abaixo do breakpoint já usado (768px).

- [ ] **Step 4: Build**

Run: `npm run build`  
Expected: exit 0.

---

### Task 3: Agregações (`cash-heatmap-aggregations.js`)

**Files:**
- Create: `js/features/dashboard/cash-heatmap-aggregations.js`

- [ ] **Step 1: Criar módulo completo**

```javascript
import { getPeriodDateBounds } from '../../core/period-filters.js';
import {
    getBillingCycle,
    isCreditCardType,
    movementDateToJsDate
} from '../../core/utils.js';

const MONTH_NAMES_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function formatHeatmapMonthLabel(year, monthIndex) {
    return `${MONTH_NAMES_PT[monthIndex]} ${year}`;
}

/** Resolve { year, monthIndex } (0–11) a partir do #period-filter. */
export function resolveHeatmapMonthFromPeriod(period, now = new Date()) {
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        return { year: now.getFullYear(), monthIndex: mi };
    }
    if (period === 'current-year') {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    const { startDate, endDate } = getPeriodDateBounds(period, now);
    const t = now.getTime();
    if (t >= startDate.getTime() && t <= endDate.getTime()) {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    return { year: endDate.getFullYear(), monthIndex: endDate.getMonth() };
}

function sameCalendarDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function assignOutLevel(dayMap) {
    let max = 0;
    for (const agg of dayMap.values()) {
        if (agg.totalSaida > max) max = agg.totalSaida;
    }
    for (const agg of dayMap.values()) {
        if (agg.totalSaida <= 0 || max <= 0) {
            agg.nivelSaida = 0;
            continue;
        }
        const ratio = agg.totalSaida / max;
        agg.nivelSaida = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
    }
}

function invoiceDueDaysInMonth(accounts, year, monthIndex) {
    const days = new Set();
    const last = new Date(year, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
        const probe = new Date(year, monthIndex, d, 12, 0, 0, 0);
        for (const card of accounts || []) {
            if (!isCreditCardType(card.type)) continue;
            const due = getBillingCycle(card, probe).due;
            if (due && sameCalendarDay(due, probe)) days.add(d);
        }
    }
    return days;
}

/**
 * @returns {Map<number, { totalSaida, totalEntrada, temFatura, nivelSaida }>}
 */
export function buildMonthDayMap(expenses, gains, accounts, year, monthIndex) {
    const dayMap = new Map();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        dayMap.set(d, { totalSaida: 0, totalEntrada: 0, temFatura: false, nivelSaida: 0 });
    }

    const invoiceDays = invoiceDueDaysInMonth(accounts, year, monthIndex);
    invoiceDays.forEach((d) => {
        const agg = dayMap.get(d);
        if (agg) agg.temFatura = true;
    });

    for (const t of expenses || []) {
        const d = movementDateToJsDate(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const day = d.getDate();
        const agg = dayMap.get(day);
        if (agg) agg.totalSaida += Number(t.amount) || 0;
    }
    for (const t of gains || []) {
        const d = movementDateToJsDate(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const day = d.getDate();
        const agg = dayMap.get(day);
        if (agg) agg.totalEntrada += Number(t.amount) || 0;
    }

    assignOutLevel(dayMap);
    return dayMap;
}

export function getDefaultSelectedDay(year, monthIndex, now = new Date()) {
    if (now.getFullYear() === year && now.getMonth() === monthIndex) {
        return now.getDate();
    }
    return 1;
}

export function clampSelectedDay(day, year, monthIndex) {
    const last = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(last, Math.max(1, day));
}

function expenseStatusLabel(t) {
    if (t.isPaid === true) return 'Pago';
    if (t.isPaid === false) return 'Pendente';
    return 'Saída';
}

/** Itens do dia para o painel, ordenados por valor desc. */
export function buildDayDetailItems(expenses, gains, accounts, year, monthIndex, day, userCurrency) {
    const target = new Date(year, monthIndex, day);
    const accountById = new Map((accounts || []).map((a) => [String(a.id), a]));
    const items = [];

    for (const t of expenses || []) {
        const d = movementDateToJsDate(t.date);
        if (!sameCalendarDay(d, target)) continue;
        const acc = accountById.get(String(t.accountId));
        items.push({
            id: `exp-${t.id}`,
            kind: 'expense',
            title: t.description || 'Saída',
            amount: Number(t.amount) || 0,
            bank: acc?.name || '—',
            tag: t.category || t.subcategory || '',
            status: expenseStatusLabel(t),
            pending: t.isPaid === false,
            currency: userCurrency
        });
    }
    for (const t of gains || []) {
        const d = movementDateToJsDate(t.date);
        if (!sameCalendarDay(d, target)) continue;
        const acc = accountById.get(String(t.accountId));
        items.push({
            id: `gain-${t.id}`,
            kind: 'gain',
            title: t.description || 'Entrada',
            amount: Number(t.amount) || 0,
            bank: acc?.name || '—',
            tag: t.category || '',
            status: 'Recebido',
            pending: false,
            currency: userCurrency
        });
    }

    items.sort((a, b) => b.amount - a.amount);
    return items;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`  
Expected: exit 0.

---

### Task 4: Calendário (`cash-heatmap-calendar.js`)

**Files:**
- Create: `js/features/dashboard/cash-heatmap-calendar.js`

- [ ] **Step 1: Implementar render**

```javascript
import { formatHeatmapMonthLabel } from './cash-heatmap-aggregations.js';
import { formatCurrency } from '../../core/utils.js';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function cellClass(agg) {
    if (agg.totalSaida > 0) {
        if (agg.nivelSaida >= 3) return 'cash-heatmap-day-btn--out-heavy';
        if (agg.nivelSaida >= 2) return 'cash-heatmap-day-btn--out-mid';
        return 'cash-heatmap-day-btn--out-light';
    }
    if (agg.totalEntrada > 0) return 'cash-heatmap-day-btn--in';
    return 'cash-heatmap-day-btn--empty';
}

export function renderCashHeatmapCalendar(
    root,
    { year, monthIndex, dayMap, selectedDay, userCurrency },
    onSelectDay
) {
    if (!root) return;
    const firstDow = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const label = formatHeatmapMonthLabel(year, monthIndex);

    let cells = '';
    for (let i = 0; i < firstDow; i++) {
        cells += '<div class="cash-heatmap-calendar__pad" aria-hidden="true"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const agg = dayMap.get(day) || { totalSaida: 0, totalEntrada: 0, temFatura: false };
        const pressed = day === selectedDay;
        const tip =
            agg.totalEntrada > 0 || agg.totalSaida > 0
                ? `Entrada ${formatCurrency(agg.totalEntrada, userCurrency)} · Saída ${formatCurrency(agg.totalSaida, userCurrency)}`
                : 'Sem movimentações';
        cells += `<button type="button" class="cash-heatmap-day-btn ${cellClass(agg)}"
            data-day="${day}" aria-pressed="${pressed}" aria-label="Dia ${day}, ${tip}"
            title="${tip}">
            <span class="cash-heatmap-day-btn__num">${day}</span>
            ${agg.temFatura ? '<span class="cash-heatmap-day-btn__dot" title="Vencimento de fatura"></span>' : ''}
        </button>`;
    }

    root.innerHTML = `
        <header class="cash-heatmap-calendar__header">
            <div>
                <h3 class="cash-heatmap-calendar__title"><i class="fas fa-calendar-days" aria-hidden="true"></i> Heatmap de Caixa</h3>
                <p class="cash-heatmap-calendar__subtitle">A intensidade da cor reflete o volume de entradas e saídas.</p>
            </div>
            <div class="cash-heatmap-calendar__month-badge" aria-hidden="true"><i class="fas fa-calendar" aria-hidden="true"></i> ${label}</div>
        </header>
        <div class="cash-heatmap-calendar__weekdays" aria-hidden="true">${WEEKDAYS.map((d) => `<span class="cash-heatmap-calendar__weekday">${d}</span>`).join('')}</div>
        <div class="cash-heatmap-calendar__grid" role="grid" aria-label="Calendário ${label}">${cells}</div>
        <footer class="cash-heatmap-calendar__legend" aria-hidden="true">
            <span>Nível de gastos:</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--empty"></span> Vazio</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-light"></span> Leve</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-mid"></span> Médio</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-heavy"></span> Pesado</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--in"></span> Entradas</span>
            <span><span class="cash-heatmap-day-btn__dot"></span> Pendência</span>
        </footer>`;

    root.querySelectorAll('.cash-heatmap-day-btn[data-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const d = parseInt(btn.dataset.day, 10);
            if (Number.isFinite(d)) onSelectDay(d);
        });
    });
}
```

Adicionar em `dashboard.css` para legenda:

```css
.cash-heatmap-legend-swatch {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border-radius: 4px;
    vertical-align: middle;
    margin-right: 0.25rem;
}
```

- [ ] **Step 2: Build** — `npm run build` → exit 0.

---

### Task 5: Painel do dia (`cash-heatmap-day-panel.js`)

**Files:**
- Create: `js/features/dashboard/cash-heatmap-day-panel.js`

- [ ] **Step 1: Implementar render**

```javascript
import { formatHeatmapMonthLabel } from './cash-heatmap-aggregations.js';
import { formatCurrency } from '../../core/utils.js';

export function renderCashHeatmapDayPanel(
    root,
    { year, monthIndex, selectedDay, items },
    onNewExpense
) {
    if (!root) return;
    const monthLabel = formatHeatmapMonthLabel(year, monthIndex);
    const dateTitle = `${selectedDay} de ${monthLabel.split(' ')[0]} <span class="cash-heatmap-day-panel__year">${year}</span>`;

    const listHtml =
        items.length === 0
            ? `<div class="cash-heatmap-day-panel__empty"><i class="fas fa-circle-info" aria-hidden="true"></i><p>O mapa está limpo.<br>Sem movimentações neste dia.</p></div>`
            : `<ul class="cash-heatmap-day-panel__list">${items
                  .map((it) => {
                      const icon =
                          it.kind === 'gain'
                              ? 'fa-arrow-up'
                              : it.pending
                                ? 'fa-calendar'
                                : 'fa-arrow-down';
                      const tone =
                          it.kind === 'gain' ? 'gain' : it.pending ? 'pending' : 'expense';
                      const sign = it.kind === 'gain' ? '+' : '−';
                      return `<li class="cash-heatmap-day-item">
                        <div class="cash-heatmap-day-item__left">
                          <span class="cash-heatmap-day-item__icon cash-heatmap-day-item__icon--${tone}" aria-hidden="true"><i class="fas ${icon}"></i></span>
                          <div>
                            <p class="cash-heatmap-day-item__title"></p>
                            <p class="cash-heatmap-day-item__meta"><span class="cash-heatmap-day-item__bank"></span></p>
                          </div>
                        </div>
                        <div class="cash-heatmap-day-item__right">
                          <p class="cash-heatmap-day-item__amount"></p>
                          <span class="cash-heatmap-day-item__status"></span>
                        </div>
                      </li>`;
                  })
                  .join('')}</ul>`;

    root.innerHTML = `
        <p class="cash-heatmap-day-panel__label">Detalhes do dia</p>
        <h3 class="cash-heatmap-day-panel__date">${dateTitle}</h3>
        ${listHtml}
        <button type="button" class="btn-primary cash-heatmap-day-panel__cta" id="cash-heatmap-new-expense-btn">
            <i class="fas fa-plus" aria-hidden="true"></i> Nova Movimentação
        </button>`;

    const lis = root.querySelectorAll('.cash-heatmap-day-item');
    items.forEach((it, i) => {
        const li = lis[i];
        if (!li) return;
        li.querySelector('.cash-heatmap-day-item__title').textContent = it.title;
        li.querySelector('.cash-heatmap-day-item__bank').textContent = [it.bank, it.tag].filter(Boolean).join(' · ');
        li.querySelector('.cash-heatmap-day-item__amount').textContent = `${it.kind === 'gain' ? '+' : '−'} ${formatCurrency(it.amount, it.currency)}`;
        li.querySelector('.cash-heatmap-day-item__status').textContent = it.status;
    });

    root.querySelector('#cash-heatmap-new-expense-btn')?.addEventListener('click', onNewExpense);
}
```

Estilos auxiliares em `dashboard.css` para `__icon--gain|expense|pending` usando `--gains-accent`, `--danger-color`, `--warning-color`.

- [ ] **Step 2: Build** — exit 0.

---

### Task 6: Export modal de saída (`transactions.js`)

**Files:**
- Modify: `js/features/finance/transactions.js` (após `openExpenseModal`, ~4870)

- [ ] **Step 1: Exportar helper**

```javascript
/** Abre «Nova saída» com data pré-preenchida (ISO date string YYYY-MM-DD ou Firestore date). */
export function openNewExpenseWithPrefillDate(date) {
    openExpenseModal(false, { sourceExpense: { date } });
}
```

Garantir que `openExpenseModal` já trata `options.sourceExpense.date` em `finishOpen` (linhas 4857–4864) — sem alteração extra.

- [ ] **Step 2: Build** — exit 0.

---

### Task 7: Orquestrador (`cash-heatmap.js`)

**Files:**
- Create: `js/features/dashboard/cash-heatmap.js`

- [ ] **Step 1: Estado + refresh + listeners**

```javascript
import {
    buildDayDetailItems,
    buildMonthDayMap,
    clampSelectedDay,
    getDefaultSelectedDay,
    resolveHeatmapMonthFromPeriod
} from './cash-heatmap-aggregations.js';
import { renderCashHeatmapCalendar } from './cash-heatmap-calendar.js';
import { renderCashHeatmapDayPanel } from './cash-heatmap-day-panel.js';
import { openNewExpenseWithPrefillDate } from '../finance/transactions.js';

let state = {
    expenses: [],
    gains: [],
    accounts: [],
    currency: 'BRL',
    selectedDay: 1,
    year: new Date().getFullYear(),
    monthIndex: new Date().getMonth()
};

let periodListenerBound = false;

function periodValue() {
    return document.getElementById('period-filter')?.value || '';
}

function refresh() {
    const calRoot = document.getElementById('cash-heatmap-calendar-root');
    const panelRoot = document.getElementById('cash-heatmap-day-panel-root');
    if (!calRoot || !panelRoot) return;

    const { year, monthIndex } = resolveHeatmapMonthFromPeriod(periodValue());
    state.year = year;
    state.monthIndex = monthIndex;
    state.selectedDay = clampSelectedDay(state.selectedDay, year, monthIndex);

    const dayMap = buildMonthDayMap(state.expenses, state.gains, state.accounts, year, monthIndex);

    renderCashHeatmapCalendar(
        calRoot,
        { year, monthIndex, dayMap, selectedDay: state.selectedDay, userCurrency: state.currency },
        (day) => {
            state.selectedDay = day;
            refresh();
        }
    );

    const items = buildDayDetailItems(
        state.expenses,
        state.gains,
        state.accounts,
        year,
        monthIndex,
        state.selectedDay,
        state.currency
    );

    const prefillDate = new Date(year, monthIndex, state.selectedDay);
    renderCashHeatmapDayPanel(
        panelRoot,
        { year, monthIndex, selectedDay: state.selectedDay, items },
        () => openNewExpenseWithPrefillDate(prefillDate)
    );
}

export function refreshCashHeatmap(expenses, gains, accounts, currency) {
    state.expenses = expenses || [];
    state.gains = gains || [];
    state.accounts = accounts || [];
    state.currency = currency || 'BRL';

    const { year, monthIndex } = resolveHeatmapMonthFromPeriod(periodValue());
    const prevDay = state.selectedDay;
    state.year = year;
    state.monthIndex = monthIndex;
    state.selectedDay = clampSelectedDay(
        prevDay || getDefaultSelectedDay(year, monthIndex),
        year,
        monthIndex
    );

    if (!periodListenerBound) {
        const sel = document.getElementById('period-filter');
        sel?.addEventListener('change', () => {
            const { year: y, monthIndex: m } = resolveHeatmapMonthFromPeriod(periodValue());
            state.selectedDay = clampSelectedDay(
                getDefaultSelectedDay(y, m),
                y,
                m
            );
            refresh();
        });
        periodListenerBound = true;
    }

    refresh();
}
```

- [ ] **Step 2: Build** — exit 0.

---

### Task 8: Integrar dashboard (`dashboard.js`)

**Files:**
- Modify: `js/features/dashboard/dashboard.js`

- [ ] **Step 1: Import e chamada**

No topo:

```javascript
import { refreshCashHeatmap } from './cash-heatmap.js';
```

No final de `loadDashboardData`, após atividade recente:

```javascript
    refreshCashHeatmap(userExpenses, userGains, userAccounts, userCurrency);
```

- [ ] **Step 2: Remover faturas**

- Deletar função `renderUpcomingInvoices` inteira (~129–186).
- Remover chamada `renderUpcomingInvoices(userAccounts, userExpenses, userCurrency);`
- Remover imports não usados: `creditCardInvoiceTotalForCycle`, `getBillingCycle`, `isCreditCardType` (se só usados por faturas).

- [ ] **Step 3: Build** — exit 0.

---

### Task 9: Verificação manual

- [ ] **Checklist spec**

1. Dashboard: heatmap visível; «Faturas Próximas» ausente.
2. `#period-filter` = mês com saídas → tercis vermelhos; dia só entrada → verde.
3. Trocar mês no filtro → badge e células atualizam.
4. Dia com vencimento de cartão → ponto laranja (pode não ter itens na lista).
5. Clicar dia → lista por valor; botão abre modal com `expense-date` = dia.
6. Mês vazio → células cinzas; painel vazio.
7. Sininho ainda lista faturas (`header-notifications.js`).

- [ ] **Build final**

Run: `npm run build`  
Expected: exit 0.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Remove Faturas Próximas | Task 1, 8 |
| Calendário + legenda + tooltip | Task 2, 4 |
| Período `#period-filter` | Task 3 `resolveHeatmapMonthFromPeriod`, Task 7 listener |
| Agregação por `date` | Task 3 |
| Tercis relativos | Task 3 `assignOutLevel` |
| Verde entrada / vermelho saída | Task 4 `cellClass` |
| Ponto laranja fatura | Task 3 `invoiceDueDaysInMonth` |
| Painel lista + vazio + botão | Task 5, 6, 7 |
| Acessibilidade básica | Task 4 `aria-pressed`, `aria-label` |
| CSS tema escuro | Task 2 |

**Ambiguity resolved:** Períodos multi-mês (`last-3-months`, etc.) → mês calendário atual se dentro do intervalo; senão último mês do intervalo (`resolveHeatmapMonthFromPeriod`).

**Placeholder scan:** Nenhum TBD.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-cash-heatmap.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
