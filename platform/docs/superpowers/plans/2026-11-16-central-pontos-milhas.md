# Central de Pontos e Milhas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; the user already said “pode seguir”). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a aba Casa das milhas pela Central de pontos (visão, carteira, calculadora, emissão) com extrato real no Postgres e fórmulas testadas em Decimal.

**Architecture:** Motor puro em `motor/milhas/` (pontos inteiros, dinheiro `decimal.js`). API `/api/miles` + repositório Postgres. UI aninhada em `/viagens/:tripId/voos/pontos/*`. Saldo derivado de movimentações; simulações de emissão ligadas à viagem.

**Tech Stack:** Node ESM, Postgres, Express session auth, React + Vite, `decimal.js`, testes `node:test`.

## Global Constraints

- Sem item novo no menu; a Central vive na aba de Voos.
- Carteira/extrato da conta; histórico de emissão por `trip_id`.
- Saldo = soma das movimentações; editar saldo grava `ajuste`.
- Bônus só se preenchido; incide no destino após a conversão (160k / 2:1 / 25% → 80k + 20k = 100k).
- Custo-benefício = custo econômico ÷ milheiros emitidos no destino.
- Não somar pontos de programas diferentes.
- Arredondar BRL em 2 casas só na exibição / gravação de `amount`; pontos inteiros.
- Sem scraping, promoções, relatórios longos ou commit git (o usuário não pediu commit).
- Sem deploy.

## File map

- Create: `motor/milhas/convert.js`, `purchase.js`, `ledger.js`, `emission.js`, `catalog.js`
- Create: `platform/tests/motor/milhas/*.test.js`
- Create: `platform/prisma/migrations/20261117010000_miles/migration_pg.sql`
- Create: `back/miles-repository.js`, `back/routes/miles.routes.js`
- Create: `front/src/frentes/viagens/api/miles.ts`
- Create: `front/src/frentes/viagens/pages/pontos/*` and `components/pontos/*`
- Modify: `back/routes/register-domain-routes.js`, `package.json`, `front/src/frentes/viagens/routes.tsx`, `ViagemVoosPage.tsx`

---

### Task 1: Conversão de pontos (Decimal)

**Files:**
- Create: `motor/milhas/convert.js`
- Test: `platform/tests/motor/milhas/convert.test.js`
- Modify: `package.json` (dependency `decimal.js` + script `test`)

**Produces:** `convertPoints({ originPoints, from, to, bonusPercent, round })` → `{ base, bonus, total }`; `originPointsNeeded({ destinationPoints, from, to, bonusPercent, round })` → number

- [ ] **Step 1:** `npm install decimal.js`
- [ ] **Step 2:** Write failing tests (160k 2:1 25%; sem bônus; inverso 100k → 160k)
- [ ] **Step 3:** Implement `convert.js`
- [ ] **Step 4:** Run tests until pass

```js
import Decimal from 'decimal.js';

function asPoints(n) {
    const d = new Decimal(n ?? 0);
    if (!d.isFinite() || d.lt(0)) return 0;
    return d.toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber();
}

function applyRound(decimal, round) {
    return round === 'up'
        ? decimal.toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber()
        : decimal.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toNumber();
}

export function convertPoints({ originPoints, from, to, bonusPercent = 0, round = 'down' }) {
    const origin = asPoints(originPoints);
    const a = Math.max(1, Math.trunc(Number(from) || 1));
    const b = Math.max(1, Math.trunc(Number(to) || 1));
    const bonus = new Decimal(bonusPercent || 0);
    const base = applyRound(new Decimal(origin).mul(b).div(a), round);
    const extra = bonus.lte(0) ? 0 : applyRound(new Decimal(base).mul(bonus).div(100), round);
    return { base, bonus: extra, total: base + extra };
}

export function originPointsNeeded({ destinationPoints, from, to, bonusPercent = 0, round = 'down' }) {
    const dest = asPoints(destinationPoints);
    if (dest === 0) return 0;
    const a = Math.max(1, Math.trunc(Number(from) || 1));
    const b = Math.max(1, Math.trunc(Number(to) || 1));
    const factor = new Decimal(b).div(a).mul(new Decimal(1).plus(new Decimal(bonusPercent || 0).div(100)));
    if (factor.lte(0)) return dest;
    let guess = dest === 0 ? 0 : new Decimal(dest).div(factor).toDecimalPlaces(0, Decimal.ROUND_CEIL).toNumber();
    const covers = (n) => convertPoints({ originPoints: n, from: a, to: b, bonusPercent, round }).total >= dest;
    while (!covers(guess)) guess += 1;
    while (guess > 0 && covers(guess - 1)) guess -= 1;
    return guess;
}
```

---

### Task 2: Compra de pontos

**Produces:** `purchaseCost({ points, milheiro, discountPercent, extraFee })` → `{ gross, total, costPerPoint, costPerMilheiro }` as Decimal (total arredondado só via `money2` na borda)

- [ ] Tests: 50_000 pts, milheiro 14, desconto 20% → total 560, milheiro efetivo 11.2
- [ ] Implement `motor/milhas/purchase.js`

---

### Task 3: Ledger (saldo, ajuste, milheiro de aquisição)

**Produces:**
- `movementDelta(m)` → signed points
- `programBalance(movements, programId)`
- `setBalanceAdjustment({ current, target })` → `{ points, pointsSign }` or null
- `acquisitionMilheiro(movements, programId)` → Decimal

Débito: `transferencia_saida`, `emissao`, `expiracao`. Crédito: `acumulo`, `compra`, `transferencia_entrada`, `bonus`. `ajuste` usa `points_sign`.

---

### Task 4: Custo de emissão + comparador + dashboard

**Produces:** `emissionOptionCost`, `compareEmissionOptions`, `programDashboardRow`, `buildDashboard`

Destaques: `lowestOutlayId`, `lowestEconomicId`, `bestValueId` (menor `economic / (destinationPoints/1000)`).

---

### Task 5: Schema Postgres + repositório + rotas

SQL `CREATE TABLE IF NOT EXISTS` para `miles_programs`, `miles_movements`, `miles_emission_sims`, `miles_emission_options`.

Na subida: `ensureMilesSchema()` executa o SQL. `GET /api/miles/programs` migra `viagensMiles` se a conta não tiver programas.

Rotas em `back/routes/miles.routes.js`, registradas em `register-domain-routes.js`.

---

### Task 6: UI Central (substitui MilesHubPanel)

Rotas React aninhadas. Telas: Visão, Carteira, Calculadora, Emissão. Aba “Central de pontos”.

---

### Task 7: Verificação

`node --test platform/tests/motor/milhas/*.test.js` e `vite build`. Sem deploy.
