/**
 * Textos dos cards de resumo (títulos, descrições de tooltip e hints).
 * Alterações de copy devem ser feitas aqui — não no HTML nem espalhadas no transactions.js.
 */

/** @typedef {{ kind: 'month'|'year'|'other', label: string }} PeriodTitleParts */

export const EXPENSES_SUMMARY_COPY = {
    projection:
        'Gastos que você marcou como essenciais no período — por exemplo aluguel, contas fixas e despesas do dia a dia que não podem faltar.',
    creditCardDefault: 'Quanto você gastou no cartão de crédito neste período.',
    creditCardWithSpend: 'Tudo que você registrou no cartão de crédito neste período, incluindo compras parceladas.',
    creditCardEmpty: 'Você não teve gastos no cartão de crédito neste período.',
    otherDefault:
        'Gastos fora do cartão que não estão marcados como essenciais — por exemplo PIX, débito, transferência ou dinheiro.',
    otherWithSpend:
        'Gastos com conta, PIX, débito ou dinheiro que não são essenciais nem passaram pelo cartão de crédito.',
    otherEmpty: 'Não há gastos deste tipo neste período.',
    filterRequiredHint: 'Marque Pago ou Pendente acima para ver os valores.'
};

export const GAINS_SUMMARY_COPY = {
    total: 'Tudo que entrou no período — salário, extras e outras receitas somadas.',
    projection: 'Dinheiro que ainda deve entrar: receitas do período que você ainda não marcou como recebidas.',
    topCategoryEmpty: 'Ainda não há entradas neste período.',
    filterRequiredHint: 'Marque Recebido ou Pendente acima para ver os valores.'
};

export const WALLET_SUMMARY_COPY = {
    totalLimit: 'Soma do limite de todos os seus cartões de crédito cadastrados.',
    totalLimitScope: 'Soma dos limites dos seus cartões',
    invoices: 'Quanto das parcelas do cartão vence no mês que você selecionou.',
    netPurchasing: 'Quanto sobra na conta depois de considerar as parcelas do cartão neste mês.'
};

export const DASHBOARD_SUMMARY_COPY = {
    titles: {
        balance: 'Saldo em conta',
        income: 'Entradas',
        expenses: 'Saídas',
        projection: 'Balanço'
    },
    balance:
        'Quanto você tem nas contas bancárias no período escolhido. Se o período incluir meses futuros, o valor é uma estimativa a partir do saldo de hoje.',
    income: 'Tudo que entrou no bolso no período, de acordo com os botões Recebido e Pendente que você marcou no topo.',
    expenses: 'Tudo que saiu no período, de acordo com os botões Pago e Pendente que você marcou no topo.',
    projection: 'O que sobrou ou faltou no período: entradas menos saídas. É a mesma ideia do gráfico de fluxo logo abaixo.',
    incomeFacetHint: 'Marque Recebido ou Pendente em Entradas para ver o valor.',
    expenseFacetHint: 'Marque Pago ou Pendente em Saídas para ver o valor.',
    projectionFacetHint: 'Marque pelo menos uma opção em Entradas e em Saídas para ver o balanço.',
    projectionSingleMonthHint: 'Para comparar com o mês anterior, escolha um único mês no filtro de período.',
    balanceVariationHint: 'Não foi possível calcular a variação do saldo neste momento.'
};

export const COFRINHOS_SUMMARY_COPY = {
    pending:
        'Saldo de saídas em «Cofrinhos» na subcategoria Pool, ainda não distribuído nas caixinhas.',
    monthAllocated:
        'Total distribuído nas caixinhas no mês civil atual (aportes registados).',
    totalInBuckets: 'Soma de todo o patrimônio alocado nas caixinhas, em todos os meses.'
};

export const DEBTS_SUMMARY_COPY = {
    totalToday:
        'Soma do saldo mais recente de cada banco com dívida ativa (última atualização registrada).',
    monthTotal:
        'Soma dos saldos de fim de mês de cada banco no mês calendário atual.',
    bankCount: 'Bancos ou instituições com pelo menos uma atualização e dívida não encerrada.'
};

/** Textos da linha de variação % nos cards (quando o filtro não é um mês único, etc.). */
export const MOVEMENT_SUMMARY_VARIATION_COPY = {
    needSingleMonth: 'Escolha um único mês no filtro para comparar com o mês anterior.',
    noPreviousBase: 'No mês passado não havia valor para fazer a comparação.',
    noValues: 'Não há valores neste mês nem no anterior para comparar.',
    vsPreviousMonthLabel: 'vs mês anterior',
    vsPreviousMonthTitle: 'Variação em relação ao mês anterior'
};

/**
 * @param {PeriodTitleParts} periodParts
 * @returns {string}
 */
