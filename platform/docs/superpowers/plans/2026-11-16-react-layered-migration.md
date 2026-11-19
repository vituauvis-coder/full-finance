# Migração para React + camadas (Meu Mundo) — plano por fases

**Data:** 2026-11-16  
**Status:** Proposta inicial (não executar tudo de uma vez)  
**Repo:** único (`meu-mundo` — produto **Meu Mundo**; remoto GitHub pode ainda ser `full-finance`)  
**Referências:** `docs/STACK.md`, `meu-mundo/client` + `meu-mundo/server`, spec antiga `2026-05-20-architecture-modernization-design.md` (atualizada pela decisão de React)

---

## Por que não é um “rewrite de fim de semana”

| Área | Tamanho aproximado | Risco |
|------|-------------------|--------|
| `server/index.js` | ~4.300 linhas | API estável mas difícil de testar por domínio |
| `index.html` + `css/` | DOM monolítico | Tudo acoplado ao shell vanilla |
| `js/features/finance/transactions.js` | ~7k linhas | Regras de dinheiro, splits, crédito |
| `js/app/main.js` + `AppState` | Bundle `/api/data` | Estado global implícito |

**Objetivo:** arquitetura **profissional em camadas**, sem parar o produto. Estratégia: **Strangler Fig** — React cresce ao lado do legado até cortar.

**Você já tem um protótipo de destino:** repositório `meu-mundo` (React + Express modular para trips/auth/bootstrap). O portal atual já tem **API `/api/trips`** e motores em `shared/trips/` (código legado). Na execução do plano isso vira **`motor/viagens/`**.

---

## Camada `motor/` — motor de regras

| Nome no repo | Significado |
|--------------|-------------|
| **`motor/`** | **Motor de regras**: funções puras de negócio (entra dado → sai resultado). Sem UI, sem SQL, sem HTTP. |
| `motor/viagens/` | Regras de viagens (hoje em `shared/trips/*.js`) |
| `motor/dinheiro/` | Regras financeiras (extraídas de `js/core/` aos poucos) |

**Não é** um rules engine genérico (DSL configurável). É **código explícito** por domínio, com testes (`node --test`).

**Quem consome:** `front/` e `back/` importam o mesmo módulo — uma fonte da verdade para totais, status, splits, etc.

**Migração de nome (Fase 0, sem mudar lógica):** renomear pasta `shared/` → `motor/`, ajustar imports e `tests/`; opcionalmente `trips/` → `viagens/` no mesmo PR ou no seguinte.

---

## Três pilares no mesmo repo: `front/`, `back/`, `motor/`

Regra de ouro: **nada de React em `back/`**, **nada de SQL em `front/`**, **regras de negócio só em `motor/`**.

| Pasta | Papel | Deploy / dev |
|-------|--------|----------------|
| **`front/`** | SPA React (telas, componentes, rotas) | Vite → `dist/` (estático) |
| **`back/`** | API Express (HTTP, sessão, Postgres) | Node → porta `PORT` |
| **`motor/`** | Motor de regras (puro, testável) | importado por front e back |
| **`legacy-web/`** | Vanilla atual (enquanto strangler roda) | Vite root legado |

Scripts npm alvo:

```bash
npm run dev          # back + front (e opcionalmente legacy)
npm run dev:back     # só API
npm run dev:front    # só Vite React
npm run dev:legacy   # vanilla antigo + API
npm run build        # build do front + nada obrigatório no back
```

> **Nota:** hoje a pasta chama-se `server/`; na migração renomeamos para **`back/`** (ou movemos `server/*` → `back/*` num PR dedicado) para ficar simétrico com **`front/`**. Até lá, trate `server/` = `back/`.

---

## Arquitetura alvo (um repo)

