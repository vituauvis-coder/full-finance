import { useCallback, useState } from 'react';
import { formatBRL } from '../../../../lib/format';
import { parseMoneyInput } from '../../domain/parseMoneyInput';

type Props = {
    blockId: string;
    allocated: number;
    currency: string;
    maxAllocation: number;
    onCommit: (next: number) => void | Promise<void>;
};

export function ZeroBudgetBlockAmountField({ blockId, allocated, currency, maxAllocation, onCommit }: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    const startEdit = useCallback(() => {
        setDraft(String(allocated));
        setEditing(true);
    }, [allocated]);

    const commit = useCallback(async () => {
        const n = parseMoneyInput(draft);
        setEditing(false);
        if (n == null) return;
        await onCommit(Math.min(n, maxAllocation));
    }, [draft, maxAllocation, onCommit]);

    return (
        <div className="zero-budget__block-amount-wrap" data-zb-amount-wrap={blockId}>
            {editing ? (
                <input
                    type="text"
                    className="zero-budget__block-amount-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft}
                    aria-label="Valor alocado em reais"
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commit()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') void commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <button
                    type="button"
                    className="zero-budget__block-amount-value"
                    title="Clique para editar o valor"
                    aria-label="Valor alocado, editar"
                    onClick={(e) => {
                        e.stopPropagation();
                        startEdit();
                    }}
                >
                    {formatBRL(allocated, currency)}
                </button>
            )}
        </div>
    );
}