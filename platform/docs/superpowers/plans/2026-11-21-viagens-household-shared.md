# Viagens household shared — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o módulo Viagens (ficha, milhas, emissões, taxas) 100% compartilhado na household, mantendo Finanças pessoal e mostrando aportes/gastos na viagem com autor.

**Architecture:** ACL de viagens e milhas via `household_id` + `household_members` (helpers em `back/household.js`). Dinheiro continua com `expenses.user_id`. A ficha agrega `expenses` de todos os membros com o mesmo `trip_id` e rotula `author`. Sync viagem→Dinheiro grava só no login de quem salvou.

**Tech Stack:** Node (ESM), Postgres, Express routes em `back/`, motor puro em `motor/viagens/`, React front em `front/src/frentes/viagens/`, testes `node --test` em `platform/tests/`.

**Spec:** `platform/docs/superpowers/specs/2026-11-21-viagens-household-shared-design.md`

## Global Constraints

- Viagens: qualquer membro da household lê e edita; fora da household não vê.
- Finanças: extrato/cofrinhos permanecem por `user_id` da sessão.
- Ponte: movimento aparece na viagem com autor; não copia para o Dinheiro do outro.
- Milhas: sem modo “só pessoal”; carteira nova sempre com `household_id`.
- Last-write-wins no `trips.payload`; sem CRDT.
- Não fazer deploy sem permissão explícita do usuário.

## File map

| File | Responsibility |
|------|----------------|
| `platform/prisma/migrations/20261121200000_trips_household/migration_pg.sql` | Coluna `trips.household_id` + backfill |
| `platform/prisma/migrations/20261121201000_miles_force_household/migration_pg.sql` | Backfill `miles_programs.household_id` |
| `back/trips-repository.js` | List/get/create/update com ACL household |
| `back/routes/trips.routes.js` | Passar `userId`; endpoint finance movements |
| `back/index.js` | `assertTripAccess` no lugar de `assertTripOwnedByUser` |
| `back/miles-repository.js` | Create sempre household; rates/emissions por casa |
| `back/routes/miles.routes.js` | Remover descompartilhar; create shared |
| `motor/viagens/trip-finance-household.js` | Merge puro payload + expenses da casa |
| `front/.../PontosWalletEditor.tsx` (+ sheets) | Remover toggle pessoal |
| `front/.../orcamento/*` | Badge autor nas linhas |
| `platform/tests/motor/viagens/trip-finance-household.test.js` | Testes do merge |
| `platform/tests/motor/viagens/trips-household-access.test.js` | Helpers de regra de acesso (se extraídos) |

---

### Task 1: Migration `trips.household_id`

**Files:**
- Create: `platform/prisma/migrations/20261121200000_trips_household/migration_pg.sql`
- Modify: `back/trips-repository.js` (ler/gravar coluna; ainda sem filtrar na Task 1 se preferir — **filtrar na Task 2**)

**Interfaces:**
- Produces: coluna `trips.household_id UUID NULL REFERENCES households(id) ON DELETE SET NULL` + índice `trips_household_id_idx`

- [ ] **Step 1: Criar migration SQL**

```sql
-- platform/prisma/migrations/20261121200000_trips_household/migration_pg.sql
ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trips_household_id_idx ON trips (household_id);

-- Backfill: household do criador; cria membership se necessário via app na Task 2.
-- SQL-only: associa à household existente do user_id
UPDATE trips t
SET household_id = hm.household_id
FROM household_members hm
WHERE hm.user_id = t.user_id
  AND t.household_id IS NULL;
```

- [ ] **Step 2: Documentar no README da migration (comentário no SQL)** que criadores sem membership serão tratados por `ensureHouseholdForUser` + re-backfill no boot/repo (Task 2).

- [ ] **Step 3: Commit**

```bash
git add platform/prisma/migrations/20261121200000_trips_household/migration_pg.sql
git commit -m "chore(db): add trips.household_id for Meu Mundo sharing"
```

---

### Task 2: Repository ACL de viagens

**Files:**
- Modify: `back/trips-repository.js`
- Create: `platform/tests/motor/viagens/trip-household-gate.test.js` (funções puras de gate se extrair; senão teste de contrato documentado abaixo via asserts no motor)

