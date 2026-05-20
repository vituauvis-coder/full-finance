# Dívidas — melhoria da tela (design)

**Data:** 2026-05-20  
**Status:** Aprovado (brainstorming)  
**Referência visual:** Cofrinhos  
**Abordagem:** C (modular + segundo gráfico de variação)

## Objetivo

Melhorar a tela de Dívidas para acompanhar saldos por banco/instituição (Santander, XP, etc.) e entender **evolução ou queda mês a mês**, com UI alinhada ao padrão Cofrinhos.

## Escopo

### Inclui

- Três cards de resumo no topo (`movements-summary`, padrão Cofrinhos)
- Reorganização da página: resumo → gráficos → tabela
- Gráfico 1: linhas por banco — saldo no fim de cada mês (lógica atual)
- Gráfico 2: barras — variação mensal do **total** consolidado
- Harmonização CSS (`cofrinhos-page` / `dashboard-reports-section` / `reports-chart-container`)
- Modularização JS: `debts-page.js`, `debts-charts.js`, `debts-aggregations.js`
- Modal de cadastro: **mesma UX** (data início + vários meses)

### Não inclui

- Grid de cards por banco (caixinhas)
- Mudança no modelo de dados (`debts` / `debtUpdates`)
- Novo fluxo de cadastro simplificado (1 mês por vez)
- Migração de Firestore/API

## Decisões do usuário

| Tópico | Escolha |
|--------|---------|
| Card principal | Total geral hoje |
| Cards no topo | 3: total + variação vs mês anterior + qtd bancos |
| Gráfico saldo | Uma linha por banco (fim do mês) |
| Gráfico extra | Variação mensal do total (barras) |
| Cards por banco | Não |
| Referência visual | Cofrinhos |
| Cadastro | Manter modal atual |
| Abordagem | C (modular + 2 gráficos) |

## Layout da página

```
[ actions-bar: título + "Nova dívida" ]

[ #debts-summary — 3× movements-summary cards ]

[ dashboard-reports-section — grid 2 colunas (desktop) / 1 (mobile) ]
  ├─ Gráfico 1: Evolução por banco (line)
  └─ Gráfico 2: Variação mensal do total (bar)

[ table-container: histórico de atualizações ]
```

Estrutura HTML espelha `cofrinhos-page`: classes `debts-page`, `debts-page__summary`, `debts-page__charts-section`, `debts-page__chart-card`.

## Cards de resumo — regras

Fonte: `userDebts` + `userDebtUpdates` (já carregados em `loadDebtsData`).

### 1. Total hoje

- Para cada `debt` com `isClosed !== true`, pegar a **atualização mais recente** (`debtUpdates` por `debtId`, maior `date`).
- Somar `amount` dessas atualizações.
- Exibir com `formatCurrency`. Se nenhuma dívida ativa com update → `R$ 0,00` ou `—` (igual outras telas).

### 2. Variação vs mês anterior (total)

- Mês de referência: **mês calendário atual** (timezone local do browser).
- Para cada banco ativo, valor do mês = último update cuja `date` cai naquele mês (mesma regra do gráfico).
- `totalAtual` = soma dos bancos com valor no mês atual.
- `totalAnterior` = soma dos bancos com valor no mês anterior.
- Variação = `totalAtual - totalAnterior` (bancos sem dado no mês não entram na soma daquele mês).
- Card usa `setMovementSummaryMomVariation` (padrão Cofrinhos/Dashboard): valor absoluto + indicador subiu/desceu.

### 3. Quantidade de bancos com dívida

- Contar `debts` onde `isClosed !== true` e existe pelo menos um `debtUpdate` (qualquer data).
- Subtítulo opcional: "bancos cadastrados" ou "com saldo registrado".

## Gráfico 1 — Evolução por banco

- Manter algoritmo atual em `buildDebtsChart` (último valor do mês por `debtId`, `spanGaps: true`).
- Mover para `debts-charts.js`; envolver em `reports-chart-container` + header/hint do Cofrinhos.
- Paleta: usar variáveis CSS do tema quando possível; fallback na paleta atual.

## Gráfico 2 — Variação mensal do total

- Eixo X: meses com pelo menos um update em qualquer banco (mesmo intervalo do gráfico 1).
- Para cada mês `M`: `total(M)` = soma dos últimos valores por banco naquele mês.
- `delta(M)` = `total(M) - total(M-1)`; primeiro mês do intervalo: `delta` = 0 ou omitir barra.
- Tipo: `bar` (Chart.js), uma série "Variação do total".
- Cores: positivo (dívida subiu) = tom de alerta; negativo (dívida caiu) = tom de sucesso — alinhado a `theme-dark.css` / tokens existentes.
- Tooltip: valor formatado + texto "aumento" / "redução".

## Tabela

- Manter colunas: Data, Empresa, Valor, Ações.
- Estilo: `table-container` dentro de `debts-page__apps-section` (nome espelhando Cofrinhos).
- Empty state: mensagem centralizada (sem estilo inline fixo; classe utilitária).

## Modal

- Sem mudança de campos ou validação.
- Ajuste visual leve: tokens de modal globais (como spec Investimentos), se ainda houver hardcodes.

## Arquivos previstos

| Arquivo | Ação |
|---------|------|
| `index.html` | Reestruturar `#debts-page` |
| `css/pages/debts.css` | Estender com classes `debts-page__*` espelhando `cofrinhos.css` |
| `js/features/debts/debts-aggregations.js` | **Novo** — totais, variação, contagem |
| `js/features/debts/debts-charts.js` | **Novo** — line + bar charts |
| `js/features/debts/debts-page.js` | **Novo** — init UI, summary cards, refresh |
| `js/features/debts/debts.js` | Reduzir: formulário/modal + eventos de save/delete |
| `js/app/main.js` ou loader equivalente | Importar `debts-page` em vez de só `debts.js` |

## Critérios de aceite

1. Ao abrir Dívidas, três cards mostram total, variação MoM e quantidade de bancos coerentes com os dados salvos.
2. Gráfico de linhas exibe uma série por banco com saldo fim do mês (comportamento igual ou equivalente ao atual).
3. Gráfico de barras mostra variação do total mês a mês.
4. Layout visual reconhecível como irmão da página Cofrinhos (resumo, blocos de gráfico, tabela).
5. Modal "Nova dívida" funciona como hoje (cadastro multi-mês).
6. Tema claro e escuro legíveis nos cards e gráficos.

## Riscos / notas

- Banco sem update no mês atual: não entra no total do mês, mas pode entrar em "total hoje" via último update — documentar no hint do card 1 se necessário.
- Muitos bancos: legenda do gráfico 1 pode ficar longa; manter `position: 'bottom'` e scroll se > 6 séries (fase 2 se precisar).

## Próximo passo

Após revisão desta spec → `writing-plans` para plano de implementação tarefa a tarefa.
