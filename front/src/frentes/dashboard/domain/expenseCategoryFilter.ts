/** Saída entra se nenhuma categoria estiver selecionada ou se a categoria estiver no conjunto. */
export function matchesDashboardExpenseCategories(
    category: string | undefined,
    selected: ReadonlySet<string> | undefined
): boolean {
    if (!selected || selected.size === 0) return true;
    return selected.has(category || '');
}