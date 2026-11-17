# Migração 100% React — tela a tela

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development ou executing-plans. Cada fase = PR mergeável; legado ainda disponível via `npm run dev:legacy` até a Fase 7.

**Goal:** Eliminar o bridge (`@legacy/js` + `window.AppState` + `load*Data` imperativo) e entregar todas as telas do produto só com React 19, TypeScript, hooks e componentes na pasta `front/`, reutilizando `motor/` e a API `back/` inalterada em contrato.

**Architecture:** Uma **frente** por domínio (`frentes/dinheiro`, `frentes/viagens`, `frentes/ferramentas`, `frentes/auth`). Cada tela = `pages/*Page.tsx` + `components/` + `hooks/` + `api/*.ts`. Regras puras em `@motor/*`; nada de importar `legacy-web/js` no `front/` após migração da tela. Design: classes CSS legadas podem ser reutilizadas temporariamente; objetivo final é tokens + componentes em `front/src/components/ui` e CSS por frente.

**Tech Stack:** React 19, React Router 7, Vite 7, TypeScript, Chart.js 4 (+ treemap se necessário), `fetch` + cookies, `motor/viagens` e `motor/dinheiro`.

## Global Constraints

- Limites de tamanho: página ~200 linhas, componente ~150, hook de rota ~150 (quebrar se passar).
- Cada PR: `npm test` verde; smoke manual da tela migrada + login.
- API: mesmos endpoints `/api/*`; não quebrar sessão cookie.
- Não reativar imports de `legacy-web/js` em novas telas (exceção: Fase 0-1 enquanto dashboard ainda em bridge).
- Commits/PRs por **uma tela** ou sub-tela (ex.: Saídas listagem vs modais).

---

## Estado atual (baseline)

| Rota React | Situação |
|------------|----------|
| `/login` | React + CSS legado |
| `/dinheiro/dashboard` | **Híbrido** — `DashboardMarkup` + `loadDashboardData` / `loadReportsData` |
| `/dinheiro/*` (resto) | Placeholder |
| `/viagens/*` | React UI; lógica espelhada do legado/meu-mundo |
| `/ferramentas` | Placeholder |
| `legacy-web` | App completo ainda referência de paridade |
| `/admin` | Estático em `platform/admin/` (fora deste plano) |

---

## Mapa legado → React

| `data-page` / seção HTML | Rota React | Módulo legado principal |
|--------------------------|------------|-------------------------|
| dashboard | `/dinheiro/dashboard` | `dashboard.js`, `reports.js` |
| gains | `/dinheiro/entradas` | `transactions.js` → `loadGainsData` |
| expenses | `/dinheiro/saidas` | `transactions.js` → `loadExpensesData` |
| zero-budget | `/dinheiro/planejamento` | `zero-budget.js` |
| wallet | `/dinheiro/carteira` | `transactions.js` → `loadWalletPage` |
| cofrinhos | `/dinheiro/cofrinhos` | `cofrinhos-page.js` |
| debts | `/dinheiro/dividas` | `debts-page.js` |
| viagens | `/viagens` | `viagens-*`, API `back/routes/trips` |
| tools | `/ferramentas` | `tools.js`, kanban API |
| profile | (futuro `/perfil`) | `profile.js` |
| support | oculto | baixa prioridade |

---

## Fase 0 — Fundação React (1 PR)

**Objetivo:** Camada compartilhada para todas as telas; começar a matar o bridge.

- [ ] **0.1** `front/src/lib/types/finance.ts` — tipos alinhados ao JSON de `/api/data` e movimentos.
- [ ] **0.2** `front/src/hooks/useFinanceData.ts` — `fetchFinanceData`, refresh, contexto `FinanceDataProvider` (substitui `AppState` no front).
- [ ] **0.3** `front/src/components/finance/CivilPeriodTimeline.tsx` — port do `civil-period-timeline.js` (props: month, year, onChange).
- [ ] **0.4** `front/src/components/finance/MovementSummaryCards.tsx` — props + cópias de `movement-summary-copy` como constantes TS.
- [ ] **0.5** `front/src/hooks/useChart.ts` — wrapper Chart.js (registro, destroy on unmount, tema dark).
- [ ] **0.6** Documentar em `front/README.md`: **proibido** `@legacy/js` em código novo; checklist de paridade por tela.

**Teste de saída:** Provider envolve `App`; dashboard ainda pode usar bridge neste PR.

---

## Fase 1 — Dashboard 100% React (1–2 PRs)

**Paridade:** timeline civil, 4+ cards resumo, filtros do header, gráfico fluxo mensal, heatmap caixa, “pagamentos a confirmar”, drawer categoria.

**PR 1.1 — Dados e cards**
- [ ] Portar lógica de totais de `reports.js` (só funções puras necessárias) para `front/src/frentes/dinheiro/dashboard/calc/` ou chamar funções já em `motor/dinheiro` (extrair se faltar).
- [ ] `DashboardPage.tsx` compõe `CivilPeriodTimeline` + `MovementSummaryCards` com hooks; remover `useLegacyDashboard`.
- [ ] Header: filtros facet em React (`DashboardFacetBar.tsx`), estado em URL ou `useSearchParams`.
- [ ] Deletar `DashboardMarkup.tsx` e imports `@legacy/js/.../dashboard` quando verde.