**Interfaces:**
- Consumes: `householdIdsForUserSql`, `ensureHouseholdForUser` de `back/household.js`
- Produces:
  - `listTripsForUser(userId): Promise<row[]>`
  - `getTripForUser(userId, tripId): Promise<row|null>`
  - `assertTripAccess(userId, tripId): Promise<row>` (throws status 404)
  - `createTrip(userId, { title }): Promise<row>` com `household_id` setado
  - Manter `getTrip(tripId)` interno/admin se necessário; rotas passam a usar variantes com user

- [ ] **Step 1: Escrever teste puro do predicado de acesso**

Create `motor/viagens/trip-household-gate.js`:

```js
/** @param {{ householdId?: string|null, userId?: string }} trip */
/** @param {{ userId: string, householdIds: string[] }} viewer */
export function canAccessTrip(trip, viewer) {
    if (!trip) return false;
    if (trip.householdId && viewer.householdIds.includes(trip.householdId)) return true;
    if (!trip.householdId && trip.userId === viewer.userId) return true;
    return false;
}
```

Create `platform/tests/motor/viagens/trip-household-gate.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessTrip } from '../../../motor/viagens/trip-household-gate.js';

test('membro da household acessa', () => {
    assert.equal(
        canAccessTrip(
            { householdId: 'h1', userId: 'a' },
            { userId: 'b', householdIds: ['h1'] }
        ),
        true
    );
});

test('fora da household não acessa', () => {
    assert.equal(
        canAccessTrip(
            { householdId: 'h1', userId: 'a' },
            { userId: 'c', householdIds: ['h2'] }
        ),
        false
    );
});

test('legado sem household: só criador', () => {
    assert.equal(
        canAccessTrip({ householdId: null, userId: 'a' }, { userId: 'a', householdIds: [] }),
        true
    );
    assert.equal(
        canAccessTrip({ householdId: null, userId: 'a' }, { userId: 'b', householdIds: [] }),
        false
    );
});
```

- [ ] **Step 2: Rodar teste — deve falhar (módulo inexistente)**

Run: `node --test platform/tests/motor/viagens/trip-household-gate.test.js`  
Expected: FAIL module not found

- [ ] **Step 3: Implementar `trip-household-gate.js` + atualizar `trips-repository.js`**

Em `listTripsForUser`:

```js
import { ensureHouseholdForUser, householdIdsForUserSql } from './household.js';

export async function listTripsForUser(userId) {
    await ensureHouseholdForUser(userId);
    const { rows } = await query(
        `SELECT ${SELECT_FIELDS}
         FROM trips t
         ${CREATOR_JOIN}
         WHERE t.household_id IN ${householdIdsForUserSql(1)}
            OR (t.household_id IS NULL AND t.user_id = $1)
         ORDER BY t.updated_at DESC`,
        [userId]
    );
    return rows;
}
```

`createTrip`: chamar `ensureHouseholdForUser(userId)`, INSERT com `household_id`.

`getTripForUser` / `assertTripAccess`: SELECT by id + checar `canAccessTrip` (mapear `household_id` → `householdId`).

Antes do SELECT, opcional: backfill órfãos do user:

```js
const hid = await ensureHouseholdForUser(userId);
await query(
  `UPDATE trips SET household_id = $1 WHERE user_id = $2 AND household_id IS NULL`,
  [hid, userId]
);
```

- [ ] **Step 4: Rodar teste gate — PASS**

Run: `node --test platform/tests/motor/viagens/trip-household-gate.test.js`

- [ ] **Step 5: Registrar teste no script `package.json` `"test"`** (adicionar path após outros `motor/viagens`).

- [ ] **Step 6: Commit**

```bash
git add motor/viagens/trip-household-gate.js platform/tests/motor/viagens/trip-household-gate.test.js back/trips-repository.js package.json
git commit -m "feat(viagens): ACL de trips por household"
```

---

### Task 3: Wire rotas de trips + fix assert em Dinheiro

**Files:**
- Modify: `back/routes/trips.routes.js`
- Modify: `back/index.js` (`assertTripOwnedByUser` → `assertTripAccess`)

**Interfaces:**
- Consumes: `listTripsForUser`, `getTripForUser`, `assertTripAccess`, `createTrip` (já com household)
- Produces: GET/POST/PATCH/DELETE `/api/trips*` respeitam household; vincular `tripId` em expenses usa `assertTripAccess`

- [ ] **Step 1: Trocar listagem**

```js
const rows = await repo.listTripsForUser(req.session.userId);
```

Em get/patch/delete: `const row = await repo.getTripForUser(req.session.userId, req.params.id); if (!row) return res.status(404)...`

