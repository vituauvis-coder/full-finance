# Cofrinho ↔ Viagem — ledger único (categoria/subcategoria)

**Data:** 2026-11-22  
**Status:** Aprovado para implementação  
**Relacionado:** `2026-11-19-orcamento-viagem-dinheiro-cartao-design.md`, `2026-11-21-viagens-household-shared-design.md`, `front/src/frentes/dinheiro/domain/cofrinhoConstants.ts`, `front/src/frentes/viagens/types.ts` (`paidFromCofrinho`)

## Problema

- Hoje existem **caixinhas** de cofrinho (subcategoria = nome da caixinha) e **viagens** com categoria **Viagens** + subcategoria = nome da viagem, sem elo estável com cofrinho.
- A caixinha que era **Aspiração** deve passar a representar reserva **para viagens**, com **uma caixinha por viagem** (mesmo nome).
- O usuário precisa de regras simples para três situações no extrato (Saídas) sem **duplicar** valor entre Cofrinhos, Viagens e orçamento da ficha.

## Objetivo

1. **Um movimento financeiro** por fato (aport or gasto); Cofrinhos e ficha Viagem **agregam** o mesmo `expense`.
2. Duas **categorias** no extrato cobrem tudo: **`Cofrinhos`** (aportes) e **`Viagens`** (gastos da viagem).
3. **Subcategoria** = sempre o **nome da viagem** quando `trip_id` estiver envolvido (não a palavra fixa “Viagens” no extrato).
4. Caixinha fixa **Aspiração** renomeada no produto para família **Viagens**: N caixinhas `kind=viagem`, cada uma com `trip_id`.

## Regra dos três tipos (Saídas)

| Tipo | Situação | Categoria | Subcategoria | Campos |
|------|----------|-----------|--------------|--------|
| **A** | Gasto da viagem (ex.: passaporte) | `Viagens` | Nome da viagem | `trip_id` |
| **B** | Aporte / guardar no cofrinho para a viagem | `Cofrinhos` | Nome da viagem | `trip_id`, `isCofrinho` (ou equivalente atual) |
| **C** | Gasto pago **com saldo do cofrinho** da viagem | `Viagens` | Nome da viagem | `trip_id`, `paid_from_cofrinho: true` |

**Proibições (evitar duplicidade e confusão):**

- **B** nunca usa categoria `Viagens`.
- **A** e **C** nunca usam categoria `Cofrinhos`.
- **C** não gera segundo débito de “saiu da conta” se o dinheiro já entrou via **B**; reduz saldo da **caixinha da viagem** e contabiliza gasto na viagem.

Outras caixinhas (fora viagem): **`Cofrinhos`** + subcategoria = nome da caixinha (**Longo prazo**, **Emergência**, etc.). **`Pool`** = subcategoria fixa `Pool` (pendente de distribuir — comportamento atual).

## Modelo de caixinha

```ts
type CofrinhoBucketKind = 'reserve' | 'viagem' | 'pool';

type CofrinhoBucket = {
  id: string;
  name: string;              // ex.: "Japão 2027" ou "Emergência"
  kind: CofrinhoBucketKind;
  tripId?: string | null;    // obrigatório quando kind === 'viagem'
  sortOrder?: number;
  // legado: colorKey, icon, goals...
};
```

- **`kind: 'viagem'`:** criada ao criar viagem (ou no primeiro aporte) com `name = trip.title` (normalizado) e `tripId`.
- UI Cofrinhos agrupa tiles sob rótulo **“Viagens”** (família); extrato usa **nome da viagem** como subcategoria.
- Migração: caixinha existente **Aspiração** → renomear família para **Viagens**; reservas antigas sem `trip_id` migram manualmente ou viram `reserve` genérico (decisão de dados na implementação).

## Fonte da verdade

| Evento | Canônico | Projeção |
|--------|----------|----------|
| Aporte (B) | `expenses` do usuário (`Cofrinhos` / nome viagem) | Saldo caixinha + lista aportes na ficha (`trip_id`) |
| Gasto (A) | `expenses` ou `TripExpense` + sync (ver spec cartão) | Orçamento viagem; **não** credita cofrinho |
| Gasto (C) | `expenses` (`Viagens`, `paid_from_cofrinho`) | Orçamento viagem + **débito** caixinha viagem |

`cofrinho_applications` continua para fluxo **Pool → caixinha** (distribuir pendente), referenciando mês/valor **sem** criar nova saída no extrato.

## Resolver (motor)

