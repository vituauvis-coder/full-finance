import { useMemo } from 'react';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { DebtsBalanceChartView } from './DebtsBalanceChartView';

type Props = {
    debts: Debt[];
    updates: DebtUpdate[];
    currency: string;
};

export function DebtsBalanceChart({ debts, updates, currency }: Props) {
    const empty = useMemo(() => updates.length === 0, [updates.length]);

    return (
        <section className="dashboard-reports-section debts-page__charts-section" aria-label="Gráfico de dívidas">
            <div className="dashboard-reports-charts-grid dashboard-reports-charts-grid--single">
                <div className="reports-chart-container dashboard-flux-chart-card debts-page__chart-card">
                    <ChartHeader />

                    <div className="flux-chart-canvas debts-page__chart-canvas">
                        {empty ? (
                            <p className="debts-page__chart-empty">Registre atualizações para ver o gráfico.</p>
                        ) : (
                            <DebtsBalanceChartView debts={debts} updates={updates} currency={currency} />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function ChartHeader() {
    return (
        <div className="reports-chart-header">
            <h3 className="dashboard-section-title">Evolução por banco</h3>
            <p className="reports-chart-hint">
                Barras: total no mês · Linhas: saldo por credor (um por banco).
            </p>
        </div>
    );
}