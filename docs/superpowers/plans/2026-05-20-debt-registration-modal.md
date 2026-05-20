# Modal «Nova dívida» — cadastro multi-mês Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a lista vertical de meses no modal «Nova dívida» por tabela compacta agrupada por ano (accordion), com atalhos de preenchimento, preservação de valores ao mudar a data de início e upsert ao salvar meses já existentes.

**Architecture:** Extrair lógica pura de intervalo/agrupamento para `debt-form-months.js`; `debts.js` mantém estado do formulário (`Map<monthKey, string>` + `Map<monthKey, updateId>`), render do accordion e persistência. HTML/CSS no padrão dos modais existentes (`#debt-update-modal`, `debts.css`).

**Tech stack:** Vanilla JS (ES modules), Express API (`saveDebt`, `saveDebtUpdate` via `js/services/firestore.js`), CSS existente.

**Spec:** `docs/superpowers/specs/2026-05-20-debt-registration-modal-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `js/features/debts/debt-form-months.js` | **Novo** — intervalo de meses, agrupar por ano, labels, helpers de valor anterior |
| `js/features/debts/debts.js` | Estado do form, render accordion, teclado/atalhos, save com upsert, `openRegisterForDebt` |
| `index.html` | Markup accordion + contador no rodapé; hint atualizado |
| `css/pages/debts.css` | Accordion, tabela compacta, foco, tema escuro |

**Note:** O projeto não tem testes automatizados (`npm test` é stub). Cada task termina com verificação manual + `npm run build`.

---

### Task 1: Módulo `debt-form-months.js`

**Files:**
- Create: `js/features/debts/debt-form-months.js`
- Modify: `js/features/debts/debts.js` (remover funções movidas; importar do novo módulo)

- [ ] **Step 1: Criar `debt-form-months.js` com funções puras**

```javascript
import { monthKey, enumerateMonths } from './debts-aggregations.js';

export const DEBT_FORM_MONTH_CAP = 120;

export function formatDebtMonthShortLabel(d) {
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return `${month}/${yy}`;
}

export function buildMonthsForDebtForm(startDateStr) {
    if (!startDateStr || String(startDateStr).trim() === '') {
        return { months: [], truncated: false, note: '' };
    }
    const parts = String(startDateStr).split('-').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return { months: [], truncated: false, note: '' };
    }
    const start = new Date(parts[0], parts[1] - 1, 1);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let from = start;
    let to =
        start.getTime() > currentMonthStart.getTime()
            ? new Date(start.getFullYear(), start.getMonth() + 11, 1)
            : currentMonthStart;
    let months = enumerateMonths(from, to);
    let note = '';
    if (months.length > DEBT_FORM_MONTH_CAP) {
        note = `São ${months.length} meses neste intervalo. Mostrando os últimos ${DEBT_FORM_MONTH_CAP} meses (até o mês atual). Para meses mais antigos, ajuste a data de início.`;
        months = months.slice(-DEBT_FORM_MONTH_CAP);
    }
    return { months, note };
}

/** @returns {{ year: number, months: Date[] }[]} ordem cronológica */
export function groupMonthsByYear(months) {
    const byYear = new Map();
    (months || []).forEach((d) => {
        const y = d.getFullYear();
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(d);
    });
    return [...byYear.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, list]) => ({ year, months: list }));
}

/** Último update por monthKey para um debtId (desempate por data mais recente). */
export function indexUpdatesByMonthKey(updates, debtId) {
    const map = new Map();
    (updates || [])
        .filter((u) => u.debtId === debtId)
        .forEach((u) => {
            const mk = monthKey(new Date(u.date));
            const prev = map.get(mk);
            if (!prev || new Date(u.date) >= new Date(prev.date)) map.set(mk, u);
        });
    return map;
}

