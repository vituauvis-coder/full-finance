# Padrões de qualidade — `front/`

Referência para PRs e revisões. **Checklist obrigatório** ao alterar uma frente.

## Camadas (por frente, ex. `frentes/dashboard/`, `frentes/shell/`)

| Camada | Pasta | Responsabilidade |
|--------|--------|------------------|
| Página | `pages/` | Composição, estado de rota, wiring de providers já existentes |
| UI | `components/` | JSX, acessibilidade, classes CSS; sem regra de negócio |
| Estado | `context/`, `hooks/` | Estado React, efeitos, localStorage de UI |
| Domínio (app) | `domain/` | Orquestração TS: métricas, séries, formatação; chama `@motor` |
| API | `api/` | `fetch` / `apiFetch` e contratos HTTP |
| Tipos | `types/` | Tipos só da frente (DTOs de painel, props de domínio) |
| Estilo | `styles/` | CSS escopado à frente |

## Motor (`@motor/*`)

- Regra de negócio **pura** (sem React, sem DOM, sem `fetch`) → `motor/<domínio>/`.
- O front importa via alias `@motor/dinheiro/...` e pode ter **adaptadores finos** em `lib/` (tipos TS).
- Novas regras: módulo no motor + teste em `platform/tests/motor/`.

## `src/lib/`

- Utilitários **compartilhados** entre frentes (período civil, formatação, tipos globais).
- HTTP compartilhado: `profileHttp`, `periodBalance`; eventos globais: `profileEvents`; rótulo da sidebar: `sidebarProfileDisplay`.
- **Sem imports entre frentes** (`frentes/a` → `frentes/b`); o que duas frentes precisam vai para `lib/` ou `@motor/`.
- Não colocar aqui lógica que só pertence a uma tela — mover para `frentes/<x>/domain/`.

## Tamanho de arquivo

- **~250 linhas** por `.tsx` / `.ts` como alvo; **~400** como teto.
- Acima do teto: extrair `hooks/`, `utils`, subcomponentes ou `types/`.
- Um componente = uma responsabilidade visual ou um hook = um fluxo de dados.

## Comentários

- Evitar comentários que repetem o código.
- Manter só: invariantes não óbvios, restrições de produto, `eslint-disable` com motivo.

## React

- Dados globais: `FinanceDataProvider`, não duplicar fetch na página.
- Listas derivadas: `useMemo`; efeitos com cancelamento em séries assíncronas.
- Tipos exportados em `types/` ou junto ao domínio, não inline em 10 arquivos.

## Carregamento (skeleton)

- **Carregamento inicial de página** (fetch do provider ou equivalente): skeleton que imita o layout real — **não** `ScreenLoader` fullscreen no meio da página.
- Primitivos: `front/src/components/ui/Skeleton.tsx` + `skeleton.css`.
- Layouts compartilhados: `front/src/components/skeleton/` (ex.: `MovementsPageSkeleton`, `DashboardPageSkeleton`). Reutilize blocos existentes (timeline, grid de KPIs) antes de inventar markup novo.
- Envelope: `PageLoadingShell` com `aria-busy="true"` e rótulo acessível.
- **Spinner (`ScreenLoader`)** fica para: sessão/auth, rotas fullscreen sem skeleton, botões (`BusyButton`), blocos inline pequenos.
- Troca de rota no shell: `RouteTransitionVeil` em `ScreenSwap` (mesmo layout que o skeleton da página destino).
- Nova tela com fetch: criar ou estender um skeleton na mesma PR; se o layout for igual a outra página, reutilize o skeleton existente.
- Duração mínima: `SKELETON_MIN_MS` (1s) em `lib/skeletonTiming.ts` — `useSkeletonMinDuration(loading)` na página e `ScreenSwap` na navegação. Respeitar `prefers-reduced-motion`.
- **Sem cores semânticas** no placeholder (verde entradas, vermelho saídas, acentos de timeline): só cinza / tokens `dash-*` e shimmer.

## CSS

- Tokens e superfícies da dashboard: `frentes/dashboard/styles/`.
- Menu lateral React: `frentes/shell/styles/` (ver [SHELL.md](./SHELL.md)).
- Perfil React: `frentes/perfil/styles/` + [PERFIL.md](./PERFIL.md); regras em `motor/conta/`.
- Listas Entradas/Saídas: `frentes/dinheiro/styles/movements-modern.css` + classe `movements-page--modern`.
- Dívidas: `legacy-web/css/pages/debts.css` + `frentes/dinheiro/styles/debts-page-spacing.css` + classe `debts-page--modern`.
- Não sobrescrever cores semânticas (ganhos/saídas/heatmap) sem alinhamento explícito.

## Verificação antes de merge

```bash
npm run build:front
npm test   # inclui testes do motor quando houver mudança em motor/
```

## Revisão de conformidade

Ao abrir ou revisar PR que mexe em `frentes/dashboard/`:

1. Regras novas estão no **motor**?
2. Imports respeitam **camadas** (página não importa `api` direto se já há domínio)?
3. Arquivos **&lt; 400** linhas?
4. Sem comentários **órfãos** / narrativos?

Detalhe das telas: [DASHBOARD.md](./DASHBOARD.md), [PERFIL.md](./PERFIL.md).