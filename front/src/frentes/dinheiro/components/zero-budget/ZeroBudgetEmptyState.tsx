export function ZeroBudgetEmptyState() {
    return (
        <div className="zero-budget__empty">
            <i className="fas fa-bullseye" aria-hidden="true"></i>
            <p>Nenhum bloco de orçamento criado</p>
            <p className="zero-budget__empty-hint">Use o botão acima para adicionar um bloco ao mês.</p>
        </div>
    );
}