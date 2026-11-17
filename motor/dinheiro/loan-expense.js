/** Empréstimo parcelado (conta caixa) — regra usada no back e no calendário. */
function normalizeCategoryToken(s) {
    return String(s ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function isLoanExpense(expense) {
    const cat = normalizeCategoryToken(expense?.category);
    const sub = normalizeCategoryToken(expense?.subcategory);
    const isLoanLabel = (w) => {
        if (!w) return false;
        if (w === 'emprestimo' || w === 'emprestimos') return true;
        if (!w.startsWith('emprestimo')) return false;
        if (w.length === 10) return true;
        const sep = w.charAt(10);
        return !/[a-z0-9]/.test(sep);
    };
    return isLoanLabel(cat) || isLoanLabel(sub);
}