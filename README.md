# Meu Mundo

Monólito: React + API Express + motor de regras + app legado (strangler).

## Raiz do repositório

| Pasta / arquivo | Papel |
|-----------------|--------|
| **`front/`** | App React (Vite) |
| **`back/`** | API Express |
| **`motor/`** | Regras puras (viagens, dinheiro) |
| **`legacy-web/`** | App vanilla em migração |
| **`server/`** | Shim de entrada → `back/` (compatibilidade) |
| **`platform/`** | Admin, dados, docs, prisma, scripts, testes, public |
| `package.json` | Scripts npm e dependências |
| `vite.config.js` | Build/dev do legado |
| `nixpacks.toml` | Deploy (Railway) |

Documentação: `platform/docs/STACK.md`

## Comandos

```bash
npm install
npm run dev          # API + legado (Vite)
npm run dev:front    # React (5174)
npm run build:front  # produção (React → front/dist)
npm start            # API + front em produção
npm test
```