import type { DayAgg } from '../../../lib/cashHeatmap';
import { formatBRL } from '../../../lib/format';
import { MaterialIcon } from '../../../components/icons/MaterialIcon';
import { MONTH_NAMES } from '../../../lib/period';
import { heatmapToneClass } from '../domain/cashHeatmapTone';

function monthTooltip(agg: DayAgg, currency: string) {
    const parts: string[] = [];
    if (agg.totalEntrada > 0) parts.push(`Entrada ${formatBRL(agg.totalEntrada, currency)}`);
    if (agg.totalSaida > 0) parts.push(`Saída ${formatBRL(agg.totalSaida, currency)}`);
    if (agg.temFatura) parts.push('Fatura(s) no mês');
    return parts.length ? parts.join(' · ') : 'Sem movimentações';
}

type Props = {
    year: number;
    monthMap: Map<number, DayAgg>;
    currency: string;
    onSelectMonth: (monthIndex: number) => void;
    compact?: boolean;
};

export function CashHeatmapYearGrid({ year, monthMap, currency, onSelectMonth, compact = false }: Props) {
    return (
        <div
            className={`cash-heatmap-calendar cash-heatmap-calendar--year-scope${
                compact ? ' cash-heatmap-calendar--compact' : ''
            }`}
            aria-live="polite"
        >
            <header className="cash-heatmap-calendar__header">
                <div>
                    <h3 className="cash-heatmap-calendar__title dashboard-section-title">
                        <MaterialIcon name="calendar_month" variant="app" opticalSize={18} aria-hidden />
                        {compact ? 'Mapa de calor' : 'Heatmap de Caixa'}
                    </h3>
                </div>
                <div className="cash-heatmap-calendar__month-badge">
                    <MaterialIcon name="calendar_today" variant="app" /> {year} (ano inteiro)
                </div>
            </header>
            <div
                className="cash-heatmap-calendar__grid cash-heatmap-calendar__grid--months"
                role="grid"
                aria-label={`Mapa de calor ${year}`}
            >
                {MONTH_NAMES.map((name, monthIndex) => {
                    const agg = monthMap.get(monthIndex) ?? {
                        totalSaida: 0,
                        totalEntrada: 0,
                        temFatura: false,
                        nivelSaida: 0,
                        faturas: []
                    };
                    const tone = heatmapToneClass(agg);
                    const tip = monthTooltip(agg, currency);
                    return (
                        <button
                            key={name}
                            type="button"
                            className={`cash-heatmap-day-btn cash-heatmap-month-btn ${tone}`}
                            aria-label={`${name} ${year}, ${tip}`}
                            title={tip}
                            onClick={() => onSelectMonth(monthIndex)}
                        >
                            <span className="cash-heatmap-day-btn__num">{name}</span>
                            {agg.temFatura ? (
                                <span className="cash-heatmap-day-btn__dot" title="Fatura no mês" />
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}