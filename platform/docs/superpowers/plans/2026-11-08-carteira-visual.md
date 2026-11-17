# Carteira visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a linha da Carteira para mostrar saldo e mini plásticos de crédito e débito, no mesmo layout de mês, resumo e painel direito.

**Architecture:** Uma função pura em `wallet-plastic.js` gera o HTML do plástico e do estado vazio. `loadWalletPage` continua calculando fatura e saldo e só entrega textos prontos para essa função. O CSS em `accounts.css` desenha o plástico, aperta a linha e alinha o painel e o modal.

**Tech Stack:** HTML, CSS e JavaScript de módulo no Vite. Teste com `node --test` (sem framework novo).

## Global Constraints

- A ordem da página permanece: timeline, três indicadores, lista de bancos, painel de vencimentos e compras.
- Clique no cartão continua abrindo o modal atual via `data-card-id` e `.wallet-card-open`.
- Editar e excluir ficam na linha da conta.
- Crédito mostra o valor já calculado por `creditCardInstallmentsDueInCalendarMonth` para o mês selecionado.
- Débito mostra o texto “Sem fatura” e não exibe total de gastos.
- Conta sem crédito e sem débito não ganha plástico falso; mantém o atalho “Adicionar cartão de crédito”.
- Cartão sem conta vinculada válida continua em linha órfã.
- Não alterar API, cálculos de saldo ou fatura, nem outras páginas.
- Cor do plástico usa `resolveBankThemeClass` quando houver classe; senão, degradê neutro.

---

### Task 1: HTML puro do plástico

**Files:**
- Create: `js/features/finance/wallet-plastic.js`
- Create: `tests/wallet-plastic.test.js`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: nada do app. Recebe objetos já formatados.
- Produces:
  - `buildWalletPlasticHtml(plastic)` → string
  - `buildWalletPlasticsColumnHtml(plastics, emptyBankId)` → string
  - `plastic` é `{ id: string, name: string, kind: 'credit' | 'debit', dueText: string, amountText: string, themeClass: string }`
  - `amountText` só é usado quando `kind === 'credit'`
  - `emptyBankId` string ou `null`. Quando a lista é vazia e o id existe, o HTML inclui `data-wallet-link-credit` com esse id.

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWalletPlasticHtml, buildWalletPlasticsColumnHtml } from '../js/features/finance/wallet-plastic.js';

test('crédito inclui valor, vencimento e data-card-id', () => {
    const html = buildWalletPlasticHtml({
        id: 'card-1',
        name: 'Bradesco Gold',
        kind: 'credit',
        dueText: 'Vence dia 10',
        amountText: 'R$ 1.100,00',
        themeClass: 'account-card--bank-bradesco'
    });
    assert.match(html, /data-card-id="card-1"/);
    assert.match(html, /wallet-card-open/);
    assert.match(html, /wallet-plastic--credit/);
    assert.match(html, /account-card--bank-bradesco/);
    assert.match(html, /Vence dia 10/);
    assert.match(html, /R\$ 1\.100,00/);
    assert.doesNotMatch(html, /Sem fatura/);
});

test('débito mostra Sem fatura e não mostra valor', () => {
    const html = buildWalletPlasticHtml({
        id: 'deb-1',
        name: 'Bradesco Débito',
        kind: 'debit',
        dueText: '',
        amountText: 'R$ 999,00',
        themeClass: ''
    });
    assert.match(html, /data-card-id="deb-1"/);
    assert.match(html, /wallet-plastic--debit/);
    assert.match(html, /Sem fatura/);
    assert.doesNotMatch(html, /R\$ 999,00/);
});

test('lista vazia oferece adicionar crédito na conta', () => {
    const html = buildWalletPlasticsColumnHtml([], 'bank-9');
    assert.match(html, /Sem cartão de crédito atrelado/);
    assert.match(html, /data-wallet-link-credit="bank-9"/);
    assert.doesNotMatch(html, /wallet-plastic/);
});

