# Dashboard — Heatmap de Caixa (design)

**Data:** 2026-05-20  
**Status:** Aprovado (brainstorming)  
**Referência visual:** `base.html` (Heatmap de Caixa + Detalhes do Dia), mockup do usuário  
**Abordagem:** B (módulos dedicados em `js/features/dashboard/`)

## Objetivo

Substituir o bloco **Faturas Próximas** na dashboard por um **calendário heatmap** que mostra, por dia, a intensidade de saídas e entradas, com um painel lateral listando as movimentações do dia selecionado.

## Decisões do usuário

| Tópico | Escolha |
|--------|---------|
| Faturas Próximas | Substituir totalmente (avisos de fatura permanecem no sininho) |
| Data por dia | Campo `date` do lançamento (não vencimento de parcela) |
| Mês exibido | Seguir `#period-filter` do painel (sem seletor próprio no heatmap) |
| Detalhes do dia | Entradas + saídas (cofrinho/investimento como saída), ordenadas por valor |
| Ponto laranja | Vencimento de fatura de cartão naquele dia |
| Botão Nova Movimentação | Abre modal de saída com data = dia selecionado |
| Intensidade vermelha | Relativa ao mês (tercis do maior dia de saída) |
| Arquitetura | Módulos dedicados (abordagem B) |

## Escopo

### Inclui

- Remoção de `#upcoming-invoices-list` e `renderUpcomingInvoices`
- Novo bloco dashboard: calendário (~2/3) + painel detalhes (~1/3)
- Sincronização com `#period-filter` e destaque do gráfico quando `current-year`
- Agregação diária de entradas/saídas por `date`
- Legenda: Vazio, Leve, Médio, Pesado, Entradas, Pendência (fatura)
- Tooltip no hover do dia com totais
- Painel do dia: lista, estado vazio, botão nova saída
- CSS alinhado ao tema escuro existente (`dashboard.css`, `theme-dark.css`)
- Módulos: `cash-heatmap-aggregations.js`, `cash-heatmap-calendar.js`, `cash-heatmap-day-panel.js`

### Não inclui (v1)

- Seletor de mês/ano independente no componente
- Regra `expense-calendar-month` (vencimento de parcela) no heatmap
- Faixas fixas em R$ ou configuração no perfil
- Lista «Faturas Próximas» em outro lugar da dashboard
- Botão para nova entrada (apenas saída)
- Componente reutilizável em `js/shared/` (abordagem C)

## Layout

```
[ dashboard-grid — coluna 1 ]
  Última atividade (mantém)

[ dashboard-cash-heatmap — full width, substitui coluna 2 ]
  ├─ cash-heatmap-calendar (xl: 2/3)
  │    título, subtítulo, badge mês/ano (somente leitura)
  │    grid 7×N, legenda
  └─ cash-heatmap-day-panel (xl: 1/3)
       título data, lista, botão Nova Movimentação
```

Em mobile: calendário empilhado acima do painel (1 coluna).

HTML/CSS espelham estrutura e tokens do protótipo em `base.html` (linhas 301–427), adaptados a classes do app (`list-container`, variáveis CSS existentes).

## Sincronização com período

- Fonte: `document.getElementById('period-filter')` (mesmo select do cabeçalho usado em `reports.js`).
- Valores `month-0` … `month-11`: mês civil do **ano atual** (`getPeriodBounds` / `period-filters.js`).
- Valor `current-year`: mês do destaque no gráfico de fluxo (`applyDashboardPeriodFromChartMonth` / índice enfatizado); fallback = mês atual.
- Badge no canto do calendário: ex. «Maio 2026» (somente leitura, derivado do mês resolvido).
- Ao `change` do filtro: re-agregar e re-renderizar calendário + painel (manter dia selecionado se ainda pertence ao mês; senão dia 1 ou hoje se no mês).

## Agregação por dia

Para cada dia `D` do mês visível:

