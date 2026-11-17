import type { DayAgg } from '../types/cashHeatmap';

export function heatmapToneClass(agg: Pick<DayAgg, 'totalEntrada' | 'totalSaida' | 'nivelSaida'>) {
    const entrada = agg.totalEntrada || 0;
    const saida = agg.totalSaida || 0;
    if (entrada === 0 && saida === 0) return 'cash-heatmap-day-btn--empty';
    if (saida > entrada) {
        if (agg.nivelSaida >= 3) return 'cash-heatmap-day-btn--out-heavy';
        if (agg.nivelSaida >= 2) return 'cash-heatmap-day-btn--out-mid';
        return 'cash-heatmap-day-btn--out-light';
    }
    if (entrada > saida) return 'cash-heatmap-day-btn--in';
    return 'cash-heatmap-day-btn--empty';
}