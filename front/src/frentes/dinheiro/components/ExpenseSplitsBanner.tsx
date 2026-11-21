import { useMemo, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import type { ExpenseSplitRequest, ExpenseSplitSeed } from '../../../lib/types/finance';
import { useConfirm } from '../../../components/ui/confirm';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { rejectExpenseSplitRequest } from '../api/expenseSplits';
import { ExpenseSplitIncomingItem } from './ExpenseSplitIncomingItem';

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

    const n = incoming.length;
    const hint =
        n === 1
            ? 'Aceite cria a sua parte; recusar notifica o solicitante.'
            : `${n} solicitações aguardando. Aceite cria a sua parte; recusar notifica o solicitante.`;

    function buildSeed(s: ExpenseSplitRequest): ExpenseSplitSeed {
        const src = s.sourceExpense;
        const rawIc = s.sourceInstallmentCount ?? src?.installmentCount ?? undefined;
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
        <div className="expense-splits-incoming expense-splits-incoming--modern" aria-live="polite">
            <header className="expense-splits-incoming__head">
                <div className="expense-splits-incoming__title-row">
                    <span className="expense-splits-incoming__icon-wrap" aria-hidden="true">
                        <MaterialIcon name="handshake" variant="app" />
                    </span>
                    <h3 className="expense-splits-incoming__title">Rateios pendentes</h3>
                    <span
                        className="expense-splits-incoming__count"
                        aria-label={`${n} pendente(s)`}
                    >
                        {n}
                    </span>
                </div>
                <p className="expense-splits-incoming__hint">{hint}</p>
            </header>
            <ul className="expense-splits-incoming__list" role="list">
                {incoming.map((s) => {
                    const reqName = s.requester?.name || s.requester?.email || 'Solicitante';
                    const desc = s.sourceExpense?.description || 'Rateio de despesa';
                    return (
                        <ExpenseSplitIncomingItem
                            key={s.id}
                            requesterName={reqName}
                            description={desc}
                            amount={Number(s.amount) || 0}
                            currency={currency}
                            busy={busyId === s.id}
                            onAccept={() => onAcceptSplit(buildSeed(s))}
                            onReject={() => void reject(s.id)}
                        />
                    );
                })}
            </ul>
        </div>
    );
}