- [ ] **Step 2: Corrigir `assertTripOwnedByUser` em `back/index.js`**

```js
async function assertTripAccess(userId, tripId) {
    if (!tripId) return;
    const { assertTripAccess: assertTrip } = await import('./trips-repository.js');
    await assertTrip(userId, tripId);
}
// substituir todas as chamadas assertTripOwnedByUser → assertTripAccess
```

Nota: o bug atual `getTrip(userId, tripId)` passa o UUID do user como id da viagem — deve sumir.

- [ ] **Step 3: Smoke manual / commit**

```bash
git add back/routes/trips.routes.js back/index.js
git commit -m "fix(viagens): rotas e vínculo Dinheiro usam ACL household"
```

---

### Task 4: Forçar milhas na household (DB + create)

**Files:**
- Create: `platform/prisma/migrations/20261121201000_miles_force_household/migration_pg.sql`
- Modify: `back/miles-repository.js` (`insertProgram` / create)
- Modify: `back/routes/miles.routes.js` (POST create + PATCH: ignorar `householdShared: false`)

**Interfaces:**
- Produces: programas novos sempre com `household_id`; backfill dos existentes

- [ ] **Step 1: Migration SQL**

```sql
UPDATE miles_programs p
SET household_id = hm.household_id,
    holder_user_id = COALESCE(p.holder_user_id, p.user_id)
FROM household_members hm
WHERE hm.user_id = p.user_id
  AND p.household_id IS NULL;
```

Comentário: conflitos `household_id + brand` únicos — Task 7 (fusão). Se a migration falhar por índice, documentar e rodar fusão antes.

- [ ] **Step 2: Em create program**

```js
const householdId = await ensureHouseholdForUser(userId);
// INSERT ... household_id, holder_user_id DEFAULT userId
```

- [ ] **Step 3: PATCH** — se `householdShared === false`, responder `400` com mensagem *"Carteiras de milhas no Meu Mundo são sempre da casa"* **ou** ignorar e manter shared (preferir 400 explícito).

- [ ] **Step 4: Commit**

```bash
git add platform/prisma/migrations/20261121201000_miles_force_household/migration_pg.sql back/miles-repository.js back/routes/miles.routes.js
git commit -m "feat(milhas): carteiras sempre compartilhadas na household"
```

---

### Task 5: UI — remover toggle “só pessoal”

**Files:**
- Modify: `front/src/frentes/viagens/pages/pontos/PontosWalletEditor.tsx`
- Modify: `front/src/frentes/viagens/components/milhas/MilesWalletHub.tsx`
- Modify: `front/src/frentes/viagens/components/voos/CarteiraSheet.tsx`

**Interfaces:**
- Produces: drafts sem `householdShared: false`; UI mostra chip “Casa” / titular sem checkbox de descompartilhar

- [ ] **Step 1: Remover state/checkbox `householdShared` do editor**; manter select de **titular** (`holderUserId`) entre membros.

- [ ] **Step 2: Nos saves (Hub / CarteiraSheet), não enviar `householdShared: false`**; enviar `holderUserId` quando relevante. Create não precisa mandar shared — backend força.

- [ ] **Step 3: Commit**

```bash
git add front/src/frentes/viagens/pages/pontos/PontosWalletEditor.tsx \
  front/src/frentes/viagens/components/milhas/MilesWalletHub.tsx \
  front/src/frentes/viagens/components/voos/CarteiraSheet.tsx
git commit -m "feat(milhas): UI sem carteira pessoal — sempre casa"
```

---

### Task 6: Taxas de conversão visíveis na casa

**Files:**
- Modify: `back/miles-repository.js` (`listRates`)
- Test: `platform/tests/motor/viagens/miles-rates-household.test.js` (predicado de merge/dedupe puro)

**Interfaces:**
- Produces: `listRates(userId)` retorna taxas de **todos os user_ids** da mesma household, dedupe por `(fromProgramId, toProgramId)` ficando com `updated_at` mais recente

- [ ] **Step 1: Função pura de dedupe**

```js
// motor/viagens/miles-rates-household.js
export function dedupeRatesByPair(rates) {
    const best = new Map();
    for (const r of rates) {
        const key = `${r.fromProgramId}→${r.toProgramId}`;
        const prev = best.get(key);
        if (!prev || String(r.updatedAt) > String(prev.updatedAt)) best.set(key, r);
    }
    return [...best.values()];
}
```

