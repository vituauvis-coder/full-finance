# Carteira — visual da linha e dos plásticos

**Data:** 2026-11-08  
**Estado:** aprovado na conversa (estrutura A, tratamento plástico, abordagem de refazer a linha)

## Objetivo

Modernizar a página Carteira sem mudar a ordem da tela nem as regras de saldo, fatura, vencimento e compras. Cada cartão vinculado a um banco vira um mini plástico. A linha do banco mostra identidade, titular e saldo ao lado desses plásticos.

## O que permanece

- Seletor de mês civil no topo (`civil-period-timeline--wallet`).
- Três números de resumo: limite total, faturas do mês, poder de compra.
- Uma linha por conta que não é cartão, ordenada como hoje (maior gasto de crédito no mês, depois nome).
- Painel direito: vencimentos de crédito e compras na fatura do mês selecionado.
- Clique no cartão abre o modal de compras já existente (`data-card-id` + `.wallet-card-open`).
- Botões editar e excluir ficam na linha da conta, não sobre o plástico.
- Conta sem nenhum cartão mostra o estado vazio e o atalho “Adicionar cartão de crédito”.
- Cartão de crédito sem conta vinculada continua numa linha órfã.
- Cálculos atuais: `creditCardInstallmentsDueInCalendarMonth` e `expenseCreditInstallmentScheduledForMonthKey`.

## Composição

1. Timeline compacta.
2. Faixa de três indicadores, compacta.
3. Coluna principal: linhas de banco.
4. Coluna direita: vencimentos e compras, com a mesma superfície, raio e escala de texto das linhas.

Em largura menor que 640px, a linha empilha: banco e saldo primeiro, plásticos abaixo, ações no fim. O painel direito desce para baixo da lista.

## Linha do banco

À esquerda:

- Nome da conta.
- Tipo da conta (corrente, poupança, etc.).
- Titular, via `holderUserName` e, se vazio, `holderName`.
- Saldo atual (`currentBalance`).

À direita, os plásticos dos cartões cujo `linkedAccountId` é o id dessa conta. Crédito e débito aparecem juntos. Crédito vem primeiro.

## Mini plástico

Elemento clicável, botão, classes `wallet-plastic wallet-card-open`, atributo `data-card-id`.

Conteúdo:

- Crédito: rótulo “Crédito”, “Vence dia N” quando `dueDay` existe, nome do cartão, e o valor das parcelas com vencimento no mês civil selecionado.
- Débito: rótulo “Débito”, nome do cartão, texto “Sem fatura”. Não calcula nem exibe total de gastos do débito neste bloco.
- Cor: classe de `resolveBankThemeClass` aplicada no plástico quando o nome do banco (ou do cartão, na linha órfã) casa com um tema existente. Sem tema, degradê neutro.
- Vários cartões quebram linha. Não escondem cartão atrás de “ver mais”.

Estado vazio: só quando a conta não tem crédito nem débito. O texto é “Sem cartão de crédito atrelado” e o botão “Adicionar cartão de crédito” permanece. Não se desenha um plástico falso.

Débito sem conta vinculada válida ganha uma linha órfã no mesmo padrão do crédito órfão, com o plástico de débito e a conta marcada como “Sem conta atrelada”.

## Painel e modal

O painel direito não muda de dados. Vencimentos listam cartões de crédito com dia e valor do mês. Compras listam lançamentos de crédito que entram na fatura daquele mês.

O modal de compras (`#card-purchases-modal`) só reduz padding, título e ritmo vertical para acompanhar a Carteira. Colunas, filtros, paginação e confirmação de parcela permanecem.

## Arquivos

- Criar `js/features/finance/wallet-plastic.js` com a função pura que devolve o HTML do plástico e da coluna.
- Alterar `loadWalletPage` em `js/features/finance/transactions.js` para passar crédito e débito a essa função e montar a identidade da linha (nome, tipo, titular, saldo).
- Alterar `css/pages/accounts.css` para a linha, o plástico, a faixa de resumo, o painel e o modal de compras.
- Não alterar `index.html`, salvo um gancho de classe que a marcação atual não tenha. A estrutura da página (`#wallet-page`, timeline, resumo, lista, aside) permanece.

## Fora de escopo

- API, household, titular no cadastro.
- Dashboard, Saídas, Entradas, Cofrinhos, Dívidas.
- Novo cálculo de fatura, saldo ou débito.
- Reescrever `transactions.js` inteiro ou trocar o modal de compras por outra tela.

## Verificação

- Teste de Node na função pura de HTML: crédito inclui valor e `data-card-id`; débito inclui “Sem fatura” e não inclui um valor de fatura; lista vazia inclui o atalho de adicionar crédito.
- No navegador, com a Carteira aberta: mês muda o valor do plástico de crédito e as listas do painel; clique no plástico abre o modal; editar e excluir continuam na linha; conta sem cartão não mostra plástico; débito vinculado aparece ao lado do crédito.
