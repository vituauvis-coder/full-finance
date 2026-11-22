import { ALL_YEARS_PERIOD, defaultCivilYear } from '../../../lib/period';

/** Página fixa em «todos os anos»; gráfico/metas usam o ano civil vigente. */
export function useCofrinhosPeriodState() {
    const chartYear = defaultCivilYear();
    return {
        period: ALL_YEARS_PERIOD,
        chartYear,
        goalYear: chartYear
    };
}