Teste: duas taxas mesmo par, fica a mais nova.

- [ ] **Step 2: Implementar + SQL**

```sql
SELECT r.*
FROM miles_conversion_rates r
WHERE r.user_id = $1
   OR r.user_id IN (
        SELECT user_id FROM household_members
        WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = $1)
   )
ORDER BY r.updated_at DESC
```

Depois `dedupeRatesByPair(rows.map(mapRate))`.

- [ ] **Step 3: Commit**

```bash
git add motor/viagens/miles-rates-household.js platform/tests/motor/viagens/miles-rates-household.test.js back/miles-repository.js package.json
git commit -m "feat(milhas): taxas de conversão visíveis na household"
```

---

### Task 7: Emissões por viagem (household)

**Files:**
- Modify: `back/miles-repository.js` (`listEmissions`, `getEmission`, update/delete asserts)
- Modify: `back/routes/miles.routes.js`

**Interfaces:**
- Consumes: `assertTripAccess(userId, tripId)` de trips-repository
- Produces: `listEmissionsForTrip(userId, tripId)` lista **todas** sims com aquele `trip_id` após assert; get/update por id se trip acessível (não só `user_id = sessão`)

- [ ] **Step 1: Trocar query de list**

```sql
SELECT * FROM miles_emission_sims WHERE trip_id = $1 ORDER BY updated_at DESC
```

Route:

```js
await assertTripAccess(req.session.userId, tripId);
const emissions = await repo.listEmissionsByTrip(tripId);
```

- [ ] **Step 2: getEmission / patch / delete** — carregar sim por id; `assertTripAccess(userId, sim.trip_id)`; permitir mutação por qualquer membro.

- [ ] **Step 3: Commit**

```bash
git add back/miles-repository.js back/routes/miles.routes.js
git commit -m "feat(milhas): emissões da viagem compartilhadas na casa"
```

---

### Task 8: Agregar movimentos financeiros da casa na viagem

**Files:**
- Create: `motor/viagens/trip-finance-household.js`
- Create: `platform/tests/motor/viagens/trip-finance-household.test.js`
- Modify: `back/trip-finance-sync.js` ou novo `back/trip-finance-household.js`
- Modify: `back/routes/trips.routes.js` — `GET /api/trips/:id/finance-movements` **ou** enrich no GET trip
- Modify: front types + `TripOrcamentoPanel` / model para consumir autores

**Interfaces:**
- Produces:
  - `mergeTripFinanceView({ payloadExpenses, householdExpenses }) → { lines, totals }`  
    onde `householdExpenses` = `{ id, amount, description, category, subcategory, tripExpenseId, userId, authorName, spentOn, ... }[]`
  - Regra: se `tripExpenseId` existe em ambos, **não duplicar** (preferir linha de `expenses` com author)
  - API: `{ movements: Array<{ ..., author: { id, name } }> }`

- [ ] **Step 1: Teste falhando do merge**

```js
test('não duplica tripExpenseId e preserva autor do Dinheiro', () => {
    const view = mergeTripFinanceView({
        payloadExpenses: [{ id: 'te1', amount: 10, description: 'Hotel' }],
        householdExpenses: [
            {
                id: 'e1',
                tripExpenseId: 'te1',
                amount: 10,
                description: 'Hotel',
                userId: 'u1',
                authorName: 'Millena'
            },
            {
                id: 'e2',
                tripExpenseId: null,
                amount: 50,
                description: 'Aporte',
                userId: 'u2',
                authorName: 'Victor'
            }
        ]
    });
    assert.equal(view.lines.length, 2);
    assert.equal(view.lines.find((l) => l.tripExpenseId === 'te1').author.name, 'Millena');
    assert.ok(view.lines.some((l) => l.author.name === 'Victor' && l.amount === 50));
});
```

- [ ] **Step 2: Implementar merge no motor**

- [ ] **Step 3: Query no back**

```sql
SELECT e.id, e.user_id, e.amount, e.description, e.category, e.subcategory,
       e.trip_id, e.trip_expense_id, e.date, u.name AS author_name
FROM expenses e
JOIN users u ON u.id = e.user_id
WHERE e.trip_id = $1
  AND e.user_id IN (
    SELECT user_id FROM household_members
    WHERE household_id = (SELECT household_id FROM trips WHERE id = $1)
  )
```

