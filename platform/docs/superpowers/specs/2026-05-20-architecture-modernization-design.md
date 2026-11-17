# Modernização do monólito Meu Malote — design

**Data:** 2026-05-20  
**Status:** Aprovado em brainstorming (princípios + fases + segurança)  
**Objetivos:** A manutenção · B profissionalismo · C segurança · D escala futura

---

## Contexto (código atual)

- **Front:** HTML monolítico (`index.html` ~2,6k linhas) + ES modules; entrada `js/app/main.js`; estado global `AppState`.
- **Back:** Express em `server/index.js` (~4,2k linhas) + módulos parciais (`cofrinho-allocation`, `zero-budget`, `expense-splits`).
- **Dados:** PostgreSQL via `pg` (SQL direto); Prisma só schema/migrations (provider legado `sqlserver` no schema).
- **Legado:** nomes Firestore, datas “firestore-like”, `GET /api/data` carrega bundle completo.
- **Arquivos críticos:** `js/features/finance/transactions.js` (~7,1k linhas).

**Conclusão:** monólito é adequado; problema é **fronteiras e tamanho de arquivos**, não falta de microserviços ou React.

---

## Princípios

1. Uma mudança por PR — app permanece funcional a cada merge.
2. Regras de negócio em `js/core/` (testadas); UI renderiza e chama API.
3. Servidor: rotas finas em `server/routes/`, lógica em módulos de domínio.
4. Renomear legado incrementalmente (`firestore.js` → `data-api.js`).
5. Escala futura: fatiar `/api/data` quando necessário; não é urgência com poucos usuários.
6. React não define maturidade; consistência, testes e limites de arquivo definem.

---

## Abordagem escolhida

**Monólito modular incremental** (não rewrite React, não microserviços).

Alternativas descartadas para esta fase:

- **Rewrite React:** alto custo, regressões em regras financeiras, pior manutenção no curto prazo.
- **Microserviços:** overengineering para produto pessoal / equipe pequena.

React permanece **opcional na Fase 4** (uma tela piloto), só se vanilla modular não bastar.

---

## Fases

### Fase 0 — Fundação (1–2 semanas) · A + C

| Entrega | Detalhe |
|---------|---------|
| Testes | Vitest em `js/core/`: `cash-balance`, `split-net`, `credit-installments`, `zero-budget-calculator` |
| Lint | ESLint em `js/` e `server/` (regras mínimas) |
| Segurança mínima | `SESSION_SECRET` obrigatório em produção; rate limit em login/register; `helmet` |
| Scripts | `npm test`, `npm run lint` |

**Não fazer:** TypeScript em todo o repo, React, microserviços.

### Fase 1 — Servidor modular (2–3 semanas) · A + C

Estrutura alvo:

```
server/
  index.js              # bootstrap, middleware, mount routes
  middleware/auth.js    # requireAuth, requireAdmin, publicAuthUser
  routes/
    auth.js, data.js, expenses.js, gains.js, accounts.js,
    debts.js, profile.js, categories.js, admin.js, kanban.js
```

- Um domínio por PR.
- Helpers de validação de body onde houver repetição.
- Manter SQL parametrizado.

**Critério de pronto:** `index.js` < ~800 linhas.

### Fase 2 — Front por fronteiras (3–4 semanas) · A + B

Dividir `transactions.js` em módulos por tela/modal (expenses-list, gains-list, wallet, modais, `index.js` só wiring).

- Sem lógica nova inline em `index.html`.
- Renomear `firestore.js` → `data-api.js` (opcional alias de reexport).
- Tokens CSS e empty/loading states padronizados.

**Critério de pronto:** nenhum arquivo em `js/features/` > ~1.500 linhas.

### Fase 3 — Segurança (1–2 semanas) · C

Ver checklist abaixo.

### Fase 4 — Escala e polish (quando necessário) · D + B

- Fatiar `/api/data` ou sync incremental.
- React opcional em uma tela piloto.
- TypeScript opcional só em `js/core/`.

---

## Checklist de segurança (Fase 3)

| Área | Ação |
|------|------|
| Sessão | Secret forte obrigatório em prod; revisar `sameSite`/`secure` com deploy cross-origin (Vercel + Railway) |
| Auth | Rate limit login/register; senha mínima (já 6 — considerar 8+ depois) |
| HTTP | `helmet` (CSP progressiva se não quebrar CDN de Chart.js) |
| Postgres | SSL com verificação em produção (`rejectUnauthorized` adequado) |
| Admin | Auditar rotas `requireAdmin`; não expor dados de outros usuários |
| Uploads | MIME/size; paths sob `data/uploads` sem traversal |
| API bundle | `/api/data` nunca retorna `passwordHash` (manter `userSafe`) |
| Dependências | `npm audit` periódico |

---

## Primeiros 5 PRs (ordem sugerida)

1. **Vitest + testes `cash-balance` e `split-net`** — maior ROI, servidor já importa `cash-balance`.
2. **ESLint + scripts `test`/`lint`** — trava regressão óbvia.
3. **`SESSION_SECRET` obrigatório + rate limit auth + helmet** — endurecimento rápido.
4. **Extrair `server/routes/auth.js` + `middleware/auth.js`** — prova o padrão de modularização.
5. **Extrair `server/routes/debts.js`** — domínio menor, baixo risco.

Depois: `expenses`/`gains` no servidor; em paralelo ou sequência, começar split de `transactions.js` (expenses-list primeiro).

---

## Anti-patterns (não fazer)

- Microserviços, GraphQL, Redis, filas sem necessidade medida
- Rewrite total React/Next
- Prisma Client no runtime
- Design system grande antes de tokens CSS simples
- PRs que misturam refactor + feature nova

---

## Métricas de sucesso

- Arquivos críticos < 1.500 linhas
- Testes verdes nas regras de saldo/split/parcelas
- Nova rota encontrável em `server/routes/` em minutos
- 3+ telas com mesmo padrão de card, modal, empty, loading

---

## Fora de escopo (esta iniciativa)

- App mobile nativo
- Multi-tenant / billing
- Migração completa para Prisma Client
- Internacionalização
