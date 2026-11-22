import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { ExpenseFormModal } from '../../../components/finance/ExpenseFormModal';
import { GainFormModal } from '../../../components/finance/GainFormModal';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { formatBRL } from '../../../lib/format';
import type { FinanceData } from '../../../lib/types/finance';
import { acceptedOutgoingSplits } from '../domain/splitRequestsForBalance';
import {
    computeDashboardWalletBuckets,
    type DashboardWalletBucketKey
} from '../domain/dashboardWalletBuckets';
import type { DashboardMetricsDisplay } from '../domain/dashboardMetrics';

type Props = {
    data: FinanceData;
    period: string;
    civilYear: number;
    currency: string;
    metrics: DashboardMetricsDisplay;
    /** Oculta “Ver carteira” (página Carteira). */
    showCta?: boolean;
    className?: string;
};

const BUCKET_META: Record<
    DashboardWalletBucketKey,
    { label: string; icon: string; tone: 'fixed' | 'invoice' | 'extra' | 'cofrinhos' }
> = {
    fixed: { label: 'Despesas fixas', icon: 'event_repeat', tone: 'fixed' },
    invoices: { label: 'Faturas', icon: 'credit_card', tone: 'invoice' },
    extra: { label: 'Despesas extras', icon: 'local_mall', tone: 'extra' },
    cofrinhos: { label: 'Cofrinhos', icon: 'savings', tone: 'cofrinhos' }
};

export function DashboardVisualWallet({
    data,
    period,
    civilYear,
    currency,
    metrics,
    showCta = true,
    className = ''
}: Props) {
    const { refresh } = useFinanceData();
    const [expenseModalOpen, setExpenseModalOpen] = useState(false);
    const [gainModalOpen, setGainModalOpen] = useState(false);
    const splits = useMemo(() => acceptedOutgoingSplits(data.expenseSplitRequests), [data.expenseSplitRequests]);
    const buckets = useMemo(
        () => computeDashboardWalletBuckets(data.userExpenses, data.userAccounts, period, civilYear, splits),
        [data.userExpenses, data.userAccounts, period, civilYear, splits]
    );

    return (
        <section
            className={`dashboard-tri-col dashboard-tri-col--wallet${className ? ` ${className}` : ''}`}
            aria-label="Carteira visual"
        >
            <header className="dashboard-tri-col__head">
                <div className="dashboard-wallet__head-lead">
                    <h2 className="dashboard-tri-col__title">
                        <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={18} aria-hidden />
                        Carteira
                    </h2>
                    {showCta ? (
                        <Link
                            className="dashboard-wallet__icon-btn dashboard-wallet__icon-btn--wallet"
                            to="/dinheiro/carteira"
                            title="Ver carteira"
                            aria-label="Ver carteira"
                        >
                            <MaterialIcon name="arrow_forward" variant="app" opticalSize={18} aria-hidden />
                        </Link>
                    ) : null}
                </div>
                {showCta ? (
                    <div className="dashboard-wallet__head-actions">
                        <button
                            type="button"
                            className="dashboard-wallet__icon-btn dashboard-wallet__icon-btn--expense"
                            title="Registrar saída"
                            aria-label="Registrar saída"
                            onClick={() => setExpenseModalOpen(true)}
                        >
                            <MaterialIcon name="remove_circle" variant="app" opticalSize={20} aria-hidden />
                        </button>
                        <button
                            type="button"
                            className="dashboard-wallet__icon-btn dashboard-wallet__icon-btn--gain"
                            title="Registrar entrada"
                            aria-label="Registrar entrada"
                            onClick={() => setGainModalOpen(true)}
                        >
                            <MaterialIcon name="add_circle" variant="app" opticalSize={20} aria-hidden />
                        </button>
                    </div>
                ) : null}
            </header>

            <div className="dashboard-wallet__balance">
                <div className="dashboard-wallet__balance-top">
                    <span
                        className="dashboard-wallet__balance-label"
                        title={
                            metrics.balanceAccountLabel
                                ? 'Saldo calculado da conta principal'
                                : 'Depois do obrigatório, menos extras do mês'
                        }
                    >
                        Saldo em conta
                    </span>
                    {metrics.balanceAccountLabel ? (
                        <span
                            className="dashboard-wallet__account-tag"
                            title={metrics.balanceAccountHolder ?? undefined}
                        >
                            {metrics.balanceAccountLabel}
                            {metrics.balanceAccountHolder ? ` · ${metrics.balanceAccountHolder}` : null}
                        </span>
                    ) : (
                        <span className="dashboard-wallet__account-tag">Fluxo do período</span>
                    )}
                </div>
                <span className="dashboard-wallet__balance-value">{metrics.balance}</span>
            </div>

            <div className="dashboard-wallet__kpis">
                <CompactKpi label="Entradas" value={metrics.incomeReady ? metrics.income : '—'} tone="gain" />
                <CompactKpi label="Saídas" value={metrics.expensesReady ? metrics.expenses : '—'} tone="expense" />
                <CompactKpi
                    label="Balanço"
                    hint="Entradas − essenciais e cartão"
                    value={metrics.projectionReady ? metrics.projection : '—'}
                    tone="neutral"
                />
            </div>

            <div className="dashboard-wallet__buckets" role="list" aria-label="Saídas por tipo">
                {buckets.map((b) => {
                    const meta = BUCKET_META[b.key];
                    return (
                        <div
                            key={b.key}
                            role="listitem"
                            className={`dashboard-wallet__bucket dashboard-wallet__bucket--${meta.tone}`}
                        >
                            <span
                                className={`dashboard-wallet__bucket-icon dashboard-wallet__bucket-icon--${meta.tone}`}
                                aria-hidden
                            >
                                <MaterialIcon name={meta.icon} variant="app" opticalSize={18} />
                            </span>
                            <div className="dashboard-wallet__bucket-body">
                                <span className="dashboard-wallet__bucket-label">{meta.label}</span>
                                <span className="dashboard-wallet__bucket-meta">
                                    {b.count > 0
                                        ? `${b.count} lançamento${b.count === 1 ? '' : 's'}`
                                        : 'Nenhum no mês'}
                                </span>
                            </div>
                            <span className="dashboard-wallet__bucket-amount">
                                {b.amount > 0 ? formatBRL(b.amount, currency) : '—'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {showCta ? (
                <>
                    <ExpenseFormModal
                        open={expenseModalOpen}
                        editing={null}
                        accounts={data.userAccounts}
                        onClose={() => setExpenseModalOpen(false)}
                        onSaved={refresh}
                    />
                    <GainFormModal
                        open={gainModalOpen}
                        editing={null}
                        accounts={data.userAccounts}
                        onClose={() => setGainModalOpen(false)}
                        onSaved={refresh}
                    />
                </>
            ) : null}
        </section>
    );
}

function CompactKpi({
    label,
    value,
    tone,
    hint
}: {
    label: string;
    value: string;
    tone: 'gain' | 'expense' | 'neutral';
    hint?: string;
}) {
    return (
        <div className={`dashboard-wallet__kpi dashboard-wallet__kpi--${tone}`} title={hint}>
            <span className="dashboard-wallet__kpi-label">{label}</span>
            <span className="dashboard-wallet__kpi-value">{value}</span>
        </div>
    );
}