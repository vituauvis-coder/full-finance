# Carteira React — checklist de aceite

**Data:** 2026-11-20  
**Referência visual:** [2026-11-08-carteira-visual-design.md](./2026-11-08-carteira-visual-design.md)

## Layout (correção)

- [ ] KPIs em cartões com grade (`movement-summary-card`), sem texto solto.
- [ ] Lista de instituições com `wallet-institution-row` (sem overlap de plásticos).
- [ ] Grid principal + aside em viewport larga; aside abaixo da lista no mobile.
- [ ] `accounts.css` carregado no bundle React.

## Paridade funcional

- [ ] Timeline civil com accent wallet (`CivilPeriodToolbar`).
- [ ] Fatura no mês civil por parcelas com vencimento (motor/legado), não só data da compra.
- [ ] Plástico de crédito: valor formatado BRL, “Vence dia N”, clique abre fluxo de saídas.
- [ ] Placeholders “Adicionar cartão” abrem modal com conta vinculada.
- [ ] Linhas órfãs (cartão sem conta) listadas após bancos ordenados por gasto no mês.
- [ ] Aside: vencimentos por cartão + compras na fatura do mês.

## Modernização (shell)

- [ ] `#wallet-page.wallet-page--modern` com `--dash-stack-gap`.
- [ ] “Nova conta” no header (`page-toolbar`), não no corpo da página.
- [ ] Skeleton de carregamento e véu de rota alinhados.
- [ ] Dark mode sem regressão de contraste nas linhas e plásticos.

## Divergências conhecidas (pré-migração)

- Modal legado `#card-purchases-modal` substituído por navegação para Saídas com filtro de conta (até port do modal).
- Contas benefit (vale alimentação/refeição): paridade parcial na primeira entrega React se dados benefit existirem.