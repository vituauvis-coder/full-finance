type Props = {
    count: number;
    entityLabel: string;
    onClear: () => void;
    onMarkReceived?: () => void;
    onMarkPending?: () => void;
    onMarkPaid?: () => void;
    onMarkUnpaid?: () => void;
    onEditBatch?: () => void;
};

export function MovementBatchBar({
    count,
    entityLabel,
    onClear,
    onMarkReceived,
    onMarkPending,
    onMarkPaid,
    onMarkUnpaid,
    onEditBatch
}: Props) {
    if (count === 0) return null;

    return (
        <div className="gains-batch-toolbar expenses-batch-toolbar" aria-live="polite">
            <span className="expenses-batch-toolbar__text">
                {count} {entityLabel}(s) selecionada(s)
            </span>
            <div className="expenses-batch-toolbar__actions">
                {onMarkReceived ? (
                    <button type="button" className="btn-secondary" onClick={onMarkReceived}>
                        Marcar recebido
                    </button>
                ) : null}
                {onMarkPending ? (
                    <button type="button" className="btn-secondary" onClick={onMarkPending}>
                        Marcar pendente
                    </button>
                ) : null}
                {onMarkPaid ? (
                    <button type="button" className="btn-secondary" onClick={onMarkPaid}>
                        Marcar pago
                    </button>
                ) : null}
                {onMarkUnpaid ? (
                    <button type="button" className="btn-secondary" onClick={onMarkUnpaid}>
                        Marcar pendente
                    </button>
                ) : null}
                {onEditBatch ? (
                    <button type="button" className="btn-primary" onClick={onEditBatch}>
                        Editar em lote
                    </button>
                ) : null}
                <button type="button" className="btn-secondary expenses-batch-toolbar__clear" onClick={onClear}>
                    Limpar seleção
                </button>
            </div>
        </div>
    );
}