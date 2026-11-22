import { useMemo, useState } from 'react';
import type { ExpenseSplitRequest } from '../../../lib/types/finance';
import { formatBRL } from '../../../lib/format';
import { useConfirm } from '../../../components/ui/confirm';
import { cancelExpenseSplitRequest } from '../api/expenseSplits';
import { normalizeSplitScope } from '@motor/dinheiro/split-net.js';

type Props = {
    outgoing: ExpenseSplitRequest[];
    currency: string;
    onChanged: () => void | Promise<void>;
};

export function ExpenseSplitsOutgoingPanel({ outgoing, currency, onChanged }: Props) {
    const { confirm } = useConfirm();
    const [busyId, setBusyId] = useState<string | null>(null);

    const pending = useMemo(
        () =>
            (outgoing || []).filter((s) => s && String(s.status).toUpperCase() === 'PENDING'),
        [outgoing]
    );

    if (pending.length === 0) return null;

    const n = pending.length;
    const headIntro =
        n === 1
            ? 'A outra pessoa pode aceitar ou recusar no app. Você pode cancelar a qualquer momento antes da resposta.'
            : `${n} solicitações aguardando resposta. Cada destinatário pode aceitar ou recusar no app.`;

    async function onCancel(splitId: string) {
        const ok = await confirm({
            title: 'Remover esta solicitação de divisão?',
            confirmLabel: 'Cancelar solicitação',
            tone: 'danger'
        });
        if (!ok) return;
        setBusyId(splitId);
        try {
            await cancelExpenseSplitRequest(splitId);
            await onChanged();
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="expense-splits-panel expense-splits-panel--outgoing" aria-live="polite">
            <div className="expense-splits-panel__hero">
                <div className="expense-splits-panel__hero-icon" aria-hidden="true">
                    <i className="fas fa-paper-plane" />
                </div>
                <div className="expense-splits-panel__hero-text">
                    <h4 className="expense-splits-panel__title">
                        {n === 1 ? 'Compartilhamento enviado' : 'Compartilhamentos enviados'}
                    </h4>
                    <p className="expense-splits-panel__lead">{headIntro}</p>
                </div>
            </div>
            <ul className="expense-splits-panel__list" role="list">
                {pending.map((s) => {
                    const name = s.recipient?.name || s.recipient?.email || 'Destinatário';
                    const desc = s.sourceExpense?.description || 'Saída';
                    const scopeTxt =
                        normalizeSplitScope(s.splitScope) === 'INSTALLMENT' && s.targetInstallmentIndex
                            ? ` · Parcela ${s.targetInstallmentIndex}`
                            : '';
                    return (
                        <li key={s.id} className="expense-splits-panel__card" data-split-id={s.id}>
                            <div className="expense-splits-panel__card-body">
                                <span
                                    className="expense-splits-panel__status-pill"
                                    title="Aguardando o outro usuário"
                                >
                                    Aguardando
                                </span>
                                <div className="expense-splits-panel__card-main">
                                    <strong className="expense-splits-panel__who">{name}</strong>
                                    <span
                                        className="expense-splits-panel__amount"
                                        aria-label="Valor da parte"
                                    >
                                        {formatBRL(Number(s.amount) || 0, currency)}
                                    </span>
                                    <span className="expense-splits-panel__desc">
                                        {desc}
                                        {scopeTxt}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-secondary expense-splits-panel__cancel expense-split-cancel-btn"
                                disabled={busyId === s.id}
                                onClick={() => void onCancel(s.id)}
                            >
                                <i className="fas fa-times" aria-hidden="true" /> Cancelar
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
