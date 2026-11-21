import { useMemo, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import type { ExpenseSplitRequest, ExpenseSplitSeed } from '../../../lib/types/finance';
import { useConfirm } from '../../../components/ui/confirm';
import { rejectExpenseSplitRequest } from '../api/expenseSplits';

type Props = {
    onAcceptSplit: (seed: ExpenseSplitSeed) => void;
};

export function ExpenseSplitsBanner({ onAcceptSplit }: Props) {
    const { confirm } = useConfirm();
    const { data, refresh } = useFinanceData();
    const currency = data?.userProfile?.currency ?? 'BRL';
    const [busyId, setBusyId] = useState<string | null>(null);

    const incoming = useMemo(() => {
        const bundle = data?.expenseSplitRequests;
        return (bundle?.incoming ?? []).filter(
            (s: ExpenseSplitRequest) => String(s.status ?? '').toUpperCase() === 'PENDING'
        );
    }, [data]);

    if (incoming.length === 0) return null;

    function buildSeed(s: ExpenseSplitRequest): ExpenseSplitSeed {
        const src = s.sourceExpense;
        const rawIc =
            s.sourceInstallmentCount ?? src?.installmentCount ?? undefined;
        const parsedIc = parseInt(String(rawIc ?? ''), 10);
        return {
            splitRequestId: s.id,
            splitAmount: Number(s.amount) || 0,
            splitScope: s.splitScope,
            sourceExpense: src ?? null,
            sourceInstallmentCount:
                Number.isFinite(parsedIc) && parsedIc >= 2 ? parsedIc : undefined
        };
    }

    async function reject(id: string) {
        const ok = await confirm({
            title: 'Recusar esta divisão?',
            message: 'O solicitante será notificado pelo status.',
            confirmLabel: 'Recusar',
            tone: 'danger'
        });
        if (!ok) return;
        setBusyId(id);
        try {
            await rejectExpenseSplitRequest(id);
            await refresh();
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="expense-splits-banner dashboard-pending-cash-outs" aria-live="polite">
            <h3 className="dashboard-pending-title">
                <i className="fas fa-handshake" aria-hidden="true" /> Rateios pendentes
            </h3>
            <ul className="dashboard-pending-list">
                {incoming.map((s) => {
                    const reqName = s.requester?.name || s.requester?.email || 'Solicitante';
                    const desc = s.sourceExpense?.description || 'Rateio de despesa';
                    return (
                        <li key={s.id} className="dashboard-pending-list__item">
                            <h4 className="split-title">
                                <strong>{reqName}</strong> pediu para dividir{' '}
                                <strong>{formatBRL(Number(s.amount) || 0, currency)}</strong>
                                <br />
                                <small>{desc}</small>
                            </h4>
                            <div className="split-actions" style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                    type="button"
                                    className="btn-primary btn-small"
                                    disabled={busyId === s.id}
                                    onClick={() => onAcceptSplit(buildSeed(s))}
                                >
                                    Aceitar
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    disabled={busyId === s.id}
                                    onClick={() => void reject(s.id)}
                                >
                                    Recusar
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
