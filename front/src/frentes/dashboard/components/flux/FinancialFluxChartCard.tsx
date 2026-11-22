import type { ReactNode } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import { ScreenLoader } from '../../../../components/ui/ScreenLoader';
import type { FluxChartScope, FluxChartViz } from '../../hooks/useFinancialFluxChart';
import { FluxChartLegend } from './FluxChartLegend';

type Props = {
    chartType: FluxChartScope;
    viz: FluxChartViz;
    showSaldoTotal: boolean;
    balanceLoading?: boolean;
    onChartTypeChange: (t: FluxChartScope) => void;
    onVizChange: (v: FluxChartViz) => void;
    onToggleSaldo: () => void;
    children: ReactNode;
};

function ChartTypeToggle({
    ariaLabel,
    children
}: {
    ariaLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="chart-type-toggle" role="group" aria-label={ariaLabel}>
            {children}
        </div>
    );
}

function ChartTypeBtn({
    active,
    onClick,
    children,
    title,
    ariaLabel,
    className = '',
    busy = false
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
    title?: string;
    ariaLabel?: string;
    className?: string;
    busy?: boolean;
}) {
    return (
        <button
            type="button"
            className={`chart-type-btn${className ? ` ${className}` : ''}${active ? ' is-active' : ''}${busy ? ' btn-busy' : ''}`}
            aria-pressed={active}
            aria-busy={busy || undefined}
            aria-label={ariaLabel}
            title={title}
            disabled={busy && active}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function FinancialFluxChartCard({
    chartType,
    viz,
    showSaldoTotal,
    balanceLoading = false,
    onChartTypeChange,
    onVizChange,
    onToggleSaldo,
    children
}: Props) {
    const chartControls = (
        <div className="reports-chart-header-actions dashboard-flux-chart-controls__inner">
            {chartType === 'year' ? (
                <ChartTypeToggle ariaLabel="Saldo em conta no gráfico">
                    <ChartTypeBtn
                        active={showSaldoTotal}
                        onClick={onToggleSaldo}
                        title="Exibir série Saldo em conta (eixo direito)"
                        ariaLabel="Alternar série Saldo em conta no gráfico"
                        className="chart-type-btn--saldo"
                        busy={balanceLoading && showSaldoTotal}
                    >
                        {balanceLoading && showSaldoTotal ? (
                            <ScreenLoader variant="inline" label="Carregando saldo" />
                        ) : (
                            'Saldo em conta'
                        )}
                    </ChartTypeBtn>
                </ChartTypeToggle>
            ) : null}
            <ChartTypeToggle ariaLabel="Escopo do gráfico">
                <ChartTypeBtn active={chartType === 'year'} onClick={() => onChartTypeChange('year')}>
                    Ano
                </ChartTypeBtn>
                <ChartTypeBtn active={chartType === 'month'} onClick={() => onChartTypeChange('month')}>
                    Mês
                </ChartTypeBtn>
            </ChartTypeToggle>
            <ChartTypeToggle ariaLabel="Tipo de visualização">
                <ChartTypeBtn
                    active={viz === 'bar'}
                    onClick={() => onVizChange('bar')}
                    title="Colunas"
                    ariaLabel="Exibir como colunas"
                >
                    <MaterialIcon name="bar_chart" variant="app" className="chart-type-icon" />
                </ChartTypeBtn>
                <ChartTypeBtn
                    active={viz === 'line'}
                    onClick={() => onVizChange('line')}
                    title="Linhas"
                    ariaLabel="Exibir como linhas"
                >
                    <MaterialIcon name="show_chart" variant="app" className="chart-type-icon" />
                </ChartTypeBtn>
            </ChartTypeToggle>
        </div>
    );

    return (
        <div className="dashboard-reports-section" id="dashboard-reports-section">
            <div className="dashboard-reports-charts-grid dashboard-reports-charts-grid--single">
                <div
                    className="reports-chart-container dashboard-flux-chart-card dashboard-flux-panel dashboard-flux-panel--chart-only"
                    id="financial-progression-card"
                    aria-label="Gráfico de fluxo financeiro"
                >
                    <div className="chart-wrapper chart-wrapper--tall chart-wrapper--flux-full flux-chart-canvas dashboard-flux-panel__canvas dashboard-flux-panel__canvas--float">
                        <div
                            className="dashboard-flux-chart-float-bar dashboard-flux-chart-float-bar--split"
                            role="toolbar"
                            aria-label="Legenda e opções do gráfico"
                        >
                            <FluxChartLegend viz={viz} showSaldoTotal={showSaldoTotal && chartType === 'year'} />
                            {chartControls}
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}