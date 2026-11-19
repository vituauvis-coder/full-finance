# Viagens · Milhas hub (layout A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor a gestão global de milhas em `/viagens/milhas` com menu Viagens em grupo (layout A) reutilizando `PontosHubPage` e calculadoras existentes.

**Architecture:** Sidebar group + rota top-level sob `viagens`; página adaptada de `PontosHubPage` sem emissões por viagem; KPI via dashboard API; Voos mantém consumo por trip.

**Tech Stack:** React 18, react-router-dom, API `/api/miles`, CSS `pontos-central.css`, motor `@motor/milhas/*`.

## Global Constraints

- Fonte de carteira: Postgres via `/api/miles`, não `viagensMiles` no perfil.
- Emissões (`miles_emission_sims`) só com `trip_id` — UI lista permanece em Voos.
- Copiar padrões de `SidebarNavGroup` / `SIDEBAR_GROUPS` (Dinheiro).
- Sem commit neste plano salvo pedido explícito do usuário.

---

### Task 1: Sidebar — grupo Viagens

**Files:**
- Modify: `front/src/frentes/shell/config/sidebarNav.ts`
- Modify: `front/src/frentes/shell/hooks/useSidebarNavState.ts`
- Modify: `front/src/frentes/shell/components/AppSidebar.tsx`

**Interfaces:**
- Produces: `SIDEBAR_VIAGENS_GROUP` com `items: [{ to: '/viagens', page, icon, label }, { to: '/viagens/milhas', ... }]`
- Consumes: `SidebarNavGroup` unchanged API

- [ ] Generalizar `SidebarGroupConfig['id']` para `'dinheiro' | 'viagens'`.
- [ ] Adicionar `SIDEBAR_VIAGENS_GROUP` em `SIDEBAR_GROUPS` (ou array separado mapeado junto com Dinheiro).
- [ ] Remover leaf `SIDEBAR_VIAGENS` de `AppSidebar`; renderizar segundo grupo.
- [ ] `useSidebarNavState`: `viagens: true` no estado inicial; incluir `leafPageIds` para milhas.
- [ ] Verificar sidebar colapsada / `SidebarNavLink` `end` no item atlas.

**Test manual:** abrir app; Viagens expande; cliques em Viagens e Milhas navegam corretamente.

---

### Task 2: Rotas e page id

**Files:**
- Modify: `front/src/frentes/viagens/routes.tsx`
- Modify: `front/src/legacy/routeMap.ts`
- Modify: `front/src/components/layout/LegacyAppHeader.tsx` (título Milhas se necessário)

- [ ] Rota `path="milhas"` **antes** de `:tripId` para não capturar `tripId=milhas`.
- [ ] `legacyPageIdFromPath`: `/viagens/milhas` → `viagens-milhas` (ou tratar header).
- [ ] Entrada em `legacyPageMeta` com título "Milhas", mesma `headerClass` viagens.

---

### Task 3: `MilhasHubPage`

**Files:**
- Create: `front/src/frentes/viagens/pages/MilhasHubPage.tsx`
- Modify: `front/src/frentes/viagens/pages/pontos/PontosHubPage.tsx` (opcional: extrair `MilhasHubCore` compartilhado)

- [ ] Copiar corpo de `PontosHubPage`: rail, hero, lançar, transferir, extrato.
- [ ] `load()`: `fetchMilesDashboard()` sem `tripId`; não chamar `fetchEmissions`.
- [ ] Remover seção "Nesta viagem · Emissões" e `useParams` tripId.
- [ ] Importar `../styles/pontos-central.css` na página ou layout pai.
- [ ] KPI strip no topo (agregar programs do dashboard).

---

### Task 4: Calculadoras inline (layout A)

**Files:**
- Create: `front/src/frentes/viagens/components/milhas/MilhasCalculadorasPanel.tsx` (ou inline na página)
- Reuse: `FlightMilesBlock`, `compareCashVsPoints` de motor, `PontosFields`

- [ ] Grid 2 colunas: cash vs pts + emissão (mesmo conteúdo do mockup / `MilesCalculatorPop` sem scrim).
- [ ] Histórico local opcional: reutilizar `miles-calc-saves` sem `tripId` (prefixo global).

---

### Task 5: Voos — link para hub

**Files:**
- Modify: `front/src/frentes/viagens/components/voos/VoosResumo.tsx`

- [ ] Link/botão "Central de milhas" → `/viagens/milhas`.

---

### Task 6: Verificação

- [ ] `npm test` ou suite em `platform/tests/motor/milhas` se houver script no README.
- [ ] Smoke: criar carteira, lançar, transferir na nova rota; voos ainda mostra gaps.

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| Menu opção A | 1 |
| `/viagens/milhas` | 2, 3 |
| Layout A hub | 3, 4 |
| Sem emissões na conta | 3 |
| Calculadoras duplas | 4 |
| Voos intacto + link | 5 |
| Testes motor | 6 |