```
meu-mundo/
├── front/                         # SISTEMA FRONT
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json               # opcional: workspaces; ou só root
│   └── src/
│       ├── app/                   # bootstrap mínimo: providers, router raiz
│       ├── components/            # DESIGN SYSTEM (ver abaixo)
│       │   ├── ui/                # primitivos: Button, Input, Badge, Modal…
│       │   ├── layout/            # AppShell, Sidebar, PageHeader, SaveHint…
│       │   └── feedback/          # Toast, EmptyState, ErrorBoundary
│       ├── frentes/               # produto por área (não “uma pasta js gigante”)
│       │   ├── dinheiro/
│       │   │   ├── pages/         # 1 arquivo ≈ 1 rota/tela
│       │   │   ├── components/    # só usados em dinheiro
│       │   │   ├── hooks/
│       │   │   ├── api/           # chamadas /api/* desse domínio
│       │   │   └── routes.tsx     # export das rotas da frente
│       │   ├── viagens/
│       │   │   ├── pages/
│       │   │   ├── components/
│       │   │   ├── sections/      # blocos da ficha (orçamento, voos…)
│       │   │   ├── hooks/
│       │   │   ├── api/
│       │   │   └── routes.tsx
│       │   └── ferramentas/
│       ├── lib/                   # http client, formatadores de UI, constants
│       └── styles/                # tokens, global.css (espelha color-tokens)
│
├── back/                          # SISTEMA BACK (hoje server/)
│   ├── index.js                   # só: env, middleware, mountRoutes, listen
│   ├── middleware/
│   ├── routes/                    # 1 arquivo por recurso HTTP (finos)
│   ├── services/                  # orquestração; sem req/res
│   ├── repositories/              # 1 arquivo por tabela/agregado SQL
│   └── validators/                # schemas de body/query (opcional zod)
│
├── motor/                         # MOTOR DE REGRAS (antes shared/)
│   ├── viagens/                   # (antes shared/trips/)
│   └── dinheiro/                  # extrair de js/core aos poucos
│
├── legacy-web/                    # vanilla congelado
├── admin/                         # último a migrar
├── prisma/migrations/
├── tests/
│   ├── motor/
│   ├── back/                      # integração leve por rota
│   └── front/                     # Vitest + Testing Library (fase 2+)
└── package.json
```

**Fronteiras:**

