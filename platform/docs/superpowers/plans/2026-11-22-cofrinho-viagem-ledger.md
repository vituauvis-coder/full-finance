# Plano — Cofrinho ↔ Viagem (ledger)

**Spec:** `platform/docs/superpowers/specs/2026-11-22-cofrinho-viagem-ledger-design.md`

## Estado (2026-11-22)

### Concluído

- [x] Migration + boot: `kind`, `trip_id`, `paid_from_cofrinho`
- [x] Caixinha `viagem` por `trip_id` (create/rename/backfill)
- [x] Resolver motor + agregação caixinha (B/C)
- [x] Sync orçamento tipo C espelha no Dinheiro
- [x] API expenses + bootstrap `paidFromCofrinho`
- [x] UI Cofrinhos: seções Reservas / Viagens
- [x] UI Saídas: viagem + pago do cofrinho
- [x] Orçamento: aporte → POST Cofrinhos; overview e resumo com `financeMovements`
- [x] `listTripFinanceMovements` + `ledgerKind`
- [x] Aspiração legado → `kind=reserve`

### Opcional / débito técnico

- [ ] Remover `piggyDeposits` só no payload após migração de dados
- [ ] Listar linhas B na UI de gastos do painel (hoje faixa «Extrato Dinheiro»)
- [ ] Editar/excluir aporte B pela ficha (hoje só via Saídas)