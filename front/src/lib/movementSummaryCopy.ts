/** Paridade com `legacy-web/js/core/movement-summary-copy.js`. */

export const GAINS_SUMMARY_COPY = {
    total: 'Tudo que entrou no período — salário, extras e outras receitas somadas.',
    projection:
        'Dinheiro que ainda deve entrar: receitas do período que você ainda não marcou como recebidas.',
    topCategoryEmpty: 'Ainda não há entradas neste período.',
    filterRequiredHint: 'Marque Recebido ou Pendente acima para ver os valores.'
} as const;

export const EXPENSES_SUMMARY_COPY = {
    month: 'Total de gastos no período. No cartão, entram as parcelas que vencem nesse mês; nos demais casos, a data em que você registrou o gasto.',
    projection:
        'Gastos que você marcou como essenciais no período — por exemplo aluguel, contas fixas e despesas do dia a dia que não podem faltar.',
    creditCardDefault:
        'Parcelas do cartão de crédito com vencimento neste período (mês da fatura), incluindo compras parceladas.',
    otherDefault:
        'Gastos fora do cartão que não estão marcados como essenciais — por exemplo PIX, débito, transferência ou dinheiro.',
    filterRequiredHint: 'Marque Pago ou Pendente acima para ver os valores.'
} as const;

export function gainsSummaryTitles() {
    return {
        total: 'Entradas',
        projection: 'A receber',
        topCategory: 'Principal categoria'
    };
}

export function expensesSummaryTitles() {
    return {
        month: 'Saídas',
        projection: 'Despesas essenciais',
        creditCard: 'Cartão de crédito',
        other: 'Outras despesas'
    };
}

export const DEBTS_SUMMARY_COPY = {
    totalToday:
        'Soma do saldo mais recente de cada banco com dívida ativa (última atualização registrada).',
    monthTotal: 'Soma dos saldos de fim de mês de cada banco no mês calendário atual.',
    bankCount: 'Bancos ou instituições com pelo menos uma atualização e dívida não encerrada.'
} as const;

export function debtsSummaryTitles() {
    return {
        totalToday: 'Total hoje',
        monthTotal: 'Total neste mês',
        bankCount: 'Bancos com dívida'
    };
}