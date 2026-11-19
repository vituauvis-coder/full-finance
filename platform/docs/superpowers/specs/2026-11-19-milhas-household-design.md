# Milhas compartilhadas na household

Caso real: **Esfera única** no mundo (e-mail da Millena), **dois logins** no Meu Mundo. Hoje cada login tem sua própria carteira Esfera e saldos duplicados sem sincronia.

Complementa `2026-11-16-central-pontos-milhas-design.md` e `2026-11-19-viagens-milhas-hub-design.md`.

## Objetivo

Carteiras marcadas como **da casa** ficam visíveis para todos os membros da mesma `household`, com **um saldo** e **um extrato**. Lançamentos identificam quem registrou.

## Modelo mental (igual Dinheiro)

| Campo | Papel |
|-------|--------|
| `household_id` | Casa que enxerga a carteira |
| `user_id` | Dono técnico do registro (criador / conta que migrou) |
| `holder_user_id` | Titular “de verdade” (ex.: Millena na Esfera) |
| Carteira pessoal | `household_id` nulo — só o `user_id` dono vê |

## Escopo v1

- Marcar/desmarcar carteira como **Compartilhada com a casa** na edição.
- Escolher **titular** (membros da household).
- Listar programas e movimentos da casa para qualquer membro logado.
- Lançar/transferir em carteira compartilhada (ambos logins).
- **Uma** Esfera por household (índice único `household_id + brand`).
- Assistente de **fusão** quando os dois já têm Esfera (fase 1.5).

Fora do v1: convite de não-membro, permissões por papel (só leitura), taxas de conversão compartilhadas (ficam no dono até etapa 2).

## Schema

Migration `platform/prisma/migrations/20261119180000_miles_household/migration_pg.sql`:

```sql
ALTER TABLE miles_programs
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS holder_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS miles_programs_household_brand_uidx
    ON miles_programs (household_id, brand)
    WHERE household_id IS NOT NULL AND brand <> 'outro';

CREATE INDEX IF NOT EXISTS miles_programs_household_idx ON miles_programs (household_id);
```

Índice antigo `miles_programs_user_brand_uidx` permanece para carteiras **pessoais** (`household_id IS NULL`).

### Movimentos

Sem mudança de tabela. `miles_movements.user_id` = quem **registrou**; `program_id` aponta para programa compartilhado.

Leitura: movimentos de programas visíveis ao usuário (pessoais + household).

## API / repositório

- `listProgramsVisible(userId)` — `user_id = $uid` OR `household_id IN (households do usuário)`.
- `assertProgramAccess(userId, programId)` — membro da household ou dono pessoal.
- `listMovements(userId, filter)` — filtra por programas visíveis, não só `user_id = sessão`.
- `listRates` v1: mantém por `user_id` do criador; taxas sugeridas do catálogo continuam.
- `PATCH /api/miles/programs/:id` aceita `householdShared: boolean`, `holderUserId: uuid | null`.
  - Ao compartilhar: `ensureHouseholdForUser`, grava `household_id`, default `holder_user_id` = sessão se vazio.
  - Ao descompartilhar: zera `household_id` e `holder_user_id`.

## UI

- Editor de carteira: toggle **Compartilhada com a casa** + select **Titular**.
- Rail / hero: chip `Casa` ou nome do titular; Esfera compartilhada mostra “Titular: Millena”.
- KPI global: sem duplicar saldo se um membro ainda tiver Esfera pessoal órfã (alerta na fusão).

## Fusão Esfera duplicada (v1.5)

Quando household tem 2+ Esfera (uma por login):

1. API `POST /api/miles/programs/merge-household` (ou fluxo guiado na UI).
2. Escolher **carteira canônica** (sugestão: a que já está compartilhada ou maior extrato).
3. Reapontar movimentos da descartada → canônica; marcar canônica como `household_id`; arquivar/deletar a outra.
4. Não somar saldos automaticamente (risco de dobrar) — opção “importar só ajuste de diferença”.

## Critérios de aceite

1. Millena compartilha Esfera; Victor no login dele vê a mesma carteira e saldo.
2. Victor lança compra; Millena vê no extrato com indicação de quem lançou (e-mail/nome).
3. Cada um mantém Smiles/LATAM **pessoais** sem `household_id`.
4. Segunda Esfera na mesma household (marca oficial) é bloqueada pelo índice único.
5. Testes de acesso: membro de outra household não acessa programa por id.

## Referência

- Household: `back/household.js` (`ensureHouseholdForUser`, `fetchHouseholdMembers`).