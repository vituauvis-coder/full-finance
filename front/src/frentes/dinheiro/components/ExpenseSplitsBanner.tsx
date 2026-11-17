import { useMemo } from 'react';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import { apiFetch } from '../../../lib/http';

type SplitRow = {
    id: string;
    amount?: number;
    status?: string;
    description?: string;
    sourceExpenseId?: string;
};

export function ExpenseSplitsBanner() {
    const { data, refresh } = useFinanceData();
    const currency = data?.userProfile?.currency ?? 'BRL';

    const incoming = useMemo(() => {
        const bundle = data?.expenseSplitRequests as { incoming?: SplitRow[] } | undefined;
        return (bundle?.incoming ?? []).filter((s) => String(s.status ?? '').toUpperCase() === 'PENDING');
    }, [data]);

    if (incoming.length === 0) return null;

    async function accept(id: string) {
        await apiFetch(`/api/expense-splits/${encodeURIComponent(id)}/accept`, { method: 'POST', body: '{}' });
        await refresh();
    }

    async function reject(id: string) {
        await apiFetch(`/api/expense-splits/${encodeURIComponent(id)}/reject`, { method: 'POST', body: '{}' });
        await refresh();
    }

    return (
        <div className="expense-splits-banner dashboard-pending-cash-outs" aria-live="polite">
            <h3 className="dashboard-pending-title">
                <i className="fas fa-handshake" aria-hidden="true"></i> Rateios pendentes
            </h3>
            <ul className="dashboard-pending-list">
                {incoming.map((s) => (
                    <li key={s.id} className="dashboard-pending-list__item">
                        <h4 className="split-title">{s.description || 'Rateio de despesa'}</h4>
                        <span className="dashboard-pending-list__amount">{formatBRL(Number(s.amount) || 0, currency)}</span>
                        <div className="split-actions" style={{ display: 'flex', gap: '0.35rem' }}>
                            <button type="button" className="btn-primary btn-small" onClick={() => void accept(s.id)}>
                                Aceitar
                            </button>
                            <button type="button" className="btn-secondary btn-small" onClick={() => void reject(s.id)}>
                                Recusar
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}