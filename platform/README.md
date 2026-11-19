# platform — suporte ao monólito

Tudo que **não** é código de produto (`front`, `back`, `motor`, `legacy-web`) fica aqui.

| Pasta | Uso |
|--------|-----|
| `admin/` | Painel administrativo estático (`/admin`) |
| `data/` | Uploads locais (`data/uploads`); backups diários do dev em `data/backups/daily/` (gitignored) |
| `docs/` | Documentação do projeto |
| `prisma/` | Schema legado + migrations SQL Postgres |
| `scripts/` | Dev, migrações, seeds, debug |
| `tests/` | `node --test` |
| `public/` | Assets estáticos do Vite (legado) |
| `archive/` | Previews HTML estáticos (`preview/`) e `env.sample` de referência |