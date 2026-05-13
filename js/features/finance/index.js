/**
 * Feature: finanças (despesas, ganhos, contas, cartões).
 * Implementação em ./transactions.js — dividir em submódulos conforme for crescendo.
 */
export {
    initFinance,
    syncFinanceState,
    loadExpensesData,
    loadGainsData,
    loadAccountsData,
    loadCardsData,
    loadWalletPage,
    showPendingSplitsLoginModal
} from './transactions.js';
