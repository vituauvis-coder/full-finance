# Viagens compartilhadas no Meu Mundo (household)

Caso real: dois (ou mais) logins na mesma household. O **ambiente Viagens** deve ser um só para a casa. O **módulo Finanças** de cada login continua pessoal. A ponte entre os dois mostra aportes/gastos na ficha da viagem **com identificação de quem lançou**, sem copiar a linha para o extrato do outro.

Complementa `2026-11-16-viagens-design.md`, `2026-11-19-milhas-household-design.md` e `2026-11-19-orcamento-viagem-dinheiro-cartao-design.md`.

## Objetivo

1. Tudo do módulo Viagens (ficha, módulos, milhas, emissões, taxas de conversão) é **visível e editável** por qualquer membro da mesma household.
2. Aportes, gastos e demais movimentos de Dinheiro **não** são compartilhados entre logins.
3. Quando um movimento de Dinheiro se liga a uma viagem (ou o inverso), a viagem compartilhada mostra o lançamento com **autor**; o espelho em Finanças fica só no `user_id` de quem salvou.

## Modelo mental

| Camada | Dono | Quem vê / edita |
|--------|------|------------------|
| Viagens (ficha, hospedagens, roteiros, voos, transporte, feed, checklist, identidade, simulador, milhas, emissões, taxas) | Household | Todos os membros — leitura e edição |
| Finanças (contas, extrato, cofrinhos, dívidas) | Usuário da sessão | Só o dono do login |
| Ponte Viagens ↔ Finanças | Espelho com autor | Na viagem: casa vê com nome; no Dinheiro: só quem lançou |

- `user_id` em `trips` / `miles_*` / `expenses` = criador ou quem registrou (auditoria), **não** ACL exclusiva.
- ACL de Viagens/milhas = membership em `household_members`.
- ACL de Dinheiro = `expenses.user_id` (e regras atuais de contas/household do Dinheiro, inalteradas neste spec).

## Fora de escopo

- Compartilhar extrato geral, cofrinhos ou contas pessoais além do que o Dinheiro já faz hoje.
- Permissões por papel (só leitura) dentro da casa.
- CRDT / merge fino de edições simultâneas no `payload` (mantém last-write-wins).
- Convidar não-membros para uma viagem isolada.

## Schema

### `trips`

```sql
ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trips_household_id_idx ON trips (household_id);
```

- Viagens **novas**: `household_id` obrigatório via `ensureHouseholdForUser(sessionUserId)`.
- Migration de dados: para cada trip, `household_id` = household do `trips.user_id` (criador); se o criador não tiver household, criar com `ensureHouseholdForUser`.
- Remover o comportamento atual de “qualquer usuário autenticado lista/edita qualquer viagem”. List/get/update/delete exigem: usuário é membro de `trips.household_id` **ou** (legado sem household) criador — a migration deve zerar o legado preenchendo `household_id`.

### Milhas — forçar casa

Reaproveita colunas de `2026-11-19-milhas-household-design.md` (`miles_programs.household_id`, `holder_user_id`).

Mudanças de produto neste spec:

- Carteira **nova** sempre grava `household_id` (sem modo pessoal).
- Migration: `UPDATE miles_programs SET household_id = <household do user_id> WHERE household_id IS NULL`.
- Remover toggle UI “Compartilhada com a casa” / descompartilhar.
- Duplicatas mesma `brand` na household: fluxo de fusão (já previsto na spec de milhas v1.5) torna-se **obrigatório** quando houver conflito de índice único `household_id + brand`.

### Taxas e emissões

- `miles_conversion_rates` (ou equivalente): listagem/escrita por programas/household visíveis ao usuário, não só `user_id = sessão`.
- `miles_emission_sims`: listar/editar por `trip_id` quando a viagem é da household do usuário (não filtrar só por `user_id` da sessão). Quem criou o sim permanece em `user_id` para auditoria.

### `expenses` (sem mudança de dono)

Mantém:

- `user_id` — dono do lançamento no Dinheiro
- `trip_id`, `trip_expense_id` — vínculo com a viagem / item do payload

Nenhuma coluna nova obrigatória. Autor na UI da viagem vem do join `expenses.user_id → users`.

## API / repositório

### Trips

