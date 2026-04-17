# Estrutura de pastas (front-end)

## Camadas

| Pasta | Função |
|--------|--------|
| **`app/`** | Entrada da aplicação (`main.js` — bootstrap, estado global, roteamento de dados por página). |
| **`core/`** | Utilitários puros sem DOM de feature (ex.: `utils.js` — moeda, datas, contas). |
| **`shared/`** | Componentes e helpers reutilizáveis entre features (paginação, ordenação de tabelas, drawer de filtros, notificações do cabeçalho). |
| **`services/`** | Camada de dados / API do cliente (ex.: `firestore.js` — fetch agregado e mutações via `api-client`). |
| **`shell/`** | Carcaça do app: autenticação (`auth.js`), tema (`theme.js`), navegação e modais globais (`app-shell.js`). |
| **`features/`** | Uma pasta por domínio de tela/negócio; cada área expõe módulos coesos (`dashboard/`, `reports/`, `investments/`, `profile/`, `tools/`, `support/`, `mascots/`, etc.). |
| **`ui.js/`** | Apenas **reexportações** legadas (`utils.js` → `core/`, `table-*` → `shared/`, …) para não quebrar imports antigos. O bootstrap real é `app/main.js`. |

## Features atuais

- **`features/finance/`** — Despesas, ganhos, contas, cartões, contas a pagar, categorias (`expense-categories.js`, `gain-categories.js`), modal de compras no cartão (`transactions.js` + `index.js`).
- **`features/goals/`** — Objetivos (`goals.js` + `index.js`).

## Convenções

1. Novos módulos de negócio → `features/<nome>/` com `index.js` exportando só o necessário ao restante do app.
2. Componentes usados em mais de uma feature → `shared/`.
3. Funções sem dependência de tela → `core/`.
4. Chamadas HTTP agregadas e persistência → `services/`.
5. O HTML deve carregar **`js/app/main.js`** como único entry ES module (mascotes em `features/mascots/mascots.js` são um script separado na tela de login).

## API HTTP

`js/api-client.js` permanece na raiz de `js/` (cliente fetch da API local).

## Administradores (`/admin`)

Quem pode acessar `/api/admin/*` e o painel `admin/` é definido pela coluna **`User.role`** no banco (`USER` ou `ADMIN`), não por lista de e-mails no código. O login e `/api/auth/me` devolvem `role` e `isAdmin` para o front decidir (link “Painel Admin”, etc.). Promover/rebaixar usuários: `PATCH /api/admin/users/:id/role` com `{ "role": "ADMIN" | "USER" }` (requer sessão de admin).