test('escapa nome do cartão', () => {
    const html = buildWalletPlasticHtml({
        id: 'x',
        name: '<img>',
        kind: 'credit',
        dueText: '',
        amountText: 'R$ 0,00',
        themeClass: ''
    });
    assert.match(html, /&lt;img&gt;/);
    assert.doesNotMatch(html, /<img>/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/wallet-plastic.test.js`  
Expected: FAIL because `wallet-plastic.js` does not exist.

- [ ] **Step 3: Implement the module**

```js
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildWalletPlasticHtml(plastic) {
    const kind = plastic.kind === 'debit' ? 'debit' : 'credit';
    const theme = plastic.themeClass ? ` ${plastic.themeClass}` : '';
    const due =
        kind === 'credit' && plastic.dueText
            ? `<span class="wallet-plastic__due">${escapeHtml(plastic.dueText)}</span>`
            : '';
    const foot =
        kind === 'credit'
            ? `<span class="wallet-plastic__amount">${escapeHtml(plastic.amountText || '')}</span>`
            : `<span class="wallet-plastic__quiet">Sem fatura</span>`;
    const label = kind === 'credit' ? 'Crédito' : 'Débito';
    return `<button type="button" class="wallet-plastic wallet-plastic--${kind}${theme} wallet-card-open" data-card-id="${escapeHtml(plastic.id)}" aria-label="Ver lançamentos: ${escapeHtml(plastic.name)}">
        <span class="wallet-plastic__top"><span class="wallet-plastic__kind">${label}</span>${due}</span>
        <span class="wallet-plastic__name">${escapeHtml(plastic.name)}</span>
        ${foot}
    </button>`;
}

export function buildWalletPlasticsColumnHtml(plastics, emptyBankId = null) {
    if (!plastics || plastics.length === 0) {
        const link =
            emptyBankId != null && String(emptyBankId).trim() !== ''
                ? `<button type="button" class="wallet-link-add-card" data-wallet-link-credit="${escapeHtml(String(emptyBankId))}">Adicionar cartão de crédito</button>`
                : '';
        return `<div class="wallet-institution-row__empty"><i class="fas fa-lock" aria-hidden="true"></i> Sem cartão de crédito atrelado${link}</div>`;
    }
    return `<div class="wallet-plastics">${plastics.map((p) => buildWalletPlasticHtml(p)).join('')}</div>`;
}
```

- [ ] **Step 4: Point npm test at this file and run it**

In `package.json`, set `"test": "node --test tests/wallet-plastic.test.js"`.

Run: `npm test`  
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add js/features/finance/wallet-plastic.js tests/wallet-plastic.test.js package.json
git commit -m "$(cat <<'EOF'
feat: add wallet plastic markup helper

EOF
)"
```

---

### Task 2: Usar o plástico na linha da Carteira

**Files:**
- Modify: `js/features/finance/transactions.js` (import no topo; loop dentro de `loadWalletPage`, por volta das linhas 6473–6588; `buildWalletCardsColumnHtml` deixa de ser chamada)

**Interfaces:**
- Consumes: `buildWalletPlasticsColumnHtml` de `./wallet-plastic.js`; `resolveBankThemeClass`; `accountHolderDisplayLabel`; `creditCardInstallmentsDueInCalendarMonth`; `formatCurrency`.
- Produces: cada `.wallet-institution-row` com identidade (nome, tipo, titular, saldo) e coluna `.wallet-institution-row__cards` vinda de `buildWalletPlasticsColumnHtml`.

- [ ] **Step 1: Import the helper**

Add next to the other finance imports:

```js
import { buildWalletPlasticsColumnHtml } from './wallet-plastic.js';
```

- [ ] **Step 2: Build plastic descriptors beside each bank**

Inside `loadWalletPage`, after `linkedCredit`, add:

```js
const debitCards = accs.filter((a) => a.type === 'cartao_debito');
const linkedDebit = (id) => debitCards.filter((c) => c.linkedAccountId === id);

function plasticsFor(bankName, credits, debits) {
    const themeClass = resolveBankThemeClass(bankName);
    const creditPlastics = credits.map((c) => ({
        id: c.id,
        name: c.name,
        kind: 'credit',
        dueText: c.dueDay != null ? `Vence dia ${c.dueDay}` : '',
        amountText: formatCurrency(
            creditCardInstallmentsDueInCalendarMonth(
                c,
                exps,
                walletSelectedYear,
                walletSelectedMonth,
                prof,
                acceptedSplits,
                exps
            ),
            cur
        ),
        themeClass
    }));
    const debitPlastics = debits.map((c) => ({
        id: c.id,
        name: c.name,
        kind: 'debit',
        dueText: '',
        amountText: '',
        themeClass
    }));
    return [...creditPlastics, ...debitPlastics];
}
```

Remove the later `const debitCards = ...` near the empty-state check and reuse this array. Keep `hasAnyCard` as `creditCards.length > 0 || debitCards.length > 0`.

- [ ] **Step 3: Replace the bank row identity and cards column**

For each `{ acc, credits }` also load `const debits = linkedDebit(acc.id)`.

Replace `accountCol` usage so `.wallet-institution-row__bank` contains:

```js
const holderRaw = accountHolderDisplayLabel(acc);
const holderLine = holderRaw ? `<span class="wallet-institution-row__meta">${escapeHtml(holderRaw)}</span>` : '';
```

```html
<div class="wallet-institution-row__bank">
    <h3>${escapeHtml(acc.name)}</h3>
    <span class="wallet-institution-row__meta">${escapeHtml(typeLabel)}</span>
    ${holderLine}
</div>
<div class="wallet-institution-row__account">
    <div class="wallet-institution-row__label">Saldo</div>
    <div class="wallet-institution-row__amount">${formatCurrency(Number(acc.currentBalance) || 0, cur)}</div>
</div>
<div class="wallet-institution-row__cards">${buildWalletPlasticsColumnHtml(plasticsFor(acc.name, credits, debits), acc.id)}</div>
```

`data-has-cards` is `"1"` when `credits.length + debits.length > 0`.

Keep the edit and delete buttons in `.wallet-institution-row__row-actions`.

- [ ] **Step 4: Orphan debit rows**

After the orphan credit loop, render debit cards whose `linkedAccountId` is missing from `byBankId`. One article per card, meta “Cartão (sem conta vinculada)”, account column “Sem conta atrelada”, cards column `buildWalletPlasticsColumnHtml(plasticsFor(c.name, [], [c]), null)`.

Stop calling `buildWalletCardsColumnHtml`. Leave the function in the file unused only if some other caller remains; if the only caller was `loadWalletPage`, delete the function.

- [ ] **Step 5: Run the unit test again**

Run: `npm test`  
Expected: PASS. This task does not add a new test; it must not break the helper.

- [ ] **Step 6: Commit**

```bash
git add js/features/finance/transactions.js
git commit -m "$(cat <<'EOF'
feat: show credit and debit plastics on wallet rows

EOF
)"
```

---

### Task 3: Visual da linha, do plástico e do painel

**Files:**
- Modify: `css/pages/accounts.css`

**Interfaces:**
- Consumes: classes `wallet-plastic`, `wallet-plastic--credit`, `wallet-plastic--debit`, `wallet-plastics`, `wallet-plastic__top`, `wallet-plastic__kind`, `wallet-plastic__due`, `wallet-plastic__name`, `wallet-plastic__amount`, `wallet-plastic__quiet`, and existing bank classes `account-card--bank-*`.
- Produces: plástico com altura fixa em torno de 92px, linha mais baixa, painel alinhado.

- [ ] **Step 1: Style the plastic**

Add to `css/pages/accounts.css`:

```css
.wallet-plastics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.wallet-plastic {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 9.5rem;
    min-height: 5.6rem;
    padding: 0.45rem 0.55rem;
    border: 0;
    border-radius: 10px;
    text-align: left;
    color: #f8fafc;
    cursor: pointer;
    background: linear-gradient(145deg, #334155, #0f172a);
}

.wallet-plastic--credit.account-card--bank-bradesco { background: linear-gradient(145deg, #9f1239, #111827); }
.wallet-plastic--credit.account-card--bank-nubank { background: linear-gradient(145deg, #6b21a8, #111827); }
.wallet-plastic--credit.account-card--bank-itau { background: linear-gradient(145deg, #c2410c, #111827); }
.wallet-plastic--credit.account-card--bank-inter { background: linear-gradient(145deg, #ea580c, #111827); }
.wallet-plastic--credit.account-card--bank-santander { background: linear-gradient(145deg, #b91c1c, #111827); }
.wallet-plastic--credit.account-card--bank-bb { background: linear-gradient(145deg, #ca8a04, #111827); }
.wallet-plastic--credit.account-card--bank-caixa { background: linear-gradient(145deg, #1d4ed8, #111827); }
.wallet-plastic--credit.account-card--bank-c6 { background: linear-gradient(145deg, #262626, #0a0a0a); }

.wallet-plastic--debit {
    background: linear-gradient(145deg, #1e293b, #0b1220);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.wallet-plastic__top,
.wallet-plastic__name,
.wallet-plastic__amount,
.wallet-plastic__quiet,
.wallet-plastic__kind,
.wallet-plastic__due {
    display: block;
}

.wallet-plastic__top {
    display: flex;
    justify-content: space-between;
    gap: 0.35rem;
    font-size: 0.62rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.85;
}

.wallet-plastic__name {
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
}

.wallet-plastic__amount {
    font-size: 0.82rem;
    font-weight: 800;
}

.wallet-plastic__quiet {
    font-size: 0.72rem;
    opacity: 0.75;
}
```

Add the same credit gradient pattern for the remaining `resolveBankThemeClass` keys already in the JS (`mercado-pago`, `picpay`, `pagbank`, `pan`, `neon`, `riachuelo`) using one distinct gradient each. Debit ignores those modifiers because the `--debit` rule comes last and resets the background. Put `.wallet-plastic--debit` after the bank gradients.

- [ ] **Step 2: Keep the row grid, drop the progress bar from the card column**

Do not render `.wallet-kpi-progress` inside the plastic. The summary bar `#wallet-summary-invoices-bar-fill` stays.

Confirm `#wallet-page` rules already use the compact timeline and summary from the density pass. Do not increase padding on `.wallet-institution-row` above `0.55rem`.

- [ ] **Step 3: Commit**

```bash
git add css/pages/accounts.css
git commit -m "$(cat <<'EOF'
style: render wallet cards as compact plastics

EOF
)"
```

---

### Task 4: Modal de compras e checagem na tela

**Files:**
- Modify: `css/pages/accounts.css` (regras de `.card-purchases-modal` / `#card-purchases-modal`)

**Interfaces:**
- Consumes: modal já aberto por `.wallet-card-open`.
- Produces: cabeçalho e corpo do modal com menos padding. Nenhuma coluna nova.

- [ ] **Step 1: Tighten the purchases modal**

Scope only to `#card-purchases-modal` or `.modal-content.card-purchases-modal`:

- Title padding at most `0.85rem 1rem`.
- Summary grid gap at most `0.5rem`.
- Table cell vertical padding at most `0.4rem`.

Do not change installment pill behavior, filters, or pagination.

- [ ] **Step 2: Browser check**

Open the Carteira in the running app.

- A bank with credit shows a plastic with the month amount. Changing the timeline month changes that amount and the right-hand lists.
- A linked debit card shows “Sem fatura” and does not show a currency total on the plastic.
- Clicking a plastic opens the purchases modal.
- Edit and delete still sit on the row and still open the existing account flow.
- A bank with no cards shows “Sem cartão de crédito atrelado” and “Adicionar cartão de crédito”, with no `.wallet-plastic`.
- Below 640px the plastics wrap under the balance instead of overflowing the page.

- [ ] **Step 3: Re-run the unit test**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add css/pages/accounts.css
git commit -m "$(cat <<'EOF'
style: tighten wallet purchase modal spacing

EOF
)"
```
