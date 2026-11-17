# Meu Mundo — Stack e convenções

> Migração em andamento: ver [plans/2026-11-16-react-layered-migration.md](superpowers/plans/2026-11-16-react-layered-migration.md).

Documento de referência para alinhar outro projeto à mesma stack antes de integrar repositórios ou features.

## Visão geral

| Aspecto | Escolha |
|--------|---------|
| **Arquitetura** | Monólito: front + API no **mesmo repositório** |
| **Runtime** | **Node.js** com **`"type": "module"`** (ESM em todo lugar) |
| **Front** | **React 19** (`front/`, padrão em prod) + legado vanilla (`legacy-web/`, referência/back) |
| **Back** | **Express 4** |
| **Banco (runtime)** | **PostgreSQL** via driver **`pg`** (SQL parametrizado, pool) |
| **ORM** | **Não usa Prisma Client** — pasta `prisma/` com schema legado + migrations **`.sql`** (scripts `npm run db:*`) |
| **Build front** | **Vite 7** (dev server + `vite build` → `dist/`) |
| **Auth** | **Sessão HTTP** (`express-session` + **cookie**); front usa `fetch` com `credentials: 'include'` |
| **Hash de senha** | **bcryptjs** |

> **Nota:** `prisma/schema.prisma` ainda declara `provider = "sqlserver"` (legado/migração). O código em produção usa **Postgres** (`server/db.js`). Alinhe novos trabalhos em **PostgreSQL**, não SQL Server.

---

## Frontend

| Item | Detalhe |
|------|---------|
| Entrada React | `front/index.html` → `src/main.tsx` |
| Legado | `legacy-web/index.html` + `js/app/main.js` |
| Estado | `AppState` em `js/app/main.js` (também `window.AppState`) |
| Shell / navegação | `js/shell/app-shell.js` |
| CSS | `css/` — tokens (`color-tokens.css`), layout, `theme-dark.css`, páginas em `css/pages/` |
| Tipografia | Google Fonts **Poppins** |
| Ícones | **Font Awesome 6** (CDN) |
| Gráficos | **Chart.js 4.4.4** + treemap (CDN) |
| Cliente HTTP | `js/api-client.js` — dev: URLs relativas `/api` (proxy Vite); prod: `VITE_API_URL` opcional |
| Camada de dados | `js/services/firestore.js` (nome legado) — REST, **não** Firebase |

O app principal em produção é **React** (`MEU_MUNDO_FRONT=react`). `legacy-web/` permanece para comparação e imports do `back/` até cutover completo — ver [REACT_CUTOVER_CHECKLIST.md](REACT_CUTOVER_CHECKLIST.md).

---

## Backend

| Item | Detalhe |
|------|---------|
| Entrada | `back/index.js` (shim `server/index.js`) — rotas REST sob `/api/*` |
| Domínios (exemplos) | `household.js`, `expense-splits.js`, `zero-budget.js`, `cofrinho-allocation.js`, `balance-ledger.js`, … |
| Uploads | **multer** → `data/uploads/` |
| CORS | localhost + `CORS_ORIGINS` / `FRONTEND_URL` |
| Admin | `admin/` (HTML/CSS/JS estático) |
| Hub Life OS | `LIFE_OS_URL` |

**Dependências principais:** `express`, `express-session`, `cors`, `dotenv`, `bcryptjs`, `pg`, `multer`, `vite`.

**Legado (migração):** `mssql` — só scripts de restore/export SQL Server.

---

## Banco de dados

- **Driver:** `pg` + `DATABASE_URL`
- **Migrations:** `prisma/migrations/**/migration_pg.sql` e `scripts/pg-migrate-*.mjs`
- **Transações:** `withTransaction` em `server/db.js`
- **Backup admin:** `pg_dump` (Railway: `nixpacks.toml` com pacote `postgresql`)

---

## Desenvolvimento local

```bash
npm install
# .env na raiz: DATABASE_URL, SESSION_SECRET, PORT (opcional), etc.
npm run dev          # API + React (front/) via dev.mjs
npm run dev:legacy   # só legado vanilla (5173)
npm run dev:front    # React (5174) + dev:back
npm run build        # legado → dist/
npm run build:front  # React → front/dist/
npm run build:prod   # alias build:front
npm run start        # API; `MEU_MUNDO_FRONT=react` serve front/dist
npm test         # node --test (tests/*.test.js)
```

- **Dev:** `scripts/dev.mjs` + `npm run dev:app` (`concurrently`: `dev:back` + `dev:front`)
- **Proxy:** `vite.config.js` — `/api` e `/uploads` → `http://localhost:${PORT}`
- **Porta:** `PORT` no env; Vite usa o mesmo valor via `dev.mjs`

---

## Deploy

- **API:** Railway (ou similar) — Express serve API + `dist/` + `/admin`
- **Front em outro host:** Vercel + `VITE_API_URL`; sessão cross-site: cookie `Secure` + `SameSite=None` (server já trata com CORS extra)
- **Health:** `GET /api/health`

---

## Estrutura de pastas (alvo)

```
meu-mundo/
├── front/              # React + Vite
├── back/               # API Express
├── motor/              # regras (viagens/, dinheiro/)
├── legacy-web/         # vanilla (strangler)
├── server/             # shim → back/
├── platform/           # admin, data, docs, prisma, scripts, tests, public
├── vite.config.js
└── package.json
```

---

## Convenções para juntar projetos

1. **Monólito** — front + API no mesmo repo; sem microserviços nesta fase.
2. **Front:** ES modules; novas telas = DOM + `navigateTo` + módulo em `js/features/`.
3. **Regras de negócio** em `js/core/`; UI chama API.
4. **API:** JSON em `/api`, `requireAuth` nas rotas protegidas, sessão por cookie.
5. **Schema:** Postgres + SQL no server; migrations em `prisma/migrations/.../migration_pg.sql`.
6. **Visual:** `css/color-tokens.css`, `layout.css`, dark mode `data-theme` + `theme-dark.css`.
7. **Evitar no core:** React, Prisma Client como ORM principal, Firebase, outro banco sem migração para Postgres.

---

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres (obrigatório) |
| `SESSION_SECRET` | Sessão (obrigatório em produção) |
| `PORT` / `HOST` | API |
| `CORS_ORIGINS` / `FRONTEND_URL` | CORS cross-origin |
| `VITE_API_URL` | API em outro domínio no build do front |
| `LIFE_OS_URL` | Integração Life OS |
| `NODE_ENV` | Produção vs desenvolvimento |
| `MSSQL_*` | Apenas scripts de migração SQL Server |

Nunca commitar `.env` com credenciais reais.

---

## Checklist de alinhamento

- [ ] Node + ESM (`"type": "module"`)
- [ ] HTML + CSS modular + JS modules (sem React no core)
- [ ] Vite para dev/build
- [ ] Express + sessão cookie + bcrypt
- [ ] PostgreSQL + `pg`
- [ ] Migrations `.sql` no padrão do repo
- [ ] `fetch(..., { credentials: 'include' })`
- [ ] `js/features/` + `js/core/` + rotas Express

---

## Referências no repo

- Arquitetura e fases: `docs/superpowers/specs/2026-05-20-architecture-modernization-design.md`
- Nome npm: `meu-malote` (`package.json`)