/** Valor do mês anterior preenchido no mapa, percorrendo monthKeys em ordem. */
export function previousFilledAmount(monthKeys, valuesMap, currentKey) {
    const idx = monthKeys.indexOf(currentKey);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
        const v = valuesMap.get(monthKeys[i]);
        if (v != null && String(v).trim() !== '') return v;
    }
    return null;
}

export function countFilledMonths(valuesMap) {
    let n = 0;
    valuesMap.forEach((v) => {
        if (v != null && String(v).trim() !== '') n++;
    });
    return n;
}
```

- [ ] **Step 2: Atualizar imports em `debts.js`**

Remover de `debts.js`: `DEBT_FORM_MONTH_CAP`, `formatDebtMonthLabel`, `buildMonthsForDebtForm`, `enumerateMonths` import se só usado no form.

Adicionar:

```javascript
import {
    buildMonthsForDebtForm,
    formatDebtMonthShortLabel,
    groupMonthsByYear,
    indexUpdatesByMonthKey,
    previousFilledAmount,
    countFilledMonths
} from './debt-form-months.js';
import { monthKey } from './debts-aggregations.js';
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`  
Expected: exit 0

---

### Task 2: Markup do modal (`index.html`)

**Files:**
- Modify: `index.html` (bloco `#debt-update-modal`, ~linhas 1791–1816)

- [ ] **Step 1: Ajustar campo de início e seção de meses**

Substituir o bloco da data e da seção mensal por:

```html
<div class="form-group">
    <label for="debt-start-date">Mês de início da dívida</label>
    <input id="debt-start-date" name="debt-start-date" type="month" required>
    <small>Escolha o primeiro mês; abaixo aparecem os meses até o mês atual para informar o saldo.</small>
</div>
<div id="debt-monthly-section" class="debt-monthly-section hidden">
    <p id="debt-monthly-note" class="debt-monthly-note hidden" role="status"></p>
    <p class="debt-monthly-hint">Deixe em branco os meses sem dado. Use <strong>= anterior</strong> para copiar o último valor e <strong>Limpar</strong> para zerar a célula.</p>
    <div id="debt-monthly-years" class="debt-monthly-years" role="region" aria-label="Valores por mês"></div>
</div>
```

Remover `<div id="debt-monthly-rows" …>`.

Antes de `.debt-update-form__actions`, adicionar:

```html
<p id="debt-month-filled-count" class="debt-month-filled-count" aria-live="polite"></p>
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`  
Expected: exit 0

---

### Task 3: CSS accordion + tabela

**Files:**
- Modify: `css/pages/debts.css` (substituir/estender bloco `.debt-monthly-*`, ~341–406)

- [ ] **Step 1: Adicionar estilos**

```css
.debt-monthly-years {
    max-height: min(50vh, 22rem);
    overflow-y: auto;
    padding-right: 0.25rem;
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.debt-year-block {
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-color);
}

.debt-year-block__toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    border: 0;
    background: color-mix(in srgb, var(--bg-light) 88%, var(--bg-color));
    color: var(--text-color);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
}

.debt-year-block__toggle:hover {
    background: var(--bg-light);
}

.debt-year-block__meta {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--text-light);
}

.debt-year-block__panel {
    padding: 0.5rem 0.65rem 0.65rem;
}

.debt-year-block__panel[hidden] {
    display: none;
}

.debt-month-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
}

.debt-month-table th {
    text-align: left;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-light);
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--border-color);
}

.debt-month-table th.debt-month-table__col-value,
.debt-month-table td.debt-month-table__col-value {
    text-align: right;
}

.debt-month-table th.debt-month-table__col-actions {
    width: 5.5rem;
    text-align: center;
}

.debt-month-table td {
    padding: 0.3rem 0.5rem;
    vertical-align: middle;
}

.debt-month-table .debt-month-input {
    width: 100%;
    max-width: 9rem;
    margin-left: auto;
    display: block;
    text-align: right;
}

.debt-month-table__actions {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
}

.debt-month-table__btn {
    padding: 0.2rem 0.35rem;
    font-size: 0.72rem;
    line-height: 1;
    border-radius: 6px;
}

.debt-month-filled-count {
    font-size: 0.85rem;
    color: var(--text-light);
    margin: 0 0 0.75rem;
}

[data-theme='dark'] .debt-year-block {
    background: var(--bg-light);
}
```

