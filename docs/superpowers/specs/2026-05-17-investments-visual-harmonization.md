# Investimentos — harmonização visual (abordagem A)

## Objetivo

Alinhar a página de Investimentos ao padrão visual do Dashboard e do Planejamento (portal minimalista), sem alterar regras de negócio.

## Mudanças

1. **Resumo do mês** — três cards `movements-summary`: pendente, aportado no mês, total nas caixinhas.
2. **Banner pendente** — padrão `dashboard-pending-cash-outs`; oculto quando não há saldo a alocar.
3. **Progresso anual** — painel neutro (`var(--bg-light)`, `var(--shadow)`); KPIs estilo `zero-budget__stat`.
4. **Metas** — títulos em uppercase como blocos do Planejamento.
5. **Gráficos** — envolvidos em `dashboard-reports-section`.
6. **Histórico** — container `reports-chart-container`.
7. **Modais** — tokens do tema global (sem fundo escuro fixo).

## Arquivos

- `index.html`
- `js/features/investments/investments-page.js`
- `css/pages/investments.css`
