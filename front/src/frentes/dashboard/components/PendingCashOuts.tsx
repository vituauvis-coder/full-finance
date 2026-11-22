import { useCallback, useEffect, useState } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { BusyButton } from '../../../components/ui/BusyButton';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { formatBRL } from '../../../lib/format';
import { apiFetch } from '../../../lib/http';
import { runWithBusyAction } from '../../../lib/runWithBusyAction';
import type { PendingCashOutItem } from '../types/pendingCashOut';

type Props = {
    currency: string;
};

export function PendingCashOuts({ currency }: Props) {
    const { refresh } = useFinanceData();
    const [items, setItems] = useState<PendingCashOutItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiFetch<{ items: PendingCashOutItem[] }>('/api/dashboard/pending-cash-outs');
            setItems(r.items ?? []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function confirm(item: PendingCashOutItem) {
        const key = `${item.expenseId}:${item.periodKey}`;
        await runWithBusyAction(
            (busy) => setConfirming(busy ? key : null),
            async () => {
                await apiFetch(`/api/expenses/${encodeURIComponent(item.expenseId)}/confirm-cash-out`, {
                    method: 'POST',
                    body: JSON.stringify({ periodKey: item.periodKey })
                });
                await refresh();
                await load();
            }
        );
    }

    if (loading) return null;
    if (items.length === 0) return null;

    return (
        <div className="dashboard-pending-cash-outs dashboard-pending-cash-outs--modern" aria-live="polite">
            <header className="dashboard-pending-cash-outs__head">
                <div className="dashboard-pending-cash-outs__title-row">
                    <span className="dashboard-pending-cash-outs__icon-wrap" aria-hidden="true">
                        <MaterialIcon name="payments" variant="app" />
                    </span>
                    <h3 className="dashboard-pending-cash-outs__title">Confirmar no saldo</h3>
                    <span className="dashboard-pending-cash-outs__count" aria-label={`${items.length} pendente(s)`}>
                        {items.length}
                    </span>
                </div>
                <p className="dashboard-pending-cash-outs__hint">
                    Fixas e faturas: confirme no extrato (ícone ao lado do valor) ou aqui. O saldo só muda
                    depois da confirmação.
                </p>
            </header>
            <ul className="dashboard-pending-cash-outs__list" id="dashboard-pending-cash-outs-list">
                {items.map((item) => {
                    const key = `${item.expenseId}:${item.periodKey}`;
                    return (
                        <li key={key} className="dashboard-pending-cash-outs__item dashboard-pending-item">
                            <div className="dashboard-pending-cash-outs__main">
                                <span className="dashboard-pending-cash-outs__item-title dashboard-pending-item__title">
                                    {item.title}
                                </span>
                                <span className="dashboard-pending-cash-outs__sep" aria-hidden="true">
                                    ·
                                </span>
                                <span className="dashboard-pending-cash-outs__item-detail dashboard-pending-item__detail">
                                    {item.detail}
                                </span>
                            </div>
                            <div className="dashboard-pending-cash-outs__actions">
                                <span className="dashboard-pending-cash-outs__amount dashboard-pending-item__amount">
                                    {formatBRL(item.amount, currency)}
                                </span>
                                <BusyButton
                                    type="button"
                                    className="dashboard-pending-cash-outs__confirm dashboard-pending-confirm"
                                    busy={confirming === key}
                                    busyLabel="…"
                                    title="Marcar como pago no saldo"
                                    aria-label={`Confirmar pagamento: ${item.title}`}
                                    onClick={() => void confirm(item)}
                                >
                                    <MaterialIcon name="check_circle" variant="app" />
                                    Confirmar
                                </BusyButton>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}