- `listTripsForUser(userId)` — `household_id IN (households do user)` (via helper existente tipo `householdIdsForUserSql`).
- `assertTripAccess(userId, tripId)` — membro da household da viagem (substitui `assertTripOwnedByUser` quebrado/inconsistente em `back/index.js`).
- Create: `ensureHouseholdForUser` → grava `household_id`.
- Update/delete: `assertTripAccess`; qualquer membro pode mutar.

### Milhas

- `listProgramsVisible` / `assertProgramAccess`: após migration, praticamente só household; remover caminhos de “descompartilhar”.
- Create program: sempre `household_id`.
- `listEmissions(userId, tripId)` → `assertTripAccess` + listar sims daquele `trip_id` (todos os autores).
- Rates: escopo household / programas visíveis.

### Ponte financeira

- `listTripFinanceMovements(userId, tripId)`:
  1. `assertTripAccess`
  2. Selecionar `expenses` com `trip_id = $tripId` **e** `user_id IN (membros da household da viagem)`
  3. Retornar linhas com `author: { id, name }` (e campos já usados no orçamento)
- Sync viagem → Dinheiro (`syncTripExpensesToFinance` / `syncFinanceExpenseForTripExpense`): continua gravando/atualizando **somente** `expenses.user_id = sessão` (quem salvou). Não criar espelho no Dinheiro dos outros membros.
- Sync Dinheiro → viagem: ao criar/atualizar expense com `trip_id` (categoria viagem / aporte cofrinho→viagens + subcategoria da viagem), a ficha inclui o movimento via agregação acima.

**Fonte canônica do orçamento compartilhado:** a lista agregada de `expenses` com `trip_id` (todos os membros) + itens ainda só no `payload` sem `trip_expense_id` espelhado. Totais da ficha usam essa união **sem duplicar** o mesmo `trip_expense_id`. O bootstrap do Dinheiro pessoal continua listando apenas `expenses.user_id = sessão`.

## UI

- Ficha e módulos de viagem: sem gate por “sou o criador”.
- Orçamento / aportes: lista unificada; cada linha mostra autor (nome do membro).
- Hub de milhas: chip Casa; sem toggle pessoal; se índice único de brand conflitar, abrir fusão.
- Dinheiro: UX atual; seletor de viagem/subcategoria quando categoria for viagem ou aporte para viagens.
- Opcional v1: badge “lançado por X” também em tooltips do orçamento.

## Fluxos de aceite

1. Dois logins da mesma household veem e editam a mesma viagem e as mesmas carteiras de milhas.
2. Login de outra household (ou sem membership) **não** lista nem abre essas viagens.
3. Extrato Dinheiro de A não lista gastos que B lançou; e vice-versa.
4. Gasto de A no Dinheiro ligado à viagem X aparece no orçamento de X para B, com autor A.
5. Gasto criado por B na ficha de X espelha no Dinheiro de B; A vê na viagem com autor B, sem a linha no Dinheiro de A.
6. Aporte (cofrinho / subcategoria viagens) de A aparece como aporte na viagem para a casa, com autor A.
7. Após migration, não restam carteiras de milhas “só pessoais” de membros que já têm household.
8. Testes automatizados: visibilidade trip/household; agregação expenses+autor; sync só no `user_id` de quem salvou; emissões listadas por trip com acesso household.

## Erros e bordas

- Usuário sem household: `ensureHouseholdForUser` antes de criar viagem ou carteira.
- Criador sai da household: viagem permanece com `household_id`; membros restantes continuam com acesso.
- Edição simultânea do `payload`: last-write-wins (`updated_at`), como hoje.
- Fusão de milhas duplicadas: não somar saldos automaticamente (mesmo critério da spec de milhas).

## Relação com specs anteriores

| Spec | Relação |
|------|---------|
| `2026-11-19-milhas-household-design.md` | Toggle opcional → **sempre** household; fusão vira passo necessário na migration/conflito |
| `2026-11-16-viagens-design.md` | ACL deixa de ser “todos autenticados” / “só criador” e passa a household |
| `2026-11-19-orcamento-viagem-dinheiro-cartao-design.md` | Mantém espelho por usuário; adiciona leitura agregada com autor na ficha |

## Critérios de pronto para implementação

- Spec aprovada pelo usuário.
- Plano em `platform/docs/superpowers/plans/` com tarefas ordenadas: migration trips → ACL trips → milhas force-share + rates/emissions → agregação financeira + UI autor → testes.