export function expensesMonthTooltip(periodParts) {
    if (periodParts.kind === 'month') {
        return `Total de gastos em ${periodParts.label}. No cartão, entram as parcelas que vencem nesse mês; nos demais casos, a data em que você registrou o gasto.`;
    }
    if (periodParts.kind === 'year') {
        return 'Total de gastos de janeiro a dezembro. No cartão, contam as parcelas que vencem em cada mês.';
    }
    return 'Total de gastos no período que você escolheu no filtro.';
}

/**
 * @param {boolean} hasSpend
 * @returns {string}
 */
export function expensesCreditCardTooltip(hasSpend) {
    return hasSpend ? EXPENSES_SUMMARY_COPY.creditCardWithSpend : EXPENSES_SUMMARY_COPY.creditCardEmpty;
}

/**
 * @param {boolean} hasSpend
 * @returns {string}
 */
export function expensesOtherTooltip(hasSpend) {
    return hasSpend ? EXPENSES_SUMMARY_COPY.otherWithSpend : EXPENSES_SUMMARY_COPY.otherEmpty;
}

/**
 * @param {string} categoryName
 * @param {string} formattedAmount
 * @returns {string}
 */
export function gainsTopCategoryTooltip(categoryName, formattedAmount) {
    if (categoryName && formattedAmount) {
        return `Sua maior entrada foi em «${categoryName}», somando ${formattedAmount} no período.`;
    }
    return GAINS_SUMMARY_COPY.topCategoryEmpty;
}

/**
 * @param {string} periodLabel
 */
export function expensesSummaryTitles(periodLabel) {
    return {
        month: `Saídas de ${periodLabel}`,
        projection: `Despesas essenciais (${periodLabel})`,
        creditCard: `Cartão de Crédito (${periodLabel})`,
        other: `Outras despesas (${periodLabel})`
    };
}

/**
 * @param {string} periodLabel
 */
export function gainsSummaryTitles(periodLabel) {
    return {
        total: `Entradas de ${periodLabel}`,
        projection: `A receber em ${periodLabel}`,
        topCategory: `Principal categoria de ${periodLabel}`
    };
}

/**
 * HTML do placeholder quando filtros de status impedem ver totais.
 * @param {string} hintText
 */