Remover estilos órfãos de `.debt-month-row__*` se não forem mais usados.

- [ ] **Step 2: Verificação visual**

Abrir app → Dívidas → Nova dívida → escolher mês de início.  
Expected: accordion/tabela estilizada (mesmo que ainda com render antigo quebrado, CSS não quebra layout).

---

### Task 4: Estado do formulário + render por ano

**Files:**
- Modify: `js/features/debts/debts.js`

- [ ] **Step 1: Estado no topo do módulo (após caches)**

```javascript
/** Valores digitados: monthKey → string (input) */
let debtFormValues = new Map();
/** Updates existentes ao editar banco: monthKey → { id, amount } */
let debtFormUpdateByMonth = new Map();
let debtFormRegisterDebtId = null;
let debtFormCompanyLocked = false;
```

- [ ] **Step 2: Helpers de sync**

```javascript
function syncDebtFormValuesFromDom() {
    document.querySelectorAll('#debt-monthly-years .debt-month-input').forEach((inp) => {
        const key = inp.dataset.monthKey;
        if (!key) return;
        debtFormValues.set(key, inp.value);
    });
}

function getDebtFormMonthKeysInOrder() {
    const startStr = document.getElementById('debt-start-date')?.value?.trim() || '';
    const { months } = buildMonthsForDebtForm(startStr);
    return months.map((d) => monthKey(d));
}

function updateDebtMonthFilledCount() {
    const el = document.getElementById('debt-month-filled-count');
    if (!el) return;
    const n = countFilledMonths(debtFormValues);
    el.textContent = n === 0 ? '' : `${n} ${n === 1 ? 'mês com valor' : 'meses com valor'}`;
}
```

- [ ] **Step 3: Substituir `renderDebtMonthRows` por `renderDebtMonthlyYears`**

```javascript
function renderDebtMonthlyYears(months, { expandYear = null } = {}) {
    const wrap = document.getElementById('debt-monthly-years');
    if (!wrap) return;
    const groups = groupMonthsByYear(months);
    const currentYear = new Date().getFullYear();
    const monthKeysOrder = months.map((d) => monthKey(d));

    wrap.innerHTML = groups
        .map(({ year, months: yearMonths }) => {
            const expanded = expandYear != null ? year === expandYear : year === currentYear;
            const filledInYear = yearMonths.filter((d) => {
                const v = debtFormValues.get(monthKey(d));
                return v != null && String(v).trim() !== '';
            }).length;
            const rows = yearMonths
                .map((d) => {
                    const key = monthKey(d);
                    const val = debtFormValues.get(key) ?? '';
                    const label = formatDebtMonthShortLabel(d);
                    return `<tr data-month-key="${key}">
                        <td>${label}</td>
                        <td class="debt-month-table__col-value">
                            <input type="number" class="debt-month-input" data-month-key="${key}"
                                step="0.01" min="0" placeholder="0,00" inputmode="decimal"
                                autocomplete="off" value="${val === '' ? '' : String(val)}" />
                        </td>
                        <td class="debt-month-table__col-actions">
                            <div class="debt-month-table__actions">
                                <button type="button" class="btn-secondary btn-sm debt-month-table__btn debt-month-copy-prev"
                                    data-month-key="${key}" title="Igual ao mês anterior" aria-label="Igual ao mês anterior">= ant</button>
                                <button type="button" class="btn-icon debt-month-table__btn debt-month-clear"
                                    data-month-key="${key}" title="Limpar" aria-label="Limpar valor"><i class="fas fa-times"></i></button>
                            </div>
                        </td>
                    </tr>`;
                })
                .join('');
            return `<section class="debt-year-block" data-year="${year}">
                <button type="button" class="debt-year-block__toggle" aria-expanded="${expanded}"
                    data-year-toggle="${year}">
                    <span>${year}</span>
                    <span class="debt-year-block__meta">${filledInYear} preenchido${filledInYear === 1 ? '' : 's'}</span>
                </button>
                <div class="debt-year-block__panel" ${expanded ? '' : 'hidden'} data-year-panel="${year}">
                    <table class="debt-month-table">
                        <thead><tr>
                            <th>Mês</th>
                            <th class="debt-month-table__col-value">Valor (R$)</th>
                            <th class="debt-month-table__col-actions">Atalhos</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </section>`;
        })
        .join('');

    updateDebtMonthFilledCount();
}
```

