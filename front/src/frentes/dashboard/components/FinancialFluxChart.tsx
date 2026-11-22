import { useState } from 'react';
import type { Account, DashboardFacets, Movement, SplitBundle, UserProfile } from '../../../lib/types/finance';
import {
    useFinancialFluxChart,
    type FluxChartScope,
    type FluxChartViz
} from '../hooks/useFinancialFluxChart';
import { FinancialFluxChartCard } from './flux/FinancialFluxChartCard';
import { FinancialFluxChartView } from './flux/FinancialFluxChartView';

type Props = {
    period: string;
    civilYear: number;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    facets: DashboardFacets;
    expenseCategories?: ReadonlySet<string>;
    currency: string;
    userProfile?: UserProfile | null;
    splitRequests?: unknown[] | null;
    splitBundle?: SplitBundle;
    onSelectMonth?: (monthIndex: number, year: number) => void;
};

export function FinancialFluxChart(props: Props) {
    const [chartType, setChartType] = useState<FluxChartScope>('year');
    const [viz, setViz] = useState<FluxChartViz>('bar');

    const {
        series,
        showSaldoTotal,
        balanceLoading,
        toggleSaldoTotal,
        monthIndexForHighlight
    } = useFinancialFluxChart({
        period: props.period,
        civilYear: props.civilYear,
        gains: props.gains,
        expenses: props.expenses,
        accounts: props.accounts,
        facets: props.facets,
        expenseCategories: props.expenseCategories,
        chartType,
        userProfile: props.userProfile,
        splitRequests: props.splitRequests,
        splitBundle: props.splitBundle
    });

    const onMonth = props.onSelectMonth
        ? (index: number) => props.onSelectMonth!(index, props.civilYear)
        : undefined;

    return (
        <FinancialFluxChartCard
            chartType={chartType}
            viz={viz}
            showSaldoTotal={showSaldoTotal}
            balanceLoading={balanceLoading}
            onChartTypeChange={setChartType}
            onVizChange={setViz}
            onToggleSaldo={toggleSaldoTotal}
        >
            <FinancialFluxChartView
                series={series}
                viz={viz}
                currency={props.currency}
                activeMonthIndex={monthIndexForHighlight}
                balanceLoading={balanceLoading}
                showSaldoTotal={showSaldoTotal && chartType === 'year'}
                yearScope={chartType === 'year'}
                onSelectMonth={onMonth}
            />
        </FinancialFluxChartCard>
    );
}