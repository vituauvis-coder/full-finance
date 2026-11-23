# API do agente Meu Mundo

Integração para bots (assistente «Meu Mundo») via **API Express** com token Bearer — mesmas regras de validação do app (conta na casa, `reference_only`, recorrência, `balance_snapshots`).

## URL base

| Ambiente | Base |
|----------|------|
| Produção | Defina `VITE_API_URL` / host do deploy (ex.: `https://seu-dominio.com`) |
| Local | `http://localhost:3001` (porta padrão do back) |

Todas as rotas abaixo são prefixadas com `/api`.

## Autenticação

1. Faça login no app (sessão por cookie).
2. Em **Perfil → Tokens do agente**, crie um token **ou**:

```bash
curl -s -b cookies.txt -c cookies.txt -X POST 'http://localhost:3001/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"voce@email.com","password":"..."}'

curl -s -b cookies.txt -X POST 'http://localhost:3001/api/agent-tokens' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Meu assistente","scopes":["finance:read","finance:write"]}'
```

Resposta (guarde `token` — **não aparece de novo**):

```json
{
  "token": "mm_agent_xxxxxxxx",
  "tokenMeta": { "id": "...", "name": "Meu assistente", "scopes": ["finance:read","finance:write"], "createdAt": "..." },
  "warning": "Guarde o token agora; ele não será exibido novamente."
}
```

3. Use nas chamadas:

```http
Authorization: Bearer mm_agent_...
```

Escopos:

- `finance:read` — listar contas, categorias, saídas e entradas
- `finance:write` — criar, alterar e excluir saídas/entradas

Outras rotas com token de agente retornam **403**. Rate limit: **120 req/min** por token.

### Revogar

```bash
curl -s -b cookies.txt -X DELETE "http://localhost:3001/api/agent-tokens/<id>"
```

## Rotas

### `GET /api/accounts`

```bash
curl -s -H "Authorization: Bearer mm_agent_..." \
  'http://localhost:3001/api/accounts'
```

```json
[
  {
    "id": "uuid",
    "name": "Nubank",
    "type": "conta_corrente",
    "isPrimaryCash": true,
    "linkedAccountId": null
  }
]
```

### `GET /api/categories?type=EXPENSE|GAIN`

```bash
curl -s -H "Authorization: Bearer mm_agent_..." \
  'http://localhost:3001/api/categories?type=EXPENSE'
```

Array de categorias com `subcategories` embutidas (mesmo formato do app).

### `GET /api/expenses?from=&to=` (opcional)

ISO 8601 em `from` / `to`. Limite 500 registros.

```bash
curl -s -H "Authorization: Bearer mm_agent_..." \
  'http://localhost:3001/api/expenses?from=2025-11-01T00:00:00.000Z&to=2025-11-30T23:59:59.999Z'
```

### `GET /api/gains?from=&to=`

Igual às saídas, para checagem de duplicidade.

### `POST /api/expenses`

Corpo (data pode ser `YYYY-MM-DD` ou `{ "seconds": unix }`):

```bash
curl -s -X POST -H "Authorization: Bearer mm_agent_..." \
  -H 'Content-Type: application/json' \
  'http://localhost:3001/api/expenses' \
  -d '{
    "description": "iFood",
    "amount": 42.5,
    "accountId": "uuid-conta",
    "category": "Alimentação",
    "subcategory": "Delivery",
    "date": "2025-11-20",
    "isPaid": true,
    "externalRef": "whatsapp-msg-12345",
    "receiptUrl": "https://exemplo.com/comprovante.jpg"
  }'
```

- `externalRef` é único por usuário → **409** se repetir (idempotência).
- `source` gravado automaticamente como `agent`.

### `POST /api/gains`

Mesmo padrão; `isRecurring: true` cria série até dezembro (como o app).

### `PUT` / `PATCH` / `DELETE /api/expenses/:id`

`PUT` e `PATCH` têm o mesmo comportamento (corpo completo).

### `PUT` / `PATCH` / `DELETE /api/gains/:id`

Idem entradas.

## Migração de banco

```bash
# idempotente no boot do servidor, ou:
psql "$DATABASE_URL" -f platform/prisma/migrations/20261123140000_agent_integration/migration_pg.sql
```

Tabelas/colunas novas: `agent_tokens`; em `expenses`/`gains`: `source`, `external_ref`, `receipt_url`.