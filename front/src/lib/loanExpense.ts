export const EXPENSE_LOAN_PAYMENT_VALUE = '__expense_loan__';

export function isLoanExpense(t: { category?: string; subcategory?: string }) {
    const cat = String(t.category ?? '').trim().toLowerCase();
    const sub = String(t.subcategory ?? '').trim().toLowerCase();
    return cat === 'empréstimo' || cat === 'emprestimo' || sub.includes('empréstimo') || sub.includes('emprestimo');
}