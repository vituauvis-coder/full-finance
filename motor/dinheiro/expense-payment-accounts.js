/** Contas que podem debitar uma saída (PIX / VA). Sem cofrinho-investimento nem plástico. */
export const EXPENSE_PIX_ACCOUNT_TYPES = new Set([
    'conta_corrente',
    'poupanca',
    'dinheiro',
    'outros',
    'alimentacao',
    'refeicao'
]);

export function accountEligibleForExpensePix(acc) {
    return EXPENSE_PIX_ACCOUNT_TYPES.has(String(acc?.type ?? ''));
}