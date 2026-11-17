import { colorWithAlpha, chartAxisColors } from './fluxChartTheme';

type Props = {
    x?: number;
    y?: number;
    payload?: { value: string };
    index?: number;
    activeMonthIndex: number;
    yearScope: boolean;
};

export function FluxChartXTick({ x, y, payload, index, activeMonthIndex, yearScope }: Props) {
    const { tick } = chartAxisColors();
    const idx = index ?? -1;
    const active = yearScope && idx === activeMonthIndex;
    return (
        <text
            x={x}
            y={(y ?? 0) + 12}
            textAnchor="middle"
            fill={active ? '#f1f5f9' : colorWithAlpha(tick, 0.55)}
            fontSize={11}
            fontWeight={active ? 600 : 500}
        >
            {payload?.value}
        </text>
    );
}