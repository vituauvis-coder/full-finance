/**
 * Formata um valor numérico para a moeda definida pelo usuário.
 * @param {number} value O valor a ser formatado.
 * @param {string} userCurrency A moeda do usuário (ex: 'BRL', 'USD', 'EUR').
 * @returns {string} O valor formatado como moeda.
 */
export function formatCurrency(value, userCurrency = 'BRL') {
    if (typeof value !== 'number') {
        value = 0;
    }
    
    const currencyMap = {
        'BRL': { locale: 'pt-BR', currency: 'BRL' },
        'USD': { locale: 'en-US', currency: 'USD' },
        'EUR': { locale: 'de-DE', currency: 'EUR' }
    };
    
    const config = currencyMap[userCurrency] || currencyMap['BRL'];
    
    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency
    }).format(value);
}

/**
 * Converte data de movimento vinda da API (JSON) ou legado Firestore em `Date`.
 * JSON só preserva `{ seconds, nanoseconds }`, sem método `toDate`.
 */
export function movementDateToJsDate(dateField) {
    if (dateField == null) return new Date(0);
    if (typeof dateField.toDate === 'function') return dateField.toDate();
    if (typeof dateField === 'object' && dateField.seconds != null) {
        return new Date(dateField.seconds * 1000);
    }
    if (dateField instanceof Date) return dateField;
    const d = new Date(dateField);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/** Timestamp em segundos para ordenação (movimentos da API). */
export function movementDateToUnixSeconds(dateField) {
    return Math.floor(movementDateToJsDate(dateField).getTime() / 1000);
}

/**
 * Movimento já efetivo para saldo “hoje”: data do lançamento ≤ hoje (calendário local).
 * Lançamentos com data futura não alteram o saldo atual.
 */
export function movementDateIsOnOrBeforeToday(dateField) {
    if (dateField == null) return false;
    const d = movementDateToJsDate(dateField);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    const dCal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const tCal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dCal.getTime() <= tCal.getTime();
}

/** Conta é cartão de crédito (fatura, limite). */
export function isCreditCardType(type) {
    return type === 'cartao_credito';
}

/** Corrente ou poupança — mesmo agrupamento «PIX» das listas (pagamento por conta bancária). */
export function isPixBankAccountType(type) {
    const t = String(type ?? '');
    return t === 'conta_corrente' || t === 'poupanca';
}

export const BANK_CARD_TYPES = new Set(['cartao_credito', 'cartao_debito']);
export const BENEFIT_CARD_TYPES = new Set(['vale_alimentacao', 'vale_refeicao']);
export const BENEFIT_INSTITUTION_TYPES = new Set(['alimentacao', 'refeicao']);

/** Plástico de banco (crédito ou débito). */
export function isBankCardType(type) {
    return BANK_CARD_TYPES.has(String(type ?? ''));
}

/** Plástico de benefício (vale alimentação ou refeição). */
export function isBenefitCardType(type) {
    return BENEFIT_CARD_TYPES.has(String(type ?? ''));
}

/** Qualquer plástico vinculado a uma instituição na Carteira. */
export function isCardAccountType(type) {
    return isBankCardType(type) || isBenefitCardType(type);
}

/** Instituição de vale (ex.: Alelo) — dois vales, sem crédito/débito. */
export function isBenefitWalletInstitution(type) {
    return BENEFIT_INSTITUTION_TYPES.has(String(type ?? ''));
}

/** Tipo persistido ao cadastrar um slot vazio de benefício. */
export function benefitCardTypeForSlot(slot) {
    return slot === 'meal' ? 'vale_refeicao' : 'vale_alimentacao';
}

/**
 * Slot visual na Carteira para um plástico vinculado a uma instituição.
 * @param {string} cardType
 * @param {string} institutionType
 * @returns {'credit'|'debit'|'food'|'meal'|null}
 */
export function walletPlasticSlotForCardType(cardType, institutionType) {
    const t = String(cardType ?? '');
    if (isBenefitWalletInstitution(institutionType)) {
        if (t === 'vale_alimentacao') return 'food';
        if (t === 'vale_refeicao') return 'meal';
        if (t === 'cartao_credito') return 'food';
        if (t === 'cartao_debito') return 'meal';
        return null;
    }
    if (t === 'cartao_credito') return 'credit';
    if (t === 'cartao_debito') return 'debit';
    return null;
}

/**
 * Rótulo compacto na coluna «Tipo» das listas: PIX (corrente/poupança), Débito (cartão débito, dinheiro, outros caixa),
 * Crédito (cartão crédito). Sem conta ou tipo incomum → «—».
 */
export function movementAccountPaymentKindLabel(acc) {
    if (!acc) return '—';
    const t = String(acc.type ?? '');
    if (t === 'cartao_credito') return 'Crédito';
    if (t === 'cartao_debito') return 'Débito';
    if (t === 'vale_alimentacao' || t === 'vale_refeicao') return 'Vale';
    if (t === 'conta_corrente' || t === 'poupanca') return 'PIX';
    if (t === 'dinheiro' || t === 'outros') return 'Débito';
    if (t === 'alimentacao' || t === 'refeicao') return 'Vale';
    if (t === 'investimento') return '—';
    if (isBenefitCardType(t)) return 'Vale';
    if (isBankCardType(t)) return 'Débito';
    return '—';
}

/**
 * Contas que entram no «Saldo total» do dashboard e gráficos: caixa (corrente, poupança, dinheiro, outros).
 * Exclui cartões e conta tipo investimento — posições em ativos usam o módulo Cofrinhos.
 */
export function isCashBalanceAccountType(type) {
    if (isCardAccountType(type)) return false;
    if (type === 'investimento') return false;
    return true;
}

/**
 * Despesa em cartão de crédito ainda não paga não conta como saída de caixa no mês
 * (o valor só afeta caixa quando a fatura for paga / marcada como paga).
 */
export function expenseCountsAsCashOut(expense, account) {
    if (!account) return true;
    if (isCreditCardType(account.type) && expense.isPaid === false) return false;
    return true;
}

/**
 * Calcula o ciclo de faturamento de um cartão de crédito.
 * @param {object} card O objeto do cartão (closeDay/dueDay ou closingDay/dueDate).
 * @returns {object} Um objeto com as datas de início, fim e vencimento do ciclo.
 */
export function getBillingCycle(card) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const closingDay = card.closingDay ?? card.closeDay;
    const dueDayNum = card.dueDate ?? card.dueDay;
    let start, end, due;

    if (!closingDay || !dueDayNum) {
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);
        return { start: startOfMonth, end: endOfMonth, due: endOfMonth };
    }

    if (today.getDate() > closingDay) {
        start = new Date(year, month, closingDay + 1);
        end = new Date(year, month + 1, closingDay);
        due = new Date(year, month + 1, dueDayNum);
    } else {
        start = new Date(year, month - 1, closingDay + 1);
        end = new Date(year, month, closingDay);
        due = new Date(year, month, dueDayNum);
    }
    return { start, end, due };
}

export function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** Cores de eixos/grid para gráficos Chart.js no tema claro ou escuro. */
export function getChartAxisColors() {
    const dark = isDarkTheme();
    return {
        tick: dark ? '#94a3b8' : '#64748b',
        // Grade discreta, levemente “slate” no claro (visual mais editorial)
        grid: dark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(71, 85, 105, 0.07)'
    };
}