**PR 1.2 — Gráfico e heatmap**
- [ ] `FinancialProgressionChart.tsx` (Chart.js via `useChart`).
- [ ] `CashHeatmap.tsx` — port de `cash-heatmap.js` (calendar + painel dia).
- [ ] `PendingCashOutsList.tsx` — `POST /api/expenses/:id/confirm-cash-out` como no legado.
- [ ] Aceite: comparar mesmo mês/ano com legado (`npm run dev:legacy` lado a lado).

---

## Fase 2 — Entradas (1–2 PRs)

- [ ] **2.1** Markup + lista + paginação + filtros período (`GainsPage`, `GainsTable`).
- [ ] **2.2** Modais criar/editar/eliminar — `POST/PUT/DELETE /api/gains`, batch patch se usado.
- [ ] **2.3** Toolbar header (recebido/pendente, drawer filtros).
- [ ] Aceite: criar entrada, filtrar mês, marcar recebido.

---

## Fase 3 — Saídas (2–4 PRs — maior risco)

Dividir `transactions.js` mentalmente: listagem, parcelas, splits, modais, batch.

- [ ] **3.1** Lista + timeline + chips status (pago/pendente).
- [ ] **3.2** Linha com parcelas/cartão (usa `motor/dinheiro` + extrair de `credit-installments` para motor com testes).
- [ ] **3.3** Modais nova/editar saída; confirm cash-out.
- [ ] **3.4** Rateios (`expense-splits` API) se visível na lista.
- [ ] Aceite: espelhar checklist em `docs/superpowers/specs/` se existir para saídas.

---

## Fase 4 — Carteira (1–2 PRs)

- [ ] **4.1** Plásticos/cartões (`wallet-plastic` → componentes React + HTML/CSS existente).
- [ ] **4.2** Contas, saldos, atalhos criar cartão — `POST /api/accounts`.
- [ ] Aceite: abrir cartão, ver fatura ciclo cartão alinhada ao legado.

---

## Fase 5 — Cofrinhos e Dívidas (1 PR cada)

- [ ] **5.1** `CofrinhosPage` — buckets, metas, aplicações (`/api/data` + rotas cofrinho se houver).
- [ ] **5.2** `DividasPage` — lista dívidas + updates (`/api/debts`, `/api/debt-updates`).
- [ ] Aceite manual por tela.

---

## Fase 6 — Planejamento (orçamento zero) (1–2 PRs)

- [ ] Portar UI de `zero-budget-page` + `zero-budget.js`.
- [ ] Blocos, categorias, vínculo ganhos/despesas — API já em `back/zero-budget.js`.
- [ ] Aceite: criar bloco, ver totais do mês.

---

## Fase 7 — Viagens 100% React (1–2 PRs)

- [ ] Remover dependência de qualquer JS legado em viagens; opcional: mover simulador para hook + `motor/viagens`.
- [ ] Secções da ficha em `sections/*.tsx` (voos, destinos, hospedagem, orçamento).
- [ ] Autosave só em React (`useTripAutosave` já existe — completar paridade spec viagens).
- [ ] Aceite: `docs/superpowers/specs/2026-11-16-viagens-acceptance.md`.

---

## Fase 8 — Ferramentas / Kanban (1 PR)

- [ ] Board React: colunas, CRUD `/api/kanban-cards`.
- [ ] Paridade com `tools-page` legado (sem drag sofisticado no 1º PR se não existir no legado).

---

## Fase 9 — Shell, auth e perfil (1 PR)

- [ ] Login/registro 100% React (sem depender de `initAuthForms` legado).
- [ ] Sidebar/header em componentes TS (já próximo — remover `syncLegacyChrome` imperativo).
- [ ] Tema escuro via React context + `localStorage` (substituir `initThemeToggle` legado).
- [ ] (Opcional) `/perfil` — `profile.js`.

---

## Fase 10 — Cutover e remoção do legado (1 PR)

- [ ] `npm run dev` padrão = `dev:back` + `dev:front` (sem Vite legado).
- [ ] Produção: só `front/dist`; remover `legacy-web` do mount estático ou manter redirect 301 por 1 release.
- [ ] Apagar pasta `legacy-web/`, `vite.config.js` raiz, bridge `front/src/legacy/*`.
- [ ] Atualizar `platform/docs/STACK.md` e README raiz.
- [ ] Regressão completa checklist Dinheiro + Viagens.

---

## Ordem recomendada de execução

```text
Fase 0 → Fase 1 (dashboard) → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6
         → Fase 7 (paralelo após Fase 0 se outra pessoa) → Fase 8 → Fase 9 → Fase 10
```

**Primeiros 3 PRs sugeridos:**
1. Fase 0 (fundação + `FinanceDataProvider`)
2. Fase 1.1 (dashboard cards + timeline, sem gráfico)
3. Fase 1.2 (gráfico + heatmap; remove bridge do dashboard)

---

## Verificação contínua

| Comando | Quando |
|---------|--------|
| `npm test` | Todo PR |
| `npm run build:front` | Todo PR que toca `front/` |
| `npm run dev:front` + `PORT=3001` | Smoke da tela |
| Legado lado a lado | Até Fase 10: comparar números do mesmo período |

---

## Fora de escopo

- Reescrever `back/index.js` monolítico (plano separado de rotas).
- Migrar `platform/admin/` para React.
- Microserviços ou troca de banco.

---

## Referências

- Plano em camadas: [2026-11-16-react-layered-migration.md](./2026-11-16-react-layered-migration.md)
- Aceite viagens: `platform/docs/superpowers/specs/2026-11-16-viagens-acceptance.md`
- Rotas API: `back/routes/`, `back/index.js`