Após `assertTripAccess`. Anexar no GET `/api/trips/:id` como `financeMovements` **ou** rota dedicada; front orçamento usa o campo.

- [ ] **Step 4: Confirmar que `syncTripExpensesToFinance` continua filtrando `user_id = sessão`** (não alterar para household write).

- [ ] **Step 5: Commit**

```bash
git add motor/viagens/trip-finance-household.js \
  platform/tests/motor/viagens/trip-finance-household.test.js \
  back/trip-finance-sync.js back/routes/trips.routes.js package.json \
  front/src/frentes/viagens/types.ts \
  front/src/frentes/viagens/components/orcamento/
git commit -m "feat(viagens): orçamento da casa com autor nos lançamentos"
```

---

### Task 9: UI orçamento — badge de autor

**Files:**
- Modify: `front/src/frentes/viagens/components/orcamento/ExpenseRow.tsx`
- Modify: `front/src/frentes/viagens/components/orcamento/TripOrcamentoPanel.tsx`
- Modify: CSS `orcamento-workspace.css` se necessário

**Interfaces:**
- Consumes: `financeMovements` / linhas mergeadas com `author?: { id, name }`
- Produces: texto discreto “por {name}” quando `author` presente e ≠ sessão (ou sempre mostrar nome)

- [ ] **Step 1: Passar `author` para `ExpenseRow` / linhas de aporte**

- [ ] **Step 2: Render**

```tsx
{author?.name ? (
  <span className="orcamento-author" title={`Lançado por ${author.name}`}>
    {author.name}
  </span>
) : null}
```

- [ ] **Step 3: Commit**

```bash
git add front/src/frentes/viagens/components/orcamento/ front/src/frentes/viagens/styles/orcamento-workspace.css
git commit -m "feat(viagens): mostrar autor dos lançamentos no orçamento"
```

---

### Task 10: Fusão mínima de milhas duplicadas (bloqueio seguro)

**Files:**
- Modify: `back/miles-repository.js` / `back/routes/miles.routes.js`
- Optional UI: alerta no `MilesWalletHub` se API devolver `duplicateBrandConflict`

**Interfaces:**
- Se INSERT/UPDATE estourar unique `miles_programs_household_brand_uidx`, retornar **409** com `{ error, code: 'MILES_BRAND_DUPLICATE', brand }` em vez de 500.
- v1.5 completa (reapontar movimentos) pode ficar como follow-up se já houver plano em `2026-11-19-milhas-household.md`; neste task só **detectar + mensagem clara**.

- [ ] **Step 1: catch unique_violation (Postgres `23505`)** no create/share force

- [ ] **Step 2: Hub mostra toast** pedindo manter uma carteira / fusão manual

- [ ] **Step 3: Commit**

```bash
git add back/miles-repository.js back/routes/miles.routes.js front/src/frentes/viagens/components/milhas/MilesWalletHub.tsx
git commit -m "fix(milhas): 409 claro quando brand duplicada na household"
```

---

### Task 11: Verificação final

- [ ] **Step 1: Rodar testes**

```bash
npm test
```

Expected: PASS (incluir novos arquivos no script se ainda faltarem)

- [ ] **Step 2: `npm run build:front`**

Expected: build OK

- [ ] **Step 3: Checklist manual (dois logins mesma casa)**
  1. B vê viagem criada por A e edita título
  2. Carteira de milhas aparece nos dois
  3. Emissão criada por A aparece para B na mesma viagem
  4. Gasto no Dinheiro de A com trip → B vê no orçamento com nome de A; Dinheiro de B limpo
  5. Login sem membership não lista a viagem

- [ ] **Step 4: Commit de ajustes residuais se houver**

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| `trips.household_id` + backfill | 1–2 |
| ACL list/get/update/delete por household | 2–3 |
| Fix assert vínculo Dinheiro | 3 |
| Milhas sempre household + migration | 4–5 |
| Taxas compartilhadas | 6 |
| Emissões por trip/household | 7 |
| Agregação expenses + autor; sync só sessão | 8–9 |
| Sem compartilhar extrato Dinheiro | 8 (write path intacto) |
| Fusão / conflito brand | 10 |
| Testes automatizados chave | 2, 6, 8, 11 |
| Last-write-wins / fora de escopo CRDT | sem task (explícito) |

Sem placeholders TBD. Assinaturas `assertTripAccess` / `listTripsForUser` / `mergeTripFinanceView` consistentes entre tasks.