export function summaryFilterRequiredHintHtml(hintText) {
    const safe = String(hintText ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    return `<span class="card-metric-hint" title="${safe}">—</span>`;
}

/** Definição estrutural dos grupos de cards (montagem no DOM). */
export const MOVEMENT_SUMMARY_CARD_GROUPS = {
    dashboard: {
        ariaLabel: 'Resumo do painel',
        cards: [
            {
                id: 'dashboard-balance',
                valueId: 'dashboard-balance-total',
                titleId: 'dashboard-balance-title',
                tone: 'balance',
                icon: 'fa-wallet',
                title: DASHBOARD_SUMMARY_COPY.titles.balance,
                variationId: 'dashboard-balance-variation',
                description: DASHBOARD_SUMMARY_COPY.balance
            },
            {
                id: 'monthly-income',
                titleId: 'monthly-income-title',
                tone: 'income',
                icon: 'fa-arrow-up',
                title: DASHBOARD_SUMMARY_COPY.titles.income,
                variationId: 'monthly-income-variation',
                description: DASHBOARD_SUMMARY_COPY.income
            },
            {
                id: 'monthly-expenses',
                titleId: 'monthly-expenses-title',
                tone: 'expense',
                icon: 'fa-arrow-down',
                title: DASHBOARD_SUMMARY_COPY.titles.expenses,
                variationId: 'monthly-expenses-variation',
                description: DASHBOARD_SUMMARY_COPY.expenses
            },
            {
                id: 'dashboard-projection',
                valueId: 'dashboard-projection-total',
                titleId: 'dashboard-projection-title',
                tone: 'projection',
                icon: 'fa-chart-area',
                title: DASHBOARD_SUMMARY_COPY.titles.projection,
                variationId: 'dashboard-projection-variation',
                description: DASHBOARD_SUMMARY_COPY.projection
            }
        ]
    },
    expenses: {
        ariaLabel: 'Resumo de saídas',
        cards: [
            {
                id: 'expenses-summary-month',
                tone: 'expense',
                icon: 'fa-calendar-day',
                title: 'Saídas esse mês',
                variationId: 'expenses-summary-variation'
            },
            {
                id: 'expenses-summary-projection',
                tone: 'expense',
                icon: 'fa-anchor',
                title: 'Despesas essenciais no período',
                variationId: 'expenses-summary-projection-variation',
                description: EXPENSES_SUMMARY_COPY.projection
            },
            {
                id: 'expenses-summary-top-cat',
                tone: 'expense',
                icon: 'fa-credit-card',
                title: 'Cartão de Crédito',
                variationId: 'expenses-summary-top-cat-variation',
                description: EXPENSES_SUMMARY_COPY.creditCardDefault
            },
            {
                id: 'expenses-summary-other',
                tone: 'expense',
                icon: 'fa-wallet',
                title: 'Outras despesas',
                variationId: 'expenses-summary-other-variation',
                description: EXPENSES_SUMMARY_COPY.otherDefault
            }
        ]
    },
    gains: {
        ariaLabel: 'Resumo de entradas',
        cards: [
            {
                id: 'gains-summary-total',
                tone: 'income',
                icon: 'fa-calendar-check',
                title: 'Entradas de …',
                variationId: 'gains-summary-variation',
                description: GAINS_SUMMARY_COPY.total
            },
            {
                id: 'gains-summary-projection',
                tone: 'income',
                icon: 'fa-clock',
                title: 'A receber em …',
                variationId: 'gains-summary-projection-variation',
                description: GAINS_SUMMARY_COPY.projection
            },
            {
                id: 'gains-summary-top-cat',
                tone: 'income',
                icon: 'fa-tags',
                title: 'Principal categoria',
                variationId: 'gains-summary-top-cat-variation'
            }
        ]
    },
    wallet: {
        ariaLabel: 'Resumo da carteira',
        cards: [
            {
                id: 'wallet-summary-total-limit',
                titleId: 'wallet-summary-limit-title',
                tone: 'balance',
                icon: 'fa-layer-group',
                title: 'Limite total (crédito)',
                iconClass: 'wallet-summary-kpi-icon--limit',
                iconAriaHidden: true,
                scopeId: 'wallet-summary-total-limit-hint',
                scopeText: WALLET_SUMMARY_COPY.totalLimitScope,
                description: WALLET_SUMMARY_COPY.totalLimit
            },
            {
                id: 'wallet-summary-invoices',
                tone: 'expense',
                icon: 'fa-credit-card',
                title: 'Parcelas no crédito (mês)',
                description: WALLET_SUMMARY_COPY.invoices,
                extraAfterValue: `<div id="wallet-summary-invoices-bar" class="wallet-kpi-progress" role="presentation" aria-hidden="true"><span id="wallet-summary-invoices-bar-fill" class="wallet-kpi-progress__fill"></span></div>`
            },
            {
                id: 'wallet-summary-net',
                tone: 'balance',
                icon: 'fa-balance-scale',
                title: 'Poder de compra real',
                description: WALLET_SUMMARY_COPY.netPurchasing
            }
        ]
    },
    cofrinhos: {
        ariaLabel: 'Resumo dos cofrinhos',
        containerClass: 'cofrinhos-page__summary',
        cards: [
            {
                id: 'cofrinhos-summary-total',
                tone: 'balance',
                icon: 'fa-chart-line',
                title: 'Total nas caixinhas',
                description: COFRINHOS_SUMMARY_COPY.totalInBuckets,
                variationId: 'cofrinhos-summary-total-variation'
            },
            {
                id: 'cofrinhos-summary-month',
                tone: 'cofrinhos',
                icon: 'fa-piggy-bank',
                title: 'Total alocado no mês',
                description: COFRINHOS_SUMMARY_COPY.monthAllocated,
                variationId: 'cofrinhos-summary-month-variation'
            },
            {
                id: 'cofrinhos-summary-pending',
                tone: 'projection',
                icon: 'fa-hourglass-half',
                title: 'Pendente de alocar',
                description: COFRINHOS_SUMMARY_COPY.pending,
                variationId: 'cofrinhos-summary-pending-variation'
            }
        ]
    },
    debts: {
        ariaLabel: 'Resumo das dívidas',
        containerClass: 'debts-page__summary',
        cards: [
            {
                id: 'debts-summary-total',
                tone: 'debts',
                icon: 'fa-landmark',
                title: 'Total hoje',
                description: DEBTS_SUMMARY_COPY.totalToday
            },
            {
                id: 'debts-summary-month',
                tone: 'debts',
                icon: 'fa-chart-line',
                title: 'Total neste mês',
                description: DEBTS_SUMMARY_COPY.monthTotal,
                variationId: 'debts-summary-month-variation'
            },
            {
                id: 'debts-summary-banks',
                tone: 'debts',
                icon: 'fa-building-columns',
                title: 'Bancos com dívida',
                description: DEBTS_SUMMARY_COPY.bankCount,
                hint: 'com saldo registrado'
            }
        ]
    }
};

/** @param {string} cardId */
export function getSummaryCardTitleElementId(cardId) {
    for (const group of Object.values(MOVEMENT_SUMMARY_CARD_GROUPS)) {
        const card = group.cards.find((c) => c.id === cardId);
        if (card) return card.titleId || `${card.id}-title`;
    }
    return `${cardId}-title`;
}
