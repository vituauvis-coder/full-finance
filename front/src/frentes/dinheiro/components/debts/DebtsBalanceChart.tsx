import { useMemo } from 'react';
import type { Debt, DebtUpdate } from '../../domain/debtTypes';
import { buildDebtsChartSeries } from './buildDebtsChartSeries';
import { DebtsBalanceChartView } from './DebtsBalanceChartView';
import { DebtsChartLegend } from './DebtsChartLegend';

type Props = {
    debts: Debt[];
    updates: DebtUpdate[];
    currency: string;
};

export function DebtsBalanceChart({ debts, updates, currency }: Props) {
    const { rows, series } = useMemo(() => buildDebtsChartSeries(debts, updates), [debts, updates]);
    const empty = updates.length === 0;

    return (
        <section className="debts-balance-chart" aria-label="Gráfico de dívidas">
            <header className="debts-balance-chart__head">
                <h3 className="debts-balance-chart__title">Evolução por banco</h3>
                <p className="debts-balance-chart__hint">
                    Barras: total no mês · Linhas: saldo por credor (um por banco).
                </p>
            </header>
            {empty ? (
                <p className="debts-balance-chart__empty">Registre atualizações para ver o gráfico.</p>
            ) : (
                <>
                    <div className="debts-balance-chart__plot">
                        <DebtsBalanceChartView rows={rows} series={series} currency={currency} />
                    </div>
                    <DebtsChartLegend series={series} />
                </>
            )}
        </section>
    );
}