- **motor/** — motor de regras; `node --test` / Vitest.
- **back/** — HTTP, sessão, persistência; arquivos **pequenos** (ver limites).
- **front/** — UI apenas; consome REST com cookie.
- **legacy-web/** — encolhe até remoção.

Auth, Postgres, cookies e `/api/health` **permanecem**; muda só quem consome a API.

---

## Sistema de componentes (front)

Objetivo: **nunca mais** um `transactions.js` de 7k linhas. Dois níveis:

### 1. `components/` — biblioteca Meu Mundo (reutilizável)

| Subpasta | Contém | Exemplo |
|----------|--------|---------|
| `ui/` | Primitivos sem regra de negócio | `Button`, `TextField`, `Icon`, `KpiCard` |
| `layout/` | Estrutura do app | `AppShell`, `SidebarGroup`, `PageToolbar` |
| `feedback/` | Estados globais | `Toast`, `Skeleton`, `EmptyState` |

Regras:

- Componentes em **`PascalCase.tsx`** + estilo colocalizado (`Button.module.css` ou prop `className` + tokens).
- **Props tipadas**; sem fetch dentro de `ui/*` (dados vêm da página/hook).
- Export barrel opcional: `components/ui/index.ts` — evitar import de 40 níveis.

### 2. `frentes/<nome>/components/` — específicos da tela

Só entra aqui o que **não** serve a outra frente. Ex.: `ViagemOrcamentoSection`, `ExpenseSplitPanel`.

### Convenções de tamanho (obrigatório no code review)

| Tipo de arquivo | Alvo máximo | Se passar |
|-----------------|-------------|-----------|
| Página (`pages/*.tsx`) | ~200 linhas | extrair seções para `components/` |
| Componente | ~150 linhas | subcomponentes na mesma pasta |
| Hook | ~120 linhas | dividir por responsabilidade |
| Route handler `back/routes/*.js` | ~150 linhas | service + repository |
| Repository | ~200 linhas | query helpers privados no arquivo |

**Página = composição:** a tela monta blocos; lógica pesada em `hooks/` ou **`motor/`** (nunca duplicar fórmula na página).

Exemplo **viagens**:

```
frentes/viagens/pages/AtlasPage.tsx        # layout + wire
frentes/viagens/pages/ViagemFichaPage.tsx
frentes/viagens/sections/OrcamentoSection.tsx
frentes/viagens/components/TripCalendarCard.tsx
frentes/viagens/hooks/useTripDraft.ts
frentes/viagens/api/trips.ts
```

Exemplo **dinheiro** (futuro):

```
frentes/dinheiro/pages/SaidasPage.tsx
frentes/dinheiro/components/ExpenseTable.tsx
frentes/dinheiro/components/modals/ExpenseFormModal.tsx   # 1 modal = 1 arquivo
```

---

## Organização do back (espelhando frentes)

Cada **frente de produto** no front mapeia para **um conjunto de rotas** no back (não um `index.js` monolítico).

```
back/routes/
  auth.routes.js
  trips.routes.js          # frente viagens
  expenses.routes.js       # frente dinheiro
  gains.routes.js
  ...
back/repositories/
  trips.repository.js
  expenses.repository.js
back/services/
  expense-split.service.js   # só quando a rota ficaria gorda
```

- **Rota:** parse → auth → chama service/repository → JSON.
- **Repository:** SQL; sem `if (regra de negócio complexa)` — isso vai para **`motor/`**; orquestração fina em `services/`.
- **index.js:** só registra rotas e middleware (meta: **&lt; 80 linhas**).

---

## Rotas no front (por frente)

Router raiz em `app/router.tsx` **compõe** rotas exportadas por cada frente:

```tsx
// app/router.tsx (esboço)
<Route path="/" element={<AppShell />}>
  {dinheiroRoutes}
  {viagensRoutes}
  {ferramentasRoutes}
</Route>
```

URLs sugeridas:

| Frente | Prefixo | Exemplos |
|--------|---------|----------|
| Dinheiro | `/dinheiro/…` | `/dinheiro/dashboard`, `/dinheiro/saidas` |
| Viagens | `/viagens/…` | `/viagens` (atlas), `/viagens/:tripId` |
| Ferramentas | `/ferramentas` | kanban |

Sidebar Meu Mundo = mesmos grupos; cada item aponta para uma **página** pequena.

---

## Abordagens (e escolha)

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **A. Strangler (recomendada)** | Sempre deployável; piloto por módulo | Dois fronts por um tempo |
| **B. Big bang React** | Um só front no fim | Meses sem merge seguro; regressão financeira |
| **C. Só modularizar vanilla** | Menor custo | Não atende objetivo React |

**Recomendação:** **A**, começando pelo **back modular** em paralelo com **client React mínimo**, primeiro módulo vertical **Viagens**.

---

## Fases (macro)

### Fase 0 — Fundação do repo (≈1 semana)

**Meta:** pastas **`front/`**, **`back/`**, **`motor/`**, `legacy-web/` e scripts existem; comportamento do usuário **inalterado**.

1. Renomear **`shared/` → `motor/`** (ajustar imports no legado, `server/`, `tests/trips/` → `tests/motor/viagens/` se aplicável).
2. Renomear ou copiar `server/` → **`back/`** (reexport temporário se precisar).
3. Criar `legacy-web/` e mover vanilla (`index.html`, `js/`, `css/`).
4. Criar `front/` vazio com `README` + estrutura de pastas (`components/ui`, `frentes/…`).
5. Ajustar Vite: `legacy-web` + futuro `front/vite.config.ts`.
6. Documentar **`motor/`** + limites de arquivo em `docs/STACK.md`.
7. Scripts: `dev:back`, `dev:front`, `dev:legacy`, `dev` = back + legacy (depois back + front).

**Pronto quando:** `npm run dev` e login iguais a hoje; árvore `front/`, `back/`, `motor/` visível; `npm test` nos motores de viagens verde.

---

### Fase 1 — Backend em camadas (≈2–4 semanas, paralelo)

**Meta:** `back/index.js` vira bootstrap; domínios em `routes/` + `repositories/`; **nenhum arquivo “escroto”** acima dos limites da tabela de tamanho.

Ordem sugerida (cada uma = 1 PR testável):

1. `middleware/auth.js` + `routes/health.js`
2. `routes/auth.js` (login/logout/me)
3. `routes/trips.js` (já existe lógica — **extrair** de `index.js` se ainda inline)
4. `routes/expenses.js`, `gains.js`, … (um domínio por PR)

**Padrão (copiar de `meu-mundo/server`):**

- Route: valida body, chama service/repository, mapeia status HTTP.
- Repository: só SQL.
- Service: regras que precisam de várias queries (opcional no início).

**Pronto quando:** `index.js` < ~400 linhas e testes de integração leves em auth + trips.

---

### Fase 2 — Scaffold React + design system mínimo (≈1–2 semanas)

**Meta:** `front/` logado, **componentes base**, shell **Meu Mundo**, frentes com **páginas placeholder** (1 arquivo por tela).

1. `front/` com Vite + React + TypeScript.
2. Criar **`components/ui`**: `Button`, `Input`, `Card`, `Badge` (usados em todo o app novo).
3. Criar **`components/layout`**: `AppShell`, `Sidebar` (grupos Dinheiro / Viagens).
4. `frentes/dinheiro/routes.tsx` + `pages/*Placeholder*.tsx` (cada uma &lt; 80 linhas).
5. `frentes/viagens/routes.tsx` + placeholder Atlas.
6. `AuthProvider` + `LoginPage` em `frentes/auth/` ou `app/`.
7. Dev: `dev:front` + `dev:back` (proxy `/api`).

**Pronto quando:** login React, menu, 7 placeholders de dinheiro + 1 viagens; **zero arquivo &gt; 200 linhas** no scaffold.

---

### Fase 3 — Piloto vertical: Viagens (≈2–3 semanas)

**Por que primeiro:** API e `motor/viagens` (hoje `shared/trips`) já no portal; UI React **já escrita** em `meu-mundo` (portar/adaptar, não redesenhar).

1. Portar `meu-mundo/client/src/features/viagens/*` → `front/src/frentes/viagens/` **fatiado** (não um único TSX gigante).
2. Mapear cada seção da ficha para `sections/*.tsx` + `components/*.tsx`.
3. `api/trips.ts` fino; hooks `useTripDraft`, `useTripPersist`.
4. Tema: tokens em `styles/tokens/viagens.css` + `components/ui`.
5. Feature flag no legado ou rota só `dev:front`.

**Pronto quando:** casa + ficha + autosave + simulador com paridade de aceite `2026-11-16-viagens-acceptance.md`.

---

### Fase 4 — Dinheiro, módulo a módulo (≈2–4 meses)

**Ordem do menor risco ao maior:**

1. Dashboard (leitura, gráficos Chart.js → componente React)
2. Cofrinhos / Dívidas (superfície menor que entradas/saídas)
3. Carteira, Planejamento (zero-budget)
4. **Entradas / Saídas por último** — **pré-requisito:** quebrar `legacy-web/.../transactions.js` em módulos nomeados *antes* de portar para `frentes/dinheiro/`.

Para cada módulo:

- 1 **página** React + N **componentes** + modais em arquivos separados.
- Regras em `motor/dinheiro/`; `back/` só expõe HTTP.
- Manter legado até paridade manual + testes.
- PR rejeitado se qualquer arquivo novo passar do limite de linhas sem justificativa.

---

### Fase 5 — Cutover e limpeza

1. Default em produção: build de `front/` em `dist/`.
2. `legacy-web/` só redireciona ou remove.
3. Admin: React ou manter estático até decisão.
4. Renomear pacote npm `meu-mundo`, atualizar deploy (Railway serve `dist` + API).

---

## O que fazer **primeiro** (próximos 2–3 PRs concretos)

| # | Entrega | Valor |
|---|---------|--------|
| **1** | Fase 0: `front/` + `back/` + `legacy-web/` + scripts | Dois sistemas visíveis no repo |
| **2** | Extrair `back/routes/trips` + `auth` do monólito | Back fino por frente |
| **3** | `front/` scaffold: `components/ui` + `AppShell` + placeholders | Design system + telas pequenas |

Só depois: port Viagens (Fase 3). **Não** começar por `transactions.js`.

---

## Decisões técnicas sugeridas

| Tópico | Escolha |
|--------|---------|
| UI | React 19 + TypeScript |
| Rotas | React Router 7; prefixos por frente (`/dinheiro/*`, `/viagens/*`) |
| Componentes | `components/ui` + `components/layout` + `frentes/*/components` |
| Nomenclatura pastas | **`front/`** e **`back/`** (não misturar com `js/` no app novo) |
| Dados remotos | TanStack Query (ou fetch + context no início) |
| Estado local | Component state; evitar Redux no v1 |
| Estilo | CSS modules + tokens existentes; depois considerar nada novo |
| Testes | `node --test` em `motor/`; Vitest no `front/` quando estável |
| API | REST atual; OpenAPI opcional na Fase 1 |

---

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Regressão financeira | Último módulo a migrar; testes em `motor/`; comparação lado a lado |
| Dois UIs divergentes | Um módulo “done” = desliga rota no legado |
| Sessão cross-origin | Mesmo origin em dev (proxy Vite); prod: um host |
| Escopo infinito | Critério de done por feature = checklist de aceite |
| Arquivos gigantes de novo | Limites de linhas + split obrigatório em review |

---

## Relação com o doc de 2026-05-20

Aquele plano priorizava **vanilla modular** e React opcional. Este documento **substitui essa direção para o front**: React é o destino, mas **mantém** a ideia de **`back/` modular** e **`motor/`** testável.

---

## Próximo passo humano

1. Revisar este plano (fases e ordem Viagens → Dinheiro).
2. Aprovar Fase 0 + Fase 2 scaffold (ou só Fase 0 se quiser estabilizar back antes).
3. Abrir issue/PR 1: “mover legacy-web + scripts”.

Quando aprovado, executar com skill **executing-plans** ou PRs incrementais (não uma branch gigante).