- [ ] **Step 4: Atualizar `syncDebtMonthlySectionFromStartDate`**

```javascript
function syncDebtMonthlySectionFromStartDate() {
    const startInput = document.getElementById('debt-start-date');
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    if (!startInput || !section || !noteEl) return;

    syncDebtFormValuesFromDom();

    const val = startInput.value;
    const { months, note } = buildMonthsForDebtForm(val);

    if (months.length === 0) {
        section.classList.add('hidden');
        const wrap = document.getElementById('debt-monthly-years');
        if (wrap) wrap.innerHTML = '';
        noteEl.classList.add('hidden');
        noteEl.textContent = '';
        updateDebtMonthFilledCount();
        return;
    }

    section.classList.remove('hidden');
    renderDebtMonthlyYears(months);
    if (note) {
        noteEl.textContent = note;
        noteEl.classList.remove('hidden');
    } else {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
}
```

- [ ] **Step 5: Atualizar `resetDebtForm`**

```javascript
function resetDebtForm() {
    const form = document.getElementById('debt-update-form');
    if (form) form.reset();
    debtFormValues = new Map();
    debtFormUpdateByMonth = new Map();
    debtFormRegisterDebtId = null;
    debtFormCompanyLocked = false;
    const companyInput = document.getElementById('debt-company');
    if (companyInput) {
        companyInput.readOnly = false;
        companyInput.removeAttribute('aria-readonly');
    }
    const section = document.getElementById('debt-monthly-section');
    const noteEl = document.getElementById('debt-monthly-note');
    const wrap = document.getElementById('debt-monthly-years');
    if (section) section.classList.add('hidden');
    if (noteEl) {
        noteEl.textContent = '';
        noteEl.classList.add('hidden');
    }
    if (wrap) wrap.innerHTML = '';
    updateDebtMonthFilledCount();
}
```

- [ ] **Step 6: `collectDebtFormMonthAmounts` ler do Map**

```javascript
function collectDebtFormMonthAmounts() {
    syncDebtFormValuesFromDom();
    const order = getDebtFormMonthKeysInOrder();
    const out = [];
    order.forEach((key) => {
        const raw = String(debtFormValues.get(key) ?? '').trim();
        if (raw === '') return;
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n)) return;
        out.push({ monthKey: key, amount: n, date: monthKeyToReferenceDate(key) });
    });
    return out;
}
```

- [ ] **Step 7: Verificação manual**

Nova dívida → mês início `2024-01` → anos 2024–2025 aparecem; 2025 expandido; preencher 2 meses → contador «2 meses com valor».

Run: `npm run build` → exit 0

---

### Task 5: Accordion, atalhos e teclado

**Files:**
- Modify: `js/features/debts/debts.js` (`bindDebtsEvents`)

- [ ] **Step 1: Toggle de ano (delegação no form)**

No listener `debtForm click`, antes dos atalhos de mês:

```javascript
const yearToggle = e.target.closest('[data-year-toggle]');
if (yearToggle) {
    const year = yearToggle.dataset.yearToggle;
    const panel = document.querySelector(`[data-year-panel="${year}"]`);
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    yearToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
}
```