Função única usada por Cofrinhos, Pool, dashboard e agregação da viagem:

```text
resolveMovement(m):
  se m.category == 'Cofrinhos':
    se sub == 'Pool' → pool pendente
    senão → bucket por nome (e trip_id se kind viagem)
    → efeito: +saldo caixinha (B), ou pool (Pool)

  se m.category == 'Viagens' e m.trip_id:
  se m.paid_from_cofrinho:
    → gasto viagem (C) + −saldo caixinha viagem(trip_id)
  senão:
    → gasto viagem (A); comprometido cofrinho conforme Pix/cartão (spec cartão)
```

Índice: `trip_id` obrigatório sempre que subcategoria for nome de viagem cadastrada (validação ao salvar).

## Dados / schema (mínimo)

### `cofrinho_buckets` (ou payload atual)

- Adicionar `kind` (`reserve` | `viagem` | `pool`) e `trip_id` (UUID, FK `trips`, ON DELETE SET NULL ou CASCADE conforme produto).

### `expenses` (já parcialmente previsto)

- `trip_id`, `trip_expense_id` — spec orçamento.
- `paid_from_cofrinho` BOOLEAN DEFAULT false — alinhado a `TripExpense.paidFromCofrinho`.
- Manter `isCofrinho` / categoria `Cofrinhos` para **B**.

Nenhuma segunda linha “espelho” para o mesmo evento.

## UI

### Saídas

- Categoria **`Viagens`:** seletor de viagem → preenche subcategoria + `trip_id`; checkbox **“Pago do cofrinho da viagem”** (Tipo C).
- Categoria **`Cofrinhos`:** subcategoria = lista de caixinhas + caixinhas viagem (nome da viagem); Pool separado.
- **B:** atalho “Aportar para viagem” na ficha pode abrir formulário já em `Cofrinhos` + viagem escolhida.

### Cofrinhos

- Grupo **Viagens** (ex-Aspiração): cards por viagem (`trip_id`).
- Demais: Longo prazo, Emergência, Pool.

### Orçamento da viagem

- Lista unificada por `trip_id` (household): aportes (**B**), gastos (**A**/**C**), com autor (spec household).
- **C** exibido com chip “Cofrinho” (já existe em `ExpenseRow`).

## Migração

1. Adicionar colunas `kind`, `trip_id` em buckets.
2. Para cada `trip` ativo: `upsert` bucket `kind=viagem`, `name=trip.title`, `trip_id`.
3. Renomear / reclassificar bucket **Aspiração** → documentar como família **Viagens** na UI (dados legados sem `trip_id` tratados em script one-off).
4. Backfill: despesas `Viagens` + sub = título da viagem → `trip_id` quando único match.

## Fora de escopo (v1 deste spec)

- Compartilhar cofrinhos entre membros da household (finanças seguem por `user_id`).
- Tags extras (“aspiração” vs “férias”) além de `trip_id`.
- CRDT / merge de payload de viagem.

## Critérios de aceite

1. **B:** Uma saída `Cofrinhos` / `{viagem}` aumenta saldo da caixinha **e** aparece como aporte na ficha (mesmo `expense.id`).
2. **A:** Uma saída `Viagens` / `{viagem}` aparece no orçamento; **não** aumenta cofrinho.
3. **C:** Uma saída `Viagens` com “pago do cofrinho” reduz saldo da caixinha **e** conta no total gasto da viagem; **sem** segunda linha `Cofrinhos`.
4. Subcategoria no extrato **nunca** exige duplicar categoria Viagens vs Cofrinhos para o mesmo dinheiro.
5. Pool: saída `Cofrinhos`/`Pool` → pendente; distribuir cria `cofrinho_application` sem novo `expense`.
6. Testes unitários do `resolveMovement` para A/B/C + Pool.

## Ordem de implementação sugerida

1. Schema bucket `kind` + `trip_id` + sync na criação da viagem.
2. Resolver + ajuste agregações Cofrinhos (`cofrinhoAggregations`, treemap/summary).
3. Formulário Saídas (viagem picker + paid from cofrinho).
4. Agregação orçamento (`listTripFinanceMovements`) incluindo **B** via `trip_id` + categoria.
5. Migração Aspiração + backfill `trip_id`.

## Self-review

- Placeholders: nenhum.
- Contradição com spec cartão: **A/C** cartão mantêm regra “comprometido cofrinho só Pix”; **B** sempre cofrinho caixa.
- Ambiguidade: renomear Aspiração em dados legados — tratar na migração com lista de buckets do usuário.