| Campo | Regra |
|-------|--------|
| `totalSaida` | Soma `amount` de despesas com `movementDateToJsDate(t.date)` no dia D (inclui `isCofrinho` / investimento) |
| `totalEntrada` | Soma `amount` de ganhos com mesma regra de data |
| `temFatura` | Algum cartão de crédito com `getBillingCycle(card).due` no dia D |
| `nivelSaida` | 0 = vazio; 1–3 = tercis do `max(totalSaida)` do mês (exclui zeros) |

### Cores da célula

1. Se `totalSaida > 0`: vermelho leve/médio/pesado conforme `nivelSaida`.
2. Senão, se `totalEntrada > 0`: verde (entrada).
3. Senão: cinza (vazio).
4. Selecionado: anel/ring accent (`--primary-color`).
5. Ponto laranja no canto se `temFatura`.

### Tooltip (hover)

- Dia N
- Entrada total (se > 0)
- Saída total (se > 0)

## Painel «Detalhes do Dia»

- **Seleção inicial:** hoje se pertence ao mês visível; senão dia 1 do mês.
- **Lista:** todos os ganhos e despesas com `date` no dia, ordenados por `amount` decrescente.
- **Item:** ícone entrada/saída/pendente, descrição, conta (nome), tag/categoria se houver, valor formatado, status textual (Pago, Pendente, Recebido conforme tipo).
- **Vazio:** ícone info + «O mapa está limpo. Sem movimentações neste dia.»
- **Botão:** «+ Nova Movimentação» → fluxo existente de nova saída com campo data pré-preenchido para o dia selecionado (reutilizar API/modal já usada na app).

## Arquitetura JS

```
js/features/dashboard/
  cash-heatmap-aggregations.js
    buildMonthDayMap(expenses, gains, accounts, year, month) → Map<day, DayAggregate>
    resolveHeatmapMonthFromPeriod(periodValue, chartEmphasisIndex?) → { year, month }

  cash-heatmap-calendar.js
    renderCashHeatmapCalendar(container, dayMap, selectedDay, onSelectDay)
    destroy / update on period change

  cash-heatmap-day-panel.js
    renderCashHeatmapDayPanel(container, items, selectedDate, onNewExpense)

  dashboard.js
    loadDashboardData → chama heatmap após dados
    remove renderUpcomingInvoices
```

**Dependências existentes:** `movementDateToJsDate`, `formatCurrency`, `getBillingCycle`, `isCreditCardType`, helpers de período em `period-filters.js`, integração com `reports.js` para mês enfatizado quando `current-year`.

**Eventos:** escutar `change` em `#period-filter`; opcionalmente callback quando gráfico altera mês enfatizado (mesmo canal que `applyDashboardPeriodFromChartMonth`).

## Faturas após remoção

- `header-notifications.js` mantém avisos de faturas próximas (sininho).
- Ponto laranja no calendário sinaliza **vencimento** no dia, não valor da fatura.

## Acessibilidade

- Células de dia: `button` ou `role="button"`, `aria-pressed` no selecionado.
- Calendário: `aria-label` com mês/ano.
- Lista do dia: região com `aria-live="polite"` em troca de dia.

## Testes manuais sugeridos

1. Filtro `month-5` (junho): dias com saídas mostram gradiente; dia só com entrada fica verde.
2. Trocar filtro: calendário e badge atualizam.
3. Dia com vencimento de cartão: ponto laranja sem movimentação na lista.
4. Clicar dia: lista ordenada por valor; botão abre saída com data correta.
5. Mês sem lançamentos: calendário cinza; painel vazio.
6. `current-year` + clique em coluna do gráfico: heatmap segue mês destacado.

## Referências no repositório

- Protótipo UI: `base.html` (~301–427)
- Lista atual removida: `index.html` `#upcoming-invoices-list`, `dashboard.js` `renderUpcomingInvoices`
- Período: `js/core/period-filters.js`, `js/features/reports/reports.js` (`#period-filter`)
- Notificações fatura: `js/shared/header-notifications.js`