- [ ] **Step 2: Remover handler `.debt-month-remove`**

Apagar bloco que faz `row?.remove()` no click.

- [ ] **Step 3: Atalhos = anterior e limpar**

```javascript
const copyBtn = e.target.closest('.debt-month-copy-prev');
if (copyBtn?.dataset.monthKey) {
    e.preventDefault();
    syncDebtFormValuesFromDom();
    const key = copyBtn.dataset.monthKey;
    const order = getDebtFormMonthKeysInOrder();
    const prev = previousFilledAmount(order, debtFormValues, key);
    if (prev == null) return;
    debtFormValues.set(key, String(prev));
    const inp = document.querySelector(`#debt-monthly-years .debt-month-input[data-month-key="${key}"]`);
    if (inp) inp.value = String(prev);
    updateDebtMonthFilledCount();
    return;
}

const clearBtn = e.target.closest('.debt-month-clear');
if (clearBtn?.dataset.monthKey) {
    e.preventDefault();
    const key = clearBtn.dataset.monthKey;
    debtFormValues.set(key, '');
    const inp = document.querySelector(`#debt-monthly-years .debt-month-input[data-month-key="${key}"]`);
    if (inp) inp.value = '';
    updateDebtMonthFilledCount();
    return;
}
```

- [ ] **Step 4: `input` nos campos atualiza contador**

```javascript
debtForm?.addEventListener('input', (e) => {
    if (!e.target.classList.contains('debt-month-input')) return;
    const key = e.target.dataset.monthKey;
    if (key) debtFormValues.set(key, e.target.value);
    updateDebtMonthFilledCount();
});
```

- [ ] **Step 5: Enter avança para próximo mês**

```javascript
debtForm?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.classList.contains('debt-month-input')) return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll('#debt-monthly-years .debt-month-input')];
    const i = inputs.indexOf(e.target);
    if (i >= 0 && i < inputs.length - 1) inputs[i + 1].focus();
});
```

- [ ] **Step 6: Verificação manual**

- Clicar cabeçalho 2024 → expande/colapsa  
- «= ant» copia valor do mês anterior preenchido  
- Limpar zera célula, linha permanece  
- Enter pula para próximo input  

---

### Task 6: Pré-preenchimento e «Registrar mês»

**Files:**
- Modify: `js/features/debts/debts.js` (`openRegisterForDebt`, abertura via botão Nova dívida)

- [ ] **Step 1: Helper `seedDebtFormFromDebt(debt)`**

```javascript
function seedDebtFormFromDebt(debt) {
    if (!debt?.id) return;
    debtFormRegisterDebtId = debt.id;
    const byMonth = indexUpdatesByMonthKey(debtUpdatesCache, debt.id);
    debtFormUpdateByMonth = new Map();
    debtFormValues = new Map();
    byMonth.forEach((u, mk) => {
        debtFormUpdateByMonth.set(mk, u.id);
        debtFormValues.set(mk, String(Number(u.amount) || 0));
    });
    const dates = [...byMonth.keys()].sort();
    if (dates.length) {
        const startInput = document.getElementById('debt-start-date');
        if (startInput) startInput.value = dates[0];
    }
}
```

- [ ] **Step 2: Atualizar `openRegisterForDebt`**

```javascript
export function openRegisterForDebt(debtId) {
    const debt = (debtsCache || []).find((d) => d.id === debtId);
    resetDebtForm();
    const companyInput = document.getElementById('debt-company');
    if (companyInput && debt) {
        companyInput.value = debt.company || '';
        companyInput.readOnly = true;
        companyInput.setAttribute('aria-readonly', 'true');
        debtFormCompanyLocked = true;
        seedDebtFormFromDebt(debt);
    }
    syncDebtMonthlySectionFromStartDate();
    const currentYear = new Date().getFullYear();
    renderDebtMonthlyYears(buildMonthsForDebtForm(document.getElementById('debt-start-date')?.value).months, {
        expandYear: currentYear
    });
    openModal('debt-update-modal');
    requestAnimationFrame(() => {
        const mk = monthKey(new Date());
        document.querySelector(`#debt-monthly-years .debt-month-input[data-month-key="${mk}"]`)?.focus();
    });
}
```

- [ ] **Step 3: Ao digitar empresa existente no modal novo, opcional seed**

No `input`/`change` de `#debt-company` (se não locked): se nome bate dívida existente, chamar `seedDebtFormFromDebt(found)` e re-render (sem travar nome até submit).

