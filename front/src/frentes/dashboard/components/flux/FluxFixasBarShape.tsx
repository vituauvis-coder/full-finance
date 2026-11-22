import type { FluxPoint } from './fluxChartData';
import { barFillOutflow } from './fluxChartTheme';

type BarShapeProps = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: FluxPoint;
    fixaColor: string;
    faturaColor: string;
    emphasis: number;
};

const MIN_SLICE = 0.5;
const SEAM_OVERLAP = 0.65;

function clampRadius(w: number, h: number, rx: number) {
    return Math.min(rx, w / 2, h / 2);
}

/** Retângulo com cantos superiores arredondados (base reta — encosta no segmento de baixo). */
function topRoundedRectPath(x: number, y: number, w: number, h: number, rx: number) {
    const r = clampRadius(w, h, rx);
    if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `Q ${x + w} ${y} ${x + w} ${y + r}`,
        `V ${y + h}`,
        `H ${x}`,
        `V ${y + r}`,
        `Q ${x} ${y} ${x + r} ${y}`,
        'Z'
    ].join(' ');
}

/** Retângulo com cantos inferiores arredondados (topo reto — junção com fatura). */
function bottomRoundedRectPath(x: number, y: number, w: number, h: number, rx: number) {
    const r = clampRadius(w, h, rx);
    if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return [
        `M ${x} ${y}`,
        `H ${x + w}`,
        `V ${y + h - r}`,
        `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `Q ${x} ${y + h} ${x} ${y + h - r}`,
        `V ${y}`,
        'Z'
    ].join(' ');
}

function allRoundedRectPath(x: number, y: number, w: number, h: number, rx: number) {
    const r = clampRadius(w, h, rx);
    if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `Q ${x + w} ${y} ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `Q ${x} ${y + h} ${x} ${y + h - r}`,
        `V ${y + r}`,
        `Q ${x} ${y} ${x + r} ${y}`,
        'Z'
    ].join(' ');
}

export function FluxFixasBarShape({
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    payload,
    fixaColor,
    faturaColor,
    emphasis
}: BarShapeProps) {
    if (!payload || height <= 0 || width <= 0) return null;
    const fixa = payload.saidaFixa;
    const fat = payload.saidaFatura;
    const total = fixa + fat;
    if (total <= 0) return null;

    const idx = payload.index;
    const fatH = height * (fat / total);
    const fixaH = height - fatH;
    const fixaFill = barFillOutflow(fixaColor, idx, emphasis, 0.92);
    const fatFill = barFillOutflow(faturaColor, idx, emphasis, 0.48);
    const rx = 5;

    if (fatH <= MIN_SLICE) {
        return <path d={allRoundedRectPath(x, y, width, height, rx)} fill={fixaFill} />;
    }
    if (fixaH <= MIN_SLICE) {
        return <path d={allRoundedRectPath(x, y, width, height, rx)} fill={fatFill} />;
    }

    const joinY = y + fatH;

    return (
        <g>
            <path d={topRoundedRectPath(x, y, width, fatH + SEAM_OVERLAP, rx)} fill={fatFill} />
            <path
                d={bottomRoundedRectPath(x, joinY - SEAM_OVERLAP, width, fixaH + SEAM_OVERLAP, rx)}
                fill={fixaFill}
            />
        </g>
    );
}