- [ ] **Step 4: Verificação manual**

Card Santander → Registrar mês → nome travado, meses históricos pré-preenchidos, ano atual aberto, foco no mês atual.

---

### Task 7: Save com upsert por mês

**Files:**
- Modify: `js/features/debts/debts.js` (handler `submit` do `#debt-update-form`)

- [ ] **Step 1: Substituir loop de `saveDebtUpdate`**

Dentro do `try`, após obter `debtId`:

```javascript
for (const { date, amount, monthKey: mk } of sortedEntries) {
    const existingId = debtFormUpdateByMonth.get(mk);
    const payload = {
        userId: currentUser.uid,
        debtId,
        date: date.toISOString(),
        amount,
        description: null
    };
    if (existingId) {
        await saveDebtUpdate(payload, existingId);
    } else {
        await saveDebtUpdate(payload);
    }
}
```

Garantir que `sortedEntries` inclui `monthKey` (ajustar `collectDebtFormMonthAmounts`).

- [ ] **Step 2: Após save de banco existente por nome, atualizar `debtFormUpdateByMonth`**

Se `debtId` já existia, antes do loop:

```javascript
const byMonth = indexUpdatesByMonthKey(debtUpdatesCache, debtId);
byMonth.forEach((u, mk) => debtFormUpdateByMonth.set(mk, u.id));
```

- [ ] **Step 3: `type="month"` compatível com `buildMonthsForDebtForm`**

`buildMonthsForDebtForm` já aceita `YYYY-MM` (split por `-`); validar que `input type="month"` retorna esse formato.

- [ ] **Step 4: Verificação manual**

1. Nova dívida, 3 meses → salvar → 3 linhas na tabela, gráfico atualiza.  
2. Mesmo banco, alterar valor de um mês já salvo → submit → **uma** linha na tabela (PUT, não duplicata).  
3. `npm run build` → exit 0

---

### Task 8: Aceite final

**Files:** (nenhum — checklist)

- [ ] **Step 1: Percorrer critérios da spec**

| # | Critério | OK |
|---|----------|-----|
| 1 | 24+ meses, anos colapsados, tabela compacta | |
| 2 | Mudar início preserva valores | |
| 3 | Tab / Enter entre valores | |
| 4 | = ant e Limpar sem remover linhas | |
| 5 | Save só meses preenchidos; upsert no mês existente | |
| 6 | Registrar mês: nome travado, ano atual aberto | |
| 7 | Tema claro e escuro | |

- [ ] **Step 2: Build de produção**

Run: `npm run build`  
Expected: exit 0

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Accordion + tabela | 2, 3, 4 |
| Tab/Enter | 5 |
| Atalhos = ant / limpar | 5 |
| Célula vazia não grava | 4, 7 |
| Sem Remover mês | 2, 5 |
| Preservar valores ao mudar data | 4 |
| Cap 120 meses | 1 |
| Registrar mês | 6 |
| Pré-preencher + upsert | 6, 7 |
| Contador rodapé | 2, 4 |
| CSS tema escuro | 3 |

**Out of scope (confirmado):** colar planilha, batch API — não listados nas tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-debt-registration-modal.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints (`executing-plans`)

Which approach do you want?
